# Session Summary - 2026-01-20 (Latest)

## What We Accomplished

### Manager Dashboard v2 - Production Ready

**Promoted to default:**
- Removed "Dashboard v2" test link from manager nav
- Updated WebApp.js routing to use v2 as default

**UI Improvements:**
- Reordered task list columns: Topic → Entity → Title → Status → Priority → Due → Link
- Consolidated expanded task row: Stream, Start, Due, Done, Priority, Open, Status, Revert, Save (all in one row)
- Added "Revert to Admin" button with confirmation dialog
- Fixed calendar dot sizing (CSS collision with Bootstrap `.content` class)
- Renamed dot classes to `topic-content`, `topic-inventory`, `topic-products`

**Backend:**
- Added `WebAppDashboardV2_revertTaskToAdmin()` - reassigns task to admin
- Added `doneDate` to manager task data

### Bug Fixes

**Brurya 999 days bug:**
- Root cause: `WebAppInventory.js:1031` missing `'value'` argument in `ConfigService.setConfig()`
- Fix applied, pending verification after housekeeping run

**Inventory view refresh bug:**
- Accepted counts disappeared from review but didn't appear in Comax sync section
- Added `loadComaxSyncData()` call after accepting counts

### Admin Dashboard
- Removed "Dashboard" title and timestamp

---

# Session Summary - 2026-01-20 (Earlier)

## What We Accomplished

### Manager Dashboard v2

**Created and deployed ManagerDashboardView_v2.html:**
- Cloned from AdminDashboardView_v2 with role-specific filtering
- Admin-only rows (system health, sync status) dimmed with `.admin-row` class
- Tasks filtered to manager-relevant types only:
  - `task.content.edit`, `task.content.translate_edit`
  - `task.inventory.brurya_update`, `task.validation.comax_internal_audit`
  - `task.validation.vintage_mismatch`, `task.onboarding.add_product`
- System tasks (brurya, inventory) are read-only for manager
- Promoted v2 to default, removed separate v2 link

### Admin Projects View Improvements

**Panel toggle redesign:**
- Changed from cycling button to 3 separate buttons (◧ ◨ ▣)
- Direct selection of panel width: 1/3, 2/3, or full

**Column alignment and truncation:**
- Session ID column truncates with ellipsis
- Scope filter links (Open, Started, Future, All) as text links
- Narrow view shows only expand button, hides scope links

**Bug fixes:**
- Fixed `entityId.indexOf is not a function` - SKU was number, needs `String()`
- Fixed null element errors in render functions
- Fixed tasks not displaying for Inventory/Product Data Quality projects

### Content Task Types

Added task definitions for content workflow:
- `task.content.draft`, `task.content.edit`, `task.content.translate`
- `task.content.translate_edit`, `task.content.images`, `task.content.blog_publish`
- `task.content.video_create`, `task.content.video_publish`
- `task.content.email`, `task.content.social`, `task.content.whatsapp`

**Commit:** `5d1ac05` — Pushed to remote

---

# Session Summary - 2026-01-05 (Evening)

## What We Accomplished

### Packing Slip Layout Overhaul

**Problem:** Wine info order was wrong, header was verbose bilingual format

**Solution:**
- `PackingSlipService.js` — Added pairing text enrichment from `wdm_PairHar*`/`wdm_PairCon*` flags
- `PrintService.js` — Complete layout overhaul:
  - Compact 2-row RTL header (value before Hebrew label to fix RTL/LTR mixing)
  - Reordered wine info: Pairings → Decant → combined Intensity/Complexity/Acidity
  - Reduced spacing throughout (setSpacingBefore/After, setLineSpacing)
  - 6 products per page

**Commit:** `8432b1d` — Pushed to remote

**Bug logged:** printme folder not in housekeeping routine

---

# Session Summary - 2026-01-05 (Earlier)

## What We Accomplished

### Content Strategy & Brand Voice Setup

**Created brand foundation documents:**
- `business/CONTENT_STRATEGY.md` — Master brand voice, customer definition, content approach
- `content/SENSORY_FRAMEWORK.md` — Wine attribute system (Intensity/Complexity/Acidity)

**Key brand decisions documented:**
- Voice: Friendly, personal, never talks down, anti-snob
- Customer: People who drink wine (not "wine lovers"), want convenience/consistency
- Sensory framework: Internal tool for consistency, not customer curriculum
- Three dimensions clarified: Intensity=Volume, Complexity=Detail, Acidity=Brightness

**Created CLAUDE.md orientation files:**
- `projects/CLAUDE.md` — Root-level map of all project areas
- `content/CLAUDE.md` — Content guidelines quick reference
- `business/CLAUDE.md` — Strategy docs orientation
- `marketing/CLAUDE.md` — Marketing orientation
- `website/CLAUDE.md` — Frontend context

**Bug logged:**
- Packing slip wine info order wrong — should be: Pairings → Decanting → Attributes

### Next Steps (Content Work)
1. Update `Intensity EN.md` — light cleanup, remove jargon
2. Update `Complexity EN.md` — replace falafel metaphor with detail metaphor
3. Update `Acidity EN.md` — replace lemon squeeze with brightness metaphor
4. Add video scripts to each blog post
5. Update remaining content files (Reds Guide, Whites Guide, etc.)

---

# Previous Session - 2026-01-02

## What We Accomplished

### Brurya Inventory Bug Fixes

**Bug 1: Screen edits not saving**
- Root cause: SKU type mismatch - sheet stores numbers, frontend sends strings
- Map lookup `Map.get("12345")` failed to find key `12345`
- Fix: Convert SKU to String() for both Map key creation and lookup
- File: `InventoryManagementService.js:381-386`

**Bug 2: Task not updated after save**
- Root cause: Save only updated quantities, didn't update timestamp or close task
- Dashboard read "days since update" from task notes, which only updated daily via housekeeping
- Fix: After successful save, update `system.brurya.last_update` config and close task
- File: `WebAppInventory.js:498-512`

**Housekeeping behavior confirmed:**
- Reads config timestamp, not task done date
- Creates new task when: no open task exists AND daysSinceUpdate >= 7

---

## Files Modified

| File | Changes |
|------|---------|
| `InventoryManagementService.js` | SKU type fix - String() conversion for Map key/lookup |
| `WebAppInventory.js` | Added timestamp update + task close after Brurya save |

---

## Git Status

**Branch:** main
**Commit:** (pending)

---

## Previous Session (2025-12-17)

### Dashboard V2 Enhancements
- Added Daily Sync status row with real-time stage display
- Consolidated Brurya display in Inventory widget
- Narrowed sidebar from 250px to 160px

### Daily Sync Widget - Complete Overhaul
- Fixed widget showing "Start daily sync" after step completion
- Added `_getMergedStatus()` helper for proper state handling
