# JLM Wines — Current Status

**Updated:** 2026-07-01 — @425 live; Library detail drawer gained an "Attach new version" action (LibraryView + PublishingView) with a modal-stacking fix; blog content-workflow docs corrected (Body-first template order, session-drafts-everything-including-email policy).

## At a glance

One current-state line per business area. The umbrella has no single phase label — each area carries its own state.

- **jlmops** (GAS backend) — live @425; new product onboarding fully shipped (Track B+C complete — WebXltM seeded at accept, hot-link deleted); Library detail drawer (LibraryView + PublishingView) can now attach a new Doc version directly, no task required; Active Plans tracking added to STATUS.
- **jlmwines.com** (storefront/theme) — live, theme v1.2.30.
- **content** — 11 editorial posts live (EN+HE); 2 in pipeline (Reds/Whites guides). 2026 plan: 6 region posts + 1 canonical summary = 7 posts satisfying full email+newsletter schedule (calendar: `exchange/editorial calendar - Sheet3.csv`). Negev region post fully drafted (body + all extracts, including Email Subject/Preview/Body/CTA); pending winery verification + HE translation before publish. Content-workflow docs corrected: `_post-template.md` orders Body right after Title; session drafts every extract (Email fields included) from seed facts, manager edits/translates.
- **marketing** — flyer round 1 active; newsletter Issue #1 distributing. **June Issue #2** — AYIW email (EN+HE) scheduled 2026-06-24; print newsletter EN+HE produced + registered (`print-newsletter-2026-06-en/he`), ready to print + distribute. July entities pre-registered (`email-ayiw-2026-07-en/he`, `print-newsletter-2026-07-en/he`). 2026 calendar filled through December (slots A–F in `content/PUBLICATION_CALENDAR.md`). Plan: `content/REGION_POSTS_PLAN.md`.
- **business** — strategy/brand docs current.

## Metrics

| Metric | Value |
|--------|-------|
| Last Active | 2026-07-01 |
| Revenue | Steady |
| Deploy Version | jlmops @425 · theme v1.2.30 |
| Deploy Date | jlmops 2026-07-01 · theme 2026-06-12 |
| CRM Contacts | 548 enriched |
| Content | 11 editorial posts live (EN+HE); 2 in pipeline (Reds Guide, Whites Guide — awaiting editing + translation). |
| SEO | 87/100 (RankMath audit 2026-05-31). RankMath MCP: 6 RankMath abilities + WooCommerce/GA4/SMTP now live on adapter (2026-06-28). Editorial blog meta verified clean (per-language canonicals correct). Growth plan: `plans/SEO_GROWTH_PLAN.md`. Open items → `plans/RANKMATH_WPML_AUDIT.md` (5-item editorial focus-keyword worklist + products §A still unchecked) + `plans/SEO_AUDIT_2026-05-06.md` (gtin13, HE site name, homepage meta, EN-only discovery post). |
| Open Bugs | See `.claude/bugs.md` + `jlmops/plans/BUG_FIX_SEQUENCE.md`. Open: Session F (sync-hardening, pending staging repro), H (timestamp/date-format audit), I (count-task creation audit). |
| Mobile PageSpeed | FCP ~3.5 / LCP ~4.2 (at baseline). Remaining lever: render-blocking pile (main.css critical-CSS + jQuery defer). |
| Desktop PageSpeed | EN FCP 0.7 / LCP 0.8 · HE FCP 0.7 / LCP 1.2 |
| Blockers | 0 |

## Next Action

The live "what now" — daily review reads these first.

1. **Newsletter Issue #2 (June) — AYIW scheduled 2026-06-24; print ready to distribute.** After send: mark `email-newsletter-2026-06-en/he` published in jlmops. After print distribute: mark `print-newsletter-2026-06-en/he` published. Set `slb_TargetDate` on entities in jlmops if not set.
2. **Branded shipping cartons — postponed, expected ~2026-06-11.** Partner-owned. Track only: nudge in daily review; re-flag if it slips. No Claude action.
3. **Flyer advertising — active, moving.** Round 1 = local acquisition within ~2km of the Katamon shop; ~₪2,000 test. Quote received (2026-06-21); art in progress. Plan → `marketing/FLYER_PLAN.md`. Coupon rides the offline-attribution scheme (Inbox, `defer:2026-07-01`).
4. **Next build candidate — pick from open queue.** Reliability 1.3 or 4.1 → `jlmops/plans/RELIABILITY_AUDIT.md`; UI Tier 5 → `jlmops/plans/UI_AUDIT.md`; mobile LCP (~4.0s). (Content-workflow redesign is fully shipped and archived — `jlmops/plans/_archive/CONTENT_WORKFLOW_REDESIGN_PLAN.md`; facts live in `jlmops/docs/DATA_MODEL.md`. Content Distribution Plan is also marked complete @366 but still lists an internal "not yet shipped" step that's actually done — see Inbox.)
5. **Ongoing operational cadence** (continuous): update products; validate web product data + image accuracy (`jlmops/plans/PRODUCT_VERIFICATION_PLAN.md`); add products to fill category gaps; publish regularly (blog pipeline + monthly newsletter).

## Active Plans

Plans with code partially shipped and open implementation steps remaining. Session-end must update this list — add when a plan starts mid-implementation, strike or remove when fully done.

- ~~**New product onboarding**~~ — fully shipped @422. Plan → `jlmops/plans/NEW_PRODUCT_WORKFLOW_UX_PLAN.md` (ready to archive).
- **Bug fix sequence** (`jlmops/plans/BUG_FIX_SEQUENCE.md`) — Sessions A–G resolved. Pending: F (sync hardening — 3 items, needs staging repro), H (timestamps + date-format audit), I (count-task creation audit).
- **Bundles** (`jlmops/plans/BUNDLE_PLAN.md`) — Stages 1–7 + UI phases 1–5 shipped. Pending: composite-weight tuning (per-slot/per-bundle weight overrides).

## Current State

- **Sync workflow** — stable. 12-state machine (Comax ↔ Sheets ↔ WooCommerce); imports, exports, validation all working.
- **Import system** — full Woo REST API pull (products + translations + orders); 30-day rolling window.
- **CRM enrichment** — 548 contacts with dual-language preferences; `campaign.received` backfill manual only (daily auto-wiring deferred). Plans → `jlmops/plans/CONTACT_MANAGER_PLAN.md`, `CRM_PLAN.md`.
- **Content Library** — entity/task/activity-log model live; Doc-sourced EN/HE templates, attach-to-replace versioning (now reachable directly from the Library detail drawer, not just via a task); LibraryView is catalog-only (task lens lives in AdminTasksView + manager dashboard). Migration scaffolding to retire: `createBlankDoc` seeding, inline `slb_Body`, Create-Doc button. Phase 12 cross-link renderer blocked on regions overhaul. System doc → `jlmops/docs/DATA_MODEL.md` (Content Library Data Model); design history archived at `jlmops/plans/_archive/CONTENT_WORKFLOW_REDESIGN_PLAN.md`.
- **Campaign system** — data model + UI live (`SysMarketingCampaigns` + `SysShortUrls`, UTM/short-URL/QR); short URLs pasted manually (auto-push deferred). Plan → `jlmops/plans/CAMPAIGN_ARCHITECTURE.md`.
- **Bundles** — all stages (0–7) live; EN/HE export working; composite-weight tuning pending. Plans → `jlmops/plans/BUNDLE_PLAN.md`, `ADMIN_BUNDLES_UI_PLAN.md`.
- **Ops↔session bridge** — OPS writes system-health (15-min) + KPI (daily) into `jlmops-status.md`; `/review-daily` reads it each run. Plan → `jlmops/plans/OPS_SESSION_BRIDGE_PLAN.md`.
- **Theme** — live v1.2.30; Homepage Phase 2 (Gutenberg blocks) queued → `website/HOMEPAGE_BLOCKS_PLAN.md`.

### Pending verification (watch items)

- **Content-library versioning** (@316–@321, Decision 7 / Plan B): attach-to-replace + supersede→`_archive` confirmed live on the Negev blog task; version-retirement UI + lock-modal Cancel + admin pack spacing smoked (@319/@320). Still to smoke: the **Create-translation-text** button (HE translate task with an EN Doc → copies EN + prompt, attaches as HE current, old HE archived); a messy/mobile-pasted URL through the hardened id extraction; and `runLibraryDuplicateReconcile` from the editor (expect `0 resolved` on clean folders). Migration `runLibraryFileNameMigration` already run (14 renamed).
- **Correct Product Name tool** (@306, deployed live 2026-06-16, no /dev smoke): Admin → Products → **SKU Management tab** → Correct Product Name button → modal → search a product, edit EN and/or HE, Save; confirm WebProdM `wpm_PostTitle` + WebDetM name cells changed and a "Name Update" row appears in the **Recent SKU Updates** table in that same tab. Plan → `jlmops/plans/PRODUCT_NAME_CORRECTION_PLAN.md`.
- **New-product Products-view UX** (@307–@311, deployed live 2026-06-17, only the suggestion sort smoked): plan `jlmops/plans/NEW_PRODUCT_WORKFLOW_UX_PLAN.md`. Smoke the rest — (a) Admin Suggestions/Linkage Accept & Link buttons open on a name with a quote; (b) Manager Products loads fast with Detail Updates open + 3 collapsed cards showing count badges (gray=0, colored when pending); expand each, confirm category/search/Suggest-Selected work; (c) a new-product onboarding task shows the EN name (not blank) in the Manager preview/header; (d) Admin Review Submissions shows the WebDetS staging name; (e) Admin New Products collapsed header shows its count badge.
- **Verification reverted-task handling** (@312, deployed live 2026-06-17, unsmoked): plan `jlmops/plans/PRODUCT_VERIFICATION_PLAN.md`. Smoke — verify modal footer is Close/Revert/Done on one mobile row + opens on Specs; revert a verify task → it lands in Admin → Verification → "Reverted — needs admin" (+ header badge); **Close** completes it; **Pass to manager** transforms it to a manager Detail-Updates editable task with the findings note intact (confirm the note surfaces to the manager).
- **SKU management** (deployed 2026-02-19): Vendor SKU Update and Trim Safety not yet tested. (Product Replacement tested, working — but see `.claude/bugs.md` 2026-06-16: its product search reads dead WebProdM columns.)
- **UI T4.3 count-entry modal** — shipped, unsmoked; verify on a phone when count tasks next appear.
- **`st_DoneDate` set without `st_Status='Done'`** — at least one Manager-assigned row carries a done date while still Assigned, so it surfaces as open. Watch whether the pattern spreads; if so, fix the write path or the dashboard filter.
- **Deploy 3 manager-dashboard pack types — partial smoke (@295).** Verified for task types present in the queue; **contact / confirmation / content-publish packs not yet exercised** (no such tasks live at deploy time). Smoke each when one next appears: contact context block + Open contact; Mark Confirmed; External-URL + Mark Published. Also confirm AdminTasks now shows a **single Notes** field (Step 8 `hideNotes`).

## Known Issues

1. Consider auto-cleanup of rows below the data range during upsert.
2. Gutenberg editor width doesn't match the Elementor front-end (accepted limitation — use Preview or API-push workflow).

## Blocked / Deferred

- **Year in Wine PDF** — needs PDF-generation research.
- **Woo Brand + GTIN structured-data enrichment** — needs a jlmops-side data-shape change (new WC sync fields or CSV columns); deferred alongside cross-sell.
- **KPI Summary tab** — parked; user prefers periodic manual review of GA4 + GSC + JLMops_Data over a built dashboard. Don't re-surface as "ready to build." Spec → `jlmops/plans/KPI_SUMMARY_TAB.md`.
- **Gift recipient campaigns** — lowest priority.
- **VIP recognition + referral program** — after campaigns launch.

## Review Cadence

Periodic business-health checks — a session-review checklist, not automated.

**Weekly** (any session touching jlmops or website): new orders since last check; new customers (EN vs HE split); open bugs / failed syncs in SysLog; spot-check live site (homepage, a product page, cart).

**Monthly** (first session of the month):

- *Customers & revenue* — new vs returning ratio; EN/HE split trend; AOV drift; top-seller shifts.
- *SEO & content* — GSC indexing / crawl errors / duplicate flags; canonical tags on new/changed products; blog-post traffic; thin/duplicate product copy.
- *Marketing* — campaigns sent vs planned; list health (bounces, unsubscribes, growth); comeback-campaign progress; new referral sources.
- *Technical* — sync reliability (30-day failures); PageSpeed (mobile + desktop); Woo API pull errors/timing; open-bug count.

## Inbox

_**Before adding:** bug? → `.claude/bugs.md`. Idea/feature? → `.claude/wishlist.md`. Operational pending task? → Next Action. Item with a plan doc? → that doc. Only cross-project notes or pending-decision items belong here._

### Active

- **PROJ-CONTENT task routing** `defer:2026-07-08` — decided June 11, not built (3rd review carry). Three-step fix in `.claude/bugs.md`. Schedule in next jlmops session after new-product smoke settles.

### Deferred

- **Offline-channel attribution scheme** `defer:2026-07-14` — newsletter attribution confirmed. Flyer not yet distributed; allow ~2 weeks post-drop to smoke results before reviewing naming convention + QR/coupon setup.
