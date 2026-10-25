(() => {
  const destination = new URL('/app.html', window.location.origin);
  destination.search = window.location.search;
  destination.hash = window.location.hash;
  window.setTimeout(() => window.location.replace(destination.href), 1012);
})();
