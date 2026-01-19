# Master Plan

Current priorities and work streams. Updated: 2025-12-29

---

## Current Situation

- **Production deploy:** Stable, partner using it daily
- **Local codebase:** Has changes not yet deployed (sync fixes, CRM, optimizations)
- **Tech debt:** Accumulated dev code, one-time migrations, untested paths

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
