The Plan: The BACKEND Sidebar
Project Goal: To replace the existing, linear sidebar with a modern, flexible "Operations Hub." This new interface will serve as the central control panel for all daily operations, task management, and system administration.
Core Components:
The New Sidebar (AdminSidebar.html): A multi-panel UI that provides access to all functionality without leaving the sidebar. It consists of three main sections:
Daily Sync: A single, dynamic button that guides the admin through the core morning sync process (backup, orders, products) with state persistence.
Operations: On-demand access to task management and manual order processing.
Utilities & Settings: A dedicated panel for system health, workflow control, and configuration.
The Unified Task System: A flexible task management framework built on the existing TaskQ Google Sheet. It supports diverse task types, including inventory counts, product data updates, and content/editorial reviews, all managed from a central interface.
Proactive Task Generation: The system moves beyond simple buttons to an intelligent agent. It monitors task queues and proactively suggests creating new tasks when a queue is running low, guiding the admin's attention to where it's needed most.
Key Architectural Principles:
Parallel Development: The new sidebar will be built alongside the existing one, launched from a separate menu item to ensure zero disruption to current operations.
Leverage Existing Code: The new system will reuse and wrap existing, tested backend functions wherever possible, minimizing rework.
Configuration-Driven: All key thresholds, settings, and user lists will be managed in the central configuration sheet, with a new UI for editing them safely.
Implementation Steps & Session Breakpoints
This plan is broken down into logical phases. Each phase ends with a "breakpoint," representing a stable state and a good place to pause or start a new session.
Phase 1: The Foundation [COMPLETE]
Goal: Create the basic scaffolding for the new sidebar without breaking the existing system.
Steps:
Create AdminSidebar.html and AdminWorkflow.gs.
Add a menu item in Menu.gs to launch the new sidebar.
Breakpoint 1: You can successfully launch the new, empty sidebar from a dedicated menu item.
Phase 2: The "Daily Sync" Feature
Phase 2a: Functional Test Platform [COMPLETE]
Goal: Create a stable, step-by-step test platform for the daily sync workflow.
Steps:
Refactor Backup.gs to separate worker logic from UI prompts.
Implement independent server-side wrapper functions in AdminWorkflow.gs for each major sync stage (Begin Sync, Orders Sync, Product Sync).
Build a client-side UI in AdminSidebar.html with separate buttons to trigger each stage and handle confirmations.
Breakpoint 2a: The test platform is fully functional. Each button successfully executes its multi-step server-side process.
Phase 2b: Dynamic Button Implementation [POSTPONED]
Goal: Combine the tested logic into the final, stateful, single-button user experience.
Steps:
Update AdminWorkflow.gs to use a single handleDailySyncStep() orchestrator function that uses State.gs to read and write the current syncStep.
Update AdminSidebar.html to replace the test buttons with the single dynamic button.
The client-side logic will now update the button's text and status based on the state received from the server, and will handle resuming the workflow if interrupted.
Breakpoint 2b: The "Daily Sync" button is fully functional. It guides the user through the entire multi-step process and correctly resumes its state if interrupted.
Phase 3: Operations & Utilities Panels [NEXT]
Goal: Build out the remaining on-demand sections of the sidebar.
Steps:
Implement Proactive Tasks: Build the UI and logic for the Generate Tasks button and its "Suggested" state.
Implement Utilities: Build the panels for Housekeeping, Workflow Control, and Settings, and hook them up to their backend functions.
Breakpoint 3: The sidebar is feature-complete. All buttons and panels are functional.
Phase 4: Finalization
Goal: Prepare the new system for deployment.
Steps:
Thoroughly test all workflows and edge cases.
Update the onOpen() trigger to show the new sidebar by default.
Clean up and remove old files.
Project Complete: The new Operations Hub is live.

