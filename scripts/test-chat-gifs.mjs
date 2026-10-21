import assert from "node:assert/strict";
import express from "express";
import {installChatGifs} from "../lib/chat-gifs.mjs";
const app = express(); let calls = 0; let configured = true;
installChatGifs(app, {
  key: () => configured ? "fixture-private-key" : "",
  sameOrigin: req => req.headers.origin !== "https://other.example",
  authenticate: async req => { if (!req.headers.authorization) throw Object.assign(new Error("Unauthorized"), {status:401}); return {token:{uid:"fixture"}}; },
  request: async url => {
    calls++; assert.equal(url.origin, "https://api.giphy.com");
    assert.equal(url.searchParams.get("api_key"), "fixture-private-key");
    assert.equal(url.searchParams.get("rating"), "pg");
    return Response.json({data:[{id:"wave",title:"Wave",images:{downsized:{url:"https://media.giphy.com/media/wave/giphy.gif",size:"100"}}},{id:"bad",images:{downsized:{url:"https://evil.example/file"}}}],pagination:{count:24,total_count:48}});
  },
});
const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api/chat/gifs`;
try {
  assert.equal((await fetch(base)).status, 401);
  assert.equal((await fetch(base,{headers:{origin:"https://other.example",authorization:"fixture"}})).status,403);
  const options = {headers:{authorization:"fixture"}};
  const result = await (await fetch(base+"?q=hello",options)).json();
  assert.equal(result.items.length,1); assert.equal(result.next,24);
  assert(!JSON.stringify(result).includes("fixture-private-key"));
  await fetch(base+"?q=hello",options); assert.equal(calls,1);
  configured=false; assert.equal((await fetch(base,options)).status,503);
  console.log("PASS GIF authentication, same-origin guard, filtered media, pagination, caching, missing configuration and key secrecy");
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
