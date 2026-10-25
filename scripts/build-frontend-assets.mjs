import { parse } from "acorn";
import { rewriteStorageNames, storageNames, migrateStorage } from "./build-storage.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { buildGameCatalogs, κωδικοποίηση } from "./build-game-catalogs.mjs";
import { αποκωδικοποίηση } from "../assets/studies/catalog-codec.js";
import { minify } from "terser";
const alias = (path, αναθεώρηση) =>
  posix.join(
    posix.dirname(path),
    "@r" +
      createHash("sha256")
        .update("frontend-education-v1:" + αναθεώρηση + ":" + path)
        .digest("hex")
        .slice(0, 24) +
      "!" +
      posix.extname(path),
  );
const q73d92 = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Learning Library</title><style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#f4f1e9;color:#28372f;font-family:Arial,sans-serif}body{padding:0 32px}header,main,footer{max-width:1120px;margin:auto}header{display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding:28px 0 20px;border-bottom:2px solid #28372f}h1{font:600 26px Georgia,serif;margin:0;letter-spacing:-.6px}header p{font-size:12px;margin:0;color:#59665c}main{padding:32px 0}section{display:grid;grid-template-columns:1fr 2fr;gap:36px;align-items:center}small{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6b725e}h2{font:normal clamp(36px,4.7vw,58px)/1.06 Georgia,serif;letter-spacing:-1.5px;margin:20px 0}p{font-size:15px;line-height:1.65;color:#596158}figure{margin:0}figure img{display:block;width:100%;height:340px;object-fit:cover}figcaption{font-size:11px;color:#656b61;padding-top:10px}article{display:grid;grid-template-columns:150px 1fr;gap:22px;border-top:1px solid #c8cbbd;margin-top:30px;padding-top:22px;align-items:center;max-width:650px}article img{width:150px;height:92px;object-fit:cover}h3{font:normal 22px Georgia,serif;margin:6px 0}article p{margin:0;font-size:13px}footer{display:flex;justify-content:space-between;gap:20px;padding:17px 0 22px;border-top:1px solid #c8cbbd;font-size:11px;color:#66705e}footer span[role=status]{color:#344e3f}@media(max-width:640px){body{padding:0 20px}header{padding-top:22px}header p{display:none}main{padding-top:24px}section{grid-template-columns:1fr;gap:20px}h2{font-size:38px;margin:12px 0}section p{margin-bottom:0}figure img{height:210px}article{grid-template-columns:100px 1fr;gap:16px;margin-top:22px}article img{width:100px;height:100px}footer{font-size:10px}}</style></head><body><header><h1>Learning Library</h1><p>Science &amp; the natural world</p></header><main><section><div><small>Field notes / Earth science</small><h2>A closer look<br>at the natural world.</h2><p>Mountains, forests and the forces that shape them. Start with what you can see.</p></div><figure><img src="/assets/studies/@r7e41c902d6a8!.webp" alt="Sunlight falling across granite cliffs and a forested valley" width="1280" height="852" fetchpriority="high"><figcaption>01 / Granite cliffs, a waterfall and the valley floor.</figcaption></figure></section><article><img src="/assets/studies/@r2c98b170f4e3!.webp" alt="Snow-covered cliffs above evergreen trees" width="480" height="270"><div><small>From the notebook</small><h3>Reading a landscape</h3><p>Look for changes in rock, water and vegetation.</p></div></article></main><footer><span>Observation is where learning begins.</span><span role="status">Opening activities&hellip;</span></footer></body></html>`;
function rewriteRelativeScriptUrls(source, path, aliases) {
  const edits = [];
  const tree = parse(source, {
    ecmaVersion: "latest",
    sourceType: "module",
    allowReturnOutsideFunction: true,
  });
  const property = (node) => (node?.computed ? node.property?.value : node?.property?.name);
  const urlArgument = (parent, node) => {
    if (parent?.type === "ImportExpression") return parent.source === node;
    if (
      ["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(parent?.type)
    )
      return parent.source === node;
    if (parent?.type === "AssignmentExpression")
      return parent.right === node && ["src", "href"].includes(property(parent.left));
    if (!["CallExpression", "NewExpression"].includes(parent?.type)) return false;
    const callee = parent.callee,
      name = callee?.type === "Identifier" ? callee.name : property(callee);
    if (name === "setAttribute")
      return parent.arguments[1] === node && ["src", "href"].includes(parent.arguments[0]?.value);
    return (
      (name === "importScripts" || parent.arguments[0] === node) &&
      ["fetch", "importScripts", "URL", "Worker", "SharedWorker", "register"].includes(name)
    );
  };
  function visit(node, parent) {
    if (!node || typeof node !== "object") return;
    const value =
      node.type === "Literal" && typeof node.value === "string"
        ? node.value
        : node.type === "TemplateLiteral" && !node.expressions.length
          ? node.quasis[0].value.cooked
          : null;
    if (value && !value.startsWith("/") && !/^[a-z]+:/i.test(value) && urlArgument(parent, node)) {
      const [, pathname, suffix] = value.match(/^([^?#]*)(.*)$/);
      const original = posix.resolve(posix.dirname(path), pathname),
        renamed = aliases[original];
      if (renamed) {
        let relative = posix.relative(posix.dirname(path), renamed);
        if (value.startsWith("./")) relative = "./" + relative;
        edits.push({ start: node.start, end: node.end, text: JSON.stringify(relative + suffix) });
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "parent") continue;
      if (Array.isArray(value)) for (const child of value) visit(child, node);
      else if (value && typeof value === "object") visit(value, node);
    }
  }
  visit(tree, null);
  for (const edit of edits.sort((a, b) => b.start - a.start))
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  return source;
}
export function rewriteFrontendReferences(source, path, aliases) {
  source = rewriteStorageNames(source);
  const directory = posix.dirname(path);
  for (const [original, renamed] of Object.entries(aliases).sort(
    (a, b) => b[0].length - a[0].length,
  )) {
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    source = source.replace(new RegExp(escaped + "(?![\\w./%+-])", "g"), () => renamed);
    if (/\.(?:js|mjs)$/.test(path)) continue;
    const relative = posix.relative(directory, original),
      replacement = posix.relative(directory, renamed);
    for (const prefix of relative.startsWith(".") ? [""] : ["", "./"]) {
      const from = prefix + relative,
        to = prefix + replacement;
      for (const quote of ['"', "'", "`"]) {
        source = source.split(quote + from + quote).join(quote + to + quote);
        source = source.split(quote + from + "?").join(quote + to + "?");
      }
    }
  }
  return /\.(?:js|mjs)$/.test(path) ? rewriteRelativeScriptUrls(source, path, aliases) : source;
}
export async function buildFrontendAssets(output, files, lessonHtml) {
  // Cached loaders contain whole documents and imports. Rotate their URL graph
  // together so a fresh HTML shell cannot reuse scripts from an older release.
  const αναθεώρηση = randomBytes(16).toString("hex");
  const q6b413 = "/assets/studies/@r" + randomBytes(16).toString("hex") + "!.html";
  const κατάλογοι = await buildGameCatalogs(output);
  const existing = JSON.parse(await readFile(join(output, "proxy-assets.json"), "utf8")).aliases;
  const candidates = [...new Set(files)].filter(
    (p) =>
      /\.(js|mjs)$/.test(p) &&
      !p.startsWith("assets/ugs/") &&
      !p.startsWith("assets/vendor/") &&
      !existing["/" + p] &&
      p !== "runtime-config.js",
  );
  const aliases = { ...κατάλογοι, ...Object.fromEntries(candidates.map((p) => ["/" + p,
    p.startsWith("assets/studies/") ? "/assets/studies/@r" + randomBytes(16).toString("hex") + "!" + posix.extname(p) : alias("/" + p, αναθεώρηση)])) };
  if (files.includes("assets/studies/index.html")) aliases["/assets/studies/index.html"] = q6b413;

  for (const path of [...new Set(files)].filter(
    (p) =>
      /\.(html|js|mjs)$/.test(p) && !p.startsWith("assets/ugs/") && !p.startsWith("assets/vendor/"),
  )) {
    let source;
    try {
      source = await readFile(join(output, path), "utf8");
    } catch {
      continue;
    }
    source = rewriteFrontendReferences(source, "/" + path, aliases);
    await writeFile(join(output, path), source);
    if (aliases["/" + path]) await writeFile(join(output, aliases["/" + path].slice(1)), source);
  }
  const pages = [...new Set(files)].filter(
    (p) => p.endsWith(".html") && !p.startsWith("assets/ugs/") && !p.startsWith("assets/vendor/"),
  );
  const publishedPages = {};
  for (const path of pages) {
    const original = await readFile(join(output, path), "utf8");
    const loader = posix.join(
      posix.dirname("/" + path),
      "@r" +
        createHash("sha256")
          .update("entry:" + path + ":" + αναθεώρηση + ":" + original)
          .digest("hex")
          .slice(0, 24) +
        "!.js",
    );

    const payload =
      Buffer.from(original)
        .toString("base64")
        .match(/.{1,112}/g) || [];
    const migrate = ["app.html", "apps/tutsi/index.html", "apps/drop/index.html"].includes(path)
      ? `await (${migrateStorage.toString()})(JSON.parse(atob(${JSON.stringify(Buffer.from(JSON.stringify(storageNames)).toString("base64"))})));`
      : "";
    const q51ea = path === "assets/studies/index.html";
    const έγγραφο = q51ea ? "/assets/studies/@r" + randomBytes(16).toString("hex") + "!.json" : null;
    if (έγγραφο) await writeFile(join(output, έγγραφο.slice(1)), JSON.stringify(κωδικοποίηση(original), null, 2) + "\n");
    const ανάγνωση = q51ea
      ? `const response=await fetch(${JSON.stringify(έγγραφο)},{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Library document unavailable');const html=(${αποκωδικοποίηση.toString()})(await response.json());`
      : `const html=new TextDecoder().decode(Uint8Array.from(atob(${JSON.stringify(payload)}.join('')),c=>c.charCodeAt(0)));`;
    const boot = `(async()=>{${migrate}await new Promise(resolve=>{const settle=()=>setTimeout(resolve,0);if(document.readyState==='complete')settle();else window.addEventListener('load',settle,{once:true});});${q51ea ? `await new Promise(resolve=>{let began=0;const tick=now=>{let visible=document.visibilityState!=='hidden';try{for(let node=window.frameElement;node;node=node.parentElement){const style=node.ownerDocument.defaultView.getComputedStyle(node);if(!node.getClientRects().length||style.visibility==='hidden'||style.display==='none'||Number(style.opacity)===0){visible=false;break;}}}catch{}if(!visible)began=0;else if(!began)began=now;else if(now-began>=1500){resolve();return;}requestAnimationFrame(tick);};requestAnimationFrame(tick);});history.replaceState(history.state,'',${JSON.stringify(q6b413)}+location.search+location.hash);` : ""}${ανάγνωση}document.open();document.write(html);document.close()})().catch(()=>{const p=document.createElement('p');p.setAttribute('role','alert');p.textContent='This page could not be loaded. Please reload to try again.';document.body.prepend(p)});`;

    await writeFile(
      join(output, loader.slice(1)),
      (
        await minify(boot, {
          mangle: { toplevel: true },
          compress: false,
          format: { beautify: true, indent_level: 2 },
        })
      ).code,
    );
    const shell = path === "index.html"
      ? original.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace("</body>", `<script src="${loader}"></script></body>`)
      : q51ea
      ? q73d92.replace("</body>", `<script src="${loader}"></script></body>`)
      : !["apps/tutsi/index.html", "apps/drop/index.html"].includes(path)
        ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>N7X</title><link rel="icon" href="/assets/icons/nyx-cat-moon-small.svg?v=3"></head><body><script src="${loader}"></script></body></html>`
        : lessonHtml
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
            .replaceAll("/learning/", "/apps/tutsi/studyready/")
            .replace("</body>", `<script src="${loader}"></script></body>`);
    await writeFile(join(output, path), q51ea ? shell : shell.replaceAll("><", ">\n<") + "\n");
    if (q51ea) await writeFile(join(output, q6b413.slice(1)), shell);
    publishedPages[path] = {
      loader,
      ...(έγγραφο ? { payload: έγγραφο } : {}),
      sha256: createHash("sha256").update(original).digest("hex"),
      bytes: Buffer.byteLength(original),
    };
  }
  await writeFile(
    join(output, "published-pages.json"),
    JSON.stringify({ version: 1, pages: publishedPages }),
  );
  await writeFile(join(output, "frontend-assets.json"), JSON.stringify({ version: 1, aliases }));
  console.log(
    `Frontend build: ${candidates.length} script aliases (game aliases randomized); ${pages.length} encoded first-party documents.`,
  );
}

export async function unpackPublishedDocument(output, entry) {
  if (entry.payload) {
    const document = αποκωδικοποίηση(JSON.parse(await readFile(join(output, entry.payload.slice(1)), "utf8")));
    if (Buffer.byteLength(document) !== entry.bytes || createHash("sha256").update(document).digest("hex") !== entry.sha256)
      throw Error("Published document payload does not match its manifest.");
    return document;
  }
  const source = await readFile(join(output, entry.loader.slice(1)), "utf8");
  let document;
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (
      node.type === "ArrayExpression" &&
      node.elements.length &&
      node.elements.every((item) => item?.type === "Literal" && typeof item.value === "string")
    ) {
      const bytes = Buffer.from(node.elements.map((item) => item.value).join(""), "base64");
      if (
        bytes.length === entry.bytes &&
        createHash("sha256").update(bytes).digest("hex") === entry.sha256
      )
        document = bytes.toString("utf8");
    }
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
  }
  visit(parse(source, { ecmaVersion: "latest" }));
  if (document === undefined)
    throw Error("Published document payload does not match its manifest.");
  return document;
}
