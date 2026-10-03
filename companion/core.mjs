import {createServer} from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {lstat,realpath,readdir,readFile,writeFile,mkdir,unlink,rename} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';

const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const hidden=name=>/^(?:\.git|\.env(?:\..*)?|\.ssh|\.aws|\.azure|node_modules|\.nyx-agent)$/i.test(name)||/\.(pem|key|pfx|p12)$/i.test(name);
export async function createCompanion({workspace,origin='https://nook.nyxlearning.org',approve,run=runCommand,port=6768}){
  const root=await realpath(workspace);
  if(!(await lstat(root)).isDirectory()||root===path.parse(root).root||root===os.homedir())throw fail('Choose a project folder, not your entire drive or home folder.');
  const allowed=new URL(origin);
  if(allowed.origin!==origin||!(allowed.protocol==='https:'||allowed.protocol==='http:'&&['localhost','127.0.0.1'].includes(allowed.hostname)))throw fail('Invalid interface origin.');
  if(typeof approve!=='function')throw fail('Desktop approval is required.');
  const token=randomBytes(32).toString('hex');
  let busy=false,active=null,connected=false;
  const changes=[];
  const backupRoot=await import('node:fs/promises').then(fs=>fs.mkdtemp(path.join(os.tmpdir(),'nyx-agent-')));
  await import('node:fs/promises').then(fs=>fs.chmod(backupRoot,0o700));
  async function resolveFile(relative,{missing=false}={}){
    if(typeof relative!=='string'||relative.length>500||/[\x00-\x1f:\\]/.test(relative)||path.isAbsolute(relative))throw fail('Use a relative path with forward slashes.');
    const parts=relative.split('/').filter(Boolean);
    if(parts.some(part=>part==='..'||part==='.'||part.endsWith('.')||part.endsWith(' ')||hidden(part)||/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(part)))throw fail('That path is outside the allowed workspace files.');
    let current=root;
    for(let i=0;i<parts.length;i++){
      current=path.join(current,parts[i]);
      try{const info=await lstat(current);if(info.isSymbolicLink()||info.nlink>1&&!info.isDirectory())throw fail('Links are not available to the agent.');const actual=await realpath(current);if(actual!==root&&!actual.startsWith(root+path.sep))throw fail('Path leaves the workspace.');}
      catch(error){if(error.code==='ENOENT'&&missing&&i===parts.length-1)break;throw error;}
    }
    return current;
  }
  async function read(relative){const file=await resolveFile(relative),info=await lstat(file);if(!info.isFile()||info.size>256000)throw fail('Choose a text file smaller than 256 KB.');const bytes=await readFile(file);if(bytes.includes(0))throw fail('Binary files cannot be edited.');return {path:relative,content:bytes.toString('utf8'),hash:hash(bytes)};}
  async function list(relative=''){const dir=await resolveFile(relative),items=await readdir(dir,{withFileTypes:true});return {path:relative,entries:items.filter(item=>!hidden(item.name)&&!item.isSymbolicLink()).slice(0,500).map(item=>({name:item.name,path:[relative,item.name].filter(Boolean).join('/'),directory:item.isDirectory()})).sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name))};}
  async function action(body,signal){
    const {tool,args={}}=body;
    if(tool==='list')return list(args.path||'');
    if(tool==='read')return read(args.path);
    if(tool==='search'){
      const query=String(args.query||'');if(!query||query.length>200)throw fail('Enter a search of 1–200 characters.');
      const matches=[];let scanned=0;const scan=async(dir,depth)=>{if(depth>8||scanned>=500||matches.length>=50)return;for(const item of (await list(dir)).entries){if(signal.aborted)throw fail('Stopped.');if(item.directory)await scan(item.path,depth+1);else{if(++scanned>500)break;try{const file=await read(item.path);file.content.split('\n').forEach((line,index)=>{if(matches.length<50&&line.toLowerCase().includes(query.toLowerCase()))matches.push({path:item.path,line:index+1,text:line.slice(0,300)});});}catch{}}}};await scan('',0);return {matches,scanned,limited:scanned>=500||matches.length>=50};
    }
    if(tool==='command'){
      const command=String(args.command||'');if(!command.trim()||command.length>6000)throw fail('Command must contain 1–6000 characters.');
      const cwd=await resolveFile(args.cwd||'');if(!(await lstat(cwd)).isDirectory())throw fail('Working directory is not a folder.');
      if(!await approve({title:'Run command?',text:`Folder: ${cwd}\n\n${command}\n\nCommands run with your Windows permissions and can access files outside this folder. Only allow a command you understand.`},signal))return {denied:true};
      if(signal.aborted)throw fail('Stopped.');return run(command,cwd,signal);
    }
    if(tool==='write'||tool==='delete'){
      const file=await resolveFile(args.path,{missing:tool==='write'});if(file===root)throw fail('Choose a file.');
      let previous=null;try{previous=await read(args.path);}catch(error){if(error.code!=='ENOENT')throw error;}
      if((previous?.hash||null)!==(args.expectedHash??null))throw fail('File changed since it was read. Read it again before editing.',409);
      if(tool==='delete'&&!previous)throw fail('File does not exist.');
      const content=tool==='write'?args.content:null;if(tool==='write'&&(typeof content!=='string'||Buffer.byteLength(content)>256000||content.includes('\0')))throw fail('Invalid text file.');
      if(previous?.content===content)return {unchanged:true};
      if(changes.length>=100)throw fail('This session has reached 100 edits. Restart the companion to continue.');
      const preview=(content??'[delete file]').slice(0,1800);
      if(!await approve({title:tool==='delete'?'Delete file?':'Save file?',text:`${args.path}\n\n${preview}${content?.length>1800?'\n\n[Preview shortened — inspect the full change in Nook.]':''}`},signal))return {denied:true};
      if(signal.aborted)throw fail('Stopped.');
      await resolveFile(args.path,{missing:tool==='write'});
      let current=null;try{current=await read(args.path);}catch(error){if(error.code!=='ENOENT')throw error;}
      if(current?.hash!==previous?.hash)throw fail('File changed while approval was open. Read it again.',409);
      const id=randomBytes(12).toString('hex'),backup=path.join(backupRoot,id);
      if(previous)await writeFile(backup,previous.content,{mode:0o600,flag:'wx'});
      if(tool==='delete')await unlink(file);else await writeFile(file,content,{flag:previous?'w':'wx'});
      const change={id,path:args.path,before:previous?.hash||null,after:content===null?null:hash(content),backup:previous?backup:null};changes.push(change);
      return {changed:true,id,path:args.path,hash:change.after};
    }
    if(tool==='undo'){
      const change=changes.find(item=>item.id===args.id);if(!change||change.undone)throw fail('Backup not available in this session.');
      const file=await resolveFile(change.path,{missing:true});let current=null;try{current=await read(change.path);}catch(error){if(error.code!=='ENOENT')throw error;}
      if((current?.hash||null)!==change.after)throw fail('File changed after this edit. Undo would overwrite newer work.',409);
      if(!await approve({title:'Undo edit?',text:change.path},signal))return {denied:true};
      if(signal.aborted)throw fail('Stopped.');
      await resolveFile(change.path,{missing:true});let fresh=null;try{fresh=await read(change.path);}catch(error){if(error.code!=='ENOENT')throw error;}if((fresh?.hash||null)!==change.after)throw fail('File changed during approval.',409);
      if(change.backup)await writeFile(file,await readFile(change.backup),{flag:current?'w':'wx'});else await unlink(file);
      change.undone=true;return {undone:true,path:change.path};
    }
    throw fail('Unknown tool.');
  }
  const server=createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
    if(req.headers.host!==`127.0.0.1:${server.address().port}`||req.headers.origin!==origin)return send(403,{error:'Origin not allowed.'});
    res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
    if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Private-Network','true');return send(200,{});}
    const supplied=Buffer.from(String(req.headers.authorization||'').replace(/^Bearer /,'')),expected=Buffer.from(token);
    if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return send(401,{error:'Reconnect from the companion launcher.'});
    try{
      if(req.method==='POST'&&req.url==='/stop'){active?.abort();return send(200,{stopped:true});}
      if(req.method==='GET'&&req.url==='/status')return send(200,{connected,workspace:path.basename(root),platform:process.platform,busy,changes:changes.map(({backup,...item})=>item)});
      if(req.method!=='POST'||!['/connect','/tool'].includes(req.url))return send(404,{error:'Not found.'});
      if(busy)return send(409,{error:'Another action is still running.'});busy=true;active=new AbortController();
      try{
        if(req.url==='/connect'){if(!connected)connected=await approve({title:'Connect Nook?',text:`${origin}\n\nWorkspace: ${root}\n\nAllow this session to read project files? Files the agent reads are sent to your selected AI provider. File changes and commands ask separately.`},active.signal);return send(200,{connected});}
        if(!connected)throw fail('Connect the companion first.',403);
        let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>400000)throw fail('Request too large.',413);}
        const result=await action(JSON.parse(raw),active.signal);send(200,result);
      }finally{busy=false;active=null;}
    }catch(error){send(error.status||400,{error:error.code==='ENOENT'?'File not found.':error.message});}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {server,token,port:server.address().port,backupRoot,close:async()=>{active?.abort();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}

export function runCommand(command,cwd,signal){
  return new Promise((resolve,reject)=>{
    const args=process.platform==='win32'?['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')]:['-lc',command];
    const child=spawn(process.platform==='win32'?'powershell.exe':'/bin/sh',args,{cwd,windowsHide:true,detached:process.platform!=='win32',env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!/TOKEN|SECRET|PASSWORD|API_KEY|CREDENTIAL/i.test(key)))});
    let output='',stopped=false;const stop=()=>{stopped=true;if(process.platform==='win32')spawn('taskkill',['/pid',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else try{process.kill(-child.pid,'SIGKILL');}catch{}};
    const timer=setTimeout(stop,60000);signal.addEventListener('abort',stop,{once:true});
    for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output+=chunk.toString();if(output.length>16000){output=output.slice(0,16000);stop();}});
    const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',stop);};child.once('error',error=>{cleanup();reject(error);});child.once('close',code=>{cleanup();resolve({output,exitCode:code,stopped});});if(signal.aborted)stop();
  });
}
