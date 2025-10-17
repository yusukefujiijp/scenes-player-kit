/*!
 Project: shorts-player-kit
 File:    js/scene-effects.js
 Role:    Effect Registry (visual effects + transitions)
 Notes:
   - Two-layer model: non-overlay "effects" (fire-and-forget) vs overlay "transitions" (await).
   - Player should await only when __effects.isOverlay(name) === true.
   - A11y: respects prefers-reduced-motion (skips animations).
*/

;(()=>{
  // ===== Registry with Metadata =====
  const REG  = new Map();  // name -> (el, opts) => Promise<void>
  const META = new Map();  // name -> { overlay?: boolean, aliasOf?: string }

  // ===== Utilities =====
  const prefersReduced = () => {
    try {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { return false; }
  };

  const onEndOnce = (el, prop, cb) => {
    const h = (e)=>{ if (!prop || e.propertyName === prop){ el.removeEventListener('transitionend', h); cb(); } };
    el.addEventListener('transitionend', h);
  };

  const keep = (el) => ({
    opacity: el.style.opacity,
    transform: el.style.transform,
    transition: el.style.transition,
    willChange: el.style.willChange
  });
  const restore = (el, prev) => {
    el.style.transition = prev.transition || '';
    el.style.willChange = prev.willChange || '';
  };

  // ===== Core API =====
  function register(name, fn, meta={}) {
    REG.set(String(name), fn);
    META.set(String(name), { overlay:false, ...meta });
  }
  function alias(name, target) {
    register(String(name), (el, opts)=> run(String(target), el, opts), { aliasOf:String(target), overlay: META.get(String(target))?.overlay === true });
  }
  function list(){ return Array.from(REG.keys()); }
  function has(name){ return REG.has(String(name)); }
  function isOverlay(name){
    const m = META.get(String(name));
    if (m && typeof m.overlay === 'boolean') return m.overlay;
    // Fallback for unknown names that look like transitions
    return /^(fade\-to\-black|flame\-out|burn\-out)$/i.test(String(name||''));
  }
  function optsFromScene(scene){
    if (!scene) return {};
    return scene.effectOpts ? { ...scene.effectOpts } : { ...scene }; // soft fallback
  }
  function run(name, el, opts={}) {
    if (!name || !REG.has(String(name))) return Promise.resolve();
    if (prefersReduced()) return Promise.resolve(); // Respect a11y; no-op but safe.
    try { el && el.offsetHeight; } catch {}
    const fn = REG.get(String(name));
    const target = el || document.body;
    return fn(target, opts) || Promise.resolve();
  }
  async function runSync(name, el, opts={}) { await run(name, el, opts); }

  function sequence(steps=[]){
    // steps: [{ name, el, opts }]
    return steps.reduce((p, s)=> p.then(()=> run(s.name, s.el, s.opts)), Promise.resolve());
  }
  function parallel(steps=[]){
    return Promise.all(steps.map(s=> run(s.name, s.el, s.opts)));
  }

  // ===== Built-in Effects (non-overlay; fire-and-forget) =====
  register('light-in', (el, { t=600, opacityFrom=0 }={}) => new Promise(res=>{
    const prev = keep(el);
    el.style.opacity    = String(opacityFrom);
    el.style.willChange = 'opacity';
    el.style.transition = `opacity ${t}ms ease-out`;
    requestAnimationFrame(()=>{ el.style.opacity = '1'; });
    onEndOnce(el, 'opacity', ()=>{ restore(el, prev); res(); });
  }), { overlay:false });

  // Alias for naming preference
  alias('fade-in', 'light-in');

  register('slide-up', (el, { t=600, dy=20, easing='cubic-bezier(.2,.8,.2,1)', opacityFrom=0 }={}) => new Promise(res=>{
    const prev = keep(el);
    el.style.opacity    = String(opacityFrom);
    el.style.transform  = `translateY(${dy}px)`;
    el.style.willChange = 'transform, opacity';
    el.style.transition = `transform ${t}ms ${easing}, opacity ${t}ms ${easing}`;
    requestAnimationFrame(()=>{ el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
    onEndOnce(el, 'transform', ()=>{ restore(el, prev); res(); });
  }), { overlay:false });

  register('zoom-in', (el, { t=600, scaleFrom=0.92, easing='cubic-bezier(.2,.8,.2,1)', opacityFrom=0 }={}) => new Promise(res=>{
    const prev = keep(el);
    el.style.opacity    = String(opacityFrom);
    el.style.transform  = `scale(${scaleFrom})`;
    el.style.willChange = 'transform, opacity';
    el.style.transition = `transform ${t}ms ${easing}, opacity ${t}ms ${easing}`;
    requestAnimationFrame(()=>{ el.style.opacity = '1'; el.style.transform = 'scale(1)'; });
    onEndOnce(el, 'transform', ()=>{ restore(el, prev); res(); });
  }), { overlay:false });

  // ===== Overlay Transitions (await; full-screen) =====
  register('fade-to-black', (_el, { t=700, from=0, to=1 }={}) => new Promise(res=>{
    const ov = document.createElement('div');
    ov.style.position = 'fixed';
    ov.style.inset = '0';
    ov.style.background = '#000';
    ov.style.opacity = String(from);
    ov.style.pointerEvents = 'none';
    ov.style.zIndex = '99998';
    ov.style.transition = `opacity ${t}ms linear`;
    document.body.appendChild(ov);
    requestAnimationFrame(()=>{ ov.style.opacity = String(to); });
    const finish = ()=>{ try{ ov.remove(); }catch{} res(); };
    onEndOnce(ov, 'opacity', finish);
    setTimeout(finish, Number(t) + 200); // safety
  }), { overlay:true });

  register('flame-out', (_el, { t=800, peak=1, base=0, peakRatio=0.35, hue='24deg' }={}) => new Promise(res=>{
    // 2-phase white-hot flash with slight orange hue at the core
    const t1 = Math.max(80, Math.floor(t * peakRatio));
    const t2 = Math.max(120, t - t1);
    const ov = document.createElement('div');
    ov.style.position = 'fixed';
    ov.style.inset = '0';
    ov.style.pointerEvents = 'none';
    ov.style.zIndex = '99998';
    // gradient fire look; falls back gracefully
    ov.style.background = `radial-gradient(circle at 50% 85%, hsl(${hue} 100% 50%) 0%, hsl(${hue} 100% 60%) 35%, hsl(${hue} 100% 70%) 60%, rgba(255,255,255,0) 100%)`;
    ov.style.opacity = String(base);
    document.body.appendChild(ov);

    // Phase 1: rise to peak
    ov.style.transition = `opacity ${t1}ms ease-out`;
    requestAnimationFrame(()=>{ ov.style.opacity = String(peak); });

    // Phase 2: decay to base
    const toDecay = ()=>{
      ov.style.transition = `opacity ${t2}ms ease-in`;
      ov.style.opacity = String(base);
      const finish = ()=>{ try{ ov.remove(); }catch{} res(); };
      onEndOnce(ov, 'opacity', finish);
      setTimeout(finish, t2 + 200); // safety
    };
    setTimeout(toDecay, t1 + 16);
  }), { overlay:true });

  alias('burn-out', 'flame-out');

  // ===== Expose =====
  window.__effects = {
    register, alias, run, runSync, list, has, isOverlay, sequence, parallel, optsFromScene
  };
})();