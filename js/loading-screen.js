window.nyxLoadingScreen = {
  show() {
    const splash = document.getElementById('setupLaunchScreen');
    if (!splash) return;
    splash.classList.remove('leaving');
    splash.classList.add('show');
    splash.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      splash.classList.add('leaving');
      setTimeout(() => {
        splash.classList.remove('show', 'leaving');
        splash.setAttribute('aria-hidden', 'true');
      }, 780);
    }, 4000);
  }
};
