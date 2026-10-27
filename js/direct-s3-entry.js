(()=>{
 const target=new URL(new URLSearchParams(location.search).get('returnTo')||'/studies.html',location.origin);
 location.replace(target.origin===location.origin&&!['/','/index.html'].includes(target.pathname)?target.href:'/studies.html');
})();
