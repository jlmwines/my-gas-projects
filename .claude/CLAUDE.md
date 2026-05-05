# JLM Wines — Project Kernel

JLM Wines is an online wine retailer in Israel. Anti-snob positioning — makes wine accessible, convenient, and easy. No jargon, no pretension.

## Session Start

1. Read `plans/STATUS.md` silently — single source of truth for project state.
2. Check the **Metrics** table and **Inbox** section — surface any cross-project notes.
3. State what you found: current status, next action, any blockers.
4. Ask: "Which area? (jlmops, website, content, marketing, business)"
5. Wait for confirmation before doing anything.

**Mid-session:** Use `/break` to save progress (STATUS.md + wip commit + push). Run every 30-60 min.
**End of session:** Use `/wrap` to update status, metrics, commit.

## Sub-Areas

| Area | Folder | What | Context |
|------|--------|------|---------|
| **Middleware** | `jlmops/` | GAS backend — product/order sync, CRM, tasks | `jlmops/CLAUDE.md` |
| **Website** | `website/` | WooCommerce storefront (jlmwines.com) | `website/CLAUDE.md` |
| **Content** | `content/` | Blog posts, guides, video scripts | `content/CLAUDE.md` |
| **Marketing** | `marketing/` | Campaigns, promotions, email | `marketing/CLAUDE.md` |
| **Business** | `business/` | Strategy, brand, content strategy | `business/CLAUDE.md` |

## Key Documents

- `plans/STATUS.md` — master status, session history, metrics, inbox
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
- **Git:** SSH via `github-jlmwines`. Branch `main`. User handles `git push origin main` after testing.
- **Live site (jlmwines.com):** user-driven only. Sessions don't push to live without explicit per-task authorization.
