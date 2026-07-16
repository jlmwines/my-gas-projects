#!/usr/bin/env node
// PreToolUse hook (matcher: Bash). Blocks `cd <dir> && <command>` / `cd <dir>; <command>`
// compound commands. This is the exact repeat-failure pattern in memory
// feedback_no_redundant_cd_prefix.md: chaining cd onto a single scoped command
// (redundant re-cd to a dir the shell is already in, or cd-into-subdir for one
// lookup that a path argument would reach directly). Memory text alone never
// stopped it because it's advisory, not enforced. This makes it mechanical.
// Does NOT block a bare `cd <dir>` issued as its own call — that's the correct
// way to move the shell when a directory genuinely needs to persist across
// several following commands. Fails OPEN on any internal error.
let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const command = data && data.tool_input && data.tool_input.command;
    if (typeof command !== 'string') return;

    const trimmed = command.trim();
    if (/^cd\s+\S/.test(trimmed) && /&&|;/.test(trimmed)) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            'BLOCKED: this chains `cd` onto another command in one Bash call. The shell\'s cwd already persists between calls, and most commands (git, ls, cat, grep, node scripts) accept a path argument that reaches the same place without moving the shell at all — use that instead (e.g. `git log -- jlmops/src/Foo.html`, not `cd jlmops && git log -- src/Foo.html`). If the working directory genuinely must persist across several following commands, issue `cd <dir>` as its own standalone call, not chained onto this one.'
        }
      }));
    }
  } catch (e) {
    // fail open
  }
  process.exit(0);
});
