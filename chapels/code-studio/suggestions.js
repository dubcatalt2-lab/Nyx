(() => {
  const input=document.querySelector('[data-code-input]');
  const language=document.querySelector('[data-language]');
  if(!input||!language)return;
  const words={
    html:'html head body title style script main section article div span button input label form header footer nav a img class id href src',
    css:'display position color background padding margin border border-radius font-size font-family width height gap grid-template-columns align-items justify-content flex grid block none',
    javascript:'const let function return async await document window console querySelector querySelectorAll addEventListener textContent setTimeout fetch Promise Array Object map filter forEach',
    typescript:'interface type string number boolean unknown never extends implements readonly public private const let function return async await console',
    python:'def class return import from for while if elif else with as print range len enumerate list dict str int float True False None',
    java:'public private static class void String int return new System.out.println import extends implements',
    c:'int char void return include printf puts sizeof struct const malloc free',
    cpp:'int auto class public private return include std cout vector string nullptr',
    csharp:'using System public private class static void string int return new Console.WriteLine',
    go:'package import func return var const type struct range fmt.Println',
    rust:'fn let mut pub impl struct enum use return println match Some None',
    php:'function return echo array foreach public private class require',
    ruby:'def end class puts each do if else elsif return require',
    sql:'SELECT FROM WHERE ORDER BY GROUP INSERT INTO VALUES CREATE TABLE UPDATE SET DELETE JOIN LIMIT',
    json:'true false null',markdown:''
  };
  const snippets={javascript:{log:'console.log()',function:'function name() {\n  \n}',if:'if (condition) {\n  \n}'},python:{def:'def name():\n    pass',for:'for item in items:\n    pass'},html:{div:'div></div>',button:'button type="button"></button>'}};
  const box=document.createElement('div');box.className='code-suggestions';box.id='code-suggestions';box.hidden=true;box.setAttribute('role','listbox');box.setAttribute('aria-label','Code suggestions');input.parentElement.append(box);
  input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',box.id);
  let items=[],selected=0,start=0,end=0;
  function close(){box.hidden=true;input.removeAttribute('aria-activedescendant');}
  function render(){
    box.replaceChildren();items.forEach((item,index)=>{const row=document.createElement('button');row.type='button';row.id=`code-suggestion-${index}`;row.setAttribute('role','option');row.setAttribute('aria-selected',String(index===selected));row.textContent=item;row.addEventListener('pointerdown',event=>{event.preventDefault();selected=index;accept();});box.append(row);});
    input.setAttribute('aria-activedescendant',`code-suggestion-${selected}`);box.children[selected]?.scrollIntoView({block:'nearest'});
  }
  function show(force=false){
    if(input.selectionStart!==input.selectionEnd)return close();
    end=input.selectionStart;const prefix=input.value.slice(0,end).match(/[\w-]+$/)?.[0]||'';start=end-prefix.length;
    if(!force&&prefix.length<2)return close();
    const identifiers=input.value.match(/\b[A-Za-z_]\w{2,}\b/g)||[];
    items=[...new Set([...(words[language.value]||'').split(' '),...Object.keys(snippets[language.value]||{}),...identifiers])].filter(word=>word&&word!==prefix&&word.toLowerCase().startsWith(prefix.toLowerCase())).slice(0,12);
    if(!items.length)return close();selected=0;box.hidden=false;render();
  }
  function accept(){
    if(box.hidden||input.selectionStart!==end)return close();
    const item=items[selected];const member=input.value[start-1]==='.';
    let replacement=member ? (item==='log'?'log()':item) : (snippets[language.value]?.[item]||item);
    if(language.value==='html'&&snippets.html[item]&&input.value[start-1]!=='<')replacement='<'+replacement;
    input.setRangeText(replacement,start,end,'end');close();input.dispatchEvent(new Event('input',{bubbles:true}));close();input.focus();
  }
  input.addEventListener('keydown',event=>{
    if(event.isComposing)return;
    if(event.ctrlKey&&event.code==='Space'){event.preventDefault();event.stopImmediatePropagation();show(true);return;}
    if(box.hidden)return;
    if(['ArrowDown','ArrowUp','Enter','Tab','Escape'].includes(event.key)&&!event.ctrlKey&&!event.metaKey){event.preventDefault();event.stopImmediatePropagation();if(event.key==='Escape')close();else if(event.key==='Enter'||event.key==='Tab')accept();else{selected=(selected+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;render();}}
    else if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key))close();
  },true);
  input.addEventListener('input',event=>{if(!event.isComposing)show();});
  input.addEventListener('compositionstart',close);input.addEventListener('blur',close);input.addEventListener('click',close);language.addEventListener('change',close);
  document.querySelector('[aria-label="Workspace files"]')?.addEventListener('change',close);
  document.addEventListener('pointerdown',event=>{if(event.target!==input&&!box.contains(event.target))close();});
})();
