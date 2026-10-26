// No provider is configured. This presentation never grants account entitlements.
export function mountRewardPreview(parent) {
  const button=document.createElement('button');
  button.type='button';button.textContent='Video rewards';button.className='reward-entry';
  const style=document.createElement('style');
  style.textContent=`.reward-entry{margin-top:12px;border:1px solid #ffffff25;border-radius:10px;padding:9px 12px;background:#ffffff08;color:inherit;cursor:pointer;font:inherit}.reward-dialog{box-sizing:border-box;width:min(520px,calc(100vw - 28px));max-height:85vh;overflow:auto;padding:24px;border:1px solid #ffffff25;border-radius:22px;background:#09090deF;backdrop-filter:blur(24px);color:#f7f7fa;font:14px/1.5 system-ui}.reward-dialog::backdrop{background:#0009;backdrop-filter:blur(8px)}.reward-dialog header{display:flex;align-items:center;justify-content:space-between;gap:20px}.reward-dialog h2{margin:0;font-size:22px}.reward-dialog header button{border:1px solid #ffffff25;border-radius:10px;background:#ffffff08;color:inherit;width:34px;height:34px;font-size:22px;cursor:pointer}.reward-dialog>p{color:#b7b7c4}.reward-card{display:flex;align-items:center;gap:16px;border:1px solid #ffffff19;background:#ffffff04;border-radius:14px;padding:16px;margin-top:10px}.reward-card svg{width:32px;height:38px;flex:none;color:#bfaaff}.reward-card strong,.reward-card small{display:block}.reward-card small{color:#a6a6b6;margin-top:3px}.reward-shackle{transform-origin:17px 15px;animation:reward-lock-settle .45s ease-out}.reward-card[data-state=unlocked] .reward-shackle{transform:translateY(-5px) rotate(-28deg);transition:transform .45s ease}.reward-card[data-state=unlocked] svg{color:#8ddbb4}@keyframes reward-lock-settle{from{transform:translateY(-3px)}to{transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.reward-shackle{animation:none!important;transition:none!important}}`;
  document.head.append(style);parent.append(button);
  button.addEventListener('click',()=>{
    const dialog=document.createElement('dialog');dialog.className='reward-dialog';dialog.setAttribute('aria-label','Video rewards');dialog.setAttribute('data-no-interface-text','');
    dialog.innerHTML='<header><h2>Video rewards</h2><button type="button" aria-label="Close video rewards">×</button></header><p>Coming soon. Video rewards aren’t available yet.</p>';
    for(const [title,detail] of [['More AI','Get extra usage after a video.'],['More models','Try more models after a video.'],['A day of Caffeine','Two completed videos · 24 hours']]) {
      const card=document.createElement('div');card.className='reward-card';card.dataset.state='locked';
      card.innerHTML='<svg viewBox="0 0 32 38" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path class="reward-shackle" d="M9 16V10a7 7 0 0 1 14 0v6"/><rect x="4" y="16" width="24" height="18" rx="5"/><path d="M16 23v5"/></svg>';
      const copy=document.createElement('div'),name=document.createElement('strong'),text=document.createElement('small');name.textContent=title;text.textContent=detail;copy.append(name,text);card.append(copy);dialog.append(card);
    }
    dialog.querySelector('button').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{dialog.remove();button.focus();},{once:true});
    document.body.append(dialog);dialog.showModal();
  });
}
