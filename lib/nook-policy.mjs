export const isNookRequest=req=>req.nookAccount===true||['nook.nyxlearning.org','nook.donateyourboat.us'].includes(req.hostname);
