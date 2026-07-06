// Issue #13 text-contract regression test.
// This does not launch a browser or prove runtime audio playback.
// It freezes the sealed source/data shape for the Final MP3 harvest path.
// TTS rules / KV fallback behavior is outside this Issue #13 contract.

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
const playerCoreRuntimeSource = stripJsComments(playerCore);

function compact(source) {
  return String(source).replace(/\s+/g, ' ');
}

function stripJsComments(source) {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
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

function finalAudioScenes() {
  return (scenesJson.scenes || []).filter(
    (scene) => String(scene?.audioStatus || '').toLowerCase() === 'final'
  );
}

function isRemoteUrl(url) {
  return /^https?:\/\//i.test(String(url || ''));
}

function localAssetPathFromUrl(audioUrl) {
  const withoutQuery = String(audioUrl || '').split(/[?#]/)[0];
  const normalized = withoutQuery.replace(/^\.\//, '');
  return path.join(repoRoot, normalized);
}

test('Page003 is wired to the final MP3 asset contract', () => {
  const page003 = getSceneByPage('3');

  assert.equal(page003.type, 'content');
  assert.equal(page003.audioKey, 'page.003.final');
  assert.equal(page003.audioStatus, 'final');
  assert.equal(page003.audioUrl, './assets/audio/final/page-003-scattered-room-v001.mp3');
  assert.equal(Number.isFinite(page003.audioDurationMs), true, 'Page003 audioDurationMs must be numeric metadata');
  assert.ok(page003.audioDurationMs > 0, 'Page003 audioDurationMs must be positive metadata');
  assert.equal(page003.audioGain, 0.9);

  assert.equal(
    scenesJson.audio?.library?.['page.003.final'],
    page003.audioUrl,
    'audio.library page.003.final must match Page003 audioUrl'
  );
});

test('all final audio scenes point to existing local assets', () => {
  const finalScenes = finalAudioScenes();
  assert.ok(finalScenes.length > 0, 'Expected at least one final audio scene');

  for (const scene of finalScenes) {
    assert.equal(typeof scene.audioUrl, 'string', `Final scene page ${scene.page} must have string audioUrl`);
    assert.ok(scene.audioUrl.trim().length > 0, `Final scene page ${scene.page} must have non-empty audioUrl`);

    if (scene.audioKey) {
      assert.equal(
        scenesJson.audio?.library?.[scene.audioKey],
        scene.audioUrl,
        `audio.library ${scene.audioKey} must match final scene page ${scene.page} audioUrl`
      );
    }

    if (isRemoteUrl(scene.audioUrl)) continue;

    const assetPath = localAssetPathFromUrl(scene.audioUrl);
    assert.equal(
      fs.existsSync(assetPath),
      true,
      `Final scene page ${scene.page} local audio asset must exist: ${scene.audioUrl}`
    );
  }
});

test('player-core exposes the Final Audio layer symbols and detection contract', () => {
  assertIncludes(playerCoreRuntimeSource, 'let currentAudio = null;');
  assertIncludes(playerCoreRuntimeSource, 'function emitAudioEvent');
  assertIncludes(playerCoreRuntimeSource, 'function hasFinalAudio(scene)');
  assertIncludes(playerCoreRuntimeSource, 'function stopFinalAudio(reason)');
  assertIncludes(playerCoreRuntimeSource, 'function playFinalAudio(scene, navTokenAtStart)');

  assertMatches(
    compact(playerCoreRuntimeSource),
    /String\(scene && scene\.audioStatus \|\| ''\)\.toLowerCase\(\) === 'final'/,
    'hasFinalAudio must require audioStatus final'
  );
  assertMatches(
    compact(playerCoreRuntimeSource),
    /typeof scene\.audioUrl === 'string'.*trim\(\)\.length > 0/,
    'hasFinalAudio must require a non-empty audioUrl'
  );
});

test('playFinalAudio uses an app-owned HTML audio element', () => {
  assertIncludes(playerCoreRuntimeSource, "document.createElement('audio')");
  assertMatches(playerCoreRuntimeSource, /el\.src\s*=\s*String\(scene\.audioUrl\s*\|\|\s*''\)/);
  assertIncludes(playerCoreRuntimeSource, 'el.preload =');
  assertIncludes(playerCoreRuntimeSource, 'el.volume =');
  assertIncludes(playerCoreRuntimeSource, "el.setAttribute('playsinline', 'true')");
  assertIncludes(playerCoreRuntimeSource, "el.setAttribute('webkit-playsinline', 'true')");
  assertIncludes(playerCoreRuntimeSource, 'document.body.appendChild(el)');
  assertIncludes(playerCoreRuntimeSource, 'el.play()');
});

test('Final MP3 completion is event-driven, not audioDurationMs timer-driven', () => {
  assertIncludes(playerCoreRuntimeSource, 'el.onended =');
  assertIncludes(playerCoreRuntimeSource, "emitAudioEvent('player:audio-end'");
  assertMatches(playerCoreRuntimeSource, /finish\(\{\s*kind\s*:\s*'ended'\s*\}\)/);
  assert.equal(
    playerCoreRuntimeSource.includes('audioDurationMs'),
    false,
    'player-core runtime source must not use audioDurationMs as a playback timer'
  );
});

test('fallback to Live TTS is limited to explicit pre-playback fallback results', () => {
  const normalized = compact(playerCoreRuntimeSource);

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
  assertIncludes(playerCoreRuntimeSource, "stopFinalAudio('stop-pressed')", 'Soft Stop must stop final audio');
  assertIncludes(playerCoreRuntimeSource, "stopFinalAudio('hard-stop')", 'Hard Stop must stop final audio');
  assertIncludes(playerCoreRuntimeSource, "stopFinalAudio('nav-goto')", 'gotoPage must stop final audio');
  assertIncludes(playerCoreRuntimeSource, "stopFinalAudio('nav-next')", 'gotoNext must stop final audio');
  assertIncludes(playerCoreRuntimeSource, "stopFinalAudio('nav-prev')", 'gotoPrev must stop final audio');
  assertIncludes(playerCoreRuntimeSource, "stopFinalAudio('stale-navigation')", 'stale nav token must stop final audio');
});

test('Final MP3 path skips Live TTS except when the final audio layer returns fallback', () => {
  const normalized = compact(playerCoreRuntimeSource);

  assertMatches(
    normalized,
    /if\(hasFinalAudio\(scene\)\)\{ const res = await playFinalAudio\(scene, myTok\); if\(res && res\.kind === 'fallback'\)\{ await runContentSpeech\(scene\); \} \} else \{ await runContentSpeech\(scene\); \}/,
    'Final audio scenes must skip Live TTS unless playFinalAudio returns fallback'
  );
});
