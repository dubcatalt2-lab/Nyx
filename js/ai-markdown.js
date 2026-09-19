(()=>{
'use strict';
  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,character=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[character]);
  }

  function mathMarkup(value,displayMode=false){
    const source=String(value??'').trim();
    if(!source) return '';
    try{
      if(window.katex?.renderToString){
        return window.katex.renderToString(source,{
          displayMode:Boolean(displayMode),
          throwOnError:false,
          strict:'ignore',
          trust:false,
          output:'htmlAndMathml'
        });
      }
    }catch(error){
      console.warn('Nyx AI could not render math:',error);
    }
    const readable=source
      .replace(/\\text\{([^{}]*)\}/g,'$1')
      .replace(/\\[,;:!]/g,' ')
      .replace(/\\(?:quad|qquad)\b/g,' ')
      .replace(/\\(?:times|cdot)/g,' × ')
      .replace(/\\leq?/g,'≤')
      .replace(/\\geq?/g,'≥')
      .replace(/\\neq/g,'≠')
      .replace(/\\pm/g,'±')
      .replace(/[{}]/g,'');
    return `<span class="ai-math-fallback">${escapeHtml(readable)}</span>`;
  }

  function inlineMarkdown(value){
    const code=[];
    let source=String(value??'').replace(/`([^`\n]+)`/g,(_match,text)=>{
      const token=`@@NYX_INLINE_${code.length}@@`;
      code.push(`<code>${escapeHtml(text)}</code>`);
      return token;
    });
    const math=[];
    source=source.replace(/\\+\[([^\n]*?)\\+\]|\\+\(([^\n]*?)\\+\)/g,(_match,display,inline)=>{
      const token=`@@NYX_MATH_${math.length}@@`;
      math.push(mathMarkup(display??inline,display!==undefined));
      return token;
    });
    source=source.replace(/(?<!\\)\$([^\s$](?:[^$\n]*?[^\s$])?)\$(?!\d)/g,(_match,formula)=>{
      const token=`@@NYX_MATH_${math.length}@@`;
      math.push(mathMarkup(formula,false));
      return token;
    });
    let html=escapeHtml(source);
    html=html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html=html.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
    html=html.replace(/__([^_\n]+)__/g,'<strong>$1</strong>');
    html=html.replace(/~~([^~\n]+)~~/g,'<s>$1</s>');
    html=html.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>');
    math.forEach((token,index)=>{html=html.replace(`@@NYX_MATH_${index}@@`,token)});
    code.forEach((token,index)=>{html=html.replace(`@@NYX_INLINE_${index}@@`,token)});
    return html;
  }

  function tableCells(line){
    return String(line).trim().replace(/^\||\|$/g,'').split('|').map(cell=>cell.trim());
  }

  function isTableDivider(line){
    const cells=tableCells(line);
    return cells.length>1&&cells.every(cell=>/^:?-{3,}:?$/.test(cell));
  }

  function displayMathFence(line){
    const trimmed=String(line??'').trim();
    if(/^\\+\[$/.test(trimmed)) return 'bracket';
    if(trimmed==='$$') return 'dollar';
    return '';
  }

  function isDisplayMathClose(line,type){
    const trimmed=String(line??'').trim();
    return type==='bracket'?/^\\+\]$/.test(trimmed):trimmed==='$$';
  }

  function displayMathLine(line){
    const trimmed=String(line??'').trim();
    const bracket=trimmed.match(/^\\+\[([\s\S]*?)\\+\]$/);
    if(bracket) return bracket[1];
    const dollar=trimmed.match(/^\$\$([\s\S]*?)\$\$$/);
    return dollar?dollar[1]:null;
  }

  function isBlockStart(lines,index){
    const line=lines[index]||'';
    return Boolean(displayMathFence(line))||displayMathLine(line)!==null||isDisplayMathClose(line,'bracket')||/^```/.test(line)||/^#{1,3}\s+/.test(line)||/^>\s?/.test(line)||/^\s*[-*+]\s+/.test(line)||/^\s*\d+[.)]\s+/.test(line)||/^\s*(?:---+|___+)\s*$/.test(line)||line.includes('\t')||(line.includes('|')&&isTableDivider(lines[index+1]||''));
  }

  function markdown(value){
    const lines=String(value??'').replace(/\r\n?/g,'\n').split('\n');
    const blocks=[];
    for(let index=0;index<lines.length;){
      const line=lines[index];
      if(!line.trim()){index+=1;continue}

      const fence=line.match(/^```([^\s`]*)\s*$/);
      if(fence){
        const language=(fence[1]||'code').slice(0,24);
        const code=[];
        index+=1;
        while(index<lines.length&&!/^```\s*$/.test(lines[index])){code.push(lines[index]);index+=1}
        if(index<lines.length) index+=1;
        blocks.push(`<div class="ai-code-block"><div class="ai-code-head"><span>${escapeHtml(language)}</span><button class="ai-code-copy" type="button" data-copy-code aria-label="Copy code"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg><span>Copy</span></button></div><pre><code>${escapeHtml(code.join('\n'))}</code></pre></div>`);
        continue;
      }

      const displayFence=displayMathFence(line);
      if(displayFence){
        let closeIndex=index+1;
        while(closeIndex<lines.length&&!isDisplayMathClose(lines[closeIndex],displayFence)) closeIndex+=1;
        if(closeIndex<lines.length){
          blocks.push(`<div class="ai-math-block">${mathMarkup(lines.slice(index+1,closeIndex).join('\n'),true)}</div>`);
          index=closeIndex+1;
          continue;
        }
        let endIndex=index+1;
        while(endIndex<lines.length&&lines[endIndex].trim()) endIndex+=1;
        const unfinishedMath=lines.slice(index+1,endIndex).join('\n');
        if(unfinishedMath.trim()) blocks.push(`<div class="ai-math-block">${mathMarkup(unfinishedMath,true)}</div>`);
        index=endIndex;
        continue;
      }

      const displayMath=displayMathLine(line);
      if(displayMath!==null){
        blocks.push(`<div class="ai-math-block">${mathMarkup(displayMath,true)}</div>`);
        index+=1;
        continue;
      }

      if(isDisplayMathClose(line,'bracket')){
        index+=1;
        continue;
      }

      if(line.includes('\t')){
        const rows=[];
        while(index<lines.length&&lines[index].includes('\t')&&lines[index].trim()){
          rows.push(lines[index].split(/\t+/).map(cell=>cell.trim()));
          index+=1;
        }
        const width=Math.max(0,...rows.map(row=>row.length));
        if(rows.length>1&&width>1){
          const headers=rows.shift();
          blocks.push(`<div class="ai-table-wrap"><table><thead><tr>${Array.from({length:width},(_item,cellIndex)=>`<th>${inlineMarkdown(headers[cellIndex]||'')}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${Array.from({length:width},(_item,cellIndex)=>`<td>${inlineMarkdown(row[cellIndex]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
          continue;
        }
        blocks.push(`<p>${rows.flat().map(inlineMarkdown).join('<br>')}</p>`);
        continue;
      }

      if(line.includes('|')&&isTableDivider(lines[index+1]||'')){
        const headers=tableCells(line);
        index+=2;
        const rows=[];
        while(index<lines.length&&lines[index].includes('|')&&lines[index].trim()){
          rows.push(tableCells(lines[index]));
          index+=1;
        }
        blocks.push(`<div class="ai-table-wrap"><table><thead><tr>${headers.map(cell=>`<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${headers.map((_header,cellIndex)=>`<td>${inlineMarkdown(row[cellIndex]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }

      const heading=line.match(/^(#{1,3})\s+(.+)$/);
      if(heading){
        const level=heading[1].length;
        blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        index+=1;
        continue;
      }

      if(/^>\s?/.test(line)){
        const quote=[];
        while(index<lines.length&&/^>\s?/.test(lines[index])){quote.push(lines[index].replace(/^>\s?/,''));index+=1}
        blocks.push(`<blockquote>${quote.map(inlineMarkdown).join('<br>')}</blockquote>`);
        continue;
      }

      const unordered=/^\s*[-*+]\s+/.test(line);
      const ordered=/^\s*\d+[.)]\s+/.test(line);
      if(unordered||ordered){
        const items=[];
        const pattern=ordered?/^\s*\d+[.)]\s+/:/^\s*[-*+]\s+/;
        while(index<lines.length&&pattern.test(lines[index])){items.push(lines[index].replace(pattern,''));index+=1}
        const tag=ordered?'ol':'ul';
        blocks.push(`<${tag}>${items.map(item=>`<li>${inlineMarkdown(item)}</li>`).join('')}</${tag}>`);
        continue;
      }

      if(/^\s*(?:---+|___+)\s*$/.test(line)){
        blocks.push('<hr>');
        index+=1;
        continue;
      }

      const paragraph=[line];
      index+=1;
      while(index<lines.length&&lines[index].trim()&&!isBlockStart(lines,index)){
        paragraph.push(lines[index]);
        index+=1;
      }
      blocks.push(`<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`);
    }
    return blocks.join('');
  }

window.NyxMarkdown={render:markdown};
})();
