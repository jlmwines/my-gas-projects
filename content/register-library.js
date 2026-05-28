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
//   node content/register-library.js                          # list manifest + registration status
//   node content/register-library.js <slug>                   # register one entry
//   node content/register-library.js --all                    # register all unregistered
//   node content/register-library.js --update <slug>          # patch existing row's email metadata
//   node content/register-library.js --update --all           # patch all manifest entries that already exist
//
// --update mode (phase 11 email): for entries whose slug is already in
// SysLibrary, the script patches a narrow set of fields rather than
// SKIPping. Patched fields are listed in UPDATE_FIELDS below — currently
// limited to email-specific metadata + slb_LastTouched. State transitions
// (e.g., draft → published) flow through the task-close UI path
// (LibraryView.markPublished), not through this script.
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
  {
    slug: 'image-context-featured',
    content_type: 'image',
    language: null,
    state: 'published',
    title: 'Context — featured image',
    kind: 'featured',
    descriptor: 'featured',
    references: ['blog-context-en', 'blog-context-he'],
    notes: 'wp_media_id: 67422; wp_url: /wp-content/uploads/2026/05/context-featured.jpg',
  },
  {
    slug: 'image-context-body-01-season-clock',
    content_type: 'image',
    language: null,
    state: 'published',
    title: 'Context — body 1, season clock',
    kind: 'body',
    index: '01',
    descriptor: 'season-clock',
    references: ['blog-context-en', 'blog-context-he'],
    notes: 'wp_media_id: 67407; wp_url: /wp-content/uploads/2026/05/context-season-clock.jpg',
  },
  {
    slug: 'image-context-body-02-pairing',
    content_type: 'image',
    language: null,
    state: 'published',
    title: 'Context — body 2, pairing',
    kind: 'body',
    index: '02',
    descriptor: 'pairing',
    references: ['blog-context-en', 'blog-context-he'],
    notes: 'wp_media_id: 67413; wp_url: /wp-content/uploads/2026/05/context-pairing-v2.jpg',
  },
  {
    slug: 'image-context-body-03-gathering',
    content_type: 'image',
    language: null,
    state: 'published',
    title: 'Context — body 3, gathering',
    kind: 'body',
    index: '03',
    descriptor: 'gathering',
    references: ['blog-context-en', 'blog-context-he'],
    notes: 'wp_media_id: 67409; wp_url: /wp-content/uploads/2026/05/context-gathering.jpg',
  },
  {
    slug: 'image-context-body-04-curation',
    content_type: 'image',
    language: null,
    state: 'published',
    title: 'Context — body 4, curation',
    kind: 'body',
    index: '04',
    descriptor: 'curation',
    references: ['blog-context-en', 'blog-context-he'],
    notes: 'wp_media_id: 67414; wp_url: /wp-content/uploads/2026/05/context-curation-v2.jpg',
  },
  // ─── Welcome family templates (phase 10 migration 2026-05-27) ──────
  // Content copy-pasted from current SysConfig source rows in
  // jlmops/config/otherSettings.json — `crm.template.welcome.*`.
  // SysConfig rows remain in place until pending_payment migration also
  // lands; retire all crm.template.* in one pass then. Per plan §17 phase 10
  // welcome has NO consumer code (HousekeepingService.createWelcomeOutreachTasks
  // only spawns a task.contact.outreach; manager does outreach manually). These
  // rows are pure pattern-setter scaffolding.
  {
    slug: 'template-welcome-email-en',
    content_type: 'template',
    language: 'en',
    state: 'locked',
    title: 'Welcome email (EN)',
    channel: 'email',
    subject: 'Welcome to JLM Wines — how was your first order?',
    body: `Hi,

Thank you so much for your first order with JLM Wines! I just wanted to reach out personally to say welcome, and to check that everything arrived well and you've been enjoying the wines.

If you'd like any suggestions for next time — whether it's something similar to what you ordered or something completely different — just let me know. Happy to help.

Evyatar
JLM Wines`,
    references: ['template-welcome-email-he'],
  },
  {
    slug: 'template-welcome-email-he',
    content_type: 'template',
    language: 'he',
    state: 'locked',
    title: 'Welcome email (HE)',
    channel: 'email',
    subject: 'ברוכים הבאים ליין ירושלים — איך הייתה ההזמנה הראשונה?',
    body: `שלום,

תודה רבה על ההזמנה הראשונה שלך מיין ירושלים! רציתי באופן אישי לברך אותך ולוודא שהכל הגיע תקין ושנהנית מהיין.

אם תרצה המלצות לפעם הבאה — בין אם זה משהו דומה למה שהזמנת או משהו חדש לגמרי — אשמח להמליץ. פנה אליי בכל שאלה.

אביתר
יין ירושלים`,
    references: ['template-welcome-email-en'],
  },
  {
    slug: 'template-welcome-whatsapp-en',
    content_type: 'template',
    language: 'en',
    state: 'locked',
    title: 'Welcome WhatsApp (EN)',
    channel: 'whatsapp',
    subject: '',  // WhatsApp has no subject
    body: "Hi! Thanks so much for your first order with JLM Wines — really hope you enjoyed it. Just checking in to see how everything was, and let me know if you'd like any suggestions for next time.",
    references: ['template-welcome-whatsapp-he'],
  },
  {
    slug: 'template-welcome-whatsapp-he',
    content_type: 'template',
    language: 'he',
    state: 'locked',
    title: 'Welcome WhatsApp (HE)',
    channel: 'whatsapp',
    subject: '',
    body: 'שלום! המון תודה על ההזמנה הראשונה שלך מיין ירושלים — מקווה שנהנית מהיין. רציתי לבדוק שהכל בסדר ואשמח להמליץ לך משהו לפעם הבאה.',
    references: ['template-welcome-whatsapp-en'],
  },
  // ─── Pending-payment family templates (phase 10 migration 2026-05-28) ──
  // First consumer-bearing migration. HousekeepingService.createPendingPaymentFollowups
  // composes email body + optional first-time addendum and sends via GmailApp.
  // Body uses {name}, {order_pay_url}, {first_time_block} placeholders; consumer
  // interpolates at send time. Addendum substitutes into {first_time_block} for
  // first-time customers (zero completed orders).
  // SysConfig source: jlmops/config/otherSettings.json crm.template.pending_payment.*
  // SysConfig rows retire alongside welcome family rows in one pass after this lands.
  {
    slug: 'template-pending-payment-email-en',
    content_type: 'template',
    language: 'en',
    state: 'locked',
    title: 'Pending-payment follow-up email (EN)',
    channel: 'email',
    subject: 'Your order at JLM Wines — can we help?',
    body: "Hi {name},\n\nI noticed your recent order with JLM Wines is still pending payment. Just checking in — is there anything I can help with?\n\nYou can complete payment in one tap here:\n{order_pay_url}\n\nOr just reply to this email and I'll help directly.{first_time_block}\n\nHappy to chat on WhatsApp too if that's easier — feel free to message us anytime.\n\nEvyatar\nJLM Wines",
    references: ['template-pending-payment-email-he'],
  },
  {
    slug: 'template-pending-payment-email-he',
    content_type: 'template',
    language: 'he',
    state: 'locked',
    title: 'Pending-payment follow-up email (HE)',
    channel: 'email',
    subject: 'ההזמנה שלך ביין ירושלים — אפשר לעזור?',
    body: 'שלום {name},\n\nראיתי שההזמנה האחרונה שלך ביין ירושלים עדיין ממתינה לתשלום. רציתי לבדוק שהכל בסדר ולשאול אם אפשר לעזור.\n\nאפשר להשלים את התשלום בלחיצה אחת כאן:\n{order_pay_url}\n\nאו פשוט להגיב למייל הזה ואסדר את זה ישירות.{first_time_block}\n\nאשמח גם לדבר בוואטסאפ אם זה נוח יותר.\n\nאביתר\nיין ירושלים',
    references: ['template-pending-payment-email-en'],
  },
  {
    slug: 'template-pending-payment-addendum-en',
    content_type: 'template',
    language: 'en',
    state: 'locked',
    title: 'Pending-payment first-time addendum (EN)',
    channel: 'email',
    subject: '',
    body: '\n\nAlso — as a first-time customer, you can use code NEW50 for ₪50 off any order of ₪399 or more, with free delivery.',
    references: ['template-pending-payment-addendum-he'],
  },
  {
    slug: 'template-pending-payment-addendum-he',
    content_type: 'template',
    language: 'he',
    state: 'locked',
    title: 'Pending-payment first-time addendum (HE)',
    channel: 'email',
    subject: '',
    body: '\n\nונקודה נוספת — כלקוח חדש, ניתן להשתמש בקוד NEW50 ל-₪50 הנחה על כל הזמנה מעל ₪399, כולל משלוח חינם.',
    references: ['template-pending-payment-addendum-en'],
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
    slb_Title: derived.title || entry.title || '',
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
    slb_Notes: entry.notes || '',
    slb_MdUrl: entry.md_file ? path.posix.join('content', entry.md_file.replace(/\\/g, '/')) : '',
    slb_DocUrl: entry.doc_url || '',
    slb_WpPostId: entry.wp_post_id || '',
    slb_Excerpt: derived.excerpt || '',
    slb_CanvaDesignUrl: entry.canva_design_url || '',
    slb_Kind: entry.kind || '',
    slb_Index: entry.index || '',
    slb_Descriptor: entry.descriptor || '',
    // Phase 10 template fields (sparse — only populated for content_type='template')
    slb_Subject: entry.subject || '',
    slb_Body: entry.body || '',
    slb_Channel: entry.channel || '',
    // Phase 11 email fields (sparse — only populated for content_type='email')
    slb_MailchimpCampaignId: entry.mailchimp_campaign_id || '',
    slb_SubjectLine: entry.subject_line || '',
    slb_SendDate: entry.send_date || '',
    slb_ExternalUrl: entry.external_url || '',
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
  // Returns a Map: slug → 1-indexed sheet row number (>= 2; header is row 1).
  // Callers needing only membership can `.has(slug)` or pass `.keys()` to a Set.
  const col = colLetter(slugColIdx);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: LIBRARY_SPREADSHEET_ID,
    range: `${SHEET_NAME}!${col}2:${col}`,
  });
  const values = res.data.values || [];
  const map = new Map();
  values.forEach((row, idx) => {
    const slug = row && row[0];
    if (slug) map.set(slug, idx + 2);
  });
  return map;
}

// Fields the --update path patches on existing rows. Narrow on purpose
// (phase 11 email post-send metadata fill). Add to this list as later
// phases need to patch additional columns; do not generalize to "all fields"
// without a deliberate decision.
const UPDATE_FIELDS = [
  'slb_LastTouched',
  'slb_MailchimpCampaignId',
  'slb_SubjectLine',
  'slb_SendDate',
  'slb_ExternalUrl',
];

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const doAll = args.includes('--all');
  const doUpdate = args.includes('--update');
  const targetSlug = args.find(a => !a.startsWith('--'));

  const manifestSlugs = new Set(MANIFEST.map(e => e.slug));
  MANIFEST.forEach(e => validateEntry(e, manifestSlugs));

  const sheets = await getAuthedSheets();
  const headers = await readHeaders(sheets);
  const slugColIdx = headers.indexOf('slb_Slug');
  if (slugColIdx < 0) throw new Error('slb_Slug column not found in SysLibrary');

  const existingRows = await readExistingSlugs(sheets, slugColIdx);
  const knownSlugs = new Set([...existingRows.keys(), ...manifestSlugs]);

  // No-arg → list
  if (!doAll && !targetSlug) {
    console.log(`SysLibrary headers (${headers.length}): ${headers.slice(0, 5).join(', ')}, …`);
    console.log(`Existing rows: ${existingRows.size}\n`);
    console.log('Manifest:');
    MANIFEST.forEach(e => {
      const status = existingRows.has(e.slug) ? '[registered]' : '[new]      ';
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
  const updates = [];  // { range, values } for batchUpdate
  for (const entry of targets) {
    const existingRow = existingRows.get(entry.slug);
    if (existingRow) {
      if (!doUpdate) {
        console.log(`  SKIP: ${entry.slug} already registered`);
        continue;
      }
      // Build patch: read each UPDATE_FIELDS column position, write a single-cell range.
      // One range per field keeps the writes minimal + traceable.
      const now = new Date().toISOString();
      const patch = {
        slb_LastTouched: now,
        slb_MailchimpCampaignId: entry.mailchimp_campaign_id || '',
        slb_SubjectLine: entry.subject_line || '',
        slb_SendDate: entry.send_date || '',
        slb_ExternalUrl: entry.external_url || '',
      };
      let patchedFields = 0;
      for (const field of UPDATE_FIELDS) {
        const colIdx = headers.indexOf(field);
        if (colIdx < 0) {
          console.warn(`  WARN: column "${field}" not found in SysLibrary headers — skipped`);
          continue;
        }
        const value = patch[field];
        if (value === '' || value === undefined) continue;  // don't overwrite with blanks
        const col = colLetter(colIdx);
        updates.push({
          range: `${SHEET_NAME}!${col}${existingRow}`,
          values: [[value]],
        });
        patchedFields++;
      }
      console.log(`  UPDATE: ${entry.slug} (${patchedFields} field(s))`);
      continue;
    }

    // CREATE path — never enters under --update mode.
    if (doUpdate) {
      console.log(`  SKIP: ${entry.slug} not registered yet (run without --update to create)`);
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

  if (rowsToAppend.length === 0 && updates.length === 0) {
    console.log('\nNothing to register or update.');
    return;
  }

  if (rowsToAppend.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: LIBRARY_SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rowsToAppend },
    });
    console.log(`\nAppended: ${rowsToAppend.length} row(s) to ${SHEET_NAME}.`);
  }

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: LIBRARY_SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates,
      },
    });
    console.log(`Patched: ${updates.length} cell(s) across existing rows.`);
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  if (err.code === 401 || err.code === 403) {
    console.error('Hint: confirm the service-account email is shared as Editor on JLMops_Library.');
  }
  process.exit(1);
});
