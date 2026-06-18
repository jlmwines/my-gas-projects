# JLM Wines — Current Status

**Updated:** 2026-06-17 — JLM Wines ecosystem live; jlmops @312 · theme v1.2.30; 0 blockers; Handling guide published EN+HE (11 posts) + EN/HE companion email scheduled; Products-view UX overhauled (@307–@312: new-product onboarding + verification reverted-task handling); blog push auto-sets featured image + category.

## At a glance

One current-state line per business area. The umbrella has no single phase label — each area carries its own state.

- **jlmops** (GAS backend) — live @312; Products-view UX overhauled (@307–@312: new-product Accept-button fix, sortable suggestions, Manager lazy/collapsed cards + count badges, EN-name + submissions-title from staging; verify-modal Close/Revert/Done + Admin reverted-verify queue with Close/Pass-to-manager transform); Correct Product Name tool (@306); content-workflow redesign Deploys 1–4 shipped; build queue open (reliability 1.3 / UI Tier 5).
- **jlmwines.com** (storefront/theme) — live, theme v1.2.30.
- **content** — 11 editorial posts live (EN+HE); 2 in pipeline (Reds/Whites guides).
- **marketing** — flyer round 1 active; newsletter Issue #1 distributing; Handling post-promo email (EN+HE) created, scheduled for this evening.
- **business** — strategy/brand docs current.

## Metrics

| Metric | Value |
|--------|-------|
| Last Active | 2026-06-17 |
| Revenue | Steady |
| Deploy Version | jlmops @312 · theme v1.2.30 |
| Deploy Date | jlmops 2026-06-17 · theme 2026-06-12 |
| CRM Contacts | 548 enriched |
| Content | 11 editorial posts live (EN+HE); 2 in pipeline (Reds Guide, Whites Guide — awaiting editing + translation). |
| SEO | 87/100 (RankMath audit 2026-05-31). RankMath MCP gained 4 read abilities (2026-06-12); editorial blog meta verified clean (per-language canonicals correct — no WPML inheritance gap on posts). Open items → `plans/RANKMATH_WPML_AUDIT.md` (5-item editorial focus-keyword worklist + products §A still unchecked) + `plans/SEO_AUDIT_2026-05-06.md` (gtin13, aggregateRating, HE OG image, EN-only discovery post). |
| Open Bugs | See `.claude/bugs.md` + `jlmops/plans/BUG_FIX_SEQUENCE.md`. Open: Session F (sync-hardening, pending staging repro), H (timestamp/date-format audit), I (count-task creation audit). |
| Mobile PageSpeed | FCP ~3.5 / LCP ~4.2 (at baseline). Remaining lever: render-blocking pile (main.css critical-CSS + jQuery defer). |
| Desktop PageSpeed | EN FCP 0.7 / LCP 0.8 · HE FCP 0.7 / LCP 1.2 |
| Blockers | 0 |

## Next Action

The live "what now" — daily review reads these first.

1. **Newsletter Issue #1 — distribution underway.** Printed; being inserted into outgoing shipments and store bags. Physical / user-handled; Claude only if insert copy or a counter card is wanted.
2. **Branded shipping cartons — postponed, expected ~2026-06-11.** Partner-owned. Track only: nudge in daily review; re-flag if it slips. No Claude action.
3. **Flyer advertising — active.** Round 1 = local acquisition within ~2km of the Katamon shop; ~₪2,000 test. Plan → `marketing/FLYER_PLAN.md`. Unblockers: vendor outreach (yoterplus / dilen), designer, photo assets; coupon rides the offline-attribution scheme (Inbox, `defer:2026-07-01`).
4. **Drive shipped jlmops/CRM/UI work through real daily use.** Top content build = **Deploy 3** of the content-workflow redesign (manager dashboard → shared TaskPacks convergence + Notes de-dup; spec in `jlmops/plans/CONTENT_WORKFLOW_REDESIGN_PLAN.md` Step 5 / Deploy Plan) — touches the manager's live daily surface, so its own session. Other open jlmops candidates: reliability audit queue (`jlmops/plans/RELIABILITY_AUDIT.md`, ~7/16 shipped; next = 1.3 concurrency [highest-risk] or 4.1 snapshots/DR) and UI audit queue (`jlmops/plans/UI_AUDIT.md`, Tiers 1–4 mobile shipped, Tier 5 partial). Mobile LCP tuning (~4.0s) also queued.
5. **Ongoing operational cadence** (continuous): update products; validate web product data + image accuracy (`jlmops/plans/PRODUCT_VERIFICATION_PLAN.md`); add products to fill category gaps; publish regularly (blog pipeline + monthly newsletter).

## Current State

- **Sync workflow** — stable. 12-state machine (Comax ↔ Sheets ↔ WooCommerce); imports, exports, validation all working.
- **Import system** — full Woo REST API pull (products + translations + orders); "API Pull" button runs the pipeline. Order pull = 30-day rolling window. Plan → `jlmops/plans/WOO_ORDER_IMPORT_PLAN.md`.
- **CRM enrichment** — complete; 548 contacts with dual-language preferences. `campaign.received` activity backfill works (manual via Dev → Backfill Campaign Activity button); daily auto-wiring deferred; richer per-recipient open/click data would need the Mailchimp member API. Plans → `jlmops/plans/CONTACT_MANAGER_PLAN.md`, `CRM_PLAN.md`.
- **Content Library** — entity / task / activity-log model, live. **Content-workflow redesign Deploys 1–4 shipped (@293–@295):** content-chain spawner on AdminTasks + `slb_TargetDate`; LibraryView **Deficiency** demand view; entity-drawer **Family** roll-up; admin **Request Correction** / **Abandon**; `slb_State` vocabulary (draft→locked→published + abandoned) with publish-task auto-transition; manager dashboard converged onto **TaskPacks** (bespoke editor + `task.fileUrl` retired; editable status/Save/Notes kept for skeleton types) + AdminTasks **Notes de-dup** (`ctx.hideNotes`); **Library direct-Doc access** (list-row ↗ Doc link + drawer Open-Doc button); **LibraryView is now catalog-only** — the Tasks tab/panel was removed (the task-list lens lives in AdminTasksView for admin + the dashboard queue for manager; lock/publish happen there). Library keeps catalog + Deficiency + entity drawer (spawn / Request Correction / Abandon / Open Doc). **Templates (Deploys 7–13):** now sibling-language (EN/HE) and **Doc-sourced** — content edited in Docs; every runtime consumer (pending-payment send, outreach Action Panel) reads the current Doc via `LibraryService.getEntityContent` (field/SysConfig fallback). Migration scaffolding still to retire once confirmed: `createBlankDoc` seeding, inline `slb_Body`, manager-facing Create-Doc button (→ `docs/WORKFLOWS.md` §13.6, `DATA_MODEL.md` "Content source of truth"). Plans → `jlmops/plans/CONTENT_WORKFLOW_REDESIGN_PLAN.md`, `plans/CONTENT_LIBRARY_PLAN.md`. Older: Phase 12 cross-link renderer still blocked on regions overhaul.
- **Campaign system** — data model + UI live (`SysMarketingCampaigns` + `SysShortUrls`, UTM/short-URL/QR builder, `AdminCampaignsView`). Short URLs pasted into RankMath manually (low volume); auto-push deferred. Plans → `jlmops/plans/CAMPAIGN_ARCHITECTURE.md`, `CADENCE_REALIGNMENT_PLAN.md`.
- **Bundles** — all stages (0–7) complete, live; rev-2.2 suggestion generator + inline-at-row editor with per-bundle EN/HE export shipped. EN+HE woosb output verified live. Remaining: composite-weight tuning of rough spots. Plans → `jlmops/plans/BUNDLE_PLAN.md`, `ADMIN_BUNDLES_UI_PLAN.md`.
- **Ops↔session bridge** — complete. OPS writes system-health (15-min) + KPI (daily + on-demand) into `jlmops-status.md`; `/review-daily` reads it each run. GA4 Traffic live; GSC populates on its next dated fetch. Plan → `jlmops/plans/OPS_SESSION_BRIDGE_PLAN.md`.
- **Theme** — cutover shipped 2026-05-05; live runs jlmwines-theme v1.2.30 with Mailchimp pulls + post-sync bundle-health auto-trigger. Bundle product pages carry a dismissible edit-quantity hint (`website/BUNDLE_MESSAGE_PLAN.md`). Homepage Phase 2 (Gutenberg blocks) queued → `website/HOMEPAGE_BLOCKS_PLAN.md`.

### Pending verification (watch items)

- **Correct Product Name tool** (@306, deployed live 2026-06-16, no /dev smoke): exercise once — search a product, edit EN and/or HE, Save, confirm the WebProdM `wpm_PostTitle` + WebDetM name cells changed and a "Name Update" row appears in Recent Updates. Plan → `jlmops/plans/PRODUCT_NAME_CORRECTION_PLAN.md`.
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

- _(empty)_

### Deferred

- **Offline-channel attribution scheme** `defer:2026-07-01` — when flyer drops + newsletter inserts ship, need a unique coupon code per offline campaign + UTM-tagged QR codes feeding GA4. Define naming convention + QR setup when offline campaigns are about to ship.
