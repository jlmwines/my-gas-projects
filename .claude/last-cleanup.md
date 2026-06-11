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

Doc-folder reconciliation:
- `website/` — **swept 2026-06-11.** 10 docs, all clean (no version-chain/dated-narrative rot). Fixed WEBSITE_UPDATE_PLAN's stale homepage-architecture note (→ custom Page Template, HOMEPAGE_BLOCKS Phase 1 shipped) + blog-post status (→ STATUS's 10-live/3-pipeline). Removed the killed exit-intent popup from WEBSITE_UPDATE_PLAN + HOMEPAGE_COPY (sections + placement mentions + voice-table row + MEET_EVYATAR ref), per user. Commits c6c3f3f + 155534b.
- `business/` — **swept 2026-06-11.** 6 docs. STRATEGY clean (exemplary, current). Fixed: README (wrongly described marketing/content as sub-folders + omitted the actual docs); CLAUDE Key Files (only listed CONTENT_STRATEGY → added STRATEGY/BRAND_STANDARDS/KPI); BRAND_STANDARDS stale per-channel statuses (theme cutover shipped 2026-05-05; newsletter Issue #1 distributing) + Updated bump; KPI header+Updated (was "deferred / 2026-05-04" but GA4/GSC built+refreshing 2026-06-10); CONTENT_STRATEGY per-file Content Status table → pointer (operational status doesn't belong in the brand bible). Sensory-doc refs verified (both SENSORY_FRAMEWORK + SENSORY_METAPHORS exist — no discrepancy).
- **Cross-folder fix:** `website/BRAND.md` was stale (Visual Identity all `_(to be defined)_` placeholders + Open Sans, pre-cutover) — flagged by BRAND_STANDARDS as "do not consume" yet listed as a key doc in the project kernel. Reconciled to the shipped palette/fonts (Cream/Terracotta, Secular One/Rubik) + a single-source pointer to BRAND_STANDARDS; replaced the done "To Complete" list with current status. (Missed in the earlier website pass.)
- `marketing/` — **swept 2026-06-11.** 5 docs. CLAUDE + FLYER_PLAN (ACTIVATED 2026-05-31) current; WHATSAPP_TRANSITION is a valid unstarted plan (account set up, 8 phases queued) — no fix. Fixed NEWSLETTER_PLAN: Status reframed (Issue #1 was "launching" → shipped + distributing; model now live), first-issue-timing open question resolved, Updated bumped. **Flagged (not auto-fixed — design decision):** EMAIL_GUIDELINES specs Marcellus/Open Sans fonts + charcoal CTA with rationale "matches website", but the 2026-05-05 cutover moved the site to Secular One/Rubik + terracotta — the email design may want a deliberate realign to the new brand.
- `content/` — **swept 2026-06-11.** content/CLAUDE (comprehensive content kernel) + ISRAELI_WINE_GUIDE_PLAN (long-horizon book architecture) + the reference/template docs (SENSORY_*, IMAGE_RECIPE, VIDEO_GUIDE, MAKING_WINE_VOICE, TOPIC_GUIDE, templates) all current/timeless. Fixed PUBLICATION_CALENDAR: May row was stale (Context "drafted/awaiting review" + Issue #1 "gated" → both shipped: Context live, Issue #1 distributing); June row flagged for the user's confirmation (couldn't verify YiV/Issue #2 status); Updated bumped.

**Full project-scoped sweep COMPLETE** — all doc folders covered (`.claude` trackers, STATUS, CALENDAR, memory, jlmops docs+plans, website, business, marketing, content).

Open items left for the user (not doc-cleanup — decisions):
- `marketing/EMAIL_GUIDELINES.md` — fonts/colors (Marcellus/Open Sans/charcoal) predate the cutover; whether to realign email design to the new theme (Secular One/Rubik/terracotta) is a design call.
- `content/PUBLICATION_CALENDAR.md` June row — needs the user's session-end confirmation of YiV / Issue #2 / the May email-sent status.

Triggered when: user asked for the full project-scoped cleanup sweep.
