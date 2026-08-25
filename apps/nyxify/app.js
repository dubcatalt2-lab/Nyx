const audio = document.getElementById('audio');
const playerEl = document.getElementById('player');
const trackList = document.getElementById('trackList');
const cardGrid = document.getElementById('cardGrid');
const detailView = document.getElementById('detailView');
const emptyState = document.getElementById('emptyState');
const emptyTitle = document.getElementById('emptyTitle');
const emptySub = document.getElementById('emptySub');
const crumbEl = document.getElementById('crumb');
const crumbText = document.getElementById('crumbText');
const seekBar = document.getElementById('seekBar');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const searchInput = document.getElementById('searchInput');
const playlistList = document.getElementById('playlistList');
const playlistSync = document.getElementById('playlistSync');
const playlistDialog = document.getElementById('playlistDialog');
const playlistChoices = document.getElementById('playlistChoices');
const playlistName = document.getElementById('playlistName');
const playlistMessage = document.getElementById('playlistMessage');
const pPlaylist = document.getElementById('pPlaylist');

let curtrack = null;
let results = [];
let query = '';
let mode = 'everything';
let detail = null;
let reqid = 0;
let dragging = false;
let activePlaylistId = '';
let playlistDialogTrack = null;
let playlists = [];
let playlistToken = '';
let playlistTokenExpiresAt = 0;
let playlistAuthPromise = null;

let queue = [];
let qindex = -1;

let shuffleon = localStorage.getItem('nyx_nyxify_shuffle') === '1';
let repeatmode = localStorage.getItem('nyx_nyxify_repeat') || 'off';
let playershown = false;
let queueopen = false;

function fmt(s) {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function playlisttrack(track) {
  return {
    id: String(track?.id || ''),
    title: String(track?.title || '').slice(0, 180),
    artist: String(track?.artist || '').slice(0, 120),
    artistId: String(track?.artistId || ''),
    album: String(track?.album || '').slice(0, 160),
    albumId: String(track?.albumId || ''),
    cover: String(track?.cover || '').slice(0, 500),
    duration: Math.max(0, Math.min(14400, Math.round(Number(track?.duration) || 0)))
  };
}

function localplaylists() {
  try {
    const stored = JSON.parse(localStorage.getItem('nyx_nyxify_playlists') || '[]');
    return Array.isArray(stored) ? stored.slice(0, 16).map(item => ({
      id: /^[A-Za-z0-9_-]{8,64}$/.test(String(item?.id || '')) ? String(item.id) : `playlist_${crypto.randomUUID().replace(/-/g, '')}`,
      name: String(item?.name || 'Playlist').trim().slice(0, 48) || 'Playlist',
      tracks: (Array.isArray(item?.tracks) ? item.tracks : []).slice(0, 150).map(playlisttrack).filter(track => track.id && track.title)
    })) : [];
  } catch (_) {
    return [];
  }
}

function saveplaylistlocal() {
  localStorage.setItem('nyx_nyxify_playlists', JSON.stringify(playlists));
}

async function playlistparenttoken() {
  if (window.parent === window) return null;
  const requestId = `nyxify-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new Promise(resolve => {
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      resolve(value);
    };
    const receive = event => {
      if (event.source !== window.parent || event.origin !== location.origin || event.data?.type !== 'nyx:account-token-response' || event.data?.requestId !== requestId) return;
      finish({ available: true, token: String(event.data.token || '') });
    };
    const timer = setTimeout(() => finish(null), 2500);
    window.addEventListener('message', receive);
    window.parent.postMessage({ type: 'nyx:account-token-request', requestId }, location.origin);
  });
}

async function playlistdirectauth() {
  if (playlistAuthPromise) return playlistAuthPromise;
  playlistAuthPromise = (async () => {
    const configResponse = await fetch('/api/founder-profile/auth-config', { cache: 'no-store' });
    const config = await configResponse.json();
    if (!configResponse.ok || !config?.enabled) return null;
    const [{ initializeApp, getApps }, { getAuth, setPersistence, browserLocalPersistence }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')
    ]);
    const app = getApps().find(item => item.name === 'nyx-founder-owner') || initializeApp({
      apiKey: config.apiKey,
      authDomain: `${config.projectId}.firebaseapp.com`,
      projectId: config.projectId
    }, 'nyx-founder-owner');
    const auth = getAuth(app);
    try { await setPersistence(auth, browserLocalPersistence); } catch (_) {}
    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    return auth;
  })();
  try {
    return await playlistAuthPromise;
  } catch (error) {
    playlistAuthPromise = null;
    throw error;
  }
}

async function playlistaccounttoken(force = false) {
  if (!force && playlistToken && playlistTokenExpiresAt > Date.now() + 30000) return playlistToken;
  const parent = await playlistparenttoken();
  if (parent?.available) {
    playlistToken = parent.token;
    playlistTokenExpiresAt = playlistToken ? Date.now() + 45 * 60000 : 0;
    return playlistToken;
  }
  const auth = await playlistdirectauth();
  playlistToken = auth?.currentUser ? await auth.currentUser.getIdToken(force) : '';
  playlistTokenExpiresAt = playlistToken ? Date.now() + 45 * 60000 : 0;
  return playlistToken;
}

async function playlistrequest(path, options = {}, retry = true) {
  const token = await playlistaccounttoken(!retry);
  if (!token) return null;
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...options, headers, cache: 'no-store' });
  if (response.status === 401 && retry) return playlistrequest(path, options, false);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Playlist request failed (${response.status}).`);
  return payload;
}

function playlistid() {
  return `playlist_${crypto.randomUUID().replace(/-/g, '')}`;
}

function getlikes() {
  try { return JSON.parse(localStorage.getItem('nyx_nyxify_likes')) || []; }
  catch (_) { return []; }
}
function isliked(id) { return getlikes().some(t => t.id === id); }
function togglelike(track) {
  let list = getlikes();
  if (list.some(t => t.id === track.id)) list = list.filter(t => t.id !== track.id);
  else list.push(track);
  localStorage.setItem('nyx_nyxify_likes', JSON.stringify(list));
  return isliked(track.id);
}

function gethistory() {
  try { return JSON.parse(localStorage.getItem('nyx_nyxify_history')) || []; }
  catch (_) { return []; }
}
function pushhistory(track) {
  let list = gethistory().filter(t => t.id !== track.id);
  list.unshift({ ...track });
  localStorage.setItem('nyx_nyxify_history', JSON.stringify(list.slice(0, 25)));
}

function makeclickable(el, label, fn) {
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  if (label) el.setAttribute('aria-label', label);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      fn(e);
    }
  });
}

function paintheart(btn, liked) {
  btn.classList.toggle('liked', liked);
  btn.setAttribute('aria-pressed', String(liked));
  btn.setAttribute('aria-label', liked ? 'unlike' : 'like');
  btn.firstElementChild.className = liked ? 'mingcute--heart-fill' : 'ic-heart';
}

function popheart(btn) {
  btn.classList.remove('pop');
  void btn.offsetWidth;
  btn.classList.add('pop');
}

function bindheart(btn, track) {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const liked = togglelike(track);
    paintheart(btn, liked);
    popheart(btn);
    refreshlikes();
  });
}

function groups(type) {
  const seen = new Map();
  for (const t of results) {
    const key = type === 'artist' ? t.artist : t.album;
    const gid = type === 'artist' ? t.artistId : t.albumId;
    if (!key || !gid) continue;
    if (!seen.has(key)) seen.set(key, { key, id: gid, count: 0, cover: t.cover });
    seen.get(key).count++;
  }
  return [...seen.values()];
}

function setplayingid(id) {
  document.querySelectorAll('[data-id]').forEach(el =>
    el.classList.toggle('playing', el.dataset.id === id));
  renderqueue();
}

function setfilter(next) {
  mode = next;
  document.querySelectorAll('.filter').forEach(b =>
    b.classList.toggle('active', b.dataset.filter === next));
}

function hideviews() {
  emptyState.style.display = 'none';
  trackList.style.display = 'none';
  cardGrid.style.display = 'none';
  detailView.style.display = 'none';
}

function showempty(title, sub, bad) {
  hideviews();
  emptyState.style.display = '';
  emptyTitle.textContent = title;
  emptySub.textContent = sub || '';
  emptyState.classList.toggle('error', !!bad);
  crumbEl.style.display = 'none';
}

function showloading(name) {
  hideviews();
  if (name) {
    crumbEl.style.display = '';
    crumbText.textContent = name;
  } else {
    crumbEl.style.display = 'none';
  }
  trackList.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const row = document.createElement('div');
    row.className = 'skel';
    row.innerHTML = `
      <span class="sk sk-art"></span>
      <div class="sk-lines">
        <span class="sk sk-l w-70"></span>
        <span class="sk sk-l w-45"></span>
      </div>`;
    trackList.appendChild(row);
  }
  trackList.style.display = '';
}

function buildrow(t, list) {
  const row = document.createElement('div');
  row.className = 'row' + (curtrack && curtrack.id === t.id ? ' playing' : '');
  row.dataset.id = t.id;

  const liked = isliked(t.id);
  const artistHtml = `<span class="alink">${esc(t.artist)}</span>`;
  const sub = t.album ? `${artistHtml} · ${esc(t.album)}` : artistHtml;

  row.innerHTML = `
    <img src="${esc(t.cover)}" alt="" loading="lazy">
    <div class="t-meta">
      <div class="t-top">
        <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="t-title">${esc(t.title)}</span>
      </div>
      <div class="t-sub">${sub}</div>
    </div>
    <span class="t-duration">${fmt(t.duration)}</span>
    <button type="button" class="like-btn${liked ? ' liked' : ''}" aria-pressed="${liked}" aria-label="${liked ? 'unlike' : 'like'}">
      <i class="${liked ? 'mingcute--heart-fill' : 'ic-heart'}"></i>
    </button>`;

  makeclickable(row, `play ${t.title} by ${t.artist}`, () => playtrack(t, list));

  row.addEventListener('click', e => {
    if (e.target.closest('.like-btn')) return;
    if (e.target.closest('.alink')) {
      e.stopPropagation();
      if (t.artistId) opendetail('artist', t.artistId, t.artist);
      return;
    }
    playtrack(t, list);
  });

  bindheart(row.querySelector('.like-btn'), t);
  return row;
}

function buildcard(g, type) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-art">
      <img src="${esc(g.cover)}" alt="" loading="lazy">
      <button type="button" class="card-play" aria-label="play ${esc(g.key)}"><i class="line-md--play-filled"></i></button>
    </div>
    <span class="c-name">${esc(g.key)}</span>
    <span class="c-count">${g.count} ${g.count === 1 ? 'track' : 'tracks'}</span>`;

  makeclickable(card, `open ${g.key}`, () => opendetail(type, g.id, g.key));
  card.addEventListener('click', e => {
    if (e.target.closest('.card-play')) return;
    opendetail(type, g.id, g.key);
  });
  card.querySelector('.card-play').addEventListener('click', e => {
    e.stopPropagation();
    opendetail(type, g.id, g.key, true);
  });
  return card;
}

function renderrowsinto(container, list) {
  container.innerHTML = '';
  container.style.display = list.length ? '' : 'none';
  list.forEach(t => container.appendChild(buildrow(t, list)));
}

function showrows(list) {
  hideviews();
  crumbEl.style.display = 'none';
  renderrowsinto(trackList, list);
}

function showcards(type) {
  hideviews();
  crumbEl.style.display = 'none';

  const list = groups(type);
  cardGrid.innerHTML = '';
  cardGrid.style.display = list.length ? '' : 'none';
  list.forEach(g => cardGrid.appendChild(buildcard(g, type)));

  if (!list.length) {
    showempty(`No ${type}s yet`, 'Results will appear here after you search.');
  }
}

function showeverythinghome() {
  hideviews();
  crumbEl.style.display = 'none';

  const artists = groups('artist');
  const albums = groups('album');

  detailView.innerHTML = '';

  const list = document.createElement('div');
  renderrowsinto(list, results);
  detailView.appendChild(list);

  if (artists.length) {
    const ag = document.createElement('div');
    ag.className = 'cards';
    artists.forEach(g => ag.appendChild(buildcard(g, 'artist')));
    detailView.appendChild(ag);
  }

  if (albums.length > 1) {
    const al = document.createElement('div');
    al.className = 'cards';
    albums.forEach(g => al.appendChild(buildcard(g, 'album')));
    detailView.appendChild(al);
  }

  detailView.style.display = '';
}

function buildhead(img, name, sub, tracks) {
  const head = document.createElement('div');
  head.className = 'group-head';
  head.innerHTML = `
    <img src="${esc(img)}" alt="">
    <div>
      <div class="g-name">${esc(name)}</div>
      <div class="g-sub">${esc(sub)}</div>
    </div>
    <div class="g-actions">
      <button type="button" class="g-play" aria-label="play all"><i class="line-md--play-filled"></i>Play</button>
    </div>`;
  head.querySelector('.g-play').addEventListener('click', () => {
    if (tracks.length) playtrack(tracks[0], tracks);
  });
  return head;
}

async function opendetail(type, id, name, autoplay) {
  const myreq = ++reqid;
  detail = { type, id, name, data: null };
  showloading(name);
  try {
    const r = await fetch(`/api/nyxify/${type}/${id}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    if (myreq !== reqid) return;
    detail.data = data;
    renderdetail();
    if (autoplay && data.tracks.length) playtrack(data.tracks[0], data.tracks);
  } catch (err) {
    if (myreq !== reqid) return;
    detail = null;
    showempty('Could not load ' + type, err.message, true);
  }
}

function renderdetail() {
  const d = detail.data;
  const count = detail.type === 'artist' && d.total ? d.total : d.tracks.length;
  hideviews();

  crumbEl.style.display = '';
  crumbText.textContent = `${detail.name} · ${count} tracks`;

  detailView.innerHTML = '';
  detailView.appendChild(buildhead(d.cover, d.name,
    d.artist ? `${d.artist} · ${count} tracks` : `${count} tracks`,
    d.tracks));

  if (detail.type === 'artist' && d.albums.length) {
    const grid = document.createElement('div');
    grid.className = 'cards';
    d.albums.forEach(a => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-art">
          <img src="${esc(a.cover)}" alt="" loading="lazy">
          <button type="button" class="card-play" aria-label="play ${esc(a.title)}"><i class="line-md--play-filled"></i></button>
        </div>
        <span class="c-name">${esc(a.title)}</span>`;
      makeclickable(card, `open ${a.title}`, () => opendetail('album', a.id, a.title));
      card.addEventListener('click', e => {
        if (e.target.closest('.card-play')) return;
        opendetail('album', a.id, a.title);
      });
      card.querySelector('.card-play').addEventListener('click', e => {
        e.stopPropagation();
        opendetail('album', a.id, a.title, true);
      });
      grid.appendChild(card);
    });
    detailView.appendChild(grid);
  }

  const list = document.createElement('div');
  renderrowsinto(list, d.tracks);
  detailView.appendChild(list);

  detailView.style.display = '';
}

function rendermain() {
  if (activePlaylistId) return renderplaylistview();
  if (detail) return detail.data ? renderdetail() : showloading(detail.name);
  if (!results.length) {
    return showempty(query ? 'No results' : 'Find something to play',
      query ? `Nothing matched "${query}".` : 'Search for a song, artist, or album.');
  }
  if (mode === 'everything') return showeverythinghome();
  if (mode === 'artists') return showcards('artist');
  if (mode === 'albums') return showcards('album');
  showrows(results);
}

crumbEl.addEventListener('click', () => {
  detail = null;
  activePlaylistId = '';
  rendermain();
});

document.querySelectorAll('.filter').forEach(btn => {
  btn.addEventListener('click', () => {
    detail = null;
    activePlaylistId = '';
    setfilter(btn.dataset.filter);
    if (!results.length) return showempty('Find something to play', 'Search for a song, artist, or album.');
    rendermain();
  });
});

function rendermini(container, list, emptymsg) {
  container.innerHTML = '';
  if (!list.length) {
    const div = document.createElement('div');
    div.className = 'mod-empty';
    div.textContent = emptymsg;
    container.appendChild(div);
    return;
  }
  list.forEach(t => {
    const item = document.createElement('div');
    item.className = 'mini' + (curtrack && curtrack.id === t.id ? ' playing' : '');
    item.dataset.id = t.id;
    const liked = isliked(t.id);
    item.innerHTML = `
      <img src="${esc(t.cover)}" alt="" loading="lazy">
      <div class="mini-m">
        <div class="mini-t">${esc(t.title)}</div>
        <div class="mini-a">${esc(t.artist)}</div>
      </div>
      <button type="button" class="like-btn${liked ? ' liked' : ''}" aria-pressed="${liked}" aria-label="${liked ? 'unlike' : 'like'}"><i class="${liked ? 'mingcute--heart-fill' : 'ic-heart'}"></i></button>`;
    makeclickable(item, `play ${t.title} by ${t.artist}`, () => playtrack(t, list));
    item.addEventListener('click', e => {
      if (e.target.closest('.like-btn')) return;
      playtrack(t, list);
    });
    bindheart(item.querySelector('.like-btn'), t);
    container.appendChild(item);
  });
}

function renderplaylists() {
  playlistList.innerHTML = '';
  if (!playlists.length) {
    const empty = document.createElement('div');
    empty.className = 'mod-empty';
    empty.textContent = 'Create a playlist to save songs together.';
    playlistList.appendChild(empty);
    return;
  }
  playlists.forEach(playlist => {
    const entry = document.createElement('div');
    entry.className = 'playlist-entry';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'playlist-open';
    const name = document.createElement('strong');
    name.textContent = playlist.name;
    const count = document.createElement('small');
    count.textContent = `${playlist.tracks.length} ${playlist.tracks.length === 1 ? 'track' : 'tracks'}`;
    open.append(name, count);
    open.addEventListener('click', () => openplaylist(playlist.id));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'playlist-delete';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Delete ${playlist.name}`);
    remove.addEventListener('click', () => {
      if (!confirm(`Delete "${playlist.name}"?`)) return;
      playlists = playlists.filter(item => item.id !== playlist.id);
      if (activePlaylistId === playlist.id) activePlaylistId = '';
      void persistplaylists();
      rendermain();
    });
    entry.append(open, remove);
    playlistList.appendChild(entry);
  });
}

function renderplaylistchoices() {
  playlistChoices.innerHTML = '';
  if (!playlists.length) {
    const empty = document.createElement('div');
    empty.className = 'mod-empty';
    empty.textContent = 'No playlists yet.';
    playlistChoices.appendChild(empty);
    return;
  }
  playlists.forEach(playlist => {
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'playlist-choice';
    const label = document.createElement('span');
    label.textContent = playlist.name;
    const count = document.createElement('small');
    count.textContent = `${playlist.tracks.length} tracks`;
    choice.append(label, count);
    choice.addEventListener('click', () => {
      if (playlistDialogTrack) addtoplaylist(playlist.id, playlistDialogTrack);
      else {
        playlistDialog.close();
        openplaylist(playlist.id);
      }
    });
    playlistChoices.appendChild(choice);
  });
}

function openplaylistdialog(track = null) {
  playlistDialogTrack = track ? playlisttrack(track) : null;
  playlistMessage.textContent = '';
  document.getElementById('playlistDialogHint').textContent = playlistDialogTrack
    ? `Add “${playlistDialogTrack.title}” to a playlist.`
    : 'Create a playlist or choose one below.';
  renderplaylistchoices();
  playlistDialog.showModal();
  playlistName.focus();
}

function openplaylist(id) {
  const playlist = playlists.find(item => item.id === id);
  if (!playlist) return;
  activePlaylistId = id;
  detail = null;
  renderplaylistview();
}

function renderplaylistview() {
  const playlist = playlists.find(item => item.id === activePlaylistId);
  if (!playlist) {
    activePlaylistId = '';
    return rendermain();
  }
  hideviews();
  crumbEl.style.display = '';
  crumbText.textContent = `${playlist.name} · ${playlist.tracks.length} tracks`;
  if (!playlist.tracks.length) {
    showempty('This playlist is empty', 'Play a song, then use + in the player to add it.');
    crumbEl.style.display = '';
    crumbText.textContent = `${playlist.name} · 0 tracks`;
    return;
  }
  renderrowsinto(trackList, playlist.tracks);
}

async function persistplaylists() {
  saveplaylistlocal();
  renderplaylists();
  renderplaylistchoices();
  try {
    const payload = await playlistrequest('/api/nyxify/playlists', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlists })
    });
    playlistSync.textContent = payload ? 'Synced to your account' : 'Saved on this device';
  } catch (error) {
    playlistSync.textContent = 'Saved locally · account sync unavailable';
    playlistMessage.textContent = error.message || 'Account sync is unavailable.';
  }
}

function addtoplaylist(id, track) {
  const playlist = playlists.find(item => item.id === id);
  if (!playlist || !track) return;
  if (playlist.tracks.some(item => item.id === track.id)) {
    playlistMessage.textContent = `Already in ${playlist.name}.`;
    return;
  }
  if (playlist.tracks.length >= 150) {
    playlistMessage.textContent = 'This playlist has reached 150 tracks.';
    return;
  }
  playlist.tracks.push(playlisttrack(track));
  playlistMessage.textContent = `Added to ${playlist.name}.`;
  void persistplaylists();
}

async function loadplaylists() {
  playlists = localplaylists();
  renderplaylists();
  try {
    const payload = await playlistrequest('/api/nyxify/playlists');
    if (!payload) {
      playlistSync.textContent = 'Saved on this device';
      return;
    }
    const remote = Array.isArray(payload.playlists) ? payload.playlists : [];
    if (!remote.length && playlists.length) {
      await persistplaylists();
      return;
    }
    playlists = remote;
    saveplaylistlocal();
    renderplaylists();
    playlistSync.textContent = 'Synced to your account';
  } catch (_) {
    playlistSync.textContent = 'Saved locally · account sync unavailable';
  }
}

function refreshlikes() {
  const likes = getlikes();
  document.getElementById('likedCount').textContent = likes.length;
  rendermini(document.getElementById('likedList'), likes, 'Songs you like will appear here.');
  rendermini(document.getElementById('historyList'), gethistory(), 'Songs you play will appear here.');
  if (curtrack) paintheart(document.getElementById('pLike'), isliked(curtrack.id));
  document.querySelectorAll('#trackList .row, #detailView .row').forEach(row => {
    const btn = row.querySelector('.like-btn');
    if (!btn) return;
    paintheart(btn, isliked(row.dataset.id));
  });
}

document.getElementById('newPlaylistBtn').addEventListener('click', () => openplaylistdialog());
document.getElementById('playlistDialogClose').addEventListener('click', () => playlistDialog.close());
document.getElementById('playlistCreateForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = playlistName.value.trim().slice(0, 48);
  if (!name) {
    playlistMessage.textContent = 'Enter a playlist name.';
    playlistName.focus();
    return;
  }
  if (playlists.length >= 16) {
    playlistMessage.textContent = 'You can have up to 16 playlists.';
    return;
  }
  if (playlists.some(item => item.name.toLowerCase() === name.toLowerCase())) {
    playlistMessage.textContent = 'A playlist with that name already exists.';
    return;
  }
  const playlist = { id: playlistid(), name, tracks: playlistDialogTrack ? [playlisttrack(playlistDialogTrack)] : [] };
  playlists.push(playlist);
  playlistName.value = '';
  playlistMessage.textContent = playlistDialogTrack ? `Created ${name} and added the song.` : `Created ${name}.`;
  void persistplaylists();
  if (!playlistDialogTrack) {
    playlistDialog.close();
    openplaylist(playlist.id);
  }
});
pPlaylist.disabled = true;
pPlaylist.addEventListener('click', () => {
  if (curtrack) openplaylistdialog(curtrack);
});

document.getElementById('searchForm').addEventListener('submit', async e => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (!q) return;
  showloading();
  try {
    const r = await fetch(`/api/nyxify/search?q=${encodeURIComponent(q)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    query = q;
    results = data.data || [];
    detail = null;
    activePlaylistId = '';
    setfilter('everything');
    rendermain();
  } catch (err) {
    showempty('Search failed', err.message, true);
  }
});

const dlBtn = document.getElementById('dlBtn');

function updatebodypad() {
  if (!playershown) {
    document.body.style.paddingBottom = '';
    return;
  }
  const h = playerEl.getBoundingClientRect().height;
  document.body.style.paddingBottom = Math.ceil(h + 14 + 26) + 'px';
}

function setplayershown(v) {
  if (playershown === v) return;
  playershown = v;
  playerEl.classList.toggle('visible', v);
  playerEl.toggleAttribute('inert', !v);
  if (!v) setqueueopen(false);
  requestAnimationFrame(updatebodypad);
}

function playtrack(t, list) {
  curtrack = t;
  queue = (list || results).slice();
  qindex = queue.findIndex(x => x.id === t.id);
  if (qindex === -1) { queue.unshift(t); qindex = 0; }

  pushhistory(t);

  audio.src = `/api/nyxify/stream/${t.id}`;
  audio.play();

  document.getElementById('pArt').src = t.cover || '';
  document.getElementById('pTitle').textContent = t.title;
  document.getElementById('pArtist').textContent = t.artist;
  document.getElementById('timeTotal').textContent = fmt(t.duration);

  dlBtn.href = `/api/nyxify/stream/${t.id}`;
  dlBtn.setAttribute('download', `${(t.artist || 'unknown')} - ${(t.title || 'song')}.mp3`.replace(/["\\]/g, ''));
  dlBtn.setAttribute('aria-label', `download ${t.title}`);
  pPlaylist.disabled = false;

  setmedia(t);

  seekBar.value = 0;
  seekBar.style.setProperty('--fill', '0%');
  document.getElementById('timeCur').textContent = '0:00';

  setplayingid(t.id);
  refreshlikes();
  renderqueue();
  setplayershown(true);
}

function playat(i) {
  if (i >= 0 && i < queue.length) playtrack(queue[i], queue);
}

function resetend() {
  playIcon.className = 'line-md--play-filled';
  seekBar.value = 0;
  seekBar.style.setProperty('--fill', '0%');
  document.getElementById('timeCur').textContent = '0:00';
}

function advance(manual) {
  if (!queue.length) return;
  if (shuffleon && queue.length > 1) {
    let i;
    do { i = Math.floor(Math.random() * queue.length); } while (i === qindex);
    return playat(i);
  }
  let i = qindex + 1;
  if (i >= queue.length) {
    if (repeatmode === 'all' || manual) i = 0;
    else return resetend();
  }
  playat(i);
}

function playprev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  if (qindex > 0) playat(qindex - 1);
  else audio.currentTime = 0;
}

document.getElementById('nextBtn').addEventListener('click', () => advance(true));
document.getElementById('prevBtn').addEventListener('click', playprev);

audio.addEventListener('ended', () => {
  if (repeatmode === 'one') { audio.currentTime = 0; audio.play(); return; }
  advance(false);
});

const shuffleBtn = document.getElementById('shuffleBtn');
shuffleBtn.classList.toggle('on', shuffleon);
shuffleBtn.setAttribute('aria-pressed', String(shuffleon));
shuffleBtn.title = `shuffle: ${shuffleon ? 'on' : 'off'}`;
shuffleBtn.addEventListener('click', () => {
  shuffleon = !shuffleon;
  localStorage.setItem('nyx_nyxify_shuffle', shuffleon ? '1' : '0');
  shuffleBtn.classList.toggle('on', shuffleon);
  shuffleBtn.setAttribute('aria-pressed', String(shuffleon));
  shuffleBtn.title = `shuffle: ${shuffleon ? 'on' : 'off'}`;
});

const repeatBtn = document.getElementById('repeatBtn');
const repeatIcon = document.getElementById('repeatIcon');
const repeatNext = { off: 'all', all: 'one', one: 'off' };
repeatIcon.className = repeatmode === 'one' ? 'ic-repeat-one' : 'ic-repeat';
repeatBtn.classList.toggle('on', repeatmode !== 'off');
repeatBtn.setAttribute('aria-pressed', String(repeatmode !== 'off'));
repeatBtn.title = `repeat: ${repeatmode === 'all' ? 'all' : repeatmode === 'one' ? 'this song' : 'off'}`;
repeatBtn.addEventListener('click', () => {
  repeatmode = repeatNext[repeatmode];
  localStorage.setItem('nyx_nyxify_repeat', repeatmode);
  repeatIcon.className = repeatmode === 'one' ? 'ic-repeat-one' : 'ic-repeat';
  repeatBtn.classList.toggle('on', repeatmode !== 'off');
  repeatBtn.setAttribute('aria-pressed', String(repeatmode !== 'off'));
  repeatBtn.title = `repeat: ${repeatmode === 'all' ? 'all' : repeatmode === 'one' ? 'this song' : 'off'}`;
});

playBtn.addEventListener('click', () => {
  if (!curtrack) {
    if (results.length) playtrack(results[0]);
    else if (getlikes().length) playtrack(getlikes()[0]);
    return;
  }
  if (audio.paused) audio.play(); else audio.pause();
});
audio.addEventListener('play', () => playIcon.className = 'material-symbols--pause-rounded');
audio.addEventListener('pause', () => playIcon.className = 'line-md--play-filled');

const pLikeBtn = document.getElementById('pLike');
pLikeBtn.addEventListener('click', e => {
  e.stopPropagation();
  if (!curtrack) return;
  const liked = togglelike(curtrack);
  paintheart(pLikeBtn, liked);
  popheart(pLikeBtn);
  refreshlikes();
});

const queueToggle = document.getElementById('queueToggle');
const queuePanel = document.getElementById('queuePanel');
const qBadge = document.getElementById('qBadge');

function setqueueopen(open) {
  queueopen = open;
  queuePanel.classList.toggle('open', open);
  queueToggle.classList.toggle('on', open);
  queueToggle.setAttribute('aria-expanded', String(open));
  queuePanel.setAttribute('aria-hidden', String(!open));
}

queueToggle.addEventListener('click', () => setqueueopen(!queueopen));
document.getElementById('qHide').addEventListener('click', () => setqueueopen(false));
document.getElementById('qClear').addEventListener('click', () => {
  queue = queue.slice(0, qindex + 1);
  renderqueue();
});

function renderqueue() {
  const qList = document.getElementById('qList');
  const up = queue.slice(qindex + 1);
  qList.innerHTML = '';

  qBadge.textContent = up.length;
  qBadge.hidden = up.length === 0;

  if (!up.length) {
    const div = document.createElement('div');
    div.className = 'q-empty';
    div.textContent = curtrack ? 'End of queue. Turn on repeat to keep listening.' : 'Play a song to start a queue.';
    qList.appendChild(div);
    return;
  }

  up.forEach((t, i) => {
    const reali = qindex + 1 + i;
    const item = document.createElement('div');
    item.className = 'mini';
    item.innerHTML = `
      <img src="${esc(t.cover)}" alt="">
      <div class="mini-m">
        <div class="mini-t">${esc(t.title)}</div>
        <div class="mini-a">${esc(t.artist)}</div>
      </div>`;
    makeclickable(item, `play ${t.title}`, () => playat(reali));
    item.addEventListener('click', () => playat(reali));
    qList.appendChild(item);
  });
}

const timeCur = document.getElementById('timeCur');
let pendingseek = null;

function knowndur() {
  if (isFinite(audio.duration) && audio.duration) return audio.duration;
  return curtrack && curtrack.duration ? curtrack.duration : 0;
}

function updateseek(sec) {
  const dur = knowndur();
  if (!dur) return;
  const pct = Math.min(100, Math.max(0, (sec / dur) * 100));
  seekBar.value = pct;
  seekBar.style.setProperty('--fill', pct + '%');
  timeCur.textContent = fmt(sec);
}

audio.addEventListener('loadedmetadata', () => {
  document.getElementById('timeTotal').textContent = fmt(audio.duration);
  if (pendingseek != null) {
    try { audio.currentTime = pendingseek; } catch (_) {}
    pendingseek = null;
  }
});

audio.addEventListener('seeked', () => updateseek(audio.currentTime));

audio.addEventListener('timeupdate', () => {
  if (dragging || audio.seeking) return;
  updateseek(audio.currentTime);
});

seekBar.addEventListener('input', () => {
  dragging = true;
  seekBar.classList.add('dragging');
  const sec = (parseFloat(seekBar.value) / 100) * knowndur();
  seekBar.style.setProperty('--fill', seekBar.value + '%');
  timeCur.textContent = fmt(sec);
});

function commitseek() {
  seekBar.classList.remove('dragging');
  dragging = false;
  if (!curtrack) return;

  let target = (parseFloat(seekBar.value) / 100) * knowndur();
  target = Math.max(target, 0);
  if (isFinite(audio.duration) && audio.duration) {
    target = Math.min(target, Math.max(audio.duration - 0.25, 0));
  }

  if (isFinite(audio.duration) && audio.duration) {
    try { audio.currentTime = target; } catch (_) {}
  } else {
    pendingseek = target;
  }
  updateseek(target);
}
seekBar.addEventListener('change', commitseek);
seekBar.addEventListener('pointerup', commitseek);

function skipby(sec) {
  if (!curtrack) return;
  const dur = knowndur();
  const base = isFinite(audio.currentTime) ? audio.currentTime : 0;
  const t = Math.min(Math.max(base + sec, 0), Math.max(dur - 0.25, 0));
  try { audio.currentTime = t; } catch (_) {}
  updateseek(t);
}

    const volBar = document.getElementById('volBar');
const volBtn = document.getElementById('volBtn');
const volIcon = document.getElementById('volIcon');
const volWrap = document.getElementById('volWrap');
const volPopup = document.getElementById('volPopup');
let volopen = false;
function setvolume(v) {
  v = Math.min(100, Math.max(0, v));
  audio.volume = v / 100;
  audio.muted = false;
  volBar.value = v;
  volBar.style.setProperty('--fill', v + '%');
  localStorage.setItem('nyx_nyxify_volume', v);
  syncvolume();
}

function syncvolume() {
  const muted = audio.muted || audio.volume === 0;
  volIcon.className = muted ? 'lucide--volume-x' : (audio.volume < 0.5 ? 'lucide--volume-1' : 'lucide--volume-2');
}

function setvolopen(open) {
  volopen = open;
  volPopup.classList.toggle('open', open);
  volBtn.setAttribute('aria-expanded', String(open));
}

volBtn.addEventListener('click', e => {
  e.stopPropagation();
  setvolopen(!volopen);
});

document.addEventListener('click', e => {
  if (volopen && !volWrap.contains(e.target)) setvolopen(false);
});

volBar.addEventListener('input', () => {
  setvolume(parseFloat(volBar.value));
});

const savedvol = localStorage.getItem('nyx_nyxify_volume');
const initvol = savedvol !== null && savedvol !== '' ? Math.min(100, Math.max(0, Number(savedvol))) : 80;
volBar.value = initvol;
audio.volume = initvol / 100;
volBar.style.setProperty('--fill', initvol + '%');
syncvolume();

document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

  if (e.key === 'Escape') {
    if (queueopen) setqueueopen(false);
    if (volopen) setvolopen(false);
    return;
  }
  if (e.key === '/') {
    if (!typing) {
      e.preventDefault();
      searchInput.focus();
    }
    return;
  }
  if (typing) return;
  if (e.key === 'ArrowRight' && !e.target.matches('input[type="range"]')) { e.preventDefault(); skipby(10); }
  else if (e.key === 'ArrowLeft' && !e.target.matches('input[type="range"]')) { e.preventDefault(); skipby(-10); }
  else if (e.key === 'ArrowUp' && !e.target.matches('input[type="range"]')) { e.preventDefault(); setvolume((audio.muted ? 0 : audio.volume * 100) + 5); }
  else if (e.key === 'ArrowDown' && !e.target.matches('input[type="range"]')) { e.preventDefault(); setvolume((audio.muted ? 0 : audio.volume * 100) - 5); }
  else if (e.code === 'Space' && tag !== 'button' && !e.target.closest('[role="button"]')) { e.preventDefault(); playBtn.click(); }
});

window.addEventListener('resize', updatebodypad);

const nyxifyThemeAccents = Object.freeze({
  default: '#9b8cf5',
  midnight: '#9eb7d9',
  ruby: '#d58b9a',
  emerald: '#82c4ae',
  sakura: '#d5a2c6',
  fresh: '#a6c99c'
});

function validhex(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
}

function hexrgb(value) {
  const hex = validhex(value) ? value.slice(1) : nyxifyThemeAccents.default.slice(1);
  return [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16));
}

let nyxifyConstellationScene = null;
function applynyxifytheme() {
  const theme = localStorage.getItem('nyx.theme') || 'default';
  let accent = theme === 'custom' ? localStorage.getItem('nyx.customThemeColor') : nyxifyThemeAccents[theme];
  if (!validhex(accent)) accent = nyxifyThemeAccents.default;
  const channels = hexrgb(accent);
  if (Math.max(...channels) < 72) accent = '#f1f3f7';
  document.documentElement.dataset.nyxifyTheme = theme;
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-rgb', hexrgb(accent).join(', '));
  nyxifyConstellationScene?.refreshColor();
}

function setupconstellations(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ambient = Array.from({ length: 54 }, (_, index) => ({
    x: ((index * 47) % 101) / 100,
    y: ((index * 71 + 13) % 103) / 102,
    r: .45 + (index % 4) * .18,
    o: .12 + (index % 5) * .035
  }));
  const constellations = [
    { x: .13, y: .24, s: 74, points: [[-.8,.1],[-.28,-.2],[.18,.05],[.63,-.58],[.9,.25],[.24,.52]], lines: [[0,1],[1,2],[2,3],[2,4],[2,5],[4,5]] },
    { x: .47, y: .16, s: 58, points: [[-.75,.45],[-.42,-.32],[.1,-.08],[.54,-.52],[.77,.23],[.15,.62]], lines: [[0,1],[1,2],[2,3],[2,4],[2,5]] },
    { x: .82, y: .28, s: 70, points: [[-.82,.12],[-.38,-.4],[.05,-.08],[.58,-.55],[.83,.08],[.42,.55],[-.18,.42]], lines: [[0,1],[1,2],[2,3],[2,4],[4,5],[5,6],[6,2]] },
    { x: .24, y: .72, s: 62, points: [[-.7,-.3],[-.26,.12],[.08,-.48],[.5,-.08],[.78,.46],[.06,.58]], lines: [[0,1],[1,2],[1,3],[3,4],[3,5]] },
    { x: .62, y: .66, s: 82, points: [[-.84,.2],[-.45,-.42],[-.04,-.08],[.38,-.52],[.75,-.08],[.48,.5],[-.18,.58]], lines: [[0,1],[1,2],[2,3],[2,4],[4,5],[5,6],[6,2]] },
    { x: .88, y: .82, s: 52, points: [[-.76,.32],[-.38,-.28],[.12,-.5],[.6,-.12],[.76,.48],[.04,.58]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,1]] }
  ];
  let width = 0;
  let height = 0;
  let color = hexrgb(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  let lastFrame = 0;

  function resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function refreshColor() {
    color = hexrgb(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  }

  function draw(now = 0) {
    if (!reduced && now - lastFrame < 42) {
      requestAnimationFrame(draw);
      return;
    }
    lastFrame = now;
    ctx.clearRect(0, 0, width, height);
    const pulse = reduced ? 0 : Math.sin(now / 1700) * .035;
    for (const dot of ambient) {
      ctx.beginPath();
      ctx.arc(dot.x * width, dot.y * height, dot.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.join(',')},${dot.o + pulse})`;
      ctx.fill();
    }
    for (let clusterIndex = 0; clusterIndex < constellations.length; clusterIndex += 1) {
      const cluster = constellations[clusterIndex];
      const drift = reduced ? 0 : Math.sin(now / 2600 + clusterIndex) * 2;
      const points = cluster.points.map(([x, y]) => [cluster.x * width + x * cluster.s, cluster.y * height + y * cluster.s + drift]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${color.join(',')},.16)`;
      for (const [from, to] of cluster.lines) {
        ctx.beginPath();
        ctx.moveTo(...points[from]);
        ctx.lineTo(...points[to]);
        ctx.stroke();
      }
      for (const [x, y] of points) {
        ctx.beginPath();
        ctx.arc(x, y, 1.45, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color.join(',')},.72)`;
        ctx.fill();
      }
    }
    if (!reduced) requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  refreshColor();
  draw();
  return { refreshColor };
}

applynyxifytheme();
nyxifyConstellationScene = setupconstellations(document.getElementById('stars'));
window.addEventListener('storage', event => {
  if (event.key === 'nyx.theme' || event.key === 'nyx.customThemeColor') applynyxifytheme();
});

setplayershown(false);
refreshlikes();
renderqueue();
void loadplaylists();

function setmedia(t) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: t.artist,
    album: t.album || 'mizu',
    artwork: t.cover ? [{ src: t.cover, sizes: '250x250', type: 'image/jpeg' }] : []
  });
}

function syncmediapos() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  if (!isFinite(audio.duration) || !audio.duration) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: audio.duration,
      position: audio.currentTime,
      playbackRate: audio.playbackRate
    });
  } catch (_) {}
}

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => audio.play());
  navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  navigator.mediaSession.setActionHandler('previoustrack', playprev);
  navigator.mediaSession.setActionHandler('nexttrack', () => advance(true));
}

audio.addEventListener('loadedmetadata', syncmediapos);
audio.addEventListener('seeked', syncmediapos);
