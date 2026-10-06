import {execFile} from 'node:child_process';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {uptime} from 'node:os';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';

const execute=promisify(execFile);
const stateFile='/run/nyx-health-watchdog/state.json';
export function assessHealth({unit,previous={},now,healthy}){
 const started=Number(unit.ActiveEnterTimestampMonotonic)/1e6;
 const instance=unit.MainPID+':'+unit.ActiveEnterTimestampMonotonic;
 const finite=value=>Number.isFinite(value)&&value>=0;
 const lastRestart=finite(previous.lastRestart)&&previous.lastRestart<=now?previous.lastRestart:null;
 const state={instance,failures:previous.instance===instance&&Number.isInteger(previous.failures)?Math.max(0,Math.min(3,previous.failures)):0,lastRestart};
 if(unit.ActiveState!=='active'||unit.SubState!=='running')return {action:'inactive',state:{...state,failures:0}};
 if(!Number.isFinite(started)||started<=0||now-started<60)return {action:'startup',state:{...state,failures:0}};
 if(healthy)return {action:'healthy',state:{...state,failures:0}};
 state.failures=Math.min(3,state.failures+1);
 if(state.failures<3)return {action:'failed-check',state};
 if(lastRestart!==null&&now-lastRestart<300)return {action:'cooldown',state};
 return {action:'restart',state:{...state,failures:0,lastRestart:now}};
}

export async function probeHealth(url='http://127.0.0.1:8080/healthz',timeout=8000){
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(timeout),redirect:'error',cache:'no-store'});
  if(!response.ok){await response.body?.cancel();return false;}
  const data=await response.json();return data.ok===true&&data.service==='nyx';
 }catch{return false;}
}

async function main(){
 const {stdout}=await execute('/usr/bin/systemctl',['show','nyx.service','--property=ActiveState','--property=SubState','--property=MainPID','--property=ActiveEnterTimestampMonotonic'],{timeout:5000,maxBuffer:16384});
 const unit=Object.fromEntries(stdout.trim().split('\n').map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1)];}));
 let previous={};try{previous=JSON.parse(await readFile(stateFile,'utf8'))||{};}catch{}
 const now=uptime();
 const eligible=unit.ActiveState==='active'&&unit.SubState==='running'&&now-Number(unit.ActiveEnterTimestampMonotonic)/1e6>=60;
 const result=assessHealth({unit,previous,now,healthy:eligible?await probeHealth():false});
 // Persist the cooldown before requesting recovery so an interrupted checker
 // cannot repeatedly restart the application. systemd serializes this unit.
 const temp=stateFile+'.'+process.pid;
 await writeFile(temp,JSON.stringify(result.state),{mode:0o600});await rename(temp,stateFile);
 if(['failed-check','cooldown','restart'].includes(result.action))console.log(JSON.stringify({event:'nyx-health-check',action:result.action,failures:result.state.failures}));
 if(result.action==='restart'){
  // Unlike restart, try-restart leaves a deliberately stopped service stopped.
  await execute('/usr/bin/systemctl',['try-restart','--no-block','nyx.service'],{timeout:5000,maxBuffer:16384});
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error('Nyx health checker failed:',error.code||error.name);process.exitCode=1;});
