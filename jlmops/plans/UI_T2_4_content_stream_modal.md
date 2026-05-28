# UI Tier 2.4 — Content Stream modal merge (DEFERRED with reasoning)

**Session ID:** UI_T2_4
**Status:** Plan v1 (2026-05-28). **DEFER decision banked.** The v0 audit assumption that the two Content Stream modals could cleanly merge into a shared include was based on the modals looking superficially similar. Side-by-side code reading shows the divergence is structural: LibraryView's modal carries fields (Type + References) that AdminProjectsView's modal cannot use without ambiguity. Forcing convergence now wastes work because `LIBRARY_VIEW_PLAN.md:194` documents AdminProjectsView's future retirement, after which the shared component would collapse back to a one-consumer kit.

**Parent:** `UI_AUDIT.md` §5 Tier 2.4
**Estimated effort:** 0 sessions. Session not opened.
**Depends on:** N/A.

## Decision: defer

The merge is deferred until **one of two conditions** holds:

1. **AdminProjectsView retirement is concretely canceled or postponed by 12+ months**, AND a maintainable shared component is worth the build cost; or
2. **A third consumer of the same modal markup emerges** (e.g., a new admin view needing "Create Content Tasks"), making the shared component a 3-way win instead of a 2-way one half-rotting.

Until then, the two modals remain forked. The fork is acknowledged in `LIBRARY_VIEW_PLAN.md:205` as deliberate.

## Why the audit's v0 plan was wrong

### Finding 1: structural divergence

Read both modals end-to-end:
- `AdminProjectsView.html:565-593` — `contentStreamModal`. Fields: Content Name + Stream ID + Stages checkboxes.
- `LibraryView.html:313-356` — `lvContentStreamModal`. Fields: **Type (Blog/Email/News/Social)** + Content Name + Stream ID + **References** + Stages checkboxes.

The Type and References fields are essential for LibraryView (they drive entity-type routing in `LibraryService.spawnContentChain` per `LIBRARY_VIEW_PLAN.md` Phase 11.1) and meaningless for AdminProjectsView (which operates on legacy content-stream projects, not library entities).

Converging via a shared include with all 5 fields, JS-toggled visibility, and a callback-based submit API is feasible but introduces an API contract:
```javascript
ContentStreamModal.open({
  showType: true,
  showReferences: true,
  onSubmit: function(formData) { /* consumer-specific */ },
  onCancel: function() { /* optional */ }
});
```

That contract is the right shape **if both consumers stick around**.

### Finding 2: AdminProjectsView is on a deprecation path

`LIBRARY_VIEW_PLAN.md:194` explicitly says: *"AdminDashboardView_v2 collapses in a later phase alongside AdminProjectsView."*

Once AdminProjectsView retires:
- The shared `ContentStreamModal` reverts to a 1-consumer kit (LibraryView only).
- The Type/References-toggle complexity becomes dead complexity.
- The callback contract layer becomes overhead for a single caller.

### Finding 3: cost / benefit

| Option | Now | After AdminProjectsView retires |
|---|---|---|
| Merge with shared component | 1 file extracted + 2 consumer updates + API contract overhead | API contract overhead lingers; 1 consumer pays for 2-consumer flexibility |
| Defer (this decision) | 0 work | Modal markup retires naturally with AdminProjectsView; LibraryView's modal stays as-is |

Defer is the cleaner long-term path.

### Finding 4: there is no current pain

Neither modal has open bugs. Both work. The fork costs nothing operationally (no double-maintenance burden — they diverged because their domains diverged).

## What would unblock the merge

This deferral is not permanent. Revisit if any of these occur:
- A third HTML view needs a "Create Content Tasks" modal with shape similar to LibraryView's.
- AdminProjectsView retirement is canceled or pushed out to 2027+ and the maintenance gap between the two modals starts producing inconsistent UX.
- A change to the Type or Stages list needs to land in both modals simultaneously (a real cross-modal change is the cleanest signal that they should converge).

## Action items

1. Update `UI_AUDIT.md` §5 Tier 2.4 entry — strike the merge implementation and note the deferral.
2. Update `UI_AUDIT.md` §10 status — T2.4 deferred (not shipped, not pending).
3. Recommended ship order in `UI_AUDIT.md` §5 — remove T2.4 from the sequence so future readers don't think it's queued.
4. **Total remaining sessions drops from 14 to 13.**

## Notes for future sessions

- This deferral demonstrates that **plan reconciliation against actual code can produce a "don't act" outcome**. That's a valid planning result, not a failure. Library-plan failure mode was punting decisions to implementation; the cure is making the decision (defer) explicit at plan time.
- If `ContentStreamModal.open(...)` shape ever does get built, the design sketch above is a starting point: Type + References as optional flags, callback-based submit, kit pattern next to TaskWidgets.
