// Only inline raster images are returned; never fetch provider-supplied URLs.
export function aiOutputImages(data) {
  const message=data?.choices?.[0]?.message;
  const supplied=[...(Array.isArray(message?.images)?message.images:[]),...(Array.isArray(message?.content)?message.content.filter(part=>part?.type==='image_url'):[])];
  if(supplied.length>1)throw new Error('The model returned too many images. Ask for one image at a time.');
  return supplied.map(part=>{
    const url=part?.image_url?.url;
    if(typeof url!=='string'||url.length>6*1024*1024)throw new Error('The generated image exceeded its size limit.');
    const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
    if(!match||match[2].length%4)throw new Error('The model returned an unsupported image format.');
    const bytes=Buffer.from(match[2],'base64');
    const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
    if(!valid)throw new Error('The model returned invalid image data.');
    return {dataUrl:url};
  });
}
