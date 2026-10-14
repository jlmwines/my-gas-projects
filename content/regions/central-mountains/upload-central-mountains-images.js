#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// upload-central-mountains-images.js — One-shot media upload for the
// Central Mountains region post.
//
// Source images are local JPGs already in content/regions/central-mountains/ (Canva exports).
//   1. Reads each local JPG
//   2. Uploads to WP /wp-json/wp/v2/media with alt_text (EN) + title
//   3. Substitutes __IMG_N_ID__ / __IMG_N_URL__ (N=1..2, body images) in:
//        regions/central-mountains/central-mountains-en.post.md
//        regions/central-mountains/central-mountains-he.post.md (if present)
//
// The featured image is uploaded too. It is not in the body, but its media ID
// is stamped into the `## FEATURED MEDIA` section (replaces __FEATURED_ID__) so
// push-posts.js sets it as the post's featured_media — no manual wp-admin step.
//
// Run from jlmwines/ root: node content/regions/central-mountains/upload-central-mountains-images.js
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const REGION_DIR = __dirname;
const CRED_PATH = path.resolve(__dirname, '../../../.wp-credentials');
const wp = require('../../../../tools/wp-api')(CRED_PATH);

// Featured (not in body — stamped into ## FEATURED MEDIA)
const FEATURED = {
  file: 'central mountains 01.jpg',
  upload: 'central-mountains-featured.jpg',
  alt_en: "Impressionist oil painting of stone-terraced vineyards and olive trees below Jerusalem's Old City walls at sunset, warm golden light",
  title: 'Central Mountains — Featured'
};

// Body images, in order of appearance (one per section)
const SLOTS = [
  {
    n: 1,
    file: 'central mountains 02.jpg',
    upload: 'central-mountains-story.jpg',
    alt_en: 'Impressionist oil painting of a hillside vineyard on rust-red terra rossa soil, pale limestone boulders and a dry stone terrace wall',
    title: 'Central Mountains — The Story'
  },
  {
    n: 2,
    file: 'central mountains 03.jpg',
    upload: 'central-mountains-watershed.jpg',
    alt_en: 'Impressionist oil painting of a mountain vineyard on a green slope falling away to a dry desert canyon below',
    title: 'Central Mountains — The Watershed Divide Between Two Worlds'
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
  if (substitute(path.join(REGION_DIR, 'central-mountains-en.post.md'), idMap, urlMap, feat.id)) {
    console.log('  central-mountains-en.post.md updated.');
  }
  if (substitute(path.join(REGION_DIR, 'central-mountains-he.post.md'), idMap, urlMap, feat.id)) {
    console.log('  central-mountains-he.post.md updated.');
  }

  console.log('\n─── Summary ───');
  console.log('  FEATURED (stamped into ## FEATURED MEDIA → set by push as featured_media): id=' + feat.id + '  ' + feat.source_url);
  for (var n = 1; n <= SLOTS.length; n++) {
    console.log('  Slot ' + n + ': id=' + idMap[n] + '  ' + urlMap[n]);
  }
  console.log('\nNext: `node content/scripts/push-posts.js central-mountains`.');
}

main().catch(function(err) {
  console.error('Fatal:', err.message);
  process.exit(1);
});
