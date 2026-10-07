import {publisherHostAllowed, publisherMode} from './publisher-config.js';
import {createPublisherFrame} from './publisher-frame.js';

export function startSocialSponsor() {
  if (!publisherHostAllowed()) return;
  let placement;
  let host;
  let attempted = false;
  let dismissed = false;
  const style = document.createElement('style');
  style.textContent = '@media(min-width:1200px){.nyx-social-sponsor{right:128px!important}}.nyx-social-sponsor{position:fixed;right:16px;bottom:16px;z-index:1200;width:min(360px,calc(100vw - 32px));border:1px solid #444;border-radius:12px;overflow:hidden;background:#161616;color:#ddd;box-shadow:0 8px 32px #0006;font:11px system-ui}.nyx-social-sponsor:not([data-ready]){visibility:hidden}.nyx-social-sponsor header{display:flex;align-items:center;justify-content:space-between;padding:6px 10px}.nyx-social-sponsor button{border:0;background:transparent;color:inherit;cursor:pointer;width:28px;height:28px}.nyx-social-sponsor svg{width:16px;height:16px}.nyx-social-sponsor iframe{display:block;border:0;width:100%;height:300px}';
  style.textContent += '.nyx-social-creative{height:300px;overflow:hidden}body:has(.workspace-window.workspace-blank .workspace-home:not(.hidden)) .nyx-social-sponsor{width:min(270px,calc(100vw - 32px))}body:has(.workspace-window.workspace-blank .workspace-home:not(.hidden)) .nyx-social-creative{height:225px}body:has(.workspace-window.workspace-blank .workspace-home:not(.hidden)) .nyx-social-sponsor iframe{width:133.333333%;transform:scale(.75);transform-origin:top left}';
  document.head.append(style);
  function clear() {placement?.destroy();placement = null;host?.remove();host = null;}
  function update() {
    if (publisherMode() !== 'adkid') {clear();attempted = false;return;}
    if (document.hidden || dismissed || attempted || !document.body.classList.contains('workspace-shell')) return;
    attempted = true;
    host = document.createElement('aside');
    host.className = 'nyx-social-sponsor';
    host.setAttribute('aria-label', 'Sponsored placement');
    host.innerHTML = '<header><span>Advertisement</span><button type="button" aria-label="Close advertisement"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M6 18 18 6"/></svg></button></header>';
    host.querySelector('button').addEventListener('click', () => {dismissed = true;clear();});
    placement = createPublisherFrame({path:'/apps/sponsor/social.html',width:360,height:300,
      onReady: () => {if (host) host.dataset.ready = 'true';},
      onUnavailable: clear
    });
    const creative = document.createElement('div');
    creative.className = 'nyx-social-creative';
    creative.append(placement.element);
    host.append(creative);
    document.body.append(host);
  }
  window.addEventListener('nyx:publisher-change', update);
  document.addEventListener('visibilitychange', update);
  update();
}
