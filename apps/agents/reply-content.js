// The shared renderer escapes input HTML, restricts links, and disables trusted
// KaTeX commands. User messages and editor source remain literal text.
export function renderReply(node,text) {
  if(window.NyxMarkdown)node.innerHTML=window.NyxMarkdown.render(text);
  else node.textContent=text;
}
const pending=new WeakMap();
export function scheduleReply(node,text,onRender) {
  const previous=pending.get(node);
  if(previous){previous.text=text;previous.onRender=onRender;return;}
  const entry={text,onRender};pending.set(node,entry);
  requestAnimationFrame(()=>{pending.delete(node);if(node.isConnected){renderReply(node,entry.text);entry.onRender?.();}});
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('.message-content [data-copy-code]');
  if(!button)return;
  const code=button.closest('.ai-code-block')?.querySelector('pre code');
  if(!code)return;
  try{await navigator.clipboard.writeText(code.textContent);button.title='Copied';}
  catch{button.title='Select the code to copy it';}
});
