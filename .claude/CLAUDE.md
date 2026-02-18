# JLM Wines — Project Kernel

JLM Wines is an online wine retailer in Israel. Anti-snob positioning — makes wine accessible, convenient, and easy. No jargon, no pretension.

## Session Start

1. Read `plans/STATUS.md` silently — single source of truth for project state.
2. State what you found: current status, next action, any blockers.
3. Ask: "Which area? (jlmops, website, content, marketing, business)"
4. Wait for confirmation before doing anything.

**At session end:** Use `/session` to update STATUS.md and portfolio dashboard.

## Sub-Areas

| Area | Folder | What | Context |
|------|--------|------|---------|
| **Middleware** | `jlmops/` | GAS backend — product/order sync, CRM, tasks | `jlmops/CLAUDE.md` |
| **Website** | `website/` | WooCommerce storefront (jlmwines.com) | `website/CLAUDE.md` |
| **Content** | `content/` | Blog posts, guides, video scripts | `content/CLAUDE.md` |
| **Marketing** | `marketing/` | Campaigns, promotions, email | `marketing/CLAUDE.md` |
| **Business** | `business/` | Strategy, brand, content strategy | `business/CLAUDE.md` |

## Key Documents

- `plans/STATUS.md` — master status, session history
- `CALENDAR.md` — dated tasks and milestones
- `jlmops/plans/` — architecture, data model, implementation, workflows, CRM, campaigns, resource optimization, strategic plan

## Brand Voice

Friendly, personal, never talks down. Polite and earnest, never negative about competitors. Goal: help people get wine they'll enjoy without making them feel dumb. Full guidelines in `business/CONTENT_STRATEGY.md`.

## Deployment

- **jlmops:** `clasp push` deploys GAS middleware. Config: edit `jlmops/config/*.json` → `node jlmops/generate-config.js` → `clasp push` → `rebuildSysConfigFromSource()`.
- **Git:** SSH via `github-jlmwines`. Branch `main`. Always `git push origin main`.
- **Sessions never push code.** User pushes, tests, then tells session to update docs/git.
