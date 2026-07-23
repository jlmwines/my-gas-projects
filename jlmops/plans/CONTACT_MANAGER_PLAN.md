# Contact Manager Plan

**Purpose.** Activate the existing CRM data layer. The system already runs nightly (548 contacts enriched as of 2026-04-30) — what's missing is automated data sync and an action layer for partner follow-ups.

**Status.** Plan written 2026-04-30. **Half 1 SHIPPED 2026-05-05 as jlmops @81** (`MailchimpService.js` + `ContactImportService.importFromMailchimpApi()` + `CampaignService.pullRecentCampaigns()` wired into housekeeping phase 3; AdminContactsView refresh button live). **Half 2 SHIPPED 2026-05-14** — see status below.

---

## Context

The CRM data layer already exists:
- ContactService, ContactImportService, ContactEnrichmentService, CrmIntelligenceService all run nightly
- Contacts enriched with bilingual preferences (categories, wineries, grapes, kashrut) — current count → `plans/STATUS.md` Current State ("CRM enrichment")
- Activity history backfill complete (18,788 records)
- Daily refresh updates lifecycle status and days-since-order
- Suggestion generation produces task records for cooling customers

What's missing — and why nothing happens today:
1. **No automated data sync.** Mailchimp subscriber state is imported via manual CSV. Stale within hours of updates.
2. **No action layer.** Suggestions sit in task records. No simple way for the partner to act on them. Result: "system reminds me I'm not doing anything."

---

## Half 1 — Mailchimp Data Automation

Replaces manual CSV with daily API pull. Same Mailchimp API key for both endpoints.

**Purpose (revised 2026-05-05).** With theme v1.0.91/v1.0.92 the website is now authoritative for language at signup — both footer signup and checkout opt-in POST directly to Mailchimp with the correct language interest based on page language. The pull's job is therefore narrower than originally scoped:

1. **Detect subscribers added outside the website** — manual Mailchimp adds, future integrations, anything not flowing through the theme. These appear as new prospect rows in SysContacts.
2. **Keep `sc_IsSubscribed` honest** — when someone unsubscribes or hard-bounces directly in Mailchimp, the boolean must flip in SysContacts so they're excluded from segment exports.
3. **Refresh campaign metrics** — opens / clicks / bounces for the rolling 60-day window.

Language sync is no longer a primary motivation. SysContacts and Mailchimp can't meaningfully diverge for website-sourced contacts because both signals derive from page language at signup time. See language rules below — they collapse to "set on prospect creation, never touch existing rows."

**Audience IDs** (`accounts@jlmwines.com`, DC `us5`, audience `8a3c6dd69c`):
- Language group category: `8b945481c0` (radio)
- English interest: `17072990c9`
- Hebrew interest: `962feef4ab`

### Subscribers Pull (daily)

- **Endpoint.** `GET /3.0/lists/8a3c6dd69c/members` (paginated, `count=1000`, iterate until exhausted)
- **Captured fields.** Email, name, status, Language interest, last_changed
- **Join.** On email with existing SysContacts row
- **Write.** Update SysContacts:
  - `sc_IsSubscribed` = `true` only when status === `subscribed`; `false` for `unsubscribed` / `cleaned` / `pending` / `transactional` / `archived`. **MC always wins on subscription state.**
  - `sc_Language` — **only set on new prospect creation** (row didn't exist in SysContacts before this pull). Take `'en'` if EN interest set, `'he'` if HE interest set, blank otherwise. **Never touch `sc_Language` on existing rows** — SysContacts is authoritative for any contact already known to ops.
  - `sc_SubscriptionSource` = `'mailchimp'` only when creating a new prospect row
- **Decision (2026-05-03):** keep `sc_IsSubscribed` as boolean. Adding `sc_SubscriptionStatus` would require schema migration + backfill of 548 contacts. Cleaned-vs-unsubscribed distinction is desirable but not worth the schema cost; both correctly exclude from future sends.
- **Activity records.** Write to SysContactActivity when state changes from prior pull:
  - status `subscribed` → not-subscribed: `subscription.unsubscribed` (or `.cleaned` based on actual status string captured in the activity summary)
- **Direction.** One-way. Mailchimp = source of truth for state; SysContacts is authoritative for language on existing rows. JLMops never PUTs back.

### Campaigns Pull (daily)

- **Endpoint.** `GET /3.0/campaigns?status=sent&since_send_time=<60d ago>` then `GET /3.0/reports/{campaign_id}` per campaign
- **Captured fields.** Campaign metadata (name, send_date, audience), metrics (opens, clicks, bounces, unsubscribes)
- **Refresh window.** Campaigns sent in last 60 days refresh daily (metrics keep updating as opens/clicks trickle in). Older than 60 days = stable snapshot, don't refresh.
- **Write.** SysCampaigns. Schema already defined in `CAMPAIGN_SYSTEM_PLAN.md` (`scm_ResultOpens`, `scm_ResultClicks`, etc.).
- **Per-contact engagement (opens/clicks per email) is out of scope.** Campaign-level totals only.

### No-Language Subscriber Handling

Dropped from the plan as of 2026-05-05. With the website now authoritative on language at signup, the only subscribers without an MC Language interest are external/manual adds. For those:

- New prospect row in SysContacts is created with `sc_Language` blank.
- No admin UX, no "fix in Mailchimp" list, no write-back.
- Language fills in when ops next interacts with the contact (first order, manual edit), or stays blank if they never engage.

### Build Steps

1. Add `MAILCHIMP_API_KEY` row to SysEnv (existing pattern; same place Woo creds live).
2. New service `MailchimpService.js` — thin HTTP wrapper: `get(path)`, `paginate(path, params)`. Pulls API key from SysEnv at call time. DC parsed from key suffix.
3. New method `ContactImportService.importFromMailchimpApi()` replaces `importFromMailchimpCsv` as the daily path. CSV method retained as manual fallback.
4. New service `CampaignSyncService.js` (or extend existing `CampaignService`) — `pullRecentCampaigns()` runs daily, refreshes 60-day rolling window.
5. Wire both pulls into `HousekeepingService` daily run, before contact enrichment so language updates feed into that step.
6. Update `system.mailchimp.subscribers_last_update` and `system.mailchimp.campaigns_last_update` per pull.
7. **On-demand "Refresh Mailchimp Now" button in AdminContactsView (admin CRM view).** The daily pull is the safety net; the on-demand button is what actually matters operationally, since the partner refreshes deliberately right before exporting a segment or planning a send. Place in the contacts-list card-header alongside the existing refresh icon (or next to the search input). Same code path as the scheduled pull. Surface last-pull timestamp adjacent so the partner can see freshness at a glance. (DevelopmentView smoke-test trigger remains, but the user-facing control is in AdminContactsView.)

### Mailchimp Plan Note

Marketing API is available on **all Mailchimp plans including Free**. Confirmed working from `accounts@jlmwines.com` API key (verified 2026-05-03 via interest-categories + lists endpoints).

### Out of Scope

- Bounce / gibberish address maintenance (defer)
- Per-contact campaign engagement (opens/clicks per email)
- Write-back to Mailchimp from JLMops

### Follow-up — Campaign-recipient activity (calendared after Half 1)

Per-contact **recipient** rows (not engagement) — record that contact X was included in campaign Y's send. Rationale: order-after-send is an attribution clue even without open/click tracking (GA4 covers that side). Equally important — this is the activity-row pattern Half 2 needs to record manager-contact outcomes, so Half 1's import paves the way. Endpoint `/reports/{id}/sent-to` (paginated). Activity type `campaign.received`, idempotent on (campaign + email).

---

## Half 2 — Manager CRM (Action Layer)

**Status.** SHIPPED 2026-05-14 as jlmops @105–@116 (portfolio `CALENDAR.md` "Manager CRM Half 2"). Reshaped per the discovery pass below into a small CRM surface for the manager (search → contact → action) rather than a single trigger-driven follow-up screen, with the welcome trigger as the first source of work — `ManagerContactView`, the outreach trigger, and the Action Panel are live. Not yet archived: `task.contact.outreach` and `ManagerContactView` haven't graduated to `jlmops/docs/WORKFLOWS.md` yet (only `SysContactActivity`'s schema has, via `DATA_MODEL.md`) — hold archiving this plan until that graduation happens.

### Discovery — what's already in place

A scan of `SysContactActivity` writers and `AdminContactsView`:

- **`SysContactActivity` is alive.** Schema: `sca_ActivityId, sca_Email, sca_Timestamp, sca_Type, sca_Summary, sca_Details, sca_CreatedBy`. Activity types already written: `order.placed`, `coupon.used`, `subscription.started` / `subscription.unsubscribed` / `subscription.cleaned`, `campaign.received`, `comm.campaign`, `status.changed`, `type.changed`, `contact.email`, `task.created`. Per-contact coupon usage already captured.
- **`AdminContactsView` exists** (1446 lines HTML + 688 lines `WebAppContacts.js`): search, contact detail with chronological timeline, `WebAppContacts_logActivity`, `WebAppContacts_sendEmail` (uses `GmailApp` + auto-logs `contact.email`), update notes/tags, create-task-for-contact.

What Half 2 adds: manager access, three-channel buttons (WhatsApp + phone are new; email exists), structured action-panel shape (channel + direction + drafted message + task-done toggle), templates per topic/channel/language, and a mobile-friendly view.

### Conceptual model — two records, linked by contact email

- **Task (`SysTasks`, type `task.contact.outreach`)** — open obligation. Created by triggers. Surfaced on the manager dashboard via the assignment-as-gate filter (@100). One task type for all CRM topics; the "why" lives in `st_Topic`, not the type taxonomy. Manager does **not** create tasks from the contact view.
- **Activity row (`SysContactActivity`)** — immutable history fact. One contact attempt = one row. A single task can span many activity rows over multi-touch follow-up.

Pipedrive unifies these into one record. We keep them separate because `SysTasks` is the cross-area manager work queue (sync, packing, system); inserting CRM items there is consistent with the existing dashboard surface.

### Triggers (v1: welcome only)

- **First `completed`-status order from a new customer** → create one `task.contact.outreach` row, `st_Topic = "Welcome — first order"`, `st_AssignedTo = 'Manager'`, `st_StartDate = today`, `st_DueDate = today + 4 days`. Fires once per customer; later status changes don't re-fire. Task auto-routes to project `PROJ-SYS_CRM` via `task.routing.topic_to_project` (Contact → PROJ-SYS_CRM mapping) so admin sees it in the CRM project view.
- **No activity row pre-created.** Activity rows are written only when actual contact happens.

Future triggers (cooling 91–180d, VIP recognition, win-back) ship as new topics on the same task type — no new task definitions, no new dashboard plumbing.

### Manager dashboard integration

Outreach tasks surface on the manager dashboard task list like any other manager-assigned task. The task detail panel renders a dedicated contact-info block when `task.typeId` starts with `task.contact.` — shows name, email, phone, language — plus an **"Open contact"** button that deep-links into ManagerContactView with the contact pre-loaded.

Backend (`WebAppDashboardV2.getManagerData`) enriches `task.contact.*` rows with `entityPhone` and `entityLanguage` via `ContactService.getContactByEmail`. The deep-link uses `sessionStorage.setItem('selectContactEmail', email)` followed by `loadView('ManagerContacts')`; ManagerContactView reads + clears the key on mount and opens the contact directly.

The task detail expansion now uses `scrollIntoView` so the panel never ends up below the viewport.

### Manager Contact View (new view — `ManagerContactView`)

New lean mobile-first view (not an extension of `AdminContactsView`). Manager's CRM surface is intentionally smaller than the admin view: just contacts and their activity, with a way to act. Reuses `WebAppContacts_*` backend.

**In scope (v1):**
- **Search** by name / email / phone. All contacts (manager knows them; shop walk-ins convert to online customers).
- **Contact detail:** name, language, phone(s), email, order count, last order date, lifecycle status.
- **Chronological activity timeline** rendered from `SysContactActivity` directly (orders + coupons + campaigns + comms + status changes already aggregate there).
- **Open tasks indicator** — if an open `task.contact.outreach` exists for this contact, surface inline; tapping links back to the manager dashboard task.
- **"New contact attempt"** button → Action Panel.

**Out of scope (admin-only — stays in `AdminContactsView`):**
- Refresh-Mailchimp button, segment exports, bulk operations
- Notes / tags editing (revisit if the partner asks for it)
- Create-task-for-contact (per earlier decision: manager doesn't create tasks from the contact view)
- Send-email-as-admin path that already exists (manager's send path is the Action Panel, not the admin send button)

### Action Panel (activity-record-drives-action)

The activity record is drafted first, then drives the channel launch.

Fields:
- **Channel** — WhatsApp / Email / Phone
- **Direction** — Outbound / Inbound (manager logs inbound when customer reached out first)
- **Message text** — Outbound WhatsApp/Email pre-fills from template keyed by `topic + channel + language` (language = `sc_Language` on contact). Manager edits before sending. Phone and Inbound use the field as a free-form note.
- **"Mark related task done?"** toggle — default OFF; visible only when an open task exists for this contact.

Per-channel behavior on submit:

| Channel | Activity type | Launch | Send model |
|---|---|---|---|
| WhatsApp | `comm.whatsapp` | `wa.me/<phone>?text=<encoded msg>` | Native app open; manager taps send |
| Email | `comm.email` | `GmailApp.sendEmail()` | Server-side from accounts@ |
| Phone | `comm.phone` | `tel:+<phone>` (no-op on desktop; number shown) | Manager dials |

`SysContactActivity` row is written before the channel launches. If "mark task done" is ON, the linked task transitions to Done.

**No outcome capture.** The activity row records the fact of contact; subsequent orders in the same timeline are the real result.

### Templates

Stored in config under `crm.template.{topic}.{channel}.{language}`. v1 set:
- `crm.template.welcome.whatsapp.en` / `.he` — one-liner
- `crm.template.welcome.email.en` / `.he` — subject + 2–3 sentence body
- Phone has no template; note field captures what was said

Language comes from `sc_Language` on the contact row. Editable in `otherSettings.json` (edit-source-not-generated).

### Edge cases

- **No WhatsApp phone (`sc_WhatsAppPhone` empty)** — WhatsApp button visually disabled; Email + Phone available.
- **No language set on contact** — fall back to EN template; manager can edit.
- **Inbound direction** — skip template, free-form note; activity row tagged `comm.{channel}` + direction noted in `sca_Details`.

### Manager Dashboard — mobile pass (parallel)

The manager is phone-first across the board. The existing dashboard list view (post-@100) needs a responsive CSS pass — column collapse / card layout / larger tap targets — but no logic change. Ship independently of the contact view.

### Explicit deferrals

- **Snooze / per-task follow-up date** — v1: "follow up later" = leave the task open; manager re-prioritizes daily from the dashboard. Revisit if volume justifies (would add `st_SnoozeUntil` + dashboard filter).
- **Outcome reporting** — no outcome radio; orders are the result. Add a structured outcome field later if reply-rate reporting becomes valuable.
- **Email-reply / WhatsApp-inbound auto-capture** — Pipedrive's Email Sync is paid-tier; manual inbound logging for now. IMAP polling or forward-into-system rules a much larger build.
- **Per-contact follow-up frequency** (Pipedrive feature) — not relevant to JLM outreach patterns.
- **Custom activity types via UI** — code-defined for now.

### Build order

1. Welcome trigger writes `task.contact.outreach` row on first `completed`-status order detection
2. Templates land in config (4 entries — 2 channels × 2 languages; phone has no template)
3. Manager Contact View — new `ManagerContactView` (lean mobile-first; not an `AdminContactsView` extension)
4. Action Panel — channel buttons, template render, activity-row write, task-done toggle, channel launch
5. Manager dashboard mobile CSS pass — parallel; ships independently

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

Updated: 2026-05-05 — Half 1 purpose narrowed. With theme v1.0.91/v1.0.92 the website is authoritative for language at signup (footer + checkout both POST direct to MC with correct language interest from page language). Pull's job collapses to: external-signup detection, `sc_IsSubscribed` freshness, campaign metrics. Language sync logic simplified (set on prospect creation only, never touch existing rows). No-language admin UX dropped. On-demand "Refresh Mailchimp Now" button elevated as the operationally-meaningful trigger; daily run is the safety net.

Updated: 2026-05-14 — Half 2 reshaped from single trigger-driven "Follow-Ups" screen to a Manager CRM surface (search → contact → activity-record-drives-action). Discovery confirmed `SysContactActivity` is alive and `AdminContactsView` already covers most of the data layer. Pipedrive pattern reviewed; we keep tasks and activity rows separate (vs Pipedrive's unified record). Decisions captured: one `task.contact.outreach` type for all CRM triggers, topic-driven message templates per channel + language from `sc_Language`, no outcome radio (orders are the result), no v1 snooze, no auto-pre-created activity row, manager access = all contacts, parallel mobile pass on manager dashboard.
