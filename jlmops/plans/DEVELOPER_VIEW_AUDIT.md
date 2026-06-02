# Developer View — Safety / UX Audit

**View file:** `jlmops/DevelopmentView.html` (server handlers in `WebApp.js`, `SetupConfig.js`, `SetupSheets.js`, `ValidationLogic.js`, `HousekeepingService.js`, `WebAppSystem.js`).
**Audited:** 2026-06-02. Read-only investigation.
**Summary:** 5 action buttons. **0 have any confirmation prompt.** Two run destructive/irreversible operations on live data with no guard. Mobile button row has no vertical spacing — wrapped buttons touch.

---

## Per-action table

| Action (button) | Server function (chain) | Destructive? | Has confirm? | Recommendation |
|---|---|---|---|---|
| **Rebuild SysConfig** | `runRebuildSysConfigFromSource()` → `rebuildSysConfigFromSource()` (`SetupConfig.js:19`) | **Yes** — `sheet.clear()` wipes the live `SysConfig` sheet, then rewrites all rows from master. Runtime keys (timestamps, sync state) are snapshotted and restored; snapshot failure aborts before the wipe. Still an in-place rewrite of all live config. | **No** | **Gate behind a typed/explicit confirm.** Not removable (it's a needed admin op), but it should never fire on a stray click. |
| **Protect Headers** | `protectAllSheetHeadersFromUI()` → `protectAllSheetHeaders()` (`SetupSheets.js:143`) | Low — applies WARNING-only header protection + freezes row 1 across data/log/library sheets. Reversible, no data loss. | No | **Safe to leave on.** Optional lightweight confirm. |
| **Validate Schema** | `validateDatabaseSchemaFromUI()` → `ValidationLogic.validateDatabaseSchema()` (`ValidationLogic.js:612`) | No — read-only; returns a discrepancy report. | No | **Safe to leave on.** No confirm needed. |
| **Daily Housekeeping** | `runDailyMaintenance()` → `performDailyMaintenance()` (`HousekeepingService.js:602`) | **Yes — highest risk.** Runs the full daily batch: purges old jobs, archives completed tasks/orders, **trashes Drive files** (`manageFileLifecycle`, `cleanupImportFiles`), cleans old logs, reformats sheets; then Phase-3 **external/customer-facing writes** — reimport all bundles, pull Mailchimp subscribers/campaigns, refresh CRM, **create welcome-outreach tasks**, run CRM intelligence. Manual run duplicates the scheduled trigger. | **No** | **Highest priority. Gate behind a hard confirm** (typed phrase, e.g. "RUN HOUSEKEEPING"), or move it off the general dev view behind a stronger guard. A misclick mutates live data, trashes files, and can generate customer outreach tasks. |
| **Run Unit Tests** | `WebAppSystem_runUnitTests()` → `TestRunner.runAllTests()` (`WebAppSystem.js:568`, `TestRunner.js:12`) | No found — runs 4 suites (`OrderServiceTest`, `ProductServiceTest`, `ComaxAdapterTest`, `WebAdapterTest`). No write ops (`setValue`/`appendRow`/`clear`/`setValues`) found in the suite files. *Deep call paths not fully traced — treat as "no live writes found," not "proven none."* | No | **Safe to leave on.** No confirm needed. |

---

## Confirmation gap

All **5 of 5** actions lack any confirmation. The two that matter:

1. **Daily Housekeeping** — destructive + irreversible + external side-effects. **No guard. Top priority.**
2. **Rebuild SysConfig** — wipes/rewrites the live config sheet. **No guard. Second priority.**

The other three (Protect Headers, Validate Schema, Run Unit Tests) are non-destructive; confirms optional/unnecessary.

---

## Mobile layout

**Confirmed: buttons run together on mobile.** The button row is five Bootstrap 4.6.2 `.btn` elements (inline-block) each carrying only `.mr-2` (right margin `0.5rem`). There is **no bottom margin, no flex container, no `gap`, and no flex-wrap rule**. On a narrow viewport the inline-block buttons wrap to multiple lines with **zero vertical spacing**, so the rows touch.

`DevelopmentView.html:8-12`:
```html
<button class="btn mr-2" onclick="runRebuildSysConfig()">Rebuild SysConfig</button>
<button class="btn mr-2" onclick="runProtectHeaders()">Protect Headers</button>
... (3 more, same pattern)
```

The project's `.responsive-stack` pattern (`AppView.html:113-137`) is a **table-collapse utility only** — it restyles `table.responsive-stack tr/td`, not buttons. **It does not apply here.** (Touch-target sizing does already apply: `AppView.html:154` sets `.btn { min-height: 44px; }` at ≤768px.)

**Fix shape (Bootstrap 4 — no `gap` utility available):** wrap the buttons in a flex-wrap container and add a bottom margin to each so wrapped rows separate.

```html
<div class="d-flex flex-wrap">
  <button class="btn mr-2 mb-2" onclick="runRebuildSysConfig()">Rebuild SysConfig</button>
  <button class="btn mr-2 mb-2" onclick="runProtectHeaders()">Protect Headers</button>
  <button class="btn mr-2 mb-2" onclick="runValidateSchema()">Validate Schema</button>
  <button class="btn mr-2 mb-2" onclick="runDailyHousekeeping()">Daily Housekeeping</button>
  <button class="btn mr-2 mb-2" onclick="runUnitTests()">Run Unit Tests</button>
</div>
```

Minimal change: add `mb-2` to each button (the `d-flex flex-wrap` wrapper is the cleaner version).

---

## Prioritized action list (build session can execute from this)

**Status 2026-06-02 (deploy @203):** items 1–3 SHIPPED. Per user decision, the confirms are *standard* (not typed-phrase), but the confirm dialog is a centered overlay positioned deliberately **away from the trigger button** (Cancel default-focused, destructive Confirm offset to the far side, Esc + backdrop = cancel) so a stray second tap/click can't blow straight through — addressing the "action and confirm in the same spot" risk. Reusable `devConfirm()` helper in `DevelopmentView.html` (self-contained; promote to a shared `TaskWidgets` helper if another view needs a destructive confirm). Items 4 (optional Protect-Headers confirm) and 5 (trace Run-Unit-Tests internals) remain open.

1. **Add a hard confirm to Daily Housekeeping.** Block the call until the user confirms (ideally a typed phrase, since it's destructive + fires external writes). Highest priority.
2. **Add a confirm to Rebuild SysConfig.** Standard confirm ("This rewrites the live SysConfig sheet. Continue?") before `google.script.run`.
3. **Fix the mobile button row** — wrap in `<div class="d-flex flex-wrap">` and add `mb-2` to each button (see above).
4. *(Optional)* Light confirm on **Protect Headers**; leave **Validate Schema** and **Run Unit Tests** as-is (non-destructive).
5. *(Follow-up, needs check)* Trace `Run Unit Tests` suite internals to confirm no live-sheet writes — currently "no write ops found," not proven clean.

---

*Audit only — no code changed. Sources read: `DevelopmentView.html`, `WebApp.js`, `SetupConfig.js`, `SetupSheets.js`, `ValidationLogic.js`, `HousekeepingService.js`, `WebAppSystem.js`, `TestRunner.js`, `AppView.html`.*
