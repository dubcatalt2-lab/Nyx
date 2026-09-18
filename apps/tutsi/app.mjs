import {websiteAddress} from "./navigation.mjs";
import {installShortcuts} from "./shortcuts.mjs";
import {protectionSandbox} from "./protections.mjs";
import { scanFilters, filterSignatures, identifyFilterAddress } from "./filter-detection.mjs";
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
function themePalette(preferences = settings) {
  const palette = { ...(palettes[preferences.theme] || palettes.mocha) };
  if (preferences.accent === "mauve") return palette;
  const color = palette[preferences.accent] || palette.mauve;
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
function tabAppearance(preferences = settings) {
  const presets = {
    tutsi: ["Tutsi Math", "/apps/tutsi/icon.png?v=2"],
    classroom: ["Google Classroom", 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="8" fill="%23fbbc04"/%3E%3Crect x="8" y="10" width="48" height="40" rx="3" fill="%2334a853"/%3E%3Ccircle cx="32" cy="25" r="6" fill="white"/%3E%3Cpath d="M18 42c4-9 20-9 24 0" fill="white"/%3E%3C/svg%3E'],
    classlink: ["ClassLink", "/assets/icons/classlink-logo.png"],
    drive: ["My Drive - Google Drive", "/assets/icons/googledrive-logo.png"],
    google: ["Google", "/assets/icons/google-logo.png"],
    custom: [
      preferences.tabTitle.trim() || "Tutsi Math",
      "/apps/tutsi/icon.png?v=2",
    ],
  };
  const [title, icon] = presets[preferences.tabPreset] || presets.tutsi;
  document.title = title;
  document.querySelector("link[rel=icon]").href = icon;
  $("tab-preset-icon").src=icon;
  $("tab-preset-preview").textContent=title;
  $("tab-title").disabled = settings.tabPreset !== "custom";
}
const themedCloudFrames = new WeakSet();
function styleApp(frame, gamesFrame = null) {
  try {
    const doc = frame.contentDocument;
    if (
      !doc ||
      new URL(frame.contentWindow.location.href).origin !== location.origin
    )
      return;
    const nestedCloud = gamesFrame === frames.get("games") && gamesFrame?.contentDocument?.getElementById("cloudGamingFrame") === frame;
    const appKey = nestedCloud ? "cloud" : [...frames].find(([, item]) => item === frame)?.[0];
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
    const appName = appKey;
    decorateEmbedded(doc, appName || "app");
    if (appKey === "games") {
      const cloud = doc.getElementById("cloudGamingFrame");
      if (cloud && !themedCloudFrames.has(cloud)) {
        themedCloudFrames.add(cloud);
        cloud.addEventListener("load", () => styleApp(cloud, frame));
      }
      if (cloud) styleApp(cloud, frame);
    }
    if (nestedCloud && !doc.documentElement.dataset.tutsiCloudSized) {
      doc.documentElement.dataset.tutsiCloudSized = "true";
      const resize = () => {
        if (!frame.isConnected || doc !== frame.contentDocument || doc.documentElement.classList.contains("cloud-session-active")) return;
        frame.style.height = Math.ceil(doc.querySelector("main").getBoundingClientRect().height) + "px";
      };
      new ResizeObserver(resize).observe(doc.querySelector("main"));
      resize();
    }
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
    "Browser settings ";
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
function applyTabFields(){
 settings.tabPreset=$('tab-preset').value;
 settings.tabTitle=$('tab-title').value;
 applySettings();
 $('tab-preset-status').textContent='Applied to this browser tab.';
}
$('tab-title').addEventListener('input',applyTabFields);
$('tab-preset').addEventListener('input',applyTabFields);
$('apply-tab-preset').onclick=applyTabFields;
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
  if(!confirm("Reset Tutsi settings? Your account, chats and game saves will stay."))return;
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
  cloud: "/apps/cloud-gaming/",
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
    cloud: "Cloud Gaming",
    youtube: "YouTube",
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
function setBrowserBarOpen(open){
  $('browser-bar-toggle').setAttribute('aria-expanded',String(open));
  $('browser-bar-panel').inert=!open;
  $('browser-bar-drawer').classList.toggle('open',open);
}
const browserDrawer=$('browser-bar-drawer');
$('browser-bar-toggle').onclick=()=>setBrowserBarOpen(!$('browser-bar-drawer').classList.contains('open'));
browserDrawer.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')setBrowserBarOpen(true);});
browserDrawer.addEventListener('pointerleave',()=>{if(!browserDrawer.contains(document.activeElement))setBrowserBarOpen(false);});
browserDrawer.addEventListener('focusout',()=>setTimeout(()=>{if(!browserDrawer.contains(document.activeElement)&&!browserDrawer.matches(':hover'))setBrowserBarOpen(false);},0));
browserDrawer.addEventListener('keydown',event=>{if(event.key==='Escape'){setBrowserBarOpen(false);$('browser-bar-toggle').focus();}});
$('address').addEventListener('blur',()=>{$('address').scrollLeft=0;});
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
  const browser=section==="browser", host=browser?$("browser"):$("browser-bar-panel");
  $("browser-bar-drawer").hidden=browser;
  if(bar.parentElement!==host)host.prepend(bar);
  const tabs=$("browser-tabs");
  if(tabs.parentElement!==host)host.insertBefore(tabs,browser?$("browser-stage"):null);
  setBrowserBarOpen(false);
  if(appPaths[name]) $("address").value="tutsi://"+name;
  else $("address").value=activeTab?.url||"";
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
  requestAnimationFrame(updateSettingsSection);
}
addEventListener("hashchange", route);
let proxyElement;
const browserTabs=[],closedWebsites=[];
let activeTab=null;
function renderBrowserTabs(){
  const strip=$('browser-tabs');strip.replaceChildren();
  browserTabs.forEach((tab,index)=>{
    const button=document.createElement('button');button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-selected',String(tab===activeTab));
    let label='New tab';try{label=new URL(tab.url).hostname}catch{}
    button.textContent=label;button.title=`Alt+${index+1}: ${label}`;button.onclick=()=>selectBrowserTab(tab);
    const item=document.createElement('div');item.className='browser-tab';item.setAttribute('role','presentation');item.dataset.active=String(tab===activeTab);
    const close=document.createElement('button');close.type='button';close.className='browser-tab-close';close.textContent=String.fromCharCode(215);close.setAttribute('aria-label',`Close ${label}`);close.title='Close tab';
    close.onclick=()=>{removeWebsiteTab(tab);$('browser-tabs').querySelector('[aria-selected="true"]')?.focus();};
    item.append(button,close);strip.append(item);
  });
  const add=document.createElement('button');add.textContent='+';add.type='button';add.setAttribute('aria-label','New tab (Alt+T)');add.onclick=()=>newBrowserTab();strip.append(add);
}
function syncBrowserTabView(){
  $('browser-new-tab').hidden=!!activeTab?.url;
  for(const tab of browserTabs){
    if(tab.element)tab.element.hidden=tab!==activeTab;
    if(tab.status)tab.status.hidden=tab!==activeTab||!tab.loading;
  }
}
function selectBrowserTab(tab){
  if(!browserTabs.includes(tab))return;activeTab=tab;proxyElement=tab.element;
  browserTabs.forEach(item=>{if(item.element)item.element.hidden=item!==tab;});
  $('address').value=tab.url;location.hash='browser';route();renderBrowserTabs();syncBrowserTabView();
}
// SPA history changes do not fire iframe load events (for example Spotify).
setInterval(()=>{
  if(document.hidden||!activeTab?.element||activeTab.loading)return;
  const url=currentWebsiteUrl(activeTab.element);
  if(!url||url===activeTab.url)return;
  activeTab.url=url;renderBrowserTabs();
  if(document.activeElement!==$('address') && !appPaths[location.hash.slice(1)])$('address').value=url;
},750);
function newBrowserTab(url=''){
  if(browserTabs.length>=8){toast('You can open up to 8 website tabs. Close one first.');return false;}
  const tab={url:'',element:null,status:null,navigation:0};browserTabs.push(tab);selectBrowserTab(tab);
  if(url)void navigate(url);else {$('new-tab-query').value='';$('new-tab-query').focus();}
  return true;
}
function closeBrowserTab(){
  const routeName=location.hash.slice(1)||'home';
  if(appPaths[routeName]){
    const app=frames.get(routeName);
    frames.delete(routeName);
    app?.remove();
    // Chat also supplies background mentions. Replace its closed UI with a
    // fresh hidden receiver so any old media/voice session is disposed.
    if(routeName==='chat' && accountUser)appFrame('chat').hidden=true;
    location.hash='home';return;
  }
  const blankTab=routeName==='home' && activeTab && !activeTab.url;
  if(routeName!=='browser' && !blankTab){
    if($('customize-dialog')?.open)dismissCustomize();
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    location.hash='home';return;
  }
  removeWebsiteTab(activeTab);
}
function removeWebsiteTab(tab){
  const index=browserTabs.indexOf(tab);if(index<0)return;
  const wasActive=tab===activeTab,url=currentWebsiteUrl(tab.element)||tab.url;
  if(/^https?:\/\//i.test(url)){closedWebsites.push(url);if(closedWebsites.length>10)closedWebsites.shift();}
  tab.navigation++;tab.status?.remove();closeBrowser(tab.element);tab.element?.remove();browserTabs.splice(index,1);
  if(!wasActive){renderBrowserTabs();syncBrowserTabView();return;}
  activeTab=null;proxyElement=null;
  if(browserTabs.length)selectBrowserTab(browserTabs[Math.max(0,index-1)]);else {location.hash='home';renderBrowserTabs();}
}

function restoreBrowserTab(){const url=closedWebsites.at(-1);if(url&&newBrowserTab(url))closedWebsites.pop();else if(!url)toast('No closed website to reopen.');}
const shortcutActions={
  home(){location.hash="home";},
  address(){const input=['browser','app-view'].includes(document.body.dataset.view)?$('address'):$('query');if(input.id==='query'){location.hash='home';route();}input.focus();input.select();},
  newTab:newBrowserTab,close:closeBrowserTab,restore:restoreBrowserTab,
  reload(){browserControl('reload')},back(){browserControl('back')},forward(){browserControl('forward')},
  select(index){selectBrowserTab(browserTabs[index])},notice:toast
};
installShortcuts(document,shortcutActions);

async function navigate(value, {newTab=false, input=null} = {}) {
  if(/^tutsi:\/\//i.test(value.trim())){
    const name=value.trim().slice(8).replace(/\/$/, "").toLowerCase();
    if(appPaths[name]||["home","apps","settings"].includes(name)){if(input)input.value="";location.hash=name;return;}
    toast("That Tutsi page does not exist.");return;
  }
  let url;
  try {
    url = websiteAddress(value, settings.engine);
  } catch (e) {
    toast(e.message);
    return;
  }
  if((!activeTab || (newTab && activeTab.url))&&!newBrowserTab())return;
  if(input)input.value="";
  const targetTab=activeTab;targetTab.url=url;renderBrowserTabs();
  const request = ++targetTab.navigation;
  location.hash = "browser";
  route();
  $("address").value = url;
  let status = targetTab.status;
  if (!status) {
    status = document.createElement("div");
    status.className = "browser-status";
    targetTab.status = status;
    $("browser-stage").append(status);
  }
  status.textContent = "Loading...";
  targetTab.loading = true;
  syncBrowserTabView();
  if (!targetTab.element) {
    proxyElement = document.createElement("iframe");
    proxyElement.title = "Website";
    targetTab.element=proxyElement;
    proxyElement.addEventListener("load",()=>{try{installShortcuts(targetTab.element.contentDocument,shortcutActions)}catch{};const latest=currentWebsiteUrl(targetTab.element);if(latest && !targetTab.loading && browserTabs.includes(targetTab)){targetTab.url=latest;if(activeTab===targetTab && document.body.dataset.view==="browser" && document.activeElement!==$("address"))$("address").value=latest;renderBrowserTabs();}});
    proxyElement.setAttribute(
      "sandbox",
      protectionSandbox(settings),
    );
    proxyElement.allow =
      "fullscreen; autoplay; encrypted-media; picture-in-picture";
    $("browser-stage").prepend(proxyElement);
  }
  proxyElement=targetTab.element;
  syncBrowserTabView();
  try {
    await browse(url, { ...settings }, targetTab.element);
    if (request !== targetTab.navigation || !browserTabs.includes(targetTab)) return;
    targetTab.loading=false;syncBrowserTabView();
  } catch (e) {
    if (request === targetTab.navigation && browserTabs.includes(targetTab)) {
      status.replaceChildren(document.createTextNode(e.message));
      const retry = document.createElement("button");
      retry.textContent = "Try again";
      retry.onclick = () => {selectBrowserTab(targetTab);void navigate(url);};
      status.append(retry);
    }
  }
}
$("search").onsubmit = (e) => {
  e.preventDefault();
  void navigate($("query").value, {newTab:true, input:$("query")});
};
$("address-form").onsubmit = (e) => {
  e.preventDefault();
  navigate($("address").value);
};
$('new-tab-search').onsubmit = event => {event.preventDefault();void navigate($('new-tab-query').value, {input:$('new-tab-query')});};
function browserControl(action){
  if(document.body.dataset.view==="app-view"){
    if(action==="reload") frames.get(location.hash.slice(1))?.contentWindow.location.reload();
    else history[action]();
  }else control(action,proxyElement);
}
for (const action of ["back", "forward", "reload"]) $(action).onclick=()=>browserControl(action);
$("close-browser").onclick = () => {
  if(appPaths[location.hash.slice(1)] || document.body.dataset.view==='browser')closeBrowserTab();
  else removeWebsiteTab(activeTab);
};
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
let accountUser = null, accountProfile = {}, profileRevision = 0;
const profileRequestIds = new WeakMap();
const defaultAccountIcon = $("account-button").innerHTML;
function profilePayload() {
  return { ...accountProfile, uid: accountUser?.uid || "", signedIn: !!accountUser,
    displayName: accountProfile.displayName || accountUser?.displayName || "Guest",
    handle: accountProfile.handle || (accountUser ? "Your profile" : "Sign in to use AI") };
}
function renderAccountProfile() {
  const profile = profilePayload();
  $("account-name").textContent = profile.displayName;
  $("account-handle").textContent = profile.handle;
  $("account-heading").textContent = accountUser ? "Your account" : "Sign in";
  $("account-dialog").classList.toggle("account-dropdown", !!accountUser);
  $("account-intro").hidden = !!accountUser;
  $("account-button").title = accountUser ? profile.displayName : "Sign in";
  for (const host of [$("account-button"), $("account-avatar")]) {
    host.innerHTML = defaultAccountIcon;
    if (profile.avatarUrl) {
      const image = document.createElement("img"); image.alt = ""; image.src = profile.avatarUrl;
      image.onerror = () => { host.innerHTML = defaultAccountIcon; };
      host.replaceChildren(image);
    }
  }
  for (const [name, frame] of frames) {
    if (name === "ai" || name === "youtube") frame.contentWindow?.postMessage({
      type: name === "ai" ? "nyx:ai-profile" : "nyx:nyxtube-profile", requestId:profileRequestIds.get(frame), profile
    }, location.origin);
  }
}
async function resolveAccountAvatar(value) {
  const source = String(value || "");
  if (/^\/api\/profile-media\/[A-Za-z0-9_-]{8,128}\/avatar\/[A-Za-z0-9_-]{12,80}$/.test(source)) {
    const response = await fetch(source + "/manifest", {cache:"force-cache"});
    const manifest = await response.json();
    if (!response.ok || !/^image\/(png|jpeg|webp|gif)$/.test(manifest.mime) || !Number.isInteger(manifest.totalChunks) || manifest.totalChunks < 1 || manifest.totalChunks > 32) return "";
    const parts = [];
    for (let i=0;i<manifest.totalChunks;i++) {
      const chunk = await fetch(source + "/chunks/" + i, {cache:"force-cache"});
      if (!chunk.ok) return "";
      parts.push(Uint8Array.from(atob((await chunk.text()).trim()), c=>c.charCodeAt(0)));
    }
    const blob = new Blob(parts,{type:manifest.mime});
    if (manifest.byteLength && blob.size !== manifest.byteLength) return "";
    return URL.createObjectURL(blob);
  }
  return /^(https:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/i.test(source) ? source : "";
}
async function refreshAccountProfile() {
  const user = accountUser, revision = ++profileRevision;
  if (!user) return;
  try {
    const response = await fetch("/api/profiles/me", {headers:{Authorization:"Bearer " + await user.getIdToken()},cache:"no-store"});
    if (!response.ok) return;
    const data = await response.json();
    const profile = {...data.profile};
    profile.avatarUrl = await resolveAccountAvatar(profile.avatarUrl).catch(()=>"");
    if (revision !== profileRevision || accountUser !== user) {
      if (profile.avatarUrl.startsWith("blob:")) URL.revokeObjectURL(profile.avatarUrl);
      return;
    }
    if (accountProfile.avatarUrl?.startsWith("blob:")) URL.revokeObjectURL(accountProfile.avatarUrl);
    accountProfile = profile;
    renderAccountProfile();
  } catch { /* Keep the last loaded profile when offline. */ }
}
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
      accountUser = user;
      profileRevision++;
      if (accountProfile.avatarUrl?.startsWith("blob:")) URL.revokeObjectURL(accountProfile.avatarUrl);
      accountProfile = {};
      renderAccountProfile();
      void refreshAccountProfile();
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
  const sender = String(data.sender || "Someone").slice(0, 80);
  host.querySelector("strong").textContent = sender;
  $("mention-avatar").textContent = Array.from(sender.trim())[0]?.toUpperCase() || "@";
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
$("mention-toast").addEventListener("pointerenter",()=>clearTimeout($("mention-toast").dismissTimer));
$("mention-toast").addEventListener("focusin",()=>clearTimeout($("mention-toast").dismissTimer));
$("mention-toast").addEventListener("pointerleave",()=>{
  const host=$("mention-toast");if(!host.contains(document.activeElement))host.dismissTimer=setTimeout(()=>host.hidden=true,5000);
});
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
    await refreshAccountProfile();
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
  } else if (["chat","cloud"].includes(name) && data.type === "nyx:go-home") {
    location.hash = "home";
  } else if (
    data.type === "nyx:account-token-request" &&
    ["ai", "music", "games", "cloud", "code", "api", "youtube", "chat"].includes(name)
  ) {
    reply({
      type: "nyx:account-token-response",
      requestId: data.requestId,
      token: await token(),
    });
  } else if (data.type === "nyx:ai-profile-request" && name === "ai") {
    await account().catch(()=>{});
    reply({type:"nyx:ai-profile", profile:profilePayload()});
  } else if (data.type === "nyx:ai-open-profile" && name === "ai") {
    void openProfile();
  } else if (data.type === "nyx:nyxtube-open-profile" && name === "youtube") {
    void openProfile();
  } else if (
    data.type === "nyx:nyxtube-profile-request" &&
    name === "youtube"
  ) {
    await account().catch(()=>{});
    profileRequestIds.set(frame,data.requestId);
    reply({type:"nyx:nyxtube-profile",requestId:data.requestId,profile:profilePayload()});
  } else if (data.type === "nyx:close-tab") {
    // A hidden app cannot close the user's current tab.
    if(location.hash.slice(1)===name)closeBrowserTab();
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
  'link-checker':'checker','link-generator':'link','jsdelivr-publisher':'publisher',
  'api-keys':'key','code-studio':'code','youtube.com':'youtube',games:'games',
  'nyx-chat':'chat',nyxify:'music','duck.ai':'sparkle','nyx-ai':'ai',
  'nyx-movies':'movies','fmhy.net':'movies','tiktok.com':'music','animex.one':'media',
  'cloud-gaming':'cloud'
};
const fallbackApps = [
  ["nyx-ai", "nyx-ai", "AI", "nyx://ai"],
  ["movies", "nyx-movies", "Movies", appPaths.movies],
  ["nyxify", "nyxify", "Music", appPaths.music],
  ["pirate-cove", "games", "Games", appPaths.games],
  ["cloud-gaming", "cloud-gaming", "Cloud Gaming", appPaths.cloud],
  ["youtube", "youtube.com", "YouTube", appPaths.youtube],
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
  if(!apps.some(app=>app.url===appPaths.cloud))apps=[...apps,{id:"cloud-gaming",icon:"cloud-gaming",name:"Cloud Gaming",url:appPaths.cloud}];
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
      }[app.id] || app.name.replace(/NyxTube/gi,"YouTube").replace(/Nyx/gi,"Tutsi");
    for (const host of [$("all-apps")]) {
      const button = document.createElement("button");
      button.type = "button";
      button.title = name;
      button.setAttribute("aria-label", name);
      if (internal) button.dataset.route = internal;
      const image = document.createElementNS('http://www.w3.org/2000/svg','svg');
      const icon = appIcons[app.icon] || ({cloud:'cloud',links:'link',api:'key'}[internal]) || internal || 'apps';
      image.setAttribute('viewBox','0 0 24 24');image.setAttribute('aria-hidden','true');
      image.classList.add('app-symbol');image.dataset.icon=icon;
      image.innerHTML=nyxIcons[icon] || nyxIcons.apps;
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
  if(!document.body.dataset.view)route();
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
  $('connection-result').textContent=(labels[detail.state]||'Relay');
  if(detail.state==='switched')toast('Connection restored.');
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
    : 'Unknown: no recognizable extension was visible. Try a block-page address below, or select your filter above.';
  if(!vendors.length)$('filter-address-help').open=true;
});
$('detect-filter').addEventListener('click',async()=>{
  const button=$('detect-filter');button.disabled=true;
  $('filter-detection-result').textContent='Checking this browser...';
  try{await scanFilters({refresh:true})}catch{$('filter-detection-result').textContent='The check could not finish. Try again or use a block-page address.'}finally{button.disabled=false}
});
$('blocker').addEventListener('change',()=>{if(settings.blocker==='auto')void scanFilters()});
if(settings.blocker==='auto')void scanFilters();
let addressFilter=null;
function inspectFilterAddress(){
  addressFilter=identifyFilterAddress($('filter-address').value);
  $('use-address-filter').hidden=!addressFilter;
  $('filter-address-result').textContent=addressFilter
    ? `${addressFilter.label}: recognized ${addressFilter.source}. Select Use this filter to save it.`
    : 'No recognizable vendor in this address. If it is still the original website address, select the filter named on the block page above.';
}
$('identify-filter-address').onclick=inspectFilterAddress;
$('filter-address').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();inspectFilterAddress();}});
$('filter-address').addEventListener('input',()=>{addressFilter=null;$('use-address-filter').hidden=true;$('filter-address-result').textContent='';});
$('use-address-filter').onclick=()=>{
  if(!addressFilter)return;
  const {vendor,label}=addressFilter;
  if(![...$('blocker').options].some(option=>option.value===vendor))$('blocker').add(new Option(label,vendor));
  $('blocker').value=vendor;$('blocker').dispatchEvent(new Event('change'));
  $('filter-address').value='';addressFilter=null;$('use-address-filter').hidden=true;
  $('filter-address-result').textContent=`${label} saved. Used when the next browser connection starts.`;
};


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

// Customization stays a draft until Save; no account or relay changes are made.
const customize=$('customize-dialog');
let customizeStep=0, customizeDraft, customizeTransition=0, customizeBusy=false;
const customizeKeys={theme:'theme',accent:'accent',wallpaper:'wallpaper',tabPreset:'tab-preset',tabTitle:'tab-title',engine:'search-engine',motion:'motion',closePrevention:'close-prevention',blocker:'blocker'};
for(const [key,id] of Object.entries(customizeKeys)){
 const control=$('customize-'+key),original=$(id);
 if(control.tagName==='SELECT'&&original)control.replaceChildren(...[...original.options].map(option=>option.cloneNode(true)));
 control.addEventListener('input',()=>{customizeDraft[key]=control.type==='checkbox'?control.checked:control.value;customizePreview();});
}
const customizeStepCount=customize.querySelectorAll('[data-customize-step]').length;
const customizeChoices=['theme','accent','wallpaper','engine','blocker'];
function renderCustomizeChoices(){
 for(const key of customizeChoices){
  const select=$('customize-'+key);
  let group=select.nextElementSibling;
  if(!group?.classList.contains('customize-choices')){group=document.createElement('div');group.className='customize-choices';group.setAttribute('role','group');group.setAttribute('aria-label',select.closest('section').querySelector('h3').textContent);select.after(group);select.hidden=true;}
  group.replaceChildren(...[...select.options].filter(option=>key!=='blocker'||option.value&&option.value!=='auto').map(option=>{
   const button=document.createElement('button');button.type='button';button.dataset.value=option.value;button.textContent=option.textContent;button.setAttribute('aria-pressed',String(select.value===option.value));
   if(key==='accent'||key==='theme'){const swatch=document.createElement('span');swatch.className='customize-swatch';swatch.style.background=key==='accent'?themePalette(customizeDraft)[option.value]:themePalette({...customizeDraft,theme:option.value}).base;swatch.setAttribute('aria-hidden','true');button.prepend(swatch);}
   button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('input'));[...group.children].find(item=>item.dataset.value===option.value)?.focus({preventScroll:true});};return button;
  }));
 }
}
function customizePreview(){
 renderCustomizeChoices();
 $('customize-next').disabled=customizeStep===customizeStepCount-1&&(!customizeDraft.blocker||customizeDraft.blocker==='auto');
 tabAppearance(customizeDraft);
 const p=themePalette(customizeDraft),preview=$('customize-preview');
 for(const [key,value] of Object.entries(p))preview.style.setProperty('--'+key,value);
 preview.style.setProperty('--accent',p[customizeDraft.accent]||p.mauve);
 preview.dataset.wallpaper=customizeDraft.wallpaper;
 $('customize-tab-label').textContent=customizeDraft.tabPreset==='custom'?(customizeDraft.tabTitle.trim()||'Tutsi Math'):$('customize-tabPreset').selectedOptions[0].textContent;
 $('customize-tabTitle').disabled=customizeDraft.tabPreset!=='custom';
 $('customize-summary').textContent=`${customizeDraft.theme[0].toUpperCase()+customizeDraft.theme.slice(1)} / ${$('customize-accent').selectedOptions[0].textContent} / ${$('customize-engine').selectedOptions[0].textContent}`;
}
function showCustomizeStep(animate=false){
 customize.querySelectorAll('[data-customize-step]').forEach(el=>el.hidden=Number(el.dataset.customizeStep)!==customizeStep);
 customize.querySelectorAll('[data-step-marker]').forEach((el,i)=>{if(i===customizeStep)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
 $('customize-progress').textContent=`Step ${customizeStep+1} of ${customizeStepCount}`;
 $('customize-back').hidden=customizeStep===0;
 $('customize-next').textContent=customizeStep===customizeStepCount-1?'Save changes':'Next';
 $('customize-next').disabled=customizeStep===customizeStepCount-1&&(!customizeDraft.blocker||customizeDraft.blocker==='auto');
 const heading=customize.querySelector('[data-customize-step]:not([hidden]) h3');heading.focus({preventScroll:true});
 if(animate&&!settings.motion&&!matchMedia('(prefers-reduced-motion: reduce)').matches)heading.parentElement.animate([{opacity:0},{opacity:1}],{duration:240,easing:'ease-out'});
}
async function changeCustomizeStep(delta){
 if(customizeBusy)return;customizeBusy=true;
 const token=++customizeTransition;
 $('customize-back').disabled=true;$('customize-next').disabled=true;
 const panel=customize.querySelector('[data-customize-step]:not([hidden])');
 if(!settings.motion&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
   try{await panel.animate([{opacity:1},{opacity:0}],{duration:120,easing:'ease-in'}).finished;}catch{}
 }
 if(token!==customizeTransition||!customize.open)return;
 customizeStep+=delta;showCustomizeStep(true);
 customizeBusy=false;$('customize-back').disabled=false;$('customize-next').disabled=customizeStep===customizeStepCount-1&&(!customizeDraft.blocker||customizeDraft.blocker==='auto');
}
function openCustomize(){
 customizeTransition++;customizeBusy=false;
 $('customize-back').disabled=false;$('customize-next').disabled=false;
 customizeDraft={...settings};customizeStep=0;
 for(const key of Object.keys(customizeKeys)){const el=$('customize-'+key);if(el.type==='checkbox')el.checked=customizeDraft[key];else el.value=customizeDraft[key];}
 customizePreview();customize.showModal();showCustomizeStep();
}
function dismissCustomize(){customizeTransition++;customizeBusy=false;try{localStorage.setItem('tutsi.customize.seen','1')}catch{}customize.close();tabAppearance();}
$('open-customize').onclick=openCustomize;
function skipCustomize(){if(!settings.blocker||settings.blocker==='auto'){settings.blocker='';applySettings();}dismissCustomize();}
$('customize-dismiss').onclick=skipCustomize;
customize.addEventListener('cancel',event=>{event.preventDefault();skipCustomize();});
$('customize-back').onclick=()=>{void changeCustomizeStep(-1);};
function saveCustomize(){
 for(const key of Object.keys(customizeKeys))settings[key]=customizeDraft[key];
 applySettings();syncClosePrevention();dismissCustomize();toast('Your changes are saved.');
}
$('customize-skip-blocker').onclick=()=>{customizeDraft.blocker='';saveCustomize();};
$('customize-next').onclick=()=>{
 if(customizeStep<customizeStepCount-1){void changeCustomizeStep(1);return;}
 saveCustomize();
};
try{if((!saved||Object.keys(saved).length===0)&&!localStorage.getItem('tutsi.customize.seen')&&(!location.hash||location.hash==='#home'))openCustomize();}catch{}

// Scroll highlighting never changes the hash or adds browser-history entries.
function updateSettingsSection(){
 if(document.body.dataset.view!=='settings')return;
 const links=[...document.querySelectorAll('.settings-nav > a')].filter(link=>document.querySelector('.settings-content '+link.getAttribute('href')));
 const sections=links.map(link=>({link,rect:document.querySelector('.settings-content '+link.getAttribute('href')).getBoundingClientRect()})).sort((a,b)=>a.rect.top-b.rect.top);
 if(!sections.length)return;
 const threshold=Math.min(180,innerHeight*.25);
 let active=sections[0];
 for(const section of sections)if(section.rect.top<=threshold)active=section;
 if(scrollY+innerHeight>=document.documentElement.scrollHeight-4)active=sections.at(-1);
 const nav=active.link.parentElement;
 nav.style.setProperty('--section-x',active.link.offsetLeft+'px');nav.style.setProperty('--section-y',active.link.offsetTop+'px');nav.style.setProperty('--section-width',active.link.offsetWidth+'px');nav.style.setProperty('--section-height',active.link.offsetHeight+'px');
 for(const section of sections){if(section===active)section.link.setAttribute('aria-current','location');else section.link.removeAttribute('aria-current');}
}
let settingsScrollFrame=0;
function scheduleSettingsHighlight(){if(settingsScrollFrame)return;settingsScrollFrame=requestAnimationFrame(()=>{settingsScrollFrame=0;updateSettingsSection();});}
addEventListener('scroll',scheduleSettingsHighlight,{passive:true});
addEventListener('resize',scheduleSettingsHighlight,{passive:true});
scheduleSettingsHighlight();

$('clear-cache').onclick=async()=>{
 const button=$('clear-cache');button.disabled=true;$('storage-status').textContent='Clearing cache...';
 try{
   if('caches' in window){for(const name of await caches.keys()){
     const cache=await caches.open(name);
     for(const request of await cache.keys()){
       const url=new URL(request.url);
       if(url.origin===location.origin&&/^\/(?:apps\/tutsi(?:\/|$)|tutsi(?:\/|$)|~\/tm\/)/.test(url.pathname))await cache.delete(request);
     }
   }}
   $('storage-status').textContent='Tutsi cache cleared. Your account and saved data are unchanged.';
 }catch{$('storage-status').textContent='Cache could not be cleared. Try your browser settings.';}
 finally{button.disabled=false;}
};
