// tools/validate-tts-kv.mjs
// Purpose: Ensure docs/tts-kv.txt and assets/tts-rules.json are logically consistent
// Usage: node tools/validate-tts-kv.mjs

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const TXT_PATH = path.join(repoRoot, 'docs', 'tts-kv.txt');
const JSON_PATH = path.join(repoRoot, 'assets', 'tts-rules.json');

function normalizeQuoted(s){
  let t = String(s || '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseTxt(txt){
  const kv = new Map();
  const regex = [];
  const lines = txt.split(/\r?\n/);
  for (const L0 of lines) {
    const L = L0.trim();
    if (!L || L.startsWith('#')) continue;
    const reMatch = L.match(/^\/(.+)\/([a-z]*)\s*:\s*(.+)$/u);
    if (reMatch) {
      const body = reMatch[1];
      const flags = (reMatch[2] || '') + 'u';
      const repl  = normalizeQuoted(reMatch[3]);
      regex.push({ pattern: body, flags, repl });
      continue;
    }
    const kvMatch = L.match(/^(.+?)\s*:\s*(.+)$/s);
    if (kvMatch) {
      const key = normalizeQuoted(kvMatch[1]);
      const val = normalizeQuoted(kvMatch[2]);
      if (key.length) kv.set(key, val);
      continue;
    }
    // ignore invalid lines
  }
  return { kv, regex };
}

function applyRules(s, kv, regexArr){
  let t = String(s || '');
  // KV: longer keys first
  const keys = [...kv.keys()].sort((a,b)=> b.length - a.length);
  for (const k of keys) {
    t = t.split(k).join(kv.get(k) || '');
  }
  // regex
  for (const r of regexArr) {
    try {
      const re = new RegExp(r.pattern, r.flags || 'u');
      t = t.replace(re, r.repl || '');
    } catch (e) {
      throw new Error(`Invalid regex: /${r.pattern}/${r.flags} -> ${e.message}`);
    }
  }
  return t;
}

async function main(){
  const [txtRaw, jsonRaw] = await Promise.all([
    fs.readFile(TXT_PATH, 'utf8'),
    fs.readFile(JSON_PATH, 'utf8').catch(()=> null)
  ]);

  const fromTxt = parseTxt(txtRaw);
  const jsonObj = jsonRaw ? JSON.parse(jsonRaw) : { kv:{}, regex:[] };

  // Compare sizes
  const kvTxtSize = fromTxt.kv.size;
  const kvJsonSize = Object.keys(jsonObj.kv || {}).length;
  const reTxtSize = fromTxt.regex.length;
  const reJsonSize = (jsonObj.regex || []).length;

  let ok = true;

  if (kvTxtSize !== kvJsonSize) {
    console.error(`[validate] KV size mismatch: txt=${kvTxtSize}, json=${kvJsonSize}`);
    ok = false;
  }
  if (reTxtSize !== reJsonSize) {
    console.error(`[validate] Regex size mismatch: txt=${reTxtSize}, json=${reJsonSize}`);
    ok = false;
  }

  // Shallow key diff (names only)
  const jsonKVKeys = new Set(Object.keys(jsonObj.kv || {}));
  for (const k of fromTxt.kv.keys()) {
    if (!jsonKVKeys.has(k)) { console.error(`[validate] Missing in JSON: KV key "${k}"`); ok = false; }
  }

  // Simple sample tests (must not throw)
  const samples = [
    '今日は令和6年10月19日です。会議は10時30分に始まります。参加者は3人です。',
    '距離は3.5km、重さは2kg、達成率は75%でした。',
    '一日は24時間です。'
  ];
  for (const s of samples) {
    try {
      const out1 = applyRules(s, fromTxt.kv, fromTxt.regex);
      if (!out1 || typeof out1 !== 'string') throw new Error('empty result');
    } catch (e) {
      console.error('[validate] Sample apply failed:', e.message);
      ok = false;
    }
  }

  if (!ok) {
    console.error('[validate] TTS dictionary validation failed.');
    process.exit(1);
  } else {
    console.log('[validate] OK: txt and json appear consistent, samples applied.');
  }
}

main().catch(e => {
  console.error('[validate] Fatal:', e);
  process.exit(1);
});