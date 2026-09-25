import {loadProxyScript as script, waitForProxyController, trackProxyController} from '/js/proxy-startup.mjs';
import {sourceWebsiteUrl} from "./navigation.mjs";
import {protectTransport, policyFrom, installPageProtection} from "./protections.mjs";
import {httpRelayUrl, installHttpRelaySocket, createHttpRelayEndpoint} from "./http-relay.mjs";
import { effectiveFilter } from "./filter-detection.mjs";
import {relayCandidates, transportCandidates, probeWisp, RelayTransport, rankForBlocker} from "./relay.mjs";
import "/js/duck-image-viewport.js";
import { compatibilityPlugin } from "./proxy-compat.mjs";
const bounded = (promise, ms, label) => {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
};
let controller,
  initializing,
  frame,
  transportKey = "";
let activeTransport;
let protectionPolicy=policyFrom({});
export function updateProtectionPolicy(settings){protectionPolicy=policyFrom(settings);}
async function activeWorker() {
  const registration = await navigator.serviceWorker.register(
    "/tutsi-runtime.sw.js",
    { scope: "/~/tm/", updateViaCache: "none" },
  );
  if (registration.active) return registration.active;
  const worker = registration.installing || registration.waiting;
  if (!worker) throw new Error("Browser worker is unavailable.");
  await bounded(
    new Promise((resolve, reject) => {
      const changed = () => {
        if (worker.state === "activated") {
          worker.removeEventListener("statechange", changed);
          resolve();
        } else if (worker.state === "redundant") {
          worker.removeEventListener("statechange", changed);
          reject(new Error("Browser worker could not start."));
        }
      };
      worker.addEventListener("statechange", changed);
      changed();
    }),
    20000,
    "Browser worker startup timed out.",
  );
  return registration.active || worker;
}
export function relayUrl(settings) {return relayCandidates(settings)[0];}
function relayStatus(detail) {dispatchEvent(new CustomEvent('tutsi:relay-status',{detail}));}
async function transport(settings) {
  installHttpRelaySocket();
  const fallback=httpRelayUrl();
  const urls=transportCandidates(settings);
  const path=settings.transport==='libcurl'?'/assets/transports/libcurl-scramjet.mjs':'/assets/transports/epoxy-scramjet.mjs';
  const {default:Client}=await import(path);
  const connection=new RelayTransport({urls,visible:()=>!document.hidden&&document.body.dataset.view==="browser",rank:async candidates=>{const remote=await rankForBlocker(candidates.filter(url=>url!==fallback),await effectiveFilter(settings.blocker),{onHint:detail=>dispatchEvent(new CustomEvent('tutsi:filter-hint',{detail}))});const bridge=candidates.filter(url=>url===fallback);return !settings.relay||settings.relay===fallback?[...bridge,...remote]:[...remote,...bridge]},onStatus:relayStatus,createClient:async wisp=>{
    const endpoint=wisp===fallback?createHttpRelayEndpoint():null;
    const url=endpoint?.url||wisp;
    const client=new Client({wisp:url,websocket:url,wisp_v2:settings.transport!=='wisp'});
    if(endpoint){const close=client.close?.bind(client);client.close=()=>{endpoint.close();close?.();};}
    try{if(typeof client.init==='function'&&!client.ready)await bounded(client.init(),10000,'Relay initialization timed out.')}catch(error){client.close?.();throw error}
    return client;
  }});
  try{await connection.init();return protectTransport(connection,()=>protectionPolicy)}catch(error){connection.close();throw error}
}
async function engine(settings) {
  const key = `${settings.transport}:${settings.blocker||""}:${JSON.stringify(transportCandidates(settings))}`;
  if (controller) {
    if (key !== transportKey) {
      const next=await transport(settings);
      controller.setTransport(next);
      activeTransport?.close();activeTransport=next;
      transportKey = key;
    }
    return controller;
  }
  if (initializing) return initializing;
  initializing = (async () => {
    await script(
      "/scramjet/scramjet.js?v=20260905-optional-history-url-v1",
      () => !!window.$scramjet,
    );
    await script(
      "/controller/controller.api.js",
      () => !!window.$scramjetController,
    );
    const [serviceworker, client] = await Promise.all([
      activeWorker(),
      transport(settings),
    ]);
    const instance = new window.$scramjetController.Controller({
      serviceworker,
      transport: client,
      config: {
        prefix: "/~/tm/",
        scramjetPath:
          "/scramjet/scramjet.js?v=20260905-optional-history-url-v1",
        injectPath: "/controller/controller.inject.js",
        wasmPath: "/scramjet/scramjet.wasm",
        virtualWasmPath: "scramjet.wasm.js",
        codec: {
          encode: (url) => encodeURIComponent(url),
          decode: (url) => decodeURIComponent(url),
        },
      },
      scramjetConfig: {
        flags: {
          syncxhr: false,
          disableComputedWrap: true,
          rewriterLogs: false,
          captureErrors: false,
          cleanErrors: false,
          scramitize: false,
          sourcemaps: false,
          destructureRewrites: false,
          allowInvalidJs: false,
          debugTrampolines: false,
          debugSourceURL: false,
          allowFailedIntercepts: true,
          encapsulateWorkers: true,
        },
        maskedfiles: ["inject.js", "scramjet.wasm.js"],
      },
    });
    const stopTracking = trackProxyController(instance);
    try { await waitForProxyController(instance); }
    catch (error) { stopTracking(); client.close?.(); throw error; }
    activeTransport=client;
    controller = instance;
    transportKey = key;
    return instance;
  })().finally(() => {
    initializing = null;
  });
  return initializing;
}
function sourceUrl(raw) { return sourceWebsiteUrl(raw, location.origin); }
function installImageRepair(element, url) {
  element.tutsiSourceUrl = url;
  if (!element.dataset.tutsiImageRepair) {
    element.dataset.tutsiImageRepair = "true";
    element.addEventListener("load", () =>
      setTimeout(() => {
        if (element.isConnected)
          globalThis.NyxDuckImageViewport?.(
            { frame: element, sourceUrl: element.tutsiSourceUrl },
            sourceUrl,
          );
      }, 40),
    );
  }
}
const browserFrames=new WeakMap();
const navigationRequests=new WeakMap();
let navigationId = 0;
let navigationQueue = Promise.resolve();
export function browse(url, settings, element) {
  updateProtectionPolicy(settings);
  const request = ++navigationId;
  navigationRequests.set(element,request);
  const navigate = async () => {
    if (request !== navigationRequests.get(element)) return;
    const instance = await engine(settings);
    if (request !== navigationRequests.get(element) || !element.isConnected) return;
    frame=browserFrames.get(element);
    if (!frame) {
      frame = instance.createFrame(element, {
        plugins: [compatibilityPlugin(()=>protectionPolicy)],
      });
      browserFrames.set(element,frame);
    }
    if(!element.dataset.tutsiProtectionWatch){
      element.dataset.tutsiProtectionWatch='true';
      element.addEventListener('load',()=>{
        installPageProtection(element,protectionPolicy);
        setTimeout(()=>installPageProtection(element,protectionPolicy),80);
        setTimeout(()=>installPageProtection(element,protectionPolicy),500);
      });
    }
    installImageRepair(element, url);
    await frame.go(url);
  };
  const result = navigationQueue.then(navigate, navigate);
  navigationQueue = result.catch(() => {});
  return result;
}
export function control(action, element) {
  if(!element)return;
  const target=browserFrames.get(element);
  if(target&&typeof target[action]==='function')target[action]();
}
export function reloadBrowser(element, settings) {
  if(!element)return Promise.resolve();
  const request=++navigationId;
  navigationRequests.set(element,request);
  const reload=async()=>{
    if(request!==navigationRequests.get(element)||!element.isConnected)return;
    await engine(settings);
    if(request!==navigationRequests.get(element)||!element.isConnected)return;
    control('reload',element);
  };
  const result=navigationQueue.then(reload,reload);
  navigationQueue=result.catch(()=>{});
  return result;
}
export function closeBrowser(element) {
  if(!element)return;
  const target=browserFrames.get(element);
  if(element)navigationRequests.delete(element);
  if(target){target.element.src='about:blank';const i=controller?.frames?.indexOf(target);if(i>=0)controller.frames.splice(i,1);browserFrames.delete(target.element);if(frame===target)frame=null;}
}
export function currentWebsiteUrl(element){
  try{return sourceUrl(element.contentWindow.location.href)||element.tutsiSourceUrl||''}catch{return element?.tutsiSourceUrl||''}
}
export async function testRelay(settings) {
  installHttpRelaySocket();
  for(const url of transportCandidates(settings)) {
    relayStatus({state:'checking',url});
    if(await probeWisp(url)) {relayStatus({state:'available',url});return 'Connected.';}
  }
  throw new Error('No configured relay responded from this device.');
}
