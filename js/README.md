# JS Runtime Notes

This document is the runtime-internals map for `js/`.

Read the root [`README.md`](../README.md) first. The root README defines the project-level branch guard, audio policy, link policy, and Human Seal boundaries. This file only explains the JavaScript runtime layer.

Root rule inherited from the root README:

> **Final MP3 is harvest. Live TTS is preview.**

---

## 1. Current scope

`js/` contains the browser runtime for the scene player.

Its job is to:

- load scenes,
- render the current scene,
- run Live TTS preview,
- play Final MP3 audio when available,
- handle navigation,
- expose runtime/debug events,
- support exporter-facing canvas rendering.

This document is intentionally not a rewrite plan. It is a map and guard.

---

## 2. File map

Important runtime files:

| File | Role |
|---|---|
| `player-core.js` | Central runtime: scene loading, render, navigation, Live TTS, Final MP3 playback, Stop / Hard Stop, canvas export hook |
| `tts-sanitize.js` | Role-based TTS text extraction / sanitation boundary |
| `tts-kv-simple.js` | Optional TTS key-value replacement layer |
| `utils/color.js` | Readable color analysis and theme application |
| `debug-panel/index.js` | Debug panel runtime wiring |
| `debug-panel/state.js` | Debug panel state helpers |
| `debug-panel/audio-log.js` | Audio/TTS event evidence helper and stop-gate support |

If a file is not named by the current task, do not edit it.

---

## 3. `player-core.js` responsibilities

`player-core.js` is currently the runtime center. Treat it as high-risk.

Main responsibilities:

- Core state: `State`, `Ctrl`, UI-facing state.
- Scene surface creation and DOM rendering.
- Scene sequencing and navigation: `gotoPage`, `gotoNext`, `gotoPrev`.
- Live TTS preview: `runContentSpeech`, `speakOrWait`, `speakStrict`.
- Final MP3 playback: `hasFinalAudio`, `playFinalAudio`, `stopFinalAudio`.
- Stop / Hard Stop behavior.
- Exporter-facing canvas rendering through `__playerCore.renderSceneToCanvas`.

Do not refactor `player-core.js` casually. A broad refactor requires a dedicated issue and explicit Human Seal.

---

## 4. Final MP3 layer

Final MP3 is the deterministic harvest path.

Key concepts:

- `hasFinalAudio(scene)` detects scenes with final audio.
- `playFinalAudio(scene, navTokenAtStart)` owns an `Audio` element.
- `stopFinalAudio(reason)` interrupts the app-owned audio object.
- The current final proof case is Page003.

Expected behavior:

- Stop / Hard Stop / Next can kill Final MP3 with one app-owned path.
- Final MP3 should not fall back to Live TTS after user stop or mid-play interruption.
- If Final MP3 fails before playback starts, fallback may still be allowed.

Runtime doctrine:

> Final MP3 is app-owned. The kill path is deterministic.

---

## 5. Live TTS layer

Live TTS is the preview path.

Key functions:

- `runContentSpeech(scene)` reads scene roles in order.
- `speakOrWait(text, rate, role)` splits text into chunks and waits for quiet time.
- `speakStrict(text, rate, role)` calls `speechSynthesis.speak()` and includes watchdog/fallback behavior.

Role order:

1. `tag`
2. `titleKey`
3. `title`
4. `narr`

Important boundary:

- Live TTS uses browser-managed `speechSynthesis`.
- The app can request cancellation, but it does not own the browser's hidden queue/producer state the same way it owns an `Audio` element.
- iOS may leave timing, queue, or watchdog states outside the app's synchronous kill path.

Runtime doctrine:

> Live TTS is useful for preview, but it is not the final deterministic audio path.

---

## 6. Red Stop / Hard Stop evidence

Observed runtime behavior:

| Page | Audio mode | Stop observation | Interpretation |
|---|---|---|---|
| Page003 | Final MP3 | one tap | app-owned kill path |
| Page004 | Live TTS | may require two taps | browser-owned producer depth |
| Page005 | Live TTS | may require three taps | deeper TTS queue / role / watchdog state |

Current interpretation:

> **Tap Count may reflect hidden browser-owned producer depth.**

This is an observation-based model, not a browser-internal claim.

The Stop mystery is parked. Do not keep patching Live TTS Stop behavior unless a new product-critical issue explicitly reopens it.

---

## 7. `audio-log.js` boundary

`debug-panel/audio-log.js` is a debug/evidence helper, not the core audio engine.

It currently helps by:

- logging `player:audio-start`, `player:audio-end`, `player:audio-interrupted`, and `player:audio-error`,
- wrapping `stopHard` for TTS stop evidence,
- gating late `speechSynthesis.speak()` attempts after hard stop,
- issuing delayed `speechSynthesis.cancel()` retries.

Do not grow `audio-log.js` into a second player core.

If behavior needs to become product-critical, create a dedicated issue for a real TTS producer-cancellation design instead of piling patches into the debug helper.

---

## 8. Runtime link note

The root README owns the project-level Link Policy. The JS runtime interpretation is simple:

- Runtime App links test the app.
- Direct MP3 links only verify asset delivery.
- A Trusted Tap URL may reduce tap friction, but it is platform/session-controlled and not guaranteed.

Do not design JS runtime behavior around ChatGPT/iOS link confirmation quirks.

---

## 9. What not to do

Do not do these from inside a small runtime task:

- Do not rewrite the TTS engine.
- Do not add a queue manager casually.
- Do not refactor `player-core.js` broadly.
- Do not change `scenes.json` from an audio-stop concern.
- Do not touch schema/exporter/workflow from a JS runtime note task.
- Do not turn `audio-log.js` into production logic.
- Do not reopen the TTS Stop mystery without a dedicated Human Seal.

---

## 10. Future issue candidate

Only if Live TTS cancellation becomes product-critical, create a dedicated issue for:

> Live TTS producer cancellation design

That issue should explicitly address:

- ownership model,
- chunk/role queue,
- watchdog timers,
- stale token guards,
- iOS `speechSynthesis` behavior,
- whether Live TTS should remain preview-only.

Until then, the working policy remains:

> **Final MP3 is harvest. Live TTS is preview.**

---

## 11. Next gate

After this file is refreshed:

1. Complete final human runtime evidence for Issue #13.
2. Decide whether Issue #13 can close after human runtime seal.
3. Avoid broad runtime cleanup until the issue boundary is sealed.

Root remains the root README. This file is the JS runtime map under that guard.
