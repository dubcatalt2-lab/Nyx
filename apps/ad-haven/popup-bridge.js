window.open = function(url) {
 if (!navigator.userActivation?.isActive) return null;
 let target;try { target=new URL(String(url),location.href); }catch { return null; }
 if(!['https:','http:'].includes(target.protocol))return null;
 parent.postMessage({type:'haven:open',url:target.href},'*');
 return null;
};
