(function () {
  "use strict";

  let installPrompt = null;
  let lastMessage = "";
  const SINGLE_FILE_RELEASE = "2026.09.18.1";

  function isInstalled() {
    return window.matchMedia?.("(display-mode: standalone)")?.matches
      || window.navigator.standalone === true;
  }

  function platformHelp() {
    const agent = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/i.test(agent)) {
      return "In Safari, tap Share, then Add to Home Screen.";
    }
    if (/Firefox/i.test(agent)) {
      return "Firefox desktop does not offer PWA installation. Open Tutsi in Chrome or Edge to install it.";
    }
    if (/Safari/i.test(agent) && !/Chrome|Chromium|Edg/i.test(agent)) {
      return "In Safari, choose File, then Add to Dock.";
    }
    return "Use the install icon in the browser address bar, or open the browser menu and choose Install Tutsi.";
  }

  function installCard(kind) {
    const card = document.createElement("section");
    card.dataset.tutsiInstallCard = "true";
    card.className = kind === "legacy" ? "settings-card" : "settings-block";
    const copy = `
      <h2>Install Tutsi</h2>
      <p data-install-tutsi-status>Installs Tutsi as an app with its own window and desktop icon.</p>`;
    const control = `<div class="settings-actions tutsi-install-actions">
      <button class="${kind === "legacy" ? "" : "settings-action"}" data-install-tutsi type="button">Install Tutsi</button>
      <button class="${kind === "legacy" ? "" : "settings-action"}" data-download-tutsi-singlefile type="button">Download Single File</button>
    </div>`;
    card.innerHTML = kind === "dashboard"
      ? `<div class="tutsi-settings-copy">${copy}</div><div class="tutsi-settings-control">${control}</div>`
      : `${copy}${control}`;
    return card;
  }

  function ensureInstallCards() {}

  function updateControls(message = lastMessage) {
    lastMessage = message;
    ensureInstallCards();
    const installed = isInstalled();
    document.querySelectorAll("[data-install-tutsi]").forEach((button) => {
      button.disabled = installed;
      button.setAttribute("aria-disabled", String(installed));
      const label = installed ? "Tutsi is Installed" : "Install Tutsi";
      if (button.textContent !== label) button.textContent = label;
    });
    document.querySelectorAll("[data-install-tutsi-status]").forEach((status) => {
      const text = installed
        ? "Tutsi is installed on this device and opens in its own app window."
        : message || (installPrompt
          ? "Ready to install on this device."
          : "Installs Tutsi as an app with its own window and desktop icon.");
      if (status.textContent !== text) status.textContent = text;
    });
    document.querySelectorAll("[data-download-tutsi-singlefile]").forEach((button) => {
      if (button.dataset.tutsiSingleFileBound === "true") return;
      button.dataset.tutsiSingleFileBound = "true";
      button.onclick = (event) => {
        event.preventDefault();
        void downloadSingleFile(button);
      };
    });
  }

  async function requestInstall() {
    if (isInstalled()) {
      updateControls();
      return;
    }
    if (!installPrompt) {
      updateControls(platformHelp());
      return;
    }

    const prompt = installPrompt;
    installPrompt = null;
    try {
      const result = await prompt.prompt();
      updateControls(result?.outcome === "accepted"
        ? "Finishing the Tutsi installation..."
        : "Installation was cancelled. You can try again anytime.");
    } catch {
      updateControls(platformHelp());
    }
  }

  async function downloadSingleFile(button) {
    const source = new URL("/apps/tutsi/tutsi-singlefile.html", window.location.href);
    source.searchParams.set("release", SINGLE_FILE_RELEASE);
    source.searchParams.set("fresh", Date.now().toString(36));
    const previousLabel = button?.textContent || "Download Single File";
    if (button) {
      button.disabled = true;
      button.textContent = "Downloading…";
    }
    const status = button?.closest("[data-tutsi-install-card]")?.querySelector("[data-install-tutsi-status]");
    try {
      const response = await fetch(source, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("The Tutsi file is unavailable.");
      const markup = await response.text();
      if (!markup.trim().toLowerCase().startsWith("<!doctype html")) throw new Error("The Tutsi file was incomplete.");
      const objectUrl = URL.createObjectURL(new Blob([markup], { type: "text/html;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "Tutsi-Download.html";
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => { link.remove(); URL.revokeObjectURL(objectUrl); }, 60_000);
      if (status) status.textContent = "Tutsi-Download.html was saved. Open it from your Downloads folder.";
    } catch {
      if (status) status.textContent = "Tutsi could not create the download. Check your connection and try again.";
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = previousLabel;
      }
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    updateControls("Ready to install on this device.");
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    updateControls();
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-install-tutsi]");
    if (!button) return;
    event.preventDefault();
    requestInstall();
  }, true);

  const observer = new MutationObserver(() => updateControls());
  function start() {
    updateControls();
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.TutsiInstall = {
    request: requestInstall,
    downloadSingleFile,
    refresh: updateControls,
    get available() {
      return Boolean(installPrompt);
    },
    get installed() {
      return isInstalled();
    }
  };
})();
