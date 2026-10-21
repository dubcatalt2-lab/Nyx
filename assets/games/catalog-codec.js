// Reversible transport representation, not encryption or authorization.
export function αποκωδικοποίηση(τιμή) {
  if (τιμή?.representation !== "n7x-xor-1") return τιμή;
  if (!Array.isArray(τιμή.key) || τιμή.key.length !== 32 ||
      !τιμή.key.every(ψηφίο => Number.isInteger(ψηφίο) && ψηφίο >= 0 && ψηφίο <= 255) ||
      !Array.isArray(τιμή.chunks) || !τιμή.chunks.every(μέρος => typeof μέρος === "string")) {
    throw new Error("Invalid catalog representation");
  }
  const bytes = Uint8Array.from(atob(τιμή.chunks.join("")), (γράμμα, θέση) =>
    γράμμα.charCodeAt(0) ^ τιμή.key[θέση % τιμή.key.length]);
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
