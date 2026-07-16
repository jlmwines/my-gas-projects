#!/usr/bin/env node
// PreToolUse hook (matcher: Write). Repo-wide filename-pattern block for the
// "session narrative / architecture-in-disguise" shape, wherever it's about
// to be written — not just inside .claude/. This is the companion to
// claude-dir-whitelist.js: that hook only gates the top level of jlmwines/
// .claude/ itself, but a 2026-07 audit found stray files with this exact
// shape sitting at the REPO ROOT (session-summary-2026-02-23.md) and inside
// jlmops/ (jlmops/session-summary-2026-02-15.md) — neither caught by a
// directory-scoped whitelist. A filename pattern catches the shape no matter
// where it's written. Fails OPEN on any internal error.
const path = require('path');

// Deliberately does NOT match .claude/session-log.md (no "log" in these) or
// jlmops/docs/*.md system docs (no "session"/"project-context" in their names).
const STRAY_PATTERNS = [
  /^session[-_]?summary/i,
  /^session[-_]?notes/i,
  /^project[-_]context/i,
];

let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const filePath = data && data.tool_input && data.tool_input.file_path;
    if (typeof filePath !== 'string') return;

    const normalized = filePath.replace(/\\/g, '/');
    if (!normalized.includes('/jlmwines/') && !normalized.startsWith('jlmwines/')) return;

    const basename = path.posix.basename(normalized);
    const matched = STRAY_PATTERNS.find(re => re.test(basename));
    if (!matched) return;

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `BLOCKED: "${basename}" matches a stray session-narrative/architecture-doc filename shape (pattern ${matched}). Per the portfolio kernel's Operating Model, session narrative has exactly one home — ".claude/session-log.md" (append, don't create a new file) — and architecture/behavior facts belong in a system doc (jlmops/docs/ARCHITECTURE.md, DATA_MODEL.md, WORKFLOWS.md) or a plans/*.md, never a standalone context/notes file. This pattern already produced 4 duplicate files scattered across the repo before it was caught. Use the sanctioned destination instead.`
      }
    }));
  } catch (e) {
    // fail open
  }
  process.exit(0);
});
