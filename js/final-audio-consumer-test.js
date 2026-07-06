let activeAudio = null;
function clearAudio(){
  if (activeAudio) {
    try { activeAudio.pause(); } catch (_) {}
    activeAudio = null;
  }
}
window.addEventListener('pagehide', clearAudio, true);
