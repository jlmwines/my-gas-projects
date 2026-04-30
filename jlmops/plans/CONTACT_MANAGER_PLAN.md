# Contact Manager Plan

**Purpose.** Activate the existing CRM data layer. The system already runs nightly (548 contacts enriched as of 2026-04-30) — what's missing is automated data sync and an action layer for partner follow-ups.

**Status.** Plan written 2026-04-30. Build queued post theme cutover. Build in two halves.

---

## Context

The CRM data layer already exists:
- ContactService, ContactImportService, ContactEnrichmentService, CrmIntelligenceService all run nightly
- 548 contacts enriched with bilingual preferences (categories, wineries, grapes, kashrut)
- Activity history backfill complete (18,788 records)
- Daily refresh updates lifecycle status and days-since-order
- Suggestion generation produces task records for cooling customers

What's missing — and why nothing happens today:
1. **No automated data sync.** Mailchimp subscriber state is imported via manual CSV. Stale within hours of updates.
2. **No action layer.** Suggestions sit in task records. No simple way for the partner to act on them. Result: "system reminds me I'm not doing anything."

---

## Half 1 — Mailchimp Data Automation

Replaces manual CSV with daily API pull. Same Mailchimp API key for both endpoints.

### Subscribers Pull (daily)

- **Endpoint.** `GET /3.0/lists/{list_id}/members` (paginated)
- **Captured fields.** Email, name, status (subscribed / unsubscribed / cleaned), language group, tags
- **Join.** On email with Woo customer data already in WebOrdM
- **Write.** Update SysContacts: subscription state, language preference, group membership
- **Direction.** One-way for v1. Mailchimp = source of truth for subscriber state. JLMops doesn't push back.

### Campaigns Pull (daily)

- **Endpoint.** `GET /3.0/campaigns` (filter sent_at within last ~60 days), then `GET /3.0/reports/{campaign_id}` per campaign
- **Captured fields.** Campaign metadata (name, send_date, audience), metrics (opens, clicks, bounces, unsubscribes)
- **Refresh window.** Campaigns sent in last 60 days refresh daily (metrics keep updating as opens/clicks trickle in). Older than 60 days = stable snapshot, don't refresh.
- **Write.** SysCampaigns. Schema already defined in `CAMPAIGN_SYSTEM_PLAN.md` (`scm_ResultOpens`, `scm_ResultClicks`, etc.).

### No-Language Subscriber Handling

- When the daily pull finds a subscriber with no language group set, flag in SysContacts.
- Surface in JLMops as a small "fix in Mailchimp" list (admin view).
- User resolves manually in Mailchimp admin (volume is low — "once in a while").
- Tomorrow's pull picks up the resolution.
- **No write-back to Mailchimp in v1.**

### Mailchimp Plan Note

Marketing API is available on **all Mailchimp plans including Free**. Only specific products like Transactional (Mandrill) require higher tiers. Confirm specific plan but odds very high that API access is already in place.

### Out of Scope

- Bounce / gibberish address maintenance (defer)
- MC4WP signup tagging on website (already configured per 2026-04-28 footer rebuild — verify still working but no new build)
- Write-back to Mailchimp from JLMops

---

## Half 2 — Action Layer (Mobile-Friendly Follow-Up)

Designed for partner use, phone-first but works on desktop. Single screen flow: list → tap channel → native action → return to JLMops → log outcome.

### Trigger

- **First detection of a completed-status order from a new customer triggers the welcome follow-up.** That's it.
- No date capture. No order-note fetch. No `processing → completed` diffing — if the order is `completed`, it has arrived.
- Trigger fires once per customer; later status changes don't re-fire.

### Follow-Up Due List

- Contacts surfaced by the trigger above, with no follow-up activity logged for that contact since.
- **Capacity cap.** ~10 oldest unhandled per the campaign plan's manual-outreach capacity.
- Once an outcome is logged (any of the three channels), the contact drops from the list. No automatic age-out window.

### Three Channels — Partner Picks One per Attempt

- **WhatsApp.** `wa.me/972...?text=...` opens WhatsApp Business (mobile or web/desktop) with language-specific one-liner pre-filled. Templates stored as config, editable without code.
- **Email.** `mailto:?subject=...&body=...` opens default email client with language-specific subject + 2–3 sentence body pre-filled.
- **Phone.** `tel:+972...` dials on mobile. On desktop the link does nothing useful, so the phone number is also displayed visibly so partner can dial manually.

All three buttons render identically everywhere. Native handler does what it can per platform. No conditional UI.

### Outcome Capture (Universal Panel)

- One panel per contact, regardless of channel chosen
- Channel auto-tagged from which button was tapped
- Free-text note (partner records what was discussed)
- Outcome buttons: replied / no reply / follow up later
- Logs to SysContactActivity with type `comm.whatsapp` / `comm.email` / `comm.phone` (types already exist per CRM_PLAN.md)
- Each attempt = one activity record (multiple attempts = multiple records)
- Contact drops from the follow-up list once any outcome is logged
- Resurfaces on the next CRM trigger (cooling at 90 days, etc.) if applicable

### Partner UX Principles

- **Utility, not polish.** No fancy UI. The simplicity is the feature.
- **Phone-first.** New "Follow-ups" view designed for mobile screen sizes.
- **No multi-channel-per-attempt state.** One channel per attempt; if partner wants to try a different channel later, that's a new attempt later.
- **No fancy state machine.** List + buttons + outcome panel. Done.

### Customers Without WhatsApp Phone

- `sc_WhatsAppPhone` empty → skip from list, OR surface separately as "no WhatsApp — try email / phone"
- Decide on display approach during build

### Extensions (Later)

- Same UX, different trigger logic for cooling customers (91–180 days), VIP recognition, lapsed win-back
- First-order welcome is the simplest entry point and should ship first

---

## Build Order

1. **Half 1 first** (data foundation). Mailchimp API auth + subscribers pull + campaigns pull + no-language flagging.
2. **Half 2 second** (action layer). Trigger detection, follow-up list view, channel buttons, outcome panel.

**Not blocked by CRM classification simplification** (see `CRM_PLAN.md`). The simplification can be applied opportunistically — first-order follow-up doesn't depend on customer-type classification, only on order completion.

---

## Cross-Reference

- `jlmops/plans/CRM_PLAN.md` — schema, classification rules, enrichment logic
- `jlmops/plans/CAMPAIGN_SYSTEM_PLAN.md` — Mailchimp campaign tracking schema, attribution model
- `jlmops/plans/WHATSAPP_CRM_INTEGRATION.md` — may already cover Half 2 shape; reread before build

---

## Cadence Tuning (Future)

Currently the CRM jobs (refreshAllContacts, enrichStaleContacts, generateDailySuggestions) run nightly. Once the action layer ships and the partner has a real review rhythm:

- Time-derivative fields (sc_DaysSinceOrder, sc_LifecycleStatus): keep daily — each day shifts the answer
- Preference enrichment (sc_FrequentCategories, sc_TopWineries): could move to weekly or event-driven
- Suggestion generation: align with partner review rhythm (e.g., generate Sunday night if partner reviews Mondays)

Not urgent — defer until the action layer is live and review patterns are observable.

---

Updated: 2026-04-30
