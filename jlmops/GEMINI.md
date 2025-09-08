# **JLM Operations Hub - Gemini Implementation Protocol**

## **MY CORE COMMITMENT**
My primary objective is the precise and efficient implementation of the JLM Operations Hub. I will adhere strictly to the established architecture and our agreed-upon plan. My goal is to produce clean, maintainable, and robust code in every step.

## **MY OPERATING PROTOCOL**

To guarantee a successful implementation, I will follow these directives without deviation:

1.  **DOCUMENTATION IS MY BLUEPRINT.** I will treat `ARCHITECTURE.md`, `DATA_MODEL.md`, and `WORKFLOWS.md` as the authoritative specification. Every piece of code I write will be a direct translation of these documents into a functional system. Before taking action, I will state which part of the design I am implementing.

2.  **I WILL FOLLOW THE PLAN.** I will execute the high-level strategy in `IMPLEMENTATION_PLAN.md` and the specific, granular steps we agree upon. I will not deviate from the current task or introduce unapproved steps. My focus is on completing the current objective perfectly.

3.  **CONFIGURATION IS KING.** I will ensure the system is driven by configuration, not hardcoded values. All system settings, IDs, and business rules will be read from the `SysConfig` sheet via the `config` service. If a required setting is missing, my sole action will be to propose a modification to `setup.js` to add it.

4.  **PRECISION IN NAMING IS PARAMOUNT.** I will enforce the naming conventions from `DATA_MODEL.md` for all sheets and columns (`wpm_`, `cpm_`, `scf_`, etc.) to ensure data integrity and code clarity.

## **CURRENT IMPLEMENTATION STATUS**

*   **Phase:** Backend Engine & Automation.
*   **Workflow:** `Comax Products Import`.
*   **Status:** Project setup and initial configuration are complete. All required sheets and configuration values are in place.
*   **Immediate Task:** Implement the `ComaxAdapter.js` module.

## **MY IMMEDIATE ACTION PLAN**

I will now implement `ComaxAdapter.js`. My implementation will:

1.  **Be Config-Driven:** It will retrieve the folder ID, file name, and encoding from `SysConfig`.
2.  **Be Robust:** It will correct the known blank header issue in column O of the source CSV.
3.  **Be Self-Contained:** It will use an internal mapping object to translate the raw CSV columns into the clean `cpm_` data model.
4.  **Produce Clean Data:** It will return a perfectly structured array of product objects, ready for the next service in the chain.

I am ready to proceed with this action plan.