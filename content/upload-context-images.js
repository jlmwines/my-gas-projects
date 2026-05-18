#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// upload-context-images.js — One-shot media upload for the Context post.
//
// 1. Downloads each Canva export URL to content/context/<name>.jpg
// 2. Uploads each to WP /wp-json/wp/v2/media with alt_text
// 3. Substitutes __IMG_N_ID__ / __IMG_N_URL__ placeholders in:
//      Context EN.post.md
//      Context HE.post.md
//
// Run from jlmwines/ root: node content/upload-context-images.js
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONTENT_DIR = path.resolve(__dirname);
const CONTEXT_DIR = path.join(CONTENT_DIR, 'context');
const CRED_PATH = path.join(CONTENT_DIR, '..', '.wp-credentials');
const wp = require('../../tools/wp-api')(CRED_PATH);

const SLOTS = [
  {
    n: 1,
    file: 'context-season-clock.jpg',
    alt_en: 'Impressionist painting of a wine glass on a sunlit windowsill at golden hour',
    alt_he: 'ציור אימפרסיוניסטי של כוס יין על אדן חלון מוצף שמש שעת הזהב',
    title: 'Context — Time and Temperature',
    canvaUrl: 'https://export-download.canva.com/7AS9s/DAHKB27AS9s/-1/0/0001-2779224586666321762.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20260517%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260517T204647Z&X-Amz-Expires=80286&X-Amz-Signature=d1d5636a0a92b932f000c46652a1de324fcac8d5d7cf688058d4a2399254e723&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Mon%2C%2018%20May%202026%2019%3A04%3A53%20GMT'
  },
  {
    n: 2,
    file: 'context-pairing.jpg',
    alt_en: 'Impressionist painting of a wine glass beside a rustic plate of food in candlelight',
    alt_he: 'ציור אימפרסיוניסטי של כוס יין לצד צלחת אוכל כפרית באור נרות',
    title: 'Context — The Menu',
    canvaUrl: 'https://export-download.canva.com/9H6vk/DAHKBy9H6vk/-1/0/0001-5412704470253256631.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20260518%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260518T004239Z&X-Amz-Expires=68503&X-Amz-Signature=349b653b5b888199e446b8df9cadc7364263e39b67dc75eb78cf5ff4e87c7ffd&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Mon%2C%2018%20May%202026%2019%3A44%3A22%20GMT'
  },
  {
    n: 3,
    file: 'context-gathering.jpg',
    alt_en: 'Impressionist painting of three wine glasses raised in a casual evening toast',
    alt_he: 'ציור אימפרסיוניסטי של שלוש כוסות יין מורמות בהרמת כוסית ערב נינוחה',
    title: 'Context — Knowing Your Audience',
    canvaUrl: 'https://export-download.canva.com/5xwWw/DAHKBx5xwWw/-1/0/0001-4952211406501658288.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20260518%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260518T063018Z&X-Amz-Expires=46901&X-Amz-Signature=966f91b5ce0ee5c96ab2898d4c146356b7baa69161a8ffb177650f83cfa5568e&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Mon%2C%2018%20May%202026%2019%3A31%3A59%20GMT'
  },
  {
    n: 4,
    file: 'context-curation.jpg',
    alt_en: 'Impressionist painting of a hand selecting one bottle from a row of curated wines on a wooden shelf',
    alt_he: 'ציור אימפרסיוניסטי של יד הבוחרת בקבוק יין מתוך שורה של יינות אצורים על מדף עץ',
    title: 'Context — JLM Wines is Your Partner',
    canvaUrl: 'https://export-download.canva.com/ZkhLQ/DAHKCfZkhLQ/-1/0/0001-4052617383397708530.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAQYCGKMUH5AO7UJ26%2F20260518%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260518T155919Z&X-Amz-Expires=12945&X-Amz-Signature=7cd3ce32c5bf705feaa063d87b03288d2f95a19dd0c4c6d674793475cd08c965&X-Amz-SignedHeaders=host%3Bx-amz-expected-bucket-owner&response-expires=Mon%2C%2018%20May%202026%2019%3A35%3A04%20GMT'
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
function substitute(filePath, idMap, urlMap) {
  if (!fs.existsSync(filePath)) {
    console.log('  WARN: ' + filePath + ' not found');
    return false;
  }
  var content = fs.readFileSync(filePath, 'utf8');
  for (var n = 1; n <= 4; n++) {
    content = content.replace(new RegExp('__IMG_' + n + '_ID__', 'g'), String(idMap[n]));
    content = content.replace(new RegExp('__IMG_' + n + '_URL__', 'g'), urlMap[n]);
  }
  fs.writeFileSync(filePath, content);
  return true;
}

// ─── Main ───────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(CONTEXT_DIR)) {
    fs.mkdirSync(CONTEXT_DIR, { recursive: true });
    console.log('Created ' + CONTEXT_DIR);
  }

  var idMap = {};
  var urlMap = {};

  for (var i = 0; i < SLOTS.length; i++) {
    var slot = SLOTS[i];
    console.log('\nSlot ' + slot.n + ' — ' + slot.file);

    // Download to local
    var localPath = path.join(CONTEXT_DIR, slot.file);
    console.log('  Downloading from Canva...');
    var buf;
    try {
      buf = await fetchBuffer(slot.canvaUrl);
    } catch (e) {
      console.log('  ERROR downloading: ' + e.message);
      process.exit(1);
    }
    fs.writeFileSync(localPath, buf);
    console.log('  Saved ' + (buf.length / 1024).toFixed(1) + ' KiB to ' + localPath);

    // Upload to WP
    console.log('  Uploading to WP media library...');
    var res = await wp.uploadMedia(buf, slot.file, 'image/jpeg', {
      alt_text: slot.alt_en,
      title: slot.title
    });
    if (res.status < 200 || res.status >= 300) {
      console.log('  ERROR uploading: HTTP ' + res.status + ' ' + JSON.stringify(res.data).substring(0, 200));
      process.exit(1);
    }
    idMap[slot.n] = res.data.id;
    urlMap[slot.n] = res.data.source_url;
    console.log('  WP media ID: ' + res.data.id);
    console.log('  WP source URL: ' + res.data.source_url);
  }

  console.log('\n─── Substituting placeholders ───');
  substitute(path.join(CONTENT_DIR, 'Context EN.post.md'), idMap, urlMap);
  console.log('  Context EN.post.md updated.');
  substitute(path.join(CONTENT_DIR, 'Context HE.post.md'), idMap, urlMap);
  console.log('  Context HE.post.md updated.');

  console.log('\n─── Summary ───');
  for (var n = 1; n <= 4; n++) {
    console.log('  Slot ' + n + ': id=' + idMap[n] + '  ' + urlMap[n]);
  }
  console.log('\nNext: add "context" to push-posts.js MANIFEST, then `node content/push-posts.js context --both`.');
}

main().catch(function(err) {
  console.error('Fatal:', err.message);
  process.exit(1);
});
