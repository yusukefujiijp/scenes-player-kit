/*!
  Project:  scenes-player-kit-exporter
  File:     js/debug-panel/state.js
  Role:     Debug Panel State (pure logic, no DOM)
  Exports:  window.__dbgState (singleton) / createDebugState (UMD/ESM)
*/
;(function (global){
  'use strict';

  // ---------- safe storage ----------
  var _ls = (function(){
    try{ if(typeof global.localStorage !== 'undefined') return global.localStorage; }catch(_){}
    return null;
  })();
  function sGet(k, d){ try{ var v=_ls&&_ls.getItem(k); return v==null?d:v; }catch(_){ return d; } }
  function sSet(k, v){ try{ _ls&&_ls.setItem(k, v); }catch(_){ /* ignore */ } }

  // ---------- keys & defaults ----------
  var K = {
    collapsed: 'dbg.panel.collapsed.v3',
    flags:     'dbg.tts.flags.v5',
    voice:     function(role){ return 'dbg.voice.'+role; }
  };
  var DEFAULTS = {
    collapsed: false,
    flags: { readTag:true, readTitleKey:true, readTitle:true, readNarr:true },
    roles: ['tag','titleKey','title','narr']
  };

  // ---------- small event hub ----------
  function makeHub(){
    var xs=[]; return {
      sub: function(fn){ if(typeof fn==='function'){ xs.push(fn); return function(){ var i=xs.indexOf(fn); if(i>=0) xs.splice(i,1); }; } return function(){}; },
      emit: function(p){ for(var i=0;i<xs.length;i++){ try{ xs[i](p); }catch(_){}} }
    };
  }

  // ---------- factory ----------
  function createDebugState(cfg){
    cfg = cfg || {};
    var hub = makeHub();

    // hydrate persisted
    var collapsed = (function(){ var s=sGet(K.collapsed,null); if(s==null) return !!cfg.collapsedDefault || DEFAULTS.collapsed; return (s==='true'); })();
    var flags = (function(){ try{ var raw=sGet(K.flags,null); return raw?JSON.parse(raw):DEFAULTS.flags; }catch(_){ return DEFAULTS.flags; } })();
    var voiceMap = (function(){
      var m={}; for(var i=0;i<DEFAULTS.roles.length;i++){ var r=DEFAULTS.roles[i]; m[r]=sGet(K.voice(r), '')||''; } return m;
    })();

    var state = { collapsed: collapsed, flags: flags, voiceMap: voiceMap };

    function get(){ return state; }
    function set(patch){
      if(!patch || typeof patch!=='object') return state;
      var next = Object.assign({}, state, patch);
      if(patch.flags)   next.flags   = Object.assign({}, state.flags, patch.flags);
      if(patch.voiceMap)next.voiceMap= Object.assign({}, state.voiceMap, patch.voiceMap);
      var prev = state; state = next; hub.emit({prev:prev, next:next}); return state;
    }

    // persisted actions
    function setCollapsed(v){ var b=!!v; sSet(K.collapsed, String(b)); return set({collapsed:b}); }
    function toggleCollapsed(){ return setCollapsed(!state.collapsed); }
    function updateFlags(part){ var nf=Object.assign({}, state.flags, part||{}); sSet(K.flags, JSON.stringify(nf)); return set({flags:nf}); }
    function setVoice(role, id){ var r=String(role||''); var v=String(id||''); sSet(K.voice(r), v); var vm={}; vm[r]=v; return set({voiceMap:vm}); }
    function subscribe(fn){ return hub.sub(fn); }

    return { get, set, setCollapsed, toggleCollapsed, updateFlags, setVoice, subscribe, _keys:K };
  }

  // singleton global
  var singleton = (global.__dbgState && typeof global.__dbgState.get==='function')
    ? global.__dbgState
    : createDebugState(global.__dbgConfig||{});
  try{ if(!global.__dbgState) global.__dbgState = singleton; }catch(_){}

  // UMD-ish exports
  if (typeof module !== 'undefined' && module.exports) module.exports = { createDebugState:createDebugState };
  else if (typeof define === 'function' && define.amd) define(function(){ return { createDebugState:createDebugState }; });

})(typeof window!=='undefined'?window:this);