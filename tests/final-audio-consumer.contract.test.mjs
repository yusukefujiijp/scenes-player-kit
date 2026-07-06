import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const scenesPath = path.join(repoRoot, 'scenes.json');
const playerCorePath = path.join(repoRoot, 'js', 'player-core.js');

const scenesJson = JSON.parse(fs.readFileSync(scenesPath, 'utf8'));
const playerCore = fs.readFileSync(playerCorePath, 'utf8');

function compact(source) {
  return String(source).replace(/\s+/g, ' ');
}

function assertIncludes(source, needle, message = `Expected source to include ${needle}`) {
  assert.ok(String(source).includes(needle), message);
}

function assertMatches(source, pattern, message = `Expected source to match ${pattern}`) {
  assert.match(String(source), pattern, message);
}

function getSceneByPage(page) {
  const scene = (scenesJson.scenes || []).find((entry) => String(entry.page) === String(page));
  assert.ok(scene, `Expected scenes.json to contain page ${page}`);
  return scene;
}

test('Page003 is wired to the final MP3 asset contract', () => {
  const page003 = getSceneByPage('3');

  assert.equal(page003.type, 'content');
  assert.equal(page003.audioKey, 'page.003.final');
  assert.equal(page003.audioStatus, 'final');
  assert.equal(page003.audioUrl, './assets/audio/final/page-003-scattered-room-v001.mp3');
  assert.equal(page003.audioDurationMs, 9326);
  assert.equal(page003.audioGain, 0.9);

  assert.equal(
    scenesJson.audio?.library?.['page.003.final'],
    page003.audioUrl,
    'audio.library page.003.final must match Page003 audioUrl'
  );
});

test('player-core exposes the Final Audio layer symbols and detection contract', () => {
  assertIncludes(playerCore, 'let currentAudio = null;');
  assertIncludes(playerCore, 'function emitAudioEvent');
  assertIncludes(playerCore, 'function hasFinalAudio(scene)');
  assertIncludes(playerCore, 'function stopFinalAudio(reason)');
  assertIncludes(playerCore, 'function playFinalAudio(scene, navTokenAtStart)');

  assertMatches(
    compact(playerCore),
    /String\(scene && scene\.audioStatus \|\| ''\)\.toLowerCase\(\) === 'final'/,
    'hasFinalAudio must require audioStatus final'
  );
  assertMatches(
    compact(playerCore),
    /typeof scene\.audioUrl === 'string'.*trim\(\)\.length > 0/,
    'hasFinalAudio must require a non-empty audioUrl'
  );
});

test('playFinalAudio uses an app-owned HTML audio element', () => {
  assertIncludes(playerCore, "document.createElement('audio')");
  assertMatches(playerCore, /el\.src\s*=\s*String\(scene\.audioUrl\s*\|\|\s*''\)/);
  assertIncludes(playerCore, 'el.preload =');
  assertIncludes(playerCore, 'el.volume =');
  assertIncludes(playerCore, "el.setAttribute('playsinline', 'true')");
  assertIncludes(playerCore, "el.setAttribute('webkit-playsinline', 'true')");
  assertIncludes(playerCore, 'document.body.appendChild(el)');
  assertIncludes(playerCore, 'el.play()');
});

test('Final MP3 completion is event-driven, not audioDurationMs timer-driven', () => {
  assertIncludes(playerCore, 'el.onended =');
  assertIncludes(playerCore, "emitAudioEvent('player:audio-end'");
  assertMatches(playerCore, /finish\(\{\s*kind\s*:\s*'ended'\s*\}\)/);
  assert.equal(
    playerCore.includes('audioDurationMs'),
    false,
    'player-core must not use audioDurationMs as a playback timer'
  );
});

test('fallback to Live TTS is limited to explicit pre-playback fallback results', () => {
  const normalized = compact(playerCore);

  assertMatches(
    normalized,
    /if\(res && res\.kind === 'fallback'\)\{ await runContentSpeech\(scene\); \}/,
    'runContentSpeech fallback must be gated by res.kind === fallback'
  );

  assertMatches(
    normalized,
    /if\(started\) return finish\(\{ kind:'error-mid' \}\); return finish\(\{ kind:'fallback' \}\);/,
    'audio errors after start must return error-mid, while pre-start errors may fallback'
  );

  assertMatches(
    normalized,
    /if\(started\) finish\(\{ kind:'error-mid' \}\); else finish\(\{ kind:'fallback' \}\);/,
    'play rejection after start must not become fallback'
  );
});

test('Final audio kill path is connected to Stop, Hard Stop, navigation, and stale navigation', () => {
  assertIncludes(playerCore, "stopFinalAudio('stop-pressed')", 'Soft Stop must stop final audio');
  assertIncludes(playerCore, "stopFinalAudio('hard-stop')", 'Hard Stop must stop final audio');
  assertIncludes(playerCore, "stopFinalAudio('nav-goto')", 'gotoPage must stop final audio');
  assertIncludes(playerCore, "stopFinalAudio('nav-next')", 'gotoNext must stop final audio');
  assertIncludes(playerCore, "stopFinalAudio('nav-prev')", 'gotoPrev must stop final audio');
  assertIncludes(playerCore, "stopFinalAudio('stale-navigation')", 'stale nav token must stop final audio');
});

test('Final MP3 path skips Live TTS except when the final audio layer returns fallback', () => {
  const normalized = compact(playerCore);

  assertMatches(
    normalized,
    /if\(hasFinalAudio\(scene\)\)\{ const res = await playFinalAudio\(scene, myTok\); if\(res && res\.kind === 'fallback'\)\{ await runContentSpeech\(scene\); \} \} else \{ await runContentSpeech\(scene\); \}/,
    'Final audio scenes must skip Live TTS unless playFinalAudio returns fallback'
  );
});
