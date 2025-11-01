/* utils.js — improved addEvt / removeEvt / support detection */

(function(global){
  'use strict';

  // feature-detect passive support once and cache result
  var _supportsPassive = (function(){
    var supported = false;
    try {
      var opts = Object.defineProperty({}, 'passive', {
        get: function(){ supported = true; }
      });
      window.addEventListener('test-passive', null, opts);
      window.removeEventListener('test-passive', null, opts);
    } catch(e){}
    return supported;
  })();

  /**
   * Safe event registration helper.
   * Returns a function which, when called, removes the registered listener.
   * @param {EventTarget} target
   * @param {string} type
   * @param {Function} handler
   * @param {Object|boolean} [opts] - options or boolean capture
   * @returns {Function|null} removeFn or null if nothing was registered
   */
  function addEvt(target, type, handler, opts){
    if(!target || typeof target.addEventListener !== 'function') return null;
    if(typeof type !== 'string' || typeof handler !== 'function') return null;

    var usedOptions = false;
    try {
      // If browser supports options object, pass it through
      if(_supportsPassive && opts && typeof opts === 'object'){
        target.addEventListener(type, handler, opts);
        usedOptions = true;
      } else {
        // fallback: capture boolean (prioritize opts.capture)
        var cap = false;
        try { cap = !!(opts && opts.capture); } catch(_) { cap = false; }
        target.addEventListener(type, handler, cap);
      }
    } catch(e){
      // final fallback: try boolean capture (older environments)
      try {
        var cap2 = !!(opts && opts.capture);
        target.addEventListener(type, handler, cap2);
      } catch(_){
        // give up silently (safety-first)
        return null;
      }
    }

    // return remover
    var removed = false;
    return function remove(){
      if(removed) return;
      try {
        if(usedOptions && _supportsPassive && opts && typeof opts === 'object'){
          target.removeEventListener(type, handler, opts);
        } else {
          var cap = !!(opts && opts.capture);
          target.removeEventListener(type, handler, cap);
        }
      } catch(_) {
        try { target.removeEventListener(type, handler); } catch(_) {}
      }
      removed = true;
    };
  }

  /**
   * Convenience remove helper if you didn't capture the removeFn.
   * @param {EventTarget} target
   * @param {string} type
   * @param {Function} handler
   * @param {Object|boolean} [opts]
   */
  function removeEvt(target, type, handler, opts){
    if(!target || typeof target.removeEventListener !== 'function') return;
    try {
      if(_supportsPassive && opts && typeof opts === 'object'){
        target.removeEventListener(type, handler, opts);
      } else {
        var cap = !!(opts && opts.capture);
        target.removeEventListener(type, handler, cap);
      }
    } catch(e){
      try { target.removeEventListener(type, handler); } catch(_) {}
    }
  }

  // Safe global export under a namespace to minimize collision
  try {
    if (typeof window !== 'undefined') {
      window.__dbgUtils = window.__dbgUtils || {};
      if (typeof window.__dbgUtils.addEvt !== 'function') window.__dbgUtils.addEvt = addEvt;
      if (typeof window.__dbgUtils.removeEvt !== 'function') window.__dbgUtils.removeEvt = removeEvt;
      // Backwards compat: only define top-level names if absent
      if (typeof window.addEvt !== 'function') window.addEvt = addEvt;
      if (typeof window.addEvent !== 'function') window.addEvent = addEvt;
    }
  } catch(e){
    try { console && console.warn && console.warn('[utils] export failed', e); } catch(_) {}
  }

  // ESM export (if bundler/toolchain uses it)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { addEvt: addEvt, removeEvt: removeEvt, supportsPassive: _supportsPassive };
  } else if (typeof define === 'function' && define.amd) {
    define(function(){ return { addEvt: addEvt, removeEvt: removeEvt, supportsPassive: _supportsPassive }; });
  } else {
    // attach to global as fallback already done
  }

})(typeof window !== 'undefined' ? window : this);