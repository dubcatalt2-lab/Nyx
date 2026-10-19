import {parse} from 'acorn';
export function encodeLiterals(source,module=false){
  const ast=parse(source,{ecmaVersion:'latest',sourceType:module?'module':'script',allowHashBang:true}),edits=[];
  function visit(node){
    if(!node||typeof node!=='object')return;
    if(node.type==='ExpressionStatement'&&node.directive)return;
    if(node.type==='Literal'&&typeof node.value==='string'&&node.value.length<=4096){
      let encoded='"';
      for(let i=0;i<node.value.length;i++)encoded+='\\u'+node.value.charCodeAt(i).toString(16).padStart(4,'0');
      edits.push({start:node.start,end:node.end,text:encoded+'"'});return;
    }
    for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}
  }
  visit(ast);
  for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
  return source;
}
