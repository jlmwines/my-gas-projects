# Testing & Versioning Strategy

This document outlines the strategy for version control, testing, and deployment of the JLM Operations Hub to ensure the system is stable, maintainable, and that changes can be made safely.

## 1. Version Control with Git and `clasp`

All code for this project will be managed in a Git repository, enabling proper versioning, branching, and code reviews. The `clasp` command-line tool will be used to bridge the gap between the local Git repository and the Google Apps Script online editor.

*   **Workflow:**
    1.  Developers will clone the Git repository to their local machine.
    2.  For new features or bug fixes, a new branch will be created (e.g., `feature/campaign-dashboard`).
    3.  Code will be written and modified locally in a standard IDE like VS Code.
    4.  The `clasp push` command will be used to sync the local code to a **Staging Apps Script Project** for testing.
    5.  Once testing is complete, a pull request will be created in Git. After a code review, the branch will be merged into the `main` branch.
    6.  The `main` branch will then be pushed via `clasp` to the **Production Apps Script Project**.

## 2. Staging & Production Environments

To prevent changes from breaking the live system, we will maintain two parallel environments.

*   **Production Environment:**
    *   The live Reference Spreadsheet containing all real data.
    *   The production Apps Script project, which is connected to the live spreadsheet.
*   **Staging Environment:**
    *   A complete, separate copy of the Reference Spreadsheet. This sandbox sheet allows for testing changes to data structures, formulas, or configuration without any risk to live operations.
    *   A separate "Staging" Apps Script project that is connected to the sandbox sheet. Its deployment settings will point to test folders, test webhooks, etc.

This separation ensures that any new feature can be thoroughly tested end-to-end in a safe, isolated environment before being deployed to production.

## 3. Testing Strategy
*   **Unit Testing:** For pure, data-transformation functions (e.g., a function that calculates a price based on rules), developers will be required to create a corresponding test function in a dedicated `Tests.gs` file. These tests will use sample data and `console.assert()` to verify the logic and will be run manually before submitting a pull request.
*   **Integration Testing:** The primary method of testing will be integration testing within the Staging Environment. Before a feature is considered "complete," the developer must deploy it to the staging project and test the full user workflow to ensure it integrates correctly with the rest of the system.
*   **User-Led Testing Workflow:** All testing is performed by the user. The user will:
    1. Upload the code.
    2. Execute the orchestration function to trigger scheduled tasks.
    3. Prepare the test data.
    4. Evaluate the results.
    5. After each test, either provide the problem and execution log details, or confirm the test is passed.
