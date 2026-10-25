import React,{useState,useEffect,useRef} from 'react';import {createRoot} from 'react-dom/client';import * as jsx from 'react/jsx-runtime';
const y=React,m=jsx,U=new Proxy({},{get:(_,key)=>String(key)}),An=({name})=><span>{name}</span>,Ke=React.createContext(null);
const _1=({onFinish})=><button onClick={onFinish}>Complete upload</button>;
// CYBER_DEFINITIONS
const GuessPanel=iw;
const nativeComplete=i=>(/* CYBER_CALLBACK */);
const Fishing=(()=>{const p=jsx,Q=({name})=><span>{name}</span>,T=new Proxy({wrapper:'_wrapper_10lfc_1'},{get:(target,key)=>target[key]||String(key)});
// FISHING_DEFINITIONS
return Vd;})();
const listeners=new Map();window.sent=[];
const emit=(name,data)=>{for(const fn of [...(listeners.get(name)||[])])fn(data);};
const room={state:{players:new Map([['target',{name:'Test player'}]])},onMessage(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);return()=>listeners.get(name).delete(fn);}};
const gn=String;window.guessCorrectIndex=1;Math.random=()=>0;
window.listenerCount=()=>listeners.get('passwordGuessResult')?.size||0;
window.setDuplicate=()=>room.state.players.set('duplicate',{name:'Test player'});
window.removeDuplicate=()=>room.state.players.delete('duplicate');
function App(){const [guessKey,setGuessKey]=useState(0);window.nextGuess=()=>setGuessKey(key=>key+1);const [prize,setPrize]=useState(true),[puzzle,setPuzzle]=useState(true);window.clearPrize=()=>setPrize(false);
 const send=(name,data)=>{sent.push({name,data});if(name==='requestHackPasswordOptions')setTimeout(()=>emit('hackPasswordOptions',{passwordIndexes:[0,1,2],targetPlayerName:'Test player'}),0);if(name==='submitPasswordGuess')setTimeout(()=>emit('passwordGuessResult',window.interruptGuess?{interrupted:true}:{correct:data.passwordIndex===window.guessCorrectIndex}),30);if(name==='requestPasswordOptions')setTimeout(()=>emit('passwordOptions',[0,1]),0);if(name==='selectPasswordIndex')setTimeout(()=>emit('passwordSelectionConfirmed'),0);if(name==='completeDefensiveHack'&&!window.denyCompletion)setTimeout(()=>setPuzzle(false),350);};
 const path=location.pathname;
 useEffect(()=>{window.fixtureReady=true;},[]);
 return <Ke.Provider value={{room,send,userId:"self"}}>{path==='/guess'&&<GuessPanel key={guessKey} onComplete={()=>{}}/>}<div id="game-kept">Game remains visible</div>{path==='/preview'&&prize&&<Ew prize={{type:'mult',text:'Triple Crypto',blook:'Brainy Bot'}} onPrizeClaimed={()=>setPrize(false)}/>} {path==='/password'&&<Cw onComplete={()=>{window.passwordDone=true;}}/>} {path==='/puzzle'&&puzzle&&<E1 hackType="upload" hackerName="Fixture player" amount={25} onComplete={nativeComplete(send)}/>} {path==='/fishing'&&<Fishing fish="Crab"/>}</Ke.Provider>;
}
createRoot(document.getElementById('root')).render(<App/>);
