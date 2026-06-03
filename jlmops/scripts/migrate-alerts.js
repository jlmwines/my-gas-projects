#!/usr/bin/env node
/**
 * One-off: rewrite native alert(ARG) -> TaskWidgets.toast(ARG, TYPE) in view HTML.
 * Uses balanced-paren matching (not a greedy regex) so nested parens / inline-arrow
 * cases (`=> alert('x')`) are handled correctly. Confirms are NOT touched.
 * Prints every change for review; only writes with --write.
 */
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..');
const write = process.argv.includes('--write');
const targets = process.argv.filter(a => a.endsWith('.html'));

function typeFor(arg) {
  if (/\berror\b|fail|could not|couldn'?t|unable|invalid/i.test(arg)) return 'error';
  if (/please|required|must|select|enter|pick|provide|already|no more|no open|not (linked|loaded|selected)/i.test(arg)) return 'warning';
  return 'success';
}

// Returns {arg, end} for the balanced-paren content starting just after `alert(`.
function extractArg(s, openIdx) {
  let depth = 0, inStr = null, i = openIdx;
  for (; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return { arg: s.slice(openIdx + 1, i), end: i }; }
  }
  return null;
}

let totalChanges = 0;
for (const f of targets) {
  const p = path.join(dir, f);
  let src = fs.readFileSync(p, 'utf8');
  let out = '', idx = 0, changes = 0;
  const re = /(^|[^.\w])alert\s*\(/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const openParen = m.index + m[0].length - 1;
    const ext = extractArg(src, openParen);
    if (!ext) continue; // unbalanced — skip, handle by hand
    const arg = ext.arg.trim();
    const type = typeFor(arg);
    out += src.slice(idx, m.index) + m[1] + 'TaskWidgets.toast(' + arg + ", '" + type + "')";
    idx = ext.end + 1;
    changes++;
    console.log(`${f}: [${type}] alert(${arg.slice(0, 70)})`);
    re.lastIndex = ext.end + 1;
  }
  out += src.slice(idx);
  if (changes && write) fs.writeFileSync(p, out);
  if (changes) { totalChanges += changes; console.log(`  -> ${f}: ${changes} change(s)${write ? ' WRITTEN' : ''}\n`); }
}
console.log(`Total: ${totalChanges} alert() conversions${write ? '' : ' (dry run — pass --write)'}`);
