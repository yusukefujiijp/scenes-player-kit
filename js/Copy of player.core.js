/*!
Project:  scenes-player-kit
File:     js/player.core.js
Role:     Player Core (page-end stop default + Stop ACK UI hooks + Hard Stop hook)
UX:       Emits UI-friendly custom events for TTS/playing states (Phase2)
Roadmap:  Phase3/4/6 — TTS watchdog hardening, event-bus hooks, QuickBar Next連携
Notes (delta):
 - Stopは「ページ末で静停止」を既定化（押下時は自動遷移だけを遮断し、当該ページの読み上げは完了させる）
 - Stop押下の“手応え”を可視化するため、即時ACK/確定ACKのカスタムイベントを追加
 - 即時ACK: window.dispatchEvent(new CustomEvent('player:stop-ack', {detail:{ts}}))
 - 確定ACK: window.dispatchEvent(new CustomEvent('player:stop-confirm', {detail:{latencyMs, context}}))
 - Hard Stop（強制停止）APIを公開（__player.stopHard）: cancel() + 短い整定待機
 - 再生系操作の先頭で resume() を儀式化（ensureResumed）し、音声起動の安定性を確保
 - speakパイプ: scrub → stripMarkdownLight → runtime speechFixes → speakOrWait（watchdog付き）
*/

import { analyzeColor, applyColorTheme } from './utils/color.js';

'use strict';

/* ======================= Feature flags ======================= */
const TTS_ENABLED = (typeof window.TTS_ENABLED === 'boolean') ? window.TTS_ENABLED : true;
window.__ttsFlags = window.__ttsFlags || { readTag: true, readTitleKey: true, readTitle: true, readNarr: true };

/* ======================= Core State ========================== */
const State = { scenes: [], idx: 0, playingLock: false };
const Ctrl = {
 stopRequested: false,   // Stop押下直後の要求（ページ末で停止）
 stopped: false,         // Stopが確定し、次遷移や再生を抑止中
 stopReqAt: 0,           // Stop受付時刻（ACKレイテンシ計測用）
 lastCancelAt: 0,        // 直近 cancel() の時刻（Hard Stop整定用）
 activationDone:false,   // 初回可聴ワンショット済み
 navToken: 0,            // ナビ世代トークン（Next/Prev/Goto/Restartで更新）
 videoMeta: {}           // scenes.json の videoMeta（advancePolicy 参照用）
};

/* ======================= UI-facing State ===================== */
// Debug UI 等が subscribe しやすいよう、TTS/再生状態を集約して発火
const UiState = { speaking:false, paused:false, pending:false, playing:false };
function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } }
function emitTtsState(next){
 const n = {
  speaking: (next.speaking ?? UiState.speaking),
  paused:   (next.paused   ?? UiState.paused),
  pending:  (next.pending  ?? UiState.pending),
 };
 if (n.speaking!==UiState.speaking || n.paused!==UiState.paused || n.pending!==UiState.pending){
  UiState.speaking = n.speaking;
  UiState.paused   = n.paused;
  UiState.pending  = n.pending;
  emit('player:tts-state', { speaking:UiState.speaking, paused:UiState.paused, pending:UiState.pending });
 }
}
function emitPlaying(on){
 const v = !!on;
 if (UiState.playing === v) return;
 UiState.playing = v;
 // 既存UI後方互換: playing は維持しつつ、index/total/canPrev/canNext を追加
 const total=(State.scenes||[]).length;
 emit('player:status', {
  playing: UiState.playing,
  index: State.idx,
  total,
  canPrev: (State.idx>0),
  canNext: (State.idx+1<total)
 });
}
// Stop要求の可視化（ACKとは別に "pending" をUIに共有）
const setPending = (p)=> emitTtsState({ pending: !!p });

/* ======================= Utils =============================== */
const nowMs = () => (window.performance && performance.now ? performance.now() : Date.now());
const sleep = (ms) => new Promise(r => setTimeout(r, Math.max(0, ms|0)));

// 中断対応 sleep（ナビ世代変更で早期復帰）
async function sleepAbortable(ms, tok){
 const step = 60; // 60ms 粒度で中断判定
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
 // 見た目は CSS が担当（position/transition などは style.css）
 return bg;
}
let __bannerDefault='';
function setBannerText(txt){ try{ const el=document.getElementById('banner'); if(!el) return; const s=String(txt||'').trim(); el.textContent=s || ' '; } catch(_){} }
function setBg(c){
 try{
  if(!c) return;
  ensureBgLayer(); // DOM を確保（スタイルは CSS）
  // CSS変数に反映（背景は #bgColor{ background-color:var(--bg-color) } が担う）
  document.documentElement.style.setProperty('--bg-color', String(c));
 }catch(_){}
}
function applyVersionToBody(scene){ const v=(scene&&(scene.version||scene.uiVersion))||'A'; const b=document.body; b.classList.remove('version-A','version-B','version-T'); b.classList.add(v==='B'?'version-B':(v==='T'?'version-T':'version-A')); }

function applyReadableTextColor(base){
  const analysisResult = analyzeColor(base);
  applyColorTheme(analysisResult);
}

/* ========================= Scene Surface ===================== */
function ensureSceneSurface(){ ensureBgLayer(); let root=document.getElementById('content'); if(!root){ root=document.createElement('div'); root.id='content'; document.body.appendChild(root);} root.innerHTML=''; return root; }
function createSceneShell(){ const el=document.createElement('div'); el.className='scene'; return el; }
function setTextInScene(sceneEl, selector, text){
 let el=sceneEl.querySelector(selector);
 if(!el){
  el=document.createElement('div');
  el.className=selector.replace(/^[.#]/,'');
  sceneEl.appendChild(el);
 }
 el.textContent=String(text||'');
 // NOTE: white-space は CSS (.narr { white-space: pre-line; }) に委譲
}
function setText(idOrKey, s){ const map={ title_key:'.title_key', titleKey:'.title_key', title:'.title', symbol:'.symbol', narr:'.narr' }; const sel=map[idOrKey]||'.narr', root=document.getElementById('content'); if(!root) return; const sc=root.querySelector('.scene')||root; setTextInScene(sc, sel, s); }

/* ========================= Effects Hook ====================== */
function runEffectIfAny(scene, anchor){ if(!scene||!scene.effect) return; if(!window.__effects||typeof __effects.run!=='function') return; try{ __effects.run(scene.effect, anchor||document.body, scene);}catch(_){} }

/* ========================= Voices (non-blocking) ============= */
function getVoicesSafe(){ try{ return window.speechSynthesis.getVoices()||[]; } catch(_){ return []; } }
let jpVoice=null; function refreshJPVoice(){ const list=getVoicesSafe(); jpVoice = list.find(v=>/^ja(-JP)?/i.test(v.lang)) || list.find(v=>/日本語/.test(v.name)) || null; }
refreshJPVoice();
try{ window.speechSynthesis.addEventListener('voiceschanged', ()=>{ refreshJPVoice(); }); }catch(_){ }

function voiceById(key){ if(!key) return null; const list=getVoicesSafe(); let v=list.find(x=>x.voiceURI===key); if(v) return v; if(key.includes('|')){ const [lang,name]=key.split('|'); v=list.find(x=>x.lang===lang && x.name===name); if(v) return v; } return list.find(x=>x.name===key)||list.find(x=>x.lang===key)||null; }
function chooseVoice(role){ const vm=window.__ttsVoiceMap||{}, map=vm[role]; if(map){ if(typeof map==='string'){ const v=voiceById(map); if(v) return v; } else if(map && typeof map==='object'){ try{ if(typeof SpeechSynthesisVoice!=='undefined' && map instanceof SpeechSynthesisVoice) return map; }catch(_){} const key=map.voiceURI||((map.lang||'')+'|'+(map.name||'')); const v=voiceById(key); if(v) return v; } }
 try{ if(window.__ttsUtils && typeof __ttsUtils.pick==='function'){ const p=__ttsUtils.pick(role); if(p&&p.id){ const v=voiceById(p.id); if(v) return v; } } }catch(_){}
 return jpVoice || null; // 未到着でも u.voice 未設定で開始可
}

/* ========================= TTS Rate ========================== */
function clampAbs(v){ const n=Number(v); if(!Number.isFinite(n)) return 1.4; return Math.max(0.5, Math.min(2.0, n)); }
function effRateFor(role='narr', base=1.4){ try{ if(window.__ttsUtils && typeof __ttsUtils.getRateForRole==='function') return clampAbs(__ttsUtils.getRateForRole(base, role)); }catch(_){} return clampAbs(base); }
function rateFor(role='narr'){ return effRateFor(role, 1.4); }

/* ========================= Priming =========================== */
async function primeTTS(){ if(!TTS_ENABLED || window.ttsPrimed) return; await new Promise(res=>{ try{ const u=new SpeechSynthesisUtterance(' '); u.lang='ja-JP'; const v=chooseVoice('narr')||jpVoice; if(v) u.voice=v; u.volume=0; u.rate=1.0; let done=false; const fin=()=>{ if(!done){ done=true; window.ttsPrimed=true; res(); } }; u.onend=fin; u.onerror=fin; speechSynthesis.speak(u); setTimeout(fin, 800); }catch(_){ window.ttsPrimed=true; res(); } }); }

/* ========================= Markdown / Scrub ================== */
function stripMarkdownLight(s){ return String(s||'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/__(.+?)__/g,'$1').replace(/\*(.+?)\*/g,'$1').replace(/_(.+?)_/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1').replace(/\[([^\]]+)\]/g,'$1'); }
function getSpeechFixes(){ try{ const o=window.speechFixes; return (o && typeof o==='object')? o : {}; }catch(_){ return {}; } }
function scrub(text){ let s=String(text||''); s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g,''); s = s.replace(/[:：]/g,'').trim(); return s; }
function splitChunksJa(s, maxLen=90){
 // 句読点を優先に細切れ化。iOS の onend 欠落に強い短尺化
 const t=scrub(s); if(!t) return [];
 const seps='。．！？?!\n、・：；'; // 追加の弱セパレータも採用
 const raw=[]; let buf='';
 for(let i=0;i<t.length;i++){
  const ch=t[i]; buf+=ch;
  if(seps.indexOf(ch)!==-1){
   // 後続の空白は巻き取る
   while(i+1<t.length && /\s/.test(t[i+1])){ buf+=t[++i]; }
   if(buf.trim()){ raw.push(buf.trim()); buf=''; }
  }
 }
 if(buf.trim()) raw.push(buf.trim());
 // 上限で無理切りする時は可能なら空白・読点付近にスナップ
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
async function ensureResumed(){ try{ if('speechSynthesis' in window && speechSynthesis.paused){ speechSynthesis.resume(); } }catch(_){} await sleep(300); const elapsed=nowMs() - (Ctrl.lastCancelAt||0); if(elapsed>=0 && elapsed<280) await sleep(280 - elapsed); }

/* ========================= Stop ACK / State ================== */
function requestSoftStop(){ if(!Ctrl.stopRequested){ Ctrl.stopRequested = true; Ctrl.stopReqAt = nowMs(); try{ window.dispatchEvent(new CustomEvent('player:stop-ack', { detail:{ ts: Ctrl.stopReqAt } })); }catch(_){} } }
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
  let speakText = cleaned; for(const k of Object.keys(fixes)){ if(!k) continue; speakText = speakText.split(k).join(String(fixes[k]??'')); }
  if(!speakText.trim()) return resolve();

  const u = new SpeechSynthesisUtterance(speakText);
  u.lang='ja-JP'; const v=chooseVoice(role)||jpVoice; if(v) u.voice=v; const eff=effRateFor(role, rate); u.rate=eff;

  let settled=false, started=false, fallbackTried=false;
  const done=()=>{ if(!settled){ settled=true; resolve(); } };
  u.onstart=()=>{ started=true; /* chunk単位の開始。全体 speaking は speakOrWait 側で管理 */ };
  // pause/resume は発火しない実装もあるが、来たらUIへ橋渡し
  u.onpause = ()=>{ emitTtsState({ paused:true  }); };
  u.onresume= ()=>{ emitTtsState({ paused:false }); };
  u.onend=done;
  u.onerror=(ev)=>{ try{ emit('player:tts-error', { role, reason: (ev && ev.error) || 'error' }); }catch(_){} done(); };

  try{ speechSynthesis.speak(u); }catch(_){ return done(); }

  // === 改良ウォッチドッグ ===
  // 期待時間: 日本語実効 6.5 cps / rate 補正 + 句読点余裕
  const cps = 6.5;
  const punct = (speakText.match(/[。．！？!?]/g)||[]).length;
  const expectedMs = Math.round(1000 + (speakText.length / Math.max(0.8, cps * Math.max(0.8, eff))) * 1000 + punct*180);
  const hardMaxMs  = Math.min(90000, Math.max(12000, speakText.length*260 + 3000));

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

  // ハードキャップのみ（自然終了を最優先）
  setTimeout(()=>{ if(!settled) done(); }, hardMaxMs);
 });
}

async function speakOrWait(text, rate = rateFor('narr'), role='narr'){
 const cleaned = stripMarkdownLight(scrub(text)); if(!cleaned) return;
 const eff = effRateFor(role, rate);
 const myTok = Ctrl.navToken; // 割り込み検出用
 if(TTS_ENABLED){
  const parts = splitChunksJa(cleaned);
  emitTtsState({ speaking:true });          // 全体 speaking をON
  emit('player:tts-start', { role, length: cleaned.length, rate: eff });
  try{
   for(let i=0;i<parts.length;i++){
    if(myTok!==Ctrl.navToken) break; // 割り込み
    const p=parts[i];
    const detailStart = { phase:'start', role, index:i+1, total:parts.length, len:p.length };
    emit('player:tts-chunk', detailStart);
    const t0=nowMs(); await speakStrict(p, eff, role);
    const dt=nowMs()-t0;
    emit('player:tts-chunk', { phase:'end', role, index:i+1, total:parts.length, len:p.length, ms:dt });
    // チャンク間静寂ゲート（途切れ読上防止）
    const quietMs = ((Ctrl.videoMeta && Ctrl.videoMeta.advancePolicy && Ctrl.videoMeta.advancePolicy.quietMs)|0) || 300;
    // speaking=false が連続 quietMs 続くまで待つ（割り込み可能）
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
   emitTtsState({ speaking:false, paused:false }); // 終了時に確実にOFF
   emit('player:tts-end', { role });
  }
 } else {
  await sleep(Math.min(20000, 800 + (cleaned.length * 100) / Math.max(0.5, eff)));
 }
}

/* =========== TTS sanitize bridge（narrTTS優先） ============== */
let __ttsSanModule = null;
async function __getNarrForTTS(scene){
 try{ __ttsSanModule = __ttsSanModule || await import('./tts_sanitize.js'); if(__ttsSanModule && typeof __ttsSanModule.getTtsText==='function') return __ttsSanModule.getTtsText(scene); }catch(_){}
 const _fallbackBasic = s => String(s||'').replace(/[\u2300-\u23FF\uFE0F]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/g,'').replace(/[⏱⏲⏰⌛️]/g,'');
 return _fallbackBasic(scene && (scene.narrTTS || scene.narr));
}

/* ========================= Renderers ========================= */
function removeAllPlayButtons(){ try{ document.querySelectorAll('#playBtn, .playBtn').forEach(b=>b.remove()); }catch(_){} }

function renderPlaceholder(scene){
 // 「アクティベーション・ゲート」UIを生成
 applyVersionToBody(scene || { uiVersion: 'A' });
 setBg(scene ? scene.base : '#f9f9f7');
 const root = ensureSceneSurface();
 applyReadableTextColor(scene ? scene.base : '#f9f9f7');

 const gate = document.createElement('div');
 gate.id = 'activation-gate';
 gate.innerHTML = '<div class="gate-icon">▶︎</div>';
 root.appendChild(gate);

 const start = (ev) => {
  if (ev) ev.preventDefault();
  // 1. 音声有効化の儀式
  if (!Ctrl.activationDone) {
   try { const u = new SpeechSynthesisUtterance(' '); u.volume=0; speechSynthesis.speak(u); Ctrl.activationDone = true; } catch(_){}
  }
  // 2. アプリ状態を「有効化済み」に移行し、イベントを発火
  document.body.classList.remove('app-unactivated');
  try { window.dispatchEvent(new CustomEvent('player:activated')); } catch(_) {}

  // 3. ゲートを消去し、再生開始
  primeTTS().catch(()=>{}); gate.remove(); requestAnimationFrame(()=>{ gotoNext(); });
 };
 gate.addEventListener('click', start, {passive: false });
}

function renderContent(scene){
 removeAllPlayButtons();
 applyVersionToBody(scene);
 setBg(scene.base || '#000');
 const root=ensureSceneSurface();
 try{ document.body.style.setProperty('--symbol-bg-color', String(scene.base || 'transparent')); }catch(_){}
 const sc=createSceneShell();
 // ==== Section Tags (1行固定・チップ単位で詰める) ====
 (function renderSectionTags(){
  // 正規化：配列のみ（sectionTags へ一本化）
  const raw = Array.isArray(scene.sectionTags) ? scene.sectionTags : [];
  const tags = (raw||[])
   .map(x => String(x||'').trim())
   .filter(x => x.length>0);
  if (!tags.length) return;

  const row = document.createElement('div');
  row.className = 'section-tags';
  sc.appendChild(row);

  // パック関数：はみ出す前にチップ追加を止める（+N 等は出さない）
  function packOnce(){
   row.innerHTML = '';
   let shown = 0;
   for (let i=0; i<tags.length; i++){
    const chip = document.createElement('div');
    chip.className = 'section-tag';
    chip.textContent = tags[i];
    row.appendChild(chip);
    // ほんの誤差対策に +1px の余裕
    if (row.scrollWidth > row.clientWidth + 1){
     row.removeChild(chip);
     break;
    }
    shown++;
   }
   row.classList.toggle('single', shown===1);
   // 1個も入らない極端なケース：行ごと非表示
   if (shown===0){ row.remove(); }
  }
  // 初回・フォント到着・次フレームでもう一度軽く詰め直す
  packOnce();
  requestAnimationFrame(packOnce);
  try{ if (document.fonts && document.fonts.ready) document.fonts.ready.then(()=>packOnce()); }catch(_){}
 })();
 if(scene.title_key){ const tk=document.createElement('div'); tk.className='title_key'; tk.textContent=String(scene.title_key||''); sc.appendChild(tk); }
 if(scene.title){ const t=document.createElement('div'); t.className='title'; t.textContent=String(scene.title||''); sc.appendChild(t); }
 if(scene.symbol){ const band=document.createElement('div'); band.className='symbol-bg'; const sym=document.createElement('div'); sym.className='symbol'; sym.textContent=String(scene.symbol||''); band.appendChild(sym); sc.appendChild(band); }
 if(scene.narr){ const n=document.createElement('div'); n.className='narr'; n.textContent=String(scene.narr||''); sc.appendChild(n); }
 root.appendChild(sc);
 applyReadableTextColor(scene && scene.base);
 runEffectIfAny(scene, root);
}

function renderEffect(scene){
 removeAllPlayButtons();
 applyVersionToBody(scene || { uiVersion:'T' });
 if(scene && scene.base) setBg(scene.base);
 const root=ensureSceneSurface();
 runEffectIfAny(scene, root);
}

/* =============== Scene type & sequencing ===================== */
function getSceneType(scene){ if(!scene) return 'unknown'; if(typeof scene.type==='string') return scene.type; if(scene.version==='A'||scene.version==='B'||scene.version==='T') return 'content'; return 'content'; }

async function runContentSpeech(scene){
 const f = (window.__ttsFlags || { readTag:true, readTitleKey:true, readTitle:true, readNarr:true });
 const muted = !TTS_ENABLED;
 // タグ読み上げ：sectionTags の先頭 3 個を連結 1 発話（自然で安定）
 if(!muted && f.readTag){
  const tags = Array.isArray(scene.sectionTags) ? scene.sectionTags : [];
  const spoken = tags.slice(0,3)
   .map(t => String(t||'').trim().replace(/^#/,'').replace(/_/g,' '))
   .filter(Boolean)
   .join('、');
  if (spoken) { await speakOrWait(spoken, rateFor('tag'), 'tag'); }
 }
 if(!muted && f.readTitleKey && scene.title_key){ await speakOrWait(scene.title_key, rateFor('titleKey'), 'titleKey'); }
 if(!muted && f.readTitle && scene.title){ await speakOrWait(scene.title, rateFor('title'), 'title'); }
 if(f.readNarr && scene.narr){ const narrSafe = await __getNarrForTTS(scene); await speakOrWait(narrSafe, rateFor('narr'), 'narr'); }
}

async function playScene(scene){
 if(!scene) return;
 const kind = getSceneType(scene);
 emit('player:scene-willstart', { index: State.idx, kind, scene });
 const myTok = (++Ctrl.navToken); // このシーンの世代トークン
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
   // === Advance policy（TTS完了ベース + 静寂 + 余韻） ===
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
     // シーン後の静寂+余韻（割り込み可能）
     await sleepAbortable(Math.max(0, pol.quietMs|0), myTok);
     await sleepAbortable(Math.max(0, pol.postDelayMs|0), myTok);
     if(myTok===Ctrl.navToken && typeof gotoNext==='function') await gotoNext();
    } // manual は自動遷移しない
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
   try{ renderContent(scene); await primeTTS(); await runContentSpeech(scene); } finally { State.playingLock = false; }
   emit('player:scene-didrender', { index: State.idx, kind:'content' });
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
 // 現在の読み上げを中断（ユーザ明示操作は即応）
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
 if(State.idx + 1 >= N){ try{ window.dispatchEvent(new CustomEvent('player:end')); }catch(_){} return; }
 emit('player:navigation-queued', { from: State.idx, to: State.idx+1 });
 await gotoPage(State.idx + 1);
}
async function gotoPrev(){
 await ensureResumed();
 if(State.idx - 1 < 0){ try{ window.dispatchEvent(new CustomEvent('player:begin')); }catch(_){} return; }
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

  try{ const vm=(data && data.videoMeta)||{}; __bannerDefault = vm.bannerText || vm.triviaTitle || vm.thumbnailText || vm.theme || ''; setBannerText(__bannerDefault); }catch(_){}

  try{
   // tts-utils セットアップ
   if(window.__ttsUtils && data && data.videoMeta && data.videoMeta.tts){ __ttsUtils.setup(data.videoMeta.tts); }
   else if(window.__ttsUtils){ __ttsUtils.setup({}); }
   // debug_config 側の voice.filter → tts-utils へ
   const VC=(window.__dbgConfig && window.__dbgConfig.voice)||null;
   if(window.__ttsUtils && VC && VC.filter && typeof VC.filter.jaOnly==='boolean'){ __ttsUtils.setup({ filter:{ jaOnly:!!VC.filter.jaOnly } }); }
   // defaults → __ttsVoiceMap（未設定ロールのみ）
   window.__ttsVoiceMap = window.__ttsVoiceMap || {};
   if(VC && VC.defaults){ ['tag','titleKey','title','narr'].forEach(k=>{ if(!window.__ttsVoiceMap[k] && VC.defaults[k]) window.__ttsVoiceMap[k]=VC.defaults[k]; }); }
  }catch(_){ }

  await gotoPage(0);
 }catch(e){
  console.error('Failed to load scenes.json', e);
  ensureSceneSurface(); setBg('#000'); const root=document.getElementById('content'); const sc=createSceneShell(); setTextInScene(sc,'.title','scenes.json の読み込みに失敗しました'); root.appendChild(sc);
 }
}

/* ========================= Public API ======================== */
async function hardStop(){
 requestSoftStop(); // UI的には止めたい意図を共有
 setPending(true);
 try{ if('speechSynthesis' in window){ speechSynthesis.cancel(); Ctrl.lastCancelAt=nowMs(); await sleep(280); } }catch(_){}
 Ctrl.stopped = true; // 強制停止は即確定
 finalizeStopIfNeeded('hard');
}

export const player = {
  next: () => { clearStop(); return gotoNext(); },
  prev: () => { clearStop(); return gotoPrev(); },
  play: () => { if(Ctrl.stopped || Ctrl.stopRequested){ clearStop(); return gotoPage(State.idx); } clearStop(); return gotoNext(); },
  stop: () => { requestSoftStop(); /* 既定: ページ末で停止（pause/cancelは行わない）*/ },
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
  getScene:() => (State.scenes && State.scenes[State.idx]) || null
};
// ---- Global alias for debug panel & external modules ----
try{ if (typeof window !== 'undefined') { window.__player = Object.assign((window.__player||{}), player); } }catch(_){ }

window.__playerCore = Object.assign((window.__playerCore || {}), {
 gotoNext, gotoPrev, gotoPage, rateFor, effRateFor, chooseVoice, primeTTS,
 // Stop周り
 ensureResumed, hardStop,
});

if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
else document.addEventListener('DOMContentLoaded', boot, { once:true });

/* ============== voiceschanged: 発話中断しない最適化 ========= */
try{ if('speechSynthesis' in window){ window.speechSynthesis.addEventListener('voiceschanged', ()=>{ refreshJPVoice(); }); } }catch(_){ }
