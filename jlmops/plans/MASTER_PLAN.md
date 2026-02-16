# Master Plan

Current priorities and work streams. Updated: 2026-02-16

---

## Current Situation

- **Production deploy:** Stable, partner using it daily
- **Local codebase:** Has changes not yet deployed (sync fixes, CRM, optimizations)
- **Tech debt:** Accumulated dev code, one-time migrations, untested paths

---

## Session Notes (2026-02-16)

### Sync Widget Poll/Action Race Condition — Fixed

**Problem:** Every sync button click showed spinner briefly, then reverted to button. Clicking again showed "Previous action still running..." — backend was working correctly but UI didn't reflect it. Root cause: `google.script.run` callbacks from already-in-flight polls overwrote the spinner with a button. Additionally, long operations (Import Comax) showed no progress — polling was completely blocked during actions.

**Fix (AdminDailySyncWidget_v2.html only, no backend changes):**

1. **Removed `actionInProgress` from poll guard** — polls now continue during actions, providing live step card and message updates
2. **Action-aware poll callback** — during actions, poll callbacks update step cards, message, footer, and progress log but NEVER touch `#sharedAction` (the button/spinner area). This eliminates the race.
3. **Step messages now displayed** — `updateStepCard` shows backend messages like "Products and translations imported" in each card
4. **Richer progress log** — action completion shows export filenames and order counts instead of generic "done"
5. **Removed dead `lastActionTime` variable** — set in 4 places, never read

**Status:** Pushed to Apps Script. Needs testing (see verification steps in plan transcript).

**Testing checklist:**
- [ ] Race condition: click button, spinner stays, button doesn't reappear until backend returns
- [ ] Progress: during Import Comax, step cards update live, message changes between stages
- [ ] Export filename shows in progress log after Generate
- [ ] Step messages visible in cards after completion
- [ ] Double-click blocked correctly
- [ ] Error recovery works (error displayed, Retry works, polling resumes)

---

## Active Work Streams

### Stream 1: Year-End Marketing (User)

**Goal:** Get year-end marketing distributed via Mailchimp

**Activities:**
- Mailchimp campaign setup
- WooCommerce coupon creation
- URL shortener for tracking
- Learning what works for future CRM integration

**Capture learnings in:** `jlmops/WISHLIST.md` and `jlmops/BUGS.md`

### Stream 2: System Hardening (Claude)

**Goal:** Prepare stable deploy with reduced tech debt

**Tasks:**
- [ ] Audit and remove one-time dev code/migrations
- [ ] Verify housekeeping phases run correctly
- [ ] Verify schema validation runs
- [ ] Dashboard polish (minor cleanup)
- [ ] Test critical paths work reliably

**Already done:**
- [x] Disabled conflicting new sync widget
- [x] Removed immediate file trashing (files stay for housekeeping)

---

## Deployment Criteria

Before next deploy:
1. All hardening tasks complete
2. No known breaking changes
3. User confirms marketing work complete or paused

---

## Reference Documents

| Topic | File |
|-------|------|
| Bugs | `jlmops/BUGS.md` |
| Wishlist | `jlmops/WISHLIST.md` |
| CRM details | `jlmops/plans/CRM_PLAN.md` |
| Architecture | `jlmops/plans/ARCHITECTURE.md` |
| Data model | `jlmops/plans/DATA_MODEL.md` |
| Optimizations | `jlmops/plans/RESOURCE_OPTIMIZATION_PLAN.md` |
| Future phases | `jlmops/plans/IMPLEMENTATION_PLAN.md` |

---

## After Deploy

Priority areas to tackle:
1. API integration investigation (WooCommerce, Mailchimp)
2. Coupon service/UI
3. Sync system simplification (if APIs prove viable)
4. CRM bug fixes
