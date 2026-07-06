function makeThing(v){
  const el = document.createElement('div');
  el.textContent = String(v || 'ok');
  return el;
}
