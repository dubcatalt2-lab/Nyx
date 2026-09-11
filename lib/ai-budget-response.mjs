// Inspect bounded usage metadata while forwarding the same response bytes.
// Missing/incomplete usage retains the full reservation, including disconnects.
export function aiBudgetResponse(response,onComplete) {
  let finished=false,total=0,buffer='',usage=null,failed=false;
  const decoder=new TextDecoder();
  const stream=/text\/event-stream/i.test(response.headers.get('content-type')||'');
  function inspect(value) {
    if(value?.error||value?.type==='error')failed=true;
    const u=value?.usage||value?.x_groq?.usage||value?.response?.usage;
    if(!u)return;
    const input=u.prompt_tokens??u.input_tokens,output=u.completion_tokens??u.output_tokens;
    if(Number.isSafeInteger(input)&&Number.isSafeInteger(output)&&input>=0&&output>=0)usage={input:Math.max(usage?.input||0,input),output:Math.max(usage?.output||0,output),cost:u.cost===undefined?undefined:Number(u.cost)};
  }
  function parse(text) {try {inspect(JSON.parse(text));}catch{}}
  const done=async complete=>{if(finished)return;finished=true;await onComplete(complete&&response.ok&&!failed?usage:null,Boolean(complete&&response.ok&&!failed&&total));};
  if(!response.body){void done(false).catch(()=>{});return response;}
  const reader=response.body.getReader();
  return new Response(new ReadableStream({
    async pull(controller) {
      try {
        const {value,done:ended}=await reader.read();
        if(ended) {
          buffer+=decoder.decode();
          if(stream){if(buffer.startsWith('data:'))parse(buffer.slice(5).trim());}else parse(buffer);
          await done(true);controller.close();return;
        }
        total+=value.byteLength;
        if(total>2*1024*1024)throw new Error('The AI response exceeded its size limit.');
        buffer+=decoder.decode(value,{stream:true});
        if(stream){const lines=buffer.split(/\r?\n/);buffer=lines.pop();for(const line of lines)if(line.startsWith('data:'))parse(line.slice(5).trim());}
        if(buffer.length>2*1024*1024)throw new Error('The AI response exceeded its size limit.');
        controller.enqueue(value);
      } catch(error) {await reader.cancel().catch(()=>{});await done(false).catch(()=>{});controller.error(error);}
    },
    async cancel(reason){await reader.cancel(reason).catch(()=>{});await done(false);}
  }),{status:response.status,statusText:response.statusText,headers:response.headers});
}
