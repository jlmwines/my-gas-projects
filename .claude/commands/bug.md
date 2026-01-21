---
description: Track bugs - no args to view list, with args to add new bug (project)
---

Read the file `.claude/bugs.md` (at project root: `C:\Users\B\my-gas-projects\.claude\bugs.md`).

**Syntax:** `/bug [project] description`
**Projects:** jlmops, web, marketing, content

If the user provided arguments after `/bug`:
1. Parse the first word - if it matches a project name (jlmops, web, marketing, content), use it as the project
2. If no project specified, default to `jlmops`
3. Find the `## [project]` section, then the `### Open` subsection
4. Append a new line under Open: `- [ ] {{DATE}}: {{description}}`
5. Confirm: "Added to [project] bugs: [description]"
6. Do NOT change session focus - continue with whatever task was in progress

If no arguments provided:
- Display the current bugs list (all sections)
- Ask if any should be marked resolved or if user wants to add one

**Examples:**
- `/bug jlmops sync fails on timeout` → adds under ## jlmops > ### Open
- `/bug web menu not responsive` → adds under ## web
- `/bug login broken` → adds under ## jlmops (default)
