# Calendar ↔ Library ↔ Task — Simplification Plan

**Status: design agreed, no code changes made yet.** The original investigation (below, still accurate) found that jlmops's content-publishing infrastructure — calendar, Library entities, task chains, translation — has a create path and a read path but no update/close-out path, so it constantly drifts from reality. Rather than building automation to keep it in sync, the agreed direction is the opposite: strip out the automation and machinery that requires syncing in the first place, and lean on the fact that a human (admin or manager) is already present at every real step.

## The three actors

- **Admin** (human) — drives the work, maintains the calendar directly.
- **Session** (Claude) — does everything mechanical the admin used to do by hand: drafting, image uploads, pushing to WordPress, building companion emails, calendar upkeep.
- **Manager** (human) — translates and edits in Google Docs, using Gemini for the actual translation pass. No session involvement in that step.

Any design choice below has to work for a human using a UI (admin, manager) and for a session acting through scripts/functions — these are different kinds of "user" and shouldn't be forced through the same interface.

## Verified breaks (original investigation, 2026-07-07 — still accurate evidence)

1. **Publish never closes the loop.** `blog-region-negev-en`/`-he` are `state: draft` in `SysLibrary` despite being live on jlmwines.com since 2026-07-06. `WebAppLibrary_markPublished` exists but nothing in the documented pipeline calls it.
2. **No target date → invisible, not just overdue.** Negev's entities have empty `slb_TargetDate`; per the old design's own rule, entities without one don't appear on the Calendar at all.
3. **Target date recorded as prose, not structured data.** `email-ayiw-2026-07-en/he`'s date lives only in `slb_Notes`, never in `slb_TargetDate`.
4. **Duplicate entities, conflicting dates, no de-dup.** Galilee had two entities (`blog-region-galilee-en`, `blog-galilee-en`) with different target dates, plus a third date from the user's planning sheet — three sources, no canonical answer.
5. **No update path once an entity exists.** Exhaustively checked `WebAppLibrary.js` — no function edits an existing `slb_TargetDate` or any other field generically after creation.
6. **No ingestion from the user's actual plan.** The user's Google Sheet (real forward plan) has no code path into `SysLibrary` — getting something registered requires a session to notice it and act by hand.

**Root cause, one sentence:** the system has a create path and a read/surface path, but no update or close-out path — so anything that changes after creation has no way back in except a raw spreadsheet edit that bypasses logging entirely.

**Decision made from this evidence:** don't build the missing update/sync path. Remove the parts of the system that need one.

## Corroborating code survey (2026-07-07, research fork)

A follow-up audit of the actual code against the simplification direction (not just the calendar) found:

- **`DATA_MODEL.md` is correct, `WORKFLOWS.md` is stale.** `slb_Version` is dead — `lockVersion` (`LibraryService.js:678-720`) doesn't touch `slb_State` or `slb_Version` at all, contradicting `WORKFLOWS.md` §13.3-13.4's description of a live version-bump step. The lock/version machinery this plan wants gone is already half-gone in code, just not in docs.
- **`attachExistingDoc`** already matches the target model — no fork/lock engine, just swaps the doc and archives the old one. Keep as-is once it gets the ownership-transfer fix (below).
- **`spawnContentChain`'s `isSiblingLanguage` branch** (`LibraryService.js:243-267`) is the actual auto-pairing mechanism — creates `baseSlug-en`/`baseSlug-he` together with cross-references in one call. This is what gets removed.
- **The entity drawer** (`PublishingView.html:414-420`) renders 7 header fields + 8 full sections for every entity regardless of type — Distribute, Family, Files & URLs, Attached tasks, References out, References in, State history, Activity log. Once auto-pairing and version history are gone, References out/in and State history have nothing left to show — concrete evidence behind "way more than I need."
- **Shared infrastructure, do not touch:** `TaskService.js` (`createTask`/`completeTask`), `TaskWidgets.html`/`ModalOverlay`, and `TaskPacks.html`'s non-content pack kinds (`deeplink_orders`, `deeplink_inventory`, etc.) are used by product-side task chains (product detail updates, counts, verification) too. Nothing here changes.

## The design

### Calendar

`JLMops_Publishing` (sheet ID `1l-mrCcmIYpkabTaxy4yTRmJ4nxqIaw7VwU2YRQ_8rbg`) becomes the one calendar — simple, directly editable, no derivation.

- **`refreshCalendarExport` retired** from daily housekeeping (`StatusReportService.js:610-688`, called from `HousekeepingService.js:734`). It currently wipes every non-holiday/blackout/note row daily and rebuilds from `SysLibrary` — exactly the automation being removed. Whatever's written to the sheet stays written.
- **`_loadHolidays()` (`WebAppPublishing.js:79-111`) loses its type filter.** Today it only returns `holiday`/`blackout`/`note` rows to the Calendar tab; it needs to return every row so entries the admin/session add directly actually show up in `PublishingView.html`'s Calendar tab.
- **New `tools/sheets-api.js`** (same shape as `tools/wp-api.js`) — jlmops's web app has no HTTP API (`WebApp.js` only has `doGet`, no `doPost`, no callable endpoint), so a session cannot call jlmops directly the way `push-posts.js` calls WordPress. This new script lets a session read/write the calendar sheet directly via the Sheets API — add, update, mark done, remove rows.
- **Optional columns:** `cal_Slug` (link a row to its Library entity once one exists — also enables picking a slug from the calendar during task creation) and `cal_Link` (a plain URL to whatever's relevant — doc, live post, entity). Both append-only, both nice-to-have, neither required.
- **Marking done = a direct edit**, by admin or session, to the row. No automated state transition.

### Library entities

- **No automatic EN/HE sibling creation.** Remove the `isSiblingLanguage` pairing branch in `spawnContentChain`. English and its translation are separate, independent entities, each created when the work for it actually starts — not batch-provisioned together.
- **No lock/version/roll-forward machinery.** `attachExistingDoc` stays as the whole versioning story: attach a new version when there's one, replacing the old. Cut `lockVersion`'s realign-prompt branch (`peerNeedsRealignment`/`_flipPeerSlug` helper at `LibraryService.js:433`, `696-722`) — small, self-contained, low-risk.
- **Ownership-transfer fix generalizes to `attachExistingDoc`.** `createTranslationDraft` already does `copy.setOwner(adminEmail)` right after forking a doc (fixed 2026-07-06). `attachExistingDoc` never grants admin access — same gap, same fix, applied there too.
- **`slb_References` becomes purely optional/informational.** A human can note "this is the translation of X" or "this newsletter excerpts that post," but nothing in the system enforces it, requires it, or derives automatic behavior from it (no slug-suffix lookups, no forced pairing).

### Translation flow

The manager translates in Google Docs using Gemini. Two pieces of the current mechanism are good and stay; one piece is the actual hard link and changes.

- **Keep as-is: the Doc-sourced Gemini prompt.** `_getTranslationPrompt()` (`LibraryService.js:1092`) reads a `template-xlt` library entity so the manager can refine the actual prompt wording in Docs, no deploy needed, with a sensible built-in fallback. `createTranslationDraft` prepends it to the top of the forked doc before the manager opens it. No change.
- **Keep as-is: the ownership-transfer fix.** `copy.setOwner(adminEmail)` right after the fork. No change.
- **Change: the input.** `createTranslationDraft` currently takes `heEntityId` and derives the English peer via `_flipPeerSlug(heEntityId)` (slug-suffix math) — this *is* the hard link, and it requires a correctly-suffixed HE entity to already exist. Replace this with an explicit EN source (entity slug or doc URL) the manager picks directly. Everything downstream (fork, prepend prompt, transfer ownership) is unchanged. The new HE entity gets created fresh at this point, with no required slug relationship to the EN one.

### Tasks

- **One task = one attachment**, uniform regardless of content type. An English task attaches to the English doc/entity; a translation task attaches to the translation doc/entity; any other task attaches to whatever asset it needs.
- **Tasks get created one at a time, as work reaches each stage** — not the current 8-stage chain (`WORKFLOWS.md` §13.2: Create WP Stubs → Draft → Admin Review → Edit → Translate → Translate Edit → Images → Blog Publish) spawned all at once across two not-yet-existing entities.

### Drawers / UI

Entity and task detail views should show only what's actionable for that specific type, not a uniform data dump. Concretely: `References out`, `References in`, and `State history` sections in the entity drawer shrink or disappear once auto-pairing and version history are gone — there's nothing left for them to show.

## Docs that need fixing regardless of build order

- **`jlmops/docs/WORKFLOWS.md` §13 needs a rewrite**, not a trim — it documents the 8-stage auto-paired chain as current, live design, and contains at least one claim (`lockVersion` bumping `slb_Version`) already contradicted by the code.

## Open questions

1. **Templates** (`slb_ContentType = 'template'` — welcome email, WhatsApp, pending-payment) are also documented as sibling-language pairs (`WORKFLOWS.md` §13.6). Does the no-auto-pairing decision apply to them too, or does their low edit-frequency make it not worth touching?
2. **Existing duplicate/stale entities** (Galilee's two entities and three conflicting dates, the July newsletter's two parallel entities) — fix these by hand once the simplified model is live, not before, and not via raw sheet edits.

## Rough scope of implementation

Not yet built — this is a scope estimate, not a commitment. Touches roughly 6-8 files, mostly *removing* logic rather than adding it, which keeps individual changes low-risk even though the change is spread wide:

- `jlmops/LibraryService.js` — remove sibling-pairing branch, remove realign-prompt branch, change `createTranslationDraft`'s input, generalize the ownership fix to `attachExistingDoc`.
- `jlmops/WebAppPublishing.js` — loosen `_loadHolidays()`'s filter.
- `jlmops/StatusReportService.js` + `jlmops/HousekeepingService.js` — retire `refreshCalendarExport` from the daily job.
- `jlmops/PublishingView.html` — trim the entity drawer sections tied to removed machinery; whatever UI currently drives sibling-paired creation and the 8-stage batch-spawn.
- `jlmops/AdminTasksView.html` / wherever "create translation" is triggered — update to let the manager pick an explicit EN source instead of relying on slug-suffix derivation.
- `tools/sheets-api.js` — new file, the one genuinely new build rather than removal. Needs Sheets API credentials set up (parallel to `.wp-credentials`), which is the single largest unknown in the whole plan since nothing like it exists yet.
- `jlmops/docs/WORKFLOWS.md` — documentation rewrite, not code, but real effort.

Explicitly untouched: product-side task chains and the shared primitives they depend on (`TaskService.js`, `TaskWidgets.html`/`ModalOverlay`, `TaskPacks.html`'s non-content pack kinds).
