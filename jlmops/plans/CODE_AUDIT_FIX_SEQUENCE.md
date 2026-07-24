# Code Audit Fix Sequence

Sequences the ~18 findings from `CODE_AUDIT_PLAN.md` §9-10 (first-ever comprehensive jlmops audit, 2026-07-23) into focused implementation sessions, same model as `BUG_FIX_SEQUENCE.md` (continuing its session-letter scheme at K). One additional bug found live 2026-07-24 (not from the original audit) is folded into Session K rather than tracked separately. Ordered by the audit's own Tier 1-4 ranking, then by readiness within each tier (concrete fix shape → decision-needed → larger scope). **Status: planned, nothing implemented yet** — each session still needs explicit user go-ahead before code changes start.

Each session ends with the established cycle: commit → user OK → `clasp push` → user smoke → user OK → `deploy.ps1`.

---

## Tier 1 — real, live, user-visible today

### Session K — Quick field/reference fixes (4 bugs, no design decisions)

1. **`WebAppDashboardV2._getOrdersData_v2`** reads `sol_Status`/`sol_ComaxExported` — rename to real fields `sol_OrderStatus`/`sol_ComaxExportStatus`. Fixes on-hold/processing/new/export counts showing 0 on every dashboard load.
2. **`TaskService.updateTaskDates`** calls nonexistent `_invalidateWebAppTasksCache()` — change to the real helper `invalidateTaskCache`. Fixes false-failure toast on a date edit that actually saved.
3. **`ProductService.js`: `vendorSkuUpdate`, `fixOrphanSku`, `webProductReassign`** reference retired field `wxl_SKU` — change to live `wxm_SKU`, matching the sibling `correctProductName` (already correct). Fixes silent no-op on the `WebXltM` (Hebrew translation) update during SKU rename/fix.
4. **`WebAppDashboardV2._getInventoryData`** (found live 2026-07-24, not from the original audit) — derives Brurya days-since-count from the open `task.inventory.brurya_update` task's notes instead of `system.brurya.last_update` directly, so the widget shows nothing whenever the count is within 7 days (the normal case — no reminder task exists yet to read from). Fix: compute `daysSinceUpdate` straight from `system.brurya.last_update`, the same arithmetic `HousekeepingService.checkBruryaReminder()` already does, instead of round-tripping through the task's `st_Notes`. Only fall back to "999/never" when the config value is absent.

All four are single-function, single-line-class fixes with a known-correct reference (or known-correct sibling calculation) already in the same codebase to copy from. Bundle into one session.

**Deployed 2026-07-24 (jlmops @530), smoke-tested.** Item 1 turned out to need more than the field rename: `sol_ComaxExportStatus`'s real values are `'Pending'`/`'Exported'` (confirmed in `OrderService.js`), not `'Yes'`/`'TRUE'`/`true` as the original comparison assumed — renaming the field alone would have kept `ordersToExport` broken. Fixed the comparison to match `OrderService.js`'s own case-insensitive `!== 'exported'` idiom. Item 4 required passing `allConfig` into `_getInventoryData` (both call sites) since it didn't previously receive it.

**Smoke test (2026-07-24) surfaced a second bug in the same function, fixed same session:** `newOrders` showed 24 — implausible. Root cause: `_getOrdersData_v2`'s `newOrders` counted `sol_OrderStatus === 'new' || 'pending'`, an invented definition with no precedent elsewhere (`'new'` isn't a real WooCommerce status, and `'pending'` orders can sit unpaid/abandoned indefinitely, so the count only grows). The only other place "new orders" is defined in the codebase, `OrderService.getNewOrdersCount()` (itself only reachable from the dead v1 `_getOrdersData()` — a Tier-4 deletion candidate), uses packing-status `'Ready'` AND never-printed. Rewired `newOrders` to that definition, computed in-memory from `ordLog` (already has `sol_PackingPrintedTimestamp`) rather than a second sheet read. Distinct from `packingReady`: an already-printed order can still sit in `'Ready'` awaiting further action, so the two counts don't collapse to the same number.

Task-date-edit and Brurya-days-since checks both confirmed correct live. SKU-tool check (item 3) still pending a real SKU rename/fix to test against.

---

### Session L — `OrdersView.html` customer-note XSS (1 bug)

`loadPackingSlipsData()` interpolates `order.customerNote` (genuine WooCommerce checkout text) raw into a table cell **and** an inline `onclick="...('${order.customerNote}')"` attribute — the one real external-input XSS path the audit found. `billingName`/`shippingName`/`shippingCity`/`status`/`orderDate` in the same tables are also unescaped.

**Needs more care than a plain `TaskWidgets.escape()` wrap on the `onclick` string** — escaping HTML entities doesn't neutralize a single quote breaking out of an inline attribute the same way. Plan:
1. Escape all listed fields for the table-cell rendering (safe, straightforward).
2. For the Gift Doc button, stop building `onclick="...('${customerNote}')"` as a string; either move the note into a `data-` attribute read by an `addEventListener` handler, or pass an index/order-id to the handler and let it look up the note from the already-loaded order object. Either avoids re-embedding untrusted text into an attribute value at all.
3. Smoke: an order with a `'` or `<` in its note must not break the Gift Doc button or render markup.

**Coded 2026-07-24, not yet committed/pushed/deployed.** Escaped all cell fields in both `loadPackingSlipsData()` and `loadOpenOrdersData()` tables (orderId/orderNumber, status, orderDate, billingName, shippingName, shippingCity, customerNote) via `TaskWidgets.escape`. Gift Doc button now carries `data-order-id` and looks the order back up from the already-loaded `orders` array via `addEventListener`, matching the exact pattern `loadOpenOrdersData()`'s CRM/Log Reward buttons already use in this same file — no untrusted text re-enters an attribute. `createGiftMessage(orderId, noteContent)` still receives the raw, unescaped note (correct — it's sent server-side for Doc creation, not rendered as HTML).

---

### Session M — `TaskDetail.html` Done button skips content-entity locking (1 bug, decision needed)

Generic "Done" button renders for `content_edit`/`content_publish` tasks; `TaskPacks.hasTypedPack(typeId)` exists specifically to suppress it for typed packs but is never called. Closing a content task this way skips `WebAppLibrary_lockVersion` — entity never versions/locks, translation-draft trigger never fires.

**Decision (2026-07-24): hide the generic button.** Confirmed `content_edit`/`content_publish` packs have their own completion actions ("Editing Done" / "Mark Published") that already run the correct locking/versioning path — hiding Done doesn't remove the manager's ability to close the task, it just forces the already-correct button.

**Deployed 2026-07-24 (jlmops @533), smoke-tested and confirmed working.** One-line change: `showDone = !isData && !TaskPacks.hasTypedPack(typeId)`. `.td-done-btn`'s click wiring already null-checks (`if (doneBtn)`), so no further change needed there. Live check: content task shows "Editing Done" (typed pack), generic "Done" button gone.

---

### Session N — `sc_DoNotContact` suppression never worked (1 bug — resolved by decision, 2026-07-24)

`CampaignService.js`'s `filterYearInWine`/`exportYearInWine2025`/`exportYearInWineSimple`/`exportLapsed2024Customers` all gate on `c.sc_DoNotContact`, which doesn't exist in `SysContacts`' schema — always `undefined`.

**Decision (owner, 2026-07-24): no do-not-contact mechanism exists anywhere in jlmops today, and none is needed right now** — no customer has asked to be excluded from all contact. Mailchimp unsubscribe already covers the actual opt-out case that occurs in practice (email specifically); there's no broader "don't contact this person at all" requirement yet. **Not a fix — a cleanup:** remove or clearly comment the dead `sc_DoNotContact` checks so the code stops implying a suppression that doesn't exist, rather than building real infrastructure for a need that hasn't materialized. If a genuine do-not-contact requirement shows up later, it's a fresh feature, not a continuation of this bug.

**Coded 2026-07-24.** Removed the dead `!c.sc_DoNotContact`/`if (c.sc_DoNotContact) return;` checks from all 4 functions in `CampaignService.js` — deleted rather than commented, since a condition that's always true is pure dead weight. No behavior change (the checks never fired either way); this only removes the misleading implication that suppression was happening.

---

## Tier 2 — real, narrower blast radius or lower likelihood

### Session O — Escaping consistency pass (6 files, same fix repeated)

Same defect class as Session L but internal-data (product/task names, contact emails) rather than customer-facing external input — lower likelihood, still worth closing given zero server-side authorization means client-side rendering gaps are the only depth that exists. Apply `TaskWidgets.escape()` (the existing shared helper) at each site:

1. **`AdminProductsView.html`** — 4 search-result renderers (`searchCurrentProduct`, `searchCorrectNameProduct`, `searchCurrentWebProduct`, `searchReplacementProduct`) build rows via raw `innerHTML`; a local `_escapeHtml` reinvention (missing apostrophe encoding) should be deleted once the shared helper is wired in.
2. **`ManagerProductsView.html`** — same defect, 4 renderers (`renderSuggestions`, `loadTaskList`, `loadVerifyList`, `loadSuggestionList`). File already defines a safe `setVal()` (`textContent`) used correctly elsewhere — the renderers just don't use it.
3. **`AdminContactsView.html`** `renderContactList()` — `data-email="..."` built with raw email while every other field in the same function is escaped.
4. **`AdminInventoryView.html`** — `renderReviewTable()`, `renderOpenTasksTable()`, `renderComaxSyncCard()` insert task title/SKU/notes raw (`renderPreview()` in the same file already does this correctly — copy its pattern).
5. **`AdminDashboardView_v2.html`** `renderTasksCard()` — inserts `task.name`/`typeId`/`entityId` unescaped into `innerHTML` and data-attributes; the near-identical renderer in `AdminProjectsView.html` already escapes every field — copy it.
6. **`ManagerInventoryView.html`** `renderProductCountsTable`/`renderBruryaInventory` — the file's only escaping helper (`escapeAttr`) covers one data-attribute, never visible cell text.

One session, six mechanical edits, same pattern each time. Smoke: a product/task name containing `<` or `"` renders literally instead of breaking the row, across all six views.

**Coded 2026-07-24, not yet committed/pushed/deployed.** Item 1: kept `AdminProductsView._escapeHtml` rather than deleting it — it already has 13 other call sites in the same file, all correctly using it, so ripping it out for `TaskWidgets.escape` would be a much larger, riskier rename than this session's scope. Instead added the missing apostrophe encoding to `_escapeHtml` itself (safe, backward-compatible) and wired it into the 4 previously-unescaped search renderers. Items 2-6 use `TaskWidgets.escape` as planned, copying each file's own established pattern.

---

### Session P — Quick batch, concrete fix shape (7 items) — all coded 2026-07-24, not yet committed/pushed/deployed

1. **`ProductImportService.js` `_upsertWebXltData`** — copies `WebXltS`→`WebXltM` by column position instead of field name (unlike every other upsert in the file). Fix to field-name-based copy, matching the file's own convention elsewhere. **Coded 2026-07-24:** remapped by field name via a `webXltMHeaders.map(h => webXltSHeaders.indexOf(h))` lookup instead of a raw positional slice. **Scope note:** tracing the "orphaned duplicate in `ProductService.js`" turned out much bigger than expected — not one function but a complete, unexported ~656-line duplicate of this file's entire import pipeline (`_runComaxImport`/`_upsertComaxData`/`_maintainSysProductAudit`/`_runWebProductsImport`/`_upsertWebProductsData`/`_runWebXltValidationAndUpsert`/`_upsertWebXltData`/`processJob`, `ProductService.js` lines ~236-892). Confirmed dead (`ProductService.js` never exports `processJob`, unlike `ProductImportService.js`, which does and is the live copy). Moved to Session T rather than deleted here — too large for this session's scope.
2. **`InventoryManagementService.js`: `setBruryaQuantity`, `setInventoryCount`, `updatePhysicalCounts`** — the "create new `SysProductAudit` row" fallback never populates `pa_CmxId` (real PK), looking for nonexistent `cpm_ProdId`/`pa_ProdId` instead. Fix the fallback to populate the real PK. Narrow window (`_maintainSysProductAudit` proactively seeds most rows first) but still a real duplicate-row risk for an unseeded SKU. **Coded 2026-07-24:** `setBruryaQuantity`/`setInventoryCount` — swapped `pa_ProdId`/`cpm_ProdId` for `pa_CmxId`/`cpm_CmxId`. `updatePhysicalCounts` turned out to have no Comax lookup at all in its fallback (not just a wrong field name) — added a `CmxProdM` lookup by SKU, matching the other two functions' pattern. **Not fixed, out of scope:** the same two functions' fallback also writes to `pa_NameHe`, which doesn't exist in the current `SysProductAudit` schema either — same silent-no-op shape, not part of this bug, not touched.
3. **`WebAppCampaigns.js` `WebAppCampaigns_getCampaignDetail`** filters on dropped field `p.spro_CampaignId` — fix to the live FK direction (`SysMarketingCampaigns.sm_ProjectId` → `SysProjects`), per `DATA_MODEL.md`. Also remove `ProjectService.js`'s now-dead writes to `spro_CampaignId` in the same session (same fact, same fix). **Also check `AdminTasksView.html`/`AdminProjectsView.html`** — both still read `project.spro_CampaignId` client-side as a UI fallback (6 call sites); no functional regression risk since the field already never resolves, but clean these up in the same pass rather than leaving a reference to a field the fix just finished removing server-side.

   **Turned out much bigger than "6 dead-reference cleanups" — coded 2026-07-24:**
   - Fixed `WebAppCampaigns_getCampaignDetail` to filter `p.spro_ProjectId === campaign.sm_ProjectId` (live FK direction).
   - Removed `ProjectService.js`'s dead `spro_CampaignId` read/write branches in `createProject`/`updateProject` (confirmed zero live callers pass `campaignId` before deleting).
   - **Real bug found while tracing the "6 call sites":** both `AdminTasksView.html` and `AdminProjectsView.html` have a live, editable "Marketing Campaign" dropdown on the project edit form AND on the new-project modal, wired to save `campaignId` via `WebAppProjects_updateProject`/`createProject`. Since `spro_CampaignId` no longer exists, **every save of that dropdown has been silently discarded** — not a harmless stale fallback, an actually-broken editable control. Worse, the "Generate Outputs" (UTM/short-URL/QR) feature in both files gated itself on reading that same dead field back, so it always claimed "not linked to a campaign" even for genuinely-linked projects.
   - **User confirmed (2026-07-24):** the real, working way to link a project to a campaign is `PublishingView.html`'s New Campaign modal, which already correctly sets `sm_ProjectId` at creation time (`WebAppPublishing_createCampaign`) — confirmed via code. The project-side dropdown was fully redundant. **Decision: removed the dropdown** (both files: edit-project field, new-project field, and their `campaignId` params) rather than fixing it, since the correct write path already exists elsewhere.
   - To keep "Generate Outputs" working (a real, valuable feature — UTM/short-URL/QR generation, matches the `marketing/` newsletter workflow), extended `WebAppCampaigns_getCampaignOptions` to also return `projectId` (`sm_ProjectId`), and rewired both files' Generate Outputs flow to do a client-side reverse lookup (`_findCampaignIdForProject`) against that cached options list instead of reading the dead field. `populateCampaignField`/`renderCampaignOptions` replaced with `_loadCampaignOptions`/`_findCampaignIdForProject` in both files.
4. **`ManagerContactView.currentDirection()`** queries `input[name="mc-direction"]`, which doesn't exist (only `mc-channel` and the separate Record modal's `mc-record-direction` do) — every "Make contact" attempt logs as Outbound. Trace what the UI actually intends to capture (a channel selector vs. a direction selector) before deciding whether to fix the selector name or add the missing markup — don't guess. **Coded 2026-07-24:** traced `WebAppContacts_logContactAttempt` server-side and confirmed it genuinely supports both directions (different summary text, and skips opening the WhatsApp/tel link for Inbound since the manager isn't initiating) — this was missing markup, not a dead/stale selector. Added a real `mc-direction` radio group (Outbound/Inbound) to the "Make contact" modal, copying the existing `mc-channel` group's pattern, and reset it in `openActionModal()`. The `updateChannelUi()`/`loadTemplate()` Inbound-branches were already correct, just unreachable — they work now that the input exists.
5. **Woo order API-pull line-item cap** hardcoded to `24` in `WooOrderPullService.js` `_populateFlatLineItemFields` instead of reading `web.order.line_item_schema.max_line_items` like the CSV order path does. Read from config instead. **Coded 2026-07-24:** now reads `ConfigService.getConfig('web.order.line_item_schema').max_line_items`, falling back to `24` only if config is somehow missing. Current config value is already `24`, so no behavior change today — this just stops the two paths from silently diverging if the value is ever raised.
6. **`LibraryService.attachExistingDoc`** (`LibraryService.js:641-642`, found live 2026-07-24) — unconditionally calls `file.setOwner(adminEmail)` on every attach, with no check against the file's current owner. Reassigns ownership even when the attaching admin already created and owns the file. `createTranslationDraft` relies on the same call (line ~1110-1111), so it inherits the same gap once this is fixed. Fix: skip `setOwner` when the file's current owner already matches `adminEmail`. **Coded 2026-07-24:** checks `file.getOwner().getEmail()` first; only calls `setOwner` on a mismatch. Wrapped in a try/catch — if the owner isn't resolvable (e.g. a shared-drive file), falls back to the prior unconditional behavior rather than throwing.
7. **`CrmIntelligenceService.js` `_checkWineryClusters`/`getInsights`** (added after independent review 2026-07-24) — reads `c.sc_TopWineries`, but the schema only has `sc_TopWineries_En`/`sc_TopWineries_He` (dual-language) — always `undefined`, so the winery-cluster campaign suggestion and dashboard "top winery" insight never fire. **Coded 2026-07-24:** both functions now read `sc_TopWineries_En`, matching the established fallback convention elsewhere in the codebase (`CampaignService.js`, `WebAppContacts.js` both default to `_En` when no per-contact language context applies — this is aggregate analytics, not customer-facing output, so there's no language context to switch on).

Seven independent, narrow fixes — bundle for efficiency, verify each separately.

---

### Session Q — `LibraryService.js` concurrency (LockService)

No `LockService` anywhere in the file. `_ensureEntity` (called from `createBlankDoc`/`attachExistingDoc`/`createTranslationDraft`) reads all rows, checks for an existing slug, then appends — no lock between check and write. A double-click or two near-simultaneous sessions can create two `SysLibrary` rows with the same slug (`_getEntityRow`'s `.find()` then silently hides the duplicate) or two Drive Docs in the canonical folder.

Needs care given this is the live content-creation path — wrap the check-then-write in `LockService.getScriptLock()` (or the project's existing lock pattern if one exists elsewhere in the codebase; check before inventing a new one) around `_ensureEntity` and the equivalent file-existence check in `createBlankDoc`. Smoke test: rapid double-click on "Create Content Tasks" / attach flows shouldn't produce duplicate entities.

**Coded 2026-07-24.** Confirmed zero existing `LockService` usage anywhere in the codebase — no pattern to copy, introduced fresh. Added a `_withLock(fn)` helper (`LockService.getScriptLock()`, 10s `tryLock`, `finally`-released), wrapping: (1) `_ensureEntity`'s full read-check-then-append body, and (2) `createBlankDoc`'s existence-check through the Doc's move into `canonicalFolder` — locking only up to Doc creation wasn't enough, since a newly-created Doc isn't in the canonical folder yet until `moveTo()` runs, so a second concurrent call's existence-check could still race past it; the lock now covers through the move, closing the gap for real. `attachExistingDoc`/`createTranslationDraft` both call `_ensureEntity`, so they inherit the fix automatically without their own changes. Not smoke-testable passively — needs a deliberate rapid-double-click repro to verify live, flagged for whenever that's convenient rather than blocking this session.

---

## Tier 3 — structural, worth a dedicated effort

### Session R — Server-side authorization (needs its own dedicated plan, sketched here)

**This is a program, not a patch** — the audit's own §8 scoping note says so, and every one of the 8 subsystem passes independently reconfirmed the same root cause. `doGet` blocks only unlisted "viewer" accounts; every other role gets the identical full SPA shell; `getView()` has no role parameter; zero mutating `google.script.run` endpoint re-checks caller role.

Don't design this in full here — it needs its own session to read `AuthService.js` closely and decide the mechanism. Sketch, for whoever picks this up:

1. **Design the shared guard first.** Likely shape: a single `AuthService.requireRole(minRole)` (or similar) that throws/rejects if the active user's role doesn't meet the bar — called at the top of every mutating endpoint. Decide fail-open vs. fail-closed explicitly (the existing `_loadRoleMapFromConfig()` is already fail-closed for unlisted users — extend that posture, don't weaken it).
2. **Close `getView()` first** — the single highest-leverage fix, since it's the one place the role-switcher's client-side flip currently has zero server backing. Gate the view name against the caller's real role.
3. **Roll out to mutating endpoints by cluster**, reusing the audit's own subsystem grouping so each rollout session has a natural boundary: Sync/Orders → Products/Inventory → CRM/Campaigns → Content Library/Projects → Core Plumbing (Tasks) → Admin-only actions (`DevelopmentView`'s backend functions are the most consequential of these — SysConfig rebuild, force daily maintenance, header rewrite — prioritize that cluster early even though it's UI-pass-adjacent, not because it's an Admin-UI escaping fix).
4. Track destructive-and-ungated endpoints first within each cluster (reuse the destructive/irreversible lens `DEVELOPER_VIEW_AUDIT.md` already applies).

Recommend spinning this into its own `AUTHORIZATION_PLAN.md` once picked up, rather than continuing to grow inside this fix-sequence doc — it's large enough to need its own phasing, review, and probably its own multi-session tracking the way `BUG_FIX_SEQUENCE.md` Session F/H/I do for audits-that-produce-fixes.

---

### Session S — UI convention consistency (ModalOverlay + drawer Esc-handling)

1. **`AdminTasksView.html` (5 modals), `AdminProjectsView.html` (6 modals), `AdminBundlesView.html` (1 modal)** build `.modal-overlay` markup but toggle with raw `style.display` instead of `ModalOverlay.open()/close()`. Convert each to the shared controller, copying the pattern from `AdminProductsView.html`/`AdminContactsView.html` (already correct, 8 calls each) per `jlmops/CLAUDE.md`'s mandatory-modal rule.
2. **`PublishingView.html`** — toggles its entity drawer via raw `style.display` and installs its own unconditional Escape-listener; opening a `ModalOverlay`-based modal on top and pressing Esc once closes both the top modal and the drawer underneath. Convert the drawer to `ModalOverlay` too so Esc-stacking works correctly. **`LibraryView.html` has the identical bug but is out of scope here — confirmed 2026-07-24 it has no nav link anywhere in `AppView.html` (only `Publishing` is linked), so it's dead despite still resolving via `WebApp.js`'s `viewMap`. Fix `PublishingView.html` only; `LibraryView.html` moves to Session T as a deletion candidate instead of a fix/dedup target.**
3. **`PublishingView.html`**'s New Campaign modal has no Escape handler at all (alone among the file's modals) — folds into item 1's conversion.

One consistency pass, same underlying fix (`ModalOverlay` adoption) across all flagged files.

**Coded 2026-07-24.** Converted all 12 raw-toggled modals: `AdminTasksView.html` (confirmModal, newProjectModal, generateOutputsModal, newTaskModal, contentImportModal), `AdminProjectsView.html` (same 5 plus contentStreamModal), `AdminBundlesView.html` (product-picker-modal), `PublishingView.html` (pvNewCampaignModal, pvEntityDrawer). `pvDrawerAttachModal` in `PublishingView.html` turned out already converted (someone had fixed it previously) — only the New Campaign modal and the entity drawer itself were still raw. Removed the drawer's own unconditional `document.addEventListener('keydown', ...)` Escape listener now that `ModalOverlay`'s stack-based handler covers it correctly (closes only the topmost modal). Verified the one behavior difference this creates — Esc-driven drawer close now skips `closeEntityDrawer()`'s extra `state.entityStack`/`currentEntity` reset — is harmless: `openEntityDrawer()`, the only real entry point, already resets `state.entityStack = []` itself before every fresh open, and every other read of `state.currentEntity` is gated behind drawer buttons that are invisible once the drawer is hidden.

---

## Tier 4 — cleanup, no urgency

### Session T — Dead-code deletion

Grep-confirmed zero callers on all of these; low-risk deletions, good single cleanup session:
- **`ProductService.js` lines ~236-892** (added 2026-07-24, from Session P item 1) — complete, unexported ~656-line duplicate of `ProductImportService.js`'s entire import pipeline: `_runWebXltValidationAndUpsert`, `_upsertWebXltData`, `_runComaxImport`, `_upsertComaxData`, `_maintainSysProductAudit`, `_runWebProductsImport`, `_upsertWebProductsData`, `processJob`. Confirmed dead: `ProductService.js` never exports `processJob` (its return object omits it, unlike `ProductImportService.js` which does export it and is the real, live, wired-up copy). Re-check the exact line span and grep each function name fresh before deleting — don't trust the range as still accurate by the time this session runs.
- `KpiService.js` (fully superseded by `KPISummaryService.js`/`StatusReportService.js`)
- `WpmlService.js` (unused scaffolding; real WPML handling lives in `WooProductPullService.js`)
- `CategoryService.js` (superseded by `ConfigService.getCategoryDivisionMap()`/`getCategoryTextLookup()`)
- `PromotionsEngineService.js` (reads a nonexistent "Promotions" sheet)
- `WebAppDashboard.js` (v1, entirely dead) + orphaned `WebAppSystem.js` functions it alone called (`WebAppSystem_getSystemHealthDashboardData`, the Inventory Cycle Checklist builder, `WebAppSystem_getSystemHealthMetrics`) + dead `WebAppDashboardV2.js` functions (`_getSystemHealthData()`, `_getLastSyncStatus()`, `_getOrdersData()` v1)
- `LibraryService.js`'s `_cache` Map — declared and `.delete()`'d but never `.set()`, does nothing
- `ContactImportService.js`'s dead local variable `couponItems` (parsed, never used, two functions)
- `OrchestratorService.js:599-603` duplicated `SpreadsheetApp.flush()` block
- **`LibraryView.html`** (added 2026-07-24, from Session S) — no nav link in `AppView.html` (only `Publishing` is linked); superseded by `PublishingView.html` per `STATUS.md`. Still resolves via `WebApp.js`'s `viewMap` (`'Library': 'LibraryView'`) — remove that entry too when deleting the file. Confirm no other live path (`TaskPacks.html`, `ContentStreamModal.html`, `WebAppLibrary.js`) depends on the file itself rather than the shared backend functions before deleting.

Re-grep each immediately before deleting (audit is a few weeks old by the time this session runs) rather than trusting the finding at face value.

**Done 2026-07-24.** All items above deleted/cleaned as scoped, plus what fresh re-grepping surfaced:
- `ProductService.js`: deleted lines 236-892 (657 lines) — also caught `_runStagingValidation` (236-248), a fully separate dead function immediately preceding the named block that the original finding hadn't listed. Confirmed doubly dead: not only is `processJob` unexported, the whole block calls `_updateJobStatus`/`_populateStagingSheet`, which are **never defined anywhere in this file** — it would have thrown `ReferenceError` even if somehow reached.
- **Correction to the `WebAppDashboard.js` item:** re-grepping its three other callees (besides `WebAppSystem_getSystemHealthDashboardData`) found `WebAppOrders_getOrdersWidgetData` and `WebAppInventory_getInventoryWidgetData` were **also** orphaned-only-by-`WebAppDashboard.js` and not mentioned in the original finding — deleted both. But `WebAppProducts_getProductsWidgetData` (the fourth) turned out to be **genuinely live** — called directly by `AdminProductsView.html:974` — did not delete it. Good reminder that "same shape as its siblings" isn't proof; checked each individually.
- `WebAppSystem.js`: deleted `WebAppSystem_getSystemHealthMetrics` + `WebAppSystem_getSystemHealthDashboardData` (the "Inventory Cycle Checklist" logic was inline within the latter, not a separate function — removed as part of the same deletion).
- `WebAppDashboardV2.js`: deleted `_getSystemHealthData()`, `_getLastSyncStatus()`, `_getOrdersData()` (v1) — kept `_parseTimestamp()`, which sits between two of them but is still called by the live `_getLastSyncStatus_v2`.
- `LibraryView.html`: deleted, plus its `WebApp.js` `viewMap` entry (`'Library': 'LibraryView'`). Left the adjacent `'AdminProjects': 'AdminProjectsView'` entry alone — that one's an intentional "soak fallback" per its own comment, not the same situation.
- All brace-balance-checked after editing; no syntax breakage.

---

### Session U — Efficiency batch (optional, low priority — do if time allows)

Audit's own passes note current data volumes aren't near the GAS quota ceiling, so none of these are urgent. One item is worth prioritizing within the batch if picked up:

- **`ContactEnrichmentService.enrichAllContacts`** calls `ContactService.upsertContact` once per contact (full sheet scan each) instead of the existing `batchUpsertContacts` — risks the 6-minute GAS execution ceiling as the contact base grows. Do this one first if the batch is split. **Coded 2026-07-24:** collects mutated contacts into an array during the loop instead of upserting immediately, then one `ContactService.batchUpsertContacts()` call after — one sheet read + one batch write total instead of one full read+write per contact. `batchUpsertContacts` already clears the cache itself, so the loop's own end-of-batch `clearCache()` call was removed (redundant, and skipped entirely if nothing needed writing).
- ~~`WebAppOrders_getOrdersWidgetData` — 4 separate full-sheet scans...~~ **Moot — this function was deleted entirely in Session T** (confirmed dead, only reachable from the also-deleted `WebAppDashboard.js`). Nothing to optimize.
- **`SyncStateService.getSyncState`/`getActiveSession`** — force a full `ConfigService.forceReload()` per call; every dashboard poll re-parses SysConfig twice. **Skipped — real risk, not attempted.** `forceReload()` exists specifically so sync-state polling sees fresh writes mid-sync; removing it risks the dashboard showing stale sync progress. A real fix needs a lighter single-key refresh path in `ConfigService`, not a quick edit here — left alone rather than risk staleness bugs in a live, actively-used sync flow.
- **`HousekeepingService.refreshCrmContacts`/`checkBundleHealth`** — skip-optimization gates on nonexistent `syncSession.currentStage` (real field: `.stage`), so the full CRM refresh + bundle scan runs unconditionally every cycle instead of only after a sync. **Coded 2026-07-24:** confirmed `STAGES.COMPLETE === 'COMPLETE'` already matches the literal string both call sites compare against — the field name was the only bug, not the comparison logic. Fixed both to `syncSession.stage === 'COMPLETE'`.
- **`InventoryManagementService.js`** — 4 widget-count functions each do their own uncached full `SysTasks` scan. **Turned out to be 1 live function, not 4 — coded 2026-07-24.** Re-checked callers: `getOpenNegativeInventoryTasksCount`, `getOpenInventoryCountTasksCount`, `getOpenInventoryCountReviewTasksCount` (and their shared helper `_getOpenTaskCountByTypeId`) had zero callers anywhere — deleted as dead code. Only `getComaxInventoryExportCount` (called by `WebAppInventory.js`) is live, and it scanned `SysTasks` twice per call via `_getOpenTaskCountByTypeIdAndStatus`; rewrote it to one read + one pass counting both conditions, then deleted the now-orphaned helper.
- **`TaskService.js`/`WebAppTasks.js`** — Drive-wide filename search (`DriveApp.getFilesByName('JLMops_Data')`) instead of the cached `SheetAccessor.getDataSpreadsheet()`. **Coded 2026-07-24:** replaced all 8 occurrences in `TaskService.js` (`createTask`, `hasOpenTasks`, `completeTask`, `updateTaskStatus`, `getTasksByProject`, `updateTaskNotes`, `updateTaskDates`, `findOpenTaskByType` — one more than the plan's 7 named, `updateTaskDates` has the identical pattern) and all 3 in `WebAppTasks.js` (`updateTask`, `deleteTasks`, `deleteTask`) — the latter also switched from the hardcoded `'SysTasks'` string to `sheetNames.SysTasks` via `SheetAccessor.getDataSheet()`, matching every other function already in that file. **Not done:** `createTask`'s per-call full-`SysTasks` de-dup scan — genuinely needs real design work (a safe cache invalidated on write) to fix without risking a stale-duplicate-check bug; left alone.
- **`ActivityBackfillService.js`** `_getExistingActivityIds()` — full `SysContactActivity` scan on every housekeeping cycle (~20 min cadence); no archiving policy exists for this table, unlike orders/tasks/jobs. **Skipped — needs a policy decision** (what's the archiving/retention rule?), not a code tweak. Left alone.

---

## Not yet sequenced (minor / low-value — sweep opportunistically, not worth a dedicated session)

Findings from the audit that didn't make the Tier 1-4 synthesis list and aren't folded into a session above. Listed so they aren't silently dropped; pick up alongside whichever session happens to touch the same file. **Independent review (2026-07-24) found this appendix was originally incomplete against §9 — the items below marked "(added on review)" were missing from the first draft and are added here rather than left silently dropped.**

- `LibraryService.js` `_supersedeFile` — try/catch covers only the Doc-stamp step, not the following `moveTo(archive)` call; a missing/trashed old file throws and reports total failure even though the new version is already live.
- `WebAppPublishing.js` `_extractTopic` — hardcoded prefix list missing `print-`/`mention-` (real content types), includes `flyer-` (not a real type) — a `print-*` slug's short URL comes out wrong.
- `OrchestratorService.js` `processSessionJobs` — duplicates `processPendingJobs`'s dispatch switch but is missing the `ValidationOrchestratorService`/`WooInventoryPushService` cases the other has; currently harmless, latent trap if a new job type routes through this path.
- `DevelopmentView.html` `devConfirm()` — reimplements `TaskWidgets.confirm()` from scratch instead of using it.
- `TaskWidgets.html` `formatDate` — derives via UTC components while `formatDateShort`/`formatDateFull` use local components; can render different calendar days for the same timestamp near midnight IL time.
- `AdminInventoryView.html` `handleComaxConfirmClick()` — calls `handleError('Error: ...')` with a bare string when `handleError(error)` expects an object; shows "Error: undefined."
- `AdminTasksView.html` `#btn-content-import` — created hidden, fully wired, nothing ever reveals it; button/handler/modal unreachable.
- `PackingSlipService`/`PrintService` — read/rewrite entire sheet ranges regardless of batch size; low severity, tables stay bounded via archiving.
- Cosmetic: `ManagerDashboardView_v2.html`'s retired Calendar view still renders 14 days into a permanently-hidden DOM tree on every filter change; `ManagerProductsView.html` has a stray `<!DOCTYPE html><html>` wrapper despite being an injected fragment.
- (added on review) `WebAdapter.js` `processOrderCsv` — final line-item check indexes `productItemFields` by hardcoded position instead of by name, despite the preceding logic tracking fields by name; reordering `product_item_fields` in config would silently validate the wrong columns.
- (added on review) `WooCommerceFormatter.js` `_csvEscape` — quote-detection regex only matches quote+space, not a bare trailing quote; muted because the only quote-heavy caller (`formatProductsForExport`) is dead code.
- (added on review) `WooCommerceFormatter.js` `formatProductsForExport` — dead code, zero callers, also references non-existent field names (`wps_WeightKg` vs. real `wps_Weight`).
- (added on review) `WooCommerceFormatter.js` `formatDescriptionHTML` — ~175 lines of unreachable "ORIGINAL FORMATTING" branch gated by a `const` that can never be false.
- (added on review) `InventoryManagementService.js` `updatePhysicalCounts` — "created new row" branch returns `{action: 'updated'}` instead of `'created'`.
- (added on review) `InventoryManagementService.js` `getStockLevel`/`updateStock` — dead code, broken if ever called (calls nonexistent `ProductService.getProductById`, looks for unprefixed headers that don't exist).
- (added on review) `ProductService.js` — `acceptProductSuggestion`, `webProductReassign`, `fixOrphanSku`/`vendorSkuUpdate` each re-implement "load headers → linear-scan → write" inline instead of a shared helper — the duplicated surface that let the Session K `wxl_SKU` bug hide across three copies.
- (added on review) `LibraryService.js`/`ProjectService.js` — every read/write does a full unbounded sheet scan; `reconcileLibraryDuplicates` adds one Drive folder-listing call per library row. Not yet a real quota risk at current row counts.
- (added on review) `ProjectService.js`/`WebAppProjects.js` — leftover debug `console.log` calls, not gated behind a debug flag.
- (added on review) `ProjectService._rowToProject` — camelCase derivation actually produces all-lowercase keys; harmless (every consumer reads the same lowercase form) but the comment is misleading.
- (added on review) `WebAppSystem`/manager data — `libraryBySlug.version` ships `slb_Version`, a field `DATA_MODEL.md` documents as retired/inert since @319.
- (added on review) `ContactImportService.js` — ~30-line archive-merge column-mapping block duplicated near-verbatim across `importFromOrderHistory` and `updateContactsFromOrders` (code's own comments acknowledge the duplication).
- (added on review) `ContactImportService.js` — hardcoded Drive folder ID (`IMPORT_FOLDER_ID`) instead of a `system.folder.*` SysConfig entry; also a dead local variable `couponItems` in two functions.
- (added on review) `CouponService.js`/`CampaignService.js` `importFromCsv` — same per-row full-sheet-read pattern as the `ContactEnrichmentService` finding in Session U, smaller scale.
- (added on review) `CrmIntelligenceService.js` — hardcoded Gregorian holiday dates; code's own comment already flags annual manual upkeep is required.

**Known gap, not a fix item:** Phase 4 (error-handling consistency) was only checked as an explicit dimension from the Content Library pass onward — Sync/Orders and Products/Inventory weren't systematically checked for catch-coverage/swallow-vs-rethrow patterns. If this audit is ever continued rather than closed out, that's the one legitimate remaining gap (per `CODE_AUDIT_PLAN.md` §10).

---

## Sequencing notes

- K, L, O, P, T are all self-contained and can run in any order — pick by whatever's fastest to clear.
- M and N need a user decision before coding starts; flag both explicitly rather than guessing an approach.
- Q needs care (live content-creation path) — don't rush.
- R is out of scope for a quick session; recommend spinning off `AUTHORIZATION_PLAN.md` when it's picked up.
- S is one mechanical pass once started; safe to bundle with T if a session wants two cleanup-flavored tasks back to back.
- U is genuinely optional — the audit itself says none of it is urgent at current data volumes.

Recommend starting with **K** (clears 3 bugs in one session, zero design decisions) then **L** (closes the one real external-input XSS gap) before deciding what's next.
