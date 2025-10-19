// tools/validate-tts-json.js
// Usage: node tools/validate-tts-json.js
const fs = require('fs');
const path = require('path');

const IN = path.resolve(__dirname, '..', 'docs', 'tts-dictionary.json');
if (!fs.existsSync(IN)) {
  console.error('[ERROR] docs/tts-dictionary.json not found. Run generate script first.');
  process.exit(1);
}
let arr;
try {
  arr = JSON.parse(fs.readFileSync(IN, 'utf8'));
} catch (err) {
  console.error('[ERROR] invalid JSON:', err.message);
  process.exit(1);
}
if (!Array.isArray(arr)) {
  console.error('[ERROR] JSON must be an array of rules.');
  process.exit(1);
}

const ids = new Set();
const exacts = new Set();
for (const r of arr) {
  if (!r.id || !r.priority || !r.type || !r.match || typeof r.replacement === 'undefined') {
    console.error('[ERROR] missing required fields in rule:', JSON.stringify(r));
    process.exit(1);
  }
  if (ids.has(r.id)) {
    console.error('[ERROR] duplicate id:', r.id);
    process.exit(1);
  }
  ids.add(r.id);
  if (r.type === 'exact') {
    if (exacts.has(r.match)) {
      console.error('[ERROR] duplicate exact match:', r.match);
      process.exit(1);
    }
    exacts.add(r.match);
  }
  if (r.type === 'regex') {
    try {
      new RegExp(r.match, r.flags || 'u');
    } catch (err) {
      console.error('[ERROR] invalid regex in rule id', r.id, ':', err.message);
      process.exit(1);
    }
  }
}

console.log('[OK] tts-dictionary.json validated: rules=', arr.length);