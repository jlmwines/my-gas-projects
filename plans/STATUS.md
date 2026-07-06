# JLM Wines — Current Status

**Updated:** 2026-07-06 — @442 live; Admin Bundles message-strip close bug fixed; Library Doc-ownership gap found and partially fixed (`createTranslationDraft` transfers HE-copy ownership to admin going forward; generic `attachExistingDoc` path still open). Negev region post text now finalized in both languages with Drive permissions arranged to both documents — next up is the publish pipeline (images, draft push, WPML link), not more drafting. Wine Talk category groundwork shipped live (Wine Basics renamed, Regions category created) ahead of any region post publishing; the tab-row UI itself is deliberately deferred to when the first region post is ready to go (`website/BLOG_CATEGORIES_PLAN.md`). Galilee drafted + registered, held for Negev; Grapes anchor drafted, facts verified.

## At a glance

One current-state line per business area. The umbrella has no single phase label — each area carries its own state.

- **jlmops** (GAS backend) — live @442; full product/order sync, CRM, content library, and KPI reporting stack running.
- **jlmwines.com** (storefront/theme) — live, theme v1.2.30; Wine Talk category taxonomy expanded (Wine Basics + Regions live in WP), tab UI pending first region post.
- **content** — 11 editorial posts live (EN+HE); region-post series and a Grapes guide anchor in active drafting (`content/REGION_POSTS_PLAN.md`, `content/guide/ISRAELI_WINE_GUIDE_PLAN.md`).
- **marketing** — flyer round 1 active (Katamon local acquisition); newsletter Issue #2 (June) in final distribution; 2026 calendar filled through December (`content/PUBLICATION_CALENDAR.md`).
- **business** — strategy/brand docs current.

## Metrics

| Metric | Value |
|--------|-------|
| Last Active | 2026-07-01 |
| Revenue | Steady |
| Deploy Version | jlmops @442 · theme v1.2.30 |
| Deploy Date | jlmops 2026-07-06 · theme 2026-06-12 |
| CRM Contacts | 548 enriched |
| Content | 11 editorial posts live (EN+HE); 2 in pipeline (Reds Guide, Whites Guide — awaiting editing + translation). |
| SEO | 87/100 (RankMath audit 2026-05-31, pre-dates the 2026-07-01 mixed-content fix below). RankMath MCP: 6 RankMath abilities + WooCommerce/GA4/SMTP now live on adapter (2026-06-28). Editorial blog meta verified clean (per-language canonicals correct). GSC KPI feed live (2026-07-01): 2,140 clicks / 117,221 impr / avg pos 9.5 over trailing 90d as of first snapshot; top pages + week-over-week trend in `jlmops-status.md`. HTTPS enforcement verified correct (clean single-hop 301); mixed-content HTTP images fixed on both homepages (9 images, EN+HE — was undersold as 1 image in the original ticket, see `.claude/bugs.md`). Growth plan: `plans/SEO_GROWTH_PLAN.md`. Open items → `plans/RANKMATH_WPML_AUDIT.md` (5-item editorial focus-keyword worklist + products §A still unchecked) + `plans/SEO_AUDIT_2026-05-06.md` (gtin13, HE site name, homepage meta, EN-only discovery post). |
| Open Bugs | See `.claude/bugs.md` + `jlmops/plans/BUG_FIX_SEQUENCE.md`. Open: Session F (sync-hardening, pending staging repro), H (timestamp/date-format audit), I (count-task creation audit). |
| Mobile PageSpeed | FCP ~3.5 / LCP ~4.2 (at baseline). Remaining lever: render-blocking pile (main.css critical-CSS + jQuery defer). |
| Desktop PageSpeed | EN FCP 0.7 / LCP 0.8 · HE FCP 0.7 / LCP 1.2 |
| Blockers | 0 |

## Next Action

The live "what now" — daily review reads these first.

1. **Newsletter Issue #2 (June) — AYIW email confirmed sent 2026-06-24 (user-confirmed); print ready to distribute.** Mark `email-newsletter-2026-06-en/he` published in jlmops. After print distribute: mark `print-newsletter-2026-06-en/he` published. Set `slb_TargetDate` on entities in jlmops if not set.
2. **Branded shipping cartons — vendor has artwork + colors in hand.** Partner-owned. Track only: nudge in daily review; re-flag if production/delivery slips. No Claude action.
3. **Flyer advertising — active, moving.** Round 1 = local acquisition within ~2km of the Katamon shop; ~₪2,000 test. Vendor has print artwork + target areas in hand. Plan → `marketing/FLYER_PLAN.md`. Coupon rides the offline-attribution scheme (Inbox, `defer:2026-07-01`).
4. **Next build — Reliability 1.3 or 4.1** → `jlmops/plans/RELIABILITY_AUDIT.md`; UI Tier 5 → `jlmops/plans/UI_AUDIT.md`; mobile LCP (~4.0s). (KPI Summary Tab + trend surfacing both shipped @440 — see Current State. Content-workflow redesign and content-distribution plans are both fully shipped and archived — `jlmops/plans/_archive/`; facts live in `jlmops/docs/DATA_MODEL.md`.)
5. **Ongoing operational cadence** (continuous): update products; validate web product data + image accuracy (`jlmops/plans/PRODUCT_VERIFICATION_PLAN.md`); add products to fill category gaps; publish regularly (blog pipeline + monthly newsletter).
6. **Negev region post — text done in both languages, Drive permissions arranged; remaining work is the publish pipeline, not drafting.** EN body/Excerpt/Email fields/Newsletter Excerpt/Print Newsletter Body/CTA/Image Prompts all locked in `content/regions/negev-en.post.md`; HE translation confirmed done in the manager's Drive doc, admin now has Editor access to both EN and HE docs. Still needs winery verification before publish (confirm which Wineries to Visit entries JLM carries, add shop links). Remaining checklist per `content/REGION_POSTS_PLAN.md`: (a) generate the 4 Canva images from the already-drafted prompts (featured + 3 body images, see file's `## IMAGE PROMPTS`) — human step, not automatable; (b) create `content/regions/negev-he.post.md` from the Drive HE doc, mirroring the EN file's full section structure (per `content/CLAUDE.md` work order step 11 — a translation duplicates the whole chain, it isn't just the body); (c) run the per-post image-upload script to get media IDs into both files' `## FEATURED MEDIA`/body placeholders; (d) register in the content library (`node content/register-library.js blog-negev` or equivalent slug) if not already; (e) `node content/push-posts.js <name> --both` to land both as WordPress drafts; (f) wp-admin checklist — focus keyword, SEO meta (EN draft already in `## NOTES`, HE needs one), WPML link the two drafts as translations, winery verification, then publish. Category assignment (`enCategoryId`/`heCategoryId` for the new Regions category, ids 1272/1273) gets added to the manifest entry as part of step (e) — see `website/BLOG_CATEGORIES_PLAN.md`.
7. **Galilee region post (Slot A, due 2026-07-07)** — drafted + registered in the library (`blog-region-galilee-en`, state `draft`), ready for the manager. Deliberately not yet flagged/pushed to the manager — hold until Negev clears the pipeline above.
8. **Grapes anchor post** ("Grape Varieties in Israel") — drafted through Image Prompts + Notes at `content/grapes/grapes-en.post.md`, all facts verified this session. Not yet registered in the library or flagged to anyone. Individual grape spoke posts deferred per `content/guide/ISRAELI_WINE_GUIDE_PLAN.md`'s sequencing decision.

## Active Plans

Plans with code partially shipped and open implementation steps remaining. Session-end must update this list — add when a plan starts mid-implementation, strike or remove when fully done.

- **Bug fix sequence** (`jlmops/plans/BUG_FIX_SEQUENCE.md`) — Sessions A–G resolved. Pending: F (sync hardening — 3 items, needs staging repro), H (timestamps + date-format audit), I (count-task creation audit).
- **Bundles** (`jlmops/plans/BUNDLE_PLAN.md`) — Stages 1–7 + UI phases 1–5 shipped. Pending: composite-weight tuning (per-slot/per-bundle weight overrides).
- **Wine Talk blog categories** (`website/BLOG_CATEGORIES_PLAN.md`) — Wine Basics renamed + Regions category created live in WP (steps 1-2 done). Tab-row UI + `All` view intentionally not started — deferred to when the first region post is ready to publish, not built against a still-empty category.

## Current State

- **Sync workflow** — stable. 12-state machine (Comax ↔ Sheets ↔ WooCommerce); imports, exports, validation all working.
- **Import system** — full Woo REST API pull (products + translations + orders); 30-day rolling window.
- **CRM enrichment** — 548 contacts with dual-language preferences; `campaign.received` backfill manual only (daily auto-wiring deferred). Plans → `jlmops/plans/CONTACT_MANAGER_PLAN.md`, `CRM_PLAN.md`.
- **Content Library** — entity/task/activity-log model live; Doc-sourced EN/HE templates, attach-to-replace versioning (now reachable directly from the Library detail drawer, not just via a task); LibraryView is catalog-only (task lens lives in AdminTasksView + manager dashboard). Migration scaffolding to retire: `createBlankDoc` seeding, inline `slb_Body`, Create-Doc button. Phase 12 cross-link renderer blocked on regions overhaul. System doc → `jlmops/docs/DATA_MODEL.md` (Content Library Data Model); design history archived at `jlmops/plans/_archive/CONTENT_WORKFLOW_REDESIGN_PLAN.md`.
- **Campaign system** — data model + UI live (`SysMarketingCampaigns` + `SysShortUrls`, UTM/short-URL/QR); short URLs pasted manually (auto-push deferred). Plan → `jlmops/plans/CAMPAIGN_ARCHITECTURE.md`.
- **Bundles** — all stages (0–7) live; EN/HE export working; composite-weight tuning pending. Plans → `jlmops/plans/BUNDLE_PLAN.md`, `ADMIN_BUNDLES_UI_PLAN.md`.
- **Ops↔session bridge** — OPS writes system-health (15-min) + KPI (daily) into `jlmops-status.md`; `/review-daily` reads it each run. Plan → `jlmops/plans/OPS_SESSION_BRIDGE_PLAN.md`.
- **KPI Summary Tab** — live @440. All 6 `business/KPI.md` KPIs compute automatically: 4 jlmops-source ones (new customers EN/HE, first-order conversion+AOV, 90-day return rate, newsletter subscribers+engagement) via `SysKPISummary`, plus GA4 organic-traffic EN/HE split and organic-source engagement (bounce rate + pages/session) via a dedicated GA4 audience report. All surface in `jlmops-status.md`, no jlmops UI. Month-over-month trend surfacing also live (new customers, return rate, subscriber MoM vs. last closed month) — but the return-rate/subscriber deltas aren't trustworthy until a month closes naturally (next: 2026-08-01), since all 6 backfilled months share one retroactive snapshot; new-customers deltas are trustworthy now. Schema/system doc → `jlmops/docs/DATA_MODEL.md` (`SysKPISummary`); engineering history archived at `jlmops/plans/_archive/KPI_SUMMARY_TAB.md`. Found + worked around along the way: `ConfigService.loadConfig` silently drops a second param pair for non-schema settings, and `sk_Period` closed-month values get silently converted to Dates by Sheets (`.claude/bugs.md` 2026-07-02/03).
- **Theme** — live v1.2.30; Homepage Phase 2 (Gutenberg blocks) queued → `website/HOMEPAGE_BLOCKS_PLAN.md`.

- **Content-library versioning** — attach-to-replace + supersede→`_archive` confirmed live (Decision 7 / Plan B). Not yet smoke-tested: the **Create-translation-text** button (HE translate task with an EN Doc → copies EN + prompt, attaches as HE current, old HE archived); a messy/mobile-pasted URL through the hardened id extraction; `runLibraryDuplicateReconcile` from the editor.
- **Correct Product Name tool** — live (Admin → Products → SKU Management → Correct Product Name); edits WebProdM/WebDetM name fields and logs to Recent SKU Updates. Not yet smoke-tested from /dev. Plan → `jlmops/plans/PRODUCT_NAME_CORRECTION_PLAN.md`.
- **New-product Products-view UX** — shipped and archived (`jlmops/plans/_archive/NEW_PRODUCT_WORKFLOW_UX_PLAN.md`); current behavior documented in `jlmops/docs/WORKFLOWS.md` §14.
- **Verification reverted-task handling** — live; reverting a verify task routes it to Admin → Verification "Reverted — needs admin"; Close completes it, Pass to manager hands it off as an editable Detail-Updates task with findings intact. Not yet smoke-tested. Plan → `jlmops/plans/PRODUCT_VERIFICATION_PLAN.md`.
- **SKU management** — Vendor SKU Update and Trim Safety not yet tested; Product Replacement tested and working, though its product search reads dead WebProdM columns (`.claude/bugs.md`).
- **UI T4.3 count-entry modal** — shipped, unsmoked; verify on a phone when count tasks next appear.
- **`st_DoneDate` set without `st_Status='Done'`** — at least one Manager-assigned row carries a done date while still Assigned, so it surfaces as open. Watch whether the pattern spreads; if so, fix the write path or the dashboard filter.
- **Manager-dashboard pack types** — contact / confirmation / content-publish packs still unexercised (no such tasks have appeared yet); smoke each type's actions when one next shows up.

## Known Issues

1. Consider auto-cleanup of rows below the data range during upsert.
2. Gutenberg editor width doesn't match the Elementor front-end (accepted limitation — use Preview or API-push workflow).

## Blocked / Deferred

- **Year in Wine PDF** — needs PDF-generation research.
- **Woo Brand + GTIN structured-data enrichment** — needs a jlmops-side data-shape change (new WC sync fields or CSV columns); deferred alongside cross-sell.
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
