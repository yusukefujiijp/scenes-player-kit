/*!
  Project:  scenes-player-kit-exporter
  File:     js/debug-panel/index.js
  Role:     Debug Panel UI（QuickBar=2段固定 / Stop ACK 可視化 / 展開パネルに状態チップ）
  Depends:  window.__player / __playerCore / window.__dbgUtils (addEvt/removeEvt) / window.__dbgState(任意) / __ttsFlags / __ttsVoiceMap / __dbgConfig (optional)
  Notes:
    - 冪等化（再初期化ガード）、destroy API、addEvt remover でクリーンアップ可。
    - localStorage 直叩きを撤廃し、存在すれば __dbgState 経由へ移行（後方互換でフォールバック）。
    - ARIA改善：トグル時に aria-expanded/aria-hidden を同期。
*/
;(function(global){
  'use strict';

  // ---------- helpers: ensure addEvt/removeEvt existence ----------
  var addEvt = (global && global.__dbgUtils && typeof global.__dbgUtils.addEvt === 'function') ? global.__dbgUtils.addEvt : null;
  var removeEvt = (global && global.__dbgUtils && typeof global.__dbgUtils.removeEvt === 'function') ? global.__dbgUtils.removeEvt : null;

  // minimal internal fallback for addEvt/removeEvt that returns remover
  if(!addEvt){
    addEvt = function(target, type, handler, opts){
      if(!target || !type || typeof handler !== 'function') return function(){};
      try{ target.addEventListener(type, handler, opts); }
      catch(_){ try{ target.addEventListener(type, handler, !!(opts && opts.capture)); }catch(_){ return function(){}; } }
      var removed = false;
      return function remove(){
        if(removed) return;
        try{ target.removeEventListener(type, handler, opts); }catch(_){
          try{ target.removeEventListener(type, handler); }catch(_){}
        }
        removed = true;
      };
    };
  }
  if(!removeEvt){
    removeEvt = function(target, type, handler, opts){
      try{ target.removeEventListener(type, handler, opts); }catch(_){
        try{ target.removeEventListener(type, handler); }catch(_){}
      }
    };
  }

  // expose to global namespace if not present (compat)
  try{
    if(typeof global !== 'undefined'){
      global.__dbgUtils = global.__dbgUtils || {};
      if(typeof global.__dbgUtils.addEvt !== 'function') global.__dbgUtils.addEvt = addEvt;
      if(typeof global.__dbgUtils.removeEvt !== 'function') global.__dbgUtils.removeEvt = removeEvt;
      if(typeof global.addEvt !== 'function') global.addEvt = addEvt;
    }
  }catch(_){}

  // ---------- optional state layer ----------
  var ST = global.__dbgState || null; // state.js が読み込まれていれば利用

  /* ====================== Config & Defaults ===================== */
  var CFG_IN   = (global.__dbgConfig || {});
  var VOICE_IN = (CFG_IN.voice || {});
  var SECTIONS = Object.assign(
    { status:true, note:false, controls:true, goto:true, ttsFlags:true, voices:true, baseRate:false },
    (CFG_IN.sections || {})
  );
  var BUTTONS  = Object.assign(
    { prev:true, next:true, play:false, stop:false, restart:true, goto:true, hardreload:true, hardstop:false, download:true },
    (CFG_IN.buttons || {})
  );
  var LOCKS    = Object.assign(
    { allowTTSFlagEdit:true, allowVoiceSelect:true },
    (CFG_IN.locks || {})
  );
  var FLAGS0   = (CFG_IN.ttsFlagsDefault || { readTag:true, readTitleKey:true, readTitle:true, readNarr:true });

  var QB_DEFAULT_ITEMS = {
    play: true, stop: true, next: true, ack: true,
    restart: true,
    download: true,
    hardreload: true
  };
  var QB_CFG_ITEMS = (CFG_IN.quickbar && CFG_IN.quickbar.items) || {};
  var mergedItems = Object.assign({}, QB_DEFAULT_ITEMS, QB_CFG_ITEMS);
  var QB_DEFAULTS = { enabled: true, mode: 'twoRows' };
  var QUICKBAR = Object.assign({}, QB_DEFAULTS, (CFG_IN.quickbar || {}), { items: mergedItems } );

  var BADGES        = (CFG_IN.badges && typeof CFG_IN.badges==='object') ? CFG_IN.badges : {};
  var BADGE_MOTION  = (BADGES.motion==='static' || BADGES.motion==='off') ? BADGES.motion : 'auto';

  /* =========================== Host ============================= */
  var host = document.getElementById('debug-panel');
  if (!host) {
    host = document.createElement('div');
    host.id = 'debug-panel';
    document.body.appendChild(host);
  }

  // Idempotency guard: if already initialized, return existing API
  if(host && host.__dbgAPI){
    if(typeof global.debugPanelInit === 'function') return;
    global.debugPanelInit = function(){ return host.__dbgAPI; };
    return;
  }

  host.setAttribute('data-ready','true');

  /* ===== collect removers so destroy() can clean all up ===== */
  var _removers = [];
  function track(remover){
    if(typeof remover === 'function') _removers.push(remover);
    return remover;
  }

  /* =========================== Inset sync (rAF, RO) ============================= */
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
    try{
      ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(schedule) : null;
      if(ro){
        ro.observe(host);
        track(function(){ try{ ro.disconnect(); }catch(_){} });
      }
    }catch(_){}
    var vv = global.visualViewport;
    if(vv){ track(addEvt(vv,'resize', schedule, {passive:true})); track(addEvt(vv,'scroll', schedule, {passive:true})); }
    track(addEvt(global,'resize', schedule, {passive:true}));
    // cancel RAF on destroy
    track(function(){ try{ if(rafId) cancelAnimationFrame(rafId); }catch(_){ } });
  })();

  /* =========================== Markup =========================== */
  host.innerHTML =
    '<div class="qb-bar">' +
      '<div class="qb-row row1">' +
        '<button id="dbg-toggle" class="dbg-toggle" title="展開/折り畳み" aria-label="Debug panel" aria-expanded="false" aria-controls="dbg-body">🐞<span id="dbg-arrow"></span></button>' +
        (QUICKBAR.items.play ? '<button data-act="play" class="qb-btn play" aria-label="Play">▶︎</button>' : '') +
        (QUICKBAR.items.stop ? '<button data-act="stop" class="qb-btn stop" aria-label="Stop">■</button>' : '') +
        (QUICKBAR.items.next ? '<button data-act="next" class="qb-btn next" aria-label="Next">➡︎</button>' : '') +
        (QUICKBAR.items.restart    ? '<button data-act="restart" class="qb-btn restart" aria-label="Restart">↻</button>' : '') +
        (QUICKBAR.items.download   ? '<button data-act="export" class="qb-btn download" aria-label="Download">⬇︎</button>' : '') +
        (QUICKBAR.items.hardreload ? '<button data-act="hardreload" class="qb-btn hardreload" aria-label="Hard Reload">⟲</button>' : '') +
        (QUICKBAR.items.ack  ? '<span id="qb-ack" class="qb-ack is-idle" role="status" aria-live="polite" aria-atomic="true"><span class="qb-dot" aria-hidden="true"></span> Idle</span>' : '') +
      '</div>' +
      '<div class="qb-row row2"><span id="dbg-status" class="dbg-status">Ready.</span></div>' +
    '</div>' +
    '<div id="dbg-body" class="dbg-body" aria-hidden="true">' +
      '<div id="dbg-statechips" class="lab-badges" aria-hidden="false"></div>' +
      '<div id="dbg-controls" class="dbg-controls">' +
        (BUTTONS.prev       ? '<button data-act="prev">⟵ Prev</button>' : '') +
        (BUTTONS.next       ? '<button data-act="next">Next ⟶</button>' : '') +
        (BUTTONS.restart    ? '<button data-act="restart">↻ Restart</button>' : '') +
        (BUTTONS.download   ? '<button data-act="export" class="btn-download">⬇︎ Download</button>' : '') +
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
  var bodyEl   = $('#dbg-body');
  var statusEl = $('#dbg-status');
  var gotoInp  = $('#dbg-goto');
  var ackEl    = $('#qb-ack');
  var chipsEl  = $('#dbg-statechips');
  var badgeEls = {}; // speaking / paused / pending を保持

  /* ================== Swipe to Toggle Panel =================== */
  (function initSwipeToToggle(){
    var swipeTarget = $('.qb-bar'); if(!swipeTarget || !tgl) return;
    var touchStartY=0, touchCurrentY=0, isSwiping=false, swipeThreshold=40;
    track(addEvt(swipeTarget,'touchstart', function(e){ if(e.touches && e.touches.length>1) return; isSwiping=true; touchStartY=touchCurrentY=(e.touches && e.touches[0] && e.touches[0].clientY) || 0; }, {passive:true}));
    track(addEvt(swipeTarget,'touchmove',  function(e){ if(!isSwiping) return; touchCurrentY=(e.touches && e.touches[0] && e.touches[0].clientY) || touchCurrentY; }, {passive:true}));
    track(addEvt(swipeTarget,'touchend',   function(){ if(!isSwiping) return; isSwiping=false;
      var dy = touchCurrentY - touchStartY; var collapsed = (host.getAttribute('data-collapsed')==='true');
      if(dy < -swipeThreshold && collapsed) tgl && tgl.click();
      else if(dy > swipeThreshold && !collapsed) tgl && tgl.click();
    }, {passive:true}));
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
    var speaking = false, paused = false, pending = false;
    try{
      if (ss === true || ss === false) speaking = !!ss;
      else if (ss && typeof ss === 'object') {
        speaking = !!ss.speaking;
        paused   = !!ss.paused;
        pending  = !!ss.pending;
      } else if ('speechSynthesis' in global) {
        speaking = !!global.speechSynthesis.speaking;
      }
    }catch(_){}
    badgeEls.speaking && badgeEls.speaking.classList.toggle('on', speaking);
    badgeEls.paused  && badgeEls.paused.classList.toggle('on', paused);
    badgeEls.pending && badgeEls.pending.classList.toggle('on', pending);
    // optional: state 反映
    try{ ST && ST.setBadges && ST.setBadges({speaking:speaking, paused:paused, pending:pending}); }catch(_){}
  }

  /* ======================= Collapsed State ====================== */
  function setCollapsedState(shouldCollapse){
    var b = !!shouldCollapse;
    host.setAttribute('data-collapsed', b ? 'true' : 'false');
    host.classList.toggle('collapsed', b);
    if(arrow) arrow.textContent = b ? '▸' : '▾';
    if(tgl)  try{ tgl.setAttribute('aria-expanded', String(!b)); }catch(_){}
    if(bodyEl) try{ bodyEl.setAttribute('aria-hidden', String(b)); }catch(_){}
    // persist via state（fallback: localStorage）
    try{
      if(ST && ST.setCollapsed) ST.setCollapsed(b);
      else { try{ localStorage.setItem('dbg.panel.collapsed.v3', String(b)); }catch(_){} }
    }catch(_){}
  }

  (function initUI(){
    var isCollapsedOnLoad = (function(){
      try{
        if(ST && ST.get) return !!ST.get().collapsed;
        var s = localStorage.getItem('dbg.panel.collapsed.v3');
        if(s!=null) return (s==='true');
      }catch(_){}
      return !!CFG_IN.collapsedDefault;
    })();
    setCollapsedState(isCollapsedOnLoad);
    if(tgl) track(addEvt(tgl,'click', function(){ var cur = (host.getAttribute('data-collapsed')==='true'); setCollapsedState(!cur); }));
    // once player activated, collapse to avoid covering UI
    var onPlayerActivated = function(){ setCollapsedState(true); };
    track(addEvt(global,'player:activated', onPlayerActivated, {capture:true}));
  })();

  /* ============ CLOSE on outside tap/click — Safe V2 ============ */
  (function initCloseOnOutsideTap_v2(){
    try{
      var CLOSE_ZONE = (function(){
        try{
          var sel = (CFG_IN && CFG_IN.closeZoneSelector) || '';
          if(sel){ var el = document.querySelector(sel); if(el) return el; }
        }catch(_){}
        return document.body || document.documentElement;
      })();

      function isCollapsed(){ return host && host.getAttribute('data-collapsed') === 'true'; }
      function isInPanel(node){ return !!(host && node && host.contains(node)); }

      function maybeClose(ev){
        try{
          if(isCollapsed()) return;
          var t = ev && ev.target; if(!t) return;
          if(!CLOSE_ZONE || !CLOSE_ZONE.contains(t)) return;
          if(isInPanel(t)) return;
          setCollapsedState(true);
        }catch(_){}
      }

      if('PointerEvent' in global){
        track(addEvt(global,   'pointerdown',  maybeClose, {capture:true, passive:true}));
      }else{
        track(addEvt(global,   'touchstart',   maybeClose, {capture:true, passive:true}));
        track(addEvt(global,   'mousedown',    maybeClose, {capture:true}));
      }
      track(addEvt(document,   'click',        maybeClose, {capture:true, passive:true}));
      track(addEvt(document,   'keydown', function(ev){
        if(ev && ev.key === 'Escape' && !isCollapsed()) setCollapsedState(true);
      }, {}));
    }catch(e){
      try{ console.warn('[debug-panel] close-on-outside disabled:', e); }catch(_){}
    }
  })();

  /* ============================ Flags =========================== */
  var FLAGS = (function(){
    if(ST && ST.get) return (global.__ttsFlags = ST.get().flags || Object.assign({}, FLAGS0));
    // fallback: LS→__ttsFlags
    var tmp = Object.assign({}, FLAGS0);
    try{
      var saved = localStorage.getItem('dbg.tts.flags.v5');
      if(saved){ var o = JSON.parse(saved); if(o && typeof o==='object') Object.assign(tmp, o); }
    }catch(_){}
    return (global.__ttsFlags = global.__ttsFlags || tmp);
  })();
  var FLAGS_KEY = 'dbg.tts.flags.v5';

  function h(tag, cls, txt){ var e=document.createElement(tag); if(cls) e.className=cls; if(txt!=null) e.textContent=String(txt); return e; }

  function setFlag(name, val){
    FLAGS[name] = !!val;
    try{
      if(ST && ST.updateFlags) ST.updateFlags({ [name]: !!val });
      else localStorage.setItem(FLAGS_KEY, JSON.stringify(FLAGS));
    }catch(_){}
    try{ global.dispatchEvent && global.dispatchEvent(new CustomEvent('debug:flags-changed', {detail:Object.assign({}, FLAGS)})); }catch(_){}
  }

  function renderFlags(){
    if(!SECTIONS.ttsFlags) return;
    var box = $('#dbg-flags'); if(!box) return;

    box.innerHTML = '';
    box.appendChild(h('h3', null, 'TTS Flags'));

    var row = h('div', 'flag-row');
    box.appendChild(row);

    var ITEMS = [
      ['readTag',      'タグ'],
      ['readTitleKey', '題名キー'],
      ['readTitle',    '題名'],
      ['readNarr',     '本文']
    ];

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
      }

      track(addEvt(btn,'click', function(){
        if(!LOCKS.allowTTSFlagEdit) return;
        setFlag(k, !FLAGS[k]);
        sync();
      }));
      track(addEvt(btn,'keydown', function(ev){
        if(ev.key === 'Enter' || ev.key === ' '){
          ev.preventDefault();
          if(!LOCKS.allowTTSFlagEdit) return;
          setFlag(k, !FLAGS[k]);
          sync();
        }
      }));

      sync();
      row.appendChild(btn);
    });
  }
  renderFlags();

  /* ============================ Voices ========================== */
  var VOICE_FILTER = { jaOnly: (VOICE_IN.filter && typeof VOICE_IN.filter.jaOnly==='boolean') ? !!VOICE_IN.filter.jaOnly : true };

  function voicesCatalog(){
    try{
      var arr = (global.__ttsUtils && __ttsUtils.getCatalog && __ttsUtils.getCatalog({ jaOnly: !!VOICE_FILTER.jaOnly })) || [];
      return Array.isArray(arr) ? arr : [];
    }catch(_){ return []; }
  }
  function currentVoiceId(role){
    // 優先度: state.voiceMap → __ttsVoiceMap → ''
    try{
      if(ST && ST.get && ST.get().voiceMap && ST.get().voiceMap[role]) return ST.get().voiceMap[role] || '';
    }catch(_){}
    var vm = (global.__ttsVoiceMap = global.__ttsVoiceMap || {});
    var cur = vm[role] || '';
    if(cur && typeof cur==='object'){ return cur.id || cur.voiceURI || (((cur.lang||'')+'|'+(cur.name||'')) || ''); }
    // fallback: LS
    try{
      var ls = localStorage.getItem('dbg.voice.'+role);
      if(ls) return ls;
    }catch(_){}
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
        if(!LOCKS.allowVoiceSelect) return;
        var id = sel.value;
        // persist: state or LS
        try{
          if(ST && ST.setVoice) ST.setVoice(role, id);
          else localStorage.setItem('dbg.voice.'+role, id);
        }catch(_){}
        // runtime map も更新（即時反映）
        var vm = (global.__ttsVoiceMap = global.__ttsVoiceMap || {});
        if(!id) delete vm[role]; else vm[role]=id;
      };
      box.appendChild(line); line.appendChild(sel);
    });
    var cnt = list.length; var note = h('span','voices-note','['+cnt+' voices]'); heading.appendChild(note);
  }
  renderVoices();
  try{
    if('speechSynthesis' in global){
      track(addEvt(global.speechSynthesis, 'voiceschanged', function(){ setTimeout(renderVoices, 0); }, {passive:true}));
    }
  }catch(_){}

  /* ============================ Stop ACK ======================== */
  var stopAck = { pending:false, confirmed:false, ts:0, latencyMs:0, context:'' };
  var ackTimer = 0;
  function setAckIdle(){ if(!ackEl) return; ackEl.className='qb-ack is-idle';    ackEl.innerHTML='<span class="qb-dot" aria-hidden="true"></span> Idle'; }
  function setAckPending(){ if(!ackEl) return; ackEl.className='qb-ack is-pending'; ackEl.innerHTML='<span class="qb-dot" aria-hidden="true"></span> Stopping…'; }
  function setAckStopped(){ if(!ackEl) return; ackEl.className='qb-ack is-stopped'; ackEl.innerHTML='<span class="qb-dot" aria-hidden="true"></span> Stopped '+(stopAck.latencyMs|0)+'ms'; clearTimeout(ackTimer); ackTimer=setTimeout(setAckIdle,1600); }
  setAckIdle();
  track(addEvt(global,'player:stop-ack',     function(ev){ stopAck.pending=true;  stopAck.confirmed=false; stopAck.ts = (ev&&ev.detail&&ev.detail.ts)? ev.detail.ts : Date.now(); setAckPending(); }, {capture:true}));
  track(addEvt(global,'player:stop-confirm', function(ev){ stopAck.pending=false; stopAck.confirmed=true; stopAck.latencyMs=(ev&&ev.detail&&ev.detail.latencyMs)|0; stopAck.context=(ev&&ev.detail&&ev.detail.context)||''; setAckStopped(); }, {capture:true}));

  /* ====================== TTS chunk telemetry ==================== */
  var lastChunkNote = '';
  track(addEvt(global,'player:tts-chunk', function(ev){
    var d = ev && ev.detail || {};
    var tag = (d.phase||'')+' '+(d.index||0)+'/'+(d.total||0); if(d.ms!=null) tag += ' '+(d.ms|0)+'ms';
    lastChunkNote = '[chunk '+tag+']';
    pushLog('tts:'+lastChunkNote+' len='+((d.len|0)) + (d.reason?(' '+d.reason):''));
  }, {passive:true}));
  track(addEvt(global,'player:tts-quiet', function(ev){
    var d = ev && ev.detail || {};
    pushLog('quiet: '+(d.passed?'ok':'skip')+' '+(d.quietMs|0)+'ms @'+(d.index||0)+'/'+(d.total||0));
  }, {passive:true}));

  /* ============================ Actions ========================= */
  function withPlayer(){ return (global.__player || global.__playerCore || {}); }

  async function doExportFlow(){
    var qbBtn = host.querySelector('.qb-bar .qb-btn.download');
    var bodyExportBtn = host.querySelector('.dbg-controls button[data-act="export"]');
    try{
      if(qbBtn) qbBtn.classList.add('is-exporting');
      if(bodyExportBtn) bodyExportBtn.classList.add('is-exporting');
      try { document && document.body && document.body.classList.add('exporting'); } catch(_){}

      var P = withPlayer();
      var scenes = [];
      try {
        if(P && typeof P.getScenes === 'function'){
          scenes = P.getScenes() || [];
        } else if(P && typeof P.getScene === 'function' && typeof P.info === 'function'){
          var inf = P.info() || {};
          var total = (inf && inf.total) ? (inf.total|0) : 0;
          for(var i=0;i<total;i++){
            try{ var s = (typeof P.getScene === 'function') ? P.getScene(i) : null; if(s) scenes.push(s); }catch(_){}
          }
        }
      } catch(_){ scenes = scenes || []; }

      if(!scenes || !scenes.length){ try{ alert('No scenes to export'); }catch(_){}
        return; }

      var opts = { fps: 30, width: 720, height: 1280, perSceneMs: 2200 };
      try{
        var vmeta = (global.__playerCore && global.__playerCore.getVideoMeta) ? global.__playerCore.getVideoMeta() : (P.videoMeta||null);
        if(vmeta && vmeta.advancePolicy){
          if(typeof vmeta.advancePolicy.perSceneMs === 'number') opts.perSceneMs = Math.max(400, vmeta.advancePolicy.perSceneMs|0);
          if(typeof vmeta.advancePolicy.fps === 'number') opts.fps = Math.max(8, Math.min(60, vmeta.advancePolicy.fps|0));
        }
      }catch(_){}

      pushLog('export: start...');
      if(statusEl) statusEl.textContent = 'Exporting video...';

      var ensure = function(){ return new Promise(function(res, rej){
        if(global.__exporter && typeof global.__exporter.downloadScenesVideo==='function') return res();
        var s = document.createElement('script');
        s.src = './js/exporter.js';
        s.onload = function(){ res(); };
        s.onerror = function(){ rej(new Error('Failed to load exporter.js')); };
        document.head.appendChild(s);
      });};

      await ensure();
      await global.__exporter.downloadScenesVideo({ scenes: scenes, opts: opts });
      pushLog('export: done.');
    }catch(err){
      try{ console.error('[debug-panel] export error', err); }catch(_){}
      try{ alert('Export failed: ' + (err && (err.message || err.name) || err)); }catch(_){}
    }finally{
      try{ if(qbBtn) qbBtn.classList.remove('is-exporting'); }catch(_){}
      try{ if(bodyExportBtn) bodyExportBtn.classList.remove('is-exporting'); }catch(_){}
      try{ document && document.body && document.body.classList.remove('exporting'); } catch(_){}
      if(statusEl) statusEl.textContent = 'Ready.';
    }
  }

  // delegate button clicks (use addEvt for remover tracking)
  track(addEvt(host,'click', function(e){
    var t = e.target;
    while(t && t!==host && !(t.tagName==='BUTTON' && t.hasAttribute('data-act'))) t = t.parentNode;
    if(!t || t===host) return;
    var act = t.getAttribute('data-act') || '';
    var P = withPlayer();
    switch(act){
      case 'export':
        doExportFlow();
        break;
      case 'prev':     if(P.prev) P.prev(); break;
      case 'play':     try{ if('speechSynthesis' in global) global.speechSynthesis.cancel(); }catch(_){} if(P.play) P.play(); break;
      case 'stop':     try{ if('speechSynthesis' in global) global.speechSynthesis.cancel(); }catch(_){} try{ if(P.stopHard) P.stopHard(); else if(P.stop) P.stop(); }catch(_){} break;
      case 'next':     if(P.next) P.next(); break;
      case 'restart':  if(P.restart) P.restart(); break;
      case 'goto':     if(P.goto && gotoInp){ var n=(Number(gotoInp.value)|0); if(n>=1) P.goto(n-1); } break;
      case 'hardreload':
        try{ if(P.stopHard) P.stopHard(); }catch(_){}
        try{
          if('caches' in global){
            caches.keys().then(function(xs){ return Promise.all(xs.map(function(k){ return caches.delete(k); })); })
              .finally(function(){ var u=new URL(location.href); u.searchParams.set('rev', String(Date.now())); location.replace(String(u)); });
          }else{ var u2=new URL(location.href); u2.searchParams.set('rev', String(Date.now())); location.replace(String(u2)); }
        }catch(_){ location.reload(); }
        break;
      case 'hardstop': try{ if(P.stopHard) P.stopHard(); }catch(_){ } break;
    }
  }));

  if(gotoInp){
    track(addEvt(gotoInp,'keydown', function(ev){
      if(ev.key==='Enter'){
        var P = withPlayer();
        var n = (Number(gotoInp.value)|0); if(P.goto && n>=1) P.goto(n-1);
      }
    }));
  }

  /* ====================== Event-driven Status =================== */
  track(addEvt(global,'player:tts-state', function(ev){ try{ renderLabBadges((ev && ev.detail) || {}); }catch(_){} }, {passive:true}));
  track(addEvt(global,'player:status', function(ev){
    try{
      if(!statusEl) return;
      var d = (ev && ev.detail) || {};
      var idx=(d.index|0)||0, total=(d.total|0)||0;
      var current = 'Page '+(idx+1)+'/'+total + (d.playing?' | ▶︎ playing':' | ■ idle');
      if(!statusEl.textContent.startsWith('[')) statusEl.textContent = current;
      // optional: state 反映
      try{ ST && ST.setStatus && ST.setStatus({ index:idx, total:total, playing:!!d.playing }); }catch(_){}
    }catch(_){}
  }, {passive:true}));

  /* ========================= Fallback Loop ====================== */
  var lastIdx=-1, lastTotal=-1;
  var loopRaf = 0;
  (function loop(){
    try{
      var P = withPlayer();
      var info = (P && P.info) ? P.info() : null;
      var ss = (global.speechSynthesis || {});
      renderLabBadges(ss);
      if(gotoInp && info && (info.index!==lastIdx || info.total!==lastTotal)){
        gotoInp.placeholder = (info.total>0) ? ((info.index+1)+' / '+info.total) : 'page#';
        lastIdx = info.index; lastTotal = info.total;
      }
    }catch(_){}
    loopRaf = requestAnimationFrame(loop);
  })();
  track(function(){ try{ if(loopRaf) cancelAnimationFrame(loopRaf); }catch(_){} });

  pushLog('debug_panel: ready.');

  /* ==================== public API: open/close/toggle/destroy ================== */
  var _api = {
    setCollapsed: setCollapsedState,
    open: function(){ setCollapsedState(false); },
    close: function(){ setCollapsedState(true); },
    toggle: function(){ setCollapsedState(!(host.getAttribute('data-collapsed')==='true')); },
    destroy: function(){
      try{
        for(var i=0;i<_removers.length;i++){
          try{ var r = _removers[i]; if(typeof r === 'function') r(); }catch(_){}
        }
        _removers = [];
        try{ host && host.parentNode && host.parentNode.removeChild && host.parentNode.removeChild(host); }catch(_){}
        try{ if(global.__debugPanel === _api) delete global.__debugPanel; }catch(_){}
        try{ if(host) host.__dbgAPI = null; }catch(_){}
      }catch(e){
        try{ console.warn('[debug-panel] destroy failed', e); }catch(_){}
      }
      pushLog('debug_panel: destroyed.');
    }
  };

  // expose API
  try{ global.debugPanelInit = function(){ return _api; }; }catch(_){}
  try{ global.__debugPanel = global.__debugPanel || _api; }catch(_){}
  try{ host.__dbgAPI = _api; }catch(_){}

})(typeof window !== 'undefined' ? window : this);