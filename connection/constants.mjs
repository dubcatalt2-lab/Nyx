import {parse} from 'acorn';

export function constants(code){
  const tree=parse(code,{ecmaVersion:'latest',sourceType:'script'}),edits=[];
  function visit(node,parent){
    if(!node||typeof node!=='object')return;
    if(node.type==='Literal'&&typeof node.value==='string'&&node.value.length>256){
      const bytes=new Uint8Array(node.value.length*2),parts=[];
      for(let index=0;index<node.value.length;index++){
        const value=node.value.charCodeAt(index);
        bytes[index*2]=value&255;bytes[index*2+1]=value>>>8;
      }
      for(let index=0;index<bytes.length;index+=1024)parts.push('['+[...bytes.subarray(index,index+1024)].join(',')+']');
      let text='['+parts.join(',')+'].map(a=>a.reduce((s,v,i)=>i%2?s:s+String.fromCharCode(v|a[i+1]<<8),"")).join("")';
      if(parent?.type==='Property'&&parent.key===node&&!parent.computed)text='['+text+']';
      edits.push({start:node.start,end:node.end,text});
    }
    for(const value of Object.values(node)){
      if(Array.isArray(value))value.forEach(child=>visit(child,node));
      else if(value&&typeof value==='object')visit(value,node);
    }
  }
  visit(tree);
  for(const edit of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,edit.start)+edit.text+code.slice(edit.end);
  return code;
}
