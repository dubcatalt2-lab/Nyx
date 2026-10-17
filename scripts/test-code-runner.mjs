import { createServer } from "node:http";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

const upstreamRequests = [];
const runner = createServer((req, res) => {
  let body = "";
  req.setEncoding("utf8");
  req.on("data", chunk => { body += chunk; });
  req.on("end", () => {
    const payload = JSON.parse(body || "{}");
    upstreamRequests.push(payload);
    const failed = String(payload.source_code || "").includes("compile_failure");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(failed
      ? { stdout: null, stderr: null, compile_output: "line 1: test compiler error", message: null, time: "0.02", memory: 512, status: { id: 6, description: "Compilation Error" } }
      : { stdout: "Hello from the runner\n", stderr: null, compile_output: null, message: null, time: "0.01", memory: 384, status: { id: 3, description: "Accepted" } }));
  });
});

let nyx;
try {
  const runnerPort = await listen(runner);
  process.env.NYX_CODE_RUNNER_URL = `http://127.0.0.1:${runnerPort}/submissions?base64_encoded=false&wait=true`;
  const { app } = await import(`../server.js?code-runner-test=${Date.now()}`);
  nyx = createServer(app);
  const nyxPort = await listen(nyx);
  const baseUrl = `http://127.0.0.1:${nyxPort}`;

  async function run(payload, headers = {}) {
    const response = await fetch(`${baseUrl}/api/code-studio/run`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(payload)
    });
    return { response, body: await response.json() };
  }

  const python = await run({ language: "python", code: 'print("Hello")' });
  assert(python.response.status === 200 && python.body.ok && python.body.stdout === "Hello from the runner\n", "Python result was not normalized");
  assert(upstreamRequests[0]?.language_id === 109 && upstreamRequests[0]?.cpu_time_limit === 3 && upstreamRequests[0]?.wall_time_limit === 6, "Python did not use the bounded runtime mapping");

  const sql = await run({ language: "sql", code: "SELECT 1;" });
  assert(sql.response.status === 200 && upstreamRequests[1]?.language_id === 82, "SQL did not use the SQLite runtime");

  const failure = await run({ language: "c", code: "compile_failure" });
  assert(failure.response.status === 200 && !failure.body.ok && failure.body.status === "Compilation Error" && failure.body.diagnostics.includes("test compiler error"), "Compiler diagnostics were not preserved");

  const unsupported = await run({ language: "brainfuck", code: "+." });
  assert(unsupported.response.status === 400, "Unsupported languages were not rejected");
  const empty = await run({ language: "python", code: "" });
  assert(empty.response.status === 400, "Empty code was not rejected");
  const oversized = await run({ language: "python", code: "x".repeat(24_001) });
  assert(oversized.response.status === 413, "Oversized code was not rejected");
  const crossSite = await run({ language: "python", code: "print(1)" }, { "sec-fetch-site": "cross-site" });
  assert(crossSite.response.status === 403, "Cross-site code runs were not rejected");
  assert(upstreamRequests.length === 3, "Rejected code was sent to the runner");
  assert(python.response.headers.get("cache-control") === "private, no-store", "Code runner responses can be cached");

  console.log("Code runner test: mappings, limits, diagnostics, and same-origin guard passed");
} finally {
  if (nyx) await close(nyx);
  await close(runner);
}
