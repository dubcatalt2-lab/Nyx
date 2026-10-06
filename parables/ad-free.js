const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${{
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  key:'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-5-5 3-3m0 6 3-3"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  revoke:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
  add:'<path d="M12 4v16M4 12h16"/>'
}[name] || ''}</svg>`;
const date = ms => ms === 0 ? 'No expiry' : new Date(ms).toLocaleString();

function modal(title, wide = false) {
  document.querySelector('.nyx-adfree-dialog')?.close();
  if (!document.getElementById('nyx-adfree-style')) {
    const style = document.createElement('style');
    style.id = 'nyx-adfree-style';
    style.textContent = `.nyx-adfree-dialog{box-sizing:border-box;width:min(460px,calc(100vw - 32px));max-height:85dvh;margin:auto;padding:24px;border:1px solid var(--obsidian-border,#ffffff24);border-radius:20px;background:var(--obsidian-surface,#181818);color:var(--obsidian-text,#eee);box-shadow:0 24px 100px #0008;font-family:inherit;font-size:14px;line-height:1.5}.nyx-adfree-dialog.wide{width:min(760px,calc(100vw - 32px))}.nyx-adfree-dialog::backdrop{background:#0009;backdrop-filter:blur(5px)}.nyx-adfree-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px}.nyx-adfree-dialog h2{margin:0;font-size:21px}.nyx-adfree-dialog h3{font-size:15px;margin:0}.nyx-adfree-dialog p{color:var(--obsidian-muted,#aaa);overflow-wrap:anywhere}.nyx-adfree-dialog form{display:grid;gap:14px;margin:18px 0}.nyx-adfree-dialog label{display:grid;gap:6px}.nyx-adfree-dialog input,.nyx-adfree-dialog select{box-sizing:border-box;width:100%;min-width:0;padding:10px 12px;background:var(--obsidian-bg,#111);color:inherit;border:1px solid var(--obsidian-border,#ffffff24);border-radius:9px;font:inherit}.nyx-adfree-dialog button{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:9px 13px;border:1px solid var(--obsidian-border,#ffffff24);border-radius:9px;background:var(--obsidian-bg,#111);color:inherit;font:inherit;cursor:pointer}.nyx-adfree-dialog button:disabled{opacity:.5;cursor:wait}.nyx-adfree-dialog button:focus-visible,.nyx-adfree-dialog input:focus-visible,.nyx-adfree-dialog select:focus-visible{outline:2px solid currentColor;outline-offset:2px}.nyx-adfree-dialog article{border-top:1px solid var(--obsidian-border,#ffffff24);padding:18px 0}.nyx-adfree-dialog .adfree-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.nyx-adfree-dialog .adfree-error{color:#ffb4ab}.nyx-adfree-dialog [data-key-result]{padding:14px;border:1px solid var(--obsidian-border,#ffffff24);border-radius:12px}.nyx-adfree-dialog [hidden]{display:none!important}@media(max-width:520px){.nyx-adfree-dialog{padding:18px}.nyx-adfree-dialog .adfree-fields{grid-template-columns:1fr}}`;
    document.head.append(style);
  }
  const previous = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'nyx-adfree-dialog' + (wide ? ' wide' : '');
  dialog.setAttribute('aria-label',title);
  dialog.setAttribute('data-nyx-owned-overlay','');
  dialog.innerHTML = `<header><h2>${esc(title)}</h2><button type="button" data-close aria-label="Close">${icon('close')}</button></header><div data-content></div><p data-status role="status" aria-live="polite"></p>`;
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();},{once:true});
  document.body.append(dialog);
  dialog.showModal();
  return {dialog,content:dialog.querySelector('[data-content]'),status(message,error=false){const el=dialog.querySelector('[data-status]');el.textContent=message;el.classList.toggle('adfree-error',error);}};
}

export async function openAdFreeManager({api}) {
  const {dialog,content,status} = modal('Ad-free keys',true);
  content.innerHTML = `<p>One account per key. Access starts when the key is redeemed or assigned.</p>
    <form data-create><div class="adfree-fields"><label>Label<input name="label" maxlength="80" placeholder="Optional note"></label><label>Duration<select name="durationDays"><option value="7">7 days</option><option value="30" selected>30 days</option><option value="90">90 days</option><option value="365">1 year</option><option value="0">No expiry</option></select></label></div>
    <label>Assign to account ID<input name="uid" maxlength="128" placeholder="Leave empty to make a redeemable key"></label>
    <button type="submit">${icon('add')}Create key</button></form>
    <section data-key-result hidden><p>Copy this key now. It is only shown once.</p><input data-new-key readonly aria-label="New ad-free key"><button type="button" data-copy>${icon('copy')}Copy key</button></section>
    <section data-list></section><button type="button" data-next hidden>Next page</button><button type="button" data-latest hidden>Latest keys</button>`;
  let nextCursor = '';
  let busy = false;
  const list = content.querySelector('[data-list]');
  async function refresh(cursor = '') {
    const result = await api('/api/owner-dashboard/ad-free-keys' + (cursor ? '?cursor='+encodeURIComponent(cursor) : ''));
    if (!dialog.isConnected) return;
    nextCursor = result.nextCursor || '';
    list.innerHTML = result.keys.map(row=>`<article data-key-id="${esc(row.id)}"><h3>${esc(row.label || 'Ad-free key')} · …${esc(row.suffix)}</h3><p>${esc(row.status)} · ${row.durationDays ? `${row.durationDays} days` : 'No expiry'}${row.assignedUid ? `<br>Account: ${esc(row.assignedUid)}<br>${row.expiresAtMs ? 'Ends '+esc(date(row.expiresAtMs)) : 'No expiry'}` : ''}</p>
      ${row.status==='unused'?`<form data-assign><label>Account ID<input name="uid" required maxlength="128"></label><button type="submit">${icon('key')}Assign key</button></form>`:''}
      ${row.status!=='revoked'?`<button type="button" data-revoke>${icon('revoke')}Revoke key</button>`:''}</article>`).join('') || '<p>No keys yet.</p>';
    content.querySelector('[data-next]').hidden = !nextCursor;
    content.querySelector('[data-latest]').hidden = !cursor;
  }
  async function work(button,fn) {
    if (busy) return;
    busy = true;button.disabled = true;status('');
    try {await fn();} catch(error) {status(error.message,true);} finally {busy=false;button.disabled=false;}
  }
  content.addEventListener('submit',event=>{
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    if (form.matches('[data-create]')) void work(button,async()=>{
      const result = await api('/api/owner-dashboard/ad-free-keys',{method:'POST',body:JSON.stringify({label:form.elements.label.value,durationDays:Number(form.elements.durationDays.value),uid:form.elements.uid.value.trim()})});
      if (!dialog.isConnected) return;
      content.querySelector('[data-new-key]').value=result.key;
      content.querySelector('[data-key-result]').hidden=false;
      status(result.assignedUid?'Key created and assigned.':'Key created.');
      await refresh();
    });
    if (form.matches('[data-assign]')) void work(button,async()=>{
      await api(`/api/owner-dashboard/ad-free-keys/${form.closest('[data-key-id]').dataset.keyId}/assign`,{method:'POST',body:JSON.stringify({uid:form.elements.uid.value.trim()})});
      status('Ad-free access assigned.');await refresh();
    });
  });
  content.addEventListener('click',event=>{
    const button = event.target.closest('button');
    if (!button) return;
    if (button.matches('[data-copy]')) void work(button,async()=>{await navigator.clipboard.writeText(content.querySelector('[data-new-key]').value);status('Key copied.');});
    if (button.matches('[data-next]')) void work(button,()=>refresh(nextCursor));
    if (button.matches('[data-latest]')) void work(button,()=>refresh());
    if (button.matches('[data-revoke]')) {
      if (!button.dataset.confirm) {button.dataset.confirm='true';button.textContent='Confirm revocation';return;}
      void work(button,async()=>{await api(`/api/owner-dashboard/ad-free-keys/${button.closest('[data-key-id]').dataset.keyId}/revoke`,{method:'POST',body:'{}'});status('Key revoked.');await refresh();});
    }
  });
  try {await refresh();} catch(error) {status(error.message,true);}
}

export async function openAdFreeRedeem({getToken,onAccount}) {
  const {dialog,content,status} = modal('Ad-free access');
  async function api(path,body) {
    const token = await getToken();
    if (!token) throw new Error('Sign in to redeem a key.');
    const response = await fetch(path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The request failed.');
    return result;
  }
  content.innerHTML = '<p data-access>Checking your account…</p><form><label>Ad-free key<input name="key" required maxlength="80" autocomplete="off" spellcheck="false" placeholder="NYX-ADFREE-…"></label><button type="submit">'+icon('key')+'Redeem key</button></form>';
  const showAccount = account => {
    onAccount(account);
    if (!dialog.isConnected) return;
    content.querySelector('[data-access]').textContent = account.adFree?.active ? 'Ad-free access · '+date(account.adFree.expiresAtMs) : account.publisherMode==='off' ? 'Your account already has ad-free access.' : 'Redeem a key from the owner to turn off Nyx ads.';
    content.querySelector('form').hidden = account.adFree?.active === true;
  };
  content.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();
    const form=event.target,button=form.querySelector('button');
    if(button.disabled)return;
    button.disabled=true;status('');
    try {const result=await api('/api/account/ad-free/redeem',{key:form.elements.key.value});form.reset();showAccount(result);status('Ad-free access is active.');}
    catch(error){status(error.message,true);}finally{button.disabled=false;}
  });
  const initialButton = content.querySelector('form button');
  initialButton.disabled = true;
  try {showAccount(await api('/api/account/me'));} catch(error) {status(error.message,true);} finally {initialButton.disabled=false;}
}
