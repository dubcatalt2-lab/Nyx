export function textCache({limit=32*1024*1024,entries=64,lifetime=60000,now=Date.now}={}){
  const values=new Map();let size=0;
  function remove(key){const value=values.get(key);if(value){size-=value.size;values.delete(key);}}
  return (key,text,compute)=>{
    const saved=values.get(key),time=now();
    if(saved&&saved.expires>time&&saved.text===text){values.delete(key);values.set(key,saved);return saved.output;}
    remove(key);
    const output=compute();
    const weight=2*(key.length+text.length+output.length);
    if(text.length<1024||weight>limit)return output;
    for(const [key,value]of values)if(value.expires<=time)remove(key);
    while(values.size&&(values.size>=entries||size+weight>limit))remove(values.keys().next().value);
    if(entries>0){values.set(key,{text,output,size:weight,expires:time+lifetime});size+=weight;}
    return output;
  };
}
