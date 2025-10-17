/*!
Project:  shorts-player-kit
File:     js/tts-voice-utils.js
Role:     Voice catalog & chooser for TTS + role-based rates (perRoleAbs/default)
Depends:  window.speechSynthesis (optional)
Public API (global __ttsUtils):
  - setup(metaTTS?:object)
  - getCatalog(opts?:{jaOnly?:boolean}): Array<{id,label,name,lang,voiceURI}>  // ← 今は常に「全件」返す
  - pick(role:string): {id:string,label?:string}|null
  - setMode(mode:'perRoleAbs'|'base+multiplier')
  - getMode(): string
  - setRate(base:number)         // base rate (used only in base+multiplier)
  - getRate(): number
  - setRateRole(map: {tag,titleKey,title,narr}) // perRoleAbs: absolute(0.5..2.0)
  - getRateRole(): {tag,titleKey,title,narr}
  - getRateForRole(base:number, role:string): number
Notes:
  - “安定 id” 規約: voiceURI > (lang|name) > name
  - Safari対策：voiceschanged + 段階ポーリングで確実にカタログ更新
  - デバッグ方針：まず全言語を UI に出す（jaOnly 等のフィルタは一旦無視）
*/

;(function(){
  'use strict';

  /* ============================ env/guards ============================ */
  var HAS_SS = (typeof window !== 'undefined') && ('speechSynthesis' in window);
  var synth  = HAS_SS ? window.speechSynthesis : null;

  /* ============================ clamp/range ============================ */
  var CLAMP = { absMin:0.5, absMax:2.0, step:0.05 };
  function clampAbs(v){
    v = Number(v); if (!isFinite(v)) return 1.4;
    return Math.min(CLAMP.absMax, Math.max(CLAMP.absMin, v));
  }

  /* ============================ state ============================ */
  var state = {
    meta: {
      lang: 'ja-JP',
      voicePreferences: [],
      rate: 1.2,      // base（base+multiplier時のみ実効）
      fixes: {},
      roleVoiceHints: { tag:[], titleKey:[], title:[], narr:[] },
      voiceAlias: {},
      // ← ここは保持だけ（現在は getCatalog 側でフィルタ無効化）
      filter: { jaOnly: false, strictLang: false }
    },
    catalog: [],
    byId: Object.create(null),
    lastRefreshed: 0,
    // rate model
    rateMode: 'perRoleAbs',                        // 'perRoleAbs' | 'base+multiplier'
    base: 1.2,
    roleAbs: { tag:1.4, titleKey:1.4, title:1.4, narr:1.4 }, // 0.5..2.0
    roleMul: { tag:1.0, titleKey:1.0, title:1.0, narr:1.0 }, // base+multiplier 用
    // warmup/polling
    pollTimer: null,
    pollIndex: 0,
    pollPlanMs: [0, 50, 120, 250, 500, 1000, 1500, 2200, 3200] // Safari 起床ハック
  };

  /* ============================ id/label helpers ============================ */
  function makeStableId(v){
    if (v && v.voiceURI) return String(v.voiceURI);
    var lang = (v && v.lang) ? String(v.lang) : '';
    var name = (v && v.name) ? String(v.name) : '';
    if (lang || name) return (lang + '|' + name);
    return name || '';
  }
  function buildLabel(v){
    var name = v.name || 'Voice';
    return v.lang ? (name + ' (' + v.lang + ')') : name;
  }

  /* ============================ catalog build ============================ */
  function refreshCatalog(){
    state.catalog = [];
    state.byId = Object.create(null);
    if (!HAS_SS) return 0;
    var arr = synth.getVoices ? (synth.getVoices() || []) : [];
    for (var i=0;i<arr.length;i++){
      var v = arr[i] || {};
      var id = makeStableId(v);
      if (!id || state.byId[id]) continue;
      var item = {
        id:id, name:v.name||'', lang:v.lang||'', voiceURI:v.voiceURI||'',
        localService: !!v.localService, default: !!v.default,
        label: buildLabel(v)
      };
      state.catalog.push(item);
      state.byId[id] = item;
    }
    state.lastRefreshed = Date.now();
    return state.catalog.length;
  }

  function dispatchReady(){
    try { window.dispatchEvent(new Event('ttsvoicesready')); }
    catch(_){
      try {
        var ev = document.createEvent('Event');
        ev.initEvent('ttsvoicesready', false, false);
        window.dispatchEvent(ev);
      } catch(__){}
    }
  }

  /* ============================ alias/hints ============================ */
  function resolveAlias(name){
    var a = state.meta.voiceAlias || {};
    return a[name] || name;
  }
  function hintToIdCandidates(hint){
    if (!hint) return [];
    var expanded = resolveAlias(hint);
    var list = Array.isArray(expanded) ? expanded : [expanded];
    var out = [], i, token, k, it, it2, it3;
    for (i=0;i<list.length;i++){
      token = String(list[i]);
      if (state.byId[token]) { out.push(token); continue; }
      for (k=0;k<state.catalog.length;k++){
        it = state.catalog[k]; if (it.name === token){ out.push(it.id); break; }
      }
      for (k=0;k<state.catalog.length;k++){
        it2 = state.catalog[k]; if ((it2.lang+'|'+it2.name)===token){ out.push(it2.id); break; }
      }
      for (k=0;k<state.catalog.length;k++){
        it3 = state.catalog[k];
        if ((it3.name||'').toLowerCase().indexOf(token.toLowerCase())>=0){ out.push(it3.id); break; }
      }
    }
    var uniq = Object.create(null), res=[];
    for (i=0;i<out.length;i++){ var id = out[i]; if (!id || uniq[id]) continue; uniq[id]=1; res.push(id); }
    return res;
  }
  function precomputeRoleHints(){
    var hv = state.meta.roleVoiceHints || {};
    ['tag','titleKey','title','narr'].forEach(function(r){
      var arr = hv[r] || [], out=[];
      for (var k=0;k<arr.length;k++){
        var ids = hintToIdCandidates(arr[k]);
        for (var j=0;j<ids.length;j++) out.push(ids[j]);
      }
      var seen = Object.create(null), uniq=[];
      for (var x=0;x<out.length;x++){ var id = out[x]; if (seen[id]) continue; seen[id]=1; uniq.push(id); }
      state.hintIdsByRole = state.hintIdsByRole || { tag:[], titleKey:[], title:[], narr:[] };
      state.hintIdsByRole[r] = uniq;
    });
  }

  /* ============================ setup ============================ */
  function setup(meta){
    meta = meta || {};
    // meta merge（安全に後勝ち）
    state.meta.lang  = meta.lang || state.meta.lang || 'ja-JP';
    state.meta.voicePreferences = Array.isArray(meta.voicePreferences) ? meta.voicePreferences.slice() : (state.meta.voicePreferences||[]);
    state.meta.rate  = (typeof meta.rate === 'number' && isFinite(meta.rate)) ? meta.rate : (state.meta.rate || 1.2);
    state.base       = state.meta.rate;
    state.meta.fixes = (meta.fixes && typeof meta.fixes === 'object') ? meta.fixes : (state.meta.fixes || {});
    state.meta.roleVoiceHints = (meta.roleVoiceHints && typeof meta.roleVoiceHints === 'object') ? meta.roleVoiceHints : (state.meta.roleVoiceHints || {});
    state.meta.voiceAlias = (meta.voiceAlias && typeof meta.voiceAlias === 'object') ? meta.voiceAlias : (state.meta.voiceAlias || {});

    // voices filter（保持だけ。実際の getCatalog では無視し全件を返すデバッグ方針）
    if (meta.filter && typeof meta.filter === 'object') {
      if ('jaOnly' in meta.filter) state.meta.filter.jaOnly = !!meta.filter.jaOnly;
      if ('strictLang' in meta.filter) state.meta.filter.strictLang = !!meta.filter.strictLang;
    } else if (typeof meta.showAllVoices === 'boolean') {
      state.meta.filter.jaOnly = !meta.showAllVoices;
    }

    // rateMode（debug_config からのヒントも尊重）
    try{
      var m = (window.__dbgConfig && window.__dbgConfig.rateMode) || null;
      if (m === 'perRoleAbs' || m === 'base+multiplier') state.rateMode = m;
      var rr = window.__dbgConfig && window.__dbgConfig.rolesRate;
      if (rr && typeof rr.defaultAbs === 'number' && isFinite(rr.defaultAbs)){
        state.roleAbs = { tag:rr.defaultAbs, titleKey:rr.defaultAbs, title:rr.defaultAbs, narr:rr.defaultAbs };
      }
    }catch(_){}

    // 初回カタログ構築
    refreshCatalog();
    precomputeRoleHints();
    // Safari対策：段階ポーリングで確実に voices を拾う
    startCatalogWarmup(/*force=*/true);
  }

  /* ============================ getCatalog / pick ============================ */
  // ★ デバッグ方針：常に「全ボイス」を返す（jaOnly/strictLangは現時点で無視）
  function getCatalog(/*opts*/){
    try{
      // 必要に応じて再取得（Safariで空回避）
      if (HAS_SS && (!state.lastRefreshed || (Date.now() - state.lastRefreshed) > 1500)){
        refreshCatalog(); precomputeRoleHints();
      }
    }catch(_){}
    return state.catalog.slice();
  }

  function preferenceFallbackIds(){
    var prefs = state.meta.voicePreferences || [], res=[], i, ids, j;
    for (i=0;i<prefs.length;i++){ ids = hintToIdCandidates(prefs[i]); for (j=0;j<ids.length;j++) res.push(ids[j]); }
    // 日本語優先の一押し（存在すれば押し込む）→ なくても全件から後で選ばれる
    for (i=0;i<state.catalog.length;i++){ var it = state.catalog[i]; if (/^ja(?:-|$)/i.test(it.lang||'')){ res.push(it.id); break; } }
    if (state.catalog.length) res.push(state.catalog[0].id);
    var seen=Object.create(null), out=[];
    for (i=0;i<res.length;i++){ var id=res[i]; if (seen[id]) continue; seen[id]=1; out.push(id); }
    return out;
  }

  function pick(role){
    role = role || 'narr';
    if (HAS_SS && (!state.lastRefreshed || (Date.now() - state.lastRefreshed) > 1500)){
      refreshCatalog(); precomputeRoleHints();
    }
    var hintsByRole = state.hintIdsByRole || {};
    var roleHints = hintsByRole[role] || [];
    for (var i=0;i<roleHints.length;i++){
      var id = roleHints[i]; if (state.byId[id]) return { id:id, label: state.byId[id].label };
    }
    var fall = preferenceFallbackIds();
    for (var j=0;j<fall.length;j++){ var fid = fall[j]; if (state.byId[fid]) return { id:fid, label: state.byId[fid].label }; }
    return null;
  }

  /* ============================ rate model ============================ */
  function setMode(mode){
    if (mode === 'perRoleAbs' || mode === 'base+multiplier') state.rateMode = mode;
  }
  function getMode(){ return state.rateMode; }
  function setRate(v){ v = Number(v); if (!isFinite(v)) return state.base; state.base = clampAbs(v); return state.base; }
  function getRate(){ return state.base; }
  function setRateRole(map){
    if (!map) return getRateRole();
    if (state.rateMode === 'perRoleAbs'){
      ['tag','titleKey','title','narr'].forEach(function(k){
        if (map[k] != null) state.roleAbs[k] = clampAbs(map[k]);
      });
    } else {
      ['tag','titleKey','title','narr'].forEach(function(k){
        if (map[k] != null){
          var m = Number(map[k]); if (!isFinite(m)) return;
          state.roleMul[k] = Math.min(CLAMP.absMax, Math.max(CLAMP.absMin, m));
        }
      });
    }
    return getRateRole();
  }
  function getRateRole(){
    return (state.rateMode === 'perRoleAbs')
      ? { tag:state.roleAbs.tag, titleKey:state.roleAbs.titleKey, title:state.roleAbs.title, narr:state.roleAbs.narr }
      : { tag:state.roleMul.tag, titleKey:state.roleMul.titleKey, title:state.roleMul.title, narr:state.roleMul.narr };
  }
  function getRateForRole(base, role){
    role = role || 'narr';
    if (state.rateMode === 'perRoleAbs'){
      return clampAbs(state.roleAbs[role] || 1.4);
    }
    var b = Number(base); if (!isFinite(b)) b = state.base;
    var m = Number(state.roleMul[role] || 1.0);
    return clampAbs(b * m);
  }

  /* ============================ warmup / polling ============================ */
  function clearPoll(){
    if (state.pollTimer){ try{ clearTimeout(state.pollTimer); }catch(_){}
      state.pollTimer = null;
    }
  }
  function pollOnce(){
    var before = (state.catalog||[]).length;
    var after  = refreshCatalog();
    precomputeRoleHints();
    if (after && after !== before) dispatchReady();
    state.pollIndex++;
    if (state.pollIndex < state.pollPlanMs.length){
      state.pollTimer = setTimeout(pollOnce, state.pollPlanMs[state.pollIndex]);
    } else {
      state.pollTimer = null; // あとは voiceschanged に任せる
    }
  }
  function startCatalogWarmup(force){
    if (!HAS_SS) return;
    if (state.pollTimer && !force) return;
    clearPoll();
    state.pollIndex = 0;
    pollOnce();
  }

  /* ============================ events ============================ */
  function onVoicesChanged(){
    try{
      var before = (state.catalog||[]).length;
      var after  = refreshCatalog();
      precomputeRoleHints();
      if (after && after !== before) dispatchReady();
      else if (after === 0) startCatalogWarmup(/*force=*/true);
    }catch(_){}
  }

  if (HAS_SS){
    try { synth.addEventListener('voiceschanged', onVoicesChanged, { passive:true }); }
    catch(_){ try{ synth.onvoiceschanged = onVoicesChanged; }catch(__){} }

    // タブが再可視化されたら再チェック
    try {
      document.addEventListener('visibilitychange', function(){
        if (document.visibilityState === 'visible'){ startCatalogWarmup(/*force=*/true); }
      }, { passive:true });
    } catch(_){}
  }

  // 初期カタログ（最低限）
  try{ refreshCatalog(); precomputeRoleHints(); }catch(_){}

  /* ============================ expose ============================ */
  var api = {
    setup: setup,
    getCatalog: getCatalog,     // ← 常に全件
    pick: pick,
    setMode: setMode,
    getMode: getMode,
    setRate: setRate,
    getRate: getRate,
    setRateRole: setRateRole,
    getRateRole: getRateRole,
    getRateForRole: getRateForRole
  };

  try {
    Object.defineProperty(window, '__ttsUtils', { value: api, writable: false, configurable: false, enumerable: true });
  } catch(_){
    window.__ttsUtils = api;
  }

  // 手動で再スキャンしたいとき用（任意）
  window.__ttsUtilsWarmup = startCatalogWarmup;

})();