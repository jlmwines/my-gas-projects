# UI Tier 5.3 — Shared list component (CONDITIONAL DEFERRAL with explicit re-evaluation criteria)

**Session ID:** UI_T5_3
**Status:** Plan v1 (2026-05-28). **Conditional defer.** This session opens only if structural similarity across the load-once+client-filter adopters meets the threshold defined below. Otherwise it stays closed permanently (Library-plan-style "build infrastructure for hypothetical reuse" is the anti-pattern this avoids).

**Parent:** `UI_AUDIT.md` §5 Tier 5.3
**Estimated effort:** 1 session IF the trigger fires, 0 otherwise.
**Depends on:** Tier 3 shipped (specifically T3.1 + T3.2 + T3.3). Also benefits from T2.1, T2.5, T2.6 outcomes.

## Why this is a deferral-with-criteria, not an action plan

The v0 audit assumed extracting a shared list-with-filter-sort-render helper would be valuable after Tier 3 shipped. That assumption is correct **only if** the patterns across adopters converge structurally — same filter-bar shape, same sort UI, same row-click-detail flow, same backend response envelope.

If patterns diverge (each consumer has bespoke filter chips, different sort indicators, different detail panels), forcing them into a shared API costs more than maintaining parallel implementations. The Library-plan failure mode was committing to shared infrastructure based on superficial similarity; T5.3 explicitly resists that.

The honest answer at plan time: **we don't know yet whether convergence is real.** This session opens only when measured.

## Trigger criteria — open this session iff ALL three are true

After Tier 3 ships, audit the following 7 views' list-with-filter-sort-render shapes:

1. `AdminContactsView` (load-once-filter-client precedent)
2. `AdminCampaignsView` (load-once, expand-detail-on-row-click)
3. `AdminProjectsView` (workbench list + detail pane)
4. `ManagerDashboardView_v2` (filter chips + expand-row-on-click)
5. `LibraryView` (filter chips + tab-switched lists + drawer detail)
6. `AdminBundlesView` (post-T2.1: filter chips + row badges + editor pane)
7. `ManagerContactView` (post-T3.2: load-once-filter-client + detail panel)

Open session iff:

- **Criterion 1 (filter shape).** ≥5 of 7 use the same chip-based filter pattern (`tw-chip` or local equivalent) AND filter logic structure (toggle active state + reapply client-side filter over cached state).
- **Criterion 2 (row interaction).** ≥5 of 7 use click-to-expand-inline OR click-to-open-detail-pane as the primary row interaction. (Either is fine — but if the views split evenly between the two patterns, the shared component would have to support both and the abstraction overhead exceeds the duplication overhead.)
- **Criterion 3 (state shape).** ≥5 of 7 store their full list in a single state property (e.g., `state.items` / `state.contacts` / `allBundles`) and never mutate per-row state outside that array.

If all 3 hold: session opens; design a `TaskWidgets.bindList({items, filters, sortFields, renderRow, onRowClick, onRowExpand})` helper.

If any one fails: session stays deferred. Parallel implementations are acceptable.

## What the session would look like IF it opens

Sketch only — full implementation plan comes at session-open time, not now.

**Stages (sketch):**
1. Add `TaskWidgets.bindList(config)` helper to the kit (CCP-UI-6).
2. Migrate the smallest-scope consumer (likely AdminCampaignsView with its single-card list + expand-detail) first as proof-of-pattern.
3. If pattern holds, migrate one more (e.g., ManagerDashboardView_v2 tasks list).
4. If both migrations are clean, document the helper as a CCP-UI sub-pattern; future consumers default to using it.
5. If migration #1 or #2 reveals divergence beyond the abstraction's tolerance, **revert** and re-defer.

**Estimated effort if all 5 stages ship:** 2-3 sessions.

## When to revisit

Revisit the trigger criteria:
- **End of UI implementation phase** (after T5.2 ships). Run the audit against the 7 views as they exist post-implementation.
- **OR when a new view is being added** that would need filter+sort+render functionality. At that point, choose between (a) building it from scratch (default), (b) opening this session to extract first.

## Action items at audit close

When all 17 active UI sessions have shipped, the next audit session updates this file with:
- The trigger evaluation result (criteria met or not).
- If met: this session opens for full planning + implementation.
- If not met: this session is permanently retired with the reasoning. UI_AUDIT.md §5 Tier 5.3 entry is struck from the active queue.

Until that evaluation: **no work in this session.**

## Notes for future sessions

- This deferral demonstrates that **plan completeness includes "the criteria for re-opening a deferred item are themselves decided up front."** T5.3 is not a "we'll decide later" punt; it's "we have explicit numeric criteria, we evaluate at a known point, we either open or close." That's a complete planning outcome.
- Avoids the Library-plan anti-pattern: building shared infrastructure on assumed-but-unverified reuse needs.
- If trigger fires later, this doc becomes the starting point for the session-open deep-dive at that time.
