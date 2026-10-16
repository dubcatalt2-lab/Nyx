// Existing home placements, enabled only in the owner's loopback preview.
export const publisherConfig = Object.freeze({
  homeBanners: [
    {path: '/apps/sponsor/side.html', width: 160, height: 600},
    {path: '/apps/sponsor/side.html', width: 160, height: 600}
  ]
});
export function publisherHostAllowed(hostname = location.hostname) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) && window === window.top;
}
function selectedHome() {
  if (document.hidden || document.body?.classList.contains('n7x-loading-active') ||
      document.body?.classList.contains('browser-content-active')) return null;
  if (document.querySelector('.browser-shell-settings-overlay')) return null;
  return [...document.querySelectorAll('.n2ac0604c6ebc.browser-blank .browser-home.n7x-minimal-home:not(.hidden)')]
    .find(home => home.getClientRects().length && getComputedStyle(home).visibility === 'visible') || null;
}
if (publisherHostAllowed()) window.__nyxPublisherHome = selectedHome;
export function publisherMode() {
  return publisherHostAllowed() && selectedHome() ? 'standard' : 'off';
}
