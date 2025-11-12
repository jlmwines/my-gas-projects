# Project Context for jlmops

This is a web app being developed to replace and enhance the functions of the existing system that consists of frontend-scripts and backend-scripts environments.

## Gemini AI Assistant Instructions

### General Instructions

- The user stated that the markdown files are not accurate, and the code is the only source of truth.
- When reading files, the tool call (e.g., `read_file`, `read_many_files`) should be displayed in the interaction, but the *content* of the files read by these tools should *not* be displayed in the response, unless requested by the user. The purpose is to acknowledge the action without flooding the output with file contents.
- All tool calls, including context-gathering at the start of a session, must be visible and not silent.

### Project-Specific Context (jlmops)

- The frontend-scripts directory contains all frontend scripts.
- The backend-scripts directory contains all backend scripts.
- The JLMops project is being implemented in parallel with the live system, using the same live data inputs. I must not assume a sterile environment and should always analyze existing data first.

### jlmops Workflow

- For the jlmops project, I must follow a strict multi-stage approval workflow for all changes. The user must explicitly approve each stage (1. The initial plan, 2. The testing plan, 3. The final 'Persist Progress' commit) before I can proceed to the next. This is a non-negotiable protocol.
- My workflow is to propose changes, get user approval to commit them to git. The user will then manually run 'clasp push'. After the push, I will tell the user which function to run to test the changes.
- At the start of every new session for the jlmops project, my first action MUST be to read the latest versions of `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `WORKFLOWS.md`, and `DATA_MODEL.md`. After reading, I must await the user's next instruction.
- The user wants to guide the start of the session, so I should reduce my proactive behavior and await their instructions at the beginning of a session.

### Key Technical Details & Memories

#### SysConfig Management

- **Source of Truth:** The `jlmops/SetupConfig.js` file is the single source of truth for the `SysConfig` Google Sheet. The master configuration is defined as a hardcoded array within the `getMasterConfiguration()` function in this file.
- **Update Workflow:** To modify the system's configuration (including UI templates like packing slips), the array in `SetupConfig.js` must be edited. After the script is updated, the `rebuildSysConfigFromSource()` function must be run from the Apps Script editor to apply the changes to the live `SysConfig` sheet.
- **Warning:** Do not make manual edits directly to the `SysConfig` sheet, as they will be overwritten the next time `rebuildSysConfigFromSource()` is run.

#### Packing Slip Generation Strategy
- The jlmops project's packing slip generation strategy has been changed. The previous method of generating HTML and converting it to a Google Doc was abandoned due to unreliability. The new, approved method, implemented in `jlmops/PrintService.js`, is to copy a pre-formatted Google Sheet template, populate it with data, and save the result as a final Google Sheet document. This is considered the new standard for document generation in the project.
