# Strategic Plan: JLM Wines Digital Dominance

A 10,000-foot view of how operations, CRM, marketing, and AI fit together to dominate online wine sales in Israel.

---

## Vision

**Personalized wine discovery at scale** - Every customer gets recommendations that match their palate, delivered through the right channel at the right time, powered by data and AI.

---

## The Four Pillars

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER EXPERIENCE                          │
│         (Website, Email, WhatsApp, Personalized Recommendations)     │
└─────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                           MARKETING ENGINE                           │
│              (Campaigns, Coupons, Segmentation, Content)             │
└─────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                          INTELLIGENCE LAYER                          │
│           (CRM, Preferences, Predictions, Recommendations)           │
└─────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│                          OPERATIONS FOUNDATION                       │
│        (Products, Orders, Inventory, Sync, Tasks, Validation)        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Current State Assessment

### Operations Foundation - 70% Complete
| Component | Status | Gap |
|-----------|--------|-----|
| Product sync (Comax + WooCommerce) | Working | Validation UI incomplete |
| Order sync | Working | Sync widget needs consolidation |
| Inventory management | Working | - |
| Packing slips | Working | Reprint logic could improve |
| Task system | Data exists | No cohesive UI |
| Project management | Data exists | No cohesive UI |
| Product images | Not started | No system at all |
| Bundle management | Partial | UI incomplete |
| Product metadata (wineries, grapes, kashrut) | Manual | No admin UI to add new values |
| Region system | Working | Needs transition plan (current system unclear) |
| Texts lookup | Working | Random/inefficient - needs examination |

### Intelligence Layer - 40% Complete
| Component | Status | Gap |
|-----------|--------|-----|
| Contact data (SysContacts) | Working | Classification bugs |
| Preference enrichment | Working (overnight) | - |
| Activity tracking | Working | - |
| Lifecycle/churn prediction | Basic | Needs refinement |
| Contact UI | Not started | Major gap |
| Recommendation engine | Not started | Major gap |

### Marketing Engine - 10% Complete
| Component | Status | Gap |
|-----------|--------|-----|
| Mailchimp integration | Manual CSV | No UI, no API |
| Coupon management | Manual | No service, no UI |
| Campaign tracking | Manual import | No UI |
| Segmentation | In Mailchimp only | Not in JLMops |
| Content management | None | Not planned |

### Customer Experience - External
| Component | Status | Gap |
|-----------|--------|-----|
| WooCommerce website | Working | Exit popup, other improvements |
| Product SEO text | Needs research | Enriched text may have redundancy affecting SEO |
| Personalized recommendations | None | Future |
| WhatsApp engagement | Manual | No integration |

---

## Strategic Priorities

### Immediate (Next Deploy)
**Goal:** Stable operations, clean foundation

1. Complete current sync fixes
2. Remove dev code clutter
3. Verify housekeeping runs correctly
4. Dashboard polish

### Short-Term (Q1)
**Goal:** Marketing capability

1. **Campaigns Screen** - Unified admin view for:
   - Mailchimp subscriber import status
   - Campaign import status
   - Coupon management (view, import, status)
   - Manual refresh triggers

2. **CRM Contact UI** - Basic contact list view:
   - Search/filter contacts
   - View contact details and history
   - Manual notes/tags

3. **API Investigation** - Evaluate:
   - WooCommerce API for orders/coupons
   - Mailchimp API for subscribers/campaigns
   - Decision: API vs CSV going forward

4. **Product Data Management** - Admin tools for:
   - Adding new wineries, grapes, kashrut values
   - Region system transition planning
   - Texts lookup efficiency review

5. **Website SEO Audit** - Research:
   - Enriched product text redundancy
   - Impact on search rankings
   - Optimization opportunities

### Mid-Term (Q2-Q3)
**Goal:** Intelligence-driven marketing

1. **Project/Task UI Refinement** - Cohesive management:
   - Project board view
   - Task list with filtering
   - Link tasks to projects

2. **CRM Bug Fixes** - Classification accuracy:
   - Fix gift detection
   - Fix war-support detection
   - Data correction script

3. **Recommendation Engine** - Basic version:
   - Match customer preferences to products
   - Surface recommendations in contact detail
   - Export recommendations for campaigns

4. **Product Validation UI** - Admin tools:
   - View validation results
   - Approve/reject changes
   - Quarantine management

### Long-Term (Q4+)
**Goal:** AI-powered personalization

1. **AI Integration** - Claude API for:
   - Natural language queries ("show me customers who like bold reds")
   - Content generation for campaigns
   - Personalized recommendation explanations

2. **Product Image Management** - Full system:
   - Image upload/organization
   - Auto-resize for web
   - Gallery management

3. **WhatsApp Integration** - Business messaging:
   - Pre-filled templates
   - Conversation logging
   - Follow-up scheduling

4. **Year in Wine** - Personalized annual summary:
   - Customer wine journey
   - Preference evolution
   - Personalized recommendations

---

## Information Architecture

### Admin Views (Current + Planned)

```
Dashboard (v2)
├── System Health
├── Orders Summary
├── Inventory Alerts
└── Tasks Due

Sync
└── Daily Sync Widget

Orders
├── Packing Slips
├── Open Orders
└── Order History (future)

Products
├── Product List
├── Bundles (future)
├── Validation (future)
└── Images (future)

Inventory
├── Counts
├── Brurya Sync
└── Adjustments

Projects (future)
├── Project Board
├── Task List
└── Calendar View

Contacts (future)
├── Contact List
├── Contact Detail
└── Activity Timeline

Campaigns (future)
├── Import Status
├── Campaign List
├── Coupon Manager
└── Segment Builder

Settings
├── System Config
└── User Management
```

### Data Flow Vision

```
                    WooCommerce
                    (Orders, Products, Coupons)
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
         Orders      Products      Coupons
            │            │            │
            ▼            ▼            ▼
    ┌───────────────────────────────────────┐
    │           JLMops Data Layer            │
    │  (WebOrdM, CmxProdM, SysCoupons, etc.) │
    └───────────────────────────────────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
       SysContacts   Preferences   Activities
            │            │            │
            └────────────┼────────────┘
                         ▼
    ┌───────────────────────────────────────┐
    │         Intelligence Engine            │
    │  (Segments, Predictions, Recommendations)│
    └───────────────────────────────────────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
        Mailchimp    WhatsApp     Website
        Campaigns    Outreach    Personalization
```

---

## Success Metrics

### Operations
- Daily sync completes without manual intervention
- Packing slips printed same-day
- Zero data sync errors per week

### CRM
- 100% contacts enriched with preferences
- Classification accuracy >95%
- Activity coverage for all customer interactions

### Marketing
- Campaign ROI tracking
- Coupon effectiveness measurement
- Segment performance comparison

### Business
- Repeat customer rate
- Average order value growth
- Customer lifetime value
- Time from subscriber to first order

---

## Key Decisions Needed

1. **API vs CSV**: Invest in WooCommerce/Mailchimp API integration, or optimize CSV workflow?
   - API: Real-time data, automation potential, development cost
   - CSV: Working now, manual but familiar, no API limits

2. **UI Framework**: Current Bootstrap-in-GAS pattern vs modern frontend?
   - Current: Works, no build process, limited interactivity
   - Modern: Better UX, significant rebuild, deployment complexity

3. **AI Scope**: Where does AI add most value first?
   - Recommendations (high impact, complex)
   - Content generation (medium impact, simpler)
   - Query interface (high convenience, moderate complexity)

---

## Next Actions

1. Complete immediate deploy prep (sync fixes, cleanup)
2. User continues Year in Wine marketing - capture learnings
3. Design Campaigns Screen wireframe
4. Prioritize CRM Contact UI vs Campaigns Screen

---

Updated: 2025-12-29 (added product metadata, region system, texts lookup, SEO audit)
