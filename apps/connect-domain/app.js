(() => {
  const target = document.querySelector("[data-target-ip]");
  const copy = document.querySelector("[data-copy-ip]");
  const form = document.querySelector("[data-domain-form]");
  const submit = document.querySelector("[data-submit]");
  const status = document.querySelector("[data-status]");
  let targetIp = "";

  function showStatus(message, type = "") {
    status.hidden = false;
    status.className = `status${type ? ` ${type}` : ""}`;
    status.textContent = message;
  }

  async function readJson(response) {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Nyx returned an unexpected ${response.status} response.`);
    }
  }

  async function loadConfig() {
    try {
      const response = await fetch("/api/custom-hostnames/config", { credentials: "same-origin", cache: "no-store" });
      const data = await readJson(response);
      targetIp = String(data.targetIps?.[0] || "");
      target.textContent = targetIp || "Not configured";
      copy.disabled = !targetIp;
      submit.disabled = !data.enabled;
      if (!data.enabled) showStatus("Custom-domain connection is not enabled on this Nyx server yet.", "error");
    } catch (error) {
      target.textContent = "Unavailable";
      copy.disabled = true;
      submit.disabled = true;
      showStatus(error.message || "Nyx could not load the domain configuration.", "error");
    }
  }

  copy.addEventListener("click", async () => {
    if (!targetIp) return;
    try {
      await navigator.clipboard.writeText(targetIp);
      copy.textContent = "Copied";
      setTimeout(() => { copy.textContent = "Copy"; }, 1400);
    } catch {
      showStatus(`Copy this address: ${targetIp}`);
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    submit.disabled = true;
    const originalLabel = submit.textContent;
    submit.textContent = "Verifying…";
    status.hidden = true;
    try {
      const response = await fetch("/api/custom-hostnames", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: form.elements.hostname.value })
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || `Domain verification failed (${response.status}).`);
      status.hidden = false;
      status.className = "status success";
      status.replaceChildren(document.createTextNode(`${data.message} `));
      const link = document.createElement("a");
      link.href = data.url;
      link.textContent = `Open ${data.hostname}`;
      status.append(link);
    } catch (error) {
      showStatus(error.message || "Nyx could not connect that domain.", "error");
    } finally {
      submit.disabled = false;
      submit.textContent = originalLabel;
    }
  });

  void loadConfig();
})();
