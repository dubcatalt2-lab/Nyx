import {parse as html} from 'parse5';
import {parse} from 'acorn';
import {gunzipSync,gzipSync} from 'node:zlib';

export function prepareOfflineDocument(source) {
  const nodes=new Map();
  function visit(node){
    const id=node.attrs?.find(item=>item.name==='id')?.value;
    if(id)nodes.set(id,node);
    node.childNodes?.forEach(visit);
  }
  visit(html(source,{sourceCodeLocationInfo:true}));
  const bundle=nodes.get('eaglercraftXClientBundle');
  const signature=nodes.get('eaglercraftXClientSignature');
  if(!bundle||!signature)throw new Error('Unexpected offline document structure');
  const loc=bundle.sourceCodeLocation;
  const payload=source.slice(loc.startTag.endOffset,loc.endTag.startOffset).trim();
  const prefix='data:application/octet-stream;base64,';
  if(!payload.startsWith(prefix))throw new Error('Unexpected offline program encoding');
  let code=gunzipSync(Buffer.from(payload.slice(prefix.length),'base64'),{maxOutputLength:64*1024*1024}).toString('utf8');
  const comments=[];
  const tree=parse(code,{ecmaVersion:'latest',onComment:comments});
  const edits=comments.filter(item=>/^[#@]\s*sourceMappingURL\s*=/.test(item.value.trim())).map(item=>({start:item.start,end:item.end,text:''}));
  let badges=0;
  function script(node){
    if(!node||typeof node!=='object')return;
    if(node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&node.left.property.name==='enableSignatureBadge'&&node.right.value===true){
      edits.push({start:node.right.start,end:node.right.end,text:'false'});badges++;
    }
    for(const value of Object.values(node))if(Array.isArray(value))value.forEach(script);else if(value&&typeof value==='object')script(value);
  }
  script(tree);
  if(edits.length!==2||badges!==1)throw new Error('Unexpected offline program metadata');
  for(const edit of edits.sort((a,b)=>b.start-a.start))code=code.slice(0,edit.start)+edit.text+code.slice(edit.end);
  const compressed=gzipSync(code,{level:9});
  // The gzip OS field must not change reviewed assets between build hosts.
  compressed[9]=255;
  const next=compressed.toString('base64');
  const changes=[
    {start:loc.startTag.endOffset,end:loc.endTag.startOffset,text:prefix+next},
    {start:signature.sourceCodeLocation.startTag.endOffset,end:signature.sourceCodeLocation.endTag.startOffset,text:''}
  ];
  for(const edit of changes.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
  source=source.replace('window.eaglercraftXClientSignature = eaglerBundleUnwrap("eaglercraftXClientSignature");','eaglerBundleUnwrap("eaglercraftXClientSignature");');
  return {source,code};
}
