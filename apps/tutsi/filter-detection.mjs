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
export async function detectFilters({signatures=filterSignatures, fetcher=globalThis.fetch, timeoutMs=1500}={}) {
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
let pending;
export function scanFilters({refresh=false}={}) {
  if(refresh)pending=null;
  return pending ||= detectFilters().then(vendors=>{
    globalThis.dispatchEvent?.(new CustomEvent('tutsi:filter-detected',{detail:{vendors}}));
    return vendors;
  });
}
export async function effectiveFilter(selection) {
  if(selection!=='auto')return selection;
  const vendors=await scanFilters();
  return vendors.length===1?vendors[0]:'';
}
