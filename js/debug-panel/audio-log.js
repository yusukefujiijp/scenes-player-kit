;(function(w){
  function el(){return document.getElementById('dbg-status')}
  function ts(){try{return new Date().toLocaleTimeString()}catch(e){return ''}}
  function pg(s){return s&&s.page!=null?String(s.page):'?'}
  function fn(u){u=String(u||'');return u.split('?')[0].split('#')[0].split('/').pop()||u}
  function log(s){var x=el(); if(x) x.textContent='['+ts()+'] '+s}
  function on(n,f){try{w.addEventListener(n,f,{passive:true})}catch(e){w.addEventListener(n,f)}}
  on('player:audio-start',function(e){var d=e.detail||{},s=d.scene||{};log('audio:start final page='+pg(s)+' '+fn(d.url||s.audioUrl))})
  on('player:audio-end',function(e){var d=e.detail||{},s=d.scene||{};log('audio:end page='+pg(s)+' '+(d.reason||'ended'))})
  on('player:audio-interrupted',function(e){var d=e.detail||{},s=d.scene||{};log('audio:stop '+(d.reason||'stopped')+' page='+pg(s))})
  on('player:audio-error',function(e){var d=e.detail||{},s=d.scene||{};log('audio:error page='+pg(s)+' '+(d.err||'error'))})
  log('audio_log: ready')
})(window);
