/*!
    Project:  shorts-player-kit
    File:     js/viewport-handler.js
    Role:     Handles visualViewport API to adapt layout for on-screen keyboards.
    */
(function() {
	'use strict';
	try {
		var de = document.documentElement;
		var vv = window.visualViewport;
		// visualViewport API がサポートされていない場合は何もしない
		if (!vv) return;

		var isKeyboardExpected = false; // 入力フォーカス中かどうかのフラグ

		function updateViewportStyles() {
			var keyboardHeightBias = 0;
			// visualViewport の高さとウィンドウの内部の高さを比較して、
			// キーボードなどによって生じるUIの高さを計算する
			keyboardHeightBias = Math.max(0, Math.ceil(window.innerHeight - (vv.offsetTop + vv.height)));

			// キーボードが出ていると予測される時だけ #wrapper の高さを変更
			if (isKeyboardExpected) {
				var viewportHeight = Math.floor(vv.height) + 'px';
				de.style.setProperty('--visual-viewport-h', viewportHeight);
			} else {
				// それ以外の時は、常にフルハイトに戻す
				de.style.setProperty('--visual-viewport-h', '100vh');
				keyboardHeightBias = 0; // バイアスもリセット
			}
			// 計算したバイアスをCSS変数として設定（デバッグパネルの padding-bottom で使用）
			de.style.setProperty('--host-bias-bottom', keyboardHeightBias + 'px');
		}

		// イベントリスナーを設定
		vv.addEventListener('resize', updateViewportStyles);
		vv.addEventListener('scroll', updateViewportStyles);
		window.addEventListener('orientationchange', function() { setTimeout(updateViewportStyles, 50); }, { passive: true });

		// 初期化時に数回実行して安定させる
		var i = 0;
		(function warmUp() {
			i++;
			updateViewportStyles();
			if (i < 6) requestAnimationFrame(warmUp);
		})();

		// 入力要素へのフォーカスを監視し、キーボード表示状態を推測
		document.addEventListener('focusin', function(e) {
			if (e && e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
				isKeyboardExpected = true;
				// フォーカスが当たった直後に更新をかける
				setTimeout(updateViewportStyles, 100);
			}
		}, { capture: true, passive: true });

		document.addEventListener('focusout', function(e) {
			isKeyboardExpected = false;
			// フォーカスが外れたら少し遅れてリセット処理をかける
			// (別の入力要素にフォーカスが移る場合を考慮)
			setTimeout(updateViewportStyles, 200);
		}, { capture: true, passive: true });

	} catch (e) {
		console.error('Viewport handler failed:', e);
	}
})();