# Bugs

Known bugs across all projects. Use `/bug [project] description` to add.
Projects: jlmops, web, marketing, content

One line per item: date + symptom + pointer to the plan doc or git commit holding the analysis.
Analysis never lives here or in `.claude/session-log.md` (portfolio kernel, "Claude session documents").

Resolved entries are kept ~60 days, then pruned (git history holds them).

---

## jlmops

### Open

- [ ] 2026-10-27: INTERNAL_AUDIT + DATA_COMPLETENESS skipped the first data row; row numbers off by one. Fixed @597, verify on next housekeeping run.
- [ ] 2026-10-23: Stale system-failure alerts stay on Admin dash; only 2 contexts call `NotificationService.resolveFailure` (sweep @594, contacts verify).
- [ ] 2026-10-18: Woo API calls intermittently get 2xx HTML instead of JSON (suspect SiteGround anti-bot). @580 logs it; see commit.
- [ ] 2026-10-13: Welcome-outreach tasks fired for first-time gift purchasers. Fixed @597 (first order a gift = no welcome); verify on next real gift order.
- [ ] 2026-08-04: `task.system.failure` tasks misuse `st_LinkedEntityId` as a dedup key, breaking entity-drawer lookups (`NotificationService.js#_createFailureTask`).
- [ ] 2026-07-24: Admin Dashboard Tasks card (`_getAdminTasksList`) dumps 200+ open tasks with no grouping/counts — needs summarization.
- [ ] 2026-07-24: Manager Dashboard Projects card includes COMPLETED/ARCHIVED projects — low priority, revisit only if it causes real confusion.
- [ ] 2026-07-23: `doGet`'s role check is a login gate, not an authorization boundary. `CODE_AUDIT_FIX_SEQUENCE.md` Session R.
- [ ] 2026-07-20: Admin Products "Correct Product Name" applies with no confirmation step. `jlmops/plans/PRODUCT_NAME_CORRECTION_PLAN.md`.
- [ ] 2026-07-16: Dashboard "Schema Validation" indicator doesn't refresh when re-run from Admin Dev — only housekeeping updates its cached status.
- [ ] 2026-07-16: "System Health Status" task's displayed date is frozen at original creation, not last-run.
- [ ] 2026-07-16: Woo Orders heartbeat shows red every morning before ~08:00 IL — staleness threshold isn't business-hours-aware.
- [ ] 2026-07-09: Calendar tab doesn't refresh after "Apply Pending Updates"/"Create Content Tasks". `jlmops/plans/CALENDAR_TAB_UX_PLAN.md` Phase 1.
- [ ] 2026-07-02: `ConfigService.loadConfig` reads only the first key-value pair of non-schema settings (P03-P10 dropped). `jlmops/plans/CONFIG_MULTI_PAIR_PARSE_PLAN.md`.
- [ ] 2026-06-16: Product Replacement reads dead WebProdM columns (`wpm_WebIdEn`/`wpm_WebIdHe`) — not yet traced whether it breaks the reassign step.
- [ ] 2026-05-04: Audit timestamps + date formats system-wide (storage vs. display standardization). Future step, no plan doc yet.
- [ ] 2026-05-04: Audit on-demand count-task creation (dedupe + split data/count validation paths). Future step, no plan doc yet.
- [ ] 2026-08-21: Daily maintenance phase 1 missed steps that catch and return false. Fixed @598 (normal skips return 'skipped'); verify Health task after next run.
- [ ] 2026-10-19 (low): Bundle descriptions never land in `WebProdM.wpm_PostContent`; bundle detail view (`WebAppBundles.js:102`) shows none. WordPress is the only copy.
- [ ] 2026-08-30: `wdm_IsSoldIndividually` (WebDetM) dead: no UI, no push; site value is pull-only. `jlmops/docs/ARCHITECTURE.md` (WooCommerceFormatter).

### Resolved (recent)

_One line each; full root-cause analysis lives in the git commit._

- [x] 2026-10-27: WebDetM duplicate web ID / SKU mismatch went unflagged — KEY_UNIQUENESS + SKU-match rules @595, write-path guard @596, verified clean.
- [x] 2026-10-22: `SysCampaigns` duplicated all-digit campaign id daily (61 rows) — fixed @591, extra rows deleted by user.
- [x] 2026-10-12: Admin attach of a manager-owned Doc failed at `setOwner` — now attaches a copy. Verified live, jlmops @576. `jlmops/docs/DATA_MODEL.md`.
- [x] 2026-09-03: Welcome task fired for repeat customers with an archived first order — fixed @575, verified live 2026-10-10. `CONTACT_MANAGER_PLAN.md`.
- [x] 2026-09-02: Bundle deficiency count on view-load was stale — automation removed, review now manual-only. jlmops @574.
- [x] 2026-09-01: "Newsletter" content stage produced a task invisible to `PublishingView` — stage removed. jlmops @573.
- [x] 2026-09-01: Sync widget Generate button reappeared mid-export, could double-submit — fixed, verified live. `SYNC_HARDENING_PLAN.md` Bug 2. @572.
- [x] 2026-09-01: Sync widget skip-log showed literal "skipped" instead of the real reason — fixed. jlmops @571.
- [x] 2026-08-21: Welcome-outreach recency + dedup gap — fixed, deployed @568. `jlmops/plans/CONTACT_MANAGER_PLAN.md`.
- [x] 2026-08-21: `JLMops_Logs` hit Sheets' 10M-cell limit, blocking all writes — `cleanOldLogs` now deletes rows >7 days. jlmops @547.
- [x] 2026-08-21: Two log-volume sources fixed (`BundleService._parseWoosbJson`, `exportWebInventory` warn). jlmops @547.
- [x] 2026-08-21: Real error messages from failed jobs overwritten by a generic relay error across 3 layers — fixed. jlmops @547-@548.
- [x] 2026-08-17: Vendor SKU Update rejected the real target SKU as a conflict once Comax had synced to the new SKU — fixed, smoke-tested, @546.
- [x] 2026-06-14: Web inventory export sync-state race — closed by `SYNC_HARDENING_PLAN.md` Bug 5 Stages A-E (script lock), live by @570.

## web

### Open

- [ ] 2026-06-16: Non-wine descriptions blanked by pushes (WebDetM empty). Recoverable text backfilled; bundles/Ilana's need new copy. `jlmops/plans/WEBDETM_DESCRIPTION_BACKFILL_PLAN.md`.
- [ ] 2026-05-11: Auto-push short URL redirects to RankMath (deferred) — manual paste acceptable at current volume (5-10/month).

### Resolved

- [x] 2026-09-03: 50NEW first-purchase check hooked to a nonexistent WC filter, never ran at all. Fixed, live, confirmed working on real orders (per user 2026-10-22). `inc/coupons.php`.
- [x] 2026-08-28: 50NEW reusable by repeat guest-checkout customers — turned out incomplete, see 2026-09-03 entry above. `inc/coupons.php`.
- [x] 2026-08-20: `deploy-theme.ps1` truncated live files to 0 bytes mid-deploy — restored from backup, hardened (byte-verify + atomic rename, curl).

## marketing

### Open

(none)

## content

### Open

- [ ] 2026-10-14: `push-posts.js` re-push of Negev/Galilee drops their Wine Basics category (single ID per language). `website/BLOG_CATEGORIES_PLAN.md`.
- [ ] 2026-08-17: `push-posts.js` MANIFEST paths stale for 9 basics posts (old flat path, not `content/basics/<topic>/`). Fixed for negev/galilee only.

### Resolved

- [x] 2026-08-17: `negev` MANIFEST entry pointed at the wrong path — fixed alongside adding the `galilee` entry.
