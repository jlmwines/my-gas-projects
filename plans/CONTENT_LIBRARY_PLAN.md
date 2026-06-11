# Content Library Plan

**Status:** PARTIAL IMPLEMENTATION — phases 2-4 + phase 5 steps 1/2/3/6 shipped (see §17 for current state per phase). Phase 7 scope locked and verified 2026-05-26 against actual code (the chain-spawn surface is the existing `WebAppProjects_createContentStream` extended, not a new `LibraryService.spawnChain`); 2-session split 7a/7b enumerated end-of-§17-phase-7. Originated 2026-05-17 with major rewrite after realizing the original plan repeated the Frankenstein pattern.

**Editing discipline:** decisions merge into topical sections at bank-time. Do not append "Added YYYY-MM-DD" blocks to §18; revise the relevant topical section instead. §18 holds only foundational principles.

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

### Write paths — UI via library service; session direct to Sheets API

Added 2026-05-20, revised 2026-05-25 (HTTP-to-GAS endpoint dropped; session writes directly to the workbook).

Two write channels, each appropriate to its caller:

- **UI writes go through the library service** (server-side in GAS, `LibraryService.*` via `google.script.run`). The "Add new entity" form, lock / publish / close actions, chain-spawn — all call into the service. Service validates, writes the entity row, writes the activity log row, fires any downstream workflow. Activity log records `actor='admin'` (or the active user).
- **Session-time registration writes directly to the JLMops_Library workbook via Sheets API.** Claude's local node script (sibling to `push-posts.js`) authenticates with local Google credentials, appends the entity row to `SysLibrary` only. No GAS involvement; ops adds nothing on the registration write because the session has every value the row needs.
- **Session cannot write to `SysLibraryActivity`.** That tab lives inside `JLMops_Data` (multi-tab, Drive-MCP-blind, ops-only territory per §18 workbook placement). Activity log entries are written exclusively by ops via `LibraryService` on state transitions (lock / publish / close / reference changes). Registration itself does not produce an activity-log entry; the row's existence + `slb_CreatedDate` + `slb_CreatedBy` is the registration audit.
- **State transitions (lock / publish / close) only happen via UI** through the library service. The session never transitions an entity's state, only creates new entities. Keeps the harder consistency questions (downstream workflow fires, reference-graph integrity at state change, activity log writes) on one writer.
- **No general-purpose API for Claude.** Browsing, reading state, inspecting status: read the library file directly via Drive MCP. Library file is the scope; no parallel export pipe (see "Read-around pattern" above).

Two writers each validates its own inputs (slug format, type vocabulary, language, references resolvable). Slug uniqueness enforced by read-before-write on both sides. At current registration volume (1-2 entities/week) the duplication risk between validation implementations is acceptable; the earlier 2026-05-20 "library service is the single state writer" framing was overdesigned for the workload.

### Session registration script — design surface (revised 2026-05-25)

The local node script Claude invokes from a session, sibling to `push-posts.js`. Writes directly to the `JLMops_Library` workbook via Sheets API; uploads file artifacts to Drive via Drive API where needed. Does NOT touch `JLMops_Data` (multi-tab, ops-only).

**Auth.** Service-account JSON at project root (`.gcp-credentials.json`), sibling-file pattern matching `.wp-credentials` for `push-posts.js`. Service-account email must be shared as Editor on `JLMops_Library` (and on the library Drive folder when file moves are needed in later phases). Picked over ADC (`gcloud auth application-default login`) because the script is a recurring local writer to a known sheet — bot identity matches the use case better than personal credentials, no CLI install dependency, no token-staleness drift, scope is explicit (only sheets shared with the SA). Committed 2026-05-25 during phase 4 implementation.

**Inputs.** CLI args (manifest-driven shape similar to `push-posts.js` is fine for recurring registrations like blog posts): `slug`, `type`, `language`, `file_path_or_url`, optional `references[]`.

**Validation (client-side, in the script; reject early with structured error).**
- Slug format: kebab-case + type prefix matches the controlled vocabulary (§20).
- Type: in the controlled vocabulary.
- Language: `en` / `he` / `null` (null only for bundled-language types like image-default).
- File ref: valid Drive URL OR valid git repo path OR null.
- References: every `entity_id` resolves (read-before-write against `SysLibrary`).

**Idempotency.** Read `SysLibrary` by slug first; if found, return the existing row with `deduplicated: true`, do not append. Otherwise append. Slug uniqueness is the read-before-write contract.

**Side effects on success.**
- Append entity row to `SysLibrary` (`JLMops_Library` workbook).
- File placement: if `file_path_or_url` is a local path, upload via Drive API and place at canonical Drive folder per §5 (auto-create concept folder if missing; reject silent overwrite). If a Drive URL, optionally move to canonical path if not already there (Drive file ID stable; URL preserved).
- **No activity log entry.** `SysLibraryActivity` lives in `JLMops_Data` (multi-tab, ops-only); session has no write access there by design. Registration is audited via `slb_CreatedDate` + `slb_CreatedBy` on the row itself.

**Scope (what it doesn't do).**
- No state transitions (lock / publish / close are UI-only via the library service).
- No file content edits.
- No activity log writes (ops territory).
- No reverse-index maintenance (computed at query time per §6, not stored).
- Registration is one-time per entity. Further changes go through the UI / library service.

**Why direct Sheets API and not an HTTP-to-GAS endpoint** (the earlier 2026-05-21 design, retracted 2026-05-25). The session has every value the entity row needs; ops can't validate or enrich any of it. The HTTP path added auth (shared secret), deployment surface (anonymous-access deployment), and a GAS code path with no purpose beyond write-through. Direct Sheets API removes all of it: same script-sibling-to-`push-posts.js` shape, simpler write target. Activity-log writes stay on the ops side where they always belonged (multi-tab JLMops_Data, ops-only).

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

- **Two write paths, two lifecycle moments.** `addEntity` (UI via `LibraryService`) creates pre-work stubs — defaults to `state='draft', version=0`. First `lockVersion` bumps to `state='locked', version=1`; subsequent re-locks increment by 1 (version increments are always lock events). `content/register-library.js` (session script) registers artifacts that already exist — typically already published — so the caller passes the actual state (e.g. `'published'`) and the script defaults `version=1`. The two writers don't share defaults because they serve different lifecycle moments: UI seeds future work; script catalogues completed work.
- Library row tracks: slug → current file URL(s) + current version number.
- New version replaces the file at the same slug under the same folder. Old version overwritten; no library-side version cascade.
- Edits between version bumps (Canva re-rolls, mid-task Claude iterations, ad-hoc tweaks) are invisible to the library and live in external systems (Drive history ~30 days for DOC, git history for MD, Canva's own history for designs).
- Activity log entries on a file-bearing entity are only at meaningful milestones: version locks (task close), reference graph changes (added / removed), state transitions (locked / published). Mid-version edits are not logged.
- Reconstruction of "exactly what was published with v3" is via the publish-event timestamp + external system history. Good enough at current scale.

### Folder placement and library-screen entity creation

Added 2026-05-21. Revised 2026-05-26 §18 (Add-new-entity generic form deferred indefinitely; role inversion: admin initiates, manager executes). The risk to mitigate is any caller creating files in the wrong Drive location and then having to hunt them down or move them after the fact.

**Library service owns canonical-folder lookup.** A single GAS-side function maps `(type, concept, slug, language)` to the canonical Drive path under `/JLMops_Data/Library/`. Every create / move path goes through this function. Callers don't compute paths themselves.

**Admin's entry point is the "Create Content Tasks" modal on LibraryView, not Drive directly.** Library-era reuse of the existing `contentStreamModal` shape (`AdminProjectsView.html:565`) driven by `WebAppProjects_createContentStream` (`WebAppProjects.js:203`) — admin types content name + checks the desired stages from the `CONTENT_STAGES` list, submit creates the SysLibrary row(s) and the selected tasks in one call (see §17 phase 7 for the extension wiring). The chain runs doc-less initially (per 2026-05-26 on-demand doc-creation decision). Admin never starts by creating a Doc in Drive on his own — that path doesn't exist in the discipline.

**On-demand doc creation lives in task packs (manager-facing).** When a manager opens a task whose entity has no doc yet, the pack offers "Create blank Doc" (createBlankDoc places a labeled doc at canonical path, links to entity) or "Attach existing Doc" (attachExistingDoc takes a pasted Drive URL, links it, optionally moves to canonical location). Both routes call the same library-service function; both end with the file at the canonical path and a library row pointing at it.

**Three behaviors the library service handles:**

- **Auto-create concept folder.** If `/JLMops_Data/Library/<type>/<concept>/` doesn't exist for a new topic, the service creates it. Caller doesn't pre-flight folder existence.
- **Place at canonical path.** New files land at `/JLMops_Data/Library/<type>/<concept>/<slug>.<ext>` automatically. Filename derives from slug + extension; the service handles naming.
- **Reject silent overwrite.** If a file already exists at the canonical path for that slug, the create call refuses. Updates use a separate "new version" path that's allowed to overwrite per the version rule above.

**Fallback: attach-an-existing-Drive-file.** When a file is already in Drive (created by hand, or moved from somewhere) and needs to come into the library, the `attachExistingDoc` button in the task pack accepts a pasted Drive URL. On submit:

- Service extracts the file ID from the URL
- Reads the file's current parent folder
- If not at the canonical path, calls `file.moveTo(canonicalFolder)` — Drive file ID is stable, so the URL stays the same and any links already shared keep working
- Renames the file to match `<slug>.<ext>` if the current name doesn't match
- Links the file to the entity row

**Post-implementation Drive-layout verification (backlog — promoted from STATUS Inbox 2026-06-01).** Phase 7 (7a + 7b) and the entity drawer shipped; before considering Drive setup closed, walk the live Drive folder layout once: confirm canonical paths per entity type (`/JLMops_Data/Library/<type>/<concept>/`); verify `createBlankDoc` placement matches this section's rule; exercise `attachExistingDoc` move-to-canonical on a real out-of-place file; confirm the canonical-folder auto-create handles a brand-new type cleanly. Originating concern: bidirectional Drive write + canonical folder placement (§17). Pairs with the phase 6 orphan-integrity report (already implemented). Originated 2026-05-26, unblocked 2026-05-27.

The above describes the UI / library-service routes (the LibraryView "Create Content Tasks" modal + on-demand Create/Attach buttons in task packs). The session registration script (§4 "Session registration script — design surface") is **sheets-only as shipped** — it appends the `SysLibrary` row via Sheets API and writes file pointers (e.g. WP media URL for image entities) into the row, but does **not** upload files to Drive or do canonical-folder placement. Phase 4 critical path made that call because the entities seeded so far (Context EN/HE blog + 5 Context images already in WP) have their files outside Drive. Drive API upload + canonical-folder placement in `register-library.js` is forward-looking; lands when an entity type that lives in Drive (editorial DOC, locked email HTML, newsletter PDF) needs registering by the session path. Until then, all canonical-folder placement happens through `LibraryService.createBlankDoc` / `attachExistingDoc` on the UI side (phase 7b).

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

- `slug` — canonical join key across Canva/Mailchimp/Drive/jlmops AND the key column of `SysLibrary` (see §20). Slug is immutable + globally unique + human-readable, so it serves as both the human handle and the cross-table FK (used in `references[]`, `slba_EntityId`, and `SysTasks.entity_id` for polymorphic attachment). No separate synthetic `id` — slug is the only identifier.
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

The library plan does NOT introduce new task date semantics — it reuses what jlmops already implements. See `jlmops/docs/DATA_MODEL.md` SysTasks section:

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
- `task.content.edit` — attaches to the EN sibling entity (e.g., `blog-context-en`). Language is carried by the entity row (`slb_Language`), not the type name; this naming convention applies to all content task types per LIBRARY_VIEW_PLAN.md Decisions banked 2026-05-25.
- `task.content.translate` — attaches to the HE sibling entity (the HE stub is created at chain spawn so the task always has its primary entity)
- New: `task.content.admin_review` — admin gate between Claude draft and Evyatar edit (see §10)
- New: `task.content.create_wp_stubs` — admin prerequisite before content push (see §10)

### Task taxonomy

- **Evyatar-facing** — review, edit, translate, image-select, approve. Evyatar closes.
- **Admin-facing** — publish, schedule, distribute. Admin closes manually post-session.
- **System** — housekeeping, pending-payment follow-ups, schema validation. ops closes itself.
- Library upgrades each task with attached assets and context (e.g., translate task gets pre-drafted HE attached) — same task list, faster time-to-action.

---

## 8. Activity log model

Per-entity log. Live schema (9 columns, registered as `schema.data.SysLibraryActivity` and shipped @122/@123):

- `slba_ActivityId` — UUID assigned at write
- `slba_EntityType` — polymorphic; matches `slb_ContentType` for library entities or one of `customer` / `order` / `project` for virtual entity types per §7
- `slba_EntityId` — slug for library entities; row id for virtual entities
- `slba_Timestamp` — ISO 8601
- `slba_Actor` — claude / ops / admin / evyatar / customer / system, OR the actual `Session.getActiveUser().getEmail()` when a logged-in user is the actor
  - `customer` = customer-initiated events surfacing into entity history (order placed, contact form submission). Telemetry like opens/clicks stays in Mailchimp per §21 — not logged here.
  - `system` = cron-fired or automatic events with no human or named-service actor (housekeeping run completion, scheduled task firing).
- `slba_ActionType` — state_change / file_lock / version_lock / contact_attempt / publish / send / template_send / etc.
- `slba_Summary` — short human-readable label (e.g. `'Version locked'`)
- `slba_Details` — JSON-stringified type-specific payload
- `slba_ReferencedEntities` — JSON-stringified list of related entity ids (which template, which order, etc.)

Generic shape; same log for any entity. SysContactActivity becomes a filtered view of this log (`slba_EntityType='customer'`).

---

## 9. Workflow model

Workflows are wiring, not a primitive:

- **Trigger:** state change on an entity, or external event (order completion in WP, scheduled time, file change at watched endpoint)
- **Action:** spawn task(s) attached to relevant entity, with appropriate references. **May also create new entity rows** as part of the chain progression (e.g., spawning HE sibling of an EN blog post; spawning an email entity for a distribution chain). See "Chain progression creates entities" below.
- **Completion handler:** when task closes, update entity state, write activity log entry, potentially fire next workflow

Examples:
- Order completion (first for customer) → spawn outreach task on customer entity, reference welcome template
- Blog chain spawn (admin clicks "Create Content Tasks") → creates EN + HE sibling entity rows + spawns selected tasks attached to the appropriate language sibling (per "Revised chain spawn for blog" below). No Drive DOC created at spawn; DOC creation is on-demand via the task pack's "Create blank Doc" button.
- All distribution events for blog post X reach "sent/posted" state → mark blog post entity as `fully_distributed`

### Chain progression creates entities

Added 2026-05-20, narrowed 2026-05-21. Workflows don't just hand off between existing entities — they CREATE new entity rows + tasks as needed. **File creation by ops is a single carved-out case** (HE Drive DOC for blog translation). Everything else lives in external systems and reaches the library through the register-on-create endpoint after the fact.

**Default chain step shape:** create entity row, create task attached to it, link references. All sheet writes. `LibraryService.spawnContentChain` (shipped phase 7a) is the writer for chain spawns — it forks the live `WebAppProjects_createContentStream` (`WebAppProjects.js:203`, which continues to serve `AdminProjectsView`'s `contentStreamModal` unchanged); `LibraryService` is also the writer for state transitions (lock / publish / file attach).

**No ops-side Drive DOC creation.** Earlier draft (2026-05-20) had a "carved-out case" where ops would create the HE Drive DOC + run Google Translate API during chain progression. **Dropped 2026-05-21** — too brittle (Translate API failures mid-workflow) and unnecessary (manager is going to iterate with Gemini in his Drive workspace anyway, the auto-draft step adds nothing).

**Revised chain spawn for blog (2026-05-21; surface clarified 2026-05-26):**

When admin submits the LibraryView "Create Content Tasks" modal for a blog (per §11 chain spawning + §17 phase 7), `LibraryService.spawnContentChain` creates all the rows in one call:

- Two SysLibrary rows: `blog-<topic>-en` and `blog-<topic>-he` (each state `draft`, no `doc_url`, HE row references the EN sibling)
- One task per admin-checked stage, each attached to the appropriate language sibling via `(st_EntityType='blog', st_EntityId=<slug>)`. Task type names are language-neutral (`task.content.edit`, `task.content.translate`) — language lives on the entity row (`slb_Language`), not on the type. Initial statuses + due dates fall out of each task type's existing `flow_pattern` + `due_pattern` in `taskDefinitions.json`.

The HE entity stub exists from spawn time so `task.content.translate` (attached to the HE sibling) has its primary entity. Drive DOC creation happens later when the manager clicks "Create blank Doc" in the task pack (§11).

**No auto-trigger on edit close.** Closing the EN-side edit task doesn't fire any workflow side effect — every task already exists from chain-spawn, all are already on the manager's queue, the per-type `due_pattern` carries the sequencing. He naturally reaches the translation task after finishing the edit.

**Where artifacts actually come from:**

- **Blog MD (EN)** — Claude writes locally, registers via endpoint, file stays in git.
- **Blog HE DOC** — manager creates via "Create blank Doc" button in the translate task pack (button calls library service `createBlankDoc()`, which places the file at the canonical Drive path per §5). Manager translates using Gemini in his Drive workspace (see §11 task pack design) and pastes the result into the DOC.
- **Newsletter PDF** — Claude builds via pandoc locally, uploads to Drive on lock, registers via endpoint.
- **Email HTML** — Claude or admin saves locked HTML, uploads to Drive, registers via endpoint.
- **Editorial images** — Canva generates, local script downloads, uploads to Drive, registers via endpoint.
- **Product images** — WP media library only, no Drive copy.
- **Templates / mentions / social / customer** — no file artifact; the entity row is the whole thing.

If a future need surfaces for ops to create a file as part of chain progression, treat it as a new carve-out (justify per-case), not a general capability.

**Manual attachment escape hatch.** For edge cases where automation doesn't fit (workflow didn't fire, ad-hoc asset, special substitution), the entity drawer and task pack expose an "Add file" action — upload local file → register + upload to Drive (or wherever the file type's home is), OR paste external URL → register URL only. Runs through the library service like everything else.

**Image entity attachment at chain spawn.** When a blog chain spawns, no image entities exist yet (per the on-demand rule). The `task.content.images` task attaches to the **blog entity** as its primary so it has a valid attachment from spawn time. Image entities register separately via `content/register-library.js` as Canva-produced files land; on registration, each image entity's `references[]` points at the parent blog entity. The blog entity's reverse-lookup (per §6) surfaces the image set without storing it inline. The `task.content.images` task itself does not need to be retargeted at the image entities — it's about approving the set for the blog, which is what the blog-entity attachment models.

---

## 10. Workflow walkthrough: blog post end-to-end

### Pre-creation

- Admin decides topic (from `content/PUBLICATION_CALENDAR.md` planning).
- Admin clicks "Create Content Tasks" on LibraryView, types the content name + checks the blog-chain stages (`create_wp_stubs`, `admin_review`, `edit`, `translate`, `images`, `blog_publish`) — see §11 chain spawning + §17 phase 7 for the `LibraryService.spawnContentChain` call. The submit creates `blog-<topic>-en` and `blog-<topic>-he` entity stubs (state `draft`, no docs attached yet per the on-demand rule) and spawns the selected tasks against them. Due dates fall out of each task type's `due_pattern` — no separate stagger config.
- Admin manually creates linked WP stubs (empty EN post + WPML-linked empty HE post). Records both `en_wp_post_id` and `he_wp_post_id` in entity. — `task.content.create_wp_stubs` (admin)

### Draft + admin review (EN)

- Claude creates EN draft (in-session, with admin).
- `task.content.admin_review` (attached to the EN sibling) fires — admin reviews (in-session or queued).
- Admin signoff → triggers Evyatar's edit task.

### Heavy edit by Evyatar (EN)

- `task.content.edit` (attached to the EN sibling via `st_EntityId=blog-<topic>-en`) — Evyatar opens, heavy edit on DOC, closes → EN locks at v1. Task type names are language-neutral; language lives on the entity row (`slb_Language`).

### Translate (HE)

- `task.content.translate` (attached to the HE sibling via `st_EntityId=blog-<topic>-he`) was already spawned with the rest of the chain. Due date computed from its `due_pattern` in `taskDefinitions.json` so it surfaces naturally after the edit.
- Evyatar opens the task pack. If the HE entity has no doc attached yet (per the on-demand rule), the pack offers "Create blank Doc" (`createBlankDoc` places labeled doc at canonical path, links to entity) or "Attach existing Doc" (paste Drive URL). Once attached, "Open EN source" + "Open HE target" buttons open both side by side.
- He works in Gemini (side panel inside the EN doc, or gemini.google.com in another tab), iterates until satisfied, pastes the final HE text into the HE DOC, polishes, saves.
- Closes the task → HE locks at v1.

### Images

- `task.content.images` — Evyatar approves image set, locks.

### Publish (admin in-session)

- Admin starts session with Claude.
- Peer-realignment guard (per §14): publish blocks if an open peer-realignment task exists on the EN+HE family. Bare version-number mismatch without an open task does not block (deliberate-mismatch states are allowed).
- Push to WP via REST through `content/push-posts.js` → updates existing stubs by ID (never creates new). Publishing stays session-side per the publishing-pack boundary in §11; JLMops doesn't push to WP.
- `task.content.blog_publish` is admin-facing. Pack surface in LibraryView is Confirmation-pack variant (notes + Mark Published button); admin closes the task post-session, the close optionally records the WP URL into entity activity log via `logEntityActivity`.

### Distribution children

- Email blast entity created, references this blog post → workflow chain
- Newsletter mention entity queued for next print issue
- Social post entities for each channel
- Each is its own entity with its own state and tasks

### Re-edit

- New task created (e.g., `task.content.edit` on the EN sibling again).
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
- Type-specific extensions per filter (e.g., `blog` adds version columns, `wp_post_id`, derivative count)
- Filter chips: state, language (en / he / language-agnostic), language gap (siblings present?), tag, taxonomy, date range
- Search
- **"Add new entity" generic form — DEFERRED INDEFINITELY 2026-05-26.** Originally framed (2026-05-21) as the manager's primary entry point for new entities. Reframed 2026-05-26 §18: admin (not manager) initiates content; the LibraryView "Create Content Tasks" modal (extended `contentStreamModal` shape — see §17 phase 7) handles planned content; session script handles authoring artifacts; no current ad-hoc-creation use case justifies the generic form. Section retained for the canonical-folder discipline it describes — that discipline still applies via the "Create Content Tasks" modal (which calls `addEntity` + the extended `createContentStream`) and on-demand Create/Attach buttons in task packs (`createBlankDoc` / `attachExistingDoc`). See §5 "Folder placement and library-screen entity creation."

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
- Action buttons in context: **Open in Drive** (when `slb_DocUrl` set; opens in new tab), **Create Content Tasks** (admin-only; opens the same modal as the LibraryView top-level button, pre-filled with the current entity's name; allows adding tasks to an existing entity via slug dedup), **Create HE sibling stub** (admin-only; shown only when current entity is `-en` and HE peer not in cached library; spawns peer via `LibraryService.addEntity`). **Lock + Version is intentionally NOT a drawer action** (settled 2026-05-27 at phase 9d): the drawer-vs-pack boundary stays clean — drawer = inspection, task pack = action; locking always goes through the task it closes, preserving the §18 foundational principle "task closure = version lock". Publish from drawer is also intentionally absent: blog publish stays session-side via `content/push-posts.js`; Mailchimp / social / WhatsApp / video are manual external workflows. Drawer's publish role reduces to inspection plus the §14 peer-realignment guard surfaced as a "publish-ready / blocked" indicator.

**Behavior + presentation (settled 2026-05-27, phase 9 spec):**

- **Layout + mobile.** Centered modal-overlay (max 560px wide, max-height 88vh, internal scroll). Matches the rest of the view's modal precedent — early planning specified a right-side slide-in panel but 9a smoke feedback found that pattern too subtle (list grayed but drawer didn't pull the eye); centered modal corrected 2026-05-27 at @140. Desktop-only for v1; phone takeover deferred until a real mobile drawer use case surfaces.
- **Drawer-to-drawer navigation.** Clicking a reference chip (in or out) opens that referenced entity's drawer. JS state maintains a small back-stack; the drawer toolbar adds a Back button that pops; Close dismisses entirely. No browser-history coupling (GAS iframe context).
- **Attached-task click behavior.** Clicking an attached-tasks list entry closes the drawer + jumps to that task in the LibraryView queue (expand it). Pack opens in its normal locus, not embedded in the drawer — preserves the drawer-vs-pack boundary described below ("Drawer vs. task pack").
- **State history source.** Derived from the activity log filtered to `slba_ActionType IN ('version_lock', 'state_change')`. No separate field on the entity row, no new write path. §8 already specifies these are the meaningful milestones logged.
- **Section ordering + default collapse state**, top to bottom:
  - Files & URLs (open)
  - Attached tasks (open)
  - References out (open if non-empty, else collapsed)
  - References in (collapsed — discovered, not authored)
  - State history (collapsed)
  - Activity log (collapsed — can grow long)

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
  - `task.content.translate` (worked example, 2026-05-21; attached to the HE sibling — language lives on the entity row): "Open EN source" button (resolves the EN sibling's `slb_DocUrl` via the slug-pair pattern `<en-slug>` → `<he-slug>` per §6 and opens in a new tab) + "Open HE target" button (the on-demand-created blank HE doc, or a "Create blank Doc" button if the doc hasn't been created yet — clicking calls library service `createBlankDoc()` and lands the file at the canonical Drive path per §5) + optional "Copy EN content to clipboard" + standard notes/close. Manager iterates with Gemini outside the system (side panel inside the EN doc, or gemini.google.com in another tab — system doesn't orchestrate the iteration), pastes the final HE into the HE doc, polishes, closes the task → HE locks at v1.
  - `task.content.blog_publish`: notes textarea + "Mark Published" button (Confirmation-pack variant). Optionally records channel + external URL into entity activity log via `logEntityActivity`. No publishing action method in LibraryService — blog publish stays session-side via `content/push-posts.js`. Same shape applies to `task.content.email`, `task.content.social`, `task.content.whatsapp`, `task.content.video_publish` (all manual external workflows).
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

**Refinement — task administration + creation locus (2026-06-01, chavruta).** Two corrections to the convergence above, after auditing what actually shipped:

1. **Task administration didn't port to the library era.** `AdminProjectsView` is a real task-admin surface — editable Due / Priority / Assignee / Status, a sortable/filterable multi-state table, and a new-task form. `LibraryView`'s Tasks tab can only edit **notes** (`WebAppTasks_updateTask` is called solely with `{notes}`); its packs are *do-the-work* surfaces, not *manage-the-record* surfaces. The unified Tasks surface must absorb AdminProjectsView's administration affordances (editable fields + the table), not just its action packs — this is the missing half of the convergence, and the reason the admin still reaches for the old view.

2. **Creation is not library-rooted.** Spawning a content chain creates an entity *and* its tasks; the entity is an input you pick (existing or new) and an output of the action — neither makes the library the necessary home of "create." The current `LibraryView` toolbar "Create Content Tasks" sits there by inheritance (forked from AdminProjectsView's `contentStreamModal`) and co-location convenience, not necessity. Canonical model: **creation is a task-surface operation; the entity is a field on it; the library is the entity catalog.** The drawer keeps an "add tasks to this entity" shortcut as a contextual convenience (you're standing on the entity), but nothing has to *start* in the library.

Net: one Tasks surface owns create + do + manage; library = entity catalog (browse / inspect / reconcile). **Chosen design (2026-06-01): a Master-Detail Task Workbench — a NEW `AdminTasksView` that lifts AdminProjectsView's proven components (multi-state table + handlers, MANAGE form + per-type lock matrix) and folds LibraryView's `packBody()` into the detail pane as a DO region, bound to the normalized `_getQueueTasks` feed. Full spec, locked decisions, and sequenced steps in `jlmops/plans/ADMIN_TASK_UI_PLAN.md`.** Nav stays additive: Library kept, Tasks = the new workbench, Projects (AdminProjectsView) demoted to the bottom as a soak-period fallback (retired once proven). Project is a library entity + a filter chip, not a container view.

Two points banked from the 2026-06-01 review:

1. **Build-new, not in-place surgery.** Because Projects is preserved as the live fallback, AdminProjectsView cannot be gutted — the Tasks view is a *fresh* file that *lifts* its proven widgets verbatim and *omits* (never imports) the project/campaign/`generateOutputs`/mode-split machinery. Omission can't leave dead coupling; stripping can. AdminProjectsView is copied from, never modified.
2. **Scope is smaller than it first looked.** A pre-implementation code audit found most of the supposed "build" already exists: the normalized `_getQueueTasks` feed (complete shape incl. `packForm`), full-field `WebAppTasks_updateTask`, the `st_ProjectId` filter (`getFilteredTasks`), and the entity→task task-id payload. **No SysConfig JSON edits.** Net effort is a medium, front-end-heavy refactor (~3–4 incremental sessions), additive and reversible (fallback preserved), low architectural risk — dominant cost is careful UI assembly + per-pack verification, not new capability. Genuinely new work: extract `packBody()` into a shared include, assemble the new view, and wire the drawer-row `onclick`. (Free-form/projectless tasks were declined 2026-06-01 — tasks always require a project/scope, so no `createTask` change.)

### Mobile

- **Queue is responsive** — list view (skeleton row) works on phone. List → tap → focused action view, not list → expand-in-place (which doesn't scale to mobile).
- **Per-pack action views** declare mobile or desktop-only. Packs with a real mobile use case (`task.contact.outreach` → `ManagerContactView` already shipped 2026-05-14) get a mobile-shaped action view. Packs that don't get desktop-only with "open on desktop to complete" placeholder on narrow screens.
- **Shared widgets are responsive once.** Foundation cost paid in refactor; per-pack cost paid when a real mobile case appears.

Refactor, not rewrite. Bones are right; the type-pack pattern needs formalizing; admin's project-centric path collapses into the unified queue.

### Project entity + chain spawning

Per the foundational principle "Projects survive only for cross-entity work" — what that looks like in the UI:

- **Project becomes a library entity type.** Same shape as blog / email / news — slug, title, notes, state, references[], activity log, attached tasks. Just another entity, not a special container.
- **AdminProjectsView narrows to**: (1) a drawer for project entities, (2) a filter view on the unified task queue. Not a separate task management surface. Collapse happens in a later phase per §17; AdminProjectsView stays untouched in the meantime and keeps firing today's content streams via its "Create Content Tasks" modal (`contentStreamModal` at `AdminProjectsView.html:565` → `WebAppProjects_createContentStream`).
- **Cross-entity coordination uses references**, not containment. A campaign project entity has `references[]` pointing at the email, newsletter mention, and social post entities under that campaign. Each child entity has its own life and tasks; the project entity coordinates.
- **Tasks attach where the work lives**: about the email → email entity; about the project as a whole → project entity. Tasks attach to one primary entity, reference others as context.

**Chain spawning extends today's content-stream surface.** Live precedent: `WebAppProjects_createContentStream` (`WebAppProjects.js:203`) loops over admin-selected stages and calls `TaskService.createTask` per stage, linking them via `st_SessionId = streamCode`. Stage list is the hardcoded `CONTENT_STAGES` array (`WebAppProjects.js:168`): currently 11 content stages (draft / edit / translate / translate_edit / images / blog_publish / video_create / video_publish / email / social / whatsapp). UI is `contentStreamModal` (`AdminProjectsView.html:565`) — admin types content name + optional stream ID, checks which stages, submit → `WebAppProjects_createContentStream({ projectId, contentName, stages, streamId })`. This **is** the chain-spawn surface; phase 7 extends it, doesn't reinvent.

Confirmed via grep 2026-05-26: the 16 distribution templates (`task.newsletter.*`, `task.flyer.*`, `task.campaign.*`) added 2026-05-11 are **schema-only — no live spawner**. They get a spawner in phase 11 (distribution events). Earlier plan wording ("`MarketingCampaignService.generateOutputs` retargets to spawnChain") misidentified the surface — `generateOutputs` builds utm-tagged URL + short URL + QR image, not tasks.

Library-era extensions (all in phase 7):

- **Two new content stages added to `CONTENT_STAGES`**: `task.content.create_wp_stubs` + `task.content.admin_review` (with matching `taskDefinitions.json` rows). Blog chain admin checks the desired stages from the existing modal; existing draft / edit / translate / images / blog_publish stay as-is.
- **`LibraryService.spawnContentChain` forks from `createContentStream`** (shipped phase 7a) — chosen over in-place extension so existing `WebAppProjects_createContentStream` keeps serving `AdminProjectsView` unchanged through soak. The fork (a) accepts `entityType` + derives `baseSlug` from `contentName`, (b) calls `LibraryService.addEntity` to write the SysLibrary row(s) for the entity, (c) passes `entityType` + `entityId` through to `TaskService.createTask` via `options.entityType` + `options.entityId` (same pattern as existing `options.projectId`, see `TaskService.js:209-212`).
- **No new `chains.json`, no `chain_id` field on task definitions, no `LibraryService.spawnChain` method, no `stagger_days` config, no `idempotency_key_pattern` config.** Per-task `due_pattern` (already on every task definition row) handles spacing. `TaskService.createTask` already de-dupes by `(taskTypeId, linkedEntityId, status≠Done/Closed)` (`TaskService.js:166-178`) — that's the idempotency guard.
- **Admin (not manager) initiates.** Admin is the chain-spawn surface; manager works the queue. Library era retains this role split: LibraryView's spawn affordances are admin-only, gated via `data-roles="admin"` per the AppView body-class CSS pattern (see `jlmops/plans/LIBRARY_VIEW_PLAN.md` Role gating section). The modal copies the `contentStreamModal` shape; AdminProjectsView's copy stays live during soak.
- **Document creation is on-demand, not eager.** Chain spawn creates entity stub + tasks, leaves Drive Doc unattached. When manager opens the relevant task and the entity has no doc, the pack offers "Create blank Doc" (`createBlankDoc` places labeled doc at canonical Drive path, links to entity) or "Attach existing Doc" (`attachExistingDoc` takes pasted Drive URL, links it, optionally moves to canonical location). Image tasks are the cleanest illustration: chain spawns the image task at the same time as the others; the actual image arrives later in Canva; the entity registers when the file is delivered.
- **Spawned tasks are independent.** The chain is a one-time generator. Once spawned, admin can edit, skip, close ahead, reassign, add new ones, or delete. The stage list doesn't constrain after creation.
- **Ad-hoc task creation** (today's `task.project.custom`) stays as the "Create task" action available on any entity drawer.

What this preserves from today: the working content-stream modal, the stage-selection UX admin already knows, `TaskService.createTask` dedup, per-task `due_pattern` spacing. What it gains: library entity creation in the same call, polymorphic entity columns set at spawn, library-era home for the surface.

### Publishing calendar boundary

`content/PUBLICATION_CALENDAR.md` is the source of truth for what ships when, maintained as markdown at session end. Admin reads the calendar, decides "now's the time," manually initiates chains once or twice a month via the LibraryView "Create Content Tasks" modal. Cross-entity coordination (blog feeds newsletter slot feeds companion email) is modeled via `references[]` on entity rows per §6 — that's the long-term integration path. A JLMops calendar view is deferred indefinitely; markdown is working fine at current volume. `slb_PublishDate` field on entity rows is a small forward-looking add (currently absent from §6 schema), not on the near horizon.

---

## 12. Data model summary

**Library physical layout (settled 2026-05-21):** one flat single-tab Google Sheet (`SysLibrary` in the separate `JLMops_Library` workbook per §17 workbook placement). Sparse per-type columns coexist on the one table — roughly 30-40 columns once all entity types are in, most null on any given row. Sheets handles that without issue; polymorphic queries are natural; per-type queries filter on `content_type`.

- Generic columns (§6) on every row
- Per-type extension columns (sparse — only populated for relevant type)
- Activity log lives in a separate tab (`SysLibraryActivity` inside `JLMops_Data`, ops-only access per §8 + §17 workbook placement)
- Task table reuses the existing `SysTasks` schema, with polymorphic `st_EntityType` + `st_EntityId` columns appended @124 (per §7)
- Reference graph stored inline on each entity as `references[]`; reverse-lookups computed at query time, not stored

**No general-purpose export pipe.** Earlier draft imagined "single-tab variants emitted by ops on cadence" so Claude could read multi-tab data. Out of scope per §4 read-around pattern: the library file itself is what Claude reads via Drive MCP; ad-hoc fetches cover anything else. A future `reports/` folder for precomputed periodic KPI roll-ups is a future provision only, not foundational.

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
- **Feature flag** `library.enabled` in SysConfig (default `true` since 2026-05-26, after phase 5 steps 1/2/3/6 went live). Library service methods short-circuit when off; nav hides the library view. **Retirement:** flag deleted (config + all `if (libraryEnabled)` short-circuits) after phase 11 ships (distribution events live, June 2026 issue registered end-to-end, no rollback path needed). Removal is a single cleanup commit; not gated by phases 12-15.

**Build discipline across phases**

- Phases 2–3, 5–7 are **additive** (new GAS files, new view file, new schema entries, empty Drive folder skeleton). The new SysLibrary workbook and the SysLibraryActivity tab are both additive — removable / ignorable without touching live code paths.
- Phase 5 (task UI build) is **a parallel new view living alongside the existing dashboards, not a replacement** (corrected 2026-05-26 after a route-flip ship-and-revert: `@127` flipped manager Dashboard → LibraryView when `library.enabled=true`; user clarified intent — Library has always been meant as an *additional* nav entry, same as admin, with `ManagerDashboardView_v2` + `AdminDashboardView_v2` continuing as the daily-use dashboards). New file `LibraryView.html` (single file, role-conditional for manager + admin) lives alongside both v2 dashboards; current daily-use code is untouched and the navigation experience for existing users is unchanged. LibraryView reaches via its own "Library" nav entry (gated by `library.enabled`) for both admin and manager. No promotion-time nav-route swap. Plan doc: `jlmops/plans/LIBRARY_VIEW_PLAN.md`.
- SysTasks polymorphic columns (`entity_type`, `entity_id`) — **append only**, leave existing typed FK columns alive (per `feedback_schema_append_only`); retire FKs in a later cleanup pass, not phase 1.
- Deploy one phase at a time: bump VERSION → `clasp push` → `deploy.ps1` to prod with explicit OK at each change-point. Bundled deploys defeat both `git revert` and the deploy-ID pin.

### Phases

1. **Lookup-add UI** — independent operational need, not a library prerequisite (per 2026-05-21 walkthrough; §13 cross-linking is future work). Does not block library work. Plan: `jlmops/plans/LOOKUP_ADMIN_UI_PLAN.md`.
2. **Library schema** designed and seeded. Even if empty, lock down columns.
3. **Confirm Drive MCP read access to the library file.** One-time check that Claude can read entity rows directly from the live library sheet via Drive MCP. No separate export pipe to build (scope narrowed 2026-05-21 — library file is the read surface).
4. **First entity types: `blog` + `image`** (reordered 2026-05-25 — was phase 5; now ahead of UI so the UI can be built against real data instead of empty scaffolding; task-UI refactor in new phase 5 remains independent of library data either way). Create new posts as library entities (sibling-language pair per post) with their image entities (featured + body); existing posts remain in current pattern. Concrete sub-steps for the next session:
   - **Local node script** (sibling to `push-posts.js`) — writes directly to `SysLibrary` in `JLMops_Library` via Sheets API; uploads file artifacts to canonical Drive folder via Drive API where needed. Does NOT write to `JLMops_Data` (multi-tab, ops-only). Auth via local Google credentials (`gcloud auth application-default login` or service account JSON sibling file). Client-side validation per §20 slug pattern + controlled type/language vocabulary; read-before-write against `SysLibrary` for slug uniqueness. See §4 "Session registration script — design surface" for the full contract. **Phase 4 critical path; no GAS code touched.**
   - **Manual seed of Context as proof** — register the existing EN sibling first via the script, then HE sibling. Exercises the full path end-to-end. Validate by Drive MCP reading `JLMops_Library` and seeing both rows.
   - **Image entities** for Context post follow the same registration path (featured + body, indexed per §20 slug pattern). May defer to a follow-up session if blog seed alone is enough proof.
   - **SheetAccessor extension** (deferred to first ops-side library read) — add `getLibrarySpreadsheet` + `getLibrarySheet` + `clearCache()` update, mirroring the existing data/log getters but reading `system.spreadsheet.library`. ~25 lines, no risk to existing flows. Sized 2026-05-25. Not on the phase 4 critical path because the session script doesn't go through ops; lands when ops first needs to read `SysLibrary` (phase 5 UI list view or phase 6 task-chain integration).
   - **LibraryService skeleton** — deferred to phase 5. Phase 4 has no UI write path, so no `LibraryService` needed yet. Methods come online with the "Add new entity" form and state-transition actions. Model: `LookupService.js` from @121 (runtime header discovery, append-only for adds, key-immutable on update, cache invalidation per write).
5. **Library list view + task UI parallel build as new entity `LibraryView`** (reordered 2026-05-25 — was phase 4; revised 2026-05-25 — parallel new view instead of in-place refactor; revised again 2026-05-25 — new entity, not v3 of the dashboard, single file role-conditional; revised 2026-05-26 — LibraryView is an additional view, not a replacement, after a same-day ship-and-revert: `@127` shipped a Dashboard route-flip on `library.enabled=true`, user clarified intent at smoke test, `@134` reverted). Build read-only library list using the common-skeleton + type-pack pattern with a shared widget kit (§11). **Build new `LibraryView.html` as a parallel new file; do NOT edit `ManagerDashboardView_v2` in place.** Single file serves both manager and admin via role-conditional content (no Manager + Admin counterparts). **LibraryView is an additional nav entry alongside the existing dashboards — no route flip, no promotion-time swap.** `ManagerDashboardView_v2` and `AdminDashboardView_v2` keep serving the existing Dashboard nav link unchanged. The new "Library" nav entry is gated by `library.enabled` for both admin and manager. Same row shape as v2 (new controller `WebAppLibrary.js` reads the polymorphic `entity_type`/`entity_id` columns from §7 with FK fallback). **Own plan doc shipped 2026-05-25: `jlmops/plans/LIBRARY_VIEW_PLAN.md`** — six pack archetypes cover daily work (Outreach / Content edit / Content publish / Confirmation / Order packing / Inventory count); ~50 task types fall to the generic skeleton in v1; `pack_form` field added to `taskDefinitions.json`. Library list view is **read-only in v1**; LibraryService skeleton deferred to phase 7. Add-new-entity generic form deferred indefinitely per 2026-05-26 §18 (no current use case — the LibraryView "Create Content Tasks" modal in phase 7 handles planned content, and the session script handles authoring artifacts). SheetAccessor library-routing extension (~25 lines) lands in step 1 of this phase. **Risk profile collapses to additive** — daily-use code untouched, swap is reversible.
6. **Orphan integrity report.** Active update from Claude on content creation (Claude writes library rows when it creates posts) **SHIPPED 2026-05-25** as part of phase 4 critical path via `content/register-library.js`. Remaining phase 6 work: ops emits a lightweight orphan-content-files integrity report on cadence as a backstop against missed updates from the session-side path.

   **Concrete shape.** New function `runLibraryIntegrityReport()` in `HousekeepingService.js`, fired by the existing `runDailyMaintenance` cadence (15-min trigger, business hours). Reads `SysLibrary` rows via the SheetAccessor extension + walks the canonical Drive folder tree under `system.folder.library` recursively. Two SysLog rows per run: `library_integrity.orphan_entities` (entities whose `slb_DocUrl` / `slb_FileUrl` doesn't resolve to a live Drive file — JSON details with slug list) and `library_integrity.orphan_files` (Drive files under the library folder with no matching `SysLibrary` row — JSON details with file path + ID list). No email, no task spawn, no remediation action — admin reads SysLog on demand. Short-circuits when `library.enabled = false`.
7. **LibraryService skeleton + content-stream chain spawn (admin) + lockVersion + Content edit pack + Content publish pack.** Scope locked 2026-05-26 (see §18 "Added 2026-05-26"). Rewritten 2026-05-26 after grep verification against actual code: the chain-spawn mechanic already exists as `WebAppProjects_createContentStream` (`WebAppProjects.js:203`) driven by the `CONTENT_STAGES` array (`WebAppProjects.js:168`) + `contentStreamModal` (`AdminProjectsView.html:565`). Phase 7 extends this surface to the library era; it does **not** introduce `chains.json`, a `chain_id` field on task definitions, a `spawnChain` method, a `stagger_days` config, or an `idempotency_key_pattern` config — those were imagined infrastructure (see [[feedback_search_repo_before_proposing_new]] and [[feedback_find_precedent_before_flagging_gap]]). **No new Drive OAuth scope** (DriveApp + Drive Advanced Service v2 already enabled in `appsscript.json`). AdminProjectsView stays untouched; its `contentStreamModal` keeps working in parallel until the later collapse phase.

   ### Architectural picks (settled at plan-time, no implementer-side bouncing)

   - **Fork `createContentStream` into `LibraryService.spawnContentChain`, do not extend in place.** Existing `WebAppProjects_createContentStream` keeps serving `AdminProjectsView` unchanged through phase 7 + soak; library-era write logic lives in `LibraryService` where it belongs. The two coexist until project absorption.
   - **3 new task templates** (not 2 — `lockVersion` needs a realignment task type): `task.content.create_wp_stubs`, `task.content.admin_review`, `task.content.realign`.
   - **6 LibraryService methods** (not 5): `addEntity`, `spawnContentChain`, `createBlankDoc`, `attachExistingDoc`, `lockVersion`, `logEntityActivity`.
   - **Service shape** mirrors `LookupService.js` (`LookupService.js:6-280`): IIFE module, module-level cache (`_cache`), private helpers prefixed `_`, `SpreadsheetApp.flush()` after writes, `_cache.delete(key)` per write for invalidation. **But the library workbook is `JLMops_Library`, not `JLMops_Data`** — open via `SheetAccessor.getLibrarySheet(name)` (`SheetAccessor.js:100`), not the direct-name `DriveApp.getFilesByName` pattern LookupService uses for JLMops_Data tabs.
   - **addEntity duplicate-slug behavior:** return `{deduplicated: true, entity: existingRow}`, do **not** error. Matches the `content/register-library.js` session-script behavior (§4). The chain caller continues with task creation; `TaskService.createTask`'s `(taskTypeId, linkedEntityId, status≠Done/Closed)` dedup (`TaskService.js:166-178`) prevents duplicate tasks. Re-spawning a chain for the same topic is therefore safe: existing entity rows are returned untouched, missing tasks fill in.

   ### Config + schema changes

   **Three new task templates in `taskDefinitions.json`** (use the existing `task.template` row shape — `[type_marker, taskTypeId, description, status, "topic", value, "default_priority", value, "initial_status", value, "flow_pattern", value, "due_pattern", value, "pack_form", value]`):

   - `task.content.create_wp_stubs` — admin manually creates the EN+HE WPML-linked WP stub posts before content push works. `topic: Content`, `default_priority: Normal`, `initial_status: New`, `flow_pattern: admin_direct`, `due_pattern: next_business_day`, `pack_form: skeleton`.
   - `task.content.admin_review` — admin gate between Claude EN draft and Evyatar's edit pass. `topic: Content`, `default_priority: Normal`, `initial_status: New`, `flow_pattern: admin_direct`, `due_pattern: next_business_day`, `pack_form: skeleton`.
   - `task.content.realign` — spawned by `lockVersion` when the editor answered Yes to the peer-realignment prompt (§14). Lives on the peer-language sibling. `topic: Content`, `default_priority: Normal`, `initial_status: Assigned` (auto-assigned to manager), `flow_pattern: manager_direct`, `due_pattern: one_week`, `pack_form: skeleton` (a real pack can come later if friction shows up).

   **CONTENT_STAGES extension at `WebAppProjects.js:168`.** Stage shape extends from `{ id, typeId, label, title }` to `{ id, typeId, label, title, target_sibling }`. `target_sibling` ∈ `'en'` (default) / `'he'`. Tells the spawner which language sibling to attach the task to when the entity is a sibling-language pair. Existing entries default to `'en'`; `translate` + `translate_edit` → `'he'` (both work on the HE sibling). Add the two new chain-pickable stages (`create_wp_stubs`, `admin_review`) — both `target_sibling: 'en'`. (`realign` is NOT in `CONTENT_STAGES` — it's lockVersion-spawned, not modal-picked.) Distribution stages land in phase 11. For language-agnostic entities (image bundled, customer, template) `target_sibling` is ignored — one entity, one attachment.

   **`TaskService.createTask` options bag extended** to accept `entityType` + `entityId`, writing each to the matching SysTasks column. Mechanically identical to the existing `options.projectId` → `st_ProjectId` write at `TaskService.js:209-212`; just two more `if (options.X)` blocks. No new function, no breaking change to existing callers.

   ### LibraryService method signatures

   New file `jlmops/LibraryService.js`. Shape: `const LibraryService = (function() { ... return { ... }; })();`.

   - **`addEntity({ slug, type, language, title, references, typeFields })`**
     - Validates: §20 slug pattern (`<type>-<topic>[-<discriminator>][-<language>]`, kebab-case); type ∈ §6 vocab; language ∈ `'en'` / `'he'` / `null`; every entry in `references` resolves against `SysLibrary`.
     - Reads `SysLibrary` by slug via `SheetAccessor.getLibrarySheet('SysLibrary').getDataRange()`. If found → return `{deduplicated: true, entity: existingRow}` without writing.
     - Otherwise appends a new row: `slb_Slug`, `slb_Title`, `slb_ContentType` ← type, `slb_Language` ← language (or empty string for language-agnostic), `slb_State` ← `'draft'`, `slb_Version` ← `0` (per §5 "Two write paths, two lifecycle moments" — `addEntity` seeds pre-work stubs at draft/v0; first `lockVersion` bumps to locked/v1), `slb_CreatedDate` ← `new Date().toISOString()` (matches the format `content/register-library.js:159` writes), `slb_CreatedBy` ← `Session.getActiveUser().getEmail()`, `slb_LastTouched` ← same ISO string, `slb_References` ← comma-joined slug list (matches existing reader at `WebAppLibrary.js:155` + writer at `content/register-library.js:172`; slugs are kebab-case so no comma collisions), plus any `typeFields` writing to matching `slb_*` columns (e.g. `wpPostId` → `slb_WpPostId`).
     - Returns `{deduplicated: false, entity: newRow}`.
     - Invalidates `_cache.delete('library.entities')` if a cache is keyed there.

   - **`spawnContentChain({ entityType, baseSlug, contentName, stages, streamId? })`**
     - `entityType` from the modal (always `'blog'` for v1; future chains pass their own type).
     - `baseSlug` derived from `contentName` per §20 + the type prefix (e.g. "Context" → `blog-context`). Caller can pass an explicit slug instead.
     - For sibling-language types (blog / news / mention / email / social): calls `addEntity` once per language (`<baseSlug>-en`, then `<baseSlug>-he` with `references: ['<baseSlug>-en']`). For language-agnostic types: single `addEntity` with `slug: baseSlug`.
     - For each id in `stages`, looks up the entry in `CONTENT_STAGES`, resolves the target slug: sibling-language type → `<baseSlug>-<stage.target_sibling>`; language-agnostic → `baseSlug`. Then calls `TaskService.createTask(stage.typeId, resolvedSlug, contentName, stage.title + contentName, '', streamCode, { entityType, entityId: resolvedSlug })`. Stream code generation matches existing `createContentStream` logic (lines 211–221) — first 3 letters uppercase + random suffix, or user-supplied `streamId`.
     - Returns `{ entities: [...], tasks: [...], streamCode, deduplicated_entities: [...] }`.

   - **`createBlankDoc({ entityId })`**
     - Reads the entity row from `SysLibrary` by slug. Errors if not found.
     - Resolves canonical concept folder: `system.folder.library` (root) → `<slb_ContentType>` → `<concept>` (concept = topic segment of slug per §20). Auto-creates each missing folder via DriveApp.
     - Creates blank Doc via `DocumentApp.create(slug)` (lands in My Drive root), then moves to canonical folder via `DriveApp.getFileById(doc.getId()).moveTo(canonicalFolder)`.
     - Refuses silent overwrite: if a file with name `<slug>` already exists in the canonical folder, throws before doc creation.
     - Writes `slb_DocUrl` ← `doc.getUrl()` on the entity row; updates `slb_LastTouched`.
     - Returns the doc URL.

   - **`attachExistingDoc({ entityId, driveUrl })`**
     - Reads the entity row by slug.
     - Extracts file ID from URL (regex `/[-\w]{25,}/`).
     - Reads current file via `DriveApp.getFileById(fileId)`.
     - Resolves canonical folder per `createBlankDoc` rule. If the file's current parent != canonical folder, calls `file.moveTo(canonicalFolder)` (Drive file ID stable; URL preserved).
     - Renames to `<slug>` if current name doesn't match.
     - Writes `slb_DocUrl` ← (canonical URL) on the entity row; updates `slb_LastTouched`.
     - Returns the doc URL.

   - **`lockVersion({ entityId, taskId, peerNeedsRealignment })`**
     - Reads entity by slug.
     - Increments `slb_Version` by 1, sets `slb_State` ← `'locked'`, updates `slb_LastTouched`.
     - Closes the originating task via `TaskService.completeTask(taskId)` (the existing function at `TaskService.js:329`).
     - If `peerNeedsRealignment === true`: resolves peer slug via slug-pair flip (`-en` ↔ `-he`); reads peer entity row to confirm it exists; calls `TaskService.createTask('task.content.realign', peerSlug, peerEntity.slb_Title, 'Realign after peer lock: ' + peerEntity.slb_Title, '', null, { entityType: 'blog', entityId: peerSlug })`. (`entityType` derived from peer's `slb_ContentType`.)
     - Calls `logEntityActivity({ entityId, actionType: 'version_lock', details: { version: newVersion, peerRealignmentSpawned: !!realignTaskId }, referencedEntities: realignTaskId ? [peerSlug] : [] })`.
     - Returns `{entity: updatedRow, task: closedTaskRow, related_tasks: realignTaskId ? [realignTaskRow] : []}`.

   - **`logEntityActivity({ entityId, actionType, details, referencedEntities })`**
     - Generates `slba_ActivityId` = `Utilities.getUuid()`.
     - Resolves the entity's type by reading its `slb_ContentType` (or accepts an explicit `entityType` for virtual entity types per §7); `slba_EntityType` ← that, `slba_EntityId` ← `entityId`.
     - Appends row to `SysLibraryActivity` (lives in `JLMops_Data` per §8 + workbook placement rule; opened via `SheetAccessor.getDataSheet('SysLibraryActivity')` — sheet name confirmed registered at `system.json:1057`): `slba_Timestamp` ← `new Date().toISOString()`, `slba_Actor` ← `Session.getActiveUser().getEmail()`, `slba_ActionType` ← actionType, `slba_Summary` ← short label per actionType (e.g. `'Version locked'`), `slba_Details` ← `JSON.stringify(details)`, `slba_ReferencedEntities` ← `JSON.stringify(referencedEntities)`.
     - Returns nothing.

   ### WebAppLibrary controller wrappers

   One wrapper per service method, each returning the §11 action envelope:

   - `WebAppLibrary_addEntity(params)`, `WebAppLibrary_spawnContentChain(params)`, `WebAppLibrary_createBlankDoc(params)`, `WebAppLibrary_attachExistingDoc(params)`, `WebAppLibrary_lockVersion(params)`, `WebAppLibrary_logEntityActivity(params)`.
   - Each wraps in `{ok: boolean, updated: {entity?, task?, related_tasks?}, error?: string, validation?: {field: message}}` per §11.
   - Existing `WebAppLibrary_getData` (`WebAppLibrary.js:30`) keeps its current `{success, data, error}` shape — read endpoints don't churn to the action envelope (settled 2026-05-26; see Envelope shapes below).

   ### Envelope shapes (settled 2026-05-26)

   - **Reads** (`WebAppLibrary_getData` and any future read endpoint): keep `{success, data, error}` already in `WebAppLibrary.js:42-66`.
   - **State-changing actions** (the 6 new endpoints above): §11 action contract — `{ok, updated: {entity?, task?, related_tasks?}, error?, validation?}`. `updated` carries affected rows in the same shape `_getQueueTasks` and `_getLibraryEntities` produce (`WebAppLibrary.js:75-181`), so the UI can swap rows without re-fetching. `validation` carries structured field errors (renders inline); `error` carries system-failure messages (renders as toast with retry).

   ### Chain-level idempotency

   Slug uniqueness is the guard. `addEntity` returns `{deduplicated: true}` on existing slug rather than appending, so re-spawning a chain for the same topic is safe — entity rows are returned untouched, missing tasks are filled in by `TaskService.createTask`'s own dedup. Admin manages stage selection per spawn via the modal; no separate per-chain stage list or `idempotency_key` config.

   ### UI changes in LibraryView

   - **"Create Content Tasks" button** in LibraryView's top region above the library list (admin-only via `data-roles="admin"` per LIBRARY_VIEW_PLAN Role gating).
   - Click opens a modal-overlay copied from `contentStreamModal` (`AdminProjectsView.html:565`) — same shape: Content Name input, optional Stream ID input, `CONTENT_STAGES` checkboxes, "Create Tasks" submit.
   - Submit calls `WebAppLibrary_spawnContentChain({entityType: 'blog', baseSlug, contentName, stages, streamId})`. Response's `updated.entities` + `updated.tasks` are merged into the LibraryView local state; modal closes.

   - **Content edit pack** (LIBRARY_VIEW_PLAN step 4) — new case in the `packBody()` JS dispatcher in `LibraryView.html` (matches the precedent set @125 for Outreach / Confirmation / deep-link packs; HtmlService include files were envisioned in early planning but not adopted in implementation — see LIBRARY_VIEW_PLAN.md "Surfaces" for the reconciliation). Surfaces per `LIBRARY_VIEW_PLAN.md` "Type packs": file-link chip (the entity's `slb_DocUrl` if set; else "Create blank Doc" + "Attach existing Doc" buttons calling the matching service methods), notes textarea, Lock button. Lock click opens the §14 peer-realignment modal-overlay (Yes / No, no Cancel — choice is required at lock per §14). Yes/No → `WebAppLibrary_lockVersion({entityId, taskId, peerNeedsRealignment})`. Response replaces the task row + entity row; the pack collapses.
   - Wires the new `file-link chip` widget atom into `TaskWidgets.html`.

   - **Content publish pack** (LIBRARY_VIEW_PLAN step 5) — new case in the `packBody()` JS dispatcher (same pattern as Content edit pack). Confirmation-pack variant: notes textarea + "Mark Published" button + optional external-URL input. "Mark Published" call sequence: (1) `WebAppTasks_completeTaskById(taskId)` (existing wrapper at `WebAppTasks.js:240`, unchanged) closes the task; (2) if the user filled the external-URL field, `WebAppLibrary_logEntityActivity({entityId, actionType: 'published', details: {externalUrl}, referencedEntities: []})` records the URL on the entity's activity log. No `LibraryService.publishEntity` method — blog publish stays session-side via `content/push-posts.js`; Mailchimp / social / WhatsApp / video are manual external workflows. Covers `task.content.blog_publish`, `task.content.video_publish`, `task.content.email`, `task.content.social`, `task.content.whatsapp`.

   ### Implementation sequencing (2 sessions, each gated by user OK before deploy)

   *Session 7a — config + service skeleton + admin spawn (no Drive ops yet):*

   - Add 3 task templates to `taskDefinitions.json` (`create_wp_stubs`, `admin_review`, `realign`).
   - Add the 2 chain-pickable stages to `CONTENT_STAGES` (`create_wp_stubs`, `admin_review`); add `target_sibling` field to all stage entries.
   - Extend `TaskService.createTask` to accept `options.entityType` + `options.entityId`.
   - Create `jlmops/LibraryService.js` with `addEntity` + `spawnContentChain` only.
   - Add `WebAppLibrary_addEntity` + `WebAppLibrary_spawnContentChain` wrappers.
   - LibraryView "Create Content Tasks" admin button + modal-overlay copied from `contentStreamModal`.
   - `node jlmops/generate-config.js` → `clasp push` → `rebuildSysConfigFromSource()` → smoke: open LibraryView as admin, click "Create Content Tasks", enter "Smoke Test" + check all 6 blog stages, submit. Verify two `SysLibrary` rows (`blog-smoke-test-en` + `blog-smoke-test-he`), six `SysTasks` rows with `st_EntityType=blog` + correct `st_EntityId` per stage's `target_sibling` (translate → HE, others → EN). User OK → `pwsh -NoProfile -File jlmops/deploy.ps1 "phase 7a"`.

   *Session 7b — Drive ops + lock + activity + Content edit pack + Content publish pack:*

   - Add `createBlankDoc`, `attachExistingDoc`, `lockVersion`, `logEntityActivity` to `LibraryService.js`.
   - Add `WebAppLibrary_createBlankDoc` / `_attachExistingDoc` / `_lockVersion` / `_logEntityActivity` wrappers.
   - Add `file-link chip` atom to `TaskWidgets.html`.
   - Extend `LibraryView.html`'s `packBody()` JS dispatcher with two new cases: Content edit pack (covers `task.content.edit`, `translate`, `translate_edit`, `images`, `print_newsletter_body`, `draft`, `video_create`) and Content publish pack (covers `blog_publish`, `video_publish`, `email`, `social`, `whatsapp`). Same JS-dispatch pattern as the @125/@127 packs — no separate HtmlService include files.
   - lockVersion peer-realignment Yes/No modal-overlay.
   - `clasp push` → smoke: open the EN edit task on `blog-smoke-test-en`, click "Create blank Doc" → verify Doc appears under `/JLMops_Data/Library/blog/smoke-test/`, `slb_DocUrl` populated; click "Lock", answer Yes → verify task closes, `slb_State='locked'`, `slb_Version=1`, `SysLibraryActivity` row appended, `task.content.realign` row spawned on the HE sibling. Open a publish task, fill external URL, click "Mark Published" → verify task closes + activity log entry. User OK → `pwsh -NoProfile -File jlmops/deploy.ps1 "phase 7b"`.

   ### What does NOT change in phase 7

   - `AdminProjectsView` + `contentStreamModal` + `WebAppProjects_createContentStream` — untouched. Existing project-side content streams keep firing.
   - `MarketingCampaignService.generateOutputs` — untouched (it's the utm+QR helper at `WebAppCampaigns.js:115`, not a chain spawner).
   - The 16 dormant distribution templates — schema-only, no spawner. Phase 11 (distribution events) adds them to `CONTENT_STAGES` and exercises them via the same modal.
   - SysTasks schema — already has `st_EntityType` + `st_EntityId` appended @124; phase 7 just writes to them.
   - SysLibrary / SysLibraryActivity schemas — already defined; phase 7 just writes to them.
   - The `library.enabled` flag — already `true`. The flag stays as the rollback control until phase 11 retirement (see "Build discipline across phases" above).
8. **SUPERSEDED 2026-05-25.** Originally: "Translation button + Google Translate auto-draft on translate task." Translation work was reassigned to phase 5's Content edit pack ("Create HE doc" button per §11); Google Translate auto-draft was dropped per 2026-05-21 revisions to §9 + §10 ("too brittle; manager iterates with Gemini outside the system anyway"). Number retained to preserve §18 cross-references.
9. **Entity detail view (drawer) + action buttons.** Builds the §11 "Entity detail view" surface: all files / external URLs (Drive / Canva / Mailchimp / WP), state history, activity log, attached tasks (open + done), references in (who references this entity) and out (what this entity references), action buttons in context: Open in Drive (when docUrl set), Create Content Tasks (admin-only; pre-filled with the current entity's name per §11 chain spawning), Create HE sibling stub (admin-only; for `-en` entities lacking an HE peer; spawns via `LibraryService.addEntity`). **Lock + Version intentionally NOT a drawer action** (settled 2026-05-27): drawer = inspection, task pack = action; locking always goes through the task it closes, preserving §18's "task closure = version lock" principle. Publish-from-drawer (e.g., "Push to WP") was previously listed here; per 2026-05-26 §18 publishing stays session-side (`content/push-posts.js` for blog; Mailchimp / social / WhatsApp / video manual). The drawer's role on publish reduces to inspection plus the §14 peer-realignment guard surfaced as a "publish task ready / blocked" indicator; the actual publish action remains external. Reopen if a real case for in-app publish appears. Lands the Comax / Web / ops comparison widget deferred from LIBRARY_VIEW_PLAN phase 5 — used by the drawer for inspection and by relevant task packs for verification work (same widget, two framings per §11 drawer-vs-pack boundary). Drawer reads via the same LibraryService introduced in phase 7; no new write surface beyond what LibraryService already exposes.

   **Concrete shape.** New `LibraryService.getEntityDetail(entityId)` reads the entity row, all incoming references (reverse-lookup query against `SysLibrary`), all attached tasks (query against `SysTasks` by `st_EntityType` + `st_EntityId`), and recent activity log entries (query against `SysLibraryActivity` by `slba_EntityId`). Returns one composite payload. Drawer opens from: (1) clicking any entity title in the LibraryView library list, (2) clicking any entity chip in a task row's primary/references display. Layout: centered modal-overlay (corrected 2026-05-27 from earlier right-side slide-in spec — feedback at @139 smoke: slide-in was too subtle; centered modal matches the rest of the view's precedent); close button + Escape key dismiss. Toolbar shows title + close; sections rendered as labeled groups in the body.
10. **Templates as entities — migrate one family at a time.** Per §14. For each template family (welcome first as pattern-setter; pending-payment next as the first consumer-bearing migration; cooling / VIP / win-back as they become real):

   **Welcome family — pattern-setter (settled 2026-05-27).** Welcome has NO consumer code today (`HousekeepingService.createWelcomeOutreachTasks` only spawns a `task.contact.outreach` for the manager; manager does outreach manually). Migration scope is therefore reduced — no consumer-rewrite step. Pure scaffolding to establish the migration recipe before pending_payment carries the real consumer change.

   - **Write path:** extend `content/register-library.js` to handle `content_type='template'`. Add template-specific fields to `buildRow()` fieldMap: `slb_Subject`, `slb_Body`, `slb_Channel` (sparse; only populated for template rows). Manifest entries are hard-coded in the script for this one-off migration; content copy-pasted from current SysConfig values. Session-side write, no GAS code touched.
   - **Initial state:** rows written directly at `slb_State='locked', slb_Version=1`. Bypasses `lockVersion` (no peer-realignment task spawned) because en/he were pre-aligned in SysConfig and §14's peer-realignment prompt is a UI-only concept for live edits — irrelevant for migration.
   - **`slb_Title`:** self-describing, e.g. `Welcome email (EN)` / `Welcome email (HE)` / `Welcome WhatsApp (EN)` / `Welcome WhatsApp (HE)`. Language redundant with `slb_Language` column but valuable for surfaces where the language column isn't visible.
   - **References:** same-channel peer only. `template-welcome-email-en` references `template-welcome-email-he` (and vice versa); no cross-channel references (no `welcome-email-en → welcome-whatsapp-en` link).
   - **Activity log:** no `template_migrated` entry written during migration. `slb_CreatedDate` + `slb_CreatedBy='session'` is sufficient audit.

   **Welcome family SysConfig source keys** (concrete starting set, confirmed against `jlmops/config/otherSettings.json` 2026-05-26):
   - `template-welcome-email-en` ← `crm.template.welcome.email.subject.en` + `crm.template.welcome.email.body.en`
   - `template-welcome-email-he` ← `crm.template.welcome.email.subject.he` + `crm.template.welcome.email.body.he`
   - `template-welcome-whatsapp-en` ← `crm.template.welcome.whatsapp.en` (body only; WhatsApp has no subject)
   - `template-welcome-whatsapp-he` ← `crm.template.welcome.whatsapp.he`

   **SysConfig retirement deferred.** Welcome `crm.template.welcome.*` rows stay in place after the migration. Retirement happens in one pass alongside pending_payment migration (when that family also moves to library).

   **Pending_payment family — first consumer-bearing migration.** Different sequencing because there IS a consumer at `HousekeepingService.js:1240-1242` (the automated send reads subject/body/addendum from `crm.template.pending_payment.*`). Welcome's pattern-setter recipe applies; the additional step is the consumer rewrite + the `logEntityActivity({ actionType: 'template_send' })` write on each successful send. Lock-time peer-realignment guard per §14 (blocks send when an open peer-realignment task exists on the family). Concrete plan deferred until welcome lands; the welcome migration is the prerequisite that proves the recipe.

   **Activity log write path (applies once consumers exist — pending_payment onward).** The service that performs the send writes the per-send activity log entry inline with the send call, via `LibraryService.logEntityActivity({ entityId: <template-slug>, actionType: 'template_send', details: { contactId, channel, language }, referencedEntities: [contactId] })`. Audit shows template + version + recipient on the template entity's activity log (the contact's history can be reconstructed via reverse-lookup on `referencedEntities`).

   Each family is one focused session. Migration is opt-in per family; SysConfig content rows that haven't migrated still work the old way. No big-bang sweep.
11. **Distribution events as entities (and the spawner for the 16 dormant distribution task templates).** Per §6: `email`, `news`, `mention`, `social` — all sibling-language. Per §21: KPI stats columns refreshed by ops on cadence. Per §18 (2026-05-20): "Campaigns absorbed into library as entity instances; `SysMarketingCampaigns` retires over time." The 16 task templates added 2026-05-11 (`task.newsletter.*`, `task.flyer.*`, `task.campaign.*`) are currently schema-only — they live in `taskDefinitions.json` with no live caller (confirmed via grep 2026-05-26). Phase 11 adds them to `CONTENT_STAGES` (or whatever extended-stage list the chain spawn reads from) so the same "Create Content Tasks" modal can spawn distribution chains the same way it spawns blog chains.

   **2026-05-25 user direction: future publishing rides this model.** Newsletter Issue #1 (2026-05-26 send) is the last pre-library issue — its EN+HE Mailchimp HTML + manual docx flow are not registered as library entities. From June 2026 onward, each issue (and its companion email + mentions + any social) registers as a library entity instance under the appropriate type. Phase 11 sequence below should be ready in time for that.

   Order:
   1. `email` first — most concrete, existing Mailchimp integration. Register one issue as library entity pair (en + he); wire Mailchimp KPI pull.

      **Chain shape (settled 2026-05-28).** Email distribution carries content drawn from a source entity (blog / news), but the email itself may still need content work — write, edit, translate, image generation, scheduling. The email entity's chain reuses blog's `CONTENT_STAGES` (`WebAppProjects.js:168-182`) — same stage IDs, same task templates, no duplication — with this selection:

      | Stage ID | Maps to | Notes |
      |---|---|---|
      | `draft` | content created | reused |
      | `edit` | edited | reused |
      | `translate` | translated | reused |
      | `images` | image generation | reused |
      | `email` | scheduling | reused — repurposed as the FINAL "schedule send in Mailchimp" step for type=`email` |

      Dropped for v1 email: `create_wp_stubs`, `blog_publish`, `video_*`, `social`, `whatsapp`, `admin_review`, `translate_edit`. Add back per-stage only if a real workflow need surfaces.

      No new task templates are introduced in phase 11 email — `task.content.email` exists already (schema-only today; phase 11 makes it spawnable as the chain's final stage). The 16 dormant distribution templates (`task.newsletter.*`, `task.flyer.*`, `task.campaign.*`) are NOT used for the email type; their fate is decided when news / social phases land.

      **`task.content.email` task pack** — reuses the existing Content publish pack (`LibraryView.html` packBody at the `isContentPublishType` branch, lines 723-747). The pack provides: optional External URL input + Notes + "Mark Published" button. `task.content.email` is already routed there alongside `task.content.blog_publish` / `task.content.video_publish` / `task.content.social` / `task.content.whatsapp` — no change needed. Operator workflow: create campaign in Mailchimp, paste in the HTML body (session converts the Drive Docs from the earlier chain stages to Mailchimp-ready HTML, same pattern as Issue #1 deliverable — `marketing/newsletter/issues/2026-05-context-{en,he}.html`), schedule the send in Mailchimp UI, return, paste the campaign URL into External URL, click Mark Published. The campaign URL captured at task close lands in the entity's activity log via the existing `markPublished` flow; primary Mailchimp metadata (campaign id, subject, send_date) is still captured at registration time via `register-library.js` (item 4 below).

      **Content artifact format.** `draft` / `edit` / `translate` / `images` stages reuse blog's existing Drive Doc workflow + Content edit pack — no new pack form for email content stages. At the `email` (schedule) stage, the session-side step converts the en + he Drive Docs to HTML for Mailchimp paste.

      **`register-library.js` update mode.** Chain spawn creates the email entity row at draft/v=0 (per phase 7a pattern). Post-send registration is therefore an UPDATE to the existing row, not a create. The script will be extended to detect existing rows by slug and patch the email-specific fields (`mailchimp_campaign_id`, `subject_line`, `send_date`, state flip to `published`) rather than skip. The current SKIP behavior at `register-library.js:341-342` remains the default; update path activates via an explicit flag (e.g., `--update` CLI arg or `mode: 'update'` in manifest entry).

      **Spawn surface.** Same flow as blog phase 7a: admin opens "Create Content Tasks" modal in LibraryView (no need to pre-create the email entity), picks email type + stages, modal calls `LibraryService.spawnContentChain` which creates the en+he entity pair AND spawns the tasks in one call. `spawnContentChain` already accepts the `entityType` parameter — phase 11 just exercises it with `entityType='email'`.

      **Email purpose drives stage selection.** An email may exist to (a) promote an existing blog/news entity — reference the source, spawn `email` stage only (scheduling), no content production; (b) distribute original AYIW content — no source reference, spawn `draft` + `translate` + `images` + `email`; (c) promote a coupon or other non-library asset — reference field carries the coupon code as free-text, stage selection reflects whether new content is needed. The admin picks stages per case in the modal.

      **References field on modal.** Optional free-text field, comma-separated. Accepts library entity slugs (`blog-context-en`) and ad-hoc references (coupon codes, campaign ids, free-text notes). Populates `slb_References` on both en + he entities at spawn. Editable later via the entity drawer or post-send `register-library.js` call.

      **June 2026 issue registration path (concrete).** After Mailchimp send, run `content/register-library.js` twice (once per language) with `type=email`, `slug=email-2606-context-en` / `-he`, `file_path_or_url=` the Mailchimp campaign URL, `references=[blog-context-en]` / `[blog-context-he]`. Each row gets `mailchimp_campaign_id` from Mailchimp + `subject_line` + `send_date` populated by the session at registration time. **Final state on write: `published`** (settled 2026-05-28) — an email send is a publish event to the subscriber audience, analogous to a blog going live; the row flips draft → published when the script updates it with the Mailchimp metadata. KPI columns (`open_rate`, `click_rate`, etc.) populate later via the cadence refresh job (KPI ingest plan, downstream). Newsletter Issue #2 (June 2026) is the first instance through this path; Issue #1 (May 2026) stays pre-library and is not back-registered.
   2. `news` + `mention` together — newsletter dependency. News is the print issue; mention rows reference posts.
   3. `social` last — platform API variety; manual entry where APIs not available.

   Existing `SysMarketingCampaigns` rows continue to reference library entity instances. Sheet stays alive until in-flight campaigns complete; retirement is housekeeping, not part of this phase.
12. **Cross-link renderer.** Extends the existing `WooCommerceFormatter.formatDescriptionHTML()` pattern. Ops-side function that takes a library entity's `taxonomy[]` codes, queries product data for matches, emits an EN/HE related-products HTML block injected into the post body at publish; reverse function for PDP "related posts" via a custom field. No WP custom taxonomies on posts.

   Prerequisites per §13: lookup-add UI (shipped @121); regions overhaul per §16 (still pending — cross-linking on the region dimension blocks until that lands).

   Order: post → product direction first (one renderer; push-posts.js inserts the block at publish; no PDP changes yet). Reverse PDP → post direction second (separate renderer + custom field + PDP template hook).
13. **Customer migration** (optional, low priority). Move SysContacts into library entity table when there's a real benefit.
14. **Project absorption** (low priority). Most new work attaches directly to entities; PROJ-X survives only for cross-entity work.
15. **Product images** later (separate plan when post-side is settled).

---

## 18. Foundational principles

Reference card for what doesn't change. Anything dated or implementation-specific lives in the relevant topical section (§4-§17), not here.

**Editing discipline:** decisions merge into topical sections at bank-time. Do not append "Added YYYY-MM-DD" blocks to this section; revise the relevant topical section instead. This list holds only durable principles.

- **Library is the entity layer**, not a fourth container concept.
- **Three primitives:** entities, tasks, activity logs. Workflows are wiring on top.
- **No parent/child between entities;** references only, many-to-many. `references[]` holds necessary structural connections; casual relatedness lives in `taxonomy[]` or is computed at query time.
- **One task attachment model:** primary entity + N references via polymorphic `(entity_type, entity_id)`. Library entity types point at library rows; virtual entity types (customer/order/project) point at their existing source sheets.
- **Tasks ≠ admin reports.** Tasks for any human work; in-session reports for everything else. Manual close is a trivial click.
- **Active updates beat passive detection** at current scale; passive narrow fallback for Evyatar's artifacts only.
- **Drive holds locked editorial artifacts.** MD source in git; DOC for editing in Drive; locked images / email HTML / newsletter PDFs in Drive; product images stay in WP media library only. Generation tools (Canva, Mailchimp drafting) are surfaces, not archives.
- **Task closure = version lock; new task = new version.** One slug, one current version. No intra-version history in the library.
- **No automation for cross-version recovery;** admin in charge.
- **No content snapshots;** reference + timestamp; rely on external system history (Drive ~30 days, git, Canva).
- **Product attributes drive post-product linking;** posts don't carry SKU foreign keys.
- **Don't move assets out of native tools** (Canva, Mailchimp, etc.); library indexes outward.
- **Templates as entities** replacing SysConfig content rows; migrate incrementally per family.
- **CRM stays as-is for now** — shipped, working, not exercised much; migrate to library entity model only if/when benefit shows up.
- **Campaigns absorbed into library** as entity instances; `SysMarketingCampaigns` sheet retires over time.
- **Projects survive only for cross-entity work**; most tasks attach directly to entities.
- **Build for current scale (~14 pieces);** bake data model for hundreds.
- **Don't rewrite working code** for cleanliness; refactor when there's a real reason.
- **Two write paths to the library.** UI writes via `LibraryService.*` (`google.script.run`); session-time registration writes directly to `SysLibrary` via Sheets API from local node scripts. Session never writes to `SysLibraryActivity` (ops-only, multi-tab `JLMops_Data`). State transitions are UI-only.
- **Admin initiates, manager executes.** Admin creates content, picks campaigns, spawns chains. Manager works the queue (no creation surface). LibraryView gates admin-only controls via `data-roles="admin"` per AppView body-class CSS.
- **Library file = read surface for Claude.** No general-purpose export pipe. Ad-hoc fetches cover anything multi-tab.
- **Publishing stays external.** Blog publish via `content/push-posts.js` session-side; Mailchimp / social / WhatsApp / video manual. JLMops doesn't push to publish targets; "publish" tasks close as Confirmation-pack variants that record the external URL.
- **Publishing calendar stays as markdown** (`content/PUBLICATION_CALENDAR.md`); no JLMops calendar UI. Admin reads the calendar to decide when to initiate chains.

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

### Operational details — deferred to KPI ingest plan

Refresh cadence, ownership, and manual-refresh-button placement are out of scope for the library plan. They become a jlmops housekeeping concern with its own future plan when KPI ingest is built. Library plan only establishes that stats live as columns on entity rows (above); refresh mechanism is downstream.
