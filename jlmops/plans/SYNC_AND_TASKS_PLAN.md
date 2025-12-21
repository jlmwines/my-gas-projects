# Sync and Tasks Implementation Plan

## Sync Sequence

Linear flow with validation after each import. Step numbers allow future insertions.

| Step | Name | Icon | Notes |
|------|------|------|-------|
| 100 | Comax Invoices | export | Optional - only shows if files present |
| 200 | Web Products | import | |
| 300 | Validation | validate | |
| 400 | Web Translations | import | Skipped if file unchanged |
| 500 | Validation | validate | Skipped if 400 skipped |
| 600 | Web Orders | import | |
| 700 | Validation | validate | |
| 800 | Order Export | export | Generate file for Comax |
| 900 | Confirmation | confirm | User confirms Comax upload |
| 1000 | Comax Products | import | |
| 1100 | Validation | validate | Includes cross-system checks |
| 1200 | Web Inventory | export | |
| 1300 | Confirmation | confirm | User confirms web upload |
| 1400 | Complete | done | Close session, reset |

**Icon Types:** import, validate, export, confirm

**UI:** Horizontal icon strip showing all steps. Single message area below. One action button for current state.

---

## Translation Freshness

Step D imports only if file changed since last import. If unchanged, D and E marked "skipped" and flow continues.

---

## Bug Fixes

1. Step number consistency across all files
2. Clear "Sync Complete" display at step N

---

## Task System

### Project Routing
Tasks auto-route to 4 system projects based on topic:
- Products, Inventory, System, Orders

### New Task Types
- task.sync.daily_session
- task.deficiency.category_stock
- task.bundle.critical_inventory
- task.bundle.low_inventory
- task.order.packing_available
- task.inventory.brurya_update
- task.system.health_status

### Singleton Tasks
Dashboard data stored in task notes (JSON):
- Orders widget, Brurya status, System health

---

## Housekeeping

Three phases:
1. Cleanup - logs, archived tasks, files
2. Validation & Tests - master_master suite, unit tests
3. Service Updates - bundle health, category check, Brurya

---

## Validation Rules

- Add IS_EMPTY operator
- Enable is_archived_mismatch
- Delete duplicate rules
- Add 10 new rules (field changes, existence checks)

---

## Implementation Order

**Phase 1: Validation Engine**
1. IS_EMPTY operator
2. Validation rule updates (titles, enable/disable)
3. New validation rules (10)

**Phase 2: Task System**
4. Task routing config
5. TaskService auto-routing
6. New task types
7. TaskService upsert functions
8. Operational tasks (bundle, category, packing)

**Phase 3: Housekeeping**
9. Restructure into 3 phases
10. Add master_master validation run
11. Add unit test run
12. System health task updates

**Phase 4: Sync Widget**
13. Translation freshness check
14. Bug fixes (step numbers, completion)
15. New sync UI with 14-step sequence

---

Plan Version: 1.0
Created: 2025-12-17
