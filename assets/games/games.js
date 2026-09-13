const elements = {
  grid: document.getElementById('gameGrid'),
  search: document.getElementById('gameSearch'),
  libraryTabs: document.getElementById('gameLibraryTabs'),
  sort: document.getElementById('gameSort'),
  count: document.getElementById('gameCount'),
  progress: document.getElementById('catalogProgress'),
  empty: document.getElementById('emptyState'),
  pagination: document.getElementById('gamePagination'),
  previousPage: document.getElementById('previousPage'),
  nextPage: document.getElementById('nextPage'),
  pageInfo: document.getElementById('pageInfo'),
  player: document.getElementById('gamePlayer'),
  playerTitle: document.getElementById('playerTitle'),
  playerLoading: document.getElementById('playerLoading'),
  playerLoadingText: document.getElementById('playerLoadingText'),
  playerRetry: document.getElementById('retryGame'),
  frame: document.getElementById('gameFrame'),
  provider: document.getElementById('gameProvider'),
  performance: document.getElementById('performanceGame'),
  performanceLabel: document.getElementById('performanceGameLabel'),
  close: document.getElementById('closePlayer'),
  reload: document.getElementById('reloadGame'),
  fullscreen: document.getElementById('fullscreenGame'),
  viewButtons: [...document.querySelectorAll('[data-game-view]')],
  localView: document.getElementById('localGamesView'),
  cloudView: document.getElementById('cloudGamesView'),
  cloudFrame: document.getElementById('cloudGamingFrame')
};

const savedPerformancePreference = localStorage.getItem('nyx.gamePerformanceMode');
const performancePreference = savedPerformancePreference === 'on'
  ? 'balanced'
  : (['auto', 'balanced', 'boost', 'off'].includes(savedPerformancePreference) ? savedPerformancePreference : 'auto');

const state = {
  games: [],
  gamesByKey: new Map(),
  manifest: null,
  lastFocused: null,
  activeGame: null,
  activeSourceIndex: 0,
  sourceAttempt: 0,
  sourceTimer: 0,
  failedSources: new Set(),
  performancePreference,
  performanceLevel: 0,
  performanceReason: 'ready',
  performanceFrame: 0,
  performanceObserver: null,
  performanceLongTasks: 0,
  performanceSamples: [],
  performanceStableWindows: 0,
  performanceLastTune: 0,
  page: 1,
  pageSize: 30,
  activeLibrary: 'all'
};

const GAME_LIBRARIES = Object.freeze([
  { id: 'all', label: 'All games', shortLabel: 'All', description: 'Every available game' },
  { id: 'lumin', label: 'LuminSDK', shortLabel: 'Lumin', description: 'Games delivered through LuminSDK' },
  { id: 'gn', label: 'GN Math', shortLabel: 'GN', description: 'The GN Math collection' },
  { id: 'gms', label: 'GMS', shortLabel: 'GMS', description: 'The GMS collection' },
  { id: 'local', label: 'Nyx Archive', shortLabel: 'Nyx', description: 'Games stored with Nyx' },
  { id: 'catclass', label: 'CatClass', shortLabel: 'CatClass', description: 'Community game sources' },
  { id: 'duckmath', label: 'DuckMath', shortLabel: 'DuckMath', description: 'Extra fallback sources' },
  { id: 'misc', label: 'Miscellaneous', shortLabel: 'Misc', description: 'Games without cover art' }
]);

const cloudGameRequests = new Map();
let cloudGameRequestId = 0;
let activeGameStorageBaseline = {};
const cloudAuthRelays = new Map();
const luminCoverUrls = new Map();
let luminSdkPromise = null;
let luminReadyPromise = null;

const CATALOG_FETCH_TIMEOUT = 8_000;
const CATALOG_FETCH_ATTEMPTS = 2;
const LUMIN_OPERATION_TIMEOUT = 9_000;

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function withTimeout(promise, milliseconds, label) {
  let timer = 0;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
    })
  ]).finally(() => clearTimeout(timer));
}

async function fetchCatalogJson(url, label, options = {}) {
  const attempts = Math.max(1, Number(options.attempts) || CATALOG_FETCH_ATTEMPTS);
  const timeout = Math.max(1_000, Number(options.timeout) || CATALOG_FETCH_TIMEOUT);
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        cache: attempt === 0 ? 'no-store' : 'default',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`${label} returned ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error?.name === 'AbortError'
        ? new Error(`${label} timed out`)
        : error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt + 1 < attempts) await wait(250 * (attempt + 1));
  }

  throw lastError || new Error(`${label} is unavailable`);
}

function loadLuminSdk(sdkUrl, sdkIntegrity = '') {
  if (window.Lumin?.init) return Promise.resolve(window.Lumin);
  if (luminSdkPromise) return luminSdkPromise;
  luminSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    script.src = sdkUrl;
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    if (sdkIntegrity) {
      script.integrity = sdkIntegrity;
      script.crossOrigin = 'anonymous';
    }
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('LuminSDK timed out')), LUMIN_OPERATION_TIMEOUT);
    script.addEventListener('load', () => window.Lumin?.init
      ? finish(null, window.Lumin)
      : finish(new Error('LuminSDK loaded without exposing its API')), { once: true });
    script.addEventListener('error', () => finish(new Error('LuminSDK could not be loaded')), { once: true });
    document.head.append(script);
  }).catch(error => {
    luminSdkPromise = null;
    throw error;
  });
  return luminSdkPromise;
}

async function ensureLuminReady(
  sdkUrl = state.manifest?.catalogs?.find(catalog => catalog.format === 'lumin')?.sdkUrl,
  sdkIntegrity = state.manifest?.catalogs?.find(catalog => catalog.format === 'lumin')?.sdkIntegrity
) {
  if (luminReadyPromise) return luminReadyPromise;
  luminReadyPromise = (async () => {
    const lumin = await loadLuminSdk(sdkUrl, sdkIntegrity);
    await withTimeout(lumin.init({ headless: true }), LUMIN_OPERATION_TIMEOUT, 'LuminSDK setup');
    return lumin;
  })().catch(error => {
    luminReadyPromise = null;
    throw error;
  });
  return luminReadyPromise;
}

function setGameView(view, updateUrl = true) {
  const nextView = view === 'cloud' ? 'cloud' : 'all';
  elements.localView.hidden = nextView !== 'all';
  elements.cloudView.hidden = nextView !== 'cloud';
  for (const button of elements.viewButtons) {
    const active = button.dataset.gameView === nextView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  if (nextView === 'cloud' && !elements.cloudFrame.src) {
    elements.cloudFrame.src = '/apps/cloud-gaming/?embedded=games';
  }
  if (updateUrl) {
    try {
      const url = new URL(location.href);
      url.hash = nextView === 'cloud' ? 'cloud' : '';
      history.replaceState(null, '', url);
    } catch {}
  }
}

for (const button of elements.viewButtons) {
  button.addEventListener('click', () => setGameView(button.dataset.gameView));
}

setGameView(location.hash.toLowerCase() === '#cloud' ? 'cloud' : 'all', false);

function cloudStorageSnapshot() {
  const snapshot = {};
  let total = 0;
  try {
    for (let index = 0; index < localStorage.length && Object.keys(snapshot).length < 64; index += 1) {
      const key = localStorage.key(index);
      if (!key || key.startsWith('nyx.') || key.startsWith('firebase:') || /[\u0000-\u001f]/.test(key)) continue;
      const value = localStorage.getItem(key);
      if (typeof value !== 'string' || new TextEncoder().encode(value).length > 24_000) continue;
      total += new TextEncoder().encode(key).length + new TextEncoder().encode(value).length;
      if (total > 280_000) break;
      snapshot[key] = value;
    }
  } catch {}
  return snapshot;
}

function requestCloudGameSave(type, payload = {}) {
  if (parent === window) return Promise.resolve({});
  const requestId = `game-${Date.now().toString(36)}-${(++cloudGameRequestId).toString(36)}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cloudGameRequests.delete(requestId);
      reject(new Error('Cloud save did not respond.'));
    }, 7_000);
    cloudGameRequests.set(requestId, { resolve, reject, timer });
    parent.postMessage({ type, requestId, ...payload }, location.origin);
  });
}

async function restoreCloudGameStorage(game) {
  if (!game?.key) return {};
  try {
    const result = await requestCloudGameSave('nyx:cloud-game-load', { gameKey: game.key });
    const storage = result?.storage && typeof result.storage === 'object' ? result.storage : {};
    Object.entries(storage).forEach(([key, value]) => {
      if (typeof key === 'string' && typeof value === 'string' && !key.startsWith('nyx.') && !key.startsWith('firebase:')) localStorage.setItem(key, value);
    });
  } catch {}
  return cloudStorageSnapshot();
}

function saveCloudGameStorage(game, baseline = {}) {
  if (!game?.key) return;
  const current = cloudStorageSnapshot();
  const storage = {};
  Object.entries(current).forEach(([key, value]) => {
    if (baseline[key] !== value) storage[key] = value;
  });
  const removed = Object.keys(baseline).filter(key => !(key in current));
  if (!Object.keys(storage).length && !removed.length) return;
  void requestCloudGameSave('nyx:cloud-game-save', { gameKey: game.key, storage, removed }).catch(() => {});
}

function syncHostTheme() {
  if (parent === window) return;
  try {
    const parentRoot = getComputedStyle(parent.document.documentElement);
    const parentBody = getComputedStyle(parent.document.body);
    const accent = [
      parentBody.getPropertyValue('--theme-accent'),
      parentBody.getPropertyValue('--theme-a'),
      parentBody.getPropertyValue('--accent'),
      parentRoot.getPropertyValue('--theme-accent'),
      parentRoot.getPropertyValue('--theme-a'),
      parentRoot.getPropertyValue('--accent')
    ].map(value => value.trim()).find(value => value && CSS.supports('color', value));
    if (accent) document.documentElement.style.setProperty('--accent', accent);
  } catch {
    // Games remains usable when opened outside the same-origin Nyx shell.
  }
}

function watchHostTheme() {
  syncHostTheme();
  if (parent === window) return;
  try {
    const observer = new MutationObserver(syncHostTheme);
    observer.observe(parent.document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    observer.observe(parent.document.body, { attributes: true, attributeFilter: ['class', 'style'] });
  } catch {}
}

watchHostTheme();

const ugsPlayerOverrides = new Map([
  ['F/clfnafps.html', 'https://classroomlesson.github.io/basic-ruffle-player/html/fnaf_pizzeria_simulator/index.html'],
  ['F/clfnafsl.html', 'https://classroomlesson.github.io/basic-ruffle-player/html/fnaf5/index.html'],
  ['minecraft/Dragonxclient.html', 'https://classroomlesson.github.io/basic-ruffle-player/html/minecraft/index.html'],
  ['minecraft/EaglercraftL_1.9_v0_7_0_Offline_Signed.html', 'https://classroomlesson.github.io/basic-ruffle-player/html/minecraft/index.html'],
  ['minecraft/EaglercraftX 1.8.8(u29).html', 'https://classroomlesson.github.io/basic-ruffle-player/html/minecraft/index.html'],
  ['minecraft/EaglercraftZ_1.11.2.html', 'https://classroomlesson.github.io/basic-ruffle-player/html/minecraft/index.html'],
  ['minecraft/eaglercraft.1.5.2.html', 'https://classroomlesson.github.io/basic-ruffle-player/html/minecraft/index.html']
]);

function titleCase(value) {
  const title = String(value || 'Game')
    .replace(/\.html?$/i, '')
    .replace(/\bindex$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([a-z])/gi, '$1 $2')
    .replace(/[\\/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());
  return title || 'Game';
}

const gameTitleCorrections = new Map([
  ['1v1lol', '1v1.LOL'],
  ['attackhole', 'Attack Hole'],
  ['achievmentunlocked', 'Achievement Unlocked'],
  ['achievmentunlocked2', 'Achievement Unlocked 2'],
  ['achievmentunlocked3', 'Achievement Unlocked 3'],
  ['amongus', 'Among Us'],
  ['animalcrossingwildworld', 'Animal Crossing: Wild World'],
  ['aquaparkio', 'Aquapark.io'],
  ['armormayhem2', 'Armor Mayhem 2'],
  ['bloonstd1', 'Bloons TD 1'],
  ['bloonstd3', 'Bloons TD 3'],
  ['bobtherobber', 'Bob the Robber'],
  ['bobtherobber2', 'Bob the Robber 2'],
  ['buckshotroulette', 'Buckshot Roulette'],
  ['burritobisonlaunchalibre', 'Burrito Bison: Launcha Libre'],
  ['colorwatersort3d', 'Color Water Sort 3D'],
  ['crazycattle3d', 'Crazy Cattle 3D'],
  ['dadnme', "Dad 'n Me"],
  ['deadestate', 'Dead Estate'],
  ['deadzed', 'Dead Zed'],
  ['deadzed2', 'Dead Zed 2'],
  ['deepersleep', 'Deeper Sleep'],
  ['deepestsword', 'Deepest Sword'],
  ['deepsleep', 'Deep Sleep'],
  ['defendyournuts', 'Defend Your Nuts'],
  ['defendyournuts2', 'Defend Your Nuts 2'],
  ['eaglercraft188u29', 'Eaglercraft 1.8.8'],
  ['eaglercraftalpha126offline', 'Eaglercraft Alpha 1.2.6'],
  ['eaglercraftbeta13offline', 'Eaglercraft Beta 1.3'],
  ['eaglercraftindevoffline', 'Eaglercraft Indev'],
  ['593275fpaworld3', 'Fancy Pants Adventures: World 3'],
  ['750785fpaworld4p1', 'Fancy Pants Adventures: World 4 Part 1'],
  ['752737fpaworld4p2', 'Fancy Pants Adventures: World 4 Part 2'],
  ['fancypantsadventuresworld3', 'Fancy Pants Adventures: World 3'],
  ['fancypantsadventuresworld4part1', 'Fancy Pants Adventures: World 4 Part 1'],
  ['fancypantsadventuresworld4part2', 'Fancy Pants Adventures: World 4 Part 2'],
  ['fivenightsatfreddysworld', "Five Nights at Freddy's World"],
  ['gunspin', 'Gun Spin'],
  ['gunmayhem', 'Gun Mayhem'],
  ['gunmayhem2', 'Gun Mayhem 2'],
  ['gunmayhemredux', 'Gun Mayhem Redux'],
  ['html5doodlejump', 'Doodle Jump'],
  ['1datedanger', '1 Date Danger'],
  ['clickteamfusiondeveloper25html5runtime', "Five Nights at Freddy's World Refreshed"],
  ['antonblastdemov12', 'Antonblast'],
  ['shapezdemofactoryautomationgame', 'shapez'],
  ['ducklife2worldchampion', 'Duck Life 2: World Champion'],
  ['pacmanworld', 'Pac-Man World'],
  ['roadoffury', 'Road of Fury'],
  ['stateioyt', 'State.io'],
  ['tombofthemask', 'Tomb of the Mask'],
  ['vex2', 'Vex 2'],
  ['worldshardestgame', "World's Hardest Game"],
  ['worldshardestgame2', "World's Hardest Game 2"],
  ['worldshardestgame3', "World's Hardest Game 3"],
  ['worldshardestgame4', "World's Hardest Game 4"],
  ['theworldshardestgame', "World's Hardest Game"],
  ['theworldshardestgame2', "World's Hardest Game 2"],
  ['theworldshardestgame3', "World's Hardest Game 3"],
  ['theworldshardestgame4', "World's Hardest Game 4"],
  ['worlds4', "World's Hardest Game 4"],
  ['worldbox', 'WorldBox'],
  ['wormsworldparty', 'Worms World Party']
]);

function cleanGameTitle(value, format = '') {
  let title = String(value || '')
    .replace(/@[a-f0-9]{8,}$/i, '')
    .replace(/\?s\b/gi, "'s")
    .replace(/\s*[-|]\s*(?:play online\b.*|poki\b.*|free (?:online )?.*|demo)\s*$/i, '')
    .replace(/\s+html5\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!title) return '';
  title = titleCase(title)
    .replace(/\b(\d)\s+D\b/g, '$1D')
    .replace(/\b(\d)\s+V\s+(\d)\b/gi, '$1v$2');
  const key = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const generic = /^(?:ytgamewrapperwebgltemplate|piplayables|runnertemplate|fix|f|a|win|manifest|offlineclient|internetexplorer|jquerymin|easeljs\d+combined|emulatorjsdemo|youtubeplayable|ruffleplayer|soundboard|coolgames|\d*firebasefirestore|aaafunworld)$/i;
  if (format === 'gn' && (generic.test(key) || /^\d{2,}$/.test(key))) return '';
  return gameTitleCorrections.get(key) || title;
}

function gameTitleScore(title, source = '') {
  const clean = String(title || '').trim();
  if (!clean) return -Infinity;
  const words = clean.split(/\s+/).filter(Boolean);
  let score = Math.min(clean.length, 36) + words.length * 9;
  if (words.length === 1 && clean.length > 11) score -= 16;
  if (clean.length > 48) score -= clean.length - 48;
  if (/[?@]|(?:template|wrapper|play online|demo)$/i.test(clean)) score -= 35;
  if (source === 'duckmath') score += 5;
  if (source === 'lumin') score += 3;
  return score;
}

function gameKey(value) {
  const key = titleCase(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {
    '10minutestilldawn': '10minutestildawn',
    fnaf: 'fivenightsatfreddys1',
    fnaf2: 'fivenightsatfreddys2',
    fnaf3: 'fivenightsatfreddys3',
    fnaf4: 'fivenightsatfreddys4',
    fnaf4halloween: 'fivenightsatfreddys4halloween',
    fnafworld: 'fivenightsatfreddysworld',
    fnafps: 'fivenightsatfreddyspizzeriasimulator',
    fnafsl: 'fivenightsatfreddyssisterlocation',
    fnafucn: 'fivenightsatfreddysucn',
    fivenightsatfreddys: 'fivenightsatfreddys1',
    fivenightsatfreddys5: 'fivenightsatfreddyssisterlocation',
    theworldshardestgame: 'worldshardestgame',
    theworldshardestgame2: 'worldshardestgame2',
    theworldshardestgame3: 'worldshardestgame3',
    theworldshardestgame4: 'worldshardestgame4'
  };
  return aliases[key] || key;
}

function fillTemplate(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(values[key] ?? ''));
}

function externalGamePlayer(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!/^https?:$/.test(url.protocol)) return '';
    url.username = '';
    url.password = '';
    url.hash = '';
    return `/assets/games/remote-play.html?v=20260805-selected-proxy-engine-v3&url=${encodeURIComponent(url.href)}`;
  } catch {
    return '';
  }
}

function ugsThumbnailName(path) {
  return String(path)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() + '.png';
}

function safeCover(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, location.href);
    const proxiedHosts = new Set(['raw.githubusercontent.com', 'cdn.jsdelivr.net', 'rawcdn.githack.com', 'raw.githack.com']);
    return proxiedHosts.has(parsed.hostname)
      ? `/gms-games-proxy?url=${encodeURIComponent(parsed.href)}`
      : parsed.href;
  } catch {
    return '';
  }
}

function directCover(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url, location.href);
    if (parsed.hostname === 'raw.githubusercontent.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 4) {
        const [owner, repository, branch, ...path] = parts;
        if (owner.toLowerCase() === 'gn-math' && repository.toLowerCase() === 'covers') {
          return `https://raw.githack.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(branch)}/${path.map(encodeURIComponent).join('/')}`;
        }
        return `https://cdn.jsdelivr.net/gh/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}@${encodeURIComponent(branch)}/${path.map(encodeURIComponent).join('/')}`;
      }
    }
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function rawItems(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.games) ? data.games : [];
}

function excludedGameItem(item) {
  const identity = [item?.title, item?.name, item?.path, item?.url, item?.cover, item?.img, item?.thumbnail]
    .map(value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''))
    .join(' ');
  return identity.includes('amirrorscursesfw')
    || identity.includes('amatyamirrorscurse');
}

async function adaptCatalog(catalog) {
  if (catalog.format === 'lumin') {
    const lumin = await ensureLuminReady(catalog.sdkUrl, catalog.sdkIntegrity);
    const games = [];
    const limit = 100;
    let page = 1;
    let pages = 1;
    do {
      const result = await withTimeout(
        lumin.getGames({ page, limit }),
        LUMIN_OPERATION_TIMEOUT,
        `LuminSDK catalog page ${page}`
      );
      const items = Array.isArray(result?.games) ? result.games : [];
      games.push(...items);
      pages = Math.max(1, Number(result?.pages) || 1);
      page += 1;
    } while (page <= pages);

    return games.flatMap(item => {
      const id = String(item?.id || '').trim();
      const title = cleanGameTitle(item?.name || id, 'lumin');
      if (!id || !title) return [];
      const player = `lumin-game:${id}`;
      const cover = item?.image_token ? `lumin-cover:${item.image_token}` : '';
      return [{
        key: gameKey(title),
        title,
        url: player,
        cover,
        covers: cover ? [cover] : [],
        priority: Number(catalog.priority) || 0,
        source: catalog.id,
        sources: [{
          url: player,
          source: catalog.id,
          priority: Number(catalog.priority) || 0,
          title,
          luminId: id
        }]
      }];
    });
  }

  const items = rawItems(await fetchCatalogJson(catalog.url, catalog.id));
  let knownCovers = new Set();

  if (catalog.coversUrl) {
    try {
      knownCovers = new Set(await fetchCatalogJson(catalog.coversUrl, `${catalog.id} covers`, { attempts: 1 }));
    } catch {
      knownCovers = new Set();
    }
  }

  return items.flatMap(item => {
    if (excludedGameItem(item)) return [];
    const path = String(item.path || '').replace(/^\/+/, '');
    if (!path && catalog.format !== 'duckmath' && catalog.format !== 'external') return [];
    const suppliedTitle = String(item.title || item.name || '').replace(/\s+/g, ' ').trim();
    if (/^@[a-f0-9]{24,}$/i.test(suppliedTitle)) return [];
    const title = cleanGameTitle(catalog.format === 'duckmath'
      ? titleCase(suppliedTitle || path)
      : suppliedTitle || titleCase(path), catalog.format);
    if (!title) return [];
    let player = catalog.format === 'duckmath'
      ? String(item.url || '')
      : catalog.format === 'external'
        ? externalGamePlayer(item.url)
        : fillTemplate(catalog.player, { path });
    if (!player) return [];
    let covers = [];

    if (catalog.format === 'ugs') {
      player = ugsPlayerOverrides.get(path) || player;
      const thumbnail = ugsThumbnailName(path);
      if (knownCovers.has(thumbnail)) covers.push(`/assets/ugs/thumbs/${encodeURIComponent(thumbnail)}`);
    } else if (catalog.format === 'gn') {
      // Prefer Nyx's same-origin asset route. Managed Chromebook networks often
      // block raw GitHub/CDN hosts even though the Nyx origin itself is allowed.
      covers.push(item.cover, directCover(item.coverFallback), directCover(item.cover));
    } else if (catalog.format === 'gms') {
      if (item.type === 'gba' && item.romId && catalog.gbaPlayer) {
        player = fillTemplate(catalog.gbaPlayer, { romId: item.romId });
      }
      covers.push(safeCover(item.cover), directCover(item.cover));
    } else if (catalog.format === 'external') {
      covers.push(safeCover(item.cover), safeCover(item.coverFallback), directCover(item.cover));
    }

    covers = [...new Set(covers.filter(Boolean))];

    return [{
      key: gameKey(title),
      title,
      url: player,
      cover: covers[0] || '',
      covers,
      priority: Number(catalog.priority) || 0,
      source: catalog.id,
      fallbackOnly: Boolean(catalog.fallbackOnly),
      sources: [{
        url: player,
        source: catalog.id,
        priority: Number(catalog.priority) || 0,
        title
      }]
    }];
  });
}

function sourceScore(source) {
  const priority = Number(source?.priority) || 0;
  return source?.source === 'gn' ? priority - 1000 : priority;
}

function mergeCatalogs(catalogs) {
  const unique = new Map();

  for (const game of catalogs.flat()) {
    if (!game.key || !game.url) continue;
    const current = unique.get(game.key);
    if (game.fallbackOnly && !current) continue;
    const sources = [...(current?.sources || []), ...(game.sources || [])]
      .filter(source => source?.url)
      .filter((source, index, list) => list.findIndex(candidate => candidate.url === source.url) === index)
      .sort((a, b) => sourceScore(b) - sourceScore(a));
    const covers = [...new Set([
      ...(current?.covers || []),
      ...(game.covers || []),
      game.cover
    ].filter(Boolean))];
    const selected = !current || sourceScore(game) > sourceScore(current) ? { ...game } : { ...current };
    const primary = sources[0];
    selected.url = primary.url;
    selected.source = primary.source;
    selected.priority = primary.priority;
    selected.sources = sources;
    selected.title = sources
      .map(source => ({ title: source.title, score: gameTitleScore(source.title, source.source) }))
      .sort((a, b) => b.score - a.score)[0]?.title || selected.title;
    selected.covers = covers;
    unique.set(game.key, selected);
  }

  const fallback = state.manifest?.fallbackCover || '';
  return [...unique.values()].map(game => {
    const suppliedCovers = [...new Set(game.covers.filter(Boolean))];
    return {
      ...game,
      hasIcon: suppliedCovers.length > 0,
      covers: suppliedCovers.length ? [...new Set([
        ...suppliedCovers,
        fallback ? fillTemplate(fallback, { title: game.title }) : ''
      ].filter(Boolean))] : []
    };
  });
}

function makeFallback(title) {
  const fallback = document.createElement('span');
  fallback.className = 'cover-fallback';
  fallback.textContent = title.trim().charAt(0).toUpperCase() || '?';
  return fallback;
}

function makeCover(game) {
  const cover = document.createElement('span');
  cover.className = 'game-cover';
  const fallback = makeFallback(game.title);
  cover.append(fallback);
  if (!game.covers.length) {
    return cover;
  }

  const image = document.createElement('img');
  image.alt = '';
  // Each page contains only 30 cards. Eager loading avoids Chromium's
  // unreliable native lazy-image heuristics inside Nyx's embedded scroller.
  image.loading = 'eager';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  let index = 0;
  const setImageSource = async source => {
    if (!source.startsWith('lumin-cover:')) {
      image.src = source;
      return;
    }
    const token = source.slice('lumin-cover:'.length);
    try {
      let url = luminCoverUrls.get(token);
      if (!url) {
        const lumin = await ensureLuminReady();
        url = await lumin.getImageUrl(token);
        if (url) luminCoverUrls.set(token, url);
      }
      if (url) image.src = url;
      else image.dispatchEvent(new Event('error'));
    } catch {
      image.dispatchEvent(new Event('error'));
    }
  };
  void setImageSource(game.covers[index]);
  image.addEventListener('load', () => {
    image.classList.add('loaded');
    fallback.remove();
  });
  image.addEventListener('error', () => {
    index += 1;
    if (index < game.covers.length) {
      void setImageSource(game.covers[index]);
    } else {
      image.remove();
    }
  });
  cover.append(image);
  return cover;
}

function makeCard(game) {
  const card = document.createElement('button');
  card.className = 'game-card';
  card.type = 'button';
  card.dataset.gameKey = game.key;
  card.dataset.gameSource = game.source;
  card.dataset.preferredSource = ['all', 'misc'].includes(state.activeLibrary) ? '' : state.activeLibrary;
  card.setAttribute('aria-label', `Play ${game.title}`);
  card.append(makeCover(game));

  const source = document.createElement('span');
  source.className = 'game-source-badge';
  const activeSource = ['all', 'misc'].includes(state.activeLibrary) ? game.source : state.activeLibrary;
  source.textContent = GAME_LIBRARIES.find(library => library.id === activeSource)?.shortLabel || 'Game';
  card.append(source);

  const name = document.createElement('span');
  name.className = 'game-name';
  name.textContent = game.title;
  card.append(name);
  return card;
}

function visibleGames() {
  const query = elements.search.value.trim().toLowerCase();
  const games = state.games.filter(game =>
    (state.activeLibrary === 'misc'
      ? !game.hasIcon
      : game.hasIcon && (state.activeLibrary === 'all' || gameSources(game).some(source => source.source === state.activeLibrary)))
      && (!query || game.title.toLowerCase().includes(query))
  );
  return games.sort((a, b) => elements.sort.value === 'za'
    ? b.title.localeCompare(a.title, undefined, { numeric: true })
    : a.title.localeCompare(b.title, undefined, { numeric: true }));
}

function render() {
  const games = visibleGames();
  const totalPages = Math.max(1, Math.ceil(games.length / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const pageStart = (state.page - 1) * state.pageSize;
  const pageGames = games.slice(pageStart, pageStart + state.pageSize);
  const fragment = document.createDocumentFragment();
  for (const game of pageGames) fragment.append(makeCard(game));
  elements.grid.replaceChildren(fragment);
  elements.empty.hidden = games.length > 0;
  elements.count.textContent = `${games.length.toLocaleString()} game${games.length === 1 ? '' : 's'}`;
  elements.pagination.hidden = games.length <= state.pageSize;
  elements.previousPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= totalPages;
  elements.pageInfo.textContent = `Page ${state.page} of ${totalPages}`;
}

function libraryGameCount(libraryId) {
  if (libraryId === 'all') return state.games.filter(game => game.hasIcon).length;
  if (libraryId === 'misc') return state.games.filter(game => !game.hasIcon).length;
  return state.games.filter(game => game.hasIcon && gameSources(game).some(source => source.source === libraryId)).length;
}

function renderLibraryTabs() {
  const fragment = document.createDocumentFragment();
  for (const library of GAME_LIBRARIES) {
    const count = libraryGameCount(library.id);
    if (library.id !== 'all' && count === 0) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'library-tab';
    button.dataset.library = library.id;
    button.title = library.description;
    button.setAttribute('aria-pressed', String(state.activeLibrary === library.id));
    button.classList.toggle('active', state.activeLibrary === library.id);

    const label = document.createElement('span');
    label.textContent = library.label;
    const total = document.createElement('span');
    total.className = 'library-tab-count';
    total.textContent = count.toLocaleString();
    button.append(label, total);
    fragment.append(button);
  }
  elements.libraryTabs.replaceChildren(fragment);
}

function resetResults() {
  state.page = 1;
  render();
}

function changePage(nextPage) {
  const games = visibleGames();
  const totalPages = Math.max(1, Math.ceil(games.length / state.pageSize));
  const page = Math.min(Math.max(1, nextPage), totalPages);
  if (page === state.page) return;
  state.page = page;
  render();
  elements.grid.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function updateGameQuery(key) {
  try {
    const url = new URL(location.href);
    if (key) url.searchParams.set('game', key);
    else url.searchParams.delete('game');
    history.replaceState(null, '', url);
  } catch {
    // The catalog still works if history is unavailable inside an embedded page.
  }
}

function clearSourceTimer() {
  clearTimeout(state.sourceTimer);
  state.sourceTimer = 0;
}

function devicePerformanceLevel() {
  const cores = Number(navigator.hardwareConcurrency || 8);
  const memory = Number(navigator.deviceMemory || 8);
  const watchViewport = matchMedia('(max-width: 480px) and (max-height: 520px)').matches;
  if (watchViewport || cores <= 4 || memory <= 4) return 2;
  if (cores <= 6 || memory <= 6) return 1;
  return 0;
}

function selectedPerformanceLevel() {
  if (!state.activeGame || state.performancePreference === 'off') return 0;
  if (state.performancePreference === 'balanced') return 1;
  if (state.performancePreference === 'boost') return 2;
  return state.performanceLevel;
}

function setPerformanceLevel(level, reason = '') {
  const nextLevel = Math.max(0, Math.min(2, Math.round(Number(level) || 0)));
  if (nextLevel === state.performanceLevel && (!reason || reason === state.performanceReason)) return;
  state.performanceLevel = nextLevel;
  if (reason) state.performanceReason = reason;
  syncGamePerformanceMode();
}

function syncGamePerformanceMode() {
  const level = selectedPerformanceLevel();
  const active = level > 0;
  document.body.classList.toggle('game-active', Boolean(state.activeGame));
  document.body.classList.toggle('game-performance-active', active);
  document.body.dataset.gamePerformanceLevel = String(level);
  const label = state.performancePreference === 'auto'
    ? (level === 2 ? 'Auto · Boost' : level === 1 ? 'Auto · Balanced' : 'Auto')
    : (state.performancePreference === 'balanced' ? 'Balanced' : state.performancePreference === 'boost' ? 'Boost' : 'Off');
  if (elements.performanceLabel) elements.performanceLabel.textContent = label;
  if (elements.performance) {
    elements.performance.dataset.mode = state.performancePreference;
    elements.performance.dataset.level = String(level);
    elements.performance.classList.toggle('active', active);
    elements.performance.setAttribute('aria-pressed', String(active));
    elements.performance.setAttribute('aria-label', `Game optimizer: ${label}`);
    elements.performance.title = `Game optimizer: ${label}. Select to change Auto, Balanced, Boost, or Off.`;
  }
}

function stopGamePerformanceMonitor() {
  if (state.performanceFrame) cancelAnimationFrame(state.performanceFrame);
  state.performanceFrame = 0;
  state.performanceObserver?.disconnect?.();
  state.performanceObserver = null;
  state.performanceSamples = [];
  state.performanceLongTasks = 0;
  state.performanceStableWindows = 0;
  state.performanceLastTune = 0;
}

function startGamePerformanceMonitor() {
  stopGamePerformanceMonitor();
  if (!state.activeGame) return;
  if (state.performancePreference === 'auto') {
    state.performanceLevel = devicePerformanceLevel();
    state.performanceReason = state.performanceLevel ? 'device' : 'ready';
    syncGamePerformanceMode();
  }
  try {
    state.performanceObserver = new PerformanceObserver(entries => {
      state.performanceLongTasks += entries.getEntries().filter(entry => entry.duration >= 50).length;
    });
    state.performanceObserver.observe({ type: 'longtask' });
  } catch {
    state.performanceObserver = null;
  }
  let last = performance.now();
  state.performanceLastTune = last;
  const monitor = now => {
    state.performanceFrame = 0;
    if (!state.activeGame) return;
    const delta = now - last;
    last = now;
    if (document.visibilityState === 'visible' && delta > 0 && delta < 250) {
      state.performanceSamples.push(delta);
      if (state.performanceSamples.length > 180) state.performanceSamples.shift();
    }
    if (state.performancePreference === 'auto' && document.visibilityState === 'visible' && now - state.performanceLastTune >= 2_000) {
      const samples = state.performanceSamples.splice(0);
      const average = samples.length ? samples.reduce((sum, sample) => sum + sample, 0) / samples.length : 0;
      const slowFrames = samples.filter(sample => sample >= 38).length;
      const deviceFloor = devicePerformanceLevel();
      const overloaded = samples.length >= 12 && (average >= 25 || slowFrames >= 5 || state.performanceLongTasks >= 2);
      const healthy = samples.length >= 40 && average > 0 && average < 19.5 && slowFrames === 0 && state.performanceLongTasks === 0;
      if (elements.performance) {
        elements.performance.dataset.averageFrame = average.toFixed(1);
        elements.performance.dataset.slowFrames = String(slowFrames);
        elements.performance.dataset.longTasks = String(state.performanceLongTasks);
      }
      if (overloaded) {
        state.performanceStableWindows = 0;
        setPerformanceLevel(Math.max(deviceFloor, state.performanceLevel + 1), 'slowdown');
      } else if (healthy && state.performanceLevel > deviceFloor) {
        state.performanceStableWindows += 1;
        if (state.performanceStableWindows >= 4) {
          state.performanceStableWindows = 0;
          setPerformanceLevel(state.performanceLevel - 1, 'recovered');
        }
      } else {
        state.performanceStableWindows = 0;
      }
      state.performanceLongTasks = 0;
      state.performanceLastTune = now;
    }
    state.performanceFrame = requestAnimationFrame(monitor);
  };
  state.performanceFrame = requestAnimationFrame(monitor);
}

function setPlayerLoading(message, failed = false) {
  elements.playerLoading.classList.remove('done');
  elements.playerLoading.classList.toggle('failed', failed);
  elements.playerLoadingText.textContent = message;
  elements.playerRetry.hidden = !failed;
}

function gameSources(game = state.activeGame) {
  if (!game) return [];
  return game.sources?.length
    ? game.sources
    : [{ url: game.url, source: game.source || 'game', priority: game.priority || 0 }];
}

function gameProviderLabel(source, index) {
  const labels = {
    local: 'Nyx Archive',
    gn: 'GN Math',
    gms: 'GMS',
    lumin: 'LuminSDK',
    catclass: 'CatClass',
    duckmath: 'DuckMath'
  };
  return labels[source?.source] || `Provider ${index + 1}`;
}

function syncGameProvider() {
  if (!elements.provider) return;
  const sources = gameSources();
  const baseLabels = sources.map(gameProviderLabel);
  const labelTotals = new Map();
  const labelIndexes = new Map();
  baseLabels.forEach(label => labelTotals.set(label, (labelTotals.get(label) || 0) + 1));
  const options = sources.map((source, index) => {
    const option = document.createElement('option');
    const label = baseLabels[index];
    const labelIndex = (labelIndexes.get(label) || 0) + 1;
    labelIndexes.set(label, labelIndex);
    option.value = String(index);
    option.textContent = labelTotals.get(label) > 1 ? `${label} ${labelIndex}` : label;
    return option;
  });
  elements.provider.replaceChildren(...options);
  elements.provider.value = String(Math.min(state.activeSourceIndex, Math.max(0, sources.length - 1)));
  elements.provider.disabled = sources.length < 2;
  elements.provider.title = sources.length > 1
    ? `${sources.length} providers available`
    : 'Only one provider is available for this game';
}

function finishGameLaunch() {
  if (!state.activeGame) return;
  clearSourceTimer();
  elements.playerLoading.classList.add('done');
  try { parent.postMessage({ type: 'nyx:game-launched' }, '*'); } catch {}
}

function showGameFailure() {
  clearSourceTimer();
  elements.frame.src = 'about:blank';
  setPlayerLoading('This game could not load from any available source.', true);
  try { parent.postMessage({ type: 'nyx:game-failed' }, '*'); } catch {}
}

async function launchGameSource(index, reason = '') {
  const sources = gameSources();
  if (!state.activeGame || index < 0 || index >= sources.length) {
    showGameFailure();
    return;
  }

  clearSourceTimer();
  state.activeSourceIndex = index;
  syncGameProvider();
  state.sourceAttempt += 1;
  const attempt = state.sourceAttempt;
  const source = sources[index];
  const message = reason && sources.length > 1
    ? `Trying another source… ${index + 1} of ${sources.length}`
    : `Loading game…${sources.length > 1 ? ` Source ${index + 1} of ${sources.length}` : ''}`;
  setPlayerLoading(message);
  try {
    let owner = window;
    for (let depth = 0; depth < 4; depth += 1) {
      if (typeof owner.nyxInstallGameAdProtection === 'function') {
        owner.nyxInstallGameAdProtection(elements.frame);
        break;
      }
      if (owner.parent === owner) break;
      owner = owner.parent;
    }
  } catch {}
  let playableUrl = source.url;
  if (source.source === 'lumin') {
    try {
      const lumin = await ensureLuminReady();
      const result = await lumin.getGameUrl(source.luminId || source.url.slice('lumin-game:'.length));
      playableUrl = String(result?.url || '');
      if (!playableUrl) throw new Error('LuminSDK did not return a playable URL');
    } catch {
      if (attempt === state.sourceAttempt && state.activeGame) tryNextGameSource('The Lumin game could not be prepared.');
      return;
    }
  }
  if (attempt !== state.sourceAttempt || !state.activeGame) return;
  elements.frame.src = playableUrl;

  let sameOrigin = false;
  try { sameOrigin = new URL(playableUrl, location.href).origin === location.origin; } catch {}
  if (sameOrigin || source.source === 'lumin') {
    state.sourceTimer = setTimeout(() => {
      if (attempt !== state.sourceAttempt || !state.activeGame) return;
      launchGameSource(index + 1, 'The current source did not finish loading.');
    }, source.source === 'lumin' ? 25_000 : 18_000);
  }
}

function tryNextGameSource(reason = '') {
  if (!state.activeGame) return;
  const sources = gameSources();
  const current = sources[state.activeSourceIndex];
  if (current?.url) state.failedSources.add(current.url);
  let next = state.activeSourceIndex + 1;
  while (next < sources.length && state.failedSources.has(sources[next].url)) next += 1;
  if (next < sources.length) launchGameSource(next, reason);
  else showGameFailure();
}

async function openGame(game, updateHistory = true, preferredSource = '') {
  if (!game) return;
  state.lastFocused = document.activeElement;
  state.activeGame = game;
  state.performanceLevel = state.performancePreference === 'auto'
    ? devicePerformanceLevel()
    : (state.performancePreference === 'balanced' ? 1 : state.performancePreference === 'boost' ? 2 : 0);
  state.performanceReason = state.performancePreference === 'auto' && state.performanceLevel ? 'device' : 'ready';
  const sources = gameSources(game);
  const preferredAvailable = preferredSource
    ? sources.findIndex(source => source.source === preferredSource && !state.failedSources.has(source.url))
    : -1;
  const firstAvailable = preferredAvailable >= 0
    ? preferredAvailable
    : sources.findIndex(source => !state.failedSources.has(source.url));
  state.activeSourceIndex = firstAvailable >= 0 ? firstAvailable : 0;
  syncGameProvider();
  elements.playerTitle.textContent = game.title;
  elements.frame.title = game.title;
  elements.player.hidden = false;
  syncGamePerformanceMode();
  startGamePerformanceMonitor();
  activeGameStorageBaseline = await restoreCloudGameStorage(game);
  if (state.activeGame !== game) return;
  launchGameSource(state.activeSourceIndex);
  elements.close.focus();
  if (updateHistory) updateGameQuery(game.key);
  try { parent.postMessage({ type: 'nyx:game-loading' }, '*'); } catch {}
}

function closeGame() {
  saveCloudGameStorage(state.activeGame, activeGameStorageBaseline);
  activeGameStorageBaseline = {};
  clearSourceTimer();
  state.sourceAttempt += 1;
  state.activeGame = null;
  state.performanceLevel = 0;
  state.performanceReason = 'ready';
  stopGamePerformanceMonitor();
  elements.frame.src = 'about:blank';
  elements.player.hidden = true;
  syncGamePerformanceMode();
  setPlayerLoading('Loading game…');
  updateGameQuery('');
  state.lastFocused?.focus?.();
}

async function loadLibrary() {
  state.manifest = await fetchCatalogJson('/assets/games/games.json', 'Catalog manifest', { attempts: 3 });
  const catalogs = Array.isArray(state.manifest.catalogs) ? state.manifest.catalogs : [];
  const loaded = new Map();
  const failed = [];
  let completed = 0;
  let requestedOpened = false;
  const requested = new URLSearchParams(location.search).get('game');

  const publish = () => {
    state.games = mergeCatalogs([...loaded.values()]);
    state.gamesByKey = new Map(state.games.map(game => [game.key, game]));
    if (state.activeLibrary !== 'all' && !libraryGameCount(state.activeLibrary)) state.activeLibrary = 'all';
    renderLibraryTabs();
    render();

    const pending = catalogs.length - completed;
    if (pending > 0) elements.count.textContent += ` · ${pending} ${pending === 1 ? 'library' : 'libraries'} loading`;
    if (completed === catalogs.length && failed.length) elements.count.textContent += ` · ${failed.length} unavailable`;
    elements.progress.classList.toggle('done', state.games.length > 0 || completed === catalogs.length);
    elements.empty.hidden = state.games.length === 0 && completed < catalogs.length;

    if (!requestedOpened && requested && state.gamesByKey.has(requested)) {
      requestedOpened = true;
      openGame(state.gamesByKey.get(requested), false);
    }
  };

  if (!catalogs.length) throw new Error('Catalog manifest did not contain any libraries');

  await Promise.all(catalogs.map(async catalog => {
    try {
      loaded.set(catalog.id, await adaptCatalog(catalog));
    } catch (error) {
      failed.push({ id: catalog.id, error });
      console.warn(`Game library ${catalog.id} is unavailable`, error);
    } finally {
      completed += 1;
      publish();
    }
  }));

  if (!state.games.length) throw new Error('No game library was available');
}

elements.grid.addEventListener('click', event => {
  const card = event.target.closest('[data-game-key]');
  if (card) openGame(state.gamesByKey.get(card.dataset.gameKey), true, card.dataset.preferredSource);
});
elements.search.addEventListener('input', resetResults);
elements.libraryTabs.addEventListener('click', event => {
  const button = event.target.closest('[data-library]');
  if (!button || button.dataset.library === state.activeLibrary) return;
  state.activeLibrary = button.dataset.library;
  renderLibraryTabs();
  resetResults();
});
elements.sort.addEventListener('change', resetResults);
elements.previousPage.addEventListener('click', () => changePage(state.page - 1));
elements.nextPage.addEventListener('click', () => changePage(state.page + 1));
elements.close.addEventListener('click', closeGame);
elements.provider?.addEventListener('change', () => {
  const index = Number(elements.provider.value);
  const sources = gameSources();
  if (!Number.isInteger(index) || index < 0 || index >= sources.length) return;
  state.failedSources.delete(sources[index].url);
  launchGameSource(index, 'Switching provider...');
});
elements.performance?.addEventListener('click', () => {
  const modes = ['auto', 'balanced', 'boost', 'off'];
  state.performancePreference = modes[(modes.indexOf(state.performancePreference) + 1) % modes.length];
  state.performanceLevel = state.performancePreference === 'auto'
    ? devicePerformanceLevel()
    : (state.performancePreference === 'balanced' ? 1 : state.performancePreference === 'boost' ? 2 : 0);
  state.performanceReason = state.performancePreference === 'auto' && state.performanceLevel ? 'device' : 'manual';
  state.performanceSamples = [];
  state.performanceLongTasks = 0;
  state.performanceStableWindows = 0;
  localStorage.setItem('nyx.gamePerformanceMode', state.performancePreference);
  syncGamePerformanceMode();
});
elements.reload.addEventListener('click', () => {
  if (state.activeGame) launchGameSource(state.activeSourceIndex);
});
elements.playerRetry.addEventListener('click', () => {
  for (const source of gameSources()) state.failedSources.delete(source.url);
  launchGameSource(0);
});
elements.fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await elements.player.requestFullscreen();
  } catch {}
});
elements.frame.addEventListener('load', () => {
  if (elements.player.hidden || !state.activeGame || elements.frame.src === 'about:blank') return;
  const source = gameSources()[state.activeSourceIndex];
  let sameOrigin = false;
  let managedRunner = false;
  try {
    const parsed = new URL(source?.url || '', location.href);
    sameOrigin = parsed.origin === location.origin;
    managedRunner = sameOrigin && /^\/assets\/(?:ugs|gn-math|gms-games|reds-misc)\/play\.html$/i.test(parsed.pathname);
    if (sameOrigin && parsed.pathname === '/assets/games/remote-play.html') managedRunner = true;
  } catch {}
  // Nyx's runner pages own their detailed loading/error state. Reveal them as
  // soon as the runner document is available instead of requiring a custom
  // ready message that a short or DOM-only game may never emit.
  if (!sameOrigin || managedRunner) setTimeout(finishGameLaunch, 900);
});
elements.frame.addEventListener('error', () => tryNextGameSource('The current source could not be opened.'));
window.addEventListener('message', event => {
  if (event.origin === location.origin && event.source === elements.cloudFrame.contentWindow && event.data?.type === 'nyx:account-token-request') {
    const childRequestId = String(event.data.requestId || '').slice(0, 120);
    if (!childRequestId || parent === window) return;
    const relayRequestId = `games-cloud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    cloudAuthRelays.set(relayRequestId, { childRequestId, source: event.source });
    setTimeout(() => cloudAuthRelays.delete(relayRequestId), 5_000);
    parent.postMessage({ type: 'nyx:account-token-request', requestId: relayRequestId }, location.origin);
    return;
  }
  if (event.origin === location.origin && event.source === parent && event.data?.type === 'nyx:account-token-response') {
    const relayRequestId = String(event.data.requestId || '');
    const relay = cloudAuthRelays.get(relayRequestId);
    if (!relay) return;
    cloudAuthRelays.delete(relayRequestId);
    relay.source?.postMessage({ type: 'nyx:account-token-response', requestId: relay.childRequestId, token: String(event.data.token || '') }, location.origin);
    return;
  }
  if (event.origin === location.origin && event.source === elements.cloudFrame.contentWindow && event.data?.type === 'nyx:games-view') {
    setGameView(event.data.view);
    return;
  }
  if (event.origin === location.origin && event.source === elements.cloudFrame.contentWindow && event.data?.type === 'nyx:cloud-player') {
    document.body.classList.toggle('cloud-session-active', event.data.active === true);
    return;
  }
  if (event.origin === location.origin && event.data?.type === 'nyx:cloud-game-result') {
    const request = cloudGameRequests.get(String(event.data.requestId || ''));
    if (request) {
      clearTimeout(request.timer);
      cloudGameRequests.delete(String(event.data.requestId || ''));
      if (event.data.error) request.reject(new Error(event.data.error));
      else request.resolve(event.data);
    }
    return;
  }
  if (event.source !== elements.frame.contentWindow || !state.activeGame) return;
  if (event.data?.type === 'nyx:game-launched') finishGameLaunch();
  if (event.data?.type === 'nyx:game-failed') tryNextGameSource('The current source reported a loading error.');
});

elements.cloudFrame.addEventListener('load', () => {
  document.body.classList.remove('cloud-session-active');
});
addEventListener('pagehide', () => saveCloudGameStorage(state.activeGame, activeGameStorageBaseline), { passive: true });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !elements.player.hidden && !document.fullscreenElement) closeGame();
});

loadLibrary().catch(error => {
  console.error('Unable to load game library', error);
  elements.progress.classList.add('done');
  elements.count.textContent = 'Could not load the game library';
  elements.empty.querySelector('h2').textContent = 'Library unavailable';
  elements.empty.querySelector('p').textContent = 'Reload Nyx and try again.';
  elements.empty.hidden = false;
});
