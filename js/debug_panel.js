/*!
Project:  shorts-player-kit
File:     js/debug_panel.js (Step-1: inline-style-free, CSS-responsibility only)
Role:     Debug Panel UI（QuickBar=2段固定 / Stop ACK 可視化 / 展開パネルに状態チップ）
Depends:  window.__player / __ttsFlags / __ttsVoiceMap / __dbgConfig (optional)
Policy:
  - このファイルは UI の「構造と状態（data属性/クラス）」のみを制御する。
  - 見た目（色・余白・サイズ・レイアウト）は style.css が唯一の出所。
  - 禁止: element.style.* の直接指定、<style> ノード注入、動的 CSS テキスト生成。
  - 折り畳みは data-collapsed="true|false" で表現し、表示/レイアウトは CSS が決める。
*/
;(function() {
  'use strict';

  /* ====================== Config & Defaults ===================== */
  var CFG_IN   = (window.__dbgConfig || {});
  var VOICE_IN = (CFG_IN.voice || {});
  var SECTIONS = Object.assign(
    { status:true, note:false, controls:true, goto:true, ttsFlags:true, voices:true, baseRate:false },
    (CFG_IN.sections || {})
  );
  var BUTTONS  = Object.assign(
    { prev:true, next:true, play:false, stop:false, restart:true, goto:true, hardreload:true, hardstop:false },
    (CFG_IN.buttons || {})
  );
  var LOCKS    = Object.assign(
    { allowTTSFlagEdit:true, allowVoiceSelect:true },
    (CFG_IN.locks || {})
  );
  var FLAGS0   = (CFG_IN.ttsFlagsDefault || { readTag:true, readTitleKey:true, readTitle:true, readNarr:true });

  var QUICKBAR = Object.assign(
    { enabled:true, mode:'twoRows', items:{ play:true, stop:true, next:true, ack:true } },
    (CFG_IN.quickbar || {})
  );
  var BADGES        = (CFG_IN.badges && typeof CFG_IN.badges==='object') ? CFG_IN.badges : {};
  var BADGE_MOTION  = (BADGES.motion==='static' || BADGES.motion==='off') ? BADGES.motion : 'auto';

  /* =========================== Host ============================= */
  var host = document.getElementById('debug-panel');
  if (!host) {
    host = document.createElement('div');
    host.id = 'debug-panel';
    document.body.appendChild(host);
  }
  host.setAttribute('data-ready','true');

  /* =========== Panel height → CSS var（rAF合流・一本化） =========== */
  (function initInsetSync(){
    var de = document.documentElement;
    var rafId = 0, dirty = true; var ro = null;
    function measureAndApply(){
      rafId = 0; dirty = false;
      try{
        var h = host ? Math.max(0, Math.ceil(host.getBoundingClientRect().height)) : 0;
        de.style.setProperty('--debug-panel-h', h + 'px');
      }catch(_){}
    }
    function schedule(){ if(dirty) return; dirty = true; if(!rafId) rafId = requestAnimationFrame(measureAndApply); }
    schedule(); requestAnimationFrame(schedule);
    try{ ro = new ResizeObserver(schedule); ro.observe(host); }catch(_){}
    var vv = window.visualViewport;
    if(vv){ vv.addEventListener('resize', schedule); vv.addEventListener('scroll', schedule); }
    window.addEventListener('resize', schedule, {passive:true});
    window.addEventListener('orientationchange', function(){ setTimeout(schedule, 50); }, {passive:true});
  })();

  /* =========================== Markup =========================== */
  host.innerHTML =
    '<div class="qb-bar">' +
      '<div class="qb-row row1">' +
        '<button id="dbg-toggle" class="dbg-toggle" title="展開/折り畳み">🐞 Debug <span id="dbg-arrow"></span></button>' +
        (QUICKBAR.items.play ? '<button data-act="play" class="qb-btn play" aria-label="Play">▶︎</button>' : '') +
        (QUICKBAR.items.stop ? '<button data-act="stop" class="qb-btn stop" aria-label="Stop">■</button>' : '') +
        (QUICKBAR.items.next ? '<button data-act="next" class="qb-btn next" aria-label="Next">➡︎</button>' : '') +
        (QUICKBAR.items.ack  ? '<span id="qb-ack" class="qb-ack is-idle" role="status" aria-live="polite" aria-atomic="true"><span class="qb-dot" aria-hidden="true"></span> Idle</span>' : '') +
      '</div>' +
      '<div class="qb-row row2"><span id="dbg-status" class="dbg-status">Ready.</span></div>' +
    '</div>' +
    '<div id="dbg-body" class="dbg-body">' +
      '<div id="dbg-statechips" class="lab-badges" aria-hidden="false"></div>' +
      '<div id="dbg-controls" class="dbg-controls">' +
        (BUTTONS.prev       ? '<button data-act="prev">⟵ Prev</button>' : '') +
        (BUTTONS.next       ? '<button data-act="next">Next ⟶</button>' : '') +
        (BUTTONS.restart    ? '<button data-act="restart">↻ Restart</button>' : '') +
        (BUTTONS.goto       ? '<label class="goto"><span>Goto:</span><input id="dbg-goto" type="number" min="1" step="1" inputmode="numeric" placeholder="page#"><button data-act="goto">Go</button></label>' : '') +
        (BUTTONS.hardreload ? '<button data-act="hardreload" class="warn">⟲ Hard Reload</button>' : '') +
        (BUTTONS.hardstop   ? '<button data-act="hardstop" class="warn">⛔ Hard Stop</button>' : '') +
      '</div>' +
      (SECTIONS.ttsFlags ? '<div id="dbg-flags" class="sec"></div>' : '') +
      (SECTIONS.voices   ? '<div id="dbg-voices" class="sec"></div>' : '') +
    '</div>';

  function $(s){ return host.querySelector(s); }
  var tgl      = $('#dbg-toggle');
  var arrow    = $('#dbg-arrow');
  var statusEl = $('#dbg-status');
  var gotoInp  = $('#dbg-goto');
  var ackEl    = $('#qb-ack');
  var chipsEl  = $('#dbg-statechips');
  var badgeEls = {}; // speaking / paused / pending を保持

  /* ================== Swipe to Toggle Panel =================== */
  (function initSwipeToToggle(){
    var swipeTarget = $('.qb-bar'); if(!swipeTarget || !tgl) return;
    var touchStartY=0, touchCurrentY=0, isSwiping=false, swipeThreshold=40;
    swipeTarget.addEventListener('touchstart', function(e){ if(e.touches.length>1) return; isSwiping=true; touchStartY=touchCurrentY=e.touches[0].clientY; }, {passive:true});
    swipeTarget.addEventListener('touchmove',  function(e){ if(!isSwiping) return; touchCurrentY=e.touches[0].clientY; }, {passive:true});
    swipeTarget.addEventListener('touchend',   function(){ if(!isSwiping) return; isSwiping=false;
      var dy = touchCurrentY - touchStartY; var collapsed = (host.getAttribute('data-collapsed')==='true');
      if(dy < -swipeThreshold && collapsed) tgl.click();
      else if(dy > swipeThreshold && !collapsed) tgl.click();
    }, {passive:true});
  })();

  /* ============== lightweight logger for telemetry ============== */
  var __dbgLogStore = [];
  function pushLog(msg){
    var line = String(msg==null?'':msg);
    try{ var ts = new Date().toLocaleTimeString(); line = '['+ts+'] '+line; }catch(_){}
    __dbgLogStore.push(line); if(__dbgLogStore.length>200) __dbgLogStore.shift();
    try{ if(statusEl) statusEl.textContent = line; }catch(_){}
    try{ console.log('%c[debug-panel]','color:#6cf', line); }catch(_){}
  }

  /* =================== Badges (efficient toggle) ================= */
  function renderLabBadges(ss){
    if(!chipsEl) return;
    if(!badgeEls.speaking){
      chipsEl.innerHTML = '';
      var pulse = (BADGE_MOTION==='off') ? '' : 'pulse';
      ['speaking','paused','pending'].forEach(function(name){
        var b = document.createElement('span');
        b.className = 'lab-badge lab-badge--'+name+' '+pulse;
        b.textContent = name;
        chipsEl.appendChild(b);
        badgeEls[name]=b;
      });
    }
    badgeEls.speaking.classList.toggle('on', ss && ss.speaking);
    badgeEls.paused .classList.toggle('on', ss && ss.paused);
    badgeEls.pending.classList.toggle('on', ss && ss.pending);
  }

  /* ======================= Collapsed State ====================== */
  function setCollapsedState(shouldCollapse){
    var key = 'dbg.panel.collapsed.v3';
    host.setAttribute('data-collapsed', shouldCollapse?'true':'false');
    host.classList.toggle('collapsed', !!shouldCollapse);
    if(arrow) arrow.textContent = shouldCollapse ? '▸' : '▾';
    try{ localStorage.setItem(key, String(shouldCollapse)); }catch(_){}
  }
  (function initUI(){
    var key='dbg.panel.collapsed.v3';
    var isCollapsedOnLoad=(function(){ try{ var s=localStorage.getItem(key); if(s!=null) return (s==='true'); }catch(_){}
      return !!CFG_IN.collapsedDefault; })();
    setCollapsedState(isCollapsedOnLoad);
    if(tgl) tgl.addEventListener('click', function(){ var cur = (host.getAttribute('data-collapsed')==='true'); setCollapsedState(!cur); });
    window.addEventListener('player:activated', function(){ setCollapsedState(true); }, {once:true});
  })();

  /* ============================ Flags =========================== */
  var FLAGS = (window.__ttsFlags = window.__ttsFlags || Object.assign({}, FLAGS0));
  var FLAGS_KEY = 'dbg.tts.flags.v5';

  function h(tag, cls, txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=String(txt); return e; }

  function setFlag(name, val){
    FLAGS[name] = !!val;
    try{ localStorage.setItem(FLAGS_KEY, JSON.stringify(FLAGS)); }catch(_){}
    try{ window.dispatchEvent(new CustomEvent('debug:flags-changed', {detail:Object.assign({}, FLAGS)})); }catch(_){}
  }

/* ===== REPLACE: renderFlags (new horizontal chip buttons) ===== */
function renderFlags(){
  if(!SECTIONS.ttsFlags) return;
  var box = $('#dbg-flags'); if(!box) return;

  box.innerHTML = '';
  box.appendChild(h('h3', null, 'TTS Flags'));

  // 横並びチップ用の行（CSS: #dbg-flags .flag-row / .flag に依存）
  var row = h('div', 'flag-row');
  box.appendChild(row);

  var ITEMS = [
    ['readTag',      'タグ'],
    ['readTitleKey', '題名キー'],
    ['readTitle',    '題名'],
    ['readNarr',     '本文']
  ];

  // 既存保存の取り込み（UI生成前に FLAGS を確定）
  try{
    var saved = localStorage.getItem(FLAGS_KEY);
    if(saved){
      var o = JSON.parse(saved);
      if(o && typeof o === 'object') Object.assign(FLAGS, o);
    }
  }catch(_){}

  ITEMS.forEach(function(pair){
    var k = pair[0], label = pair[1];

    var btn = h('button', 'flag', label);
    btn.type = 'button';
    btn.dataset.flag = k;
    btn.setAttribute('role', 'switch');

    function sync(){
      var on = !!FLAGS[k];
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      // 表示ラベルは固定（日本語ラベル）。必要ならここで切替も可
    }

    btn.addEventListener('click', function(){
      setFlag(k, !FLAGS[k]);
      sync();
    });

    btn.addEventListener('keydown', function(ev){
      if(ev.key === 'Enter' || ev.key === ' '){
        ev.preventDefault();
        setFlag(k, !FLAGS[k]);
        sync();
      }
    });

    sync();
    row.appendChild(btn);
  });
}
/* ===== END REPLACE ===== */

/* 再描画呼び出し（既に呼んでいる場合は二重呼び出し不要） */
renderFlags();

  /* ============================ Voices ========================== */
  var VOICE_FILTER = { jaOnly: (VOICE_IN.filter && typeof VOICE_IN.filter.jaOnly==='boolean') ? !!VOICE_IN.filter.jaOnly : true };

  function voicesCatalog(){
    try{
      var arr = (window.__ttsUtils && __ttsUtils.getCatalog && __ttsUtils.getCatalog({ jaOnly: !!VOICE_FILTER.jaOnly })) || [];
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }
  function currentVoiceId(role){
    var vm = (window.__ttsVoiceMap = window.__ttsVoiceMap || {});
    var cur = vm[role] || '';
    if(cur && typeof cur==='object'){ return cur.id || cur.voiceURI || (((cur.lang||'')+'|'+(cur.name||'')) || ''); }
    return cur || '';
  }
  function renderVoices(){
    if(!SECTIONS.voices) return;
    var box = $('#dbg-voices'); if(!box) return;
    box.innerHTML='';
    var heading = h('h3', null, 'Voices ');
    box.appendChild(heading);
    var roles = ['tag','titleKey','title','narr'];
    var list  = voicesCatalog();
    roles.forEach(function(role){
      var line = h('div', 'dbg-row'); line.appendChild(h('span','dbg-row-label', role));
      var sel = h('select');
      sel.appendChild(new Option('Auto',''));
      list.forEach(function(v){
        var id = v.id || v.voiceURI || ((v.lang||'')+'|'+(v.name||''));
        sel.appendChild(new Option((v.label||v.name||id)+' ['+(v.lang||'-')+']', id));
      });
      sel.value = currentVoiceId(role);
      sel.onchange = function(){
        var id = sel.value; var vm = (window.__ttsVoiceMap = window.__ttsVoiceMap || {});
        if(!id) delete vm[role]; else vm[role]=id;
        try{ localStorage.setItem('dbg.voice.'+role, id); }catch(_){}
      };
      box.appendChild(line); line.appendChild(sel);
    });
    var cnt = list.length; var note = h('span','voices-note','['+cnt+' voices]'); heading.appendChild(note);
  }
  renderVoices();
  try{
    if('speechSynthesis' in window){
      window.speechSynthesis.addEventListener('voiceschanged', function(){ setTimeout(renderVoices, 0); }, {passive:true});
    }
  }catch(_){}

  /* ============================ Stop ACK ======================== */
  var stopAck = { pending:false, confirmed:false, ts:0, latencyMs:0, context:'' };
  var ackTimer = 0;
  function setAckIdle(){ if(!ackEl) return; ackEl.className='qb-ack is-idle';    ackEl.innerHTML='<span class="qb-dot" aria-hidden="true"></span> Idle'; }
  function setAckPending(){ if(!ackEl) return; ackEl.className='qb-ack is-pending'; ackEl.innerHTML='<span class="qb-dot" aria-hidden="true"></span> Stopping…'; }
  function setAckStopped(){ if(!ackEl) return; ackEl.className='qb-ack is-stopped'; ackEl.innerHTML='<span class="qb-dot" aria-hidden="true"></span> Stopped '+(stopAck.latencyMs|0)+'ms'; clearTimeout(ackTimer); ackTimer=setTimeout(setAckIdle,1600); }
  setAckIdle();
  window.addEventListener('player:stop-ack',     function(ev){ stopAck.pending=true;  stopAck.confirmed=false; stopAck.ts = (ev&&ev.detail&&ev.detail.ts)? ev.detail.ts : Date.now(); setAckPending(); });
  window.addEventListener('player:stop-confirm', function(ev){ stopAck.pending=false; stopAck.confirmed=true; stopAck.latencyMs=(ev&&ev.detail&&ev.detail.latencyMs)|0; stopAck.context=(ev&&ev.detail&&ev.detail.context)||''; setAckStopped(); });

  /* ====================== TTS chunk telemetry ==================== */
  var lastChunkNote = '';
  window.addEventListener('player:tts-chunk', function(ev){
    var d = ev && ev.detail || {};
    var tag = (d.phase||'')+' '+(d.index||0)+'/'+(d.total||0); if(d.ms!=null) tag += ' '+(d.ms|0)+'ms';
    lastChunkNote = '[chunk '+tag+']';
    pushLog('tts:'+lastChunkNote+' len='+((d.len|0)) + (d.reason?(' '+d.reason):''));
  }, {passive:true});
  window.addEventListener('player:tts-quiet', function(ev){
    var d = ev && ev.detail || {};
    pushLog('quiet: '+(d.passed?'ok':'skip')+' '+(d.quietMs|0)+'ms @'+(d.index||0)+'/'+(d.total||0));
  }, {passive:true});

  /* ============================ Actions ========================= */
  host.addEventListener('click', function(e){
    var t = e.target;
    while(t && t!==host && !(t.tagName==='BUTTON' && t.hasAttribute('data-act'))) t = t.parentNode;
    if(!t || t===host) return;
    var act = t.getAttribute('data-act') || '';
    var P = (window.__player || window.__playerCore || {});
    switch(act){
      case 'prev':     if(P.prev) P.prev(); break;
      case 'play':     try{ speechSynthesis.cancel(); }catch(_){} if(P.play) P.play(); break;
      case 'stop':     try{ if('speechSynthesis' in window) speechSynthesis.cancel(); }catch(_){} try{ if(P.stopHard) P.stopHard(); else if(P.stop) P.stop(); }catch(_){} break;
      case 'next':     if(P.next) P.next(); break;
      case 'restart':  if(P.restart) P.restart(); break;
      case 'goto':     if(P.goto && gotoInp){ var n=(Number(gotoInp.value)|0); if(n>=1) P.goto(n-1); } break;
      case 'hardreload':
        try{ if(P.stopHard) P.stopHard(); }catch(_){}
        try{
          if('caches' in window){
            caches.keys().then(function(xs){ return Promise.all(xs.map(function(k){ return caches.delete(k); })); })
              .finally(function(){ var u=new URL(location.href); u.searchParams.set('rev', String(Date.now())); location.replace(String(u)); });
          }else{ var u2=new URL(location.href); u2.searchParams.set('rev', String(Date.now())); location.replace(String(u2)); }
        }catch(_){ location.reload(); }
        break;
      case 'hardstop': try{ if(P.stopHard) P.stopHard(); }catch(_){} break;
    }
  });

  if(gotoInp){
    gotoInp.addEventListener('keydown', function(ev){
      if(ev.key==='Enter'){
        var P = (window.__player || window.__playerCore || {});
        var n = (Number(gotoInp.value)|0); if(P.goto && n>=1) P.goto(n-1);
      }
    });
  }

  /* ====================== Event-driven Status =================== */
  window.addEventListener('player:tts-state', function(ev){
    try{ renderLabBadges((ev && ev.detail) || {}); }catch(_){}
  });
  window.addEventListener('player:status', function(ev){
    try{
      if(!statusEl) return;
      var d = (ev && ev.detail) || {};
      var idx=(d.index|0)||0, total=(d.total|0)||0;
      var current = 'Page '+(idx+1)+'/'+total + (d.playing?' | ▶︎ playing':' | ■ idle');
      if(!statusEl.textContent.startsWith('[')) statusEl.textContent = current;
    }catch(_){}
  });

  /* ========================= Fallback Loop ====================== */
  var lastIdx=-1, lastTotal=-1;
  (function loop(){
    var P = window.__player || null; if(!P || !P.info){ requestAnimationFrame(loop); return; }
    var info = P.info(), scene=(P.getScene && P.getScene()) || null;
    var ss = (window.speechSynthesis || {});
    renderLabBadges(ss);
    if(gotoInp && (info.index!==lastIdx || info.total!==lastTotal)){
      gotoInp.placeholder = (info.total>0) ? ((info.index+1)+' / '+info.total) : 'page#';
      lastIdx = info.index; lastTotal = info.total;
    }
    requestAnimationFrame(loop);
  })();
})();
