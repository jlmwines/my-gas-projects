#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// push-pages.js — Push WP pages to staging from .page.md files
//
// File format:
//   ## PAGE TITLE
//   <title>
//
//   ## BODY
//   <first line is meta note, skipped>
//   <rest is the page content — pushed verbatim>
//
// Usage:
//   node content/push-pages.js                 # push all
//   node content/push-pages.js about           # push EN about
//   node content/push-pages.js about --he      # push HE about
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.resolve(__dirname);
const CRED_PATH = path.join(CONTENT_DIR, '..', '.wp-credentials');

const MANIFEST = [
  {
    name: 'about',
    enId: 63644, enFile: 'About Page EN.page.md',
    heId: 63649, heFile: 'About Page HE.page.md'
  }
];

function loadCreds() {
  const txt = fs.readFileSync(CRED_PATH, 'utf8');
  const lines = txt.split(/\r?\n/);
  const creds = {};
  for (const line of lines) {
    const m = line.match(/^(url|username|app_password):\s*(.+)$/);
    if (m) creds[m[1]] = m[2].trim();
  }
  if (!creds.url || !creds.username || !creds.app_password) {
    throw new Error('Missing url/username/app_password in ' + CRED_PATH);
  }
  return creds;
}

function parsePageFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const titleMatch = text.match(/^## PAGE TITLE\r?\n([^\r\n]+)/m);
  if (!titleMatch) throw new Error('No PAGE TITLE in ' + filePath);
  const title = titleMatch[1].trim();

  const bodyIdx = text.indexOf('## BODY');
  if (bodyIdx === -1) throw new Error('No BODY marker in ' + filePath);
  let body = text.slice(bodyIdx + '## BODY'.length).replace(/^\r?\n/, '');
  // Drop the first non-empty line (the "Push to page ID ..." meta note)
  const firstLineEnd = body.indexOf('\n');
  body = body.slice(firstLineEnd + 1).replace(/^\r?\n+/, '');
  return { title, body };
}

// Wrap the raw HTML in a Custom HTML block so the WP block editor opens
// it cleanly (no "block recovery" prompt, emergency edits doable in wp-admin).
function wrapAsHtmlBlock(html) {
  return '<!-- wp:html -->\n' + html + '\n<!-- /wp:html -->';
}

async function pushPage(creds, pageId, file) {
  const filePath = path.join(CONTENT_DIR, file);
  const { title, body } = parsePageFile(filePath);
  const url = creds.url.replace(/\/+$/, '') + '/wp-json/wp/v2/pages/' + pageId;
  const auth = Buffer.from(creds.username + ':' + creds.app_password.replace(/\s+/g, '')).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + auth,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, content: wrapAsHtmlBlock(body) })
  });
  const json = await res.json();
  if (!res.ok) {
    console.error('  FAILED ' + pageId + ' ' + file + ' — ' + res.status + ' ' + (json.message || ''));
    return false;
  }
  console.log('  OK ' + pageId + ' ' + file + ' (' + body.length + ' chars)');
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const isHe = args.includes('--he');
  const isAll = !args.find(a => !a.startsWith('--'));
  const wantedName = args.find(a => !a.startsWith('--'));

  const creds = loadCreds();
  console.log('Target: ' + creds.url);

  for (const entry of MANIFEST) {
    if (!isAll && entry.name !== wantedName) continue;
    const file = isHe ? entry.heFile : entry.enFile;
    const id = isHe ? entry.heId : entry.enId;
    console.log(entry.name + ' (' + (isHe ? 'HE' : 'EN') + '):');
    await pushPage(creds, id, file);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
