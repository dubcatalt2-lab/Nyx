import {parse} from 'acorn';
                                                                            
                                                                            
export function patchClientSockets(source) {
 const edits=[];
 function walk(node) {
  if(!node || typeof node!=='object')return;
  if(node.type==='ClassDeclaration' && node.id?.name==='CurlWebSocket') {
   const method=node.body.body.find(n=>n.key?.name==='cleanup');
   if(!method)throw Error('Socket cleanup method missing');
   const original=source.slice(method.start,method.end);
   if(!/if\s*\(!this\.connected\)\s*return;/.test(original))throw Error('Socket cleanup contract changed');
   const text=original.replace(/if\s*\(!this\.connected\)\s*return;/,'if (!this.http_handle) return;')
    .replace('super.close();','super.close(); this.http_handle = null; this.recv_loop = null;');
   edits.push({start:method.start,end:method.end,text});
  }
  if(node.type==='ClassDeclaration' && node.id?.name==='FakeWebSocket') {
   const method=node.body.body.find(n=>n.key?.name==='connect');
   if(!method)throw Error('Socket connection method missing');
   const original=source.slice(method.start,method.end);
   if(!original.includes('this.onerror(error_event);'))throw Error('Socket error contract changed');
   const text=original.replace('this.onerror(error_event);',`this.onerror(error_event);
        const close_event = new CloseEvent('close', {code:1006, wasClean:false});
        this.dispatchEvent(close_event);
        this.onclose(close_event);`);
   edits.push({start:method.start,end:method.end,text});
  }
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
 }
 walk(parse(source,{ecmaVersion:'latest',sourceType:'module'}));
 if(edits.length!==2)throw Error('Expected both socket lifecycle patches');
 for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
 return source;
}
