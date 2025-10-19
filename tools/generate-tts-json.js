// tools/generate-tts-json.js
// Usage: node tools/generate-tts-json.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MD = path.resolve(__dirname, '..', 'docs', 'TTS-DICTIONARY.md');
const OUT = path.resolve(__dirname, '..', 'docs', 'tts-dictionary.json');

if (!fs.existsSync(MD)) {
  console.error('[ERROR] docs/TTS-DICTIONARY.md not found. Create it from template first.');
  process.exit(1);
}

const text = fs.readFileSync(MD, 'utf8');
const lines = text.split(/\r?\n/);

const records = [];
let lineNo = 0;
for (const raw of lines) {
  lineNo++;
  const line = raw.trim();
  if (!line) continue;
  if (line.startsWith('#')) continue;
  if (line.startsWith('>')) continue;
  // Skip non-rule lines that are instruction text - heuristic: require at least one pipe
  if (line.indexOf('|') === -1) continue;

  // split on pipes but allow pipes inside quotes? we keep simple: split and trim
  const parts = line.split('|').map(s => s.trim());
  // Expect at least 4 fields: priority | type | match | replacement ; optional scope|flags|comment
  if (parts.length < 4) {
    console.error(`[ERROR] invalid format at ${MD}:${lineNo} -> need at least 4 pipe-separated fields. Line: "${line}"`);
    process.exit(1);
  }

  const [priority, type, match, replacement, scope = 'all', flags = '', comment = ''] = parts;

  // Basic validation
  const prio = priority.toLowerCase();
  if (!['high','medium','low'].includes(prio)) {
    console.error(`[ERROR] invalid priority at ${MD}:${lineNo} -> "${priority}" (allowed: high|medium|low)`);
    process.exit(1);
  }
  const t = type.toLowerCase();
  if (!['exact','phrase','regex'].includes(t)) {
    console.error(`[ERROR] invalid type at ${MD}:${lineNo} -> "${type}" (allowed: exact|phrase|regex)`);
    process.exit(1);
  }
  if (!match) {
    console.error(`[ERROR] empty match at ${MD}:${lineNo}`);
    process.exit(1);
  }
  // try compile regex if type === 'regex' to catch invalid regex early
  if (t === 'regex') {
    try {
      new RegExp(match, flags || 'u');
    } catch (err) {
      console.error(`[ERROR] invalid regex at ${MD}:${lineNo} -> ${err.message}`);
      process.exit(1);
    }
  }

  const id = crypto.createHash('sha1').update(`${prio}|${t}|${match}|${replacement}|${scope}|${flags}`).digest('hex').slice(0,12);

  records.push({
    id,
    priority: prio,
    type: t,
    match,
    replacement,
    scope: scope || 'all',
    flags: flags || '',
    comment: comment || '',
  });
}

// sort by priority (high->medium->low) stable
const rank = { high: 0, medium: 1, low: 2 };
records.sort((a,b) => {
  const r = rank[a.priority] - rank[b.priority];
  if (r !== 0) return r;
  return a.id.localeCompare(b.id);
});

// write JSON pretty
fs.writeFileSync(OUT, JSON.stringify(records, null, 2), 'utf8');
console.log(`[OK] Generated ${OUT} with ${records.length} rules.`);