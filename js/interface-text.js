(() => {
  if (globalThis.__interfaceTextReady) return;
  globalThis.__interfaceTextReady = true;
  const excluded =
    "script,style,textarea,input,code,pre,kbd,samp,[contenteditable],[data-no-interface-text],[data-user-content],.chat-messages,.ai-messages,.lyrics,.captions,.ai-message,.message-content,[data-chat-history],[data-chat-messages]";
  const originals = new WeakMap();

  const titleWrites = new WeakMap();
  const managedTitles = new WeakSet();
  const implicitOptionValues = new WeakMap();
  const attributeExcluded = excluded.replace("textarea,input,", "");
  const attributes = ["title", "placeholder", "label", "aria-label", "alt"];
  const accessibleLabels = new WeakMap();
  const neutralWords = (text) => text.replace(/\bbr00ser\b/gi, "browser").replace(
    /\b(game frame|games|game|libraries|library|arcade|playlists|playlist|players|player|playback|playing|played|plays|play)\b/gi,
    (word) => {
      const replacements = {
        "game frame": "viewer", games: "games", game: "game", libraries: "collections",
        library: "collection", arcade: "collection", playlists: "mixes", playlist: "mix",
        players: "viewers", player: "viewer", playback: "audio", playing: "active",
        played: "opened", plays: "starts", play: "start",
      };
      const value = replacements[word.toLowerCase()];
      return word === word.toUpperCase() ? value.toUpperCase() :
        /^[A-Z]/.test(word) ? value[0].toUpperCase() + value.slice(1) : value;
    },
  );
  const convertWords = (text) =>
    neutralWords(text)
      .replace(/\bbrowser\b/gi, "br00ser")
      .replace(/\b(?:game|games|gaming)\b/gi, word => Array.from(
        word === word.toUpperCase() ? (word.toLowerCase() === "game" ? "STUDY" : "STUDIES") :
          (/^[A-Z]/.test(word) ? "S" : "s") + (word.toLowerCase() === "game" ? "tudy" : "tudies"), ch =>
        String.fromCodePoint((ch <= "Z" ? 0x1d63c : 0x1d656) + ch.toLowerCase().charCodeAt(0) - 97)).join(""))
      .replace(/\bAI\b/g, "A1")
      .replace(/\b(?:n7x|nyx)(?=\b|(?:tube|ify|1fy|cloud)\b)|\b(?:studyhub|delta\s*math)\b/gi, "N7x")
      .replace(/\b[A-Za-z]{4,}\b/g, (word) => /e/i.test(word) ? word.replace(/e/i, "3") : word.replace(/o/i, "0"))
      .replace(/[A-Za-z]/g, (ch) =>
        String.fromCodePoint((ch <= "Z" ? 0x1d5a0 : 0x1d5ba) + ch.toLowerCase().charCodeAt(0) - 97),
      );

  const convert = (text) =>
    text
      .split(/(https?:\/\/[^\s<>]+|[\w.+-]+@[\w.-]+\.[a-z]{2,})/gi)
      .map((part, index) => (index % 2 ? part : convertWords(part)))
      .join("");
  function applyAttributes(element) {
    if (element.closest(attributeExcluded)) return;
    for (const name of attributes) {
      if (name === "label" && !["OPTION", "OPTGROUP"].includes(element.tagName)) continue;
      const value = element.getAttribute(name);
      if (!value) continue;
      const rendered = name === "aria-label" || name === "alt" ? neutralWords(value) : convert(value);
      if (name === "aria-label") {
        if (rendered !== value) {
          element.setAttribute(name, rendered);
          if (accessibleLabels.get(element) === value) accessibleLabels.set(element, rendered);
        }
        continue;
      }
      if (
        rendered !== value &&
        (!element.hasAttribute("aria-label") ||
          element.getAttribute("aria-label") === accessibleLabels.get(element)) &&
        !element.hasAttribute("aria-labelledby") &&
        ((name === "placeholder" && !element.labels?.length) ||
          (name === "title" && element.matches("button,a") && !element.textContent.trim()))
      ) {
        const plain = neutralWords(value.normalize("NFKC"));
        element.setAttribute("aria-label", plain);
        accessibleLabels.set(element, plain);
      }
      if (rendered !== value) element.setAttribute(name, rendered);
    }
  }
  function apply(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest(excluded)) return;
    const text = node.nodeValue || "";
    if (!/[A-Za-z]/.test(text)) return;
    if (parent.tagName === "TITLE") {
      if (managedTitles.has(parent)) return;
      const last = titleWrites.get(parent);
      if (last && text === last.plain) {
        managedTitles.add(parent);
        return;
      }
    }
    const previous = originals.get(node);
    if (previous?.rendered === text) return;
    const rendered = convert(text);
    if (rendered === text) return;

    const option = parent.closest("option");
    if (
      option &&
      (!option.hasAttribute("value") ||
        option.getAttribute("value") === implicitOptionValues.get(option))
    ) {
      const value = option.text;
      option.setAttribute("value", value);
      implicitOptionValues.set(option, value);
    }
    const control = parent.closest("button,a,label,option,h1,h2,h3,h4,h5,h6");
    if (
      control &&
      (!control.hasAttribute("aria-label") ||
        control.getAttribute("aria-label") === accessibleLabels.get(control))
    ) {
      const plain = neutralWords(control.textContent.normalize("NFKC").trim());
      control.setAttribute("aria-label", plain);
      accessibleLabels.set(control, plain);
    }
    originals.set(node, { plain: text, rendered });
    if (parent.tagName === "TITLE") titleWrites.set(parent, { plain: text, rendered });
    node.nodeValue = rendered;
  }
  function scan(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      apply(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    applyAttributes(root);
    if (root.closest(excluded)) return;
    root
      .querySelectorAll("[title],[placeholder],[aria-label],[alt],option[label],optgroup[label]")
      .forEach(applyAttributes);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) apply(walker.currentNode);
  }
  function start() {
    scan(document.documentElement);
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes") applyAttributes(record.target);
        else if (record.type === "characterData") apply(record.target);
        else for (const node of record.addedNodes) scan(node);
      }
    }).observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: attributes,
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
