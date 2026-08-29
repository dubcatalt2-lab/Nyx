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
const sidebarPlaylistList = document.getElementById('sidebarPlaylistList');
const playlistSync = document.getElementById('playlistSync');
const playlistDialog = document.getElementById('playlistDialog');
const playlistChoices = document.getElementById('playlistChoices');
const playlistName = document.getElementById('playlistName');
const playlistMessage = document.getElementById('playlistMessage');
const pPlaylist = document.getElementById('pPlaylist');
const nowPlayingModule = document.getElementById('nowPlayingModule');
const nowPlayingArt = document.getElementById('nowPlayingArt');
const nowPlayingContext = document.getElementById('nowPlayingContext');
const nowPlayingTitle = document.getElementById('nowPlayingTitle');
const nowPlayingArtist = document.getElementById('nowPlayingArtist');
const nowPlayingAlbum = document.getElementById('nowPlayingAlbum');
const nowPlayingPlaylists = document.getElementById('nowPlayingPlaylists');
const nowPlayingNext = document.getElementById('nowPlayingNext');
const fullTrackStage = document.getElementById('fullTrackStage');
const fullTrackTitle = document.getElementById('fullTrackTitle');
const fullTrackStatus = document.getElementById('fullTrackStatus');
const fullTrackPreview = document.getElementById('fullTrackPreview');
const fullTrackVideo = document.getElementById('fullTrackVideo');

let curtrack = null;
let results = [];
let query = '';
let mode = 'home';
let homeData = { tracks: [], artists: [], albums: [] };
let homeLoading = true;
let homeError = '';
let playbackContext = 'Nyxify';
let detail = null;
let reqid = 0;
let dragging = false;
let activePlaylistId = '';
let playlistAddTargetId = '';
let playlistDialogTrack = null;
let playlists = [];
let playlistToken = '';
let playlistTokenExpiresAt = 0;
let playlistAuthPromise = null;
let playlistSaveChain = Promise.resolve();
let playlistMutationRevision = 0;
const playlistCoverDataLimit = 18000;
const playlistCoverFileLimit = 8 * 1024 * 1024;
const playlistAccentCache = new Map();

let queue = [];
let qindex = -1;
let playbackmode = 'preview';
let octaveplayer = null;
let octaveplaying = false;
let octaverequest = 0;
let octaveprogress = null;
let octaveapipromise = null;
let octavepending = false;
let octavevideo = null;
const nyxtubedirectapi = window.NyxTubePlayerCore.createDirectYoutubeApi({ optimisticState: false });

let shuffleon = localStorage.getItem('nyx_nyxify_shuffle') === '1';
let repeatmode = localStorage.getItem('nyx_nyxify_repeat') || 'off';
let playershown = false;
let queueopen = false;

const coverFallback = '/assets/icons/shortcut-nyxify.svg?v=3';

document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || image.dataset.coverFallback === '1') return;
  image.dataset.coverFallback = '1';
  image.classList.add('cover-fallback');
  image.src = coverFallback;
}, true);

function setcover(image, source, alt = '') {
  if (!image) return;
  delete image.dataset.coverFallback;
  image.classList.remove('cover-fallback');
  image.alt = alt;
  image.src = source || coverFallback;
}

function fmt(s) {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

async function nyxifyjson(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const text = await response.text();
  let payload = null;
  if (text && (contentType.includes('application/json') || /^[\s\r\n]*[\[{]/.test(text))) {
    try { payload = JSON.parse(text); } catch (_) {}
  }
  if (!response.ok) {
    throw new Error(payload?.error || `Nyxify is temporarily unavailable (${response.status}).`);
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Nyxify received a web page instead of music data. Reload Nyx and try again.');
  }
  return payload;
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

function normalizedplaylistcover(value) {
  const cover = String(value || '').replace(/\s/g, '');
  return /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(cover) && cover.length <= playlistCoverDataLimit ? cover : '';
}

function normalizedplaylistaccent(value) {
  const accent = String(value || '').trim();
  return validhex(accent) ? accent.toLowerCase() : '';
}

function localplaylists() {
  try {
    const stored = JSON.parse(localStorage.getItem('nyx_nyxify_playlists') || '[]');
    return Array.isArray(stored) ? stored.slice(0, 16).map(item => ({
      id: /^[A-Za-z0-9_-]{8,64}$/.test(String(item?.id || '')) ? String(item.id) : `playlist_${crypto.randomUUID().replace(/-/g, '')}`,
      name: String(item?.name || 'Playlist').trim().slice(0, 48) || 'Playlist',
      cover: normalizedplaylistcover(item?.cover),
      accent: normalizedplaylistaccent(item?.accent),
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
    const config = await nyxifyjson('/api/founder-profile/auth-config');
    if (!config?.enabled) return null;
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

function groups(type, source = results) {
  const seen = new Map();
  for (const t of source) {
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

function buildrow(t, list, options = {}) {
  const row = document.createElement('div');
  row.className = 'row' + (curtrack && curtrack.id === t.id ? ' playing' : '');
  row.dataset.id = t.id;

  const liked = isliked(t.id);
  const addTarget = playlistAddTargetId ? playlists.find(item => item.id === playlistAddTargetId) : null;
  const alreadyAdded = !!addTarget?.tracks.some(item => item.id === t.id);
  const playlistAction = options.playlistId
    ? `<span class="playlist-track-actions"><button type="button" class="playlist-track-action playlist-track-seed" aria-label="Create a new playlist from ${esc(t.title)}" title="Create a new playlist from this song"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 .9 3.1L16 7l-3.1.9L12 11l-.9-3.1L8 7l3.1-.9L12 3Zm6 8 .7 2.3L21 14l-2.3.7L18 17l-.7-2.3L15 14l2.3-.7L18 11ZM8 11l1.4 4.6L14 17l-4.6 1.4L8 23l-1.4-4.6L2 17l4.6-1.4L8 11Z"></path></svg></button><button type="button" class="playlist-track-action playlist-track-shuffle" aria-label="Shuffle ${esc(options.playlistName || 'this playlist')}" title="Shuffle this playlist"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h2.2c4.8 0 6.7 10 11.6 10H20M17 14l3 3-3 3M4 17h2.2c1.8 0 3.2-1.4 4.5-3.2M14.2 9.4c1-1.4 2.1-2.4 3.6-2.4H20M17 4l3 3-3 3"></path></svg></button><button type="button" class="playlist-track-action playlist-track-remove" aria-label="Remove ${esc(t.title)} from playlist">&times;</button></span>`
    : addTarget
      ? `<button type="button" class="playlist-track-action playlist-track-add${alreadyAdded ? ' added' : ''}" aria-label="${alreadyAdded ? 'Already in playlist' : `Add ${esc(t.title)} to playlist`}" ${alreadyAdded ? 'disabled' : ''}>${alreadyAdded ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8.5 12.5 2.2 2.2 4.8-5.2"></path></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v8M8 12h8"></path></svg>'}</button>`
      : '';
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
    ${playlistAction}
    <button type="button" class="like-btn${liked ? ' liked' : ''}" aria-pressed="${liked}" aria-label="${liked ? 'unlike' : 'like'}">
      <i class="${liked ? 'mingcute--heart-fill' : 'ic-heart'}"></i>
    </button>`;

  makeclickable(row, `play ${t.title} by ${t.artist}`, () => playtrack(t, list));

  row.addEventListener('click', e => {
    if (e.target.closest('.like-btn, .playlist-track-action')) return;
    if (e.target.closest('.alink') && !playlistAddTargetId) {
      e.stopPropagation();
      if (t.artistId) opendetail('artist', t.artistId, t.artist);
      return;
    }
    playtrack(t, list);
  });

  row.querySelector('.playlist-track-add')?.addEventListener('click', event => {
    event.stopPropagation();
    if (!playlistAddTargetId || !addtoplaylist(playlistAddTargetId, t)) return;
    event.currentTarget.classList.add('added');
    event.currentTarget.disabled = true;
    event.currentTarget.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8.5 12.5 2.2 2.2 4.8-5.2"></path></svg>';
    event.currentTarget.setAttribute('aria-label', 'Already in playlist');
  });
  row.querySelector('.playlist-track-remove')?.addEventListener('click', event => {
    event.stopPropagation();
    removefromplaylist(options.playlistId, t.id);
  });
  row.querySelector('.playlist-track-seed')?.addEventListener('click', event => {
    event.stopPropagation();
    void createplaylistfromtrack(t, event.currentTarget);
  });
  row.querySelector('.playlist-track-shuffle')?.addEventListener('click', event => {
    event.stopPropagation();
    shuffleplaylist(options.playlistId);
  });

  bindheart(row.querySelector('.like-btn'), t);
  return row;
}

function buildcard(g, type) {
  const card = document.createElement('div');
  card.className = 'card';
  const meta = g.artist
    ? g.artist
    : Number(g.count) > 0
      ? `${g.count} ${g.count === 1 ? 'track' : 'tracks'}`
      : Number(g.position) > 0
        ? `#${g.position} this week`
        : type === 'artist' ? 'Popular artist' : 'Popular album';
  card.innerHTML = `
    <div class="card-art">
      <img src="${esc(g.cover)}" alt="" loading="lazy">
      <button type="button" class="card-play" aria-label="play ${esc(g.key)}"><i class="line-md--play-filled"></i></button>
    </div>
    <span class="c-name">${esc(g.key)}</span>
    <span class="c-count">${esc(meta)}</span>`;

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

function renderrowsinto(container, list, options = {}) {
  container.innerHTML = '';
  container.style.display = list.length ? '' : 'none';
  list.forEach(t => container.appendChild(buildrow(t, list, options)));
}

function showrows(list) {
  hideviews();
  crumbEl.style.display = 'none';
  renderrowsinto(trackList, list);
}

function showcards(type, source = groups(type)) {
  hideviews();
  crumbEl.style.display = 'none';

  const list = source;
  cardGrid.innerHTML = '';
  cardGrid.style.display = list.length ? '' : 'none';
  list.forEach(g => cardGrid.appendChild(buildcard(g, type)));

  if (!list.length) {
    showempty(`No ${type}s yet`, 'Results will appear here after you search.');
  }
}

function homesection(title, subtitle, content, className = '') {
  const section = document.createElement('section');
  section.className = `home-section ${className}`.trim();
  const heading = document.createElement('div');
  heading.className = 'home-section-head';
  const copy = document.createElement('div');
  const name = document.createElement('h2');
  name.textContent = title;
  const detailText = document.createElement('p');
  detailText.textContent = subtitle;
  copy.append(name, detailText);
  heading.appendChild(copy);
  section.append(heading, content);
  return section;
}

function showhomechart() {
  hideviews();
  crumbEl.style.display = 'none';
  detailView.innerHTML = '';

  const tracks = document.createElement('div');
  tracks.className = 'home-track-list';
  renderrowsinto(tracks, homeData.tracks.slice(0, 12));
  detailView.appendChild(homesection('Popular tracks this week', 'What people are playing right now.', tracks, 'home-tracks'));

  const artists = document.createElement('div');
  artists.className = 'cards home-cards';
  homeData.artists.slice(0, 8).forEach(item => artists.appendChild(buildcard(item, 'artist')));
  detailView.appendChild(homesection('Popular artists', 'Artists trending across the current chart.', artists));

  const albums = document.createElement('div');
  albums.className = 'cards home-cards';
  homeData.albums.slice(0, 8).forEach(item => albums.appendChild(buildcard(item, 'album')));
  detailView.appendChild(homesection('Popular albums', 'Albums listeners are coming back to this week.', albums));
  detailView.style.display = '';
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
    const data = await nyxifyjson(`/api/nyxify/${type}/${id}`);
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
  rendersidebarplaylists();
  if (activePlaylistId) return renderplaylistview();
  if (playlistAddTargetId) return renderplaylistaddview();
  if (detail) return detail.data ? renderdetail() : showloading(detail.name);
  if (query) {
    if (!results.length) return showempty('No results', `Nothing matched "${query}".`);
    if (mode === 'home') return showeverythinghome();
    if (mode === 'artists') return showcards('artist');
    if (mode === 'albums') return showcards('album');
    return showrows(results);
  }
  if (homeLoading) return showloading();
  if (homeError && !homeData.tracks.length) return showempty('Home is unavailable', homeError, true);
  if (mode === 'home') return showhomechart();
  if (mode === 'artists') return showcards('artist', homeData.artists);
  if (mode === 'albums') return showcards('album', homeData.albums);
  if (homeData.tracks.length) return showrows(homeData.tracks);
  showempty('Nothing is charting yet', 'Try searching for a song, artist, or album.');
}

crumbEl.addEventListener('click', () => {
  if (playlistAddTargetId) {
    const playlistId = playlistAddTargetId;
    playlistAddTargetId = '';
    return openplaylist(playlistId);
  }
  detail = null;
  activePlaylistId = '';
  rendermain();
});

document.querySelectorAll('.filter').forEach(btn => {
  btn.addEventListener('click', () => {
    playlistAddTargetId = '';
    detail = null;
    activePlaylistId = '';
    setfilter(btn.dataset.filter);
    if (btn.dataset.filter === 'home') {
      query = '';
      results = [];
      searchInput.value = '';
    }
    rendermain();
  });
});

async function loadhome() {
  homeLoading = true;
  homeError = '';
  if (!query && !activePlaylistId && !detail) rendermain();
  try {
    const payload = await nyxifyjson('/api/nyxify/home');
    homeData = {
      tracks: Array.isArray(payload.tracks) ? payload.tracks : [],
      artists: Array.isArray(payload.artists) ? payload.artists : [],
      albums: Array.isArray(payload.albums) ? payload.albums : []
    };
  } catch (error) {
    homeError = error.message || 'The weekly chart could not load.';
  } finally {
    homeLoading = false;
    if (!query && !activePlaylistId && !detail && !playlistAddTargetId) rendermain();
  }
}

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

function playlistcoverelement(playlist, compact = false) {
  const cover = document.createElement('span');
  cover.className = `playlist-cover${compact ? ' compact' : ''}`;
  const artwork = playlist?.cover ? [playlist.cover] : [];
  if (!artwork.length) {
    for (const track of playlist?.tracks || []) {
      if (!track.cover || artwork.includes(track.cover)) continue;
      artwork.push(track.cover);
      if (artwork.length === 4) break;
    }
  }
  cover.dataset.count = String(artwork.length);
  if (!artwork.length) {
    const icon = document.createElement('i');
    icon.className = 'mingcute--music-line';
    cover.appendChild(icon);
    return cover;
  }
  artwork.forEach(src => {
    const image = document.createElement('img');
    image.src = src;
    image.alt = '';
    image.loading = 'lazy';
    cover.appendChild(image);
  });
  return cover;
}

function playlistaccentstyle(node, accent) {
  if (!node || !validhex(accent)) return;
  const channels = hexrgb(accent);
  const luminance = channels[0] * .299 + channels[1] * .587 + channels[2] * .114;
  node.style.setProperty('--playlist-cover-rgb', channels.join(', '));
  node.style.setProperty('--playlist-cover-ink', luminance > 158 ? '#06070a' : '#f7f8fb');
}

function playlistedgeaccent(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const pixels = context.getImageData(0, 0, width, height).data;
  const edgeX = Math.max(1, Math.round(width * .16));
  const edgeY = Math.max(1, Math.round(height * .16));
  const buckets = new Map();
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (x >= edgeX && x < width - edgeX && y >= edgeY && y < height - edgeY) continue;
      const index = (y * width + x) * 4;
      if (pixels[index + 3] < 180) continue;
      const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const saturation = max ? (max - min) / max : 0;
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const bucket = buckets.get(key) || { count: 0, score: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.score += .7 + saturation * .7;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }
  const selected = [...buckets.values()].sort((a, b) => b.score - a.score)[0];
  if (!selected) return '#777b86';
  let channels = [selected.r, selected.g, selected.b].map(value => Math.round(value / selected.count));
  const brightness = channels[0] * .299 + channels[1] * .587 + channels[2] * .114;
  if (brightness < 42) channels = channels.map(value => Math.round(value + (255 - value) * .22));
  if (brightness > 225) channels = channels.map(value => Math.round(value * .82));
  return `#${channels.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function playlistimageload(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That image could not be opened.'));
    image.src = source;
  });
}

function playlistfiledata(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

async function prepareplaylistcover(file) {
  if (!file || !new Set(['image/jpeg', 'image/png', 'image/webp']).has(file.type)) throw new Error('Choose a PNG, JPG, or WebP image.');
  if (file.size > playlistCoverFileLimit) throw new Error('Playlist covers must be 8 MB or smaller.');
  const source = await playlistfiledata(file);
  const image = await playlistimageload(source);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  if (!side) throw new Error('That image has no usable pixels.');
  const sourceX = (image.naturalWidth - side) / 2;
  const sourceY = (image.naturalHeight - side) / 2;
  const sample = document.createElement('canvas');
  sample.width = 128;
  sample.height = 128;
  sample.getContext('2d', { alpha: false }).drawImage(image, sourceX, sourceY, side, side, 0, 0, 128, 128);
  const accent = playlistedgeaccent(sample);
  const attempts = [[320, .82], [288, .74], [256, .66], [224, .58], [192, .52], [160, .46], [128, .42]];
  for (const [size, quality] of attempts) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.getContext('2d', { alpha: false }).drawImage(image, sourceX, sourceY, side, side, 0, 0, size, size);
    const cover = canvas.toDataURL('image/webp', quality);
    if (cover.length <= playlistCoverDataLimit) return { cover, accent };
  }
  throw new Error('That image could not be compressed enough. Try a simpler image.');
}

async function playlistaccentfromsource(source) {
  if (!source) return '';
  if (!playlistAccentCache.has(source)) {
    playlistAccentCache.set(source, (async () => {
      try {
        const image = await playlistimageload(source);
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        canvas.getContext('2d', { alpha: false }).drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 64, 64);
        return playlistedgeaccent(canvas);
      } catch (_) {
        return '';
      }
    })());
  }
  return playlistAccentCache.get(source);
}

function playlistcovereditor(playlist) {
  const editor = document.createElement('div');
  editor.className = 'playlist-cover-editor';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'playlist-cover-change';
  button.setAttribute('aria-label', `Change cover for ${playlist.name}`);
  button.appendChild(playlistcoverelement(playlist));
  const prompt = document.createElement('span');
  prompt.className = 'playlist-cover-prompt';
  prompt.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 6.5 9.5 4h5l1.3 2.5H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h3.2Z"></path><circle cx="12" cy="13" r="3.5"></circle></svg><span>Change cover</span>';
  button.appendChild(prompt);
  const input = document.createElement('input');
  input.className = 'playlist-cover-input';
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/webp';
  input.hidden = true;
  button.addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const status = detailView.querySelector('.playlist-cover-status');
    button.disabled = true;
    if (status) status.textContent = 'Preparing cover…';
    try {
      const prepared = await prepareplaylistcover(file);
      playlist.cover = prepared.cover;
      playlist.accent = prepared.accent;
      const save = await persistplaylists({ verifyCover: { id: playlist.id, cover: prepared.cover } });
      renderplaylistview();
      const updatedStatus = detailView.querySelector('.playlist-cover-status');
      if (updatedStatus) {
        if (save.synced) updatedStatus.textContent = 'Cover synced to your account.';
        else if (save.error) updatedStatus.textContent = `Cover saved on this device. ${save.error.message}`;
        else updatedStatus.textContent = 'Cover saved on this device. Sign in to sync it.';
      }
    } catch (error) {
      button.disabled = false;
      if (status) status.textContent = error.message;
    } finally {
      input.value = '';
    }
  });
  editor.append(button, input);
  if (validhex(playlist.accent)) playlistaccentstyle(editor, playlist.accent);
  return editor;
}

function rendersidebarplaylists() {
  sidebarPlaylistList.innerHTML = '';
  if (!playlists.length) {
    const empty = document.createElement('span');
    empty.className = 'sidebar-playlist-empty';
    empty.textContent = 'No playlists yet';
    sidebarPlaylistList.appendChild(empty);
    return;
  }
  playlists.forEach(playlist => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sidebar-playlist';
    button.classList.toggle('active', activePlaylistId === playlist.id);
    const label = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = playlist.name;
    const count = document.createElement('small');
    count.textContent = `${playlist.tracks.length} songs`;
    label.append(name, count);
    button.append(playlistcoverelement(playlist, true), label);
    button.addEventListener('click', () => openplaylist(playlist.id));
    sidebarPlaylistList.appendChild(button);
  });
}

function renderplaylists() {
  playlistList.innerHTML = '';
  rendersidebarplaylists();
  rendernowplaying();
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
    if (validhex(playlist.accent)) playlistaccentstyle(entry, playlist.accent);
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'playlist-open';
    const meta = document.createElement('span');
    meta.className = 'playlist-open-meta';
    const name = document.createElement('strong');
    name.textContent = playlist.name;
    const count = document.createElement('small');
    count.textContent = `${playlist.tracks.length} ${playlist.tracks.length === 1 ? 'track' : 'tracks'}`;
    meta.append(name, count);
    open.append(playlistcoverelement(playlist, true), meta);
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
      if (playlistAddTargetId === playlist.id) playlistAddTargetId = '';
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
  playlistAddTargetId = '';
  detail = null;
  rendersidebarplaylists();
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
  crumbText.textContent = 'Playlists';

  detailView.innerHTML = '';
  const hero = document.createElement('section');
  hero.className = 'playlist-hero';
  const savedAccent = normalizedplaylistaccent(playlist.accent);
  if (savedAccent) playlistaccentstyle(hero, savedAccent);
  else {
    const source = playlist.cover || playlist.tracks.find(track => track.cover)?.cover || '';
    void playlistaccentfromsource(source).then(accent => {
      if (hero.isConnected && accent) playlistaccentstyle(hero, accent);
    });
  }
  const info = document.createElement('div');
  info.className = 'playlist-hero-info';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'playlist-eyebrow';
  eyebrow.textContent = 'Playlist';
  const title = document.createElement('h2');
  title.textContent = playlist.name;
  const summary = document.createElement('p');
  summary.textContent = `${playlist.tracks.length} ${playlist.tracks.length === 1 ? 'song' : 'songs'} · Nyxify/built in music`;
  const actions = document.createElement('div');
  actions.className = 'playlist-hero-actions';
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'playlist-play-all';
  play.disabled = !playlist.tracks.length;
  play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.8v12.4L18 12Z"></path></svg><span>Play</span>';
  play.addEventListener('click', () => {
    if (playlist.tracks.length) playtrack(playlist.tracks[0], playlist.tracks);
  });
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'playlist-add-songs';
  add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 8v8M8 12h8"></path></svg><span>Add songs</span>';
  add.addEventListener('click', () => startplaylistadd(playlist.id));
  actions.append(play, add);
  if (playlist.cover) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'playlist-reset-cover';
    reset.textContent = 'Use song covers';
    reset.addEventListener('click', async () => {
      playlist.cover = '';
      playlist.accent = '';
      await persistplaylists();
      renderplaylistview();
    });
    actions.appendChild(reset);
  }
  const coverStatus = document.createElement('span');
  coverStatus.className = 'playlist-cover-status';
  coverStatus.setAttribute('role', 'status');
  info.append(eyebrow, title, summary, actions, coverStatus);
  hero.append(playlistcovereditor(playlist), info);
  detailView.appendChild(hero);

  if (!playlist.tracks.length) {
    const empty = document.createElement('section');
    empty.className = 'playlist-empty';
    empty.innerHTML = '<strong>Your playlist is empty</strong><span>Use Add songs to find music for it.</span>';
    detailView.appendChild(empty);
  } else {
    const seedHint = document.createElement('div');
    seedHint.className = 'playlist-seed-hint';
    seedHint.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 .9 3.1L16 7l-3.1.9L12 11l-.9-3.1L8 7l3.1-.9L12 3Zm6 8 .7 2.3L21 14l-2.3.7L18 17l-.7-2.3L15 14l2.3-.7L18 11ZM8 11l1.4 4.6L14 17l-4.6 1.4L8 23l-1.4-4.6L2 17l4.6-1.4L8 11Z"></path></svg><span>Sparkle creates a separate playlist from a song. Shuffle randomizes this playlist for playback.</span>';
    detailView.appendChild(seedHint);
    const list = document.createElement('div');
    list.className = 'playlist-track-list';
    renderrowsinto(list, playlist.tracks, { playlistId: playlist.id, playlistName: playlist.name });
    detailView.appendChild(list);
  }
  detailView.style.display = '';
}

function startplaylistadd(id) {
  const playlist = playlists.find(item => item.id === id);
  if (!playlist) return;
  playlistAddTargetId = id;
  activePlaylistId = '';
  detail = null;
  query = '';
  results = [];
  searchInput.value = '';
  renderplaylistaddview();
  searchInput.focus();
}

function renderplaylistaddview() {
  const playlist = playlists.find(item => item.id === playlistAddTargetId);
  if (!playlist) {
    playlistAddTargetId = '';
    return rendermain();
  }
  hideviews();
  crumbEl.style.display = '';
  crumbText.textContent = `Back to ${playlist.name}`;
  detailView.innerHTML = '';
  const heading = document.createElement('section');
  heading.className = 'playlist-add-heading';
  const copy = document.createElement('div');
  copy.innerHTML = `<span>Add to playlist</span><strong>${esc(playlist.name)}</strong><small>Search above, then use + beside any song.</small>`;
  heading.append(playlistcoverelement(playlist, true), copy);
  detailView.appendChild(heading);
  if (!results.length) {
    const empty = document.createElement('section');
    empty.className = 'playlist-empty compact';
    empty.innerHTML = `<strong>${query ? 'No songs found' : 'Find songs for this playlist'}</strong><span>${query ? `Nothing matched “${esc(query)}”.` : 'Type a song or artist into the search bar.'}</span>`;
    detailView.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'playlist-track-list playlist-add-results';
    renderrowsinto(list, results);
    detailView.appendChild(list);
  }
  detailView.style.display = '';
}

async function persistplaylists(options = {}) {
  const revision = ++playlistMutationRevision;
  const snapshot = JSON.parse(JSON.stringify(playlists));
  saveplaylistlocal();
  renderplaylists();
  renderplaylistchoices();
  const save = async () => {
    const payload = await playlistrequest('/api/nyxify/playlists', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlists: snapshot })
    });
    if (!payload) return { synced: false, reason: 'signed-out' };
    if (options.verifyCover) {
      const expected = normalizedplaylistcover(options.verifyCover.cover);
      const saved = (Array.isArray(payload.playlists) ? payload.playlists : []).find(item => item?.id === options.verifyCover.id);
      if (!expected || normalizedplaylistcover(saved?.cover) !== expected) {
        throw new Error('Account sync did not retain the custom cover. Try it again.');
      }
    }
    return { synced: true, payload };
  };
  const pending = playlistSaveChain.then(save, save);
  playlistSaveChain = pending.catch(() => {});
  try {
    const result = await pending;
    if (revision === playlistMutationRevision) playlistSync.textContent = result.synced ? 'Synced to your account' : 'Saved on this device';
    return result;
  } catch (error) {
    if (revision === playlistMutationRevision) playlistSync.textContent = 'Saved locally · account sync unavailable';
    playlistMessage.textContent = error.message || 'Account sync is unavailable.';
    return { synced: false, reason: 'error', error };
  }
}

function addtoplaylist(id, track) {
  const playlist = playlists.find(item => item.id === id);
  if (!playlist || !track) return false;
  if (playlist.tracks.some(item => item.id === track.id)) {
    playlistMessage.textContent = `Already in ${playlist.name}.`;
    return false;
  }
  if (playlist.tracks.length >= 150) {
    playlistMessage.textContent = 'This playlist has reached 150 tracks.';
    return false;
  }
  playlist.tracks.push(playlisttrack(track));
  playlistMessage.textContent = `Added to ${playlist.name}.`;
  void persistplaylists();
  return true;
}

function removefromplaylist(id, trackId) {
  const playlist = playlists.find(item => item.id === id);
  if (!playlist) return;
  const next = playlist.tracks.filter(track => track.id !== trackId);
  if (next.length === playlist.tracks.length) return;
  playlist.tracks = next;
  playlistMessage.textContent = `Removed from ${playlist.name}.`;
  void persistplaylists();
  renderplaylistview();
}

function generatedplaylistname(seed) {
  const rawBase = `${String(seed?.title || 'Song').trim() || 'Song'} Mix`;
  const taken = new Set(playlists.map(playlist => playlist.name.toLowerCase()));
  for (let number = 1; number <= playlists.length + 2; number++) {
    const suffix = number === 1 ? '' : ` ${number}`;
    const candidate = `${rawBase.slice(0, 48 - suffix.length).trim()}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `New Mix ${Date.now().toString(36).slice(-5)}`;
}

function shuffleplaylist(id) {
  const playlist = playlists.find(item => item.id === id);
  if (!playlist?.tracks.length) return;
  const shuffled = playlist.tracks.map(playlisttrack);
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  playtrack(shuffled[0], shuffled);
  playlistMessage.textContent = `Shuffling ${playlist.name}.`;
}

async function createplaylistfromtrack(seed, button) {
  if (!seed || button?.disabled) return;
  if (playlists.length >= 16) {
    playlistMessage.textContent = 'You can have up to 16 playlists.';
    return;
  }
  const usedTracks = playlists.reduce((total, playlist) => total + playlist.tracks.length, 0);
  const remainingLibraryTracks = Math.max(0, 1200 - usedTracks);
  if (!remainingLibraryTracks) {
    playlistMessage.textContent = 'Your playlist library has reached its track limit.';
    return;
  }
  if (button) button.disabled = true;
  playlistMessage.textContent = `Creating a new playlist from ${seed.title}…`;
  let matches = [];
  let searchFailed = false;
  try {
    const searchSeed = String(seed.artist || seed.title || '').trim();
    if (!searchSeed) throw new Error('This song does not have enough catalog information.');
    const payload = await nyxifyjson(`/api/nyxify/search?q=${encodeURIComponent(searchSeed)}`);
    matches = Array.isArray(payload.data) ? payload.data : [];
  } catch (_) {
    searchFailed = true;
  }
  try {
    const seen = new Set([String(seed.id)]);
    const room = Math.max(0, Math.min(17, remainingLibraryTracks - 1));
    const additions = matches.filter(track => {
      const id = String(track?.id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).slice(0, room).map(playlisttrack);
    const playlist = {
      id: playlistid(),
      name: generatedplaylistname(seed),
      cover: '',
      accent: await playlistaccentfromsource(seed.cover),
      tracks: [playlisttrack(seed), ...additions]
    };
    playlists.push(playlist);
    await persistplaylists();
    openplaylist(playlist.id);
    playlistMessage.textContent = searchFailed
      ? `Created ${playlist.name} with ${seed.title}; more matches were unavailable.`
      : `Created ${playlist.name} with ${playlist.tracks.length} ${playlist.tracks.length === 1 ? 'song' : 'songs'}.`;
  } catch (error) {
    playlistMessage.textContent = `Could not create the playlist: ${error.message}`;
    if (button?.isConnected) button.disabled = false;
  }
}

async function loadplaylists() {
  playlists = localplaylists();
  renderplaylists();
  const loadRevision = playlistMutationRevision;
  try {
    const payload = await playlistrequest('/api/nyxify/playlists');
    if (!payload) {
      playlistSync.textContent = 'Saved on this device';
      return;
    }
    if (playlistMutationRevision !== loadRevision) {
      await playlistSaveChain;
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
document.getElementById('sidebarNewPlaylist').addEventListener('click', () => openplaylistdialog());
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
  const playlist = { id: playlistid(), name, cover: '', accent: '', tracks: playlistDialogTrack ? [playlisttrack(playlistDialogTrack)] : [] };
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
    const data = await nyxifyjson(`/api/nyxify/search?q=${encodeURIComponent(q)}`);
    query = q;
    results = data.data || [];
    detail = null;
    activePlaylistId = '';
    setfilter('home');
    rendermain();
  } catch (err) {
    if (playlistAddTargetId) {
      query = q;
      results = [];
      renderplaylistaddview();
      playlistMessage.textContent = `Search failed: ${err.message}`;
    } else {
      showempty('Search failed', err.message, true);
    }
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

function inferplaycontext(list) {
  const activePlaylist = playlists.find(item => item.id === activePlaylistId) || playlists.find(item => item.tracks === list);
  if (activePlaylist) return `Playlist · ${activePlaylist.name}`;
  if (detail?.name) return `${detail.type === 'artist' ? 'Artist' : 'Album'} · ${detail.name}`;
  if (query) return `Search · ${query}`;
  if (list === homeData.tracks || (Array.isArray(list) && list.length && list.every(item => homeData.tracks.some(track => track.id === item.id)))) return 'Popular this week';
  return 'Nyxify';
}

function rendernowplaying() {
  nowPlayingModule.hidden = !curtrack;
  if (!curtrack) return;
  setcover(nowPlayingArt, curtrack.cover, `${curtrack.title} cover`);
  nowPlayingContext.textContent = playbackContext || 'Nyxify';
  nowPlayingTitle.textContent = curtrack.title;
  nowPlayingArtist.textContent = curtrack.artist || 'Unknown artist';
  nowPlayingArtist.disabled = !curtrack.artistId;
  nowPlayingArtist.onclick = () => {
    if (curtrack?.artistId) opendetail('artist', curtrack.artistId, curtrack.artist);
  };
  nowPlayingAlbum.hidden = !curtrack.album;
  nowPlayingAlbum.textContent = curtrack.album || '';
  nowPlayingAlbum.disabled = !curtrack.albumId;
  nowPlayingAlbum.onclick = () => {
    if (curtrack?.albumId) opendetail('album', curtrack.albumId, curtrack.album);
  };

  const memberships = playlists.filter(playlist => playlist.tracks.some(track => track.id === curtrack.id));
  nowPlayingPlaylists.innerHTML = '';
  if (memberships.length) {
    const label = document.createElement('span');
    label.textContent = 'In your playlists';
    nowPlayingPlaylists.appendChild(label);
    memberships.forEach(playlist => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = playlist.name;
      button.addEventListener('click', () => openplaylist(playlist.id));
      nowPlayingPlaylists.appendChild(button);
    });
  }

  const next = queue[qindex + 1];
  nowPlayingNext.innerHTML = '';
  if (next) {
    const label = document.createElement('span');
    label.textContent = 'Next in queue';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${next.title} · ${next.artist}`;
    button.addEventListener('click', () => playat(qindex + 1));
    nowPlayingNext.append(label, button);
  }
}

function ensureoctaveframe() {
  let frame = document.getElementById('fullTrackFrame');
  if (!frame || frame.tagName === 'IFRAME') {
    const replacement = document.createElement('div');
    replacement.id = 'fullTrackFrame';
    if (frame) frame.replaceWith(replacement);
    else fullTrackStage.appendChild(replacement);
    frame = replacement;
  }
  return frame;
}

function ensureoctaveapi() {
  if (/\bCrOS\b/i.test(navigator.userAgent)) return Promise.resolve(nyxtubedirectapi);
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (octaveapipromise) return octaveapipromise;
  octaveapipromise = new Promise(resolve => {
    const previous = window.onYouTubeIframeAPIReady;
    let settled = false;
    const finish = api => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(api);
    };
    const timer = setTimeout(() => finish(nyxtubedirectapi), 5_000);
    window.onYouTubeIframeAPIReady = () => {
      try { previous?.(); } catch (_) {}
      finish(window.YT?.Player ? window.YT : nyxtubedirectapi);
    };
    let script = document.querySelector('script[data-nyx-octave-player]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.nyxOctavePlayer = '1';
      script.addEventListener('error', () => finish(nyxtubedirectapi), { once: true });
      document.head.appendChild(script);
    }
  });
  return octaveapipromise;
}

function stopoctaveprogress() {
  if (octaveprogress != null) clearInterval(octaveprogress);
  octaveprogress = null;
}

function startoctaveprogress() {
  stopoctaveprogress();
  octaveprogress = setInterval(() => {
    if (playbackmode !== 'octave' || dragging || !octaveplayer) return;
    const current = Number(octaveplayer.getCurrentTime?.()) || 0;
    const duration = Number(octaveplayer.getDuration?.()) || Number(curtrack?.duration) || 0;
    if (duration) document.getElementById('timeTotal').textContent = fmt(duration);
    updateseek(current);
    syncmediapos();
  }, 500);
}

function destroyoctaveplayer() {
  stopoctaveprogress();
  try { octaveplayer?.stopVideo?.(); } catch (_) {}
  try { octaveplayer?.destroy?.(); } catch (_) {}
  octaveplayer = null;
  octaveplaying = false;
  octavepending = false;
  ensureoctaveframe();
  fullTrackStage.hidden = true;
  fullTrackStage.dataset.playbackState = 'idle';
}

function previewsource() {
  return curtrack ? `/api/nyxify/stream/${curtrack.id}` : '';
}

function setoctavevideo(candidate = null) {
  octavevideo = candidate && /^[A-Za-z0-9_-]{11}$/.test(String(candidate.videoId || '')) ? candidate : null;
  fullTrackVideo.disabled = !octavevideo;
  fullTrackVideo.textContent = 'Show video';
  fullTrackVideo.setAttribute('aria-label', octavevideo ? 'Show music video in NyxTube' : 'Music video unavailable');
  fullTrackVideo.setAttribute('aria-pressed', 'false');
}

function usepreview(autoplay = true, message = '') {
  octaverequest += 1;
  destroyoctaveplayer();
  playbackmode = 'preview';
  dlBtn.hidden = false;
  const source = previewsource();
  if (source && new URL(audio.currentSrc || audio.src || source, location.href).pathname !== source) audio.src = source;
  if (message) console.warn(message);
  if (autoplay && source) audio.play().catch(() => {});
}

function octaveerror(message) {
  if (fullTrackStatus) fullTrackStatus.textContent = message;
  usepreview(true, message);
}

async function startoctavetrack(track, request) {
  fullTrackStage.hidden = false;
  fullTrackStage.dataset.playbackState = 'loading';
  delete fullTrackStage.dataset.lastError;
  fullTrackTitle.textContent = track.title || 'Full track';
  fullTrackStatus.textContent = 'Finding the full song...';
  setoctavevideo();
  try {
    const match = await nyxifyjson(`/api/nyxify/full-track/${encodeURIComponent(track.id)}`);
    if (request !== octaverequest || curtrack?.id !== track.id) return;
    if (match.mode !== 'octave' || !/^[A-Za-z0-9_-]{11}$/.test(String(match.videoId || ''))) {
      throw new Error('No playable full song was found.');
    }
    const octaveCandidates = (Array.isArray(match.candidates) ? match.candidates : [match])
      .filter(candidate => /^[A-Za-z0-9_-]{11}$/.test(String(candidate?.videoId || '')))
      .slice(0, 8);
    if (!octaveCandidates.length) throw new Error('No playable full song was found.');
    let octaveCandidateIndex = 0;
    setoctavevideo(octaveCandidates[0]);
    fullTrackTitle.textContent = octaveCandidates[0].title || match.title || track.title;
    const YT = await ensureoctaveapi();
    if (request !== octaverequest || curtrack?.id !== track.id) return;
    destroyoctaveplayer();
    fullTrackStage.hidden = false;
    fullTrackStage.dataset.playbackState = 'loading';
    fullTrackStatus.textContent = 'Loading full song...';
    ensureoctaveframe();
    octaveplayer = new YT.Player('fullTrackFrame', {
      width: '240',
      height: '240',
      videoId: octaveCandidates[0].videoId,
      host: 'https://www.youtube-nocookie.com',
      expectedDuration: Number(match.durationSeconds) || Number(track.duration) || 0,
      playerVars: {
        autoplay: 1,
        controls: 1,
        playsinline: 1,
        enablejsapi: 1,
        rel: 0,
        origin: location.origin
      },
      events: {
        onReady(event) {
          if (request !== octaverequest || curtrack?.id !== track.id) return;
          octavepending = true;
          const volume = Math.min(100, Math.max(0, Number(volBar.value) || 0));
          event.target.setVolume?.(volume);
          fullTrackStatus.textContent = audio.paused ? 'Full song ready - press play' : 'Starting full song...';
          event.target.playVideo?.();
          setTimeout(() => {
            if (request !== octaverequest || !octavepending || playbackmode === 'octave') return;
            fullTrackStage.dataset.playbackState = 'ready';
            fullTrackStatus.textContent = 'Full song ready - press play';
          }, 1_500);
          const duration = Number(event.target.getDuration?.()) || Number(match.durationSeconds) || Number(track.duration) || 0;
          if (duration) document.getElementById('timeTotal').textContent = fmt(duration);
        },
        onStateChange(event) {
          if (request !== octaverequest) return;
          const state = event.data;
          octaveplaying = state === YT.PlayerState.PLAYING;
          if (octaveplaying) {
            playbackmode = 'octave';
            octavepending = false;
            audio.pause();
            dlBtn.hidden = true;
            playIcon.className = 'material-symbols--pause-rounded';
            fullTrackStage.dataset.playbackState = 'playing';
            fullTrackStatus.textContent = 'Playing full song';
            startoctaveprogress();
          } else if (state === YT.PlayerState.PAUSED && playbackmode === 'octave') {
            playIcon.className = 'line-md--play-filled';
            fullTrackStage.dataset.playbackState = 'paused';
          } else if (state === YT.PlayerState.BUFFERING) {
            fullTrackStage.dataset.playbackState = 'buffering';
            fullTrackStatus.textContent = 'Buffering the full song...';
          } else if (state === YT.PlayerState.CUED || state === YT.PlayerState.PAUSED) {
            octavepending = true;
            fullTrackStage.dataset.playbackState = 'ready';
            fullTrackStatus.textContent = 'Full song ready - press play';
          } else if (state === YT.PlayerState.ENDED) {
            octaveplaying = false;
            if (repeatmode === 'one') {
              event.target.seekTo?.(0, true);
              event.target.playVideo?.();
            } else {
              advance(false);
            }
          }
        },
        onError(event) {
          if (request !== octaverequest) return;
          fullTrackStage.dataset.lastError = String(event.data ?? 'unknown');
          octaveCandidateIndex += 1;
          const next = octaveCandidates[octaveCandidateIndex];
          if (next) {
            setoctavevideo(next);
            fullTrackStage.dataset.playbackState = 'loading';
            fullTrackTitle.textContent = next.title || track.title;
            fullTrackStatus.textContent = 'Trying another full-song source...';
            event.target.loadVideoById?.(next.videoId);
            return;
          }
          octaveerror('No matching full song could be embedded. Playing the preview instead.');
        }
      }
    });
  } catch (error) {
    if (request === octaverequest && curtrack?.id === track.id) octaveerror(`${error.message} Playing the preview instead.`);
  }
}

function playbackpaused() {
  return playbackmode === 'octave' ? !octaveplaying : audio.paused;
}

function playbackplay() {
  if (playbackmode === 'octave' || octavepending) octaveplayer?.playVideo?.();
  else audio.play().catch(() => {});
}

function playbackpause() {
  if (playbackmode === 'octave') octaveplayer?.pauseVideo?.();
  else audio.pause();
}

function playbacktime() {
  return playbackmode === 'octave' ? Number(octaveplayer?.getCurrentTime?.()) || 0 : Number(audio.currentTime) || 0;
}

function playbackduration() {
  if (playbackmode === 'octave') return Number(octaveplayer?.getDuration?.()) || Number(curtrack?.duration) || 0;
  return isFinite(audio.duration) && audio.duration ? audio.duration : Number(curtrack?.duration) || 0;
}

function playbackseek(seconds) {
  if (playbackmode === 'octave') octaveplayer?.seekTo?.(seconds, true);
  else audio.currentTime = seconds;
}

fullTrackPreview.addEventListener('click', () => usepreview(true));
fullTrackVideo.addEventListener('click', () => {
  if (!octavevideo) return;
  const url = `/apps/nyxtube/?video=${encodeURIComponent(octavevideo.videoId)}`;
  if (parent !== window) parent.postMessage({ type: 'nyx:navigate', url }, location.origin);
  else location.href = url;
});
setoctavevideo();

function playtrack(t, list, context = '') {
  cancelqueuedseek();
  const nextContext = context || inferplaycontext(list);
  curtrack = t;
  queue = (list || results).slice();
  qindex = queue.findIndex(x => x.id === t.id);
  if (qindex === -1) { queue.unshift(t); qindex = 0; }
  playbackContext = nextContext;

  pushhistory(t);

  usepreview(false);
  const fullTrackRequest = octaverequest;
  audio.play().catch(() => {});
  void startoctavetrack(t, fullTrackRequest);

  setcover(document.getElementById('pArt'), t.cover, `${t.title} cover`);
  document.getElementById('pTitle').textContent = t.title;
  document.getElementById('pTitle').title = t.title;
  document.getElementById('pArtist').textContent = t.artist;
  document.getElementById('pArtist').title = t.artist;
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
  rendernowplaying();
  setplayershown(true);
}

function playat(i) {
  if (i >= 0 && i < queue.length) playtrack(queue[i], queue, playbackContext);
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
  if (playbacktime() > 3) { playbackseek(0); return; }
  if (qindex > 0) playat(qindex - 1);
  else playbackseek(0);
}

document.getElementById('nextBtn').addEventListener('click', () => advance(true));
document.getElementById('prevBtn').addEventListener('click', playprev);

audio.addEventListener('ended', () => {
  if (playbackmode !== 'preview') return;
  if (octavepending && octaveplayer) {
    playIcon.className = 'line-md--play-filled';
    fullTrackStage.dataset.playbackState = 'ready';
    fullTrackStatus.textContent = 'Full song ready - press play';
    return;
  }
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
    else if (homeData.tracks.length) playtrack(homeData.tracks[0], homeData.tracks, 'Popular this week');
    else if (getlikes().length) playtrack(getlikes()[0]);
    return;
  }
  if (octavepending || playbackpaused()) playbackplay(); else playbackpause();
});
audio.addEventListener('play', () => {
  if (playbackmode === 'preview') playIcon.className = 'material-symbols--pause-rounded';
});
audio.addEventListener('pause', () => {
  if (playbackmode === 'preview') playIcon.className = 'line-md--play-filled';
});

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
  rendernowplaying();
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
let queuedseek = null;
let seekapplytimer = null;

function knowndur() {
  return playbackduration();
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

audio.addEventListener('seeked', () => {
  if (!dragging) updateseek(audio.currentTime);
});

audio.addEventListener('timeupdate', () => {
  if (dragging || audio.seeking) return;
  updateseek(audio.currentTime);
});

function seekbartarget() {
  const value = Math.min(100, Math.max(0, Number.parseFloat(seekBar.value) || 0));
  let target = (value / 100) * knowndur();
  target = Math.max(target, 0);
  const duration = playbackduration();
  if (duration) target = Math.min(target, Math.max(duration - 0.25, 0));
  return target;
}

function applyseek(target) {
  if (!curtrack) return;
  if (playbackmode === 'octave') {
    playbackseek(target);
    pendingseek = null;
    return;
  }
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA && isFinite(audio.duration) && audio.duration) {
    try {
      audio.currentTime = target;
      pendingseek = null;
      return;
    } catch (_) {}
  }
  pendingseek = target;
}

function scheduleseek(target) {
  queuedseek = target;
  if (seekapplytimer != null) return;
  seekapplytimer = setTimeout(() => {
    seekapplytimer = null;
    const next = queuedseek;
    queuedseek = null;
    applyseek(next);
  }, 75);
}

function flushseek(target) {
  if (seekapplytimer != null) clearTimeout(seekapplytimer);
  seekapplytimer = null;
  queuedseek = null;
  applyseek(target);
}

function cancelqueuedseek() {
  if (seekapplytimer != null) clearTimeout(seekapplytimer);
  seekapplytimer = null;
  queuedseek = null;
  pendingseek = null;
  dragging = false;
  seekBar.classList.remove('dragging');
}

function beginseek() {
  dragging = true;
  seekBar.classList.add('dragging');
}

seekBar.addEventListener('pointerdown', beginseek);
seekBar.addEventListener('input', () => {
  beginseek();
  const sec = seekbartarget();
  seekBar.style.setProperty('--fill', seekBar.value + '%');
  timeCur.textContent = fmt(sec);
  scheduleseek(sec);
});

function commitseek() {
  seekBar.classList.remove('dragging');
  dragging = false;
  if (!curtrack) return;
  const target = seekbartarget();
  flushseek(target);
  updateseek(target);
}
seekBar.addEventListener('change', commitseek);
seekBar.addEventListener('pointerup', commitseek);
seekBar.addEventListener('pointercancel', commitseek);
seekBar.addEventListener('blur', commitseek);

function skipby(sec) {
  if (!curtrack) return;
  const dur = knowndur();
  const base = playbacktime();
  const t = Math.min(Math.max(base + sec, 0), Math.max(dur - 0.25, 0));
  try { playbackseek(t); } catch (_) {}
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
  if (playbackmode === 'octave') {
    octaveplayer?.unMute?.();
    octaveplayer?.setVolume?.(v);
  }
  volBar.value = v;
  volBar.style.setProperty('--fill', v + '%');
  localStorage.setItem('nyx_nyxify_volume', v);
  syncvolume();
}

function syncvolume() {
  const volume = playbackmode === 'octave' ? (Number(octaveplayer?.getVolume?.()) || 0) / 100 : audio.volume;
  const muted = playbackmode === 'octave' ? Boolean(octaveplayer?.isMuted?.()) || volume === 0 : audio.muted || volume === 0;
  volIcon.className = muted ? 'lucide--volume-x' : (volume < 0.5 ? 'lucide--volume-1' : 'lucide--volume-2');
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
  else if (e.key === 'ArrowUp' && !e.target.matches('input[type="range"]')) { e.preventDefault(); setvolume((playbackmode === 'octave' ? Number(octaveplayer?.getVolume?.()) || 0 : audio.muted ? 0 : audio.volume * 100) + 5); }
  else if (e.key === 'ArrowDown' && !e.target.matches('input[type="range"]')) { e.preventDefault(); setvolume((playbackmode === 'octave' ? Number(octaveplayer?.getVolume?.()) || 0 : audio.muted ? 0 : audio.volume * 100) - 5); }
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
void loadhome();

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
  const duration = playbackduration();
  const position = Math.min(playbacktime(), Math.max(duration - 0.01, 0));
  if (!isFinite(duration) || !duration) return;
  try {
    navigator.mediaSession.setPositionState({
      duration,
      position,
      playbackRate: playbackmode === 'octave' ? Number(octaveplayer?.getPlaybackRate?.()) || 1 : audio.playbackRate
    });
  } catch (_) {}
}

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', playbackplay);
  navigator.mediaSession.setActionHandler('pause', playbackpause);
  navigator.mediaSession.setActionHandler('previoustrack', playprev);
  navigator.mediaSession.setActionHandler('nexttrack', () => advance(true));
}

audio.addEventListener('loadedmetadata', syncmediapos);
audio.addEventListener('seeked', syncmediapos);
