import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serviceDir = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, [path.join(serviceDir, "launcher.mjs"), "--check"], {
  cwd: serviceDir,
  env: {
    ...process.env,
    STRATUS_API_KEY: "check-only-not-a-production-secret-0000000000000000",
    STRATUS_PUBLIC_ORIGIN: "http://127.0.0.1:3001",
    STRATUS_ACCOUNT_POOL_TARGET: "0"
  },
  stdio: "inherit"
});

child.once("exit", code => {
  process.exitCode = code ?? 1;
});
