// Self-contained for injection into the pinned provider runtime. Never logs inbox contents.
export async function pollVerificationMailbox(mailJwt, request, options = {}) {
  const now=options.now || Date.now;
  const sleep=options.sleep || (ms=>new Promise(resolve=>setTimeout(resolve,ms)));
  const deadline=now()+(options.timeoutMs ?? 120000);
  const headers={Authorization:`Bearer ${mailJwt}`,Accept:'application/ld+json'};
  let successfulReads=0,hadMessages=false,lastFailure='',failures=0;
  async function read(url){
    let response;
    try{response=await request(url,{headers},Math.max(1,Math.min(20000,deadline-now())));}
    catch{throw new Error('The verification mailbox could not be reached.');}
    if(response.status===401||response.status===403){const error=new Error('The verification mailbox rejected its login.');error.permanent=true;throw error;}
    if(!response.ok)throw new Error(`The verification mailbox returned HTTP ${response.status}.`);
    try{return await response.json();}catch{throw new Error('The verification mailbox returned an unreadable response.');}
  }
  while(now()<deadline){
    try{
      const data=await read('https://api.mail.tm/messages?page=1');
      if(!Array.isArray(data?.['hydra:member']))throw new Error('The verification mailbox returned an unexpected message list.');
      successfulReads++;
      const messages=data['hydra:member'].slice(0,30);hadMessages ||= messages.length>0;
      for(const message of messages){
        if(now()>=deadline)break;
        const id=String(message?.id||'');if(!id)continue;
        const full=await read(`https://api.mail.tm/messages/${encodeURIComponent(id)}`);
        const text=[full.subject,full.text,...(Array.isArray(full.html)?full.html:[full.html])].filter(v=>typeof v==='string').join(' ')
          .replace(/<[^>]*>/g,' ').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi,(_,hex,dec)=>{const n=parseInt(hex||dec,hex?16:10);return n<=0x10ffff?String.fromCodePoint(n):' ';}).replace(/&nbsp;/gi,' ');
        const match=text.match(/(?:^|\D)(\d{6})(?:\D|$)/);if(match)return match[1];
      }
      failures=0;lastFailure='';
    }catch(error){
      if(error.permanent)throw error;
      lastFailure=error.message;failures++;
      if(failures>=3)throw new Error(lastFailure);
    }
    await sleep(Math.max(0,Math.min(failures?5000:2000,deadline-now())));
  }
  if(lastFailure)throw new Error(lastFailure);
  if(!successfulReads)throw new Error('The verification mailbox could not be read.');
  throw new Error(hadMessages?'The provider email arrived, but no verification code could be read.':'The provider verification email did not arrive before the deadline.');
}
