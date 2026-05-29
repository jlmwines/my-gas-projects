# Contact Action Ribbon — unified "Make contact" + record model

**Status:** **PHASE 1 SHIPPED 2026-05-29 (@187 deploy @191).** ManagerContactView: single "+ New contact attempt" button → ribbon = distinct green **✆ Make contact** (outbound-only send via `logContactAttempt`; Direction radios removed) + record icons **📞 💬 📧 📝** → new record modal → `logActivity` (log only, no send; in/out for channels, none for note). SMS skipped per user. User-confirmed. **Phase 2 (task packs) still pending** — see below. Designed 2026-05-29 in a chavruta session that surfaced while doing UI T5.1.

## Why this exists (the rough spot)

While converting AdminContactsView's modals (T5.1) we hit a structural question, not just a styling one:

- There are **two contact surfaces** that overlap: ManagerContactView (single-contact lookup + outreach, mobile-first) and AdminContactsView (CRM list/console + per-contact detail with an emoji action ribbon).
- The **admin doesn't actually contact customers** — outreach is a manager/staff job — yet the admin view carried the outreach actions, and the admin's "Contacts" nav even pointed at the manager view (fixed live; see Nav below).
- The two views model the same action **differently**: the manager view has ONE smart modal (`logContactAttempt`) that both *sends* and *records*; the admin view splits it into separate, dumber modals (Compose Email = generate, Log Activity = record), neither wired to templates or tasks.
- The conceptual muddle: "six channel icons that each secretly send-and-record." Only one thing actually **transmits** (send email / launch WhatsApp / dial); everything else is **bookkeeping**.

## The model (decided)

**One modal, two modes, driven by a "pack"** (same idea as the task-system `pack_form` packs).

### The ribbon = record icons + one distinct "Make contact" action

- **Record icons** — one per form of communication plus a note: 📞 Call, 💬 WhatsApp, 📧 Email, 📱 SMS, 📝 Note. Tapping one opens the log flow with **that activity type pre-selected** (maps to existing `contact.call` / `contact.whatsapp` / `contact.email` / `contact.sms` / `note.general`). Pure journaling of something that already happened, **either direction** (inbound/outbound). No template, no send.
- **"Make contact"** — a **visually distinct** entry (styled as a button, not a bare emoji), placed **first** in the row, that clearly *causes an action* (it transmits). Opens the send-capable modal: template preloaded, server-sends email / launches WhatsApp / dials, logs the activity, and marks the linked task done. Channel(s) come from the task pack.

### Two invocation modes (the "pack")

The caller hands the modal a **contact pack** describing what to offer:

1. **Opened from an outreach task** (e.g. welcome follow-up): pack = the task's relevant channels (welcome → email / WhatsApp / voice), preloaded template (email + WhatsApp have one; voice does not — just dial + record), direction = outbound, mark-this-task-done on completion. **The record icons grey out** in this mode — you're here to execute the task, not journal random activity. "Make contact" is the action.
2. **Opened standalone** from the contact screen: full ribbon. Record icons all available (any type, either direction) + Note. "Make contact" still present (generic outbound) for ad-hoc outreach.

### Channel notes

- **Voice** = a channel in a pack with **no template** (dial + record).
- **SMS** stays an icon in the standalone/record set but is **not** in the welcome pack and may go unused (we likely don't SMS customers). Keep it; don't rip it out.
- **Note** = record-only (it isn't "contacting" anyone), standalone mode only.
- **Make contact** is a single entry; channel is chosen inside the modal (or fixed by the task pack), NOT three separate send-icons.

## What already exists (reuse map — keeps the build small)

- **Send engine:** `WebAppContacts_logContactAttempt({email, channel, direction, message, subject, taskId, markTaskDone})` already sends email server-side, returns `whatsappUrl`/`telUrl` for client launch, writes the activity row, and closes the task. This IS the "Make contact" backend.
- **Template load:** `WebAppContacts_getOutreachTemplate(topicKey, channel, language)` pulls subject/body (welcome templates live in SysLibrary post content-library migration). ManagerContactView's `loadTemplate()` already keys off the open task's topic.
- **Open-task awareness:** ManagerContactView already stores `state.openTask` and shows a "Mark related task done" toggle only when a task is open.
- **Record-icon presets:** AdminContactsView's ribbon already pre-selects the activity type via `data-type` handlers ("click 📞 → Log Activity with Phone Call selected"). That's the record-icon behavior already working.
- **Modal mechanics:** shared `ModalOverlay` helper (TaskWidgets) — focus-trap / Esc / scroll-lock / restore. Both views include TaskWidgets.

**Net new work = composition, not invention:** one shared ribbon + modal; give "Make contact" distinct styling + wire it to the send engine with a pack; disable record icons in task mode; fold the admin view's separate Compose Email / Log Activity modals onto the unified one.

## Open decisions (settle before building)

1. **Where the pack is defined.** Lean **task definitions** (a field on the outreach task type, consistent with the existing `pack_form` pattern, extensible) vs a small **topic→pack map in code** (simpler if outreach task types stay few). Recommendation: task definitions.
2. **"Make contact" presence:** keep it **always** in the ribbon (generic outbound when no task; task-pack-loaded when a task is open) — recommended — vs only-when-a-task-exists.
3. **Make-contact visual treatment:** button vs filled-color icon; confirm "first in the row."
4. **Scope of unification:** do both ManagerContactView and AdminContactsView adopt the one ribbon/modal, or does the manager view stay as-is and only the admin view gain it? (The cleaner end-state is one shared component used by both.)

## Nav context (FINAL — live as of @185 deploy @189)

- **Both** admin and manager "Contacts" → `ManagerContacts` (`ManagerContactView`, the modern single-contact view). Identical label + target across roles.
- **`AdminContactsView` is the OLD CRM list/console — out of the nav now**, per user ("the old CRM interface, not the correct endpoint"). It still exists in viewMap (reachable directly / via task deep-links) but is **superseded** by the single-contact view + this ribbon plan. Treat it as legacy; likely retire later.
- Implication: **this plan targets `ManagerContactView`** as THE contacts surface. The ribbon (record icons + "Make contact") replaces its single "+ New contact attempt" button there. The admin no longer has a separate CRM console in nav — so any genuinely admin-only CRM management (bulk segments, Mailchimp refresh, stats) needs a future home if still wanted (open question — it lived only in the now-delisted AdminContactsView).
- Note: UI T5.1 cleaned AdminContactsView's modals just before it was delisted — sunk effort, harmless (view not deleted).

## Relationship to other work

- **Builds on UI T5.1** (AdminContacts Bootstrap modals → modal-overlay via ModalOverlay). T5.1 is the structural prerequisite (no Bootstrap, project modal pattern, shared helper).
- Touches the same surfaces as `CONTACT_MANAGER_PLAN.md` (CRM action layer) — cross-reference when implementing.

## Rough implementation outline

1. ~~Build the ribbon + record modal in ManagerContactView~~ — **DONE Phase 1 (@187 deploy @191):** ribbon (Make contact + 📞/💬/📧/📝), record icons → `logActivity`, Make contact outbound-only via `logContactAttempt` (+ existing `getOutreachTemplate` topic preload, mark-task-done). `.mc-rec-disabled` CSS hook in place.
2. **Phase 2 — task packs (NEXT):** define the pack shape + where it lives (decision #1 below — lean task definitions). When opened from an outreach task: restrict Make contact's channels to the pack, preload the template, **disable the record icons** (apply `.mc-rec-disabled`), mark-done on send.
3. Decide #4 (does AdminContactsView adopt the ribbon, or stay legacy/out-of-nav — currently delisted). If kept, retire its separate Compose Email / Log Activity modals.
4. Smoke Phase 2: welcome-task send (email/WhatsApp/voice), record disabled in task mode, standalone record still full.

(Phase 2 open decisions: see the "Open decisions" section above — pack location, Make-contact presence, visual treatment, AdminContactsView adoption.)
