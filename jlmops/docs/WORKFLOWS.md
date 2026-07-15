
## 11. Daily Sync Workflow (Automated & Guided)

This workflow orchestrates the synchronization of data between the Web (WooCommerce) and the ERP (Comax), ensuring inventory accuracy and data integrity.

### 11.1. Steps & Logic

1.  **Import Web Data:**
    *   **Action:** User clicks "Start".
    *   **Process:** The system imports the latest `WebOrders.csv`, `WebProducts.csv`, and `WebTranslations.csv` from the source folder.
    *   **State:** Transitions to `WEB_IMPORT_PROCESSING`.

2.  **Export Orders (Conditional):**
    *   **Check:** The system checks if any eligible orders need to be exported to Comax.
    *   **If Orders Exist:**
        *   **Action:** User clicks "Export Orders".
        *   **Process:** A CSV file is generated for upload to Comax.
        *   **Action:** User clicks "Confirm Comax Update" after uploading.
    *   **If No Orders:**
        *   **Logic:** The system displays "No orders to export" and automatically enables the next step.

3.  **Import Comax Data:**
    *   **Action:** User clicks "Start Import" (after ensuring Comax export file is in source folder).
    *   **Process:** The system imports `ComaxProducts.csv` and updates master data.
    *   **State:** Transitions to `COMAX_IMPORT_PROCESSING`.

4.  **Validation (Automated):**
    *   **Trigger:** Automatically starts after Comax Import completes.
    *   **Process:** Runs master data validation (SKU checks, price integrity).
    *   **State:** Transitions to `VALIDATING`.

5.  **Export Web Inventory:**
    *   **Trigger:** Enabled only after Validation succeeds.
    *   **Action:** User clicks "Generate Export".
    *   **Process:** Generates a CSV diff of inventory changes for WooCommerce.
    *   **Action:** User clicks "Download Export" to get the file.
    *   **Action:** User clicks "Confirm Web Update" to complete the cycle.
    *   **State:** Transitions to `COMPLETE`.

### 11.2. Error Handling & Reset
*   **Failure:** If any step fails, the widget turns red and displays the error.
*   **Retry:** Users can retry specific actions (e.g., "Generate Export") without restarting the whole flow.
*   **Reset:** A "Reset" link is available to clear the state and start a fresh sync cycle if necessary.

---

## 12. Task Routing, Assignment & Dates

### 12.0 Project Routing on Creation

**Design rule:** every task belongs to exactly one project, carried in `st_ProjectId`. Routing is how that project is assigned at creation.

`createTask()` stamps each new task with a project. When the caller passes no explicit `options.projectId`, the task's topic (`options.topic`, else the task type's `topic`) is looked up in the `task.routing.topic_to_project` config map and the match becomes `st_ProjectId`. An explicit `options.projectId` always wins. There is currently no fallback: a topic with no map entry, or a topic mapped to an unseeded project, yields a task that does not satisfy the design rule (see Coverage gaps below).

**Topic → project map** (`task.routing.topic_to_project`, stored split-key in SysConfig):

| Topic | Project |
|-------|---------|
| `Products` | `PROJ-SYS_PRODUCT` |
| `WebXlt` | `PROJ-SYS_PRODUCT` |
| `Inventory` | `PROJ-SYS_INVENTORY` |
| `Orders` | `PROJ-SYS_ORDERS` |
| `System` | `PROJ-SYS_SYSTEM` |
| `CRM` | `PROJ-SYS_CRM` |
| `Contact` | `PROJ-SYS_CRM` |
| `Campaign` | `PROJ-SYS_CRM` |
| `Content` | `PROJ-CONTENT` |

To change routing, edit `config/system.json` → `node generate-config.js` → `clasp push` → `rebuildSysConfigFromSource()`.

**Project classes.** Routing targets fall into two kinds:

- **System-managed** — the `PROJ-SYS_*` projects (`SysProjects`, seeded Dec 2025): Product Data Quality (`PROJ-SYS_PRODUCT`), Inventory Management (`PROJ-SYS_INVENTORY`), System Health (`PROJ-SYS_SYSTEM`), Order Fulfillment (`PROJ-SYS_ORDERS`), CRM Operations (`PROJ-SYS_CRM`). They hold auto-generated system tasks and are **protected from deletion** (`ProjectService.deleteProject` rejects any `PROJ-SYS_` id).
- **User-managed** — projects where a person creates and works the tasks directly, e.g. `PROJ-CONTENT` (editorial content production). These must **not** carry the `PROJ-SYS_` prefix, precisely so they stay user-deletable/editable; system tasks cannot be handled the way content tasks are.

Campaign-type projects (e.g. Core Content, `PROJ-6878357E`) are created per program and carry a `spro_CampaignId`. Schema → `DATA_MODEL.md` (`SysProjects`).

**Coverage — complete.** The topic-map fix shipped 2026-06-22 (@339): `Marketing` now maps to `PROJ-CONTENT` and the two `Data` task types were re-topiced (`task.data.review` → `CRM`; `task.data.coupons_update` → `Marketing`). `PROJ-CONTENT` itself is seeded in `SysProjects` (confirmed live 2026-07-10: `PROJ-CONTENT, Content, CAMPAIGN, ACTIVE`) — every topic in the map now resolves to a real project row.

`Custom` (`task.project.custom`) is intentionally unmapped: user-created tasks require the user to choose a project (`WebAppTasks` rejects a missing one), so they already satisfy the rule.

### 12.1 Auto-Assignment on Creation

When `TaskService.createTask()` is called:
1. Task type config is loaded (includes `flow_pattern`, `due_pattern`)
2. If `flow_pattern` specifies initial assignee → auto-assign based on role
3. If auto-assigned, the following fields are set atomically:
   - `st_AssignedTo` = role name (Manager or Administrator)
   - `st_StartDate` = now
   - `st_Status` = 'Assigned'
   - `st_DueDate` = calculated from `due_pattern`

### 12.1.1 Flow Patterns

| Pattern | Initial Assignee | Description |
|---------|------------------|-------------|
| `admin_direct` | Administrator | Admin resolves directly |
| `manager_direct` | Manager | Manager resolves directly |
| `manager_to_admin_review` | Manager | Manager works, then hands off to Administrator on Review (e.g. `task.onboarding.add_product`, `task.validation.vintage_mismatch`) |

### 12.2 Due Date Patterns

| Pattern | Calculation |
|---------|-------------|
| `immediate` | Same day |
| `next_business_day` | +1 day, skip Fri/Sat to Sunday |
| `one_week` | +7 days |
| `two_weeks` | +14 days |

**Business Days (Israel):** Sun (0), Mon (1), Tue (2), Wed (3), Thu (4)
**Weekend:** Fri (5), Sat (6)

### 12.3 Date Field Rules

**Rule 1: Start Date on Creation**
- Only `immediate` due_pattern tasks get `st_StartDate` on creation
- Other tasks get start date when assigned

**Rule 2: Assignment Atomicity**
When a task is assigned (manually or automatically), ALL THREE fields must be set:
- `st_StartDate` = assignment time
- `st_Status` = 'Assigned'
- `st_DueDate` = calculated from due_pattern

**Invariant:** If any of these 3 fields has a value, all 3 must have values.

### 12.4 Manual Assignment

When user assigns task via UI:
1. Update `st_AssignedTo` to user email
2. Set `st_StartDate` = now (if not already set)
3. Set `st_Status` = 'Assigned'
4. Calculate and set `st_DueDate` based on task type's `due_pattern`

---

## 13. Content Production Workflow

How a piece of editorial content gets produced — stage by stage, by whom, on which surface. §12 covers the assignment *mechanics* (flow patterns, due dates, routing); this section assembles them into the end-to-end editorial flow. Rewritten for the `CALENDAR_LIBRARY_LOOP_PLAN` design (shipped 2026-07-08, jlmops @443–451): no automatic entity pairing, entities created lazily, task-derived status instead of `slb_State` display. Sources of truth: `CONTENT_STAGES` (`WebAppProjects.js`), per-type `flow_pattern` (`config/taskDefinitions.json`), the content-status model (`DATA_MODEL.md`), and the task packs (`TaskPacks.html`).

### 13.1 Surfaces

- **Admin** works content tasks in **AdminTasksView** — the task workbench (create / do / manage).
- **Manager** works content tasks in the **Dashboard queue** — their only task surface; there is no separate manager workbench.
- **Calendar** (`PublishingView.html`'s Calendar tab, backed by the `JLMops_Publishing` sheet) is the authoritative schedule/demand view — "calendar is king." Every row shows a live task-derived status, with a search box and status filter (not started / in progress / done / no tasks yet) in the title bar. Clicking a row opens the entity drawer (details) whenever an entity exists for that slug — its attached-tasks list is independently clickable to advance into a task from there; only rows with no entity yet (fresh spawn, no Doc attached) route straight to the earliest open task (role-aware: manager sees only tasks assigned to `'Manager'`). Redesigned 2026-07-09 (jlmops @461) — previously routed straight to a task with no confirmation step. New content is always started by picking an existing calendar row (`ContentStreamModal.html`) — never by typing a free-text name — so a row's `cal_Slug` is the single authority a spawned chain's slug always matches.
- **Library** (both roles) is the entity catalog, not a task surface and not the schedule view. Its **Deficiency** preset is a due/overdue list (pieces with a target date in the rolling window, or overdue and not yet done). Its **entity drawer** is deliberately minimal — header fields (title/slug/type/language/campaign/status), an actions bar (Open Doc, Attach new version, Create Content Tasks), and **Attached tasks** only. No Family, Files & URLs, References, State history, or Activity log sections — tasks tell the action story, the library just holds entities.

Every content task renders the same shared **pack** (`TaskPacks`) wherever it appears, so the DO controls are identical on every surface.

### 13.2 The content chain

Spawning a chain (admin: AdminTasks **+ Content**, Library **Create Content Tasks**, or a Calendar-row **Spawn** shortcut) picks an *existing calendar row* and creates **the task chain only** — every stage task at once, each carrying its stage-resolved slug (`baseSlug-en`/`baseSlug-he` per the stage's target language, or bare `baseSlug` for language-agnostic types) as its entity reference. **No `SysLibrary` entity row is created at spawn time, sibling or otherwise.**

| # | Stage | Task type | Lang | Assignee | Pack action |
|---|---|---|---|---|---|
| 1 | Create WP Stubs | `content.create_wp_stubs` | EN | Admin | skeleton |
| 2 | Draft | `content.draft` | EN | Admin (Claude drafts) | Create/Attach Doc → Editing Done |
| 3 | Admin Review | `content.admin_review` | EN | Admin | skeleton |
| 4 | **Edit** | `content.edit` | EN | **Manager** | Open Doc → Editing Done |
| 5 | Translate | `content.translate` | HE | Admin | **Create translation text** (when the EN peer has a Doc) → Editing Done |
| 6 | **Translate Edit** | `content.translate_edit` | HE | **Manager** | Open Doc → Editing Done |
| 7 | Images | `content.images` | EN | Admin | Open Doc → Editing Done |
| 8 | Blog Publish | `content.blog_publish` | EN | Admin | External URL → Mark Published |

**An entity comes into being the first time a Doc is attached or created against its slug** (`createBlankDoc`/`attachExistingDoc` in `LibraryService.js`, auto-creating via `_ensureEntity` — type/language/title derived from the slug itself). Concretely: the EN entity appears whenever stage 1–4 work actually starts (whichever task first attaches a Doc); the HE entity appears when stage 5's "Create translation text" runs, which copies the EN Doc, prepends the Gemini prompt, and attaches the copy — the HE entity is a byproduct of that attach, not a separate creation step. This applies uniformly to every sibling-language type (`blog`, `news`, `mention`, `email`, `social`, `template`) — none are batch-provisioned as pairs, ever. The **manager owns the two editorial passes** (Edit EN, Edit Translation HE); admin/Claude owns drafting, translating, images, and publishing. Companion stages (video, email, social, whatsapp, newsletter) can be added to the same chain and are admin-assigned distribution tasks.

### 13.3 Manager turnaround (click-path)

**Edit (EN):**
1. Open the app → land on the **Dashboard**.
2. Find the **"Edit: <title>"** row (assigned Manager, topic Content) → **click to expand**.
3. The pack shows **Open Doc** (or **Create/Attach Doc** if the entity doesn't exist yet — attaching one creates it) and a Notes box.
4. Edit the draft in Google Docs.
5. Click **Editing Done** → a plain confirm ("Mark editing done for '\<slug>'?"), no peer prompt of any kind.

**Translate Edit (HE):** identical — Open Doc → Editing Done. No "Open EN source" link; the manager already has direct Drive/Library/Task access if they want to look at the English side independently.

**Translate (HE, usually admin, sometimes manager):** the pack shows **Create translation text** once the EN peer (a deterministic slug flip, `baseSlug-en`) has a Doc — copies it, prepends the Gemini translation prompt (`_getTranslationPrompt()`, Doc-sourced, editable without a deploy), and attaches the result as this entity's Doc, creating the entity if it didn't exist yet. Stays available regardless of whether the EN edit task was finished today or last week — no Done-status gate, so it's always reachable in the normal open-task queue.

Content tasks have **no New/In-Progress/Done dropdown** (that control exists only for generic tasks) — a content task is either open or closed via its pack action. The manager can **Revert** a row to hand it back to admin.

### 13.4 Lifecycle and publishing

Two different things now answer "how's this going," and they're not the same field:

- **Displayed status** (Library rows, entity drawer, Calendar rows) is computed live from open task status — never read from `slb_State`. Three tiers: **not started** (open tasks exist, all still `New`), **in progress** (an open task is `Assigned`/`Review`), **done** (every task `Done`/`Cancelled`, or none ever spawned). Computed fresh on every render (`TaskWidgets.deriveStatus`), never cached or persisted.
- **`slb_State`** still exists as a column but only two of its values are ever written deliberately, and neither is displayed as "the state" anymore: **`abandoned`** (admin drawer action, terminal) and **`published`** (publish task's **Mark Published**, + optional external URL, `LibraryService.markPublished`). Both gate specific drawer actions (Request Correction shows only when `published`; Abandon hides once `published`/`abandoned`) but nothing shows the raw value as a status pill. `draft`/`locked` are set at creation and by `lockVersion` respectively but are never read anywhere — dead weight kept only because columns are append-only, never removed.
- **`lockVersion`** ("Editing Done") no longer sets `slb_State` to `locked` in any way that matters for display — it closes the task and bumps `slb_LastTouched`, full stop. No peer-realignment branch exists (removed with auto-pairing).

Full field reference: `DATA_MODEL.md`.

### 13.5 Correcting a published piece

Admin opens the entity drawer → **Request Correction** (published pieces only) → spawns a fresh `content.edit` task; the piece stays `published` while it is open. **Known limitation (accepted — corrections are rare):** completing that edit task doesn't spawn a publish task, so it must be re-published manually. Revisit (spawn an edit+publish mini-chain) only if corrections become common.

### 13.6 Templates (email/WhatsApp) — Doc-sourced, edited like any content

Templates are a sibling-language type like blogs — **no longer auto-paired**, same as every other type (§13.2): each language's entity is created lazily on first Doc attach, independently. Edited through the same Edit / Edit-Translation tasks. Their content lives in **Docs** (`slb_DocUrl`), not inline: a manager opens the Doc, edits, and finishes with **Editing Done**. The **system reads template content from the Doc at runtime** — the pending-payment follow-up send (`HousekeepingService`) resolves the email + first-time addendum via `LibraryService.getEntityContent` (Doc-first, inline-field fallback). So editing a template's Doc changes what the system sends; the legacy inline `slb_Subject`/`slb_Body` fields are a migration fallback only. Full content-source model: `DATA_MODEL.md` (`SysLibrary` → "Content source of truth"). Scaffolding still to retire once migration is fully confirmed: `createBlankDoc` seeding, the inline fields, and admin-gating the Create-Doc action (it isn't part of the manager's normal flow).

---

## 14. New Product Onboarding Pipeline

Moves a product from Comax-only existence through data preparation, WooCommerce publication, and full system integration. Two task types: `task.onboarding.suggestion` (stage 1) and `task.onboarding.add_product` (stages 2–5). Flow pattern: `manager_to_admin_review`.

### 14.1 Stage 1 — Suggestion (manager submits, admin accepts)

Manager finds a Comax product not yet on the web store and submits it from ManagerProductsView → New Products tab. This creates a `task.onboarding.suggestion` task.

Admin opens the suggestion in AdminProductsView → New Products → Candidates and clicks Accept. The accept dialog fields, in fill order: EN name, EN Woo Post ID, HE name, then a required "I've marked this SKU 'Sold Online' in Comax" checkbox. **Admin must create the EN draft product in WooCommerce first, then use WPML "Create Translation" to get the HE draft, before accepting** — both Woo drafts must exist at accept time. The checkbox is a manual acknowledgment only (JLMops has no write-path to the Comax ERP) — it gates Submit but doesn't itself update anything; the admin still has to flip the flag in Comax directly. This folds the old Stage 5 Comax update forward to acceptance time instead of leaving it for after publish.

`acceptProductSuggestion` on accept atomically:
- Completes the suggestion task
- Creates `task.onboarding.add_product` assigned to Manager
- Seeds **WebDetS** (staging) with EN/HE names
- Inserts **WebProdM** row: SKU, EN name (`wpm_PostTitle`), price + stock from CmxProdM, Woo Post ID (`wpm_ID`)
- Inserts **WebDetM** row: SKU, EN/HE names, `wdm_WebIdEn`
- Sets `cpm_IsWeb=true` in CmxProdM (the JLMops-side mirror only — separate from the checkbox above, which covers the actual Comax ERP)

### 14.2 Stage 2 — Detail submission (manager)

Manager opens the product in ManagerProductsView → Detail Updates tab (surfaced via the `task.onboarding.add_product` task pack). Fills in product details (region, grape varieties, tasting notes, kashrut, etc.) in WebDetS staging and submits. Task status moves to Review.

### 14.3 Stage 3 — Detail acceptance (admin)

Admin reviews submissions in AdminProductsView → Detail Updates. On accept, `acceptProductDetails` writes WebDetM from WebDetS and deletes the WebDetS staging row. Task status moves to Accepted.

### 14.4 Stage 4 — Export and publish (manual)

Admin exports product details (Detail export on AdminProductsView) to generate the WooCommerce update file. Admin publishes the EN and HE Woo products. Admin clicks "Confirm Published" in AdminProductsView → closes the `task.onboarding.add_product` task to Done.

### 14.5 Stage 5 — Comax update (manual, now normally pre-empted by Stage 1)

Historically a separate step: admin updates the product record in Comax to mark it active on the web store. Now that Stage 1's accept dialog requires acknowledging this at acceptance, this stage should already be satisfied by the time a product reaches Stage 4/5 — kept here as a fallback check, not the primary trigger.

### 14.6 Next sync

The next daily sync's EN pull finds the SKU already in WebProdM (seeded at accept) and updates price, stock, and status. The HE pull rebuilds WebXltM wholesale, adding the `wxm_WpmlOriginalId` link for the new product.

### 14.7 Translation validation

The validation rule `master_translation_missing` checks that every WebProdM row has a matching WebXltM entry (`wxm_WpmlOriginalId = wpm_ID`). `acceptProductSuggestion` seeds the WebXltM row at accept time by fetching the EN product from the Woo REST API, reading `translations.he`, and upserting the row immediately. The daily sync still rebuilds WebXltM wholesale on each run. Refresh Translations (AdminProductsView → New Products tab) remains available for manual corrections.

---

## 15. Bundle Management Workflow

JLMops authors bundle/package composition; WooCommerce (WPClever) is the published record. Schema → `DATA_MODEL.md` "Bundle Management Data Model". Code: `BundleService.js`, `AdminBundlesView.html`.

### 15.1 Refresh cadence

Three independent clocks: (1) **Pull Bundle Data** — on-demand button, WC REST `?type=woosb`, writes composition + WOOSB discount fields straight to `WebProdM`/`WebXltM` master (bundles are exempt from Comax validation, so this bypasses staging safely). (2) **Update Composition** — re-derives `SysBundles`/`SysBundleSlots` from master only, no WC pull; also runs daily via housekeeping (`refreshBundleComposition`), preserving the JLMops-owned fields (`sb_MinTotal`/`MaxTotal`/`LastGenerated`/`GenFlags`) across the rewrite. (3) **Export** — out-of-stock failsafe check runs just before producing the copy-paste `woosb_ids` meta; this is the only fresh-stock gate the export path itself needs, since everything upstream (Maintain/Re-roll) already worked from live data.

### 15.2 Deficiency — the one test everything shares

A **slot** is deficient if its current wine is: out/low-stock (available = Comax stock − on-hold quantity < `system.inventory.minimum_stock`), no longer satisfies its own criteria (category/price/attributes — including `sbs_PriceMax`, the "over-band" case), or (for a base, qty≥1 slot) has no wine assigned at all. A **bundle** is deficient if any slot is, or its base total (Σ price×qty over base slots; flexible qty-0 slots contribute 0) falls outside `[sb_MinTotal, sb_MaxTotal]`.

This single definition (`BundleService._evaluateBundleDeficiency`) drives: the "Needs attention" list badge and `task.bundles.needs_update` (via `checkBundleHealth`, cached in `system.bundles.needs_update_status`), the editor's live "why" strip when a flagged bundle is opened (always a fresh check, not cached), and — since the fix below — Maintain/Re-roll's own self-check of its output.

### 15.3 Maintain vs. Re-roll

Both run the same structure-preserving generator (`_generateBundleComposition`) — it swaps the wine *in* a slot, never adds/removes slots; slot structure (count, criteria, flex vs. base) is authored by hand.

- **Maintain (default).** Re-picks only slots the deficiency test currently flags; keeps every still-valid wine. One bundle (editor) or every deficient bundle (bulk, from the dashboard).
- **Re-roll (explicit).** Re-picks every product slot regardless of current deficiency — higher churn, for a seasonal reset or "give me new wines."

**Per-slot pick:** candidates = in-criteria, in-stock (live Comax stock − on-hold), not already used elsewhere in the bundle, not `sbs_Exclusive`-reserved to another bundle, ranked by profit (blank → neutral 0.25) + cross-bundle diversity (fewer other bundles using this SKU ranks higher) + stock, under a running per-slot price ceiling (`sbs_PriceMax`, else the remaining `sb_MaxTotal` ÷ remaining base slots). If no candidate clears the pool, the slot keeps its current wine rather than exporting blank or breaking category — this is a legitimate, expected outcome, not a bug, when nothing in stock fits.

**Band enforcement**, after the per-slot fill: a top-up pass upgrades the cheapest-headroom slot while the base total is under `sb_MinTotal` (never breaching `sb_MaxTotal`); a symmetric down-pass downgrades the priciest slot while over `sb_MaxTotal`. Both are monotone (strictly better each step) and terminate.

### 15.4 Self-check — the result is only "ok" if it actually is

The generator's fill/top-up/down-pass loops keep their own internal bookkeeping while they run, but that bookkeeping is **not** the final word: after picks are final, the generator re-runs the same §15.2 deficiency test against its own result (no extra sheet reads — reuses the run's already-loaded inventory snapshot) and writes *that* verdict to `sb_GenFlags`, not its own narrower accounting. A run only reports clean when the real test agrees — including the case where nothing changed at all (a flexible add-on slot that found zero candidates used to fail silently, with no flag; it's now covered by the same check).

`sb_GenFlags` format: `below_min:total=X,min=Y` / `above_max:total=X,max=Y` for a band miss; `<stock|criteria|empty>:<slotId>[:avail=N,min=M][:searched=N,cheapest=P,ceiling=C]` per still-deficient slot — real numbers, not a bare code. Rendered in the editor's generation-status line and the Maintain/Re-roll results table (`AdminBundlesView.html`).

### 15.5 Export gate

Nothing reaches the website until Export. Export selects every bundle whose serialized ops composition differs from the current web `woosb_ids` (a token/order/text-agnostic product-multiset comparison) — covering both "changed this session" and "already drifted, unnoticed" cases in one test. Delivered as a CSV (EN/HE `woosb_ids` cells) pasted into WPClever manually. Un-exported edits are volatile by design — the next Update Composition re-derives from master and, if the edit was never exported, it's gone; this is accepted (ops-as-source-of-truth, publish-or-lost).

## 16. Product Detail Task Load Performance

Three fixes, one theme: read-heavy per-open sheet scans replaced with either a one-time snapshot (where staleness genuinely doesn't matter) or a housekeeping-cadence cache (where it's fine but the data still needs to stay roughly current).

### 16.1 Product-detail snapshot (add / vintage-drift / verify-conversion)

The manager's product editor (`ManagerProductsView.html`, backed by `ProductService.getProductDetails`) used to read WebDetM, WebDetS, CmxProdM, WebProdM live on every open — slow, and repeated on every click. Since product-detail data only changes on three triggers (new product added, annual vintage change, failed verification) and staleness between task-creation and manager-open doesn't matter (the physical product label is the real source of truth, not the on-screen reference), each of those three moments now writes a `{ master, staging, comax }` snapshot to the task's `st_DetailSnapshot` column instead:

- **Add** (`task.onboarding.add_product`) — `ProductService.acceptProductSuggestion` builds the snapshot from data it already gathers onboarding the product; no extra read.
- **Vintage-drift** (`task.validation.vintage_mismatch`, created by `ValidationOrchestratorService._createIndividualTask` off the `validation.comax.vintage_mismatch` rule) — the rule's own discrepancy data only covers CmxProdM/CmxProdS, so this path does one extra `ProductService.getWebDetailRows(sku)` read (WebDetM + WebDetS) at creation — paid once per validation pass, not per manager open.
- **Verification-fail conversion** (`WebAppProducts_passVerifyToManager`, converting an existing `task.product.verify` task onto `task.validation.vintage_mismatch` per the 2026-06-17 decision) — nothing was in memory at this point, so all three reads (WebDetM, WebDetS, CmxProdM) happen once here, at conversion.

`WebAppProducts_loadProductEditorData` checks the task's `st_DetailSnapshot` first; if present, it skips the live sheet reads entirely (still fetching the catalog-wide lookup lists — regions/grapes/kashrut/abvOptions, via `ProductService.getProductLookups` — since those aren't per-product). Falls back to a live `getProductDetails` read when absent (tasks created before this shipped). Task-row lookup itself uses a `TextFinder` scoped to the `st_TaskId` column (`WebAppProducts._findTaskRowFast`) rather than reading all of `SysTasks` — that sheet has grown large enough that a full scan costs multiple seconds on its own.

### 16.2 Verify batch-walk bulk-prefetch

The read-only verification modal (`ManagerProductsView.loadVerifyDetail`, backed by `ProductService.getVerifyDetail`) needs *current* Comax/Web data — it's checking for live drift, so a creation-time snapshot would defeat the point. Instead, since the manager's batch walk (`startVerifyWalk`/`startVerifyAt`) already knows its full SKU list before stepping through it, `ProductService.getVerifyDetailsBulk(skus)` reads CmxProdM + WebProdM once for the whole queue at walk-start; each step then reads from that client-side cache (`ManagerProductsView.verifyDetailCache`) instead of a fresh round-trip, falling back to a live single-SKU call on a cache miss.

### 16.3 Category-stock health moved to housekeeping

`WebAppProducts_getManagerWidgetData` used to compute category stock-health live on every widget load (full CmxProdM scan) and create `task.deficiency.category_stock` tasks inline — each creation also paying a full `SysTasks` de-dup scan. Feeds the new-product-suggestion tool's category filter badges, which tolerate staleness fine. Moved to `HousekeepingService.checkCategoryStockHealth`, run on the frequent-maintenance cadence, cached in `system.category_stock.health` (`{ allCategories, deficientCategories, deficientCategoriesCount, ts }`) — the widget just reads the cache.

### 16.4 `WebAppTasks.getOpenTasks` cache fix

Its "60-second cache" was a module-level variable — always cold on a fresh `google.script.run` call (each call runs in a new execution context), so it silently did a full uncached `SysTasks` read every time despite the comment claiming caching. Replaced with `CacheService` (60s TTL), which actually persists across calls; if the open-tasks payload is too large to fit `CacheService`'s 100KB cap, it's simply not cached (same as the prior always-uncached behavior) rather than failing.
