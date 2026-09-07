(()=>{
  'use strict';
  const STORAGE_KEY='nyx.codeStudio.v1';
  const MAX_CODE_CHARS=24000;
  const languages={
    html:{file:'index.html',help:'Build a small page and see it safely in the preview.',starter:'<!doctype html>\n<html>\n  <head>\n    <style>\n      body { font-family: system-ui; padding: 2rem; color: #172033; }\n      button { padding: .7rem 1rem; border: 0; border-radius: .6rem; background: #4f6ee8; color: white; }\n    </style>\n  </head>\n  <body>\n    <h1>Hello, Nyx</h1>\n    <p>Make this page your own.</p>\n    <button onclick="this.textContent = \'Nice work!\'">Try it</button>\n  </body>\n</html>',run:true},
    css:{file:'styles.css',help:'Write styles and preview them on a small sample card.',starter:'body {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: #e8eefc;\n  font-family: system-ui;\n}\n\n.card {\n  max-width: 20rem;\n  padding: 2rem;\n  border-radius: 1.25rem;\n  background: white;\n  box-shadow: 0 18px 45px rgba(46, 67, 122, .18);\n}',run:true},
    javascript:{file:'app.js',help:'Run JavaScript in an isolated browser preview.',starter:'const message = document.querySelector("#message");\nconst button = document.querySelector("button");\n\nbutton.addEventListener("click", () => {\n  message.textContent = "You changed the page with JavaScript.";\n});',run:true},
    typescript:{file:'app.ts',help:'Compile and run TypeScript in an isolated environment. Do not include secrets.',starter:'type Student = {\n  name: string;\n  projects: number;\n};\n\nconst student: Student = { name: "Nyx learner", projects: 1 };\nconsole.log(`${student.name} has ${student.projects} project.`);',runner:true},
    python:{file:'main.py',help:'Run Python in an isolated environment. Do not include secrets.',starter:'def greet(name: str) -> str:\n    return f"Hello, {name}!"\n\nprint(greet("Nyx learner"))',runner:true},
    java:{file:'Main.java',help:'Compile and run Java in an isolated environment. Do not include secrets.',starter:'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, Nyx learner!");\n  }\n}',runner:true},
    c:{file:'main.c',help:'Compile and run C in an isolated environment. Do not include secrets.',starter:'#include <stdio.h>\n\nint main(void) {\n  puts("Hello, Nyx learner!");\n  return 0;\n}',runner:true},
    cpp:{file:'main.cpp',help:'Compile and run C++ in an isolated environment. Do not include secrets.',starter:'#include <iostream>\n\nint main() {\n  std::cout << "Hello, Nyx learner!\\n";\n  return 0;\n}',runner:true},
    csharp:{file:'Program.cs',help:'Compile and run C# in an isolated environment. Do not include secrets.',starter:'using System;\n\npublic class Program {\n  public static void Main() {\n    Console.WriteLine("Hello, Nyx learner!");\n  }\n}',runner:true},
    go:{file:'main.go',help:'Compile and run Go in an isolated environment. Do not include secrets.',starter:'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, Nyx learner!")\n}',runner:true},
    rust:{file:'main.rs',help:'Compile and run Rust in an isolated environment. Do not include secrets.',starter:'fn main() {\n    println!("Hello, Nyx learner!");\n}',runner:true},
    php:{file:'index.php',help:'Run PHP in an isolated environment. Do not include secrets.',starter:'<?php\n$name = "Nyx learner";\necho "Hello, {$name}!\\n";',runner:true},
    ruby:{file:'main.rb',help:'Run Ruby in an isolated environment. Do not include secrets.',starter:'def greet(name)\n  "Hello, #{name}!"\nend\n\nputs greet("Nyx learner")',runner:true},
    sql:{file:'query.sql',help:'Run SQLite statements in an isolated temporary database. Do not include secrets.',starter:'CREATE TABLE learners (\n  student_name TEXT,\n  completed_projects INTEGER\n);\n\nINSERT INTO learners VALUES ("Nyx learner", 2);\n\nSELECT student_name, completed_projects\nFROM learners\nORDER BY completed_projects DESC;',runner:true},
    json:{file:'data.json',help:'Validate JSON and inspect its formatted result.',starter:'{\n  "project": "Nyx Code Studio",\n  "languages": ["JavaScript", "Python", "Rust"],\n  "ready": true\n}',run:true},
    markdown:{file:'README.md',help:'Write Markdown and see a safe rendered preview.',starter:'# My project\n\nBuild something useful, then write down what it does.\n\n- Clear goal\n- Small next step\n- Test your work',run:true}
  };
  const starters={html:['Landing page','<main><h1>My project</h1><p>A clear place to start.</p></main>'],javascript:['Click counter','let count = 0;\ndocument.querySelector("button").addEventListener("click", () => {\n  count += 1;\n  document.querySelector("#message").textContent = `Clicked ${count} times`;\n});'],python:['Simple list','tasks = ["Plan", "Build", "Test"]\nfor task in tasks:\n    print(f"- {task}")'],json:['Project data','{\n  "name": "My project",\n  "version": 1,\n  "complete": false\n}'],markdown:['Project notes','# Project notes\n\n## Next up\n\n1. Build a small version\n2. Test it\n3. Improve it']};
  const refs={
    shell:document.querySelector('[data-code-studio]'),workbench:document.querySelector('[data-workbench]'),language:document.querySelector('[data-language]'),help:document.querySelector('[data-language-help]'),files:document.querySelectorAll('[data-file-name]'),input:document.querySelector('[data-code-input]'),highlight:document.querySelector('[data-highlight] code'),lineNumbers:document.querySelector('[data-line-numbers]'),cursor:document.querySelector('[data-cursor-position]'),editorWrap:document.querySelector('[data-editor-wrap]'),editorCard:document.querySelector('.editor-card'),languageBadge:document.querySelector('[data-language-badge]'),languageStatus:document.querySelector('[data-language-status]'),starters:document.querySelector('[data-starters]'),runButtons:document.querySelectorAll('[data-run], [data-run-empty]'),reset:document.querySelector('[data-reset]'),clear:document.querySelector('[data-clear-code]'),download:document.querySelector('[data-download-code]'),preview:document.querySelector('[data-preview]'),previewEmpty:document.querySelector('[data-preview-empty]'),output:document.querySelector('[data-output]'),previewState:document.querySelector('[data-preview-state]'),previewStateLabel:document.querySelector('[data-preview-state-label]'),refreshPreview:document.querySelector('[data-refresh-preview]'),fullscreenPreview:document.querySelector('[data-fullscreen-preview]'),resultCard:document.querySelector('[data-result-card]'),problemCount:document.querySelector('[data-problem-count]'),resultTabs:document.querySelectorAll('[data-result-mode]'),saveState:document.querySelector('[data-save-state]'),saveLabel:document.querySelector('[data-save-label]'),form:document.querySelector('[data-ai-form]'),prompt:document.querySelector('[data-ai-prompt-input]'),send:document.querySelector('[data-ai-send]'),answer:document.querySelector('[data-ai-answer]'),aiStatus:document.querySelector('[data-ai-status]'),aiStatusLabel:document.querySelector('[data-ai-status-label]')
  };
  const keywordPattern=/^(?:as|async|await|break|case|catch|class|const|continue|def|default|delete|do|else|enum|export|extends|false|finally|fn|for|from|function|go|if|implements|import|in|instanceof|interface|let|match|new|null|package|private|protected|public|return|select|static|struct|switch|this|throw|true|try|type|typeof|using|var|void|while|yield|SELECT|FROM|WHERE|ORDER|BY|GROUP|INSERT|UPDATE|DELETE|CREATE|TABLE|JOIN|AS|AND|OR|NOT|NULL)$/;
  const UI_STORAGE_KEY='nyx.codeStudio.layout.v1';
  let state=loadState();
  let authPromise=null;
  let aiOptions=[];
  let aiOptionsPromise=null;
  let lastTerminal='Run a file to see activity here.';
  let lastOutput='';
  let hasRun=false;
  let previewRunId='';
  let runLogLines=[];
  let runtimeProblems=[];
  let runSequence=0;
  let running=false;

  function loadState(){
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      const language=languages[saved.language]?saved.language:'html';
      return {language,codes:saved.codes&&typeof saved.codes==='object'?saved.codes:{}};
    }catch{return {language:'html',codes:{}}}
  }
  function setSaveState(label,kind=''){
    refs.saveLabel.textContent=label;
    refs.saveState.classList.toggle('is-saving',kind==='saving');
    refs.saveState.classList.toggle('is-error',kind==='error');
  }
  function save(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));setSaveState('Saved locally')}
    catch{setSaveState('Could not save','error')}
  }
  function code(){return String(state.codes[state.language]??languages[state.language].starter).slice(0,MAX_CODE_CHARS)}
  function setCode(value){state.codes[state.language]=String(value||'').slice(0,MAX_CODE_CHARS);refs.input.value=code();renderEditor();resetPreview();save()}
  function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function matchingBracketIndexes(source,caret){
    const pairs={'(':')','[':']','{':'}'};
    const reverse={')':'(',']':'[','}':'{'};
    let index=caret;
    if(!pairs[source[index]]&&!reverse[source[index]])index=caret-1;
    const selected=source[index];
    if(!selected||(!pairs[selected]&&!reverse[selected]))return new Set();
    const forward=Boolean(pairs[selected]);
    const target=forward?pairs[selected]:reverse[selected];
    let depth=0;
    for(let cursor=index;forward?cursor<source.length:cursor>=0;cursor+=forward?1:-1){
      const character=source[cursor];
      if(character===selected)depth+=1;
      else if(character===target){
        depth-=1;
        if(depth===0)return new Set([index,cursor]);
      }
    }
    return new Set([index]);
  }
  function escapedSegment(value,start,brackets){
    let result='';
    for(let index=0;index<value.length;index+=1){
      const character=escapeHtml(value[index]);
      result+=brackets.has(start+index)?`<span class="matching-bracket">${character}</span>`:character;
    }
    return result;
  }
  function tokenClass(token,source,end){
    if(/^<!--|^\/\*|^\/\/|^#(?![0-9a-f]{3,8}\b)/i.test(token))return 'syntax-comment';
    if(/^<\/?[a-z]/i.test(token))return 'syntax-tag';
    if(/^['"`]/.test(token))return source.slice(end).trimStart().startsWith(':')?'syntax-property':'syntax-string';
    if(/^\d/.test(token))return 'syntax-number';
    if(keywordPattern.test(token))return 'syntax-keyword';
    return 'syntax-operator';
  }
  function syntax(value){
    const source=String(value||'');
    const brackets=matchingBracketIndexes(source,refs.input.selectionStart);
    const tokenPattern=state.language==='html'
      ? /<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b/g
      : /\/\*[\s\S]*?\*\/|\/\/[^\n]*|#(?![0-9a-fA-F]{3,8}\b)[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][\w$]*\b|[=+\-*\/%!<>:&|]+/g;
    let html='';
    let lastIndex=0;
    for(const match of source.matchAll(tokenPattern)){
      const index=match.index||0;
      html+=escapedSegment(source.slice(lastIndex,index),lastIndex,brackets);
      html+=`<span class="${tokenClass(match[0],source,index+match[0].length)}">${escapedSegment(match[0],index,brackets)}</span>`;
      lastIndex=index+match[0].length;
    }
    return html+escapedSegment(source.slice(lastIndex),lastIndex,brackets)+'\n';
  }
  function renderEditor(){
    refs.highlight.innerHTML=syntax(refs.input.value);
    refs.lineNumbers.textContent=Array.from({length:refs.input.value.split('\n').length},(_,index)=>index+1).join('\n');
    document.querySelectorAll('[data-starters] button').forEach(button=>button.classList.toggle('is-active',refs.input.value===button.dataset.code));
    updateCursor();
    refs.input.scrollTop=refs.highlight.parentElement.scrollTop;
    refs.input.scrollLeft=refs.highlight.parentElement.scrollLeft;
  }
  function updateCursor(){
    const before=refs.input.value.slice(0,refs.input.selectionStart);
    const line=before.split('\n').length;
    const column=before.length-before.lastIndexOf('\n');
    const label=`Ln ${line}, Col ${column}`;
    refs.cursor.textContent=label;
    refs.editorWrap.style.setProperty('--active-line',String(line-1));
    document.querySelectorAll('[data-cursor-status]').forEach(item=>item.textContent=label);
    refs.highlight.innerHTML=syntax(refs.input.value);
  }
  function renderStarters(){
    const info=languages[state.language];
    const choices=[['Default starter',info.starter]];
    if(starters[state.language])choices.push(starters[state.language]);
    refs.starters.replaceChildren();
    choices.forEach(([label,value])=>{
      const button=document.createElement('button');
      button.type='button';
      button.textContent=label;
      button.dataset.code=value;
      button.classList.toggle('is-active',code()===value);
      button.addEventListener('click',()=>setCode(value));
      refs.starters.append(button);
    });
  }
  function languageLabel(){return state.language==='cpp'?'C++':state.language==='csharp'?'C#':state.language[0].toUpperCase()+state.language.slice(1)}
  function resetPreview(){
    runSequence+=1;
    setRunning(false);
    hasRun=false;
    lastOutput='';
    previewRunId='';
    runLogLines=[];
    runtimeProblems=[];
    refs.preview.removeAttribute('srcdoc');
    refs.refreshPreview.disabled=true;
    refs.problemCount.textContent='0';
    setPreviewNote('Not run','');
    setResultMode('output');
  }
  function syncLanguage(){
    const info=languages[state.language];
    refs.language.value=state.language;
    refs.help.textContent=info.help;
    refs.files.forEach(file=>file.textContent=info.file);
    refs.languageStatus.textContent=languageLabel();
    refs.languageBadge.textContent=languageLabel();
    refs.input.value=code();
    renderStarters();
    renderEditor();
    resetPreview();
    save();
  }
  function previewDocument(source){if(state.language==='html')return source;if(state.language==='css')return `<!doctype html><style>${source}</style><article class="card"><h1>Styled card</h1><p>Your CSS is running in this safe preview.</p></article>`;return `<!doctype html><style>body{font-family:system-ui;padding:2rem;color:#172033}button{padding:.7rem 1rem;border:0;border-radius:.5rem;background:#4f6ee8;color:white}</style><h1>JavaScript preview</h1><p id="message">Press the button to test your code.</p><button>Try it</button><script>${source.replace(/<\/script/gi,'<\\/script')}<\/script>`}
  function markdown(source){return escapeHtml(source).replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h1>$1</h1>').replace(/^[-*] (.*)$/gm,'<li>$1</li>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br>')}
  function setPreviewNote(label,kind){
    refs.previewStateLabel.textContent=label;
    refs.previewState.className=`preview-state${kind?` is-${kind}`:''}`;
  }
  function setRunning(value){
    running=Boolean(value);
    refs.runButtons.forEach(button=>{
      button.disabled=running;
      button.classList.toggle('is-running',running);
      const label=button.querySelector('[data-run-label]');
      if(label)label.textContent=running?'Running...':'Run code';
      else if(button.matches('[data-run-empty]'))button.textContent=running?'Running...':'Run code';
    });
    refs.refreshPreview.disabled=running||!hasRun;
  }
  function problemMessages(){
    const messages=runtimeProblems.map(problem=>({...problem}));
    if(state.language==='json'&&!messages.some(message=>message.title==='Invalid JSON')){
      try{JSON.parse(code())}catch(error){messages.push({title:'Invalid JSON',detail:error.message})}
    }
    refs.problemCount.textContent=String(messages.length);
    return messages;
  }
  function renderProblems(){
    const messages=problemMessages();
    const list=document.createElement('div');
    list.className='problem-list';
    const entries=messages.length?messages:[{title:'No problems found',detail:`${languages[state.language].file} passed the available browser checks.`,clear:true}];
    entries.forEach(message=>{
      const row=document.createElement('div');
      row.className=`problem-row${message.clear?' is-clear':''}`;
      const symbol=document.createElement('i');
      symbol.textContent=message.clear?'✓':'!';
      const copy=document.createElement('div');
      const title=document.createElement('strong');
      const detail=document.createElement('span');
      title.textContent=message.title;
      detail.textContent=message.detail;
      copy.append(title,detail);
      row.append(symbol,copy);
      list.append(row);
    });
    refs.output.replaceChildren(list);
  }
  function renderTerminal(){
    refs.output.replaceChildren();
    const lines=runLogLines.length?runLogLines:lastTerminal.split('\n').map((text,index)=>({text:text.replace(/^>\s*/,''),tone:index===0?'prompt':'muted'}));
    lines.forEach((entry,index)=>{
      const line=document.createElement('div');
      line.className='terminal-line';
      const prompt=document.createElement('span');
      prompt.className=entry.tone==='prompt'?'terminal-prompt':'terminal-muted';
      prompt.textContent=entry.tone==='prompt'?'❯':'·';
      const content=document.createElement('span');
      content.textContent=entry.text;
      line.append(prompt,content);
      refs.output.append(line);
    });
  }
  function setResultMode(mode='output'){
    refs.resultTabs.forEach(tab=>tab.classList.toggle('is-active',tab.dataset.resultMode===mode));
    refs.preview.hidden=true;
    refs.previewEmpty.hidden=true;
    refs.output.hidden=true;
    if(mode==='terminal'){
      refs.output.hidden=false;
      renderTerminal();
      return;
    }
    if(mode==='problems'){
      refs.output.hidden=false;
      renderProblems();
      return;
    }
    if(refs.preview.srcdoc){refs.preview.hidden=false;return}
    if(hasRun){refs.output.hidden=false;refs.output.textContent=lastOutput;return}
    refs.previewEmpty.hidden=false;
  }
  async function run(){
    if(running)return;
    const source=code();
    const language=state.language;
    const runId=++runSequence;
    hasRun=true;
    refs.refreshPreview.disabled=false;
    lastTerminal=`Run ${languages[state.language].file}\nCompleted ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
    runLogLines=[{text:`Run ${languages[state.language].file}`,tone:'prompt'},{text:`Started ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`,tone:'muted'}];
    runtimeProblems=[];
    refs.problemCount.textContent='0';
    if(languages[state.language].run&&['html','css','javascript'].includes(state.language)){
      const csp='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; img-src data:">';
      previewRunId=`preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const bridge=`<script>(()=>{const runId=${JSON.stringify(previewRunId)};const send=(kind,args)=>parent.postMessage({type:'nyx-code-preview',runId,kind,text:args.map(value=>{try{return typeof value==='string'?value:JSON.stringify(value)}catch{return String(value)}}).join(' ')},'*');['log','info','warn','error'].forEach(kind=>{const original=console[kind]?.bind(console);console[kind]=(...args)=>{original?.(...args);send(kind,args)}});addEventListener('error',event=>send('error',[event.message||'Preview error']));addEventListener('unhandledrejection',event=>send('error',[event.reason?.message||event.reason||'Unhandled promise rejection']))})()<\/script>`;
      refs.preview.srcdoc=`${csp}${bridge}${previewDocument(source)}`;
      setPreviewNote('Live','live');
      setResultMode('output');
      return;
    }
    refs.preview.removeAttribute('srcdoc');
    if(state.language==='json'){
      try{lastOutput=JSON.stringify(JSON.parse(source),null,2);setPreviewNote('Valid JSON','live')}
      catch(error){lastOutput=`JSON error: ${error.message}`;runtimeProblems=[{title:'Invalid JSON',detail:error.message}];refs.problemCount.textContent='1';setPreviewNote('Needs a fix','note')}
      setResultMode('output');
      return;
    }
    if(state.language==='markdown'){
      previewRunId='';
      refs.preview.srcdoc=`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>html,body{min-height:100%;margin:0;background:#fff}body{font:15px/1.6 system-ui;padding:1.4rem;color:#172033}code{background:#edf1f9;padding:.1rem .25rem;border-radius:.25rem}h1,h2,h3{line-height:1.2}</style><p>${markdown(source)}</p>`;
      setPreviewNote('Rendered','live');
      setResultMode('output');
      return;
    }
    if(languages[state.language].runner){
      lastOutput='Running your code...';
      setPreviewNote('Running...','note');
      setRunning(true);
      setResultMode('output');
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),18_000);
      try{
        const response=await fetch('/api/code-studio/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({language,code:source}),signal:controller.signal});
        const contentType=response.headers.get('content-type')||'';
        const result=contentType.includes('application/json')?await response.json():{};
        if(runId!==runSequence)return;
        if(!response.ok)throw new Error(result.error||'The isolated code runner could not complete this request.');
        const stdout=String(result.stdout||'').trimEnd();
        const diagnostics=String(result.diagnostics||'').trimEnd();
        lastOutput=[stdout,diagnostics].filter(Boolean).join('\n\n')||'Program finished with no output.';
        const duration=Number.isFinite(Number(result.time))?` in ${Number(result.time).toFixed(3)}s`:'';
        runLogLines.push({text:`${result.status||'Finished'}${duration}`,tone:result.ok?'prompt':'muted'});
        if(result.ok){
          setPreviewNote('Completed','live');
        }else{
          runtimeProblems=[{title:result.status||'Run failed',detail:diagnostics||stdout||'The program did not finish successfully.'}];
          setPreviewNote('Needs a fix','note');
        }
      }catch(error){
        if(runId!==runSequence)return;
        const message=error?.name==='AbortError'?'The code run took too long. Try a smaller program.':String(error?.message||'The isolated code runner is temporarily unavailable.');
        lastOutput=message;
        runtimeProblems=[{title:'Could not run code',detail:message}];
        runLogLines.push({text:message,tone:'muted'});
        setPreviewNote('Run failed','note');
      }finally{
        clearTimeout(timeout);
        if(runId===runSequence){
          refs.problemCount.textContent=String(runtimeProblems.length);
          setRunning(false);
          setResultMode(document.querySelector('.result-tab.is-active')?.dataset.resultMode||'output');
        }
      }
    }
  }
  const CUSTOM_THEME_FALLBACK='#6f9ee8';
  const customThemeProperties=['--studio-theme-hover-accent','--studio-theme-hover-soft','--studio-theme-hover-line'];
  function themeHex(value,fallback=CUSTOM_THEME_FALLBACK){const raw=String(value||'').trim();return /^#[0-9a-f]{6}$/i.test(raw)?raw.toLowerCase():fallback}
  function shadeHex(hex,percent=0){const clean=themeHex(hex);const amount=Math.max(-100,Math.min(100,Number(percent)||0))/100;const channel=index=>{const value=parseInt(clean.slice(index,index+2),16);return Math.round(amount>=0?value+(255-value)*amount:value*(1+amount))};return '#'+[1,3,5].map(index=>channel(index).toString(16).padStart(2,'0')).join('')}
  function themeRgba(hex,alpha){const clean=themeHex(hex);const channels=[1,3,5].map(index=>parseInt(clean.slice(index,index+2),16));return `rgba(${channels.join(',')},${alpha})`}
  function inheritedTheme(){try{return String(localStorage.getItem('nyx.theme')||'default')}catch{return 'default'}}
  function inheritedCustomThemeColor(){try{return themeHex(localStorage.getItem('nyx.customThemeColor'))}catch{return CUSTOM_THEME_FALLBACK}}
  function clearCustomThemePalette(){customThemeProperties.forEach(property=>document.documentElement.style.removeProperty(property))}
  function applyCustomThemePalette(){
    const base=inheritedCustomThemeColor();
    const accent=shadeHex(base,38);
    const styles={
      '--studio-theme-hover-accent':accent,
      '--studio-theme-hover-soft':themeRgba(accent,.06),
      '--studio-theme-hover-line':themeRgba(accent,.19)
    };
    Object.entries(styles).forEach(([property,value])=>document.documentElement.style.setProperty(property,value));
  }
  function applyTheme(){
    document.body.classList.remove('theme-ruby','theme-emerald','theme-sakura','theme-fresh','theme-custom');
    clearCustomThemePalette();
    const theme=inheritedTheme();
    if(theme==='custom'){
      document.body.classList.add('theme-custom');
      applyCustomThemePalette();
      return;
    }
    if(['ruby','emerald','sakura','fresh'].includes(theme))document.body.classList.add(`theme-${theme}`);
  }
  function focusLanguage(){refs.language.focus()}
  function handleCommand(command){if(command==='reset'){delete state.codes[state.language];syncLanguage();return}if(command==='edit'){refs.input.focus();return}if(command==='select'){refs.input.focus();refs.input.select();return}if(command==='preview'){setResultMode('output');return}if(command==='language'){focusLanguage();return}if(command==='run'){run();return}if(command==='terminal'){setResultMode('terminal')}}
  async function accountToken(){if(parent!==window){const requestId=`code-${Date.now()}-${Math.random().toString(36).slice(2)}`;const parentToken=await new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;clearTimeout(timer);removeEventListener('message',receive);resolve(String(value||''))};const receive=event=>{if(event.source===parent&&event.origin===location.origin&&event.data?.type==='nyx:account-token-response'&&event.data.requestId===requestId)finish(event.data.token)};const timer=setTimeout(()=>finish(''),2200);addEventListener('message',receive);parent.postMessage({type:'nyx:account-token-request',requestId},location.origin)});if(parentToken)return parentToken}if(!authPromise)authPromise=(async()=>{try{const response=await fetch('/api/founder-profile/auth-config',{cache:'no-store'});const config=await response.json();if(!config?.enabled||!config?.apiKey||!config?.projectId)return null;const [{initializeApp,getApps},{getAuth,setPersistence,browserLocalPersistence}]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')]);const app=getApps().find(item=>item.name==='nyx-code-studio')||initializeApp({apiKey:config.apiKey,authDomain:`${config.projectId}.firebaseapp.com`,projectId:config.projectId},'nyx-code-studio');const auth=getAuth(app);try{await setPersistence(auth,browserLocalPersistence)}catch{}if(typeof auth.authStateReady==='function')await auth.authStateReady();return auth}catch{return null}})();try{const auth=await authPromise;return auth?.currentUser?await auth.currentUser.getIdToken():''}catch{return ''}}
  async function aiHeaders(provider='shared',token=null){const account=token===null?await accountToken():token;return {'content-type':'application/json','x-nyx-ai-provider':provider,...(account?{Authorization:`Bearer ${account}`}:{})}}
  async function loadAiOptions(){
    try{
      const providerResponse=await fetch('/api/nyx-ai/providers',{headers:{accept:'application/json'}});
      const providerData=await providerResponse.json();
      const availableProviders=providerResponse.ok&&Array.isArray(providerData?.providers)?providerData.providers.map(item=>String(item?.id||'')):[];
      const providerIds=['huggingface','shared','groq'].filter(provider=>availableProviders.includes(provider));
      const token=await accountToken();
      const options=(await Promise.all(providerIds.map(async provider=>{
        try{
          const response=await fetch('/api/nyx-ai/models',{headers:await aiHeaders(provider,token)});
          const data=await response.json();
          const models=response.ok&&Array.isArray(data?.models)?data.models:[];
          const preferred=(provider==='huggingface'&&models.find(item=>/coder/i.test(item?.id||'')))||models.find(item=>item?.id==='chatgpt-5.4-mini')||models.find(item=>item?.id==='openai/gpt-oss-20b')||models[0];
          return preferred?.id?{provider,model:String(preferred.id)}:null;
        }catch{return null}
      }))).filter(Boolean);
      aiOptions=options;
    }catch{aiOptions=[]}
    return aiOptions;
  }
  function ensureAiOptions(refresh=false){
    if(!refresh&&aiOptions.length)return Promise.resolve(aiOptions);
    if(refresh||!aiOptionsPromise)aiOptionsPromise=loadAiOptions();
    return aiOptionsPromise;
  }
  function aiReplyText(data){return String(data?.text||data?.response||data?.choices?.[0]?.message?.content||data?.choices?.[0]?.text||'').trim()}
  async function requestAiSuggestion(option,payload,token){
    const response=await fetch('/api/nyx-ai',{method:'POST',headers:await aiHeaders(option.provider,token),body:JSON.stringify({...payload,model:option.model})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const error=new Error(data?.error||(response.status>=500?'Nyx AI is temporarily unavailable. Please try again.':`Nyx AI could not help (${response.status}).`));
      error.status=response.status;
      throw error;
    }
    const text=aiReplyText(data);
    if(!text)throw new Error('Nyx AI did not return a suggestion.');
    return text;
  }
  function setAiStatus(label,working=false){
    refs.aiStatusLabel.textContent=label;
    refs.aiStatus.classList.toggle('is-working',working);
  }
  function appendMessage(role,value,error=false){
    refs.answer.querySelector('[data-ai-empty]')?.remove();
    const message=document.createElement('article');
    message.className=`ai-message is-${role}${error?' is-error':''}`;
    const header=document.createElement('header');
    header.textContent=role==='user'?'You':'Nyx AI';
    const paragraph=document.createElement('p');
    paragraph.textContent=value;
    message.append(header,paragraph);
    refs.answer.append(message);
    refs.answer.scrollTop=refs.answer.scrollHeight;
    return message;
  }
  async function ask(prompt){
    const question=String(prompt||'').trim();
    if(!question)return;
    refs.send.disabled=true;
    document.querySelectorAll('[data-ai-prompt]').forEach(button=>{button.disabled=true});
    setAiStatus('Thinking',true);
    appendMessage('user',question);
    const reply=appendMessage('assistant','Looking through your code…');
    reply.classList.add('is-loading');
    try{
      let options=await ensureAiOptions();
      if(!options.length)options=await ensureAiOptions(true);
      if(!options.length)throw new Error('Nyx AI is not available right now. Please try again in a moment.');
      const file=languages[state.language].file;
      const currentCode=code();
      const codeLimit=18000;
      const visibleCode=currentCode.slice(0,codeLimit);
      const context=`You are helping in Nyx Code Studio. Give a practical, friendly answer for a ${file} file. Focus on the request, point out the most important issue first, and include a small corrected snippet only when it helps.\n\nUser request: ${question}\n\nCurrent code${currentCode.length>codeLimit?' (first 18,000 characters)':''}:\n\n${visibleCode}`;
      const payload={message:question,messages:[{role:'user',content:context}],responseDepth:'normal',stream:false};
      const token=await accountToken();
      let suggestion='';
      let lastError=null;
      for(let index=0;index<options.length;index+=1){
        const option=options[index];
        try{
          suggestion=await requestAiSuggestion(option,payload,token);
          if(index>0)aiOptions=[option,...options.filter(item=>item!==option)];
          break;
        }catch(error){
          lastError=error;
          if(!(error?.status>=500)||index===options.length-1)throw error;
        }
      }
      if(!suggestion)throw lastError||new Error('Nyx AI did not return a suggestion.');
      reply.querySelector('p').textContent=suggestion;
      refs.prompt.value='';
    }catch(error){
      reply.classList.add('is-error');
      reply.querySelector('p').textContent=error?.message||'Nyx AI could not complete that suggestion.';
    }finally{
      reply.classList.remove('is-loading');
      refs.send.disabled=false;
      document.querySelectorAll('[data-ai-prompt]').forEach(button=>{button.disabled=false});
      setAiStatus('Ready');
      refs.answer.scrollTop=refs.answer.scrollHeight;
    }
  }
  function downloadCode(){
    const blob=new Blob([code()],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=languages[state.language].file;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),0);
    lastTerminal=`Exported ${languages[state.language].file}\nSaved from this browser`;
    runLogLines=[{text:`Exported ${languages[state.language].file}`,tone:'prompt'},{text:'Saved from this browser',tone:'muted'}];
  }
  function loadLayout(){
    try{return JSON.parse(localStorage.getItem(UI_STORAGE_KEY)||'{}')}catch{return {}}
  }
  function saveLayout(){
    const previous=loadLayout();
    const assistantWidth=document.querySelector('.assistant-panel').getBoundingClientRect().width||previous.assistantWidth||318;
    const previewWidth=refs.resultCard.getBoundingClientRect().width||previous.previewWidth||420;
    const layout={assistantWidth,previewWidth,aiCollapsed:document.body.classList.contains('ai-collapsed'),previewCollapsed:document.body.classList.contains('preview-collapsed')};
    try{localStorage.setItem(UI_STORAGE_KEY,JSON.stringify(layout))}catch{}
  }
  function setPanelCollapsed(panel,collapsed,shouldSave=true){
    const className=panel==='assistant'?'ai-collapsed':'preview-collapsed';
    document.body.classList.toggle(className,collapsed);
    document.querySelectorAll(`[data-toggle-panel="${panel}"]`).forEach(button=>button.setAttribute('aria-pressed',String(!collapsed)));
    if(shouldSave)saveLayout();
  }
  function initializeLayout(){
    const layout=loadLayout();
    if(Number.isFinite(layout.assistantWidth)&&layout.assistantWidth>0)document.documentElement.style.setProperty('--assistant-width',`${Math.max(250,Math.min(420,layout.assistantWidth))}px`);
    if(Number.isFinite(layout.previewWidth)&&layout.previewWidth>0)document.documentElement.style.setProperty('--preview-width',`${Math.max(280,Math.min(680,layout.previewWidth))}px`);
    setPanelCollapsed('assistant',Boolean(layout.aiCollapsed),false);
    setPanelCollapsed('preview',Boolean(layout.previewCollapsed),false);
  }
  function bindPanelResizer(resizer){
    const panel=resizer.dataset.resizePanel;
    const resizeBy=delta=>{
      if(panel==='assistant'){
        const current=document.querySelector('.assistant-panel').getBoundingClientRect().width;
        document.documentElement.style.setProperty('--assistant-width',`${Math.max(250,Math.min(420,current+delta))}px`);
      }else{
        const current=refs.resultCard.getBoundingClientRect().width;
        const maximum=Math.max(280,refs.workbench.getBoundingClientRect().width-380);
        document.documentElement.style.setProperty('--preview-width',`${Math.max(280,Math.min(maximum,current-delta))}px`);
      }
    };
    resizer.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      event.preventDefault();
      const startX=event.clientX;
      const assistantStart=document.querySelector('.assistant-panel').getBoundingClientRect().width;
      const previewStart=refs.resultCard.getBoundingClientRect().width;
      const move=moveEvent=>{
        const delta=moveEvent.clientX-startX;
        if(panel==='assistant')document.documentElement.style.setProperty('--assistant-width',`${Math.max(250,Math.min(420,assistantStart+delta))}px`);
        else{
          const maximum=Math.max(280,refs.workbench.getBoundingClientRect().width-380);
          document.documentElement.style.setProperty('--preview-width',`${Math.max(280,Math.min(maximum,previewStart-delta))}px`);
        }
      };
      const stop=()=>{document.body.classList.remove('is-resizing');removeEventListener('pointermove',move);removeEventListener('pointerup',stop);saveLayout()};
      document.body.classList.add('is-resizing');
      addEventListener('pointermove',move);
      addEventListener('pointerup',stop,{once:true});
    });
    resizer.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();
      resizeBy(event.key==='ArrowRight'?16:-16);
      saveLayout();
    });
    resizer.addEventListener('dblclick',()=>{
      document.documentElement.style.removeProperty(panel==='assistant'?'--assistant-width':'--preview-width');
      saveLayout();
    });
  }
  function setMobileView(view){
    document.body.classList.toggle('mobile-show-ai',view==='ai');
    document.body.classList.toggle('mobile-show-preview',view==='preview');
    document.querySelectorAll('.mobile-view-switcher [data-mobile-view]').forEach(button=>button.classList.toggle('is-active',button.dataset.mobileView===view));
  }
  refs.language.addEventListener('change',()=>{state.language=refs.language.value;syncLanguage()});
  refs.input.addEventListener('input',()=>{state.codes[state.language]=refs.input.value.slice(0,MAX_CODE_CHARS);setSaveState('Saving…','saving');renderEditor();save()});
  refs.input.addEventListener('scroll',()=>{refs.highlight.parentElement.scrollTop=refs.input.scrollTop;refs.highlight.parentElement.scrollLeft=refs.input.scrollLeft;refs.lineNumbers.scrollTop=refs.input.scrollTop;refs.editorWrap.style.setProperty('--editor-scroll-top',`${refs.input.scrollTop}px`)});
  refs.input.addEventListener('keyup',updateCursor);
  refs.input.addEventListener('click',updateCursor);
  refs.input.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();const start=refs.input.selectionStart,end=refs.input.selectionEnd;refs.input.setRangeText('  ',start,end,'end');refs.input.dispatchEvent(new Event('input'))}else if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();run();if(matchMedia('(max-width: 940px)').matches)setMobileView('preview')}});
  refs.runButtons.forEach(button=>button.addEventListener('click',()=>{run();if(matchMedia('(max-width: 940px)').matches)setMobileView('preview')}));
  document.querySelectorAll('[data-reset]').forEach(button=>button.addEventListener('click',()=>{delete state.codes[state.language];syncLanguage()}));
  document.querySelector('[data-load-starter]').addEventListener('click',()=>setCode(languages[state.language].starter));
  refs.clear.addEventListener('click',()=>setCode(''));
  refs.download.addEventListener('click',downloadCode);
  refs.refreshPreview.addEventListener('click',run);
  refs.fullscreenPreview.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await refs.resultCard.requestFullscreen()}catch{}});
  refs.resultTabs.forEach(tab=>tab.addEventListener('click',()=>setResultMode(tab.dataset.resultMode)));
  document.querySelectorAll('[data-toggle-panel]').forEach(button=>button.addEventListener('click',()=>setPanelCollapsed(button.dataset.togglePanel,!document.body.classList.contains(button.dataset.togglePanel==='assistant'?'ai-collapsed':'preview-collapsed'))));
  document.querySelectorAll('[data-resize-panel]').forEach(bindPanelResizer);
  document.querySelectorAll('[data-mobile-view]').forEach(button=>button.addEventListener('click',()=>setMobileView(button.dataset.mobileView)));
  document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>handleCommand(button.dataset.command)));
  refs.form.addEventListener('submit',event=>{event.preventDefault();void ask(refs.prompt.value)});
  refs.prompt.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();refs.form.requestSubmit()}});
  document.querySelectorAll('[data-ai-prompt]').forEach(button=>button.addEventListener('click',()=>void ask(button.dataset.aiPrompt)));
  addEventListener('message',event=>{
    const message=event.data;
    if(event.source!==refs.preview.contentWindow||message?.type!=='nyx-code-preview'||message.runId!==previewRunId)return;
    const kind=['log','info','warn','error'].includes(message.kind)?message.kind:'log';
    const text=String(message.text||'(empty message)').slice(0,2000);
    runLogLines.push({text:`${kind}: ${text}`,tone:kind==='error'||kind==='warn'?'muted':'prompt'});
    if(kind==='warn'||kind==='error')runtimeProblems.push({title:kind==='error'?'Preview error':'Preview warning',detail:text});
    refs.problemCount.textContent=String(runtimeProblems.length);
    const activeMode=document.querySelector('.result-tab.is-active')?.dataset.resultMode;
    if(activeMode==='terminal')renderTerminal();
    if(activeMode==='problems')renderProblems();
  });
  addEventListener('storage',event=>{if(event.key==='nyx.theme'||event.key==='nyx.customThemeColor')applyTheme()});
  initializeLayout();
  applyTheme();
  syncLanguage();
  setMobileView('editor');
  void ensureAiOptions();
})();
