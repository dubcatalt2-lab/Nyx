// Resource-probe approach adapted from Hugh Parry's chrome-extension-identifier.
// MIT attribution: licenses/extension-identifier.txt. Historical resource references
// and verification limits are documented in docs/TUTSI_FILTER_DETECTION.md.
export const filterSignatures = [
  {
    "vendor": "securly",
    "label": "Securly",
    "id": "joflmkccibkooplaeoinecjbmdebglab",
    "path": "fonts/Metropolis.css"
  },
  {
    "vendor": "securly",
    "label": "Securly",
    "id": "iheobagjkfklnlikgihanlhcddjoihkg",
    "path": "fonts/Metropolis.css"
  },
  {
    "vendor": "goguardian",
    "label": "GoGuardian",
    "id": "haldlgldplgnggkjaafhelgiaglafanh",
    "path": "youtube_injection.js"
  },
  {
    "vendor": "lanschool",
    "label": "LanSchool",
    "id": "baleiojnjpgeojohhhfbichcodgljmnj",
    "path": "blocked.html"
  },
  {
    "vendor": "linewize",
    "label": "Linewize",
    "id": "ddfbkhpmcdbciejenfcolaaiebnjcbfc",
    "path": "background/assets/pages/default-blocked.html"
  },
  {
    "vendor": "blocksi",
    "label": "Blocksi",
    "id": "ghlpmldmjjhmdgmneoaibbegkjjbonbk",
    "path": "pages/blockPage.html"
  },
  {
    "vendor": "fortiguard",
    "label": "FortiGuard",
    "id": "igbgpehnbmhgdgjbhkkpedommgmfbeao",
    "path": "youtube_injection.js"
  },
  {
    "vendor": "cisco",
    "label": "Cisco Umbrella",
    "id": "jcdhmojfecjfmbdpchihbeilohgnbdci",
    "path": "blocked.html"
  },
  {
    "vendor": "contentkeeper",
    "label": "ContentKeeper",
    "id": "jdogphakondfdmcanpapfahkdomaicfa",
    "path": "img/ckauth19x.png"
  },
  {
    "vendor": "contentkeeper",
    "label": "ContentKeeper",
    "id": "odoanpnonilogofggaohhkdkdgbhdljp",
    "path": "img/ckauth19x.png"
  },
  {
    "vendor": "hapara",
    "label": "Hapara",
    "id": "kbohafcopfpigkjdimdcdgenlhkmhbnc",
    "path": "blocked.html"
  },
  {
    "vendor": "hapara",
    "label": "Hapara",
    "id": "aceopacgaepdcelohobicpffbbejnfac",
    "path": "blocked.html"
  },
  {
    "vendor": "iboss",
    "label": "iboss",
    "id": "kmffehbidlalibfeklaefnckpidbodff",
    "path": "restricted.html"
  },
  {
    "vendor": "lightspeed",
    "label": "Lightspeed",
    "id": "adkcpkpghahmbopkjchobieckeoaoeem",
    "path": "icon-128.png"
  },
  {
    "vendor": "interclass",
    "label": "InterCLASS",
    "id": "jbddgjglgkkneonnineaohdhabjbgopi",
    "path": "pages/message-page.html"
  },
  {
    "vendor": "intersafe",
    "label": "InterSafe",
    "id": "ecjoghccnjlodjlmkgmnbnkdcbnjgden",
    "path": "resources/options.js"
  },
  {
    "vendor": "loilo",
    "label": "LoiLo Web Filters",
    "id": "pabjlbjcgldndnpjnokjakbdofjgnfia",
    "path": "image/allow_icon/shield_green_128x128.png"
  },
  {
    "vendor": "imtlazarus",
    "label": "IMTLazarus",
    "id": "cgigopjakkeclhggchgnhmpmhghcbnaf",
    "path": "models/model.json"
  },
  {
    "vendor": "impero",
    "label": "Impero",
    "id": "jjpmjccpemllnmgiaojaocgnakpmfgjg",
    "path": "licenses.html"
  },
  {
    "vendor": "mobileguardian",
    "label": "Mobile Guardian",
    "id": "fgmafhdohjkdhfaacgbgclmfgkgokgmb",
    "path": "block.html"
  }
];
// Current Securly ID has no assumed public path. Only probe paths actually
// exposed by the installed extension in this page, never guessed private files.
const additionalIdentities = [{vendor:'securly',label:'Securly',id:'ckecmkbnoanpgplccmnoikfmpcdladkc'}];
export function exposedSignatures(doc=globalThis.document, signatures=filterSignatures) {
  if (!doc?.querySelectorAll) return [];
  const identities = [...signatures,...additionalIdentities];
  const found = [];
  for (const node of doc.querySelectorAll('script[src],link[href],img[src],iframe[src]')) {
    const source=node.getAttribute(node.tagName==='LINK'?'href':'src');
    try {
      const url=new URL(source);
      if(url.protocol!=='chrome-extension:')continue;
      const identity=identities.find(item=>item.id===url.hostname);
      if(identity)found.push({...identity,path:url.pathname.slice(1)});
    } catch {}
  }
  return found;
}
export async function detectFilters({signatures=filterSignatures, fetcher=globalThis.fetch, timeoutMs=3000, doc=globalThis.document}={}) {
  signatures=[...signatures,...exposedSignatures(doc,signatures)];
  signatures=signatures.filter((item,index,all)=>all.findIndex(other=>other.id===item.id&&other.path===item.path)===index);
  const matches = await Promise.all(signatures.map(async signature => {
    if (!/^[a-p]{32}$/.test(signature.id) || !/^[a-z0-9_-]+$/.test(signature.vendor) || !signature.path || signature.path.includes('..')) return null;
    const abort = new AbortController();
    let timer;
    try {
      const response = await Promise.race([
        fetcher(`chrome-extension://${signature.id}/${signature.path}`, {cache:'no-store', signal:abort.signal}),
        new Promise(resolve => {timer=setTimeout(()=>{abort.abort();resolve(null)},timeoutMs)}),
      ]);
      // Do not execute scripts or read contents. Failed/hidden resources mean unknown.
      if (response?.ok) { try {await response.body?.cancel()} catch {} return signature.vendor; }
    } catch {} finally {clearTimeout(timer);abort.abort()}
    return null;
  }));
  return [...new Set(matches.filter(Boolean))];
}
let pending, scanVersion=0, lastScan=0;
export function scanFilters({refresh=false}={}) {
  if(refresh || Date.now()-lastScan>30000)pending=null;
  if(pending)return pending;
  const version=++scanVersion;lastScan=Date.now();
  pending=detectFilters().then(vendors=>{
    if(version===scanVersion)globalThis.dispatchEvent?.(new CustomEvent('tutsi:filter-detected',{detail:{vendors}}));
    return vendors;
  });
  return pending;
}
export async function effectiveFilter(selection) {
  if(selection!=='auto')return selection;
  const vendors=await scanFilters();
  return vendors.length===1?vendors[0]:'';
}

// Read only the supplied address. Never request it, retain its query, or treat
// names in the blocked destination/query as evidence of the filtering vendor.
export function identifyFilterAddress(value) {
  const input=String(value||'').trim();
  if(!input || input.length>8192)return null;
  let url;
  try{url=new URL(input)}catch{return null}
  if(url.username || url.password)return null;
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  if(url.protocol==='chrome-extension:'){
    const match=[...filterSignatures,...additionalIdentities].find(item=>item.id===host);
    return match?{vendor:match.vendor,label:match.label,source:'extension address'}:null;
  }
  if(!['https:','http:'].includes(url.protocol))return null;
  // Vendor domains identify the owner of the pasted address, not whether an
  // extension is installed. Using this evidence remains an explicit choice.
  const domains=[['goguardian.com','goguardian','GoGuardian'],['securly.com','securly','Securly'],['block.opendns.com','cisco','Cisco Umbrella']];
  const match=domains.find(([domain])=>host===domain || host.endsWith('.'+domain));
  return match?{vendor:match[1],label:match[2],source:'vendor address'}:null;
}
