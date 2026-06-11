# Content Library Plan

A library + librarian system that is the **entity layer** for content, marketing, and (eventually) CRM work — one unified entity model replacing fragmented per-domain containers (Projects, Campaigns, content folders). It spans jlmops (ops), Claude CLI (production + reasoning), Google Drive (canonical storage), Canva + Mailchimp (creative tools), and WordPress (publish target).

**Current state:** phases through 9 are shipped (schema, blog+image entities, the read-only `LibraryView`, the orphan-integrity report, the content-stream chain spawn + lock/activity service, the entity drawer). Open intent: templates migration (§10), distribution events (§14 phase 11), the cross-link renderer (phase 12), and customer/project/product-image migration. The live **schemas** (`SysLibrary`, `SysLibraryActivity`, SysTasks polymorphic columns, slug convention) are graduated to `../jlmops/docs/DATA_MODEL.md`. The unified task workbench is specced in `../jlmops/plans/ADMIN_TASK_UI_PLAN.md`; the view in `../jlmops/plans/LIBRARY_VIEW_PLAN.md`.

## 1. The model: three primitives

- **Entities** — things with state and history (content pieces, customers, templates, campaign instances). Live in the library.
- **Tasks** — work units. Attach polymorphically to entities via `(entity_type, entity_id)`: one primary entity, N references.
- **Activity logs** — per-entity audit trail (what, when, who).

**Workflows are not a fourth primitive** — they're wiring: a state change spawns a task; a task close updates entity state + writes the activity log. *Not* covered by the model (stays as-is): system config (SysConfig), schema definitions (code), lookup tables, housekeeping functions, read-only reports.

The redesign exists because the original draft built the library as a *fourth container* alongside Projects/Campaigns/CRM — repeating the very fragmentation that caused the problem. The entity layer collapses those into patterns within one shape. **Non-decision:** don't rewrite working code — CRM and the campaigns sheet stay; the library is built for new content/marketing work and existing surfaces migrate only when there's a real reason.

## 2. What gets unified

| Today | In the unified model |
|---|---|
| Customer (SysContacts row) | Entity type `customer` (virtual — stays in SysContacts) |
| Outreach text (SysConfig rows) | Entity type `template` (EN/HE) |
| Marketing campaign type/instance | `content_type` value (`email`/`news`/`mention`/`social`) + entity instance |
| Blog post draft | Entity type `blog` (sibling per language) |
| Project (PROJ-X container) | Survives only for cross-entity work; most tasks attach directly to entities |
| Task via per-domain FK | Task via polymorphic `(entity_type, entity_id)` |
| Per-domain activity tracking | Generic per-entity activity log |

Nothing disappears as functionality — the workflows still fire, and the daily operating surface keeps the familiar per-domain views as preset filters.

## 3. Claude/ops coordination

- **jlmops** owns time-driven runs, multi-tab Sheets, persistent state. **Claude CLI** owns judgment + content generation + reach into Canva/Mailchimp/WP/local files in one workflow.
- **Read-around:** the library file is the read surface — a single flat sheet (Drive-MCP single-tab compatible), read directly by Claude, written by GAS. No general-purpose export pipe; multi-tab data is fetched ad-hoc. A future `reports/` folder for precomputed KPI roll-ups is a provision, not a Claude read-API.
- **Active updates over passive detection** at this scale (one extra write per content action; no polling infra). Passive timestamp detection is a narrow fallback for *Evyatar's* artifacts only (Canva/Mailchimp/DOC edits ops or Claude observes on his behalf).
- **Two write paths:** UI writes go through `LibraryService.*` (server-side, via `google.script.run`) — it validates, writes the entity row + activity log, fires downstream workflow. Session-time registration writes directly to `SysLibrary` via the Sheets API from a local node script (sibling to `push-posts.js`, service-account auth). The **session cannot write `SysLibraryActivity`** (it lives in `JLMops_Data`, ops-only) and never transitions entity state — it only creates entities; registration is audited by `slb_CreatedDate`/`slb_CreatedBy`. Each writer validates its own inputs; slug uniqueness is enforced read-before-write on both sides.

## 4. Storage

- **MD source** → git repo under `content/<topic>/` (canonical for code paths; `push-posts.js` reads it). **DOC for editing** → Drive (Evyatar's phone-accessible surface). Claude converts both directions (`pformat`).
- **Locked editorial artifacts live in Drive** (images, email HTML, newsletter PDFs) — generation tools (Canva, Mailchimp) are surfaces, not archives. **Product images** stay in the WP media library only.
- **One slug, one current version. No intra-version history in the library.** A new version overwrites the file at the same slug; edits between locks live in external history (Drive ~30d, git, Canva). Activity log entries are only at milestones (version lock, reference change, state transition).
- **Canonical folder placement** is owned by the library service: `(type, concept, slug, language)` → `/JLMops_Data/Library/<type>/<concept>/<slug>.<ext>`. It auto-creates the concept folder, places at the canonical path, and refuses silent overwrite. `createBlankDoc` / `attachExistingDoc` (in task packs) are the on-demand routes; a file attached out-of-place is moved to canonical (Drive ID stable, URL preserved). *Backlog:* one live walk of the Drive layout to confirm canonical paths + exercise `attachExistingDoc` move-to-canonical.

## 5. Entity model

| Type | What | Language split |
|---|---|---|
| `blog` | Editorial post | sibling per language |
| `news` | Print newsletter issue | sibling per language |
| `mention` | Section within a newsletter issue | sibling per language |
| `email` | Mailchimp send | sibling per language |
| `social` | FB/IG/X post | sibling per language |
| `template` | Outreach message (replaces SysConfig usage) | sibling per (channel, language) — §10 |
| `image` | Editorial image asset | bundled (no language) by default; sibling when directional |
| `customer` | CRM contact (virtual; migration optional) | n/a |

**Language-split rule:** if the artifact has a language, language splits it into sibling entities (`-en`/`-he` slug suffix), each independently drafted/locked/versioned. Siblings reference each other as translation pairs via the slug-pair pattern (the cross-language version check is a slug-pair lookup, not a row field).

Column definitions (generic + sparse per-type) are in `DATA_MODEL.md` (`SysLibrary`). **Reference model:** entities reference each other, no parent/child ownership. `references[]` holds only necessary structural connections (this image belongs to this post; this email is about this post) — test: would the entity be orphaned without the link? Casual relatedness lives in `taxonomy[]` or is computed at query time. Reverse lookups ("who references me") give the cross-cutting analytics.

## 6. Task model

- Every task has **one primary entity** (`entity_type`, `entity_id`) and may reference others for context.
- **Virtual entity types** (`customer`/`order`/`project`) stay in their source sheets — `entity_id` is the source row id (`sc_Email`, order id, `spro_ProjectId`); library types point at a `SysLibrary` slug. One attachment pattern across the board (SysTasks `st_EntityType`/`st_EntityId`, appended per the schema-append-only rule; the old typed FK columns retire in a later cleanup).
- Reuses the existing SysTasks date semantics + `flow_pattern`/`due_pattern` (see `DATA_MODEL.md` SysTasks + WORKFLOWS §12) — the library plan inherits, doesn't redesign.
- **Task taxonomy:** Evyatar-facing (review/edit/translate/image-select), admin-facing (publish/schedule/distribute, closed manually post-session), system (housekeeping, closes itself). The library *upgrades* each task with attached assets + context (e.g. a translate task carries the pre-drafted HE) — same list, faster time-to-action.

## 7. Activity log

Per-entity log (`SysLibraryActivity`, schema in `DATA_MODEL.md`), polymorphically attached via `(slba_EntityType, slba_EntityId)`. `slba_Actor` ∈ claude/ops/admin/evyatar/customer/system or the logged-in user. `customer` = customer-initiated events (order placed); telemetry (opens/clicks) stays in Mailchimp (§13). Generic shape, same log for any entity; `SysContactActivity` becomes a filtered view (`slba_EntityType='customer'`).

## 8. Workflow model

Workflows are wiring: **trigger** (entity state change, or external event) → **action** (spawn task(s), optionally create entity rows) → **completion handler** (on task close: update state, write activity log, maybe fire next).

- **Chain spawn creates entities.** `LibraryService.spawnContentChain` (forked from the live `WebAppProjects_createContentStream`, which keeps serving AdminProjectsView) writes the entity row(s) + tasks in one call. A blog chain creates `blog-<topic>-en` + `-he` stubs (draft, no doc) and one task per admin-checked stage, attached to the appropriate language sibling. Task type names are language-neutral (`task.content.edit`, `.translate`); language lives on the entity row. Spacing falls out of each task's `due_pattern`; no `chains.json`/`stagger_days`. Idempotency = slug uniqueness + `createTask`'s existing dedup, so re-spawning a topic is safe.
- **On-demand doc creation:** chain spawn leaves the Drive DOC unattached; the task pack offers "Create blank Doc" / "Attach existing Doc" when the manager opens the task. (No ops-side auto-translate — the manager iterates with Gemini in his Drive workspace.)
- **Where artifacts come from:** blog MD → Claude writes locally, registers, stays in git; HE DOC → manager via "Create blank Doc"; newsletter PDF / email HTML / images → built or generated, uploaded to Drive on lock, registered; product images → WP only; templates/mentions/social → the entity row is the whole thing.
- **Peer-realignment (§10)** is the cross-language coherence mechanism, fired at lock time.

## 9. UI shape

- **Sidebar nav = preset filters** over one substrate: Library (firehose), Blog, Campaigns (`email`/`news`/`mention`/`social` — surfaces the §13 KPI columns), Templates, Images, Contacts, Tasks. Each preset shows type-specific columns + actions; the per-domain mental model is preserved.
- **Drawer = inspection, task pack = action — keep the boundary clean.** The entity drawer (centered modal-overlay) shows files/URLs, state history, activity log, attached tasks, references in/out, and context actions (Open in Drive, Create Content Tasks, Create HE sibling stub). It is *not* where locking/publishing happen — locking always goes through the task it closes (§15: "task closure = version lock"). Packs are focused action surfaces that compose from a shared widget kit (status pill, due chip, file-link chip, the Comax/Web/ops comparison widget); each declares its form (inline expand / modal / dedicated view).
- **Convergence:** one Tasks surface owns create + do + manage; the library is the entity catalog. The chosen design is a Master-Detail **`AdminTasksView`** that lifts AdminProjectsView's table + manage-form and folds LibraryView's `packBody()` in as a DO region — full spec in `ADMIN_TASK_UI_PLAN.md`. Nav stays additive (Library kept; Projects demoted to a soak-period fallback, retired once proven). Project is a library entity + filter chip, not a container view.
- **Mobile:** the queue is responsive (list → tap → focused action view, not expand-in-place). Per-pack action views declare mobile or desktop-only; shared widgets are made responsive once.

## 10. Templates as entities

Replaces content-shaped SysConfig rows (SysConfig stays for true config). Templates split by **both channel and language** (`template-welcome-email-en`, `…-whatsapp-he`); each combination is independently drafted + locked. Outreach tasks reference a template by slug + version; the latest locked version is active (no separate pointer).

**Peer-realignment via lock-time prompt** (replaces forced version alignment): locking one language asks *"does the peer need editing for this change?"* — Yes spawns a realignment task on the peer (pair is "drifting" until it locks or the task is closed "no change"); No is recorded in the activity log. **Outreach/publish blocks only on an *open* peer-realignment task**, never on a bare version-number mismatch (deliberate mismatch is allowed). Applies to all sibling types.

**Migration is per family, opt-in, no big-bang:** welcome first as the pattern-setter (no consumer code today — pure scaffolding via an extended `register-library.js`, rows written at locked/v1); pending-payment next as the first consumer-bearing migration (rewire `HousekeepingService` send to read the template entity + write a `template_send` activity entry). SysConfig content rows that haven't migrated still work the old way; retirement happens in passes alongside the migrations.

## 11. Taxonomy & cross-linking

Shared vocabulary lives in the ops lookup tabs (product attribute codes: intensity/complexity/acidity/grapes/etc.). Library entities use the **same codes** via `taxonomy[]` — a post tagged `intensity=IN3` matches every product whose `wdm_Intensity` is `IN3`; no new vocabulary infra.

**Cross-linking renders at publish, ops-side** — no WP custom taxonomies, no taxonomy sync into WP. The model is the existing `WooCommerceFormatter.formatDescriptionHTML()`: take an entity's `taxonomy[]` codes, query product data for matches, emit a "related products" HTML block injected into the post body at publish (and the reverse PDP "related posts" via a custom field). Prerequisites: the lookup-add UI (shipped) and the **regions overhaul** (§14) — region codes need cleanup + EN-primary keying before region cross-linking works.

## 12. Slug convention

The slug is the canonical join key across the library row, Canva title, Mailchimp campaign name, Drive file, and jlmops ID columns. Pattern `<type>-<topic-or-series>-<discriminator>[-<language>]`, lowercase kebab-case, type-prefix first, language last; immutable + globally unique. Full definition + cross-system mapping in `DATA_MODEL.md` (SysLibrary). Examples: `blog-context-en`, `image-context-body-01`, `news-2606-he`, `template-welcome-email-en`.

## 13. KPI ingest (deferred)

Campaign entities carry KPI stats as columns on the entity row, refreshed on cadence by ops — the library becomes a lightweight analytics surface alongside authoring. The row holds stable IDs (`mailchimp_campaign_id`, coupon code + UTM) + derived stats (`open_rate`/`click_rate`/`attributed_orders`/`attributed_revenue`, etc.). Refresh sources: Mailchimp API for email; platform APIs (or manual) for social; the orders sheet for coupon redemptions + attribution (via `wom_CampaignId`). What stays *out*: live click-stream (GA4) and per-recipient engagement (Mailchimp) — the library indexes outward, deep-links, doesn't duplicate. This enables single-substrate queries (e.g. attributed revenue across all emails referencing a given post). **Refresh cadence/ownership/UI are out of scope** — a downstream KPI-ingest plan owns them; the library plan only establishes that stats live as entity columns.

## 14. Current state & remaining phases

**Shipped (phases ~1–9):** library schema + Drive-MCP read access; blog + image entities via `content/register-library.js`; the read-only `LibraryView` (parallel nav entry alongside the v2 dashboards — never a route swap); the orphan-integrity report; `LibraryService` (addEntity / spawnContentChain / createBlankDoc / attachExistingDoc / lockVersion / logEntityActivity) + the content-stream chain spawn + Content edit/publish packs; the entity detail drawer.

**Open intent:**
- **Templates migration** (§10) — welcome, then pending-payment, then cooling/VIP/win-back as they become real.
- **Distribution events (phase 11)** — `email`/`news`/`mention`/`social` as entities + a spawner for the 16 dormant distribution task templates. `email` first (reuses blog's `CONTENT_STAGES`, repurposing the `email` stage as the Mailchimp "schedule send" step; `register-library.js` gains an update mode to patch a sent campaign's row to `published` + Mailchimp metadata). From June 2026 each issue + companion email + mentions register as library entities.
- **Cross-link renderer (phase 12)** — §11; post→product direction first, then PDP→post. Blocked on the regions overhaul for the region dimension.
- **Regions overhaul (prerequisite)** — define the canonical EN region list, add EN codes + EN/HE labels to the texts lookup, repoint product rows (one-pass sweep if small, else organic). Fixes editorial misalignment, invalid pairings, and the HE-primary inconsistency.
- **Customer migration / project absorption** (low priority) — move SysContacts / collapse PROJ-X into the entity table only when there's a real benefit.
- **Product images** — separate plan once the post side is settled.
- **Book assembly** (long-term) — a book is a filtered + ordered view of existing entities; no special type. Mentioned only to confirm the model is forward-compatible.

**Workbook placement (architectural constraint):** `SysLibrary` lives in the separate single-tab `JLMops_Library` workbook (Drive-MCP read access); `SysLibraryActivity` and any ops-only library tables live inside `JLMops_Data`. Detail in `DATA_MODEL.md`. Rule before adding any sheet/file for this plan: *does Claude need to read it via Drive MCP?* Yes → separate single-tab workbook + a `system.spreadsheet.<name>` row; no → a tab in `JLMops_Data`.

## 15. Foundational principles

The durable reference card — what doesn't change.

- **Library is the entity layer**, not a fourth container. **Three primitives:** entities, tasks, activity logs; workflows are wiring.
- **No parent/child between entities;** references only (necessary structural links), many-to-many. Casual relatedness → `taxonomy[]` or query-time.
- **One task attachment model:** primary entity + N references via polymorphic `(entity_type, entity_id)`; virtual types point at their source sheets.
- **Tasks ≠ admin reports** — tasks for any human work (manual close is a trivial click); in-session reports for everything else.
- **Active updates beat passive detection** at this scale; passive is a narrow fallback for Evyatar's artifacts only.
- **Drive holds locked editorial artifacts** (MD in git, DOC for editing in Drive, images/email-HTML/newsletter-PDFs locked in Drive, product images in WP only). Generation tools are surfaces, not archives.
- **Task closure = version lock; new task = new version.** One slug, one current version; no intra-version history. No automation for cross-version recovery; no content snapshots — rely on external system history.
- **Product attributes drive post↔product linking;** posts carry no SKU FKs.
- **Templates as entities** replace SysConfig content rows, migrated incrementally per family. **CRM stays as-is** until a benefit shows up. **Campaigns absorb** into the library; `SysMarketingCampaigns` retires over time. **Projects survive only for cross-entity work.**
- **Two write paths** (UI via `LibraryService`; session direct to `SysLibrary` via Sheets API); session never writes the activity log; state transitions are UI-only.
- **Admin initiates, manager executes** (admin creates/spawns; manager works the queue; LibraryView gates admin controls via `data-roles="admin"`).
- **Library file = Claude's read surface;** no general-purpose export pipe. **Publishing stays external** (blog via `content/push-posts.js`; Mailchimp/social/WhatsApp/video manual; "publish" tasks close as confirmations recording the external URL). **Publishing calendar stays markdown** (`content/PUBLICATION_CALENDAR.md`).
- **Build for current scale (~14 pieces); bake the data model for hundreds. Don't rewrite working code** for cleanliness.
