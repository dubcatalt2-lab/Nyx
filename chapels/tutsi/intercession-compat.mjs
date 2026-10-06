import {protectionSource} from "./protections.mjs";
// Keep the Google compatibility guard aligned with Nyx script.js.
export const minimalGuardSource = `(() => {
    if (typeof window === "undefined" || window.__nyxScramjetMinimalGuards) return;
    window.__nyxScramjetMinimalGuards = true;
    try {
      const noop = value => value;
      window.$scramerr = window.$scramerr || noop;
      window.$scramjet$pushsourcemap = window.$scramjet$pushsourcemap || noop;
    } catch {}
    try {
      window.__sentry_instrumentation_handlers__ = window.__sentry_instrumentation_handlers__ || {};
      window.global = window.global || window;
    } catch {}
    if (!window.trustedTypes) {
      try {
        Object.defineProperty(window, "trustedTypes", {
          configurable: true,
          value: {
            createPolicy(_name, rules = {}) {
              return {
                createHTML(value) { return typeof rules.createHTML === "function" ? rules.createHTML(value) : value; },
                createScript(value) { return typeof rules.createScript === "function" ? rules.createScript(value) : value; },
                createScriptURL(value) { return typeof rules.createScriptURL === "function" ? rules.createScriptURL(value) : value; }
              };
            }
          }
        });
      } catch {}
    }
    try {
      if (!window.Buffer) {
        const toBytes = value => value instanceof Uint8Array ? value : new TextEncoder().encode(String(value ?? ""));
        window.Buffer = {
          from: toBytes,
          alloc(size) { return new Uint8Array(Math.max(0, Number(size) || 0)); },
          isBuffer(value) { return value instanceof Uint8Array; },
          byteLength(value) { return toBytes(value).byteLength; }
        };
      }
      if (!window.Long) {
        const toNumber = value => Number(value && typeof value === "object" && "low" in value ? value.low : value) || 0;
        window.Long = {
          ZERO: 0,
          UZERO: 0,
          fromNumber: toNumber,
          fromValue: toNumber,
          isLong() { return false; }
        };
      }
    } catch {}
    try {
      const nativeCurrentScript = Object.getOwnPropertyDescriptor(Document.prototype, "currentScript");
      const fallbackScript = document.createElement("script");
      fallbackScript.setAttribute("nonce", "");
      Object.defineProperty(Document.prototype, "currentScript", {
        configurable: true,
        get() {
          let current = null;
          try { current = nativeCurrentScript?.get?.call(this) || null; } catch {}
          return current || this.querySelector?.("script[src],script") || fallbackScript;
        }
      });
    } catch {}
  })();`;
export function compatibilityPlugin(getPolicy = () => ({})) {
  const children = (node) => node?.childNodes || node?.children || [];
  const find = (node, name) =>
    node?.name === name
      ? node
      : children(node)
          .map((child) => find(child, name))
          .find(Boolean);
  const plugin = {
    name: "tutsi-nyx-compatibility",
    dependencies: [],
    install(frame) {
      const Tap = window.$scramjet?.Tap;
      const hook = frame?.fetchHandler?.hooks?.rewriter?.html?.post;
      if (!Tap?.tap) return;
      if (hook)
        Tap.tap(
          hook,
          (context) => {
            const root = context?.handler?.root;
            function strip(node) {
              if (node?.attribs) {
                delete node.attribs.integrity;
                delete node.attribs["scramjet-attr-integrity"];
              }
              children(node).forEach(strip);
            }
            strip(root);

            const target = find(root, "head") || find(root, "html") || root;
            if (!target) return;
            const nodes = children(target);
            if (
              nodes.some(
                (n) =>
                  n?.attribs?.["data-nyx-runtime-guard"] === "minimal-guard",
              )
            )
              return;
            const script = {
              type: "script",
              name: "script",
              attribs: { "data-nyx-runtime-guard": "minimal-guard" },
              children: [],
              parent: target,
              prev: null,
              next: nodes[0] || null,
            };
            script.children.push({
              type: "text",
              data:
                protectionSource(getPolicy()) + "if (/(^|\\.)(google\\.com|gstatic\\.com|recaptcha\\.net|google-analytics\\.com|googletagmanager\\.com)$/.test(location.hostname)) {" +
                minimalGuardSource +
                "}",
              parent: script,
              prev: null,
              next: null,
            });
            if (nodes[0]) nodes[0].prev = script;
            nodes.unshift(script);
          },
          plugin,
        );
      const responseHook = frame?.fetchHandler?.hooks?.fetch?.response;
      if (responseHook)
        Tap.tap(
          responseHook,
          (_context, result) => {
            const headers = result?.response?.headers;
            const link = String(headers?.get?.("link") || "");
            if (link)
              headers.set(
                "link",
                link.replace(
                  /;\s*integrity\s*=\s*(?:"[^"]*"|'[^']*'|[^,;]*)/gi,
                  "",
                ),
              );
          },
          plugin,
        );
    },
  };
  return plugin;
}
