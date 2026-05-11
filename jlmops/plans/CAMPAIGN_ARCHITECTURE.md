# Campaign Architecture

**Status.** Consolidated 2026-05-11 after the planning conversation. Ready for build review.

**Purpose.** Define the data model, workflow, and UI for managing marketing campaigns, their distribution outputs (UTM-tagged URL + short URL + QR), and their relationship to content production Projects.

---

## Layer Split

Two layers with distinct responsibilities, both in jlmops:

- **Campaigns layer** owns *attribution.* UTM scheme, tag generation, short URL service, QR generation, campaign-level analytics.
- **Projects layer** owns *production.* Task chains, content creation, scheduling, status tracking.

**Handoff.** A Project that produces a customer-facing URL (newsletter QR, email link, social post, flyer QR) calls the Campaign Service to build the URL. The URL exists only once the target content is published — so dependent Projects wait on the parent content's publish task. Informal dependency for now.

---

## What a Campaign Is

A Campaign is the **shared-attribution unit** — whatever should get one row in the "how did this do" report. The unifying axis is delivery method.

At launch, all Campaigns are ongoing delivery-channel programs (no end date):

- `newsletter-print` — every print newsletter issue rolls up here
- `email-broadcast` — every Mailchimp send rolls up here

Added when those channels go active:

- `flyer-acquisition` — every flyer drop, geo distinguished via `utm_source`
- `social-organic` — every social post, when social goes live

**Not Campaigns:** welcome-coupon, referral-program. They're offers/mechanisms that reach customers only through the Campaigns above. Performance attribution happens via coupon redemption joins on first-order data — no Campaign FK on the coupon itself.

**Bounded Campaigns** (with `sm_EndDate` set) are supported in the schema but not seeded. The partner can create one ad-hoc if a specific multi-channel push needs its own attribution row. Holiday emails like Pesach are NOT bounded campaigns — they roll up under `email-broadcast` with `utm_content="pesach-2026"`.

**Cardinality rule:** every Campaign has at least one Project (per definition — a Campaign without distribution work isn't doing anything).

---

## Data Model

### New: `SysMarketingCampaigns` (`sm_` prefix)

- `sm_CampaignId` — PK. Pure slug for ongoing (e.g., `newsletter-print`); slug + date for rare bounded campaigns
- `sm_Name` — human name (e.g., "Print Newsletter — Wine Talk")
- `sm_Status` — PLANNING / ACTIVE / COMPLETED / ARCHIVED
- `sm_StartDate`
- `sm_EndDate` — nullable; null = ongoing
- `sm_PrimaryGoal` — free text, one line — what success looks like
- `sm_Notes`

`sm_Type` column dropped — six rows total max, each obvious from its name.

### New: `SysShortUrls` (`ssu_` prefix)

Stores short-code → utm-tagged URL mappings. The Campaign Service writes here; RankMath redirect rules are pushed from this source.

- `ssu_ShortCode` — PK. Unique code segment used in `jlmwines.com/n/<code>`
- `ssu_CampaignId` — FK to `SysMarketingCampaigns`
- `ssu_ProjectId` — FK to `SysProjects` (nullable for standalone Campaign Service uses)
- `ssu_Language` — `en` / `he`
- `ssu_TargetUrl` — utm-tagged destination URL
- `ssu_CreatedDate`
- `ssu_Notes`

### Columns added to existing sheets

- `SysProjects.spro_CampaignId` (nullable FK to `sm_CampaignId`) — distribution Projects fill in; standalone Projects (Core Content blog posts, ops projects) leave null
- `SysCampaigns.scm_MarketingCampaignId` (nullable FK) — Mailchimp sends tied to a Campaign carry the FK

Two FKs in the original draft are dropped or deferred:

- Coupon → Campaign FK: dropped. Effectively one coupon (NIS 50 welcome); brand position isn't discount-driven.
- Activity → Campaign FK: deferred until Contact Manager Half 2 ships.

### Naming collision (existing `SysCampaigns`)

`SysCampaigns` (`scm_`) is Mailchimp-send-level. Don't rename it (too much existing reference code). New `SysMarketingCampaigns` (`sm_`) is the top-level container; Mailchimp sends become children via `scm_MarketingCampaignId`.

---

## Project ID Conventions

Each Project ID names the content (topic stable per channel); the Campaign comes from the FK.

- Blog post: `PROJ-BLOG-<slug>` — slug is canonical and unique forever via WordPress
- Newsletter: `PROJ-NL-<topic>-YYYY-MM-DD` — print date is the stable disambiguator
- Email: `PROJ-CMP-<topic>-YYYY-MM-DD` — send date
- Flyer: `PROJ-FLYER-<topic>-<geo>-YYYY-MM-DD` — drop date + geography

Blog Projects always have `spro_CampaignId = null` (blog is a destination, not a delivery channel). Newsletter / email / flyer Projects always have a Campaign FK.

**Core Content** (the strategic initiative to produce the blog catalog) stays a conceptual umbrella — not modeled as a parent Project row. At current scale, structural parent-child linking doesn't earn its keep.

---

## Campaign Service: Unified Workflow

One workflow produces three outputs from one input. The partner enters target URL + Campaign context once; the service emits utm-tagged URL + short URL + QR. UTM Builder and short-URL builder are the same feature — not two.

**Input.** Either standalone via the Campaign Service UI, or inline from a Project's "Generate Outputs" button.

- Target URL
- Campaign (pre-filled from Project context, or chosen from list)
- Channel context: medium / source / content marker
- Language: `en` or `he` (drives separate short codes per language)

**Outputs.**

- **UTM-tagged URL.** `utm_campaign = sm_CampaignId`; `utm_medium = channel type`; `utm_source = vehicle`; `utm_content = asset marker`.
- **Short URL.** `jlmwines.com/n/<code>`. Stored in `SysShortUrls`. Valuable beyond aesthetics — desktop users (higher purchase rate) and seniors will type/paste rather than scan, so the short URL is an alternative access path next to the QR.
- **QR SVG.** Encoded from the short URL. Downloadable.

**Per-language pattern.** Each language gets its own short URL + QR pair. EN newsletter side carries the EN code; HE side carries the HE code. Two literal redirect rules per article — no regex.

**Redirect runtime.** RankMath handles matching, redirecting, and 404'ing. jlmops pushes new redirect rules to RankMath when a short URL is created. Build-time verification: does RankMath expose an API/hook for programmatic rule creation, or does jlmops write to its DB table?

---

## UI Surfaces in jlmops

Following existing convention (AdminContactsView, AdminProductsView pattern). Separate top-level admin views, cross-linked.

1. **AdminCampaignsView** — small list (5–7 ongoing). Click into Campaign Detail.
2. **AdminCampaignDetailView** — campaign metadata + linked Projects + analysis (Mailchimp send aggregates, coupon redemption count, order activity in window).
3. **AdminProjectsView** — filterable by Campaign / Type / Status. Click into Project Detail.
4. **AdminProjectDetailView** — task chain for this Project + "Generate Outputs" button (calls Campaign Service inline).
5. **AdminCampaignServiceView** — standalone access to the UTM + Short URL + QR workflow (for social or ad-hoc URLs not tied to a Project).

Cross-linking: Project Detail shows parent Campaign name (clickable); Campaign Detail shows linked Projects (clickable).

---

## Workflow Stages (Per Distribution)

Four phases, overlapping and recurring:

1. **Define.** Partner creates a Project via "Add Project" form: Type (auto-fills Campaign), date/slug, topic, notes. System auto-creates the task chain from `taskDefinitions.json`.

2. **Produce.** Project Detail view tracks the chain: draft → edit → translate → publish/print/send. Reuses existing jlmops SysTasks machinery (flow_pattern, due_pattern, role assignment).

3. **Distribute.** At the customer-facing-URL step, partner clicks "Generate Outputs." Campaign Service emits utm-tagged URL + short URL + QR SVG. Mappings store in `SysShortUrls`; redirect rules push to RankMath. Partner uses the outputs in print, email, or social.

4. **Analyze.** After distribution, Campaign Detail view aggregates: Mailchimp open/click metrics, coupon redemptions, orders in attribution window, top-performing `utm_content` values. Read-only queries over existing data. Built when first cycle has data worth looking at.

---

## Build Order

1. **Schema additions.** `SysMarketingCampaigns` sheet + `SysShortUrls` sheet + columns (`spro_CampaignId`, `scm_MarketingCampaignId`). Update `DATA_MODEL.md`.

2. **Seed Campaigns.** Two rows at launch: `newsletter-print`, `email-broadcast`.

3. **Project task templates.** New `taskTypeId`s in `config/taskDefinitions.json` for the Distribution chain types (blog post lead, blog post standalone, newsletter issue, email send, flyer drop).

4. **Campaign Service backend.** UTM builder logic + short code generation + QR SVG emission + `SysShortUrls` writes + RankMath redirect push.

5. **Admin UIs.** AdminCampaignsView, AdminProjectsView, AdminProjectDetailView with Generate Outputs button, AdminCampaignServiceView.

6. **Mailchimp tracking config.** One-time setup: default `utm_campaign = email-broadcast`, `utm_source = mailchimp`, `utm_medium = email`. Per send, partner only sets `utm_content`.

7. **Pilot.** Newsletter Issue #1 (Context lead) + Context blog post Project — end-to-end through Define → Produce → Distribute.

8. **AdminCampaignDetailView analytics.** Built once first cycle's data exists.

---

## Out of Scope (For Now)

- CRM cohort outreach (cooling / lapsed / dormant) and any candidate queue — parked per `CADENCE_REALIGNMENT_PLAN.md`.
- Activity → Campaign FK (`sca_CampaignId`) — added when Contact Manager Half 2 ships.
- Coupon → Campaign FK (`sco_CampaignId`) — not needed; effectively one coupon and brand position isn't discount-driven.
- Parent-Project FK for Core Content — over-engineering at current scale.
- `sm_Type` column — drop until enum grouping has a concrete use.
- Bounded topic / promo / seasonal Campaigns — schema supports them; none seeded at launch.

---

## Cross-References

- `jlmops/plans/CADENCE_REALIGNMENT_PLAN.md` — CRM throttling (companion plan)
- `jlmops/plans/CRM_PLAN.md` — contact data model, segmentation (still computed, cohort actions parked)
- `jlmops/plans/CONTACT_MANAGER_PLAN.md` — Half 1 shipped @81; Half 2 action layer (per-customer welcome) queued
- `jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md` — campaign strategy / business levers (this plan provides the data shape)
- `jlmops/plans/DATA_MODEL.md` — schema additions to be documented here
- `jlmops/plans/WORKFLOWS.md` §12 — flow patterns reused for Project task chains
- `content/PUBLICATION_CALENDAR.md` — external calendar view; annotates with `sm_CampaignId` and Project IDs as cross-link
- `content/CLAUDE.md` — post format and blog/newsletter decoupling; aligns with Project task chain templates
