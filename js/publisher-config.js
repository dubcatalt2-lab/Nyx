export const publisherConfig = Object.freeze({
  homeBanners: [
    { path: "/apps/sponsor/side.html", width: 160, height: 600 },
    { path: "/apps/sponsor/side.html", width: 160, height: 600 },
  ],
});
export function publisherHostAllowed() {
  return /^https?:$/.test(location.protocol);
}
export function publisherAccountMode(account = window.__nyxPublisherAccount) {
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
  if (document.hidden || document.fullscreenElement || document.body?.classList.contains('n7x-loading-active') || document.body?.classList.contains('q12346517d2fb00ddb9')) return null;
  return selectedHome() || [...document.querySelectorAll('.n2ac0604c6ebc .q6576ed118d3ca9c284')].find(surface => surface.getClientRects().length && getComputedStyle(surface).visibility === 'visible') || null;
}
export function publisherMode() {
  return publisherHostAllowed() && publisherSurface() ? publisherAccountMode() : "off";
}
