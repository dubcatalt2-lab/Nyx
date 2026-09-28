export async function readResponse(response,onProgress){
 if(!response.ok||!response.headers.get('content-type')?.includes('text/event-stream')){
  const raw=await response.text();let data;
  try{data=JSON.parse(raw);}catch{throw Error(response.status>=500?'The AI service is temporarily unavailable ('+response.status+'). Please retry in a moment.':'The AI service returned an unexpected response. Reload the page and try again.');}
  if(!response.ok)throw Error(typeof data.error==='string'?data.error:data.error?.message||'AI request failed ('+response.status+').');
  return data;
 }
 const reader=response.body.getReader(),decoder=new TextDecoder(),result={text:'',model:'',metadata:{summary:''}};
 let buffer='',finished=false;
 function line(value){
  if(!value.startsWith('data:'))return;
  const raw=value.slice(5).trim();if(!raw)return;if(raw==='[DONE]'){finished=true;return;}
  let event;try{event=JSON.parse(raw);}catch{throw Error('The AI service returned an unreadable reply. Please retry.');}
  if(event.error)throw Error(typeof event.error==='string'?event.error:event.error.message||'The model could not finish its reply.');
  if(event.model)result.model=event.model;
  const text=event.choices?.[0]?.delta?.content;
  if(typeof text==='string')result.text=event.nyx_replace?text:result.text+text;
  if(event.nyx_metadata?.summary)result.metadata.summary=(result.metadata.summary+event.nyx_metadata.summary).slice(0,2400);
  if(result.text.length>200000)throw Error('This reply is too long. Ask for a shorter answer.');
  if(typeof text==='string'||event.nyx_metadata?.summary)onProgress?.(result);
 }
 try{while(!finished){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});if(buffer.length>1000000)throw Error('The AI response exceeded its size limit.');let index;while((index=buffer.indexOf('\n'))>=0){line(buffer.slice(0,index).trimEnd());buffer=buffer.slice(index+1);if(finished)break;}}
 buffer+=decoder.decode();if(!finished&&buffer.trim())line(buffer.trim());if(!finished)throw Error('The connection ended before the reply finished. Please retry.');return result;
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
