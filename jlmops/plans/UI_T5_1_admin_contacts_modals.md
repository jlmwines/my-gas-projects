# UI Tier 5.1 — AdminContactsView Bootstrap modal cleanup

**Session ID:** UI_T5_1
**Status:** Plan v1 (2026-05-28). Ready to ship. All gaps resolved via code reading:
- **3 modals to convert:** `#modal-activity` (Log Activity at `:420-454`), `#modal-task` (Create Task at `:457-489`), `#modal-email` (Compose Email at `:491-518`). All use `class="modal fade"` + Bootstrap `$().modal()` open/close.
- **Bootstrap open call sites:** `:615` (modal-task), `:621` (modal-activity), `:632` (modal-email).
- **Bootstrap close call sites:** `:686` (modal-email after send), `:1067` (modal-activity after save), `:1087` (modal-task after create).
- **2 invented btn-primary sites:** `:409` `#btn-save-notes`, `:515` `#btn-send-email`.
- **Click-outside-to-close convention:** Bootstrap modal closed on backdrop click by default; jlmops project modal-overlay precedents (e.g., `AdminProductsView` modals) do NOT auto-close on backdrop click. **Decision: preserve project convention — no backdrop click-to-close.** Explicit Cancel + close-X buttons only.

**Parent:** `UI_AUDIT.md` §5 Tier 5.1
**Estimated effort:** 1 session, 2 staged deploys.
**Depends on:** Nothing structural. Independent.

## Session goal

CLAUDE.md compliance for AdminContactsView. All 3 Bootstrap modals convert to the project's modal-overlay pattern. 2 invented `btn-primary` classes replaced with the file's existing `btn` / `btn btn-sm` pattern.

## Session opening checklist

1. Working tree clean.
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. Re-read `AdminContactsView.html:418-518` (3 modal markups), `:615, :621, :632, :686, :1067, :1087` (Bootstrap call sites), `:409, :515` (btn-primary sites).
5. Re-read `jlmops/CLAUDE.md:80-95` (modal-overlay rule) + `:68-78` (button rule).
6. Confirm grep for `$('` prefix patterns finds only the 6 known modal-related sites; no other jQuery usage to migrate (out of scope if found — flag and continue).

## Stage A — btn-primary fixes (2 sites)

**Why first.** Independent of modal conversion. Cheapest fix.

**Files.**
- Edit `jlmops/AdminContactsView.html` — 2 button class changes.

**Changes.**

Modify `:409`:

```html
<!-- before -->
<button id="btn-save-notes" class="btn btn-sm btn-primary">Save</button>
<!-- after -->
<button id="btn-save-notes" class="btn btn-sm">Save</button>
```

Modify `:515`:

```html
<!-- before -->
<button type="button" id="btn-send-email" class="btn btn-sm btn-primary">Send</button>
<!-- after -->
<button type="button" id="btn-send-email" class="btn btn-sm">Send</button>
```

Confirm via grep that `btn-primary` returns zero matches in AdminContactsView.html after these two edits.

**Smoke A.**
- `clasp push`. Deploy.
- Open AdminContactsView. Find a contact, click into detail panel. Confirm Save notes button renders as light btn. Open Compose Email modal — confirm Send button is light (modal is still Bootstrap — comes in Stage B; only the button class changed here).
- No regression to button click behavior.

**Rollback A.** Git revert + redeploy.

**Commit A.** `ui(AdminContacts): replace invented btn-primary with bare btn class (CLAUDE.md compliance; 2 sites)`

## Stage B — Convert 3 Bootstrap modals to modal-overlay

**Why second.** Single coherent change touching 3 modals. Smoke covers all 3 in one flow.

**Files.**
- Edit `jlmops/AdminContactsView.html` — modal markup (3 sites) + open/close call sites (6 total) + add helper `closeAdminModal(id)`.

**Changes.**

### Part 1: Add modal-overlay CSS

Insert at top of file (or extend existing `<style>` block if present):

```html
<style>
.modal-overlay {
  display: none;
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  justify-content: center;
  align-items: flex-start;
  padding-top: 80px;
  overflow-y: auto;
}
.modal-container {
  background: white;
  width: 90%;
  max-width: 500px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  display: flex;
  flex-direction: column;
}
.modal-container .modal-header { padding: 10px 16px; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center; }
.modal-container .modal-header h6 { margin: 0; }
.modal-container .form-body { padding: 16px; }
.modal-container .modal-footer { padding: 10px 16px; border-top: 1px solid #dee2e6; display: flex; justify-content: flex-end; gap: 8px; background: #f8f9fa; }
</style>
```

(Same shape as T2.1's Stage A modal-overlay CSS extension. `max-width: 500px` matches the `modal-sm` Bootstrap class the originals used.)

### Part 2: Convert `#modal-activity` (Log Activity) at `:420-454`

```html
<!-- before -->
<div class="modal fade" id="modal-activity" tabindex="-1">
  <div class="modal-dialog modal-sm">
    <div class="modal-content">
      <div class="modal-header py-2">
        <h6 class="modal-title">Log Activity</h6>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <div class="modal-body">
        ...form fields unchanged...
      </div>
      <div class="modal-footer py-2">
        <button type="button" class="btn btn-sm" data-dismiss="modal">Cancel</button>
        <button type="button" id="btn-submit-activity" class="btn btn-sm">Save</button>
      </div>
    </div>
  </div>
</div>

<!-- after -->
<div class="modal-overlay" id="modal-activity">
  <div class="modal-container">
    <div class="modal-header">
      <h6>Log Activity</h6>
      <button type="button" class="close" id="btn-close-activity" aria-label="Close">&times;</button>
    </div>
    <div class="form-body">
      ...form fields unchanged (form-group structure preserved)...
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-sm" id="btn-cancel-activity">Cancel</button>
      <button type="button" id="btn-submit-activity" class="btn btn-sm">Save</button>
    </div>
  </div>
</div>
```

### Part 3: Convert `#modal-task` (Create Task) at `:457-489` — same pattern

Same structural conversion: `modal fade` → `modal-overlay`, `modal-dialog modal-sm modal-content` → `modal-container`, replace `data-dismiss="modal"` with id'd close/cancel buttons (`btn-close-task`, `btn-cancel-task`).

### Part 4: Convert `#modal-email` (Compose Email) at `:491-518` — same pattern

Same: `btn-close-email`, `btn-cancel-email`. The Send button (id `btn-send-email`) keeps its `btn btn-sm` class from Stage A.

### Part 5: Add `closeAdminModal` helper + wire close/cancel buttons

Add near the existing event-binding section (likely near the contact-list bindings at the start of the IIFE):

```javascript
function closeAdminModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

document.getElementById('btn-close-activity').addEventListener('click', function() { closeAdminModal('modal-activity'); });
document.getElementById('btn-cancel-activity').addEventListener('click', function() { closeAdminModal('modal-activity'); });
document.getElementById('btn-close-task').addEventListener('click', function() { closeAdminModal('modal-task'); });
document.getElementById('btn-cancel-task').addEventListener('click', function() { closeAdminModal('modal-task'); });
document.getElementById('btn-close-email').addEventListener('click', function() { closeAdminModal('modal-email'); });
document.getElementById('btn-cancel-email').addEventListener('click', function() { closeAdminModal('modal-email'); });
```

### Part 6: Replace `$(...).modal('show')` and `$(...).modal('hide')` calls

6 call sites to update:

```javascript
// :615 open task modal — before:
document.getElementById('btn-create-task').addEventListener('click', function() { $('#modal-task').modal('show'); });
// after:
document.getElementById('btn-create-task').addEventListener('click', function() { document.getElementById('modal-task').style.display = 'flex'; });

// :621 open activity modal — before:
$('#modal-activity').modal('show');
// after:
document.getElementById('modal-activity').style.display = 'flex';

// :632 open email modal — before:
$('#modal-email').modal('show');
// after:
document.getElementById('modal-email').style.display = 'flex';

// :686 close email after send — before:
$('#modal-email').modal('hide');
// after:
closeAdminModal('modal-email');

// :1067 close activity after save — before:
$('#modal-activity').modal('hide');
// after:
closeAdminModal('modal-activity');

// :1087 close task after create — before:
$('#modal-task').modal('hide');
// after:
closeAdminModal('modal-task');
```

**Smoke B.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T5.1: AdminContacts modals Bootstrap → modal-overlay (CLAUDE.md compliance)"`.
- Open AdminContacts. For each of the 3 modals:
  - **Log Activity:** click a contact → click "Log activity" → modal opens centered overlay with dim backdrop. Click close (×). Re-open. Fill the form. Click Save → activity row appears in timeline; modal closes.
  - **Create Task:** click "Create task" → modal opens. Fill form → Create → task created; modal closes.
  - **Compose Email:** click "Compose email" → modal opens. Type subject + body → Send → modal closes; result alert visible.
- Browser console during full flow: zero errors. No `$ is not defined` / `.modal is not a function`.
- Confirm backdrop click does NOT close any modal (per banked decision).

**Rollback B.** Git revert + redeploy.

**Risk B.** Medium-low. Three structural conversions in one stage; smoke covers each.

**Commit B.** `ui(AdminContacts): convert 3 Bootstrap modals to modal-overlay (CLAUDE.md compliance; activity/task/email)`

## Session-end checklist

1. **Git log review.** Two commits.
2. **Live smoke** — Stage A + Stage B paths.
3. **Grep verification:** `grep -n "\$('" jlmops/AdminContactsView.html` returns zero results. `grep -n "btn-primary" jlmops/AdminContactsView.html` returns zero results. `grep -n "modal fade" jlmops/AdminContactsView.html` returns zero results.
4. **Update `UI_AUDIT.md` §10 status:** mark T5.1 SHIPPED.
5. **Update `.claude/session-log.md`:** brief note.
6. **CCP-UI audit:**
   - CCP-UI-1 (modal pattern): zero `$().modal()` calls; zero `modal fade` markup.
   - CCP-UI-2 (button discipline): zero invented btn-color classes.

## Notes for future sessions

- **Bootstrap modal cleanup recipe established** (T2.1 Stage A + T5.1 Stage B). Same shape applies to T5.2 (AdminProductsView modal cleanup): markup conversion, close-helper, replace 6 call patterns. No new findings expected at T5.2.
- **No backdrop click-to-close decision banked** for the project — modal-overlays close only via explicit Cancel/× buttons. Document this in `CLAUDE.md` if it isn't already.
