<script lang="ts">
  import reports from '#lib/data/reports-4471.json';
  import notes from '#lib/data/desk-notes.json';
  import { causeOf, groupByCause, uniqueById, type Report } from '#lib/kb/causes';
  import { tenantOf } from '#lib/kb/locales';

  // #4471 holds one ticket of merged reports. This table says how many reports each
  // problem inside it holds, so the desk can split the ticket and count once.
  const TICKET = 4471;

  const rows = $derived(reports as Report[]);
  const unique = $derived(uniqueById(rows));
  const merged = $derived(unique.filter((r) => r.mergedInto === TICKET));
  const groups = $derived(groupByCause(merged, tenantOf));

  const parser = $derived(groups.find((g) => g.cause === 'parser'));
  const hint = $derived(groups.find((g) => g.cause === 'hint'));

  // The desk read these as a one-day move. It files them under the parser's cause and
  // footnotes them there, so they are counted with that cause and shown as open
  // questions, not as a problem of their own.
  const exceptions = $derived((parser?.reports ?? []).filter((r) => notes.oneDayMove.includes(r.id)));

  const problems = $derived([
    {
      cause: 'parser',
      problem: 'Month and day swapped in the shared parser',
      detail: 'The parser reads every date month first. Tenants that write the day first get flipped dates.',
      reports: parser?.reports.length ?? 0,
      tenants: parser?.tenants ?? 0,
      first: parser?.firstSeen ?? '',
      last: parser?.lastSeen ?? '',
    },
    {
      cause: 'hint',
      problem: 'The booking form prints the wrong order for the tenant',
      detail: 'booking-v3 prints MM/DD/YYYY, so the tenant types month first, and the form reads it the tenant’s way.',
      reports: hint?.reports.length ?? 0,
      tenants: hint?.tenants ?? 0,
      first: hint?.firstSeen ?? '',
      last: hint?.lastSeen ?? '',
    },
  ]);

  const total = $derived(problems.reduce((n, p) => n + p.reports, 0));
  const repeatRows = $derived(rows.length - unique.length);
  const subjects = $derived(new Set(merged.map((r) => r.subject)).size);
  const taggedWrong = $derived(merged.filter((r) => r.meta.intakeTag !== (causeOf(r, tenantOf(r)) ?? 'unplaced')).length);
</script>

<p class="sum">
  <strong>{total}</strong> reports in #{TICKET}, split into <strong>{problems.length}</strong> problems ·
  the export holds {rows.length} rows, so {repeatRows} of them repeat a report
</p>

<table>
  <thead>
    <tr><th>problem</th><th>reports</th><th>tenants</th><th>cause</th><th>seen</th><th>what it is</th></tr>
  </thead>
  <tbody>
    {#each problems as p (p.cause)}
      <tr>
        <td><strong>{p.problem}</strong></td>
        <td>{p.reports}</td>
        <td>{p.tenants}</td>
        <td><code>{p.cause}</code></td>
        <td>{p.first} → {p.last}</td>
        <td class="detail">{p.detail}</td>
      </tr>
    {/each}
    <tr class="total">
      <td><strong>total</strong></td>
      <td>{total}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>

<ul class="notes">
  <li>
    Intake's tag is a guess from the reporter's browser. It names the wrong cause for
    {taggedWrong} of the {total} reports, so it cannot be used to count.
  </li>
  <li>
    The ticket holds {subjects} different subject lines. One subject, merged many times,
    is not what #{TICKET} contains.
  </li>
  <li>
    {exceptions.length} of the {problems[0].reports} parser reports were read by the desk as a
    one-day move. They are counted in that cause, where the desk files them, and are listed
    below as open questions.
  </li>
</ul>

{#if exceptions.length}
  <h3>Open questions inside the parser group</h3>
  <p class="lede">
    These read as a one-day move, not a month and day swap. No root cause is established for
    them, and they are not counted again.
  </p>
  <table class="exceptions">
    <thead>
      <tr><th>report</th><th>tenant</th><th>channel</th><th>what the reporter wrote</th></tr>
    </thead>
    <tbody>
      {#each exceptions as r (r.id)}
        <tr>
          <td><code>{r.id}</code></td>
          <td>{r.tenant}</td>
          <td>{r.channel}</td>
          <td class="detail">{r.body}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  .sum { font-size: 1.1rem; }
  .detail { color: var(--muted); font-size: 0.9em; }
  .lede { color: var(--muted); }
  .total td { border-top: 2px solid var(--line); }
  .notes { color: var(--muted); font-size: 0.9em; }
  .notes li { margin-bottom: 0.35rem; }
  h3 { margin-top: 2rem; }
</style>
