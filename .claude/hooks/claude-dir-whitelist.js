#!/usr/bin/env node
// PreToolUse hook (matcher: Write). Enforces the portfolio kernel's "one file
// per class" rule for jlmwines/.claude/ by WHITELIST rather than chasing bad
// filenames one at a time — a blocklist (block "SESSION_SUMMARY.md") only ever
// stops the exact name it names; the next stray file is "SESSION_NOTES.md" or
// "project-notes.md" and slips through. A whitelist stops the whole class.
// Concretely: SESSION_SUMMARY.md and project-context.md both existed here in
// violation of the kernel's explicit "session-log.md is the only session-
// history file" / "no parallel architecture doc" rules, undetected for
// months because nothing enforced it except a cleanup session remembering to
// look. Fails OPEN on any internal error or on any path outside the
// jlmwines/.claude/ directory itself (subfolders like hooks/, commands/,
// plans/ are untouched — this only gates new top-level files in .claude/).
const path = require('path');

const CLAUDE_DIR_SUFFIX = 'jlmwines/.claude';
const ALLOWED_FILES = new Set([
  'CLAUDE.md',
  'session-log.md',
  'bugs.md',
  'wishlist.md',
  'last-cleanup.md',
  'settings.json',
  'settings.local.json',
]);

let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const filePath = data && data.tool_input && data.tool_input.file_path;
    if (typeof filePath !== 'string') return;

    const normalized = filePath.replace(/\\/g, '/');
    const dir = path.posix.dirname(normalized);
    if (!dir.endsWith(CLAUDE_DIR_SUFFIX)) return; // only gate the top level of .claude/, not subfolders

    const basename = path.posix.basename(normalized);
    if (ALLOWED_FILES.has(basename)) return;

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `BLOCKED: "${basename}" is not on the allowed list for jlmwines/.claude/ (${[...ALLOWED_FILES].join(', ')}). Per the portfolio kernel's Operating Model: session-log.md is the ONLY session-history file (no SESSION_SUMMARY.md, no session-summary-YYYY-MM-DD.md, no parallel context/notes doc). Architecture and behavior facts belong in a system doc under jlmops/docs/ (ARCHITECTURE.md, DATA_MODEL.md, WORKFLOWS.md) or the project's plans/*.md — not in .claude/. If this file's content is a session narrative, append it to session-log.md instead. If it's an architecture fact, add it to the relevant system doc instead. If you believe this file genuinely needs a new home here, stop and ask the user before adding it to the whitelist.`
      }
    }));
  } catch (e) {
    // fail open
  }
  process.exit(0);
});
