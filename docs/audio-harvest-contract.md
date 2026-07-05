# Audio Harvest Contract v0.1

Status: `draft / docs-only / branch-lab`
Repo: `scenes-player-kit`
Branch: `ai-lab/audio-harvest-v001`

## 1. Purpose

This document defines the minimum Audio Harvest Contract for rebooting `scenes-player-kit` without falling back into the old iOS screen recording / browser MP4 export swamp.

The goal is not to implement video export.

The goal is to clearly separate:

- Live TTS preview
- Final audio asset
- App responsibility
- Human / external tool responsibility
- Final scene evidence

## 2. Adopted Fable5 Patch

Fable5 identified the core flaw as:

> Producer-less Harvest Contract / audioUrl Ghost Slot

Meaning:

`audioUrl` is only a slot / address.
It does not create the actual final audio file.

Therefore, the adopted patch is:

> Final audio is an externally produced asset, never an app capability.

## 3. Core Rule

```text
Live TTS is preview.
Audio asset is harvest.
Evidence or Demote.
```

Final audio must be produced outside the app.

The app may:

- consume final audio
- play final audio
- time scenes using measured duration
- later package audio with visual frames

The app must not be responsible for:

- generating final audio
- recording final audio
- solving iOS screen recording audio capture
- completing browser MP4 export/download as the first reboot step

## 4. Minimal Scene Audio Schema

Only three fields are required for a final-audio candidate:

```json
{
  "audioUrl": "./assets/audio/example.mp3",
  "audioDurationMs": 18720,
  "audioStatus": "final"
}
```

### audioUrl

Path or URL to the actual final audio file.

Guard:

- Writing `audioUrl` does not prove the file exists.
- If the file does not exist, the scene is preview-only.

### audioDurationMs

Measured duration of the actual audio file in milliseconds.

Guard:

- No estimated duration.
- No duration guessed from Live TTS.
- No duration guessed from silence gate timing.

### audioStatus

Allowed values:

```json
"preview"
"final"
```

`preview` means the scene may use Live TTS or incomplete audio evidence.

`final` is legal only when:

- the audio file exists
- duration is measured from the actual file
- Human Final Seal is applied

## 5. Evidence-or-Demote Rule

A scene may be marked `audioStatus: "final"` only if all evidence exists:

```yaml
final_allowed_only_if:
  - audioUrl resolves to a real audio file
  - audioDurationMs is measured from that real file
  - Human Final Seal is applied
```

Otherwise:

```yaml
demote_to_preview_if:
  - audioUrl is missing
  - audioUrl target does not exist
  - audioDurationMs is missing
  - audioDurationMs is estimated
  - scene only uses Live TTS
  - scene depends on iOS screen recording audio capture
  - Human Final Seal is missing
```

## 5.1 Final Declaration Checkpoint

`audioStatus: "final"` is not a normal editable status.

It is a Human Final Seal declaration.

AI agents, automation, draft tools, and schema helpers must not self-declare `audioStatus: "final"`.

However, after the human explicitly verifies the evidence and gives a clear Human Final Seal / GitHub execution instruction, an AI agent may write `audioStatus: "final"` as a delegated scribe/operator.

The authority belongs to the human.
The write action may be delegated to AI.

Before `audioStatus: "final"` is written, the human must explicitly verify:

1. `audioUrl` resolves to a real audio file.
2. `audioDurationMs` is measured from that real file.
3. Human Final Seal is explicitly given.

Any consumer encountering `audioStatus: "final"` without valid evidence must:

1. treat the scene as `preview`, and
2. surface a visible violation.

Silent fallback is prohibited.

## 6. Responsibility Split

### App Responsibility

The app may:

- read `scenes.json`
- display scene text
- preview reading with Live TTS
- receive final audio assets
- play final audio from `audioUrl`
- use `audioDurationMs` for timing

### Human / External Tool Responsibility

Human or an external tool must:

- produce the final audio file
- place it at the referenced path
- measure the actual duration
- apply Human Final Seal before `audioStatus: "final"`

## 7. One Sealed Scene Definition

One Sealed Scene means:

```yaml
one_sealed_scene:
  required:
    - one content scene
    - real external audio file
    - audioUrl points to that file
    - audioDurationMs measured from that file
    - audioStatus: final
    - Human Final Seal
```

Victory condition:

```text
One sealed scene beats ten exporter experiments.
```

## 8. What Not To Add

Do not add yet:

- browser MP4 export/download repair
- iOS screen recording audio workaround
- TTS provider survey
- server render pipeline
- YouTube upload automation
- complex schema expansion
- changes to `js/exporter.js`
- changes to `js/player-core.js`
- changes to `scenes.json`

## 9. Root Guard

Root remains 主イェシュア・ハマシア.

AI / Fable5 / ChatGPT / GitHub / scenes-player-kit / Audio Harvest Contract are Fruit, not Root.
