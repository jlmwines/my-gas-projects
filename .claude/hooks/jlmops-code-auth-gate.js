#!/usr/bin/env node
// Per-turn authorization gate for jlmops code edits (jlmops/*.js, jlmops/*.html,
// jlmops/config/**). Replaces the settings.local.json `ask` rules, which prompted
// on EVERY edit even in accept-edits mode. Intent (user, 2026-10-27): stop code
// changes until the user authorizes the change, not re-confirm each write.
//
// Modes (argv[2]):
//   pre   (PreToolUse Edit|Write)  — no approval yet this turn → ask once.
//   post  (PostToolUse Edit|Write) — an edit actually ran, so the user approved
//                                    → mark this session's turn as authorized.
//   reset (UserPromptSubmit)       — new user message → clear the mark.
// A denied prompt never runs the tool, so `post` never fires and nothing is
// remembered. Marker lives in the OS temp dir, keyed by session_id.
// Fails OPEN on any internal error — a hook bug must never block real work.
const fs = require('fs');
const os = require('os');
const path = require('path');

const GATED = /\/projects\/jlmwines\/jlmops\/([^/]+\.(js|html)|config\/.+)$/i;

let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  try {
    const mode = process.argv[2];
    const data = JSON.parse(input || '{}');
    const sessionId = String(data.session_id || 'unknown').replace(/[^\w-]/g, '');
    const marker = path.join(os.tmpdir(), `jlmops-code-auth-${sessionId}`);

    if (mode === 'reset') {
      if (fs.existsSync(marker)) fs.unlinkSync(marker);
      return;
    }

    const filePath = String((data.tool_input && data.tool_input.file_path) || '').replace(/\\/g, '/');
    if (!GATED.test(filePath)) return;

    if (mode === 'post') {
      fs.writeFileSync(marker, new Date().toISOString());
      return;
    }

    if (mode === 'pre' && !fs.existsSync(marker)) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason:
            'First jlmops code edit this turn. Approve to authorize this change; further jlmops edits in this turn will not ask again.'
        }
      }));
    }
  } catch (e) {
    // fail open
  }
  process.exit(0);
});
