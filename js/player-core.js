/*!
Project:  scenes-player-kit
File:     js/player-core.js
Role:     Player Core (page-end stop default + Stop ACK UI hooks + Hard Stop hook)
UX:       Emits UI-friendly custom events for TTS/playing states (Phase2)
Roadmap:  Phase3/4/6 — TTS watchdog hardening, event-bus hooks, QuickBar Next 連携
Notes (delta):
 - Stopは「ページ末で静停止」を既定化（押下時は自動遷移だけを遮断し、当該ページの読み上げは完了させる）
 - Stop押下の“手応え”を可視化するため、即時ACK/確定ACKのカスタムイベントを追加
   即時ACK: window.dispatchEvent(new CustomEvent('player:stop-ack', {detail:{ts}}))
   確定ACK: window.dispatchEvent(new CustomEvent('player:stop-confirm', {detail:{latencyMs, context}}))
 - Hard Stop（強制停止）APIを公開（__player.stopHard）: cancel() + 短い整定待機
 - 再生系操作の先頭で resume() を儀式化（ensureResumed）し、音声起動の安定性を確保
 - speakパイプ: scrub → stripMarkdownLight → runtime speechFixes → speakOrWait（watchdog付き）
 - Exporter連携: __playerCore.renderSceneToCanvas(canvas, scene, overlay) を提供（canvasに直接描画）
*/

import { analyzeColor, applyColorTheme } from './utils/color.js';
import { getTtsForRole } from './tts-sanitize.js';

'use strict';

/* ======================= Feature flags ======================= */
const TTS_ENABLED = (typeof window.TTS_ENABLED === 'boolean') ? window.TTS_ENABLED : true;
window.__ttsFlags = window.__ttsFlags || { readTag: true, readTitleKey: true, readTitle: true, readNarr: true };

/* ======================= Optional TTS KV ====================== */
let __ttsKvApply = null; // false=not available / function=apply
async function loadTtsKvOptional(){
  if (__ttsKvApply !== null) return; // already tried
  try {
    const mod = await import('./tts-kv-simple.js');
    __ttsKvApply =
      (mod && typeof mod.applyTtsKv === 'function') ? mod.applyTtsKv :
      (mod && mod.default && typeof mod.default.applyTtsKv === 'function') ? mod.default.applyTtsKv :
      false;
    if (mod && typeof mod.loadTtsKv === 'function'){
      try { await mod.loadTtsKv(); } catch(_){}
    }
  } catch(_) {
    __ttsKvApply = false; // not available
  }
}
function applyTtsKvIfAny(text){
  if (!__ttsKvApply) return text;
  try { return __ttsKvApply(String(text||'')); } catch(_) { return text; }
}

/* ======================= Core State ========================== */
const State = { scenes: [], idx: 0, playingLock: false };
const Ctrl = {
  stopRequested: false,   // Stop押下直後の要求（ページ末で停止）
  stopped: false,         // Stopが確定し、次遷移や再生を抑止中
  stopReqAt: 0,           // Stop受付時刻（ACKレイテンシ計測用）
  lastCancelAt: 0,        // 直近 cancel() の時刻（Hard Stop整定用）
  activationDone:false,   // 初回可聴ワンショット済み
  navToken: 0,            // ナビ世代トークン（Next/Prev/Goto/Restartで更新）
  videoMeta: {}           // scenes.json の videoMeta（advancePolicy 参照用）
};
window.__playerCore = window.__playerCore || {}; // exporter 等から参照

/* ======================= UI-facing State ===================== */
const UiState = { speaking:false, paused:false, pending:false, playing:false };
function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } }
function emitTtsState(next){
  const n = {
    speaking: (next.speaking ?? UiState.speaking),
    paused:   (next.paused   ?? UiState.paused),
    pending:  (next.pending  ?? UiState.pending),
  };
  if (n.speaking!==UiState.speaking || n.paused!==UiState.paused || n.pending!==UiState.pending){
    UiState.speaking = n.speaking;
    UiState.paused   = n.paused;
    UiState.pending  = n.pending;
    emit('player:tts-state', { speaking:UiState.speaking, paused:UiState.paused, pending:UiState.pending });
  }
}
function emitPlaying(on){
  const v = !!on;
  if (UiState.playing === v) return;
  UiState.playing = v;
  const total=(State.scenes||[]).length;
  emit('player:status', {
    playing: UiState.playing,
    index: State.idx,
    total,
    canPrev: (State.idx>0),
    canNext: (State.idx+1<total)
  });
}
const setPending = (p)=> emitTtsState({ pending: !!p });

/* ======================= Utils =============================== */
const nowMs = () => (window.performance && performance.now ? performance.now() : Date.now());
const sleep = (ms) => new Promise(r => setTimeout(r, Math.max(0, ms|0)));
async function sleepAbortable(ms, tok){
  const step = 60;
  const t0 = nowMs();
  while(nowMs() - t0 < ms){
    if(tok !== Ctrl.navToken) return; // 中断
    await sleep(Math.min(step, ms));
  }
}

/* =================== Activation (first user tap) ============= */
function installActivationOnce() {
  if (Ctrl.activationDone || !('speechSynthesis' in window)) return;
  const handler = () => {
    if (Ctrl.activationDone) return;
    Ctrl.activationDone = true;
    try { const u = new SpeechSynthesisUtterance('あ'); u.lang='ja-JP'; u.rate=1.0; u.volume=0.06; speechSynthesis.speak(u); } catch(_){}
    ['pointerdown','click','touchend','keydown'].forEach(t => document.removeEventListener(t, handler, true));
  };
  ['pointerdown','click','touchend','keydown'].forEach(t => document.addEventListener(t, handler, { capture:true, once:true }));
}
installActivationOnce();

/* =================== Background / Version / Color ============ */
function ensureBgLayer(){
  let bg=document.getElementById('bgColor');
  if(!bg){
    bg=document.createElement('div');
    bg.id='bgColor';
    document.body.insertBefore(bg, document.body.firstChild||null);
  }
  return bg;
}
let __bannerDefault='';
function setBannerText(txt){
  try{
    const el=document.getElementById('banner'); if(!el) return;
    const s=String(txt||'').trim(); el.textContent=s || ' ';
  }catch(_){}
}
function setBg(c){
  try{
    if(!c) return;
    ensureBgLayer();
    document.documentElement.style.setProperty('--bg-color', String(c));
  }catch(_){}
}
function applyVersionToBody(scene){
  const v=(scene&&(scene.version||scene.uiVersion))||'A';
  const b=document.body;
  b.classList.remove('version-A','version-B','version-T');
  b.classList.add(v==='B'?'version-B':(v==='T'?'version-T':'version-A'));
}
function applyReadableTextColor(base){
  const analysisResult = analyzeColor(base || getComputedStyle(document.documentElement).getPropertyValue('--bg-color') || '#fff');
  applyColorTheme(analysisResult); // body に text-on-dark / text-on-light 等を適用
}

/* ========================= Scene Surface ===================== */
function ensureSceneSurface(){
  ensureBgLayer();
  let root=document.getElementById('content');
  if(!root){ root=document.createElement('div'); root.id='content'; document.body.appendChild(root); }
  root.innerHTML='';
  return root;
}
function createSceneShell(){ const el=document.createElement('div'); el.className='scene'; return el; }
function setTextInScene(sceneEl, selector, text){
  let el=sceneEl.querySelector(selector);
  if(!el){
    el=document.createElement('div');
    el.className=selector.replace(/^[.#]/,'');
    sceneEl.appendChild(el);
  }
  el.textContent=String(text||'');
}
function setText(idOrKey, s){
  const map={ title_key:'.title_key', titleKey:'.title_key', title:'.title', symbol:'.symbol', narr:'.narr' };
  const sel=map[idOrKey]||'.narr';
  const root=document.getElementById('content'); if(!root) return;
  const sc=root.querySelector('.scene')||root;
  setTextInScene(sc, sel, s);
}

/* ========================= Effects Hook ====================== */
function runEffectIfAny(scene, anchor){
  if(!scene||!scene.effect) return;
  if(!window.__effects||typeof __effects.run!=='function') return;
  try{ __effects.run(scene.effect, anchor||document.body, scene);}catch(_){}
}

/* ========================= Voices (non-blocking) ============= */
function getVoicesSafe(){ try{ return window.speechSynthesis.getVoices()||[]; } catch(_){ return []; } }
let jpVoice=null;
function refreshJPVoice(){
  const list=getVoicesSafe();
  jpVoice = list.find(v=>/^ja(-JP)?/i.test(v.lang)) || list.find(v=>/日本語/.test(v.name)) || null;
}
refreshJPVoice();
try{ window.speechSynthesis.addEventListener('voiceschanged', ()=>{ refreshJPVoice(); }); }catch(_){ }

function voiceById(key){
  if(!key) return null;
  const list=getVoicesSafe();
  let v=list.find(x=>x.voiceURI===key);
  if(v) return v;
  if(key.includes('|')){
    const [lang,name]=key.split('|');
    v=list.find(x=>x.lang===lang && x.name===name);
    if(v) return v;
  }
  return list.find(x=>x.name===key)||list.find(x=>x.lang===key)||null;
}
function chooseVoice(role){
  const vm=window.__ttsVoiceMap||{}, map=vm[role];
  if(map){
    if(typeof map==='string'){ const v=voiceById(map); if(v) return v; }
    else if(map && typeof map==='object'){
      try{ if(typeof SpeechSynthesisVoice!=='undefined' && map instanceof SpeechSynthesisVoice) return map; }catch(_){}
      const key=map.voiceURI||((map.lang||'')+'|'+(map.name||'')); const v=voiceById(key); if(v) return v;
    }
  }
  try{
    if(window.__ttsUtils && typeof __ttsUtils.pick==='function'){
      const p=__ttsUtils.pick(role);
      if(p&&p.id){ const v=voiceById(p.id); if(v) return v; }
    }
  }catch(_){}
  return jpVoice || null;
}

/* ========================= TTS Rate ========================== */
function clampAbs(v){ const n=Number(v); if(!Number.isFinite(n)) return 1.4; return Math.max(0.5, Math.min(2.0, n)); }
function effRateFor(role='narr', base=1.4){
  try{ if(window.__ttsUtils && typeof __ttsUtils.getRateForRole==='function') return clampAbs(__ttsUtils.getRateForRole(base, role)); }catch(_){}
  return clampAbs(base);
}
function rateFor(role='narr'){ return effRateFor(role, 1.4); }

/* ========================= Priming =========================== */
async function primeTTS(){
  if(!TTS_ENABLED || window.ttsPrimed) return;
  await new Promise(res=>{
    try{
      const u=new SpeechSynthesisUtterance(' ');
      u.lang='ja-JP';
      const v=chooseVoice('narr')||jpVoice; if(v) u.voice=v;
      u.volume=0; u.rate=1.0;
      let done=false; const fin=()=>{ if(!done){ done=true; window.ttsPrimed=true; res(); } };
      u.onend=fin; u.onerror=fin; speechSynthesis.speak(u);
      setTimeout(fin, 800);
    }catch(_){ window.ttsPrimed=true; res(); }
  });
}

/* ========================= Markdown / Scrub ================== */
function stripMarkdownLight(s){
  return String(s||'')
    .replace(/\*\*(.+?)\*\*/g,'$1')
    .replace(/__(.+?)__/g,'$1')
    .replace(/\*(.+?)\*/g,'$1')
    .replace(/_(.+?)_/g,'$1')
    .replace(/`([^`]+)`/g,'$1');
}
function getSpeechFixes(){ try{ const o=window.speechFixes; return (o && typeof o==='object')? o : {}; }catch(_){ return {}; } }
function scrub(text){ let s=String(text||''); s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,''); s = s.replace(/[:：]/g,'').trim(); return s; }
function splitChunksJa(s, maxLen=90){
  const t=scrub(s); if(!t) return [];
  const seps='。．！？?!\n、・：；';
  const raw=[]; let buf='';
  for(let i=0;i<t.length;i++){
    const ch=t[i]; buf+=ch;
    if(seps.indexOf(ch)!==-1){
      while(i+1<t.length && /\s/.test(t[i+1])){ buf+=t[++i]; }
      if(buf.trim()){ raw.push(buf.trim()); buf=''; }
    }
  }
  if(buf.trim()) raw.push(buf.trim());
  const out=[];
  for(let seg of raw){
    while(seg.length>maxLen){
      let cut=maxLen, snap=-1;
      for(let k=maxLen;k>=Math.max(40,maxLen-20);k--){
        if(' 、・：；。．!?？！”）)]'.indexOf(seg[k])!==-1){ snap=k+1; break; }
      }
      if(snap>0) cut=snap;
      out.push(seg.slice(0,cut).trim());
      seg=seg.slice(cut);
    }
    if(seg) out.push(seg);
  }
  return out;
}

/* ========== Resume ritual（再生直前の標準儀式） ============== */
async function ensureResumed(){
  try{ if('speechSynthesis' in window && speechSynthesis.paused){ speechSynthesis.resume(); } }catch(_){}
  await sleep(300);
  const elapsed=nowMs() - (Ctrl.lastCancelAt||0);
  if(elapsed>=0 && elapsed<280) await sleep(280 - elapsed);
}

/* ========================= Stop ACK / State ================== */
function requestSoftStop(){
  if(!Ctrl.stopRequested){
    Ctrl.stopRequested = true; Ctrl.stopReqAt = nowMs();
    try{ window.dispatchEvent(new CustomEvent('player:stop-ack', { detail:{ ts: Ctrl.stopReqAt } })); }catch(_){}
  }
}
function finalizeStopIfNeeded(context){
  if(Ctrl.stopRequested && !Ctrl.stopped){
    Ctrl.stopped = true;
    const t = nowMs(); const lat = Math.max(0, Math.round(t - (Ctrl.stopReqAt||t)));
    try{ window.dispatchEvent(new CustomEvent('player:stop-confirm', { detail:{ latencyMs: lat, context: String(context||'') } })); }catch(_){}
    setPending(false);
  }
}
function clearStop(){ Ctrl.stopRequested = false; Ctrl.stopped = false; }

/* ========================= TTS Core ========================== */
function speakStrict(text, rate = rateFor('narr'), role='narr'){
  return new Promise(async (resolve)=>{
    if(!TTS_ENABLED) return resolve();
    const cleaned = stripMarkdownLight(scrub(text)); if(!cleaned) return resolve();

    await ensureResumed();

    const fixes = getSpeechFixes();
    let speakText = cleaned;
    for (const k of Object.keys(fixes)){
      if(!k) continue;
      speakText = speakText.split(k).join(String(fixes[k]??''));
    }
    try { await loadTtsKvOptional(); } catch(_){}
    speakText = applyTtsKvIfAny(speakText);
    if(!speakText.trim()) return resolve();

    const u = new SpeechSynthesisUtterance(speakText);
    u.lang='ja-JP'; const v=chooseVoice(role)||jpVoice; if(v) u.voice=v; const eff=effRateFor(role, rate); u.rate=eff;

    let settled=false, started=false, fallbackTried=false;
    const done=()=>{ if(!settled){ settled=true; resolve(); } };
    u.onstart=()=>{ started=true; };
    u.onpause = ()=>{ emitTtsState({ paused:true  }); };
    u.onresume= ()=>{ emitTtsState({ paused:false }); };
    u.onend=done;
    u.onerror=(ev)=>{ try{ emit('player:tts-error', { role, reason: (ev && ev.error) || 'error' }); }catch(_){ } done(); };

    try{ speechSynthesis.speak(u); }catch(_){ return done(); }

    // === 改良ウォッチドッグ ===
    const cps = 6.5;
    const punct = (speakText.match(/[。．！？!?]/g)||[]).length;
    const expectedMs = Math.round(1000 + (speakText.length / Math.max(0.8, cps * Math.max(0.8, eff))) * 1000 + punct*180);
    const hardMaxMs  = Math.min(90000, Math.max(12000, speakText.length*260 + 3000));

    // 2.0s 経っても start しない＆speaking=false の時だけ一度だけ再発話
    setTimeout(async ()=>{
      if(!started && !settled && !fallbackTried){
        try{ if('speechSynthesis' in window) speechSynthesis.resume(); }catch(_){ }
        await sleep(350);
        if(!started && !settled){
          if(('speechSynthesis' in window) && !speechSynthesis.speaking){
            fallbackTried=true;
            try{ speechSynthesis.cancel(); Ctrl.lastCancelAt = nowMs(); }catch(_){ }
            await sleep(280);
            const u2=new SpeechSynthesisUtterance(speakText); u2.lang='ja-JP'; if(v) u2.voice=v; u2.rate=eff; u2.onstart=()=>{ started=true; }; u2.onend=done; u2.onerror=done;
            try{ speechSynthesis.speak(u2); }catch(_){ return done(); }
          }
        }
      }
    }, 2000);

    setTimeout(()=>{ if(!settled) done(); }, Math.max(hardMaxMs, expectedMs+1500));
  });
}

async function speakOrWait(text, rate = rateFor('narr'), role='narr'){
  const cleaned = stripMarkdownLight(scrub(text)); if(!cleaned) return;
  const eff = effRateFor(role, rate);
  const myTok = Ctrl.navToken; // 割り込み検出用
  if(TTS_ENABLED){
    const parts = splitChunksJa(cleaned);
    emitTtsState({ speaking:true });
    emit('player:tts-start', { role, length: cleaned.length, rate: eff });
    try{
      for(let i=0;i<parts.length;i++){
        if(myTok!==Ctrl.navToken) break;
        const p=parts[i];
        const detailStart = { phase:'start', role, index:i+1, total:parts.length, len:p.length };
        emit('player:tts-chunk', detailStart);
        const t0=nowMs(); await speakStrict(p, eff, role);
        const dt=nowMs()-t0;
        emit('player:tts-chunk', { phase:'end', role, index:i+1, total:parts.length, len:p.length, ms:dt });

        const quietMs = ((Ctrl.videoMeta && Ctrl.videoMeta.advancePolicy && Ctrl.videoMeta.advancePolicy.quietMs)|0) || 300;
        if(myTok===Ctrl.navToken){
          const step=100; const need = Math.max(quietMs, 0);
          let acc=0;
          while(acc<need && myTok===Ctrl.navToken){
            await sleep(step);
            try{
              if(('speechSynthesis' in window) && !speechSynthesis.speaking){ acc+=step; }
              else acc=0;
            }catch(_){ break; }
          }
          emit('player:tts-quiet', { role, index:i+1, total:parts.length, quietMs:need, passed:(acc>=need) });
        }
      }
    } finally {
      emitTtsState({ speaking:false, paused:false });
      emit('player:tts-end', { role });
    }
  } else {
    await sleep(Math.min(20000, 800 + (cleaned.length * 100) / Math.max(0.5, eff)));
  }
}

/* ========================= Renderers ========================= */
function removeAllPlayButtons(){ try{ document.querySelectorAll('#playBtn, .playBtn').forEach(b=>b.remove()); }catch(_){} }

function renderPlaceholder(scene){
  // 「アクティベーション・ゲート」UI
  applyVersionToBody(scene || { uiVersion: 'A' });
  setBg(scene ? scene.base : '#f9f9f7');
  applyReadableTextColor(scene ? scene.base : '#f9f9f7');
  const root = ensureSceneSurface();

  const gate = document.createElement('div');
  gate.id = 'activation-gate';
  gate.innerHTML = '<div class="gate-icon">▶︎</div>';
  root.appendChild(gate);

  const start = (ev) => {
    if (ev) ev.preventDefault();
    if (!Ctrl.activationDone) {
      try { const u = new SpeechSynthesisUtterance(' '); u.volume=0; speechSynthesis.speak(u); Ctrl.activationDone = true; } catch(_){}
    }
    document.body.classList.remove('app-unactivated');
    try { window.dispatchEvent(new CustomEvent('player:activated')); } catch(_) {}
    primeTTS().catch(()=>{});
    gate.classList.add('is-closing');
    setTimeout(()=>{ try{ gate.remove(); }catch(_){ } requestAnimationFrame(()=>{ gotoNext(); }); }, 220);
  };
  gate.addEventListener('click', start, {passive: false });
}

function renderContent(scene){
  removeAllPlayButtons();
  applyVersionToBody(scene);
  setBg(scene.base || '#000');
  applyReadableTextColor(scene && scene.base);

  const root=ensureSceneSurface();
  try{ document.body.style.setProperty('--symbol-bg-color', String(scene.base || 'transparent')); }catch(_){}
  const sc=createSceneShell();

  // Section Tags（1行固定・詰め切る）
  (function renderSectionTags(){
    const raw = Array.isArray(scene.sectionTags) ? scene.sectionTags : [];
    const tags = (raw||[]).map(x => String(x||'').trim()).filter(x => x.length>0);
    if (!tags.length) return;

    const row = document.createElement('div');
    row.className = 'section-tags';
    sc.appendChild(row);

    function packOnce(){
      row.innerHTML = '';
      let shown = 0;
      for (let i=0; i<tags.length; i++){
        const chip = document.createElement('div');
        chip.className = 'section-tag';
        chip.textContent = tags[i];
        row.appendChild(chip);
        if (row.scrollWidth > row.clientWidth + 1){
          row.removeChild(chip);
          break;
        }
        shown++;
      }
      row.classList.toggle('single', shown===1);
      if (shown===0){ row.remove(); }
    }
    packOnce();
    requestAnimationFrame(packOnce);
    try{ if (document.fonts && document.fonts.ready) document.fonts.ready.then(()=>packOnce()); }catch(_){}
  })();

  if(scene.title_key){ const tk=document.createElement('div'); tk.className='title_key'; tk.textContent=String(scene.title_key||''); sc.appendChild(tk); }
  if(scene.title){ const t=document.createElement('div'); t.className='title'; t.textContent=String(scene.title||''); sc.appendChild(t); }
  if(scene.symbol){
    const band=document.createElement('div'); band.className='symbol-bg';
    const sym=document.createElement('div'); sym.className='symbol'; sym.textContent=String(scene.symbol||'');
    band.appendChild(sym); sc.appendChild(band);
  }
  if(scene.narr){ const n=document.createElement('div'); n.className='narr'; n.textContent=String(scene.narr||''); sc.appendChild(n); }
  root.appendChild(sc);
  runEffectIfAny(scene, root);
}

function renderEffect(scene){
  removeAllPlayButtons();
  applyVersionToBody(scene || { uiVersion:'T' });
  if(scene && scene.base) setBg(scene.base);
  applyReadableTextColor(scene && scene.base);
  const root=ensureSceneSurface();
  runEffectIfAny(scene, root);
}

/* =============== Scene type & sequencing ===================== */
function getSceneType(scene){
  if(!scene) return 'unknown';
  if(typeof scene.type==='string') return scene.type;
  if(scene.version==='A'||scene.version==='B'||scene.version==='T') return 'content';
  return 'content';
}

async function runContentSpeech(scene){
  const f = (window.__ttsFlags || { readTag:true, readTitleKey:true, readTitle:true, readNarr:true });
  const muted = !TTS_ENABLED;

  // タグ読み上げ（先頭3つ）
  if(!muted && f.readTag){
    const tags = Array.isArray(scene.sectionTags) ? scene.sectionTags : [];
    const spoken = tags.slice(0,3)
      .map(t => String(t||'').trim().replace(/^#/,'').replace(/_/g,' '))
      .filter(Boolean)
      .join('、');
    if (spoken) { await speakOrWait(spoken, rateFor('tag'), 'tag'); }
  }

  // ロール別：titleKey → title → narr
  const tkRead = getTtsForRole(scene, 'titleKey');
  if(!muted && f.readTitleKey && tkRead){ await speakOrWait(tkRead, rateFor('titleKey'), 'titleKey'); }
  const tiRead = getTtsForRole(scene, 'title');
  if(!muted && f.readTitle && tiRead){ await speakOrWait(tiRead, rateFor('title'), 'title'); }
  if(f.readNarr){
    const narrSafe = getTtsForRole(scene, 'narr');
    if (!muted && narrSafe) { await speakOrWait(narrSafe, rateFor('narr'), 'narr'); }
  }
}

async function playScene(scene){
  if(!scene) return;
  const kind = getSceneType(scene);
  emit('player:scene-willstart', { index: State.idx, kind, scene });
  const myTok = (++Ctrl.navToken);
  switch(kind){
    case 'placeholder':
      renderPlaceholder(scene);
      emit('player:scene-didrender', { index: State.idx, kind });
      break;
    case 'content':
      if(State.playingLock) break; State.playingLock = true;
      try{
        emitPlaying(true);
        renderContent(scene);
        emit('player:scene-didrender', { index: State.idx, kind });
        await primeTTS();
        await runContentSpeech(scene);
      } finally {
        State.playingLock = false;
        emitPlaying(false);
      }
      emit('player:scene-didfinish', { index: State.idx, kind });
      if(Ctrl.stopRequested){ finalizeStopIfNeeded('content'); break; }
      if(myTok===Ctrl.navToken && !Ctrl.stopped){
        const pol = (()=>{
          const d={ mode:'auto', postDelayMs: 250, quietMs: 300 };
          try{
            const g=(Ctrl.videoMeta && Ctrl.videoMeta.advancePolicy)||{};
            const s=scene && scene.advancePolicy || {};
            return Object.assign({}, d, g, s);
          }catch(_){ return d; }
        })();
        if(String(pol.mode||'auto')!=='manual'){
          await sleepAbortable(Math.max(0, pol.quietMs|0), myTok);
          await sleepAbortable(Math.max(0, pol.postDelayMs|0), myTok);
          if(myTok===Ctrl.navToken && typeof gotoNext==='function') await gotoNext();
        }
      }
      break;
    case 'effect':
      if(State.playingLock) break; State.playingLock = true;
      try{
        emitPlaying(true);
        renderEffect(scene);
        emit('player:scene-didrender', { index: State.idx, kind });
        const raw=(scene.t ?? scene.duration ?? scene.durationMs ?? scene.effectDuration ?? 1200);
        const ms=Math.max(0, Math.min(60000, Number(raw)||1200));
        await sleep(ms);
      } finally { State.playingLock = false; emitPlaying(false); }
      emit('player:scene-didfinish', { index: State.idx, kind });
      if(Ctrl.stopRequested){ finalizeStopIfNeeded('effect'); break; }
      if(!Ctrl.stopped && typeof gotoNext==='function') await gotoNext();
      break;
    default:
      if(State.playingLock) break; State.playingLock = true;
      try{
        emitPlaying(true);
        renderContent(scene);
        emit('player:scene-didrender', { index: State.idx, kind:'content' });
        await primeTTS();
        await runContentSpeech(scene);
      } finally { State.playingLock = false; emitPlaying(false); }
      emit('player:scene-didfinish', { index: State.idx, kind:'content' });
      if(Ctrl.stopRequested){ finalizeStopIfNeeded('content'); break; }
      if(!Ctrl.stopped && typeof gotoNext==='function') await gotoNext();
      break;
  }
}

async function gotoPage(i){
  if(!Array.isArray(State.scenes)) return;
  if(i<0||i>=State.scenes.length) return;
  await ensureResumed();
  emit('player:navigation-queued', { from: State.idx, to: i });
  try{ if('speechSynthesis' in window){ speechSynthesis.cancel(); Ctrl.lastCancelAt=nowMs(); } }catch(_){}
  Ctrl.navToken++; // 以降の待機を中断
  State.idx=i;
  try{ window.dispatchEvent(new CustomEvent('player:page', { detail:{ index:i, total:(State.scenes||[]).length, scene: State.scenes[i] } })); }catch(_){}
  emit('player:navigation-applied', { index: i, total:(State.scenes||[]).length });
  await playScene(State.scenes[i]);
}
async function gotoNext(){
  await ensureResumed();
  const N=(State.scenes||[]).length;
  if(State.idx + 1 >= N){ try{ window.dispatchEvent(new CustomEvent('player:end')); }catch(_){ } return; }
  emit('player:navigation-queued', { from: State.idx, to: State.idx+1 });
  await gotoPage(State.idx + 1);
}
async function gotoPrev(){
  await ensureResumed();
  if(State.idx - 1 < 0){ try{ window.dispatchEvent(new CustomEvent('player:begin')); }catch(_){ } return; }
  emit('player:navigation-queued', { from: State.idx, to: State.idx-1 });
  await gotoPage(State.idx - 1);
}

/* ============================ Boot =========================== */
async function boot(){
  try{
    const res=await fetch('./scenes.json', { cache:'no-cache' });
    const data=await res.json();
    const scenes=data.scenes || data || [];
    State.scenes = scenes;
    try{ Ctrl.videoMeta = data.videoMeta || {}; }catch(_){ Ctrl.videoMeta={}; }
    document.body.classList.add('app-unactivated');

    try{
      const vm=(data && data.videoMeta)||{};
      __bannerDefault = vm.bannerText || vm.triviaTitle || vm.thumbnailText || vm.theme || '';
      setBannerText(__bannerDefault);
    }catch(_){}

    try{
      if(window.__ttsUtils && data && data.videoMeta && data.videoMeta.tts){ __ttsUtils.setup(data.videoMeta.tts); }
      else if(window.__ttsUtils){ __ttsUtils.setup({}); }
      const VC=(window.__dbgConfig && window.__dbgConfig.voice)||null;
      if(window.__ttsUtils && VC && VC.filter && typeof VC.filter.jaOnly==='boolean'){ __ttsUtils.setup({ filter:{ jaOnly:!!VC.filter.jaOnly } }); }
      window.__ttsVoiceMap = window.__ttsVoiceMap || {};
      if(VC && VC.defaults){ ['tag','titleKey','title','narr'].forEach(k=>{ if(!window.__ttsVoiceMap[k] && VC.defaults[k]) window.__ttsVoiceMap[k]=VC.defaults[k]; }); }
    }catch(_){ }

    try { loadTtsKvOptional().catch(()=>{}); } catch(_){}

    await gotoPage(0);
  }catch(e){
    console.error('Failed to load scenes.json', e);
    ensureSceneSurface(); setBg('#000');
    const root=document.getElementById('content');
    const sc=createSceneShell();
    setTextInScene(sc,'.title','scenes.json の読み込みに失敗しました');
    root.appendChild(sc);
  }
}

/* ========================= Public API ======================== */
async function hardStop(){
  requestSoftStop();
  setPending(true);
  try{ if('speechSynthesis' in window){ speechSynthesis.cancel(); Ctrl.lastCancelAt=nowMs(); await sleep(280); } }catch(_){}
  Ctrl.stopped = true;
  finalizeStopIfNeeded('hard');
}

export const player = {
  next: () => { clearStop(); return gotoNext(); },
  prev: () => { clearStop(); return gotoPrev(); },
  play: () => {
    if(Ctrl.stopped || Ctrl.stopRequested){ clearStop(); return gotoPage(State.idx); }
    clearStop(); return gotoNext();
  },
  stop: () => { requestSoftStop(); /* 既定: ページ末で停止 */ },
  stopHard:() => { return hardStop(); },
  restart: () => { clearStop(); return gotoPage(0); },
  goto: (i) => { clearStop(); return gotoPage(i|0); },
  info: () => {
    const total=(State.scenes||[]).length;
    return {
      index: State.idx,
      total,
      playing: !!State.playingLock,
      stopRequested: !!Ctrl.stopRequested,
      stopped: !!Ctrl.stopped,
      canPrev: (State.idx>0),
      canNext: (State.idx+1<total)
    };
  },
  getScene:() => (State.scenes && State.scenes[State.idx]) || null,
  getScenes: () => (State.scenes || []).slice()
};

// ---- Global alias for debug panel & external modules ----
try {
  if (typeof window !== 'undefined') {
    window.__player = Object.assign((window.__player || {}), player);
  }
} catch (_) {}

/* ===== Canvas描画API: renderSceneToCanvas（書き出し用） ===== */
function renderSceneToCanvas(canvas, scene, overlay){
  const ctx = canvas.getContext('2d');
  const W = canvas.width|0, H = canvas.height|0;

  // フォント到着待ち（ある場合のみ）
  try{ if(document.fonts && document.fonts.ready) {/* await-able だが exporter 側で連続呼び出しのため同期化は避ける */} }catch(_){}

  // 背景色は scene.base を最優先、なければ CSS var
  let cssBg='#000';
  try{ cssBg=getComputedStyle(document.documentElement).getPropertyValue('--bg-color')||'#000'; }catch(_){}
  const base = (scene && scene.base) ? String(scene.base) : cssBg;

  // 画面クリア＋塗り
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = base.trim() || '#000';
  ctx.fillRect(0,0,W,H);

  // スケール
  const S = Math.min(W,H);

  // タグ行（上部・最大3個）
  if (Array.isArray(scene?.sectionTags) && scene.sectionTags.length){
    const tagFont = Math.max(18, Math.round(H*0.026));
    const chipH   = Math.round(tagFont*1.55);
    const padX=12, gap=10, rr=Math.round(chipH/2.2);

    ctx.font = `700 ${tagFont}px ui-monospace,Menlo,Consolas,monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle';

    const tags = scene.sectionTags.slice(0,3).map(String);
    // 総幅を先に測り中央寄せ
    let total = -gap;
    for(const t of tags) total += Math.round(ctx.measureText(t).width) + padX*2 + gap;
    let x = Math.max(12, Math.round((W-total)/2));

    // CSS の --section-tags-y を優先。なければ 12vh (旧 14vh)。
    const y = (() => {
      try{
        const v = getComputedStyle(document.documentElement)
                         .getPropertyValue('--section-tags-y').trim();
        if (v.endsWith('vh')) { const n = parseFloat(v); if (!isNaN(n)) return Math.round(H * n / 100); }
        if (v.endsWith('px')) { const n = parseFloat(v); if (!isNaN(n)) return Math.round(n); }
      }catch(_){}
      // 14%では重なっていたため、デフォルトのフォールバック値を 10% に引き上げ
      return Math.round(H * 0.08); // fallback (0.12 -> 0.10)
    })();

    for(const t of tags){
      const tw = Math.round(ctx.measureText(t).width);
      const w  = tw + padX*2;

      // ピル背景
      ctx.fillStyle='rgba(255,255,255,.20)';
      ctx.strokeStyle='rgba(255,255,255,.35)';
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(x+rr, y); ctx.lineTo(x+w-rr, y);
      ctx.quadraticCurveTo(x+w, y, x+w, y+rr);
      ctx.lineTo(x+w, y+chipH-rr); ctx.quadraticCurveTo(x+w, y+chipH, x+w-rr, y+chipH);
      ctx.lineTo(x+rr, y+chipH);   ctx.quadraticCurveTo(x, y+chipH, x, y+chipH-rr);
      ctx.lineTo(x, y+rr);         ctx.quadraticCurveTo(x, y, x+rr, y);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // テキスト
      ctx.fillStyle='#fff';
      ctx.fillText(t, x + w/2, y + chipH/2 + 0.5);
      x += w + gap;
    }
  }

  // 絵文字帯（やや下）
  const bandY = Math.round(H*0.36);
  const bandH = Math.round(H*0.16);
  if (scene?.symbol){
    const mix = (hex, t=0.22)=>{
      const s=String(hex||'#10131d').replace('#','');
      const n=parseInt(s.length===3?s.split('').map(c=>c+c).join(''):s,16);
      const r=(n>>16)&255, g=(n>>8)&255, b=n&255;
      const R=Math.round(r+(255-r)*t), G=Math.round(g+(255-g)*t), B=Math.round(b+(255-b)*t);
      return `rgba(${R},${G},${B},0.85)`;
    };
    ctx.fillStyle = mix(base, 0.22);
    ctx.fillRect(0, bandY, W, bandH);

    ctx.font = `700 ${Math.round(S*0.12)}px "Shippori Mincho","Noto Sans JP",system-ui`;
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(String(scene.symbol), Math.round(W/2), Math.round(bandY + bandH/2));
  }

  // 題名キー・題名
  const titleTop = Math.round(H*0.22);
  if (scene?.title_key){
    ctx.font = `700 ${Math.round(H*0.034)}px "Shippori Mincho","Noto Sans JP",serif`;
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillText(String(scene.title_key), Math.round(W/2), titleTop - Math.round(H*0.07));
  }
  if (scene?.title){
    const tFont = Math.round(H*0.052);
    ctx.font = `700 ${tFont}px "Shippori Mincho","Noto Sans JP",serif`;
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='top';
    const maxW = Math.round(W*0.82);
    const lines = (function wrap(ctx, s){
      s=String(s||'').trim(); const out=[]; let line='';
      for(const ch of s){
        const test = line + ch;
        if(ctx.measureText(test).width <= maxW) line=test;
        else{ if(line) out.push(line); line=ch; }
      }
      if(line) out.push(line); return out;
    })(ctx, scene.title);
    const gap = Math.round(H*0.058);
    lines.forEach((ln,i)=> ctx.fillText(ln, Math.round(W/2), titleTop + i*gap));
  }

  // 本文
  if (scene?.narr){
    const nFont = Math.round(H*0.030);
    const lh    = Math.round(H*0.043);
    ctx.font = `${nFont}px "Noto Sans JP",system-ui,sans-serif`;
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='top';
    const maxW = Math.round(W*0.86);
    const baseY = Math.round(H*0.66);
    const lines = (function wrap(ctx, s){
      s=String(s||'').replace(/\s+/g,' ').trim(); const out=[]; let line='';
      for(const ch of s){
        const test=line+ch;
        if(ctx.measureText(test).width<=maxW) line=test;
        else{ if(line) out.push(line); line=ch; }
      }
      if(line) out.push(line); return out;
    })(ctx, scene.narr);
    const maxLines=Math.max(1, Math.floor((H-baseY)/lh)-1);
    lines.slice(0,maxLines).forEach((ln,i)=> ctx.fillText(ln, Math.round(W/2), baseY + i*lh));
  }

  // テストオーバレイ
  if (overlay?.test) {
    ctx.save(); ctx.globalAlpha=0.20; ctx.strokeStyle='#fff'; ctx.lineWidth=1;
    const step = Math.round(S/12);
    for(let gx=0; gx<=W; gx+=step){ ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,H); ctx.stroke(); }
    for(let gy=0; gy<=H; gy+=step){ ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke(); }
    ctx.restore();
  }
}

// 既存__playerCoreへマージして公開
try{
  window.__playerCore = Object.assign((window.__playerCore||{}), {
    gotoNext, gotoPrev, gotoPage, rateFor, effRateFor, chooseVoice, primeTTS,
    ensureResumed, hardStop,
    getVideoMeta: () => (Ctrl.videoMeta || {}),
    getScenes: () => (State.scenes || []).slice(),
    renderSceneToCanvas
  });
}catch(_){}

if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
else document.addEventListener('DOMContentLoaded', boot, { once:true });

/* ============== voiceschanged: 発話中断しない最適化 ========= */
try{ if('speechSynthesis' in window){ window.speechSynthesis.addEventListener('voiceschanged', ()=>{ refreshJPVoice(); }); } }catch(_){ }

/* ===== Theme autopilot: scene.base → CSS vars / symbol band ===== */
(function () {
  'use strict';

  function hexToRgb(hex) {
    if (!hex) return { r: 16, g: 19, b: 29 };
    var s = String(hex).trim();
    if (s[0] === '#') s = s.slice(1);
    if (s.length === 3) s = s.split('').map(c => c + c).join('');
    var n = parseInt(s, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  // baseを白で少し混ぜて“帯”に使う（暗い背景でも見える）
  function mixWithWhite(hex, ratio /*0..1*/) {
    var c = hexToRgb(hex);
    var t = Math.max(0, Math.min(1, ratio == null ? 0.18 : ratio));
    var r = Math.round(c.r + (255 - c.r) * t);
    var g = Math.round(c.g + (255 - c.g) * t);
    var b = Math.round(c.b + (255 - c.b) * t);
    // 帯は半透明でよいのでalphaを固定
    return 'rgba(' + r + ',' + g + ',' + b + ',0.85)';
  }

  function applyScenePalette(scene) {
    var root = document.documentElement;
    if (!scene) return;
    var base = scene.base || getComputedStyle(root).getPropertyValue('--bg-color') || '#10131d';
    root.style.setProperty('--bg-color', String(base).trim());
    root.style.setProperty('--symbol-bg-color', mixWithWhite(base, 0.22));
  }

  function getCurrentScene() {
    var P = (window.__player || window.__playerCore || {});
    try { return P.getScene ? P.getScene() : null; } catch (_) { return null; }
  }

  // 1) 初期・毎フレームの状態イベントで同期
  window.addEventListener('player:status', function () {
    try { applyScenePalette(getCurrentScene()); } catch (_) {}
  }, { passive: true });

  // 2) 予備：最初の読み込み時にも一度実施
  document.addEventListener('DOMContentLoaded', function () {
    try { applyScenePalette(getCurrentScene()); } catch (_) {}
  });

  // 3) もし __playerCore にイベントがあればそれもフック（存在すれば）
  try {
    if (window.__playerCore && typeof __playerCore.on === 'function') {
      __playerCore.on('scenechange', function (scene) { applyScenePalette(scene); });
    }
  } catch (_) {}
})();