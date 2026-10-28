<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import { causeOf, groupByCause, readAs, uniqueById, type Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';

  // #4471 holds one ticket of merged reports. This table says how many reports each
  // problem inside it really holds, so the desk can split the ticket and count once.
  const TICKET = 4471;

  const rows = $derived(reports as Report[]);
  const unique = $derived(uniqueById(rows));
  const merged = $derived(unique.filter((r) => r.mergedInto === TICKET));
  const groups = $derived(groupByCause(merged, tenantOf));

  const parser = $derived(groups.find((g) => g.cause === 'parser'));
  const hint = $derived(groups.find((g) => g.cause === 'hint'));

  // The desk read these as a one-day move and filed them under the parser's cause.
  // Their cause is not a month/day swap, so they are counted with their own problem.
  const oneDay = $derived(parser ? readAs(parser, notes.oneDayMove) : 0);

  const problems = $derived([
    {
      cause: 'parser',
      problem: 'Month and day swapped in the shared parser',
      detail: 'The parser reads every date month first. Tenants that write the day first get flipped dates.',
      reports: (parser?.reports.length ?? 0) - oneDay,
      filed: parser?.reports.length ?? 0,
      tenants: parser?.tenants ?? 0,
      tag: 'parser',
    },
    {
      cause: 'hint',
      problem: 'The booking form prints the wrong order for the tenant',
      detail: 'booking-v3 prints MM/DD/YYYY, so the tenant types month first, and the form reads it the tenant’s way.',
      reports: hint?.reports.length ?? 0,
      filed: hint?.reports.length ?? 0,
      tenants: hint?.tenants ?? 0,
      tag: 'hint',
    },
    {
      cause: 'one-day move',
      problem: 'A one-day move, not a swap',
      detail: 'Dates shift by one day, usually across a timezone or a daylight-saving change.',
      reports: oneDay,
      filed: oneDay,
      tenants: new Set(
        (parser?.reports ?? []).filter((r) => notes.oneDayMove.includes(r.id)).map((r) => r.tenant),
      ).size,
      tag: 'read as a one-day move',
    },
  ]);

  const total = $derived(problems.reduce((n, p) => n + p.reports, 0));
  const repeatRows = $derived(rows.length - unique.length);
  const subjects = $derived(new Set(merged.map((r) => r.subject)).size);
  const taggedWrong = $derived(
    merged.filter((r) => r.meta.intakeTag !== (causeOf(r, tenantOf(r)) ?? 'unplaced')).length,
  );
</script>

<p class="sum">
  <strong>{total}</strong> reports in #{TICKET}, split into <strong>{problems.length}</strong> problems ·
  the export holds {rows.length} rows, so {repeatRows} of them repeat a report
</p>

<table>
  <thead>
    <tr><th>problem</th><th>reports</th><th>tenants</th><th>cause</th><th>what it is</th></tr>
  </thead>
  <tbody>
    {#each problems as p (p.cause)}
      <tr>
        <td><strong>{p.problem}</strong></td>
        <td>{p.reports}</td>
        <td>{p.tenants}</td>
        <td><code>{p.tag}</code></td>
        <td class="detail">{p.detail}</td>
      </tr>
    {/each}
    <tr class="total">
      <td><strong>total</strong></td>
      <td>{total}</td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>

<ul class="notes">
  <li>
    The desk files <code>{parser?.reports.length ?? 0}</code> reports under <code>parser</code>.
    {oneDay} of them are the one-day move, so the parser holds {problems[0].reports}.
  </li>
  <li>
    Intake's tag is a guess from the reporter's browser. It names the wrong cause for
    {taggedWrong} of the {total} reports, so it cannot be used to count.
  </li>
  <li>
    The ticket holds {subjects} different subject lines. One subject, merged many times,
    is not what #{TICKET} contains.
  </li>
</ul>

<style>
  .sum { font-size: 1.1rem; }
  .detail { color: var(--muted); font-size: 0.9em; }
  .total td { border-top: 2px solid var(--line); }
  .notes { color: var(--muted); font-size: 0.9em; }
  .notes li { margin-bottom: 0.35rem; }
</style>
