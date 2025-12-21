# CRM Enrichment Plan

**Goal:** Populate contact preferences, activity history, and enable Year in Wine campaign.

---

## Part 1: Activity History Backfill

Populate SysContactActivity with historical events from existing data.

### 1A. Order Activity

**Source:** WebOrdM + WebOrdItemsM + SysOrdLog

**Events to create:**
- `order.placed` - For each completed order

**Activity record:**
```javascript
{
  sca_Email: billingEmail,
  sca_Timestamp: orderDate,
  sca_Type: 'order.placed',
  sca_Summary: `Order #${orderNumber}: ${itemCount} items, ${totalAmount}`,
  sca_Details: JSON.stringify({
    orderId: orderId,
    orderNumber: orderNumber,
    total: totalAmount,
    itemCount: itemCount,
    items: itemSummary  // "2x Carmel Shiraz, 1x Golan Cab"
  }),
  sca_CreatedBy: 'import'
}
```

### 1B. Coupon Activity

**Source:** WebOrdM.wom_CouponItems field

**Format:** `code:SHIPFREE|amount:0.00;code:WELCOME10|amount:44.03`

**Events to create:**
- `coupon.used` - For each coupon in each order

**Activity record:**
```javascript
{
  sca_Email: billingEmail,
  sca_Timestamp: orderDate,
  sca_Type: 'coupon.used',
  sca_Summary: `Used coupon ${code} (-${amount})`,
  sca_Details: JSON.stringify({
    code: code,
    discount: amount,
    orderId: orderId
  }),
  sca_CreatedBy: 'import'
}
```

### 1C. Mailchimp Campaign Activity

**Source:** SysCampaigns (if populated) + subscriber list cross-reference

**Challenge:** We don't have per-contact send data from Mailchimp exports. Campaign data shows aggregate stats only.

**Options:**
1. Skip for now - no per-contact data available
2. Mark all subscribers as "included" in campaigns sent after their subscribe date
3. Wait for future Mailchimp API integration

**Recommendation:** Skip Mailchimp activity backfill. Focus on orders/coupons. Add Mailchimp activity going forward when campaigns are sent through the system.

---

## Part 2: Preference Enrichment

Calculate wine preferences from order item history.

### Data Flow

```
WebOrdItemsM (items purchased)
    ↓
WebProM (product details: category, winery, price)
    ↓
Aggregate per contact
    ↓
Update SysContacts preference fields
```

### Preference Fields to Populate

**Note:** Bundles guide most purchases, so customer behavior is not fully independent. Use ranges (most common range) not averages for attribute scales.

| Field | Type | Calculation |
|-------|------|-------------|
| sc_FrequentCategories | string | Most purchased categories (may be multiple) |
| sc_RedIntensityRange | string | Most common intensity range for Dry Red (e.g., "3-5") |
| sc_RedComplexityRange | string | Most common complexity range for Dry Red (e.g., "2-4") |
| sc_WhiteComplexityRange | string | Most common complexity range for Dry White (e.g., "2-4") |
| sc_WhiteAcidityRange | string | Most common acidity range for Dry White (e.g., "2-4") |
| sc_TopWineries | string | Top 3 wineries by bottle count |
| sc_TopRedGrapes | string | First grape per wine, red wines only |
| sc_TopWhiteGrapes | string | First grape per wine, white wines only |
| sc_PriceAvg | number | Average bottle price purchased |
| sc_PriceMin | number | Lowest bottle price purchased |
| sc_PriceMax | number | Highest bottle price purchased |

**Attribute ranges:** Scale is 1-5 for intensity, complexity, acidity. Find most common range (e.g., "3-5" means customer typically buys wines rated 3, 4, or 5).

**Sources:**
- Category: CmxProdM Division/Group
- Winery: Parse from product name (e.g., "Golan Heights Yarden Cabernet" → "Golan Heights")
- Grapes: First grape listed per wine in product data
- Attributes: 1-5 scale, calculate most common range within category

### Category Priority

From plan - use WooCommerce categories:
```javascript
const CATEGORY_PRIORITY = [
  'Dry Red', 'Dry White', 'Rosé', 'Semi-Dry',
  'Dessert', 'Fortified', 'Sparkling'
];
```

### Winery Extraction

**Source:** Product name parsing OR WebDataMaster.wdm_Winery field

**Approach:**
1. Build lookup from WebProM/WebDataMaster by SKU
2. For each contact's order items, collect winery
3. Count frequency, take top 3

### Implementation

**New function:** `ContactEnrichmentService.enrichContactPreferences()`

```javascript
function enrichContactPreferences() {
  // 1. Load all order items with product details
  const itemsByEmail = buildItemsByEmail();  // Map<email, Array<item>>

  // 2. Load product lookup (SKU → category, winery, price)
  const productLookup = buildProductLookup();

  // 3. For each contact with orders
  for (const [email, items] of itemsByEmail) {
    const contact = ContactService.getContactByEmail(email);
    if (!contact) continue;

    // Enrich items with product data
    const enrichedItems = items.map(item => ({
      ...item,
      category: productLookup[item.sku]?.category,
      winery: productLookup[item.sku]?.winery,
      price: productLookup[item.sku]?.price || item.unitPrice
    }));

    // Calculate preferences
    contact.sc_PreferredCategory = calculatePrimaryCategory(enrichedItems);
    contact.sc_SecondaryCategory = calculateSecondaryCategory(enrichedItems);
    contact.sc_PriceMin = Math.min(...enrichedItems.map(i => i.price));
    contact.sc_PriceMax = Math.max(...enrichedItems.map(i => i.price));
    contact.sc_TopWineries = calculateTopWineries(enrichedItems, 3);

    ContactService.upsertContact(contact);
  }
}
```

### When to Run

1. **Initial backfill:** Run once after activity import
2. **Ongoing:** In nightly housekeeping, after new orders sync

---

## Part 3: Year in Wine Campaign

### Campaign Project Structure

**Project Type:** `CAMPAIGN`
**Project Name:** `Year in Wine 2024`

### Tasks in Campaign Project

| Order | Task Type | Title | Description |
|-------|-----------|-------|-------------|
| 1 | task.campaign.audience | Define audience | Select contacts to receive Year in Wine |
| 2 | task.campaign.content | Create EN template | Write English Year in Wine template |
| 3 | task.campaign.content | Create HE template | Write Hebrew Year in Wine template |
| 4 | task.campaign.content | Review templates | Approve final content |
| 5 | task.campaign.audience | Generate personalized data | Run enrichment, export stats per contact |
| 6 | task.campaign.launch | Send via Mailchimp | Import to Mailchimp, send campaign |
| 7 | task.campaign.review | Log results | Record activity, review engagement |

### Year in Wine Data Generation

**Function:** `generateYearInWineData(email, year)`

**Output per contact:**
```javascript
{
  email: "customer@example.com",
  name: "David Cohen",
  language: "en",
  year: 2024,
  orderCount: 4,
  bottleCount: 14,
  totalSpend: 2340,
  favoriteCategory: "Dry Red",
  topWinery: "Golan Heights",
  newWineriesDiscovered: 2,
  avgOrderValue: 585,
  // For template merge
  stats_summary: "4 orders, 14 bottles",
  spend_formatted: "2,340",
  taste_summary: "Bold red lover with a taste for Golan Heights wines"
}
```

### Export Format

CSV for Mailchimp merge:
```csv
Email,FNAME,LNAME,LANGUAGE,ORDER_COUNT,BOTTLE_COUNT,TOTAL_SPEND,FAV_CATEGORY,TOP_WINERY,TASTE_SUMMARY
david@example.com,David,Cohen,en,4,14,2340,Dry Red,Golan Heights,"Bold red lover..."
```

### Template (from CRM plan)

**English:**
```
Your 2024 Year in Wine

Hi {name},

What a year it's been! Here's your wine journey with JLMwines:

BY THE NUMBERS
- {order_count} orders
- {bottle_count} bottles
- {spend_formatted} invested in great wine

YOUR FAVORITES
- Go-to category: {fav_category}
- Top winery: {top_winery}
- Your style: {taste_summary}

Here's to an even better 2025!

L'chaim,
JLMwines
```

---

## Implementation Order

### Step 1: Activity Backfill Service

Create `ActivityBackfillService.js`:
- `backfillOrderActivity()` - Creates order.placed events
- `backfillCouponActivity()` - Creates coupon.used events
- `runFullBackfill()` - Runs both

**Global function:** `runActivityBackfill()`

### Step 2: Preference Enrichment

Add to `ContactEnrichmentService.js`:
- `buildProductLookup()` - SKU → category, winery, price
- `enrichContactPreferences()` - Calculate and save preferences
- `enrichSingleContact(email)` - For incremental updates

**Add to HousekeepingService:** Call enrichment after contact refresh

### Step 3: Year in Wine Functions

Add to `CampaignService.js` or new `YearInWineService.js`:
- `generateYearInWineData(email, year)`
- `exportYearInWineAudience(year, filters)`
- `createYearInWineCampaignProject(year)`

---

## Data Dependencies

### Required Sheets
- WebOrdM (orders)
- WebOrdItemsM (order items)
- WebProM or WebDataMaster (product details)
- SysContacts (contacts)
- SysContactActivity (activity log)

### Required Fields in Product Data

Need to verify availability:
- Category (wdm_TypeFull or wdm_Category)
- Winery (wdm_Winery)
- Price (wdm_Price or woi_UnitPrice from items)

---

## Resolved Design Decisions

### Category Source: Comax Division/Group

**Primary category comes from CmxProdM:**

| Division | Category Name | Notes |
|----------|---------------|-------|
| 1 | *Use cpm_Group* | Wine - subtype from Group (יין אדום יבש, יין לבן יבש, רוזה, etc.) |
| 3 | Liqueur | ליקר |
| 5 | Accessories | אביזרים |
| 9 | Gifts | פריטי מתנה |

**Category extraction logic:**
```javascript
function getPrimaryCategory(product) {
  const div = String(product.cpm_Division || '').trim();
  const group = String(product.cpm_Group || '').trim();

  if (div === '1') return group;  // Wine - use Group
  if (div === '3') return 'Liqueur';
  if (div === '5') return 'Accessories';
  if (div === '9') return 'Gifts';
  return 'Other';
}
```

### Winery Source

Extract from product name or use WebDetM wdm_Region as fallback. Product names typically include winery (e.g., "Golan Heights Cabernet 2021").

### Year in Wine Audience

Anyone with enough history to generate a profile:
- At least 1 completed order
- Filter: `sc_IsCustomer === true && sc_OrderCount >= 1`

### Year in Wine Timing

On-demand when user requests it. System generates data and export instantly.

---

## Estimated Work

| Component | Effort |
|-----------|--------|
| ActivityBackfillService | Medium - straightforward data transformation |
| Preference enrichment | Medium - need product lookup integration |
| Year in Wine data generation | Low - aggregation from existing data |
| Campaign project creation | Low - uses existing project/task system |
| Export for Mailchimp | Low - CSV generation |

---

## Success Criteria

1. Activity tab in Contact Detail shows order history and coupon usage
2. Preferences section shows category, wineries, price range
3. Year in Wine campaign project can be created with one click
4. Export generates Mailchimp-ready CSV with personalized data

---

## Phase 2: Advanced Preference Analysis

Future refinements once base data is populated and patterns can be observed.

### Separate Red vs White Attributes

Schema already includes `sc_RedComplexityAvg` and `sc_WhiteComplexityAvg`. Enrichment code needs to:

1. Filter items by wine type (red vs white) before calculating complexity
2. Populate the separate fields

| Field | Status | Notes |
|-------|--------|-------|
| sc_RedComplexityAvg | Schema exists | Need enrichment logic |
| sc_WhiteComplexityAvg | Schema exists | Need enrichment logic |
| sc_RedIntensity | Future | May need schema addition |
| sc_WhiteAcidity | Future | May need schema addition |

### Category Statistical Significance

Most order data falls into Dry Red / Dry White categories. Other categories (Rosé, Semi-Dry, Dessert, Fortified, Sparkling) may lack enough data for reliable conclusions.

**Approach:**
- Set minimum threshold (e.g., 3+ purchases) before assigning category preference
- Flag low-confidence preferences
- Consider grouping minor categories for analysis

### Seasonal Preference Patterns

Customer preferences may shift with seasons:
- **Winter:** Higher intensity reds, fuller body
- **Summer:** Higher acidity whites, lighter wines, rosé

**Implementation ideas:**
- Analyze order dates to detect seasonal patterns
- Require sufficient order history (e.g., 2+ years, 6+ orders) for seasonal analysis
- Track `sc_SeasonalPattern` flag (e.g., "winter-red", "summer-white", "consistent")
- Use for campaign timing recommendations

### Minimum Data Requirements

| Analysis Type | Minimum Orders | Minimum Timespan |
|---------------|----------------|------------------|
| Basic category preference | 2 | Any |
| Secondary category | 4 | Any |
| Winery loyalty | 3 | Any |
| Seasonal pattern | 6 | 18 months |
| Complexity preference | 5 | Any |

---

## Status

- [x] Part 1: Activity history backfill (18,788 records imported)
  - [x] Order activity (order.placed)
  - [x] Coupon activity (coupon.used)
  - [x] Subscription activity (subscription.started)
  - [x] Campaign activity (campaign.received)
  - [x] Backfill added to housekeeping Phase 3
- [x] Part 2: Preference enrichment
  - [x] Schema updated (FrequentCategories, attribute ranges, grapes, prices)
  - [x] ContactEnrichmentService.js updated with new field calculations
  - [x] Enrichment runs in housekeeping after contact refresh
  - [x] Grapes use wdm_GrapeG1 codes with SysLkp_Grapes lookup (primary grape only)
  - [x] Kashrut uses wdm_KashrutK1 codes with SysLkp_Kashrut lookup (top 3)
  - [x] Tasting attributes loaded from WebDetM (intensity, complexity, acidity)
- [ ] Part 3: Year in Wine campaign
  - [ ] Campaign project template
  - [ ] Data generation functions
  - [ ] Mailchimp export
- [x] Intelligence Layer
  - [x] CrmIntelligenceService.js created
  - [x] Triggers: cooling customers, unconverted subscribers, winery clusters, holidays
  - [x] task.crm.suggestion task type added
  - [x] Runs in housekeeping Phase 3

**Note:** SysCouponUsage sheet is obsolete. Coupon tracking via activity records (coupon.used type).

---

## Technical Debt

### Hardcoded Category Mapping
`CATEGORY_TRANSLATION` in ContactEnrichmentService.js maps Hebrew cpm_Group values to English.

**Future:** Create `SysLkp_Categories` lookup table with columns: Code, NameHE, NameEN, Division, Group. Load dynamically instead of hardcoding.

### Hardcoded Winery List
`KNOWN_WINERIES` in ContactEnrichmentService.js is a static list for extraction from product names.

**Future:** Solved by Brands feature. `SysBrands` table with name patterns for matching. Winery becomes a brand attribute.

### Resolved: Grape Extraction
~~Previously used text parsing to find grape names in product names.~~

**Fixed:** Now uses `wdm_GrapeG1` code from WebDetM and resolves via `LookupService.getLookupMap('map.grape_lookups')` to get English grape name from `SysLkp_Grapes`.

---

## Optimizations Added

### Incremental Enrichment (sc_LastEnriched)
- Added `sc_LastEnriched` field to SysContacts
- `enrichAllContacts()` skips contacts where `LastOrderDate <= LastEnriched`
- First run processes all contacts (no LastEnriched value)
- Subsequent runs only process contacts with new orders since last enrichment

### Periodic Data Update Reminders
Housekeeping creates tasks when data sources are stale (>14 days):
- `task.data.subscribers_update` - Mailchimp subscribers
- `task.data.campaigns_update` - Mailchimp campaigns
- `task.data.coupons_update` - WooCommerce coupons

---

Updated: 2025-12-21
