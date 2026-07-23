2026-07-23 — project-scoped cleanup pass (jlmwines only).

Touched this pass:
- `jlmops/plans/BUG_FIX_SEQUENCE.md` — header progress line was stale (still listed Session J as open); J was actually shipped/smoke-tested clean 2026-07-15 per the body of the same doc. Corrected.
- `plans/STATUS.md` — Metrics row "Open Bugs" carried the same stale J-open claim (`Open sessions: F, H, I, J`). Corrected to `F, H, I`.
- `CALENDAR.md` — `Updated:` date bumped; plan-driven-queue summary line for `BUG_FIX_SEQUENCE.md` had the same stale J-open claim, corrected to match.
- `.claude/wishlist.md` — removed one undated jlmops item ("Remove hardcoded workaround in WebAppProducts.js:438") — grepped the current file for any workaround/hardcode comment near that reference; none found, and the line itself is now a different function's docstring after months of edits. Treated as resolved-and-drifted, not re-verifiable at the original granularity.
- `.claude/session-log.md` — pruned entries from 2026-06-14 through 2026-06-22 (now 31+ days old), extending the prior pass's boundary from "before 2026-06-14" to "before 2026-06-23", per the file's own header and the 30-day default. Durable facts from that range (PublishingView build, Content Library versioning Decision 7, content-workflow redesign, product verification reverted-task handling, new-product UX overhaul, Correct Product Name tool, Handling guide) already graduated to system docs — noted in the new pruned-block summary.

Audited, no change needed:
- `.claude/bugs.md` open jlmops/web/marketing/content sections — cross-checked each item with a plan-doc pointer against that plan's current state (`SYNC_HARDENING_PLAN.md`, `RELIABILITY_AUDIT.md` §1.3, `CONFIG_COMPLIANCE_PLAN.md`) — all still genuinely open, no resolved-but-untracked items found beyond the wishlist item above.
- `plans/STATUS.md` Inbox — 1 deferred item (offline-attribution, `defer:2026-08-10`), not yet due.
- Memory (`~/.claude/projects/.../memory/`) — spot-checked against this session's actual tool use (deploy.ps1 wrapper, pinned deployment ID, clasp auth, AYIW English-only convention) — all confirmed accurate by direct use this session, no drift.

---

Same day, second pass — full `jlmops/plans/` (44 files) + `jlmops/docs/` (4 files) completion-status audit, the item flagged out-of-scope above. Verified each finding against the code or git history before editing (grep for the fix, `git log -p` for doc history), not just against other doc claims.

Fixed this pass:
- `jlmops/plans/CAMPAIGN_ARCHITECTURE.md` — status line said "Ready for build review" (2026-05-11); campaign system has actually been live for weeks (data model + UI + Distribution templates, per `STATUS.md` Current State). Corrected.
- `jlmops/plans/CONTACT_MANAGER_PLAN.md` — both status blocks stale: Half 1's line still said "Half 2 (action layer) not started," and Half 2's own block never recorded that it shipped. Portfolio `CALENDAR.md` confirms "Manager CRM Half 2 SHIPPED 2026-05-14 @105-@116." Corrected both. Not archived yet — `task.contact.outreach` / `ManagerContactView` haven't graduated to `docs/WORKFLOWS.md` (checked: absent; only `SysContactActivity`'s schema graduated to `DATA_MODEL.md`). Left a pointer in the doc; graduating those facts is a follow-up, not done this pass.
- `jlmops/plans/MANAGER_UI_PLAN.md` — two 2026-03-03 status lines ("Approved. Pending implementation." / "Done. In test (not deployed).") were stale; grepped the live code and confirmed both features are shipped (`task-col-created` in `ManagerDashboardView_v2.html`; `createdDateDisp` in `AdminProjectsView.html`/`AdminTasksView.html`). Corrected both lines.
- `jlmops/plans/UI_T5_2_admin_products_modals.md` — said "Ready to ship (queued next)" but grepped `AdminProductsView.html` and found zero `btn-primary` occurrences — the fix had already landed, just never marked shipped. Updated status, moved to `_archive/`, updated `_archive/README.md` (both the Contents list and the "still active" list).
- `jlmops/plans/UI_T2_1_admin_bundles.md` — never shipped; confirmed superseded 2026-06-07 by `ADMIN_BUNDLES_UI_PLAN.md`'s deeper three-lens redesign of the same view (`AdminBundlesView`). Updated status line to point to the superseding doc; left in `plans/` per the archive convention (archive = shipped only, this wasn't). Updated `_archive/README.md`'s "still active" note to match.

Audited, no change needed (verified, not just cross-referenced):
- `jlmops/docs/WORKFLOWS.md` starts at §11 with no title and no §1–10 — looks broken but isn't new: `git log -p` shows §1–10 were already gone before the 2026-06-11 `git mv` from `plans/` to `docs/` (that commit was a pure rename, 0 diff), and the same commit's message already flagged it "needs a freshness pass (flagged drifted in TECH_DEBT_AUDIT)." `docs/README.md` still carries that same pointer. Already tracked, not re-flagged as new — but still unresolved 6+ weeks later and worth a session if `docs/README.md`'s freshness-pass note keeps getting skipped.
- `jlmops/plans/NOTIFICATION_UX_PLAN.md` — "Implementing Phases 0-2... Phases 3-4 backlog" (2026-06-03). Grepped current `alert()`/`confirm()` counts: 51 remain, concentrated in the admin-heavy views (AdminBundlesView 12, AdminProductsView 11, AdminInventoryView 4) the plan named as backlog; manager views are down to single digits. Status still accurate, no edit needed.
- `jlmops/plans/PERFORMANCE_OPTIMIZATION_PLAN.md` — two plans concatenated in one file. Part 2 ("Bundles Health Check — N+1 Sheet Reads") is genuinely done and already cross-referenced from `_archive/BUNDLE_PLAN.md`. Part 1 ("Dashboard Performance — One Endpoint Per Dashboard") has no shipped/deployed marker anywhere in the file or elsewhere — left as-is, not claiming it shipped or claiming it's stale without evidence either way.

Flagged, not fixed — needs an owner call, not a doc edit:
- `jlmops/docs/TESTING_GUIDE.md` — `Updated: 2025-12-15`, over 7 months old against a codebase that's shipped a large fraction of its current feature set since. Worth a freshness pass.
- `jlmops/plans/INVENTORY_TASK_CONSOLIDATION_PLAN.md` — status "Planning," never started, not referenced from `STATUS.md` or any other plan. Still wanted, or drop?
- `jlmops/plans/PRODUCT_DETAIL_VALIDATION_PLAN.md` — "Plan written. Implementation pending user OK," not referenced elsewhere. Possibly superseded by the since-shipped `CONFIG_COMPLIANCE_PLAN.md` / product-verification work — not verified either way.
- `jlmops/plans/PERFORMANCE_OPTIMIZATION_PLAN.md` Part 1 (see above) — still wanted, or drop/archive-as-abandoned?

Out of scope this pass: `jlmops/plans/DEVELOPER_VIEW_AUDIT.md` items 4-5 (minor, honestly labeled still-open, no discrepancy found) and the ~15 remaining plans not mentioned above (design/reference docs like `CODING_STANDARDS.md`, `JLMOPS_DESIGN_SYSTEM.md`, `STRATEGIC_PLAN.md`, `CAMPAIGN_SYSTEM_PLAN.md`, `README.md` — read and confirmed current-state/reference framing, no stale claims found) — read but no discrepancy found worth a full line-item.
