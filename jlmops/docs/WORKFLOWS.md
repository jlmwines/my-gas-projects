
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

**Coverage gaps (current — a tracked fix closes these; see `.claude/bugs.md`).** Until that fix ships, some auto-created tasks do not resolve to a real project:

- **`Content`** (16 task types) maps to `PROJ-CONTENT`, which is **not yet seeded** in `SysProjects`. These tasks are still tracked operationally via their Library entity (`st_EntityId`). Fix: seed `PROJ-CONTENT` as a user-managed project (plain id, not `PROJ-SYS_`, since users own its tasks).
- **`Marketing`** (15 task types) has **no map entry**. Fix: fold into Content (add `Marketing → PROJ-CONTENT`).
- **`Data`** (2 task types) has **no map entry**. Fix: re-topic per domain — `task.data.review` (cities lookup) → `CRM` (→ `PROJ-SYS_CRM`); `task.data.coupons_update` → `Marketing` (→ Content). The `Data` topic then retires.

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

How a piece of editorial content gets produced — stage by stage, by whom, on which surface. §12 covers the assignment *mechanics* (flow patterns, due dates, routing); this section assembles them into the end-to-end editorial flow. Sources of truth: `CONTENT_STAGES` (`WebAppProjects.js`), per-type `flow_pattern` (`config/taskDefinitions.json`), the `slb_State` lifecycle (`DATA_MODEL.md`), and the task packs (`TaskPacks.html`).

### 13.1 Surfaces

- **Admin** works content tasks in **AdminTasksView** — the task workbench (create / do / manage).
- **Manager** works content tasks in the **Dashboard queue** — their only task surface; there is no separate manager workbench.
- **Library** (both roles) is the entity catalog, not a task surface. Its **Deficiency** preset is the publication-calendar / demand view (pieces due within the rolling window plus overdue); its **entity drawer** shows a piece's Family, attached tasks, files (Open Doc), and admin lifecycle actions (spawn chain, Request Correction, Abandon).

Every content task renders the same shared **pack** (`TaskPacks`) wherever it appears, so the DO controls are identical on every surface.

### 13.2 The blog chain

Spawning a blog chain (admin: AdminTasks **+ Content**, or Library **Create Content Tasks**) creates an **EN + HE entity pair** at state `draft` and all stage tasks at once. Assignment is set automatically from each type's `flow_pattern`:

| # | Stage | Task type | Lang | Assignee | Pack action |
|---|---|---|---|---|---|
| 1 | Create WP Stubs | `content.create_wp_stubs` | EN+HE | Admin | skeleton |
| 2 | Draft | `content.draft` | EN | Admin (Claude drafts) | Create/Open Doc → Lock + Version |
| 3 | Admin Review | `content.admin_review` | EN | Admin | skeleton |
| 4 | **Edit** | `content.edit` | EN | **Manager** | Open Doc → Lock + Version |
| 5 | Translate | `content.translate` | HE | Admin | Open Doc (+EN source) → Lock + Version |
| 6 | **Translate Edit** | `content.translate_edit` | HE | **Manager** | Open Doc (+EN source) → Lock + Version |
| 7 | Images | `content.images` | EN | Admin | Open Doc → Lock + Version |
| 8 | Blog Publish | `content.blog_publish` | EN+HE | Admin | External URL → Mark Published |

The same EN/HE chain mechanics apply to all **sibling-language types** (`blog`, `news`, `mention`, `email`, `social`, `template`) — e.g. templates also spawn as `-en`/`-he` pairs. The **manager owns the two editorial passes** (Edit EN, Edit Translation HE); admin/Claude owns drafting, translating, images, and publishing. Companion stages (video, email, social, whatsapp, newsletter) can be added to the same chain and are admin-assigned distribution tasks.

### 13.3 Manager turnaround (click-path)

**Edit (EN):**
1. Open the app → land on the **Dashboard**.
2. Find the **"Edit: <title>"** row (assigned Manager, topic Content) → **click to expand**.
3. The pack shows **Open Doc** (the EN draft), a Notes box, and **Lock + Version** (with the current `v… · state`).
4. Edit the draft in Google Docs.
5. Click **Lock + Version** → answer the peer prompt *"does the Hebrew sibling need editing?"* — **No, just lock**, or **Yes, spawn realign** (auto-creates a realign task on the HE peer).
6. This bumps `slb_Version`, sets the entity `locked`, and **closes the task**.

**Translate Edit (HE):** identical, plus an **Open EN source** link (the locked English) for side-by-side reference; the peer prompt is about the EN sibling.

Content tasks have **no New/In-Progress/Done dropdown** (that control exists only for generic tasks) — a content task is either open or closed via its pack action. The manager can **Revert** a row to hand it back to admin.

### 13.4 Lifecycle and publishing

State moves **only by completing the owning task** — there is no manual status-set, by design:

- edit / translate tasks → **Lock + Version** → `locked`, version +1 (`LibraryService.lockVersion`).
- publish task → **Mark Published** (+ optional external URL) → `published` (`LibraryService.markPublished`).
- admin drawer **Abandon** → `abandoned` (terminal; filtered out of the Deficiency view).

Full state reference: `DATA_MODEL.md` (`slb_State`: `draft → locked → published`, plus terminal `abandoned`).

### 13.5 Correcting a published piece

Admin opens the entity drawer → **Request Correction** (published pieces only) → spawns a fresh `content.edit` task; the piece stays `published` while it is open. **Known limitation (accepted — corrections are rare):** completing that edit Lock+Versions the entity to `locked` and no publish task is spawned, so it must be re-published manually. Revisit (spawn an edit+publish mini-chain) only if corrections become common.

### 13.6 Templates (email/WhatsApp) — Doc-sourced, edited like any content

Templates are sibling-language content like blogs (EN/HE pairs) and are edited through the same Edit / Edit-Translation tasks. Their content lives in **Docs** (`slb_DocUrl`), not inline: a manager opens the Doc, edits, and finishes with **Editing Done**. The **system reads template content from the Doc at runtime** — the pending-payment follow-up send (`HousekeepingService`) resolves the email + first-time addendum via `LibraryService.getEntityContent` (Doc-first, inline-field fallback). So editing a template's Doc changes what the system sends; the legacy inline `slb_Subject`/`slb_Body` fields are a migration fallback only. Full content-source model: `DATA_MODEL.md` (`SysLibrary` → "Content source of truth"). Scaffolding still to retire once migration is fully confirmed: `createBlankDoc` seeding, the inline fields, and admin-gating the Create-Doc action (it isn't part of the manager's normal flow).
