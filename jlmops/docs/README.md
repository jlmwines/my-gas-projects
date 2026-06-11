# jlmops system docs

Living reference for what the jlmops backend **is** and how it **behaves**, kept present-tense and current as the code changes. These are *system docs*, not plans: they are never retired, only updated. History lives in git; intent and proposals live in `../plans/`.

Governed by **Documentation Standards** in the portfolio kernel (`projects/.claude/CLAUDE.md`).

## What lives here

- **`ARCHITECTURE.md`** — system structure, layering, sync workflow, DR posture.
- **`DATA_MODEL.md`** — every sheet, column, and relationship.
- **`WORKFLOWS.md`** — the key user and system workflows. (Flagged in `../plans/TECH_DEBT_AUDIT.md` as possibly drifted from current code; needs a freshness pass.)

## The rules that keep these true

- **Docs-as-code.** When a change alters architecture, schema, or behavior, the matching system doc is updated *in the same change as the code* — not deferred.
- **Graduation.** A plan in `../plans/` is never the sole home of a durable architecture or behavior fact. When a plan ships, its durable facts graduate here first; only then is the plan archived. Archiving a plan must never conceal a fact something still needs.
- **Authoritative.** If a developer couldn't reconstruct a fact from the code, it belongs here.

## Not yet graduated

- Several large plan docs still hoard schema/architecture detail that should graduate here (cleanup-session backlog). Notable: `../../docs/plans/projects recovery.txt` is the only record of the shipped Project-Task Integration (topic→project routing, the four system projects); its durable facts should graduate into a clean reference, then the dump can go.
