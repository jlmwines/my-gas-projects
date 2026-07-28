# JLM Wines — Deep Review, 2026-07-27

## 1. Situation

Steady state overall, with one sync-reliability incident: Friday's code-audit deploy (@530-543) silently emptied `WebXltM` (translation master) via a broken column-remap. Sync doesn't run Saturdays, so it surfaced at the next actual occasion — Sunday 2026-07-26 — and was root-caused and fixed the same day (@544), confirmed healthy the next morning: `WebXltM`/`WebProdM` both 766 rows, 0 recent errors, 15/15 tests, schema clean. Acquisition-period work (content, newsletter, flyer) continued in parallel and is unaffected; flyer distribution began 2026-07-26 in Talbiye, resolving the last review's open question.

## 2. Direction — is it still right?

- **Acquisition (online + offline)** still holds per `STRATEGY.md` — one-line confirm. Flyer now actually dropping; content/newsletter on cadence.
- **"Sync is stable, bug fixes only"** (`STRATEGY.md` jlmops) — held true in substance (this week's fix was a bug fix, not a rebuild), but the underlying assumption took a real 2-day hit, and it surfaced that Tier 4 (DR/backup snapshots) is still unshipped — recovery required manually digging through Sheets version history. Not a direction change; worth an occasional reliability session alongside acquisition, not instead of it. See Decision #3.

## 3. Performance

- **Sync/data quality:** recovered, performing. `jlmops-status.md` fresh (07:07 today), all integrations ok, queue clean (0 pending/processing), 15/15 tests, schema PASSED (critical 0), 0 recent errors. Failed-job backlog unchanged (16, oldest 267d) — known metric-granularity artifact, not new.
- **Orders:** improving. 7d 5 orders/₪3,594; MTD 16/₪9,836, AOV ₪615 — up from last review's ₪490 AOV.
- **New customers / return rate:** 4 EN + 2 HE (trailing 90d); return rate 6% (vs 5% last month) — MoM deltas still not fully trustworthy per the known retroactive-snapshot caveat (unchanged from prior reviews).
- **Newsletter:** 683 subscribers (+2 MoM), 8 campaigns sent, avg 50% open / 7% click — performing.
- **Organic traffic:** durable upward trend since the mixed-content/SEO fix (2026-07-01, per user), not just a two-point blip — 7d organic 60 EN/33 HE = 93 (vs. 39 at the 07-17 review), total GA4 7d 159 (vs. 65). Top-of-funnel is genuinely better.
- **New customers: the actual bottleneck.** Despite the traffic gain, new-customer conversion is not strong (per user) — 4 EN + 2 HE this month. Traffic is up ~2.4x but new customers aren't scaling with it — a **Convert**-stage gap (`KPI.md`'s Acquire→Convert→Retain frame), not an Acquire-stage one. Worth asking whether the first-order coupon / trust-conversion path is the leak.
- **Newsletter subscribers lag** (+2 MoM per user's read) — acquisition into the list itself is slow, separate from the (healthy) 50%/7% engagement on the existing list.
- **Operational velocity up:** product update/addition pace is faster now, and publishing cadence is improving (per user) — increased capacity that isn't yet clearly pointed at the Convert-stage gap above.
- **GSC:** 2,140 clicks / 117,221 impr / avg pos 9.5, byte-identical — expected, monthly cadence, next due 08-03.

## 4. Active initiatives

- **Woo API push** — shipped, live, plan promoted to `jlmops/plans/WOO_API_PUSH_PLAN.md`. Resolves last review's Decision #4.
- **Product Verification** — shipped, archived, facts graduated. Resolves last review's Decision #2.
- **Region posts** — Galilee (due 08-11) in progress, Central Mountains staged. On cadence.
- **Flyer** — distribution began 2026-07-26, Talbiye. Resolves last review's Decision #3.
- **Reliability debt** — two new gaps logged this week, unfixed: `RELIABILITY_AUDIT.md` §1.5 (empty-master hard-crash blocks retries) and §1.6 (multi-phase pull has no atomicity). Tier 4 (DR/backup) still unshipped. See Decision #2.

## 5. Plan vs. reality — where revision is due

- `CALENDAR.md`'s reliability-audit summary line was stale (missed 1.4 shipped + didn't exist for 1.5/1.6) — **fixed in-session**.
- `plans/STATUS.md` hadn't been touched since 07-24 despite the WebXltM incident+fix being the most significant event since — **fixed in-session** (Updated line, Metrics, flyer status).
- `.claude/bugs.md` had no entry for the incident — **fixed in-session** (resolved entry added, pointing to `RELIABILITY_AUDIT.md` §1.5/§1.6 and the commit).
- `.claude/session-log.md` had no entry for 2026-07-26 — **fixed in-session**.

## 6. Decisions outstanding

1. **Reliability debt** (`RELIABILITY_AUDIT.md` §1.5, §1.6, Tier 4 DR) — worth a dedicated session soon, or keep riding acquisition focus and revisit later?

**Resolved this cycle:** AYIW July email — scheduled for 2026-07-28, not an open question.

## 7. Wishlist + reminders

- No wishlist movement this cycle.
- Reminder: offline-attribution `defer:2026-08-10`, not yet due — now more relevant with flyer distribution live (QR/coupon tracking to watch).

---

## Flags → resolution

| Flag | Resolution |
|---|---|
| `CALENDAR.md` reliability-audit summary stale | In-session fix — applied |
| `STATUS.md` not updated since 07-24, missing the incident | In-session fix — applied |
| `.claude/bugs.md` missing WebXltM incident entry | In-session fix — applied |
| `.claude/session-log.md` missing 2026-07-26 entry | In-session fix — applied |
| Flyer distribution date (carried from 07-17 review) | Resolved — began 2026-07-26, Talbiye |
| Woo API push plan promotion (carried from 07-17 review) | Resolved — shipped, promoted |
| Product Verification archive (carried from 07-17 review) | Resolved — archived, graduated |
| AYIW July email send status | Resolved — scheduled 2026-07-28 |
| Reliability debt investment (new, from this week's incident) | Decision outstanding — §6.1 |
| Organic-traffic MoM still not long-run-trended | Dismiss/note — same KPI-system gap as prior reviews, not a pending decision |
