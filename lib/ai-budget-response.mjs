import { aiOutputImages } from './ai-output-images.mjs';
                                                                           
                                                                                
export function aiBudgetResponse(response,onComplete,maxBytes=2*1024*1024) {
  let finished=false,total=0,buffer='',usage=null,failed=false,imageCount=null,answer='',generated=false;
  const decoder=new TextDecoder();
  let inputTokens=null,outputTokens=null,reasoningTokens=null,cachedTokens=null;
  const stream=/text\/event-stream/i.test(response.headers.get('content-type')||'');
  function inspect(value) {
    const content=value?.choices?.[0]?.delta?.content??value?.choices?.[0]?.message?.content??value?.choices?.[0]?.text;
    if(typeof content==='string')answer=(answer+content).slice(0,12001);
    try { imageCount=Math.max(imageCount||0,aiOutputImages(value).length); } catch {}
    const message=value?.choices?.[0]?.delta||value?.choices?.[0]?.message||{};
    if(content?.length||imageCount||message.reasoning||message.reasoning_details?.length||message.tool_calls?.length||message.function_call||message.audio)generated=true;
    if(value?.error||value?.type==='error')failed=true;
    const u=value?.usage||value?.x_groq?.usage||value?.response?.usage||value?.message?.usage;
    if(!u)return;
    const input=u.prompt_tokens??u.input_tokens,output=u.completion_tokens??u.output_tokens;
    if(Number.isSafeInteger(input)&&input>=0)inputTokens=Math.max(inputTokens??0,input);
    if(Number.isSafeInteger(output)&&output>=0)outputTokens=Math.max(outputTokens??0,output);
    const reasoning=u.completion_tokens_details?.reasoning_tokens??u.output_tokens_details?.reasoning_tokens;
    const cached=u.prompt_tokens_details?.cached_tokens??u.input_tokens_details?.cached_tokens;
    if(Number.isSafeInteger(reasoning)&&reasoning>=0)reasoningTokens=Math.max(reasoningTokens??0,reasoning);
    if(Number.isSafeInteger(cached)&&cached>=0)cachedTokens=Math.max(cachedTokens??0,cached);
    if(inputTokens!==null&&outputTokens!==null)usage={input:inputTokens,output:outputTokens,...(reasoningTokens!==null?{reasoning:Math.min(outputTokens,reasoningTokens)}:{}),...(cachedTokens!==null?{cached:Math.min(inputTokens,cachedTokens)}:{}),cost:u.cost===undefined?usage?.cost:Number(u.cost),...(Number.isSafeInteger(u.server_tool_use?.web_search_requests)?{webSearches:u.server_tool_use.web_search_requests}:usage?.webSearches!==undefined?{webSearches:usage.webSearches}:{})};
  }
  function parse(text) {try {inspect(JSON.parse(text));}catch{}}
  const done=async complete=>{if(finished)return;finished=true;await onComplete(complete&&response.ok&&!failed?usage:null,Boolean(complete&&response.ok&&!failed&&total),complete?imageCount:null,answer,{refundTokens:Boolean(complete&&(!response.ok||failed)&&!generated&&!(usage?.output>0))});};
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
        if(total>maxBytes)throw new Error('The AI response exceeded its size limit.');
        buffer+=decoder.decode(value,{stream:true});
        if(stream){const lines=buffer.split(/\r?\n/);buffer=lines.pop();for(const line of lines)if(line.startsWith('data:'))parse(line.slice(5).trim());}
        if(buffer.length>maxBytes)throw new Error('The AI response exceeded its size limit.');
        controller.enqueue(value);
      } catch(error) {await reader.cancel().catch(()=>{});await done(false).catch(()=>{});controller.error(error);}
    },
    async cancel(reason){await reader.cancel(reason).catch(()=>{});await done(false);}
  }),{status:response.status,statusText:response.statusText,headers:response.headers});
}
