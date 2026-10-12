import {parse} from 'acorn';

export function inspectCode(code,{mode,offset=0}={}) {
  let tree,error,comments=[];
  for(const sourceType of mode?[mode]:['module','script'])try{comments=[];tree=parse(code,{ecmaVersion:'latest',sourceType,allowReturnOutsideFunction:true,locations:true,onComment:comments});break}catch(e){error=e}
  if(!tree)throw error;
  const nodes=[],scopes=new WeakMap(),parents=new WeakMap();
  function bind(pattern,scope){
    if(!pattern)return;
    if(pattern.type==='Identifier'){if(!scope.names.has(pattern.name))scope.names.set(pattern.name,new Set());}
    else if(pattern.type==='RestElement')bind(pattern.argument,scope);
    else if(pattern.type==='AssignmentPattern')bind(pattern.left,scope);
    else if(pattern.type==='ArrayPattern')pattern.elements.forEach(n=>bind(n,scope));
    else if(pattern.type==='ObjectPattern')pattern.properties.forEach(n=>bind(n.value||n.argument,scope));
  }
  function index(node,parent,scope){
    if(!node||typeof node.type!=='string')return;
    if(node.type==='FunctionDeclaration'||node.type==='ClassDeclaration'){bind(node.id,scope);if(node.id)scope.names.get(node.id.name).add('FunctionInstance');}
    const callable=/^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type);
    if(callable||['Program','BlockStatement','CatchClause','ForStatement','ForInStatement','ForOfStatement'].includes(node.type))scope={names:new Map(),parent:scope,callable:callable||node.type==='Program'};
    if(callable){bind(node.id,scope);node.params.forEach(n=>bind(n,scope));}
    if(node.type==='CatchClause')bind(node.param,scope);
    if(node.type==='VariableDeclaration'){let s=scope;if(node.kind==='var')while(!s.callable&&s.parent)s=s.parent;node.declarations.forEach(n=>bind(n.id,s));}
    if(node.type==='ImportDeclaration')node.specifiers.forEach(n=>bind(n.local,scope));
    nodes.push(node);scopes.set(node,scope);parents.set(node,parent);
    for(const [key,value]of Object.entries(node))if(key!=='loc')if(Array.isArray(value))value.forEach(n=>index(n,node,scope));else if(value&&typeof value==='object')index(value,node,scope);
  }
  index(tree,null,{names:new Map(),parent:null,callable:true});
  const binding=(name,node)=>{for(let s=scopes.get(node);s;s=s.parent)if(s.names.has(name))return s.names.get(name);return null};
  const value=node=>{
    if(!node)return;
    if(node.type==='Literal')return node.value;
    if(node.type==='BinaryExpression'&&node.operator==='+'){const a=value(node.left),b=value(node.right);if(typeof a==='string'&&typeof b==='string')return a+b;}
    if(node.type==='TemplateLiteral'&&node.expressions.length===0)return node.quasis[0].value.cooked;
    if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.object.name==='String'&&['fromCharCode','fromCodePoint'].includes(node.callee.property.name)&&node.arguments.every(n=>Number.isInteger(n.value)))return String[node.callee.property.name](...node.arguments.map(n=>n.value));
  };
  function origins(node,seen=new Set()){
    if(!node||seen.has(node))return new Set();seen.add(node);
    if(['FunctionExpression','ArrowFunctionExpression'].includes(node.type))return new Set(['FunctionInstance']);
    if(node.type==='Identifier'){
      const local=binding(node.name,node);
      return local||new Set(['atob','eval','Function','window','self','globalThis','WebAssembly','Reflect'].includes(node.name)?[node.name]:[]);
    }
    if(node.type==='SequenceExpression')return origins(node.expressions.at(-1),seen);
    if(node.type==='ChainExpression')return origins(node.expression,seen);
    if(node.type==='MemberExpression'){
      const property=node.computed?value(node.property):node.property.name;
      const base=origins(node.object,seen);
      if([...base].some(x=>['window','self','globalThis'].includes(x)))return new Set(['atob','eval','Function','window','self','globalThis','WebAssembly','Reflect'].includes(property)?[property]:[]);
      if(base.has('WebAssembly')&&property==='Function')return new Set(['WebAssembly.Function']);
      if(property==='constructor'&&[...base].some(x=>['FunctionInstance','Function','eval','atob'].includes(x)))return new Set(['Function']);
      if(['call','apply','bind'].includes(property))return base;
    }
    if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'){
      const property=node.callee.computed?value(node.callee.property):node.callee.property.name;
      if(property==='bind')return origins(node.callee.object,seen);
      if(property==='apply'&&node.callee.object.type==='MemberExpression'&&node.callee.object.property.name==='bind')return origins(node.arguments[0],seen);
    }
    return new Set();
  }
  let changed=true;
  while(changed){changed=false;for(const node of nodes){
    const assignment=node.type==='VariableDeclarator'?{left:node.id,right:node.init}:node.type==='AssignmentExpression'?node:null;
    if(!assignment)continue;
    const pairs=assignment.left.type==='Identifier'?[[assignment.left,origins(assignment.right)]]:assignment.left.type==='ObjectPattern'?assignment.left.properties.filter(p=>p.type==='Property').map(p=>[p.value,origins({type:'MemberExpression',object:assignment.right,computed:p.computed,property:p.key})]):[];
    for(const [left,right]of pairs){const target=binding(left.name,node);if(target)for(const origin of right)if(!target.has(origin)){target.add(origin);changed=true}}
  }}
  const calls=[],methods=[],strings=[],identifiers=[];
  for(const node of nodes){
    if(node.type==='Identifier')identifiers.push({value:node.name,start:offset+node.start,end:offset+node.end});
    if(['Literal','BinaryExpression','TemplateLiteral','CallExpression'].includes(node.type)){
      const decoded=value(node);if(typeof decoded==='string')strings.push({value:decoded,start:offset+node.start,end:offset+node.end});
    }
    if(!['CallExpression','NewExpression'].includes(node.type))continue;
    if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'){
      const property=node.callee.computed?value(node.callee.property):node.callee.property.name;
      if(property==='bind'||property==='apply'&&node.callee.object.type==='MemberExpression'&&node.callee.object.property.name==='bind')continue;
    }
    let found=origins(node.callee);
    if(node.callee.type==='MemberExpression'&&origins(node.callee.object).has('Reflect')&&['construct','apply'].includes(node.callee.property.name))found=origins(node.arguments[0]);
    for(const name of found){const site={name,start:offset+node.start,end:offset+node.end,line:node.loc.start.line,column:node.loc.start.column};if(['atob','eval','Function'].includes(name))calls.push(site);else if(name==='WebAssembly.Function')methods.push(site);}
    if(node.callee.type==='MemberExpression'&&node.callee.object.type==='ThisExpression'&&node.callee.property.name==='Function')methods.push({name:'this.Function',start:offset+node.start});
  }
  return {calls,methods,strings,identifiers,sourceMaps:comments.filter(comment=>/^[#@]\s*sourceMappingURL\s*=/.test(comment.value.trim())).map(comment=>({start:offset+comment.start}))};
}
