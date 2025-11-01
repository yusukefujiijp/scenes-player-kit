/*!
 * scenes-player-kit: exporter.js (Visual Brush-up v2)
 * Canvasベースの簡易エクスポータ（無劣化レイアウト版）
 *  - __playerCore.renderSceneToCanvas があればそれを使用
 *  - 無い場合は本ファイルの「フォールバック描画」を使用（タグ・題名・絵文字バンド・本文）
 *  - iOS/Safari優先の MIME 選択、簡易ビープ音（テスト用）をミックス
 */
;(function(){
  'use strict';

  /* ====================== MIME 試行 ====================== */
  function pickBestMime(){
    var cand = [
      'video/mp4;codecs=avc1.42E01E',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (var i=0; i<cand.length; i++){
      try{
        if (typeof MediaRecorder!=='undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(cand[i])) return cand[i];
      }catch(_){}
    }
    return (typeof MediaRecorder!=='undefined' && MediaRecorder.isTypeSupported) ? '' : null;
  }

  /* ====================== Canvas 確保 ====================== */
  function ensureCanvas(w,h){
    var c = document.getElementById('exporter-canvas');
    if(!c){
      c = document.createElement('canvas');
      c.id = 'exporter-canvas';
      c.style.position = 'fixed';
      c.style.left = '-9999px';
      c.style.top = '-9999px';
      c.style.pointerEvents = 'none';
      document.body.appendChild(c);
    }
    c.width  = Math.max(16, w|0);
    c.height = Math.max(16, h|0);
    return c;
  }

  /* ====================== ヘルパ ====================== */
  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function mix(a, b, t){ // a,b: #rrggbb , t:0..1
    function c2i(x){ return parseInt(x,16); }
    var r = Math.round((1-t)*c2i(a.slice(1,3)) + t*c2i(b.slice(1,3)));
    var g = Math.round((1-t)*c2i(a.slice(3,5)) + t*c2i(b.slice(3,5)));
    var bl= Math.round((1-t)*c2i(a.slice(5,7)) + t*c2i(b.slice(5,7)));
    var h = function(n){ return ('0'+n.toString(16)).slice(-2); };
    return '#'+h(r)+h(g)+h(bl);
  }
  function roundedRect(ctx, x,y,w,h,r){
    var rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }
  function fitText(ctx, text, maxW, basePx, minPx){
    var size = basePx;
    ctx.font = '700 '+size+'px "Shippori Mincho","Noto Sans JP",system-ui,-apple-system,sans-serif';
    while(ctx.measureText(text).width > maxW && size > minPx){
      size -= 1;
      ctx.font = '700 '+size+'px "Shippori Mincho","Noto Sans JP",system-ui,-apple-system,sans-serif';
    }
    return size;
  }
  function wrapJP(ctx, text, maxW){
    // 日本語は連続文字で折り返す（英数は単語境界）
    var tokens = [];
    var re = /[A-Za-z0-9]+|./g, m;
    while((m = re.exec(text))){ tokens.push(m[0]); }

    var lines = [], cur = '';
    for(var i=0;i<tokens.length;i++){
      var t = tokens[i];
      var test = cur + t;
      if (ctx.measureText(test).width <= maxW) cur = test;
      else{ if(cur) lines.push(cur); cur = t; }
    }
    if(cur) lines.push(cur);
    return lines;
  }

  /* ============== フォールバック描画 ==============
     タグ → 題名キー → 題名 → （中央）絵文字バンド → 本文
  */
  function renderSceneFallback(canvas, scene){
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;

    // Theme tokens
    var base = (scene && scene.base) || '#0f121a';
    var txt  = '#e9edf3';
    var dim  = '#c7cfda';
    var chipBg = mix(base, '#ffffff', 0.15);
    var chipBd = mix(base, '#ffffff', 0.28);
    var band  = mix(base, '#ffffff', 0.08);

    // 背景
    ctx.fillStyle = base;
    ctx.fillRect(0,0,W,H);

    // 基本余白
    var P  = Math.round(W*0.06);           // 横マージン
    var y  = Math.round(H*0.075);          // 上からの開始
    var gap= Math.round(H*0.012);          // 行間の基本

    /* ---- Section Tags ---- */
    var tags = Array.isArray(scene && scene.sectionTags) ? scene.sectionTags : [];
    if(tags.length){
      var chipFs = clamp(Math.round(W*0.028), 14, 20); // ★大きく
      var padY = Math.round(chipFs*0.40), padX = Math.round(chipFs*0.7);
      ctx.font = '700 '+chipFs+'px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
      ctx.textBaseline = 'top';

      // 必要幅を計算（8px 間隔）
      var widths = tags.map(function(t){ return Math.ceil(ctx.measureText(t).width) + padX*2; });
      var totalW = widths.reduce(function(a,b){return a+b;}, 0) + (tags.length-1)*8;
      // はみ出すなら縮小
      var scale = totalW > (W - P*2) ? (W - P*2) / totalW : 1;

      var chipsH = Math.round(chipFs + padY*2);
      var startX = Math.round((W - totalW*scale)/2);
      var x = startX;
      for(var i=0;i<tags.length;i++){
        var cw = Math.round(widths[i]*scale);
        var ch = Math.round(chipsH*scale);
        var cy = y;
        ctx.save();
        ctx.translate(x, cy);
        ctx.scale(scale, scale);
        // 背景
        ctx.fillStyle = chipBg;
        ctx.strokeStyle = chipBd;
        roundedRect(ctx, 0, 0, widths[i], chipsH, chipsH/2);
        ctx.fill(); ctx.lineWidth = 1; ctx.stroke();
        // 文字
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tags[i], padX, padY - 2);
        ctx.restore();
        x += cw + Math.round(8*scale);
      }
      y += Math.round(chipsH*scale) + gap*2;
    }

    /* ---- title_key ---- */
    var tkey = (scene && (scene.title_key || scene.titleKey || '')) || '';
    if(tkey){
      var tkeySize = clamp(Math.round(W*0.055), 22, 34);
      ctx.font = '700 '+tkeySize+'px "Shippori Mincho","Noto Sans JP",system-ui,-apple-system,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = txt;
      ctx.fillText(tkey, W/2, y);
      y += tkeySize + gap*1.5;
    }

    /* ---- title ---- */
    var title = (scene && scene.title) || '';
    if(title){
      var maxW = W - P*2;
      var tSize = fitText(ctx, title, maxW, Math.round(W*0.11), Math.round(W*0.06)); // 大きめ→はみ出しで調整
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = txt;
      ctx.fillText(title, W/2, y);
      y += tSize + gap*2;
    }

    /* ---- Symbol Band（中央）---- */
    var sym = (scene && scene.symbol) || '';
    if(sym){
      var bandTop = y + Math.round(H*0.01);
      var bandH   = clamp(Math.round(H*0.16), 90, 180); // ★しっかり目の高さ
      ctx.fillStyle = band;
      ctx.fillRect(0, bandTop, W, bandH);

      var sSize = clamp(Math.round(Math.min(W*0.18, bandH*0.72)), 48, 128);
      ctx.font = '700 '+sSize+'px "Apple Color Emoji","Noto Color Emoji",system-ui,-apple-system,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
      ctx.fillText(sym, W/2, bandTop + bandH/2);

      y = bandTop + bandH + gap*2;
    }

    /* ---- Narr ---- */
    var narr = (scene && scene.narr) || '';
    if(narr){
      var maxWn = W - P*2;
      var nSize = clamp(Math.round(W*0.05), 18, 26);
      ctx.font = nSize+'px "Noto Sans JP",system-ui,-apple-system,sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = dim;

      var lines = wrapJP(ctx, narr.replace(/\r/g,''), maxWn);
      var lineH = Math.round(nSize * 1.7);

      // 下端に食い込むようならフォントを縮めて再計算
      while(y + lines.length*lineH > H - Math.round(P*0.8) && nSize > 16){
        nSize -= 1;
        ctx.font = nSize+'px "Noto Sans JP",system-ui,-apple-system,sans-serif';
        lineH = Math.round(nSize*1.7);
        lines = wrapJP(ctx, narr, maxWn);
      }

      var nx = (W - maxWn)/2, ny = y;
      for(var i=0;i<lines.length;i++){
        ctx.fillText(lines[i], nx, ny);
        ny += lineH;
        if(ny > H - P) break;
      }
    }
  }

  /* ============== ラッパ：__playerCore か Fallback か ============== */
  function drawSceneToCanvas(canvas, scene){
    try{
      if (window.__playerCore && typeof window.__playerCore.renderSceneToCanvas === 'function'){
        // もし core が用意されていれば、それを優先
        return Promise.resolve(window.__playerCore.renderSceneToCanvas(canvas, scene));
      }
    }catch(_){}
    renderSceneFallback(canvas, scene);
    return Promise.resolve();
  }

  /* ====================== 本体（録画） ====================== */
  async function exportScenesToBlob(args){
    var scenes = (args && args.scenes) || [];
    var optsIn = (args && args.opts) || {};
    var fps = clamp((optsIn.fps|0) || 30, 8, 60);
    var W   = Math.max(16, (optsIn.width|0)  || 720);
    var H   = Math.max(16, (optsIn.height|0) || 1280);
    var perSceneMs = Math.max(500, (optsIn.perSceneMs|0) || 2200);

    if (!scenes.length) throw new Error('No scenes');

    var mime = pickBestMime();
    if (mime==null) throw new Error('MediaRecorder is not available on this browser.');
    if (mime==='') mime = undefined;

    var canvas = ensureCanvas(W,H);
    var vStream = canvas.captureStream(fps);

    // --- テスト用ビープ（必要なければ enableBeep=false） ---
    var enableBeep = true;
    var mixed;
    if(enableBeep && 'AudioContext' in window){
      var ac = new AudioContext();
      var dest = ac.createMediaStreamDestination();
      var osc = ac.createOscillator();
      var env = ac.createGain();
      osc.frequency.value = 880;
      env.gain.value = 0.0001;
      osc.connect(env).connect(dest);
      osc.start();

      // 0.2s×各シーンの冒頭で小さくビープ
      var now = ac.currentTime + 0.05;
      var t = now;
      for(var i=0;i<scenes.length;i++){
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.12, t + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
        t += perSceneMs/1000;
      }

      mixed = new MediaStream([].concat(vStream.getTracks(), dest.stream.getTracks()));
    }else{
      mixed = vStream;
    }

    var rec;
    try{
      rec = new MediaRecorder(mixed, mime ? { mimeType: mime } : undefined);
    }catch(err){
      throw err;
    }

    var chunks = [];
    rec.ondataavailable = function(ev){ if(ev && ev.data && ev.data.size>0){ chunks.push(ev.data); } };
    var stoppedResolve, stoppedReject;
    var stopped = new Promise(function(res, rej){ stoppedResolve = res; stoppedReject = rej; });
    rec.onstop = function(){ stoppedResolve(); };
    rec.onerror = function(e){ stoppedReject(e.error || e.name || e); };

    rec.start();

    // タイムライン
    var framesPerScene = Math.max(1, Math.round(perSceneMs * fps / 1000));
    var timeline = [];
    for (var i=0; i<scenes.length; i++){
      for (var k=0; k<framesPerScene; k++) timeline.push(i);
    }

    // 先頭を描画
    await drawSceneToCanvas(canvas, scenes[0]);

    // 固定間隔で描画
    var idx = 0;
    var interval = 1000/fps;
    await new Promise(function(done){
      var timer = setInterval(function(){
        try{
          if(idx >= timeline.length){
            clearInterval(timer);
            rec.stop();
            done();
            return;
          }
          var sIdx = timeline[idx];
          drawSceneToCanvas(canvas, scenes[sIdx]);
          idx++;
        }catch(e){
          clearInterval(timer);
          try{ rec.stop(); }catch(_){}
          done();
        }
      }, interval);
    });

    await stopped;
    var blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
    return blob;
  }

  /* ====================== ダウンロード便宜 ====================== */
  function downloadBlob(blob, filename){
    var a = document.createElement('a');
    var url = URL.createObjectURL(blob);
    a.href = url; a.download = filename || 'export.webm';
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
  }
  function nowStamp(){
    var d = new Date();
    function pad(n){ return (n<10?'0':'')+n; }
    return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'-'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds());
  }
  async function downloadScenesVideo(args){
    var scenes = (args && args.scenes) || [];
    var opts = (args && args.opts) || {};
    var blob = await exportScenesToBlob({ scenes: scenes, opts: opts });
    var ext = (blob && blob.type && blob.type.indexOf('mp4')>=0) ? 'mp4' : 'webm';
    var name = (args && args.filename) || ('scenes-'+nowStamp()+'.'+ext);
    downloadBlob(blob, name);
    return { blob, name };
  }

  /* ====================== export ====================== */
  window.__exporter = {
    pickBestMime: pickBestMime,
    exportScenesToBlob: exportScenesToBlob,
    downloadScenesVideo: downloadScenesVideo
  };
})();