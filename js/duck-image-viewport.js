// Shared Nyx/Tutsi DuckDuckGo image-results viewport repair.
globalThis.NyxDuckImageViewport = function(t, browserShellSourceUrl){
      if(!t?.frame) return;
      let doc;
      try{doc=t.frame.contentDocument}catch{return}
      if(!doc?.documentElement || doc.documentElement.dataset.nyxDuckImageViewport==='true') return;
      const currentSource=()=>{
        try{
          const href=String(t.frame.contentWindow?.location?.href || '');
          return browserShellSourceUrl(href) || browserShellSourceUrl(t.sourceUrl || t.url || '') || t.sourceUrl || t.url || '';
        }catch{
          return browserShellSourceUrl(t.sourceUrl || t.url || '') || t.sourceUrl || t.url || '';
        }
      };
      let initial;
      try{initial=new URL(currentSource(),location.href)}catch{return}
      if(initial.hostname.replace(/^www\./i,'').toLowerCase()!=='duckduckgo.com') return;
      doc.documentElement.dataset.nyxDuckImageViewport='true';
      const decodeBrokenImageUrl=value=>{
        const raw=String(value || '').trim();
        const match=raw.match(/https?%3a%2f%2f/i);
        if(!match) return '';
        const isEncodedUrl=match.index===0;
        const isScramjetPath=raw.includes('/~/sj/');
        if(!isEncodedUrl && !isScramjetPath) return '';
        let encoded=raw.slice(match.index);
        const metadataAt=encoded.search(/[?&]%24(?:rfp|io|tf|pf|iframe)=/i);
        if(metadataAt>0) encoded=encoded.slice(0,metadataAt);
        let decoded=encoded;
        for(let pass=0;pass<2 && /%[0-9a-f]{2}/i.test(decoded);pass++){
          try{decoded=decodeURIComponent(decoded)}catch{break}
        }
        return /^https?:\/\//i.test(decoded) ? decoded : '';
      };
      const repairImages=()=>{
        doc.querySelectorAll('img,source').forEach(image=>{
          const current=image.getAttribute('src') || '';
          const repaired=decodeBrokenImageUrl(current);
          if(repaired && repaired!==current) image.setAttribute('src',repaired);
          ['data-src','data-original','data-lazy-src','data-image-url'].forEach(attribute=>{
            const lazy=image.getAttribute(attribute) || '';
            const repairedLazy=decodeBrokenImageUrl(lazy);
            if(!repairedLazy || repairedLazy===lazy) return;
            image.setAttribute(attribute,repairedLazy);
            if(image.tagName==='IMG' && (!current || decodeBrokenImageUrl(current))) image.setAttribute('src',repairedLazy);
          });
          const srcset=image.getAttribute('srcset') || '';
          const firstSrcsetUrl=srcset.split(',')[0]?.trim().split(/\s+/)[0] || '';
          const repairedSrcset=decodeBrokenImageUrl(firstSrcsetUrl);
          if(repairedSrcset){
            image.removeAttribute('srcset');
            image.setAttribute('src',repairedSrcset);
          }
        });
      };
      const warmVisibleImages=()=>{
        const view=t.frame.contentWindow;
        if(!view || !t.frame.getClientRects().length) return;
        let source;
        try{source=new URL(currentSource())}catch{return}
        if(source.searchParams.get('ia')!=='images' && source.searchParams.get('iax')!=='images') return;
        const height=view.innerHeight, width=view.innerWidth;
        // Layout repair can move a lazy image into view after the site's scroll
        // handler has run. Start nearby thumbnails without moving the viewport.
        for(const image of doc.images){
          if(image.closest('header,nav,aside,[role="dialog"],[class*="modal" i],[class*="anomaly" i]'))continue;
          const box=image.getBoundingClientRect();
          if(box.width<50 || box.height<50 || box.bottom < -height || box.top > height*3 || box.right<0 || box.left>width)continue;
          if(image.getAttribute('loading')==='lazy')image.setAttribute('loading','eager');
          const current=image.getAttribute('src') || '';
          const placeholder=!current || current==='about:blank' || (/^data:image\//i.test(current) && image.complete && image.naturalWidth<=1);
          if(!placeholder || image.getAttribute('srcset'))continue;
          const lazy=image.getAttribute('data-src') || image.getAttribute('data-original') || image.getAttribute('data-lazy-src');
          if(!lazy)continue;
          try{
            const url=new URL(lazy,source);
            if(['http:','https:'].includes(url.protocol))image.setAttribute('src',lazy);
          }catch{}
        }
      };
      const repairImageFilterViewport=()=>{
        const labels=['AI images','All sizes','All colors','All types','All layouts','Licenses'];
        doc.querySelectorAll('nav').forEach(nav=>{
          const text=String(nav.innerText || nav.textContent || '').replace(/\s+/g,' ').trim();
          if(labels.filter(label=>text.includes(label)).length<3) return;
          const list=[...nav.querySelectorAll('ul')].find(candidate=>{
            const box=candidate.getBoundingClientRect?.();
            return box && box.width>=300 && box.height>=20 && box.height<=96;
          });
          if(!list) return;
          const navBox=nav.getBoundingClientRect?.();
          const listBox=list.getBoundingClientRect?.();
          if(!navBox || !listBox || navBox.height<=listBox.height+120) return;
          const targetHeight=Math.ceil(Math.max(40,listBox.height+16));
          nav.style.setProperty('height',`${targetHeight}px`,'important');
          nav.style.setProperty('min-height','0','important');
          nav.style.setProperty('max-height',`${targetHeight}px`,'important');
          nav.style.setProperty('overflow','visible','important');
          const wrapper=list.parentElement;
          if(wrapper && wrapper!==nav){
            const wrapperHeight=Math.ceil(Math.max(32,listBox.height));
            wrapper.style.setProperty('height',`${wrapperHeight}px`,'important');
            wrapper.style.setProperty('min-height','0','important');
            wrapper.style.setProperty('max-height',`${wrapperHeight}px`,'important');
            wrapper.style.setProperty('overflow','visible','important');
            wrapper.dataset.nyxDuckImageFilterWrapperFixed='true';
          }
          nav.dataset.nyxDuckImageFilterFixed='true';
          doc.documentElement.dataset.nyxDuckImageFilterFixed='true';
        });
      };
      const restoreDuckDuckGoSearchLayout=()=>{
        // DuckDuckGo changes between Images and All without reloading the document.
        // Every image-only layout override must therefore be undone explicitly.
        doc.querySelectorAll('[data-nyx-duck-mainline-hidden="true"]').forEach(mainline=>{
          ['display','min-height','height','margin','padding'].forEach(property=>mainline.style.removeProperty(property));
          delete mainline.dataset.nyxDuckMainlineHidden;
        });
        doc.querySelectorAll('[data-nyx-duck-image-gap-fixed="true"]').forEach(container=>{
          container.style.removeProperty('margin-top');
          delete container.dataset.nyxDuckImageGapFixed;
        });
        doc.querySelectorAll('[data-nyx-duck-image-filter-fixed="true"]').forEach(nav=>{
          ['height','min-height','max-height','overflow'].forEach(property=>nav.style.removeProperty(property));
          delete nav.dataset.nyxDuckImageFilterFixed;
        });
        doc.querySelectorAll('[data-nyx-duck-image-filter-wrapper-fixed="true"]').forEach(wrapper=>{
          ['height','min-height','max-height','overflow'].forEach(property=>wrapper.style.removeProperty(property));
          delete wrapper.dataset.nyxDuckImageFilterWrapperFixed;
        });
      };
      const collapseEmptyImageGap=()=>{
        const view=t.frame.contentWindow;
        if(!view || !doc.body) return;
        const pageText=String(doc.body.innerText || '');
        if(!/AI images/i.test(pageText) || !/All sizes/i.test(pageText) || !/All layouts/i.test(pageText)){
          restoreDuckDuckGoSearchLayout();
          return;
        }
        const scrollTop=view.scrollY || doc.scrollingElement?.scrollTop || 0;
        const resultImages=[...doc.images].filter(image=>{
          if(image.closest?.('header,nav,aside,[role="dialog"],[class*="modal" i],[class*="anomaly" i]')) return false;
          const box=image.getBoundingClientRect?.();
          return box && box.width>=100 && box.height>=70;
        }).sort((a,b)=>{
          const first=a.getBoundingClientRect();
          const second=b.getBoundingClientRect();
          return first.top-second.top || first.left-second.left;
        });
        if(resultImages.length<4) return;
        const sample=resultImages.slice(0,Math.min(12,resultImages.length));
        doc.querySelectorAll('[data-testid="mainline"],.results--main').forEach(mainline=>{
          if(sample.some(image=>mainline.contains(image))) return;
          mainline.style.setProperty('display','none','important');
          mainline.style.setProperty('min-height','0','important');
          mainline.style.setProperty('height','0','important');
          mainline.style.setProperty('margin','0','important');
          mainline.style.setProperty('padding','0','important');
          mainline.dataset.nyxDuckMainlineHidden='true';
        });
        let filterBottom=0;
        doc.querySelectorAll('div,nav,section').forEach(element=>{
          const text=String(element.innerText || '').replace(/\s+/g,' ').trim();
          const matches=['AI images','All sizes','All colors','All types','All layouts','Licenses']
            .filter(label=>text.includes(label)).length;
          if(matches<3) return;
          const box=element.getBoundingClientRect?.();
          if(!box || box.width<300 || box.height<=0 || box.height>120) return;
          filterBottom=Math.max(filterBottom,box.bottom+scrollTop);
        });
        const targetTop=Math.max(110,filterBottom ? filterBottom+12 : 0);
        let container=sample[0].parentElement;
        while(container && !sample.every(image=>container.contains(image))) container=container.parentElement;
        if(!container || container===doc.body || container===doc.documentElement) return;
        while(container.parentElement && container.parentElement!==doc.body && container.parentElement!==doc.documentElement){
          const parent=container.parentElement;
          if(parent.querySelector('[data-testid="header"],form[data-testid="search-form"]')) break;
          const parentBox=parent.getBoundingClientRect?.();
          const parentTop=(parentBox?.top || 0)+scrollTop;
          if(!parentBox || parentTop<targetTop+180) break;
          container=parent;
        }
        if(container.dataset.nyxDuckImageGapFixed==='true') return;
        const containerBox=container.getBoundingClientRect?.();
        if(!containerBox) return;
        const gap=Math.round(containerBox.top+scrollTop-targetTop);
        if(gap<220) return;
        const currentMargin=Number.parseFloat(view.getComputedStyle(container).marginTop) || 0;
        container.style.setProperty('margin-top',`${currentMargin-gap}px`,'important');
        container.dataset.nyxDuckImageGapFixed='true';
        doc.documentElement.dataset.nyxDuckImageGapFixed='true';
      };
      let queued=false;
      const queueRepair=()=>{
        if(queued) return;
        queued=true;
        requestAnimationFrame(()=>{
          queued=false;
          repairImageFilterViewport();
          repairImages();
          collapseEmptyImageGap();
          warmVisibleImages();
        });
      };
      try{
        new MutationObserver(queueRepair).observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','srcset','loading','data-src','data-original','data-lazy-src','data-image-url']});
      }catch{}
      let warmQueued=false;
      const queueWarm=()=>{
        if(warmQueued)return;
        warmQueued=true;
        requestAnimationFrame(()=>{warmQueued=false;warmVisibleImages()});
      };
      // Image completion and viewport changes must work without continuous scroll.
      doc.addEventListener('load',queueWarm,true);
      doc.addEventListener('scroll',queueWarm,{capture:true,passive:true});
      doc.defaultView?.addEventListener('resize',queueWarm,{passive:true});
      repairImageFilterViewport();
      repairImages();
      collapseEmptyImageGap();
      warmVisibleImages();
      [250,700,1400,2600,4200].forEach(delay=>setTimeout(()=>{
        repairImageFilterViewport();
        repairImages();
        collapseEmptyImageGap();
        warmVisibleImages();
      },delay));
    };
