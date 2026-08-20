var nyxUvSessionMatch = location.pathname.match(/^\/service\/(nyx_[a-z0-9_-]{12,80})\//i);
var nyxUvSessionId = nyxUvSessionMatch?.[1] || "";
self.__uv$config = {
  prefix: nyxUvSessionId ? `/service/${nyxUvSessionId}/` : "/service/",
  cookieDbName: nyxUvSessionId ? `__nyx_uv_tab_${nyxUvSessionId}` : "__op",
  bare: (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "/wisp/"
    : "wss://wisp.mercurywork.shop/",
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: "/uv/uv.handler.js",
  bundle: "/uv/uv.bundle.js",
  config: "/uv.config.js",
  sw: "/uv.sw.js?v=nyx-uv-v10-20260820-quiet-browser",
  client: "/uv/uv.client.js"
};
