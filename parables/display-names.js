(() => {
  globalThis.nyxDisplayName = value => String(value ?? '').replace(/[A-Za-z0-9]/g, letter => {
    const code = letter.charCodeAt(0);
    return String.fromCodePoint(code >= 97 ? 0x1d5ba + code - 97 : code >= 65 ? 0x1d5a0 + code - 65 : 0x1d7e2 + code - 48);
  });
})();
