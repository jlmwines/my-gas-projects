# jlmops system docs

Living reference for what the jlmops backend **is** and how it **behaves**, kept present-tense and current as the code changes. These are *system docs*, not plans: they are never retired, only updated. History lives in git; intent and proposals live in `../plans/`.

Governed by **Documentation Standards** in the portfolio kernel (`projects/.claude/CLAUDE.md`).

## What lives here

- **`ARCHITECTURE.md`** — system structure, layering, sync workflow, DR posture.
- **`DATA_MODEL.md`** — every sheet, column, and relationship.
- **`WORKFLOWS.md`** — the key user and system workflows, plus task routing/assignment (§12: topic→project routing, flow_pattern→assignee, due dates). (Flagged in `../plans/TECH_DEBT_AUDIT.md` as possibly drifted from current code; needs a freshness pass.)

## The rules that keep these true

- **Docs-as-code.** When a change alters architecture, schema, or behavior, the matching system doc is updated *in the same change as the code* — not deferred.
- **Graduation.** A plan in `../plans/` is never the sole home of a durable architecture or behavior fact. When a plan ships, its durable facts graduate here first; only then is the plan archived. Archiving a plan must never conceal a fact something still needs.
- **Authoritative.** If a developer couldn't reconstruct a fact from the code, it belongs here.

## Not yet graduated

The five biggest plans were audited 2026-06-11 against the live `config/schemas.json`. Resolved:

- **`CONTENT_LIBRARY_PLAN`** — schema facts **graduated** to `DATA_MODEL.md`: the Content Library Data Model section (`SysLibrary`, `SysLibraryActivity`, the `JLMops_Library` workbook-placement constraint, slug-as-key rule) plus the `st_EntityType`/`st_EntityId`/`st_LinkedEntityName` SysTasks columns. The plan keeps its unbuilt-phase intent and still needs a length trim.
- **`CAMPAIGN_SYSTEM_PLAN`** — **no graduation gap**: campaign/attribution schema already in `DATA_MODEL.md`; the rest is superseded by `CAMPAIGN_ARCHITECTURE.md` or strategy. Trim-only.

Also graduated 2026-06-11 (verified against live code):

- **`UI_AUDIT`** — `ARCHITECTURE.md` §2.1.1 now describes single-file `data-roles` gating as the current preferred pattern (with separate-per-role files as legacy); §2.1.2 documents the load-once / client-side-filter data-fetch pattern.
- **`RELIABILITY_AUDIT`** — `ARCHITECTURE.md` §4.3 now documents two-tier stuck-job recovery (zombie killer + inline reaper) and the UI-managed vs code-installed trigger model.
- **`CRM_PLAN`** — SysContacts roster reconciled; the config-driven enrichment/segmentation thresholds (lifecycle bands, VIP 5-orders/3000-spend, prospect bands, percentile rules, `woosb` BundleBuyer) graduated to `DATA_MODEL.md` SysContacts "Derived field rules".

Still open (not graduations — deferred):

- **`ARCHITECTURE.md` §2.5.6** housekeeping-phase list may be slightly stale (missing some 2026-06-03 additions) — needs an in-place freshness check.
- **Length trims:** the five audited plans (esp. `CONTENT_LIBRARY_PLAN` 1210, `CAMPAIGN_SYSTEM_PLAN` 1026, `UI_AUDIT` 820) still carry dated-narrative / completed-history bloat to cut toward the ≤150-line standard.

_Graduated 2026-06-11: the Project-Task Integration (topic→project routing + the standing system projects) is now in `WORKFLOWS.md` §12.0; its archived plan dump is retired._
