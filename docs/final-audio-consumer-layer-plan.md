# Final Audio Consumer Layer v002 Plan

Status: docs-only / Fable5 conditional-pass integrated / no code patch yet

## Purpose

Make the player consume a sealed audio asset when a scene declares final audio, without creating orphaned audio or ghost narration.

Current evidence:

- Page 003 MP3 asset exists and is publicly playable on GitHub Pages.
- `scenes.json` Page 003 declares:
  - `audioKey: page.003.final`
  - `audioUrl: ./assets/audio/final/page-003-scattered-room-v001.mp3`
  - `audioDurationMs: 9326`
  - `audioStatus: final`
- Current `player-core.js` content playback still appears to use Live TTS through `runContentSpeech(scene)`.

## Fable5 Conditional Pass

Fable5 judgment:

```text
CONDITIONAL PASS: Tiny patch is safe if corrected.
```

The correction is mandatory:

```text
The kill path is the patch.
```

Meaning: do not add MP3 playback unless Stop / Hard Stop / Next / Prev / stale navigation also kills the `HTMLAudioElement`.

## One Critical Flaw

```text
Orphaned audio / ghost voice risk.
```

Existing interruption paths were designed around `speechSynthesis.cancel()`. If the patch adds an `HTMLAudioElement` but does not stop it on navigation or Stop, Page 003 MP3 can continue playing over the next scene.

Failure mode:

1. Page 003 starts MP3 playback.
2. User taps Next or Stop.
3. The visual scene advances or stops.
4. MP3 continues playing because only Live TTS was cancelled.
5. Next scene can speak over the still-playing MP3.

This is a bedtime-product failure and must be prevented in the same commit as final-audio playback.

## Core Rule

```text
If scene.audioStatus === "final" and scene.audioUrl exists,
play the audio file first.
If the audio file completes successfully, skip Live TTS for that scene.
If the audio file fails before meaningful playback begins, fall back to Live TTS.
If playback is interrupted, do not fall back.
If playback fails mid-stream after meaningful playback began, end the scene speech phase quietly and do not restart Live TTS from the top.
```

## Mandatory Kill Path

Add a module-scope handle and killer near existing player state:

```js
let currentAudio = null;

function stopFinalAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.src = "";
    } catch (_) {}
    currentAudio = null;
  }
}
```

`stopFinalAudio()` must be called wherever existing code cancels or invalidates current speech playback, including:

- Stop
- Hard Stop
- gotoNext
- gotoPrev
- any navigation path that invalidates the current scene token

The patch is not acceptable unless these kill hooks are included.

## Minimal Runtime Behavior

For content scenes:

1. Render the visual scene normally.
2. Check whether final audio is available.
3. If final audio is available:
   - create an `HTMLAudioElement`
   - assign it to `currentAudio`
   - set `src` to `scene.audioUrl`
   - apply `audioGain` if present
   - capture the current `navToken` at playback start
   - emit `player:audio-start`
   - await `audio.play()`
   - wait for `ended`, `error`, or interruption
   - on `ended`, emit `player:audio-end`
   - on `error`, emit `player:audio-error` only when the scene is still current
   - always clear `currentAudio` if it still owns the same element
4. If final audio completes successfully:
   - skip `runContentSpeech(scene)`
5. If final audio fails before meaningful playback begins:
   - fall back to `runContentSpeech(scene)`
6. If final audio is interrupted by Stop/navigation:
   - do not fall back to Live TTS
   - do not emit stale events
7. If final audio fails mid-playback:
   - do not restart Live TTS from the beginning

## Helper Shape

```js
function hasFinalAudio(scene) {
  return !!(
    scene &&
    String(scene.audioStatus || '').toLowerCase() === 'final' &&
    typeof scene.audioUrl === 'string' &&
    scene.audioUrl.trim()
  );
}

async function playFinalAudio(scene, navTokenAtStart) {
  if (!hasFinalAudio(scene)) return 'failed-before-start';
  // returns:
  // - 'completed'
  // - 'failed-before-start'
  // - 'interrupted'
  // - 'failed-mid-playback'
}
```

The caller must distinguish these results. Do not reduce them to boolean.

## Proposed Content Flow

```js
renderContent(scene);
emit('player:scene-didrender', { index: State.idx, kind });

if (hasFinalAudio(scene)) {
  const result = await playFinalAudio(scene, navToken);
  if (result === 'completed' || result === 'interrupted' || result === 'failed-mid-playback') {
    return;
  }
  // Only failed-before-start falls through to Live TTS.
}

await primeTTS();
await runContentSpeech(scene);
```

## Events

```text
player:audio-start
player:audio-end
player:audio-error
```

Suggested event details:

```js
{ index: State.idx, audioUrl: scene.audioUrl, audioStatus: scene.audioStatus }
```

Do not emit end/error events after the scene is stale.

## Stop / Navigation Guard

The `navToken` captured at audio playback start is authoritative.

Rules:

- If live `navToken` does not match captured token, the scene is stale.
- Stale audio must resolve as `interrupted`.
- Stale audio must not trigger Live TTS fallback.
- Stale audio must not emit normal end/error events.
- Next / Prev / Stop / Hard Stop must call `stopFinalAudio()`.

## iOS Audio Unlock Guard

Assume `audio.play()` may reject unless a user gesture has unlocked audio in the current browser session.

Safe behavior:

- Do not autoplay on page load.
- Do not add a WebAudio unlock dance in this tiny patch.
- Await `audio.play()`.
- If `audio.play()` rejects before playback begins, return `failed-before-start` and fall back to Live TTS.

## Fallback Rule

Live TTS fallback is allowed only when final audio never meaningfully began.

Allowed fallback:

- `audio.play()` rejected before playback.
- `error` fires before first meaningful playback.

No fallback:

- user pressed Stop
- user navigated Next / Prev
- navToken became stale
- audio failed mid-playback after listener already heard part of it

Rationale: restarting Live TTS from the top after partial MP3 playback is worse than silence for a bedtime product.

## audioDurationMs Rule

`audioDurationMs` is evidence metadata.

Do not use `audioDurationMs: 9326` as a runtime timer.

Runtime must rely on the audio element's `ended` event, plus interruption/error handling.

## Acceptance Criteria

- Page 003 uses MP3 asset playback, not Live TTS.
- Page 003 still advances after audio ends.
- Next / Prev / Stop / Hard Stop stop MP3 immediately.
- Interrupted audio never falls back to Live TTS.
- Mid-playback audio failure does not restart Live TTS from the beginning.
- MP3 failure before playback begins falls back to Live TTS.
- No exporter, schema, workflow, or broad refactor is touched.
- No estimated duration is introduced.
- `audioDurationMs` remains the measured MP3 evidence value: `9326`.

## What Not To Touch

Do not touch:

- `scenes.json` values or schema
- `exporter.js`
- GitHub workflows
- PR #11 / PR #12 state
- `runContentSpeech` internals
- TTS rules layer: `tts-rules.json` / `tts-kv.txt`
- broad navigation internals beyond the required one-line kill hooks

## Minimal Human Runtime Test

On iPhone Safari or Chrome:

1. Tap start.
2. Navigate to Page 003.
3. Confirm MP3 voice is used, not Live TTS.
4. Tap Next during Page 003 MP3 playback.
5. Confirm MP3 stops instantly.
6. Confirm next scene speaks normally.
7. Return to Page 003.
8. Confirm replay works.
9. Optional failure test: block MP3/network and confirm Live TTS fallback only when playback never began.

## Guard

- Public MP3 URL OK does not prove player consumption.
- Runtime consumer layer is the next gate.
- Do not mark runtime success until Page 003 is observed using MP3 playback.
- Kill pathなしのMP3 playback patchは禁止。
- Do not touch exporter/schema/workflow in this patch.
- Do not merge or resolve unrelated PR conflicts while implementing this.

## Next Gate

Create a tiny `player-core.js` patch only after Human Seal.

The patch must include both:

1. Final audio playback.
2. `stopFinalAudio()` kill path.
