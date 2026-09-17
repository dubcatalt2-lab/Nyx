import {installShortcuts} from "./shortcuts.mjs";
import {protectionSandbox} from "./protections.mjs";
import { scanFilters, filterSignatures } from "./filter-detection.mjs";
import { decorateEmbedded } from "./embedded.mjs";
import { startClock } from "./clock.mjs";
import { icons as nyxIcons } from "./icons.mjs";
import { browse, control, closeBrowser, testRelay, updateProtectionPolicy, currentWebsiteUrl } from "./proxy.mjs";
const $ = (id) => document.getElementById(id),
  root = document.documentElement;
const defaults = {
  theme: "mocha",
  accent: "mauve",
  motion: false,
  engine: "duckduckgo",
  transport: "epoxy",
  relay: "",
  autoRelay: true,
  adBlock: true, popupBlock: true, downloadBlock: true,
  blocker: "auto",
  tabPreset: "tutsi",
  tabTitle: "",
  wallpaper: "waves",
  closePrevention: true,
};
let saved;
try {
  saved = JSON.parse(localStorage.getItem("tutsi.settings.v1") || "{}");
} catch {}
let settings = { ...defaults, ...saved };
const palettes = {
  mocha: {
    base: "#1e1e2e",
    mantle: "#181825",
    surface: "#313244",
    text: "#cdd6f4",
    muted: "#a6adc8",
    line: "#45475a",
    mauve: "#cba6f7",
    blue: "#89b4fa",
    green: "#a6e3a1",
    peach: "#fab387",
    pink: "#f5c2e7",
    teal: "#94e2d5",
    red: "#f38ba8",
    yellow: "#f9e2af",
  },
  latte: {
    base: "#eff1f5",
    mantle: "#e6e9ef",
    surface: "#dce0e8",
    text: "#4c4f69",
    muted: "#6c6f85",
    line: "#bcc0cc",
    mauve: "#8839ef",
    blue: "#1e66f5",
    green: "#40a02b",
    peach: "#fe640b",
    pink: "#ea76cb",
    teal: "#179299",
    red: "#d20f39",
    yellow: "#df8e1d",
  },
};
palettes.macchiato = {
  base: "#24273a",
  mantle: "#1e2030",
  surface: "#363a4f",
  text: "#cad3f5",
  muted: "#a5adcb",
  line: "#494d64",
  mauve: "#c6a0f6",
  blue: "#8aadf4",
  green: "#a6da95",
  peach: "#f5a97f",
  pink: "#f5bde6",
  teal: "#8bd5ca",
  red: "#ed8796",
  yellow: "#eed49f",
};
palettes.frappe = {
  base: "#303446",
  mantle: "#292c3c",
  surface: "#414559",
  text: "#c6d0f5",
  muted: "#a5adce",
  line: "#51576d",
  mauve: "#ca9ee6",
  blue: "#8caaee",
  green: "#a6d189",
  peach: "#ef9f76",
  pink: "#f4b8e4",
  teal: "#81c8be",
  red: "#e78284",
  yellow: "#e5c890",
};
function themePalette() {
  const palette = { ...(palettes[settings.theme] || palettes.mocha) };
  if (settings.accent === "mauve") return palette;
  const color = palette[settings.accent] || palette.mauve;
  const [r, g, b] = color
    .slice(1)
    .match(/../g)
    .map((hex) => parseInt(hex, 16) / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  let hue = delta
    ? (max === r
        ? (g - b) / delta
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4) * 60
    : 0;
  hue = (hue + 360) % 360;
  for (const name of ["base", "mantle", "surface", "line", "text", "muted"]) {
    const channels = palette[name]
      .slice(1)
      .match(/../g)
      .map((hex) => parseInt(hex, 16) / 255);
    const lightness = (Math.max(...channels) + Math.min(...channels)) * 50;
    const saturation = ["text", "muted"].includes(name) ? 18 : 24;
    palette[name] =
      `hsl(${hue.toFixed(1)} ${saturation}% ${lightness.toFixed(1)}%)`;
  }
  return palette;
}
const paths = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  chevron: "m9 5 7 7-7 7",
  close: "m6 6 12 12M6 18 18 6",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  reload: "M20 7v5h-5M20 12a8 8 0 1 0-2 6",
  settings:
    "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  sparkles: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
  film: "M3 4h18v16H3zM7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4",
  music: "M9 18V5l12-3v14M9 18a3 3 0 1 1-3-3h3m12 1a3 3 0 1 1-3-3h3",
  game: "M7 7h10l4 11-2 2-5-4h-4l-5 4-2-2zM7 10v4m-2-2h4m7-1h.01m2 3h.01",
  palette:
    "M21 12a9 9 0 1 0-9 9c4 0 1-4 3-5s6 0 6-4M7 9h.01m4-3h.01m5 2h.01M6 14h.01",
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z",
};
document.querySelectorAll("[data-icon]").forEach((node) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const name = node.dataset.icon;
  const alias = {
    globe: "browse",
    game: "games",
    film: "movies",
    sparkles: "sparkle",
  };
  if (nyxIcons[alias[name] || name])
    svg.innerHTML = nyxIcons[alias[name] || name];
  else {
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", paths[name] || paths.search);
    svg.append(path);
  }
  node.append(svg);
});
let toastTimer;
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 4000);
}
const frames = new Map();
function tabAppearance() {
  const presets = {
    tutsi: ["Tutsi Math", "/apps/tutsi/icon.png?v=2"],
    classroom: ["Google Classroom", 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="8" fill="%23fbbc04"/%3E%3Crect x="8" y="10" width="48" height="40" rx="3" fill="%2334a853"/%3E%3Ccircle cx="32" cy="25" r="6" fill="white"/%3E%3Cpath d="M18 42c4-9 20-9 24 0" fill="white"/%3E%3C/svg%3E'],
    classlink: ["ClassLink", "/assets/icons/classlink-logo.png"],
    drive: ["My Drive - Google Drive", "/assets/icons/googledrive-logo.png"],
    google: ["Google", "/assets/icons/google-logo.png"],
    custom: [
      settings.tabTitle.trim() || "Tutsi Math",
      "/apps/tutsi/icon.png?v=2",
    ],
  };
  const [title, icon] = presets[settings.tabPreset] || presets.tutsi;
  document.title = title;
  document.querySelector("link[rel=icon]").href = icon;
  $("tab-title").disabled = settings.tabPreset !== "custom";
}
function styleApp(frame) {
  try {
    const doc = frame.contentDocument;
    if (
      !doc ||
      new URL(frame.contentWindow.location.href).origin !== location.origin
    )
      return;
    const appKey = [...frames].find(([, item]) => item === frame)?.[0];
    if (
      !appKey ||
      new URL(frame.contentWindow.location.href).pathname !== appPaths[appKey]
    )
      return;
    let style = doc.getElementById("tutsi-theme");
    if (!style) {
      style = doc.createElement("style");
      style.id = "tutsi-theme";
      doc.head.append(style);
    }
    const p = themePalette(),
      accent = p[settings.accent] || p.mauve;
    const accentRgb = accent
      .slice(1)
      .match(/../g)
      .map((hex) => parseInt(hex, 16))
      .join(",");
    style.textContent = `:root,body{--accent-rgb:${accentRgb}!important;--ai-theme-hover-border:${accent}!important;color-scheme:${settings.theme === "latte" ? "light" : "dark"};--tutsi-base:${p.base};--tutsi-mantle:${p.mantle};--bg:${p.base}!important;--background:${p.base}!important;--surface:${p.mantle}!important;--panel:${p.mantle}!important;--text:${p.text}!important;--muted:${p.muted}!important;--accent:${accent}!important;--border:${p.line}!important;--line:${p.line}!important;--field:${p.surface}!important;--surface-strong:${p.mantle}!important;--surface-soft:${p.surface}!important;--surface-raised:${p.surface}!important;--surface-hover:${p.surface}!important;--page:${p.base}!important;--page-deep:${p.mantle}!important;--nt-bg:${p.base}!important;--dim:${p.muted}!important;--ai-bg:${p.base}!important;--ai-bg-deep:${p.mantle}!important;--ai-surface:${p.mantle}!important;--ai-surface-raised:${p.surface}!important;--ai-surface-hover:${p.surface}!important;--ai-border:${p.line}!important;--ai-text:${p.text}!important;--ai-text-soft:${p.text}!important;--ai-muted:${p.muted}!important;--ai-accent:${accent}!important;--ai-accent-bright:${accent}!important;--ai-accent-foreground:${p.base}!important}html,body{background:${p.base}!important;color:${p.text}!important}body::before,body::after{background-image:none!important}.ai-workspace,.ai-main,.ai-sidebar{background:${p.base}!important}.ai-topbar,.ai-composer,.ai-sidebar{border-color:${p.line}!important}.ai-brand img{content:url('/apps/tutsi/icon.png?v=2')}.ai-brand-mark{background-image:url('/apps/tutsi/icon.png?v=2')!important}#stars{display:none!important} ${settings.motion ? "*,*::before,*::after{animation:none!important;transition:none!important}" : ""}`;
    doc.documentElement.dataset.motion = settings.motion ? "reduce" : "normal";
    decorateApp(doc);
    const appName = [...frames].find(([, item]) => item === frame)?.[0];
    decorateEmbedded(doc, appName || "app");
    installShortcuts(doc,shortcutActions);
    frame.contentWindow.postMessage(
      {
        type: "nyx:theme-sync",
        theme: settings.theme === "latte" ? "light" : "dark",
      },
      location.origin,
    );
  } catch {}
}
function decorateApp(doc) {
  for (const selector of [".movie-brand img", ".nyxify-brand img"]) {
    const image = doc.querySelector(selector);
    if (image) image.src = "/apps/tutsi/icon.png?v=2";
  }
  const movie = doc.querySelector(".movie-brand span");
  if (movie) movie.textContent = "Tutsi Movies";
  const music = doc.querySelector(".nyxify-brand strong");
  if (music) music.textContent = "Tutsi Music";
  const subtitle = doc.querySelector(".nyxify-brand small");
  if (subtitle) subtitle.textContent = "Music";
  const arcade = doc.querySelector(".cove-header .eyebrow");
  if (arcade) arcade.textContent = "Tutsi arcade";
  for (const selector of [".ai-brand-copy h1", ".ai-sidebar-brand strong"]) {
    const name = doc.querySelector(selector);
    if (name) name.textContent = "Tutsi AI";
  }
  const input = doc.querySelector("#input");
  if (input?.tagName === "TEXTAREA") {
    input.placeholder = "Ask Tutsi AI anything...";
    input.setAttribute("aria-label", "Message Tutsi AI");
  }
  const home = doc.querySelector(".home-link");
  if (home) {
    home.textContent = "Back to Tutsi";
    home.onclick = (event) => {
      event.preventDefault();
      location.hash = "home";
    };
  }
}
function applySettings() {
  const p = themePalette();
  for (const [key, value] of Object.entries(p))
    root.style.setProperty(`--${key}`, value);
  root.style.setProperty("--accent", p[settings.accent] || p.mauve);
  root.style.colorScheme = settings.theme === "latte" ? "light" : "dark";
  root.dataset.motion = settings.motion ? "reduce" : "normal";
  root.dataset.wallpaper = settings.wallpaper;
  root.dataset.theme = settings.theme;
  $("wallpaper").value = settings.wallpaper;
  $("close-prevention").checked = settings.closePrevention;
  document.querySelector("meta[name=theme-color]").content = p.base;
  document
    .querySelectorAll("[name=theme]")
    .forEach((el) => (el.checked = el.value === settings.theme));
  $("accent").value = settings.accent;
  $("motion").checked = settings.motion;
  $("search-engine").value = settings.engine;
  $("transport").value = settings.transport;
  $("relay").value = settings.relay;
  $("auto-relay").checked = settings.autoRelay;
  for(const [id,key] of [['ad-block','adBlock'],['popup-block','popupBlock'],['download-block','downloadBlock']])$(id).checked=settings[key]!==false;
  updateProtectionPolicy(settings);
  $("blocker").value = settings.blocker;
  $("tab-preset").value = settings.tabPreset;
  $("tab-title").value = settings.tabTitle;
  $("connection-shortcut").firstChild.textContent =
    "Connection settings ";
  tabAppearance();
  frames.forEach(styleApp);
  try {
    localStorage.setItem("tutsi.settings.v1", JSON.stringify(settings));
    localStorage.setItem(
      "nyx.transport",
      settings.transport === "libcurl" ? "libcurlRaw" : settings.transport,
    );
    if (settings.relay) localStorage.setItem("nyx.wispUrl", settings.relay);
    else localStorage.removeItem("nyx.wispUrl");
  } catch {
    toast("Your browser could not save these settings.");
  }
}
for (const [id, key] of Object.entries({
  "close-prevention": "closePrevention",
  "auto-relay": "autoRelay",
  "ad-block": "adBlock", "popup-block": "popupBlock", "download-block": "downloadBlock",
  blocker: "blocker",
  wallpaper: "wallpaper",
  accent: "accent",
  motion: "motion",
  "search-engine": "engine",
  transport: "transport",
  "tab-preset": "tabPreset",
  "tab-title": "tabTitle",
}))
  $(id).addEventListener("change", () => {
    settings[key] = $(id).type === "checkbox" ? $(id).checked : $(id).value;
    applySettings();
    if(['adBlock','popupBlock','downloadBlock'].includes(key)){
      for(const tab of browserTabs)if(tab.element){tab.element.setAttribute('sandbox',protectionSandbox(settings));control('reload',tab.element);}
    }
  });
document.querySelectorAll("[name=theme]").forEach((el) =>
  el.addEventListener("change", () => {
    settings.theme = el.value;
    applySettings();
  }),
);
$("relay").addEventListener("change", () => {
  const value = $("relay").value.trim();
  try {
    if (value) {
      const url = new URL(value);
      if (
        !["ws:", "wss:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.hash ||
        (location.protocol === "https:" && url.protocol !== "wss:")
      )
        throw Error();
    }
    settings.relay = value;
    applySettings();
  } catch {
    toast("Enter a valid secure Wisp URL, such as wss://host/wisp/.");
    $("relay").value = settings.relay;
  }
});
$("reset-settings").onclick = () => {
  settings = { ...defaults };
  applySettings();
  for(const tab of browserTabs)if(tab.element){tab.element.setAttribute("sandbox",protectionSandbox(settings));control("reload",tab.element);}
  toast("Tutsi settings restored.");
};
$("test-connection").onclick = async () => {
  $("test-connection").disabled = true;
  $("connection-result").textContent = "Connecting…";
  try {
    $("connection-result").textContent = await testRelay(settings);
  } catch (e) {
    $("connection-result").textContent = e.message;
  } finally {
    $("test-connection").disabled = false;
  }
};
$("connection-shortcut").onclick = () => (location.hash = "connection");
const appPaths = {
  ai: "/ai.html",
  movies: "/apps/movies/",
  music: "/apps/nyxify/",
  games: "/assets/games/",
  youtube: "/apps/nyxtube/",
  chat: "/apps/chat/",
  profiles: "/apps/tutsi/profiles.html",
  code: "/apps/code-studio/",
  checker: "/apps/link-checker/",
  links: "/apps/link-generator/",
  publisher: "/apps/jsdelivr-publisher/",
  api: "/apps/api-keys/",
};
function appFrame(name) {
  if (frames.has(name)) return frames.get(name);
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.title = {
    ai: "Tutsi AI",
    movies: "Movies",
    music: "Music",
    games: "Games",
    youtube: "NyxTube",
    chat: "Chat",
    profiles: "Profiles",
    code: "Code Sandbox",
    checker: "Link Checker",
    links: "Link Generator",
    publisher: "JSDelivr Publisher",
    api: "API Keys",
  }[name];
  frame.allow =
    "fullscreen; autoplay; encrypted-media; picture-in-picture; clipboard-write; microphone; display-capture";
  frame.src = appPaths[name];
  frame.addEventListener("load", () => {styleApp(frame);try{installShortcuts(frame.contentDocument,shortcutActions)}catch{}});
  frames.set(name, frame);
  $("app-host").append(frame);
  // Apply the sibling theme once its DOM is ready, without waiting for every
  // catalog thumbnail or remote font to finish loading.
  let attempts = 0;
  const readyTimer = setInterval(() => {
    attempts++;
    try {
      if (
        frame.contentDocument?.body &&
        frame.contentDocument.readyState !== "loading"
      ) {
        styleApp(frame);
        clearInterval(readyTimer);
      }
    } catch {}
    if (attempts >= 80 || !frame.isConnected) clearInterval(readyTimer);
  }, 100);
  frame.addEventListener("load", () => clearInterval(readyTimer), {
    once: true,
  });
  return frame;
}
function route() {
  const name = location.hash.slice(1) || "home";
  const section = appPaths[name]
    ? "app-view"
    : ["appearance", "connection", "protections", "shortcuts", "privacy", "tab-appearance"].includes(name)
      ? "settings"
      : ["home", "apps", "browser", "settings", "terms"].includes(name)
        ? name
        : "home";
  document
    .querySelectorAll("main>.view")
    .forEach((el) => (el.hidden = el.id !== section));
  $("footer").hidden = ["browser", "app-view"].includes(section);
  document.body.dataset.view = section;
  const bar=document.querySelector(".browser-bar");
  $(section==="app-view"?"app-view":"browser").prepend(bar);
  if(appPaths[name]) $("address").value="tutsi://"+name;
  else if(section==="browser") $("address").value=activeTab?.url||"";
  document
    .querySelectorAll("[data-route]")
    .forEach((el) => el.classList.toggle("active", el.dataset.route === name));
  if (appPaths[name]) {
    appFrame(name);
    frames.forEach((frame, key) => (frame.hidden = key !== name));
  }
  if (["appearance", "connection", "protections", "shortcuts", "privacy", "tab-appearance"].includes(name))
    requestAnimationFrame(() => $(name).scrollIntoView());
  else window.scrollTo(0, 0);
  tabAppearance();
}
addEventListener("hashchange", route);
let navigation = 0,
  proxyElement;
const browserTabs=[],closedWebsites=[];
let activeTab=null;
function renderBrowserTabs(){
  const strip=$('browser-tabs');strip.replaceChildren();
  browserTabs.forEach((tab,index)=>{
    const button=document.createElement('button');button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(tab===activeTab));
    let label='New tab';try{label=new URL(tab.url).hostname}catch{}
    button.textContent=label;button.title=`Alt+${index+1}: ${label}`;button.onclick=()=>selectBrowserTab(tab);strip.append(button);
  });
  const add=document.createElement('button');add.textContent='+';add.type='button';add.setAttribute('aria-label','New tab (Alt+T)');add.onclick=()=>newBrowserTab();strip.append(add);
}
function selectBrowserTab(tab){
  if(!tab)return;activeTab=tab;proxyElement=tab.element;
  browserTabs.forEach(item=>{if(item.element)item.element.hidden=item!==tab;});
  $('address').value=tab.url;location.hash=tab.url?'browser':'home';renderBrowserTabs();
}
function newBrowserTab(url=''){
  if(browserTabs.length>=8){toast('You can open up to 8 website tabs. Close one first.');return false;}
  const tab={url:'',element:null};browserTabs.push(tab);selectBrowserTab(tab);
  if(url)void navigate(url);else {$('query').value='';$('query').focus();}
  return true;
}
function closeBrowserTab(){
  if(!activeTab)return;
  const index=browserTabs.indexOf(activeTab),url=currentWebsiteUrl(activeTab.element)||activeTab.url;
  if(/^https?:\/\//i.test(url)){closedWebsites.push(url);if(closedWebsites.length>10)closedWebsites.shift();}
  closeBrowser(activeTab.element);activeTab.element?.remove();browserTabs.splice(index,1);activeTab=null;proxyElement=null;navigation++;
  if(browserTabs.length)selectBrowserTab(browserTabs[Math.max(0,index-1)]);else {location.hash='home';renderBrowserTabs();}
}
function restoreBrowserTab(){const url=closedWebsites.at(-1);if(url&&newBrowserTab(url))closedWebsites.pop();else if(!url)toast('No closed website to reopen.');}
const shortcutActions={
  home(){location.hash="home";},
  address(){const input=['browser','app-view'].includes(document.body.dataset.view)?$('address'):$('query');if(input.id==='query'){location.hash='home';route();}input.focus();input.select();},
  newTab:newBrowserTab,close:closeBrowserTab,restore:restoreBrowserTab,
  reload(){control('reload',proxyElement)},back(){control('back',proxyElement)},forward(){control('forward',proxyElement)},
  select(index){selectBrowserTab(browserTabs[index])},notice:toast
};
installShortcuts(document,shortcutActions);

function website(value) {
  const text = value.trim();
  if (!text) throw new Error("Enter a website or something to search.");
  if (/^[a-z][a-z\d+.-]*:/i.test(text) && !/^https?:\/\//i.test(text))
    throw new Error("Use an http or https website address.");
  if (/^https?:\/\//i.test(text)) return new URL(text).href;
  if (
    /^(localhost|(?:[a-z\d-]+\.)+[a-z\d-]+)(?::\d+)?(?:[/?#]\S*)?$/i.test(text)
  )
    return new URL(`https://${text}`).href;
  const prefix = {
    duckduckgo: "https://duckduckgo.com/?q=",
    google: "https://www.google.com/search?q=",
    bing: "https://www.bing.com/search?q=",
  };
  return (
    (prefix[settings.engine] || prefix.duckduckgo) + encodeURIComponent(text)
  );
}
async function navigate(value) {
  if(/^tutsi:\/\//i.test(value.trim())){
    const name=value.trim().slice(8).replace(/\/$/, "").toLowerCase();
    if(appPaths[name]||["home","apps","settings"].includes(name)){location.hash=name;return;}
    toast("That Tutsi page does not exist.");return;
  }
  let url;
  try {
    url = website(value);
  } catch (e) {
    toast(e.message);
    return;
  }
  if(!activeTab&&!newBrowserTab())return;
  const targetTab=activeTab;targetTab.url=url;renderBrowserTabs();
  const request = ++navigation;
  location.hash = "browser";
  $("address").value = url;
  let status = $("browser-stage").querySelector(".browser-status");
  if (!status) {
    status = document.createElement("div");
    status.className = "browser-status";
    $("browser-stage").append(status);
  }
  status.textContent = "Loading...";
  status.hidden = false;
  if (!proxyElement) {
    proxyElement = document.createElement("iframe");
    proxyElement.title = "Website";
    activeTab.element=proxyElement;
    proxyElement.addEventListener("load",()=>{try{installShortcuts(targetTab.element.contentDocument,shortcutActions)}catch{};const latest=currentWebsiteUrl(targetTab.element);if(latest){targetTab.url=latest;if(activeTab===targetTab)$("address").value=latest;renderBrowserTabs();}});
    proxyElement.setAttribute(
      "sandbox",
      protectionSandbox(settings),
    );
    proxyElement.allow =
      "fullscreen; autoplay; encrypted-media; picture-in-picture";
    $("browser-stage").prepend(proxyElement);
  }
  try {
    await browse(url, { ...settings }, targetTab.element);
    if (request !== navigation) return;
    status.hidden = true;
  } catch (e) {
    if (request === navigation) {
      status.replaceChildren(document.createTextNode(e.message));
      const retry = document.createElement("button");
      retry.textContent = "Try again";
      retry.onclick = () => navigate(url);
      status.append(retry);
    }
  }
}
$("search").onsubmit = (e) => {
  e.preventDefault();
  navigate($("query").value);
};
$("address-form").onsubmit = (e) => {
  e.preventDefault();
  navigate($("address").value);
};
for (const action of ["back", "forward", "reload"])
  $(action).onclick = () => {
    if(document.body.dataset.view==="app-view"){
      if(action==="reload") frames.get(location.hash.slice(1))?.contentWindow.location.reload();
      else history[action]();
    }else control(action,proxyElement);
  };
$("close-browser").onclick = () => document.body.dataset.view==="app-view" ? location.hash="home" : closeBrowserTab();
$("browser-home").onclick=()=>{location.hash="home";};
addEventListener("keydown", (e) => {
  if (e.defaultPrevented) return;
  if (
    e.key === "/" &&
    !e.ctrlKey &&
    !e.metaKey &&
    !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) &&
    !document.activeElement.isContentEditable
  ) {
    e.preventDefault();
    location.hash = "home";
    $("query").focus();
  }
});
let authPromise;
async function account() {
  if (authPromise) return authPromise;
  authPromise = (async () => {
    const response = await fetch("/api/founder-profile/auth-config");
    const config = await response.json();
    if (!response.ok || !config.enabled)
      throw Error("Account sign-in is available on the live site.");
    const [appSdk, sdk] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js"),
    ]);
    const app =
      appSdk.getApps().find((app) => app.name === "nyx-founder-owner") ||
      appSdk.initializeApp(
        {
          apiKey: config.apiKey,
          authDomain: `${config.projectId}.firebaseapp.com`,
          projectId: config.projectId,
        },
        "nyx-founder-owner",
      );
    const auth = sdk.getAuth(app);
    await sdk.setPersistence(auth, sdk.browserLocalPersistence);
    await auth.authStateReady?.();
    sdk.onAuthStateChanged(auth, (user) => {
      const name =
        user?.displayName || user?.email?.split("@")[0] || "Your account";
      $("account-button").title = user ? name : "Sign in";
      $("account-button").setAttribute(
        "aria-label",
        user ? "Your account" : "Sign in",
      );
      $("sign-in").hidden = !!user;
      $("auth-mode").hidden = !!user;
      $("signed-in").hidden = !user;
      $("account-name").textContent = user ? `Signed in as ${name}` : "";
      if (user) {
        const chat = appFrame("chat");
        chat.hidden = location.hash !== "#chat";
      } else {
        mentionIds.clear();
        $("mention-toast").hidden = true;
      }
      frames.forEach((frame) =>
        frame.contentWindow?.postMessage(
          {
            type: "nyx:ai-profile",
            profile: {
              displayName: user ? name : "Guest",
              handle: user ? "Nyx account" : "Sign in to use AI",
            },
          },
          location.origin,
        ),
      );
    });
    return { auth, sdk };
  })().catch((error) => {
    authPromise = null;
    throw error;
  });
  return authPromise;
}
async function token() {
  try {
    const { auth } = await account();
    return (await auth.currentUser?.getIdToken()) || "";
  } catch {
    return "";
  }
}
function openAccount() {
  $("account-dialog").showModal();
  account().catch((error) => ($("auth-error").textContent = error.message));
}
let pendingProfile = { mode: "view", uid: "" };
let profileReturn = "home";
async function openProfile(mode = "view", uid = "") {
  const { auth } = await account().catch(() => ({ auth: {} }));
  if (!auth.currentUser) {
    openAccount();
    return;
  }
  pendingProfile = { mode, uid: uid || auth.currentUser.uid };
  if (location.hash !== "#profiles")
    profileReturn = location.hash.slice(1) || "home";
  $("account-dialog").close();
  location.hash = "profiles";
  const frame = appFrame("profiles");
  frame.contentWindow?.postMessage(
    { type: "tutsi:profile-open", ...pendingProfile },
    location.origin,
  );
}
$("view-profile").onclick = () => openProfile("view");
$("edit-profile").onclick = () => openProfile("edit");
const mentionIds = new Set();
function mentionNotification(data) {
  if (data.kind !== "mention" || typeof data.notificationId !== "string")
    return;
  const id = data.notificationId.slice(0, 180);
  if (mentionIds.has(id)) return;
  mentionIds.add(id);
  if (mentionIds.size > 200)
    mentionIds.delete(mentionIds.values().next().value);
  const host = $("mention-toast");
  host.querySelector("strong").textContent =
    String(data.sender || "Someone").slice(0, 80) + " mentioned you";
  host.querySelector("p").textContent = String(data.preview || "").slice(
    0,
    240,
  );
  host.hidden = false;
  clearTimeout(host.dismissTimer);
  host.dismissTimer = setTimeout(() => {
    host.hidden = true;
  }, 5000);
}
$("mention-open").onclick = () => {
  location.hash = "chat";
  $("mention-toast").hidden = true;
};
$("mention-dismiss").onclick = () => {
  $("mention-toast").hidden = true;
};
$("account-button").onclick = openAccount;
$("account-close").onclick = () => $("account-dialog").close();
let registering = false;
$("auth-mode").onclick = () => {
  registering = !registering;
  $("account-heading").textContent = registering
    ? "Create an account"
    : "Sign in";
  $("identifier-label").textContent = registering
    ? "Username"
    : "Username or email";
  $("register-fields").hidden = !registering;
  $("password").autocomplete = registering
    ? "new-password"
    : "current-password";
  $("password").minLength = registering ? 8 : 6;
  $("password").value = "";
  $("auth-submit").textContent = registering ? "Create account" : "Sign in";
  $("auth-mode").textContent = registering
    ? "Already have an account? Sign in"
    : "Create an account";
  $("auth-error").textContent = "";
};
$("sign-in").onsubmit = async (e) => {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;
  $("auth-mode").disabled = true;
  $("auth-error").textContent = "Signing in…";
  try {
    const { auth, sdk } = await account();
    const response = await fetch(
      registering ? "/api/account/register" : "/api/account/sign-in",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(registering
            ? {
                username: $("identifier").value.trim(),
                email: $("register-email").value.trim(),
              }
            : { identifier: $("identifier").value.trim() }),
          password: $("password").value,
        }),
      },
    );
    const data = await response.json();
    if (!response.ok || !data.customToken)
      throw Error(
        data.error ||
          (registering ? "Account creation failed." : "Sign-in failed."),
      );
    await sdk.signInWithCustomToken(auth, data.customToken);
    $("password").value = "";
    $("auth-error").textContent = "";
    $("account-dialog").close();
    frames.forEach((frame) => {
      frame.src = frame.src;
    });
    toast("You’re signed in.");
  } catch (error) {
    $("auth-error").textContent = error.message;
  } finally {
    button.disabled = false;
    $("auth-mode").disabled = false;
  }
};
$("sign-out").onclick = async () => {
  try {
    const { auth, sdk } = await account();
    await sdk.signOut(auth);
    frames.forEach((frame) => {
      frame.src = frame.src;
    });
    toast("Signed out.");
  } catch (error) {
    $("auth-error").textContent = error.message;
  }
};
addEventListener("message", async (event) => {
  if (event.origin !== location.origin) return;
  const entry = [...frames].find(
    ([, frame]) => frame.contentWindow === event.source,
  );
  if (!entry) return;
  const [name, frame] = entry;
  try {
    if (
      new URL(frame.contentWindow.location.href).pathname !==
      new URL(appPaths[name], location.origin).pathname
    )
      return;
  } catch {
    return;
  }
  const data = event.data;
  if (!data || typeof data !== "object") return;
  const reply = (payload) =>
    event.source?.postMessage(payload, location.origin);
  if (name === "profiles" && data.type === "tutsi:profile-ready") {
    reply({ type: "tutsi:profile-open", ...pendingProfile });
  } else if (name === "profiles" && data.type === "tutsi:profile-signin") {
    openAccount();
  } else if (name === "profiles" && data.type === "tutsi:profile-close") {
    location.hash = profileReturn;
  } else if (name === "profiles" && data.type === "tutsi:profile-saved") {
    $("account-name").textContent =
      "Signed in as " + String(data.displayName || "Your account").slice(0, 48);
    for (const [key, other] of frames) {
      if (key !== "profiles")
        other.contentWindow?.postMessage(
          { type: "nyx:account-changed" },
          location.origin,
        );
    }
    const chat = frames.get("chat");
    if (chat)
      chat.contentWindow?.postMessage(
        { type: "nyx:profile-updated" },
        location.origin,
      );
    toast("Profile saved.");
  } else if (name === "chat" && data.type === "nyx:chat-open-profile") {
    if (/^[A-Za-z0-9_-]{8,128}$/.test(String(data.uid || "")))
      void openProfile("view", data.uid);
  } else if (name === "chat" && data.type === "nyx:chat-notification") {
    mentionNotification(data);
  } else if (name === "chat" && data.type === "nyx:account-open-signin") {
    openAccount();
  } else if (name === "chat" && data.type === "nyx:go-home") {
    location.hash = "home";
  } else if (
    data.type === "nyx:account-token-request" &&
    ["ai", "music", "games", "code", "api", "youtube", "chat"].includes(name)
  ) {
    reply({
      type: "nyx:account-token-response",
      requestId: data.requestId,
      token: await token(),
    });
  } else if (data.type === "nyx:ai-profile-request" && name === "ai") {
    const { auth } = await account().catch(() => ({ auth: {} }));
    reply({
      type: "nyx:ai-profile",
      profile: {
        displayName: auth.currentUser?.displayName || "Your account",
        handle: auth.currentUser ? "Nyx account" : "Sign in to use AI",
      },
    });
  } else if (data.type === "nyx:ai-open-profile" && name === "ai") {
    void openProfile();
  } else if (data.type === "nyx:nyxtube-open-profile" && name === "youtube") {
    void openProfile();
  } else if (
    data.type === "nyx:nyxtube-profile-request" &&
    name === "youtube"
  ) {
    const { auth } = await account().catch(() => ({ auth: {} }));
    const user = auth.currentUser;
    reply({
      type: "nyx:nyxtube-profile",
      requestId: data.requestId,
      profile: {
        uid: user?.uid || "",
        signedIn: !!user,
        displayName: user?.displayName || "Your account",
        avatarUrl: user?.photoURL || "",
      },
    });
  } else if (data.type === "nyx:close-tab") {
    location.hash = "home";
  } else if (
    name === "games" &&
    ["nyx:cloud-game-load", "nyx:cloud-game-save"].includes(data.type)
  ) {
    try {
      const credential = await token();
      if (!credential) {
        reply({
          type: "nyx:cloud-game-result",
          requestId: data.requestId,
          storage: {},
        });
        return;
      }
      const save = data.type === "nyx:cloud-game-save";
      const response = await fetch(
        `/api/account/cloud-games/${encodeURIComponent(String(data.gameKey || ""))}`,
        {
          method: save ? "PUT" : "GET",
          headers: {
            Authorization: `Bearer ${credential}`,
            "Content-Type": "application/json",
          },
          ...(save
            ? {
                body: JSON.stringify({
                  storage: data.storage,
                  removed: data.removed,
                }),
              }
            : {}),
        },
      );
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Cloud save unavailable.");
      reply({
        type: "nyx:cloud-game-result",
        requestId: data.requestId,
        ...result,
      });
    } catch (error) {
      reply({
        type: "nyx:cloud-game-result",
        requestId: data.requestId,
        error: error.message,
      });
    }
  }
});

const appIcons = {
  "link-checker": "link-checker.svg",
  "link-generator": "link-generator.svg",
  "jsdelivr-publisher": "jsdelivr-publisher.svg",
  "api-keys": "api-keys.svg",
  "code-studio": "code-studio.svg",
  "youtube.com": "shortcut-youtube.svg",
  games: "dock-controller.png",
  "nyx-chat": "chat.svg",
  nyxify: "shortcut-nyxify.svg",
  "duck.ai": "duck-ai-logo.png",
  "nyx-ai": "shortcut-nyx-ai.svg",
  "nyx-movies": "nyx-movies.svg",
  "fmhy.net": "theatre-masks.svg",
  "tiktok.com": "tiktok-logo.png",
  "animex.one": "theatre-masks.svg",
};
const fallbackApps = [
  ["nyx-ai", "nyx-ai", "AI", "nyx://ai"],
  ["movies", "nyx-movies", "Movies", appPaths.movies],
  ["nyxify", "nyxify", "Music", appPaths.music],
  ["pirate-cove", "games", "Games", appPaths.games],
  ["youtube", "youtube.com", "NyxTube", appPaths.youtube],
  ["nyx-chat", "nyx-chat", "Chat", appPaths.chat],
  ["code-studio", "code-studio", "Code Sandbox", appPaths.code],
  ["link-checker", "link-checker", "Link Checker", appPaths.checker],
  ["link-generator", "link-generator", "Link Generator", appPaths.links],
  [
    "jsdelivr-publisher",
    "jsdelivr-publisher",
    "JSDelivr Publisher",
    appPaths.publisher,
  ],
  ["nyx-api-keys", "api-keys", "API Keys", appPaths.api],
  ["duck-ai", "duck.ai", "Duck AI", "https://duck.ai/"],
  [
    "more-movie-sites",
    "fmhy.net",
    "More Movie Sites",
    "https://fmhy.net/video#p-stream-forks",
  ],
  ["tiktok", "tiktok.com", "TikTok", "https://www.tiktok.com/"],
  ["animex", "animex.one", "Animex", "https://animex.one/"],
].map(([id, icon, name, url]) => ({ id, icon, name, url }));
function renderApps(apps) {
  $("all-apps").replaceChildren();

  for (const app of apps) {
    if (!app || typeof app.url !== "string" || typeof app.name !== "string")
      continue;
    const internal =
      app.url === "nyx://ai"
        ? "ai"
        : Object.keys(appPaths).find((key) => appPaths[key] === app.url);
    if (!internal && !/^https?:\/\//i.test(app.url)) continue;
    const name =
      {
        "nyx-ai": "AI",
        nyxify: "Music",
        "nyx-chat": "Chat",
        "pirate-cove": "Games",
        "nyx-api-keys": "API Keys",
      }[app.id] || app.name;
    for (const host of [$("all-apps")]) {
      const button = document.createElement("button");
      button.type = "button";
      button.title = name;
      button.setAttribute("aria-label", name);
      if (internal) button.dataset.route = internal;
      const image = document.createElement("img");
      image.src =
        "/assets/icons/" + (appIcons[app.icon] || "nyx-monogram-small.png");
      image.alt = "";
      image.loading = "lazy";
      const label = document.createElement("span");
      label.textContent = name;
      button.append(image, label);
      button.onclick = () => {
        if (internal) location.hash = internal;
        else navigate(app.url);
      };
      host.append(button);
    }
  }
  route();
}
function renderDock() {
  for (const [key, label, icon] of [
    ["ai", "AI", "ai"],
    ["music", "Music", "music"],
    ["settings", "Settings", "settings"],
    ["youtube", "YouTube", "youtube"],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.dataset.route = key;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = nyxIcons[icon];
    const labelNode = document.createElement("span");
    labelNode.textContent = label;
    button.append(svg, labelNode);
    button.onclick = () => (location.hash = key);
    $("dock-apps").append(button);
  }
}
function preventClose(event) {
  event.preventDefault();
  event.returnValue = "";
}
function syncClosePrevention() {
  if (settings.closePrevention) addEventListener("beforeunload", preventClose);
  else removeEventListener("beforeunload", preventClose);
}
$("close-prevention").addEventListener("change", syncClosePrevention);
$("reset-settings").addEventListener("click", syncClosePrevention);
applySettings();
syncClosePrevention();
renderDock();
renderApps(fallbackApps);
startClock($("clock"), $("calendar"));
account().catch(() => {});
fetch("/api/apps")
  .then((response) => (response.ok ? response.json() : Promise.reject()))
  .then((data) => {
    if (Array.isArray(data.apps) && data.apps.length) renderApps(data.apps);
  })
  .catch(() => {});

addEventListener('tutsi:relay-status',({detail})=>{
  const labels={checking:'Checking relay',connected:'Connected',switched:'Switched to backup',available:'Available',unavailable:'No reachable relay'};
  $('connection-result').textContent=(labels[detail.state]||'Relay')+(detail.url?' - '+(detail.url.endsWith('/api/tutsi-relay/socket/')?'HTTPS fallback':detail.url):'');
  if(detail.state==='switched')toast('Connected through a backup relay.');
});

fetch('/api/link-checker/vendors').then(r=>r.ok?r.json():Promise.reject()).then(data=>{
 const vendors=Array.isArray(data)?data:data.vendors;
 if(!Array.isArray(vendors))return;
 for(const vendor of vendors){
   if(typeof vendor!=='string'||!/^[a-z0-9_-]{1,64}$/.test(vendor)||[...$('blocker').options].some(o=>o.value===vendor))continue;
   $('blocker').add(new Option(vendor.replace(/[_-]/g,' '),vendor));
 }
 $('blocker').value=settings.blocker;
}).catch(()=>{});
addEventListener('tutsi:filter-hint',({detail})=>{
 const blocked=detail.results.filter(r=>r.blocked===true).length;
 const known=detail.results.some(r=>r.blocked!==null);
 $('blocker-result').textContent=known?`${detail.vendor}: ${blocked} relay domain(s) reported blocked. Testing reachable alternatives.`:'Filter results are unavailable. Using connection checks.';
});

for(const {vendor,label} of filterSignatures){
  if(![...$('blocker').options].some(option=>option.value===vendor))$('blocker').add(new Option(label,vendor));
}
$('blocker').value=settings.blocker;
const filterLabel=vendor=>filterSignatures.find(item=>item.vendor===vendor)?.label||vendor;
addEventListener('tutsi:filter-detected',({detail:{vendors}})=>{
  $('filter-detection-result').textContent=vendors.length
    ? `Extension detected: ${vendors.map(filterLabel).join(', ')}. This does not prove it blocked a connection.${vendors.length>1?' Choose a filter below, or keep using connection checks.':''}`
    : 'Unknown: no supported extension resource responded. A network filter may still be present.';
});
$('detect-filter').addEventListener('click',async()=>{
  const button=$('detect-filter');button.disabled=true;
  $('filter-detection-result').textContent='Checking this browser...';
  try{await scanFilters({refresh:true})}finally{button.disabled=false}
});
$('blocker').addEventListener('change',()=>{if(settings.blocker==='auto')void scanFilters()});
if(settings.blocker==='auto')void scanFilters();

// Keep player shortcuts working when focus remains in the enclosing Tutsi page.
for(const type of ['keydown','keyup'])addEventListener(type,event=>{
  if(location.hash!=='#youtube'||event.target.closest?.('input,textarea,select,button,a,[contenteditable]'))return;
  const frame=document.querySelector('#app-host iframe:not([hidden])');
  try{
    if(!frame||new URL(frame.src,location.href).origin!==location.origin||new URL(frame.src,location.href).pathname!=='/apps/nyxtube/')return;
    const win=frame.contentWindow,doc=frame.contentDocument;
    const forwarded=new win.KeyboardEvent(type,{key:event.key,code:event.code,repeat:event.repeat,shiftKey:event.shiftKey,ctrlKey:event.ctrlKey,altKey:event.altKey,metaKey:event.metaKey,bubbles:true,cancelable:true});
    const target=doc.activeElement?.closest('dialog[open]')?doc.activeElement:doc.body;
    if(!target.dispatchEvent(forwarded))event.preventDefault();
  }catch{}
},true);

let protectionToastAt=0;
function protectionNotice(kind){
  if(!['popup','download'].includes(kind)||Date.now()-protectionToastAt<2000)return;
  protectionToastAt=Date.now();toast(kind==='popup'?'Popup blocked. You can change this in Settings.':'Risky download blocked. You can change this in Settings.');
}
addEventListener('tutsi:protection',event=>protectionNotice(event.detail?.kind));
addEventListener('message',event=>{
  if(event.origin===location.origin&&proxyElement&&event.source===proxyElement.contentWindow&&event.data?.type==='tutsi:protection')protectionNotice(event.data.kind);
});
