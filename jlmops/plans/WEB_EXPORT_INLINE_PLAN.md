# Web Inventory Export — Inline Refactor Plan

**Created:** 2026-05-12
**Status:** SHIPPED as @88 on 2026-05-12; postscript regression fix shipped as @96 on 2026-05-13 (see end of doc).
**Scope:** Move the daily sync's web inventory export step from the async job-queue architecture to a synchronous backend call. Eliminate the `GENERATING_WEB_EXPORT` stage. The CSV file is still produced; only the machinery wrapped around the production changes.
**Out of scope:** All other sync stages remain on the async-job model. No change to `WAITING_WEB_CONFIRM`, `PUSHING_WEB_INVENTORY`, or the API upload path. No change to the diff logic itself.

---

## Why

The web inventory export keeps breaking despite repeated point fixes:

- **2026-03-03:** stale-poll discard fix
- **2026-03-17:** post-completion button reset
- **2026-05-05:** inline stuck-job reaper (`SYNC_HARDENING_PLAN.md` Bug 4)
- **2026-05-12 (today):** state advanced to `COMPLETE` with `step5='skipped'` after a real diff was produced — file `Inv-Web-05-12-07-21.csv` written to Drive but never uploaded to the web. User had to push manually.

Each fix patched a different race in the same triple: SysJobQueue row status, `webExportFilename` in state, orchestrator polling deciding to advance stage. New races keep emerging because three independent processes must agree on each transition.

The export itself is not a long-running background operation. Reading the implementation at `ProductService.js:901-1018`:

- Reads `CmxProdM` + `WebProdM` + `SysInventoryOnHold` into memory maps
- Iterates the WebProdM map (~700–800 products)
- For each product: compare new stock/price to existing, push to `exportProducts[]` if changed
- If `exportProducts.length === 0` → set `webExportFilename = 'No Changes Detected'`, return
- Otherwise → format CSV via `WooCommerceFormatter.formatInventoryUpdate`, write one file to Drive, set `webExportFilename = fileName`, return

No external API calls during diff. Total runtime is well under one minute in normal operation. There is no reason this step lives in the async job queue.

---

## Today's failure (concrete)

Symptom in widget log:

```
✓ 7:21:29 - Importing Comax products... - done
✓ 7:22:30 - Export file: Inv-Web-05-12-07-21.csv
✓ 7:25:51 - Web inventory - skipped
✓ 7:26:28 - Export file: Inv-Web-05-12-07-26.csv
✓ 7:26:28 - Daily sync completed
```

Reconstructed sequence:

1. First Generate → job queued → file `Inv-Web-05-12-07-21.csv` written at 7:22:30. State write of `webExportFilename` either failed or was lost in a race with the orchestrator's read.
2. Orchestrator's `GENERATING_WEB_EXPORT` branch (`OrchestratorService.js:1295-1351`) read state, saw `webExportFilename` empty or `'No Changes Detected'`, took the `noChanges` path → stage = `COMPLETE`, step5 = skipped, session task closed, files registered.
3. The widget didn't refresh cleanly — still showed Generate. User clicked again, producing `Inv-Web-05-12-07-26.csv` (a redundant file).

The orchestrator's `noChanges` detection is the single sentinel that decides whether the sync is over or just beginning the user-confirm phase. Any path that leaves `webExportFilename` unset at the moment of the orchestrator's read sends the sync to `COMPLETE` without an upload, **even when a real CSV with real changes exists on Drive**. That is the structural fault.

---

## Proposed change

### Backend (`WebAppSync.generateWebExportBackend`)

Replace the current queue-and-poll flow:

**Current (`WebAppSync.js:389-430`):**
```
guard stage = WAITING_WEB_EXPORT
  → transition to GENERATING_WEB_EXPORT
  → OrchestratorService.queueWebInventoryExport(sessionId)
  → OrchestratorService.run('hourly')
  → return (orchestrator will advance state later, asynchronously)
```

**Proposed:**
```
guard stage = WAITING_WEB_EXPORT
  → run ProductService.exportWebInventory(sessionId) inline (synchronous)
  → if result has no changes:
      transition to COMPLETE, step5 = skipped, complete session task, register files
  → else:
      transition to WAITING_WEB_CONFIRM, step5 = waiting, set webExportFilename
  → return the post-state to the widget
```

The widget's existing success handler (`runAction` in `AdminDailySyncWidget_v2.html`) renders the new state via `STAGE_CONFIG`. From `WAITING_WEB_CONFIRM` it shows the API push + manual confirm buttons — same as today, just reached without an intermediate spinner stage.

### State machine (`SyncStateService.js`)

Remove `GENERATING_WEB_EXPORT` from `STAGES` and `TRANSITIONS`. The new transition is direct:

```
VALIDATING → WAITING_WEB_EXPORT → WAITING_WEB_CONFIRM → (COMPLETE | PUSHING_WEB_INVENTORY)
```

`WAITING_WEB_EXPORT` can transition to either `WAITING_WEB_CONFIRM` or `COMPLETE` (the no-changes path).

### Orchestrator (`OrchestratorService.js`)

Remove the entire `GENERATING_WEB_EXPORT` polling branch (lines 1295-1351). The `_reapStuckJobInSession` call for `export.web.inventory` and the `noChanges` decision logic both go away. The PUSHING_WEB_INVENTORY branch (the API upload polling) stays — that one is genuinely async via WooInventoryPushService.

Also remove `queueWebInventoryExport` (lines 404+) and the `export.web.inventory` case in `processJob` dispatch.

### Config (`config/jobs.json`)

Remove the `export.web.inventory` job-type registration. Regenerate `SetupConfig.js`.

### Widget (`AdminDailySyncWidget_v2.html`)

Remove the `GENERATING_WEB_EXPORT` entry from `STAGE_CONFIG`. The polling cadence stays as-is; nothing else needs to change in the widget.

---

## Callers audit (resolved 2026-05-12)

| Caller | File:line | Path | Disposition |
|---|---|---|---|
| `WebAppInventory_exportWebInventory` | `WebAppInventory.js:168` | Admin UI direct button (outside sync flow) | Keep. Synchronous call into the canonical `ProductService.exportWebInventory`. |
| `generateWebExportBackend` queue path | `WebAppSync.js:389-430` | Sync flow Generate click | **Replace** with inline call to `ProductService.exportWebInventory`. |
| `getWebInventoryExportBackend` | `WebAppSync.js:749-759` | Orphan — zero callers (verified by grep) | **Delete.** Misleadingly named ("retrieve URL" but actually runs a full export); dead code. |
| Async job dispatch | `ProductImportService.js:1017-1020` | `case 'export.web.inventory'` in processJob | **Remove** (job type going away). |
| `ProductImportService.exportWebInventory` | `ProductImportService.js:1047-1179` | Duplicate of `ProductService.exportWebInventory` | **Delete.** Differs only in missing the bundle-product skip at lines 938-942 of the `ProductService` copy. Without the skip, every `woosb`/`bundle` product hits the `cmxMap.has(sku)` miss path and emits a misleading "Not found in Comax" warning — cosmetic noise on every export. `ProductService` copy is canonical. |
| `run_exportWebInventory` global wrapper | `ProductImportService.js:1199-1200` | Orphan — Apps Script project triggers are `daily maintenance` and `pullwooorders` only (user-verified 2026-05-12) | **Delete.** Not wired to any trigger. |
| Async job dispatch in ProductService | `ProductService.js:867-868` | Second `case 'export.web.inventory'` in another `processJob` switch | **Audit at implementation time** — appears to be a second job-dispatch path in `ProductService.js`. Confirm it's part of the job-queue machinery being removed (likely yes), or note as separate concern. |

Net effect: `ProductService.exportWebInventory` becomes the single canonical implementation, called from exactly two places — `WebAppInventory_exportWebInventory` (admin button) and the rewritten `generateWebExportBackend` (sync flow).

---

## Files in scope

- `jlmops/WebAppSync.js` — rewrite `generateWebExportBackend`; delete orphan `getWebInventoryExportBackend`
- `jlmops/ProductService.js` — `exportWebInventory` body unchanged. The state-update side effect at lines 988-994 and 1010-1018 (`webExportFilename` set on the active session) stays — the rewritten `generateWebExportBackend` reads the post-state to decide its return transition. Also delete the `case 'export.web.inventory'` job dispatch at `ProductService.js:867-868` (if confirmed redundant).
- `jlmops/ProductImportService.js` — delete the duplicate `exportWebInventory` (lines 1047-1179); delete the `case 'export.web.inventory'` job dispatch (lines 1017-1020); delete the `run_exportWebInventory` global wrapper (lines 1199-1201)
- `jlmops/SyncStateService.js` — remove `GENERATING_WEB_EXPORT` stage and transitions
- `jlmops/OrchestratorService.js` — remove `queueWebInventoryExport`, remove `GENERATING_WEB_EXPORT` branch in `_checkAndAdvanceSyncState`
- `jlmops/config/jobs.json` — remove `export.web.inventory` job type
- `jlmops/AdminDailySyncWidget_v2.html` — remove `GENERATING_WEB_EXPORT` from `STAGE_CONFIG`
- `jlmops/plans/SYNC_HARDENING_PLAN.md` — mark Bug 4 as obsoleted by this refactor (the stage it described no longer exists)

---

## Migration sequence

Single commit. Steps 1–5 below are the implementation order *within* the commit — they share tight dependencies (the inline rewrite, state-machine cleanup, config cleanup, and widget cleanup form one coherent change that can't safely ship half-done). Verification and deploy follow as separate events.

**Implementation order (one commit):**

1. **Dead-code + duplicate removal.** Delete `getWebInventoryExportBackend` (orphan), delete `ProductImportService.exportWebInventory` and its `processJob` case, delete `run_exportWebInventory` global wrapper. Confirm and delete the `ProductService.js:867-868` job-dispatch case if redundant. No behavior change to live paths — only callers that disappear are dead code and the about-to-be-removed async job dispatch.
2. **Backend rewrite.** Rewrite `generateWebExportBackend` to call `ProductService.exportWebInventory` inline and transition state directly (`WAITING_WEB_EXPORT → WAITING_WEB_CONFIRM` or `→ COMPLETE` on no-changes). Returns the post-state to the widget.
3. **State machine + orchestrator cleanup.** Remove `GENERATING_WEB_EXPORT` from `STAGES`/`TRANSITIONS`. Remove the orchestrator's `GENERATING_WEB_EXPORT` branch. Remove `queueWebInventoryExport`.
4. **Config cleanup.** Remove `export.web.inventory` from `jobs.json`. Regenerate `SetupConfig.js`. Run `rebuildSysConfigFromSource()` on test deploy.
5. **Widget cleanup.** Remove the `GENERATING_WEB_EXPORT` entry from `STAGE_CONFIG`.

**Then, as separate events:**

6. **Verification on `/dev` deploy** (see below).
7. **User authorization to deploy to stable URL.** Live cutover.

---

## Verification

**Operational constraint:** the daily sync runs once per day on the stable URL. `/dev` is not isolated — it reads the same Drive, SysConfig, and WebProdM as live. A "synthetic-diff" test on `/dev` would mutate real production data, which isn't worth it for what `/dev` actually proves. The sync widget is admin-only (single user), so any failure on the stable URL has no public exposure and rollback is fast. Verification collapses to one in-conversation check after deploy, then live observation tomorrow.

### Post-deploy smoke test (today, immediately after `clasp deploy`)

1. Open the admin URL in a browser.
2. Navigate to the sync widget.
3. Confirm the page renders, the widget displays current state correctly, no browser-console errors.
4. **Do not click Generate.** No diff-producing action.

If the page renders cleanly → done for today, await tomorrow's sync.
If the page throws or doesn't render → execute rollback (below) immediately.

### Live sync observation (tomorrow morning)

- Be present at the start of the daily sync.
- Watch each step in the widget. Critically: after Generate, the widget must transition to `WAITING_WEB_CONFIRM` with the API upload button visible, OR to `COMPLETE` if there are no changes.
- If the API upload button appears, run it and confirm the inventory updates on the live site.
- If anything looks wrong (stuck spinner, missing buttons, wrong stage, error in widget), **trigger rollback immediately** (below). The manual CSV upload path (used 2026-05-12) remains the safety net to push inventory for the day.

Bug 4 from `SYNC_HARDENING_PLAN.md` is no longer reproducible because the stage doesn't exist.

## Rollback plan

Before `clasp deploy`:

1. Note the current deployed `@version` from `clasp deployments`.
2. Tag the pre-refactor git commit: `git tag pre-web-export-inline`.
3. Confirm `clasp` is authenticated and the project-local `.clasprc.json` is current.

If Phase 2 observation reveals a problem:

1. `git checkout pre-web-export-inline`
2. `clasp push` (restores GAS source to pre-refactor)
3. `clasp deploy --deploymentId <stable-id>` (promotes the restored version to the stable URL)
4. `rebuildSysConfigFromSource()` in the Apps Script editor (restores the `export.web.inventory` job type to SysConfig).
5. Verify the widget recovers to the previous behavior — the stuck-state bugs return, but they're the known-quantity stuck-state bugs, not a new failure mode.
6. Use the manual CSV upload path for today's inventory if the sync can't complete naturally.
7. After rollback, diagnose the failure cause without time pressure, revise the plan, retry on a future day.

Rollback target: under 10 minutes from observed failure to restored previous version. The user has done equivalent rollbacks before during the cutover work (`plans/CUTOVER_CHECKLIST.md`).

---

## Risks

1. **Apps Script execution time.** The export must complete within the 6-minute hard limit AND within the `google.script.run` HTTP timeout (5 minutes for the call to return). Today's data volume (~700–800 products) runs in seconds. If product count grows substantially (multiples) the bound matters — but at that scale, the diff logic itself is the optimization target, not the queue architecture.
2. **Lock contention on SysConfig writes.** Inline run holds the session longer than the queue path. If the user has multiple admin tabs open polling the state, lock contention could increase. Mitigation: existing `ConfigService.forceReload()` pattern + lock service usage in `SyncStateService.setSyncState` should handle this; verify in step 1 of verification.
3. **Sessions where `WebAppInventory_exportWebInventory` (admin button) is used outside sync.** The admin button calls the same function. Today it runs synchronously and returns. No change. The function's state-update side effect at lines 988-994 and 1010-1018 fires only when `currentState.sessionId === sessionId`, so a non-sync caller (which passes no sessionId) leaves state alone — safe.
4. **Rollback.** If the inline rewrite has an unforeseen issue, restoring the queue path requires re-adding the stage, transition, job type, orchestrator branch, and widget config. The commented-out old code from step 2 provides the rollback recipe; once verification passes, that scaffolding is removed in a cleanup commit.

---

## Open questions

1. **`SYNC_HARDENING_PLAN.md` open items 1–3.** Bugs 1, 2, 3 in that plan are orthogonal to this refactor. They affect order-export and stage-rendering races. Worth keeping that plan alive for those, or fold into a successor plan after this lands?
2. **`ProductService.js:867-868` job-dispatch case.** A second `case 'export.web.inventory'` outside `ProductImportService.processJob`. Confirm at implementation time whether this is part of the job-queue machinery being removed, or a separate dispatcher with other reasons to exist.

Resolved 2026-05-12:
- ~~`WebAppSync.js:754` caller — orphan `getWebInventoryExportBackend`, no callers, delete.~~
- ~~Two `exportWebInventory` implementations — `ProductService` copy is canonical (has bundle skip); `ProductImportService` copy is the duplicate, delete.~~
- ~~`run_exportWebInventory` trigger — Apps Script project triggers are `daily maintenance` and `pullwooorders` only; this function is orphan, delete.~~

---

## What this does and does not fix

**Fixes (directly):**
- Today's failure mode (no-changes-detected after a real diff was produced).
- Bug 4 in `SYNC_HARDENING_PLAN.md` (Generate button stays after export completes).
- Any future race where the `webExportFilename` write loses to the orchestrator's read.

**Does not fix (out of scope):**
- Bugs 1, 2, 3 in `SYNC_HARDENING_PLAN.md` (other sync stages — order export, Comax import display).
- The `PUSHING_WEB_INVENTORY` async path (legitimate background work — Woo API call).
- Comax product import being async (legitimate — Drive I/O + variable file size).
- Any non-sync admin button on the inventory widget.

---

## Postscript — 2026-05-13: regression caught at the morning-sync watchpoint, fixed as @96

The @88 refactor moved `exportWebInventory` from `ProductImportService` (duplicate, deleted) to `ProductService` (canonical, kept). It also rewrote `generateWebExportBackend` in `WebAppSync.js` to call `ProductService.exportWebInventory(sessionId)` inline instead of enqueuing a job. Both halves of the move were correct in the file bodies — but the public return object of the `ProductService` IIFE (at `ProductService.js:2886`) was never updated to expose the function.

So at runtime, `ProductService.exportWebInventory` was `undefined`. The deployed code couldn't be exercised because no daily sync had been run between the @88 push (2026-05-12 afternoon) and this morning's sync, and the failure surface was specifically a public-API lookup rather than a code-body bug — invisible to static review of the file diffs and invisible to the post-deploy smoke check that didn't actually invoke Generate.

When the daily sync ran on 2026-05-13 morning (the expected watchpoint queued in STATUS.md after @88), `generateWebExportBackend` failed with `"ProductService.exportWebInventory is not a function"`. Two callers were broken:
- `WebAppSync.js:406` — the new inline sync path introduced by @88.
- `WebAppInventory.js:169` — the admin "Re-Export" button, which used the same public-API call pattern; this was broken in @88 as well, just hadn't been exercised between push and the morning sync.

**Fix shipped as @96 on 2026-05-13:** added `exportWebInventory: exportWebInventory,` to the `ProductService` return object. Removed the stale `// Note: ... moved to ProductImportService` comment that no longer reflected reality. Two-line diff in `ProductService.js`.

**Lesson worth keeping:** a refactor that moves a function between modules and changes who exposes it on its public API needs a deliberate check of the destination module's return object, not just the function body and the caller. The @88 caller audit covered every caller site but did not verify that the function was actually reachable through the destination module's exported surface. For future moves of this shape, add "verify exposed in return object" to the checklist alongside "every caller updated."
