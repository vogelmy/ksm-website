/**
 * Renders scripts/og/og.html to public/og.png (1200x630), the card platforms
 * show when the site is shared.
 *
 *   node scripts/og/render.mjs
 *
 * Uses the Chrome already on the machine rather than downloading a browser.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

const chrome = CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error('No Chrome found. Install Chrome or edit CANDIDATES in this file.');
  process.exit(1);
}

const src = pathToFileURL(resolve('scripts/og/og.html')).href;
const out = resolve('public/og.png');
const profile = mkdtempSync(join(tmpdir(), 'ksm-og-'));

try {
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-prefers-reduced-motion',
      `--user-data-dir=${profile}`,
      '--window-size=1200,630',
      '--virtual-time-budget=8000',
      `--screenshot=${out}`,
      src,
    ],
    { stdio: 'inherit' }
  );
  console.log('wrote', out);
} finally {
  rmSync(profile, { recursive: true, force: true });
}
