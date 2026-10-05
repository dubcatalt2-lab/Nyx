/* Account relationships and public profile cards, shared by embedded/standalone Chat. */
window.createNyxChatSocial = function createNyxChatSocial({request, me, members, avatar, name, badge, startDm, changed, closeDrawers}) {
  const dialog = document.querySelector('[data-member-dialog]');
  const content = document.querySelector('[data-member-dialog-content]');
  const friends = document.querySelector('[data-friends-dialog]');
  const list = document.querySelector('[data-friends-list]');
  const errorLine = document.querySelector('[data-friends-error]');
  let relationships = new Map(), owner = '', loaded = false, loading = null, generation = 0;
  let revision = 0, signature = '';
  let current = null, filter = 'accepted', busy = false, failure = '';
  const node = (tag, className, text) => {
    const element = document.createElement(tag); element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const icons = {
    'Add friend':'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 8h6M19 5v6M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'Remove friend':'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 8h6M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'Accept':'m5 12 4 4L19 6','Decline':'m6 6 12 12M6 18 18 6','Cancel request':'m6 6 12 12M6 18 18 6',
    'Block':'M5.6 5.6 18.4 18.4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    'Unblock':'m8 12 3 3 5-6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    'Ignore':'m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.3A10 10 0 0 1 12 5c7 0 10 7 10 7a16 16 0 0 1-3 4M6 6.5A16 16 0 0 0 2 12s3 7 10 7a10 10 0 0 0 4-1',
    'Unignore':'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    'Message':'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 2V11.5a8.5 8.5 0 0 1 17 0Z',
    'Retry':'M3 10a9 9 0 1 1 1 7M3 4v6h6'
  };
  const button = (text, action, className = 'social-button') => {
    const element = node('button', className, text); element.type = 'button';
    const path=icons[text]||icons[text.startsWith('Retry')?'Retry':''];
    if(path){element.replaceChildren();const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const shape=document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',path);svg.append(shape);element.append(svg);const label=node('span',className.includes('social-button')?'social-action-label':'',text);element.append(label);element.setAttribute('aria-label',text);element.title=text;}
    element.disabled = busy || !loaded; element.addEventListener('click', action); return element;
  };
  const muted = uid => Boolean(relationships.get(uid)?.blocked || relationships.get(uid)?.ignored);
  const canMessage = uid => relationships.get(uid)?.canMessage !== false;
  function reset() {
    owner = me()?.uid || ''; generation++; revision++; signature = ''; current = null; loaded = false; loading = null;
    relationships = new Map(); failure = ''; busy = false; dialog.close(); friends.close(); renderFriends();
  }
  function apply(values) {
    const nextSignature = JSON.stringify(values || []);
    if (loaded && signature === nextSignature && !failure) return false;
    signature = nextSignature;
    relationships = new Map((Array.isArray(values) ? values : []).map(value => [value.uid, value]));
    loaded = true; failure = ''; renderFriends(); changed(); return true;
  }
  async function refresh() {
    if (owner !== me()?.uid) reset();
    if (!owner) return;
    if (loading) return loading;
    const uid = owner, version = revision;
    const task = request('/api/chat/relationships', {cache: 'no-store'}).then(payload => {
      if (uid === owner && uid === me()?.uid && version === revision) {const updated = apply(payload.relationships); if (updated && dialog.open && current) renderProfile(current);}
    }).catch(error => {
      if (uid !== owner) return;
      failure = error.message || 'Relationships could not load.'; renderFriends();
    }).finally(() => {if (loading === task) loading = null;});
    loading = task; return task;
  }
  async function change(member, action) {
    if (busy || !loaded) return;
    busy = true; revision++; failure = ''; renderFriends(); if (current) renderProfile(current);
    const uid = owner;
    try {
      const payload = await request('/api/chat/relationships/' + encodeURIComponent(member.uid), {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action})
      });
      if (owner === uid && me()?.uid === uid) {revision++; apply(payload.relationships);}
    } catch (error) {if (owner === uid) failure = error.message || 'The change could not be saved.';}
    finally {if (owner === uid) {busy = false; renderFriends(); if (current && dialog.open) renderProfile(current);}}
  }
  function actions(member, container, compact = false) {
    const relation = relationships.get(member.uid) || {};
    const add = (label, action, style) => container.append(button(label, () => void change(member, action), style));
    if (relation.blocked) add('Unblock', 'unblock');
    else {
      if (relation.friend === 'incoming') {add('Accept', 'accept'); add('Decline', 'decline');}
      else if (relation.friend === 'outgoing') add('Cancel request', 'cancel');
      else if (relation.friend === 'accepted') add('Remove friend', 'remove');
      else if (!compact && canMessage(member.uid)) add('Add friend', 'request', 'social-button friend-request');
      if (!compact) add('Block', 'block', 'social-button social-danger');
    }
    if (!compact || filter === 'ignored') add(relation.ignored ? 'Unignore' : 'Ignore', relation.ignored ? 'unignore' : 'ignore');
  }
  function renderFriends() {
    errorLine.textContent = failure;
    const count = [...relationships.values()].filter(value => value.friend === 'incoming').length;
    const counter = document.querySelector('[data-request-count]'); counter.textContent = count; counter.hidden = !count;
    list.replaceChildren();
    const entries = [...relationships.values()].filter(value => filter === 'pending' ? ['incoming', 'outgoing'].includes(value.friend) : ['blocked', 'ignored'].includes(filter) ? value[filter] : value.friend === 'accepted');
    if (!entries.length) list.append(node('p', 'friends-empty', !loaded ? 'Loading relationships…' : {accepted: 'No friends yet.', pending: 'No pending requests.', blocked: 'No blocked accounts.', ignored: 'No ignored accounts.'}[filter]));
    for (const relation of entries) {
      const member = members().find(value => value.uid === relation.uid) || relation.member;
      const row = node('article', 'friend-row');
      const profile = button('', () => void open(member), 'friend-identity');
      profile.disabled = false; profile.append(avatar(member, member.online));
      const copy = node('span', 'friend-copy'); copy.append(name(member));
      copy.append(node('small', '', relation.friend === 'incoming' ? 'Incoming request' : relation.friend === 'outgoing' ? 'Request sent' : member.handle || ''));
      profile.append(copy); row.append(profile);
      const controls = node('div', 'friend-actions'); actions(member, controls, true); row.append(controls); list.append(row);
    }
    if (failure) {const retry = button('Retry', () => void refresh()); retry.disabled = false; list.append(retry);}
  }
  function renderProfile(member) {
    content.replaceChildren(); content.className = '';
    // Preserve the existing cosmetic overlay, including animated profile effects.
    if (/^fx-[a-z0-9-]+$/.test(member.profileEffect || '')) {
      content.className = 'nyx-user-profile-effect-' + member.profileEffect;
      const artwork = node('i', 'nyx-user-profile-effect'); artwork.setAttribute('aria-hidden', 'true'); content.append(artwork);
    }
    const banner = node('div', 'member-card-banner');
    if (/^#[0-9a-f]{6}$/i.test(member.bannerColor || '')) banner.style.backgroundColor = member.bannerColor;
    if (member.bannerUrl) {
      try {
        const url = new URL(member.bannerUrl, location.origin);
        if (['http:', 'https:'].includes(url.protocol) || /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(member.bannerUrl)) {
          const image = node('img', 'member-banner-image'); image.alt = ''; image.src = url.href;
          image.addEventListener('error', () => image.remove(), {once: true}); banner.append(image);
        }
      } catch {}
    }
    const body = node('div', 'member-card-body'); body.append(avatar(member, member.online));
    const title = node('div', 'member-card-title'); const heading = node('h2', ''); heading.append(name(member)); title.append(heading);
    if (member.role && member.role !== 'member') title.append(node('span', 'profile-role', member.roleLabel || member.role.replaceAll('_', ' ')));
    if (member.caffeine) title.append(badge());
    body.append(title, node('p', 'member-handle', member.handle || ''));
    if (member.customStatus) body.append(node('p', 'member-status', member.customStatus));
    if (member.bio) body.append(node('p', 'member-bio', member.bio));
    const date = new Date(member.createdAt);
    if (Number.isFinite(date.getTime())) body.append(node('p', 'member-joined', 'Joined ' + date.toLocaleDateString(undefined, {month: 'long', year: 'numeric'})));
    const status = node('p', 'profile-status', member.loading ? 'Loading profile…' : member.profileError || ''); status.setAttribute('role', 'status'); body.append(status);
    if (member.profileError) {const retry = button('Retry profile', () => void open(member)); retry.disabled = false; body.append(retry);}
    if (member.uid !== me()?.uid) {
      const dm = button('Message', () => {friends.close(); void startDm(member);}, 'member-dm-button');
      dm.disabled = !canMessage(member.uid) || busy; body.append(dm);
      const controls = node('div', 'member-social-actions'); actions(member, controls); body.append(controls);
      const relation = relationships.get(member.uid);
      if (relation?.blocked) body.append(node('p', 'member-social-hint', 'Blocked. Direct messages and friend requests are disabled.'));
      else if (relation?.ignored) body.append(node('p', 'member-social-hint', 'Ignored. Their messages and notifications are hidden for you.'));
      else if (relation?.canMessage === false) body.append(node('p', 'member-social-hint', 'Direct messages are unavailable.'));
      const error = node('p', 'profile-status', failure); error.setAttribute('role', 'status'); body.append(error);
      if (!loaded && failure) {const retry = button('Retry relationships', () => void refresh().then(() => current && renderProfile(current))); retry.disabled = false; body.append(retry);}
    }
    content.append(banner, body);
  }
  async function open(member) {
    if (!member?.uid) return;
    if (owner !== me()?.uid) reset();
    const ticket = ++generation; current = {...member, loading: true, profileError: ''}; renderProfile(current);
    closeDrawers(); if (!dialog.open) dialog.showModal(); void refresh();
    try {
      const payload = await request('/api/profiles/' + encodeURIComponent(member.uid), {cache: 'no-store'});
      if (ticket !== generation || !dialog.open) return;
      current = {...member, ...payload.profile, uid: member.uid, role: payload.role, roleLabel: payload.roleLabel, customRole: payload.customRole, online: payload.online, createdAt: payload.createdAt};
    } catch (error) {if (ticket !== generation || !dialog.open) return; current = {...member, profileError: error.message || 'Profile unavailable.'};}
    renderProfile(current);
  }
  dialog.addEventListener('close', () => {generation++; current = null;});
  document.querySelector('[data-open-friends]').addEventListener('click', () => {renderFriends(); closeDrawers(); friends.showModal(); void refresh();});
  document.querySelector('[data-friends-close]').addEventListener('click', () => friends.close());
  friends.addEventListener('click', event => {if (event.target === friends) friends.close();});
  document.querySelector('[data-find-friend]').addEventListener('click', () => {friends.close(); document.querySelector('[data-new-dm]').click();});
  document.querySelectorAll('[data-friend-filter]').forEach(control => control.addEventListener('click', () => {
    filter = control.dataset.friendFilter;
    document.querySelectorAll('[data-friend-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === control))); renderFriends();
  }));
  const timer = setInterval(() => {if (!document.hidden && me()?.uid) void refresh();}, 15000);
  window.addEventListener('beforeunload', () => clearInterval(timer), {once: true});
  return {open, refresh, reset, muted, canMessage};
};
