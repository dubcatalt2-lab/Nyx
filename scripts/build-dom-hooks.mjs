import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "acorn";
import { parse as parseHtml, parseFragment } from "parse5";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";

const targeted = /^data-n7x-dock-item$|^data-copy-page-link$|^data-n7x-notifications-enable$|^offer-(?:panel|action|label)$|game|librar(?:y|ies)|play|arcade|^gif-(?:picker|grid)$|voice-room|voice-speaking|voice-screen-expanded|voice-member-uid|voice-open|^ad-(?:wall|piece(?:-wide|-tall)?|mixed|popup|notices)$|^wall$/i;
const property = (node) => node?.computed ? node.property?.value : node?.property?.name;
const textOf = (node) => node?.type === "Literal" && typeof node.value === "string" ? node.value :
  node?.type === "TemplateLiteral" ? node.quasis.map(q => q.value.cooked || "").join(" ") :
  node?.type === "BinaryExpression" && node.operator === "+" ? textOf(node.left) + textOf(node.right) : "";
const words = (text) => String(text).match(/[A-Za-z_][\w-]*/g) || [];
const dataName = (name) => "data-" + name.replace(/[A-Z]/g, c => "-" + c.toLowerCase());
const dataKey = (name) => name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
export const domHookAlias = (kind, name) => (name.startsWith("-") ? "-" : "") + "r" + createHash("sha256")
  .update("owned-dom-v3:" + kind + ":" + name).digest("hex").slice(0, 18) + (name.endsWith("-") ? "-" : "");

export function createDomHookTransform({ allOwned = false } = {}) {
  const names = { class: new Map(), id: new Map(), attribute: new Map() };
  const prefixes = {class:new Set(),id:new Set(),attribute:new Set()};
  let πλήρης = false;
  const add = (kind, name) => {
    // These markers are shared with the separately published text-presentation runtime.
    if (kind === "attribute" && ["data-user-content", "data-no-interface-text", "data-chat-history", "data-chat-messages", "data-zone", "data-cfasync"].includes(name)) return;
    if (!πλήρης && !targeted.test(name)) return;
    if (kind === "id" && name === "container-9c738b5defae15a3c8d545815ad6e73e") return;
    names[kind].set(name, kind === "attribute" ? "data-" + domHookAlias(kind, name) : domHookAlias(kind, name));
  };
  const tokens = (kind, text) => words(text).forEach(name => add(kind, name));
  const attributes = /\b(class|id|for|aria-labelledby|aria-describedby|data-[\w-]+)\s*=\s*(["'])(.*?)\2/gs;
  const scriptKind = (attrs) => {
    const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() || "";
    return ["", "module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"].includes(type) ? type : null;
  };
  const htmlAttributes = (value, visit) => {
    const root = /<!doctype|<html\b/i.test(value) ? parseHtml(value, {sourceCodeLocationInfo:true}) : parseFragment(value, {sourceCodeLocationInfo:true});
    const walk = node => {
      for (const attr of node.attrs || []) {
        const key = attr.prefix ? attr.prefix + ":" + attr.name : attr.name;
        const location = node.sourceCodeLocation?.attrs?.[key];
        if (location) visit(key, attr.value, location, node.tagName);
      }
      for (const child of node.childNodes || []) walk(child);
      if (node.content) walk(node.content);
    };
    walk(root);
  };
  const marker = index => "___OWNED_EXPR_" + index + "___";
  const templateValue = node => node.quasis.map((q,i)=>(q.value.cooked || "") + (i<node.expressions.length ? marker(i) : "")).join("");
  const templateAttribute = (node, parents) => {
    const template = [...parents].reverse().find(p=>p.type === "TemplateLiteral");
    if (!template) return "";
    const index = template.expressions.findIndex(e=>node.start>=e.start && node.end<=e.end);
    if (index<0) return "";
    const prefix=template.quasis.slice(0,index+1).map((q,i)=>(q.value.cooked || "")+(i<index?marker(i):"")).join("");
    return /\s(class|id)\s*=\s*(["'])[^"']*$/.exec(prefix.slice(prefix.lastIndexOf("<")))?.[1] || "";
  };
  const classValue = (node, parents) => {
    const inside = (part) => part && node.start>=part.start && node.end<=part.end;
    for(const parent of [...parents].reverse()) {
      if(parent.type === "BinaryExpression" && parent.operator !== "+") return false;
      if(parent.type === "ConditionalExpression" && inside(parent.test)) return false;
      if(parent.type === "MemberExpression" && parent.computed && inside(parent.property)) return false;
      if(parent.type === "CallExpression") {
        const method=parent.callee?.type === "Identifier" ? parent.callee.name : property(parent.callee);
        if(method === "svgButton") return inside(parent.arguments[1]);
        if(classCall(parent)) return parent.arguments.some((argument,index)=>inside(argument) && (method !== "toggle" || index === 0));
        if(method === "join" && parent.callee.object?.type === "ArrayExpression") continue;
        return false;
      }
      if(parent.type === "TemplateLiteral" && node.type !== "TemplateElement") {
        const index=parent.expressions.findIndex(inside);
        if(index>=0) {
          let prefix=parent.quasis[index].value.cooked || "";
          const attr=/\sclass\s*=\s*(["'])([^"']*)$/.exec(prefix);
          if(attr) prefix=attr[2];
          if(prefix && !/\s$/.test(prefix) && typeof node.value === "string" && !/^\s/.test(node.value)) return false;
          if(templateAttribute(node,parents) === "class") return true;
        }
      }
      if(parent.type === "AssignmentExpression" && property(parent.left) === "className") return true;
      if(parent.type === "Property" && property({property:parent.key,computed:parent.computed}) === "className" && inside(parent.value)) return true;
      if(/Function/.test(parent.type)) return false;
    }
    return false;
  };
  const collectMarkup = (value) => htmlAttributes(value, (name, contents) => {
    const chunks = contents.replace(/___OWNED_EXPR_\d+___/g, " ");
    if (name === "class") {
      tokens("class",chunks);
      for(const word of contents.split(/\s+/)) if(word.includes("___OWNED_EXPR_")) {
        const prefix=word.split(/___OWNED_EXPR_\d+___/)[0];
        if(prefix) prefixes.class.add(prefix);
      }
    }
    else if (name === "id") {
      chunks.split(/\s+/).filter(Boolean).forEach(name=>add("id", name));
      if(contents.includes("___OWNED_EXPR_")) {
        const prefix=contents.split(/___OWNED_EXPR_\d+___/)[0];
        if(prefix) prefixes.id.add(prefix);
      }
    }
    else if (["href","xlink:href"].includes(name) && contents.startsWith("#") && contents.includes("___OWNED_EXPR_")) {
      const prefix=contents.slice(1).split(/___OWNED_EXPR_\d+___/)[0];
      if(prefix){add("id",prefix);prefixes.id.add(prefix);}
    }
    else if (name.startsWith("data-") && !name.includes("___owned_expr_")) add("attribute", name);
  });
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
    πλήρης = allOwned || /^(?:assets\/(?:studies|math)\/|apps\/cloud-studies\/)/.test(path);
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
    walk(program, [], (node, parents) => {
      if (node.type === "Literal" && typeof node.value === "string") {
        const kind=templateAttribute(node,parents);
        if(kind === "id" || classValue(node,parents)) tokens(kind || "class",node.value);
      }
      if (node.type === "Literal" && typeof node.value === "string" && /<[a-z]/i.test(node.value)) collectMarkup(node.value);
      if (node.type === "TemplateLiteral" && /<[a-z]/i.test(templateValue(node))) collectMarkup(templateValue(node));
      if (node.type === "AssignmentExpression" && property(node.left) === "className") tokens("class", textOf(node.right));
      if (node.type === "AssignmentExpression" && property(node.left) === "id" && textOf(node.right)) add("id", textOf(node.right));
      if (node.type === "Property" && property({ property: node.key, computed: node.computed }) === "className") tokens("class", textOf(node.value));
      if (classCall(node)) node.arguments.forEach(arg => tokens("class", textOf(arg)));
      if (dataset(node) && typeof property(node) === "string") add("attribute", dataName(property(node)));
      if (node.type === "CallExpression" && property(node.callee) === "setAttribute") {
        const name = textOf(node.arguments[0]);
        if (name === "id" || name === "class") tokens(name, textOf(node.arguments[1]));
        else if (name.startsWith("data-") && !name.includes("___owned_expr_")) add("attribute", name);
      }
    });
  }
  const replaceToken = (kind, value) => {
    if(kind === "attribute" && ["data-user-content","data-no-interface-text","data-chat-history","data-chat-messages","data-zone","data-cfasync"].includes(value)) return value;
    if(kind === "id" && value === "container-9c738b5defae15a3c8d545815ad6e73e") return value;
    for(const before of [...prefixes[kind]].sort((a,b)=>b.length-a.length)) if(value.startsWith(before) && names[kind].has(before)) return names[kind].get(before)+value.slice(before.length);
    if (names[kind].has(value)) return names[kind].get(value);
    for (const [before, after] of names[kind]) if (before.endsWith("-") && value.startsWith(before)) return after + value.slice(before.length);
    for (const [before, after] of names[kind]) if (before.startsWith("-") && value.endsWith(before)) return value.slice(0, -before.length) + after;
    return value;
  };
  const replaceWords = (kind, value) => value.split(/(___OWNED_EXPR_\d+___)/g).map((part,index)=>index%2?part:part.replace(/[A-Za-z_][\w-]*/g,token=>replaceToken(kind,token))).join("");
  const selectors = (value) => value
    .replace(/([.#])([A-Za-z_][\w-]*)/g, (_, prefix, name) => prefix + replaceToken(prefix === "." ? "class" : "id", name))
    .replace(/\bdata-[\w-]+\b/g, name => replaceToken("attribute", name));
  const fragments = value => value.replace(/url\(\s*(["']?)#([A-Za-z_][\w-]*)\1\s*\)/g,
    (_, quote, id) => "url(" + quote + "#" + replaceToken("id", id) + quote + ")");
  const styles = (value) => {
    const prepared=value.replace(/___OWNED_EXPR_\d+___/g, part=>"/*"+part+"*/");
    const css = postcss.parse(prepared);
    css.walkRules(rule => { rule.selector = selectors(rule.selector); });
    css.walkDecls(declaration => { declaration.value = fragments(declaration.value); });
    return css.toString().replace(/\/\*(___OWNED_EXPR_\d+___)\*\//g,"$1");
  };
  const embeddedStyles = (value) => {
    if (/<[a-z]/i.test(value)) return value.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
      (_, open, css, close) => open + styles(css) + close);
    try {
      const css = postcss.parse(value);
      if (!css.nodes.length || css.nodes.some(node => !['rule', 'atrule', 'comment'].includes(node.type))) return value;
      let rules = 0;
      css.walkRules(rule => { selectorParser().astSync(rule.selector); rules++; });
      return rules ? styles(value) : value;
    } catch { return value; }
  };
  const markup = (value) => {
    const edits = [];
    htmlAttributes(value, (name, contents, location, tag) => {
      const attr = replaceToken("attribute", name);
      let raw = value.slice(location.startOffset, location.endOffset);
      if(attr !== name) raw = raw.replace(/^[^\s=]+/, attr);
      if (["class", "id", "for", "aria-labelledby", "aria-describedby"].includes(name))
        raw = raw.replace(/(=\s*)(["'])([\s\S]*)\2$/, (_, equal, quote, text) => equal + quote + replaceWords(name === "class" ? "class" : "id", text) + quote)
          .replace(/(=\s*)([^"'\s][^\s]*)$/, (_, equal, text) => equal + replaceWords(name === "class" ? "class" : "id", text));
      if (["style","fill","stroke","filter","clip-path","mask","marker-start","marker-mid","marker-end"].includes(name)) raw=fragments(raw);
      if (["href","xlink:href"].includes(name) && ["use","linearGradient","radialGradient","pattern","textPath"].includes(tag) && contents.startsWith("#"))
        raw=raw.replace(contents,"#"+replaceToken("id",contents.slice(1)));
      if (raw !== value.slice(location.startOffset, location.endOffset)) edits.push({start:location.startOffset,end:location.endOffset,value:raw});
    });
    for (const edit of edits.sort((a,b)=>b.start-a.start)) value=value.slice(0,edit.start)+edit.value+value.slice(edit.end);
    return value;
  };
  function rewrite(source, path) {
    if (path.endsWith(".css")) return styles(source);
    if (path.endsWith(".html")) {
      const scripts = [];
      const shell = source.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (whole, attrs, code) => {
        // Local script attributes share owned hooks with their runtime. External SDK attributes remain API fields.
        const open = /\bsrc\s*=\s*["'](?:https?:)?\/\//i.test(attrs) ? "<script" + attrs + ">" : markup("<script" + attrs + ">");
        scripts.push(open + (!code.trim() || scriptKind(attrs) === null ? code :
          rewrite(code, path + (scriptKind(attrs) === "module" ? ".inline.mjs" : ".inline.js"))) + "</script>");
        return `<!--owned-script-${scripts.length - 1}-->`;
      });
      return markup(shell).replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi,
      (_, attrs, css) => "<style" + attrs + ">" + styles(css) + "</style>")
      .replace(/<!--owned-script-(\d+)-->/g, (_, index) => scripts[Number(index)]);
    }
    const edits = [], handled = new WeakSet();
    walk(tree(source, path.endsWith(".mjs")), [], (node, parents) => {
      if (dataset(node) && typeof property(node) === "string") {
        const before = dataName(property(node)), after = replaceToken("attribute", before);
        if (after !== before) edits.push({ start: node.object.end, end: node.end, value: (node.optional ? "?." : "") + "[" + JSON.stringify(dataKey(after)) + "]" });
        return;
      }
      if (node.type === "TemplateLiteral") {
        const original = templateValue(node);
        if (/<[a-z]/i.test(original)) {
          let rendered = markup(original);
          rendered = embeddedStyles(rendered);
          const chunks = rendered.split(/___OWNED_EXPR_\d+___/g);
          if (chunks.length !== node.quasis.length) throw Error("Template boundary changed during DOM linking at " + node.start + " in " + path + ": " + JSON.stringify({original:original.slice(0,400),rendered:rendered.slice(0,400)}));
          node.quasis.forEach((q,i) => {
            handled.add(q);
            if (chunks[i] !== q.value.cooked) edits.push({start:q.start,end:q.end,value:JSON.stringify(chunks[i]).slice(1,-1).replace(/`/g,"\\`").replace(/\$\{/g,"\\${")});
          });
        }
      }
      if (node.type === "TemplateElement" && handled.has(node)) return;
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
      const attributeKind=templateAttribute(node,parents);
      if(attributeKind === "id" || classValue(node,parents)) result=replaceWords(attributeKind || "class",result);
      else if (["querySelector", "querySelectorAll", "closest", "matches", "qs", "qsa", "ownedSelector"].includes(name)) result = selectors(result);
      else if (["getElementById", "$"].includes(name) || (name === "instantiate" && call.arguments[0] === node)) result = replaceToken("id", result);
      else if (name === "getElementsByClassName") result = replaceWords("class", result);
      else if (property(assignment?.left) === "id") result = replaceToken("id", result);
      else if (["getAttribute", "setAttribute", "hasAttribute", "removeAttribute", "toggleAttribute"].includes(name)) {
        if (call.arguments[0] === node) result = replaceToken("attribute", result);
        else if (["class", "id"].includes(textOf(call.arguments[0]))) result = replaceWords(textOf(call.arguments[0]), result);
      }
      if (/\{[^}]*[;:]/s.test(value)) result = embeddedStyles(result);
      if (result === value) return;
      const rendered = isString ? JSON.stringify(result) : JSON.stringify(result).slice(1, -1).replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
      edits.push({ start: node.start, end: node.end, value: rendered });
    });
    for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
    return source;
  }
  return { collect, rewrite, aliases: () => Object.fromEntries(Object.entries(names).map(([kind,entries])=>[kind,Object.fromEntries([...entries].map(([name])=>[name,replaceToken(kind,name)]))])), count: () => Object.values(names).reduce((sum, map) => sum + map.size, 0) };
}

export async function buildDomHooks(output, files) {
  const owned = files.filter(path => /\.(html|css|js|mjs)$/.test(path) &&
    (/^(?:[^/]+\.html$|script\.js|startup\.js|styles\.css|css\/|js\/|app\/|district\/|apps\/)/.test(path) ||
     /^assets\/(?:studies|math|reading|backgrounds)\//.test(path)));
  const transform = createDomHookTransform({ allOwned: true }), sources = new Map();
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
  await mkdir(join(output,"..",".codex-artifacts"),{recursive:true});
  await writeFile(join(output,"..",".codex-artifacts","owned-dom-hooks.json"),JSON.stringify(transform.aliases(),null,2));
  console.log(`DOM hooks: ${transform.count()} owned class, ID and data hooks linked across markup, styles and scripts.`);
}
