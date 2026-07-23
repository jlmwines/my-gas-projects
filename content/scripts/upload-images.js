#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// upload-images.js — Generic one-shot media upload for a blog post.
//
// Manifest-driven (mirrors push-posts.js's MANIFEST pattern). Each entry
// describes a post's image folder, optional featured image, and body-image
// slots. Uploads each to WP /wp-json/wp/v2/media, then substitutes the
// returned media IDs/URLs into __IMG_N_ID__ / __IMG_N_URL__ / __FEATURED_ID__
// placeholders in the post's EN + HE .post.md files.
//
// A slot with `canvaUrl` is downloaded from that URL first and saved into
// the post's `dir`; a slot without one is read from a file already there.
//
// Usage:
//   node content/scripts/upload-images.js               # list manifest
//   node content/scripts/upload-images.js <name>        # upload that post's images
//
// New post: add a manifest entry below — no new script file needed.
// Run from jlmwines/ root.
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONTENT_DIR = path.resolve(__dirname, '..');
const CRED_PATH = path.join(CONTENT_DIR, '..', '.wp-credentials');
const wp = require('../../../tools/wp-api')(CRED_PATH);

// ─── Manifest ─────────────────────────────────────────────────────────
const MANIFEST = [
  {
    name: 'handling',
    dir: 'basics/handling',
    enFile: 'Handling EN.post.md',
    heFile: 'Handling HE.post.md',
    featured: {
      file: 'handling featured.png',
      upload: 'handling-featured.png',
      alt_en: 'Impressionist oil painting of a wine bottle resting in a cool, dim interior cabinet with a sliver of warm light across the glass',
      title: 'Handling — Featured'
    },
    slots: [
      { n: 1, file: 'wine storage.png', upload: 'handling-storage.png', alt_en: 'Impressionist oil painting of wine bottles lying on their sides in a shadowed cabinet away from a sunlit window', alt_he: 'ציור שמן אימפרסיוניסטי של בקבוקי יין שוכבים על צידם בארון מוצל הרחק מחלון שטוף שמש', title: 'Handling — Storage' },
      { n: 2, file: 'opening wine.png', upload: 'handling-opening.png', alt_en: 'Impressionist oil painting of a hand easing a cork from a bottle with a waiter\'s corkscrew', alt_he: 'ציור שמן אימפרסיוניסטי של יד מוציאה בעדינות שעם מבקבוק בעזרת חולץ פקקים', title: 'Handling — Opening' },
      { n: 3, file: 'decanting wine.png', upload: 'handling-decanting.png', alt_en: 'Impressionist oil painting of red wine being poured into a glass decanter', alt_he: 'ציור שמן אימפרסיוניסטי של יין אדום הנמזג לתוך דקנטר זכוכית', title: 'Handling — Decanting' },
      { n: 4, file: 'pouring wine.png', upload: 'handling-serving.png', alt_en: 'Impressionist oil painting of two wine glasses poured a third full on a simple wooden table', alt_he: 'ציור שמן אימפרסיוניסטי של שתי כוסות יין מזוגות עד שליש על שולחן עץ פשוט', title: 'Handling — Serving' },
      { n: 5, file: 'saving wine for later.png', upload: 'handling-saving.png', alt_en: 'Impressionist oil painting of a re-corked open wine bottle with a vacuum stopper beside a half-full glass', alt_he: 'ציור שמן אימפרסיוניסטי של בקבוק יין פתוח עם פקק ואקום לצד כוס מלאה למחצה', title: 'Handling — Saving for later' }
    ]
  },
  {
    name: 'context',
    dir: 'basics/context',
    enFile: 'Context EN.post.md',
    heFile: 'Context HE.post.md',
    slots: [
      { n: 1, file: 'context-season-clock.jpg', alt_en: 'Impressionist painting of a wine glass on a sunlit windowsill at golden hour', title: 'Context — Time and Temperature' },
      { n: 2, file: 'context-pairing.jpg', alt_en: 'Impressionist painting of a wine glass beside a rustic plate of food in candlelight', title: 'Context — The Menu' },
      { n: 3, file: 'context-gathering.jpg', alt_en: 'Impressionist painting of three wine glasses raised in a casual evening toast', title: 'Context — Knowing Your Audience' },
      { n: 4, file: 'context-curation.jpg', alt_en: 'Impressionist painting of a hand selecting one bottle from a row of curated wines on a wooden shelf', title: 'Context — JLM Wines is Your Partner' }
    ]
  }
];

// ─── Download a URL into a Buffer ───────────────────────────────────
function fetchBuffer(url) {
  return new Promise(function(resolve, reject) {
    https.get(url, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP ' + res.statusCode + ' for ' + url.substring(0, 80) + '...'));
      }
      var chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() { resolve(Buffer.concat(chunks)); });
    }).on('error', reject);
  });
}

// ─── Replace placeholders in a .post.md file ────────────────────────
function substitute(filePath, idMap, urlMap, featuredId, slotCount) {
  if (!fs.existsSync(filePath)) {
    console.log('  WARN: ' + filePath + ' not found');
    return false;
  }
  var content = fs.readFileSync(filePath, 'utf8');
  for (var n = 1; n <= slotCount; n++) {
    content = content.replace(new RegExp('__IMG_' + n + '_ID__', 'g'), String(idMap[n]));
    content = content.replace(new RegExp('__IMG_' + n + '_URL__', 'g'), urlMap[n]);
  }
  if (featuredId != null) {
    content = content.replace(/__FEATURED_ID__/g, String(featuredId));
  }
  fs.writeFileSync(filePath, content);
  return true;
}

// ─── Get local file buffer, downloading first if the slot has a canvaUrl ──
async function getLocalBuffer(postDir, slot) {
  var localPath = path.join(postDir, slot.file);
  if (slot.canvaUrl) {
    console.log('  Downloading from Canva...');
    var buf = await fetchBuffer(slot.canvaUrl);
    if (!fs.existsSync(postDir)) fs.mkdirSync(postDir, { recursive: true });
    fs.writeFileSync(localPath, buf);
    console.log('  Saved ' + (buf.length / 1024).toFixed(1) + ' KiB to ' + localPath);
    return buf;
  }
  if (!fs.existsSync(localPath)) {
    throw new Error('Local image not found: ' + localPath);
  }
  return fs.readFileSync(localPath);
}

function extFor(file) {
  return file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

async function uploadOne(postDir, slot) {
  var buf = await getLocalBuffer(postDir, slot);
  var uploadName = slot.upload || slot.file;
  console.log('  ' + slot.file + ' (' + (buf.length / 1024).toFixed(0) + ' KiB) → uploading as ' + uploadName);
  var res = await wp.uploadMedia(buf, uploadName, extFor(uploadName), { alt_text: slot.alt_en, title: slot.title });
  if (res.status < 200 || res.status >= 300) {
    throw new Error('HTTP ' + res.status + ' ' + JSON.stringify(res.data).substring(0, 200));
  }
  console.log('    WP media ID ' + res.data.id + '  ' + res.data.source_url);
  return res.data;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  var arg = process.argv[2];

  if (!arg) {
    console.log('Manifest:');
    MANIFEST.forEach(function(entry) {
      console.log('  ' + entry.name.padEnd(12) + ' dir=' + entry.dir + '  slots=' + entry.slots.length + (entry.featured ? ' +featured' : ''));
    });
    console.log('\nUsage:');
    console.log('  node content/scripts/upload-images.js <name>');
    return;
  }

  var entry = MANIFEST.find(function(e) { return e.name === arg; });
  if (!entry) {
    console.error('Unknown post: ' + arg + '. Run with no args to list the manifest.');
    process.exit(1);
  }

  var postDir = path.join(CONTENT_DIR, entry.dir);
  var idMap = {};
  var urlMap = {};
  var featuredId = null;

  if (entry.featured) {
    console.log('\nFeatured:');
    var feat = await uploadOne(postDir, entry.featured);
    featuredId = feat.id;
  }

  for (var i = 0; i < entry.slots.length; i++) {
    var slot = entry.slots[i];
    console.log('\nSlot ' + slot.n + ' — ' + (slot.title || slot.file));
    var data = await uploadOne(postDir, slot);
    idMap[slot.n] = data.id;
    urlMap[slot.n] = data.source_url;
  }

  console.log('\n─── Substituting placeholders ───');
  substitute(path.join(CONTENT_DIR, entry.dir, entry.enFile), idMap, urlMap, featuredId, entry.slots.length);
  console.log('  ' + entry.enFile + ' updated.');
  substitute(path.join(CONTENT_DIR, entry.dir, entry.heFile), idMap, urlMap, featuredId, entry.slots.length);
  console.log('  ' + entry.heFile + ' updated.');

  console.log('\n─── Summary ───');
  if (featuredId != null) {
    console.log('  FEATURED (stamped into ## FEATURED MEDIA → set by push as featured_media): id=' + featuredId);
  }
  for (var n = 1; n <= entry.slots.length; n++) {
    console.log('  Slot ' + n + ': id=' + idMap[n] + '  ' + urlMap[n]);
  }
  console.log('\nNext: `node content/scripts/push-posts.js ' + entry.name + ' --both`.');
}

main().catch(function(err) {
  console.error('Fatal:', err.message);
  process.exit(1);
});
