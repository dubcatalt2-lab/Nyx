// Portable functions: the controller serializes them into documents and workers.
// This is a URL representation, not encryption or a security boundary.
globalThis.NyxProxyUrlCodec = Object.freeze({
  encode: function (value) {
    const text = String(value || "");
    if (!text) return "";
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (let index = 0; index < bytes.length; index++)
      binary += String.fromCharCode(bytes[index] ^ ((index * 31 + 93) & 255));
    return (
      "u3." +
      btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "")
        .replace(/[A-Za-z]/g, (γράμμα) => {
          const βάση = γράμμα <= "Z" ? 65 : 97;
          return String.fromCharCode(
            ((γράμμα.charCodeAt(0) - βάση + 17) % 26) + βάση,
          );
        })
    );
  },
  decode: function (value) {
    const text = String(value || "");
    if (
      !text.startsWith("u1.") &&
      !text.startsWith("u2.") &&
      !text.startsWith("u3.")
    )
      return decodeURIComponent(text);
    const payload = text.slice(3);
    if (
      !payload ||
      !/^[A-Za-z0-9_-]+$/.test(payload) ||
      payload.length % 4 === 1
    )
      throw new TypeError("Invalid destination token");
    const binary = atob(
      (text.startsWith("u3.")
        ? payload.replace(/[A-Za-z]/g, (γράμμα) => {
            const βάση = γράμμα <= "Z" ? 65 : 97;
            return String.fromCharCode(
              ((γράμμα.charCodeAt(0) - βάση + 9) % 26) + βάση,
            );
          })
        : payload
      )
        .replace(/-/g, "+")
        .replace(/_/g, "/"),
    );
    const xor = !text.startsWith("u1.");
    const bytes = Uint8Array.from(
      binary,
      (character, index) =>
        character.charCodeAt(0) ^ (xor ? (index * 31 + 93) & 255 : 0),
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  },
});
