// Read the provider's documented catalog without loading its page-level SDK.
export function κατάλογοςZengs(δεδομένα, διεύθυνση) {
  const βάση = new URL(διεύθυνση);
  if (βάση.protocol !== "https:") return [];
  const κλειδί = [0x3b, 0x9a, 0x51, 0xe7, 0x2c, 0x84, 0x1d, 0xf0, 0x66];
  const σύνδεσμος = (τιμή) => {
    if (typeof τιμή !== "string" || !τιμή.startsWith("/") || τιμή.startsWith("//")) return "";
    const στόχος = new URL(τιμή, βάση);
    return στόχος.origin === βάση.origin && !στόχος.username && !στόχος.password ? στόχος.href : "";
  };
  return (Array.isArray(δεδομένα?.items) ? δεδομένα.items : []).flatMap((στοιχείο) => {
    try {
      if (!στοιχείο || typeof στοιχείο.title !== "string" || στοιχείο.title.length > 4096) return [];
      const κωδικός = στοιχείο.title.replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(atob(κωδικός), (γράμμα, θέση) =>
        γράμμα.charCodeAt(0) ^ κλειδί[θέση % κλειδί.length],
      );
      const title = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
      const url = σύνδεσμος(στοιχείο.play);
      if (!title || /[\u0000-\u001f\u007f]/.test(title) || !url) return [];
      return [{ title, url, cover: σύνδεσμος(στοιχείο.cover) }];
    } catch {
      return [];
    }
  });
}
