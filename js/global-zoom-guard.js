// global-zoom-guard.js — permanent zoom lock for recording builds
(function attachGlobalZoomGuard() {
  let lastTouchEnd = 0;

  function prevent(e) { e.preventDefault(); }

  // iOS WebKit (non-standard gesture* events) — pinch zoom guard
  document.addEventListener('gesturestart',  prevent, { passive:false });
  document.addEventListener('gesturechange', prevent, { passive:false });
  document.addEventListener('gestureend',    prevent, { passive:false });

  // Double-tap zoom guard
  document.addEventListener('touchend', (e) => {
    const now = performance.now();
    if (now - lastTouchEnd < 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });
})();