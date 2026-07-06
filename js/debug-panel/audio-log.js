;(function(w){
  function el(){return document.getElementById('dbg-status')}
  function ts(){try{return new Date().toLocaleTimeString()}catch(e){return ''}}
  function pg(s){return s&&s.page!=null?String(s.page):'?'}
  function fn(u){u=String(u||'');return u.split('?')[0].split('#')[0].split('/').pop()||u}
  function log(s){var x=el(); if(x) x.textContent='['+ts()+'] '+s}
  function on(n,f){try{w.addEventListener(n,f,{passive:true})}catch(e){w.addEventListener(n,f)}}
  function ttsStop(reason){
    try{ if('speechSynthesis' in w) w.speechSynthesis.cancel() }catch(e){}
    try{ w.dispatchEvent(new CustomEvent('player:tts-stop',{detail:{reason:reason||'hard-stop'}})) }catch(e){}
    setTimeout(function(){try{if('speechSynthesis' in w) w.speechSynthesis.cancel()}catch(e){}},80)
    setTimeout(function(){try{if('speechSynthesis' in w) w.speechSynthesis.cancel()}catch(e){}},240)
  }
  function wrapPlayer(){
    var p=w.__player; if(!p||p.__audioLogWrapped) return;
    p.__audioLogWrapped=true;
    var old=p.stopHard;
    p.stopHard=function(){ttsStop('hard-stop'); return old?old.apply(p,arguments):undefined}
  }
  on('player:audio-start',function(e){var d=e.detail||{},s=d.scene||{};log('audio:start final page='+pg(s)+' '+fn(d.url||s.audioUrl))})
  on('player:audio-end',function(e){var d=e.detail||{},s=d.scene||{};log('audio:end page='+pg(s)+' '+(d.reason||'ended'))})
  on('player:audio-interrupted',function(e){var d=e.detail||{},s=d.scene||{};log('audio:stop '+(d.reason||'stopped')+' page='+pg(s))})
  on('player:audio-error',function(e){var d=e.detail||{},s=d.scene||{};log('audio:error page='+pg(s)+' '+(d.err||'error'))})
  on('player:tts-stop',function(e){var d=e.detail||{};log('tts:stop '+(d.reason||'hard-stop'))})
  wrapPlayer(); setTimeout(wrapPlayer,0); setTimeout(wrapPlayer,500);
  log('audio_log: ready')
})(window);
