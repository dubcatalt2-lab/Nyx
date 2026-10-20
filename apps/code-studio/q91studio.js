window.q91studio = function (api) {
  const { refs } = api,
    $ = (s) => document.querySelector(s),
    make = (tag, cls, text) => {
      const el = document.createElement(tag);
      if (cls) el.className = cls;
      if (text) el.textContent = text;
      return el;
    };
  const glyphs = {
    assistant: "M4 4h16v12H9l-5 4z M8 8h8 M8 12h5",
    files: "M6 3h8l4 4v14H6z M14 3v5h5",
    search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    undo: "M3 10h8a7 7 0 0 1 0 14 M3 10l5-5 M3 10l5 5",
    redo: "M21 10h-8a7 7 0 0 0 0 14 M21 10l-5-5 M21 10l-5 5",
    more: "M5 12h.01 M12 12h.01 M19 12h.01",
    close: "M6 6l12 12 M18 6L6 18",
    external: "M15 3h6v6 M10 14L21 3 M21 14v7H3V3h7",
    attach: "m21 11-9 9a6 6 0 0 1-9-9l10-10a4 4 0 0 1 6 6L9 17a2 2 0 0 1-3-3l9-9",
    folder: "M3 7V4h6l2 3h10v13H3z",
  };
  const icon = (name) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", glyphs[name] || glyphs.files);
    svg.append(path);
    return svg;
  };

  function button(label, fn, glyph) {
    const b = make("button", "q91button", glyph ? "" : label);
    b.type = "button";
    b.title = label;
    b.setAttribute("aria-label", label);
    if (glyph) b.append(icon(glyph));
    b.onclick = fn;
    return b;
  }
  const key = "nyx.codeStudio.design.v1";
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem(key) || "{}");
  } catch {}
  const persist = () => {
    try {
      localStorage.setItem(key, JSON.stringify(settings));
    } catch {}
  };
  const toast = make("div", "q91toast");
  toast.setAttribute("role", "status");
  document.body.append(toast);
  let toastTimer;

  function notify(text) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.hidden = true), 3500);
  }
  toast.hidden = true;
  const header = $(".workspace-header");
  header.classList.add("q91header");
  refs.shell.before(header);
  $(".workspace-heading").replaceChildren();
  const brand = make("div", "q91brand");
  brand.append(
    icon("files"),
    make("strong", "", "Code Sandbox"),
    make("span", "", "/"),
    make("span", "", "Local workspace"),
  );
  $(".workspace-heading").append(brand);
  const status = $(".editor-status");
  status.classList.add("q91status");
  refs.shell.after(status);
  status.prepend(make("span", "q91local", "Device workspace"));
  const overflow = make("dialog", "q91menu");
  overflow.setAttribute("aria-label", "Workspace actions");
  const overflowTitle = make("h2", "", "Workspace");
  overflow.append(overflowTitle);
  document.body.append(overflow);
  const closeMenu = button("Close menu", () => overflow.close(), "close");
  overflow.append(closeMenu);
  const secondary = make("div", "q91secondary");
  secondary.append($(".starter-field"), $(".toolbar-actions"));
  overflow.append(secondary);
  $(".project-controls").hidden = true;
  const menuButton = button("Workspace actions", () => overflow.showModal(), "more");
  $(".workspace-actions").append(menuButton);
  $(".workspace-actions").prepend(
    button("Undo edit", () => undo(-1), "undo"),
    button("Redo edit", () => undo(1), "redo"),
  );
  const rail = make("nav", "q91rail");
  rail.setAttribute("aria-label", "Editor tools");
  const explorer = make("aside", "q91explorer");
  explorer.setAttribute("aria-label", "Workspace files");
  explorer.hidden = true;
  const explorerHeader = make("header");
  explorerHeader.append(
    make("strong", "", "Files"),
    button("Close files", () => setExplorer(false), "close"),
  );
  explorer.append(explorerHeader);
  const fileActions = make("div", "q91file-actions");
  fileActions.append(
    api.newFile,
    button("New folder", () => editDialog("folder"), "folder"),
  );
  explorer.append(fileActions);
  const tree = make("div", "q91tree");
  explorer.append(tree);
  refs.shell.prepend(rail, explorer);
  const grip = make("div", "q91file-grip");
  grip.setAttribute("role", "separator");
  grip.setAttribute("aria-label", "Resize files");
  grip.setAttribute("aria-orientation", "vertical");
  grip.tabIndex = 0;
  explorer.append(grip);
  const resizeFiles = (value) => {
    settings.fileWidth = Math.max(160, Math.min(320, value));
    document.documentElement.style.setProperty("--q91files", settings.fileWidth + "px");
    persist();
  };
  resizeFiles(settings.fileWidth || 210);
  grip.onkeydown = (e) => {
    if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      resizeFiles(settings.fileWidth + (e.key === "ArrowRight" ? 10 : -10));
    }
  };
  grip.onpointerdown = (e) => {
    e.preventDefault();
    const start = e.clientX,
      width = settings.fileWidth;
    const move = (event) => resizeFiles(width + event.clientX - start),
      stop = () => {
        removeEventListener("pointermove", move);
        removeEventListener("pointerup", stop);
      };
    addEventListener("pointermove", move);
    addEventListener("pointerup", stop, {
      once: true,
    });
  };

  function setExplorer(open) {
    explorer.hidden = !open;
    document.body.classList.toggle("q91files-open", open);
    settings.files = open;
    persist();
    rail.firstElementChild.setAttribute("aria-expanded", String(open));
  }
  rail.append(
    button("Workspace files", () => setExplorer(explorer.hidden), "files"),
    button("Find and replace", () => findDialog.showModal(), "search"),
  );
  const assistantToggle = button("Toggle N7X AI panel", () => {
    const opening = document.body.classList.contains("ai-collapsed") ||
      (matchMedia("(max-width:940px)").matches && !document.body.classList.contains("mobile-show-ai"));
    api.setPanelCollapsed("assistant", !opening);
    if (matchMedia("(max-width:940px)").matches) api.setMobileView(opening ? "ai" : "editor");
    document.body.classList.remove("q91preview-only");
    settings.layout = "split";
    persist();
  }, "assistant");
  assistantToggle.dataset.togglePanel = "assistant";
  assistantToggle.setAttribute("aria-pressed", String(!document.body.classList.contains("ai-collapsed")));
  rail.append(assistantToggle);
  const tabs = make("div", "q91tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Open files");
  $(".editor-tab").hidden = true;
  $(".card-header").prepend(tabs);
  $(".editor-meta").replaceChildren(refs.language);
  refs.language.setAttribute("aria-label", "File language");
  let dormant = false;
  let opened = new Set([api.snapshot().file]),
    signature = "";
  const folders = new Set(Array.isArray(settings.folders) ? settings.folders : []);
  const histories = new Map();
  const context = make("dialog", "q91menu");
  context.setAttribute("aria-label", "File actions");
  document.body.append(context);
  let contextFile = "";
  context.append(
    make("h2", "", "File actions"),
    button("Close file actions", () => context.close(), "close"),
  );
  for (const action of ["rename", "duplicate", "delete"])
    context.append(
      button(action[0].toUpperCase() + action.slice(1), () => {
        context.close();
        editDialog(action, contextFile);
      }),
    );

  function fileMenu(name) {
    contextFile = name;
    context.showModal();
  }
  const fileDialog = make("dialog", "q91menu");
  fileDialog.setAttribute("aria-label", "Manage file");
  fileDialog.innerHTML =
    '<form><h2></h2><label>Name<input name="name" autocomplete="off" maxlength="120"></label><p role="alert"></p><footer><button type="button">Cancel</button><button type="submit">Save</button></footer></form>';
  document.body.append(fileDialog);
  let pending;
  fileDialog.querySelector("[type=button]").onclick = () => fileDialog.close();

  function editDialog(action, name = "") {
    pending = {
      action,
      name,
    };
    fileDialog.querySelector("h2").textContent =
      action === "delete"
        ? "Delete " + name + "?"
        : action === "folder"
          ? "Create folder"
          : action === "rename"
            ? "Rename file"
            : "Duplicate file";
    const field = fileDialog.querySelector("input");
    field.value = action === "duplicate" ? name.replace(/(\.[^.]+)$/, "-copy$1") : name;
    field.parentElement.hidden = action === "delete";
    field.required = action !== "delete";
    fileDialog.querySelector("[role=alert]").textContent =
      action === "delete" ? "This removes the saved file from this workspace." : "";
    fileDialog.querySelector("[type=submit]").textContent = action === "delete" ? "Delete" : "Save";
    fileDialog.showModal();
    field.focus();
  }
  fileDialog.querySelector("form").onsubmit = (e) => {
    e.preventDefault();
    try {
      const name = fileDialog.querySelector("input").value.trim();
      if (pending.action === "folder") {
        if (!/^[\w-]+(?:\/[\w-]+)*$/.test(name))
          throw Error("Use folder names separated by /, without parent paths.");
        folders.add(name);
        settings.folders = [...folders];
        persist();
      } else api.mutate(pending.action, pending.name, name);
      signature = "";
      render();
      fileDialog.close();
      notify("Workspace updated");
    } catch (error) {
      fileDialog.querySelector("[role=alert]").textContent = error.message;
    }
  };

  function render() {
    const snap = api.snapshot();
    opened = new Set([...opened].filter((name) => Object.hasOwn(snap.codes, name)));
    if (!dormant) opened.add(snap.file);
    refs.editorWrap.hidden = dormant;
    const next = JSON.stringify([Object.keys(snap.codes), snap.file, [...folders], [...opened]]);
    if (next === signature) return;
    signature = next;
    tree.replaceChildren();
    tabs.replaceChildren();
    const groups = new Map([["", tree]]);

    function group(path) {
      if (groups.has(path)) return groups.get(path);
      const parts = path.split("/"),
        label = parts.pop(),
        parent = group(parts.join("/"));
      const detail = make("details", "q91folder");
      detail.open = true;
      const summary = make("summary", "", label);
      summary.prepend(icon("folder"));
      const content = make("div");
      detail.append(summary, content);
      parent.append(detail);
      groups.set(path, content);
      return content;
    }
    [...folders].sort().forEach(group);
    for (const name of Object.keys(snap.codes).sort()) {
      const parts = name.split("/"),
        label = parts.pop();
      const row = make("div", "q91file");
      const open = button(label, () => {
        dormant = false;
        api.switchFile(name);
        render();
      });
      open.prepend(icon("files"));
      open.setAttribute("aria-current", String(name === snap.file));
      open.title = name;
      row.append(
        open,
        button("Actions for " + name, () => fileMenu(name), "more"),
      );
      row.oncontextmenu = (e) => {
        e.preventDefault();
        fileMenu(name);
      };
      group(parts.join("/")).append(row);
    }
    for (const name of opened) {
      const tab = make("div", "q91tab");
      const open = button(name.split("/").pop(), () => {
        dormant = false;
        api.switchFile(name);
        render();
      });
      open.setAttribute("role", "tab");
      open.setAttribute("aria-selected", String(name === snap.file));
      open.prepend(icon("files"));
      tab.append(
        open,
        button(
          "Close " + name,
          () => {
            if (opened.size === 1) {
              opened.clear();
              dormant = true;
              signature = "";
              render();
              setExplorer(true);
              notify("Select a file to continue editing.");
              return;
            }
            opened.delete(name);
            if (name === snap.file) api.switchFile([...opened].at(-1));
            signature = "";
            render();
          },
          "close",
        ),
      );
      tabs.append(tab);
    }
  }
  addEventListener("q91change", () =>
    queueMicrotask(() => {
      if (api.snapshot().file !== api.workspaceFiles.value) dormant = false;
      render();
    }),
  );
  api.workspaceFiles.addEventListener("change", () => queueMicrotask(render));
  refs.language.addEventListener("change", () => queueMicrotask(render));
  render();
  setExplorer(Boolean(settings.files));
  const history = () => {
    const name = api.snapshot().file;
    if (!histories.has(name))
      histories.set(name, {
        values: [api.code()],
        index: 0,
      });
    return histories.get(name);
  };
  history();
  refs.input.addEventListener("beforeinput", () => {
    const h = history();
    if (h.values[h.index] !== refs.input.value) {
      h.values = h.values.slice(0, h.index + 1);
      h.values.push(refs.input.value);
      h.index++;
    }
  });
  refs.input.addEventListener("input", () => {
    const h = history();
    if (h.values[h.index] !== refs.input.value) {
      h.values = h.values.slice(0, h.index + 1);
      h.values.push(refs.input.value);
      if (h.values.length > 100) h.values.shift();
      h.index = h.values.length - 1;
    }
  });

  function undo(delta) {
    const h = history(),
      index = h.index + delta;
    if (index < 0 || index >= h.values.length) return;
    h.index = index;
    api.setCode(h.values[index]);
    refs.input.focus();
  }
  const findDialog = make("dialog", "q91menu q91find");
  findDialog.setAttribute("aria-label", "Find and replace");
  findDialog.innerHTML =
    '<h2>Find in file</h2><label>Find<input data-find autocomplete="off"></label><label>Replace with<input data-replace autocomplete="off"></label><p role="status"></p>';
  document.body.append(findDialog);

  function find() {
    const query = findDialog.querySelector("[data-find]").value;
    if (!query) return;
    const text = refs.input.value,
      start = refs.input.selectionEnd;
    let at = text.indexOf(query, start);
    if (at < 0) at = text.indexOf(query);
    findDialog.querySelector("[role=status]").textContent =
      at < 0 ? "No matches" : "Match at character " + (at + 1);
    if (at >= 0) {
      refs.input.setSelectionRange(at, at + query.length);
      const line = text.slice(0, at).split("\n").length;
      refs.input.scrollTop = Math.max(
        0,
        (line - 4) * parseFloat(getComputedStyle(refs.input).lineHeight),
      );
      refs.input.dispatchEvent(new Event("scroll"));
      refs.input.dispatchEvent(new Event("keyup"));
    }
  }
  findDialog.append(
    button("Find next", find),
    button("Replace all", () => {
      const query = findDialog.querySelector("[data-find]").value;
      if (!query) return;
      const text = api.code(),
        count = text.split(query).length - 1;
      api.setCode(text.split(query).join(findDialog.querySelector("[data-replace]").value));
      findDialog.querySelector("[role=status]").textContent = count + " replacements";
    }),
    button("Close", () => {
      findDialog.close();
      refs.input.focus();
    }),
  );
  refs.input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      findDialog.showModal();
    }
    if ((e.ctrlKey || e.metaKey) && ["z", "y"].includes(e.key.toLowerCase())) {
      e.preventDefault();
      undo(e.key.toLowerCase() === "y" || e.shiftKey ? 1 : -1);
    }
  });
  refs.input.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    editorMenu.showModal();
  });
  const editorMenu = make("dialog", "q91menu");
  editorMenu.setAttribute("aria-label", "Editor actions");
  editorMenu.append(
    make("h2", "", "Editor"),
    button("Find and replace", () => {
      editorMenu.close();
      findDialog.showModal();
    }),
    button("Select all", () => {
      editorMenu.close();
      refs.input.focus();
      refs.input.select();
    }),
    button("Undo", () => {
      editorMenu.close();
      undo(-1);
    }),
    button("Close", () => editorMenu.close()),
  );
  document.body.append(editorMenu);
  const prefs = make("label", "q91pref", "Editor font size");
  const size = make("select");
  for (const n of [12, 13, 14, 15, 16, 18]) {
    const option = make("option", "", n + " px");
    option.value = n;
    size.append(option);
  }
  size.value = String(settings.fontSize || 13);
  const font = () => {
    settings.fontSize = Number(size.value);
    document.documentElement.style.setProperty("--q91font", size.value + "px");
    persist();
  };
  size.onchange = font;
  font();
  prefs.append(size);
  overflow.append(prefs);
  const wrapButton = button("Word wrap", () => {
    settings.wrap = !settings.wrap;
    applyWrap();
    persist();
  });
  overflow.append(wrapButton);
  const measure = make("div");
  measure.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-all;tab-size:2;left:-10000px";
  document.body.append(measure);

  function updateWrap() {
    if (!settings.wrap) return;
    const style = getComputedStyle(refs.input);
    measure.style.font = style.font;
    measure.style.width =
      refs.input.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight) +
      "px";
    const lines = refs.input.value.split("\n"),
      heights = lines.map((line) => {
        measure.textContent = line || " ";
        return Math.max(parseFloat(style.lineHeight), measure.getBoundingClientRect().height);
      });
    refs.lineNumbers.replaceChildren(
      ...heights.map((h, i) => {
        const span = make("span", "", String(i + 1));
        span.style.cssText = "display:block;height:" + h + "px";
        return span;
      }),
    );
    const line = refs.input.value.slice(0, refs.input.selectionStart).split("\n").length - 1;
    refs.editorWrap.style.setProperty(
      "--active-line",
      String(heights.slice(0, line).reduce((sum, h) => sum + h, 0) / parseFloat(style.lineHeight)),
    );
  }

  function applyWrap() {
    document.body.classList.toggle("q91wrap", Boolean(settings.wrap));
    refs.input.wrap = settings.wrap ? "soft" : "off";
    wrapButton.setAttribute("aria-pressed", String(Boolean(settings.wrap)));
    if (settings.wrap) updateWrap();
    else refs.input.dispatchEvent(new Event("input"));
  }
  size.addEventListener("change", updateWrap);
  addEventListener("q91cursor", updateWrap);
  new ResizeObserver(updateWrap).observe(refs.editorWrap);
  applyWrap();
  const layouts = make("div", "q91layouts");
  layouts.append(make("h3", "", "Workspace layout"));

  function layout(mode) {
    document.body.classList.toggle("q91preview-only", mode === "preview");
    api.setPanelCollapsed("assistant", mode === "focus" || mode === "preview");
    api.setPanelCollapsed("preview", mode === "focus");
    if (matchMedia("(max-width:940px)").matches)
      api.setMobileView(mode === "preview" ? "preview" : "editor");
    settings.layout = mode;
    persist();
  }
  for (const [mode, label] of [
    ["split", "Editor & preview"],
    ["focus", "Editor focus"],
    ["preview", "Preview only"],
  ])
    layouts.append(
      button(label, () => {
        layout(mode);
        overflow.close();
      }),
    );
  overflow.append(layouts);
  if (settings.layout) layout(settings.layout);
  document.querySelectorAll("[data-toggle-panel]").forEach((b) =>
    b.addEventListener("click", () => {
      document.body.classList.remove("q91preview-only");
      settings.layout = "split";
      persist();
    }),
  );
  const deviceBar = make("div", "q91devices");
  deviceBar.append(make("span", "", "Viewport"));
  for (const [name, width] of [
    ["Desktop", "100%"],
    ["Tablet", "768px"],
    ["Mobile", "375px"],
  ]) {
    const b = button(name, () => {
      refs.preview.style.width = width;
      settings.device = name;
      persist();
      deviceBar
        .querySelectorAll("button")
        .forEach((el) => el.setAttribute("aria-pressed", String(el === b)));
    });
    b.setAttribute("aria-pressed", String((settings.device || "Desktop") === name));
    deviceBar.append(b);
    if (settings.device === name) refs.preview.style.width = width;
  }
  $(".result-header").after(deviceBar);
  let liveTimer;
  const live = button("Live preview", () => {
    settings.live = !settings.live;
    live.setAttribute("aria-pressed", String(settings.live));
    persist();
    if (settings.live)
      notify("Browser previews update after you stop typing. Server-run languages still use Run.");
  });
  live.setAttribute("aria-pressed", String(Boolean(settings.live)));
  deviceBar.append(live);
  refs.input.addEventListener("input", () => {
    clearTimeout(liveTimer);
    if (
      settings.live &&
      ["html", "css", "javascript", "json", "markdown"].includes(refs.language.value)
    )
      liveTimer = setTimeout(() => api.run(), 700);
  });
  const external = button(
    "Open isolated preview in new tab",
    () => {
      const source = refs.preview.getAttribute("srcdoc");
      if (!source) {
        notify("Run the file to create a preview first.");
        return;
      }
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts");
      frame.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0";
      frame.srcdoc = source;
      const blob = URL.createObjectURL(
        new Blob(["<!doctype html><title>Sandbox preview</title>" + frame.outerHTML], {
          type: "text/html",
        }),
      );
      window.open(blob, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blob), 60000);
    },
    "external",
  );
  $(".preview-tools").append(external);
  const quick = $(".quick-prompts");
  quick.replaceChildren();
  for (const [name, mode, prompt] of [
    ["Fix", "agent", "Find and fix bugs in the current file."],
    ["Explain", "ask", "Explain the current file concisely."],
    ["Refactor", "edit", "Refactor the current file without changing behavior."],
    ["Optimize", "edit", "Improve the performance of the current file without changing behavior."],
  ])
    quick.append(
      button(name, () => {
        api.agentMode.value = mode;
        api.agentMode.onchange();
        refs.prompt.value = prompt;
        refs.prompt.focus();
      }),
    );
  $(".assistant-intro").textContent = "Plan a change, ask a question, or edit your workspace.";
  $(".assistant-brand small").textContent = "Workspace assistant";
  $(".assistant-empty strong").textContent = "Build your next idea";
  $(".assistant-empty p").textContent =
    "Your workspace is already in context. Start with a small change.";
  const attachment = make("input");
  attachment.type = "file";
  attachment.accept = ".txt,.md,.html,.css,.js,.ts,.json,.py";
  attachment.hidden = true;
  const attach = button("Attach text context", () => attachment.click(), "attach");
  refs.form.append(attach, attachment);
  attachment.onchange = async () => {
    const file = attachment.files[0];
    if (!file) return;
    if (file.size > 3500) {
      notify("Choose a text file smaller than 3.5 KB.");
      return;
    }
    const value = "\nContext from " + file.name + ":\n" + (await file.text());
    if (refs.prompt.value.length + value.length > 4000) {
      notify("Context exceeds the 4,000 character limit.");
      return;
    }
    refs.prompt.value += value;
    refs.prompt.focus();
    notify(file.name + " attached as text context");
    attachment.value = "";
  };
  refs.prompt.maxLength = 4000;
  const available = make("p", "q91availability");
  api.assistantSettings.after(available);
  new MutationObserver(() => {
    document
      .querySelectorAll(".example-prompts button")
      .forEach((b) => (b.disabled = api.modelPicker.disabled));
    available.textContent = api.modelPicker.disabled
      ? "No models available. Check your sign-in and connection."
      : "";
    refs.send.disabled = api.modelPicker.disabled || refs.aiStatus.classList.contains("is-working");
  }).observe(api.modelPicker, {
    attributes: true,
    childList: true,
  });
};
