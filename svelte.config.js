import adapter from '@sveltejs/adapter-static';
import { mdsvex } from 'mdsvex';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

// The kb ships as an export of the support repo, so the app shell is ours to write:
// only the pages and the logic under src/lib are the desk's.
const runbook = path.resolve('./src/lib/layouts/runbook.svelte');

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: ['.svelte', '.svx'],
  preprocess: [vitePreprocess(), mdsvex({ extensions: ['.svx'], layout: { _: runbook, runbook } })],
  kit: {
    adapter: adapter({ fallback: null }),
    alias: { '#lib': path.resolve('./src/lib') },
  },
};

export default config;
