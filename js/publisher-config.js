export const publisherConfig = Object.freeze({
  homeBanners: [
    { path: "/apps/sponsor/side.html", width: 160, height: 600 },
    { path: "/apps/sponsor/side.html", width: 160, height: 600 },
  ],
});
export function publisherHostAllowed(hostname = location.hostname) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname) && window === window.top;
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
export function publisherMode() {
  return publisherHostAllowed() && selectedHome() ? "standard" : "off";
}
