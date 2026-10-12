import {parse, parseFragment, serialize} from 'parse5';
import {parse as cssParse, walk as cssWalk, generate} from 'css-tree';
import {parse as jsParse} from 'acorn';
import {route} from './address.mjs';
import {partitionOrigin} from './partition.mjs';
import {textCache} from './text-cache.mjs';

const compiledText=textCache();

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parentNode' || key === 'loc') continue;
    if (Array.isArray(value)) value.forEach(child => visit(child, callback));
    else if (value && typeof value === 'object') visit(value, callback);
  }
}

export function stylesheet(text, base, prefix, context = 'stylesheet') {
  return compiledText(JSON.stringify(['css',base,prefix,context]),text,()=>styleText(text,base,prefix,context));
}
function styleText(text,base,prefix,context){
  const tree = cssParse(text, {context});
  cssWalk(tree, node => {
    if (node.type === 'Url') node.value = route(node.value, base, prefix);
    if (node.type === 'Atrule' && node.name.toLowerCase() === 'import') {
      const first = node.prelude?.children?.first;
      if (first?.type === 'String') first.value = route(first.value, base, prefix);
    }
  });
  return generate(tree);
}

export function script(text, base, prefix, module = false) {
  return compiledText(JSON.stringify(['js',base,prefix,module]),text,()=>scriptText(text,base,prefix,module));
}
function scriptText(text,base,prefix,module){
  const tree = jsParse(text, {ecmaVersion: 'latest', sourceType: module ? 'module' : 'script', allowReturnOutsideFunction: !module, allowHashBang: true});
  const edits = [];
  const mapped = new Set();
  const nodes = [];
  function bind(pattern, scope, value = {}) {
    if (!pattern) return;
    if (pattern.type === 'Identifier') scope.names.set(pattern.name, {...value, scope});
    else if (pattern.type === 'RestElement') bind(pattern.argument, scope, value);
    else if (pattern.type === 'AssignmentPattern') bind(pattern.left, scope, value);
    else if (pattern.type === 'ArrayPattern') pattern.elements.forEach(item => bind(item, scope, value));
    else if (pattern.type === 'ObjectPattern') pattern.properties.forEach(item => bind(item.type === 'RestElement' ? item.argument : item.value, scope, value));
  }
  function index(node, parent, owner, key) {
    if (!node || typeof node.type !== 'string') return;
    const callable = /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node.type);
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') bind(node.id, parent);
    const scope = ['Program','BlockStatement','CatchClause','ForStatement','ForInStatement','ForOfStatement'].includes(node.type) || callable ? {names:new Map(),parent,callable:callable || node.type === 'Program'} : parent;
    const callee=node.callee;
    const callName=callee?.type==='Identifier'?callee.name:callee?.type==='MemberExpression'?(callee.computed?callee.property.value:callee.property.name):'';
    const memberName=node.type==='MemberExpression'?(node.computed?node.property.value:node.property.name):'';
    if (node.type === 'Identifier' && node.name === 'location' || ['location','postMessage'].includes(memberName) || ['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type) || ['fetch','WebSocket','EventSource','Worker','SharedWorker','importScripts','open'].includes(callName)) nodes.push({node,scope,parent:owner,key});
    if (callable) { bind(node.id,scope);node.params.forEach(parameter => bind(parameter,scope)); }
    if (node.type === 'CatchClause') bind(node.param,scope);
    if (node.type === 'VariableDeclaration') {
      let owner = scope;
      if (node.kind === 'var') while (!owner.callable && owner.parent) owner = owner.parent;
      node.declarations.forEach(declaration => bind(declaration.id,owner,{init:declaration.init}));
    }
    if (node.type === 'ImportDeclaration') node.specifiers.forEach(specifier => bind(specifier.local,scope));
    if (node.type === 'Identifier' || node.type === 'Literal' || node.type === 'PrivateIdentifier') return;
    for (const key in node) {
      const value=node[key];
      if (Array.isArray(value)) { for(const child of value)index(child,scope,node,key); }
      else if (value && typeof value === 'object') index(value,scope,node,key);
    }
  }
  index(tree,null);
  function binding(name, scope) {
    for (let current = scope; current; current = current.parent) if (current.names.has(name)) return current.names.get(name);
    return null;
  }
  function native(target, name, scope) {
    if (target?.type === 'Identifier') return target.name === name && !binding(name,scope);
    return target?.type === 'MemberExpression' && ['window','self','globalThis'].includes(target.object.name) && !binding(target.object.name,scope) && (target.computed ? target.property.value : target.property.name) === name;
  }
  function argument(node, dynamic = false) {
    if (!node || mapped.has(node.start)) return;
    if (node.type === 'Literal' && typeof node.value === 'string') {
      edits.push({start: node.start, end: node.end, text: JSON.stringify(route(node.value, base, prefix))});
      mapped.add(node.start);
    } else if (dynamic) {
      edits.push({start: node.start, end: node.start, text: 'globalThis.documentAddress('});
      edits.push({start: node.end, end: node.end, text: ',' + JSON.stringify(base) + ')'});
    }
  }
  function locations(node, parent, key, scope) {
    const direct = node.type === 'Identifier' && node.name === 'location' && !binding('location', scope);
    const member = node.type === 'MemberExpression' && ['window','self','globalThis','document'].includes(node.object.name) && !binding(node.object.name, scope) && (node.computed ? node.property.value : node.property.name) === 'location';
    const property = parent?.type === 'MemberExpression' && key === 'property' && !parent.computed;
    const definition = ['Property','MethodDefinition','PropertyDefinition'].includes(parent?.type) && key === 'key' && !parent.computed;
    const label = ['LabeledStatement','BreakStatement','ContinueStatement'].includes(parent?.type);
    if ((direct && !property && !definition && !label) || member) {
      const assignment = parent?.type === 'AssignmentExpression' && key === 'left';
      const shorthand = parent?.type === 'Property' && parent.shorthand && key === 'value';
      edits.push({start:node.start,end:node.end,text:(shorthand?'location:':'')+'globalThis.documentLocation'+(assignment?'.href':'')});
      return;
    }
    if(node.type==='MemberExpression'&&node.object.type!=='Super'&&node.property.type!=='PrivateIdentifier'&&['location','postMessage'].includes(node.computed?node.property.value:node.property.name)){
      let optional=false;
      for(let item=node.object;item?.type==='MemberExpression'||item?.type==='CallExpression';item=item.object||item.callee)optional ||= item.optional===true;
      if(!optional){
        edits.push({start:node.object.start,end:node.object.start,text:'globalThis.'+((node.computed?node.property.value:node.property.name)==='location'?'documentOwner':'documentMessenger')+'('});
        edits.push({start:node.object.end,end:node.object.end,text:')'});
      }
    }
  }
  for(const {node,scope,parent,key} of nodes){
    locations(node,parent,key,scope);
    if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)) argument(node.source);
    if (node.type === 'ImportExpression') argument(node.source, true);
    if (node.type !== 'CallExpression' && node.type !== 'NewExpression') continue;
    const target = node.callee;
    const name = target.type === 'Identifier' ? target.name : target.type === 'MemberExpression' ? (target.computed ? target.property.value : target.property.name) : '';
    if (['fetch','WebSocket','EventSource','Worker','SharedWorker'].includes(name) && native(target,name,scope)) argument(node.arguments[0]);
    if (name === 'importScripts' && native(target,name,scope)) node.arguments.forEach(value => argument(value));
    if (name === 'open' && target.type === 'MemberExpression') {
      const receiver = target.object;
      const found = receiver.type === 'Identifier' ? binding(receiver.name,scope) : null;
      const value = found?.init || receiver;
      if (value.type === 'NewExpression' && native(value.callee,'XMLHttpRequest',found?.scope || scope)) argument(node.arguments[1]);
    }
  }
  edits.sort((a, b) => a.start - b.start || a.end - b.end);
  const parts=[];
  let offset=0;
  for(const edit of edits){
    if(edit.start<offset)throw new Error('Conflicting document edits');
    parts.push(text.slice(offset,edit.start),edit.text);
    offset=edit.end;
  }
  parts.push(text.slice(offset));
  return parts.join('');
}

export function candidates(text, base, prefix) {
  const output = [];
  let index = 0;
  while (index < text.length) {
    while (index < text.length && /[\s,]/.test(text[index])) index++;
    if (index >= text.length) break;
    const start = index;
    while (index < text.length && !/\s/.test(text[index])) index++;
    let url = text.slice(start, index);
    if (url.endsWith(',')) { url = url.replace(/,+$/, ''); output.push(route(url, base, prefix)); continue; }
    const descriptor = index;
    let depth = 0;
    while (index < text.length) {
      if (text[index] === '(') depth++;
      if (text[index] === ')') depth--;
      if (text[index] === ',' && depth === 0) break;
      index++;
    }
    output.push(route(url, base, prefix) + text.slice(descriptor, index));
    index++;
  }
  return output.join(', ');
}

function markup(tree, base, prefix) {
  let effective = base, found = false, head;
  visit(tree, node => {
    if (node.tagName === 'head') head = node;
    if (node.tagName === 'base' && !found) {
      const attr = node.attrs.find(item => item.name === 'href');
      if (attr) { try { effective = new URL(attr.value, base).href; } catch {} found = true; }
    }
  });
  visit(tree, node => {
    if (!node.tagName) return;
    const attr = name => node.attrs.find(item => item.name === name);
    if (node.tagName === 'meta' && /^(content-security-policy|refresh)$/i.test(attr('http-equiv')?.value || '')) {
      if (/refresh/i.test(attr('http-equiv').value)) {
        const content = attr('content');
        if (content) content.value = content.value.replace(/(url\s*=\s*)(.+)$/i, (_, lead, value) => lead + route(value.replace(/^['"]|['"]$/g, ''), effective, prefix));
      } else { node.attrs = []; }
    }
    node.attrs = node.attrs.filter(item => !['integrity','nonce'].includes(item.name));
    for (const item of node.attrs) {
      if (['src','href','action','formaction','poster','data-src'].includes(item.name)) item.value = route(item.value, effective, prefix);
      else if (item.name === 'srcset') item.value = candidates(item.value, effective, prefix);
      else if (item.name === 'style') item.value = stylesheet(item.value, effective, prefix, 'declarationList');
      else if (item.name.startsWith('on')) {
        try{item.value = script(item.value, effective, prefix);}catch(error){if(!(error instanceof SyntaxError))throw error;}
      }
    }
    if (node.tagName === 'script' && !attr('src')) {
      const type = attr('type')?.value || '';
      if (!type || /^(module|text\/javascript|application\/javascript)$/i.test(type)) {
        for (const child of node.childNodes || []) if (child.nodeName === '#text') {
          try{child.value = script(child.value, effective, prefix, type === 'module');}catch(error){if(!(error instanceof SyntaxError))throw error;}
        }
      }
    }
    if (node.tagName === 'style') for (const child of node.childNodes || []) if (child.nodeName === '#text') child.value = stylesheet(child.value, effective, prefix);
  });
  return {effective,head};
}

export function fragment(text, base, prefix, context) {
  const element=context?.localName?{nodeName:context.localName,tagName:context.localName,namespaceURI:context.namespaceURI||'http://www.w3.org/1999/xhtml',attrs:[],childNodes:[]}:null;
  const tree = element ? parseFragment(element, String(text)) : parseFragment(String(text));
  markup(tree,base,prefix);
  return serialize(tree);
}

export function document(text, base, prefix, context={}) {
  const tree = parse(text);
  const {effective,head}=markup(tree,base,prefix);
  const entry = parseFragment('<script src="/boot/runtime.js"></script>').childNodes[0];
  entry.attrs.push({name: 'data-document', value: effective}, {name: 'data-location', value: base}, {name: 'data-route', value: prefix});
  entry.attrs.push({name:'data-ready-at',value:String(context.readyAt||0)},{name:'data-cookies',value:context.cookies||''});
  if(context.isolated)entry.attrs.push({name:'data-isolated',value:'1'},{name:'data-broker',value:context.broker||''});
  entry.parentNode = head;
  head.childNodes.unshift(entry);
  return serialize(tree);
}

async function decodedText(response,headers){
  const type=headers.get('content-type')||'';
  const label=/charset\s*=\s*["']?([^\s;"']+)/i.exec(type)?.[1]||'utf-8';
  let decoder;
  try{decoder=new TextDecoder(label);}catch{decoder=new TextDecoder();}
  const text=decoder.decode(await response.arrayBuffer());
  if(type)headers.set('content-type',type.replace(/;\s*charset\s*=\s*(?:"[^"]*"|'[^']*'|[^;]*)/i,'')+'; charset=utf-8');
  return text;
}

export async function content(response, base, prefix, destination = '', mode = 'classic', context={}) {
  const headers = new Headers(response.headers);
  for (const name of ['content-security-policy','content-security-policy-report-only','x-frame-options','content-length','content-encoding','set-cookie','clear-site-data','x-document-cookies']) headers.delete(name);
  if(context.isolated){
    headers.set('origin-agent-cluster','?1');headers.set('referrer-policy','unsafe-url');
    const allow=headers.get('access-control-allow-origin');
    if(allow&&allow!=='*'&&allow!=='null'){try{headers.set('access-control-allow-origin',partitionOrigin(new URL(allow).origin,new URL(prefix).origin));}catch{headers.delete('access-control-allow-origin');}}
  }
  const type = headers.get('content-type') || '';
  const location = headers.get('location');
  if (location) headers.set('location', route(location, base, prefix));
  headers.set('cache-control', 'no-store');
  let body = response.body;
  const redirect=[301,302,303,307,308].includes(response.status);
  const program=['script','worker','sharedworker'].includes(destination);
  if(redirect||[204,205,304].includes(response.status)||program&&!response.ok)return new Response([204,205,304].includes(response.status)?null:body,{status:response.status,headers});
  if (['document','iframe','frame'].includes(destination)&&/text\/html|application\/xhtml\+xml/i.test(type)) body = document(await decodedText(response,headers), base, prefix, context);
  else if (destination==='style'&&/text\/css/i.test(type)) {
    const text=await decodedText(response,headers);
    body=context.compile&&text.length>=32768?await context.compile('css',text,base,prefix,mode):stylesheet(text,base,prefix);
  }
  else if (program) {
    if(mode==='module'&&type&&!/javascript|ecmascript/i.test(type))return new Response(body,{status:response.status,headers});
    const text = await decodedText(response,headers);
    if(context.compile&&text.length>=32768)body=await context.compile('js',text,base,prefix,mode);
    else{
      try { body = script(text, base, prefix, true); }
      catch { body = script(text, base, prefix, false); }
    }
    if (['worker','sharedworker'].includes(destination)&&context.workerEntry!==false) {
      const runtime = JSON.stringify('/boot/runtime.js');
      body = 'globalThis.documentContext='+JSON.stringify({base,prefix,isolated:!!context.isolated,broker:context.broker||'',readyAt:context.readyAt||0})+';'+(mode === 'module' ? 'import ' + runtime + ';' : 'importScripts(' + runtime + ');') + '\n' + body;
    }
  }
  return new Response([204,205,304].includes(response.status) ? null : body, {status: response.status, headers});
}

