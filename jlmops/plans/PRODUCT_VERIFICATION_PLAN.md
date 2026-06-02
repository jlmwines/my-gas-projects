# Product Verification — Plan

**Created:** 2026-05-14
**Status:** **SHIPPED 2026-06-02 (jlmops deploy @199).** Read-only review surface (look-and-note; two actions: Confirm & close / Revert to admin). All editing lives in the separate update-details task. Category check is show-don't-compare (no `SysLkp_Texts` join). Count-flow strip (below) intentionally NOT shipped — deferred until verification proves out ~1 cycle in production.

**As-built deltas (vs this plan's pre-build text):**
- **Everything product-side** (resolved during build): the creation card lives on `AdminProductsView`; planning/create/complete/stamp + a new `getVerifyDetail` all live in `ProductService` + `WebAppProducts` — `WebAppInventory`/`InventoryManagementService` untouched (the Files-table inventory-side entries were superseded).
- **New `getVerifyDetail(sku)`** added: the existing `loadProductEditorData` returns WebDetM+Comax but not `wpm_Images`/`wpm_TaxProductCat`, so the modal's image tile + web-category panel needed a dedicated fetch.
- **Revert path uses `WebAppDashboardV2_updateManagerTask(taskId, { notes })`** — the real API key is `notes`, not `st_Notes` as written below.
- **No dashboard whitelist needed:** the manager dashboard gates by `st_AssignedTo === 'Manager'`, and `manager_direct` assigns to Manager, so `task.product.verify` surfaces automatically. A **Verify** deep-link button (sessionStorage → `loadView('ManagerProducts')`, Outreach precedent) enters the batch walk.
- **`pack_form: dedicated_view`** on the template (the field postdates this plan's template snippet).
- **Read-only render:** `verifyMode` adds `#editor-modal.verify-mode` (CSS hides the Edit columns + Fill/Clear, single-column grid) and disables all `[id^="edit-"]` inputs; image tile at top of the modal, Web-categories + flags on the Specs Current column.

## Problem

Today's `task.inventory.count` flow has been stretched to serve two unrelated jobs: counting (time-sensitive quantity work) and product-data integrity (vintage drift, image quality, Comax fact-checking). The manager's count view exposes vintage entry and image preview alongside the count, and inline edits create `task.validation.vintage_mismatch` tasks for admin.

Result: counts carry verification overhead, verification is opportunistic (only happens when something is being counted), and the cadence for verification is implicit in the count cadence.

The audit sheet already separates the two concerns — `pa_LastCount` and `pa_LastDetailAudit` are distinct columns on `SysProductAudit` — but no machinery uses `pa_LastDetailAudit` yet.

## Goal

Make verification a first-class workflow with its own cadence, task type, and surface — and strip the verification overhead out of counting.

## Architectural decisions

Settled in planning (2026-05-14). Not up for re-litigation during implementation.

| Decision | Choice |
|---|---|
| New task type | `task.product.verify` (single SKU per task, manager-assigned) |
| Task creation model | **Manual** — parallel "Create Verification Tasks" card mirroring the existing count card. No automated sweep. Manager runs ~20/week, gaps for busy seasons = twice annually |
| Count creation model | Stays manual; same card pattern (no separate cadence rewrite — existing card already accepts "days since last count") |
| Idempotency | One open task per SKU per type at a time. Server-side dedup on create, same as count card |
| Verification surface | **Read-only** variant of the product detail modal — reuse `ManagerProductsView` with a `verifyMode` flag (decided 2026-06-01). Edit inputs disabled, no save button; footer has exactly two actions — **Confirm & close** and **Revert to admin**. Revert exposes a findings notes field; its text is saved to the task's `st_Notes` before reassigning to admin. Image as its own tile; Comax facts shown side-by-side with the web/derived values for one-glance human comparison (no automated category match) |
| Failed verification routing | Revert-to-admin (existing `WebAppDashboardV2_revertTaskToAdmin` pattern). Task notes carry findings. **No spawn** — confirmed 2026-05-31, see Resolution below |
| Editing during verification | **None.** Verification is look-and-note only. All product-data editing (vintage, description, attributes, image) happens in the separate update-details task or by the admin on a reverted task — never on the verification surface |
| Stamp trigger | `pa_LastDetailAudit` is stamped only on **verify-task completion** (Confirm & close, or admin completing a reverted task) — never off a stray modal save |
| Product-overview view (Inbox 2026-05-14) | Separate scope. Not part of this plan. Verification reuses the existing detail modal |
| Sheet-import vintage tasks | Existing `task.validation.vintage_mismatch` path stays (it's an admin-facing fix queue, separate concern) |

### Resolution — failed-verification handling (2026-05-31)

Confirms the "Failed verification routing / **No spawn**" decision above. Revert-to-admin with task notes is **sufficient and intentional**. We will **NOT** spawn a separate image-replacement / media-library task type.

Rationale: reverting the existing task to the admin is cheaper than creating a new task; the image remediation (raw photo → cleanup → upload to website) is a single human job that does not need to be decomposed into modeled steps at this stage.

This is a deliberate non-goal for now. Future sessions should **NOT** "discover" it as a gap and build media-task machinery — the absence of an image/media task type is intended, not an oversight.

#### No ops-side media/image library (confirmed 2026-05-31)

Extends the No-spawn decision: we will **NOT** build a separate ops-side media/image library either. Image remediation is a linear, single-use, single-owner chain — admin shoots a raw photo → cleans it up in Canva/similar → sizes + names it → uploads to the website to replace the live image. The website's own (WordPress) media library is already the system of record for the live image; an ops-side library would only duplicate it.

A media library would only earn its keep given asset reuse across channels, versioning/rollback needs, or a capture/publish handoff between different people — none of which apply here. The provenance that matters (was it checked, when, what was wrong) lives on the **task** — its notes plus the `pa_LastDetailAudit` stamp — not in a library.

**Workflow (admin↔manager bounce).** Product-detail validation is a task that bounces between admin and manager:

- Manager reviews image + details in the modal.
- If correct → close the task (Confirm & close).
- If something's wrong → note the finding and pass the task back to the admin (revert-to-admin).
- The admin attaches the corrected image to the task as the working artifact and uploads it to the website. No library association is created or needed.

## Task creation card

Sibling to the existing unified "Create Count Tasks" card in `AdminInventoryView.html`. New card: "Create Verification Tasks". Same in-memory model — load once on view open, all filter/sort/preview client-side.

### Controls

Same shape as the count card:

| Field | Default | Notes |
|---|---|---|
| Name filter mode | starts with | starts with / contains |
| Name filter text | empty | matches `nameHe` |
| Start at (name) | empty | alphabetic walking across sessions |
| Count (batch size) | 20 | matches the ~20/week target |
| Skip verified within N days | 180 | mirror of the count card's "skip counted within N days" — defaults to 180 (twice-annual) |
| Web products only | checked | |
| Wine only (Div 1) | checked | |
| Include 0 stock | unchecked | |

### Server data

Extend `WebAppInventory_getCountPlanningData()` (or sibling `getVerifyPlanningData()`) to include `pa_LastDetailAudit` per product. Same payload, additional field.

### Create

`WebAppInventory_createVerifyTasksBulk(skus, optionalNote)` — mirror of `createCountTasksBulk`. Server-side dedup against open `task.product.verify` for the SKU.

### Reuse

If the implementation can land as a single shared card with a type toggle (Counts | Verifications) that switches both the threshold field label and the task type, that's cleaner. Otherwise two sibling cards is fine. Implementation choice.

## New task template

```
task.template, task.product.verify, "Verify product details against live site and Comax.", stable,
topic, "Products",
default_priority, "Normal",
initial_status, "New",
flow_pattern, "manager_direct",
due_pattern, "two_weeks"
```

Edit `jlmops/config/taskDefinitions.json` → `node jlmops/generate-config.js` → `clasp push` → `rebuildSysConfigFromSource()`.

`due_pattern` two_weeks reflects "best done slowly" — no rush.

## The verification surface (read-only review modal)

A **read-only** variant of the product detail modal — the same display layout the manager already knows, but every edit input is disabled and there is no save button. The footer carries exactly two actions: **Confirm & close** and **Revert to admin** (see Completion paths). No editing happens here.

**Build approach — DECIDED 2026-06-01:** reuse `ManagerProductsView`'s modal with a `verifyMode` flag that disables inputs and swaps the footer. Rationale: shared field definitions (future field adds/changes show up in both surfaces for free), one place to improve perf later, and the read-only render is *lighter* than the edit modal — `verifyMode` skips populating all the edit controls/dropdowns that make the full modal slow, so review renders faster, not slower. (A separate read-only modal was the alternative; rejected to keep the field source shared.)

Two display additions over a plain read-only view:

1. **Live site image tile.** Separate area near the modal header (or top of the Specs tab if the header is tight). `<img src="{wpm_Images first src}">` lazy-loaded, max 300px wide. Never block modal open on image fetch — the browser handles it async. The manager judges image accuracy + quality by eye.
2. **Comax facts shown beside the web/derived values.** The Specs tab already shows `cur-CmxVintage`, `cur-CmxDivision`, `cur-CmxGroup`. Alongside each, show the corresponding web/derived value so the manager sees them side-by-side in one glance and judges any disparity himself.

### Flags — show the data, don't auto-compare categories

Two unambiguous empty-value flags only (no name-matching, no `SysLkp_Texts` join, so neither can false-positive):

1. **`cpm_Division` missing** — empty value → red asterisk + "missing" label. Every Comax product should have one.
2. **`cpm_Group` missing on a Wine-Division product** — `cpm_Division` resolves to wine but `cpm_Group` is blank → red asterisk + "missing" label.

**No automated Division/Group ↔ web-category comparison.** Resolved 2026-06-01: the comparison is dropped. Rationale — `wpm_TaxProductCat` stores **all** of a product's categories comma-joined (e.g. "Red Wine, Kosher, Dry") with no primary marker (`WooProductPullService.js:139` → `_extractNames`), and matching a Comax Division/Group **code** against those category **names** would require the fragile `SysLkp_Texts` code→label join — which can false-flag on label-shape variance ("Dry Red" vs "Red Wine") or a missing lookup row. On a look-and-note surface that noise is pure cost. Instead, **show** Comax Division/Group next to the web category list and let the manager judge. The Comax side may optionally be run through the lookup *for display readability only*; if the lookup misses, it simply shows the raw code — it never produces a flag.

**No editing capability.** Comax-field corrections go through the Comax CSV path (Comax is not directly writable from jlmops). Web-side corrections go through the separate update-details task or the admin's edit modal on a reverted task — never here.

## Verification completion paths

**Two** paths, both triggered from the read-only modal footer when a verify task is open:

1. **Confirm & close** — footer button. Stamps `pa_LastDetailAudit = today`, completes the task, no other changes. Used when image + data look correct. Then **advances to the next open verification task** (see Batch flow).
2. **Revert to admin** — the modal's Revert action exposes a findings notes field. Manager writes findings (e.g. "Image is blurry; needs reshoot. Comax year shows 2020 but bottle is 2021"), clicks Revert. The modal **carries the notes back to the task** — saves them to `st_Notes` via the existing manager notes-save path (`WebAppDashboardV2_updateManagerTask`), then reassigns the task to admin via the existing `WebAppDashboardV2_revertTaskToAdmin`. **Both backend functions already exist — no new backend.** The notes ride with the task row, so the admin sees the findings. Task stays open with admin assignee. Audit date NOT stamped — verification isn't done until the admin fixes the detail/image and re-completes the task (admin completion also stamps `pa_LastDetailAudit`). Then **advances to the next open verification task** (see Batch flow).

There is no edit-and-save path on this surface. Editing belongs to the separate update-details task.

### Batch flow — walk the queue, don't bounce out

A manager verifies many products in one sitting. After **either** action (Confirm & close or Revert to admin), the surface advances to the **next open `task.product.verify` assigned to this manager** and re-renders the modal with that product — it does **not** return to the task screen. The task screen is reached only when the queue is exhausted, or on an explicit Close.

Implementation: on entering verification (from any open verify task), load the manager's list of open verify tasks (task id + SKU) once; walk it client-side, loading each product's detail as it comes up (prefetch optional). Each Confirm/Revert removes the current task from the local queue and loads the next; when the queue is empty, show a brief "no more verifications" state and close back to the task list.

## Stamp ownership (corrected 2026-06-01)

Each task type stamps **only its own column** in `SysProductAudit`, on task completion. Same table, separate columns, separate triggers — neither touches the other's stamp:

- **Count task closes → `pa_LastCount`** only. The count flow MUST NOT stamp `pa_LastDetailAudit`. (Once verification is stripped from counting, counting does no validation — re-stamping the audit date here would silently re-couple the two concerns this plan exists to separate.)
- **Product-detail review (verify) task closes → `pa_LastDetailAudit`** only, through either close path (manager Confirm & close, or admin completing a reverted task).

~~Vintage update via the inventory count flow → stamps audit date~~ — **REMOVED 2026-06-01.** This was the exact count↔verification coupling the plan exists to undo.

**RESOLVED 2026-06-01 — validation and editing are SEPARATE tasks:**

- **Validation (product-detail review) task:** manager reviews on the read-only surface; the only outcomes are **Confirm & close** or **Revert to admin with findings**. **No editing happens during validation.** Completing this task stamps `pa_LastDetailAudit`.
- **Update-product-details task:** the distinct task type where actual modal editing occurs. Separate trigger, separate task.

Therefore stamping is strictly **task-completion-driven**, never off a stray edit — validation doesn't edit, so there is no "in-the-wild" edit-stamp case at all. (The earlier "edit-and-save auto-completes the verify task and stamps `pa_LastDetailAudit`" design has been removed throughout this plan — reconciled 2026-06-01.)

- Image upload through whatever channel → not part of the validation task; remediation rides the update-details/admin path
- Manual sheet edits to `SysProductAudit` → user responsibility; not automated

## Files to modify

| File | Change |
|---|---|
| `jlmops/config/taskDefinitions.json` | Add `task.product.verify` template |
| `jlmops/AdminInventoryView.html` | Add "Create Verification Tasks" card (parallel to count card, or shared card with type toggle) |
| `jlmops/WebAppInventory.js` | Extend planning-data response with `pa_LastDetailAudit`; add `createVerifyTasksBulk` wrapper |
| `jlmops/InventoryManagementService.js` | Add `createVerifyTasksBulk(skus, note)` mirror of `createCountTasksBulk`; helper to stamp `pa_LastDetailAudit` for a SKU |
| `jlmops/ManagerProductsView.html` | Add the read-only `verifyMode` surface: live image tile + Comax-vs-web side-by-side display on the Specs tab + the two empty-value flags (no `SysLkp_Texts`, no category comparison); disable edit inputs / hide save in verify mode; footer "Confirm & close" + "Revert to admin" buttons (gated on verify-task context); Revert exposes a findings notes field and saves it to `st_Notes` (via existing `WebAppDashboardV2_updateManagerTask`) before calling existing `WebAppDashboardV2_revertTaskToAdmin` — no new backend for the revert path |
| `jlmops/WebAppProducts.js` (or wherever the product-side handler lives) | Add the verify-task completion handler (stamps `pa_LastDetailAudit` + completes the task) for Confirm & close. NOT wired into the edit-save path — verification doesn't edit. Also provide the manager's open-verify-task queue (task id + SKU) for the batch walk — reuse the existing task feed if it already returns this, otherwise a thin `getOpenVerifyTasks()` |
| `jlmops/WebAppDashboardV2.js` | Whitelist `task.product.verify` in manager dashboard (type uses manager_direct flow, so it should surface via assignment-based gating already; verify) |

No schema additions — `pa_LastDetailAudit` already exists.

**Completion owner — RESOLVED 2026-06-01.** Counts have a dedicated stamp-on-close path in the inventory service (`InventoryManagementService` stamps `pa_LastCount` on count-task completion). Verification needs the **product-side equivalent** — a dedicated completion handler (product service, e.g. `ProductService`, NOT the inventory service, since this is product validation) that stamps `pa_LastDetailAudit` when a `task.product.verify` closes. It must own **both** close paths: (a) the manager's Mark-verified, and (b) the admin completing a reverted task. This replaces the earlier note that put the stamp helper in `InventoryManagementService.js` — move it product-side to match the AdminProductsView placement decision.

## Strip verification from count flow (separate cleanup pass)

Decoupling from the user's "corrupted the count process" concern. Once verification is live, count flow returns to pure quantity work:

- `ManagerInventoryView.html` count row expansion: remove the inline vintage-actual and comment inputs that create `task.validation.vintage_mismatch`. Keep the read-only vintage/image/page-link references for the counter to validate they're counting the right product, but don't accept inline detail edits.
- `WebAppInventory.exportCountsToSheet`: drop the "Vintage (actual)" editable column. Keep Vintage (ref) and Product Page link for orientation.
- `WebAppInventory.importCountsFromSheet`: drop the post-import vintage-mismatch task creation. Counts and comments only.
- `WebAppInventory.submitInventoryCounts`: drop the inline vintage/comment task creation.

The `task.validation.vintage_mismatch` template itself stays — it still serves admin-driven validation flows (CSV import vintage drift detection, etc.).

**Sequencing:** Verification track ships first and is verified working in production for ~1 cycle (1–2 weeks) before count flow is stripped. Don't remove the inline vintage path until the cadence-based verification has produced its first round of tasks and been worked through.

## Verification cadence surfacing — deliberate non-goal (2026-06-01)

No automated due-reminder / cadence surfacing for verification. Unlike counts (which have a pre-sync prompt), the admin generates verification tasks **manually/ad-hoc** when they choose to. The ~180-day cadence is a guideline, not a system-enforced nudge. This is a deliberate decision, not a gap — future sessions should NOT build a "products due for verification" surfacing mechanism unless the user revisits it.

## Out of scope

- **Product-overview ops view** (Inbox 2026-05-14) — separate plan. Useful for ops triage but not the verification surface
- **High-velocity SKU prioritization** — verification cadence is uniform 180 days. No tier for top sellers
- **Verification chains** (e.g. category audit) — single SKU per task only
- **Automated image quality scoring** — manual judgment only
- **Separate image-replacement / media-library task type** — deliberate non-goal (resolved 2026-05-31). Failed verification reverts the existing task to admin; image remediation stays a single un-modeled human job
- **Comax direct write** — Comax edits still go through the existing CSV / Comax UI path; verification just flags drift
- **Cross-language consistency checks** (EN name vs HE name) — manager catches in modal eyeball; no automation

## Risks

**Low.** All the data paths exist. New behavior is additive: one new task type, one card clone (counts), modal extensions. No phase3 sweep means no scheduling logic to debug. Strip-count-flow is a follow-up that doesn't ship until verification proves itself.

One thing to watch:

- **No fragile join remains.** The risky `SysLkp_Texts` code→label join was eliminated by dropping the automated category comparison (2026-06-01). If the lookup is used at all, it's display-only and degrades to showing the raw code — it can't produce a false flag. The two remaining flags are pure empty-value checks on `cpm_Division` / `cpm_Group`.

## Open questions for user

1. **Web category source for the comparison.** ✅ RESOLVED 2026-06-01. Web category = `wpm_TaxProductCat`, web image = `wpm_Images`, both on **WebProdM**, joined on `wpm_SKU`. Further resolved: `wpm_TaxProductCat` holds **all** of a product's categories comma-joined with no primary marker (`WooProductPullService.js:139` `_extractNames`), so a single-category "primary + parent" comparison isn't supported by the data. **Decision: drop the automated category comparison entirely** — show Comax Division/Group beside the web category list and let the manager judge (see "Flags — show the data" above). No `SysLkp_Texts` join needed for flagging.
2. **Card layout** — ✅ RESOLVED 2026-06-01. Decision supersedes the original AdminInventoryView one-card-vs-two question. Verification is *product validation, not inventory*, so the verification-task-creation card lives on **AdminProductsView**, not AdminInventoryView. It reuses the existing count-task-creation card's pattern (admin generates verification tasks the same way count tasks are created). Counts stay on the inventory screen; verification creation + the manager's verification modal both live on the product surface — fully decoupled from inventory. Reinforces the count/verification separation (the core fix this plan exists for). **Perf:** both cards (existing count-creation card + new verification card) are infrequent-use and pay a populate cost, so default them **collapsed, populate-on-expand** (lazy-load); retrofit the existing count card to the same behavior. (Original text: one shared "Counts | Verifications" toggle card vs two sibling cards on AdminInventoryView; mild preference for shared — now obsolete.)
