# UI Tier 5.2 — AdminProductsView CLAUDE.md compliance

**Session ID:** UI_T5_2
**Status:** Plan v1 (2026-05-28). Ready to ship. All gaps resolved via code reading:
- **AdminProductsView modals are ALREADY modal-overlay** — all 7 modals (`vendor-sku-modal`, `replacement-modal`, `fix-orphan-modal`, `suggestion-modal`, `linkage-modal`, `lookup-modal`, `editor-modal`) use `<div class="modal-overlay">`. Zero `class="modal fade"`. Zero `$().modal()` calls.
- The audit's premise for modal cleanup at this view was **wrong** — they were either always modal-overlay or were converted earlier (likely as part of `ADMIN_VINTAGE_REVIEW_UX_PLAN.md` work). **No modal conversion needed.**
- **Remaining violations: 3 `btn-primary` sites only** at `:186` (Export New Products), `:590` (Finalize Hot Insert), `:1420` (Link button).

**Parent:** `UI_AUDIT.md` §5 Tier 5.2
**Estimated effort:** 1 session, 1 stage, ~10 minutes including push+deploy+smoke.
**Depends on:** Nothing structural.

## Session goal

Replace 3 invented `btn-primary` classes with the file's existing `btn` / `btn-light` pattern. CLAUDE.md compliance for this view. Zero modal work needed — already compliant.

## Session opening checklist

1. Working tree clean.
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. **Re-verify the audit's premise correction:** run `grep -n "modal fade\|\$('#" jlmops/AdminProductsView.html` — expected zero results. If non-zero, the file has changed since plan time; surface and re-plan.
5. Open the file at `:186`, `:590`, `:1420` to confirm session-time button context matches plan.

## Stage A — 3 btn-primary fixes

**Why one stage.** 3 trivial substitutions in one file. Single commit, single deploy.

**Files.**
- Edit `jlmops/AdminProductsView.html` — 3 button class changes.

**Changes.**

Modify `:186`:

```html
<!-- before -->
<button id="btn-export-new" class="btn btn-primary mr-2" onclick="AdminProductsView.exportNewProducts()">Export New Products</button>
<!-- after -->
<button id="btn-export-new" class="btn mr-2" onclick="AdminProductsView.exportNewProducts()">Export New Products</button>
```

Modify `:590`:

```html
<!-- before -->
<button class="btn btn-primary" onclick="AdminProductsView.submitLinkage()">Finalize Hot Insert</button>
<!-- after -->
<button class="btn" onclick="AdminProductsView.submitLinkage()">Finalize Hot Insert</button>
```

Modify `:1420`:

```html
<!-- before -->
<td><button class="btn btn-sm btn-primary" onclick="AdminProductsView.openLinkageModal('${t.taskId}', '${t.sku}')">Link</button></td>
<!-- after -->
<td><button class="btn btn-sm" onclick="AdminProductsView.openLinkageModal('${t.taskId}', '${t.sku}')">Link</button></td>
```

Verify post-edit: `grep -n "btn-primary\|btn-danger\|btn-warning\|btn-info\|btn-success" jlmops/AdminProductsView.html` returns zero results.

**Smoke.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T5.2: AdminProducts CLAUDE.md compliance — 3 btn-primary → bare btn"`.
- Open AdminProductsView. Spot-check each fixed button:
  - **Export New Products** in Card 2 — confirm light btn style; click → export fires.
  - **Finalize Hot Insert** in the linkage panel — confirm light btn; submit fires.
  - **Link** button in the Finalize Linkage list — confirm light btn; opening linkage modal works.
- No regression to button click behavior.

**Rollback.** Git revert + redeploy.

**Risk.** Minimal. CSS-class-only changes; backend untouched.

**Commit.** `ui(AdminProducts): replace 3 invented btn-primary with bare btn (CLAUDE.md compliance)`

## Session-end checklist

1. **Git log review.** One commit.
2. **Live smoke** per above.
3. **Grep verification:** `grep -n "btn-primary\|modal fade\|\$('#" jlmops/AdminProductsView.html` returns zero results.
4. **Update `UI_AUDIT.md` §10 status:** mark T5.2 SHIPPED — note the audit's modal-cleanup premise was wrong (they were already compliant); only btn-primary cleanup happened.
5. **Update `.claude/session-log.md`:** brief note.
6. **CCP-UI audit:**
   - CCP-UI-2 (button discipline): zero invented btn-color classes after this session.

## Notes for future sessions

- **Audit correction recorded:** UI_AUDIT.md §5 Tier 5.2 should be updated to reflect that AdminProductsView modals were already modal-overlay; only btn-primary fixes were needed. Update at session end.
- This session is the smallest in the queue. If batching with another short session feels natural (e.g., a tail-end cleanup pass), it could ride along. Otherwise stays standalone for change-isolation.
