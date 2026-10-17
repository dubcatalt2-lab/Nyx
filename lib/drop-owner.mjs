import {AsyncLocalStorage} from 'node:async_hooks';

                                                                                
                                                                                 
export function createDropOwnerScope({verify,env=process.env}) {
  const context=new AsyncLocalStorage();
  return {
    uid:()=>context.getStore()||'',
    async middleware(req,res,next) {
      const uid=String(env.DROP_OWNER_UID||'').trim();
      const drop=req.hostname==='drop.ridgewoodstem.org';
      const protectedRoute=/^\/api\/(?:owner-dashboard|founder-profile\/owner|drop-ai)(?:\/|$)/.test(req.path);
      const token=String(req.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1];
      if(!uid||!drop||!protectedRoute||!token)return next();
      try {
        const identity=await verify(token);
        if(identity?.uid===uid)return context.run(uid,next);
      } catch {                                                                     }
      return next();
    }
  };
}
