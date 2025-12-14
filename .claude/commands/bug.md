---
description: Track bugs - no args to view list, with args to add new bug
---

Read the file `.claude/bugs.md`.

If the user provided arguments after `/bug`:
- Append a new line to the bugs list: `- [ ] {{DATE}}: {{ARGS}}`
- Confirm the bug was added
- Do NOT change session focus - continue with whatever task was in progress

If no arguments provided:
- Display the current bugs list
- Ask if any should be marked resolved or if user wants to add one
