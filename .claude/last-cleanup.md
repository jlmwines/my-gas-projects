2026-05-26 — focused plan-doc reconciliation pass

Scope: `plans/CONTENT_LIBRARY_PLAN.md` + `jlmops/plans/LIBRARY_VIEW_PLAN.md`. Triggered after the @125/@127 JS-dispatch deviation was flagged for the third session running without ever being reconciled into the plan. User pause-then-cleanup direction.

Touched:
- `plans/CONTENT_LIBRARY_PLAN.md`
  - §5 line 232 — `content/register-library.js` is sheets-only as shipped; Drive upload + canonical-folder placement is forward-looking
  - §8 — activity log column listing updated to the live 9-column schema (`slba_ActivityId`, `slba_EntityType`, `slba_EntityId`, `slba_Timestamp`, `slba_Actor`, `slba_ActionType`, `slba_Summary`, `slba_Details`, `slba_ReferencedEntities`)
  - §9 line 387 + line 393 — chain spawn writer is `LibraryService.spawnContentChain` (fork from `WebAppProjects_createContentStream`); both passages no longer say "extended `createContentStream`"
  - §10 line 425 — same correction in the workflow walkthrough
  - §11 line 622 — fork picked at phase 7a; hedging ("prefer in-place extension") removed
  - §17 phase 7 lines 925, 928, 950 — Content edit + Content publish packs ship as JS-dispatcher cases in `LibraryView.html`'s `packBody()`, not as separate `TaskPack_*.html` HtmlService include files
  - §17 phase 5 (line 815) — already updated this session for additive-nav correction (kept)
- `jlmops/plans/LIBRARY_VIEW_PLAN.md`
  - Status line — added phase 7a shipment
  - Out-of-scope line — narrowed to phase 7b items only
  - Surfaces section — removed `TaskPack_<Name>.html` file list; added explicit "Pack pattern" correction (JS dispatch in `packBody`, not HtmlService includes; HtmlService include pattern available but not adopted)
  - Why-a-new-entity section — already updated this session for additive-nav (kept; "old file retires at promotion" fixed)
  - Routing + flag wiring section — rewrote to reflect additive-nav (no route flip; `library.enabled` gates Library nav entry visibility only; Dashboard link unchanged)
  - Build order steps 4 + 5 — corrected Content edit pack count (7 task types, not 6); Content publish pack count (5 task types)
  - Build order step 7 (Soak) — admin-only daily testing during soak; manager's daily UI stays on v2
  - Build order step 8 — converted from "Promote: flag default-on; nav-route swap; v2 deprecated" to "(No promotion step.) Library is permanently additive"
  - Soak + promotion path → Soak + extended-use path — full rewrite for additive-nav
  - Decisions banked first entry — "old file retires at promotion" replaced with "Library is permanently additive, not a replacement"
  - Decisions banked phase 7 entry — fork picked; phase 7a admin-side shipped 2026-05-26; phase 7b ships manager-side
  - Cross-references line for `ManagerDashboardView_v2` — corrected "stays as fallback after LibraryView promotion, removed in a later cleanup phase" → "stays as the manager's daily-use dashboard indefinitely"

Also banked this session:
- Memory `feedback_verify_structural_intent_before_planning` (replace-vs-add ambiguity in "alongside" language)
- Memory `feedback_israel_time_powershell_not_tz` (TZ=Asia/Jerusalem doesn't convert on Git Bash on Windows)

Out of scope for this pass: other JLM Wines plan docs (`CONTACT_MANAGER_PLAN`, `CAMPAIGN_ARCHITECTURE`, `CUTOVER_CHECKLIST`, etc.), `.claude/bugs.md`, `.claude/wishlist.md`, session-log pruning, memory audit. Triggered as a focused two-doc reconciliation, not a full portfolio cleanup.

Phase 7b implementation paused pending this pass; ready to resume with the corrected plan as baseline.
