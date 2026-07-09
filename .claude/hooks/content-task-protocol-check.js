#!/usr/bin/env node
// UserPromptSubmit hook. When the user asks for content/library/publishing work
// (email, blog post, newsletter, library, calendar, AYIW, publish, draft), and
// jlmops/docs/DATA_MODEL.md and/or jlmops/plans/CONTENT_CREATION_CHECKLIST.md
// haven't been read yet this session, inject a forceful instruction: read both,
// then explicitly confirm to the user (before drafting or writing anything) which
// docs were read and how the protocol applies to this task.
//
// This is a nudge, not a hard block — UserPromptSubmit can't restrict which tools
// are usable later in the turn. The real enforcement is the separate PreToolUse
// deny hook (require-data-model-read.js) on the Drive write tools, which cannot be
// bypassed even if this instruction is ignored. This hook exists so the check (and
// the visible confirmation to the user) happens at the START of the task, not only
// discovered via a block once the session is already mid-draft.
//
// DEBUG: writes the raw stdin payload to a scratch file on every firing so the
// actual UserPromptSubmit field name can be empirically confirmed, since it was
// not verified before this hook was authored (unlike the PreToolUse schema, which
// was confirmed via a live dump on 2026-07-09).

const fs = require('fs');

const DEBUG_DUMP_PATH =
  'C:/Users/B/AppData/Local/Temp/claude/C--Users-B-projects-jlmwines/01fdf3ba-f20b-44f5-816c-c77711bdd86e/scratchpad/last-user-prompt-submit-input.json';

const KEYWORD_RE = /\b(email|newsletter|blog(?:[\s-]?post)?|library|calendar|ayiw|publish(?:ing)?|content\s+task|create\s+content|draft(?:ing)?)\b/i;
const DATA_MODEL_RE = /"name":"Read","input":\{"file_path":"[^"]*DATA_MODEL\.md"/i;
const CHECKLIST_RE = /"name":"Read","input":\{"file_path":"[^"]*CONTENT_CREATION_CHECKLIST\.md"/i;

let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  try {
    fs.writeFileSync(DEBUG_DUMP_PATH, input);
  } catch (e) {
    // debug dump is best-effort only
  }

  try {
    const data = JSON.parse(input || '{}');
    const promptText = data.prompt ?? data.message ?? data.user_prompt ?? data.text ?? '';
    if (typeof promptText !== 'string' || !KEYWORD_RE.test(promptText)) return; // not a content task: silent

    const transcriptPath = data.transcript_path;
    if (typeof transcriptPath !== 'string' || !fs.existsSync(transcriptPath)) {
      return remind(); // no transcript yet (first message of session) — remind
    }

    const content = fs.readFileSync(transcriptPath, 'utf8');
    const lines = content.split('\n');
    const hasDataModel = lines.some(l => DATA_MODEL_RE.test(l));
    const hasChecklist = lines.some(l => CHECKLIST_RE.test(l));
    if (hasDataModel && hasChecklist) return; // protocol already read this session: silent

    return remind(hasDataModel, hasChecklist);
  } catch (e) {
    // fail open — a hook bug must never block real work
  }
});

function remind(hasDataModel, hasChecklist) {
  const missing = [];
  if (!hasDataModel) missing.push('jlmops/docs/DATA_MODEL.md (Publishing Calendar + SysLibrary sections)');
  if (!hasChecklist) missing.push('jlmops/plans/CONTENT_CREATION_CHECKLIST.md');
  const missingList = missing.length ? missing.join(' and ') : 'jlmops/docs/DATA_MODEL.md and jlmops/plans/CONTENT_CREATION_CHECKLIST.md';

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext:
        `CONTENT-TASK PROTOCOL CHECK: this request looks like content/library/publishing work (email, blog, newsletter, library, calendar, or similar). Before drafting, searching Drive, or writing anything, read ${missingList}. Then, before taking any drafting/placement action, tell the user explicitly which docs you read and how the write mechanics apply to this specific task (e.g. calendar staging path vs. library having no session write path) — a visible confirmation, not just an internal note. Do not skip to drafting because a plan doc alone seems sufficient; DATA_MODEL.md is the authoritative source for write mechanics. (Note: a hard PreToolUse block on the actual Drive-write tools also exists as a backstop — this reminder is what makes compliance happen early, before work is invested.)`
    }
  }));
  process.exit(0);
}
