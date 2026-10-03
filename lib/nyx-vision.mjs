import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const workerPath = fileURLToPath(new URL("./nyx-vision-worker.mjs", import.meta.url));
const workerTimeoutMs = 180_000;

let inferenceTail = Promise.resolve();
let queuedInferences = 0;

function visionError(message, status = 503) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function runVisionWorker(message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = fork(workerPath, [], {
      env: process.env,
      execArgv: [],
      serialization: "json",
      stdio: ["ignore", "ignore", "ignore", "ipc"]
    });
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(value);
    };
    const timeout = setTimeout(() => {
      worker.kill();
      finish(visionError("Image analysis took too long. Try the image again.", 504));
    }, workerTimeoutMs);
    timeout.unref?.();

    worker.once("error", () => {
      finish(visionError("Image analysis could not start. Try again in a moment."));
    });
    worker.once("exit", () => {
      if (settled) return;
      finish(visionError("Image analysis stopped safely before completing. Try again in a moment."));
    });
    worker.once("message", response => {
      if (response?.ok) {
        finish(null, String(response.result || ""));
        return;
      }
      finish(visionError(
        String(response?.error || "Image analysis failed. Try again in a moment."),
        Number(response?.status) || 503
      ));
    });
    worker.send(message, error => {
      if (!error) return;
      worker.kill();
      finish(visionError("Image analysis could not receive the upload. Try again."));
    });
  });
}

export async function warmNyxVision() {
  await runVisionWorker({ type: "warm" });
}

export async function analyzeNyxImage(input) {
  if (queuedInferences >= 2) {
    throw visionError("Image analysis is busy. Wait a moment and try again.", 429);
  }
  queuedInferences += 1;
  const task = inferenceTail.then(() => runVisionWorker({
    type: "analyze",
    buffer: input.buffer.toString("base64"),
    mime: input.mime,
    prompt: input.prompt
  }));
  inferenceTail = task.catch(() => {});
  try {
    return await task;
  } finally {
    queuedInferences = Math.max(0, queuedInferences - 1);
  }
}
