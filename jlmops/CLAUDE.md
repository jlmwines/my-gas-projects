# JLMOps Session Guidelines

## Follow Instructions Literally

When the user tells you to do something, do exactly that. Not your interpretation of it.

- "Copy X and modify it" → Read X, copy X, modify only what's needed
- "Look at how Y works" → Actually read Y before writing anything
- "Do it like Z" → Find Z, understand Z, replicate Z

Do NOT:
- Write from memory when told to copy
- Rewrite or "improve" when told to modify
- Guess at patterns when told to look at examples

If instructions are unclear, ask. Do not substitute your judgment for the user's instructions.

## Session Workflow

**Git and Deployment:**
- Sessions NEVER push code. User pushes, tests, then tells session to update docs/git.
- When user says `/session` or asks to close session: update docs and commit only.
- Wait for user confirmation before any git operations.

**Planning vs Execution:**
- Stay in planning mode until user explicitly says "implement", "do it", or similar.
- Confirming a detail is NOT permission to start coding.
- When discussing a plan, focus on the specific point - do NOT repeat the entire plan.
- Plans go in `jlmops/plans/` as permanent documents, not conversation output.

**Centralized Assets (in `.claude/` at project root `C:\Users\B\my-gas-projects\.claude\`):**

All projects share these files. Sessions can access them regardless of working directory.

| File | Purpose | Command |
|------|---------|---------|
| `wishlist.md` | Feature ideas for all projects (jlmops, web, marketing, content) | `/wish [project] item` |
| `bugs.md` | Known bugs for all projects | `/bug [project] item` |
| `commands/` | Slash command definitions | - |
| `project-context.md` | High-level project overview | - |
| `SESSION_SUMMARY.md` | Recent session work | - |

Project defaults to `jlmops` if not specified. Example: `/wish web exit popup` adds to web section.

## Communication Style

**Be concise:**
- When clarifying a small point, respond to that point only.
- Do NOT restate the entire context or plan unless asked.
- Code snippets in discussion should be minimal - just the relevant lines.

**Ask, don't guess:**
- If unsure about project conventions, READ the docs first.
- Key docs: `jlmops/plans/DATA_MODEL.md`, `jlmops/plans/PROJECT_TASK_PLAN.md`
- If still unsure, ASK the user.

## Project-Specific Knowledge

### Configuration System
**SetupConfig.js is GENERATED - never edit directly.**

Workflow:
1. Edit JSON files in `jlmops/config/*.json`
2. Run `node jlmops/generate-config.js`
3. Push with `clasp push`
4. Run `rebuildSysConfigFromSource()` in Apps Script

Config files: `headers.json`, `system.json`, `jobs.json`, `schemas.json`, `mappings.json`, `validation.json`, `taskDefinitions.json`, `orders.json`, `printing.json`, `users.json`, `otherSettings.json`

### UI Constraints

**CRITICAL: Copy existing patterns exactly. Do not invent.**

**Buttons - YOU WILL GET THIS WRONG. STOP AND READ FIRST.**

Claude repeatedly fails at buttons. Before writing ANY button:
1. Run: `grep -n "class=\"btn" <filename>`
2. Look at the output
3. Copy one of those classes exactly

Do not write `btn-primary`, `btn-secondary`, or any color class unless you SEE it in the grep output.

**Modals - MANDATORY RULES:**
1. Do NOT use Bootstrap modal (`$().modal()`)
2. Use the `modal-overlay` pattern with `style.display = 'flex'` / `'none'`
3. Copy an existing modal structure from AdminProductsView.html
4. Example:
```html
<div class="modal-overlay" id="my-modal" style="display:none;">
  <div class="modal-container" style="max-width: 500px;">
    <div class="modal-header">...</div>
    <div class="form-body">...</div>
    <div class="modal-footer bg-light">
      <button class="btn" onclick="document.getElementById('my-modal').style.display='none'">Cancel</button>
      <button class="btn" id="btn-submit">Submit</button>
    </div>
  </div>
</div>
```

**Tables:** Use `table table-sm table-hover` for data tables.

**Cards:** Use Bootstrap card classes, not custom styling.

**Golden Rule:** When adding ANY UI element, find the same element type already working in the file and copy it exactly.

### Task Notes Pattern
Tasks can store structured data in `st_Notes` as JSON:
```javascript
const notes = JSON.parse(task.st_Notes);
// Example: { daysSinceUpdate: 14, lastCheck: "2025-12-18" }
```
Used by: health status task, Brurya reminder task, packing slip task.

### Field Naming Conventions
- Sheet columns: `st_` prefix for SysTasks, `sol_` for SysOrdLog, `sp_` for SysProducts
- Task fields in code: `st_TaskId`, `st_TaskTypeId`, `st_Status`, `st_Notes`, `st_DoneDate`
- Config keys: dot notation like `system.brurya.last_update`, `validation.rule.*`

### Sync Workflow States
```
IDLE -> WEB_PRODUCTS_IMPORTING -> WEB_IMPORT_PROCESSING -> WEB_IMPORT_COMPLETE
     -> WAITING_FOR_COMAX -> READY_FOR_COMAX_IMPORT -> COMAX_IMPORTING
     -> WEB_EXPORT_GENERATING -> WEB_EXPORT_GENERATED -> COMPLETE
     -> FAILED (from any state)
```

Step statuses: `waiting`, `processing`, `completed`, `skipped`, `failed`

## Code Health (Light Touch)

During normal work, briefly flag obvious issues in code you're touching:
- Dead code or unused parameters
- Duplicated logic that should be a shared function
- Functions over 100 lines or deeply nested logic
- Hardcoded values that belong in config

**Don't derail:** Mention it once, continue with the task. Example:
> "Note: `processOrder()` has 3 unused parameters - consider cleanup later."

**Don't hunt:** Only flag what's in your immediate work area, not the whole codebase.

## Common Mistakes to Avoid

1. **Wrong field names:** `st_TaskTypeId` not `st_TypeId`
2. **Editing SetupConfig.js directly:** Always edit config/*.json
3. **Pushing code:** User handles deployment
4. **Inventing button styles:** NEVER add btn-primary, btn-secondary, etc. unless existing buttons in the same file use them. Copy exactly.
5. **Using Bootstrap modals:** This project uses `modal-overlay` with `style.display`, NOT `$().modal()`
6. **Repeating plans:** Focus on the question at hand
7. **Starting implementation in plan mode:** Wait for explicit permission
8. **Not copying existing patterns:** Before adding ANY UI element, find a working example in the same file and copy it exactly

## Key Files Reference

| Purpose | File |
|---------|------|
| Main entry | WebApp.js |
| Dashboard v2 data | WebAppDashboardV2.js |
| Dashboard v2 UI | AdminDashboardView_v2.html |
| Sync widget | AdminDailySyncWidget_v2.html |
| Task service | TaskService.js |
| Sync state | SyncStateService.js |
| Housekeeping | HousekeepingService.js |
| Config generator | generate-config.js |
| Project plans | jlmops/plans/*.md |
