/*!
Project: shorts-player-kit
File:    js/debug_config.js
Role:    Debug Panel Config
Notes:
  - QuickBarは2段固定。Row1: Debug/Play/Stop/Next/ACK、Row2: status。
  - デフォルト音声は固定せず “Auto” に戻す（役割別 hints は豊富に）。
  - Voicesは JA のみを基本表示。ただし実機で 0 件でも tts-voice-utils 側が賢くフォールバック。
*/
(function() {
	'use strict';

	// ---- merge: defaults ← overrides（配列は置換、プレーンオブジェクトは再帰）----
	function isPlainObject(v) { return !!v && Object.prototype.toString.call(v) === '[object Object]'; }

	function deepMerge(base, over) {
		if (!isPlainObject(base)) return over;
		var out = {};
		Object.keys(base).forEach(function(k) { out[k] = base[k]; });
		if (isPlainObject(over)) {
			Object.keys(over).forEach(function(k) {
				var bv = out[k],
					ov = over[k];
				if (Array.isArray(ov)) out[k] = ov.slice();
				else if (isPlainObject(ov) && isPlainObject(bv)) out[k] = deepMerge(bv, ov);
				else out[k] = ov;
			});
		}
		return out;
	}

	function deepFreeze(o) {
		if (!o || typeof o !== 'object') return o;
		Object.getOwnPropertyNames(o).forEach(function(prop) {
			var v = o[prop];
			if (v && typeof v === 'object') deepFreeze(v);
		});
		return Object.freeze(o);
	}

	// ---- Defaults（Auto運用 + JA優先 + デバッグUIはそのまま）----
	var defaults = {
		collapsedDefault: true,

		sections: {
			status: true,
			note: false,
			controls: true,
			goto: true,
			ttsFlags: true,
			voices: true,
			baseRate: false
		},

		buttons: {
			prev: true,
			next: true,
			play: false,
			stop: false,
			restart: true,
			goto: true,
			hardreload: true,
			hardstop: false
		},

		locks: { allowTTSFlagEdit: true, allowVoiceSelect: true },

		// 速度規範（役割別・絶対）
		rateMode: 'perRoleAbs',
		rolesRate: { min: 0.5, max: 2.0, step: 0.1, defaultAbs: 1.4 },
		// 互換
		rate: { min: 0.5, max: 2.0, step: 0.05 },

		ttsFlagsDefault: { readTag: true, readTitleKey: true, readTitle: true, readNarr: true },

		// ★ デフォルト音声は “指定しない(=Auto)” に変更
		//   → __playerCore が __ttsVoiceMap を未設定なら触らず、tts 側の pick() とUI選択に委ねる
		// debug_config.js の voice.hints を拡張（任意）
		voice: {
			defaults: { tag: 'ja-JP|Kyoko', titleKey: 'ja-JP|Kyoko', title: 'ja-JP|Kyoko', narr: 'ja-JP|Kyoko' },
			hints: {
				tag: ['ja-JP|Kyoko', 'Kyoko', 'Otoya', 'O-ren', 'Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley'],
				titleKey: ['ja-JP|Kyoko', 'Kyoko', 'Otoya', 'O-ren', 'Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley'],
				title: ['ja-JP|Kyoko', 'Kyoko', 'Otoya', 'O-ren', 'Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley'],
				narr: ['ja-JP|Kyoko', 'Kyoko', 'Otoya', 'O-ren', 'Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley']
			},
			filter: { jaOnly: false }
		},

		quickbar: {
			enabled: true,
			mode: 'twoRows',
			items: { play: true, stop: true, next: true, ack: true }
		},

		badges: { motion: 'auto' } // 'auto' | 'static' | 'off'
	};

	// 既存の window.__dbgConfig があれば優先してマージ（上書きは**ユーザー側**のみ）
	var incoming = (typeof window.__dbgConfig === 'object' && window.__dbgConfig) ? window.__dbgConfig : {};
	var merged = deepMerge(defaults, incoming);
	window.__dbgConfig = deepFreeze(merged);

	// 参考：以前 Kyoko を localStorage に保存していた場合、UI操作で「Auto」に戻してください。
	// 保存キー（参考）：'dbg.voice.tag' / 'dbg.voice.titleKey' / 'dbg.voice.title' / 'dbg.voice.narr'
})();
