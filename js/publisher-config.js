const preferenceKey='nyx.ads.enabled';
export function publisherAdsEnabled(){try{return localStorage.getItem(preferenceKey)!=='false';}catch{return false;}}
function refreshAds(){dispatchEvent(new Event('nyx:publisher-change'));for(const button of document.querySelectorAll('[data-n7x-ads-toggle]')){const on=publisherAdsEnabled();button.setAttribute('aria-checked',String(on));button.classList.toggle('on',on);const text=button.querySelector('span');if(text)text.textContent=on?'On':'Off';}}
window[Symbol.for('nyx.ads.preference')]={enabled:publisherAdsEnabled,set(enabled){try{localStorage.setItem(preferenceKey,String(Boolean(enabled)));}catch{return false;}refreshAds();return true;}};
addEventListener('storage',event=>{if(event.key===preferenceKey||event.key===null)refreshAds();});
document.addEventListener('click',event=>{const button=event.target.closest?.('[data-n7x-ads-toggle]');if(!button)return;window[Symbol.for('nyx.ads.preference')].set(!publisherAdsEnabled());});
export const publisherConfig = Object.freeze({
  offerAddress: "https://uplcm.com/4/12141120",
  homeBanners: [
    { path: "/apps/sponsor/side.html", width: 160, height: 600 },
    { path: "/apps/sponsor/side.html", width: 160, height: 600 },
  ],
});
export function publisherOfferAddress() {
  try {
    const value = globalThis.english_RUNTIME_CONFIG?.offerAddress ?? publisherConfig.offerAddress;
    if (!value) return "";
    const address = new URL(value);
    return ["https:", "http:"].includes(address.protocol) && !address.username && !address.password
      ? address.href : "";
  } catch { return ""; }
}
export function publisherHostAllowed() {
  return /^https?:$/.test(location.protocol);
}
export function publisherAccountMode(account = window.__nyxPublisherAccount) {
  if (!publisherAdsEnabled()) return 'off';
  if (!account || account.state === 'pending') return 'pending';
  if (account.state === 'guest') return 'standard';
  if (account.state !== 'ready' || typeof account.role !== 'string' || typeof account.subscriptionStatus !== 'string') return 'pending';
  const staff = ['owner','co_owner','admin','manager','developer','moderator','support'];
  const staffPermissions = /^(?:dashboard:view|users:|audit:|profiles:write|roles:write|subscriptions:write|accounts:|network:bans|developer-console|chat:moderate)/;
  if (account.premiumAccess === true || ['premium','trialing'].includes(account.subscriptionStatus) ||
      staff.includes(account.role) || (Array.isArray(account.permissions) ? account.permissions : []).some(value => staffPermissions.test(value))) return 'off';
  return 'standard';
}
function selectedHome() {
  if (
    document.hidden ||
    document.body?.classList.contains("n7x-loading-active") ||
    document.body?.classList.contains("q12346517d2fb00ddb9")
  )
    return null;
  if (document.querySelector(".q1b8b57bdd44ab91267")) return null;
  return (
    [
      ...document.querySelectorAll(
        ".n2ac0604c6ebc.q6139d8ecebcdf8e8c1 .q4f959b063679fe3afa.n7x-minimal-home:not(.hidden)",
      ),
    ].find(
      (home) => home.getClientRects().length && getComputedStyle(home).visibility === "visible",
    ) || null
  );
}
if (publisherHostAllowed()) window.__nyxPublisherHome = selectedHome;
export function publisherSurface() {
  if (document.hidden || document.fullscreenElement || document.body?.classList.contains('n7x-loading-active')) return null;
  return selectedHome();
}
export function publisherMode() {
  return publisherHostAllowed() && publisherSurface() ? publisherAccountMode() : "off";
}

// Ad documents need storage, but must not share the app's origin.
export function publisherDocumentUrl(path){
 let origin='https://n7x.zakaon.top';
 if(['localhost','127.0.0.1','[::1]'].includes(location.hostname))origin=location.protocol+'//'+(location.hostname==='localhost'?'127.0.0.1':'localhost')+(location.port?':'+location.port:'');
 else if(location.hostname==='n7x.zakaon.top')origin='https://counselors.elkamdistrict.help';
 return new URL(path,origin).href;
}
