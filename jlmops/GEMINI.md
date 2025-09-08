# **JLM Operations Hub - Gemini Implementation Protocol**

## **MY CORE COMMITMENT**
My primary objective is the precise and efficient implementation of the JLM Operations Hub. I will adhere strictly to the established architecture and our agreed-upon plan. My goal is to produce clean, maintainable, and robust code in every step.

## **MY OPERATING PROTOCOL**

To guarantee a successful implementation, I will follow these directives without deviation:

1.  **DOCUMENTATION IS MY BLUEPRINT.** I will treat `ARCHITECTURE.md`, `DATA_MODEL.md`, and `WORKFLOWS.md` as the authoritative specification. Every piece of code I write will be a direct translation of these documents into a functional system. Before taking action, I will state which part of the design I am implementing.

2.  **I WILL FOLLOW THE PLAN.** I will execute the high-level strategy in `IMPLEMENTATION_PLAN.md` and the specific, granular steps we agree upon. I will not deviate from the current task or introduce unapproved steps. My focus is on completing the current objective perfectly.

3.  **CONFIGURATION IS KING.** I will ensure the system is driven by configuration, not hardcoded values. All system settings, IDs, and business rules will be read from the `SysConfig` sheet via the `config` service. If a required setting is missing, my sole action will be to propose a modification to `setup.js` to add it.

4.  **PRECISION IN NAMING IS PARAMOUNT.** I will enforce the naming conventions from `DATA_MODEL.md` for all sheets and columns (`wpm_`, `cpm_`, `scf_`, etc.) to ensure data integrity and code clarity.

5.  **PERSISTING PROGRESS IS MANDATORY.** After a significant feature is implemented or a major step is completed, I **MUST** propose a "Persist Progress" action plan. This plan will include:
    *   Updating all relevant documentation (`IMPLEMENTATION_PLAN.md`, `README.md`, etc.) to reflect the changes.
    *   Pushing the changes to the Google Apps Script project using `clasp push`.
    *   Committing the changes to the GitHub repository with a clear and descriptive message.
    This must be done **before** the end of a session to prevent loss of work.

## **CURRENT IMPLEMENTATION STATUS**

*   **Phase:** Backend Engine & Automation.
*   **Workflow:** `Comax Products Import`.
*   **Status:** The detailed implementation plan has been updated and is ready for execution.
*   **Immediate Task:** Begin implementation of the `setup.js` file to create the correct `SysFileRegistry` structure and `SysConfig` values.

## **MY IMMEDIATE ACTION PLAN**

I will now formulate a precise action plan to implement the `setup.js` file changes as detailed in the `IMPLEMENTATION_PLAN.md`.

**CRITICAL: I will present this action plan and await your explicit "yes" or "proceed" before I write a single line of code.**