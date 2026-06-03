#!/usr/bin/env node
/**
 * Conformance guard for the notification standard (plans/NOTIFICATION_UX_PLAN.md).
 * Flags bare native alert(...) / confirm(...) in view HTML — these add the ugly
 * un-styleable browser header inside the Apps Script iframe. Use TaskWidgets.toast
 * / TaskWidgets.confirm instead.
 *
 * Usage:
 *   node scripts/check-no-native-dialogs.js          # report (always exits 0)
 *   node scripts/check-no-native-dialogs.js --strict  # exit 1 if any found (wire to deploy once Phases 3-4 land)
 *
 * Ignores TaskWidgets.confirm( / *.confirm( method calls and the helper's own file.
 */
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..');
const strict = process.argv.includes('--strict');
const NATIVE = /(^|[^.\w])(alert|confirm)\s*\(/; // bare alert(/confirm(, not x.confirm(
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

let total = 0;
const perFile = [];
for (const f of files) {
  if (f === 'TaskWidgets.html') continue; // defines the replacements
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
  let count = 0;
  lines.forEach((line, i) => {
    if (NATIVE.test(line) && !/TaskWidgets\.(toast|confirm)/.test(line)) {
      count++;
      if (process.env.VERBOSE) console.log(`  ${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
    }
  });
  if (count) { perFile.push([f, count]); total += count; }
}

perFile.sort((a, b) => b[1] - a[1]).forEach(([f, c]) => console.log(`${String(c).padStart(3)}  ${f}`));
console.log(`\nTotal native alert()/confirm() in views: ${total}`);
if (strict && total > 0) {
  console.error('FAIL (--strict): native dialogs present. Use TaskWidgets.toast / TaskWidgets.confirm.');
  process.exit(1);
}
