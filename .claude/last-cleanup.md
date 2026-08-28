2026-08-28 — portfolio-scoped cleanup pass touching jlmwines (bug-list hygiene follow-up); full jlmwines sweep was 2026-08-25 (below), still current for everything except bugs.md.

Touched this pass:
- `.claude/bugs.md` — trimmed 8 entries that had grown into paragraph-length root-cause essays (violating this file's own one-line-per-item rule; the `/review-claude` doc-hygiene sweep flagged it as DRIFT) down to symptom + pointer, since the analysis already lives in the git commit or plan doc named on each line: the 2026-08-04 entity-drawer bug, both 2026-07-24 dashboard-card entries, the 2026-07-23 `doGet` authorization entry, the 2026-08-21 `phase1Tasks` entry, the three 2026-08-21 log-volume/JLMops_Logs resolved entries, the 2026-08-20 deploy-theme.ps1 incident, and the 2026-08-17 push-posts.js MANIFEST entry. Also removed one fully-redundant stub ("2026-05-04: Sync state-machine hardening (bundle, 3 items pending staging repro)") — superseded by `SYNC_HARDENING_PLAN.md`, which is now the actively-maintained single home for that work and already covered by more specific entries elsewhere in this file.
- `.claude/wishlist.md` — reviewed against the same DRIFT flag; every long entry checked (Newsletter UTM/QR helper, Product-centered ops view, Woo App/Jetpack replacement, unpaid-orders outreach, Comax export decouple, bundle explainer message, nav menu review, bundle+package imagery refresh) carries unique feature-spec detail with no other home (not a git commit, not a plan doc) — trimming would destroy the only record of that spec. Left as-is deliberately; this is a judgment call, not an oversight.
- `plans/STATUS.md` + `../CALENDAR.md` (portfolio root) — see `projects/.claude/last-cleanup.md` for that half of this pass.

Audited, no change needed:
- Inbox (`plans/STATUS.md`) — still empty, both sections.
- Plan-graduation spot check (done as part of the same `/review-claude` doc-hygiene sweep this session) — `CONFIG_COMPLIANCE_PLAN.md`, `CODE_AUDIT_PLAN.md`, `ADMIN_BUNDLES_UI_PLAN.md`, `ADMIN_TASK_UI_PLAN.md`, `UI_T4_3_inventory_mobile.md`, `CONTACT_MANAGER_PLAN.md` all self-declare partial/phased completion consistent with `plans/STATUS.md`'s Active Plans tracking — no plan reading as finished-but-unarchived.
- Memory (`~/.claude/projects/.../memory/MEMORY.md` + linked files) — deploy-ID memory spot-verified against `jlmops/.deployment-id` this session, matches; nothing stale.
- `.claude/session-log.md` — 212 lines, 4 entries added since the 2026-08-25 prune (160→212); not yet excessive, no pruning needed.

Not re-touched (still current from 2026-08-25): everything else from that pass — see below.

---

2026-08-25 — project-scoped cleanup pass (jlmwines, all folders), user-invoked ("cleanup") after the session found a recurring plan-graduation gap.

Touched this pass:
- `jlmops/plans/CALENDAR_TAB_UX_PLAN.md` — Phases 2-4 were shipped/documented in `jlmops/docs/WORKFLOWS.md` §13.1 since 2026-07-09 but the plan doc still read as if all four items were open. Trimmed to track Phase 1 only (the still-open refresh bug); status header now points to WORKFLOWS.md for the shipped facts. Not archived — Phase 1 remains genuinely unresolved.
- `plans/STATUS.md` — Active Plans "Calendar tab UX" line collapsed to match the trim above. Next Action items 9-10 corrected: Central Mountains' real target blog date is 2026-09-22 per the user's own working editorial calendar (the live `JLMops_Publishing` row still shows the old 2026-08-25 placeholder — deliberately left un-touched per the user's "existing rows cannot be altered" instruction, admin needs to fix it directly); Judea/Foothills now has a confirmed slot (F) and staged near-future calendar rows, previously described as "no slot assigned yet."
- `content/plans/REGION_POSTS_PLAN.md` — Slot table updated: added a Blog-date column (previously only Email/Newsletter dates, several rows had no blog date at all), corrected Slot C (Central Mountains) to the real 2026-09-22 blog date + no dedicated email (confirmed deliberate) + two newsletter dates, added blog dates to Slots D/E, and assigned Slot F to Judea (Foothills) — its dates match that slot's placeholder exactly. Removed the stale "Remaining regions, no slot assigned yet: Judea" line.
- `.claude/session-log.md` — pruned entries from 2026-07-14 through 2026-07-26 (30+ days old) into one condensed summary block, extending the 2026-08-12 pass; file went from 382 to 160 lines.
- `.claude/wishlist.md` — removed 3 stale jlmops entries already fully built: "WooCommerce API - could replace CSV sync..." (WooOrderPullService/WooProductPullService/WooApiService.fetchCoupons all live), "Mailchimp API - better than manual exports..." (`ContactImportService.importFromMailchimpApi`/`CampaignService.pullRecentCampaigns` both live in daily housekeeping), "Coupon Service - dedicated service for coupon management" (`CouponService.js` + today's API-pull addition).

Audited, no change needed:
- `plans/STATUS.md` Inbox — both Active and Deferred sections empty.
- `.claude/bugs.md` — all jlmops/web/marketing/content open items cross-checked; still accurate. Spot-checked the `push-posts.js` MANIFEST stale-path bug (content, 2026-08-17) directly against current code — still genuinely open, the 9 basics-post entries still use flat filenames instead of the `basics/<topic>/` subfolder structure.
- `jlmops/plans/CITY_CLASSIFICATION_REMOVAL_PLAN.md` — correctly tracked as blocked on two manual admin steps only (not a documentation gap).
- Memory (`~/.claude/projects/.../memory/MEMORY.md` + linked files) — all entries still current, nothing stale.

Flagged, not resolved (judgment calls, not clear-cut):
- `jlmops/plans/TESTING_GUIDE.md` (last touched 2025-12-08, "Phase 0/0A Emergency Fixes," 37 tests/4 suites) — reads like a historical snapshot doc rather than a live plan; likely superseded by `CODING_STANDARDS.md`/the current test suite, but genuinely ambiguous whether to archive, merge, or leave as historical reference. Left untouched.
- Several other 2025-12 through 2026-02 dated plan docs (`RESOURCE_OPTIMIZATION_PLAN.md`, `STRATEGIC_PLAN.md`, `PRODUCT_TEXT_UPDATE_PLAN.md`) weren't touched in 6+ months but weren't deep-read this pass either — worth a closer look in a future cleanup if time allows; not flagged as definite problems, just unverified.

Separately (same session, before this cleanup pass, already committed): `jlmops/plans/SYNC_HARDENING_PLAN.md` trimmed and `jlmops/plans/_archive/COUPON_API_PULL_PLAN.md` + `jlmops/plans/_archive/VENDOR_SKU_UPDATE_FIX_PLAN.md` archived, with facts graduated into `jlmops/docs/ARCHITECTURE.md`/`WORKFLOWS.md`. Not re-touched this pass.
