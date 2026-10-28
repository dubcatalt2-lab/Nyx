const aliases=[
 [/^\/assets\/(?:gms-games|gms-studies)\/games\.json(?=[?]|$)/,'/assets/gms-studies/studies.json'],
 [/^\/assets\/studies\/arcade\.css(?=[?]|$)/,'/assets/studies/leadership.css'],
 [/^\/api\/cloud-gaming(?=[/?]|$)/,'/api/cloud-studies'],
 [/^\/api\/games\/reports(?=[/?]|$)/,'/api/studies/reports'],
 [/^\/gms-games-(fetch|proxy)(?=[/?]|$)/,(_,kind)=>'/gms-studies-'+kind],
 [/^\/assets\/gms-games(?=[/?]|$)/,'/assets/gms-studies'],
 [/^\/apps\/cloud-gaming(?=[/?]|$)/,'/apps/cloud-studies'],
 [/^\/assets\/icons\/cloud-gaming\.svg(?=[?]|$)/,'/assets/icons/cloud-studies.svg'],
];
export function rewriteLegacyPublicPath(url){
 for(const [pattern,replacement] of aliases)if(pattern.test(url))return url.replace(pattern,replacement);
 return url;
}
