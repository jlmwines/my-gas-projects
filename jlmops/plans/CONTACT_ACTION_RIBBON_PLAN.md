# Contact Action Ribbon — unified "Make contact" + record model

**Status:** PLAN (not implemented). Designed 2026-05-29 in a chavruta session that surfaced while doing UI T5.1 (AdminContacts Bootstrap-modal cleanup). Capture-before-build so we don't lose the shape.

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

## Nav context (FINAL — live as of @184)

- Admin nav: **single "Contacts" link** → `AdminContacts` (the CRM/contacts view). The short-lived second entry ("Contact Lookup" → ManagerContacts) was **removed** per user — admin gets one contacts link, named consistently with the manager nav.
- Manager nav: **"Contacts"** → `ManagerContacts` (unchanged).
- `ManagerContactView` is no longer in the admin nav but stays reachable for admins via **dashboard task deep-links** (`loadView('ManagerContacts')` + `sessionStorage.selectContactEmail`) — outreach tasks still open the outreach tool directly. That's fine/desired.
- Admin keeps the same activity-recording access as the manager **inside AdminContactsView** (its action ribbon), per user — no harm, and otherwise the CRM screen has little to act on.

## Relationship to other work

- **Builds on UI T5.1** (AdminContacts Bootstrap modals → modal-overlay via ModalOverlay). T5.1 is the structural prerequisite (no Bootstrap, project modal pattern, shared helper).
- Touches the same surfaces as `CONTACT_MANAGER_PLAN.md` (CRM action layer) — cross-reference when implementing.

## Rough implementation outline (when greenlit)

1. Define the contact-pack shape + where it lives (decision #1).
2. Build the unified ribbon + single modal (record icons pre-select type; "Make contact" distinct, first) — start in one view.
3. Wire "Make contact" to `logContactAttempt` + `getOutreachTemplate` with the pack; mark-task-done.
4. Task mode: pass the task's pack; disable record icons.
5. Adopt in both views (or per decision #4); retire AdminContacts' separate Compose Email / Log Activity modals.
6. Smoke: welcome-task send (email/WhatsApp/voice), standalone record (each type, both directions), task-done closure, mobile + desktop.
