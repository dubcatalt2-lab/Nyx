async function loadDesktopRelease() {
  const response = await fetch('/api/nook-desktop/release', {cache: 'no-store', signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw Error('The Windows download is temporarily unavailable. Please try again shortly.');
  const release = await response.json();
  const quick = document.getElementById('desktopDownload');
  if (quick && release.artifacts?.some(item => item.arch === 'x64')) quick.hidden = false;
  const host = document.getElementById('downloads');
  if (!host) return;
  document.getElementById('releaseStatus').textContent = 'Version ' + release.version + ' · Installer built and published';
  document.getElementById('signing').textContent = release.signed ? 'Digitally signed Windows release.' : 'This first release is unsigned. Windows may show an unknown-publisher warning. A code-signing certificate has not been configured.';
  for (const item of release.artifacts) {
    if (!/^\/download\/nook\/\d+\.\d+\.\d+\/Nook-Agent-[\w.\-]+\.exe$/.test(item.url)) continue;
    const row = document.createElement('div'), link = document.createElement('a'), checksum = document.createElement('p');
    link.className = 'download'; link.href = item.url; link.textContent = 'Download for Windows ' + item.arch + ' · ' + Math.round(item.size / 1048576) + ' MB';
    checksum.className = 'checksum'; checksum.textContent = 'SHA-256: ' + item.sha256;
    row.append(link, checksum); host.append(row);
  }
}
loadDesktopRelease().catch(error => { const status = document.getElementById('releaseStatus'); if (status) status.textContent = error.message; });
