---
description: Track wishlist items - no args to view list, with args to add new item
---

Read the file `.claude/wishlist.md`.

If the user provided arguments after `/wish`:
- Append a new line to the wishlist: `- [ ] {{DATE}}: {{ARGS}}`
- Confirm the item was added
- Do NOT change session focus - continue with whatever task was in progress

If no arguments provided:
- Display the current wishlist
- Ask if any should be marked done or if user wants to add one
