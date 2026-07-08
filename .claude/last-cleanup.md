2026-07-08 — project-scoped cleanup pass (jlmwines only).

Touched this pass:
- `.claude/bugs.md` — 4 stale entries resolved/trimmed: PROJ-CONTENT task routing (trimmed to pointer, full analysis already in `WORKFLOWS.md` §12.0); `attachExistingDoc` Drive-ownership bug (fixed 2026-07-08 per `DATA_MODEL.md`, moved to Resolved); Bundles N+1 (fixed @228/@229 2026-06-05, moved to Resolved); Calendar-shows-library-entities bug (resolved as a side effect of the CALENDAR_LIBRARY_LOOP_PLAN rework, moved to Resolved).
- `jlmops/plans/PERFORMANCE_OPTIMIZATION_PLAN.md` — fixed internal contradiction (header said "done," trailing `## Status` section still said "not implemented").
- `marketing/FLYER_PLAN.md` — Status + Open Items updated to current reality (printed, distribution scheduled after 9 Av to 5,000 Talbiye residences; done items checked off).
- `content/REGION_POSTS_PLAN.md` — Galilee slot status corrected from "held" to "in progress."
- `plans/STATUS.md` — at-a-glance (marketing) and Next Action items 1/2/3/5/6 updated to current reality (newsletter cadence, cartons, flyer, Negev promo email, Galilee) earlier in this session.
- `.claude/session-log.md` — pruned entries older than 30 days (2026-05-15 through 2026-06-07, ~620 lines) to a condensed pointer note; kept everything from 2026-06-08 forward plus two out-of-order 2026-06-23 entries that were sitting after the old block.

Audited, no change needed:
- `plans/STATUS.md` Inbox — 2 items, both current (PROJ-CONTENT `defer:2026-07-08` still genuinely blocked; offline-attribution `defer:2026-07-14` future-valid).
- `~/.claude/projects/.../memory/MEMORY.md` — no stale entries; `feedback_flag_convention_breaks_before_building` pattern recurred again this week (translation-trigger convention change), confirming it's still load-bearing.
- Other open bugs (jlmops: KPI sk_Period Date bug, ConfigService second-param drop, Product Replacement dead columns, web-inventory-export race, Mailchimp activity-log gap, sync-hardening/timestamp/count-task audits; web: gift/accessory description blanking, RankMath auto-push) — checked against relevant plan docs, all still genuinely open, no drift found.

Out of scope this pass (project-scoped, not portfolio-wide): portfolio `CALENDAR.md`, VaadAi, AliyahNet.
