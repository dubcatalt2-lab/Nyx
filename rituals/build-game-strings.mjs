import {parse} from 'acorn';
import {createHash} from 'node:crypto';

export function obscureGameStrings(source,seed='games'){
  const hash=createHash('sha256').update(seed).digest('hex');
  const name='_0x'+hash.slice(0,12),table=name+'_a',cache=name+'_b';
  if(source.includes('function '+name+'('))return source;
  const tree=parse(source,{ecmaVersion:'latest',sourceType:'module'}),edits=[],values=new Map();
  const key=parseInt(hash.slice(12,16),16)||173;
  function visit(node,parent){
    if(!node||typeof node!=='object')return;
    if(node.type==='Literal'&&typeof node.value==='string'){
      const value=node.value;
      if(!value||value.length>256||/[/:]/.test(value)||parent?.directive)return;
      if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression','ImportAttribute','ImportSpecifier','ExportSpecifier'].includes(parent?.type))return;
      if(['Property','MethodDefinition','PropertyDefinition'].includes(parent?.type)&&parent.key===node&&!parent.computed)return;
      if(!values.has(value))values.set(value,values.size);
      edits.push({start:node.start,end:node.end,text:'('+name+'('+values.get(value)+'))'});
    }
    for(const [property,value] of Object.entries(node)){
      if((property==='value'&&node.type==='Literal')||property==='regex')continue;
      if(Array.isArray(value))value.forEach(child=>visit(child,node));
      else if(value&&typeof value==='object')visit(value,node);
    }
  }
  visit(tree,null);
  if(!edits.length)return source;
  const encoded=[...values.keys()].map(value=>Array.from({length:value.length},(_,i)=>value.charCodeAt(i)^((key+i*31)&65535)));
  const decoder=`const ${table}=${JSON.stringify(encoded)},${cache}=[];function ${name}(i){return ${cache}[i]??(${cache}[i]=${table}[i].map((v,j)=>String.fromCharCode(v^((${key}+j*31)&65535))).join(''))}`;
  const directives=tree.body.filter(node=>node.type==='ExpressionStatement'&&node.directive);
  const position=directives.at(-1)?.end||0;
  for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
  source=source.slice(0,position)+';'+decoder+';'+source.slice(position);
  parse(source,{ecmaVersion:'latest',sourceType:'module'});
  return source;
}
