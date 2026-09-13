import { runNyxVisionInference, warmNyxVisionRuntime } from "./nyx-vision-runtime.mjs";

let handled = false;

function finish(payload, exitCode = 0) {
  if (typeof process.send !== "function") process.exit(exitCode);
  process.send(payload, () => {
    process.disconnect?.();
    process.exit(exitCode);
  });
}

process.on("message", async message => {
  if (handled) return;
  handled = true;
  try {
    if (message?.type === "warm") {
      await warmNyxVisionRuntime();
      finish({ ok: true, result: "ready" });
      return;
    }
    if (message?.type !== "analyze") throw new Error("Invalid vision-worker request.");
    const encoded = String(message.buffer || "");
    if (!encoded) throw new Error("The image payload is empty.");
    const result = await runNyxVisionInference({
      buffer: Buffer.from(encoded, "base64"),
      mime: String(message.mime || ""),
      prompt: String(message.prompt || "")
    });
    finish({ ok: true, result });
  } catch (error) {
    finish({
      ok: false,
      error: String(error?.message || "Image analysis failed.").slice(0, 500),
      status: Number(error?.status) || 503
    }, 1);
  }
});
