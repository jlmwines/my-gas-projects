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

- Several large plan docs still hoard schema/architecture detail that should graduate here (cleanup-session backlog). The biggest plans (`CONTENT_LIBRARY_PLAN`, `CAMPAIGN_SYSTEM_PLAN`, `RELIABILITY_AUDIT`, `UI_AUDIT`, `CRM_PLAN`) are the candidates — verify before moving, since much is already covered here.

_Graduated 2026-06-11: the Project-Task Integration (topic→project routing + the standing system projects) is now in `WORKFLOWS.md` §12.0; its archived plan dump is retired._
