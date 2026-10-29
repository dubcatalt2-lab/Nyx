(async () => {
const { supportedEntries } = await import('./supported.mjs');
const qs = (selector) => document.querySelector(selector);
const labels = { global:'Global', gold:'Gold Quest', crypto:'Cyber Hack / Crypto Hack', brawl:'Monster Brawl', cafe:'Café', dinos:'Dino Dig', doom:'Tower of Doom', factory:'Factory', fishing:'Fishing Frenzy', flappy:'Flappy Blook', kingdom:'Crazy Kingdom', racing:'Racing', royale:'Battle Royale', rush:'Blook Rush', 'tower-defense':'Tower Defense', 'tower-defense-2':'Tower Defense 2', voyage:'Pirate’s Voyage', workshop:'Santa’s Workshop', interfaces:'Legacy interfaces' };
const { createBookmarklet, connectWorkspace } = await import('./connector.mjs');
let entries = [], selected = null, collection = 'all', bridge = null, ready = false, busy = false;
const modeIcon = key => ['gold','factory','voyage','crypto'].includes(key) ? 'coins' : ['brawl','royale','rush','doom','tower-defense','tower-defense-2'].includes(key) ? 'shield' : ['racing','flappy'].includes(key) ? 'flag' : key === 'global' ? 'bolt' : key === 'interfaces' ? 'code' : 'box';
const icon = name => '<svg aria-hidden="true"><use href="#v-' + name + '"/></svg>';
let availability = {}, inspection = null;
async function inspectTab(){
 if(!bridge||!ready)return;
 if(inspection)return inspection;
 inspection=bridge.request('inspect').then(result=>{availability=result.availability||{};render();updateRun();}).catch(error=>record(error.message)).finally(()=>{inspection=null;});
 return inspection;
}
let favorites = new Set();
try { const value = JSON.parse(localStorage.getItem('nyx.blooket.favorites.v1') || '[]'); if (Array.isArray(value)) favorites = new Set(value.filter(v => typeof v === 'string')); } catch {}
function record(text) {
  const list = qs('[data-activity]');
  if (!list.dataset.started) { list.replaceChildren(); list.dataset.started = 'yes'; }
  const row = document.createElement('li'); row.textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + ' · ' + text; row.setAttribute('aria-label',text); list.prepend(row);
  while (list.children.length > 20) list.lastElementChild.remove();
}
function updateRun() { qs('[data-run]').disabled = !ready || busy || !selected?.code || selected.category === 'interfaces' || availability[selected?.path]?.available === false; }
function setStatus(selector,text){const node=qs(selector);node.textContent=text;node.setAttribute('aria-label',text);node.setAttribute('role','status');}
function sessionStatus(text, available = false) { ready = available; setStatus("[data-session-status]",text); qs('[data-session-status]').classList.toggle('is-connected', available); updateRun(); }
function render() {
  const query = qs('[data-search]').value.trim().toLowerCase(), mode = qs('#vault-mode').value;
  const shown = entries.filter(e => (!mode || e.category === mode) && (collection !== 'favorites' || favorites.has(e.path)) && `${e.name} ${labels[e.category] || e.category}`.toLowerCase().includes(query));
  qs('[data-total]').textContent = entries.length; qs('[data-favorite-count]').textContent = entries.filter(e => favorites.has(e.path)).length;
  qs('[data-heading]').textContent = collection === 'favorites' ? 'Favorites' : labels[mode] || 'All tools';
  setStatus("[data-result-count]",`${shown.length} ${shown.length === 1 ? 'tool' : 'tools'}`); qs('[data-empty]').hidden = shown.length > 0;
  const grid = qs('[data-grid]'); grid.replaceChildren();
  for (const entry of shown) {
    const card = document.createElement('article'); card.className = 'vault-card'; card.dataset.category = entry.category;
    const top = document.createElement('div'); top.className = 'vault-card-top';
    const label = document.createElement('span'); label.className = 'vault-tool-icon'; label.innerHTML = icon(modeIcon(entry.category)); const modeLabel = labels[entry.category] || entry.category;
    const star = document.createElement('button'); star.type = 'button'; star.className = 'vault-star'; star.innerHTML = icon('star'); star.setAttribute('aria-label', `Favorite ${entry.name} (${modeLabel})`); star.setAttribute('aria-pressed', String(favorites.has(entry.path)));
    star.onclick = () => { favorites.has(entry.path) ? favorites.delete(entry.path) : favorites.add(entry.path); try { localStorage.setItem('nyx.blooket.favorites.v1', JSON.stringify([...favorites])); } catch { record('Favorites could not be saved in this br00ser.'); } render(); };
    top.append(label, star);
    const title = document.createElement('h3'); title.textContent = entry.name;
    const note = document.createElement('p'); note.textContent = entry.category === 'interfaces' ? 'Legacy interface: source only' : availability[entry.path]?.available === false ? 'Game data not found in this tab' : availability[entry.path]?.available ? modeLabel + ' - game data found' : modeLabel;
    const open = document.createElement('button'); open.type = 'button'; open.innerHTML = 'Open tool' + icon('arrow'); open.setAttribute('aria-label', `Open ${entry.name} (${modeLabel})`); open.onclick = () => openTool(entry);
    card.append(top, title, note, open); grid.append(card);
  }
}
async function openTool(entry) {
  selected = entry; qs('#vault-tool-title').textContent = entry.name; qs('[data-tool-mode]').textContent = labels[entry.category];
  qs('[data-tool-description]').textContent = entry.path === 'brawl/maxCurrentAbilities.js' ? 'Boosts damage, firing speed and penetration. Normal ability levels and upgrade choices stay intact. Stop scheduled tools removes the boost.' : entry.category === 'interfaces' ? 'Source only. For controls in Nyx, choose an individual tool from the library.' : entry.category === 'global' ? 'Use this on the Blooket page the tool applies to.' : 'Start ' + labels[entry.category] + ' before running this tool.';
  setStatus("[data-tool-result]",ready ? 'Connected. Open the matching game mode in Blooket before running this tool.' : 'Use the Connect to Nyx bookmark in your Blooket tab first.');
  qs('[data-code]').textContent = entry.code || 'Source reference only.';
  qs('[data-source]').href = 'https://gitlab.com/blooket/blooket-cheats/-/blob/c322469ebbd192b6731480af76b1ac0a3d4a7b22/cheats/' + entry.path;
  qs('[data-download]').href = './upstream/' + entry.path + '.txt';
  updateRun(); qs('dialog').showModal();
  await inspectTab();
  if(selected===entry && availability[entry.path]?.available===false)setStatus("[data-tool-result]",availability[entry.path].reason);
}
function disconnected() {
  availability={}; sessionStatus('Not connected');
  qs('[data-disconnect]').disabled = true; qs('[data-focus]').disabled = true; qs('[data-stop]').disabled = true; qs('[data-details]').disabled = true;
  qs('[data-session-description]').textContent = 'Click your saved Connect to Nyx bookmark on the official Blooket page to connect.';
}
bridge = connectWorkspace({
  onStatus: ({host,path}) => {
    const firstConnection = !ready;
    sessionStatus('Connected to Blooket', true);
    qs('[data-session-description]').textContent = host + path;
    qs('[data-disconnect]').disabled = false; qs('[data-focus]').disabled = false; qs('[data-stop]').disabled = false; qs('[data-details]').disabled = false;
    if (firstConnection) { qs('[data-setup]').open = false; queueMicrotask(inspectTab); }
  },
  onDisconnect: () => { disconnected(); record('Blooket disconnected. Click the bookmark again to reconnect.'); },
  onError: message => { record(message); qs('[data-session-description]').textContent = message; }
});
if (bridge) { sessionStatus('Connecting to Blooket'); qs('[data-session-description]').textContent = 'Waiting for Blooket...'; }
qs('[data-run]').onclick = async () => {
  if (!selected || busy || !ready || !bridge || selected.category === 'interfaces') return;
  const entry = selected;
  busy = true; updateRun(); setStatus("[data-tool-result]",'Running in Blooket. Check its tab for any input prompt.');
  bridge.focus();
  try {
    const result = await bridge.request('run', entry.path);
    const message = result.message ? entry.name + ': ' + result.message : result.cancelled ? entry.name + ': cancelled.' : result.scheduled ? entry.name + ': running. Use Stop scheduled tools to stop it.' : entry.name + ': finished running. Check the result in Blooket.';
    record(message); if (selected === entry) setStatus("[data-tool-result]",message);
  } catch (error) {
    const message = entry.name + ' failed: ' + String(error.message || error);
    record(message); if (selected === entry) setStatus("[data-tool-result]",message);
  } finally { busy = false; updateRun(); }
};
qs('[data-disconnect]').onclick = () => bridge?.close();
qs('[data-focus]').onclick = () => bridge?.focus();
qs('[data-details]').onclick = async () => {
  try {
    const result = await bridge.request('details',selected?.path);
    const text = JSON.stringify(result.details, null, 2);
    await navigator.clipboard.writeText(text);
    record('Connection details copied. Includes component field names, not account values.');
  } catch (error) { record('Could not copy connection details: ' + error.message); }
};
qs('[data-stop]').onclick = async () => {
  try { await bridge?.request('stop'); record('Scheduled tools stopped. Previous changes remain.'); }
  catch (error) { record(error.message); }
};
qs('[data-copy-page-link]').onclick = async () => {
  const address=new URL('/blooket',location.origin).href;
  try { await navigator.clipboard.writeText(address); setStatus('[data-setup-status]','Page link copied. Open it in a tab to set up the connector.'); }
  catch { setStatus('[data-setup-status]','Page link: '+address); }
};
qs('[data-copy-page-link]').disabled=false;
qs('[data-copy-bookmark]').onclick = async () => {
  try { await navigator.clipboard.writeText(qs('[data-bookmark]').href); setStatus('[data-setup-status]', 'Connector code copied. Paste it into the bookmark URL field, then run that bookmark on Blooket.'); }
  catch { qs('[data-manual]').hidden = false; qs('[data-bookmark-code]').value = qs('[data-bookmark]').href; qs('[data-bookmark-code]').select(); setStatus('[data-setup-status]', 'Select and copy the bookmark URL below.'); }
};
qs('[data-bookmark]').onclick = event => { event.preventDefault(); setStatus('[data-setup-status]', 'Drag this button to your bookmarks bar, then click that saved bookmark while on Blooket.'); };
qs('[data-download-bookmark]').onclick = () => {
  const href = qs('[data-bookmark]').href.replaceAll('&','&amp;').replaceAll('"','&quot;');
  const blob = new Blob(['<!DOCTYPE NETSCAPE-Bookmark-file-1><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8"><TITLE>Nyx Blooket connector</TITLE><H1>Nyx Blooket connector</H1><DL><p><DT><A HREF="' + href + '">Connect to Nyx</A></DL><p>'], {type:'text/html'});
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'Nyx-Blooket-Bookmark.html'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 30000);
  setStatus('[data-setup-status]', 'Downloaded. In Chrome or Edge: open Bookmarks manager, choose Import bookmarks from the menu, then select Nyx-Blooket-Bookmark.html.');
};
qs('[data-close]').onclick = () => qs('dialog').close();
document.querySelectorAll('[data-collection]').forEach(button => button.onclick = () => { collection = button.dataset.collection; qs('#vault-mode').value = ''; document.querySelectorAll('[data-mode-nav] button').forEach(b=>b.setAttribute('aria-pressed','false')); document.querySelectorAll('[data-collection]').forEach(other => other.setAttribute('aria-pressed', String(other === button))); render(); });
qs('[data-search]').oninput = render; qs('#vault-mode').onchange = render;

try {
  const response = await fetch('./catalog.json'); if (!response.ok) throw Error(`Catalog returned HTTP ${response.status}`);
  const catalog = await response.json(); entries = catalog.entries;
  if (!Array.isArray(entries) || entries.some(e => !/^[a-zA-Z0-9/-]+\.js$/.test(e.path) || typeof e.code !== 'string')) throw Error('Invalid tool catalog');
  entries = supportedEntries(entries);
  qs('[data-library-total]').textContent=entries.length;
  qs('[data-library-modes]').textContent=new Set(entries.map(entry=>entry.category)).size;
  for (const [value,label] of Object.entries(labels).filter(([key]) => entries.some(entry => entry.category === key))) { const option = document.createElement('option'); option.value=value; option.textContent=label; qs('#vault-mode').append(option); }
  const runtimeResponse = await fetch('./connector-runtime.js');
  if (!runtimeResponse.ok) throw Error('Bookmark setup could not load (HTTP ' + runtimeResponse.status + ').');
  qs('[data-bookmark]').href = createBookmarklet(location.origin, entries, await runtimeResponse.text());
  qs('[data-copy-bookmark]').disabled = false; qs('[data-download-bookmark]').disabled = false;
  for (const [value,label] of Object.entries(labels).filter(([key]) => entries.some(entry => entry.category === key))) {
    const button = document.createElement('button'); button.type='button'; button.innerHTML = icon(modeIcon(value));
    button.append(document.createTextNode(label)); const count=document.createElement('span'); count.textContent=entries.filter(e=>e.category===value).length; button.append(count);
    button.onclick=()=>{qs('#vault-mode').value=value; collection='all'; document.querySelectorAll('[data-collection]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.collection==='all'))); document.querySelectorAll('[data-mode-nav] button').forEach(b=>b.setAttribute('aria-pressed',String(b===button))); render();}; qs('[data-mode-nav]').append(button);
  }
  render();
} catch (error) { setStatus("[data-result-count]",'Library unavailable: ' + String(error.message || error)); }
})();
