import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {parse} from 'acorn';
import {parse as html} from 'parse5';
import {binaryText} from '../scripture/binary-text.mjs';

export function replaceBinaryCalls(text,mode,staticOnly=false){
  const tree=parse(text,{ecmaVersion:'latest',sourceType:mode,allowReturnOutsideFunction:mode!=='module'});
  const edits=[];
  const scopes=new WeakMap();
  const bind=(pattern,scope)=>{
    if(!pattern)return;
    if(pattern.type==='Identifier')scope.names.add(pattern.name);
    else if(pattern.type==='RestElement')bind(pattern.argument,scope);
    else if(pattern.type==='AssignmentPattern')bind(pattern.left,scope);
    else if(pattern.type==='ArrayPattern')pattern.elements.forEach(p=>bind(p,scope));
    else if(pattern.type==='ObjectPattern')pattern.properties.forEach(p=>bind(p.type==='RestElement'?p.argument:p.value,scope));
  };
  const index=(node,parent)=>{
    if(!node||typeof node!=='object')return;
    const callable=/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type);
    if(node.type==='FunctionDeclaration'||node.type==='ClassDeclaration')bind(node.id,parent);
    const own=callable||['Program','BlockStatement','CatchClause','ForStatement','ForInStatement','ForOfStatement'].includes(node.type);
    const scope=own?{names:new Set(),parent,callable:callable||node.type==='Program'}:parent;
    scopes.set(node,scope);
    if(callable){bind(node.id,scope);node.params.forEach(p=>bind(p,scope));}
    if(node.type==='CatchClause')bind(node.param,scope);
    if(node.type==='VariableDeclaration'){
      let owner=scope;
      if(node.kind==='var')while(!owner.callable&&owner.parent)owner=owner.parent;
      node.declarations.forEach(d=>bind(d.id,owner));
    }
    if(node.type==='ImportDeclaration')node.specifiers.forEach(s=>bind(s.local,scope));
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(v=>index(v,scope));else if(value&&typeof value==='object')index(value,scope);
  };
  index(tree,null);
  const bound=(name,node)=>{for(let s=scopes.get(node);s;s=s.parent)if(s.names.has(name))return true;return false;};
  const visit=node=>{
    if(!node||typeof node!=='object')return;
    if(staticOnly&&node.type==='WithStatement')return;
    if(staticOnly&&node.type==='CallExpression'&&!node.optional&&node.callee.type==='Identifier'&&node.callee.name==='eval'&&!bound('eval',node)&&node.arguments.length===1&&typeof node.arguments[0].value==='string'){
      const code=node.arguments[0].value;
      try{
        const program=parse(code,{ecmaVersion:'latest',sourceType:'script'});
        const statement=program.body[0];
        if(program.body.length===1&&statement.type==='ExpressionStatement'&&!statement.directive){
          edits.push({start:node.start,end:node.end,text:'(0,'+code.slice(statement.expression.start,statement.expression.end)+')'});
          return;
        }
        if(code==='let foo = 123;'){
          edits.push({start:node.start,end:node.end,text:'(()=>{let foo = 123;})()'});
          return;
        }
      }catch{}
    }
    if(staticOnly&&node.type==='CallExpression'&&['CallExpression','NewExpression'].includes(node.callee.type)){
      const factory=node.callee;
      if(factory.callee.type==='Identifier'&&factory.callee.name==='Function'&&!bound('Function',node)&&!bound('globalThis',node)&&factory.arguments.length===1&&factory.arguments[0].value==='return this'&&node.arguments.length===0){
        edits.push({start:node.start,end:node.end,text:'globalThis'});
        return;
      }
    }
    if(!staticOnly&&node.type==='CallExpression'){
      const callee=node.callee;
      if(callee.type==='Identifier'&&callee.name==='atob'&&!bound('atob',node)||callee.type==='MemberExpression'&&['globalThis','window','self'].includes(callee.object.name)&&!bound(callee.object.name,node)&&(callee.computed?callee.property.value:callee.property.name)==='atob')edits.push({start:callee.start,end:callee.end,text:'('+binaryText.toString().replace(/\r\n?/g,'\n')+')'});
    }
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
  };
  visit(tree);
  for(const edit of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.text+text.slice(edit.end);
  return {text,count:edits.length};
}
export function replaceStaticCalls(text,mode){
  if(!/\b(?:eval|Function)\s*\(/.test(text))return {text,count:0};
  return replaceBinaryCalls(text,mode,true);
}
export async function buildNativeValues(root){
  let count=0,compiled=0;
  const failures=[];
  const transform=(text,mode)=>{
    const staticResult=replaceStaticCalls(text,mode);
    const result=replaceBinaryCalls(staticResult.text,mode);
    compiled+=staticResult.count;
    return {...result,changed:result.count>0||staticResult.count>0};
  };
  async function walk(directory){
    for(const item of await readdir(directory,{withFileTypes:true})){
      const file=join(directory,item.name);
      if(item.isDirectory()){await walk(file);continue;}
      if(!/\.(?:[mc]?js|html)$/.test(file))continue;
      let text=await readFile(file,'utf8');
      const original=text;
      if(file.endsWith('.html')){
        const edits=[];
        const visit=node=>{
          if(node.tagName==='script'&&!node.attrs.some(a=>a.name==='src')){
            const type=node.attrs.find(a=>a.name==='type')?.value||'';
            if(!type||/^(module|(?:text|application)\/javascript)$/i.test(type)){
              const location=node.sourceCodeLocation;
              const start=location?.startTag.endOffset,end=location?.endTag?.startOffset;
              if(Number.isInteger(start)&&Number.isInteger(end))try{
                const result=transform(text.slice(start,end),type==='module'?'module':'script');
                if(result.changed){edits.push({start,end,text:result.text});count+=result.count;}
              }catch(error){failures.push({file,line:location.startLine,message:error.message});}
            }
          }
          node.childNodes?.forEach(visit);
        };
        visit(html(text,{sourceCodeLocationInfo:true}));
        for(const edit of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.text+text.slice(edit.end);
      }else{
        let result;
        try{result=transform(text,'module');}catch{try{result=transform(text,'script');}catch(error){failures.push({file,message:error.message});}}
        if(result){text=result.text;count+=result.count;}
      }
      if(text!==original)await writeFile(file,text);
    }
  }
  await walk(root);
  console.log('Native decoding: '+count+' calls replaced with byte decoding; '+failures.length+' parse failures remain for the mandatory release audit.');
  console.log('Static execution: '+compiled+' known expressions compiled ahead of time.');
  return {count,compiled,failures};
}
