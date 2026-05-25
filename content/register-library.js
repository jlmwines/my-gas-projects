#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// register-library.js — register content library entities by writing
// rows to SysLibrary in the JLMops_Library workbook via Sheets API.
//
// Sibling to push-posts.js. No GAS involvement. Writes only to
// JLMops_Library (single-tab, Drive-MCP-readable). Does NOT touch
// JLMops_Data. See plans/CONTENT_LIBRARY_PLAN.md §4 + §17 phase 4.
//
// Auth: service-account JSON at project root (.gcp-credentials.json).
// The service-account email must be shared as Editor on the JLMops_Library
// spreadsheet. Sibling pattern to .wp-credentials used by push-posts.js.
//
// Usage:
//   node content/register-library.js              # list manifest + registration status
//   node content/register-library.js <slug>       # register one entry
//   node content/register-library.js --all        # register all unregistered
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CONTENT_DIR = path.resolve(__dirname);
const CRED_PATH = path.join(CONTENT_DIR, '..', '.gcp-credentials.json');
const LIBRARY_SPREADSHEET_ID = '1Xu8XNFCxLm-65UWopz0jHJD7s7aGKNhIbqcoQtBDMGs';
const SHEET_NAME = 'SysLibrary';

// Controlled vocabulary per §6 + §20
const TYPES = ['blog', 'news', 'mention', 'email', 'social', 'template', 'image', 'customer'];
const LANGUAGES = ['en', 'he', null];

// ─── Manifest ───────────────────────────────────────────────────────
// Entries added one concept at a time; sibling-language pairs grouped.
const MANIFEST = [
  {
    slug: 'blog-context-en',
    content_type: 'blog',
    language: 'en',
    state: 'published',
    md_file: 'Context EN.post.md',
    wp_post_id: 67403,
    references: ['blog-context-he'],
  },
  {
    slug: 'blog-context-he',
    content_type: 'blog',
    language: 'he',
    state: 'published',
    md_file: 'Context HE.post.md',
    wp_post_id: 67405,
    references: ['blog-context-en'],
  },
];

// ─── MD parsing (mirror push-posts.js) ─────────────────────────────
function parseTitle(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath, 'utf8');
  const m = content.match(/^## TITLE\n(.+?)(?=\n## )/s);
  return m ? m[1].trim() : '';
}

function parseExcerpt(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath, 'utf8');
  const m = content.match(/^## EXCERPT\n(.+?)(?=\n## )/ms);
  return m ? m[1].trim() : '';
}

// ─── Validation per §4 + §20 ───────────────────────────────────────
function validateEntry(entry, allSlugsInManifest) {
  const { slug, content_type, language, references } = entry;

  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`slug "${slug}" must be lowercase kebab-case (a-z, 0-9, hyphen)`);
  }
  if (!TYPES.includes(content_type)) {
    throw new Error(`content_type "${content_type}" not in controlled vocabulary: ${TYPES.join(', ')}`);
  }
  if (!slug.startsWith(content_type + '-')) {
    throw new Error(`slug "${slug}" must start with type prefix "${content_type}-"`);
  }
  if (!LANGUAGES.includes(language)) {
    throw new Error(`language "${language}" must be one of: en, he, null`);
  }
  if (language && !slug.endsWith('-' + language)) {
    throw new Error(`slug "${slug}" must end with language suffix "-${language}"`);
  }
  for (const ref of references || []) {
    if (!allSlugsInManifest.has(ref)) {
      // Soft check; references may resolve via SysLibrary at write time.
      // Hard check happens in main() against the union of manifest + sheet.
    }
  }
}

// ─── Row builder ───────────────────────────────────────────────────
function buildRow(headers, entry, derived) {
  const now = new Date().toISOString();
  const fieldMap = {
    slb_Slug: entry.slug,
    slb_Title: derived.title || '',
    slb_ContentType: entry.content_type,
    slb_Language: entry.language || '',
    slb_State: entry.state || 'draft',
    slb_Version: 1,
    slb_CreatedDate: now,
    slb_CreatedBy: 'session',
    slb_LastTouched: now,
    slb_Tags: '',
    slb_Taxonomy: '',
    slb_References: (entry.references || []).join(','),
    slb_Notes: '',
    slb_MdUrl: entry.md_file ? path.posix.join('content', entry.md_file.replace(/\\/g, '/')) : '',
    slb_DocUrl: entry.doc_url || '',
    slb_WpPostId: entry.wp_post_id || '',
    slb_Excerpt: derived.excerpt || '',
  };
  return headers.map(h => (fieldMap[h] !== undefined ? fieldMap[h] : ''));
}

// ─── Sheets helpers ────────────────────────────────────────────────
function colLetter(idx) {
  // 0-indexed → A, B, ..., Z, AA, AB, ...
  let n = idx;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

async function getAuthedSheets() {
  if (!fs.existsSync(CRED_PATH)) {
    throw new Error(
      `Service-account JSON not found at ${CRED_PATH}.\n` +
      `Create a service account in GCP Console, download the JSON key, save it there, ` +
      `and share JLMops_Library as Editor with the service-account email.`
    );
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: CRED_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

async function readHeaders(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: LIBRARY_SPREADSHEET_ID,
    range: `${SHEET_NAME}!1:1`,
  });
  const headers = (res.data.values && res.data.values[0]) || [];
  if (headers.length === 0) throw new Error(`No header row found in ${SHEET_NAME}`);
  return headers;
}

async function readExistingSlugs(sheets, slugColIdx) {
  const col = colLetter(slugColIdx);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: LIBRARY_SPREADSHEET_ID,
    range: `${SHEET_NAME}!${col}2:${col}`,
  });
  return new Set(((res.data.values || []).flat()).filter(Boolean));
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const doAll = args.includes('--all');
  const targetSlug = args.find(a => !a.startsWith('--'));

  const manifestSlugs = new Set(MANIFEST.map(e => e.slug));
  MANIFEST.forEach(e => validateEntry(e, manifestSlugs));

  const sheets = await getAuthedSheets();
  const headers = await readHeaders(sheets);
  const slugColIdx = headers.indexOf('slb_Slug');
  if (slugColIdx < 0) throw new Error('slb_Slug column not found in SysLibrary');

  const existingSlugs = await readExistingSlugs(sheets, slugColIdx);
  const knownSlugs = new Set([...existingSlugs, ...manifestSlugs]);

  // No-arg → list
  if (!doAll && !targetSlug) {
    console.log(`SysLibrary headers (${headers.length}): ${headers.slice(0, 5).join(', ')}, …`);
    console.log(`Existing rows: ${existingSlugs.size}\n`);
    console.log('Manifest:');
    MANIFEST.forEach(e => {
      const status = existingSlugs.has(e.slug) ? '[registered]' : '[new]      ';
      console.log(`  ${status} ${e.slug}`);
    });
    return;
  }

  const targets = doAll ? MANIFEST : MANIFEST.filter(e => e.slug === targetSlug);
  if (targets.length === 0) {
    console.log(`Unknown slug: ${targetSlug}`);
    console.log(`Available: ${MANIFEST.map(e => e.slug).join(', ')}`);
    process.exit(1);
  }

  const rowsToAppend = [];
  for (const entry of targets) {
    if (existingSlugs.has(entry.slug)) {
      console.log(`  SKIP: ${entry.slug} already registered`);
      continue;
    }
    for (const ref of entry.references || []) {
      if (!knownSlugs.has(ref)) {
        console.warn(`  WARN: reference "${ref}" not found in SysLibrary or manifest`);
      }
    }
    const mdPath = entry.md_file ? path.join(CONTENT_DIR, entry.md_file) : null;
    const derived = {
      title: mdPath ? parseTitle(mdPath) : '',
      excerpt: mdPath ? parseExcerpt(mdPath) : '',
    };
    if (entry.md_file && !derived.title) {
      console.warn(`  WARN: no title parsed from ${entry.md_file}`);
    }
    rowsToAppend.push(buildRow(headers, entry, derived));
    console.log(`  REGISTER: ${entry.slug} (${derived.title || '<no title>'})`);
  }

  if (rowsToAppend.length === 0) {
    console.log('\nNothing to register.');
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: LIBRARY_SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:A`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rowsToAppend },
  });

  console.log(`\nDone: ${rowsToAppend.length} row(s) appended to ${SHEET_NAME}.`);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  if (err.code === 401 || err.code === 403) {
    console.error('Hint: confirm the service-account email is shared as Editor on JLMops_Library.');
  }
  process.exit(1);
});
