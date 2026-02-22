#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// convert-posts.js — Batch convert docx → .post.md (WordPress blocks)
//
// Usage:
//   node content/convert-posts.js              # convert all 16
//   node content/convert-posts.js "Pairing EN" # convert one
// ═══════════════════════════════════════════════════════════════════

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.resolve(__dirname);

// ─── File manifest ────────────────────────────────────────────────
const FILES = [
  'Acidity EN_2025-01-12.docx',
  'Acidity HE_2025-01-12.docx',
  'Complexity EN_2025-01-12.docx',
  'Complexity HE.docx',
  'Intensity EN 2026-01-15 A.docx',
  'Intensity HE.docx',
  'Pairing EN_2026-01-06.docx',
  'Pairing HE.docx',
  'What is a Good Wine EN_2026-01-06.docx',
  'What is a Good Wine HE.docx',
  'Your Private Selection EN_2026-01-06.docx',
  'Your Private Selection HE.docx',
  'Price vs Quality EN 2026-01-18 B.docx',
  'Price vs Quality HE 2026-01-18 B.docx',
  'About Evyatar EN_2026-01-08.docx',
  'About Evyatar HE.docx'
];

// ─── Hebrew text cleaning ─────────────────────────────────────────
function cleanHebrew(text) {
  // Remove pandoc RTL/LTR span markers
  text = text.replace(/\{dir="rtl"\}/g, '');
  text = text.replace(/\{dir="ltr"\}/g, '');
  // Remove empty bracket spans (don't consume newlines)
  text = text.replace(/\[\][^\S\n]*/g, '');
  // Unwrap [text] brackets that pandoc adds for bidi spans
  text = text.replace(/\[([^\]]+)\]/g, '$1');
  // Strip blockquote markers (> ) that pandoc sometimes adds
  text = text.replace(/^> /gm, '');
  return text;
}

// ─── Markdown inline → HTML ──────────────────────────────────────
function inlineToHtml(text) {
  // Clean pandoc backslash linebreaks → space
  text = text.replace(/\\\s*/g, ' ');
  // Escape HTML entities
  text = text.replace(/&/g, '&amp;');
  // Bold: **text** → <strong>text</strong>
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* → <em>text</em>
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Pandoc dashes (---) → em dash
  text = text.replace(/---/g, '—');
  // Clean zero-width chars and stray escaped quotes
  text = text.replace(/[\u200F\u200E\u200B\uFEFF]/g, '');
  return text.trim();
}

// ─── Parse pandoc markdown into structured content ───────────────
function parseMarkdown(md, isHebrew) {
  if (isHebrew) md = cleanHebrew(md);

  var lines = md.split('\n');
  var title = '';
  var excerpt = '';
  var bodyLines = [];
  var inExcerptSection = false;
  var inMetaSection = false; // after Blog Roll Excerpt, for SEO/social/email sections

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();

    // Detect meta sections — EN markers
    if (/^\*\*Blog Roll Excerpt/i.test(trimmed)) {
      inExcerptSection = true;
      inMetaSection = true;
      continue;
    }
    // Detect meta sections — HE markers (after cleanHebrew strips brackets/dir)
    // Hebrew excerpt marker: בלוג: (Blog:) - with or without bold
    if (isHebrew && /^(\*\*)?בלוג:?\*?\*?\\?$/.test(trimmed) || /^בלוג:\\?$/.test(trimmed)) {
      inExcerptSection = true;
      inMetaSection = true;
      continue;
    }
    if (inExcerptSection && !excerpt && trimmed.length > 0) {
      // Extract excerpt - strip surrounding quotes (including Hebrew quotes)
      excerpt = trimmed.replace(/^[""\u201C\u201D\u05F4‏]+|[""\u201C\u201D\u05F4]+$/g, '').trim();
      excerpt = excerpt.replace(/^\*\*/, '').replace(/\*\*$/, '');
      inExcerptSection = false;
      continue;
    }
    if (inMetaSection) continue;

    // Check for separator (--- or horizontal rule) that marks end of body
    if (/^---+$/.test(trimmed) && bodyLines.length > 0) {
      inMetaSection = true;
      continue;
    }

    // Detect other meta sections → stop collecting body
    // EN: Search Engine Snippet, Social Media, Email, Newsletter
    if (/^\*\*Search Engine Snippet/i.test(trimmed) || /^\*\*Social Media/i.test(trimmed) ||
        /^\*\*Email:?\*\*/i.test(trimmed) || /^\*\*Newsletter/i.test(trimmed)) {
      inMetaSection = true;
      continue;
    }
    // HE: קטע למנוע חיפוש, טיזר לרשתות, אימייל, מייל, קטע מהניוזלטר, גרסת דף
    if (isHebrew && (/קטע למנוע חיפוש/.test(trimmed) || /טיזר לרשתות/.test(trimmed) ||
        /^(\*\*)?אימייל/.test(trimmed) || /^(\*\*)?מייל:?\*?\*?/.test(trimmed) ||
        /קטע.*ניוזלטר/.test(trimmed) || /גרסת דף/.test(trimmed) ||
        /רשתות חברתיות/.test(trimmed))) {
      inMetaSection = true;
      continue;
    }

    // Title: first bold-only line, or for Hebrew: first non-empty line
    if (!title) {
      var titleMatch = trimmed.match(/^\*\*(.+)\*\*$/);
      if (titleMatch) {
        title = titleMatch[1].trim();
        if (isHebrew) title = cleanHebrew(title);
        continue;
      }
      // Hebrew fallback: first non-empty line is the title
      if (isHebrew && trimmed.length > 0) {
        title = trimmed;
        continue;
      }
      if (trimmed === '') continue; // skip leading blanks
    }

    bodyLines.push(line);
  }

  // Clean title and excerpt of artifacts
  title = title.replace(/\\\s*/g, ' ').replace(/[\u200F\u200E\u200B\uFEFF]/g, '').trim();
  excerpt = excerpt.replace(/\\\s*/g, ' ').replace(/[\u200F\u200E\u200B\uFEFF]/g, '').replace(/^[""\u05F4‏]+|[""\u05F4]+$/g, '').trim();

  return { title: title, excerpt: excerpt, body: bodyLines.join('\n') };
}

// ─── Detect if a bold-only line is a subsection (h3) vs section (h2) ─
// Heuristic: short headings that appear within a parent section are h3.
function classifyHeading(text, prevHeadingLevel, gapSincePrevHeading, consecutiveH3) {
  var plain = text.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  // Always h2: long headings with sentence structure (colon + text, question, etc.)
  if (/[:?!]/.test(plain) && plain.length > 25) return 2;
  // After 4+ consecutive h3s, force reset to h2 (new section)
  if (consecutiveH3 >= 4) return 2;
  // Short heading after an h2 or h3 with small gap → h3 (subsection pattern)
  if ((prevHeadingLevel === 2 || prevHeadingLevel === 3) && gapSincePrevHeading < 4 && plain.length < 50) return 3;
  // Default: h2
  return 2;
}

// ─── Convert body markdown to WordPress blocks ──────────────────
function bodyToBlocks(bodyMd) {
  var lines = bodyMd.split('\n');
  var blocks = [];
  var prevHeadingLevel = 0;
  var paragraphsSinceHeading = 0;
  var consecutiveH3 = 0;
  var i = 0;

  while (i < lines.length) {
    var line = lines[i].trim();

    // Skip empty lines
    if (line === '') { i++; continue; }

    // Detect bold-only line → heading
    var headingMatch = line.match(/^\*\*(.+)\*\*$/);
    if (headingMatch) {
      var headingText = inlineToHtml(headingMatch[1]);
      var level = classifyHeading(headingText, prevHeadingLevel, paragraphsSinceHeading, consecutiveH3);
      if (level === 3) {
        blocks.push('<!-- wp:heading {"level":3} -->\n<h3>' + headingText + '</h3>\n<!-- /wp:heading -->');
        consecutiveH3++;
      } else {
        blocks.push('<!-- wp:heading -->\n<h2>' + headingText + '</h2>\n<!-- /wp:heading -->');
        consecutiveH3 = 0;
      }
      prevHeadingLevel = level;
      paragraphsSinceHeading = 0;
      i++;
      continue;
    }

    // Detect unordered list
    if (/^- /.test(line)) {
      var items = [];
      while (i < lines.length && /^- /.test(lines[i].trim())) {
        var itemText = lines[i].trim().replace(/^- /, '');
        // Continue multi-line list items (indented continuation)
        while (i + 1 < lines.length && /^\s{2,}/.test(lines[i + 1]) && !/^- /.test(lines[i + 1].trim())) {
          i++;
          itemText += ' ' + lines[i].trim();
        }
        items.push('<li>' + inlineToHtml(itemText) + '</li>');
        i++;
        // Skip blank line between list items
        if (i < lines.length && lines[i].trim() === '') i++;
      }
      blocks.push('<!-- wp:list -->\n<ul>' + items.join('') + '</ul>\n<!-- /wp:list -->');
      paragraphsSinceHeading++;
      continue;
    }

    // Detect ordered list
    if (/^\d+\.\s/.test(line)) {
      var items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        var itemText = lines[i].trim().replace(/^\d+\.\s/, '');
        while (i + 1 < lines.length && /^\s{2,}/.test(lines[i + 1]) && !/^\d+\.\s/.test(lines[i + 1].trim())) {
          i++;
          itemText += ' ' + lines[i].trim();
        }
        items.push('<li>' + inlineToHtml(itemText) + '</li>');
        i++;
        if (i < lines.length && lines[i].trim() === '') i++;
      }
      blocks.push('<!-- wp:list {"ordered":true} -->\n<ol>' + items.join('') + '</ol>\n<!-- /wp:list -->');
      paragraphsSinceHeading++;
      continue;
    }

    // Regular paragraph - collect until empty line or next structural element
    var paraText = '';
    while (i < lines.length && lines[i].trim() !== '' &&
           !/^\*\*[^*]+\*\*$/.test(lines[i].trim()) &&
           !/^- /.test(lines[i].trim()) &&
           !/^\d+\.\s/.test(lines[i].trim())) {
      if (paraText) paraText += ' ';
      paraText += lines[i].trim();
      i++;
    }
    if (paraText) {
      blocks.push('<!-- wp:paragraph -->\n<p>' + inlineToHtml(paraText) + '</p>\n<!-- /wp:paragraph -->');
      paragraphsSinceHeading++;
    }
  }

  return blocks;
}

// ─── Wrap blocks in a plain 2-column layout ─────────────────────
// Matches existing working posts: no widths, no CSS overrides.
function wrapColumns(leftBlocks, rightBlocks) {
  return '<!-- wp:columns -->\n' +
    '<div class="wp-block-columns">' +
    '<!-- wp:column -->\n' +
    '<div class="wp-block-column">' +
    leftBlocks.join('\n\n') +
    '</div>\n<!-- /wp:column -->\n\n' +
    '<!-- wp:column -->\n' +
    '<div class="wp-block-column">' +
    rightBlocks.join('\n\n') +
    '</div>\n<!-- /wp:column -->' +
    '</div>\n<!-- /wp:columns -->';
}

// ─── Estimate content weight (text length sans markup) ──────────
function contentWeight(blocks) {
  return blocks.join('').replace(/<[^>]+>/g, '').replace(/<!--[\s\S]*?-->/g, '').length;
}

// ─── Distribute a group of blocks into balanced columns ─────────
function distributeToColumns(blocks) {
  // Too little content for columns — full-width
  if (blocks.length <= 2) return blocks.join('\n\n');

  // Natural split: paragraphs/headings left, lists right
  var narrative = [];
  var lists = [];
  for (var i = 0; i < blocks.length; i++) {
    if (/<!-- wp:list/.test(blocks[i])) {
      lists.push(blocks[i]);
    } else {
      narrative.push(blocks[i]);
    }
  }
  if (lists.length > 0 && narrative.length > 0) {
    return wrapColumns(narrative, lists);
  }

  // No natural split — balance by weight, sequential order
  var totalWeight = contentWeight(blocks);
  var target = totalWeight / 2;
  var running = 0;
  var splitAt = 1;

  for (var i = 0; i < blocks.length - 1; i++) {
    running += contentWeight([blocks[i]]);
    splitAt = i + 1;
    if (running >= target) break;
  }

  return wrapColumns(blocks.slice(0, splitAt), blocks.slice(splitAt));
}

// ─── Build post body with 2-column distribution ─────────────────
// h2 headings go full-width. Content between h2s is distributed
// into columns: paired by h3 sub-sections, or balanced by weight.
function buildBody(blocks) {
  // Split at h2 boundaries
  var sections = [];
  var currentH2 = null;
  var currentBlocks = [];

  for (var i = 0; i < blocks.length; i++) {
    if (/<!-- wp:heading -->/.test(blocks[i]) && !/<!-- wp:heading \{"level"/.test(blocks[i])) {
      if (currentH2 !== null || currentBlocks.length > 0) {
        sections.push({ h2: currentH2, content: currentBlocks });
      }
      currentH2 = blocks[i];
      currentBlocks = [];
    } else {
      currentBlocks.push(blocks[i]);
    }
  }
  if (currentH2 !== null || currentBlocks.length > 0) {
    sections.push({ h2: currentH2, content: currentBlocks });
  }

  var output = [];

  for (var s = 0; s < sections.length; s++) {
    var section = sections[s];

    // h2 heading goes full-width
    if (section.h2) output.push(section.h2);

    var content = section.content;
    if (content.length === 0) continue;

    // Group content at h3 boundaries into sub-sections
    var subsections = [];
    var cur = [];
    for (var j = 0; j < content.length; j++) {
      if (/<!-- wp:heading \{"level":3\}/.test(content[j]) && cur.length > 0) {
        subsections.push(cur);
        cur = [];
      }
      cur.push(content[j]);
    }
    if (cur.length > 0) subsections.push(cur);

    if (subsections.length >= 2) {
      // Pair consecutive h3 sub-sections into column blocks
      for (var k = 0; k < subsections.length; k += 2) {
        if (k + 1 < subsections.length) {
          output.push(wrapColumns(subsections[k], subsections[k + 1]));
        } else {
          // Odd sub-section — distribute its blocks or full-width
          output.push(distributeToColumns(subsections[k]));
        }
      }
    } else {
      // Single group — distribute by content type or weight
      output.push(distributeToColumns(content));
    }
  }

  return output.join('\n\n');
}

// ─── Assemble .post.md file ─────────────────────────────────────
function buildPostMd(title, excerpt, blocks) {
  var body = buildBody(blocks);

  return '## TITLE\n' + title + '\n\n' +
    '## EXCERPT\n' + excerpt + '\n\n' +
    '## BODY\nPaste below into WordPress Code Editor:\n\n' + body + '\n';
}

// ─── Convert one file ───────────────────────────────────────────
function convertFile(docxFile) {
  var fullPath = path.join(CONTENT_DIR, docxFile);
  if (!fs.existsSync(fullPath)) {
    console.log('  SKIP (not found): ' + docxFile);
    return false;
  }

  var isHebrew = / HE[_. ]/.test(docxFile) || / HE\.docx$/.test(docxFile);

  // Run pandoc
  var md;
  try {
    md = execSync('pandoc "' + fullPath + '" -t markdown --wrap=none', { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  } catch (e) {
    console.log('  ERROR (pandoc): ' + e.message);
    return false;
  }

  // Parse
  var parsed = parseMarkdown(md, isHebrew);
  if (!parsed.title) {
    console.log('  WARNING: No title found in ' + docxFile);
    return false;
  }

  // Convert body to blocks
  var blocks = bodyToBlocks(parsed.body);

  // Build output
  var postMd = buildPostMd(parsed.title, parsed.excerpt || '', blocks);

  // Write .post.md alongside the docx
  var outFile = docxFile.replace(/\.docx$/, '.post.md');
  var outPath = path.join(CONTENT_DIR, outFile);
  fs.writeFileSync(outPath, postMd, 'utf8');
  console.log('  ✓ ' + outFile + ' (' + blocks.length + ' blocks, title: "' + parsed.title.substring(0, 50) + '...")');
  return true;
}

// ─── Main ───────────────────────────────────────────────────────
var filter = process.argv[2];
var filesToConvert = FILES;
if (filter) {
  filesToConvert = FILES.filter(function(f) { return f.toLowerCase().includes(filter.toLowerCase()); });
  if (filesToConvert.length === 0) {
    console.log('No files matching: ' + filter);
    process.exit(1);
  }
}

console.log('Converting ' + filesToConvert.length + ' file(s)...\n');
var success = 0;
filesToConvert.forEach(function(f) {
  console.log(f);
  if (convertFile(f)) success++;
});
console.log('\nDone: ' + success + '/' + filesToConvert.length + ' converted.');
