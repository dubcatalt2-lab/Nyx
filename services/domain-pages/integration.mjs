import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {learningPage} from './pages.mjs';
import {textbookHtml} from './textbook.mjs';
import {normalizeDomain} from './server.mjs';

const defaults=[{hostname:'nyxlearning.org',title:'StudyReady'},{hostname:'www.nyxlearning.org',title:'StudyReady'}];
const assets=new Set(['learning.css','learning.mjs','curriculum.mjs','secondary.mjs','textbook.css']);
const problem=(message,status=400)=>Object.assign(new Error(message),{status});
export function installStudyReady(app,{owner,db,sameOrigin,verifyDns,targetIps,audit=async()=>{},staticRoot,pdfPath=process.env.STUDYREADY_PDF_PATH||'/var/lib/nyx/studyready/textbook.pdf'}){
 let cached,expires=0,pending,version=0,book;
 const reference=store=>store.collection('nyxSiteSettings').doc('studyready');
 const rows=snapshot=>snapshot.exists&&Array.isArray(snapshot.data()?.domains)?snapshot.data().domains:defaults;
 async function domains(){
  if(cached&&Date.now()<expires)return cached;
  if(pending)return pending;
  const generation=version;
  pending=(async()=>{const value=rows(await reference(await db()).get());if(generation===version){cached=value;expires=Date.now()+30000;}return cached||value;})();
  try{return await pending;}finally{pending=null;}
 }
 const secure=res=>res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"});
 const api='/api/owner-dashboard/studyready';
 app.get(api,async(req,res)=>{res.set('Cache-Control','no-store');try{await owner(req);res.json({domains:await domains(),targetIps:targetIps(),nyxPath:'/nyx'});}catch(error){res.status(error.status||503).json({error:error.status?error.message:'StudyReady settings are unavailable.'});}});
 async function change(req,res,remove=false){
  res.set('Cache-Control','no-store');
  if(!sameOrigin(req))return res.status(403).json({error:'Cross-origin requests are not allowed.'});
  try{
   const context=await owner(req),hostname=normalizeDomain(remove?req.params.hostname:req.body?.hostname,{allowPrimary:true});
   const title=String(req.body?.title||'StudyReady').trim();if(!remove&&(!title||title.length>80))throw problem('Use a title between 1 and 80 characters.');
   const next=await context.firebase.firestore.runTransaction(async tx=>{
    const ref=reference(context.firebase.firestore),current=rows(await tx.get(ref));
    if(remove&&!current.some(row=>row.hostname===hostname))throw problem('That domain is not configured.',404);
    const result=current.filter(row=>row.hostname!==hostname);if(!remove)result.push({hostname,title});
    if(result.length>100)throw problem('You can configure up to 100 domains.',409);
    tx.set(ref,{domains:result,updatedBy:context.token.uid,updatedAt:new Date().toISOString()});return result;
   });
   version++;cached=next;expires=Date.now()+30000;
   await audit(context,{action:remove?'studyready_domain_removed':'studyready_domain_saved',details:{hostname,title:remove?undefined:title}});
   res.json({domains:next,targetIps:targetIps()});
  }catch(error){res.status(error.status||(error.code?503:400)).json({error:error.code?'Could not save StudyReady settings.':error.message});}
 }
 app.post(api,(req,res)=>change(req,res));
 app.delete(api+'/:hostname',(req,res)=>change(req,res,true));
 app.post(api+'/:hostname/check',async(req,res)=>{
  res.set('Cache-Control','no-store');if(!sameOrigin(req))return res.status(403).json({error:'Cross-origin requests are not allowed.'});
  try{await owner(req);const hostname=normalizeDomain(req.params.hostname,{allowPrimary:true});if(!(await domains()).some(row=>row.hostname===hostname))throw problem('Add this domain first.',404);const ips=await verifyDns(hostname),targets=targetIps();res.json({hostname,resolvedIps:ips,matches:ips.some(ip=>targets.includes(ip)),targetIps:targets});}catch(error){res.status(error.status||503).json({error:error.status?error.message:'DNS could not be checked. Try again later.'});}
 });
 app.get(['/nyx','/nyx/'],(req,res)=>{if(req.path.endsWith('/'))return res.redirect(302,'/nyx'+(req.url.includes('?')?req.url.slice(req.url.indexOf('?')):''));res.set('Cache-Control','no-store').sendFile(join(staticRoot,'index.html'),{dotfiles:'allow'});});
 app.use(async(req,res,next)=>{
  const path=req.path;if(!['GET','HEAD'].includes(req.method))return next();
  try{
   if(path==='/studyready'||path==='/studyready/')return secure(res).type('html').send(learningPage({title:String(req.query.title||'StudyReady').slice(0,80)}));
   if(path==='/textbook'){book??=textbookHtml();return secure(res).type('html').send(book);}
   if(path==='/textbook.pdf')return secure(res).type('application/pdf').sendFile(resolve(pdfPath),{dotfiles:'allow'},error=>{if(error&&!res.headersSent)res.status(404).type('text').send('The PDF is unavailable. Read the book at /textbook.');});
   if(path.startsWith('/learning/')){const name=path.slice('/learning/'.length);if(!assets.has(name))return res.status(404).end();const content=await readFile(new URL('./'+name,import.meta.url),'utf8');return secure(res).type(name.endsWith('.css')?'text/css':'text/javascript').send(content);}
   if(!['/','/robots.txt'].includes(path))return next();
   // These hosts retain their existing Tutsi shell and crawler policy.
   if(['tutsi.nyxlearning.org','childsupport.donateyourboat.us','turn.nyxlearning.org'].includes(req.hostname))return next();
   const domain=(await domains()).find(row=>row.hostname===req.hostname.toLowerCase());if(!domain)return next();
   if(path==='/robots.txt')return secure(res).type('text').send('User-agent: *\nAllow: /\n');
   return secure(res).type('html').send(learningPage(domain));
  }catch{res.status(503).set('Cache-Control','no-store').type('text').send('StudyReady is temporarily unavailable. Please try again.');}
 });
}
