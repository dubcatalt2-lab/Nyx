(() => {
  const accents={default:'#a9b8d8',midnight:'#86b8ee',ruby:'#e39a9a',emerald:'#89c7a7',sakura:'#ddb0ce',fresh:'#9acbc1'};
  function applyTheme(){
    try{
      const theme=localStorage.getItem('nyx.theme')||'default';
      const custom=localStorage.getItem('nyx.customThemeColor')||'';
      document.documentElement.style.setProperty('--accent',theme==='custom'&&/^#[\da-f]{6}$/i.test(custom)?custom:accents[theme]||accents.default);
    }catch{}
  }
  addEventListener('storage',applyTheme);
  applyTheme();
})();
