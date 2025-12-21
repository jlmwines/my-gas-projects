# Contact Analysis Service Plan

**Goal:** Provide actionable insights from activity history to guide marketing and outreach efforts.

---

## Contact Segmentation

**Critical distinction:** Not all contacts have equal targeting value.

### Core Customers (High Priority)
- Ship to themselves (billing ≈ shipping, or shipping in Israel with non-gift message)
- Actively chose JLMwines
- Likely to reorder
- **These are the focus of CRM efforts**

### Gift Recipients (Low Priority)
- Received wine as a gift (shipping ≠ billing + gift message)
- Did not choose JLMwines themselves
- Low repeat purchase likelihood
- Occasional targeting at gift-giving holidays only

### Overseas Gifters
- Billing address outside Israel
- Found JLMwines via organic search (English keywords)
- Drive significant revenue but are search-driven, not CRM-driven
- May only appear once in contacts

### Gift Detection Logic

**Inverse detection** - easier to identify NON-gift messages (delivery instructions):

```javascript
const DELIVERY_KEYWORDS = ['please', 'deliver', 'call', 'phone', 'outside', 'floor', 'door', 'gate', 'code', 'buzzer'];

function isGiftOrder(order) {
  const note = (order.customerNote || '').toLowerCase();
  const billingCity = order.billingCity || '';
  const shippingCity = order.shippingCity || '';

  // Same city = not a gift
  if (billingCity && billingCity === shippingCity) return false;

  // No note but different addresses = likely gift
  if (!note) return billingCity !== shippingCity;

  // Delivery instructions = not a gift
  for (const keyword of DELIVERY_KEYWORDS) {
    if (note.includes(keyword)) return false;
  }

  // Everything else with different addresses = gift
  return billingCity !== shippingCity;
}
```

---

## Geographic Analysis

### City Normalization

**Purpose:** Normalize Hebrew/English city names and enrich with targeting attributes.

**Schema: SysLkp_Cities**

| Column | Purpose | Example Values |
|--------|---------|----------------|
| slc_Code | Canonical ID | JLM, TLV, DIMONA |
| slc_NameEN | English name | Jerusalem |
| slc_NameHE | Hebrew name | ירושלים |
| slc_Aliases | Match variations | Yerushalayim, j-lem |
| slc_Type | Community type | major_city, suburb, town, kibbutz, moshav, yishuv |
| slc_Region | Geographic region | Jerusalem, Center, North, South, Sharon |
| slc_LanguageTend | Language tendency | en, he, mixed |
| slc_WineAccess | Access to quality wine retail | high, medium, low, none |

### Wine Access Levels

The key targeting insight: **customers with poor local wine access are better prospects**.

| Level | Description | Examples |
|-------|-------------|----------|
| high | Major cities with wine shops | Tel Aviv, Jerusalem, Haifa |
| medium | Suburbs near major cities | Ra'anana, Herzliya, Modi'in |
| low | Smaller towns, limited selection | Netanya, Ashdod, Be'er Sheva |
| none | Remote areas, no quality wine retail | Kibbutzim, moshavim, small yishuvim, development towns |

### Location Determination

1. Use **shipping city** (not billing - often outside Israel for English speakers)
2. Only analyze **core customers** (non-gift orders)
3. Flag uncertainty when gift detection is ambiguous

---

## Data Sources

| Source | Purpose |
|--------|---------|
| SysContactActivity | Orders, subscriptions, campaigns, coupons |
| SysContacts | Customer attributes, lifecycle status |
| WebOrdM + Archive | Order details, addresses, customer notes |
| WebOrdItemsM + Archive | Order line items (for bundle detection) |
| SysCampaigns | Campaign metadata |
| SysLkp_Cities | City normalization and attributes |

---

## Analysis Categories

### 1. Conversion & Acquisition

**Metrics:**
- Subscription → first order conversion rate
- Average days from subscription to first order
- Conversion rate by subscription source
- Subscribers who never ordered

**Segmented by:** Core customers only (exclude gift recipients)

**Output:**
```javascript
{
  totalSubscribers: 450,
  convertedToCustomer: 120,
  conversionRate: 0.267,
  avgDaysToFirstOrder: 18.5,
  bySource: {
    'Website Popup': { subscribers: 200, converted: 60, rate: 0.30 },
    'Checkout': { subscribers: 150, converted: 50, rate: 0.33 },
    'Import': { subscribers: 100, converted: 10, rate: 0.10 }
  },
  neverOrdered: 330
}
```

### 2. Campaign Effectiveness

**Metrics:**
- Orders within 1/3/7 days after each campaign
- Revenue attributed to campaigns (orders in window)
- Campaign response by language group
- Best performing campaigns

**Output:**
```javascript
{
  campaigns: [
    {
      id: 'camp_123',
      title: 'Summer Wine Sale',
      sendDate: '2024-07-15',
      recipients: 200,
      ordersWithin1Day: 5,
      ordersWithin3Days: 12,
      ordersWithin7Days: 18,
      attributedRevenue: 4500
    }
  ],
  overall: {
    avgOrdersWithin7Days: 8.5,
    avgAttributedRevenue: 2100
  }
}
```

### 3. Customer Behavior

**Metrics (Core Customers Only):**
- Order frequency distribution (1 order, 2-3, 4-5, 6+)
- Average days between orders
- Repeat purchase rate
- Monthly/seasonal order patterns

**Output:**
```javascript
{
  coreCustomers: {
    total: 160,
    orderFrequency: {
      '1': 80,
      '2-3': 45,
      '4-5': 20,
      '6+': 15
    },
    avgDaysBetweenOrders: 45,
    repeatPurchaseRate: 0.53
  },
  giftRecipients: {
    total: 120,
    convertedToCore: 8  // ordered for themselves later
  },
  seasonalPattern: {
    'Jan': 12, 'Feb': 8, /* ... */ 'Dec': 25
  }
}
```

### 4. Retention & Churn Risk

**Metrics:**
- Core customers by lifecycle status (Active, Recent, Cooling, Lapsed, Dormant)
- Customers at risk (45-90 days since order)
- Win-back candidates (ordered before, lapsed, still subscribed)

**Output:**
```javascript
{
  byStatus: {
    'Active': 40,
    'Recent': 35,
    'Cooling': 25,
    'Lapsed': 30,
    'Dormant': 20
  },
  atRisk: 25,
  winBackCandidates: 18
}
```

### 5. Coupon Analysis

**Metrics:**
- Usage count by coupon code
- Total discount given per coupon
- Repeat purchase rate of coupon users vs non-users
- First-order coupons (WELCOME10, etc.) effectiveness

**Output:**
```javascript
{
  byCoupon: {
    'WELCOME10': { uses: 45, totalDiscount: 1980, avgDiscount: 44 },
    'SHIPFREE': { uses: 120, totalDiscount: 0, avgDiscount: 0 },
    'SUMMER20': { uses: 30, totalDiscount: 2400, avgDiscount: 80 }
  },
  couponUserRepeatRate: 0.62,
  nonCouponUserRepeatRate: 0.48
}
```

### 6. Bundle Analysis

**Metrics:**
- Bundle purchase frequency
- Special Value Bundle specifically tracked
- Bundle buyer characteristics (order count, spend)
- Bundle → repeat purchase rate
- Non-bundle buyers who might convert to bundle buyers

**Detection:** Look in order items for bundle products (by SKU pattern or product type)

**Output:**
```javascript
{
  bundlePurchases: 85,
  specialValueBundle: {
    purchases: 42,
    uniqueCustomers: 38,
    repeatPurchases: 8,
    avgOrderValue: 320
  },
  bundleBuyerRepeatRate: 0.71,
  nonBundleBuyerRepeatRate: 0.45,
  potentialBundleConversions: 25  // repeat buyers who haven't tried bundles
}
```

### 7. Geographic Analysis (Core Customers Only)

**Metrics:**
- Distribution by wine access level
- Order value by wine access level
- Repeat rate by wine access level
- Distribution by community type
- Language preference by region

**Output:**
```javascript
{
  byWineAccess: {
    'high': { customers: 45, avgOrderValue: 280, repeatRate: 0.42 },
    'medium': { customers: 60, avgOrderValue: 320, repeatRate: 0.55 },
    'low': { customers: 35, avgOrderValue: 380, repeatRate: 0.68 },
    'none': { customers: 20, avgOrderValue: 450, repeatRate: 0.75 }
  },
  byType: {
    'major_city': 45,
    'suburb': 60,
    'town': 25,
    'kibbutz': 8,
    'moshav': 12,
    'yishuv': 10
  },
  byLanguage: {
    'en': { customers: 80, avgOrderValue: 350 },
    'he': { customers: 65, avgOrderValue: 290 },
    'mixed': { customers: 15, avgOrderValue: 310 }
  },
  unmatchedCities: ['Ramat Beit Shemesh', 'Neve Daniel']  // cities not in lookup
}
```

---

## Implementation

### Service: ContactAnalysisService.js

```javascript
const ContactAnalysisService = (function() {

  // Helper functions
  function isGiftOrder(order) { /* ... */ }
  function classifyContact(contact, orders) { /* core, gift_recipient, overseas */ }
  function normalizeCity(rawCity) { /* ... */ }

  // Core analysis functions
  function analyzeConversion() { /* ... */ }
  function analyzeCampaigns() { /* ... */ }
  function analyzeCustomerBehavior() { /* ... */ }
  function analyzeRetention() { /* ... */ }
  function analyzeCoupons() { /* ... */ }
  function analyzeBundles() { /* ... */ }
  function analyzeGeography() { /* ... */ }

  // Main function - runs all analyses
  function runFullAnalysis() {
    return {
      generatedAt: new Date(),
      contactSegmentation: classifyAllContacts(),
      conversion: analyzeConversion(),
      campaigns: analyzeCampaigns(),
      behavior: analyzeCustomerBehavior(),
      retention: analyzeRetention(),
      coupons: analyzeCoupons(),
      bundles: analyzeBundles(),
      geography: analyzeGeography()
    };
  }

  // Generate text summary for quick reading
  function generateInsightsSummary() { /* ... */ }

  return {
    runFullAnalysis,
    generateInsightsSummary,
    isGiftOrder,
    classifyContact,
    normalizeCity
  };
})();
```

### Global Functions

```javascript
function runContactAnalysis() {
  return ContactAnalysisService.runFullAnalysis();
}

function getContactInsightsSummary() {
  return ContactAnalysisService.generateInsightsSummary();
}
```

---

## Bundle Detection

**Question:** How are bundles (especially Special Value Bundle) identified in the data?

Options:
1. **SKU pattern** - If bundles have distinctive SKU format
2. **Product lookup** - Check CmxProdM for Division/Group indicating bundle
3. **Product name** - Parse for "bundle", "pack", etc.

---

## Open Questions

1. How are bundles (especially Special Value Bundle) identified in the data?
2. Should results be stored historically to track trends over time?
3. Any specific thresholds for "at risk" customers (currently using 45-90 days)?

---

## Status

- [x] City lookup: SysLkp_Cities seeded and maintained via maintainCityLookup()
- [x] Gift detection logic defined
- [x] Data sources documented
- [ ] ContactAnalysisService.js full implementation
- [ ] Analysis functions (conversion, campaigns, behavior, retention, coupons, bundles, geography)
- [ ] Integration with dashboard/reporting

**Note:** City lookup is now auto-maintained in housekeeping. New cities from orders are added automatically.

---

Updated: 2025-12-21
