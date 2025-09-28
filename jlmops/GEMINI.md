# **JLM Operations Hub - Gemini Implementation Protocol**

## **MY CORE COMMITMENT**
My primary objective is the precise and efficient implementation of the JLM Operations Hub. I will adhere strictly to the established architecture and our agreed-upon plan. My goal is to produce clean, maintainable, and robust code in every step.

## **MY OPERATING PROTOCOL**

To guarantee a successful implementation, I will follow these directives without deviation:

**0. ALWAYS START WITH THE BLUEPRINT.** Before formulating any plan to create or modify code, my first action will **always** be to re-read the core documentation (`ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `WORKFLOWS.md`, `DATA_MODEL.md`). In my subsequent proposal, I **MUST** cite the specific document and section that justifies each part of my plan. Any deviation from the established architecture is prohibited unless we first agree to formally update the documentation.

1.  **DOCUMENTATION IS MY BLUEPRINT.** I will treat `ARCHITECTURE.md`, `DATA_MODEL.md`, and `WORKFLOWS.md` as the authoritative specification. Every piece of code I write will be a direct translation of these documents into a functional system. Before taking action, I will state which part of the design I am implementing.

2.  **I WILL FOLLOW THE PLAN.** I will execute the high-level strategy in `IMPLEMENTATION_PLAN.md` and the specific, granular steps we agree upon. I will not deviate from the current task or introduce unapproved steps. My focus is on completing the current objective perfectly.

3.  **LIVE CONFIGURATION IS KING.** The system is driven by the live `SysConfig` sheet. If a required setting is missing, I will propose a safe, tactical, and single-purpose function in `setup.js` to add it non-destructively.

4.  **PRECISION IN NAMING IS PARAMOUNT.** I will enforce the naming conventions from `DATA_MODEL.md` for all sheets and columns (`wpm_`, `cpm_`, `scf_`, etc.) to ensure data integrity and code clarity.

5.  **PERSISTING PROGRESS IS MANDATORY.** After a significant feature is implemented or a major step is completed, I **MUST** propose a "Persist Progress" action plan. This plan will follow a **"Commit, then Push"** strategy to ensure a safe rollback point. The steps are:
    *   Updating all relevant documentation (`IMPLEMENTATION_PLAN.md`, `README.md`, etc.) to reflect the changes.
    *   Committing the changes to the local GitHub repository with a clear and descriptive message. This creates a safe, versioned checkpoint.
    *   Informing you that the code is ready for you to deploy via `clasp push` for testing.
    This must be done **before** the end of a session to prevent loss of work.

## **CURRENT IMPLEMENTATION STATUS**

*   **Phase:** Backend Engine & Automation.
*   **Workflow:** `Comax Products Import`.
*   **Status:** The configuration-driven validation engine has been implemented and all related code and documentation have been updated.
*   **Immediate Task:** Test the validation engine to confirm that it correctly identifies exceptions in the data and creates tasks in the `SysTasks` sheet.**