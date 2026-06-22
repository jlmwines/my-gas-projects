# Publishing View Plan

`LibraryView` is promoted to `PublishingView` — the operational hub for all content and marketing planning. It expands the existing Library surface with Projects, Campaigns, and Calendar tabs, giving admin and manager a single place to plan, track, and distribute. The Calendar tab is shared across both roles; tab sets and drawer actions are role-conditional.

---

## Why the rename

LibraryView was named for its entity catalog. The expanded surface owns projects, campaigns, calendar scheduling, and distribution outputs — not just the content shelf. "Publishing" names the job: getting content and marketing out the door.

---

## Tab Structure

### Admin

| Tab | Owns | Primary action |
|-----|------|---------------|
| **Calendar** | Chronological list of all publication + distribution events | Filter, sort, open entity drawer |
| **Campaigns** | Parent campaign programs; name/status maintenance | — |
| **Projects** | All SysProjects (system + marketing); name/status maintenance | — |
| **Library** | Entity catalog; deficiency preset; family drawer; spawn chain | Spawn chain, Request Correction, Abandon |

### Manager

| Tab | Owns | Primary action |
|-----|------|---------------|
| **Calendar** | Same shared view as admin; read-oriented | Tap row → open drawer |
| **Tasks** | Content tasks assigned to manager; entity context inline | Open Doc, task status |
| **Library** | Entity catalog for locating content | Open entity drawer |

Dashboard task queue remains the manager's daily driver for all task types. The Tasks tab in PublishingView is a content-scoped navigation aid — faster path to the right content task and its entity, not a second task workbench.

---

## Calendar Tab

The editorial overview. Shared across both roles. Flat list sorted chronologically. Replaces `content/PUBLICATION_CALENDAR.md` as the operational calendar.

**Row = primary entity.** Each event is represented by its primary Library entity (EN version for bilingual items; newsletter entity for a print issue). Tapping a row opens the entity drawer, which shows the full picture: sibling state, companions, open tasks, doc link.

**Holiday and non-campaign markers** appear as non-clickable date rows (distinct style). Source: `JLMops_Calendar` — a standalone single-tab Google Sheet. Columns: `cal_Date` · `cal_Name` · `cal_Type` (holiday / blackout / note) · `cal_Notes`. Both consumers use the same file: sessions read/write via Drive MCP; jlmops reads via `SpreadsheetApp.openById()` at Calendar load time and at export time. File ID stored in `config/system.json` as `calendar.sheet_id`, baked into SysConfig by `generate-config.js`.

**Calendar export.** Jlmops generates `jlmops-calendar.md` (upcoming Library entities with target dates + holidays merged, chronological) alongside `jlmops-status.md`. Composition sessions read it at start for planning context.

**Row columns:** date · campaign type · title · state (EN + HE pills) · open task count.

**Filters:** campaign type · state · date range · language.

**What appears:** all Library entity types with a `slb_TargetDate` — blog posts, newsletters, emails, flyers. Holiday markers always appear regardless of filters. Entities without a target date are not on the Calendar (discoverable via the Library deficiency preset).

---

## Campaigns Tab (admin only)

The 4 ongoing parent campaigns — set-and-forget configuration, rarely edited:

| Campaign ID | Type | Distribution? |
|-------------|------|--------------|
| `core-content` | Blog publish | No — publish only |
| `newsletter-print` | Print newsletter | Yes |
| `email-broadcast` | Mailchimp send | Yes |
| `flyer-acquisition` | Mailbox flyer | Yes |

Each row: name · status · count of linked entities.

`core-content` is added to `SysMarketingCampaigns`. The prior design excluded it; blog posts carry `slb_CampaignId = 'core-content'`. `social-organic` deferred until social is an active channel.

Campaigns belong to Projects via `sm_ProjectId` FK on `SysMarketingCampaigns` (one campaign → one project). The prior `spro_CampaignId` FK on SysProjects is dropped — it pointed the wrong way.

---

## Projects Tab (admin only)

All SysProjects rows — system health, ops work, and marketing umbrella projects. List + name/status maintenance only.

**Distribution instance rows deprecated.** The old `PROJ-NL-*` / `PROJ-CMP-*` pattern (newsletter and email instances as SysProjects rows) is replaced by Library entities. Any existing rows are purged; no migration.

AdminProjectsView (already nav-removed) is formally replaced by this tab.

---

## Library Tab

The current LibraryView entity catalog, unchanged in function: entity list, deficiency preset, family drawer, spawn chain entry point, Request Correction, Abandon.

**Entity types.** `news` and `email` already exist in `VALID_TYPES` (LibraryService.js) with sibling-language support. `flyer` needs adding. `blog` and `template` existing.

| Type | Slug pattern | Status | Task spawn |
|------|-------------|--------|------------|
| `blog` | `<topic>-<subtopic>` | existing | draft → translate → publish (fixed chain) |
| `template` | `template-<name>` | existing | — |
| `news` | `news-<topic>-yyyy-mm` | existing | layout_lock → confirm_lead → secondary_slot → print_proof → distribute (fixed chain) |
| `email` | `email-<topic>-yyyy-mm-dd` | existing | copy → html_build → test_send → live_send → pull_results (fixed chain) |
| `other` | `pub-<description>-yyyy-mm-dd` | add to VALID_TYPES | admin selects from full task list at spawn (no fixed chain) |

`other` covers ad-hoc publishing efforts (flyers, social posts, one-off campaigns) without requiring a dedicated type per channel. Flyer-specific task definitions in `taskDefinitions.json` (design, print, drop, attribution_review) remain available for admin selection.

---

## Entity Drawer (all tabs)

One drawer, role-conditional actions.

**Both roles:** Open Doc · task status/count · family section (EN/HE siblings, companions, referenced entities).

**Admin only:**
- `slb_CampaignId` field (set at spawn, editable)
- Spawn Chain · Request Correction · Abandon
- **Distribute panel** — for distribution-campaign entities only (`newsletter-print`, `email-broadcast`, `flyer-acquisition`). Generates UTM-tagged URL + short URL + QR SVG. For newsletters: QR auto-generated from the referenced blog post entity; AYIW section is print/email-exclusive — no link, no QR. Not shown for `core-content` entities.

---

## Data Model Changes

| Change | Detail |
|--------|--------|
| `slb_CampaignId` | New column on SysLibrary. FK to `sm_CampaignId`. Set at spawn; null for templates and non-campaign entities. |
| `sm_ProjectId` | New column on SysMarketingCampaigns. FK to SysProjects. One campaign → one project. Replaces old `spro_CampaignId` direction. |
| `spro_CampaignId` | Dropped from SysProjects. |
| `ssu_ProjectId` | Replaced by `ssu_EntitySlug` on SysShortUrls — FK to SysLibrary slug (distribution events are Library entities, not Projects rows). |
| `core-content` row | New row in SysMarketingCampaigns. Seed at build time. |
| `other` entity type | Add `other` to `VALID_TYPES` in LibraryService.js. `news` and `email` already in vocabulary. No fixed task chain — admin selects at spawn. |
| `JLMops_Calendar` | Standalone single-tab Google Sheet. Columns: `cal_Date`, `cal_Name`, `cal_Type`, `cal_Notes`. Sessions write via Drive MCP; jlmops reads via SpreadsheetApp. File ID → `config/system.json` `calendar.sheet_id` → SysConfig. |
| `jlmops-calendar.md` | New export file generated by jlmops alongside `jlmops-status.md`. |

`slb_TargetDate` already exists (shipped in CONTENT_WORKFLOW_REDESIGN_PLAN Deploy 1). No other schema changes.

**Backfill:** existing blog post entities need `slb_CampaignId = 'core-content'` set. Delivered as a one-time Dev button (`backfillCoreContentCampaignId`).

---

## Views Retired / Consolidated

- **AdminCampaignsView** — folds into the Campaigns tab. Nav entry removed.
- **AdminProjectsView** — already nav-removed; Projects tab replaces it formally.
- **`content/PUBLICATION_CALENDAR.md`** — superseded by Calendar tab. May persist as authoring scratch pad.

---

## Out of Scope (This Plan)

- **Session-composition workflow** — how Claude sessions assist in composing posts, emails, newsletters. Separate concern.
- **Analytics tab** — campaign performance aggregates. Deferred until first distribution cycle has data.
- **Distribute auto-push to RankMath** — deferred per CAMPAIGN_ARCHITECTURE.md.
- **`social-organic` campaign** — deferred until social is an active channel.

---

## Cross-References

- `jlmops/plans/CAMPAIGN_ARCHITECTURE.md` — data model detail; needs update: `sm_ProjectId` direction, `ssu_EntitySlug`, `core-content` addition, distribution instance rows deprecated
- `jlmops/plans/CONTENT_WORKFLOW_REDESIGN_PLAN.md` — shipped; Decision 1 ("markdown stays calendar authoring surface") superseded by Calendar tab
- `jlmops/plans/LIBRARY_VIEW_PLAN.md` — shipped scaffold; PublishingView inherits LibraryView.html as its Library tab
- `content/PUBLICATION_CALENDAR.md` — operational calendar; superseded by Calendar tab on build
- `jlmops/plans/OPS_SESSION_BRIDGE_PLAN.md` — `jlmops-calendar.md` export follows the same pattern as `jlmops-status.md`
