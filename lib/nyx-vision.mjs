const modelId = "HuggingFaceTB/SmolVLM-256M-Instruct";
const defaultCacheDir = process.platform === "linux"
  ? "/var/lib/nyx/vision-models"
  : undefined;

let runtimePromise = null;
let inferenceTail = Promise.resolve();
let queuedInferences = 0;

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

      // Load sequentially. Besides keeping startup memory steadier, this avoids
      // opening several large model downloads at once on a fresh installation.
      const processor = await transformers.AutoProcessor.from_pretrained(modelId);
      const model = await transformers.AutoModelForImageTextToText.from_pretrained(modelId, {
        dtype: {
          embed_tokens: "q4",
          decoder_model_merged: "q4",
          vision_encoder: "q4f16"
        },
        // ONNX Runtime can incorrectly fuse a layer-normalization cast in the
        // quantized vision encoder. Disabling graph rewrites keeps the small
        // model portable across the Windows development host and Linux VPS.
        session_options: { graphOptimizationLevel: "disabled" }
      });
      return { transformers, processor, model };
    })().catch(error => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

async function releaseRuntime(runtime) {
  runtimePromise = null;
  try {
    await runtime?.model?.dispose?.();
  } catch {}
}

async function runInference({ buffer, mime, prompt }) {
  const runtime = await loadRuntime();
  const { transformers, processor, model } = runtime;
  try {
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
  } finally {
    await releaseRuntime(runtime);
  }
}

export async function warmNyxVision() {
  const runtime = await loadRuntime();
  await releaseRuntime(runtime);
}

export async function analyzeNyxImage(input) {
  if (queuedInferences >= 2) {
    const error = new Error("Image analysis is busy. Wait a moment and try again.");
    error.status = 429;
    throw error;
  }
  queuedInferences += 1;
  const task = inferenceTail.then(() => runInference(input));
  inferenceTail = task.catch(() => {});
  try {
    return await task;
  } finally {
    queuedInferences = Math.max(0, queuedInferences - 1);
  }
}
