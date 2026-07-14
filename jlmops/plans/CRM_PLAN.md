# CRM Plan

The CRM is live: a unified contact master (`SysContacts`) built from WooCommerce orders + Mailchimp subscribers, with calculated wine preferences, behavioral/lifecycle segmentation, an activity timeline, and outreach via email/WhatsApp/Mailchimp. The schema and all derived-field rules (segmentation thresholds, enrichment percentiles) are graduated to `../docs/DATA_MODEL.md` (SysContacts + "Derived field rules"); the overnight maintenance sequence is in `../docs/ARCHITECTURE.md` §2.5.6. This doc keeps the durable classification policy and the remaining intent (recommendations / AI).

## Vision

A relationship system that maintains a unified contact list from orders + subscribers, calculates wine preferences from purchase history, segments by behavior + lifecycle, generates actionable insights for targeted campaigns, and enables personalized communication.

## Data Architecture

| Sheet | Purpose | Key |
|-------|---------|-----|
| `SysContacts` | Customer master list | `sc_Email` |
| `SysContactActivity` | Activity timeline | `sca_ActivityId` |
| `SysCoupons` | Coupon reference | `sco_Code` |
| `SysCampaigns` | Mailchimp campaign history (per-send) | `scm_CampaignId` |

Full column schemas + the segmentation/enrichment derivation rules live in `../docs/DATA_MODEL.md`. Don't duplicate them here.

## Classification policy (the SIMPLIFIED RULE, 2026-04-30)

A single rule governs core/non-core classification (it replaced an earlier "5 bugs + 2 issues" framing):

- **Every customer defaults to `core`**, subdivided by frequency: `core.new` (1 order), `core.repeat` (2+), `core.vip` (5+ orders or ≥3000 NIS). Subscribers with no orders track separately as `prospect.*`.
- **A customer is `noncore.gift` only when ALL their orders look like gifts.** A single order is a gift when **both**: the shipping address differs from billing (different last name) **and** a customer note is present. The `DELIVERY_KEYWORDS` exclusion was dropped — false positives are acceptable; this is rough segmentation filtering, not perfect classification.
- **War-support purchases** (efrat / roshtzurim / gushwarriors / gush / tekoa coupons) were a one-time wave; those buyers age into Lapsed → Dormant and drop out of active outreach on their own. **Not separately classified** — `noncore.war_support` is a legacy/manual value, not auto-assigned.
- **`sc_IsCore` defaults to TRUE**; the gift-only case is the sole override.

## Preference enrichment & language

Wine preferences are calculated from order history (the percentile/threshold rules are in `DATA_MODEL.md`). Preference fields that carry text are stored as a dual-language `_En`/`_He` pair (`sc_FrequentCategories_*`, `sc_TopWineries_*`, `sc_TopRedGrapes_*`, `sc_TopWhiteGrapes_*`, `sc_KashrutPrefs_*`) so EN and HE labels render/export without re-translation.

**Phone normalization.** `sc_WhatsAppPhone` is normalized to `+972` international form for WhatsApp (Israeli `05x`/`0x` → `+972…`, existing `+` kept as-is), and only rewritten when the normalized form actually differs from the stored value (avoids phantom "changes" on every refresh).

## Overnight maintenance

CRM maintenance runs in the nightly housekeeping (phase detail in `ARCHITECTURE.md` §2.5.6): refresh contacts (recompute `sc_DaysSinceOrder`/`sc_DaysSubscribed`/`sc_LifecycleStatus`, log status changes), enrich stale contacts (those past the `sc_LastEnriched` staleness window), then run CRM intelligence (identify cooling customers, spawn outreach suggestion tasks, update health-status metrics). Source timing: WooCommerce orders + Comax prices land during the daily sync; Mailchimp subscribers are a manual import to run before the CRM refresh when there's new data.

## Current state & remaining intent

**Shipped:** the contact master + enrichment + segmentation + activity timeline; the Contact List UI (`AdminContactsView`, 8/4 split with filters + detail panel) and communication actions (WhatsApp templates, outcome logging, Mailchimp export) — see `CONTACT_MANAGER_PLAN.md`.

**Open intent:**
- **Recommendations** — a preference→product recommendation engine + audience-profile bundle suggestions. (The "Year in Wine" personalized-summary campaign that originally lived here is **dropped** per the `CAMPAIGN_SYSTEM_PLAN.md` retrospective.)
- **Deeper AI** — Claude-API natural-language contact queries, campaign content generation, automation suggestions.

## Key files

| Purpose | File |
|---------|------|
| Contact CRUD | `ContactService.js` |
| Order/Mailchimp import | `ContactImportService.js` |
| Preference enrichment | `ContactEnrichmentService.js` |
| Intelligence triggers | `CrmIntelligenceService.js` |
| Schema definitions | `config/schemas.json` |
| Lookup tables | `config/mappings.json` |
