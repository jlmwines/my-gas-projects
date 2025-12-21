# CRM Feature Plan

## Overview

Build a contact list and customer relationship management system for JLMwines. Focus on core customers (Israeli residents buying for themselves), mine order and email data to identify patterns, and generate actionable tasks for retention and growth.

---

## Data Analysis Summary (Dec 2025)

### Customer Base (excluding war-related, gift orders)
- **223 core customers** from 864 orders
- 71% single-order, 29% repeat (64 customers)
- ~30% conversion rate from first to repeat order

### Key Patterns

**Language trends:**
- Hebrew customers growing: 24% (2022) → 34% (2025)
- Hebrew = 40% of core customers but only 31% of repeat
- English customers convert to repeat at higher rate

**Location patterns:**
- Jerusalem dominant: 81 customers (36%), 32% repeat rate
- Tel Aviv: 12 customers, only 8% repeat rate (poor retention)
- Smaller cities (Nahariya, Netanya, Haifa) have 67-100% repeat rates

**Order values:**
- Repeat customers: avg 590 ILS, median 461 ILS
- Single customers: avg 534 ILS, median 429 ILS
- Repeat customers spend ~10% more

**Order frequency (repeat customers):**
- Median: 48 days between orders
- 75% reorder within 102 days
- Average: 94 days

**Current customer status:**
| Status | Single | Repeat | Action |
|--------|--------|--------|--------|
| Active (0-30 days) | 5 | 15 | Maintain |
| Recent (31-90 days) | 2 | 5 | Monitor |
| Cooling (91-180 days) | 6 | 9 | Re-engage NOW |
| Lapsed (181-365 days) | 19 | 10 | Win-back |
| Dormant (365+ days) | 127 | 25 | Long-shot |

### Mailchimp Analysis
- 632 subscribers total (54% English, 38% Hebrew)
- 143 core customers in Mailchimp (23%)
- 80 core customers NOT in Mailchimp (36%) ← capture opportunity
- 489 subscribers never ordered

**Subscription timing:**
- 40 subscribed before ordering (newsletter conversion)
- 97 subscribed at checkout
- Newsletter-to-customer conversion ~8%

**Engagement scores (MEMBER_RATING):**
- Almost everyone is rating 2 - not predictive of purchases
- Rating doesn't correlate with customer status

---

## Thresholds (Data-Driven)

Based on median 48-day reorder interval:

| Status | Days Since Last Order | Rationale |
|--------|----------------------|-----------|
| Active | 0-30 | Within typical reorder window |
| Recent | 31-90 | Still engaged, approaching reorder |
| Cooling | 91-180 | Past typical interval, needs nudge |
| Lapsed | 181-365 | Significantly overdue |
| Dormant | 365+ | Unlikely to return without intervention |

---

## Customer Types

### Core Customers (Israeli residents, self-purchase)
- **New**: 1 order only
- **Repeat**: 2+ orders
- **Active Repeat**: Repeat + ordered within 90 days
- **Cooling Repeat**: Repeat + 91-180 days since order
- **Lapsed Repeat**: Repeat + 181-365 days since order

### Non-Core
- **Gift Purchaser**: Different billing/shipping name or foreign billing
- **War-Support**: Used community support coupons (efrat, roshtzurim, gushwarriors)

### Prospects
- **Subscriber**: In Mailchimp, never ordered
- **Recent Subscriber**: Subscribed <90 days ago
- **Stale Subscriber**: Subscribed 365+ days, never ordered

---

## Contact List Schema (SysContacts)

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| sc_Email | string | Orders/MC | Primary key |
| sc_Name | string | Orders/MC | Customer name |
| sc_Phone | string | Orders | Contact phone |
| sc_Language | string | Orders/MC | EN or HE |
| sc_City | string | Orders | Shipping city (normalized) |
| sc_IsCustomer | boolean | Calc | Has placed orders |
| sc_IsCore | boolean | Calc | Core customer (not gift/war) |
| sc_IsSubscribed | boolean | MC | In Mailchimp list |
| sc_CustomerType | string | Calc | See types above |
| sc_FirstOrderDate | date | Orders | Earliest order |
| sc_LastOrderDate | date | Orders | Most recent order |
| sc_DaysSinceOrder | number | Calc | Updated daily |
| sc_OrderCount | number | Orders | Total orders |
| sc_TotalSpend | number | Orders | Sum of order values |
| sc_AvgOrderValue | number | Calc | Average order |
| sc_SubscribedDate | date | MC | When joined Mailchimp |
| sc_DaysSubscribed | number | Calc | Updated daily |
| sc_Notes | string | Manual | Manager notes |
| sc_LastUpdated | date | System | Last refresh |

---

## Task Types

| Task Type | Trigger | Priority | Assignee |
|-----------|---------|----------|----------|
| task.crm.cooling_repeat | Repeat customer 91-180 days | High | Manager |
| task.crm.lapsed_repeat | Repeat customer 181-365 days | Normal | Manager |
| task.crm.lapsed_new | Single customer 181-365 days | Normal | Manager |
| task.crm.welcome | New customer 14 days after order | Normal | Manager |
| task.crm.convert_subscriber | Subscriber 90+ days, no order | Low | Mailchimp |
| task.crm.mailchimp_update | Weekly reminder | Normal | Manager |

---

## Implementation Phases

### Phase 1: Contact List Foundation
1. Create SysContacts sheet schema
2. Build ContactService.js
3. Populate from order history (all historical data)
4. Import Mailchimp audience
5. Deduplicate by email
6. Calculate derived fields
7. Normalize city names

### Phase 2: Daily Statistics Update
1. Add contact refresh to housekeeping
2. Calculate DaysSinceOrder, CustomerType
3. Flag status changes

### Phase 3: Task Generation
1. Add CRM task types to taskDefinitions.json
2. Create CRM project (long-term operational)
3. Add task generation rules to housekeeping
4. Deduplication - don't create duplicate tasks

### Phase 4: Manager Interface
1. Contact list view with filters
2. Contact detail with order history
3. Action buttons (phone, email)
4. Task workflow integration

### Phase 5: Mailchimp Integration
1. Segment export (lapsed, prospects, etc.)
2. CSV formatted for Mailchimp import
3. Track exported contacts

---

## Key Insights for Strategy

1. **Focus on Hebrew customers** - growing segment, lower repeat rate, opportunity to improve
2. **Jerusalem is the core market** - 36% of customers, good repeat rate
3. **Tel Aviv needs attention** - low repeat rate despite presence
4. **Small city loyalty** - customers in smaller cities are more loyal
5. **Email signups at checkout** - most subscriptions happen at purchase, not from marketing
6. **Mailchimp engagement scores not useful** - don't rely on MEMBER_RATING for targeting
7. **36% of customers not subscribed** - opportunity to capture more emails

---

## Status

- [x] Data analysis complete
- [x] Thresholds defined
- [x] Schema finalized (SysContacts)
- [x] Phase 1: Contact list populated (~630 contacts from orders + Mailchimp)
- [x] Phase 2: Daily refresh in housekeeping (refreshCrmContacts)
- [ ] Phase 3: Task generation rules
- [ ] Phase 4: Manager interface (contact detail views)
- [ ] Phase 5: Mailchimp integration (segment export)

**Data Status (Dec 2025):**
- Orders: ~1,300 (WebOrdM + WebOrdM_Archive)
- Contacts: ~630 in SysContacts
- Activity: 18,788 records in SysContactActivity
- City lookup: SysLkp_Cities seeded and maintained

---

Updated: 2025-12-21
