// Renders the page as the desk sees it: one self-contained HTML file with the CSS inlined,
// and a full-page screenshot.
//
//   node scripts/render.mjs
//
// It serves build/ over a local port, opens the page in Chromium, captures the styled DOM
// and every stylesheet rule, writes rendered/kb-4471-problems.html, and writes
// rendered/kb-4471-problems.png.
//
// Playwright is resolved from the machine's global install; set PLAYWRIGHT_CORE to point
// at it another way. It never touches the network beyond localhost.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'kb/incidents/4471/problems';
const OUT_HTML = join(ROOT, 'rendered/kb-4471-problems.html');
const OUT_PNG = join(ROOT, 'rendered/kb-4471-problems.png');

const require = createRequire(import.meta.url);
const candidates = [
  process.env.PLAYWRIGHT_CORE,
  'playwright-core',
  '/home/ckjackslack/.nvm/versions/node/v24.14.0/lib/node_modules/@playwright/cli/node_modules/playwright-core',
].filter(Boolean);

let chromium;
for (const c of candidates) {
  try {
    ({ chromium } = require(c));
    break;
  } catch {
    /* try the next one */
  }
}
if (!chromium) {
  console.error('playwright-core not found. Set PLAYWRIGHT_CORE to its path.');
  process.exit(1);
}

// Use a browser build that is already on this machine.
function findChromium() {
  const dir = join(process.env.HOME ?? '', '.cache/ms-playwright');
  if (!existsSync(dir)) return undefined;
  const builds = readdirSync(dir)
    .filter((d) => d.startsWith('chromium-'))
    .sort()
    .reverse();
  for (const b of builds) {
    const p = join(dir, b, 'chrome-linux', 'chrome');
    if (existsSync(p)) return p;
  }
  return undefined;
}

// A static server for build/, so the page loads over http like it does on the desk.
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const file = join(ROOT, 'build', path);
  if (!existsSync(file) || !file.startsWith(join(ROOT, 'build'))) {
    res.writeHead(404).end('not found');
    return;
  }
  const ext = path.slice(path.lastIndexOf('.'));
  res.writeHead(200, { 'content-type': types[ext] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
await page.goto(`http://127.0.0.1:${port}/${PAGE}.html`, { waitUntil: 'networkidle' });

const captured = await page.evaluate(() => {
  const css = [...document.styleSheets]
    .flatMap((s) => {
      try {
        return [...s.cssRules].map((r) => r.cssText);
      } catch {
        return [];
      }
    })
    .join('\n');
  const clone = document.documentElement.cloneNode(true);
  clone.querySelectorAll('script').forEach((n) => n.remove());
  clone.querySelectorAll('link[rel="modulepreload"]').forEach((n) => n.remove());
  clone.querySelectorAll('link[rel="stylesheet"]').forEach((n) => n.remove());
  const style = document.createElement('style');
  style.textContent = css;
  clone.querySelector('head').appendChild(style);
  return { html: '<!doctype html>\n' + clone.outerHTML, deskRef: document.body.innerText.match(/DR-[A-Z0-9-]{8,}/)?.[0] ?? null };
});

writeFileSync(OUT_HTML, captured.html);
await page.screenshot({ path: OUT_PNG, fullPage: true });
await browser.close();
server.close();

console.log(`wrote rendered/kb-4471-problems.html (${captured.html.length} bytes)`);
console.log(`wrote rendered/kb-4471-problems.png`);
console.log(`desk ref on the page: ${captured.deskRef}`);
