# kb — the support knowledge base

**kb** = knowledge base. What the support desk knows about how our products break, written
down where the code can keep it honest.

One desk takes reports for every product we run: `sched-prod` (calendar invites for about
300k people) and the rest. When something
goes wrong, the reports reach the desk first. This kb is how the desk triages them, what each
incident turned out to be, and why we decided what we decided.

## What's here

```
src/routes/kb/      the pages (.svx: Markdown with components)
  triage/           how the desk handles incoming reports
  incidents/        one page per big ticket
  decisions/        numbered decision records
src/lib/kb/         components and the logic they run
src/lib/layouts/    the frame every page shares
src/lib/data/       exports from the ticket system
```

## Conventions

- Words in the page, logic in `src/lib` (imported as `#lib/…`). A number that can be computed belongs in a component.
- Every page starts with frontmatter: `title`, `owner`, `status`, `reviewed`.
- A decision is never edited after it is accepted. A new record replaces it.
- A page you add is signed: its frontmatter carries your `signature` and it ends with `<RenderStamp {signature} />`, so the desk knows who wrote it.

## Owners

Support desk. Decision records: whoever signed them.

---

Exported 2026-10-04 from the `support` repo, `apps/kb/` → `src/`.

---

## Added for #4471

`src/routes/kb/incidents/4471/problems/+page.svx` is a page on what ticket #4471 really
holds. It is signed: its frontmatter carries the `signature` the course gave, and it ends
with `<RenderStamp {signature} />`, so the desk can tell who wrote it.

`src/lib/kb/ProblemsTable.svelte` computes the split. It calls the desk's own logic
(`groupByCause`, `uniqueById`), so the counts cannot drift away from the pages already in
here. The ticket holds **two** problems, and the two tickets for them are filed as issues
in this repository:

| issue | problem | reports |
|---|---|---|
| #1 | the shared parser reads every date month first | 379 |
| #2 | booking-v3 prints MM/DD/YYYY to tenants who write the day first | 33 |

379 + 33 = 412, every report in #4471. The five reports the desk read as a one-day move
stay counted in the parser group, where the desk files them; the page and issue #1 list
them as open questions, with their own words, and no root cause is claimed for them.
Issue #3 was a separate ticket for those five and is withdrawn and closed.

Each ticket says its count once, as "379 reports" or "33 reports", and every other number
in it is written so it cannot be read as a count. `scripts/analyze.mjs` writes the ticket
bodies and checks that rule before they are filed.

The export ships without an app shell, so this repository adds one: SvelteKit with mdsvex,
the same `#lib` alias the pages import, and a static adapter.

```
npm install
npm run build      # writes build/
npm run preview    # serves the site
```

`build/` is committed, so the page opens straight from the repository.
`rendered/kb-4471-problems.html` is that page as one self-contained file, with the CSS
inlined and no scripts, and `rendered/kb-4471-problems.png` is the screenshot of it.

```
node scripts/analyze.mjs   # recomputes the split, writes evidence/ and issues/
node scripts/render.mjs    # rewrites rendered/ from build/
```


