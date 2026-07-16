const elements = {
  grid: document.getElementById('gameGrid'),
  search: document.getElementById('gameSearch'),
  library: document.getElementById('gameLibrary'),
  sort: document.getElementById('gameSort'),
  count: document.getElementById('gameCount'),
  progress: document.getElementById('catalogProgress'),
  empty: document.getElementById('emptyState'),
  player: document.getElementById('gamePlayer'),
  playerTitle: document.getElementById('playerTitle'),
  playerLoading: document.getElementById('playerLoading'),
  frame: document.getElementById('gameFrame'),
  close: document.getElementById('closePlayer'),
  reload: document.getElementById('reloadGame'),
  fullscreen: document.getElementById('fullscreenGame')
};

const state = {
  games: [],
  gamesByKey: new Map(),
  manifest: null,
  lastFocused: null
};

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

function gameKey(value) {
  return titleCase(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function fillTemplate(template, values) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(values[key] ?? ''));
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

function rawItems(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.games) ? data.games : [];
}

async function adaptCatalog(catalog) {
  const response = await fetch(catalog.url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${catalog.id} returned ${response.status}`);
  const items = rawItems(await response.json());
  let knownCovers = new Set();

  if (catalog.coversUrl) {
    try {
      const coverResponse = await fetch(catalog.coversUrl, { cache: 'no-store' });
      if (coverResponse.ok) knownCovers = new Set(await coverResponse.json());
    } catch {
      knownCovers = new Set();
    }
  }

  return items.flatMap(item => {
    const path = String(item.path || '').replace(/^\/+/, '');
    if (!path) return [];
    if (catalog.format === 'seraph' && !/(^|\/)index\.html?$/i.test(path)) return [];

    const suppliedTitle = String(item.title || item.name || '').replace(/\s+/g, ' ').trim();
    if (/^@[a-f0-9]{24,}$/i.test(suppliedTitle)) return [];
    const title = catalog.format === 'seraph'
      ? titleCase(suppliedTitle || path)
      : suppliedTitle || titleCase(path);
    let player = fillTemplate(catalog.player, { path });
    let cover = '';

    if (catalog.format === 'ugs') {
      const thumbnail = ugsThumbnailName(path);
      if (knownCovers.has(thumbnail)) cover = `/assets/ugs/thumbs/${encodeURIComponent(thumbnail)}`;
    } else if (catalog.format === 'gn') {
      cover = item.cover || item.coverFallback || '';
    } else if (catalog.format === 'gms') {
      if (item.type === 'gba' && item.romId && catalog.gbaPlayer) {
        player = fillTemplate(catalog.gbaPlayer, { romId: item.romId });
      }
      cover = safeCover(item.cover);
    } else if (catalog.format === 'seraph' && item.thumbnail) {
      cover = `/seraph-asset?path=${encodeURIComponent(String(item.thumbnail).replace(/^\/+/, ''))}`;
    }

    return [{
      key: gameKey(title),
      title,
      url: player,
      cover,
      priority: Number(catalog.priority) || 0,
      source: catalog.id
    }];
  });
}

function mergeCatalogs(catalogs) {
  const unique = new Map();

  for (const game of catalogs.flat()) {
    if (!game.key || !game.url) continue;
    const current = unique.get(game.key);
    const covers = [...new Set([...(current?.covers || []), game.cover].filter(Boolean))];
    const selected = !current || game.priority > current.priority ? { ...game } : { ...current };
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
  if (!game.covers.length) {
    cover.append(makeFallback(game.title));
    return cover;
  }

  const image = document.createElement('img');
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  let index = 0;
  image.src = game.covers[index];
  image.addEventListener('error', () => {
    index += 1;
    if (index < game.covers.length) {
      image.src = game.covers[index];
    } else {
      image.replaceWith(makeFallback(game.title));
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
  card.setAttribute('aria-label', `Play ${game.title}`);
  card.append(makeCover(game));

  const name = document.createElement('span');
  name.className = 'game-name';
  name.textContent = game.title;
  card.append(name);
  return card;
}

function visibleGames() {
  const query = elements.search.value.trim().toLowerCase();
  const showMisc = elements.library.value === 'misc';
  const games = state.games.filter(game =>
    game.hasIcon !== showMisc && (!query || game.title.toLowerCase().includes(query))
  );
  return games.sort((a, b) => elements.sort.value === 'za'
    ? b.title.localeCompare(a.title, undefined, { numeric: true })
    : a.title.localeCompare(b.title, undefined, { numeric: true }));
}

function render() {
  const games = visibleGames();
  const fragment = document.createDocumentFragment();
  for (const game of games) fragment.append(makeCard(game));
  elements.grid.replaceChildren(fragment);
  elements.empty.hidden = games.length > 0;
  elements.count.textContent = `${games.length.toLocaleString()} game${games.length === 1 ? '' : 's'}`;
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

function stopPointerLock() {
  try {
    const gameDocument = elements.frame.contentDocument;
    if (!gameDocument) return;
    gameDocument.addEventListener('pointerlockchange', () => {
      if (gameDocument.pointerLockElement) gameDocument.exitPointerLock?.();
    });
  } catch {
    // Cross-origin frames cannot be inspected; pointer lock is also omitted from iframe permissions.
  }
}

function openGame(game, updateHistory = true) {
  if (!game) return;
  state.lastFocused = document.activeElement;
  elements.playerTitle.textContent = game.title;
  elements.frame.title = game.title;
  elements.playerLoading.classList.remove('done');
  elements.player.hidden = false;
  elements.frame.src = game.url;
  elements.close.focus();
  if (updateHistory) updateGameQuery(game.key);
  try { parent.postMessage({ type: 'nyx:game-loading' }, '*'); } catch {}
}

function closeGame() {
  elements.frame.src = 'about:blank';
  elements.player.hidden = true;
  elements.playerLoading.classList.remove('done');
  updateGameQuery('');
  state.lastFocused?.focus?.();
}

async function loadLibrary() {
  const manifestResponse = await fetch('/assets/games/games.json', { cache: 'no-store' });
  if (!manifestResponse.ok) throw new Error(`Catalog manifest returned ${manifestResponse.status}`);
  state.manifest = await manifestResponse.json();

  const results = await Promise.allSettled(state.manifest.catalogs.map(adaptCatalog));
  const loaded = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  const failed = results.length - loaded.length;
  state.games = mergeCatalogs(loaded);
  state.gamesByKey = new Map(state.games.map(game => [game.key, game]));
  const iconCount = state.games.filter(game => game.hasIcon).length;
  const miscCount = state.games.length - iconCount;
  elements.library.options[0].textContent = `Games (${iconCount.toLocaleString()})`;
  elements.library.options[1].textContent = `Misc. Games (${miscCount.toLocaleString()})`;
  elements.progress.classList.add('done');
  render();

  if (failed) {
    elements.count.textContent += ` · ${failed} catalog${failed === 1 ? '' : 's'} unavailable`;
  }

  const requested = new URLSearchParams(location.search).get('game');
  if (requested && state.gamesByKey.has(requested)) openGame(state.gamesByKey.get(requested), false);
}

elements.grid.addEventListener('click', event => {
  const card = event.target.closest('[data-game-key]');
  if (card) openGame(state.gamesByKey.get(card.dataset.gameKey));
});
elements.search.addEventListener('input', render);
elements.library.addEventListener('change', render);
elements.sort.addEventListener('change', render);
elements.close.addEventListener('click', closeGame);
elements.reload.addEventListener('click', () => {
  elements.playerLoading.classList.remove('done');
  try {
    elements.frame.contentWindow?.location.reload();
  } catch {
    elements.frame.src = elements.frame.src;
  }
});
elements.fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await elements.player.requestFullscreen();
  } catch {}
});
elements.frame.addEventListener('load', () => {
  if (elements.player.hidden || elements.frame.src === 'about:blank') return;
  elements.playerLoading.classList.add('done');
  stopPointerLock();
});
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
