(() => {
  let activeSession = 0;

  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  function updateProgress(splash, value, label, emit = true, updateFill = true) {
    const progress = splash.querySelector('.nyx-loading-progress');
    const fill = progress?.querySelector('span');
    const percent = splash.querySelector('[data-nyx-loading-percent]');
    const stage = splash.querySelector('[data-nyx-loading-stage]');
    const visualValue = Math.max(0, Math.min(100, Number(value) || 0));
    const next = Math.round(visualValue);
    if (fill && updateFill) fill.style.transform = `scaleX(${visualValue / 100})`;
    if (percent) percent.textContent = `${next}%`;
    if (stage && label) stage.textContent = label;
    progress?.setAttribute('aria-valuenow', String(next));
    if (label) progress?.setAttribute('aria-valuetext', label);
    if (emit) window.dispatchEvent(new CustomEvent('nyx:loading-progress', { detail: { value: next, label: label || '' } }));
  }

  function progressValue(splash) {
    return Number(splash.querySelector('.nyx-loading-progress')?.getAttribute('aria-valuenow')) || 0;
  }

  function animateProgress(splash, target, label, duration, session) {
    const start = progressValue(splash);
    const end = Math.max(start, Math.min(100, Number(target) || 0));
    const fill = splash.querySelector('.nyx-loading-progress span');
    if (end === start) {
      updateProgress(splash, end, label);
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const started = performance.now();
      const animation = fill?.animate([
        { transform: `scaleX(${start / 100})` },
        { transform: `scaleX(${end / 100})` }
      ], {
        duration: Math.max(1, duration),
        easing: 'linear',
        fill: 'forwards'
      });
      const tick = now => {
        if (session !== activeSession) {
          animation?.cancel();
          resolve();
          return;
        }
        const elapsed = Math.min(1, (now - started) / Math.max(1, duration));
        const value = start + ((end - start) * elapsed);
        updateProgress(splash, value, label, false, false);
        if (elapsed < 1) {
          requestAnimationFrame(tick);
        } else {
          if (fill) fill.style.transform = `scaleX(${end / 100})`;
          animation?.cancel();
          updateProgress(splash, end, label, true);
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  window.nyxLoadingScreen = {
    show() {
      const splash = document.getElementById('setupLaunchScreen');
      const fill = splash?.querySelector('.nyx-loading-progress span');
      if (!splash || !fill) return null;

      const session = ++activeSession;
      splash.classList.remove('show', 'leaving');
      fill.getAnimations().forEach(animation => animation.cancel());
      updateProgress(splash, 0, 'Preparing Nyx');
      void splash.offsetWidth;
      splash.classList.add('show');
      splash.setAttribute('aria-hidden', 'false');

      return {
        async step(value, label, task, minimumVisible = 360) {
          if (session !== activeSession) return { ok: false, cancelled: true };
          updateProgress(splash, progressValue(splash), label);
          const started = performance.now();
          let result;
          let error = null;
          try {
            result = await Promise.resolve().then(task);
          } catch (caught) {
            error = caught;
            console.warn(`Startup task failed: ${label}`, caught);
          }
          const remaining = Math.max(480, Number(minimumVisible) - (performance.now() - started));
          await animateProgress(splash, value, error ? `${label} (warning)` : label, remaining, session);
          if (session !== activeSession) return { ok: false, cancelled: true };
          return { ok: !error, result, error };
        },

        async complete(label = 'Nyx is ready') {
          if (session !== activeSession) return;
          await animateProgress(splash, 100, label, 300, session);
          await wait(620);
          if (session !== activeSession) return;
          splash.classList.add('leaving');
          await wait(780);
          if (session !== activeSession) return;
          splash.classList.remove('show', 'leaving');
          splash.setAttribute('aria-hidden', 'true');
          updateProgress(splash, 0, 'Preparing Nyx');
        }
      };
    }
  };
})();
