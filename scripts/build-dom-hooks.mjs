import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "acorn";

const targeted = /game|librar(?:y|ies)|play|arcade|^gif-(?:picker|grid)$/i;
const property = (node) => node?.computed ? node.property?.value : node?.property?.name;
const textOf = (node) => node?.type === "Literal" && typeof node.value === "string" ? node.value :
  node?.type === "TemplateLiteral" ? node.quasis.map(q => q.value.cooked || "").join(" ") :
  node?.type === "BinaryExpression" && node.operator === "+" ? textOf(node.left) + textOf(node.right) : "";
const words = (text) => String(text).match(/[A-Za-z_][\w-]*/g) || [];
const dataName = (name) => "data-" + name.replace(/[A-Z]/g, c => "-" + c.toLowerCase());
const dataKey = (name) => name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
export const domHookAlias = (kind, name) => (name.startsWith("-") ? "-" : "") + "study-" + BigInt("0x" + createHash("sha256")
  .update("dom-hooks-v2:" + kind + ":" + name).digest("hex").slice(0, 15)).toString() + (name.endsWith("-") ? "-" : "");

export function createDomHookTransform() {
  const names = { class: new Map(), id: new Map(), attribute: new Map() };
  let πλήρης = false;
  const add = (kind, name) => {
    // These markers are shared with the separately published text-presentation runtime.
    if (kind === "attribute" && ["data-user-content", "data-no-interface-text", "data-chat-history", "data-chat-messages"].includes(name)) return;
    if (!πλήρης && !targeted.test(name)) return;
    names[kind].set(name, kind === "attribute" ? "data-" + domHookAlias(kind, name) : domHookAlias(kind, name));
  };
  const tokens = (kind, text) => words(text).forEach(name => add(kind, name));
  const attributes = /\b(class|id|for|aria-labelledby|aria-describedby|data-[\w-]+)\s*=\s*(["'])(.*?)\2/gs;
  const scriptKind = (attrs) => {
    const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() || "";
    return ["", "module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"].includes(type) ? type : null;
  };
  const collectMarkup = (text) => {
    for (const match of text.matchAll(attributes)) {
      if (match[1] === "class" || match[1] === "id") tokens(match[1], match[3]);
      else if (match[1].startsWith("data-")) add("attribute", match[1]);
    }
  };
  const tree = (source, module) => {
    const options = { ecmaVersion: "latest", sourceType: module ? "module" : "script", allowHashBang: true };
    try { return parse(source, options); }
    catch (error) { if (module) throw error; return parse(source, { ...options, sourceType: "module" }); }
  };
  const walk = (node, parents, visit) => {
    if (!node || typeof node !== "object") return;
    visit(node, parents);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(child => walk(child, [...parents, node], visit));
      else if (value && typeof value === "object" && value.type) walk(value, [...parents, node], visit);
    }
  };
  const classCall = (node) => node?.type === "CallExpression" && property(node.callee?.object) === "classList";
  const dataset = (node) => node?.type === "MemberExpression" && property(node.object) === "dataset";
  function collect(source, path) {
    πλήρης = /^(?:assets\/(?:studies|gms-studies)\/|apps\/cloud-studies\/)/.test(path);
    if (path.endsWith(".html")) {
      collectMarkup(source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ""));
      source.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_, attrs, code) => {
        if (code.trim() && scriptKind(attrs) !== null)
          collect(code, path + (scriptKind(attrs) === "module" ? ".inline.mjs" : ".inline.js"));
        return _;
      });
      return;
    }
    if (!/\.(?:js|mjs)$/.test(path)) return;
    let program;
    try { program = tree(source, path.endsWith(".mjs")); } catch (error) { error.message += " in " + path; throw error; }
    walk(program, [], (node) => {
      if (node.type === "Literal" && typeof node.value === "string" && /<[a-z]/i.test(node.value)) collectMarkup(node.value);
      if (node.type === "TemplateLiteral") node.quasis.forEach(q => collectMarkup(q.value.cooked || ""));
      if (node.type === "AssignmentExpression" && property(node.left) === "className") tokens("class", textOf(node.right));
      if (node.type === "AssignmentExpression" && property(node.left) === "id" && textOf(node.right)) add("id", textOf(node.right));
      if (classCall(node)) node.arguments.forEach(arg => tokens("class", textOf(arg)));
      if (dataset(node) && typeof property(node) === "string") add("attribute", dataName(property(node)));
      if (node.type === "CallExpression" && property(node.callee) === "setAttribute") {
        const name = textOf(node.arguments[0]);
        if (name === "id" || name === "class") tokens(name, textOf(node.arguments[1]));
        else if (name.startsWith("data-")) add("attribute", name);
      }
    });
  }
  const replaceToken = (kind, value) => {
    if (names[kind].has(value)) return names[kind].get(value);
    for (const [before, after] of names[kind]) if (before.endsWith("-") && value.startsWith(before)) return after + value.slice(before.length);
    for (const [before, after] of names[kind]) if (before.startsWith("-") && value.endsWith(before)) return value.slice(0, -before.length) + after;
    return value;
  };
  const replaceWords = (kind, value) => value.replace(/[A-Za-z_][\w-]*/g, token => replaceToken(kind, token));
  const selectors = (value) => value
    .replace(/([.#])([A-Za-z_][\w-]*)/g, (_, prefix, name) => prefix + replaceToken(prefix === "." ? "class" : "id", name))
    .replace(/\bdata-[\w-]+\b/g, name => replaceToken("attribute", name));
  const markup = (value) => value.replace(attributes, (_, name, quote, contents) => {
    const attr = replaceToken("attribute", name);
    const content = name === "class" ? replaceWords("class", contents) :
      ["id", "for", "aria-labelledby", "aria-describedby"].includes(name) ? replaceWords("id", contents) : contents;
    return attr + "=" + quote + content + quote;
  });
  function rewrite(source, path) {
    if (path.endsWith(".css")) return selectors(source);
    if (path.endsWith(".html")) {
      const scripts = [];
      const shell = source.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (whole, attrs, code) => {
        scripts.push(!code.trim() || scriptKind(attrs) === null ? whole :
          "<script" + attrs + ">" + rewrite(code, path + (scriptKind(attrs) === "module" ? ".inline.mjs" : ".inline.js")) + "</script>");
        return `<!--owned-script-${scripts.length - 1}-->`;
      });
      return markup(shell).replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi,
      (_, attrs, css) => "<style" + attrs + ">" + selectors(css) + "</style>")
      .replace(/<!--owned-script-(\d+)-->/g, (_, index) => scripts[Number(index)]);
    }
    const edits = [];
    walk(tree(source, path.endsWith(".mjs")), [], (node, parents) => {
      if (dataset(node) && typeof property(node) === "string") {
        const before = dataName(property(node)), after = replaceToken("attribute", before);
        if (after !== before) edits.push({ start: node.object.end, end: node.end, value: (node.optional ? "?." : "") + "[" + JSON.stringify(dataKey(after)) + "]" });
        return;
      }
      const parent = parents.at(-1);
      if (parent?.type === "MemberExpression" && dataset(parent)) return;
      const isString = node.type === "Literal" && typeof node.value === "string";
      const isQuasi = node.type === "TemplateElement";
      if (!isString && !isQuasi) return;
      if (isQuasi && parents.some(p => p.type === "TaggedTemplateExpression")) return;
      const value = isString ? node.value : node.value.cooked;
      if (value == null) return;
      let result = /<[a-z]/i.test(value) ? markup(value) : value;
      const call = [...parents].reverse().find(p => p.type === "CallExpression");
      const name = call?.callee?.type === "Identifier" ? call.callee.name : property(call?.callee);
      const assignment = [...parents].reverse().find(p => p.type === "AssignmentExpression");
      if (["querySelector", "querySelectorAll", "closest", "matches", "qs", "qsa"].includes(name)) result = selectors(result);
      else if (["getElementById", "$"].includes(name) || (name === "instantiate" && call.arguments[0] === node)) result = replaceToken("id", result);
      else if (classCall(call) || name === "getElementsByClassName" || property(assignment?.left) === "className") result = replaceWords("class", result);
      else if (property(assignment?.left) === "id") result = replaceToken("id", result);
      else if (["getAttribute", "setAttribute", "hasAttribute", "removeAttribute", "toggleAttribute"].includes(name)) {
        if (call.arguments[0] === node) result = replaceToken("attribute", result);
        else if (["class", "id"].includes(textOf(call.arguments[0]))) result = replaceWords(textOf(call.arguments[0]), result);
      }
      if (/\{[^}]*[;:]/s.test(value)) result = selectors(result);
      if (result === value) return;
      const rendered = isString ? JSON.stringify(result) : JSON.stringify(result).slice(1, -1).replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
      edits.push({ start: node.start, end: node.end, value: rendered });
    });
    for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
    return source;
  }
  return { collect, rewrite, count: () => Object.values(names).reduce((sum, map) => sum + map.size, 0) };
}

export async function buildDomHooks(output, files) {
  const owned = files.filter(path => /\.(html|css|js|mjs)$/.test(path) &&
    (/^(?:[^/]+\.html$|script\.js|startup\.js|styles\.css|css\/|js\/|apps\/)/.test(path) ||
     /^assets\/(?:studies|gms-studies|gn-math)\//.test(path)));
  const transform = createDomHookTransform(), sources = new Map();
  for (const path of owned) {
    let source;
    try { source = await readFile(join(output, path), "utf8"); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
    sources.set(path, source);
    transform.collect(source, path);
  }
  for (const [path, source] of sources) {
    try { await writeFile(join(output, path), transform.rewrite(source, path)); }
    catch (error) { error.message += " while rewriting " + path; throw error; }
  }
  console.log(`DOM hooks: ${transform.count()} owned class, ID and data hooks linked across markup, styles and scripts.`);
}
