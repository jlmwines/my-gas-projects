2026-05-27 — project-scoped cleanup pass (JLM Wines, end of long session)

Touched:
- `plans/STATUS.md` Inbox — struck-through resolved MCP-integrations item removed entirely (commit history preserves the record); "Drive setup review" promoted from Deferred → Active because phase 7 (7a + 7b) landed today, satisfying its `defer:after-content-library-phase-7` condition. Two remaining Deferred items (Drive folder structure, Offline-channel attribution) intact with their future dates.
- `jlmops/plans/LIBRARY_VIEW_PLAN.md` Status line — flipped from PARTIAL IMPLEMENTATION to SHIPPED. All phase 5 steps complete; step 4 + 5 shipped with CONTENT_LIBRARY_PLAN phase 7b; phase 9 entity drawer shipped end-to-end. LibraryView surface is now feature-complete for the planned workflows. Future work points to CONTENT_LIBRARY_PLAN §17 phases 10 / 11 / 12.

Surfaced but NOT touched (intentional, scope decisions):
- `.claude/session-log.md` (821 lines) — older entries are condensable per the file's own header. Bigger pruning pass deferred; needs more care than an end-of-session sweep.
- `.claude/wishlist.md` (96 lines) — not surveyed this pass.
- Memory audit — not run this pass.

Earlier today's plan-doc reconciliation (the bigger drift cleanup yesterday + today) is covered in the prior commits — phase 9 + phase 10 + phase 11 architecture banked into CONTENT_LIBRARY_PLAN.md §11 + §17 inline.

Triggered when: user requested at end of session after consolidation commit 48503e5.
