// js/tts-kv-simple.js
let __kvPairs = [];      // [["一日","いちにち"], ...]
let __rxRules = [];      // [{re: /.../gu, to:"..."}, ...]
let __loaded = false;

function addKvPair(from, to){
  const a = String(from ?? '');
  const b = String(to ?? '');
  if (!a) return;
  __kvPairs.push([a, b]);
}
function addRegex(pattern, to, flags = 'gu'){
  try {
    const re = new RegExp(pattern, flags || 'gu');
    __rxRules.push({ re, to: String(to ?? '') });
  } catch(_) { /* ignore bad pattern */ }
}

function parseJsonRules(json){
  // 支持形: {kv:[["A","B"],...], regex:[["pat","rep","flags"],...]}
  if (Array.isArray(json)) {
    json.forEach(v => { if (Array.isArray(v) && v.length >= 2) addKvPair(v[0], v[1]); });
    return;
  }
  if (json && Array.isArray(json.kv)) {
    json.kv.forEach(v => { if (Array.isArray(v) && v.length >= 2) addKvPair(v[0], v[1]); });
  }
  if (json && Array.isArray(json.rules)) {
    // 互換名: rules を kv と見なす
    json.rules.forEach(v => { if (Array.isArray(v) && v.length >= 2) addKvPair(v[0], v[1]); });
  }
  if (json && Array.isArray(json.regex)) {
    json.regex.forEach(v => {
      if (Array.isArray(v) && v.length >= 2) addRegex(String(v[0]), String(v[1]), String(v[2]||'gu'));
    });
  }
}

function parseKvText(text){
  // 1行: left: right  / 空行・#コメント行は無視
  const lines = String(text||'').split(/\r?\n/);
  for (const ln of lines) {
    const s = ln.trim();
    if (!s || s.startsWith('#')) continue;
    const m = s.match(/^(.+?)\s*:\s*(.+)$/);
    if (m) addKvPair(m[1], m[2]);
  }
}

export async function loadTtsKv(){
  if (__loaded) return;
  __loaded = true;
  let ok = false;

  // 1) JSON を最優先で探す
  try{
    const r = await fetch('./assets/tts-rules.json', { cache: 'no-cache' });
    if (r.ok) {
      const j = await r.json();
      parseJsonRules(j);
      ok = true;
    }
  }catch(_){}

  // 2) 無ければ docs/tts-kv.txt（key: value 行形式）
  if (!ok) {
    try{
      const r2 = await fetch('./docs/tts-kv.txt', { cache: 'no-cache' });
      if (r2.ok) {
        const t = await r2.text();
        parseKvText(t);
        ok = true;
      }
    }catch(_){}
  }

  // 3) 何も無ければフェイルセーフ（最重要1件だけ内蔵）
  if (!ok) {
    addKvPair('一日', 'いちにち');
  }
}

export function applyTtsKv(text){
  let s = String(text ?? '');

  // 先に正規表現
  for (const {re, to} of __rxRules) {
    try { s = s.replace(re, to); } catch(_){}
  }
  // 次にリテラル
  for (const [from, to] of __kvPairs) {
    if (!from) continue;
    s = s.split(from).join(String(to ?? ''));
  }
  return s;
}

export default { loadTtsKv, applyTtsKv };