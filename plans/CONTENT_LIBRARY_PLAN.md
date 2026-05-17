# Content Library Plan

**Status:** PLANNING — discovery + architecture reflection 2026-05-17. No implementation yet. Major rewrite of earlier draft after realizing the original plan repeated the Frankenstein pattern.

**Scope:** A library + librarian system that serves as the **entity layer** for content, marketing, and (eventually) CRM work. Replaces fragmented per-domain containers (Projects, Campaigns, Content folders) with a unified entity model. Post assets first; product images later.

**Cross-cutting:** spans jlmops (ops layer), Claude CLI (production + reasoning), Google Drive (canonical storage), Canva + Mailchimp (creative tools), WordPress (publish target).

---

## 1. Core principle: three primitives

The system reduces to:

- **Entities** — things with state and history (content pieces, customers, templates, campaign instances, etc.). Live in the library.
- **Tasks** — work units. Attach polymorphically to entities via `(entity_type, entity_id)`. One primary entity per task; N references to other entities.
- **Activity logs** — per-entity audit trail. What happened, when, by whom.

**Workflows are not a fourth primitive** — they're wiring on top: when an entity's state changes to X, spawn task Y; when task Y closes, update entity state and write to activity log.

**What's NOT covered by this model** (stays as it is):
- System config (deployment IDs, feature flags) — SysConfig
- Schema / data model definitions — code
- Lookup tables (controlled vocabulary) — reference data
- Periodic housekeeping functions — code on triggers
- Read-only reports — views, not entities

---

## 2. The Frankenstein realization (why we redesigned)

The original draft built a content library as a fourth "container" alongside Projects, Campaigns, CRM. That repeated the pattern that created the problem:

- Each domain had its own container concept, sheet schema, task attachment pattern, state machine, UI surface.
- The Claude/ops coordination layer was bolted on, not designed.
- Library-as-fourth-container would have added a fifth shape.

**The honest assessment:** had we known where we were headed, we'd have built the entity layer first. Customer, content piece, campaign, order, product — all "things with state and history." A single shape for the work.

**The consolidation:** Library becomes the entity layer. The other domains become patterns within it.

**The non-decision:** don't rewrite working code. CRM ships and works; it stays. Existing campaigns sheet stays. Library is built for **new** work (content/marketing); existing surfaces migrate only when there's a real reason.

---

## 3. What gets unified

Each existing framework becomes a pattern within the entity+task model:

| Today | In the unified model |
|---|---|
| Customer (SysContacts row) | Entity type `customer` |
| Outreach message text (SysConfig rows) | Entity type `template` (with EN/HE versions) |
| Marketing campaign type (SysMarketingCampaigns row) | Entity `content_type` value (`email_blast`, `newsletter_print`) |
| Campaign instance (per-project link) | Entity instance of that content_type |
| Blog post draft (`content/<topic>/`) | Entity type `blog_post` |
| Project (PROJ-X container) | Survives only for cross-entity work; most tasks attach directly to entities |
| Task attached to project/contact/campaign via different FKs | Task attached to any entity via `(entity_type, entity_id)` |
| Per-domain activity tracking (SysContactActivity, etc.) | Generic per-entity activity log |

**Nothing disappears as functionality.** The workflows still fire. The CRM logic still runs. The user's daily operating surface looks the same — preset filters in the sidebar give the familiar per-domain views.

---

## 4. The Claude/ops coordination question

### Surfaces and their unique capabilities

- **jlmops** — time-driven runs, multi-tab Sheets access, persistent state, lives where data is.
- **Claude CLI** — judgment + content generation, reach into Canva / Mailchimp / WP REST / local files in one workflow, conversation with admin.

### Read-around pattern (acknowledged)

- Drive MCP only exposes Tab 1 of a workbook (multi-tab GA4 problem hit 2026-05-17).
- ops emits flat **single-tab "Claude-readable"** exports for anything Claude needs to read.
- One-way pipe: ops writes, Claude reads.
- Cadence per export (timer / on-change / on-request).

### Coordination mode: active over passive

Default to **active updates** from disciplined agents (Claude, ops):

- Cheap: one extra write per content action.
- Reliable: no polling/timestamp/dedup infrastructure.
- 14 content pieces — discipline scales.
- Single source of truth, no detection lag.

**Passive (timestamp-based) detection** as narrow fallback for **Evyatar's** artifacts only:

- He shouldn't have to update a sheet from his phone.
- For his work (Canva designs, manual Mailchimp edits, DOC edits), ops or Claude observes the endpoint and writes the registry on his behalf.

### Task vs direct-report rule

- **Tasks (jlmops):** handoffs to Evyatar, async work surviving across sessions, system housekeeping.
- **Direct session reports:** anything admin handles in conversation with Claude.
- Don't create a task for something admin will hear about in-session anyway.

---

## 5. Storage architecture

### Canonical store: Google Drive

- Each content piece has its own Drive folder.
- Evyatar accesses on phone via Drive app — the unblocker.
- ops writes via Drive API (GAS scope); Claude reads via Drive MCP.

### MD/DOC dual format for content entities

- `<slug>.en.md` (canonical for code — WP push, Claude editing)
- `<slug>.en.doc` (for Evyatar — phone editing, Google Translate workflow)
- HE files: same pattern
- Conversion: Claude handles both directions (ops can't run Pandoc); MD → DOC after Claude creates/merges; DOC → MD when Evyatar finishes (`pformat` skill is part of this)
- Pragmatic: DOC is "true" during edit phase (Evyatar's territory); MD is "true" during publish phase (what WP needs)

### No content snapshots

- Library stores reference + timestamp, not frozen copies.
- "Locked version" = the Drive file at that moment.
- Drive version history (~30 days for Docs) is the recovery surface.
- Admin handles recovery beyond that — no automated facility.

### Local `content/<topic>/`

- Source-of-record for **plans only**, not live content.
- Drive is truth from here forward.

---

## 6. Entity model

### Entity types (initial)

- `blog_post` — editorial post (EN + HE)
- `template` — outreach message (welcome, pending payment, etc.) replacing SysConfig usage
- `email_blast` — single-topic or multi-topic Mailchimp send
- `newsletter_print` — print newsletter issue
- `newsletter_mention` — a single section/mention within a newsletter issue
- `social_post` — FB, IG posts (with channel field)
- `customer` — CRM contact (migration optional; CRM continues with SysContacts in parallel)

### Generic columns (all entities)

- `id`
- `slug`
- `title`
- `content_type` (which entity type)
- `state` (per workflow — type-specific values)
- `created_at`
- `created_by`
- `last_touched`
- `tags[]` — free-form
- `taxonomy[]` — controlled vocabulary (grapes, wineries, regions, kashrut, style)
- `references[]` — list of entity IDs this entity refers to

### Per-type extensions

- `blog_post`: `en_md_url`, `en_doc_url`, `he_md_url`, `he_doc_url`, `en_version`, `he_version`, `en_wp_post_id`, `he_wp_post_id`
- `template`: `en_subject`, `en_body`, `he_subject`, `he_body`, version per language, `channel` (whatsapp/email/sms)
- `email_blast`: `mailchimp_campaign_id`, `subject_line`, `send_date`, `recipient_count`
- `newsletter_print`: `issue_number`, `print_date`, `canva_design_url`
- `social_post`: `channel`, `scheduled_at`, `posted_at`, `external_url`
- `customer`: same shape as SysContacts (when/if migrated)

### Reference model (no parent/child)

- Entities reference each other, no ownership.
- Email entity REFERENCES blog post entities it mentions (1, 2, or N posts).
- Newsletter print issue REFERENCES newsletter mention entries, each of which REFERENCES a blog post.
- Reverse lookups answer "who references me" — natural cross-cutting analytics (e.g., "how many emails referenced this winery").

---

## 7. Task model

### Attachment

- Every task has **one primary entity** (`entity_type`, `entity_id`) — where it lives, what/who it's about.
- Tasks can **reference other entities** for context (template being used, triggering order, etc.).

### Example: welcome outreach task

- Primary entity: customer
- References: welcome `template` entity (the locked version being used), the triggering order
- On close: activity log entry on customer records "sent welcome template v1 EN via email" — template version is part of audit trail

### Existing task types continue to work

- `task.contact.outreach` — still fires from HousekeepingService, just attaches to customer entity via unified pattern (today: via `sc_*` linkage; same idea, generic shape)
- `task.content.edit_en` — attaches to blog_post entity
- `task.content.translate_he` — attaches to blog_post entity
- New: `task.content.admin_review_en` — admin gate between Claude draft and Evyatar edit (see §10)
- New: `task.content.create_wp_stubs` — admin prerequisite before content push (see §10)

### Task taxonomy

- **Evyatar-facing** — review, edit, translate, image-select, approve. Evyatar closes.
- **Admin-facing** — publish, schedule, distribute. Admin closes manually post-session.
- **System** — housekeeping, pending-payment follow-ups, schema validation. ops closes itself.
- Library upgrades each task with attached assets and context (e.g., translate task gets pre-drafted HE attached) — same task list, faster time-to-action.

---

## 8. Activity log model

Per-entity log:

- `entity_id` (which entity)
- `timestamp`
- `actor` (claude / ops / admin / evyatar)
- `action_type` (state_change / file_lock / contact_attempt / publish / send / etc.)
- `details` (JSON — type-specific)
- `referenced_entities[]` (related context — which template, which order, etc.)

Generic shape; same log for any entity. SysContactActivity becomes a filtered view of this log (`entity_type=customer`).

---

## 9. Workflow model

Workflows are wiring, not a primitive:

- **Trigger:** state change on an entity, or external event (order completion in WP, scheduled time, file change at watched endpoint)
- **Action:** spawn task(s) attached to relevant entity, with appropriate references
- **Completion handler:** when task closes, update entity state, write activity log entry, potentially fire next workflow

Examples:
- Order completion (first for customer) → spawn outreach task on customer entity, reference welcome template
- Blog post EN locked at v1 → spawn translate_he task on the same blog post, reference EN locked version, auto-draft HE via Google Translate
- All distribution events for blog post X reach "sent/posted" state → mark blog post entity as `fully_distributed`

---

## 10. Workflow walkthrough: blog post end-to-end

### Pre-creation

- Admin decides topic.
- Admin creates `blog_post` entity in library (Claude session or UI).
- Admin manually creates linked WP stubs (empty EN post + WPML-linked empty HE post). Records both `en_wp_post_id` and `he_wp_post_id` in entity. — `task.content.create_wp_stubs` (admin)

### Draft + admin review (EN)

- Claude creates EN draft (in-session, with admin).
- `task.content.admin_review_en` fires — admin reviews (in-session or queued).
- Admin signoff → triggers Evyatar's edit task.

### Heavy edit by Evyatar (EN)

- `task.content.edit_en` — Evyatar opens, heavy edit on DOC, closes → EN locks at v1.

### Translate (HE)

- `task.content.translate_he` fires with Google Translate auto-draft attached.
- Evyatar reviews, edits, closes → HE locks at v1.

### Images

- `task.content.image_select` — Evyatar approves image set, locks.

### Publish (admin in-session)

- Admin starts session with Claude.
- Version check: EN version must equal HE version. If mismatch, Claude tells admin in-session; admin resolves; no task created.
- Push to WP via REST → updates existing stubs by ID (never creates new).
- `task.content.wp_push` admin-facing; admin closes manually post-session.

### Distribution children

- Email blast entity created, references this blog post → workflow chain
- Newsletter mention entity queued for next print issue
- Social post entities for each channel
- Each is its own entity with its own state and tasks

### Re-edit

- New task created (e.g., `task.content.edit_en` again).
- Existing locked file pre-fills task draft.
- Close → v2 locked.
- Downstream distribution events: optionally re-fire (admin decides per case; no auto cascade).

---

## 11. UI shape

### Sidebar nav = preset filters

- **Library** (firehose — rarely used)
- **Blog posts** (filtered to `content_type=blog_post`)
- **Campaigns** (filtered to email_blast + newsletter_print + social_post)
- **Templates** (filtered to `content_type=template`)
- **Contacts** (filtered to `content_type=customer` once migrated; until then, current Contacts view)
- **Tasks** (task queue, filtered by assignee + status)

Each preset shows type-specific columns + actions. User mental model preserved — domain-specific views still exist, just as filters on a unified substrate.

### Entity list view (per filter)

- Generic: title, type, state, last touched, references count
- Type-specific extensions per filter (e.g., blog_post adds version columns, wp_post_id, derivative count)
- Filter chips: state, language gap, tag, taxonomy, date range
- Search

### Entity detail view (drawer)

- All files / external URLs (Drive, Canva, Mailchimp, WP)
- State history (per language for content entities)
- Activity log
- Attached tasks (open + done)
- References (in: who references this entity; out: what this entity references)
- Action buttons in context (Generate HE translation, Lock, Push to WP, Open in Drive)

### Cross-domain queries (new capability)

- "Show everything that references winery Galil" → products + posts + emails + templates + tasks in one result
- "Show entity-360 for blog post Selection" → full lifecycle in one drawer
- These are bonus; not part of the daily workflow unless you ask

---

## 12. Data model summary

Single library table (could be one Sheet, or one tab per type, TBD):

- Generic columns (§6) on every row
- Per-type extension columns (sparse — only populated for relevant type)
- Separate activity log table (§8)
- Separate task table (existing, with attachment pattern updated to polymorphic)
- Reference graph stored inline on each entity as `references[]` (with reverse-lookup indexes / views)

Single-tab variant per query Claude needs (e.g., "all blog_post entities flat with their state and file URLs") — emitted by ops on cadence.

---

## 13. Taxonomy alignment

### Shared with WC product attributes

- Grapes, wineries, regions, kashrut, style — already WC product attributes.
- Library entities use the **same vocabulary** via the `taxonomy[]` column.
- Single source of truth: a controlled-vocabulary sheet in ops.
- ops syncs to: WP product attributes (already happens via Comax pipeline) AND a parallel WP post taxonomy (new).
- Claude reads the same vocabulary when tagging new entities.

### Linkage model (post ↔ product)

- **Product attributes drive linking.** Posts don't carry "mentions SKU X" foreign keys.
- "Posts mentioning Galilee Cab" = WC query against shared taxonomy.
- One direction of truth, auto-updates when product attributes change.

### Prerequisites

- **Lookup-add UI** must exist before scaled tagging (currently no UI; tracked in `.claude/bugs.md`, 2026-05-17 entry).
- **Regions overhaul** (long-term — see §16).

---

## 14. Templates as entities (replacing SysConfig usage)

### Motivation

- SysConfig is brittle and overworked (system flags + content store mixed).
- Email/outreach templates need: EN/HE versions, lockable, edit-via-review workflow, history.
- Aligns with WP email template model; gives migration path off WC default emails over time.
- Library is designed for scale; SysConfig is not.

### Migration path

- Library `content_type=template` rows replace `crm.template.*` SysConfig rows over time.
- Outreach tasks (welcome, pending payment, future cooling/VIP/win-back) reference template entity by ID + version.
- Editing a template becomes a content edit workflow (review, lock, version increment).
- Activity log entry per outreach attempt records template + version sent.

### Implication for SysConfig

- SysConfig stays for true config (system flags, deployment IDs, feature gates).
- Content-shaped SysConfig rows migrate to library template entities incrementally.
- Not a forced sweep — migrate per template as workflows touch them.

---

## 15. Book assembly (narrow scope, long-term)

- A book is a **filtered + ordered view** of existing library entities.
- No special data type for "bridge content"; if connective content is needed, it's another library entity.
- Filter by `tags` or a `collection_membership` field → see chapters in order.
- "Export collection" → assemble into single document (MD/DOC).
- Same library, different view. Future work, not now. Mention only to confirm data model is forward-compatible.

---

## 16. Prerequisites + related future plans

### Lookup-add UI (immediate prerequisite)

- Currently no UI to add lookup values (kashrut, grapes, wineries, regions, style).
- `LookupService.js` only has `getLookupMap()` — read-only.
- Adding requires manual sheet edit.
- Blocks reliable content tagging at scale.
- Tracked in `.claude/bugs.md` (2026-05-17 entry).

### Regions overhaul (long-term, not immediate)

- Known mess; will simplify + consolidate.
- EN as primary key, HE as display translation.
- Apply same EN-key pattern to other lookups when their overhauls happen (grapes / wineries / kashrut currently fine — no overhaul needed).
- Out of scope for content library; mentioned only as related future work.

### WP/WPML stub-creation prerequisite per blog post

- New blog posts require manually created EN + HE WPML-linked WP stubs before content push works.
- Built into the workflow as `task.content.create_wp_stubs` (admin).
- Not a one-time prerequisite; a recurring per-post step.

---

## 17. Migration / phasing

Order matters; each step unblocks the next.

1. **Lookup-add UI** (prerequisite). Small scope, immediate need.
2. **Library schema** designed and seeded. Even if empty, lock down columns.
3. **Single-tab Claude-readable exports pattern** — prove with one trial (e.g., GA4 trend data from 2026-05-17).
4. **Library UI list view** (read-only against schema). Validates shape before writing.
5. **First entity type: `blog_post`.** Create new posts as library entities; existing posts remain in current pattern.
6. **Active update from Claude** on content creation — Claude writes library rows when it creates posts.
7. **Task-chain integration** — ops spawns standard task chain when a new library row appears (via Claude's explicit call, not polling).
8. **Translation button + Google Translate auto-draft** on translate task.
9. **Detail view + action buttons** (publish, version-match check, etc.).
10. **Templates as entities** — migrate one template family at a time from SysConfig (welcome first; pending-payment next).
11. **Distribution events as entities** — email_blast, newsletter_print, newsletter_mention, social_post.
12. **WP cross-linking via shared taxonomy** (post taxonomy aligned with product attributes; PDP shows related posts).
13. **Customer migration** (optional, low priority). Move SysContacts into library entity table when there's a real benefit.
14. **Project absorption** (low priority). Most new work attaches directly to entities; PROJ-X survives only for cross-entity work.
15. **Product images** later (separate plan when post-side is settled).

---

## 18. Decisions banked from discovery + reflection

For continuity if this plan gets picked up later:

- **Library is the entity layer**, not a fourth container concept.
- **Three primitives:** entities, tasks, activity logs. Workflows are wiring on top.
- **No parent/child between entities;** references only, many-to-many.
- **One task attachment model:** primary entity + N references.
- **Tasks ≠ admin reports;** in-session updates beat task-row bureaucracy.
- **Active updates beat passive detection** at this scale; passive narrow fallback for Evyatar's artifacts only.
- **Drive over local** for canonical content storage (Evyatar's phone access).
- **Task closure = version lock;** new task = new version.
- **No automation for cross-version recovery;** admin in charge.
- **No content snapshots;** reference + timestamp; rely on Drive history.
- **Product attributes drive post-product linking;** posts don't carry SKU foreign keys.
- **Don't move assets out of native tools** (Canva, Mailchimp, etc.); library indexes outward.
- **Templates as entities** replacing SysConfig content rows; migrate incrementally.
- **CRM stays as-is for now** — shipped, working, not exercised much; migrate to library entity model only if/when benefit shows up.
- **Campaigns absorbed into library** as entity instances; `SysMarketingCampaigns` sheet retires over time.
- **Projects survive only for cross-entity work**; most tasks attach directly to entities.
- **Build for current scale (~14 pieces);** bake data model for hundreds.
- **Don't rewrite working code** for cleanliness; refactor when there's a real reason.

---

## 19. Open questions

- Where exactly the library lives in `JLMops_Data` workbook (one sheet vs one tab per type).
- File format choice settled (MD + DOC parallel); cycle for keeping them synced needs operational definition (every lock? on demand?).
- Whether the "Claude-readable exports" folder in Drive deserves its own naming convention from day 1 (`for-claude/` prefix or similar).
- Bidirectional Drive interaction later? Claude wanting to *write* something for ops to react to — for now no, but worth keeping in mind.
- For multi-language content, when admin pushes to WP and EN/HE versions don't match: hard block or just warn? (Current decision: hard block, escalate to admin in-session.)
- Cross-language template mismatch in outreach: welcome EN locked at v2 but HE still at v1 — when trigger fires for HE customer, use HE v1, block task, or escalate? (Open.)
- Active version vs latest locked for templates (A/B testing scenario) — is there a separate "active_version_id" pointer or is latest always active? (Open.)
- Template retirement lifecycle — deprecated → archived → ? (Open.)
