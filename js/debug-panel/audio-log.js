;(function(w){
  var gateUntil=0;
  function el(){return document.getElementById('dbg-status')}
  function ts(){try{return new Date().toLocaleTimeString()}catch(e){return ''}}
  function pg(s){return s&&s.page!=null?String(s.page):'?'}
  function fn(u){u=String(u||'');return u.split('?')[0].split('#')[0].split('/').pop()||u}
  function log(s){var x=el(); if(x) x.textContent='['+ts()+'] '+s}
  function on(n,f){try{w.addEventListener(n,f,{passive:true})}catch(e){w.addEventListener(n,f)}}
  function cancelOnce(){try{ if('speechSynthesis' in w) w.speechSynthesis.cancel() }catch(e){}}
  function openGate(){gateUntil=Date.now()+4000}
  function closeGate(){gateUntil=0}
  function installSpeakGate(){
    try{
      var ss=w.speechSynthesis; if(!ss||ss.__audioLogGate||typeof ss.speak!=='function') return;
      var raw=ss.speak.bind(ss); ss.__audioLogGate=true;
      ss.speak=function(u){if(Date.now()<gateUntil){log('tts:gate after-stop');return;} return raw(u)};
    }catch(e){}
  }
  function ttsStop(reason){
    openGate();
    cancelOnce();
    try{ w.dispatchEvent(new CustomEvent('player:tts-stop',{detail:{reason:reason||'hard-stop'}})) }catch(e){}
    setTimeout(cancelOnce,80)
    setTimeout(cancelOnce,240)
    setTimeout(cancelOnce,600)
    setTimeout(cancelOnce,1200)
  }
  function wrapPlayer(){
    var p=w.__player; if(!p||p.__audioLogWrapped) return;
    p.__audioLogWrapped=true;
    var old=p.stopHard;
    p.stopHard=function(){ttsStop('hard-stop'); return old?old.apply(p,arguments):undefined}
    ;['play','next','prev','goto','restart'].forEach(function(k){var oldFn=p[k]; if(typeof oldFn==='function'){p[k]=function(){closeGate(); return oldFn.apply(p,arguments)}}})
  }
  installSpeakGate();
  on('player:audio-start',function(e){var d=e.detail||{},s=d.scene||{};log('audio:start final page='+pg(s)+' '+fn(d.url||s.audioUrl))})
  on('player:audio-end',function(e){var d=e.detail||{},s=d.scene||{};log('audio:end page='+pg(s)+' '+(d.reason||'ended'))})
  on('player:audio-interrupted',function(e){var d=e.detail||{},s=d.scene||{};log('audio:stop '+(d.reason||'stopped')+' page='+pg(s))})
  on('player:audio-error',function(e){var d=e.detail||{},s=d.scene||{};log('audio:error page='+pg(s)+' '+(d.err||'error'))})
  on('player:tts-stop',function(e){var d=e.detail||{};log('tts:stop '+(d.reason||'hard-stop'))})
  wrapPlayer(); setTimeout(wrapPlayer,0); setTimeout(wrapPlayer,500);
  log('audio_log: ready')
})(window);
