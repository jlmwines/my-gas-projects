# Bugs

Known bugs across all projects. Use `/bug [project] description` to add.
Projects: jlmops, web, marketing, content

One line per item: date + symptom + pointer to the plan doc or git commit holding the analysis.
Analysis never lives here or in `.claude/session-log.md` (portfolio kernel, "Claude session documents").

Resolved entries are kept ~60 days, then pruned (git history holds them).

---

## jlmops

### Open

- [ ] 2026-11-02: Heter Mechira = 1 shows no red text in descriptions; check accepted only `true`; short desc never added it. Fixed @604; 61 live products corrected via API 2026-11-02.
- [ ] 2026-10-27: INTERNAL_AUDIT + DATA_COMPLETENESS skipped the first data row; row numbers off by one. Fixed @597, verify on next housekeeping run.
- [ ] 2026-10-23: Stale failure alerts stay on Admin dash. Fixed @599; verify live, clean up old ones. `jlmops/plans/FAILURE_ALERT_AUTO_RESOLVE_PLAN.md`.
- [ ] 2026-08-04: `task.system.failure` tasks misuse `st_LinkedEntityId` as a dedup key, breaking entity-drawer lookups (`NotificationService.js#_createFailureTask`).
- [ ] 2026-07-24: Admin Dashboard Tasks card (`_getAdminTasksList`) dumps 200+ open tasks with no grouping/counts — needs summarization.
- [ ] 2026-07-24: Manager Dashboard Projects card includes COMPLETED/ARCHIVED projects — low priority, revisit only if it causes real confusion.
- [ ] 2026-07-23: `doGet`'s role check is a login gate, not an authorization boundary. `CODE_AUDIT_FIX_SEQUENCE.md` Session R.
- [ ] 2026-07-20: Admin Products "Correct Product Name" applies with no confirmation step. Fixed @601 (confirm before save); verify live.
- [ ] 2026-07-09: Publishing calendar view (now List/Month) may not refresh after "Apply Pending Updates"/"Create Content Tasks". `jlmops/plans/PUBLISHING_BOARD_PLAN.md` Build notes, Refresh.
- [ ] 2026-07-02: `ConfigService.loadConfig` reads only the first key-value pair of non-schema settings (P03-P10 dropped). `jlmops/plans/CONFIG_MULTI_PAIR_PARSE_PLAN.md`.
- [ ] 2026-05-04: Audit timestamps + date formats system-wide (storage vs. display standardization). Future step, no plan doc yet.
- [ ] 2026-05-04: Audit on-demand count-task creation (dedupe + split data/count validation paths). Future step, no plan doc yet.
- [ ] 2026-08-30: `wdm_IsSoldIndividually` (WebDetM) dead: no UI, no push; site value is pull-only. `jlmops/docs/ARCHITECTURE.md` (WooCommerceFormatter).

### Resolved (recent)

_One line each; full root-cause analysis lives in the git commit._

- [x] 2026-10-13: Welcome-outreach fired for first-time gift purchasers. Fixed @597, confirmed by user 2026-11-04.
- [x] 2026-07-16: Schema Validation indicator didn't refresh on Admin Dev re-run. Fixed @603, confirmed by user 2026-11-04.
- [x] 2026-07-16: System Health Status task date frozen at creation. Fixed @603, re-dated each run (SysTasks export 2026-11-04).
- [x] 2026-07-16: Woo Orders heartbeat red overnight/weekends. Fixed @602, green 2026-11-04 morning (user).
- [x] 2026-08-21: Daily maintenance phase 1 counted normal skips as failures. Fixed @598, Health task 2026-11-04 shows no phase failures.

- [x] 2026-10-18: Woo 2xx HTML instead of JSON: 1 hit in 7 days (SiteGround bot page), retry handled it. Closed; @580 logging stays. Ticket SG if frequent.
- [x] 2026-06-16: Product Replacement read dead `wpm_WebIdEn/He` (blank web IDs, dead web-ID match). Fixed @600, lookup confirmed live 2026-10-27.
- [x] 2026-10-27: WebDetM duplicate web ID / SKU mismatch went unflagged — KEY_UNIQUENESS + SKU-match rules @595, write-path guard @596, verified clean.
- [x] 2026-10-22: `SysCampaigns` duplicated all-digit campaign id daily (61 rows) — fixed @591, extra rows deleted by user.
- [x] 2026-10-12: Admin attach of a manager-owned Doc failed at `setOwner` — now attaches a copy. Verified live, jlmops @576. `jlmops/docs/DATA_MODEL.md`.
- [x] 2026-09-03: Welcome task fired for repeat customers with an archived first order — fixed @575, verified live 2026-10-10. `CONTACT_MANAGER_PLAN.md`.

## web

### Open

- [ ] 2026-06-16: Non-wine descriptions blanked by pushes (WebDetM empty). Recoverable text backfilled; bundles/Ilana's need new copy. `jlmops/plans/WEBDETM_DESCRIPTION_BACKFILL_PLAN.md`.
- [ ] 2026-05-11: Auto-push short URL redirects to RankMath (deferred) — manual paste acceptable at current volume (5-10/month).

### Resolved

- [x] 2026-09-03: 50NEW first-purchase check hooked to a nonexistent WC filter, never ran at all. Fixed, live, confirmed working on real orders (per user 2026-10-22). `inc/coupons.php`.

## marketing

### Open

(none)

## content

### Open

(none)

### Resolved

- [x] 2026-10-14: `push-posts.js` re-push dropped Wine Basics (single category ID). Now takes a list; region posts carry both (2026-10-27). `PUBLISHING.md`.
- [x] 2026-08-17: `push-posts.js` MANIFEST paths stale for 10 basics posts. Fixed to `basics/<topic>/`; all 13 entries resolve (2026-10-27).
- [x] 2026-08-17: `negev` MANIFEST entry pointed at the wrong path — fixed alongside adding the `galilee` entry.
