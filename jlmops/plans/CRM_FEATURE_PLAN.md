# CRM Feature Plan

## Overview

Add CRM capabilities to jlmops for customer follow-up and behavior-based contact management.

## Goals

1. Follow up with customers after orders are completed
2. Contact customers based on behavior patterns (repeat, lapsed, new)
3. Create actionable tasks for manager to track outreach and results

---

## Data Sources

### WooCommerce Customers
- Imported to jlmops via existing order sync
- Unique identifier: email address
- Contains: order history, language, shipping info, order dates

### Mailchimp Contacts
- Currently standalone
- Can export contact list and import to sheet
- Overlaps with customers but not 1:1

---

## Proposed Architecture

### 1. Unified Contact List (New Sheet: `Contacts` or `Audience`)

**Core Fields:**
| Field | Description |
|-------|-------------|
| Email | Primary key, dedupe on this |
| Name | From order or Mailchimp |
| Is Customer | Y/N - has WooCommerce orders |
| Is Mailchimp | Y/N - exists in Mailchimp list |
| Language | From order data (EN/JA/etc) |
| First Order Date | Earliest order |
| Last Order Date | Most recent order |
| Total Orders | Count |
| Total Spend | Sum of order values |
| Customer Status | Derived: New / Repeat / Lapsed / Prospect |
| Notes | Manager notes |

**Customer Status Logic:**
- **Prospect**: In Mailchimp but no orders
- **New**: 1 order only
- **Repeat**: 2+ orders
- **Lapsed**: No order in X months (TBD)

### 2. CRM Tasks Sheet

**Fields:**
| Field | Description |
|-------|-------------|
| Task ID | Auto-generated |
| Created Date | When task was generated |
| Due Date | Suggested contact date |
| Email | Link to contact |
| Customer Name | For quick reference |
| Task Type | Follow-up / Win-back / Welcome / Custom |
| Trigger | What generated this task |
| Status | Pending / Completed / Skipped |
| Completed Date | When marked done |
| Outcome | Manager notes on result |
| Assigned To | Manager / Mailchimp / Other |

### 3. Task Generation Rules

Automated rules that create tasks:

| Trigger | Task Type | Timing | Notes |
|---------|-----------|--------|-------|
| Order completed | Follow-up | X days after | "How was your order?" |
| First order completed | Welcome | X days after | New customer welcome |
| No order in X months | Win-back | Immediate | Lapsed customer outreach |
| Custom query | Custom | Manual | Manager-defined segments |

---

## Implementation Steps

### Phase 1: Foundation
1. Create Contacts sheet with schema
2. Build sync function to populate from Orders data
3. Build import mechanism for Mailchimp export
4. Implement deduplication by email
5. Calculate derived fields (status, totals, dates)

### Phase 2: Task System
1. Create CRM Tasks sheet
2. Build task generation engine
3. Implement rule-based triggers
4. Create manager UI (sidebar or menu) for task management
5. Add task completion workflow

### Phase 3: Automation
1. Schedule daily/weekly task generation
2. Add notifications for new tasks
3. Build reporting on task completion rates

---

## Open Questions

### Timing & Thresholds

1. **Lapsed definition**: How many months without an order = lapsed?
   - Suggestion: 90 days (3 months)?

2. **Follow-up timing**: Days after order completion for follow-up task?
   - Suggestion: 7-14 days?

3. **Follow-up scope**: Every completed order, or conditions?
   - Every order
   - First order only
   - First order + every Nth order
   - Only orders over certain value

### Task Handling

4. **Additional triggers**: Beyond follow-up, welcome, win-back - others?
   - High-value customer recognition?
   - Birthday/anniversary?
   - Product-specific follow-up?

5. **Task location**: New sheet in jlmops workbook, or separate?

6. **Mailchimp-only contacts**: Any specific handling?
   - Just flag as "prospect"?
   - Ignore until they order?
   - Specific outreach tasks?

### Technical

7. **Mailchimp import frequency**: One-time manual, or periodic sync?

8. **Language detection**: Is language reliably in order data, or needs inference?

9. **Historical data**: Process all past orders, or start fresh from implementation date?

---

## Dependencies

- Existing order data in jlmops
- Mailchimp export capability
- Manager workflow for task handling

---

## Notes

*Section for additional details as they emerge*

---

## Status

- [ ] Questions answered
- [ ] Plan approved
- [ ] Phase 1 implementation
- [ ] Phase 2 implementation
- [ ] Phase 3 implementation
