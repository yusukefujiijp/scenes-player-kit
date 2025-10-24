# TTS-DICTIONARY (Human-editable)

> Format: priority | type | match | replacement | scope | flags | comment
>
> - priority: high | medium | low
> - type: exact | phrase | regex
> - match: exact/phrase text or regex pattern (without surrounding / /)
> - replacement: text to output for TTS
> - scope: all | title | body (optional; default: all)
> - flags: regex flags (optional; e.g. i,u,m)
> - comment: editor note (why this rule exists)

## Rules (one rule per line, pipe-separated)

high | exact | 一日 | いちにち | all |  | "Avoid reading as ついたち in everyday context"
high | regex | \b([0-9]{1,2})月([0-9]{1,2})日\b | $1がつ$2にち | all | u | "Numeric month/day -> Japanese reading"
medium | phrase | 〜によって | 〜により | body |  | "Normalize formal phrasing"
low | regex | (?<=第)\s*([一二三四五六七八九十百千0-9]+)\s*(章|節) | $1$2 | title | u | "Chapter numerals normalization"

## Editing notes
- Use `exact` for short fixed words (safe, first preference).
- Use `phrase` for multi-word sequences.
- Use `regex` only when necessary; prefer Unicode-aware flags (`u`) and anchor boundaries.
- Order matters: generator will sort by priority (high → low) and apply in that order.
- After editing, run: `node tools/generate-tts-json.js` to update `docs/tts-dictionary.json`.