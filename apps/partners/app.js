(() => {
  function applyTheme(){
    try{
      document.documentElement.style.setProperty('--accent','#a9b8d8');
    }catch{}
  }
  addEventListener('storage',applyTheme);
  applyTheme();
})();
