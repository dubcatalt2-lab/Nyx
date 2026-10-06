// libcurl.js resolves fetch on the first chunk, but closes the body even when
// the transfer later fails. Preserve that result for consumers and rewriters.
export function preserveTransferErrors(session){
  const original=session.stream_response;
  session.stream_response=function(url,onHeaders,onEnd,signal){
    let complete;
    const completion=new Promise(resolve=>{complete=resolve;});
    return original.call(this,url,stream=>{
      const reader=stream.getReader();
      onHeaders(new ReadableStream({
        async pull(controller){
          try{
            const item=await reader.read();
            if(!item.done){controller.enqueue(item.value);return;}
            const code=await completion;
            if(code===-1 || signal?.aborted) throw signal?.reason || new DOMException('The operation was aborted.','AbortError');
            if(code!==0) throw new TypeError(`Request failed with error code ${code}: incomplete libcurl transfer`);
            controller.close();
          }catch(error){controller.error(error);}
        },
        cancel(reason){return reader.cancel(reason);}
      },{highWaterMark:0}));
    },code=>{complete(code);onEnd(code);},signal);
  };
}

const responseLimit=16*1024*1024;
export const bufferLimit=32*1024*1024;
const retryable=error=>/\berror code (?:18|52|56|92)\b/i.test(String(error?.message || error));
const rewriteable=headers=>headers.some(([key,value])=>key.toLowerCase()==='content-type'
  && /^(?:(?:text|application)\/(?:x-)?(?:javascript|ecmascript)|(?:text|application)\/(?:[\w.+-]+\+)?json|text\/html|application\/xhtml\+xml)$/i.test(String(value).split(';')[0].trim()));

async function validatedBody(body,budget){
  const reader=body.getReader(),chunks=[];
  let size=0;
  const release=()=>{budget.bytes-=size;size=0;chunks.length=0;};
  try{
    for(;;){
      const item=await reader.read();
      if(item.done){
        const result=new Blob(chunks).stream();
        release();
        return result;
      }
      if(size+item.value.byteLength>responseLimit || budget.bytes+item.value.byteLength>bufferLimit){
        // Above the buffering bounds, preserve streaming without a body retry:
        // replaying after exposing the prefix would duplicate bytes.
        let pending=item.value;
        return new ReadableStream({
          async pull(controller){
            try{
              if(chunks.length){const chunk=chunks.shift();size-=chunk.byteLength;budget.bytes-=chunk.byteLength;controller.enqueue(chunk);return;}
              if(pending){controller.enqueue(pending);pending=null;return;}
              const next=await reader.read();
              if(next.done) controller.close();else controller.enqueue(next.value);
            }catch(error){release();controller.error(error);}
          },
          cancel(reason){release();pending=null;return reader.cancel(reason);}
        },{highWaterMark:0});
      }
      chunks.push(item.value);size+=item.value.byteLength;budget.bytes+=item.value.byteLength;
    }
  }catch(error){
    release();
    void reader.cancel(error).catch(()=>{});
    throw error;
  }
}

export async function requestWithTransferRetry(request,{method,body,signal,budget}){
  const safe=/^(?:GET|HEAD)$/i.test(method || 'GET') && body==null;
  for(let attempt=0;;attempt++){
    signal?.throwIfAborted();
    try{
      const response=await request();
      if(safe && response.body?.getReader && rewriteable(response.headers)){
        return {...response,body:await validatedBody(response.body,budget)};
      }
      return response;
    }catch(error){
      if(!safe || attempt>=1 || signal?.aborted || !retryable(error)) throw error;
    }
  }
}
