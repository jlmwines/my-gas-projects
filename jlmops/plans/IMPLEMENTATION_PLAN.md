# Implementation Plan & Status

## Key Technical Constraints

### A. Configuration Management (The "Config Build" Cycle)
*   **Source of Truth:** The JSON files in **`jlmops/config/*.json`**. (Do NOT edit `SetupConfig.js` directly).
*   **Workflow:**
    1.  Edit the appropriate JSON file in `jlmops/config/` (e.g., `mappings.json`).
    2.  Run `node generate-config.js` to build `jlmops/SetupConfig.js`.
    3.  User runs `clasp push` and executes `rebuildSysConfigFromSource()` in Apps Script.

### B. Data Access (The "No Hardcoding" Rule)
*   **Rule:** Never hardcode Sheet names ("WebProdM") or Column Indices (3) in the codebase.
*   **Mechanism:** Always use `ConfigService` to retrieve these values.
    *   *Bad:* `sheet.getRange(row, 3)`
    *   *Good:* `const colIdx = ConfigService.getConfig('schema.data.WebProdM').indexOf('wpm_Price');`

### C. Frontend Architecture (The "Controller" Pattern)
*   **Pattern:** `HTML View` -> `WebApp Controller` -> `Backend Service`.
*   **Constraint:**
    *   **`AdminView.html`** must ONLY call functions exposed in **`WebAppAdmin.js`** (or similar Controllers).
    *   *Never* call a Service directly from HTML.

---

## Completed Phases (1-13)

Phases 1-13 established the core system:
- **Phases 1-4:** Foundation, product workflow, data migration, order logic
- **Phase 5:** UI overhaul with dashboard widgets and role-based views
- **Phase 6:** Workflow orchestration with state-driven UI
- **Phase 7:** Core workflows (packing slips, inventory, Comax export)
- **Phase 8:** Session-based orchestration and validation architecture
- **Phase 9:** Admin tools, legacy validation, data migration utilities
- **Phase 10:** Housekeeping automation (log/task archiving, file lifecycle)
- **Phase 11:** Performance optimization (caching, batch operations)
- **Phase 12:** Quality assurance (TestRunner, schema validation)
- **Phase 13:** Codebase health (ProductService split, sync widget refactor)

---

## Future Roadmap

### Phase 14: Bundle Management (PLANNED)

**Goal:** Manage product bundles with intelligent inventory monitoring and replacement suggestions.

**Context:** Bundles are managed in WooCommerce (WPClever plugin). JLMops serves as a shadow system to monitor inventory, suggest replacements, and track content.

**Core Concepts:**
- 2-Sheet Model: `SysBundles` (header) + `SysBundleSlots` (content blocks and product slots)
- Slot Types: `'Text'` (bilingual content) or `'Product'` (criteria-based assignment)
- Criteria-Based Slots: Define eligibility criteria (Category, Price, Intensity, etc.) rather than hardcoded SKUs
- Inventory Monitoring: Alert when any active bundle component has low inventory

**Web Product Import Expansion:**
- Handle both `simple` and `woosb` (bundle) product types
- `woosb` products: Skip Comax validation, store as bundle metadata only
- Parse `woosb_ids` JSON to extract text blocks and product slots

**User Interface:**
- Bundle Dashboard: Stats, health indicators, bundle list
- Bundle Health: Low inventory alerts with replacement suggestions
- Bundle Editor: Slot management with criteria-based product assignment

### Phase 15: Project Management (PLANNED)

**Goal:** Unified system for managing all work (Projects), replacing separate Campaign concept.

**Core Concepts:**
- Unified Projects: "Campaigns" and "Operational Improvements" are different project types
- Project-Task Link: Tasks linked to projects via `st_ProjectId`
- Assets as Tasks: Content creation items where `st_LinkedEntityId` points to asset (e.g., Google Doc URL)

**User Interface:**
- Project Board: High-level view of all projects with progress
- Project Detail: Task and asset management within a project
- Master Task List: Global task view, groupable by project or schedule

---

## Backlog Items

### Enhanced Product Detail Verification
Task-based workflow for managers to review and verify product details, images, and attributes.

### Automated Failed Job Task Creation
Auto-create high-priority task when a job in `SysJobQueue` fails.

### Product Attribute Management & Export
Bidirectional WooCommerce attribute management:
1. Streamlined import with lean export format
2. Attribute standardization and cleanup
3. Safe export for descriptions and attributes
4. Full detail update export as uploadable CSV
