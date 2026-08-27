const modelId = "Xenova/vit-gpt2-image-captioning";
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

      const captioner = await transformers.pipeline("image-to-text", modelId, {
        dtype: "q8",
        session_options: {
          // The VPS has limited memory. ONNX Runtime's default CPU arena and
          // shape-based memory pattern can retain much more than the quantized
          // caption model requires. Predictable one-thread allocations keep
          // image work bounded on the production host.
          enableCpuMemArena: false,
          enableMemPattern: false,
          executionMode: "sequential",
          intraOpNumThreads: 1,
          interOpNumThreads: 1
        }
      });
      return { transformers, captioner };
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
  const { transformers, captioner } = await loadRuntime();
  const image = await transformers.RawImage.fromBlob(new Blob([buffer], { type: mime }));
  const output = await captioner(image, { max_new_tokens: 64 });
  const caption = String(output?.[0]?.generated_text || "").trim();
  if (!caption) throw new Error("The local vision model returned an empty description.");
  const question = boundedPrompt(prompt);
  return [
    `Visible scene: ${caption}`,
    `Image dimensions: ${Number(image.width) || "unknown"} by ${Number(image.height) || "unknown"} pixels.`,
    `User request for context: ${question}`
  ].join("\n").slice(0, 6_000);
}
