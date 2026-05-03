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

**Audience IDs** (`accounts@jlmwines.com`, DC `us5`, audience `8a3c6dd69c`):
- Language group category: `8b945481c0` (radio)
- English interest: `17072990c9`
- Hebrew interest: `962feef4ab`

### Subscribers Pull (daily)

- **Endpoint.** `GET /3.0/lists/8a3c6dd69c/members` (paginated, `count=1000`, iterate until exhausted)
- **Captured fields.** Email, name, status, Language interest, last_changed
- **Join.** On email with existing SysContacts row
- **Write.** Update SysContacts:
  - `sc_IsSubscribed` = `true` only when status === `subscribed`; `false` for `unsubscribed` / `cleaned` / `pending` / `transactional` / `archived`
  - `sc_Language` = `'en'` if EN interest set, `'he'` if HE interest set; leave existing value alone if neither set (no overwrite from "no group")
  - `sc_SubscriptionSource` = `'mailchimp'` only when creating a new prospect row
- **Decision (2026-05-03):** keep `sc_IsSubscribed` as boolean. Adding `sc_SubscriptionStatus` would require schema migration + backfill of 548 contacts. Cleaned-vs-unsubscribed distinction is desirable but not worth the schema cost; both correctly exclude from future sends.
- **Activity records.** Write to SysContactActivity when state changes from prior pull:
  - status `subscribed` → not-subscribed: `subscription.unsubscribed` (or `.cleaned` based on actual status string captured in the activity summary)
  - language interest changed: `subscription.language_changed` (edge case — rare per user, but cheap to log)
- **Direction.** One-way. Mailchimp = source of truth. JLMops never PUTs back.

### Campaigns Pull (daily)

- **Endpoint.** `GET /3.0/campaigns?status=sent&since_send_time=<60d ago>` then `GET /3.0/reports/{campaign_id}` per campaign
- **Captured fields.** Campaign metadata (name, send_date, audience), metrics (opens, clicks, bounces, unsubscribes)
- **Refresh window.** Campaigns sent in last 60 days refresh daily (metrics keep updating as opens/clicks trickle in). Older than 60 days = stable snapshot, don't refresh.
- **Write.** SysCampaigns. Schema already defined in `CAMPAIGN_SYSTEM_PLAN.md` (`scm_ResultOpens`, `scm_ResultClicks`, etc.).
- **Per-contact engagement (opens/clicks per email) is out of scope.** Campaign-level totals only.

### No-Language Subscriber Handling

- When the daily pull finds a subscriber with no Language interest set, leave `sc_Language` unchanged (existing order-language wins).
- Surface count in JLMops admin view as a small "fix in Mailchimp" list (admin view to be designed alongside Half 2).
- User resolves manually in Mailchimp admin (volume is low — "once in a while").
- Tomorrow's pull picks up the resolution.
- **No write-back to Mailchimp in v1.**

### Build Steps

1. Add `MAILCHIMP_API_KEY` row to SysEnv (existing pattern; same place Woo creds live).
2. New service `MailchimpService.js` — thin HTTP wrapper: `get(path)`, `paginate(path, params)`. Pulls API key from SysEnv at call time. DC parsed from key suffix.
3. New method `ContactImportService.importFromMailchimpApi()` replaces `importFromMailchimpCsv` as the daily path. CSV method retained as manual fallback.
4. New service `CampaignSyncService.js` (or extend existing `CampaignService`) — `pullRecentCampaigns()` runs daily, refreshes 60-day rolling window.
5. Wire both pulls into `HousekeepingService` daily run, before contact enrichment so language updates feed into that step.
6. Update `system.mailchimp.subscribers_last_update` and `system.mailchimp.campaigns_last_update` per pull.
7. Manual smoke-test trigger from DevelopmentView (one-off "Pull Mailchimp Now" buttons) before enabling the daily schedule.

### Mailchimp Plan Note

Marketing API is available on **all Mailchimp plans including Free**. Confirmed working from `accounts@jlmwines.com` API key (verified 2026-05-03 via interest-categories + lists endpoints).

### Out of Scope

- Bounce / gibberish address maintenance (defer)
- Per-contact campaign engagement (opens/clicks per email)
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

Updated: 2026-05-03 — Half 1 scope decisions resolved (keep `sc_IsSubscribed` boolean; subscribers + campaigns pulled together). Audience IDs captured. Stale MC4WP reference removed; theme-side signup is now direct-POST + checkout-opt-in scaffold (theme v1.0.74).
