const MAX_LINKS = 5_000_000;
const MEMORY_DOWNLOAD_LIMIT = 100_000;
const CHUNK_SIZE = 10_000;

export function prepareAliasBase(origin, namespace) {
  let url;
  try { url = new URL(String(origin || "").trim()); } catch { throw new Error("Nyx could not determine the address for these links."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Nyx links require a public http:// or https:// address.");
  const group = String(namespace || "").trim();
  if (!/^[A-Za-z0-9_-]{8,24}$/.test(group)) throw new Error("Nyx could not create a safe link group.");
  url.pathname = "/l/";
  url.search = "";
  url.hash = "";
  return Object.freeze({ prefix: `${url.href}${group}-`, suffix: "" });
}

export function buildAliasUrl(plan, value) {
  return `${plan.prefix}${encodeURIComponent(String(value))}${plan.suffix}`;
}

function sequentialDigitTotal(count) {
  let total = 0;
  for (let start = 1; start <= count; start *= 10) {
    const end = Math.min(count, start * 10 - 1);
    total += (end - start + 1) * String(start).length;
  }
  return total;
}

export function estimatedLinkBytes(plan, count, mode = "sequential") {
  const amount = Number(count);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > MAX_LINKS) throw new Error(`Choose between 1 and ${MAX_LINKS.toLocaleString()} links.`);
  const fixed = new TextEncoder().encode(`${plan.prefix}${plan.suffix}\n`).length;
  const valueBytes = mode === "uuid" ? 36 * amount : mode === "random" ? 16 * amount : sequentialDigitTotal(amount);
  return fixed * amount + valueBytes;
}

function randomCode(length = 16) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let value = "";
  for (const byte of bytes) value += alphabet[byte % alphabet.length];
  return value;
}

function linkValue(mode, index) {
  if (mode === "uuid") return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${randomCode(16)}-${randomCode(16)}`;
  if (mode === "random") return randomCode();
  return String(index);
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Math.max(0, Number(bytes) || 0);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function downloadBlob(parts, name) {
  const url = URL.createObjectURL(new Blob(parts, { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  link.hidden = true;
  document.body.append(link);
  link.click();
  setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 60_000);
}

function initBulkLinks() {
  const root = document.querySelector("[data-bulk-variants]");
  if (!root) return;
  const form = root.querySelector("[data-bulk-variants-form]");
  const count = root.querySelector("[data-bulk-count]");
  const mode = root.querySelector("[data-bulk-mode]");
  const aliasExample = root.querySelector("[data-bulk-alias-example]");
  const generate = root.querySelector("[data-bulk-generate]");
  const cancel = root.querySelector("[data-bulk-cancel]");
  const estimate = root.querySelector("[data-bulk-estimate]");
  const progress = root.querySelector("[data-bulk-progress]");
  const progressBar = root.querySelector("[data-bulk-progress-bar]");
  const progressText = root.querySelector("[data-bulk-progress-text]");
  const preview = root.querySelector("[data-bulk-preview]");
  const previewCount = root.querySelector("[data-bulk-preview-count]");
  const previewLines = root.querySelector("[data-bulk-preview-lines]");
  let activeJob = null;

  const showProgress = (message, ratio = 0, state = "") => {
    progress.hidden = false;
    progress.className = `bulk-variants-progress${state ? ` ${state}` : ""}`;
    progressBar.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
    progressText.textContent = message;
  };
  const estimatePlan = () => prepareAliasBase(location.origin, "NyxLinkGroup");
  const updateEstimate = () => {
    aliasExample.textContent = `${location.origin}/l/NyxLinkGroup-...`;
    try { estimate.textContent = `Estimated download: ${formatBytes(estimatedLinkBytes(estimatePlan(), Number(count.value), mode.value))}`; }
    catch (error) { estimate.textContent = error.message; }
  };
  [count, mode].forEach(control => control.addEventListener("input", updateEstimate));
  mode.addEventListener("change", updateEstimate);
  cancel.addEventListener("click", () => { if (activeJob) activeJob.cancelled = true; });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (activeJob) return;
    let plan;
    let amount;
    try {
      plan = prepareAliasBase(location.origin, randomCode(12));
      amount = Number(count.value);
      estimatedLinkBytes(plan, amount, mode.value);
      if (amount > MEMORY_DOWNLOAD_LIMIT && typeof window.showSaveFilePicker !== "function") {
        throw new Error(`This browser can safely download up to ${MEMORY_DOWNLOAD_LIMIT.toLocaleString()} links at once. Use Chrome or Edge for larger streamed files.`);
      }
    } catch (error) {
      showProgress(error.message, 0, "error");
      return;
    }

    const job = { cancelled: false };
    activeJob = job;
    generate.disabled = true;
    cancel.hidden = false;
    preview.hidden = true;
    showProgress("Choose where to save the list…", 0);
    let writable = null;
    const memoryParts = [];
    const first = [];
    const last = [];
    let completed = 0;
    const started = performance.now();
    const name = `nyx-path-links-${amount}.txt`;
    try {
      if (amount > MEMORY_DOWNLOAD_LIMIT) {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "Text file", accept: { "text/plain": [".txt"] } }] });
        writable = await handle.createWritable();
      }
      for (let start = 1; start <= amount && !job.cancelled; start += CHUNK_SIZE) {
        const end = Math.min(amount, start + CHUNK_SIZE - 1);
        const lines = [];
        for (let index = start; index <= end; index += 1) {
          const url = buildAliasUrl(plan, linkValue(mode.value, index));
          lines.push(url);
          if (first.length < 5) first.push(url);
          last.push(url);
          if (last.length > 5) last.shift();
        }
        const text = `${lines.join("\n")}\n`;
        if (writable) await writable.write(text);
        else memoryParts.push(text);
        completed = end;
        const seconds = Math.max(.01, (performance.now() - started) / 1000);
        showProgress(`Generated ${completed.toLocaleString()} of ${amount.toLocaleString()} · ${Math.round(completed / seconds).toLocaleString()} links/sec`, completed / amount);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (job.cancelled) {
        if (writable) await writable.abort();
        showProgress("Generation cancelled. No completed file was saved.", completed / amount, "error");
        return;
      }
      if (writable) await writable.close();
      else downloadBlob(memoryParts, name);
      const previewValues = completed > 10 ? [...first, "…", ...last] : [...first, ...last.slice(Math.max(0, first.length - 5))];
      previewLines.textContent = [...new Set(previewValues)].join("\n");
      previewCount.textContent = `${completed.toLocaleString()} links`;
      preview.hidden = false;
      showProgress(`${completed.toLocaleString()} different Nyx links saved to ${name}.`, 1, "complete");
    } catch (error) {
      if (writable) await writable.abort().catch(() => {});
      showProgress(error?.name === "AbortError" ? "Save cancelled." : (error?.message || "The link list could not be created."), completed / amount, "error");
    } finally {
      activeJob = null;
      generate.disabled = false;
      cancel.hidden = true;
    }
  });

  updateEstimate();
}

if (typeof document !== "undefined") initBulkLinks();

export { MAX_LINKS };
