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
      return "Firefox desktop does not offer PWA installation. Open N7X in Chrome or Edge to install it.";
    }
    if (/Safari/i.test(agent) && !/Chrome|Chromium|Edg/i.test(agent)) {
      return "In Safari, choose File, then Add to Dock.";
    }
    return "Use the install icon in the browser address bar, or open the browser menu and choose Install N7X.";
  }

  function installCard(kind) {
    const card = document.createElement("section");
    card.dataset.n7xInstallCard = "true";
    card.className = kind === "legacy" ? "settings-card" : "settings-block";
    const copy = `
      <h2>Install N7X</h2>
      <p data-install-n7x-status>Installs N7X as an app with its own window and desktop icon.</p>`;
    const control = `<div class="settings-actions n7x-install-actions">
      <button class="${kind === "legacy" ? "" : "settings-action"}" data-install-n7x type="button">Install N7X</button>
      <button class="${kind === "legacy" ? "" : "settings-action"}" data-download-n7x-singlefile type="button">Download Single File</button>
    </div>`;
    card.innerHTML = kind === "dashboard"
      ? `<div class="n7x-settings-copy">${copy}</div><div class="n7x-settings-control">${control}</div>`
      : `${copy}${control}`;
    return card;
  }

  function ensureInstallCards() {
    document.querySelectorAll(".browser-only-settings.n7x-settings-dashboard").forEach((app) => {
      if (app.querySelector("[data-n7x-install-card]")) return;
      const group = app.querySelector('[data-settings-category="advanced"] .n7x-settings-group');
      if (group) group.prepend(installCard("dashboard"));
    });

    document.querySelectorAll(".browser-only-settings .settings-section.active").forEach((section) => {
      if (section.querySelector("[data-n7x-install-card]")) return;
      const card = installCard("browser");
      const displayHeading = [...section.querySelectorAll("h2")]
        .find((heading) => heading.textContent.trim() === "Display Mode");
      const displayCard = displayHeading?.closest(".settings-block");
      if (displayCard) displayCard.after(card);
      else section.append(card);
    });

    document.querySelectorAll(".settings-panel").forEach((panel) => {
      if (panel.querySelector("[data-n7x-install-card]")) return;
      const grids = panel.querySelectorAll(":scope > .settings-grid");
      const target = grids[1] || grids[0];
      if (target) target.prepend(installCard("legacy"));
    });
  }

  function updateControls(message = lastMessage) {
    lastMessage = message;
    ensureInstallCards();
    const installed = isInstalled();
    document.querySelectorAll("[data-install-n7x]").forEach((button) => {
      button.disabled = installed;
      button.setAttribute("aria-disabled", String(installed));
      const label = installed ? "N7X is Installed" : "Install N7X";
      if (button.textContent.normalize('NFKC') !== label) button.textContent = label;
    });
    document.querySelectorAll("[data-install-n7x-status]").forEach((status) => {
      const text = installed
        ? "N7X is installed on this device and opens in its own app window."
        : message || (installPrompt
          ? "Ready to install on this device."
          : "Installs N7X as an app with its own window and desktop icon.");
      if (status.textContent.normalize('NFKC') !== text) status.textContent = text;
    });
    document.querySelectorAll("[data-download-n7x-singlefile]").forEach((button) => {
      if (button.dataset.n7xSingleFileBound === "true") return;
      button.dataset.n7xSingleFileBound = "true";
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
        ? "Finishing the N7X installation..."
        : "Installation was cancelled. You can try again anytime.");
    } catch {
      updateControls(platformHelp());
    }
  }

  async function downloadSingleFile(button) {
    const source = new URL("/nyx-singlefile.html", window.location.href);
    source.searchParams.set("release", SINGLE_FILE_RELEASE);
    source.searchParams.set("fresh", Date.now().toString(36));
    const previousLabel = button?.textContent || "Download Single File";
    if (button) {
      button.disabled = true;
      button.textContent = "Downloading…";
    }
    const status = button?.closest("[data-n7x-install-card]")?.querySelector("[data-install-n7x-status]");
    try {
      const response = await fetch(source, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("The N7X file is unavailable.");
      const markup = await response.text();
      if (!markup.trim().toLowerCase().startsWith("<!doctype html")) throw new Error("The N7X file was incomplete.");
      const objectUrl = URL.createObjectURL(new Blob([markup], { type: "text/html;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "N7X-Download.html";
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => { link.remove(); URL.revokeObjectURL(objectUrl); }, 60_000);
      if (status) status.textContent = "N7X-Download.html was saved. Open it from your Downloads folder.";
    } catch {
      if (status) status.textContent = "N7X could not create the download. Check your connection and try again.";
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
    const button = event.target.closest?.("[data-install-n7x]");
    if (!button) return;
    event.preventDefault();
    requestInstall();
  }, true);

                                                                              
                                                                     
  const installUi = '.browser-only-settings,.settings-panel,[data-n7x-install-card],[data-install-n7x],[data-install-n7x-status]';
  const observer = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node =>
      node.nodeType === Node.ELEMENT_NODE &&
      (node.matches(installUi) || node.querySelector(installUi))
    ))) updateControls();
  });
  function start() {
    updateControls();
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  window.NyxInstall = {
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
