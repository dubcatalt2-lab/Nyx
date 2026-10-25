import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const context = { TextEncoder, TextDecoder, atob, btoa };
vm.runInNewContext(
  await readFile(
    process.env.NYX_CODEC_SOURCE || "js/K7b49.js",
    "utf8",
  ),
  context,
);
const codec = context.NyxProxyUrlCodec;
assert(Object.isFrozen(codec));
// The controller injects these functions into a different global environment.
const portable = vm.runInNewContext(
  `({ encode: ${codec.encode.toString()}, decode: ${codec.decode.toString()} })`,
  { TextEncoder, TextDecoder, atob, btoa },
);
for (const url of [
  "",
  "https://example.com/",
  "https://duckduckgo.com/?q=games%20%26%20caf%C3%A9#results",
  "https://example.com/東京?q=☃&nested=https%3A%2F%2Fexample.org%2F%3Fa%3D1%26b%3D2",
  "https://example.com/?q=" + "abc☃".repeat(10000),
]) {
  const encoded = codec.encode(url);
  assert.equal(portable.decode(encoded), url);
  assert.equal(codec.decode(portable.encode(url)), url);
  assert.equal(
    codec.decode(encodeURIComponent(url)),
    url,
    "Existing encoded links remain readable",
  );
  if (url) {
    assert.match(encoded, /^u3\.[A-Za-z0-9_-]+$/);
    assert(!encoded.includes("duckduckgo") && !encoded.includes("games"));
    const old = "u1." + Buffer.from(url).toString("base64url");
    assert.equal(
      codec.decode(old),
      url,
      "Previous URL-safe links remain readable",
    );
    const bytes = Buffer.from(url);
    for (let index = 0; index < bytes.length; index++)
      bytes[index] ^= (index * 31 + 93) & 255;
    const binary = bytes.toString("base64url");
    assert.equal(
      codec.decode("u2." + binary),
      url,
      "Previous XOR links remain readable",
    );
    const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const value = "RSTUVWXYZABCDEFGHIJKLMNOPQrstuvwxyzabcdefghijklmnopq";
    assert.equal(
      encoded,
      "u3." +
        binary.replace(/[A-Za-z]/g, (γράμμα) => value[text.indexOf(γράμμα)]),
      "ROT17 uses the exact forward alphabet",
    );
  }
}
for (const invalid of [
  "u1.",
  "u1.x",
  "u1.%%%",
  "u1.__8",
  "u2.",
  "u2.x",
  "u2.%%%",
  "u3.",
  "u3.x",
  "u3.%%%",
  "u3.__8",
]) {
  assert.throws(() => codec.decode(invalid));
}
console.log(
  "PASS portable URL codec, Unicode, nested queries, long URLs, legacy links and malformed tokens",
);
