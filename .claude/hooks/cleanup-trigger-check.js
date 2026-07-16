#!/usr/bin/env node
// SessionStart hook. Mechanizes the portfolio kernel's session-start step 4
// ("check cleanup triggers ... append one line to the standard report"),
// which previously relied entirely on the model remembering to read three
// files and do the date math itself — the same soft-reminder failure mode
// that let doc-hygiene drift accumulate for months. Reads
// .claude/last-cleanup.md's leading date, plans/STATUS.md's "Updated:" date,
// and the Inbox item count against the kernel's own stated thresholds, and
// injects additionalContext naming exactly which threshold(s) fired so the
// model can't quietly skip surfacing it. Fails OPEN (silent) on any missing
// file or internal error — a hook bug must never block session start.
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = 'C:/Users/B/projects/jlmwines';
const LAST_CLEANUP_PATH = path.join(PROJECT_ROOT, '.claude/last-cleanup.md');
const STATUS_PATH = path.join(PROJECT_ROOT, 'plans/STATUS.md');

const CLEANUP_MAX_DAYS = 7;
const STATUS_MAX_DAYS = 7;
const INBOX_MAX_ITEMS = 5;

function daysAgo(dateStr) {
  const then = new Date(dateStr + 'T00:00:00Z').getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86400000);
}

function checkLastCleanup(triggers) {
  let text;
  try {
    text = fs.readFileSync(LAST_CLEANUP_PATH, 'utf8');
  } catch (e) {
    triggers.push('cleanup never run (.claude/last-cleanup.md missing)');
    return;
  }
  const m = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) return; // can't parse a date — don't guess, don't block
  const age = daysAgo(m[1]);
  if (age !== null && age > CLEANUP_MAX_DAYS) {
    triggers.push(`last cleanup was ${age} days ago (${m[1]}, threshold ${CLEANUP_MAX_DAYS})`);
  }
}

function checkStatus(triggers) {
  let text;
  try {
    text = fs.readFileSync(STATUS_PATH, 'utf8');
  } catch (e) {
    return; // STATUS.md missing entirely is a bigger problem than this hook should raise
  }

  const updatedMatch = text.match(/^\*{0,2}Updated:\*{0,2}\s*(\d{4}-\d{2}-\d{2})/m);
  if (updatedMatch) {
    const age = daysAgo(updatedMatch[1]);
    if (age !== null && age > STATUS_MAX_DAYS) {
      triggers.push(`STATUS.md "Updated:" is ${age} days stale (${updatedMatch[1]}, threshold ${STATUS_MAX_DAYS})`);
    }
  }

  const inboxStart = text.search(/^## Inbox\b/m);
  if (inboxStart === -1) return;
  const rest = text.slice(inboxStart + 1);
  const nextHeadingRel = rest.search(/^## /m);
  const inboxBody = nextHeadingRel === -1 ? rest : rest.slice(0, nextHeadingRel);
  const items = (inboxBody.match(/^-\s+\*\*/gm) || []).length;
  if (items > INBOX_MAX_ITEMS) {
    triggers.push(`Inbox has ${items} items (threshold ${INBOX_MAX_ITEMS})`);
  }
}

function main() {
  const triggers = [];
  checkLastCleanup(triggers);
  checkStatus(triggers);
  if (triggers.length === 0) return;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext:
        `CLEANUP TRIGGER CHECK (mechanical, per portfolio kernel session-start step 4): ${triggers.join('; ')}. Surface this to the user as "Cleanup suggested — <reason>" in your first response this session, per the kernel's session-start protocol — don't wait to be asked.`
    }
  }));
}

try {
  main();
} catch (e) {
  // fail open
}
process.exit(0);
