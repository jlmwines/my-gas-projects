#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// push-posts.js — Push blog posts to WordPress (staging6.jlmwines.com)
//
// Manifest-driven. Reads .post.md files, pushes as drafts via WP API.
// Slug-based upsert — no hardcoded post IDs.
//
// Usage:
//   node content/push-posts.js                  # list all posts
//   node content/push-posts.js pairing          # push EN post
//   node content/push-posts.js pairing --he     # push HE post
//   node content/push-posts.js --all            # push all EN
//   node content/push-posts.js --all --he       # push all HE
//   node content/push-posts.js --all --both     # push all EN + HE
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.resolve(__dirname);
const CRED_PATH = path.join(CONTENT_DIR, '..', '.wp-credentials');

// ─── Post manifest ───────────────────────────────────────────────
const MANIFEST = [
  {
    name: 'acidity',
    enSlug: 'white-rose-wine-acidity',
    heSlug: 'white-rose-wine-acidity-he',
    enFile: 'Acidity EN_2025-01-12.post.md',
    heFile: 'Acidity HE_2025-01-12.post.md'
  },
  {
    name: 'complexity',
    enSlug: 'wine-complexity',
    heSlug: 'wine-complexity-he',
    enFile: 'Complexity EN_2025-01-12.post.md',
    heFile: 'Complexity HE.post.md'
  },
  {
    name: 'intensity',
    enSlug: 'red-wine-intensity',
    heSlug: 'red-wine-intensity-he',
    enFile: 'Intensity EN 2026-01-15 A.post.md',
    heFile: 'Intensity HE.post.md'
  },
  {
    name: 'pairing',
    enSlug: 'pairing-food-and-wine',
    heSlug: 'pairing-food-and-wine-he',
    enFile: 'Pairing EN_2026-01-06.post.md',
    heFile: 'Pairing HE.post.md'
  },
  {
    name: 'good-wine',
    enSlug: 'what-makes-a-wine-good',
    heSlug: 'what-makes-a-wine-good-he',
    enFile: 'What is a Good Wine EN_2026-01-06.post.md',
    heFile: 'What is a Good Wine HE.post.md'
  },
  {
    name: 'selection',
    enSlug: 'how-we-choose-wines',
    heSlug: 'how-we-choose-wines-he',
    enFile: 'Your Private Selection EN_2026-01-06.post.md',
    heFile: 'Your Private Selection HE.post.md'
  },
  {
    name: 'price',
    enSlug: 'does-higher-price-mean-better-wine',
    heSlug: 'does-higher-price-mean-better-wine-he',
    enFile: 'Price vs Quality EN 2026-01-18 B.post.md',
    heFile: 'Price vs Quality HE 2026-01-18 B.post.md'
  },
  {
    name: 'evyatar',
    enSlug: 'about-evyatar',
    heSlug: 'about-evyatar-he',
    enFile: 'About Evyatar EN_2026-01-08.post.md',
    heFile: 'About Evyatar HE.post.md'
  }
];

// ─── Parse .post.md file ─────────────────────────────────────────
function parsePostMd(filePath) {
  var content = fs.readFileSync(filePath, 'utf8');
  var title = '', excerpt = '', body = '';

  // Extract TITLE section
  var titleMatch = content.match(/^## TITLE\n(.+?)(?=\n## )/s);
  if (titleMatch) title = titleMatch[1].trim();

  // Extract EXCERPT section
  var excerptMatch = content.match(/^## EXCERPT\n(.+?)(?=\n## )/ms);
  if (excerptMatch) excerpt = excerptMatch[1].trim();

  // Extract BODY section (everything after "Paste below into WordPress Code Editor:\n\n")
  var bodyMatch = content.match(/Paste below into WordPress Code Editor:\n\n([\s\S]+)$/);
  if (bodyMatch) body = bodyMatch[1].trim();

  return { title: title, excerpt: excerpt, body: body };
}

// ─── Push a single post ─────────────────────────────────────────
async function pushPost(wp, entry, lang) {
  var isHe = lang === 'he';
  var slug = isHe ? entry.heSlug : entry.enSlug;
  var file = isHe ? entry.heFile : entry.enFile;
  var filePath = path.join(CONTENT_DIR, file);

  if (!fs.existsSync(filePath)) {
    console.log('  SKIP: ' + file + ' (file not found)');
    return false;
  }

  var parsed = parsePostMd(filePath);
  if (!parsed.title || !parsed.body) {
    console.log('  SKIP: ' + file + ' (missing title or body)');
    return false;
  }

  var payload = {
    title: parsed.title,
    content: parsed.body,
    excerpt: parsed.excerpt || ''
  };

  var result = await wp.upsertPost(slug, payload);

  if (result.status === 200 || result.status === 201) {
    console.log('  ' + (isHe ? 'HE' : 'EN') + ' ' + result.action + ' — ID ' + result.id);
    if (result.data && result.data.link) {
      console.log('     ' + result.data.link);
    }
    return true;
  } else {
    console.log('  ERROR (' + result.status + '): ' + JSON.stringify(result.data).substring(0, 200));
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────────
function listPosts() {
  console.log('Available posts:\n');
  MANIFEST.forEach(function(entry) {
    var enExists = fs.existsSync(path.join(CONTENT_DIR, entry.enFile)) ? 'OK' : 'MISSING';
    var heExists = fs.existsSync(path.join(CONTENT_DIR, entry.heFile)) ? 'OK' : 'MISSING';
    console.log('  ' + entry.name.padEnd(12) + ' EN: ' + enExists.padEnd(8) + ' HE: ' + heExists);
  });
  console.log('\nUsage:');
  console.log('  node content/push-posts.js <name>           # push EN');
  console.log('  node content/push-posts.js <name> --he      # push HE');
  console.log('  node content/push-posts.js --all            # push all EN');
  console.log('  node content/push-posts.js --all --he       # push all HE');
  console.log('  node content/push-posts.js --all --both     # push all EN + HE');
}

async function main() {
  var args = process.argv.slice(2);
  var doAll = args.includes('--all');
  var doHe = args.includes('--he');
  var doBoth = args.includes('--both');
  var postName = args.find(function(a) { return !a.startsWith('--'); });

  // No args → list
  if (!doAll && !postName) {
    listPosts();
    return;
  }

  // Check credentials
  if (!fs.existsSync(CRED_PATH)) {
    console.log('Error: .wp-credentials not found at ' + CRED_PATH);
    console.log('Create it with:\n  url: https://staging6.jlmwines.com\n  username: <user>\n  app_password: <app_password>');
    process.exit(1);
  }

  var wp = require('../../tools/wp-api')(CRED_PATH);
  console.log('Connected to ' + wp.hostname + '\n');

  var entries = doAll ? MANIFEST : MANIFEST.filter(function(e) { return e.name === postName; });
  if (entries.length === 0) {
    console.log('Unknown post: ' + postName);
    console.log('Available: ' + MANIFEST.map(function(e) { return e.name; }).join(', '));
    process.exit(1);
  }

  var success = 0;
  var total = 0;

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    console.log(entry.name + ':');

    if (!doHe || doBoth) {
      total++;
      if (await pushPost(wp, entry, 'en')) success++;
    }
    if (doHe || doBoth) {
      total++;
      if (await pushPost(wp, entry, 'he')) success++;
    }
  }

  console.log('\nDone: ' + success + '/' + total + ' pushed.');
  if (doBoth) {
    console.log('Reminder: Link HE↔EN translations manually in WPML admin.');
  }
}

main().catch(function(err) {
  console.error('Fatal:', err.message);
  process.exit(1);
});
