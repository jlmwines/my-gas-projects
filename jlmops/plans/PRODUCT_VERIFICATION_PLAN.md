# Product Verification — Plan

**Created:** 2026-05-14
**Status:** Plan written, not implemented. Awaiting OK before code.

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
| Verification surface | Existing `ManagerProductsView.html` `editor-modal`. Image as its own tile; Comax fields rendered side-by-side with Specs for one-glance comparison |
| Failed verification routing | Revert-to-admin (existing `WebAppDashboardV2_revertTaskToAdmin` pattern). Task notes carry findings. **No spawn** — confirmed 2026-05-31, see Resolution below |
| Vintage-update completion | Editing vintage (or any modal save) on a SKU with an open verify task auto-completes that task and stamps `pa_LastDetailAudit` |
| Edits in the wild | Any vintage/image/description edit through the modal stamps `pa_LastDetailAudit`. Selection card then naturally skips that SKU |
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
- If correct → close the task (Mark verified / edit-and-save path above).
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

## Modal additions (ManagerProductsView)

Extend the existing `editor-modal`. Two additions:

1. **Live site image tile.** Separate area near the modal header (or top of the Specs tab if header is tight). `<img src="{wpm_Images first src}">` lazy-loaded, max 300px wide. Never block modal open on image fetch — browser handles async.
2. **Comax facts column on the Specs tab.** The Specs tab today has Current | Edit columns. The Current column already shows `cur-CmxVintage`, `cur-CmxDivision`, `cur-CmxGroup`. Add alongside each Comax field the corresponding web/derived value so the manager sees them side-by-side in one glance.

### Mismatch rules

Three flags on the Comax facts column:

1. **`cpm_Division` missing** — empty value → red asterisk + "missing" label. Every Comax product should have one.
2. **`cpm_Group` missing on Wine-Division product** — `cpm_Division` resolves to wine but `cpm_Group` is blank → red asterisk + "missing" label.
3. **(Division, Group) ↔ web category disagreement.** Lookup logic:
   - Read `SysLkp_Texts` (`slt_Code`, `slt_TextEN`, `slt_TextHE`).
   - Expected EN division label = `slt_TextEN` where `slt_Code = cpm_Division`.
   - Expected EN group label = `slt_TextEN` where `slt_Code = cpm_Group`.
   - Compare against the EN web category names on the product (primary category + parent — exact strings TBD at implementation time once we look at how WC categories are stored on the product join).
   - Disagreement → red flag + diff summary ("Comax says Dry Red, web says Dessert").

If the lookup row is missing in `SysLkp_Texts` (`cpm_Division` value not found in `slt_Code`), that's its own flag: "Comax Division value not in lookup."

**No new editing capability beyond what the modal already does.** Manager already edits Region, ABV, attributes, descriptions in this modal — that's how verification edits flow. Comax field corrections still go through the Comax CSV path (Comax is not directly writable from jlmops).

## Verification completion paths

Three paths, all triggered from the modal when a verify task is open:

1. **Mark verified** — new button in modal footer. Stamps `pa_LastDetailAudit = today`, completes the task, no other changes. Used when image + data look correct and no edits are needed.
2. **Edit-and-save** — existing modal save path. Wraps the save: in addition to current behavior, stamps `pa_LastDetailAudit` and completes any open `task.product.verify` for the SKU. This is the auto-complete path for vintage updates, description fixes, attribute corrections.
3. **Revert to admin** — existing dashboard button (`WebAppDashboardV2_revertTaskToAdmin`). Manager writes findings into task notes (e.g. "Image is blurry; needs reshoot. Comax year shows 2020 but bottle is 2021"), clicks Revert. Task stays open with admin assignee. Audit date NOT stamped — verification isn't done until admin resolves and re-completes (admin completion also stamps the audit date).

## Stamp ownership (corrected 2026-06-01)

Each task type stamps **only its own column** in `SysProductAudit`, on task completion. Same table, separate columns, separate triggers — neither touches the other's stamp:

- **Count task closes → `pa_LastCount`** only. The count flow MUST NOT stamp `pa_LastDetailAudit`. (Once verification is stripped from counting, counting does no validation — re-stamping the audit date here would silently re-couple the two concerns this plan exists to separate.)
- **Product-detail review (verify) task closes → `pa_LastDetailAudit`** only, through whatever path is appropriate (Mark verified, edit-and-save auto-complete, or admin completing a reverted task).

~~Vintage update via the inventory count flow → stamps audit date~~ — **REMOVED 2026-06-01.** This was the exact count↔verification coupling the plan exists to undo.

**Sub-question RESOLVED 2026-06-01 — validation and editing are SEPARATE tasks:**

- **Validation (product-detail review) task:** manager reviews; the only action is a **note** in the task. Outcomes = Mark verified, or revert-to-admin with findings. **No modal editing happens during validation.** Closing this task stamps `pa_LastDetailAudit`.
- **Update-product-details task:** the distinct task type where actual modal editing occurs. Separate trigger, separate task.

Therefore stamping is strictly **task-completion-driven**, never off a stray edit — validation doesn't edit, so there is no "in-the-wild" edit-stamp case to worry about.

⚠️ **Correction required:** the "edit-and-save auto-completes the verify task and stamps `pa_LastDetailAudit`" path (see Completion paths §2 and the "Vintage-update completion" / "Edits in the wild" architecture-table rows) **conflates validation with editing again** and must be reconciled — validation = look-and-note only; editing belongs to the separate update-details task.

- Image upload through whatever channel → not part of the validation task; remediation rides the update-details/admin path
- Manual sheet edits to `SysProductAudit` → user responsibility; not automated

If an in-the-wild edit happens for a SKU that has an open verify task, the save completes it.

## Files to modify

| File | Change |
|---|---|
| `jlmops/config/taskDefinitions.json` | Add `task.product.verify` template |
| `jlmops/AdminInventoryView.html` | Add "Create Verification Tasks" card (parallel to count card, or shared card with type toggle) |
| `jlmops/WebAppInventory.js` | Extend planning-data response with `pa_LastDetailAudit`; add `createVerifyTasksBulk` wrapper |
| `jlmops/InventoryManagementService.js` | Add `createVerifyTasksBulk(skus, note)` mirror of `createCountTasksBulk`; helper to stamp `pa_LastDetailAudit` for a SKU |
| `jlmops/ManagerProductsView.html` | Add live image tile + Comax-vs-web side-by-side display on Specs tab + mismatch flags using `SysLkp_Texts`; add "Mark verified" button (gated on verify task context); save handler stamps `pa_LastDetailAudit` and completes open verify tasks |
| `jlmops/WebAppProducts.js` (or wherever Manager save handler lives) | Add stamp-and-complete logic to the save path |
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

- **`SysLkp_Texts` join correctness.** The lookup is keyed by `slt_Code` matching `cpm_Division` and `cpm_Group` values. If those code values aren't always strings of the same shape (e.g. `"1"` vs `1`, leading zeros), the join silently fails and everything looks like a mismatch. Test with a known wine product before turning the flags on for the whole catalog.

## Open questions for user

1. **Web category source for the mismatch comparison.** ✅ RESOLVED 2026-06-01 (confirmed against `jlmops/config/schemas.json`): both fields live on **WebProdM** (Web Products Master) — web category = `wpm_TaxProductCat`, web image = `wpm_Images` — joined to the product on `wpm_SKU`. The comparison is EN-side on WebProdM; Hebrew products (WebXltM) carry no own category/image (inherited via WPML), so no HE-side join needed. The risky `SysLkp_Texts` join is NOT required for the category/image mismatch. (Original question text: where does the EN web category live on the product join — `wpm_Categories`? an attribute? the `cpm_*` master? — answer: `wpm_TaxProductCat` on WebProdM.)
2. **Card layout** — ✅ RESOLVED 2026-06-01. Decision supersedes the original AdminInventoryView one-card-vs-two question. Verification is *product validation, not inventory*, so the verification-task-creation card lives on **AdminProductsView**, not AdminInventoryView. It reuses the existing count-task-creation card's pattern (admin generates verification tasks the same way count tasks are created). Counts stay on the inventory screen; verification creation + the manager's verification modal both live on the product surface — fully decoupled from inventory. Reinforces the count/verification separation (the core fix this plan exists for). **Perf:** both cards (existing count-creation card + new verification card) are infrequent-use and pay a populate cost, so default them **collapsed, populate-on-expand** (lazy-load); retrofit the existing count card to the same behavior. (Original text: one shared "Counts | Verifications" toggle card vs two sibling cards on AdminInventoryView; mild preference for shared — now obsolete.)
