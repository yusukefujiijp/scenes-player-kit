# Final Audio Consumer Layer v001 Plan

Status: docs-only / planning / no code patch yet

## Purpose

Make the player consume a sealed audio asset when a scene declares final audio.

Current evidence:

- Page 003 MP3 asset exists and is publicly playable on GitHub Pages.
- `scenes.json` Page 003 declares:
  - `audioKey: page.003.final`
  - `audioUrl: ./assets/audio/final/page-003-scattered-room-v001.mp3`
  - `audioDurationMs: 9326`
  - `audioStatus: final`
- Current `player-core.js` content playback still appears to use Live TTS through `runContentSpeech(scene)`.

## Core Rule

```text
If scene.audioStatus === "final" and scene.audioUrl exists,
play the audio file first.
If the audio file plays successfully, skip Live TTS for that scene.
If the audio file fails, fall back to Live TTS and emit an error event.
```

## Minimal Runtime Behavior

For content scenes:

1. Render the visual scene normally.
2. Check whether final audio is available.
3. If final audio is available:
   - create an `HTMLAudioElement`
   - set `src` to `scene.audioUrl`
   - apply `audioGain` if present
   - emit `player:audio-start`
   - wait for `ended`
   - emit `player:audio-end`
   - skip `runContentSpeech(scene)`
4. If final audio fails:
   - emit `player:audio-error`
   - fall back to `runContentSpeech(scene)`

## Acceptance Criteria

- Page 003 uses MP3 asset playback, not Live TTS.
- Page 003 still advances after audio ends.
- MP3 failure does not break playback; Live TTS fallback still works.
- No exporter, schema, workflow, or broad refactor is touched.
- No estimated duration is introduced.
- `audioDurationMs` remains the measured MP3 value: `9326`.

## Proposed Helper Shape

```js
function hasFinalAudio(scene) {
  return !!(
    scene &&
    String(scene.audioStatus || '').toLowerCase() === 'final' &&
    typeof scene.audioUrl === 'string' &&
    scene.audioUrl.trim()
  );
}

async function playFinalAudioIfAny(scene) {
  if (!hasFinalAudio(scene)) return false;
  // returns true when final audio completed successfully
  // returns false on failure so caller can fall back to Live TTS
}
```

## Proposed Content Flow

```js
renderContent(scene);
emit('player:scene-didrender', { index: State.idx, kind });

const usedFinalAudio = await playFinalAudioIfAny(scene);
if (!usedFinalAudio) {
  await primeTTS();
  await runContentSpeech(scene);
}
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

## Guard

- Public MP3 URL OK does not prove player consumption.
- Runtime consumer layer is the next gate.
- Do not mark runtime success until Page 003 is observed using MP3 playback.
- Do not touch exporter/schema/workflow in this patch.
- Do not merge or resolve unrelated PR conflicts while implementing this.

## Next Gate

Create a tiny `player-core.js` patch only after Human Seal or a narrow Fable5 audit.
