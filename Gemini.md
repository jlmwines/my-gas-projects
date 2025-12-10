# Project Context for jlmops

This is a web app being developed to replace and enhance the functions of the existing system that consists of frontend-scripts and backend-scripts environments.

## Gemini Session Guidelines

### 1. Interaction Protocol

This project follows a strict, user-driven session flow. The session moves between distinct modes based on user signals.

#### Phase 1: Planning Mode (Default Start)
*   **Start:** Every session begins here.
*   **Action:**
    1.  Read core documentation (`jlmops/ARCHITECTURE.md`, `jlmops/IMPLEMENTATION_PLAN.md`, `jlmops/WORKFLOWS.md`, `jlmops/DATA_MODEL.md`) to establish context.
    2.  Discuss requirements, explore the codebase, and formulate a strategy.
    3.  **Constraint:** Do **NOT** write, edit, or offer code in this phase. Focus solely on the "What" and "How".

#### Phase 2: Editing Mode
*   **Trigger:** Enter this mode *only* when the user explicitly signals to begin implementation (e.g., "Go ahead", "Start coding", "Implement the plan").
*   **Action:** Use tools (`replace`, `write_file`) to modify the codebase according to the agreed plan.
*   **Completion:** specific changes are made, stop and notify the user that the code is ready for testing.

#### Phase 3: Testing & Iteration Loop
*   **User Action:** The user will manually deploy (`clasp push`) and run tests.
*   **Feedback:** The user will report results.
*   **AI Response:**
    *   *Simple Fixes:* Stay in **Editing Mode** and apply fixes.
    *   *Complex Issues:* Suggest returning to **Planning Mode** to re-evaluate the strategy before touching more code.
*   **Flexibility:** The user may direct the session back to **Planning Mode** at any time.

#### Phase 4: Finalization
*   **Trigger:** This phase is *only* initiated when the user explicitly indicates satisfaction (e.g., "Everything works", "Update docs").
*   **Action:**
    1.  Update documentation (e.g., `IMPLEMENTATION_PLAN.md`).
    2.  Prepare/Perform Git commits.
*   **Constraint:** Never update docs or git without this explicit final command.

### 2. General Instructions

- **Source of Truth:** The code is the final source of truth. Markdown documentation is secondary.
- **Tool Visibility:** All tool calls must be visible. Do not use silent execution.
- **File Reading:** Do not output the full content of read files unless specifically asked.
- **Project Structure:**
    - `frontend-scripts`: Frontend code.
    - `backend-scripts`: Backend code.
    - `jlmops`: The active project directory. Always analyze existing data/code before assuming a fresh environment.

### 3. Key Technical Constraints

#### A. Configuration Management (The "Config Build" Cycle)
*   **Source of Truth:** The JSON files in **`jlmops/config/*.json`**.
*   **Workflow:**
    1.  Edit the appropriate JSON file in `jlmops/config/` (e.g., `mappings.json`, `orders.json`).
    2.  Run `node generate-config.js` to build `jlmops/SetupConfig.js`.
    3.  User runs `clasp push` and executes `rebuildSysConfigFromSource()` in the Apps Script editor.
*   **Do Not Edit:** Never manually edit `jlmops/SetupConfig.js` or the live `SysConfig` Google Sheet directly.

#### B. Data Access (The "No Hardcoding" Rule)
*   **Rule:** Never hardcode Sheet names ("WebProdM") or Column Indices in the codebase.
*   **Mechanism:** Always use `ConfigService` to retrieve these values.
    *   *Bad:* `sheet.getRange(row, 3)`
    *   *Good:* `const colIdx = ConfigService.getConfig('schema.data.WebProdM').indexOf('wpm_Price');`

#### C. Frontend Architecture (The "Controller" Pattern)
*   **Pattern:** `HTML View` -> `WebApp Controller` -> `Backend Service`.
*   **Constraint:**
    *   **HTML Views** (e.g., `AdminView.html`) must ONLY call functions exposed in **WebApp Controllers** (e.g., `WebAppAdmin.js`).
    *   **WebApp Controllers** are the *only* scripts allowed to call **Backend Services** (e.g., `OrderService.js`).
    *   *Never* call a Service directly from HTML.

#### Packing Slip Generation
- **Strategy:** `jlmops/PrintService.js` copies a Google Sheet template, populates it, and saves it as a new Sheet.
- **Status:** HTML generation is deprecated.