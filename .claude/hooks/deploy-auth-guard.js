#!/usr/bin/env node
// PreToolUse hook (matcher: Bash). Forces a permission prompt for live-deploy
// commands that the global settings.json allow-list otherwise pre-approves
// silently. Real gap found 2026-08-28 via /review-claude: Bash(clasp:*),
// Bash(pwsh *), Bash(powershell.exe *), Bash(powershell *) are all
// unconditional allows in ~/.claude/settings.json, so bare `clasp deploy` and
// both deploy wrappers (jlmops/deploy.ps1, website/deploy-theme.ps1) ran with
// ZERO permission prompt — directly contradicting jlmwines/.claude/CLAUDE.md:
// "NEVER call bare clasp deploy", "Live deploy still needs explicit user OK",
// "Live site... user-driven only... sessions don't push to live without
// explicit per-task authorization". This does NOT ban deploys — it restores
// the confirmation prompt CLAUDE.md's text already promises but the broad
// allow-list was silently skipping. A narrower permission-list entry can't do
// this: deploy.ps1/deploy-theme.ps1 invocations vary in flag order/quoting
// (pwsh -NoProfile -File <path> "<description>"), so only a command-content
// regex — not a fixed prefix — reliably catches every shape. Fails OPEN on
// any internal error — a hook bug must never block real work.
let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input || '{}');
    const command = data && data.tool_input && data.tool_input.command;
    if (typeof command !== 'string') return;

    // `clasp deploy` (not `clasp push`, `clasp login`, etc.) — the exact
    // anti-pattern CLAUDE.md flags as the historical cause of orphan
    // deployment URLs (memory jlm_stable_deploy_id.md). `clasp deploy`
    // invoked from INSIDE deploy.ps1 is not visible here (it runs inside the
    // pwsh process), so this only ever catches Claude calling clasp deploy
    // directly, bypassing the wrapper.
    const bareClaspDeploy = /\bclasp\s+deploy\b/i.test(command);
    const deployScript = /\bdeploy(-theme)?\.ps1\b/i.test(command);

    if (bareClaspDeploy || deployScript) {
      const reason = bareClaspDeploy
        ? 'bare `clasp deploy`'
        : 'a live-deploy wrapper script (deploy.ps1 / deploy-theme.ps1)';
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason:
            `This command runs ${reason}, which pushes to the LIVE system (jlmops or jlmwines.com). The global settings.json allow-list would otherwise skip the permission prompt for this. Per jlmwines/.claude/CLAUDE.md: "Live deploy still needs explicit user OK" / "Live site... user-driven only." Confirm the user gave EXPLICIT per-task authorization for THIS deploy (not a prior task's OK) before proceeding.`
        }
      }));
    }
  } catch (e) {
    // fail open
  }
  process.exit(0);
});
