#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// upload-negev-images.js — One-shot media upload for the Negev region post.
//
// Source images are local PNGs already in content/regions/negev/ (Canva exports).
//   1. Reads each local PNG
//   2. Uploads to WP /wp-json/wp/v2/media with alt_text (EN) + title
//   3. Substitutes __IMG_N_ID__ / __IMG_N_URL__ (N=1..3, body images) in:
//        regions/negev-en.post.md
//        regions/negev-he.post.md
//
// The featured image is uploaded too. It is not in the body, but its media ID
// is stamped into the `## FEATURED MEDIA` section (replaces __FEATURED_ID__) so
// push-posts.js sets it as the post's featured_media — no manual wp-admin step.
//
// Run from jlmwines/ root: node content/regions/negev/upload-negev-images.js
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const NEGEV_DIR = __dirname;
const CRED_PATH = path.resolve(__dirname, '../../../.wp-credentials');
const wp = require('../../../../tools/wp-api')(CRED_PATH);

// Featured (not in body — stamped into ## FEATURED MEDIA)
const FEATURED = {
  file: 'negev featured.png',
  upload: 'negev-featured.png',
  alt_en: 'Impressionist oil painting of an ancient terraced hillside in the Negev desert at golden hour, pale loess soil, sparse dry vines, wide open desert sky',
  title: 'Negev — Featured'
};

// Body images, in order of appearance (one per section)
const SLOTS = [
  {
    n: 1,
    file: 'negev history 01.png',
    upload: 'negev-history.png',
    alt_en: 'Impressionist oil painting of ancient stone ruins in a Negev desert valley, warm rust and ochre tones, olive jars suggesting the ancient wine trade',
    alt_he: 'ציור שמן אימפרסיוניסטי של הריסות אבן עתיקות בעמק מדבר הנגב, גוני חלודה וחמרה חמים, כדי זית המרמזים על סחר היין העתיק',
    title: 'Negev — The Story'
  },
  {
    n: 2,
    file: 'negev sunset vineyard 01.png',
    upload: 'negev-vineyard-dusk.png',
    alt_en: 'Impressionist oil painting of a Negev vineyard at dusk, blazing orange sky cooling to deep blue, vine rows receding into the desert',
    alt_he: 'ציור שמן אימפרסיוניסטי של כרם בנגב בשעת דמדומים, שמיים כתומים בוערים המתקררים לכחול עמוק, שורות גפנים נמשכות אל תוך המדבר',
    title: 'Negev — Why Grow Grapes in the Desert'
  },
  {
    n: 3,
    file: 'negev sunset glass.png',
    upload: 'negev-glass-sunset.png',
    alt_en: 'Impressionist oil painting, close-up of a wine glass reflecting a desert sunset, warm amber and garnet tones',
    alt_he: 'ציור שמן אימפרסיוניסטי, תקריב של כוס יין המשקפת שקיעה מדברית, גוני ענבר וגרנט חמים',
    title: 'Negev — What to Expect in the Glass'
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
  var localPath = path.join(NEGEV_DIR, file);
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
  substitute(path.join(NEGEV_DIR, 'negev-en.post.md'), idMap, urlMap, feat.id);
  console.log('  negev-en.post.md updated.');
  substitute(path.join(NEGEV_DIR, 'negev-he.post.md'), idMap, urlMap, feat.id);
  console.log('  negev-he.post.md updated.');

  console.log('\n─── Summary ───');
  console.log('  FEATURED (stamped into ## FEATURED MEDIA → set by push as featured_media): id=' + feat.id + '  ' + feat.source_url);
  for (var n = 1; n <= SLOTS.length; n++) {
    console.log('  Slot ' + n + ': id=' + idMap[n] + '  ' + urlMap[n]);
  }
  console.log('\nNext: `node content/push-posts.js negev --both`.');
}

main().catch(function(err) {
  console.error('Fatal:', err.message);
  process.exit(1);
});
