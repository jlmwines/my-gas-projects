# **JLM Operations Hub - Gemini Implementation Protocol**

## **MY CORE COMMITMENT**
My primary objective is the precise and efficient implementation of the JLM Operations Hub. I will adhere strictly to the established architecture and our agreed-upon plan. My goal is to produce clean, maintainable, and robust code in every step.

## **MY OPERATING PROTOCOL**

To guarantee a successful implementation, I will follow these directives without deviation:

1.  **DOCUMENTATION IS MY BLUEPRINT.** I will treat `ARCHITECTURE.md`, `DATA_MODEL.md`, and `WORKFLOWS.md` as the authoritative specification. Every piece of code I write will be a direct translation of these documents into a functional system. Before taking action, I will state which part of the design I am implementing.

2.  **I WILL FOLLOW THE PLAN.** I will execute the high-level strategy in `IMPLEMENTATION_PLAN.md` and the specific, granular steps we agree upon. I will not deviate from the current task or introduce unapproved steps. My focus is on completing the current objective perfectly.

3.  **CONFIGURATION IS KING.** I will ensure the system is driven by configuration, not hardcoded values. All system settings, IDs, and business rules will be read from the `SysConfig` sheet via the `config` service. If a required setting is missing, my sole action will be to propose a modification to `setup.js` to add it.

4.  **PRECISION IN NAMING IS PARAMOUNT.** I will enforce the naming conventions from `DATA_MODEL.md` for all sheets and columns (`wpm_`, `cpm_`, `scf_`, etc.) to ensure data integrity and code clarity.

5.  **PERSISTING PROGRESS IS MANDATORY.** After a significant feature is implemented or a major step is completed, I **MUST** propose a "Persist Progress" action plan. This plan will follow a **"Commit, then Push"** strategy to ensure a safe rollback point. The steps are:
    *   Updating all relevant documentation (`IMPLEMENTATION_PLAN.md`, `README.md`, etc.) to reflect the changes.
    *   Committing the changes to the local GitHub repository with a clear and descriptive message. This creates a safe, versioned checkpoint.
    *   Pushing the changes to the Google Apps Script project using `clasp push`. This deploys the code for testing in the target environment.
    This must be done **before** the end of a session to prevent loss of work.

### **Architectural Compliance Protocol**

To ensure strict adherence to the "Configuration as Data" principle, I will follow this protocol for all future code modifications:

1.  **Pre-Implementation Configuration Check:** Before writing or modifying any service, adapter, or workflow, I will first identify all required configuration values (e.g., sheet names, column mappings, business rules). I will then verify that these values are defined in the `SYS_CONFIG_DEFINITIONS` object within `setup.js`. If they are not, my first action will be to add them.

2.  **No Hardcoded Values Mandate:** I will not use hardcoded string literals or "magic numbers" for any value that represents a system entity (like a sheet name, column name, or folder ID) or a business rule. All such values **MUST** be retrieved from the `ConfigService` at runtime.

3.  **Post-Implementation Compliance Review:** Immediately after modifying a script, and before presenting it as complete, I will perform a compliance review on the code I just wrote. I will specifically scan it for any violations of the "No Hardcoded Values Mandate." If any are found, I will correct them before proceeding.

## **CURRENT IMPLEMENTATION STATUS**

*   **Phase:** Backend Engine & Automation.
*   **Workflow:** `Comax Products Import`.
*   **Status:** The detailed implementation plan has been updated and is ready for execution.
*   **Immediate Task:** Begin implementation of the `setup.js` file to create the correct `SysFileRegistry` structure and `SysConfig` values.

## **MY IMMEDIATE ACTION PLAN**

I will now formulate a precise action plan to implement the `setup.js` file changes as detailed in the `IMPLEMENTATION_PLAN.md`.

**CRITICAL: I will present this action plan and await your explicit "yes" or "proceed" before I write a single line of code.**