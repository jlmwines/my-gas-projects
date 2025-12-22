# CRM Plan

Consolidated plan for contact management, preference analysis, and customer engagement.

---

## Vision

Build a customer relationship system that:
1. Maintains a unified contact list from orders and email subscribers
2. Calculates wine preferences from purchase history
3. Segments customers by behavior and lifecycle status
4. Generates actionable insights for targeted campaigns
5. Enables personalized communication via email, WhatsApp, and Mailchimp

---

## Data Architecture

### Core Sheets

| Sheet | Purpose | Key |
|-------|---------|-----|
| SysContacts | Customer master list | sc_Email |
| SysContactActivity | Activity timeline | sca_ActivityId |
| SysCoupons | Coupon reference | sco_Code |
| SysCampaigns | Mailchimp campaign history | scm_CampaignId |
| SysLkp_Cities | City normalization | slc_Code |

### SysContacts Schema (44 fields)

**Identity:**
- sc_Email (PK), sc_Name, sc_Phone, sc_WhatsAppPhone, sc_Language, sc_City, sc_Country

**Classification:**
- sc_CustomerType, sc_LifecycleStatus, sc_IsCore, sc_IsCustomer, sc_IsSubscribed

**Order Metrics:**
- sc_FirstOrderDate, sc_LastOrderDate, sc_DaysSinceOrder
- sc_OrderCount, sc_TotalSpend, sc_AvgOrderValue, sc_AvgBottlesPerOrder

**Subscription:**
- sc_SubscribedDate, sc_DaysSubscribed, sc_SubscriptionSource

**Predictions:**
- sc_NextOrderExpected, sc_ChurnRisk, sc_LastContactDate, sc_LastContactType

**Wine Preferences:**
- sc_FrequentCategories, sc_TopWineries, sc_TopRedGrapes, sc_TopWhiteGrapes
- sc_PriceAvg, sc_PriceMin, sc_PriceMax
- sc_RedIntensityRange, sc_RedComplexityRange
- sc_WhiteComplexityRange, sc_WhiteAcidityRange
- sc_KashrutPrefs, sc_BundleBuyer

**Manual:**
- sc_Tags, sc_Notes, sc_CreatedDate, sc_LastUpdated, sc_LastEnriched

---

## Customer Segmentation

### Customer Types

| Type | Criteria |
|------|----------|
| core.new | Customer with 1 order, buying for self |
| core.repeat | Customer with 2+ orders |
| core.vip | 5+ orders OR >=3000 NIS total spend |
| noncore.gift | All orders shipped to different person |
| noncore.support | All orders used war-support coupons |
| prospect.fresh | Subscriber <30 days, no orders |
| prospect.subscriber | Subscriber 30-179 days, no orders |
| prospect.stale | Subscriber 180+ days, no orders |

### Lifecycle Status (based on days since last order)

| Status | Days | Action |
|--------|------|--------|
| Active | 0-30 | Maintain relationship |
| Recent | 31-90 | Monitor, prepare reorder nudge |
| Cooling | 91-180 | Re-engage NOW |
| Lapsed | 181-365 | Win-back campaign |
| Dormant | 365+ | Long-shot outreach |
| Unknown | No orders | Subscriber only |

### Gift Detection Logic

A customer is classified as `noncore.gift` if ALL their orders are gifts.

**Order is a gift if:**
```javascript
function isGiftOrder(order) {
  const note = (order.customerNote || '').toLowerCase();

  // Delivery keywords suggest customer is directing their OWN delivery = not a gift
  const DELIVERY_KEYWORDS = ['please', 'deliver', 'call', 'phone', 'outside',
                             'floor', 'door', 'gate', 'code', 'buzzer',
                             'leave', 'ring', 'knock', 'entrance', 'building'];
  if (note && DELIVERY_KEYWORDS.some(kw => note.includes(kw))) {
    return false;
  }

  // Different billing/shipping last name = gift
  const billName = (order.billingLastName || '').toLowerCase().trim();
  const shipName = (order.shippingLastName || '').toLowerCase().trim();
  return billName && shipName && billName !== shipName;
}
```

**Note:** Country/city comparison not implemented because WebOrdM lacks billing address fields.

### War-Support Detection Logic

War-support coupons: `efrat`, `roshtzurim`, `gushwarriors`, `gush`, `tekoa`

```javascript
const WAR_SUPPORT_COUPONS = ['efrat', 'roshtzurim', 'gushwarriors', 'gush', 'tekoa'];

function hasWarSupportCoupon(couponItems) {
  const coupons = extractCoupons(couponItems);  // Parse wom_CouponItems field
  return coupons.some(c =>
    WAR_SUPPORT_COUPONS.some(ws => c.code.toLowerCase().includes(ws))
  );
}

// wom_CouponItems format: "code:EFRAT|amount:44.03;code:SHIPFREE|amount:0.00"
function extractCoupons(couponItems) {
  if (!couponItems) return [];
  return String(couponItems).split(';').map(item => {
    const codeMatch = item.match(/code:([^|]+)/);
    const amountMatch = item.match(/amount:([^|;]+)/);
    return codeMatch ? { code: codeMatch[1].trim(), amount: parseFloat(amountMatch?.[1]) || 0 } : null;
  }).filter(Boolean);
}
```

---

## Preference Enrichment

### Data Flow

1. **Contact Import** (ContactImportService) - Creates/updates contacts from order history
2. **Daily Refresh** (ContactService.refreshAllContacts) - Updates days-since, lifecycle status
3. **Preference Enrichment** (ContactEnrichmentService) - Calculates wine preferences from purchase history

### Preference Fields Calculated

| Field | Calculation |
|-------|-------------|
| sc_FrequentCategories | Categories with >15% of purchases, sorted by count |
| sc_TopWineries | Top 3 wineries by purchase count |
| sc_TopRedGrapes | Top 3 grapes from red wine purchases |
| sc_TopWhiteGrapes | Top 3 grapes from white wine purchases |
| sc_PriceAvg | Average unit price of wine purchases |
| sc_PriceMin | 10th percentile price (skips outliers) |
| sc_PriceMax | 90th percentile price (skips outliers) |
| sc_RedIntensityRange | 15th-85th percentile intensity of red wines purchased |
| sc_RedComplexityRange | 15th-85th percentile complexity of red wines purchased |
| sc_WhiteComplexityRange | 15th-85th percentile complexity of white wines purchased |
| sc_WhiteAcidityRange | 15th-85th percentile acidity of white wines purchased |
| sc_KashrutPrefs | Top 3 kashrut certifications from K1 codes |
| sc_BundleBuyer | TRUE if any purchased SKU is a bundle (wpm_TaxProductType = 'woosb') |
| sc_AvgBottlesPerOrder | Wine bottles only (excludes accessories/gifts/liqueur) |

### Category Translation

Hebrew cpm_Group values are translated to English:
- יין אדום יבש → Dry Red
- יין לבן יבש → Dry White
- רוזה / יין רוזה → Rosé
- יין מוגז → Sparkling
- יין קינוח → Dessert
- יין מחוזק → Fortified
- יין חצי יבש → Semi-Dry

---

## Activity History

### Activity Types

| Type | Description |
|------|-------------|
| order.placed | Customer placed an order |
| coupon.used | Customer redeemed a coupon |
| subscription.started | Customer subscribed to newsletter |
| campaign.received | Customer was in Mailchimp campaign |
| status.changed | Lifecycle status changed |
| comm.whatsapp | WhatsApp conversation logged |
| comm.email | Email sent |
| note.added | Manual note added |

### Backfill Status

Activity history backfill completed: **18,788 records**
- Order activity from WebOrdM + WebOrdM_Archive
- Coupon activity from wom_CouponItems
- Subscription activity from Mailchimp export
- Campaign activity from campaign history

---

## Implementation Status

### Completed

| Phase | Component | Status |
|-------|-----------|--------|
| 1 | SysContacts sheet + schema | Done |
| 1 | ContactService.js - CRUD operations | Done |
| 1 | ContactImportService.js - order/Mailchimp import | Done |
| 2 | Daily refresh in housekeeping | Done |
| 2 | Lifecycle status calculation | Done |
| 2 | Customer type classification | Done |
| 3 | Activity history backfill | Done |
| 3 | ContactEnrichmentService.js | Done |
| 3 | Preference calculation (categories, wineries, prices) | Done |
| 3 | Attribute range calculation (intensity, complexity, acidity) | Done |
| 3 | Lookup integration (grapes, kashrut) | Done |
| 4 | CrmIntelligenceService.js | Done |
| 4 | Cooling customer triggers | Done |
| 4 | task.crm.suggestion task type | Done |

### In Progress / Blocked

| Component | Status | Blocker |
|-----------|--------|---------|
| Contact classification accuracy | BLOCKED | Bugs in gift/war-support detection |
| sc_IsCore accuracy | BLOCKED | Defaulting conflict overwrites imports |
| Preference enrichment accuracy | BLOCKED | Classification bugs affect enrichment |

### Not Started

| Phase | Component |
|-------|-----------|
| 5 | Contact list UI (AdminContactsView.html) |
| 5 | WebAppContacts.js data provider |
| 6 | WhatsApp integration |
| 6 | Mailchimp export |
| 7 | Recommendation engine |
| 7 | Year in Wine campaign |

---

## Current Issues - CRITICAL FIX REQUIRED

### Summary

5 bugs + 2 additional issues causing data corruption in SysContacts.

**Root cause:** Gift detection, war-support detection, and IsCore classification have implementation errors that result in incorrect customer types.

### Bug 1: sc_IsCore Defaulting Conflict

**Location:** ContactService.js lines 644-652

**Problem:** Code defaults sc_IsCore to TRUE for customers when empty, overwriting correct values set by import.

```javascript
// PROBLEMATIC CODE - TO BE REMOVED
const currentIsCore = row[indices.sc_IsCore];
if (currentIsCore === '' || currentIsCore === null || currentIsCore === undefined) {
  const isCustomer = row[indices.sc_IsCustomer] === true || row[indices.sc_IsCustomer] === 'TRUE';
  row[indices.sc_IsCore] = isCustomer;
  changed = true;
}
```

**Fix:** Remove this defaulting logic. Add a warning log instead:
```javascript
if (currentIsCore === '' || currentIsCore === null || currentIsCore === undefined) {
  if (isCustomer) {
    LoggerService.warn(SERVICE_NAME, fnName,
      `Contact ${email} is customer but sc_IsCore not set - run import to fix`);
  }
}
```

### Bug 2: Gift Detection is Incomplete

**Location:** ContactImportService.js lines 191-193

**Problem:** Inline gift detection only checks lastname, doesn't use delivery keyword logic.

```javascript
// PROBLEMATIC CODE
const isGift = billingLastName && shippingLastName &&
               billingLastName.toLowerCase() !== shippingLastName.toLowerCase();
```

**Fix:** Use ContactService._isGiftOrder() function instead. First update that function with DELIVERY_KEYWORDS (see Classification Logic section above), then replace inline code:

```javascript
const isGift = ContactService._isGiftOrder({
  customerNote: customerNote,
  billingLastName: billingLastName,
  shippingLastName: shippingLastName
});
```

### Bug 3: War-Support Detection Checks Wrong Field

**Location:** ContactImportService.js lines 247-251

**Problem:** Code checks customerNote for war-support coupon codes instead of wom_CouponItems.

```javascript
// PROBLEMATIC CODE
const noteLower = customerNote.toLowerCase();
if (WAR_SUPPORT_COUPONS.some(code => noteLower.includes(code))) {
  contact._warSupportOrders++;
}
```

**Fix:**
1. Extract wom_CouponItems field (add after line 184):
   ```javascript
   const couponItems = row[womIdx['wom_CouponItems']] || '';
   ```

2. Use proper coupon parsing:
   ```javascript
   const coupons = ContactService._extractCoupons(couponItems);
   if (ContactService._hasWarSupportCoupon(coupons)) {
     contact._warSupportOrders++;
   }
   ```

### Bug 4: Archive Mapping Missing CouponItems

**Location:** ContactImportService.js lines 89-104

**Problem:** woma_CouponItems is not mapped from archive orders.

**Fix:** Add to archive mapping loop:
```javascript
mappedRow[womIdx['wom_CouponItems']] = row[womaIdx['woma_CouponItems']];
```

### Bug 5: Duplicate _classifyCustomerType Function

**Location:** ContactImportService.js lines 430-451

**Problem:** Duplicate of function in ContactService.js, with subtle logic difference (missing sc_IsSubscribed check).

**Fix:** Delete the function from ContactImportService.js and use ContactService._classifyCustomerType().

### Bug 6: Duplicate _calculateLifecycleStatus Function

**Location:** ContactImportService.js lines 421-428

**Problem:** Hardcodes threshold values while ContactService uses LIFECYCLE_THRESHOLDS constants.

**Fix:** Delete the function from ContactImportService.js and use ContactService._calculateLifecycleStatus().

### Bug 7: Existing Data Corrupted

**Problem:** Contacts have inconsistent state (e.g., sc_CustomerType = 'noncore.gift' but sc_IsCore = TRUE).

**Fix:** Run data correction script after code fixes are deployed (see below).

---

## Fix Implementation Order

### Pre-Work
1. Export SysContacts to CSV for backup

### Code Fixes (in order)

| Step | File | Action |
|------|------|--------|
| 1 | ContactService.js | Update _isGiftOrder() with DELIVERY_KEYWORDS |
| 2 | ContactService.js | Add _extractCoupons() and _hasWarSupportCoupon() to public API |
| 3 | ContactImportService.js | Add wom_CouponItems extraction (after line 184) |
| 4 | ContactImportService.js | Add woma_CouponItems archive mapping (line ~103) |
| 5 | ContactImportService.js | Replace inline gift detection with function call |
| 6 | ContactImportService.js | Replace war-support detection with coupon parsing |
| 7 | ContactImportService.js | Delete duplicate _classifyCustomerType (lines 430-451) |
| 8 | ContactImportService.js | Delete duplicate _calculateLifecycleStatus (lines 421-428) |
| 9 | ContactImportService.js | Update call sites to use ContactService functions |
| 10 | ContactService.js | Remove sc_IsCore defaulting (lines 644-652), add warning log |
| 11 | ContactService.js | Add correctContactData() function |
| 12 | Global | Add runContactDataCorrection() function |

### Data Fix

After code is deployed:
1. Run `runContactDataCorrection()` from Apps Script editor
2. Verify sample contacts manually
3. Run "Refresh Contacts" - verify no new corruption
4. Run "Enrich Contacts" - verify enrichment works

### Correction Script Pseudocode

```javascript
function correctContactData() {
  const contacts = loadAllContacts();
  const orders = loadAllOrdersWithCoupons();  // Must include wom_CouponItems
  const ordersByEmail = groupOrdersByBillingEmail(orders);

  let corrected = 0;

  for (const contact of contacts) {
    if (!contact.sc_IsCustomer) continue;

    const customerOrders = ordersByEmail.get(contact.sc_Email.toLowerCase()) || [];
    if (customerOrders.length === 0) continue;

    // Re-analyze with corrected logic
    let giftCount = 0;
    let warSupportCount = 0;

    for (const order of customerOrders) {
      if (_isGiftOrder(order)) giftCount++;
      const coupons = _extractCoupons(order.couponItems);
      if (_hasWarSupportCoupon(coupons)) warSupportCount++;
    }

    // Determine correct IsCore value
    const allGifts = giftCount === customerOrders.length;
    const allWarSupport = warSupportCount === customerOrders.length;
    const shouldBeCore = !allGifts && !allWarSupport;

    // Check for mismatch
    if (contact.sc_IsCore !== shouldBeCore) {
      contact.sc_IsCore = shouldBeCore;
      contact.sc_CustomerType = _classifyCustomerType(contact);
      upsertContact(contact);
      corrected++;
      LoggerService.info('Correction', 'correctContactData',
        `Fixed ${contact.sc_Email}: IsCore=${shouldBeCore}, Type=${contact.sc_CustomerType}`);
    }
  }

  return { corrected };
}
```

---

## Validation & Testing Gaps

### Current State

| Area | Status | Gap |
|------|--------|-----|
| CRM Services Tests | 0/4 | ContactService, ContactImportService, ContactEnrichmentService, CrmIntelligenceService have no tests |
| CRM Validation Rules | PENDING TEST | 3 rules added for IsCore/CustomerType consistency |
| Schema Validation | PENDING TEST | Added to housekeeping Phase 2 - needs deployment and verification |
| Registered Test Suites | 4/31 | Only OrderServiceTest, ProductServiceTest, ComaxAdapterTest, WebAdapterTest |

### Required Actions

1. **Add CRM test suites to TestRunner:**
   - ContactServiceTest.js
   - ContactImportServiceTest.js
   - ContactEnrichmentServiceTest.js

2. **Add CRM validation rules to validation.json:**
   - sc_Email format validation
   - sc_CustomerType enum validation
   - sc_LifecycleStatus enum validation
   - sc_IsCore/sc_CustomerType consistency check

3. **Enable schema validation in housekeeping:**
   - Add `ValidationLogic.validateDatabaseSchema()` call
   - Include results in task.system.health_status notes

### Health Status Integration

CRM health should be a **section** in the existing `task.system.health_status` singleton task, not a separate task.

The health_status task stores JSON in st_Notes:
```javascript
{
  daysSinceUpdate: 14,
  lastCheck: "2025-12-18",
  testsPassed: 4,
  testsFailed: 0,
  validationErrors: [],
  crmHealth: {              // NEW SECTION
    contactCount: 1234,
    enrichedCount: 1100,
    lastEnrichment: "2025-12-21",
    classificationErrors: 0
  }
}
```

---

## Phone Number Formatting

### Strategy: One-Time Normalization

Phone numbers are normalized to +972 format for WhatsApp compatibility.

**Rule:** Only update phone if the normalized form is DIFFERENT from current value (avoids false "changes" on every refresh).

```javascript
function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/[\s\-\(\)]/g, '');

  // Already international format
  if (cleaned.startsWith('+')) return cleaned;

  // Israeli mobile: 05x -> +9725x
  if (cleaned.startsWith('05')) {
    return '+972' + cleaned.substring(1);
  }

  // Israeli landline: 0x -> +972x
  if (cleaned.startsWith('0')) {
    return '+972' + cleaned.substring(1);
  }

  return cleaned;
}

// Only update if actually different
const normalized = normalizePhone(contact.sc_Phone);
if (normalized !== contact.sc_WhatsAppPhone) {
  contact.sc_WhatsAppPhone = normalized;
}
```

---

## Dual-Language Preference Storage

### Strategy: Store Both EN and HE

When enriching preferences, store both language versions to support UI display and Mailchimp exports.

**Fields affected:**
- sc_FrequentCategories → stores English (from translation map)
- sc_TopWineries → stores Hebrew (from cpm_Winery)
- sc_TopRedGrapes → stores Hebrew (from lookup)
- sc_TopWhiteGrapes → stores Hebrew (from lookup)
- sc_KashrutPrefs → stores Hebrew (from K1 lookup)

**Future consideration:** Add parallel `_EN` fields if English versions needed for export:
- sc_TopWineries_EN, sc_TopRedGrapes_EN, etc.

For now, category translation map covers the primary use case (marketing segmentation).

---

## Overnight Maintenance Checklist

### Housekeeping Phases

The overnight housekeeping runs in phases. CRM maintenance fits into existing structure:

| Phase | Time | Operations |
|-------|------|------------|
| 1. Cleanup | 00:00 | Archive old orders, clear logs |
| 2. Validation | 00:15 | Run test suites, schema validation |
| 3. CRM Updates | 00:30 | Refresh contacts, enrich preferences |
| 4. Intelligence | 01:00 | Generate suggestions, update health status |

### CRM Maintenance Sequence

```
1. ContactService.refreshAllContacts()
   - Updates sc_DaysSinceOrder, sc_DaysSubscribed
   - Recalculates sc_LifecycleStatus
   - Logs status changes to SysContactActivity

2. ContactEnrichmentService.enrichStaleContacts()
   - Processes contacts where sc_LastEnriched > 30 days ago
   - Calculates wine preferences from order history
   - Updates sc_LastEnriched timestamp

3. CrmIntelligenceService.generateDailySuggestions()
   - Identifies cooling customers (91-180 days)
   - Creates task.crm.suggestion tasks for outreach
   - Updates health_status with CRM metrics
```

### Data Source Timing

| Source | When Updated | CRM Impact |
|--------|--------------|------------|
| WooCommerce Orders | During daily sync | New orders available same evening |
| Mailchimp Subscribers | Manual import | Run before CRM refresh if new data |
| Comax Products | During daily sync | Price changes reflected in enrichment |

---

## Future Phases

### Phase 5: Contact List UI

- AdminContactsView.html with 8/4 column split
- Filter bar: Type, Status, Language, Subscribed, Search
- Detail panel with metrics, preferences, activity timeline
- Action buttons: WhatsApp, Email

### Phase 6: Communication Actions

- WhatsApp pre-filled message templates
- Outcome logging after conversation
- Follow-up scheduling (coupon, email, reminder)
- Mailchimp segment export

### Phase 7: Recommendations & Year in Wine

- Recommendation engine matching customer preferences to products
- "Year in Wine" campaign: personalized summary of customer's wine journey
- Bundle suggestions based on audience profile

### Phase 8: AI Integration

- Claude API integration for natural language queries
- Content generation for campaigns
- Intelligent automation suggestions

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Contact CRUD | ContactService.js |
| Order/Mailchimp import | ContactImportService.js |
| Preference enrichment | ContactEnrichmentService.js |
| Intelligence triggers | CrmIntelligenceService.js |
| Schema definitions | config/schemas.json |
| Lookup tables | config/mappings.json |

---

Updated: 2025-12-22 (consolidated from 4 documents + session discussion)
