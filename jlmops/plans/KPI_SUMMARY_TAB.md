# KPI Summary Tab — Implementation Spec

**Created:** 2026-05-06
**Status:** APPROVED FOR BUILD (2026-07-02) — next jlmops build item, ahead of the open queue. The 2026-05-07 parking was specifically about a *dashboard view*; the user does not want any jlmops-side KPI UI (see Build sequence — the old step 6 "Manager UI surfacing" is cut, not deferred). What's actually missing, confirmed 2026-07-02: `jlmops-status.md`'s KPI block (shipped via `OPS_SESSION_BRIDGE_PLAN.md`) carries generic order/traffic totals, not `business/KPI.md`'s 6 defined KPIs in their defined shape — this spec is what computes them. Output must feed the existing `jlmops-status.md` export so sessions read it exactly as they already do today; it is not a separate consumer surface.
**Relation to `OPS_DATA_TRIGGERS.md`:** that doc's "KPI trigger — periodic/broad" concept is what shipped as `jlmops-status.md`'s KPI block. This spec is the missing computation layer underneath it — `SysKPISummary` becomes an input the KPI-block generator reads, not a rival pipeline.
**Pairs with:** `business/KPI.md` (strategic — what we measure and why). This doc is the engineering side — how the four jlmops-source KPIs get pre-computed and stored in `JLMops_Data` so `jlmops-status.md` can read 13 cells instead of parsing 3 MB of raw sheets.
**Companion item (separate build, not bundled here):** KPI #3's Mailchimp-campaign-attribution half ("did this order follow a campaign") depends on per-recipient activity writes that don't exist yet — see `.claude/bugs.md` 2026-05-28 "Mailchimp campaign sends not written to per-contact activity log." KPI #5 (newsletter engagement) does NOT depend on this — it reads `SysCampaigns` aggregates, already pulled daily.

---

## What this is and what it isn't

**Is:** a small, self-contained sheet in `JLMops_Data` named `SysKPISummary` that holds pre-computed monthly metrics + a rolling-current row, refreshed by a new housekeeping phase. ~13 rows per year. Read-only consumer surface for weekly reviews.

**Is not:** raw event storage, a replacement for `SysOrdLog`/`SysContacts`/`SysCampaigns`, or a place to write derived analytics for ad-hoc questions. Those queries still run against the live data when needed.

The summary tab is the **fast-read cache**. Source data stays where it lives; nothing else changes.

---

## Scope: which KPIs land here

The four jlmops-source KPIs from `business/KPI.md`:

| # | KPI | Source data |
|---|---|---|
| 2 | New customers / month (EN/HE split) | `SysContacts.sc_FirstOrderDate` + `sc_Language` + `sc_IsCore` |
| 3 | First-order conversion + AOV | `SysCouponUsage.scu_WasFirstOrder` + `scu_OrderTotal` (filtered to first-purchase coupon code) |
| 4 | 90-day return rate | `SysContacts.sc_DaysSinceOrder` ≤ 90 / total core customers |
| 5 | Newsletter (subscribers + open/click) | `SysContacts.sc_IsSubscribed` for subscriber count; `SysCampaigns.scm_*` for engagement |

The two GA4-source KPIs (#1 organic traffic and #6 organic-source engagement) are out of scope for `SysKPISummary` itself, but KPI #1's EN/HE split should be added to the GA4 block `jlmops-status.md` already reads (per `OPS_SESSION_BRIDGE_PLAN.md`) rather than left to the user's separately-owned sheet — that separate-sheet framing predates the GA4 pull shipping. Confirm feasibility (does the GA4 Sheets add-on export a Language dimension) before committing to this as part of the same build.

---

## Sheet schema

**Sheet name:** `SysKPISummary`
**Prefix:** `sk_`
**Row model:** one row per period. Period values: `current` (rolling 30-day snapshot, recomputed daily) and `YYYY-MM` (closed monthly snapshot, frozen on the 1st of the following month).

### Columns

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `sk_Period` | string | `current` or `YYYY-MM`. Primary key. |
| 2 | `sk_AsOfTimestamp` | datetime | When this row was last computed. |
| 3 | `sk_NewCustomersEN` | int | KPI #2 EN. Count of `SysContacts` rows where `sc_FirstOrderDate` falls within the period AND `sc_Language='EN'` AND `sc_IsCore=TRUE`. For `current`, period = trailing 30 days. |
| 4 | `sk_NewCustomersHE` | int | KPI #2 HE. Same predicate, `sc_Language='HE'`. |
| 5 | `sk_NewCustomersTotal` | int | Convenience sum of EN + HE. Computed; not separately maintained. |
| 6 | `sk_FirstOrderConvRate` | decimal | KPI #3. `scu_WasFirstOrder=TRUE` rows in period whose `scu_Code` matches the configured first-purchase coupon, divided by `sk_NewCustomersTotal`. NULL if no new customers. |
| 7 | `sk_FirstOrderAOV` | decimal (NIS) | KPI #3. Mean of `scu_OrderTotal` for the same `scu_WasFirstOrder=TRUE` rows. NULL if zero rows. |
| 8 | `sk_Return90Rate` | decimal | KPI #4. Count of `SysContacts` where `sc_IsCustomer=TRUE` AND `sc_IsCore=TRUE` AND `sc_DaysSinceOrder ≤ 90`, divided by count of core customers. **Snapshot at end of period, not period-bounded.** Frozen monthly rows record the snapshot taken on the 1st. |
| 9 | `sk_TotalCoreCustomers` | int | Denominator of #8 — all-time core customers count at end of period. Useful as standalone trend. |
| 10 | `sk_Subscribers` | int | KPI #5. Count of `SysContacts` where `sc_IsSubscribed=TRUE`. End-of-period snapshot. |
| 11 | `sk_SubscriberGrowthMoM` | int | Convenience: `sk_Subscribers` minus the previous month's value. NULL on the first row. |
| 12 | `sk_CampaignsSent` | int | KPI #5. Count of `SysCampaigns` rows where `scm_SendDate` falls in period. |
| 13 | `sk_AvgOpenRate` | decimal | Mean of `scm_OpenRate` for the campaigns counted in #12. NULL if zero. |
| 14 | `sk_AvgClickRate` | decimal | Mean of `scm_ClickRate` for the campaigns counted in #12. NULL if zero. |
| 15 | `sk_Notes` | string | Free-form for ad-hoc annotations on a row (e.g., "April had no campaigns — newsletter v1 not yet launched"). |

Total: 15 columns, ~13 rows per year. Sheet stays under 200 cells indefinitely.

### Worked example — one row

For June 2026 close, computed on 2026-07-01:

```
sk_Period             = "2026-06"
sk_AsOfTimestamp      = 2026-07-01T03:00:00Z
sk_NewCustomersEN     = 8
sk_NewCustomersHE     = 14
sk_NewCustomersTotal  = 22
sk_FirstOrderConvRate = 0.59     (13 of 22 used the welcome coupon)
sk_FirstOrderAOV      = 412.50   (mean NIS)
sk_Return90Rate       = 0.43     (snapshot 2026-07-01)
sk_TotalCoreCustomers = 1284
sk_Subscribers        = 712
sk_SubscriberGrowthMoM= 25       (May was 687)
sk_CampaignsSent      = 1
sk_AvgOpenRate        = 0.32
sk_AvgClickRate       = 0.04
sk_Notes              = ""
```

The `current` row is the same shape with `sk_Period="current"`, recomputed every housekeeping run.

---

## Computation logic

A new service `KPISummaryService.js` exports two methods:

### `recomputeCurrent()`
Called by `HousekeepingService` daily (phase 4, after CRM refresh in phase 3 — KPI numbers depend on enriched contact data).

```
1. Compute trailing-30-day window: end = now, start = end - 30 days.
2. Walk SysContacts once. Tally sc_FirstOrderDate hits in window per language.
3. Walk SysCouponUsage once. Tally scu_WasFirstOrder hits in window where scu_Code matches the configured first-purchase coupon code(s). Sum scu_OrderTotal.
4. Walk SysContacts again (no extra read — keep one in-memory copy from step 2). Count sc_IsCustomer=TRUE AND sc_IsCore=TRUE rows; bucket by sc_DaysSinceOrder ≤ 90.
5. Walk SysContacts a third time on the same in-memory copy. Count sc_IsSubscribed=TRUE.
6. Walk SysCampaigns once. Tally scm_SendDate hits in window. Mean scm_OpenRate, scm_ClickRate over those rows.
7. Upsert the `current` row in SysKPISummary.
```

Single sheet read each for `SysContacts`, `SysCouponUsage`, `SysCampaigns`. No cross-product joins. Estimated runtime: <2 seconds against current data sizes.

### `closeMonth(yyyymm)`
Called automatically on the 1st of each month for the previous month. Optionally invokable manually for backfill.

```
1. Compute period window: start = first day of yyyymm, end = first day of next month (exclusive).
2. Same logic as recomputeCurrent() but with the period window.
3. Append a new row keyed sk_Period=yyyymm. If a row for this period already exists, overwrite it (idempotent).
4. Recompute sk_SubscriberGrowthMoM by reading the previous month's row.
```

Manual backfill path: a `KPISummaryService.backfillMonths(['2026-01', '2026-02', ...])` admin call iterates `closeMonth` for each given period. Useful right after first deploy to populate history from existing data.

---

## Configuration

One new SysConfig row:

| `scf_SettingName` | `scf_P01` | `scf_P02` | Description |
|---|---|---|---|
| `kpi.first_purchase_coupons` | comma-separated coupon codes | (timestamp marker) | Codes that count as first-purchase coupons for KPI #3. Today: `JLMNEW50` (or whatever the current welcome code is — confirm before deploy). Allows multiple if a campaign rotates codes. |

Stored in `config/system.json`, regenerated via `generate-config.js`.

No other config needed. Computation rules are code; period boundaries are calendar-derived.

---

## Refresh contract

| Trigger | What runs | When | Frozen? |
|---|---|---|---|
| Daily housekeeping | `recomputeCurrent()` | Same trigger that runs phase 3 today | No — overwrites `current` row each run |
| Monthly close | `closeMonth(prev_month)` | First daily housekeeping run of each calendar month | Yes — written once, then the row never changes (unless backfill is invoked) |

The "frozen" property matters: monthly rows record what the metric was at the time the month closed. Late-arriving data (e.g., a refund that retroactively changes a customer's `sc_OrderCount`) does not rewrite history. This is intentional — KPIs are a record of what we observed, not a live reflection of current reality. The trade-off: occasional small discrepancies between the time-series rows and a fresh recomputation. We accept this in exchange for stable numbers in weekly reviews.

If retroactive correction is ever needed, `backfillMonths` is the explicit path. Don't put logic in the daily run that silently rewrites historical rows.

---

## Read pattern (the value this delivers)

The `jlmops-status.md` KPI-block generator loads `SysKPISummary` (one read, 13 rows × 15 cells) and folds it into the export sessions already read. No session ever reads `SysKPISummary` directly. Once wired, a review session has:

- This month's pace so far (from the `current` row).
- Last 12 monthly closes (from frozen rows).
- All four jlmops-source KPIs in one place, with no need to walk `SysContacts` (3000+ rows), `SysCouponUsage`, or `SysCampaigns`.

Compared to today's session pattern (read SysContacts, filter, count, repeat for each KPI question), this is roughly a **30× reduction in cells read** for the same answers.

The two GA4-source KPIs join in via the GA4-to-Sheets file the user maintains separately — those numbers can be hand-merged or referenced by URL during the review. We don't auto-merge them in `SysKPISummary` because the GA4 sheet is owned by the user, not jlmops.

---

## What this displaces / replaces

Nothing. There's no current KPI computation in jlmops to retire. This is additive.

---

## Open questions for user before implementation → **RESOLVED 2026-05-07**

1. **First-purchase coupon code:** **`50new`**. Note: new-customer detection is decoupled from coupon — first-order-by-email defines a new customer regardless of whether the coupon was used. Coupon usage becomes a sub-metric of KPI #3 ("X% of first-orders used `50new`, AOV with vs without").
2. **`current` window length:** **trailing 90 days throughout.** Aligns with KPI #4's 90-day return-rate definition and the GA4/GSC sheets' 90-day rolling window.
3. **EN/HE classification:** **`sc_Language` from SysContacts** is canonical. Verify it aligns with web order language + Mailchimp group as a sanity check; flag drift if detected. (User confirmed all three sources should match.)
4. **Core-customer filter:** **drop war-support detection** (legacy; existing categorized rows stay as-is). **Gift detection = not core.** Mailchimp campaigns are universal (no segmentation), so core/non-core isn't an email-segmentation concern. For KPIs: track BOTH raw new-customer count AND core-only count (exclude gifts), per the `business/KPI.md` strategic emphasis on "core" growth.
5. **Backfill scope:** **full SysOrdLog history.** User confirms order history is complete in jlmops; overnight CRM activity has been continuous; no data gaps expected. Backfill all available months.

---

## Build sequence

Once the open questions are resolved:

1. **Sheet creation** — manual on first deploy: create `SysKPISummary` sheet in `JLMops_Data`, populate header row from this spec. (Could be code-driven via `SetupService` if convenient, but this is a one-time op.)
2. **Code** — `KPISummaryService.js` with the two public methods.
3. **Config** — `config/system.json` row for `kpi.first_purchase_coupons`. Regenerate `SetupConfig.js`. Run `rebuildSysConfigFromSource()` post-deploy.
4. **Housekeeping wiring** — extend `HousekeepingService` with the new phase (recomputeCurrent every run; closeMonth gated on month-rollover).
5. **Backfill** — manual admin call to populate history.
6. **Wire into `jlmops-status.md`** — extend the `OPS_SESSION_BRIDGE_PLAN.md` KPI-block generator to read `SysKPISummary` and fold its columns into the existing KPI export. This is the actual delivery point — a session never reads `SysKPISummary` directly, and there is no jlmops UI view of this data (a prior "optional later" UI-tile step is explicitly cut, not deferred — see Status above).

Estimated total: 1 short session, plus the wiring step above.

---

## Cross-references

- `business/KPI.md` — strategic scope (the "what" and "why")
- `jlmops/docs/DATA_MODEL.md` — source schemas (`SysContacts`, `SysCouponUsage`, `SysCampaigns`)
- `jlmops/plans/CONTACT_MANAGER_PLAN.md` — Mailchimp daily pull (KPI #5 wiring; already shipped as Half 1)
- `jlmops/plans/IMPLEMENTATION_PLAN.md` — overall jlmops phasing
