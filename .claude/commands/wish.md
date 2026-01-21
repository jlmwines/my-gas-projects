---
description: Track wishlist items - no args to view list, with args to add new item (project)
---

Read the file `.claude/wishlist.md` (at project root: `C:\Users\B\my-gas-projects\.claude\wishlist.md`).

**Syntax:** `/wish [project] description`
**Projects:** jlmops, web, marketing, content

If the user provided arguments after `/wish`:
1. Parse the first word - if it matches a project name (jlmops, web, marketing, content), use it as the project
2. If no project specified, default to `jlmops`
3. Find the `## [project]` section in the wishlist
4. Append a new line under that section: `- [ ] {{DATE}}: {{description}}`
5. Confirm: "Added to [project] wishlist: [description]"
6. Do NOT change session focus - continue with whatever task was in progress

If no arguments provided:
- Display the current wishlist (all sections)
- Ask if any should be marked done or if user wants to add one

**Examples:**
- `/wish jlmops add export button` → adds under ## jlmops
- `/wish web fix mobile menu` → adds under ## web
- `/wish marketing email template` → adds under ## marketing
- `/wish add new feature` → adds under ## jlmops (default)
