/*!
  Project:  shorts-player-kit
  File:     js/modules/tts.js
  Role:     Text-to-Speech with Safari/iOS hardening + voice-mode switch (auto/os-default/fixed)
*/
import { stripMarkdownLight, getSpeechFixes, scrub, splitChunksJa } from '../utils/text.js';

/* ===== Module-private state ===== */
let jpVoice = null;
let __ttsWarmTried = false;

/* ===== Local utils ===== */
const sleep = (ms) => new Promise(r => setTimeout(r, Math.max(0, ms|0)));
const nowMs  = () => (window.performance && performance.now ? performance.now() : Date.now());

/* ===== UI emitters ===== */
function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } }
function emitTtsState(next){ emit('player:tts-state', next); }

/* ===== Voices helpers ===== */
function getVoicesSafe(){ try{ return (window.speechSynthesis && window.speechSynthesis.getVoices && window.speechSynthesis.getVoices()) || []; } catch(_){ return []; } }
function refreshJPVoice(){ const list=getVoicesSafe(); jpVoice = list.find(v=>/^ja(-JP)?/i.test(v.lang)) || list.find(v=>/日本語/.test(String(v.name||''))) || null; }
function hasJPChar(s){ try{ return /[\u3040-\u30ff\u3400-\u9fff]/.test(String(s||'')); }catch(_){ return false; } }
function forceWarmVoices(){ try{ if(!('speechSynthesis' in window) || __ttsWarmTried) return; __ttsWarmTried=true; const u=new SpeechSynthesisUtterance('あ'); try{ if(jpVoice) u.voice=jpVoice; }catch(_){ } u.lang='ja-JP'; u.volume=.15; u.rate=1.0; u.pitch=1.0; u.onend=()=>{}; u.onerror=()=>{}; try{ speechSynthesis.speak(u); }catch(_){ } }catch(_){ } }
async function voicesReady(timeoutMs=5000){
  try{
    const t0=nowMs(); let delay=60; let list=getVoicesSafe(); if(!Array.isArray(list)||list.length===0) forceWarmVoices();
    while((nowMs()-t0)<timeoutMs){ if(Array.isArray(list)&&list.length>0){ try{ refreshJPVoice(); }catch(_){ } try{ window.dispatchEvent(new CustomEvent('tts:voices-ready',{detail:{count:list.length}})); }catch(_){ } return list; } await sleep(delay); delay=Math.min(300,(delay*1.7)|0); list=getVoicesSafe(); }
    try{ window.dispatchEvent(new CustomEvent('tts:voices-ready',{detail:{count:(Array.isArray(list)?list.length:0),timeout:true}})); }catch(_){ }
    return Array.isArray(list)?list:[];
  }catch(_){ return []; }
}
async function resumePump(budgetMs=500){ try{ if(!('speechSynthesis' in window)) return; const t0=nowMs(); while((nowMs()-t0)<budgetMs){ try{ speechSynthesis.resume(); }catch(_){ } await sleep(50); try{ if(!speechSynthesis.paused) break; }catch(_){ } } }catch(_){ } }

/* ===== Voice mode config ===== */
function getVoiceMode(){ try{ const v=(window.__dbgConfig&&window.__dbgConfig.voice)||{}; return v.mode||'auto'; }catch(_){ return 'auto'; } }
function getFixedVoiceFor(role){ try{ const v=(window.__dbgConfig&&window.__dbgConfig.voice)||{}; const d=v.defaults||{}; const s=d[role]; return (typeof s==='string')?s:null; }catch(_){ return null; } }

/* ===== Voice selection by role ===== */
function voiceById(key){
  if(!key) return null; const list=getVoicesSafe();
  let v=list.find(x=>x.voiceURI===key); if(v) return v;
  if(key.includes('|')){ const [lang,name]=key.split('|'); v=list.find(x=>x.lang===lang && x.name===name); if(v) return v; }
  return list.find(x=>x.name===key)||list.find(x=>x.lang===key)||null;
}
function chooseVoice(role){
  const mode=getVoiceMode();
  if(mode==='os-default') return null; // ← OS任せ（u.voice を設定しない）

  if(mode==='fixed'){
    const key=getFixedVoiceFor(role);
    if(key){ const v=voiceById(key); if(v) return v; }
    // fixed指定が見つからない時だけ自動fallback
  }

  const vm=window.__ttsVoiceMap||{}, map=vm[role];
  if(map){
    if(typeof map==='string'){ const v=voiceById(map); if(v) return v; }
    else if(map && typeof map==='object'){
      try{ if(typeof SpeechSynthesisVoice!=='undefined' && map instanceof SpeechSynthesisVoice) return map; }catch(_){}
      const key=map.voiceURI||((map.lang||'')+'|'+(map.name||'')); const v=voiceById(key); if(v) return v;
    }
  }
  try{ if(window.__ttsUtils && typeof __ttsUtils.pick==='function'){ const p=__ttsUtils.pick(role); if(p&&p.id){ const v=voiceById(p.id); if(v) return v; } } }catch(_){}
  return jpVoice || null;
}
function chooseVoiceWithFallback(){ const list=getVoicesSafe(); let v=null; try{ v=list.find(v=>/^ja(-JP)?/i.test(v.lang))||list.find(v=>/日本語/.test(String(v.name||'')))||null; }catch(_){ v=null; } if(!v && list.length>0) v=list[0]; if(v) jpVoice=v; return v; }

/* ===== Rate helpers ===== */
function clampAbs(v){ const n=Number(v); if(!Number.isFinite(n)) return 1.4; return Math.max(0.5, Math.min(2.0, n)); }
function effRateFor(role='narr', base=1.4){ try{ if(window.__ttsUtils && typeof __ttsUtils.getRateForRole==='function') return clampAbs(__ttsUtils.getRateForRole(base, role)); }catch(_){ } return clampAbs(base); }
function rateFor(role='narr'){ return effRateFor(role, 1.4); }

/* ===== Resume Ritual ===== */
async function ensureResumed(Ctrl){ try{ await voicesReady(5000); }catch(_){ } await resumePump(500); const elapsed=nowMs()-((Ctrl && Ctrl.lastCancelAt)||0); if(elapsed>=0 && elapsed<280) await sleep(280 - elapsed); }

/* ===== Stop-all (export) ===== */
function stopAllTTS(){ try{ if('speechSynthesis' in window){ window.speechSynthesis.cancel(); } }catch(_){ } }
export { stopAllTTS };

/* ===== Speak Core ===== */
function assignVoiceAndLang(u, text, vCandidate){
  const isJP = hasJPChar(text);
  if(vCandidate){ try{ u.voice=vCandidate; }catch(_){ } try{ if(!u.lang && vCandidate.lang) u.lang=vCandidate.lang; }catch(_){ } }
  if(!u.lang){ u.lang = isJP ? 'ja-JP' : 'en-US'; }
  u.volume = 1.0; u.pitch = 1.0;
}
function speakStrict(text, rate, role, Ctrl){
  return new Promise(async (resolve)=>{
    const cleaned=stripMarkdownLight(scrub(text)); if(!cleaned) return resolve();
    await ensureResumed(Ctrl); try{ await voicesReady(1200); }catch(_){ }
    const fixes=getSpeechFixes(); let speakText=cleaned; for(const k of Object.keys(fixes)){ if(!k) continue; speakText=speakText.split(k).join(String(fixes[k]??'')); }
    if(!speakText.trim()) return resolve();

    const v = chooseVoice(role) || (getVoiceMode()==='fixed' ? null : (chooseVoiceWithFallback()||null));
    const u = new SpeechSynthesisUtterance(speakText);
    assignVoiceAndLang(u, speakText, v);
    const eff=effRateFor(role, rate); u.rate=eff;

    let settled=false, started=false, fallbackTried=false;
    const done=()=>{ if(!settled){ settled=true; resolve(); } };
    u.onstart=()=>{ started=true; };
    u.onpause=()=>{ emitTtsState({paused:true}); };
    u.onresume=()=>{ emitTtsState({paused:false}); };
    u.onend=done;
    u.onerror=()=>{ try{ emit('player:tts-error',{role,reason:'error'}); }catch(_){ } done(); };

    try{ speechSynthesis.speak(u); setTimeout(()=>{ try{ speechSynthesis.resume(); }catch(_){ } }, 0); }catch(_){ return done(); }

    // 1.2s未起動なら可聴キック → 再投機
    const doKick = async ()=>{
      if(fallbackTried||started||settled) return; fallbackTried=true;
      try{ speechSynthesis.cancel(); if(Ctrl) Ctrl.lastCancelAt=nowMs(); }catch(_){ }
      await sleep(200);
      const probe=new SpeechSynthesisUtterance(hasJPChar(speakText)?'あ':'a');
      assignVoiceAndLang(probe, speakText, v); probe.rate=1.0;
      await new Promise(res=>{ probe.onend=res; probe.onerror=res; try{ speechSynthesis.speak(probe); }catch(_){ res(); } });
      await sleep(120);
      const u2=new SpeechSynthesisUtterance(speakText);
      assignVoiceAndLang(u2, speakText, v); u2.rate=eff; u2.onstart=()=>{ started=true; }; u2.onend=done; u2.onerror=done;
      try{ speechSynthesis.speak(u2); }catch(_){ return done(); }
    };
    setTimeout(()=>{ if(!started && !settled) doKick(); }, 1200);

    const hardMaxMs=Math.min(90000, Math.max(12000, speakText.length*260 + 3000));
    setTimeout(()=>{ if(!settled) done(); }, hardMaxMs);
  });
}

/* ===== Speak Or Wait ===== */
async function speakOrWait(text, rate, role, Ctrl){
  const TTS_ENABLED=(typeof window.TTS_ENABLED==='boolean')?window.TTS_ENABLED:true;
  const cleaned=stripMarkdownLight(scrub(text)); if(!cleaned) return;
  const eff=effRateFor(role, rate); const myTok=Ctrl.navToken;
  if(TTS_ENABLED){
    const parts=splitChunksJa(cleaned);
    emitTtsState({speaking:true, paused:false, pending:false});
    emit('player:tts-start',{role,length:cleaned.length,rate:eff});
    try{
      for(let i=0;i<parts.length;i++){
        if(myTok!==Ctrl.navToken) break;
        const p=parts[i];
        emit('player:tts-chunk',{phase:'start',role,index:i+1,total:parts.length,len:p.length});
        const t0=nowMs(); await speakStrict(p, eff, role, Ctrl);
        const dt=nowMs()-t0;
        emit('player:tts-chunk',{phase:'end',role,index:i+1,total:parts.length,len:p.length,ms:dt});
        const quietMs=((Ctrl.videoMeta&&Ctrl.videoMeta.advancePolicy&&Ctrl.videoMeta.advancePolicy.quietMs)|0)||300;
        if(myTok===Ctrl.navToken){
          const step=100; const need=Math.max(quietMs,0); let acc=0;
          while(acc<need && myTok===Ctrl.navToken){
            await sleep(step);
            try{ if(('speechSynthesis' in window)&&!speechSynthesis.speaking){ acc+=step; } else acc=0; }catch(_){ break; }
          }
          emit('player:tts-quiet',{role,index:i+1,total:parts.length,quietMs:need,passed:(acc>=need)});
        }
      }
    } finally {
      emitTtsState({speaking:false, paused:false});
      emit('player:tts-end',{role});
    }
  } else {
    await sleep(Math.min(20000, 800 + (cleaned.length*100)/Math.max(0.5, eff)));
  }
}

/* ===== Optional narr sanitizer ===== */
let __ttsSanModule=null;
async function __getNarrForTTS(scene){
  try{ __ttsSanModule=__ttsSanModule||await import('../tts_sanitize.js'); if(__ttsSanModule && typeof __ttsSanModule.getTtsText==='function') return __ttsSanModule.getTtsText(scene); }catch(_){}
  const _fallbackBasic=s=>String(s||'').replace(/[\u2300-\u23FF\uFE0F]|[\uD83C-\uDBFF][\uDC00-\uDFFF]/g,'').replace(/[⏱⏲⏰⌛️]/g,'');
  return _fallbackBasic(scene && (scene.narrTTS||scene.narr));
}

/* ===== Public API ===== */
export async function primeTTS(){
  const TTS_ENABLED=(typeof window.TTS_ENABLED==='boolean')?window.TTS_ENABLED:true;
  if(!TTS_ENABLED || window.ttsPrimed) return;
  try{
    forceWarmVoices(); await resumePump(300);
    const u=new SpeechSynthesisUtterance('あ'); try{ if(jpVoice) u.voice=jpVoice; }catch(_){ }
    u.lang='ja-JP'; u.rate=1.0; u.pitch=1.0; u.volume=.12;
    let settled=false, ok=false; const done=()=>{ if(!settled){ settled=true; } };
    u.onstart=()=>{ ok=true; }; u.onend=()=>{ done(); }; u.onerror=()=>{ done(); };
    try{ speechSynthesis.speak(u); }catch(_){ done(); }
    const t0=nowMs(); while(!settled && (nowMs()-t0)<1200){ await sleep(40); }
    window.ttsPrimed=true; try{ window.dispatchEvent(new CustomEvent(ok?'tts:probe-ok':'tts:probe-fail')); }catch(_){ }
  }catch(_){ window.ttsPrimed=true; }
}
export async function playSceneSpeech(scene, State, Ctrl){
  const f=(window.__ttsFlags || { readTag:true, readTitleKey:true, readTitle:true, readNarr:true });
  const TTS_ENABLED=(typeof window.TTS_ENABLED==='boolean')?window.TTS_ENABLED:true;
  const muted=!TTS_ENABLED;

  if(!muted && f.readTag){
    const tags=Array.isArray(scene.sectionTags)?scene.sectionTags:[];
    const spoken=tags.slice(0,3).map(t=>String(t||'').trim().replace(/^#/,'').replace(/_/g,' ')).filter(Boolean).join('、');
    if(spoken) await speakOrWait(spoken, rateFor('tag'), 'tag', Ctrl);
  }
  if(!muted && f.readTitleKey && scene.title_key) await speakOrWait(scene.title_key, rateFor('titleKey'), 'titleKey', Ctrl);
  if(!muted && f.readTitle && scene.title)     await speakOrWait(scene.title,    rateFor('title'),    'title',    Ctrl);
  if(f.readNarr && scene.narr){ const narrSafe=await __getNarrForTTS(scene); await speakOrWait(narrSafe, rateFor('narr'), 'narr', Ctrl); }
}
export function listVoices(){ try{ return getVoicesSafe(); }catch(_){ return []; } }
export async function reloadVoices(){ try{ forceWarmVoices(); await voicesReady(2000); }catch(_){ } }

/* ===== Init ===== */
refreshJPVoice();
try{ window.speechSynthesis.addEventListener('voiceschanged', ()=>{ refreshJPVoice(); }); }catch(_){ }