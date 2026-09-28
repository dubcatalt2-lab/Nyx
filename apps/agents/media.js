export function setupMedia({notice,sizePrompt,canSend,voiceModel}){
 const $=id=>document.getElementById(id),svg=paths=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+paths+'</svg>';
 $('attachImage').innerHTML=svg('<path d="M13 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 3-3 6 6M19 2v6M16 5h6"/>');
 $('dictate').innerHTML=svg('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>');
 $('voice').innerHTML=svg('<path d="M3 10v4M7 6v12M12 3v18M17 6v12M21 10v4"/>');
 $('removeImage').innerHTML=svg('<path d="m6 6 12 12M18 6 6 18"/>');
 let attachment=null,preparing=false,generation=0,recognition=null,conversation=false,speaking=false,paused=false,mode='',base='',transcript='',timer,player=null,playbackUrl='';
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 function status(text=''){ $('voiceStatus').textContent=text;$('voiceStatus').hidden=!text;$('voice').setAttribute('aria-pressed',String(conversation));$('dictate').setAttribute('aria-pressed',String(!!recognition&&mode==='dictation')); }
 function clearImage(){generation++;attachment=null;$('attachment').hidden=true;$('attachmentImage').removeAttribute('src');$('imageInput').value='';}
 async function attach(file){
  if(!file)return;if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)){notice('Choose a PNG, JPEG, WebP or GIF image.');return;}if(file.size>10*1024*1024){notice('Choose an image under 10 MB.');return;}
  const version=++generation;preparing=true;$('attachImage').disabled=true;
  try{const bitmap=await createImageBitmap(file);const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();let dataUrl;for(const quality of [.85,.7,.5,.3]){dataUrl=canvas.toDataURL('image/jpeg',quality);if(dataUrl.length<280000)break;}if(dataUrl.length>=280000)throw Error('This image is too detailed. Crop it or choose a smaller image.');if(version!==generation)return;attachment={dataUrl};$('attachmentImage').src=dataUrl;$('attachmentName').textContent=file.name||'Pasted image';$('attachment').hidden=false;}
  catch(error){notice(error.message||'Could not open that image.');}finally{preparing=false;$('attachImage').disabled=false;}
 }
 $('attachImage').onclick=()=>$('imageInput').click();$('imageInput').onchange=()=>{attach($('imageInput').files[0]);$('imageInput').value='';};$('removeImage').onclick=clearImage;
 $('prompt').addEventListener('paste',event=>{const file=[...event.clipboardData.items].find(item=>item.type.startsWith('image/'))?.getAsFile();if(file){event.preventDefault();attach(file);}});
 function abortRecognition(){const old=recognition;recognition=null;if(old){old.onend=null;old.onresult=null;old.onerror=null;old.abort();}}
 function stopVoice(){conversation=false;paused=false;speaking=false;clearTimeout(timer);abortRecognition();if(player){player.pause();player.removeAttribute('src');player=null;}if(playbackUrl){URL.revokeObjectURL(playbackUrl);playbackUrl='';}status();}
 function listen(kind){
  if(!Recognition){notice('Voice input is unavailable in this browser. Try Chrome or Edge.');return;}
  abortRecognition();mode=kind;base=$('prompt').value;transcript='';const current=new Recognition();recognition=current;current.lang=navigator.language||'en-US';current.continuous=false;current.interimResults=true;
  current.onresult=event=>{if(recognition!==current)return;transcript=Array.from(event.results).map(result=>result[0].transcript).join(' ');$('prompt').value=(base+(base?' ':'')+transcript).slice(0,3500);sizePrompt();};
  current.onerror=event=>{stopVoice();notice(event.error==='not-allowed'?'Microphone permission was denied. Allow it in your browser to use voice.':'Voice input stopped: '+event.error);};
  current.onend=()=>{if(recognition!==current)return;recognition=null;status();if(kind==='conversation'&&conversation){if(transcript.trim()&&canSend()){$('composer').requestSubmit();}else{conversation=false;status();}}};
  try{current.start();status(kind==='conversation'?'Listening — speak your task. Click the waveform to end.':'Listening — your words will appear above.');}catch{stopVoice();notice('Could not start the microphone. Try again.');}
 }
 $('dictate').onclick=()=>{if(recognition&&mode==='dictation'){recognition.stop();return;}stopVoice();listen('dictation');};
 $('voice').onclick=()=>{if(conversation){stopVoice();return;}if(!Recognition){notice('Voice conversation is unavailable in this browser. Try Chrome or Edge.');return;}if(!canSend()){notice('Sign in and select a model first. Computer mode also needs a connected folder.');return;}if(!voiceModel())return;stopVoice();conversation=true;listen('conversation');};
 function resume(){if(conversation&&!paused&&!speaking&&canSend()&&!recognition){clearTimeout(timer);timer=setTimeout(()=>{if(conversation&&!speaking&&canSend())listen('conversation');},250);}}
 function pause(){paused=true;abortRecognition();if(conversation)status('Working — click the waveform to end voice.');}
 function reply(text,audio){if(!conversation)return;if(!audio?.data||audio.mime!=='audio/mpeg'){stopVoice();notice('No model audio was returned. Browser read-aloud is not used.');return;}try{const binary=atob(audio.data),bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));playbackUrl=URL.createObjectURL(new Blob([bytes],{type:audio.mime}));player=new Audio(playbackUrl);speaking=true;player.onended=()=>{speaking=false;URL.revokeObjectURL(playbackUrl);playbackUrl='';player=null;resume();};player.onerror=()=>{stopVoice();notice('Could not play the model voice.');};status('Speaking ? click the waveform to end voice.');player.play().catch(()=>{stopVoice();notice('Audio playback was blocked. Start voice again to retry.');});}catch{stopVoice();notice('The model returned invalid audio.');}}
 window.addEventListener('pagehide',stopVoice);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopVoice();});
 return {voiceActive:()=>conversation,image:()=>attachment,preparing:()=>preparing,clearImage,stopVoice,pause,reply,resume(){paused=false;resume();},reset(){stopVoice();clearImage();}};
}
