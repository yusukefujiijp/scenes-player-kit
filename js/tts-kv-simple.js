// js/tts-kv-simple.js
let EXACT = new Map();
let REGEX = []; // [{re, repl}]

function unquote(s) {
  if (!s) return s;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseLine(line) {
  // trim and ignore comments/blank
  const raw = line.trim();
  if (!raw || raw.startsWith('#')) return null;

  // regex to capture: "key" : "value"  OR key: value
  // groups: 1="double-quoted key",2='single-quoted key',3=unquoted key
  //        4="double-quoted value",5='single-quoted value',6=unquoted value
  const m = raw.match(/^\s*(?:"([^"]+)"|'([^']+)'|([^:]+?))\s*:\s*(?:"([^"]*)"|'([^']*)'|(.*?))\s*$/);
  if (!m) return null;

  const key = m[1] ?? m[2] ?? (m[3] ? m[3].trim() : '');
  const val = m[4] ?? m[5] ?? (m[6] ? m[6].trim() : '');

  if (!key) return null;
  return { key: key, replacement: val };
}

function tryParseRegexKey(key) {
  // detect /pattern/flags
  const m = key.match(/^\/(.+)\/([a-z]*)$/i);
  if (!m) return null;
  try {
    const pattern = m[1];
    const flags = m[2] || 'u';
    const re = new RegExp(pattern, flags);
    return { re, flags };
  } catch (err) {
    console.warn('[tts-kv] invalid regex key skipped:', key, err.message);
    return null;
  }
}

export async function loadTtsKv(url = 'docs/tts-kv.txt') {
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  EXACT = new Map();
  REGEX = [];

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const parsed = parseLine(raw);
    if (!parsed) continue;
    const key = parsed.key.trim();
    const repl = parsed.replacement ?? '';

    // if key quoted, unquote
    const uqKey = unquote(key);
    const uqRepl = unquote(repl);

    // regex key support: /pattern/flags
    const maybeRe = tryParseRegexKey(uqKey);
    if (maybeRe) {
      REGEX.push({ re: maybeRe.re, repl: uqRepl });
      continue;
    }
    // otherwise exact match (literal)
    EXACT.set(uqKey, uqRepl);
  }

  console.log('[tts-kv] loaded', { exact: EXACT.size, regex: REGEX.length });
}

export function applyTtsKv(input) {
  if (!input) return input;
  let out = input;

  // 1) exact replacements: simple global replacement (non-overlapping text split/join)
  if (EXACT.size) {
    // iterate keys in insertion order (Map preserves insertion)
    for (const [k, v] of EXACT) {
      if (out.includes(k)) out = out.split(k).join(v);
    }
  }

  // 2) regex replacements (in file order)
  for (const { re, repl } of REGEX) {
    out = out.replace(re, repl);
  }

  return out;
}