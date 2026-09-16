import assert from 'node:assert/strict';
import express from 'express';
import {chromium} from 'playwright';
const app=express();app.use(express.static(process.env.NYX_TEST_ASSET_ROOT||'.'));
const server=app.listen(0);await new Promise(r=>server.once('listening',r));
const origin='http://localhost:'+server.address().port,browser=await chromium.launch();
const sources=[{id:'aniembed',name:'AniEmbed',url:'https://aniembed.se/e/154587/1?lang=sub&autoplay=1&t=0'},{id:'rive',name:'Rive',url:'https://watch.rivestream.app/embed?type=tv&id=209867&season=1&episode=1'}];
try{
 const p=await browser.newPage();await p.clock.install();
 await p.addInitScript(()=>localStorage.setItem('nyx.movies.preferredSource','aniembed'));
 await p.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(u.hostname==='aniembed.se')return r.fulfill({contentType:'text/html',body:'<button>Play</button>'});
  if(u.origin!==origin)return r.abort();
  if(u.pathname==='/apps/movies/proxy.mjs')return r.fulfill({contentType:'application/javascript',body:`export async function launchMovieProxy(frame,url){window.fallbackUrl=url;frame.src='/fixture';} export function inspectMovieProxy(){return {};} export function styleMovieVideo(){return ()=>{};} export function startMovieProxy(){} export function canStartMovieProxy(){return false;}`});
  if(u.pathname==='/fixture')return r.fulfill({contentType:'text/html',body:'Fallback player'});
  if(u.pathname==='/api/movies/tv/209867/season/1/episode/1')return r.fulfill({json:{id:'209867/1/1',kind:'episode',title:'Frieren',tmdbSeriesId:209867,sources}});
  if(u.pathname.startsWith('/api/movies/'))return r.fulfill({json:{results:[]}});
  return r.continue();
 });
 let scenario=0;
 const load=async()=>{await p.goto(origin+'/apps/movies/?scenario='+(++scenario)+'#watch=209867/1/1');await p.frameLocator('#player iframe').getByText('Play',{exact:true}).waitFor();};
 const message=async(name,data={})=>p.frames().find(f=>f.url().startsWith('https://aniembed.se/')).evaluate(({name,data})=>parent.postMessage({source:'aniembed',version:1,type:'event',name,data},'*'),{name,data});
 await load();assert.equal(await p.locator('[data-provider=aniembed]').count(),1);
 assert.equal(await p.locator('#player iframe').getAttribute('sandbox'),'allow-scripts allow-same-origin allow-forms allow-presentation');
 await p.evaluate(()=>dispatchEvent(new MessageEvent('message',{source:document.querySelector('#player iframe').contentWindow,origin:'https://evil.test',data:{type:'error'}})));
 assert.equal(await p.evaluate(()=>window.fallbackUrl),undefined);
 await message('progress',{currentTime:1});await message('progress',{currentTime:2});
 await p.waitForFunction(()=>document.querySelector('[data-provider=aniembed]').closest('li').dataset.state==='Playing');
 await p.clock.fastForward(46000);assert.equal(await p.evaluate(()=>window.fallbackUrl),undefined,'Measured playback cancels startup timeout');
 await message('error');await p.waitForFunction(()=>window.fallbackUrl);assert.equal(await p.evaluate(()=>window.fallbackUrl),sources[1].url);
 await load();await p.clock.fastForward(46000);await p.waitForFunction(()=>window.fallbackUrl);assert.equal(await p.evaluate(()=>window.fallbackUrl),sources[1].url,'No-play timeout advances to the next source');
 await p.locator('#close-player').click({force:true});assert.equal(await p.locator('#player iframe').count(),0);
 console.log('PASS AniEmbed source choice, sandbox, trusted progress, error/timeout fallback and cleanup');
}finally{await browser.close();await new Promise(r=>server.close(r));}
