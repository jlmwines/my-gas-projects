# Content Library Plan

**Status:** PLANNING — discovery + architecture reflection 2026-05-17, refined 2026-05-18 (slug conventions, sibling-language reshape, image-as-entity, MD-local revision, template channel-language split, KPI handling), 2026-05-20 (task model retraction + write architecture + task UI shape), 2026-05-21 (atomicity softened, virtual entity types for tasks, lock-time peer-realignment replaces forced version alignment, register-on-create endpoint design, library service canonical-folder ownership, §19 cleared, lookup-add UI demoted to independent need — plan at `jlmops/plans/LOOKUP_ADMIN_UI_PLAN.md`). No implementation yet. Major rewrite of earlier draft after realizing the original plan repeated the Frankenstein pattern.

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
| Marketing campaign type (SysMarketingCampaigns row) | Entity `content_type` value (`email`, `news`, `mention`, `social`) |
| Campaign instance (per-project link) | Entity instance of that content_type |
| Blog post draft (`content/<topic>/`) | Entity type `blog` (sibling per language) |
| Project (PROJ-X container) | Survives only for cross-entity work; most tasks attach directly to entities |
| Task attached to project/contact/campaign via different FKs | Task attached to any entity via `(entity_type, entity_id)` |
| Per-domain activity tracking (SysContactActivity, etc.) | Generic per-entity activity log |

**Nothing disappears as functionality.** The workflows still fire. The CRM logic still runs. The user's daily operating surface looks the same — preset filters in the sidebar give the familiar per-domain views.

---

## 4. The Claude/ops coordination question

### Surfaces and their unique capabilities

- **jlmops** — time-driven runs, multi-tab Sheets access, persistent state, lives where data is.
- **Claude CLI** — judgment + content generation, reach into Canva / Mailchimp / WP REST / local files in one workflow, conversation with admin.

### Read-around pattern (narrowed 2026-05-21)

- **Library file is the read surface.** Single flat sheet (Drive MCP single-tab compatible), readable directly by Claude, written by GAS. That covers session-time browsing of entities, slugs, state, references.
- **No general-purpose export pipe to Claude.** Earlier framing imagined ops emitting many "for-claude/" single-tab exports of multi-tab data (SysContacts, SysOrders, etc.). Not the plan. Intent is to keep the library file as the scope; if Claude needs data from a multi-tab workbook for a session task, fetch it ad-hoc.
- **Periodic reporting exports are a future provision.** When KPI roll-ups or trend data become worth precomputing (Mailchimp / GA4 / orders aggregations), ops can emit a small number of report-shaped single-tab files. Treated as analytics outputs, not as a Claude read-API.
- **Drive MCP constraint stays the reason** the library file is flat single-tab in the first place.

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

(Retracted 2026-05-20: the original "don't create a task for in-session work" carve-out was wrong. Tasks aren't bureaucracy when the work involves human action — they carry reminder + audit + work-tracking, and a manual close after the work is a trivial click.)

- **Tasks (jlmops):** any workflow action involving human work — Evyatar handoffs, admin in-session actions, sync-cycle confirmations of external state (Comax orders loaded, exports processed), system housekeeping. Task row is the work-tracking primitive; manual close preserves the audit.
- **Direct session reports:** Claude → admin in-session updates (status, findings, prepared content). Supplement task rows, don't replace them.
- **Non-task rows in SysTasks** (e.g., `task.system.health_status` singleton used as dashboard backing store): data storage, not workflow tasks. Worth migrating out of the table eventually; out of scope here.

### Library service is the single state writer

Added 2026-05-20.

- **All state writes go through the library service** (server-side in GAS). Entity state changes, activity log entries, task closures — one writer, one place to enforce invariants.
- **UI is the only direct caller** of the library service via `google.script.run`. Buttons, action panels, status changes all route through it.
- **Claude session has no direct path** to the library service. Architecturally that's fine — Claude acts through admin's hand:
  - For state-affecting actions (publish, lock, close): Claude prepares content + tells admin "click X in the UI." Admin clicks. UI calls service. Activity log records `actor=admin`.
  - For artifact creation (drafting MD, generating images, calling WP REST to push posts): Claude works in the local repo and external APIs. A small local node script (sibling to `push-posts.js`) calls a thin GAS HTTP endpoint to register the new artifact in the library — single purpose: `POST { slug, type, file_path, task_id }` → ops writes the library row + activity log entry. That's Claude's only write path to the library.
- **No general-purpose API for Claude.** Browsing, reading state, inspecting status — read the library file directly via Drive MCP. Library file is the scope; no parallel export pipe (see "Read-around pattern" above).

If the admin-click bridge becomes painful later (e.g., Claude driving larger orchestrations), a programmatic HTTP endpoint becomes worth the auth + payload-schema cost. Not now.

### Register-on-create endpoint — design surface (banked 2026-05-21)

The thin GAS HTTP endpoint Claude's local script calls. Same library-service function handles both this endpoint AND the "Add new entity" UI on the library screen (§11) — the endpoint is just the HTTP wrapper.

**Auth.** Shared-secret token in `.wp-credentials` sibling file (or equivalent local credential store), sent as Authorization header. Mirrors the existing `push-posts.js` WP REST pattern. UI path uses Google OAuth via the standard GAS web-app context — actor identity is native.

**Payload.** `POST { slug, type, language, file_path_or_url, references?, task_id? }`. `slug` and `type` required; `language` required for types that split by language; `file_path_or_url` may be a Drive URL, a local git repo path, or null for entities without a file (templates, mentions); `references[]` optional list of entity IDs; `task_id` optional context.

**Idempotency.** Same slug submitted twice (script crash + retry; manager double-clicks Submit) → endpoint dedupes and returns the existing row with `deduplicated: true`. No error on retry. Caller can tell whether it created the row or found an existing one.

**Validation (reject early, structured error).**
- Slug format: kebab-case + type prefix matches the controlled vocabulary (§20).
- Type: in the controlled vocabulary.
- Language: `en` / `he` / `null` (null only for bundled-language types like image-default).
- File ref: valid Drive URL OR valid git repo path OR null.
- References: every entity_id in `references[]` must resolve.

**Response shape.**
- Success: full created entity row + `created: true`.
- Dedupe: existing entity row + `deduplicated: true`.
- Validation error: `{ ok: false, errors: [{ field, message }] }`.
- System error: `{ ok: false, error: "..." }`.

**Side effects on success.**
- Activity log row written with `actor='claude (script)'` (HTTP) or `actor='admin'` (UI path), `action_type='registered'`, details with caller info.
- Reverse-index updates if `references[]` is non-empty (per §6 reverse-lookup support).
- File placement: if `file_path_or_url` points outside the canonical Drive folder, library service moves it to the canonical path per §5 (file ID preserved, URL stays stable).

**Scope (what it doesn't do).**
- No state transitions — separate library service methods for lock / publish / close.
- No file content upload over HTTP — caller is responsible for getting the file to Drive / git before registration. UI path may upload via DriveApp inside GAS since it has Drive write scope.
- No content edits — registration is one-time per entity; further changes go through other library service methods.

---

## 5. Storage architecture

### Storage split: MD local, DOC in Drive

Revised 2026-05-18 from the original "Drive is truth for everything" rule. The narrower true rule is **Evyatar can access on phone**, which only DOC needs to satisfy.

- **MD stays in the git repo** under `content/<topic>/` — canonical for code (WP push, Claude editing). `push-posts.js` already reads MD from local with zero plumbing change.
- **DOC lives in Drive** — Evyatar's edit surface, phone-accessible via Drive app.
- Conversion: Claude handles both directions (ops can't run Pandoc); MD → DOC after Claude creates/merges and uploads to Drive; DOC → MD when Evyatar finishes (`pformat` skill is part of this).
- Library row stores `md_url` (git repo path or raw URL) + `doc_url` (Drive URL).
- MD-canonical-in-Drive is a future evolution if non-developer collaborators ever need to edit MD without a code repo. Not now.

### Drive folder structure

- One folder per content concept (not per language-entity), with both languages inside — Evyatar's translation flow benefits from EN+HE side-by-side:

```
/JLMops_Data/Library/
  blog/
    context/
      context-en.doc
      context-he.doc
```

- `archive/` reserved for retired stuff later.
- Editorial images, email HTML, newsletter PDFs and other locked-content assets DO get Drive folders (see "Drive as canonical archive" below). Templates and social posts may not need Drive depending on their lifecycle.
- **No `exports/for-claude/` pipe.** Earlier draft imagined this folder as the shared read surface for ops-emitted single-tab data. Out of scope. Library file is what Claude reads (§4). A future `reports/` folder may appear for precomputed periodic reporting (KPI roll-ups, trend snapshots) when that becomes worth building.

### Drive as canonical archive (revised 2026-05-20)

Replaces the 2026-05-18 "live native, library indexes outward" framing. **Generation tools (Canva, Mailchimp drafting) are not archival sources** — they're surfaces used to make or distribute. The actual locked-version artifact lives in Drive.

Storage rules by entity type:

- **MD source** → local git repo (no change). Canonical for code paths (push-posts.js).
- **DOC for editing** → Drive (no change). Evyatar's phone-readable edit surface.
- **Editorial images** (used in content / marketing / newsletters / emails) → Drive. Workflow: generate in Canva → download locally → register via library service → file lands in Drive folder for the concept. Canva URL not stored on the library row.
- **Product images** → WP media library only. No Drive copy. Tied to products which sync from Comax; no editorial flow.
- **Email HTML** → Drive once confirmed used in a campaign. Drafted locally, registered at lock, locked version lives in Drive. Mailchimp draft URL not stored.
- **Newsletter PDFs** → Drive.

The user-readable library across systems:
- Local repo holds MD / draft HTML / source artifacts (developer-readable, git-versioned).
- Drive holds locked editorial assets (anyone-with-Drive-access readable).
- WP media library holds product images and any published editorial images (anyone-with-WP-access readable).
- Mailchimp sent-campaigns archive holds what was actually delivered.

### Version rule

**One slug, one current version. No intra-version history in the library.**

- Library row tracks: slug → current file URL(s) + current version number.
- New version replaces the file at the same slug under the same folder. Old version overwritten; no library-side version cascade.
- Edits between version bumps (Canva re-rolls, mid-task Claude iterations, ad-hoc tweaks) are invisible to the library and live in external systems (Drive history ~30 days for DOC, git history for MD, Canva's own history for designs).
- Activity log entries on a file-bearing entity are only at meaningful milestones: version locks (task close), reference graph changes (added / removed), state transitions (locked / published). Mid-version edits are not logged.
- Reconstruction of "exactly what was published with v3" is via the publish-event timestamp + external system history. Good enough at current scale.

### Folder placement and library-screen entity creation

Added 2026-05-21. The risk to mitigate is the manager (or any caller) creating files in the wrong Drive location and then having to hunt them down or move them after the fact.

**Library service owns canonical-folder lookup.** A single GAS-side function maps `(type, concept, slug, language)` to the canonical Drive path under `/JLMops_Data/Library/`. Every create / move path goes through this function. Callers don't compute paths themselves.

**Manager's entry point is the library screen, not Drive directly.** A "Add new entity" action on the library screen takes type + concept/topic + language, drives the create through the library service, and returns the resulting Drive URL for the manager to open. Manager never starts by creating a Doc in Drive on his own — that path doesn't exist in the discipline.

**The "Create HE doc" button in the translate_he task pack is the same pattern scoped to one case.** Both routes call the same library-service function; both end with the file at the canonical path and a library row pointing at it.

**Three behaviors the library service handles:**

- **Auto-create concept folder.** If `/JLMops_Data/Library/<type>/<concept>/` doesn't exist for a new topic, the service creates it. Caller doesn't pre-flight folder existence.
- **Place at canonical path.** New files land at `/JLMops_Data/Library/<type>/<concept>/<slug>.<ext>` automatically. Filename derives from slug + extension; the service handles naming.
- **Reject silent overwrite.** If a file already exists at the canonical path for that slug, the create call refuses. Updates use a separate "new version" path that's allowed to overwrite per the version rule above.

**Fallback: register-an-existing-Drive-file.** Manager occasionally has a file already in Drive (created by hand, or moved from somewhere) and wants to bring it into the library. The "Add new entity" form accepts an existing Drive URL alongside the type/concept/slug fields. On submit:

- Service extracts the file ID from the URL
- Reads the file's current parent folder
- If not at the canonical path, calls `file.moveTo(canonicalFolder)` — Drive file ID is stable, so the URL stays the same and any links the manager already has keep working
- Renames the file to match `<slug>.<ext>` if the current name doesn't match
- Then creates the entity row pointing at the (now correctly located) URL

The HTTP register-on-create endpoint that Claude's local script calls uses the same library-service function and gets the same guarantees.

---

## 6. Entity model

### Entity types

Type vocabulary kept to short single words (revised 2026-05-18 — the previous longer names like `blog_post`, `newsletter_print` collapsed for slug brevity per §20).

| Type | What | Language split |
|---|---|---|
| `blog` | Editorial post | sibling per language (one entity per language) |
| `news` | Print newsletter issue | sibling per language |
| `mention` | Section/mention within a newsletter issue | sibling per language |
| `email` | Mailchimp send | sibling per language |
| `social` | FB/IG/X post | sibling per language |
| `template` | Outreach message replacing SysConfig usage | sibling per (channel, language) — see §14 |
| `image` | Editorial image asset | bundled (no language axis) by default; sibling when directional |
| `customer` | CRM contact (migration optional) | n/a |

### Language-split rule

**If the artifact has a language, language splits it into sibling entities** (`-en` / `-he` slug suffix). Each language is independently drafted, locked, versioned. The only bundled-language case is the directional-image exception — most images are language-agnostic; directional images split.

Sibling-language pairs reference each other naturally as translation pairs (the slug-pair pattern is the lookup — `blog-context-en` knows its HE peer is `blog-context-he`). Cross-language version-match (§10's publish-time check) becomes a slug-pair lookup instead of row-internal field comparison.

### Generic columns (all entities)

- `id`
- `slug` — canonical join key across Canva/Mailchimp/Drive/jlmops (see §20)
- `title`
- `content_type` (which entity type)
- `language` (`en`, `he`, or `null` for language-agnostic like image-default)
- `state` (per workflow — type-specific values)
- `version` — per-entity counter
- `created_at`
- `created_by`
- `last_touched`
- `tags[]` — free-form
- `taxonomy[]` — controlled vocabulary (grapes, wineries, regions, kashrut, style)
- `references[]` — list of entity IDs this entity refers to

### Per-type extensions

- `blog`: `md_url` (git path or raw URL), `doc_url` (Drive URL), `wp_post_id`
- `news`: `canva_design_url`, `issue_number`, `print_date`
- `mention`: `excerpt`, `position` (primary/secondary), `canva_design_url` if the mention has its own visual element
- `email`: `mailchimp_campaign_id`, `subject_line`, `send_date`, `recipient_count`, plus KPI columns (see §21)
- `social`: `platform` (fb/ig/x), `external_url`, `scheduled_at`, `posted_at`, plus KPI columns (see §21)
- `template`: `subject`, `body`, `channel` (email/whatsapp/sms)
- `image`: `canva_design_url`, `kind` (featured/body/promo/etc.), `index`, `descriptor`
- `customer`: same shape as SysContacts (when/if migrated)

### Reference model (no parent/child)

- Entities reference each other, no ownership.
- **`references[]` holds necessary structural connections only.** This image belongs to this post; this email is about this post; this mention is in this newsletter issue. Test: would the entity be incomplete or orphaned if you removed the link? If yes → reference.
- **Casual relatedness lives elsewhere.** Two posts sharing a topic, two emails going to the same audience, products sharing a winery — that's `taxonomy[]` or computed at query time from shared attributes. Not stored in `references[]`.
- Email entity REFERENCES blog post entities it mentions (1, 2, or N posts).
- Newsletter print issue REFERENCES newsletter mention entries, each of which REFERENCES a blog post.
- Reverse lookups answer "who references me" — natural cross-cutting analytics (e.g., "how many emails referenced this winery").
- Sibling-language pairs are peer entities (no parent/child) — the slug-pair pattern (`-en`/`-he`) is the join.

---

## 7. Task model

### Attachment

- Every task has **one primary entity** (`entity_type`, `entity_id`) — where it lives, what/who it's about.
- Tasks can **reference other entities** for context (template being used, triggering order, etc.).

### Task lifecycle dates (existing SysTasks schema)

The library plan does NOT introduce new task date semantics — it reuses what jlmops already implements. See `jlmops/plans/DATA_MODEL.md` SysTasks section:

- `st_CreatedDate` — always set at spawn
- `st_StartDate` — nullable until task moves to `Assigned`
- `st_DueDate` — nullable until task moves to `Assigned`; calculated from the task definition's `due_pattern` (`one_week` / `next_business_day` / `two_weeks` / `immediate` / `manual`)
- `st_DoneDate` — set on close

Initial status can be `New` (no dates yet, awaits assignment) or `Assigned` (dates set, work can begin). Chain templates set `initial_status` and `due_pattern` per task. This gives both modes from §9: templates with default relative due dates (`one_week` etc.) OR date-less tasks (`due_pattern='manual'`, `initial_status='New'`) where admin assigns calendar timing as visibility lands.

`flow_pattern` (`admin_direct` / `manager_to_admin_review` / `manager_direct` / `manual`) controls user-to-user routing. The state machine driven by these patterns is already in production via the 2026-05-11 distribution chain work — library plan inherits, doesn't redesign.

### Virtual entity types (customer, order, project)

Added 2026-05-21. The polymorphic `(entity_type, entity_id)` attachment is uniform across the system, but not every entity type lives in the library table. Customer / order / project rows stay in their existing sheets (`SysContacts`, `SysOrders`, `SysProjects`) — they're treated as **virtual entity types** where `entity_id` is the row id in the source sheet.

- `entity_type='customer'`, `entity_id=sc_ContactId` → points at a SysContacts row.
- `entity_type='order'`, `entity_id=wom_OrderId` (or equivalent) → points at a SysOrders row.
- `entity_type='project'`, `entity_id=spro_ProjectId` → points at a SysProjects row. (Per §11, project may eventually migrate into the library table; until then, virtual.)
- `entity_type IN ('blog', 'email', 'news', 'mention', 'social', 'template', 'image')` → points at a library table row.

Result: SysTasks gets two new columns (`entity_type`, `entity_id`) added at the END of the schema (per the schema-append-only rule). Existing typed FK columns (`sc_ContactId`, `spro_ProjectId`, etc.) become redundant once writers are updated to populate the new columns; they can be retired in a later cleanup pass, not as part of the initial migration. One attachment pattern across the board from day one, no Frankenstein, no CRM rewrite forced.

References[] follows the same pattern — a task referencing the triggering order writes `entity_type='order'` into its references graph; the resolver dereferences against SysOrders, not the library table.

### Example: welcome outreach task

- Primary entity: customer
- References: welcome `template` entity (the locked version being used), the triggering order
- On close: activity log entry on customer records "sent welcome template v1 EN via email" — template version is part of audit trail

### Existing task types continue to work

- `task.contact.outreach` — still fires from HousekeepingService, just attaches to customer entity via unified pattern (today: via `sc_*` linkage; same idea, generic shape)
- `task.content.edit_en` — attaches to the `-en` sibling entity (e.g., `blog-context-en`)
- `task.content.translate_he` — attaches to the `-he` sibling entity (or creates it if it doesn't exist yet)
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
- `actor` (claude / ops / admin / evyatar / customer / system)
  - `customer` = customer-initiated events surfacing into entity history (order placed, contact form submission). Telemetry like opens/clicks stays in Mailchimp per §21 — not logged here.
  - `system` = cron-fired or automatic events with no human or named-service actor (housekeeping run completion, scheduled task firing).
- `action_type` (state_change / file_lock / contact_attempt / publish / send / etc.)
- `details` (JSON — type-specific)
- `referenced_entities[]` (related context — which template, which order, etc.)

Generic shape; same log for any entity. SysContactActivity becomes a filtered view of this log (`entity_type=customer`).

---

## 9. Workflow model

Workflows are wiring, not a primitive:

- **Trigger:** state change on an entity, or external event (order completion in WP, scheduled time, file change at watched endpoint)
- **Action:** spawn task(s) attached to relevant entity, with appropriate references. **May also create new entity rows** as part of the chain progression (e.g., spawning HE sibling of an EN blog post; spawning an email entity for a distribution chain). See "Chain progression creates entities" below.
- **Completion handler:** when task closes, update entity state, write activity log entry, potentially fire next workflow

Examples:
- Order completion (first for customer) → spawn outreach task on customer entity, reference welcome template
- Blog post EN locked at v1 → workflow creates HE entity row + new Drive DOC + Google Translate auto-draft + spawns translate_he task attached to HE entity with EN as reference (one workflow call, see below)
- All distribution events for blog post X reach "sent/posted" state → mark blog post entity as `fully_distributed`

### Chain progression creates entities

Added 2026-05-20, narrowed 2026-05-21. Workflows don't just hand off between existing entities — they CREATE new entity rows + tasks as needed. **File creation by ops is a single carved-out case** (HE Drive DOC for blog translation). Everything else lives in external systems and reaches the library through the register-on-create endpoint after the fact.

**Default chain step shape:** create entity row, create task attached to it, link references. All sheet writes. The library service is the writer (per §4).

**No ops-side Drive DOC creation.** Earlier draft (2026-05-20) had a "carved-out case" where ops would create the HE Drive DOC + run Google Translate API during chain progression. **Dropped 2026-05-21** — too brittle (Translate API failures mid-workflow) and unnecessary (manager is going to iterate with Gemini in his Drive workspace anyway, the auto-draft step adds nothing).

**Revised chain spawn for blog (2026-05-21):**

When the blog distribution chain spawns, the library service creates all the tasks at once:

- `task.content.edit_en` — assigned status, due date set per chain template
- `task.content.translate_he` — assigned status, due date staggered a few days later
- (plus images / publish / distribution tasks per the chain)

It also creates the entity rows the tasks attach to, including the **HE entity stub** — slug `blog-<topic>-he`, type `blog`, language `he`, state `draft`, no `doc_url` yet, references the EN sibling. The stub exists from spawn time so `task.content.translate_he` has its primary entity to attach to. Drive DOC creation happens later when the manager clicks "Create HE doc" in the task pack (§11).

**No auto-trigger on edit close.** Closing `task.content.edit_en` doesn't fire any workflow side effect — both tasks already existed from chain-spawn, both are already on the manager's queue, the staggered due dates carry the sequencing. He naturally reaches the translation task after finishing the edit.

**Where artifacts actually come from:**

- **Blog MD (EN)** — Claude writes locally, registers via endpoint, file stays in git.
- **Blog HE DOC** — manager creates via "Create HE doc" button in the translate_he task pack (button calls library service `createBlankDoc()`, which places the file at the canonical Drive path per §5). Manager translates using Gemini in his Drive workspace (see §11 task pack design) and pastes the result into the DOC.
- **Newsletter PDF** — Claude builds via pandoc locally, uploads to Drive on lock, registers via endpoint.
- **Email HTML** — Claude or admin saves locked HTML, uploads to Drive, registers via endpoint.
- **Editorial images** — Canva generates, local script downloads, uploads to Drive, registers via endpoint.
- **Product images** — WP media library only, no Drive copy.
- **Templates / mentions / social / customer** — no file artifact; the entity row is the whole thing.

If a future need surfaces for ops to create a file as part of chain progression, treat it as a new carve-out (justify per-case), not a general capability.

**Manual attachment escape hatch.** For edge cases where automation doesn't fit (workflow didn't fire, ad-hoc asset, special substitution), the entity drawer and task pack expose an "Add file" action — upload local file → register + upload to Drive (or wherever the file type's home is), OR paste external URL → register URL only. Runs through the library service like everything else.

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

- `task.content.translate_he` was already spawned at chain-spawn (with the HE entity stub as its primary). Staggered due date a few days after `edit_en` so it surfaces naturally after the edit.
- Evyatar opens the task pack, sees "Open EN source" + "Open HE target" buttons (the HE target is a blank DOC the system created at the canonical path when he clicked "Create HE doc", or auto-created at chain spawn).
- He works in Gemini (side panel inside the EN doc, or gemini.google.com in another tab), iterates until satisfied, pastes the final HE text into the HE DOC, polishes, saves.
- Closes the task → HE locks at v1.

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
- **Blog posts** (filtered to `content_type=blog`)
- **Campaigns** (filtered to `content_type IN (email, news, mention, social)`) — see §21 for the KPI columns this view surfaces
- **Templates** (filtered to `content_type=template`)
- **Images** (filtered to `content_type=image`)
- **Contacts** (filtered to `content_type=customer` once migrated; until then, current Contacts view)
- **Tasks** (task queue, filtered by assignee + status)

Each preset shows type-specific columns + actions. User mental model preserved — domain-specific views still exist, just as filters on a unified substrate.

### Entity list view (per filter)

- Generic: title, type, state, last touched, references count
- Type-specific extensions per filter (e.g., blog_post adds version columns, wp_post_id, derivative count)
- Filter chips: state, language (en / he / language-agnostic), language gap (siblings present?), tag, taxonomy, date range
- Search
- **"Add new entity" action** (added 2026-05-21) — form takes type, concept/topic, language, optional existing-Drive-URL. Drives create through the library service, which handles canonical folder placement (§5). Manager's primary entry point for any new library entity that isn't auto-spawned by a chain. See §5 "Folder placement and library-screen entity creation."

### Task queue filter / sort / search (Residual 2 settlement, 2026-05-20)

Filters (top-level chips):
- Status (open / done / all)
- Type — entity type: blog / email / news / image / customer / product / project / etc. ("looking at past emails and newsletters")
- Topic — existing: Content / Inventory / CRM / Marketing / etc.
- Assignee — mine / Evyatar / unassigned / all
- Language — en / he / language-agnostic (useful for finding sibling-language tasks, or filtering an EN-only or HE-only workload)

Search: free text on title + entity name.

Sort: due date ascending default (sequence by date). User can change to topic (visual grouping) or alphabetical.

Drop:
- Priority as filter chip. Keep as visual badge in the row (Critical / High show as colored pip; Normal / Low are unstyled).
- Due-window filter. The sort already surfaces what's soon at the top.

**Overlap rule**: pick one per axis. Sort by due date OR filter by due window, not both. Filter by topic OR sort by topic, not both. Sort orders; filter subsets; doing both on the same axis is noise.

Dashboard inline list pre-applies "open + mine" filter. Sidebar Tasks opens unfiltered. Same component, different starting state.

### Action-feedback loop (Residual 6 settlement, 2026-05-20)

Two top-level action categories.

**A. Pure server actions** — no external app launched. Most actions are this (lock, publish, close, refresh-from-Comax, register-on-create). Standard loop:

1. Click → `LibraryService.doAction({ task_id, action_type, payload })` via `google.script.run`.
2. Service runs writes in sequence inside one call: validate → write entity state → write activity log → close task if applicable → return affected rows. Each step logs to SysLog as it goes; no transactional rollback across Sheets writes (GAS doesn't offer one). Partial-failure recovery is manual — read SysLog, finish or revert by hand. At current scale this is rare and acceptable.
3. Standardized response contract: `{ ok, updated: { task, entity?, related_tasks? }, error?, validation? }`. UI replaces local rows from `updated`; no re-fetch.
4. Feedback: brief dismissable toast on success; inline structured message in the task row on validation failure (no popup); toast with retry on system failure (no `alert()`).
5. Button returns to normal state from the response.

Service methods always return updated rows; UI never re-fetches from the queue. Activity log is written by the service inline with the state change, never as a separate UI-driven call. One feedback widget for toasts, one for inline validation — both in the shared widget kit.

**B. External-app triggers** — three sub-patterns by audit-worthiness:

| Sub-pattern | When | Mechanism | Existing surface |
|---|---|---|---|
| **B1. Log-then-launch** | Customer-touching actions (call / text / whatsapp / send email) | Pre-action modal captures channel + topic + outcome + notes. Server logs the attempt, then launches the external app (or server-sends for email). Audit captured regardless of whether the external action succeeds. | `WebAppContacts_logContactAttempt` + ManagerContactView modal |
| **B2. Launch + task-close audit** | Editing artifacts in external tools (open Drive DOC, open Canva, open WP to edit) | No pre-action form. User launches, edits externally, returns and closes the task. Task close = audit. Notes field captures what was done. | Existing ManagerDashboardView pattern for content edit tasks |
| **B3. Just-launch** | Pure navigation / read-only (view a WP post, view a Comax record, view a Drive doc for reference) | Plain link or button. No audit. | Existing "Open" link patterns |

Rule for choosing the sub-pattern: **audit-worthiness of the touch.** Customer-touching → B1; editing artifacts → B2 (task IS the audit); reading → B3.

**Patterns combine within one pack.** A pack mixes sub-patterns per action. Outreach pack typically has "Call customer" (B1) + "View customer history" (B3) + status / notes / Save section (B2 element via task close).

Cross-task or cross-entity orchestrations (e.g., publish → also spawn email + social tasks) happen server-side inside the service method; response carries `related_tasks` so the UI can update those rows too. Workflow chaining doesn't leak into the UI.

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

### Task UI shape

Added 2026-05-20. The current task UIs split into two mental models — `ManagerDashboardView_v2` treats task as the unit of work (expand-in-place); `AdminDashboardView_v2` shows a summary card and jumps to `AdminProjectsView`, which treats project as the unit. That's the Frankenstein to dissolve.

Target pattern: **common skeleton + type pack + shared widget kit.**

- **Common skeleton** — same on every task: title, status, due, assignee, priority, references in/out, activity log, notes, close. Task primitive renders identically regardless of type.
- **Type pack** — slotted body region per task type:
  - `task.contact.outreach`: customer card + call/text/whatsapp buttons (already exists in `ManagerContactView`).
  - `task.content.edit`: file link + draft status + lock button.
  - `task.content.translate_he` (worked example, 2026-05-21): "Open EN source" button (resolves the EN sibling's `doc_url` from `references[]` and opens in a new tab) + "Open HE target" button (the pre-created blank HE doc, or a "Create HE doc" button if the doc hasn't been created yet — clicking calls library service `createBlankDoc()` and lands the file at the canonical Drive path per §5) + optional "Copy EN content to clipboard" + standard notes/close. Manager iterates with Gemini outside the system (side panel inside the EN doc, or gemini.google.com in another tab — system doesn't orchestrate the iteration), pastes the final HE into the HE doc, polishes, closes the task → HE locks at v1.
  - `task.content.blog_publish`: WP push button + version-match check.
  - `task.order.packing_available`: order list + generate-slips button.
  - `task.confirmation.*`: confirm-completed button + notes for what was loaded.
  - Adding a new task type = adding a type pack, not a new view file.
- **Shared widget kit** — small, reusable: customer card, file link chip, status pills, due chip, action button row, confirm dialog, **Comax/Web/ops side-by-side comparison widget** (per the 2026-05-15 wishlist product-overview item — same widget consumed by both drawer and task pack). Three or four core widgets plus type-specific ones; type packs compose from them. Guards against per-pack widget reinvention.

**Type packs choose presentation form** per task type. Three valid forms:

- **Inline expand** — quick edits, status changes, notes. Current manager-dashboard pattern. Default for lightweight packs.
- **Modal overlay** — heavy detail comparison + edit, needs full attention but still task-scoped. Validated by `PRODUCT_VERIFICATION_PLAN.md` (`ManagerProductsView.html` `editor-modal`).
- **Dedicated view** — multi-step or context-heavy work. Validated by `ManagerContactView` for outreach.

Each pack declares its form as metadata. The queue routes the click identically; the pack renders the right surface.

### Drawer vs. task pack — boundary

Added 2026-05-20. The entity detail drawer and task packs both surface entity data, but they serve different purposes and should not duplicate each other.

- **Drawer = read-and-reconcile.** Lived-in inspection surface, opened from an entity link. Canonical example: the 2026-05-15 wishlist "Product-centered ops view" — Comax vs. Web vs. ops side-by-side for triage when something looks off on a specific product. Shows full picture; flags contradictions; deep-links to external surfaces (WP, Comax). Entity-scoped, not task-scoped.
- **Task pack = focused action.** Action surface for a specific task. Reuses the comparison widget where useful (vintage-update pack shows the Comax/Web comparison the drawer also uses) but adds edit affordances and stays task-scoped. Closes after the action.
- **Both compose from the shared widget kit.** Comax/Web comparison is one widget; consumed by drawer for inspection, by task pack for verification work. Same data shape, two framings.
- **Navigation**: task pack → entity link → drawer (inspection). Drawer → attached-tasks list → task pack (action). Two-way but distinct purposes.

Risk if unclear: drawer grows action buttons; task pack grows reference panels and full activity log; both bloat. Rule of thumb: if it's "do something with this," it's pack. If it's "understand this," it's drawer.

Manager dashboard is already halfway there — two inline `if` branches (`isContactTask`, `isSystemTask`) and a generic fallback body. Refactor formalizes the pattern: extract branches into named packs, add the missing ones, build the widget kit.

Admin collapses to the same task-as-unit-of-work model (§18: "Projects survive only for cross-entity work"). Project becomes a filter/view over the unified task queue, not the entry point. Both dashboards converge on one task UI component.

### Mobile

- **Queue is responsive** — list view (skeleton row) works on phone. List → tap → focused action view, not list → expand-in-place (which doesn't scale to mobile).
- **Per-pack action views** declare mobile or desktop-only. Packs with a real mobile use case (`task.contact.outreach` → `ManagerContactView` already shipped 2026-05-14) get a mobile-shaped action view. Packs that don't get desktop-only with "open on desktop to complete" placeholder on narrow screens.
- **Shared widgets are responsive once.** Foundation cost paid in refactor; per-pack cost paid when a real mobile case appears.

Refactor, not rewrite. Bones are right; the type-pack pattern needs formalizing; admin's project-centric path collapses into the unified queue.

### Project entity + chain spawning

Added 2026-05-20. Per §18 "Projects survive only for cross-entity work" — what that looks like in the UI:

- **Project becomes a library entity type.** Same shape as blog / email / news — slug, title, notes, state, references[], activity log, attached tasks. Just another entity, not a special container.
- **AdminProjectsView narrows to**: (1) a drawer for project entities, (2) a filter view on the unified task queue. Not a separate task management surface.
- **Cross-entity coordination uses references**, not containment. A campaign project entity has `references[]` pointing at the email, newsletter mention, and social post entities under that campaign. Each child entity has its own life and tasks; the project entity coordinates.
- **Tasks attach where the work lives**: about the email → email entity; about the project as a whole → project entity. Tasks attach to one primary entity, reference others as context.

**Chain spawning as the substitute for today's project-spawn-tasks capability.** Today's "Generate Outputs" button + 16 distribution templates (shipped 2026-05-11) generalize into the library era as:

- **Chain templates** are reusable definitions: N tasks with relative due dates, default assignees, topics, attachment shape. The existing 16 distribution templates migrate to this form. Examples: "Newsletter Issue Distribution," "Email Campaign Build," "Blog Post End-to-End."
- **"Spawn chain" action available on any entity drawer** that has chain templates registered for its type. Admin opens the entity, clicks Spawn chain, picks template, system creates the tasks attached to the right entities with appropriate due dates and assignees. Generalizes the Generate Outputs button to any entity, not project-exclusive.
- **Spawned tasks are independent.** The chain template is a one-time generator. Once spawned, admin can edit, skip, close ahead, reassign, add new ones, or delete. The template doesn't constrain after creation.
- **Ad-hoc task creation** (today's `task.project.custom`) becomes a "Create task" action available on any entity drawer.

What this preserves from today: chain-of-tasks orchestration, admin's path-planning move, reuse of the 16 distribution templates. What it gains: chain spawning everywhere, not projects-only.

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

Revised 2026-05-21 after the WC attribute landscape was clarified (intensity / complexity / acidity are the three active filter dimensions; winery is tolerated but kept; everything else is purgeable) and the existing `WooCommerceFormatter` pattern surfaced as the model for cross-linking.

### Shared vocabulary lives in the ops lookup tabs

- ops already holds product attribute codes per row (`wdm_Region`, `wdm_Intensity`, `wdm_Complexity`, `wdm_Acidity`, `wdm_GrapeG1..G5`, etc.) plus lookup tabs (texts / grapes / kashrut) that resolve codes to EN/HE display labels.
- Library entities use the **same codes** via the `taxonomy[]` column. A post tagged with `intensity=IN3` matches every product whose `wdm_Intensity` is also `IN3`. No new vocabulary infrastructure.
- Claude reads the same lookup tabs when tagging new entities.

### Linkage model (post ↔ product)

- **No WP custom taxonomies on posts. No taxonomy sync into WP.** Earlier draft proposed pushing a parallel post taxonomy into WP and querying it from PHP templates — out of scope.
- **Cross-linking renders at publish time, ops-side.** The model is the existing `WooCommerceFormatter.formatDescriptionHTML()` (jlmops/WooCommerceFormatter.js:138), which already takes a product's codes + lookup maps and emits structured EN/HE HTML for the product description AND the packing slip. Same source data, multiple output surfaces, all rendered in ops.
- A new renderer in the same shape will produce cross-link HTML: take a library entity's `taxonomy[]` codes, query ops product data for matches, emit a "related products" block — injected into the published WP post body when push-posts.js fires. Reverse direction (PDP "related posts") works the same — query library entities matching the product's codes, emit HTML, push into a custom field the PDP template reads.
- One direction of truth (ops product data + lookups); auto-updates whenever those are refreshed.

### Prerequisites

- **Lookup-add UI** must exist before scaled tagging (currently no UI; tracked in `.claude/bugs.md`, 2026-05-17 entry).
- **Regions overhaul** (§16 — region codes need cleanup + EN-primary keying before cross-linking on region works cleanly).
- **Purge of unused WC attributes** (kashrut / grape / region / style / etc. on the storefront filter side — separate housekeeping; doesn't block library work because library reads codes from ops, not from WC).

---

## 14. Templates as entities (replacing SysConfig usage)

### Motivation

- SysConfig is brittle and overworked (system flags + content store mixed).
- Email/outreach templates need: EN/HE versions, lockable, edit-via-review workflow, history.
- Aligns with WP email template model; gives migration path off WC default emails over time.
- Library is designed for scale; SysConfig is not.

### Channel-language split

Templates split by BOTH channel AND language (revised 2026-05-18). Each combination is independently drafted and locked — EN email body might be locked while HE whatsapp is still in draft. 4 entities per use-case for typical (email + whatsapp) × (en + he):

- `template-welcome-email-en`
- `template-welcome-email-he`
- `template-welcome-whatsapp-en`
- `template-welcome-whatsapp-he`

Channel goes before language in the slug (channel is the stable axis, language is the variant).

### Migration path

- Library `content_type=template` rows replace `crm.template.*` SysConfig rows over time.
- Outreach tasks (welcome, pending payment, future cooling/VIP/win-back) reference template entity by ID + version. The task knows what channel and language to send and looks up the matching template entity by slug.
- Editing a template becomes a content edit workflow (review, lock, version increment).
- Activity log entry per outreach attempt records template + version sent.

### Active version

Latest locked version is active (no separate pointer). A/B testing or multi-version-active scenarios deferred — re-open §19 if a real need surfaces.

### No historical template body preserved

Added 2026-05-21. Per the §5 "one slug, one current version" rule, the library overwrites old template body text on version bump. We don't snapshot prior versions to an audit table. If reconstruction of what a prior version said is ever needed, the source is whatever external system archived the actual send (Mailchimp sent-campaigns log for Mailchimp-delivered outreach; nothing for GAS direct-SMTP sends). Accepted limit at current scale — template version tracking isn't worth building.

### Peer-language realignment via lock-time prompt

Added 2026-05-21, replaces the 2026-05-20 "force version alignment, block send" rule.

Sibling-language entities (blog, news, mention, email, social, template) don't hard-couple their version counters. Instead, when an editor locks a new version of one language, the lock action prompts:

> *"Does the [peer-language] need editing for this change?"*

- **Yes** → spawn realignment task on the peer entity. The pair is in "drifting" state until the peer locks at the matching version (or the editor closes the realignment task with a deliberate "no change needed" note).
- **No** → no peer task. Activity log records the editor's choice (audit shows the peer was intentionally skipped — typical for typo fixes in one language, or when this IS the realignment of a previously-drifted peer).

Rationale: the people doing this work (admin, manager, Evyatar) are aware of the pairing. Hard-coupling would force useless work in the realignment-fix case (HE had a typo, EN was fine — fixing HE shouldn't force an EN re-lock). The prompt fires at the moment of lock when the editor's context is freshest, and the activity log preserves the audit either way.

**Outreach / publish guard:** block if an *open* peer-realignment task exists on the family. Version-number mismatch alone doesn't block — a deliberate-mismatch state (no open task) is allowed. The realignment task is the source of truth for "is this pair coherent right now."

Applies to templates (welcome, abandoned-order, future cooling / VIP / win-back) and to blog / news / mention / email / social siblings. Same prompt, same realignment task pattern; consumers differ (templates → outreach engine; blog → publish action).

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

### Lookup-add UI (independent operational need)

- No UI to add lookup values; `LookupService.js` is read-only.
- Real near-term scope (per 2026-05-21 walkthrough): `SysLkp_Grapes` + `SysLkp_Kashrut`. `SysLkp_Texts` is phase 2. Cities skipped; wineries live in WP; regions handled later via the Texts pack.
- Demoted 2026-05-21 from "immediate prerequisite" to independent operational need: §13 cross-linking is future work, so scaled tagging via controlled vocabulary isn't blocked by this UI.
- Plan: `jlmops/plans/LOOKUP_ADMIN_UI_PLAN.md`.
- Tracked in `.claude/bugs.md` (2026-05-17 entry).

### Regions overhaul (concrete approach added 2026-05-21)

Three problems to fix together:

1. **Misalignment with editorial.** Region values in the lookup don't match the regions we'll be publishing articles about. Cross-linking won't work cleanly until they reconcile.
2. **Invalid combinations in the data.** Existing region values include compound or invalid pairings that shouldn't exist as taxonomy values.
3. **Hebrew-primary lookup.** Regions are the only lookup table where the primary key is Hebrew; all other lookups use English as the primary. Inconsistent.

Concrete fix:

- Define the canonical list of valid regions in English (the article-driven set).
- Add EN codes for each, plus EN + HE display translations, into the texts lookup table.
- Update existing product rows to point at the new codes:
  - **Option (a) sweep:** one-pass backfill replacing old region values with new codes.
  - **Option (b) organic:** retire old region values gradually as products get touched during normal updates.
- Pick (a) if the product count is small enough to sweep in one sitting; (b) otherwise.

Apply the same EN-key pattern to other lookups when their overhauls happen (grapes / wineries / kashrut currently fine — no overhaul needed). Out of scope for the library plan proper; prerequisite for §13 cross-linking on the region dimension specifically.

Add to `.claude/bugs.md` as a tracked cleanup when scheduled.

### WP/WPML stub-creation prerequisite per blog post

- New blog posts require manually created EN + HE WPML-linked WP stubs before content push works.
- Built into the workflow as `task.content.create_wp_stubs` (admin).
- Not a one-time prerequisite; a recurring per-post step.

---

## 17. Migration / phasing

Order matters; each step unblocks the next.

### Rollback + safety preconditions

Established 2026-05-25 before phase 2 began; corrected same day after the workbook-placement miss (see "Workbook placement" below).

**Workbook placement (architectural constraint, not a soft preference)**

`SysLibrary` lives in a **separate single-tab Google Sheets workbook** called `JLMops_Library` (id in `system.spreadsheet.library`), NOT as a tab in `JLMops_Data`. Reason: §4 read-around requires Drive MCP read access, and Drive MCP only handles single-tab workbooks per `reference_drive_files` — JLMops_Data is multi-tab and Drive-MCP-blind. Putting SysLibrary inside JLMops_Data breaks the entire Claude-reads-the-library-directly design.

`SysLibraryActivity` DOES live inside `JLMops_Data` (ops-internal, no Drive MCP read need per §18). Same for any future library-related tables that are ops-only.

Rule: before adding any new sheet/file/folder for this plan, answer **"does Claude need to read this via Drive MCP?"** If yes → separate workbook (and add a `system.spreadsheet.<name>` config row + matching SheetAccessor getter). If no → tab inside JLMops_Data, register in `system.sheet_names`.

**Rollback preconditions**

- **Git tag** the current state (e.g. `pre-library-v0`) at the pre-phase-2 commit so any phase can be reverted to a single known point.
- **Data snapshot** of `JLMops_Data` (Drive → Make a Copy) so any tab schema misstep is recoverable without a live restore. Snapshot taken 2026-05-25.
- **Library workbook does not need its own snapshot** at phase 2 — it's empty and fully reproducible from schemas.json + the headers CSV. Snapshot becomes worth taking once real entity rows accumulate.
- **Deploy ID** already pinned in `jlmops/.deployment-id` — the stable web-app URL survives all rollback deploys.
- **Feature flag** `library.enabled` in SysConfig (default `false`). Library service methods short-circuit when off; nav hides the library view.

**Build discipline across phases**

- Phases 2–3, 5–7 are **additive** (new GAS files, new view file, new schema entries, empty Drive folder skeleton). The new SysLibrary workbook and the SysLibraryActivity tab are both additive — removable / ignorable without touching live code paths.
- Phase 4 (task UI refactor of `ManagerDashboardView_v2` + `AdminDashboardView_v2`) is the **single riskiest in-place edit** — daily-use code. Worth its own plan doc + extended soak before promotion.
- SysTasks polymorphic columns (`entity_type`, `entity_id`) — **append only**, leave existing typed FK columns alive (per `feedback_schema_append_only`); retire FKs in a later cleanup pass, not phase 1.
- Deploy one phase at a time: bump VERSION → `clasp push` → `deploy.ps1` to prod with explicit OK at each change-point. Bundled deploys defeat both `git revert` and the deploy-ID pin.

### Phases

1. **Lookup-add UI** — independent operational need, not a library prerequisite (per 2026-05-21 walkthrough; §13 cross-linking is future work). Does not block library work. Plan: `jlmops/plans/LOOKUP_ADMIN_UI_PLAN.md`.
2. **Library schema** designed and seeded. Even if empty, lock down columns.
3. **Confirm Drive MCP read access to the library file.** One-time check that Claude can read entity rows directly from the live library sheet via Drive MCP. No separate export pipe to build (scope narrowed 2026-05-21 — library file is the read surface).
4. **First entity types: `blog` + `image`** (reordered 2026-05-25 — was phase 5; now ahead of UI so the UI can be built against real data instead of empty scaffolding; task-UI refactor in new phase 5 remains independent of library data either way). Create new posts as library entities (sibling-language pair per post) with their image entities (featured + body); existing posts remain in current pattern. Concrete sub-steps for the next session:
   - **SheetAccessor extension** — add `getLibrarySpreadsheet` + `getLibrarySheet` + `clearCache()` update, mirroring the existing data/log getters but reading `system.spreadsheet.library`. ~25 lines, no risk to existing flows. Sized 2026-05-25.
   - **LibraryService skeleton** — header-driven write + read methods. Model: `LookupService.js` from @121 (runtime header discovery via row 1, append-only for adds, key-immutable on update, cache invalidation per write, EN/HE-required suffix detection adapted to library's column shape). Methods needed at minimum: `getLibrarySheet()`, `registerEntity({slug, type, language, ...})`, `getEntityBySlug(slug)`, `listByType(type, language?)`. State-transition methods (lock/publish/close) and chain-spawn methods defer to later phases.
   - **Register-on-create HTTP endpoint** per §4 — shared-secret auth via `.wp-credentials` sibling, payload `{slug, type, language, file_path_or_url, references?, task_id?}`, validation up front (slug format / type vocabulary / language / file ref / references resolvable), idempotent on duplicate slug (returns existing row with `deduplicated: true`), structured error responses. Side effects: activity log row (`actor='claude (script)'`, `action_type='registered'`), file-move-to-canonical-path if needed (per §5).
   - **Local node script** sibling to `push-posts.js` that calls the endpoint after artifact creation. Single purpose. Claude's only write path to the library.
   - **Manual seed of Context as proof** — register the existing EN sibling first, then HE sibling. Exercises the full path end-to-end. Validate by Drive MCP reading `JLMops_Library` and seeing both rows.
   - **Image entities** for Context post follow the same registration path (featured + body, indexed per §20 slug pattern). May defer to a follow-up session if blog seed alone is enough proof.
5. **Library UI list view + task UI refactor** (reordered 2026-05-25 — was phase 4). Build read-only library list using the common-skeleton + type-pack pattern with a shared widget kit (§11). Refactor `ManagerDashboardView_v2` task list to formalize the pattern; collapse `AdminDashboardView_v2` + `AdminProjectsView` task surface into the same shape — project becomes a filter over the unified queue. **Single riskiest in-place edit per §17 safety preamble** — touches daily-use code. Own plan doc (`jlmops/plans/LIBRARY_TASK_UI_REFACTOR_PLAN.md`, to be drafted in chavruta as the first move of this phase) + extended soak before promotion. Validates the type-pack shape against real entity data created in phase 4.
6. **Active update from Claude** on content creation — Claude writes library rows when it creates posts. Ops emits a lightweight orphan-content-files integrity report on cadence as a backstop against missed updates.
7. **Task-chain integration** — ops spawns standard task chain when a new library row appears (via Claude's explicit call, not polling).
8. **Translation button + Google Translate auto-draft** on translate task.
9. **Detail view + action buttons** (publish, version-match check, etc.).
10. **Templates as entities** — migrate one template family at a time from SysConfig (welcome first; pending-payment next).
11. **Distribution events as entities** — `email`, `news`, `mention`, `social` (all sibling-language per §6). KPI stats columns refreshed by ops (see §21).
12. **Cross-link renderer** — extends the existing `WooCommerceFormatter.formatDescriptionHTML()` pattern. Ops-side function that takes a library entity's `taxonomy[]` codes, queries product data for matches, emits an EN/HE related-products HTML block injected into the post body at publish; reverse function for PDP "related posts" via a custom field. No WP custom taxonomies on posts.
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

Added 2026-05-18:

- **Slug pattern:** `<type>-<topic-or-series>-<discriminator>` with hyphens everywhere. Type-first (type is stable, disambiguates outside folder context). See §20.
- **Type vocabulary kept to short single words.** `blog`, `news`, `mention`, `email`, `social`, `image`, `template`, `customer`. Renames `blog_post`/`newsletter_print`/`newsletter_mention`/`email_blast`/`social_post` from the original plan.
- **Language always splits when the artifact has a language.** Sibling-language entities (`-en`/`-he`) for `blog`, `news`, `mention`, `email`, `social`, `template`. Bundled exception: `image` defaults to no language axis; sibling only when directional.
- **Templates split by BOTH channel and language.** Four entities per use-case for typical (email + whatsapp) × (en + he).
- **MD stays local in git repo; DOC lives in Drive.** Revises the original "Drive is truth" rule. The real rule is "Evyatar can access on phone" — DOC satisfies; MD-canonical-in-Drive is future evolution.
- **Derivative entities split off at lock time.** Source DOC remains the authoring surface; derivatives copy their starting content from the relevant section at lock and then have independent life. Re-edit of source does NOT auto-cascade (matches §10).
- **Campaign KPIs as stats columns on entity rows**, refreshed on cadence by ops from Mailchimp/GA4/orders (see §21).
- **Latest-locked-is-active** for templates and other versioned entities. Defer `active_version` pointer for A/B testing until real need.

Added 2026-05-20:

- **Outreach templates with multi-language requirement: force version alignment.** Block send if peer-language template not at same locked version. Applies to welcome, abandoned-order, and future outreach templates (cooling, VIP, win-back). Mismatch surfaces as a content gap in admin session, not a runtime fallback decision. Closes §19's cross-language mismatch question. **RETRACTED 2026-05-21** — replaced with lock-time peer-realignment prompt (§14 "Peer-language realignment"). Hard version alignment would force useless re-locks in the realignment-fix case. The new model: at lock time, editor is prompted whether the peer needs editing; "yes" spawns a realignment task on the peer; "no" records the choice in the activity log. Outreach/publish guard becomes "no open peer-realignment task," not "versions must match." Same rule applies to all sibling-language entity types, not just templates.
- **Ops emits orphan-content-files integrity report on cadence** as a backstop against missed active updates from Claude (phase 6). Lightweight check, not a primary mechanism.
- **§4 in-session task-row carve-out retracted.** Tasks for all workflow work involving human action; manual close is a trivial click. Sync-cycle confirmation tasks (`task.confirmation.*`) confirm external state (orders loaded into Comax), they're real work, not UI cruft. See §4.
- **Library service is the single state writer.** UI is the only direct caller via `google.script.run`. Claude acts via admin clicks for state changes; Claude's only library write path is a register-on-create endpoint called by a local script after artifact creation. See §4 final subsection.
- **Task UI = common skeleton + type pack + shared widget kit.** Manager dashboard is already halfway there; admin collapses from project-centric to task-as-unit-of-work; mobile via queue-responsive + per-pack action views. Refactor, not rewrite. See §11.
- **Type packs choose presentation form** per task type: inline expand (lightweight), modal overlay (heavy comparison, validated by PRODUCT_VERIFICATION_PLAN), or dedicated view (multi-step, validated by ManagerContactView). Pack declares its form as metadata; queue routes clicks identically. See §11.
- **Drawer vs. task pack boundary**: drawer is read-and-reconcile (lived-in inspection, e.g., wishlist 2026-05-15 product overview — Comax/Web/ops side-by-side for triage). Task pack is focused action (transient, task-scoped). Both compose from the shared widget kit; the Comax/Web comparison widget is consumed by both. See §11.
- **Drive as canonical archive (revises 2026-05-18 "live native").** Generation tools (Canva, Mailchimp drafting) are not archival sources. Editorial images, email HTML, newsletter PDFs, DOCs all live in Drive once locked. Product images are the narrow exception — they live in WP media library only. See §5.
- **One slug, one current version. No intra-version history in the library.** New version replaces old at the same slug. Mid-version edits live in external systems (Drive history, git, Canva); invisible to the library. Activity log only records version locks, reference-graph changes, state transitions. See §5 version rule.
- **Activity log surface boundaries.** Three distinct logs: SysLog (system operations, existing), entity activity log (per-entity, drawer surface, new under library), task history (per-task lifecycle, inline in task pack skeleton). A single action may write to all three; they don't replicate each other. Task creation / closure are recorded on the task itself, not in the entity log — the entity log records ENTITY events with `task_id` as context.
- **Project becomes a library entity type, not a container.** AdminProjectsView narrows to (1) drawer for project entities, (2) filter view on the unified task queue. Tasks attach where the work lives (email task → email entity; project-level task → project entity); cross-entity coordination uses references[], not containment. See §11.
- **Chain spawning generalizes the project-spawn-tasks capability.** Existing 16 distribution templates (shipped 2026-05-11) migrate to chain templates registered against entity types. "Spawn chain" action available on any entity drawer with registered templates. Spawned tasks are independent (admin can edit / skip / close / reassign / delete; template is a one-time generator). See §11.
- **Workflows create new entity rows + tasks as part of chain progression**, not just hand off between existing entities. **File creation by ops is a single carved-out case**: HE Drive DOC for blog translation. All other artifacts (newsletter PDF, email HTML, editorial images, blog MD) are created in external systems by Claude / Canva / Mailchimp and reach the library via the register-on-create endpoint after the fact. New ops-creates-file cases require explicit justification per case, not a general capability. Each workflow step logs to SysLog; partial-failure recovery is manual. Manual attachment escape hatch on entity drawer / task pack for edge cases. See §9.
- **Task queue filters (Residual 2 settlement)**: status, type (entity type), topic, assignee, language. Sort by due date ascending default. Drop priority as filter chip (keep as visual badge); drop due-window filter (sort covers it). Overlap rule: one mechanism per axis. See §11.
- **Action-feedback loop (Residual 6 settlement)**. Two categories: (A) pure server actions follow a standard loop (`LibraryService.doAction` → sequential writes (entity + log + task close) + standardized response → UI replaces rows from response; toast / inline / no `alert()`); (B) external-app triggers split three ways by audit-worthiness: B1 log-then-launch (customer-touching, existing ManagerContactView modal), B2 launch + task-close audit (editing in Drive / Canva / WP), B3 just-launch (read-only navigation). Patterns combine within a pack. See §11.

Added 2026-05-21:

- **Task attachment unified via virtual entity types.** SysTasks gets two new columns appended (`entity_type`, `entity_id`) — one polymorphic shape for all tasks from day one. Library entity types (blog/email/news/mention/social/template/image) point at library table rows; virtual entity types (customer/order/project) point at their existing source sheets (SysContacts/SysOrders/SysProjects). No CRM rewrite forced, no Frankenstein attachment patterns. Existing typed FK columns retire in a later cleanup pass once writers are updated. See §7.
- **Activity log actors include `customer` and `system`.** Customer for order-placed / form-submission events surfacing into entity history; system for cron-fired or automatic events with no human or named-service actor. Mailchimp engagement telemetry stays out of the activity log. See §8.
- **Peer-language coupling: lock-time prompt, not hard version alignment.** Replaces the 2026-05-20 force-alignment rule. At lock, editor is asked if peer needs editing; yes → realignment task on peer, no → recorded in activity log. Outreach/publish blocks on open realignment tasks, not on version mismatch. Applies to all sibling-language entity types. See §14.
- **No historical template body preserved.** Per §5 "one slug, one current version," the library overwrites old template text on version bump. Reconstruction relies on Mailchimp sent-campaigns for Mailchimp-delivered outreach; no archive for GAS direct-SMTP sends. Accepted limit at current scale. See §14.
- **Folder placement owned by the library service.** Single GAS function maps `(type, concept, slug, language)` to the canonical Drive path. Both the HTTP register-on-create endpoint and the "Add new entity" UI route go through it. Behaviors: auto-create concept folder; place new files at canonical path; reject silent overwrite (force "new version" path). Manager's entry point for ad-hoc entity creation is the library screen's "Add new entity" action, NOT direct Drive file creation. Fallback for existing files: form accepts a pasted Drive URL; system moves the file to canonical location via `file.moveTo()` (file ID stable, URL preserved) and renames to match slug if needed. See §5 "Folder placement and library-screen entity creation."
- **Task lifecycle dates inherited from existing SysTasks schema.** Library plan reuses `st_CreatedDate` (always set), `st_StartDate` / `st_DueDate` (nullable until Assigned, calculated from `due_pattern`), `st_DoneDate`. Both modes work: templates with default relative due dates (`one_week` etc.) for "assign all tasks at chain spawn with staggered dates," OR date-less tasks (`due_pattern='manual'`, `initial_status='New'`) for "spawn and let admin assign calendar timing later." See `jlmops/plans/DATA_MODEL.md` SysTasks section; §7 cross-reference.
- **Chain spawn for blog: all tasks Assigned at spawn with staggered dates; no auto-trigger on edit close.** `task.content.edit_en` and `task.content.translate_he` both spawn at chain-spawn time, both Assigned, due dates staggered (edit due first, translate due a few days later). HE entity stub exists at chain-spawn so the translate task has a primary entity to attach to. Closing the edit task fires no workflow side effect — the staggered due dates carry the natural sequencing. Replaces the 2026-05-20 "carved-out workflow creates HE entity + DOC + Translate auto-draft on edit close" model. See §9 and §10.
- **translate_he task pack design.** "Open EN source" button (resolves EN sibling's `doc_url` from `references[]`) + "Open HE target" button (the pre-created blank HE doc, or a "Create HE doc" button if not yet created — calls library service to place blank doc at canonical Drive path per §5). Manager iterates with Gemini outside the system (side panel inside EN doc, or gemini.google.com in another tab); system doesn't orchestrate the iteration. Manager pastes final HE into the HE doc, polishes, closes task. See §11.
- **Register-on-create endpoint design banked.** Auth via shared-secret in `.wp-credentials` sibling (HTTP path) or Google OAuth (UI path). Payload `{ slug, type, language, file_path_or_url, references?, task_id? }`. Idempotent on duplicate slug (returns existing row with `deduplicated: true`). Validation: slug/type/language/file/references all checked up front, structured errors. Response includes the created or deduped row. Side effects: activity log row written, reverse-index updates, file move to canonical Drive folder if needed. Scope: no state transitions, no HTTP file content upload, no content edits — all those are separate library-service methods. See §4 "Register-on-create endpoint — design surface."
- **Workflow ops creates entity rows + tasks; file creation by ops is a single carve-out (HE Drive DOC for blog translation).** All other artifacts created externally (Claude / Canva / Mailchimp) and registered via the register-on-create endpoint. New ops-creates-file cases require explicit per-case justification. See §9.
- **`references[]` holds necessary structural connections only.** Casual relatedness (shared topic, shared audience) lives in `taxonomy[]` or is computed at query time. Test: would the entity be incomplete or orphaned if the link were removed? See §6.
- **Library file is the read surface; no general-purpose export pipe.** Library lives as a single flat sheet (Drive MCP single-tab compatible), read directly by Claude, written by GAS via the library service. Earlier draft imagined "for-claude/" exports of multi-tab data — out of scope. Periodic reporting exports (KPI roll-ups, trend snapshots) remain a future provision only, not foundational. See §4 read-around pattern + §5 folder structure + §17 phase 3.
- **Library physical layout: one flat single-tab sheet, sparse per-type columns.** ~30-40 columns once all entity types are in (most null on any given row). Sheets handles that without issue. Closes the §19 open question on layout. Implication: polymorphic queries are natural; per-type queries filter on `content_type`. Activity log + task table remain separate tabs (separate concerns, different access patterns).
- **Atomic-language softened.** Earlier wording in §4 / §9 / §11 implied transactional rollback across Sheets + Drive + Translate calls. GAS doesn't provide that. Replaced with "sequential writes inside one workflow call; each step logs to SysLog; partial-failure recovery is manual." At current scale this is rare and acceptable.
- **Lookup-add UI demoted from library prerequisite to independent operational need.** §13 cross-linking is future work, so scaled tagging via controlled vocabulary isn't blocked. Library work no longer gated by this UI. Phase 1 scope narrowed to Grapes + Kashrut; Texts deferred to phase 2; cities skipped; wineries out of scope (WP product attribute). Plan: `jlmops/plans/LOOKUP_ADMIN_UI_PLAN.md`. See §16, §17 phase 1.

---

## 19. Open questions

Closed 2026-05-18:

- ~~File format choice settled (MD + DOC parallel); sync cycle.~~ Closed: MD stays local in git, DOC in Drive; sync on lock + Evyatar-edit milestones (see §5).
- ~~Claude-readable exports folder naming.~~ Superseded 2026-05-21: no general-purpose export pipe planned. Library file is the read surface (§4). Future `reports/` folder reserved for precomputed periodic reporting only.
- ~~Active version vs latest locked for templates.~~ Closed: latest-locked-is-active; A/B testing pointer deferred.

Closed 2026-05-20, revised 2026-05-21:

- ~~Cross-language template mismatch in outreach: welcome EN locked at v2 but HE still at v1 — when trigger fires for HE customer, use HE v1, block task, or escalate?~~ Closed 2026-05-21: **lock-time peer-realignment prompt** (§14). Editor is asked at lock whether the peer needs editing; "yes" spawns realignment task; "no" is recorded in activity log. Outreach blocks if an open peer-realignment task exists, not on version-number mismatch. Replaces the 2026-05-20 "force version alignment" rule (retracted in §18) — that rule would have forced useless re-locks when the edit IS the realignment.

Closed 2026-05-21:

- ~~Where exactly the library lives in `JLMops_Data` workbook (one sheet vs one tab per type).~~ Closed: **one flat single-tab sheet** (Drive MCP single-tab constraint + simplest shared read/write surface). Sparse per-type columns coexist on one table (~30-40 columns once all types are in). One unified table, polymorphic queries natural.
- ~~General-purpose export pipe for Claude session access.~~ Closed: not planned. Library file is the read surface; periodic reporting exports are a future provision only.
- ~~Bidirectional Drive interaction later? Claude wanting to *write* something for ops to react to.~~ Closed 2026-05-21 walkthrough: no third write channel needed. Register-on-create endpoint and library service writes cover everything Claude needs. Claude does not drop files in Drive locations for ops to poll.
- ~~For multi-language content, when admin pushes to WP and EN/HE versions don't match: hard block or just warn?~~ Closed 2026-05-21 walkthrough: stale listing. §14 already settled this — lock-time peer-realignment prompt replaces version alignment. Outreach/publish blocks on an open peer-realignment task, not on version mismatch. Legitimate single-language edits pass through.
- ~~Template retirement lifecycle — deprecated → archived → ?~~ Deferred 2026-05-21 walkthrough: few templates exist, none retired yet. Not worth designing until a real retirement happens. Re-open if/when.
- ~~KPI refresh cadence + ownership — who runs the Mailchimp pull, how often, what triggers an out-of-cadence refresh.~~ Closed 2026-05-21 walkthrough: out of scope for the library plan. The library plan only establishes that stats live as columns on entity rows (§21); refresh mechanism is a jlmops housekeeping concern with its own future plan when KPI ingest is built.

Still open:

(None — §19 cleared 2026-05-21.)

---

## 20. Slug + naming conventions

The slug is the canonical join key. Same string identifies the entity in the library, titles the design in Canva, names the campaign in Mailchimp, names the folder/file in Drive, lives in jlmops sheet ID columns, and (where it matches) suggests the WP post slug. The library row is the join.

### Pattern

`<type>-<topic-or-series>-<discriminator>[-<language>]`

Hyphens everywhere. No underscores. Lowercase kebab-case.

### Segments

- **Type** — first because it's stable (an `image` doesn't become a `blog`) and because slugs frequently appear outside folder context (Mailchimp campaign lists, jlmops rows, activity logs) where the type prefix tells you what you're looking at instantly. Short single words per the vocabulary in §6.
- **Topic-or-series** — blog topic when there is one (`context`, `acidity`); series name when the entity belongs to a recurring stream without a single blog topic (`newsletter`, `special-value`, `welcome`, `social`).
- **Discriminator** — only when needed for uniqueness:
  - **Index** for ordered sub-items inside a parent topic: `image-context-body-01`, with optional readability suffix `image-context-body-01-season-clock`. The suffix is help-text, doesn't affect semantics.
  - **Date as YYMM** for recurring dated instances: `news-2606`, `email-special-value-2606`. YYMMDD if multiple ship in the same month.
  - **Channel** for templates (only type with a channel axis): `template-welcome-email`, `template-welcome-whatsapp`.
- **Language suffix** (`-en` / `-he`) — appended when the type splits by language (see §6). Always last segment.

### Worked examples

- `blog-context-en` / `blog-context-he` — text artifact, sibling pair
- `image-context-featured` — featured image (no language axis)
- `image-context-body-01-season-clock` — body image, indexed with readability suffix
- `image-context-body-01-en` / `-he` — same image directional (rare case)
- `news-2606-en` / `news-2606-he` — June 2026 print issue, EN front + HE back
- `mention-2606-context-en` / `-he` — primary mention in June issue referencing Context post
- `mention-2606-dyk-free-pickup-en` / `-he` — secondary mention, DYK content
- `email-special-value-2606-en` / `-he` — recurring email series, June 2026 instance
- `email-2606-context-launch-en` / `-he` — one-off email tied to a launch event
- `social-2605-context-launch-ig-en` / `-he` — IG post promoting Context launch
- `template-welcome-email-en` / `-he` — welcome email channel-language combo
- `template-welcome-whatsapp-en` / `-he` — welcome whatsapp channel-language combo

### Cross-system mapping

- **Canva design title** = slug
- **Canva folder** = `Topics/<Topic>/` (existing structure, slugs land inside; non-topic entities like `news-*` may want their own series folder)
- **Mailchimp campaign name** = slug
- **Drive file** (where Drive holds a file) = `<slug>.<ext>` inside the concept folder
- **jlmops library sheet row** keyed on slug
- **WP post slug** = derived from title, can match library slug but doesn't have to (URL-friendly slugify of post title is WP's domain)

### Rules

- Slug is immutable once assigned. Renaming = retire + create new (rare).
- Slug is globally unique across the library (the type prefix carries most of that uniqueness; topic + discriminator handle the rest).
- Type and channel vocabulary live in a controlled-vocabulary table (the type names from §6, the channel names from §14). Adding a new type or channel is a deliberate act.

---

## 21. KPI ingest pattern

Campaigns (the §11 Campaigns filter spans `email`, `news`, `mention`, `social`) carry KPI stats as columns on the entity row, refreshed on cadence by ops. The library becomes a lightweight analytics surface alongside its authoring role — same substrate, different lens.

### Shape

- Library entity row carries **stable IDs** (`mailchimp_campaign_id` for `email`, coupon code + UTM for `news` / `mention` / `social`) plus meta (subject, send_date, audience).
- **Stats columns** populated by ops on a cadence (daily probably enough; out-of-cadence refresh on admin demand):
  - For `email`: `open_rate`, `click_rate`, `bounce_rate`, `unsubscribe_count`, `attributed_orders`, `attributed_revenue`
  - For `social`: `impressions`, `engagement_count`, `click_throughs`, `attributed_orders`, `attributed_revenue`
  - For `news` / `mention`: `print_quantity`, `coupon_redemptions`, `qr_scans` (when QR analytics exist), `attributed_orders`, `attributed_revenue`
- Stats columns are derived; if missing or stale, the refresh job repopulates. Not authored.

### Refresh sources by type

- `email` → Mailchimp API (via jlmops UrlFetchApp or the Mailchimp MCP) for opens/clicks/bounces. Attribution from jlmops orders sheet via `wom_CampaignId` linkage (already shipped 2026-05-11 Campaign Architecture).
- `social` → platform API where available (FB Graph, IG); manual entry where not.
- `news` / `mention` → jlmops orders sheet for coupon redemptions + attribution; QR scan count from RankMath or a future analytics shim when QR scan-tracking exists.

### Where stats DON'T live in the library

- Live click-stream data (GA4 sessions, scroll depth, on-page time, demographic breakdowns) stays in GA4. Detail view can deep-link to a GA4 segment URL when relevant. Library indexes outward, doesn't duplicate.
- Per-customer engagement events (who opened the email, who clicked) stay in Mailchimp. Activity log records the send fact + template version; per-recipient telemetry isn't pulled into the library.

### Cross-cutting queries (consequence)

- "Total attributed revenue from emails referencing the Selection post" = sum `attributed_revenue` across `email-*` entities whose `references[]` includes `blog-selection-en` or `blog-selection-he`. Library query, single substrate.
- "Average open rate this month for special-value series" = aggregation across `email-special-value-*` entities. Library query.
- "Best-performing mention by attributed revenue" = sort `mention-*` entities by `attributed_revenue`.

### Open operational details

See §19 — refresh cadence, ownership, manual-refresh-button placement.
