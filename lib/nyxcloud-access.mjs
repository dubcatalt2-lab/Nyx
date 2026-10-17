import express from 'express';

// A separate capability from staff roles or remote access to a physical PC.
export const nyxCloudOwnerUid='3158eOj4ATMzkoC1PAm8H7TXc2R2';
export const hasNyxCloudAccess=identity=>identity?.uid===nyxCloudOwnerUid;

export function createNyxCloudAccess({firebase}){
  const router=express.Router();
  router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.get('/access',async(req,res)=>{
    try{
      const token=String(req.get('authorization')||'').match(/^Bearer (.{1,8192})$/)?.[1];
      if(!token)throw Error('Missing session');
      const identity=await (await firebase()).auth.verifyIdToken(token,true);
      if(!hasNyxCloudAccess(identity))throw Error('Not available');
      res.json({allowed:true,available:false,status:'reserved'});
    }catch{
      res.status(404).json({error:'Not available.'});
    }
  });
  // Reserving access must not create an unauthenticated VM launch/connect API.
  router.use((_req,res)=>res.status(404).json({error:'Not available.'}));
  return router;
}
