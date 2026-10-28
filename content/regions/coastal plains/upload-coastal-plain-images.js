#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// upload-coastal-plain-images.js — One-shot media upload for the
// Coastal Plain region post.
//
// Source images are local JPGs already in content/regions/coastal plains/
// (Canva PNG exports, resized to 1680px JPG).
//   1. Reads each local JPG
//   2. Uploads to WP /wp-json/wp/v2/media with alt_text (EN) + title
//   3. Substitutes __IMG_N_ID__ / __IMG_N_URL__ (N=1..2, body images) in:
//        regions/coastal plains/coastal-plain-en.post.md
//        regions/coastal plains/coastal-plain-he.post.md (if present)
//
// The featured image is uploaded too. It is not in the body, but its media ID
// is stamped into the `## FEATURED MEDIA` section (replaces __FEATURED_ID__) so
// push-posts.js sets it as the post's featured_media — no manual wp-admin step.
//
// Run from jlmwines/ root: node "content/regions/coastal plains/upload-coastal-plain-images.js"
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const REGION_DIR = __dirname;
const CRED_PATH = path.resolve(__dirname, '../../../.wp-credentials');
const wp = require('../../../../tools/wp-api')(CRED_PATH);

// Featured (not in body — stamped into ## FEATURED MEDIA)
const FEATURED = {
  file: 'coastal 01.jpg',
  upload: 'coastal-plain-featured.jpg',
  alt_en: 'Impressionist oil painting of vineyard rows on a low coastal plain running toward the Mediterranean at golden hour, sailboats on a shimmering sea',
  title: 'Coastal Plain — Featured'
};

// Body images, in order of appearance (one per section)
const SLOTS = [
  {
    n: 1,
    file: 'coastal 02b.jpg',
    upload: 'coastal-plain-story.jpg',
    alt_en: 'Impressionist oil painting of an old stone winery with oak barrels on a terraced hillside at sunset, gnarled old vines heavy with dark grapes in the foreground',
    title: 'Coastal Plain — The Story'
  },
  {
    n: 2,
    file: 'coastal 03.jpg',
    upload: 'coastal-plain-coast.jpg',
    alt_en: 'Impressionist oil painting of vine rows on pale sandy soil, palm trees and soft sea haze in the distance',
    title: 'Coastal Plain — Why the Coast Grows Differently'
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
  var localPath = path.join(REGION_DIR, file);
  if (!fs.existsSync(localPath)) {
    throw new Error('Local image not found: ' + localPath);
  }
  var buf = fs.readFileSync(localPath);
  console.log('  ' + file + ' (' + (buf.length / 1024).toFixed(0) + ' KiB) → uploading as ' + uploadName);
  var res = await wp.uploadMedia(buf, uploadName, 'image/jpeg', { alt_text: altEn, title: title });
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
  if (substitute(path.join(REGION_DIR, 'coastal-plain-en.post.md'), idMap, urlMap, feat.id)) {
    console.log('  coastal-plain-en.post.md updated.');
  }
  if (substitute(path.join(REGION_DIR, 'coastal-plain-he.post.md'), idMap, urlMap, feat.id)) {
    console.log('  coastal-plain-he.post.md updated.');
  }

  console.log('\n─── Summary ───');
  console.log('  FEATURED (stamped into ## FEATURED MEDIA → set by push as featured_media): id=' + feat.id + '  ' + feat.source_url);
  for (var n = 1; n <= SLOTS.length; n++) {
    console.log('  Slot ' + n + ': id=' + idMap[n] + '  ' + urlMap[n]);
  }
  console.log('\nNext: `node content/scripts/push-posts.js coastal-plain --both`.');
}

main().catch(function(err) {
  console.error('Fatal:', err.message);
  process.exit(1);
});
