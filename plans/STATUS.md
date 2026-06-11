# JLM Wines — Current Status

**Updated:** 2026-06-10 — jlmops @288 · theme v1.2.29 live; 0 blockers; next jlmops action open (reliability/UI audit queues).

## Metrics

| Metric | Value |
|--------|-------|
| Phase | Live, post-cutover. Theme cutover, Manager CRM, Lookup admin UI, Content Library, and the Admin task workbench (`AdminTasksView`) all shipped & live. Phase 12 cross-link renderer blocked on the §16 regions overhaul. |
| Last Active | 2026-06-10 |
| Revenue | Steady |
| Deploy Version | jlmops @288 · theme v1.2.29 |
| Deploy Date | jlmops 2026-06-10 · theme 2026-06-04 |
| CRM Contacts | 548 enriched |
| Content | 10 editorial posts live (EN+HE); 3 in pipeline (Handling and Storage, Reds Guide, Whites Guide — awaiting editing + translation). |
| SEO | 87/100 (RankMath audit 2026-05-31). Open items → `plans/RANKMATH_WPML_AUDIT.md` (WPML per-language meta gap) + `plans/SEO_AUDIT_2026-05-06.md` (gtin13, aggregateRating, HE OG image, EN-only discovery post). |
| Open Bugs | See `.claude/bugs.md` + `jlmops/plans/BUG_FIX_SEQUENCE.md`. Open: Session F (sync-hardening, pending staging repro), H (timestamp/date-format audit), I (count-task creation audit). |
| Mobile PageSpeed | FCP ~3.5 / LCP ~4.2 (at baseline). Remaining lever: render-blocking pile (main.css critical-CSS + jQuery defer). |
| Desktop PageSpeed | EN FCP 0.7 / LCP 0.8 · HE FCP 0.7 / LCP 1.2 |
| Blockers | 0 |

## Next Action

The live "what now" — daily review reads these first.

1. **Newsletter Issue #1 — distribution underway.** Printed; being inserted into outgoing shipments and store bags. Physical / user-handled; Claude only if insert copy or a counter card is wanted.
2. **Branded shipping cartons — postponed, expected ~2026-06-11.** Partner-owned. Track only: nudge in daily review; re-flag if it slips. No Claude action.
3. **Flyer advertising — active.** Round 1 = local acquisition within ~2km of the Katamon shop; ~₪2,000 test. Plan → `marketing/FLYER_PLAN.md`. Unblockers: vendor outreach (yoterplus / dilen), designer, photo assets; coupon rides the offline-attribution scheme (Inbox, `defer:2026-07-01`).
4. **Drive shipped jlmops/CRM/UI work through real daily use.** Next jlmops build action is **open** — candidates: reliability audit queue (`jlmops/plans/RELIABILITY_AUDIT.md`, ~7/16 shipped; next = 1.3 concurrency [highest-risk] or 4.1 snapshots/DR) and UI audit queue (`jlmops/plans/UI_AUDIT.md`, Tiers 1–4 mobile shipped, Tier 5 partial). Mobile LCP tuning (~4.0s) also queued.
5. **Ongoing operational cadence** (continuous): update products; validate web product data + image accuracy (`jlmops/plans/PRODUCT_VERIFICATION_PLAN.md`); add products to fill category gaps; publish regularly (blog pipeline + monthly newsletter).

## Current State

- **Sync workflow** — stable. 12-state machine (Comax ↔ Sheets ↔ WooCommerce); imports, exports, validation all working.
- **Import system** — full Woo REST API pull (products + translations + orders); "API Pull" button runs the pipeline. Order pull = 30-day rolling window. Plan → `jlmops/plans/WOO_ORDER_IMPORT_PLAN.md`.
- **CRM enrichment** — complete; 548 contacts with dual-language preferences. `campaign.received` activity backfill works (manual via Dev → Backfill Campaign Activity button); daily auto-wiring deferred; richer per-recipient open/click data would need the Mailchimp member API. Plans → `jlmops/plans/CONTACT_MANAGER_PLAN.md`, `CRM_PLAN.md`.
- **Content Library** — complete and permanent (entity / task / activity-log model; templates migrated from SysConfig; Campaigns absorbed). Remaining: Phase 12 cross-link renderer, blocked on the §16 regions overhaul. Plans → `plans/CONTENT_LIBRARY_PLAN.md`, `jlmops/plans/LIBRARY_VIEW_PLAN.md`.
- **Campaign system** — data model + UI live (`SysMarketingCampaigns` + `SysShortUrls`, UTM/short-URL/QR builder, `AdminCampaignsView`). Short URLs pasted into RankMath manually (low volume); auto-push deferred. Plans → `jlmops/plans/CAMPAIGN_ARCHITECTURE.md`, `CADENCE_REALIGNMENT_PLAN.md`.
- **Bundles** — all stages (0–7) complete, live; rev-2.2 suggestion generator + inline-at-row editor with per-bundle EN/HE export shipped. EN+HE woosb output verified live. Remaining: composite-weight tuning of rough spots. Plans → `jlmops/plans/BUNDLE_PLAN.md`, `ADMIN_BUNDLES_UI_PLAN.md`.
- **Ops↔session bridge** — complete. OPS writes system-health (15-min) + KPI (daily + on-demand) into `jlmops-status.md`; `/review-daily` reads it each run. GA4 Traffic live; GSC populates on its next dated fetch. Plan → `jlmops/plans/OPS_SESSION_BRIDGE_PLAN.md`.
- **Theme** — cutover shipped 2026-05-05; live runs jlmwines-theme v1.2.29 with Mailchimp pulls + post-sync bundle-health auto-trigger. Homepage Phase 2 (Gutenberg blocks) queued → `website/HOMEPAGE_BLOCKS_PLAN.md`.

### Pending verification (watch items)

- **SKU management** (deployed 2026-02-19): Vendor SKU Update and Trim Safety not yet tested. (Product Replacement tested, working.)
- **UI T4.3 count-entry modal** — shipped, unsmoked; verify on a phone when count tasks next appear.
- **`st_DoneDate` set without `st_Status='Done'`** — at least one Manager-assigned row carries a done date while still Assigned, so it surfaces as open. Watch whether the pattern spreads; if so, fix the write path or the dashboard filter.

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

- _(empty)_

### Deferred

- **Offline-channel attribution scheme** `defer:2026-07-01` — when flyer drops + newsletter inserts ship, need a unique coupon code per offline campaign + UTM-tagged QR codes feeding GA4. Define naming convention + QR setup when offline campaigns are about to ship.
