# Cadence Realignment Plan

**Status.** Consolidated 2026-05-11. **CRM throttling SHIPPED 2026-05-11 as @83.** Project coordination supersedes to `CAMPAIGN_ARCHITECTURE.md`.

**Purpose.** Stop the CRM from generating tasks no one will act on. Partner has explicitly parked lifecycle-cohort-driven outreach — current operational reality is broad campaigns to "everyone we can reach," not cohort segmentation.

---

## Decisions (2026-05-11)

Resolved during the planning conversation:

- **Cohort outreach parked.** Partner does not value lifecycle-cohort outreach. Campaigns go to everyone reachable. `CrmIntelligenceService` lifecycle-suggestion generation is the target of this plan.
- **No `SysCrmCandidates` table at launch.** Originally proposed as a queue for cohort candidates; not needed since cohort outreach is parked. May revisit if cohort work returns.
- **First-order welcome trigger continues.** Per-customer trigger fires on first completed order; partner acts via Contact Manager Half 2 when shipped. (Not yet implemented in `CrmIntelligenceService` — it lives elsewhere; this plan didn't touch its path.)
- **Existing unactioned lifecycle tasks: cleared manually by user 2026-05-11.** No bulk-strike code needed.
- **Project-level coordination of campaign/content work moves to `CAMPAIGN_ARCHITECTURE.md`.** This plan focuses solely on CRM throttling.

---

## The Change

`CrmIntelligenceService.runAnalysis()` previously emitted task records for four trigger types every nightly run: cooling customers, unconverted subscribers, winery clusters, and upcoming holidays. After this change:

- **Cohort-driven suggestions disabled** (cooling, unconverted subscribers, winery clusters). Gated by the new `crm.suggestions.cohort.enabled` flag (default false). The lifecycle status fields (`sc_LifecycleStatus`, `sc_DaysSinceOrder`) and other contact-level signals continue to be computed and stored on SysContacts — useful context on a record — but no task records are emitted.
- **Holiday reminders unaffected.** Calendar-driven reminders for upcoming Hebrew holidays still fire; they're planning prompts, not cohort outreach.
- **First-order welcome trigger.** Lives outside `CrmIntelligenceService` (will hang off the order-completion path when Contact Manager Half 2 ships). Not touched.

### Implementation options

a. **Config flag.** Add `crm.suggestions.cohort.enabled` to `config/system.json` (default `false`). Service checks the flag before generating cooling/lapsed/dormant suggestions. Preserves the code path for future re-enable.

b. **Code removal.** Strip the cooling/lapsed/dormant generation entirely. Simpler but loses the future on-ramp.

**Recommend (a).** Minimal change, reversible. Once cohort outreach machinery returns (with the action-layer UX in place), flip the flag back on.

---

## Build Steps (SHIPPED 2026-05-11 as @83)

1. ✅ Added `crm.suggestions.cohort.enabled = false` row to `config/system.json`.
2. ✅ Modified `CrmIntelligenceService.runAnalysis()` to gate the three cohort checks (cooling / unconverted subscribers / winery clusters) behind the flag. Holiday reminder check unaffected.
3. ✅ Regenerated `SetupConfig.js` via `node jlmops/generate-config.js`.
4. ✅ `clasp push` + `clasp deploy --deploymentId <stable> -d "@83"` — preserves the live URL.
5. **User action required:** run `rebuildSysConfigFromSource()` in Apps Script editor to apply the new config row to the live `SysConfig` sheet.
6. **Verify** next nightly run: no new cohort suggestion tasks generated. Holiday check still fires within lead-time window.

---

## Cross-References

- `jlmops/plans/CAMPAIGN_ARCHITECTURE.md` — Campaign + Project coordination layer (companion plan)
- `jlmops/plans/CONTACT_MANAGER_PLAN.md` — first-order welcome trigger details, Half 2 action layer
- `jlmops/plans/CRM_PLAN.md` — lifecycle status definitions (still computed, not acted on)
