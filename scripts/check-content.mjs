/**
 * Content compliance check.
 *
 * KSM may not sell, imply or advertise credit repair, credit improvement, or
 * guaranteed funding outcomes. This scans the built HTML and fails the build if
 * any claim language appears, so it cannot creep back in through a later edit.
 *
 * Negation is judged per SENTENCE, not by a character window — a disclaimer
 * elsewhere in the paragraph must never excuse a claim made here.
 *
 *   Allowed: "KSM is not a credit repair organization."
 *   Allowed: "Is KSM a debt settlement company? No. KSM does not ..."
 *   Blocked: "We raise your score. KSM is not a lender."
 *
 *   node scripts/check-content.mjs [dir]
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.argv[2] || 'dist';

/** Never acceptable, negated or not. */
const FORBIDDEN = [
  /we\s+(can\s+)?(get|got)\s+you\s+(funded|approved)/,
  /(repair|fix|clean\s+up|restore)\s+your\s+credit/,
  /(guaranteed|guarantee)\s+results/,
];

/** Permitted only inside a negation. */
const NEGATION_ONLY = [
  /guarantee[ds]?\s+(approval|funding|financing|outcomes?|savings)/,
  /guaranteed\s+(rate|limit|score|approval)/,
  /(raise|boost|increase|improve)\s+(your\s+)?(credit\s+)?score/,
  /(remove|delete|erase|wipe)\s+(negative|derogatory|late\s+payments|collections)/,
  /score\s+increase/,
  /credit\s+repair/,
  /credit\s+restoration/,
  /debt\s+settlement/,
  /debt\s+relief/,
  /disputes?\b/,
  /\d+\s*point\s+(increase|jump|boost)/,
];

const NEGATION_CUES =
  /\b(not|never|no|none|cannot|can't|doesn't|don't|isn't|aren't|without|neither|nor|nothing)\b/i;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

/** Strip markup so the check runs on what a reader actually sees. */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

const splitSentences = (text) => text.match(/[^.?!]+[.?!]*/g) || [text];

function allowed(sentence, matchIndex, nextSentence) {
  if (NEGATION_CUES.test(sentence.slice(0, matchIndex))) return true;
  // A question may be denied by the sentence that answers it.
  if (/\?\s*$/.test(sentence.trim()) && nextSentence && NEGATION_CUES.test(nextSentence)) return true;
  return false;
}

const violations = [];

for (const file of walk(ROOT)) {
  const where = relative(ROOT, file).split(/[\\/]/).join('/');
  const parts = splitSentences(visibleText(readFileSync(file, 'utf8')));

  parts.forEach((sentence, i) => {
    const next = parts[i + 1] || '';

    for (const re of FORBIDDEN) {
      for (const m of sentence.matchAll(new RegExp(re.source, 'gi'))) {
        violations.push({ file: where, kind: 'forbidden claim', match: m[0], context: sentence.trim() });
      }
    }

    for (const re of NEGATION_ONLY) {
      for (const m of sentence.matchAll(new RegExp(re.source, 'gi'))) {
        if (allowed(sentence, m.index, next)) continue;
        violations.push({
          file: where,
          kind: 'sensitive term used without a negation',
          match: m[0],
          context: sentence.trim(),
        });
      }
    }
  });
}

if (violations.length === 0) {
  console.log('Content check passed — no credit-repair, credit-improvement or guaranteed-outcome claims found.');
  process.exit(0);
}

console.error('\nCONTENT CHECK FAILED — ' + violations.length + ' issue(s):\n');
for (const v of violations) {
  console.error('  ' + v.file);
  console.error('    ' + v.kind + ': "' + v.match + '"');
  console.error('    ...' + v.context.slice(0, 150) + '...\n');
}
console.error('KSM may not advertise credit repair, credit improvement, or guaranteed funding outcomes.');
console.error('Remove the claim, or state it as an explicit negation ("KSM does not ...").\n');
process.exit(1);
