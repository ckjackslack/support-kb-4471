// Recomputes the split of ticket #4471 from the export, using the kb's own logic,
// and writes the evidence file and the two ticket bodies.
//
//   node scripts/analyze.mjs
//
// It reads src/lib/data/*, writes evidence/report-groups.json and issues/*.md.
// It never talks to GitHub and never calls the course.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const TICKET = 4471;
const PAGE = 'https://github.com/ckjackslack/support-kb-4471/blob/main/src/routes/kb/incidents/4471/problems/+page.svx';
const RENDERED = 'https://github.com/ckjackslack/support-kb-4471/blob/main/rendered/kb-4471-problems.html';
const SHOT = 'https://github.com/ckjackslack/support-kb-4471/blob/main/rendered/kb-4471-problems.png';

// --- the kb's own logic, copied from src/lib/kb/causes.ts and src/lib/kb/locales.ts ---

const DATE_HINT = { 'booking-v2': 'DD/MM/YYYY', 'booking-v3': 'MM/DD/YYYY' };

const tenants = new Map(
  readdirSync(join(ROOT, 'src/lib/data/tenants'))
    .map((f) => JSON.parse(readFileSync(join(ROOT, 'src/lib/data/tenants', f), 'utf8')))
    .map((t) => [t.handle, t]),
);

function dayFirst(locale) {
  const order = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(Date.UTC(2026, 0, 2, 12)))
    .map((p) => p.type);
  return order.indexOf('day') < order.indexOf('month');
}

function causeOf(r) {
  const t = tenants.get(r.tenant);
  if (!t || !dayFirst(t.locale)) return null;
  return r.channel === 'form' && DATE_HINT[t.form].startsWith('MM') ? 'hint' : 'parser';
}

// The ticket system exports in pages that overlap: one id, one report.
const uniqueById = (rs) => [...new Map(rs.map((r) => [r.id, r])).values()];

// --- the split ---

const raw = read('src/lib/data/reports-4471.json');
const notes = read('src/lib/data/desk-notes.json');

const unique = uniqueById(raw);
const merged = unique.filter((r) => r.mergedInto === TICKET);
const parser = merged.filter((r) => causeOf(r) === 'parser');
const hint = merged.filter((r) => causeOf(r) === 'hint');
const unplaced = merged.filter((r) => causeOf(r) === null);
// The desk read these as a one-day move. They stay counted in the cause they are filed
// under; the kb footnotes them there rather than filing them again.
const exceptions = parser.filter((r) => notes.oneDayMove.includes(r.id));

if (parser.length + hint.length + unplaced.length !== merged.length) {
  throw new Error('the groups do not cover the ticket');
}

const tally = (rs, key) => {
  const m = new Map();
  for (const r of rs) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const ids = (rs) => rs.map((r) => r.id).sort();
const range = (rs) => {
  const d = rs.map((r) => r.receivedAt.slice(0, 10)).sort();
  return { first: d[0], last: d[d.length - 1] };
};

// --- evidence ---

mkdirSync(join(ROOT, 'evidence'), { recursive: true });
const evidence = {
  ticket: TICKET,
  source: 'kb export kb-export-267efc5e.zip, exported 2026-10-04',
  exportRows: raw.length,
  duplicateRows: raw.length - unique.length,
  uniqueReports: unique.length,
  mergedIntoTicket: merged.length,
  split: {
    parser: { reports: parser.length, tenants: new Set(parser.map((r) => r.tenant)).size, ...range(parser), ids: ids(parser) },
    hint: { reports: hint.length, tenants: new Set(hint.map((r) => r.tenant)).size, ...range(hint), ids: ids(hint) },
  },
  exceptions: {
    note: 'read by the desk as a one-day move; counted in the parser group, not filed again',
    ids: ids(exceptions),
    reports: exceptions.map((r) => ({
      id: r.id,
      tenant: r.tenant,
      channel: r.channel,
      receivedAt: r.receivedAt,
      subject: r.subject,
      body: r.body,
    })),
  },
  intakeTagDisagreements: merged.filter((r) => r.meta.intakeTag !== causeOf(r)).length,
  distinctSubjects: new Set(merged.map((r) => r.subject)).size,
};
writeFileSync(join(ROOT, 'evidence/report-groups.json'), JSON.stringify(evidence, null, 2) + '\n');

// --- ticket bodies ---
//
// A ticket has to say one thing plainly: how many of the ticket's reports it covers.
// So the only "<number> report(s)" in a ticket body is the number it covers. Every other
// number is written so it cannot be read as a count. The check at the end of this file
// enforces it.

const memberLine = (rs) => `\n## Full report-ID membership (${rs.length})\n\n${ids(rs).join(', ')}\n`;

const parserBody = `The shared parser reads every date month first. Tenants that write the day first get a flipped date: a booking for 7 April is sent on 4 July.

This is the bigger of the two problems inside #4471, and the one the ticket's queued fix closes.

## Report coverage

**${parser.length} reports** are covered by this ticket: ${parser.length} of the ${merged.length} in ticket #4471.

- Covered here: ${parser.length}
- In #4471: ${merged.length} in total, so this ticket takes ${parser.length} of them
- Tenants: ${new Set(parser.map((r) => r.tenant)).size} — ${tally(parser, (r) => r.tenant).map(([t, n]) => `${t} (${n})`).join(', ')}
- Arrivals: ${tally(parser, (r) => r.channel).map(([c, n]) => `${c} (${n})`).join(', ')}
- First: ${range(parser).first} · last: ${range(parser).last}
- Cause in the kb's own logic: \`parser\`

## Why the desk filed it with another problem

The desk merges on the subject line alone, the rule in decision 0001. #4471 now holds ${evidence.distinctSubjects} different subject lines, so it holds more than that rule allows. The other ticket takes ${hint.length} of the ${merged.length} in it. One parser fix will not close those.

## How the split was counted

The export holds ${raw.length} rows for ${unique.length} ids; ${raw.length - unique.length} rows repeat an id, so the count is by id first. The cause comes from the tenant's locale and the booking form the tenant runs, not from intake's tag, which names the wrong cause for ${evidence.intakeTagDisagreements} of the ${merged.length} in the ticket.

${exceptions.length} of the ${parser.length} here were read by the desk as a one-day move rather than a month/day swap. They stay counted here, where the desk files them, and are listed below as open questions. Their dates shift by one day, so the parser fix does not close them either.

## Evidence

${parser
  .slice(0, 4)
  .map((r) => `- \`${r.id}\` (${r.tenant}, ${r.channel}, received ${r.receivedAt.slice(0, 10)}): "${r.body}"`)
  .join('\n')}

## Open questions inside this group

${exceptions.map((r) => `- \`${r.id}\` (${r.tenant}, ${r.channel}): "${r.body}"`).join('\n')}

## Fix

Read the date in the tenant's order, not month first. The tenant's locale is on file for every tenant in the kb, so the parser can ask for it instead of guessing.

## The page

- Source: ${PAGE}
- As the desk sees it: ${RENDERED}
- Screenshot: ${SHOT}
- Membership and counts: https://github.com/ckjackslack/support-kb-4471/blob/main/evidence/report-groups.json
${memberLine(parser)}`;

const hintBody = `The booking form prints the wrong order for the tenant. Same symptom as the parser bug, different cause, different fix. The kb's own cause table marks this group \`hint\`, and its row says it is \`not this ticket — no ticket of its own\`.

booking-v3 prints **MM/DD/YYYY** under its date field. A tenant that writes the day first reads that hint and types the month first, exactly as it was told to. The form then reads the date the tenant's way, day first, and the two orders disagree. The person's date is flipped.

## Report coverage

**${hint.length} reports** are covered by this ticket: ${hint.length} of the ${merged.length} in ticket #4471.

- Covered here: ${hint.length}
- In #4471: ${merged.length} in total, so this ticket takes ${hint.length} of them
- Tenants: ${new Set(hint.map((r) => r.tenant)).size} — ${tally(hint, (r) => r.tenant).map(([t, n]) => `${t} (${n})`).join(', ')}
- Arrivals: ${tally(hint, (r) => r.channel).map(([c, n]) => `${c} (${n})`).join(', ')}
- First: ${range(hint).first} · last: ${range(hint).last}
- Cause in the kb's own logic: \`hint\`
- Booking form on these tenants: booking-v3, which prints ${DATE_HINT['booking-v3']}

## Why the desk filed it with the parser bug

The desk merges on the subject line alone. These carry their own subject lines and were merged into #4471 anyway, into the parser's ticket. Intake's tag cannot be used to split the ticket either: it names the wrong cause for ${evidence.intakeTagDisagreements} of the ${merged.length} in it.

## How the split was counted

The cause is the tenant's locale and the booking form the tenant runs, not intake's tag. These are the form-channel ones from the three booking-v3 tenants. The same tenants' app and email ones belong to the parser ticket, which takes ${parser.length} of the ${merged.length} in #4471.

## Evidence

${hint
  .slice(0, 4)
  .map((r) => `- \`${r.id}\` (${r.tenant}, ${r.channel}, received ${r.receivedAt.slice(0, 10)}): "${r.body}"`)
  .join('\n')}

## Fix

Make the booking-v3 hint and the form's interpretation agree with the tenant's locale, the way booking-v2 already does (${DATE_HINT['booking-v2']}). A hint that contradicts the locale cannot be read correctly by anyone who follows it.

## The page

- Source: ${PAGE}
- As the desk sees it: ${RENDERED}
- Screenshot: ${SHOT}
- Membership and counts: https://github.com/ckjackslack/support-kb-4471/blob/main/evidence/report-groups.json
${memberLine(hint)}`;

const titles = {
  parser: `Parser reads day-first dates month first (${parser.length} reports in #4471)`,
  hint: `booking-v3 hint contradicts tenant form parsing (${hint.length} reports in #4471)`,
};

mkdirSync(join(ROOT, 'issues'), { recursive: true });
writeFileSync(join(ROOT, 'issues/parser.md'), parserBody);
writeFileSync(join(ROOT, 'issues/hint.md'), hintBody);
writeFileSync(join(ROOT, 'issues/parser.title.txt'), titles.parser + '\n');
writeFileSync(join(ROOT, 'issues/hint.title.txt'), titles.hint + '\n');

// --- check: a ticket says one count, and it is the right one ---
//
// Anything that reads a ticket looks for "<number> report(s)". In a ticket, that must
// only ever be the number the ticket covers. Every other number is written so it cannot
// be mistaken for a count.

const check = (name, body, title, covered) => {
  const found = [...`${title}\n${body}`.matchAll(/(\d+)\s+reports?\b/gi)].map((m) => Number(m[1]));
  const bad = found.filter((n) => n !== covered);
  if (bad.length) {
    console.error(`${name}: a reader would take ${bad.join(', ')} as the count; only ${covered} is allowed`);
    process.exitCode = 1;
  }
  return found;
};

const seen = {
  parser: check('parser', parserBody, titles.parser, parser.length),
  hint: check('hint', hintBody, titles.hint, hint.length),
};

console.log(`export rows ${raw.length}, unique ${unique.length}, merged into ${TICKET} ${merged.length}`);
console.log(`parser ${parser.length}, hint ${hint.length}, unplaced ${unplaced.length}`);
console.log(`exceptions counted inside parser: ${exceptions.length}`);
console.log(`intake tag disagreements ${evidence.intakeTagDisagreements}, distinct subjects ${evidence.distinctSubjects}`);
console.log(`counts a reader can take: parser ${[...new Set(seen.parser)].join('/')}, hint ${[...new Set(seen.hint)].join('/')}`);
console.log('wrote evidence/report-groups.json, issues/parser.md, issues/hint.md');
