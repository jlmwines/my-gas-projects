# JLM Wines — Coordination & Roadmap

**Purpose.** Long-term project management view across jlmops + website + content + marketing, reviewed weekly or monthly. Designed to surface seams between areas (where work in one folder depends on, blocks, or unblocks another).

**Frame.** Business is the overarching project. The other folders (jlmops, website, marketing, content) are channels and tools that express it.

**What this is not.**
- Not a session log — `plans/STATUS.md` does that
- Not a timeline — `CALENDAR.md` does that
- Not a roll-up of every plan doc — per-area plans remain the source of truth

---

## Sequence

The current gating event is **theme cutover** (early-to-mid May 2026, staging build active). Most cross-area work waits for cutover so it doesn't get thrown away — but a couple of tracks can advance in parallel.

Two columns: **In flight now** (parallel work that can move while cutover finishes) vs **After cutover** (sequential queue, gated by cutover).

### In flight (parallel)

| # | Initiative | State |
|---|-----------|-------|
| 1 | Theme cutover (gating event) | Active build on staging (v1.0.71 as of 2026-04-30) |
| 1p | Newsletter v1 prep — post writing, plan finalization, print vendor, volume estimate | Operating model approved; "A Year in the Vineyard" HE pending |

### After cutover (sequential)

| # | Initiative | State |
|---|-----------|-------|
| 2 | Newsletter v1 first issue | Waits on cutover for QR destination polish + first print run |
| 3 | Contact Manager Half 1 (Mailchimp data pull) | Plan written, build queued |
| 4 | Contact Manager Half 2 (action layer) | Plan written, build queued |
| 5 | Cross-sell calculation + push | Plan written, build queued |
| 6 | JLMops → WC attribute push | Deferred, lower priority |

Sequence is provisional — review and revise as conditions change.

---

## Active Cross-Area Initiatives

### Theme cutover

- **Owner.** Claude + user
- **Areas touched.** Website (primary), jlmops (sync indirectly affected), content (republish posts after cutover), marketing (newsletter waits on this)
- **State.** Phase 6 complete on staging — 7 posts live EN+HE, About page rebuilt, gifts page rebuilt, footer + header + cart drawer + free-shipping monitor + bottom nav + mobile drawer all working
- **Open seams.**
  - Free-shipping monitor stale text on /cart/ — parked diagnostic, resume next theme session
  - Article publish post-cutover requires WPML translation step
  - 16 Elementor pages partially migrated; remainder TBD
- **Next milestone.** Cutover to live via SiteGround staging-to-live push
- **Detail.** `plans/THEME_REPLACEMENT_PLAN.md`, `plans/THEME_FOUNDATIONS.md`

### Newsletter v1

- **Owner.** User (content + design), Claude (operational mechanics)
- **Areas touched.** Marketing (primary), content (blog post excerpts), website (signup destination), jlmops (later — packing slip integration if automated)
- **State.** Operating model decided. Content engine already built (each blog post source carries a Newsletter Excerpt section). "A Year in the Vineyard" post needs partner edit + translate before first issue.
- **Open seams.**
  - Newsletter destination QR points to that month's primary post on the website — depends on theme cutover for clean experience
  - Signup form on every page footer (already configured via MC4WP + language groups)
- **Next milestone.** First issue ready right after cutover
- **Detail.** `marketing/NEWSLETTER_PLAN.md`

### Contact Manager activation

- **Owner.** Claude (build), user (review + use)
- **Areas touched.** jlmops (primary), marketing (Mailchimp), business (CRM data)
- **State.** Plan written. CRM data layer already runs nightly (548 contacts enriched). What's missing: Mailchimp data automation + action layer for partner follow-ups.
- **Open seams.**
  - MC4WP signup tagging on the new theme — already configured per 2026-04-28 footer rebuild but verify still working
  - WHATSAPP_CRM_INTEGRATION.md may already cover the action layer shape — reread before build
- **Next milestone.** Half 1 (Mailchimp data pull) post-cutover
- **Detail.** `jlmops/plans/CONTACT_MANAGER_PLAN.md`

### Cross-sell calculation + push

- **Owner.** Claude (build)
- **Areas touched.** jlmops (calculation + CSV push), website (theme rendering)
- **State.** Plan written. Schema slot exists in DATA_MODEL.md (`wps_CrossSells`). Pushed alongside daily inventory CSV. Theme replaces native Related Products on PDP, cart cross-sells suppressed for bundle-only carts.
- **Open seams.**
  - Theme needs `inc/woocommerce.php` hooks to swap related-products section + add category-aware heading
  - Calculation reads attribute values from JLMops; if attribute push (deferred) is later built, the loop closes back to the same source
- **Next milestone.** Build post-cutover
- **Detail.** `jlmops/plans/CROSS_SELL_PLAN.md`

### JLMops → WC attribute push (deferred)

- **Owner.** Claude (build, when prioritized)
- **Areas touched.** jlmops, website (WC attribute taxonomy)
- **State.** Deferred, lower priority. Scope locked to intensity / complexity / acidity only. WC storage model needs live confirmation before plan.
- **Detail.** `jlmops/plans/IMPLEMENTATION_PLAN.md` Phase 14+

---

## Open Seams (cross-cutting)

Things where two areas need to meet but the connection is incomplete:

- **JLMops → website push** beyond inventory CSV — broader category, includes attribute push (deferred), description push (not planned), image push (not planned). Currently only inventory + cross-sell IDs flow; everything else is manual upload / manual edit in WC admin.
- **Mailchimp ↔ JLMops** — manual CSV today; automated daily pull queued in Contact Manager Half 1.
- **Packing slip ↔ newsletter** — both live in the same shipment envelope. Currently no integration (newsletter is print-monthly batch, packing slip is per-order generated).
- **Brand consistency across channels** — see `business/BRAND_STANDARDS.md`.

---

## Long-Horizon Direction by Area

### Business / Marketing

- Email = "we exist" reminder. Don't ask for behavior.
- One campaign, two language copies (EN + HE). Microsegmentation not justified at current volume.
- Newsletter insert = primary near-term marketing channel post-cutover.
- Year in Wine retrospective: high-effort personalization (auto-apply coupons, free-gift selection, tiered rewards) backfires. Drop from active roadmap. See `jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md` "What didn't work."

### Website

- Theme replacement is the dominant workstream. Post-cutover: SEO audit, perf tuning to ≥90 Lighthouse, integration with cross-sell loop.

### jlmops

- Sync is stable. Major build areas next: Bundle Management Phase 14 (with composition/condition split per 2026-04-30 decisions), Contact Manager (Half 1 + Half 2), Cross-sell calculation.
- Resource discipline: no new sophistication of CRM data layer until activation works. The system already produces more than the human can act on.

### Content

- 7 posts live EN+HE. Selection + Price vs Quality remain (resume May).
- A Year in the Vineyard publishes in basics category, sticky, evergreen 12-month structure.

---

## Review Cadence

This document is reviewed **monthly** at minimum. Update when:
- An initiative changes state (queued → active → done)
- A new cross-area seam is identified
- A long-horizon direction shifts

The per-area plans remain the source of truth for detail. This doc is the index and the seams.

---

Updated: 2026-04-30
