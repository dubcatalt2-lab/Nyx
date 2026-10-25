function previewPrize(props,cleanup,resolveProps){
 const existing=document.querySelector('[data-nyx-prize-preview]');if(existing)existing.remove();
 const panel=document.createElement('div');panel.setAttribute('data-nyx-prize-preview','');panel.setAttribute('role','status');
 panel.textContent='Upcoming prize: '+props.prize.text;
 Object.assign(panel.style,{position:'fixed',bottom:'16px',left:'50%',transform:'translateX(-50%)',maxWidth:'calc(100vw - 32px)',padding:'12px 16px',background:'#111',color:'#fff',border:'1px solid #555',borderRadius:'8px',font:'14px system-ui',zIndex:'2147483647',pointerEvents:'none'});
 document.body.append(panel);
 const observer=new MutationObserver(()=>{let current;try{current=resolveProps(['prize.text','prize.type','onPrizeClaimed'],true);}catch{}if(!current||current.prize!==props.prize){observer.disconnect();panel.remove();}});
 observer.observe(document.body,{childList:true,subtree:true});cleanup(()=>{observer.disconnect();panel.remove();});
}

async function completePuzzle(resolveProps,schedule,cleanup){
 const paths=['hackType','hackerName','amount','onComplete'],panel=resolveProps(paths);
 await new Promise((resolve,reject)=>{
  let done=false,checks=0;
  const finish=error=>{if(done)return;done=true;error?reject(error):resolve();};
  cleanup(()=>finish(Error('Stopped.')));
  const check=()=>{
   if(done)return;
   try{const current=resolveProps(paths,true);if(!current||current.hackType!==panel.hackType||current.hackerName!==panel.hackerName){finish();return;}}catch(error){finish(error);return;}
   if(++checks>=50){finish(Error('Blooket did not confirm puzzle completion.'));return;}
   schedule(check,100);
  };
  try{panel.onComplete();check();}catch(error){finish(error);}
 });
}
function choosePassword(ask){
 const headers=[...document.querySelectorAll('[class*="introHeader"]')];
 if(!headers.some(el=>el.textContent.includes('WELCOME')))throw Error('Open the initial password selection screen.');
 const buttons=[...document.querySelectorAll('[class*="buttonContainer"] [role="button"]')].filter(el=>el.getClientRects().length);
 if(!buttons.length)throw Error('Wait for the password choices to appear.');
 const answer=ask('Choose one of these passwords:\n'+buttons.map(el=>el.textContent.trim()).join('\n'));
 if(answer===null)return {cancelled:true};
 const matches=buttons.filter(el=>el.textContent.trim()===answer.trim());
 if(matches.length!==1)throw Error('Enter one of the displayed passwords exactly.');
 matches[0].click();
}
async function guessPassword(resolveProps,schedule,unschedule,cleanup){
 const buttons=[...document.querySelectorAll('[class*="buttonContainer"] [role="button"]')].filter(el=>el.getClientRects().length);
 const header=[...document.querySelectorAll('[class*="introHeader"]')].find(el=>el.textContent.trim().startsWith('HACKING '));
 if(!header||!buttons.length)throw Error('Open a player’s password choices first.');
 if(buttons.some(el=>el.className.includes('buttonDeactivated')||getComputedStyle(el).pointerEvents==='none'))throw Error('Wait for the password choices to be ready.');
 const target=header.querySelector('span')?.textContent.trim();
 const {room}=resolveProps(['value.room.state.players','value.userId']).value;
 const players=[...room.state.players.entries()].filter(([,player])=>player.name===target);
 if(!target||players.length!==1)throw Error('This player cannot be identified uniquely. Choose a password in the game.');
 const key=Symbol.for('nyx.blooket.password-learning');
 let memory=window[key];if(!memory||memory.room!==room)window[key]=memory={room,players:new Map()};
 const id=players[0][0],options=buttons.map(el=>el.textContent.trim());
 if(new Set(options).size!==options.length)throw Error('The password choices are ambiguous.');
 let history=memory.players.get(id);
 if(!history)memory.players.set(id,history={rejected:new Set(),possible:null,confirmed:null});
 const possible=options.filter(value=>!history.rejected.has(value)&&(!history.possible||history.possible.has(value)));
 if(!possible.length||(history.confirmed&&!possible.includes(history.confirmed))){memory.players.delete(id);throw Error('The password choices changed. Run again to start fresh.');}
 history.possible=new Set(possible);
 const choice=history.confirmed||possible[Math.floor(Math.random()*possible.length)];
 return await new Promise((resolve,reject)=>{
  let done=false,off,timer;
  const finish=(error,result)=>{if(done)return;done=true;off?.();if(timer)unschedule(timer);error?reject(error):resolve(result);};
  cleanup(()=>finish(Error('Stopped.')));
  off=room.onMessage('passwordGuessResult',result=>{
   if(result.interrupted){finish(Error('The guess was interrupted. No result was saved.'));return;}
   if(typeof result.correct!=='boolean'){finish(Error('The game did not return a guess result.'));return;}
   if(result.correct)history.confirmed=choice;else {history.rejected.add(choice);history.possible.delete(choice);}
   finish(null,{message:result.correct?'Correct. Remembered for this player during this match.':'Incorrect. That choice will be skipped for this player during this match.'});
  });
  timer=schedule(()=>finish(Error('The game did not confirm the guess.')),15000);
  buttons[options.indexOf(choice)].click();
 });
}
export function adaptCryptoAction(path){
 if(path==='crypto/autoGuess.js')return {code:`(${guessPassword.toString()})(resolveBlooketProps,setTimeout,clearTimeout,onBlooketCleanup)`,adapted:0,expected:[],requirements:[{kind:'props',value:['value.room.state.players','value.userId']}],implementation:'native-cyber'};
 if(path==='crypto/choiceESP.js')return {code:`(${previewPrize.toString()})(resolveBlooketProps(["prize.text","prize.type","onPrizeClaimed"]),onBlooketCleanup,resolveBlooketProps)`,adapted:0,expected:[],requirements:[{kind:'props',value:['prize.text','prize.type','onPrizeClaimed']}],implementation:'native-cyber'};
 if(path==='crypto/removeHack.js')return {code:`(${completePuzzle.toString()})(resolveBlooketProps,setTimeout,onBlooketCleanup)`,adapted:0,expected:[],requirements:[{kind:'props',value:['hackType','hackerName','amount','onComplete']}],implementation:'native-cyber'};
 if(path==='crypto/setPassword.js')return {code:`(${choosePassword.toString()})(prompt)`,adapted:0,expected:[],requirements:[{kind:'selector',value:'[class*="buttonContainer"] [role="button"]'}],implementation:'native-cyber'};
 return null;
}
