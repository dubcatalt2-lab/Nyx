export const publisherConfig = Object.freeze({
  hosts: ['nyxlearning.org', 'www.nyxlearning.org', 'localhost', '127.0.0.1', '[::1]'],
  bannerPath: '/apps/sponsor/banner.html',
  bannerWidth: 468,
  bannerHeight: 60,
  homeBanners: [
    {path: '/apps/sponsor/side.html', width: 160, height: 600},
    {path: '/apps/sponsor/side.html', width: 160, height: 600}
  ],
  homeLink: 'https://asiafilm.org/4/4e423fea224eac7374c037f143e080e3',
  homeLimit: 2,
  homePeriodMs: 4 * 60 * 1000,
  homeSpacingMs: 1000
});

export function publisherHostAllowed(hostname = location.hostname) {
  return publisherConfig.hosts.includes(hostname);
}

export function publisherBaseMode() {
  try {
    const shell = window.parent === window ? window : window.parent;
    if (shell.__NYX_RUNTIME_CONFIG__?.publisherAdsEnabled === false) return 'off';
    return shell.__nyxPublisherMode || (shell.document.body?.classList.contains('workspace-shell') ? 'pending' : 'standard');
  } catch { return 'off'; }
}

export function publisherMode() {
  const mode = publisherBaseMode();
  try {
    const shell = window.parent === window ? window : window.parent;
    if (shell.__nyxAdcoinsFreeUntil > Date.now()) return 'off';
    if (mode === 'standard') {
      if (shell !== window || document.hidden || document.body?.classList.contains('nyx-loading-active')) return 'off';
      const homes = document.querySelectorAll('.workspace-window.workspace-blank .workspace-home.nyx-minimal-home:not(.hidden)');
      if (![...homes].some(home => home.getClientRects().length && getComputedStyle(home).visibility === 'visible')) return 'off';
    }
    return mode;
  } catch { return 'off'; }
}

export function popupPolicy(mode = publisherMode()) {
  if (mode === 'off' || mode === 'pending') return null;
  return mode === 'adkid'
    ? {limit: 100, period: 60 * 1000, spacing: 600}
    : {limit: publisherConfig.homeLimit, period: publisherConfig.homePeriodMs, spacing: publisherConfig.homeSpacingMs};
}
