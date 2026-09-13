import sharp from 'sharp';

// Normalize actual pixels server-side; never trust client dimension metadata.
// Keep one still frame, bound decoder work, strip metadata, preserve small text.
export async function aiImageContent(image,prompt,model) {
  if(!model?.vision)throw Object.assign(new Error('This model cannot read images. Choose Gemini 2.5 Flash Lite or GPT-5.6 Luna (Vision) and send the image again.'),{status:400});
  if(!Buffer.isBuffer(image?.buffer)||!image.buffer.length||image.buffer.length>1100000)throw Object.assign(new Error('That image is too large or unavailable.'),{status:413});
  let buffer;
  try {
    const input=sharp(image.buffer,{limitInputPixels:25000000,pages:1,failOn:'warning'});
    const metadata=await input.metadata();
    if(!['png','jpeg','webp','gif'].includes(metadata.format))throw new Error('Unsupported image');
    buffer=await input.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true})
      .flatten({background:'#ffffff'}).jpeg({quality:90,chromaSubsampling:'4:4:4'}).timeout({seconds:10}).toBuffer();
    if(buffer.length>3000000)throw new Error('Image too large');
  } catch {throw Object.assign(new Error('Nyx could not decode that image. Try a PNG or JPEG screenshot.'),{status:400});}
  return [{type:'text',text:prompt||'Read this image carefully and answer the question.'},
    {type:'image_url',image_url:{url:`data:image/jpeg;base64,${buffer.toString('base64')}`,detail:'high'}}];
}
