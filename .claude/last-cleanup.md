2026-06-11 — project-scoped cleanup pass (jlmwines), run after the doc-governance item-1 work (graduations + 5-plan trim).

Touched this pass:
- `.claude/bugs.md` — condensed the "Resolved (recent)" section from ~48 verbose multi-paragraph entries to ~22 one-liners (date + symptom + resolution@deploy + pointer), per the "one line per item; analysis lives in git/session-log" standard. Open bugs left intact (active working context). No open bug newly resolved this pass.
- `.claude/wishlist.md` — struck 6 shipped/killed items (protect-headers `[x]`; lookup-add UI shipped @121; Campaigns Screen = AdminCampaignsView; Phase 14 Bundle Mgmt = bundles 0-7 live; Phase 15 Project Mgmt = AdminProjectsView; Contact list UI = AdminContactsView; Exit popup = plan killed) and consolidated the duplicate product-overview wish (kept the detailed 2026-05-15 "Product-centered ops view").
- `plans/STATUS.md` — refreshed `Updated:` to 2026-06-11 current-state (doc-governance complete; system docs are the verified fact home; metrics unchanged — no code deploys this session, still @288 / v1.2.29). Inbox Active already empty; Deferred's offline-attribution (`defer:2026-07-01`) still future-valid.
- `CALENDAR.md` — refreshed the stale plan-queue descriptions (UI_AUDIT ~95% shipped, not "17 active sessions"; RELIABILITY ~7/16 shipped, Mailchimp now Tier 3.3; validateDeployment resolved at root). Updated date bumped.

Audited, no change needed:
- Memory (`~/.claude/.../memory/`, 56 pointers) — feedback/reference facts; none invalidated by the doc reorganization (consistent with the 2026-06-04 audit).
- `session-log.md` — all entries within 30 days (oldest ~2026-05-15); no pruning due.
- The 5 audited plans + system docs — just reconciled/trimmed in the item-1 work (commits b0cc9e0 → 46b4202); current.

Not swept this pass (no flagged staleness; offered to user):
- `business/`, `marketing/`, `website/`, `content/` long-lived doc folders — out of scope for item 1; not reconciled this pass.

Triggered when: user asked for the full project-scoped cleanup sweep.
