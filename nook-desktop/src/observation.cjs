function observation(value,limit=16000,maximum=48000) {
  let truncated=false;
  const text=JSON.stringify(value,(_key,item)=>{
    if(typeof item==='string'&&item.length>limit){truncated=true;return item.slice(0,limit)+' [truncated; read a smaller section if needed]';}
    if(Array.isArray(item)&&item.length>100){truncated=true;return item.slice(0,100);}
    return item;
  });
  if(text.length>maximum)return JSON.stringify({truncated:true,hash:value?.hash,path:value?.path,error:typeof value?.error==='string'?value.error.slice(0,500):value?.error,exitCode:value?.exitCode,preview:text.slice(0,Math.floor((maximum-1500)/6))});
  return truncated?JSON.stringify({truncated:true,observation:JSON.parse(text)}):text;
}
module.exports={observation};
