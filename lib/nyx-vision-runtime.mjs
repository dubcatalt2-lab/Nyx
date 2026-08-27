const modelId = "HuggingFaceTB/SmolVLM-256M-Instruct";
const defaultCacheDir = process.platform === "linux"
  ? "/var/lib/nyx/vision-models"
  : undefined;

let runtimePromise = null;

function boundedPrompt(value) {
  const prompt = String(value || "").trim().slice(0, 4_000);
  return prompt || "Describe this image and identify the important visible details.";
}

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const transformers = await import("@huggingface/transformers");
      const cacheDir = String(process.env.NYX_AI_VISION_CACHE_DIR || defaultCacheDir || "").trim();
      if (cacheDir) transformers.env.cacheDir = cacheDir;
      transformers.env.allowLocalModels = true;
      transformers.env.allowRemoteModels = true;

      const processor = await transformers.AutoProcessor.from_pretrained(modelId);
      const model = await transformers.AutoModelForImageTextToText.from_pretrained(modelId, {
        dtype: {
          embed_tokens: "q4",
          decoder_model_merged: "q4",
          vision_encoder: "q4f16"
        },
        session_options: {
          // Keep graph rewrites disabled for parity across the Windows
          // development host and Linux VPS.
          graphOptimizationLevel: "disabled",
          // The VPS has limited memory. ONNX Runtime's default CPU arena and
          // shape-based memory pattern can retain several gigabytes while the
          // vision encoder and decoder run in sequence. Predictable one-thread
          // allocations keep the quantized model safely below that spike.
          enableCpuMemArena: false,
          enableMemPattern: false,
          executionMode: "sequential",
          intraOpNumThreads: 1,
          interOpNumThreads: 1
        }
      });
      return { transformers, processor, model };
    })().catch(error => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

export async function warmNyxVisionRuntime() {
  await loadRuntime();
}

export async function runNyxVisionInference({ buffer, mime, prompt }) {
  const { transformers, processor, model } = await loadRuntime();
  const image = await transformers.RawImage.fromBlob(new Blob([buffer], { type: mime }));
  const question = boundedPrompt(prompt);
  const visualPrompt = [
    `Answer this request using only what is visible in the image: ${question}`,
    "State the main content first, then include the relevant visible details.",
    "If the request asks about text or math, transcribe it exactly when possible.",
    "Be accurate and concise."
  ].join("\n");
  const chat = [{
    role: "user",
    content: [{ type: "image" }, { type: "text", text: visualPrompt }]
  }];
  const formattedPrompt = processor.apply_chat_template(chat, {
    add_generation_prompt: true,
    tokenize: false
  });
  const inputs = await processor(formattedPrompt, [image]);
  const inputLength = Number(inputs.input_ids?.dims?.at(-1) || 0);
  const generate = async currentInputs => {
    const output = await model.generate({ ...currentInputs, max_new_tokens: 96 });
    const tokens = output.tolist()[0]?.slice(inputLength) || [];
    return processor.tokenizer.decode(tokens, { skip_special_tokens: true }).trim();
  };
  let analysis = await generate(inputs);
  const words = analysis.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const repeatedPunctuation = /([^\p{L}\p{N}\s])\1{3,}/u.test(analysis);
  const lowVocabulary = words.length >= 4 && new Set(words).size <= 2;
  if (analysis.length < 12 || repeatedPunctuation || lowVocabulary || (analysis.length > 30 && words.length < 4)) {
    const retryChat = [{
      role: "user",
      content: [{ type: "image" }, { type: "text", text: "Describe the main scene in this image accurately in one or two sentences." }]
    }];
    const retryPrompt = processor.apply_chat_template(retryChat, {
      add_generation_prompt: true,
      tokenize: false
    });
    const retryInputs = await processor(retryPrompt, [image]);
    const retryInputLength = Number(retryInputs.input_ids?.dims?.at(-1) || 0);
    const output = await model.generate({ ...retryInputs, max_new_tokens: 96 });
    const tokens = output.tolist()[0]?.slice(retryInputLength) || [];
    analysis = processor.tokenizer.decode(tokens, { skip_special_tokens: true }).trim();
  }
  if (!analysis) throw new Error("The local vision model returned an empty analysis.");
  return analysis.slice(0, 6_000);
}
