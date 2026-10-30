const aliases=[
 [/^\/assets\/(?:gms-games|gms-studies)\/games\.json(?=[?]|$)/,'/assets/math/studies.json'],
 [/^\/gn-math-/, '/reading-'],
 [/^\/gms-studies-/, '/math-'],
 [/^\/assets\/gn-math(?=[/?]|$)/, '/assets/reading'],
 [/^\/assets\/gms-studies(?=[/?]|$)/, '/assets/math'],
 [/^\/assets\/studies\/arcade\.css(?=[?]|$)/,'/assets/studies/leadership.css'],
 [/^\/api\/cloud-gaming(?=[/?]|$)/,'/api/cloud-studies'],
 [/^\/api\/games\/reports(?=[/?]|$)/,'/api/studies/reports'],
 [/^\/gms-games-(fetch|proxy)(?=[/?]|$)/,(_,kind)=>'/math-'+kind],
 [/^\/assets\/gms-games(?=[/?]|$)/,'/assets/math'],
 [/^\/apps\/cloud-gaming(?=[/?]|$)/,'/apps/cloud-studies'],
 [/^\/assets\/icons\/cloud-gaming\.svg(?=[?]|$)/,'/assets/icons/cloud-studies.svg'],
];
export function rewriteLegacyPublicPath(url){
 if(/\/@r[0-9a-f]+!\.(?:js|mjs|css|wasm|html|json|svg|webp)(?:[?]|$)/.test(String(url).split(/[?#]/,1)[0]))return url;
 for(const [pattern,replacement] of aliases)if(pattern.test(url))return url.replace(pattern,replacement);
 return url;
}

export const providerPageAliases=Object.freeze({
 '/assets/gn-math/':'/assets/reading/index.html',
 '/assets/gn-math/index.html':'/assets/reading/index.html',
 '/assets/gn-math/play.html':'/assets/reading/play.html',
 '/assets/gms-studies/':'/assets/math/index.html',
 '/assets/gms-studies/index.html':'/assets/math/index.html',
 '/assets/gms-studies/play.html':'/assets/math/play.html',
 '/assets/gms-games/':'/assets/math/index.html',
 '/assets/gms-games/index.html':'/assets/math/index.html',
 '/assets/gms-games/play.html':'/assets/math/play.html'
});
