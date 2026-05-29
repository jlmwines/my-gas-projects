# UI Tier 2.2 — CRM Tools nav misplacement (relocate CRM operations to AdminContactsView)

**Session ID:** UI_T2_2
**Status:** SHIPPED 2026-05-29 @154 deploy @158. Plan v1 (2026-05-28). All gaps resolved via code reading:
- **Nav structure correction:** the audit doc said "remove the duplicate CRM Tools nav entry." This was wrong — the two nav entries load **different views** (Contacts → ManagerContactView, the mobile-first lookup; CRM Tools → AdminContactsView, the full CRM browse). Neither is a duplicate. **Both nav entries stay.** What changes: the CRM Tools label finally matches its destination after CRM operations move into AdminContactsView.
- MC freshness chip stays at view-level in AdminContactsView header (`:13-14`); re-surfacing as a panel header is a minor concern, deferred.
- Panel default state: collapsed (weekly-or-less operations, not daily — per v0 audit decision).

**Parent:** `UI_AUDIT.md` §5 Tier 2.2
**Estimated effort:** 1 session, 1 staged deploy (atomic file-to-file move).
**Depends on:** Nothing. Independent.

## Session goal

Move the CRM Tools card and its 6 button handlers from `DevelopmentView.html:19-36` (+ JS functions at `:141-260`) into `AdminContactsView.html` as a collapsible "Admin operations" panel above the main contact-card row. DevelopmentView keeps only the system-debug card (Rebuild SysConfig / Protect Headers / Validate Schema / Daily Housekeeping / Run Unit Tests). Result: operator wanting to refresh contacts doesn't navigate to "Development."

## Session opening checklist

1. Working tree clean (`git status`).
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. Read `jlmops/DevelopmentView.html` end-to-end (262 lines). Confirm the 6 CRM button handlers are at `:141-260`: `runCrmImportData / runCrmValidate / runCrmCorrect / runCrmRefresh / runCrmEnrich / runCrmIntelligence`.
5. Read `jlmops/AdminContactsView.html:1-30` to confirm the two-column layout starts at `:2` with `col-md-8 / col-md-4`.
6. Confirm `runCrmImport / runCrmValidation / runContactDataCorrection / runContactRefresh / runContactEnrichment / runCrmIntelligence` backend functions still exist (grep `function runCrmImport` in `jlmops/*.js` if uncertain — these are the backend entry names called by the 6 button handlers).

## Stage A — Atomic file-to-file move

**Why one stage.** Moving code between two files is naturally atomic. Either both files reflect the move or neither does. Single commit, single deploy, single smoke.

**Files.**
- Edit `jlmops/AdminContactsView.html` — add collapsible panel with 6 buttons + add 6 JS handler functions.
- Edit `jlmops/DevelopmentView.html` — remove the CRM Tools card markup (`:19-36`) and the 6 JS handlers (`:141-260`).

### Part 1: Add Admin operations panel to AdminContactsView

Insert a new row immediately inside `<div class="container-fluid">` and BEFORE the existing two-column row at `:2`:

```html
<div class="row mb-3">
  <div class="col-12">
    <details class="card" id="admin-ops-panel">
      <summary class="card-header" style="cursor: pointer; user-select: none;">
        <span class="font-weight-bold">Admin operations</span>
        <span class="text-muted small ml-2">(import / validate / correct / refresh / enrich / intelligence)</span>
      </summary>
      <div class="card-body">
        <button class="btn mr-2" onclick="runCrmImportData()">Import CRM Data</button>
        <button class="btn mr-2" onclick="runCrmValidate()">Validate CRM</button>
        <button class="btn mr-2" onclick="runCrmCorrect()">Correct Data</button>
        <button class="btn mr-2" onclick="runCrmRefresh()">Refresh Contacts</button>
        <button class="btn mr-2" onclick="runCrmEnrich()">Enrich Contacts</button>
        <button class="btn mr-2" onclick="runCrmIntelligence()">Run Intelligence</button>
        <div id="crm-tools-results" class="mt-3"></div>
      </div>
    </details>
  </div>
</div>
```

Notes on choices:
- `<details>` / `<summary>` native disclosure for the collapsible — no JS needed, accessible, keyboard-operable. Aligns with project pattern (low-tech, no Bootstrap collapse plugin).
- Default collapsed (no `open` attribute) per audit decision (weekly-or-less ops).
- Buttons keep bare `btn` class — CCP-UI-2 (no invented color classes).
- `crm-tools-results` ID preserved from DevelopmentView so the 6 handler functions work without modification.

### Part 2: Add the 6 JS handler functions to AdminContactsView

AdminContactsView has its own `<script>` block (location to verify at session start by grep). Insert the 6 functions verbatim from `DevelopmentView.html:141-260`:

- `runCrmImportData()` (lines 142-164 of DevelopmentView)
- `runCrmValidate()` (166-191)
- `runCrmCorrect()` (193-212)
- `runCrmRefresh()` (214-225)
- `runCrmEnrich()` (227-239)
- `runCrmIntelligence()` (241-260)

Each function uses `document.getElementById('crm-tools-results')` to write its output — works unchanged because the result div ID is preserved in the new panel markup.

### Part 3: Remove CRM Tools card from DevelopmentView

Delete `DevelopmentView.html:19-36` (the `<div class="row mt-3">...<h3>CRM Tools</h3>...</div></div></div>`).

### Part 4: Remove the 6 JS handlers from DevelopmentView

Delete `DevelopmentView.html:141-260` (the `// --- CRM Tools Functions ---` comment + 6 handlers). The `<script>` block continues with just the 5 system-debug handlers (`runRebuildSysConfig / runProtectHeaders / runValidateSchema / runDailyHousekeeping / runUnitTests`).

**Smoke.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T2.2: move CRM ops from DevelopmentView to AdminContactsView"`.
- Open admin sidebar, navigate to "CRM Tools" (loads AdminContactsView). Confirm:
  - "Admin operations" collapsible card visible above the contact list.
  - Card is collapsed by default.
  - Click the summary → card expands showing 6 buttons.
  - Click "Refresh Contacts" → operation fires (alert / success message renders in `crm-tools-results`).
  - Click "Run Intelligence" → same.
  - Console: zero errors.
- Navigate to "Development" view. Confirm:
  - Only "Development Tools" card visible (5 system-debug buttons).
  - No CRM Tools section.
  - Click "Validate Schema" → still works.
  - Console: zero errors.

**Rollback.**
- Git revert + redeploy. Both files restore.

**Risk.**
- Low. Backend entry points unchanged. Button IDs reused. The two-column layout in AdminContactsView is unaffected (new row sits above it; existing `style="height: calc(100vh - 120px);"` on the col-md-8 card still fits the viewport because the new row adds ~50px when collapsed).

**Commit.** `ui(CRM): relocate Admin operations from DevelopmentView to AdminContactsView (collapsible above contact list; nav label finally matches destination)`

## Session-end checklist

After Stage A committed + deployed:

1. **Git log review.** One commit touching two files.
2. **Live smoke:** full flow above.
3. **Nav verification:** both "Contacts" (manager view) and "CRM Tools" (AdminContactsView with ops panel) work and load their respective views.
4. **Update `UI_AUDIT.md` §10 status:** mark T2.2 SHIPPED.
5. **Update `.claude/session-log.md`:** brief note.
6. **CCP-UI audit:**
   - CCP-UI-2 (button discipline): all 6 buttons use bare `btn` class — preserved from DevelopmentView.
   - CCP-UI-4 (role gating): the panel is implicit-admin-only (AdminContactsView is admin-only via WebApp.js viewMap). No explicit `data-roles` needed.

## Notes for future sessions

- **Audit doc correction:** UI_AUDIT.md Tier 2.2 §5 text said "Update `AppView.html:206` to remove the duplicate 'CRM Tools' nav entry pointing at AdminContactsView." This deep-dive corrects that — the two nav entries point at different views and both stay. Session-end update to UI_AUDIT.md §5 Tier 2.2 should reflect the correction (no nav change).
- **MC freshness chip surfacing** in panel header is deferred — minor cosmetic, not blocking. If addressed later, the chip moves from header (`:13-14`) into the new panel summary line.
- The collapsible `<details>` pattern established here is a precedent for any future Admin-ops-style panels that don't fit cleanly elsewhere.
