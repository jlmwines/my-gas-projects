#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// upload-handling-images.js — One-shot media upload for the Handling post.
//
// Source images are local PNGs already in content/handling/ (Canva exports).
//   1. Reads each local PNG
//   2. Uploads to WP /wp-json/wp/v2/media with alt_text (EN) + title
//   3. Substitutes __IMG_N_ID__ / __IMG_N_URL__ (N=1..5, body images) in:
//        Handling EN.post.md
//        Handling HE.post.md
//
// The featured image is uploaded too. It is not in the body, but its media ID
// is stamped into the `## FEATURED MEDIA` section (replaces __FEATURED_ID__) so
// push-posts.js sets it as the post's featured_media — no manual wp-admin step.
//
// Run from jlmwines/ root: node content/upload-handling-images.js
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.resolve(__dirname);
const HANDLING_DIR = path.join(CONTENT_DIR, 'handling');
const CRED_PATH = path.join(CONTENT_DIR, '..', '.wp-credentials');
const wp = require('../../tools/wp-api')(CRED_PATH);

// Featured (not in body — reported for manual Featured Image set)
const FEATURED = {
  file: 'handling featured.png',
  upload: 'handling-featured.png',
  alt_en: 'Impressionist oil painting of a wine bottle resting in a cool, dim interior cabinet with a sliver of warm light across the glass',
  title: 'Handling — Featured'
};

// Body images, in order of appearance (one per section)
const SLOTS = [
  {
    n: 1,
    file: 'wine storage.png',
    upload: 'handling-storage.png',
    alt_en: 'Impressionist oil painting of wine bottles lying on their sides in a shadowed cabinet away from a sunlit window',
    alt_he: 'ציור שמן אימפרסיוניסטי של בקבוקי יין שוכבים על צידם בארון מוצל הרחק מחלון שטוף שמש',
    title: 'Handling — Storage'
  },
  {
    n: 2,
    file: 'opening wine.png',
    upload: 'handling-opening.png',
    alt_en: 'Impressionist oil painting of a hand easing a cork from a bottle with a waiter\'s corkscrew',
    alt_he: 'ציור שמן אימפרסיוניסטי של יד מוציאה בעדינות שעם מבקבוק בעזרת חולץ פקקים',
    title: 'Handling — Opening'
  },
  {
    n: 3,
    file: 'decanting wine.png',
    upload: 'handling-decanting.png',
    alt_en: 'Impressionist oil painting of red wine being poured into a glass decanter',
    alt_he: 'ציור שמן אימפרסיוניסטי של יין אדום הנמזג לתוך דקנטר זכוכית',
    title: 'Handling — Decanting'
  },
  {
    n: 4,
    file: 'pouring wine.png',
    upload: 'handling-serving.png',
    alt_en: 'Impressionist oil painting of two wine glasses poured a third full on a simple wooden table',
    alt_he: 'ציור שמן אימפרסיוניסטי של שתי כוסות יין מזוגות עד שליש על שולחן עץ פשוט',
    title: 'Handling — Serving'
  },
  {
    n: 5,
    file: 'saving wine for later.png',
    upload: 'handling-saving.png',
    alt_en: 'Impressionist oil painting of a re-corked open wine bottle with a vacuum stopper beside a half-full glass',
    alt_he: 'ציור שמן אימפרסיוניסטי של בקבוק יין פתוח עם פקק ואקום לצד כוס מלאה למחצה',
    title: 'Handling — Saving for later'
  }
];

// ─── Replace placeholders in a .post.md file ────────────────────────
function substitute(filePath, idMap, urlMap, featuredId) {
  if (!fs.existsSync(filePath)) {
    console.log('  WARN: ' + filePath + ' not found');
    return false;
  }
  var content = fs.readFileSync(filePath, 'utf8');
  for (var n = 1; n <= SLOTS.length; n++) {
    content = content.replace(new RegExp('__IMG_' + n + '_ID__', 'g'), String(idMap[n]));
    content = content.replace(new RegExp('__IMG_' + n + '_URL__', 'g'), urlMap[n]);
  }
  // Stamp the featured media ID into the `## FEATURED MEDIA` section
  // (push-posts.js reads it and sets featured_media).
  content = content.replace(/__FEATURED_ID__/g, String(featuredId));
  fs.writeFileSync(filePath, content);
  return true;
}

async function uploadOne(file, uploadName, altEn, title) {
  var localPath = path.join(HANDLING_DIR, file);
  if (!fs.existsSync(localPath)) {
    throw new Error('Local image not found: ' + localPath);
  }
  var buf = fs.readFileSync(localPath);
  console.log('  ' + file + ' (' + (buf.length / 1024).toFixed(0) + ' KiB) → uploading as ' + uploadName);
  var res = await wp.uploadMedia(buf, uploadName, 'image/png', { alt_text: altEn, title: title });
  if (res.status < 200 || res.status >= 300) {
    throw new Error('HTTP ' + res.status + ' ' + JSON.stringify(res.data).substring(0, 200));
  }
  console.log('    WP media ID ' + res.data.id + '  ' + res.data.source_url);
  return res.data;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  var idMap = {};
  var urlMap = {};

  console.log('\nFeatured:');
  var feat = await uploadOne(FEATURED.file, FEATURED.upload, FEATURED.alt_en, FEATURED.title);

  for (var i = 0; i < SLOTS.length; i++) {
    var slot = SLOTS[i];
    console.log('\nSlot ' + slot.n + ' — ' + slot.title);
    var data = await uploadOne(slot.file, slot.upload, slot.alt_en, slot.title);
    idMap[slot.n] = data.id;
    urlMap[slot.n] = data.source_url;
  }

  console.log('\n─── Substituting body + featured placeholders ───');
  substitute(path.join(CONTENT_DIR, 'Handling EN.post.md'), idMap, urlMap, feat.id);
  console.log('  Handling EN.post.md updated.');
  substitute(path.join(CONTENT_DIR, 'Handling HE.post.md'), idMap, urlMap, feat.id);
  console.log('  Handling HE.post.md updated.');

  console.log('\n─── Summary ───');
  console.log('  FEATURED (stamped into ## FEATURED MEDIA → set by push as featured_media): id=' + feat.id + '  ' + feat.source_url);
  for (var n = 1; n <= SLOTS.length; n++) {
    console.log('  Slot ' + n + ': id=' + idMap[n] + '  ' + urlMap[n]);
  }
  console.log('\nNext: `node content/push-posts.js handling --both`.');
}

main().catch(function(err) {
  console.error('Fatal:', err.message);
  process.exit(1);
});
