// tools/generate-tts-json.mjs
// Usage:
//   node tools/generate-tts-json.mjs               # write to assets/tts-rules.json
//   node tools/generate-tts-json.mjs tmp/out.json  # write to custom path (CI用)
//
// Reads:  docs/tts-kv.txt  (KV & regex lines)
// Writes: assets/tts-rules.json (or given out path)

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const TXT_PATH = path.join(repoRoot, 'docs', 'tts-kv.txt');
const DEFAULT_OUT = path.join(repoRoot, 'assets', 'tts-rules.json');
const outPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_OUT;

function normalizeQuoted(s){
  let t = String(s || '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseLine(line){
  const L = line.trim();
  if (!L || L.startsWith('#')) return null;

  // /regex/flags: replacement
  const reMatch = L.match(/^\/(.+)\/([a-z]*)\s*:\s*(.+)$/u);
  if (reMatch) {
    const body = reMatch[1];
    const flags = (reMatch[2] || '') + 'u';
    const repl  = normalizeQuoted(reMatch[3]);
    return { type:'regex', pattern: body, flags, repl };
  }

  // key: value   or   "key": "value"
  const kvMatch = L.match(/^(.+?)\s*:\s*(.+)$/s);
  if (kvMatch) {
    const key = normalizeQuoted(kvMatch[1]);
    const val = normalizeQuoted(kvMatch[2]);
    if (key.length) return { type:'kv', key, val };
  }
  return null;
}

async function main(){
  // read txt
  let txt;
  try {
    txt = await fs.readFile(TXT_PATH, 'utf8');
  } catch (e) {
    console.error(`[gen] Cannot read ${TXT_PATH}.`, e.message);
    process.exit(1);
  }
  const lines = txt.split(/\r?\n/);

  const kv = new Map();
  const regex = [];

  for (const ln of lines) {
    const r = parseLine(ln);
    if (!r) continue;
    if (r.type === 'kv') {
      kv.set(r.key, r.val);
    } else if (r.type === 'regex') {
      regex.push({ pattern: r.pattern, flags: r.flags, repl: r.repl });
    }
  }

  // stable order
  const kvObj = {};
  [...kv.keys()].sort((a,b)=> a.localeCompare(b, 'ja')).forEach(k => { kvObj[k] = kv.get(k); });

  const outObj = { kv: kvObj, regex };

  // ensure dir
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  // write with trailing newline
  await fs.writeFile(outPath, JSON.stringify(outObj, null, 2) + '\n', 'utf8');

  console.log(`[gen] Wrote ${outPath} (${Object.keys(kvObj).length} kv, ${regex.length} regex)`);
}

main().catch(e => {
  console.error('[gen] Fatal:', e);
  process.exit(1);
});