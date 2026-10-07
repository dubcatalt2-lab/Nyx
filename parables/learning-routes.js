export const learningRoutes = Object.freeze({
  '/history': '/assets/games/',
  '/arts': '/apps/nyxify/',
  '/lectures': '/apps/nyxtube/',
  '/literature': '/apps/movies/',
  '/classroom': '/apps/chat/',
  '/mathematics': 'nyx://ai',
  '/laboratory': '/apps/nyxcloud/',
  '/computing': '/apps/cloud-gaming/',
  '/assignments': '/apps/code-studio/',
  '/references': '/apps/link-generator/',
  '/citations': '/apps/link-checker/',
  '/publishing': '/apps/jsdelivr-publisher/',
  '/credentials': '/apps/api-keys/',
  '/planner': 'nyx://settings',
  '/resources': 'nyx://apps'
});
export function appForLearningRoute(value, origin) {
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return '';
    const app = learningRoutes[url.pathname.replace(/\/$/, '')];
    return app ? app + url.search + url.hash : '';
  } catch { return ''; }
}
export function learningRouteForApp(value, origin) {
  const internal = Object.entries(learningRoutes).find(([,app]) => app === value);
  if (internal) return internal[0];
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return '';
    const pathname = url.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '');
    const route = Object.entries(learningRoutes).find(([,app]) => !app.startsWith('nyx:') && app.replace(/\/$/, '') === pathname);
    return route ? route[0] + url.search + url.hash : '';
  } catch { return ''; }
}
if (typeof window !== 'undefined') {
  window.NyxLearningRoutes = {learningRoutes, appForLearningRoute, learningRouteForApp};
  window.__nyxLearningEntry = appForLearningRoute(location.href, location.origin);
}
