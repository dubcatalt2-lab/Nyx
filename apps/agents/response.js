export async function readResponse(response,onProgress,audioFormat){
 if(!response.ok||!response.headers.get('content-type')?.includes('text/event-stream')){
  const raw=await response.text();let data;
  try{data=JSON.parse(raw);}catch{throw Error(response.status>=500?'The AI service is temporarily unavailable ('+response.status+'). Please retry in a moment.':'The AI service returned an unexpected response. Reload the page and try again.');}
  if(!response.ok)throw Object.assign(new Error(typeof data.error==='string'?data.error:data.error?.message||'AI request failed ('+response.status+').'),{status:response.status,code:data.code});
  return data;
 }
 const reader=response.body.getReader(),decoder=new TextDecoder(),result={text:'',model:'',metadata:{summary:''}};
 let buffer='',finished=false,audioBytes=0,transcript='';const audioParts=[];
 function line(value){
  if(!value.startsWith('data:'))return;
  const raw=value.slice(5).trim();if(!raw)return;if(raw==='[DONE]'){finished=true;return;}
  let event;try{event=JSON.parse(raw);}catch{throw Error('The AI service returned an unreadable reply. Please retry.');}
  if(event.error)throw Error(typeof event.error==='string'?event.error:event.error.message||'The model could not finish its reply.');
  if(event.model)result.model=event.model;
  const delta=event.choices?.[0]?.delta||{},text=delta.content;
  if(audioFormat&&delta.audio?.data){const chunk=Uint8Array.from(atob(delta.audio.data),c=>c.charCodeAt(0));audioBytes+=chunk.length;if(audioBytes>8*1024*1024)throw Error('Voice reply is too large.');audioParts.push(chunk);}
  if(audioFormat&&typeof delta.audio?.transcript==='string')transcript+=delta.audio.transcript;
  if(transcript.length>60000)throw Error('Voice transcript is too long.');
  if(event.choices?.[0]?.finish_reason)result.finishReason=event.choices[0].finish_reason;
  if(typeof text==='string')result.text=event.nyx_replace?text:result.text+text;
  if(event.nyx_metadata?.summary)result.metadata.summary=(result.metadata.summary+event.nyx_metadata.summary).slice(0,2400);
  if(result.text.length>200000)throw Error('This reply is too long. Ask for a shorter answer.');
  if(typeof text==='string'||event.nyx_metadata?.summary)onProgress?.(result);
 }
 try{while(!finished){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});if(buffer.length>1000000)throw Error('The AI response exceeded its size limit.');let index;while((index=buffer.indexOf('\n'))>=0){line(buffer.slice(0,index).trimEnd());buffer=buffer.slice(index+1);if(finished)break;}}
 buffer+=decoder.decode();if(!finished&&buffer.trim())line(buffer.trim());if(!finished)throw Error('The connection ended before the reply finished. Please retry.');if(audioFormat){if(!audioBytes)throw Error('This model returned no audio.');const pcm=audioFormat==='pcm16';if(pcm&&audioBytes%2)throw Error('The voice audio was incomplete.');const bytes=new Uint8Array(audioBytes+(pcm?44:0));if(pcm){const view=new DataView(bytes.buffer),label=(offset,value)=>[...value].forEach((c,i)=>bytes[offset+i]=c.charCodeAt(0));label(0,'RIFF');view.setUint32(4,audioBytes+36,true);label(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,24000,true);view.setUint32(28,48000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);label(36,'data');view.setUint32(40,audioBytes,true);}let offset=pcm?44:0;for(const part of audioParts){bytes.set(part,offset);offset+=part.length;}let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));result.audio={mime:pcm?'audio/wav':'audio/mpeg',data:btoa(binary)};result.text=transcript||result.text;}return result;
 }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
