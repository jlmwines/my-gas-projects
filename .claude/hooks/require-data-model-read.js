#!/usr/bin/env node
// PreToolUse hook (matcher: mcp__claude_ai_Google_Drive__create_file|mcp__claude_ai_Google_Drive__copy_file).
// Blocks Drive writes to the calendar/library workflow until jlmops/docs/DATA_MODEL.md
// has actually been read this session. Real incident, 2026-07-09: a session staged a
// calendar-merge file via create_file after reading only a downstream plan doc
// (CONTENT_CREATION_CHECKLIST.md), never DATA_MODEL.md's "Publishing Calendar" /
// "SysLibrary" write-rules sections — which is where the calendar's staging/merge
// mechanism and SysLibrary's total lack of a session write path are actually documented.
// Memory/CLAUDE.md instructions stating this rule had already failed repeatedly; this
// moves the check into the harness so it can't be skipped by forgetting or satisficing
// on a nearer doc. Fails OPEN on any internal error (can't read transcript, bad JSON,
// etc.) — a hook bug must never block real work; only a genuine missing-read blocks.

const fs = require('fs');

const GATED_TOOLS = new Set([
  'mcp__claude_ai_Google_Drive__create_file',
  'mcp__claude_ai_Google_Drive__copy_file',
]);

const READ_EVIDENCE_RE = /"name":"Read","input":\{"file_path":"[^"]*DATA_MODEL\.md"/i;

let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    if (!GATED_TOOLS.has(data.tool_name)) return; // not a gated tool: allow, silent

    const transcriptPath = data.transcript_path;
    if (typeof transcriptPath !== 'string' || !fs.existsSync(transcriptPath)) return; // fail open

    const content = fs.readFileSync(transcriptPath, 'utf8');
    const hasRead = content.split('\n').some(line => READ_EVIDENCE_RE.test(line));
    if (hasRead) return; // evidence found: allow, silent

    return deny();
  } catch (e) {
    // fail open — a hook bug must never block real work
  }
});

function deny() {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        'BLOCKED: no Read of jlmops/docs/DATA_MODEL.md found yet this session. This tool writes into the calendar/library Drive workflow, whose actual write mechanics (the "Publishing Calendar" and "SysLibrary" sections — calendar has a staging/merge path via system.folder.calendar, SysLibrary has NO session write path at all) live only in DATA_MODEL.md, not in any plan/checklist doc. Read jlmops/docs/DATA_MODEL.md first, then retry.'
    }
  }));
  process.exit(0);
}
