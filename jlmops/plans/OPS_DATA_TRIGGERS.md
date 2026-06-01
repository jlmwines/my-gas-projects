# Ops Data Triggers — Design Concept

**Created:** 2026-05-31
**Status:** CONCEPT — captured direction, candidate spec. NOT approved for build, NOT a revival of the deferred KPI-cache work. This records the user's reframed thinking as of 2026-05-31 so a future session can pick it up.
**Reframes:** `KPI_SUMMARY_TAB.md` (DEFERRED). That narrow pre-computed KPI cache becomes, at most, one downstream consumer of the broad trigger described here — not its own pipeline.

---

## What changed

The earlier direction was a single pre-computed KPI summary tab refreshed on a blind cadence. The user has reframed this into **two distinct, on-demand, phone-triggerable mechanisms** that share underlying export plumbing but answer different questions. Pull fresh data when a question is actually being asked, rather than caching a fixed column set on a schedule.

Both triggers fire from the phone — the Ops app and Dispatch are both on it — so the user can kick off a data refresh/export in the field, then have a session examine the fresh data. Shared export mechanism, two separate entry points, two intents: **measure** vs. **fix**.

---

## The two triggers

### 1. KPI trigger — periodic / broad

Answers "how is the business doing." Cadence-driven (weekly / monthly). Pulls **ops data** (tasks/dashboard, CRM, orders) *plus* **external data** (Google Analytics GA4, Google Search Console, possibly site-direct) into one combined metrics picture.

The deferred KPI Summary tab is a *consumer* of this export, if built at all — not the pipeline itself. This is where "how's the business doing" signal is consolidated, including the external sources the old summary-tab spec deliberately left out of scope.

### 2. Diagnostics & management trigger — ad-hoc / narrow

Fired when the user spots something off in the Ops dashboard/tasks. (The dashboard ≈ almost all tasks data, and is what draws his attention when something's wrong.) Grabs the relevant tasks/ops slice for the problem at hand. Oriented toward **resolving** the issue, not measuring it — a working set for diagnosis, not a metrics report.

---

## Shared export plumbing

Both triggers rest on a common export mechanism — the same pull/snapshot machinery, parameterized by scope and source set:

- **KPI** fires it broad, on a cadence, across ops + external sources.
- **Diagnostics** fires it narrow, ad-hoc, against the ops/tasks slice in question.

One pipeline, two entry points. The shared part is the export/refresh; the divergence is in scope, cadence, and what the follow-up session does with the data.

---

## Why this over the deferred cache

- Fresh-on-demand removes the invisible staleness window of a scheduled cache.
- External data (GA4, Search Console) — where most "how's the business doing" signal lives — is in scope from the start, instead of being a separate user-owned sheet hand-merged at review time.
- Cleanly separates measurement (broad, periodic) from investigation (narrow, ad-hoc) rather than forcing both into one summary tab.
- The trigger model matches how the user actually works: notices something on the phone, fires a pull, then a session diagnoses or reviews.

---

## Open questions (for when/if this is taken up)

- Export format and target, and how a follow-up session picks up the fresh snapshot.
- Auth/quota for GA4 + Search Console pulls under the project-local account (`accounts@jlmwines.com`).
- Whether site-direct adds signal over GA4/GSC or is redundant.
- Where KPI output lands for glanceability — the old Summary-tab role, now reframed as a consumer.
- Exact phone trigger mechanism from the Ops app / Dispatch.

---

*This is captured direction as of 2026-05-31, not an approved build. Supersedes/reframes the narrow KPI-cache approach in `KPI_SUMMARY_TAB.md`; that doc stays DEFERRED.*
