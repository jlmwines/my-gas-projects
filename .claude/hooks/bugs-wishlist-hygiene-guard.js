#!/usr/bin/env node
// PreToolUse hook (matcher: Edit|Write). Enforces bugs.md/wishlist.md's own
// documented "one line per item: date + symptom + pointer" rule (see each
// file's own header) at write time. Real gap found via /review-claude
// 2026-08-28: STATUS.md has status-hygiene-guard.js enforcing the same class
// of rule, but bugs.md/wishlist.md never got the equivalent — several
// entries drifted into full root-cause paragraphs (400-900+ chars) with
// nothing catching it until a review ran. Simpler than status-hygiene-guard.js
// on purpose: these files aren't structured into governed zones like
// STATUS.md (At a glance / Metrics / Current State) — every non-empty line
// is subject to the same one-line convention, so a flat per-line length
// check is sufficient. Fails OPEN on any internal error or on any file this
// isn't scoped to.
const MAX_LINE = 200;
const TARGET_SUFFIXES = ['jlmwines/.claude/bugs.md', 'jlmwines/.claude/wishlist.md'];

let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const filePath = data && data.tool_input && data.tool_input.file_path;
    if (typeof filePath !== 'string') return;

    const normalized = filePath.replace(/\\/g, '/');
    if (!TARGET_SUFFIXES.some(s => normalized.endsWith(s))) return;

    const toolName = data.tool_name;
    let textToCheck = null;
    if (toolName === 'Write') {
      textToCheck = data.tool_input.content;
    } else if (toolName === 'Edit') {
      textToCheck = data.tool_input.new_string;
    }
    if (typeof textToCheck !== 'string') return;

    for (const line of textToCheck.split('\n')) {
      if (line.length > MAX_LINE) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason:
              `BLOCKED: this line is ${line.length} chars (limit ~${MAX_LINE}): "${line.trim().slice(0, 90)}...". Per this file's own header: one line per item — date + symptom + pointer to the plan doc or git commit holding the analysis. Move the detail there and keep this line to the pointer.`
          }
        }));
        return;
      }
    }
  } catch (e) {
    // fail open
  }
  process.exit(0);
});
