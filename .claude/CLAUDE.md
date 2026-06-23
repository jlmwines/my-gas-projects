# JLM Wines — Project Kernel

JLM Wines is an online wine retailer in Israel. Anti-snob positioning — makes wine accessible, convenient, and easy. No jargon, no pretension.

For session protocols, file routing, and operating mechanics, see the portfolio kernel: `projects/.claude/CLAUDE.md`. Don't restate operating rules here.

## Session Start (project-specific)

After the universal session-start (per portfolio kernel — read `plans/STATUS.md` and the last 1–2 entries of `.claude/session-log.md`):

1. State what you found: current status, next action, any blockers.
2. Ask: "Which area? (jlmops, website, content, marketing, business)"
3. Wait for confirmation before doing anything.

## Pre-action checklist

Run before any action that touches code, modifies user data, or instructs the user to do something. Skip only for pure discussion/explanation.

1. **Cite the plan.** Point to the plan section/line that informed the action. If you can't, you haven't read enough.
2. **Search for automation.** Before "you need to do X manually," grep for an existing function that does X. Schema-to-sheet header updates already exist as `SetupSheets.js#syncHeaders`. See [[feedback_search_automation_before_manual_instructions]].
3. **Search for existing infrastructure.** Before "you need to create X," grep `.clasp.json`, `config/*.json`, `.gitignore`, `package.json`, memory. See [[feedback_search_repo_before_proposing_new]].
4. **Pick when the plan offers options.** "X or Y" in the plan = pick from precedent and proceed; don't bounce to the user. See [[feedback_pick_plan_options_not_pass_back]].
5. **Stale-framing scan.** If you just revised the plan, downstream framings must update — don't carry forward a constraint the revision removed.
6. **Narrate, don't re-ask.** In execution mode: "pushing now," not "OK to push?" The user already authorized the scope.

When the user says the session is being foolish: stop and re-run this checklist for the current step.

7. **Bug report ≠ ship order.** A report authorizes investigation only. Explicit OK at each gate: investigate → fix → deploy. Never fix-and-deploy on a report alone.
8. **Verify state before speaking.** Don't describe current state, open gaps, or what's in place without a positive tool result. Planning docs describe intent, not reality.
9. **Check live systems directly.** Use WebFetch or the REST API to answer "what's configured/installed" — don't ask the user.

## Sub-Areas

| Area | Folder | What | Context |
|------|--------|------|---------|
| **Middleware** | `jlmops/` | GAS backend — product/order sync, CRM, tasks | `jlmops/CLAUDE.md` |
| **Website** | `website/` | WooCommerce storefront (jlmwines.com) | `website/CLAUDE.md` |
| **Content** | `content/` | Blog posts, guides, video scripts | `content/CLAUDE.md` |
| **Marketing** | `marketing/` | Campaigns, promotions, email | `marketing/CLAUDE.md` |
| **Business** | `business/` | Strategy, brand, content strategy | `business/CLAUDE.md` |

## Key Documents

- `plans/STATUS.md` — current state, metrics, next action, inbox (dashboard only — no session history)
- `plans/OPERATIONS.md` — operational task registry; read when a session is about to execute a recurring task (publish post, register content, create email, deploy, etc.)
- `.claude/session-log.md` — Claude-internal session log
- `CALENDAR.md` — dated tasks and milestones
- `website/BRAND.md` — visual identity and brand guidelines for jlmwines.com
- `jlmops/plans/` — architecture, data model, implementation, workflows, CRM, campaigns, resource optimization, strategic plan

## Google Drive

Drive MCP authenticated as `accounts@jlmwines.com`. Key files: `JLMops_Data` (operational data behind the jlmops GAS app — products, orders, contacts) and the JLM GA4 sheet (analytics, active for periodic review). Consider Drive content as part of orientation for jlmops / KPI / marketing / SEO work.

## Brand Voice

Friendly, personal, never talks down. Polite and earnest, never negative about competitors. Goal: help people get wine they'll enjoy without making them feel dumb. Full guidelines in `business/CONTENT_STRATEGY.md`.

## Deployment

- **Theme to staging:** sessions may run `pwsh -NoProfile -File website/deploy-theme.ps1` directly after a code change. Incremental FTP push to staging6. Don't ask first — make the change, deploy, then report.
- **jlmops:** `clasp push` deploys GAS middleware. Config: edit `jlmops/config/*.json` → `node jlmops/generate-config.js` → `clasp push` → `rebuildSysConfigFromSource()`. Live deploy still needs explicit user OK.
- **jlmops live deploy:** always use the wrapper `pwsh -NoProfile -File jlmops/deploy.ps1 "<description>"`. NEVER call bare `clasp deploy` — that's the failure mode that has historically created orphan deployment URLs (memory `jlm_stable_deploy_id`). The wrapper now does three things in order: (1) **auto-stamps `VERSION.built` in `WebApp.js` with the real Israel-local time** via the timezone API — NEVER hand-stamp `built` yourself, the script owns it so the deploy timestamp can't be fabricated or drift; (2) runs `clasp push` itself — for a code deploy do NOT run `clasp push` separately first; (3) `clasp deploy --deploymentId <pinned>` + verifies the pinned ID survived. You still write the `commit:` description (and it's passed as the wrapper arg). If the pinned ID needs to change, update both `.deployment-id` and `system.deployment.pinned_id` in `config/system.json`. (Config-only pushes with no deploy still use bare `clasp push` + `rebuildSysConfigFromSource()`.)
- **Git:** remote `origin` over SSH config alias `github-jlmwines` (in `~/.ssh/config`). Branch `main`. Push command: `git push origin main`. Sessions push only when explicitly asked.
- **Live site (jlmwines.com):** user-driven only. Sessions don't push to live without explicit per-task authorization.
