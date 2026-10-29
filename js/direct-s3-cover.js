(() => {
  let destination = new URL('/studies.html', location.origin);
  try {
    const requested = new URL(new URLSearchParams(location.search).get('returnTo') || '/studies.html', location.origin);
    if (requested.origin === location.origin && !['/', '/index.html'].includes(requested.pathname)) destination = requested;
  } catch {}
  if (!destination.search) {
    const parameters = new URLSearchParams(location.search);
    parameters.delete('returnTo');
    destination.search = parameters.toString();
  }
  destination.hash = location.hash;
  setTimeout(() => location.replace(destination.href), 1012);
})();
