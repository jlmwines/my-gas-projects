# Implementation Plan & Status

## Key Technical Constraints

### A. Configuration Management (The "Config Build" Cycle)
*   **Source of Truth:** The JSON files in **`jlmops/config/*.json`**. (Do NOT edit `SetupConfig.js` or `SysConfig.json` directly).
*   **Workflow:**
    1.  Edit the appropriate JSON file in `jlmops/config/` (e.g., `mappings.json`).
    2.  Run `node generate-config.js` to build `jlmops/SetupConfig.js`.
    3.  User runs `clasp push` and executes `rebuildSysConfigFromSource()` in the Apps Script editor.

### B. Data Access (The "No Hardcoding" Rule)
*   **Rule:** Never hardcode Sheet names ("WebProdM") or Column Indices (3) in the codebase.
*   **Mechanism:** Always use `ConfigService` to retrieve these values.
    *   *Bad:* `sheet.getRange(row, 3)`
    *   *Good:* `const colIdx = ConfigService.getConfig('schema.data.WebProdM').indexOf('wpm_Price');`

### C. Frontend Architecture (The "Controller" Pattern)
*   **Pattern:** `HTML View` -> `WebApp Controller` -> `Backend Service`.
*   **Constraint:**
    *   **`AdminView.html`** must ONLY call functions exposed in **`WebAppAdmin.js`** (or similar Controllers).
    *   **`WebAppAdmin.js`** is the *only* place allowed to call **`OrderService.js`**.
    *   *Never* call a Service directly from HTML.

## 0. CRITICAL WORKFLOW: SysConfig Management

*   **Goal:** To replace the error-prone manual editing of `SetupConfig.js` with a safer, configuration-driven build process.
*   **Architecture:**
    1.  The master configuration is stored in `jlmops/SysConfig.json`.
    2.  A Node.js script (`generate-config.js`) reads `SysConfig.json` and generates the `jlmops/SetupConfig.js` file.
    3.  `SetupConfig.js` is a machine-generated artifact and must not be edited manually.
*   **Developer Workflow:**
    1.  To make configuration changes, edit `jlmops/SysConfig.json`.
    2.  Run the `node generate-config.js` script.
    3.  Commit both `jlmops/SysConfig.json` and the generated `jlmops/SetupConfig.js`.

## 1. Future Roadmap (Backlog)

### 1.1. Enhanced Product Detail Verification
*   **Goal:** To provide a comprehensive, task-based workflow for managers to review and verify product details, including images, facts, and overall appearance.
*   **Tasks:**
    1.  **UI Development:** Create a new UI view that displays a list of products requiring verification.
    2.  **Product Display:** For each product, display relevant details (e.g., name, SKU, current image URL, key attributes).
    3.  **Checklist Integration:** Implement an interactive checklist for managers to mark verification status for various details.
    4.  **Submission & Status Update:** Implement backend logic to update the product's verification status upon submission.
    5.  **Task Integration:** Ensure this UI is linked to "Verify Product Details" tasks.

### 1.2. Automated Failed Job Task Creation
*   **Goal:** To ensure that any failed job in the `SysJobQueue` automatically generates a high-priority task for an administrator to investigate.
*   **Tasks:**
    1.  **Configuration:** Add a new high-priority task definition for "Job Failed" to the master configuration.
    2.  **Orchestration:** Modify the job processing function to automatically create a "Job Failed" task when a job's status is set to FAILED.

### 1.3. Product Attribute Management & Export

*   **Goal:** Enable bidirectional management of WooCommerce product attributes—import for monitoring, export for bulk updates.
*   **Context:** Current detail update workflow shows content for manual entry in WooCommerce. This feature enables safe bulk uploads of descriptions and attributes, and eventually full export of detail updates.

#### Current State
*   Web product import captures attribute data (`Attribute1Name`, `Attribute1Value`, etc.)
*   Cross-sells and upsells are imported but not actively managed
*   Detail updates generate tasks for manual WooCommerce entry

#### Phase 1: Streamlined Import
*   **Lean Export Format:** Create a WooCommerce export preset with only relevant fields. Remove:
    *   SEO metadata (Yoast, RankMath)
    *   Facebook/social fields
    *   Shopify migration artifacts
    *   Unused WPClever fields (keep `woosb_ids` for bundles)
*   **Recommended Export Fields:**
    *   Core: `ID`, `Type`, `SKU`, `Name`, `Published`, `Stock`, `Regular price`, `Categories`, `Images`
    *   Attributes: `Attribute 1-7 name/value/visible/global`
    *   Relationships: `Upsells`, `Cross-sells`
    *   Behavior: `Sold individually?`, `External URL`
    *   Bundles: `Meta: woosb_ids` (for `woosb` type)
*   **Attribute Parsing:** Parse attribute columns into structured data for display and validation
*   **Cross-sell/Upsell Tracking:** Store relationships for future recommendation features

#### Phase 2: Attribute Standardization
*   **Attribute Sequence:** Ensure all products have attributes in consistent order within export files
*   **Attribute Cleanup:** Remove deprecated attributes (e.g., Region, Grapes) that are no longer displayed or relevant
*   **Validation:** Flag products with missing or inconsistent attributes

#### Phase 3: Safe Export for Updates
*   **Scope:** Descriptions and attributes only (safe fields that won't break products)
*   **Workflow:**
    1.  User reviews/edits product details in JLMops
    2.  System generates WooCommerce-compatible CSV with updates
    3.  User uploads CSV to WooCommerce via Product Import
*   **Safety:** Exclude price, stock, SKU, and structural fields from export

#### Phase 4: Full Detail Update Export
*   **Goal:** Export all detail updates (name mismatches, vintage updates, etc.) as uploadable CSV
*   **Attribute Normalization:** Ensure exported attributes follow standard sequence
*   **Bilingual Support:** Generate separate files for EN and HE products, or combined format if WooCommerce supports

## 2. Completed Milestones

### Phase 1-4: Foundation & Core Logic (COMPLETED)
*   **Phase 1: System Foundation:** Established core foundation and configuration.
*   **Phase 2: Product Workflow Engine:** Automated ingestion, reconciliation, and validation.
*   **Phase 3: Initial Data Population:** Migrated legacy data.
*   **Phase 4: Order Workflow:** Implemented core order logic and parallel operation utilities.

### Phase 5: UI Overhaul & Workflow Screens (COMPLETED)
*   **Core Navigation:** Updated shell with Home button and Role-Specific Sidebar.
*   **Admin Screens:** System Health, Orders (Comax Export), Inventory (Review, Acceptance, Task Creation), Development Tools.
*   **Manager Screens:** Inventory (Brurya Management, Count Submission), Product Management (Detail Updates, Stock Health, Suggestions).
*   **Architecture:** Refactored to Shared/Dedicated View Controller pattern.
*   **Auth:** Implemented robust user switching and role-based access.

### Phase 6: Workflow Integrity & UI Orchestration (COMPLETED)
*   **State-Awareness:** `OrchestratorService` drives UI state.
*   **Job Orchestration:** State-based and Paired-Job triggers for exports.
*   **UI Gating:** Buttons enable/disable based on workflow state.
*   **Daily Sync Workflow:** Implemented the guided 6-step "Daily Sync" wizard in the System Health widget.

### Phase 7: Core Workflows (COMPLETED)
*   **Packing Slips:** Robust generation from Google Doc templates.
*   **Customer Notes:** UI for handling notes and gift messages.
*   **Inventory Management:** Full Brurya stock and count review workflow.
*   **Comax Inventory Export:** CSV generation and confirmation.
*   **Gap Analysis:** Automated detection of low stock and candidate suggestions.
*   **SKU Management:** Modal-guided workflows for Vendor SKU Update and Product Replacement.
*   **Product Detail Updates:** Vintage mismatch handling.
*   **New Product Workflow:** Suggestion and creation workflow implemented.

### Phase 8: Session-Based Orchestration & Validation (COMPLETED)
*   **Session Orchestration:** `SessionID` tracking for all jobs and logs.
*   **Validation Architecture:** "Shadow" validation logic for safe parallel testing.
*   **Specific Task Types:** Vintage, Status, and Name mismatch tasks.
*   **Validation Hardening:** Unified `Action.Object.Detail` naming, `st_LinkedEntityName` optimization, and Quarantine logic for critical failures.

### Phase 9: Admin Tools & Refactoring (COMPLETED)
*   **Development Tools:** UI for Config Rebuild, Legacy Validation, and Migration.
*   **Legacy Validation:** Comprehensive comparison tools for Orders, Inventory, and Products.
*   **Data Migration:** Utilities for migrating legacy product details and order history.
*   **Logging:** Standardized usage of `LoggerService`.
*   **Output Names:** Centralized and standardized filename configuration.

### Phase 10: Maintenance & Scalability (COMPLETED)
*   **Housekeeping:** Automated archiving of old logs and tasks (`SysLog_Archive`, `SysTasks_Archive`) and file lifecycle management.
*   **Advanced Logging:** `LoggerService` standardization and traceability improvements.

### Phase 11: Performance Optimization (COMPLETED)
*   **Data Access:** Caching and optimized lookup strategies.
*   **Frontend-Backend:** Composite objects and prefetching to minimize round-trips.

### Phase 12: Quality Assurance & Resilience (COMPLETED)
*   **Automated Testing:** `TestRunner`, `TestData`, and unit test suites.
*   **Database Protection:** Header locking and schema validation.

### Phase 13: Codebase Health & Stabilization (NEXT)

*   **Goal:** Address technical debt to create a stable foundation before adding new features.
*   **Rationale:** Bundle implementation touches ProductService, validation logic, and import workflows. These must be clean and maintainable first.

#### 0. Critical Bug Fix (Do First)
*   **WebXltM Schema Validation Failure**
    *   **Problem:** `_upsertWebXltData()` in ProductService.js (lines 310-346) copies staging headers (`wxs_`) directly to master sheet instead of transforming to `wxl_` prefix.
    *   **Location:** `ProductService.js:323-334`
    *   **Fix:** Read data rows from WebXltS, get correct `wxl_` headers from config schema, write headers + data to WebXltM.

#### 1. File Renaming (Clarity)
*   **`ValidationService_DEPRECATED.js`** → **`ValidationService_LEGACY.js`**
    *   Still in use for legacy comparison during parallel processing
    *   "LEGACY" indicates intentional retention, not forgotten code
    *   Remove after parallel processing phase complete

#### 2. ProductService Split (2705 LOC → 2 files)
*   **Split into:**
    *   `ProductImportService.js` (~865 LOC) - Job processing, Comax/Web/Translation imports, staging, audit maintenance, inventory export
    *   `ProductService.js` (~1725 LOC) - Core CRUD, lookups, caching, detail management, SKU operations, search
*   **Architecture:** Direct calls from controllers (not facade pattern)
*   **Why first:** Bundle import will integrate with ProductImportService

#### 3. OrchestratorService Split (1479 LOC → 3 files + utilities)
*   **Split into:**
    *   `SessionService.js` (~400 LOC) - Session lifecycle, ID tracking, sync workflow state machine
    *   `JobService.js` (~450 LOC) - Job queue, scheduling, state transitions, completion handlers
    *   `OrchestratorService.js` (~100 LOC) - High-level workflow coordination only
    *   `OrchestratorUtils.js` - Shared helpers (file registry, archiving)
*   **Note:** Remove duplicate `getPendingOrProcessingJob()` (defined at lines 965 and 1302)

#### 4. InventoryManagementService Split (1328 LOC → 5 files)
*   **Critical Performance Bug:** `generateComaxInventoryExport()` lines 994-1019 has 40-50+ individual `setValue()`/`getValue()` API calls in forEach loop. Fix with batch processing.
*   **Split into:**
    *   `InventoryLevelService.js` (~80 LOC) - `getStockLevel`, `updateStock`
    *   `ReservedInventoryService.js` (~110 LOC) - `calculateOnHoldInventory`
    *   `BruryaInventoryService.js` (~250 LOC) - Brurya warehouse operations
    *   `InventoryAuditService.js` (~240 LOC) - Physical count operations
    *   `InventoryTaskService.js` (~650 LOC) - Task workflows, Comax export (fix perf bug here)

#### 5. HTML Component Extraction (Deferred)
*   `AdminProductsView.html` (1453 LOC) - Extract after backend stable

#### Files to Update (Controller Imports)
*   `WebApp.js`, `WebAppProducts.js`, `WebAppSystem.js`, `WebAppSync.js`
*   `WebAppInventory.js`, `WebAppDashboard.js`, `WebAppTasks.js`

### Phase 14: Bundle Management (PLANNED)

*   **Goal:** Implement a system for managing complex product bundles with intelligent inventory monitoring and replacement suggestions.
*   **Context:** Bundles are managed in WooCommerce (WPClever plugin). JLMops serves as a **shadow system** to monitor inventory, suggest replacements, and track content—users manually update WooCommerce.

#### Core Concepts

*   **2-Sheet Model:** `SysBundles` (header) + `SysBundleSlots` (unified content blocks and product slots).
*   **Slot Types:** Each slot is either `'Text'` (bilingual content with style: `h6`, `none`, etc.) or `'Product'` (criteria-based product assignment).
*   **Criteria-Based Slots:** Product slots define eligibility criteria (Category, Price, Intensity, Complexity, Acidity, NameContains) rather than hardcoded SKUs.
*   **Intelligent Replacement:** When a slot needs filling, the system suggests products matching the slot's criteria.
*   **Inventory Monitoring:** Alert when any active bundle component has low inventory.
*   **Rotation History:** JSON-based history per slot tracks SKU, start/end dates, and reason for change.

#### Web Product Import Expansion

The existing Web product import must be expanded to handle both `simple` and `woosb` (bundle) product types:

*   **Product Type Handling:**
    *   `simple` products: Existing validation (SKU match to Comax, etc.)
    *   `woosb` products: **No SKU, no Comax relationship**—skip Comax validation, store as bundle metadata only.
*   **New Import Fields:**
    *   `wps_Type`: Product type (`simple`, `woosb`)
    *   `wps_Categories`: Full WooCommerce category membership (comma-separated). Note: Comax Division/Group remains the **primary category determinant**; WooCommerce categories (e.g., "Special Value", "New Arrivals") are supplementary.
    *   `wps_Images`: Product image URL
    *   `wps_ExternalURL`: Product page URL
    *   `wps_CrossSells`, `wps_Upsells`: Related product IDs
    *   `wps_SoldIndividually`: Flag
    *   `wps_WoosbIds`: Bundle composition JSON (for `woosb` type only)
*   **Bundle Import from `woosb_ids`:**
    *   Parse JSON to extract text blocks (`type: "h6"`, `"none"`, etc.) and product slots (`id`, `sku`, `qty`, `optional`, `min`, `max`).
    *   Populate `SysBundles` and `SysBundleSlots` with imported structure.
    *   User then enriches product slots with criteria for intelligent replacement.

#### Order Handling

*   **Bundle products in orders:** Bundles appear in order line items but are **ignored for fulfillment**—only component products are picked/packed.
*   **Future:** Track bundle sales for analytics (count bundle appearances in orders).

#### Backend Implementation

*   **BundleService:** Refactor to use 2-sheet model (`SysBundles`, `SysBundleSlots`). Key functions:
    *   `getBundleWithSlots(bundleId)` - Load bundle and all slots
    *   `getEligibleProducts(slotId)` - Find products matching slot criteria
    *   `assignProductToSlot(slotId, sku, reason)` - Update slot and append to history
    *   `getBundlesWithLowInventory()` - Return bundles where any active SKU is below threshold
    *   `importBundleFromWooCommerce(woosbIds)` - Parse `woosb_ids` JSON and create/update bundle structure
    *   `duplicateBundle(bundleId)` - Clone bundle for creating variations
*   **ProductService/ValidationLogic:** Adjust validation to skip Comax-related checks for `woosb` type products.
*   **Search Strategy:** Pre-filter by explicit criteria columns (Category, Price), then post-filter by flexible criteria (NameContains) in memory. Cache product attributes per session.

#### User Interface

**Admin Bundles View** - Single cohesive screen with three sections:

1.  **Bundle Dashboard (top)**
    *   Summary stats: Total bundles, Active/Draft/Archived counts, bundles with issues
    *   Quick actions: Add Bundle, Import from WooCommerce
    *   Bundle list table with status, type (Bundle/Package), health indicator, last modified
    *   Click row to load bundle in Editor section

2.  **Bundle Health (middle)**
    *   Lists all bundles with low inventory slots
    *   For each issue: Current product, stock level, suggested replacement with stock
    *   Checkboxes to accept/reject suggestions
    *   Exclusivity conflict warnings (same product suggested for multiple bundles)
    *   Bulk actions: "Apply Selected Replacements", "Skip Conflicts"
    *   [Edit] link per slot opens that bundle/slot in Editor section

3.  **Bundle Editor (bottom)**
    *   Left pane: Slot list showing order, type, preview (text snippet or "Product Name ₪Price")
    *   Right pane: Selected slot detail
        *   Text slots: Style, English text, Hebrew text
        *   Product slots: Current product, stock, criteria fields, eligible replacements list
    *   Reorder via editable Order number field (no drag-drop)
    *   Add Text / Add Product buttons
    *   Assign replacement: Select from eligible list → Apply

**Main Admin Dashboard Widget** - Summary widget showing:
*   Bundle count and health status
*   "X bundles need attention" with link to Admin Bundles view
*   Quick stats: Low inventory count, pending replacements

### Phase 15: Project Management (PLANNED)

*   **Goal:** Implement a unified system for managing all work (Projects), replacing the separate Campaign concept.

#### Core Concepts

*   **Unified Projects:** "Campaigns" and "Operational Improvements" are just different types of Projects (`SysProjects`).
*   **Project-Task Link:** Tasks can be linked to a Project (`st_ProjectId`) and have a schedule (`st_StartDate`).
*   **Assets as Tasks:** Content creation (Blog posts, emails) are Tasks where the `st_LinkedEntityId` points to the asset (e.g., Google Doc URL).

#### Backend Implementation

*   **ProjectService:** New service to manage `SysProjects` sheet. **Replaces `CampaignService.js`** (delete the old file).
*   **TaskService:** Update to support `st_ProjectId` and `st_StartDate` fields.

#### User Interface (Admin Command Center)

*   **Project Board:** High-level view of all Projects (Campaigns & Ops) with progress bars.
*   **Project Detail:** A focused view to manage tasks and assets within a specific project.
*   **Master Task List:** A global view of all tasks, groupable by Project or Schedule.