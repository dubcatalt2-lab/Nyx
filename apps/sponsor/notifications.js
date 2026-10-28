(() => {
 const button=document.querySelector('button'),status=document.querySelector('[role="status"]');
 if(!window.isSecureContext||!('Notification' in window)){button.disabled=true;status.textContent='Notifications are not available in this br00ser.';return;}
 if(Notification.permission==='denied'){button.disabled=true;status.textContent='Notifications are blocked in your br00ser settings.';return;}
 button.addEventListener('click',event=>{
  if(!event.isTrusted||button.disabled)return;button.disabled=true;
  const script=document.createElement('script');script.src='https://5gvci.com/act/files/tag.min.js?z=12141239';script.dataset.cfasync='false';script.async=true;
  script.onload=()=>{status.textContent=Notification.permission==='granted'?'Notifications are allowed for this site.':'Use the notification prompt to finish.';};
  script.onerror=()=>{status.textContent='The notification service could not load.';};
  status.textContent='Opening notification setup...';document.head.append(script);
 });
 button.disabled=false;
})();
