// Exact, owner-requested sibling hostnames. Do not match arbitrary suffixes.
export const tutsiHostnames = new Set([
  'tutsi.nyxlearning.org',
  'childsupport.donateyourboat.us',
]);
export function isTutsiHostname(hostname) {
  return tutsiHostnames.has(String(hostname || '').toLowerCase().replace(/\.$/, ''));
}
