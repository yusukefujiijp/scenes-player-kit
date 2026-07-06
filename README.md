# scenes-player-kit

**iOS-first scene player kit for YusukeJP x AI-Collaborator.**

This repository is a small, scene-driven runtime for testing short visual/audio sequences on iPhone. It currently serves two different audio purposes:

- **Live TTS preview** for drafting, checking, and quick iteration.
- **Final MP3 harvest** for deterministic playback and production-like runtime checks.

Root rule:

> **Final MP3 is harvest. Live TTS is preview.**

This README is the project-level entry gate for future humans and AI collaborators. Read this before changing branches, audio behavior, runtime links, or player internals.

---

## 1. Current operating branch

- **Living branch:** `dev`
- **Main branch:** stale / do not touch casually.
- **PR #11:** unsafe / do not touch unless YusukeJP gives an explicit Human Seal.

When in doubt, work only on `dev` and touch only the file explicitly named by the current task.

---

## 2. Live runtime links

Tap links:

- [GitHub Pages Runtime](https://yusukefujiijp.github.io/scenes-player-kit/)
- [GitHub Pages Runtime Test](https://yusukefujiijp.github.io/scenes-player-kit/?v=hardstop-core1) — Trusted Tap URL candidate; direct-open was observed, but this is platform/session-controlled and not guaranteed.
- [Page003 Final MP3](https://yusukefujiijp.github.io/scenes-player-kit/assets/audio/final/page-003-scattered-room-v001.mp3) — direct asset verification.

The runtime app link tests the app. The MP3 link only verifies the final audio asset.

---

## 3. Current status

- Page003 final MP3 route: **PASS**.
- Page003 MP3 Stop / Hard Stop / Next kill path: **PASS**.
- Live TTS Red Stop: **best-effort / browser-managed / mystery parked**.
- Issue #13 should remain open until final human runtime seal.

This project has already proven the important design boundary:

> The app can own and kill a final MP3 Audio object deterministically. It cannot fully own browser-managed `speechSynthesis` in the same way.

---

## 4. Core doctrine

- **The kill path is the patch.**
- **Evidence or Demote.**
- **Final MP3 is harvest.**
- **Live TTS is preview.**
- **Mystery Mode converts anomalies into design boundaries.**

A runtime mystery is not noise. It is diagnostic evidence. Once the boundary is found, record it and move forward.

---

## 5. Audio policy

### Final MP3

Final MP3 is the harvest path.

- It is an app-owned `Audio` object.
- `Stop`, `Hard Stop`, `Next`, `Prev`, and stale navigation can directly interrupt it.
- No Live TTS fallback should occur after mid-play interruption or user stop.
- Page003 final MP3 is the current proof case.

### Live TTS

Live TTS is the preview path.

- It is browser-managed through `speechSynthesis`.
- It is useful for drafting, checking, and early iteration.
- It is not the final deterministic audio path.
- Red Stop behavior may remain probabilistic on iOS.

Do not keep patching Live TTS Stop behavior unless a dedicated future issue makes it product-critical.

---

## 6. Runtime evidence

Observed on iPhone / ChatGPT-led runtime testing:

| Page | Audio mode | Stop observation | Interpretation |
|---|---|---|---|
| Page003 | Final MP3 | one tap | app-owned kill path |
| Page004 | Live TTS | may require two taps | browser-owned producer depth |
| Page005 | Live TTS | may require three taps | deeper TTS queue / role / watchdog state |

Working model:

> **Tap Count may reflect hidden browser-owned producer depth.**

This remains an observation-based model, not a claim about browser internals.

---

## 7. Link policy

A direct MP3 is a file, not a place.

Direct media asset links may open more smoothly because they resolve to a passive file resource. Runtime app links, GitHub commits, issues, PRs, and docs are interactive destinations and may trigger platform confirmation. Ark does not attempt to bypass platform-controlled confirmation behavior.

### Link classes

| Class | Use | Expected behavior |
|---|---|---|
| Direct Asset Link | MP3 / media / asset delivery verification | may open smoothly |
| Runtime App Link | actual GitHub Pages runtime testing | confirmation tap may appear |
| Trusted Tap URL | exact runtime URL with observed direct-open behavior | useful, not guaranteed |
| Code / Audit Link | commits / PRs / issues / file views | confirmation tap expected |
| Documentation Link | README / docs | confirmation tap expected |
| Copy-only URL | Full Rail / handoff blocks | copy target, not tap target |

Trusted Tap URL rule:

> A previously opened exact runtime URL may behave as a Trusted Tap URL in the current platform/session. This is useful for Tap & Open Rail, but it is platform-controlled and not guaranteed.

For routine testing, reuse one stable tap link when possible. Use cache-busted or audit URLs when needed, but treat them as confirmation-expected or copy-only.

---

## 8. Mystery Mode findings

### TTS Mystery

Final MP3 and Live TTS are different ownership models.

- Final MP3: app-owned, deterministic kill path.
- Live TTS: browser-managed, best-effort cancellation.

Conclusion:

> **Final MP3 is harvest. Live TTS is preview.**

### Link Mystery

Direct MP3 was smooth because it is a file, not a place. A runtime URL may also become smooth if the exact href has already behaved as trusted/direct-open in the current platform session.

Conclusion:

> **Do not fake a file. Find the honest smooth rail.**

---

## 9. Branch / PR guard

- `dev` is the current living branch.
- `main` is not the operational truth right now.
- PR #11 is not a safe target.
- Do not merge, close, rewrite, or synchronize PR #11 unless YusukeJP explicitly says so.

Branch confusion has already consumed time. The current project posture is survival-line discipline: stay on `dev` unless a task explicitly says otherwise.

---

## 10. Do not touch without Human Seal

Do not change these unless the task explicitly says to do so:

- `main`
- PR #11
- schema files
- exporter pipeline
- GitHub workflows
- `scenes.json`
- `player-core.js` refactor
- TTS engine rewrite
- new queue manager
- broad architecture cleanup

If a future AI wants to touch any of these, stop and ask for a Human Seal first.

---

## 11. Next gates

Recommended order:

1. Write / update `js/README.md` as the runtime internals map.
2. Complete final human runtime evidence for Issue #13.
3. Decide whether Issue #13 can close after human runtime seal.
4. Only then consider broader cleanup.

Do not reopen the TTS Stop mystery or Link mystery unless there is a new product-critical reason.

---

## 12. Older local-development notes

Historical context from the earlier README remains useful but is no longer the top-level operating truth:

- The project started as an iPhone-first scene playback workflow.
- `scenes.json` carries scenario data and some self-documenting rules.
- `js/tts-sanitize.js` and related TTS utilities still matter for Live TTS preview.
- For local iPhone testing, a simple static server can still be used, for example `python3 -m http.server 8080`.

For JS internals, read `js/README.md` after it is created or refreshed.
