import {parentPort} from 'node:worker_threads';
import {script,stylesheet} from './liturgy.mjs';

parentPort.on('message',({kind,text,base,prefix,mode})=>{
  try {
    let output;
    if(kind==='css')output=stylesheet(text,base,prefix);
    else if(kind==='js'){
      try { output=script(text,base,prefix,true); }
      catch { output=script(text,base,prefix,false); }
    }else throw new Error('Unsupported compilation');
    parentPort.postMessage({output});
  }catch(error){parentPort.postMessage({error:{name:error.name,message:error.message}});}
});
