# JLM Wines — Deep Review, 2026-07-17

## 1. Situation

Steady state, continuing the 07-14 review's read. The 3 days since were more jlmops maintenance (view-loading indicator @508, Comax file-link buttons re-implemented @508, Publishing-view Calendar-tab crash root-caused and fixed @509) plus one substantial planning session: a Woo REST API push (product descriptions, category, attributes) was scoped end-to-end through live conversation, independent-agent verification against the codebase, and real sample-data checks — result is a solid, reviewed plan, currently sitting outside the project's normal plan-doc home (`~/.claude/plans/`, not `jlmops/plans/`). No code shipped from that thread yet.

**Process correction, this session:** while answering an organic-traffic question, I pulled the raw "JLM GA4 Weekly" Drive sheet directly and tried to hand-aggregate month-over-month figures from it. `business/KPI.md` line 106 explicitly says sessions/Drive MCP should **not** read that sheet directly (multi-tab, not reliably parseable) — only OPS flattens it into `jlmops-status.md`, which is the sanctioned source. That's also why the pull came back truncated/unreliable. Net effect: true organic-traffic month-over-month isn't actually available through any documented path right now (see §3) — worth knowing rather than re-attempting the same workaround.

## 2. Direction — is it still right?

Acquisition (online + offline) still holds per `STRATEGY.md`'s Period Focus — one-line confirmation for content/newsletter/flyer. Flyer slip is unchanged (still no firm date), carried from last review, not worsening.

One new question this session's work raises: the Woo API push plan is catalog/ops infrastructure — closer to `STRATEGY.md`'s "build less data, ship more action" internal-build category than to either named acquisition channel (content, offline). Not wrong to have planned it (planning is cheap, and it directly targets a real defect — descriptions duplicating themselves live), but worth an explicit call: build it now, or queue behind the acquisition-period push it isn't part of? See Decision #4.

## 3. Performance

- **Sync/data quality:** performing. `jlmops-status.md` fresh (06:43 today), all integrations ok, 15/15 tests, 0 validation issues, **schema PASSED (critical 0)** — yesterday's `review-daily` flagged a critical schema failure; it's resolved as of this morning's housekeeping run, not a new open issue. Same 13-job failed-job backlog (oldest 257d) — known metric-granularity artifact, unchanged.
- **Orders:** last 7d 5 orders/₪1,787; MTD 10/₪4,896, AOV ₪490 — same thin-but-steady early-month pattern as 07-14's read.
- **GA4 (total traffic):** the 6x 7d-session jump flagged in both 07-02 and 07-14 reviews has normalized (7d now 65 total sessions, in line with the pre-anomaly baseline) — resolves that carried flag, no action needed.
- **Organic traffic specifically:** **unmeasured for trend.** 7d/MTD snapshot is fine (39/194 sessions this pull) but month-over-month isn't in the built KPI system yet — `STATUS.md`'s MoM trend surfacing covers new-customers/return-rate/subscribers only, not organic traffic. Not a defect, just a gap to stop reaching around.
- **GSC:** 2,140 clicks / 117,221 impr / avg pos 9.5 — byte-identical again. Expected: monthly cadence (3rd), next due ~08-03.
- **CRM:** 682 subscribers, flat MoM (+1) — same as 07-14, within normal noise at this list size.

## 4. Active initiatives

- **Product Verification** — still fully shipped, still not archived (holding for continued live testing, per 07-14). Re-surfacing per Decision #2.
- **Bug Fix Sequence** — F/H/I unchanged, no drift.
- **Region posts** — Negev live, Galilee (due 08-11) in progress, Central Mountains staged. On cadence.
- **Newsletter** — July print out, AYIW drafting on cadence.
- **Flyer** — still delayed past original target, no new date. Unchanged from last review.
- **Woo API push (new)** — planned, zero code shipped, plan file not yet in `jlmops/plans/`. See Decision #4.

## 5. Plan vs. reality — where revision is due

- **`STRATEGY.md` line 74** still reads `defer:2026-07-01`; `STATUS.md` Inbox has moved to `defer:2026-08-10` since. This is the **second consecutive review** flagging the same one-line drift (07-14 called it out and it wasn't fixed) — exactly the float pattern the closing-step process exists to prevent. Fixing now.
- **`STATUS.md` Blocked/Deferred**, the "Woo product attributes/descriptions via API push" line still says "not started... no plan doc yet" — no longer true, a reviewed plan exists. Needs the plan promoted into `jlmops/plans/` and this line updated to point at it.

## 6. Decisions outstanding

1. **Fix `STRATEGY.md`'s stale defer-date now** — one line, second time flagged, doing it this session unless told otherwise.
2. **Product Verification plan** — archive + graduate to system docs now, or keep holding for continued live testing? (3rd re-surface.)
3. **Flyer** — any firmer distribution date, or does the "last week of July" placeholder stand?
4. **Woo API push plan** — promote from `~/.claude/plans/` into `jlmops/plans/WOO_API_PUSH_PLAN.md` (updating `STATUS.md`'s Blocked/Deferred line to match), and confirm sequencing intent: build now, or after the acquisition-period push closes out?

## 7. Wishlist + reminders

- No wishlist movement to confirm this cycle.
- Reminders: offline-attribution `defer:2026-08-10` not yet due. Flyer's "last week of July" window is approaching — next review should check if it landed.

---

## Flags → resolution

| Flag | Resolution |
|---|---|
| `STRATEGY.md` stale defer-date (`07-01` vs current `08-10`) | In-session fix — applying now |
| GA4 7d-session 6x anomaly (carried from 07-02, 07-14) | Dismiss — self-resolved, confirmed normal this pull |
| Schema-validation critical failure (from 07-16 `review-daily`) | Dismiss — resolved by this morning's housekeeping run |
| Organic-traffic MoM not available via documented path | Noted in review; not an Inbox item — it's a KPI-system gap, not a pending decision. Revisit only if the user wants it built. |
| Woo API push plan sitting outside `jlmops/plans/`, STATUS Blocked/Deferred line stale | Decision outstanding — §6.4 |
| Product Verification plan graduation | Decision outstanding — §6.2 (3rd re-surface) |
| Flyer distribution date still unconfirmed | Decision outstanding — §6.3 |
