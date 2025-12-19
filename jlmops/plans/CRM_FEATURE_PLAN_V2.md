# CRM Feature Plan v2

## Vision

A lightweight but powerful customer relationship system tailored for JLMwines. Beyond basic contact management, this CRM will:
- **Surface actionable insights** from purchase patterns
- **Enable personalized outreach** via WhatsApp, email, and Mailchimp campaigns
- **Automate relationship maintenance** through smart task generation
- **Build customer profiles** that evolve with each interaction

---

## Data Analysis Summary (Dec 2025)

*Carried forward from v1 - see original analysis for details*

### Key Numbers
- 223 core customers from 864 orders
- 71% single-order, 29% repeat (64 customers)
- 30% conversion rate from first to repeat
- Median reorder interval: 48 days
- 36% of customers NOT in Mailchimp (capture opportunity)
- 489 Mailchimp subscribers who never ordered

### Strategic Insights
1. Hebrew customers growing but convert to repeat at lower rate
2. Jerusalem dominant (36%), Tel Aviv needs attention (8% repeat rate)
3. Small city customers are most loyal
4. Email signups mostly at checkout, not marketing
5. Mailchimp MEMBER_RATING not predictive

---

## Customer Segmentation

### Lifecycle Status (Days Since Last Order)
| Status | Days | Description |
|--------|------|-------------|
| Active | 0-30 | Within typical reorder window |
| Recent | 31-90 | Still engaged, approaching reorder |
| Cooling | 91-180 | Past typical interval, needs nudge |
| Lapsed | 181-365 | Significantly overdue |
| Dormant | 365+ | Unlikely to return without intervention |

### Customer Types

**Core Customers** (Israeli residents, self-purchase):
- `core.new` - 1 order only
- `core.repeat` - 2+ orders
- `core.vip` - Top 10% by total spend OR 5+ orders

**Non-Core** (tracked but not targeted for retention):
- `noncore.gift` - Different billing/shipping name OR foreign billing
- `noncore.war_support` - Used community support coupons

**Prospects** (no orders):
- `prospect.subscriber` - In Mailchimp, never ordered
- `prospect.fresh` - Subscribed <30 days ago
- `prospect.stale` - Subscribed 180+ days, never ordered

---

## Data Architecture

### SysContacts Schema (Primary Contact Record)

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| **Identity** |
| sc_Email | string | Orders/MC | **Primary Key** |
| sc_Name | string | Orders/MC | Display name |
| sc_Phone | string | Orders | Primary phone |
| sc_WhatsAppPhone | string | Derived | Phone formatted for WhatsApp |
| **Demographics** |
| sc_Language | string | Orders/MC | `EN` or `HE` |
| sc_City | string | Orders | Shipping city (raw) |
| sc_Country | string | Orders | Shipping country code |
| **Classification** |
| sc_CustomerType | string | Calc | See types above |
| sc_LifecycleStatus | string | Calc | Active/Recent/Cooling/Lapsed/Dormant |
| sc_IsCore | boolean | Calc | Not gift/war-support |
| sc_IsSubscribed | boolean | MC | Has Mailchimp subscription |
| **Purchase Metrics** |
| sc_FirstOrderDate | date | Orders | Earliest order |
| sc_LastOrderDate | date | Orders | Most recent order |
| sc_DaysSinceOrder | number | Calc | Updated daily |
| sc_OrderCount | number | Calc | Total completed orders |
| sc_TotalSpend | number | Calc | Sum of order totals |
| sc_AvgOrderValue | number | Calc | Average order |
| **Subscription** |
| sc_SubscribedDate | date | MC | When joined Mailchimp |
| sc_DaysSubscribed | number | Calc | Updated daily |
| sc_SubscriptionSource | string | MC | From NOTES field |
| **Engagement** |
| sc_LastContactDate | date | Activity | Last outreach sent |
| sc_LastContactType | string | Activity | whatsapp/email/mailchimp |
| **Predictions** |
| sc_NextOrderExpected | date | Calc | Based on historical frequency |
| sc_ChurnRisk | string | Calc | low/medium/high |
| **Wine Preferences** (calculated from order history) |
| sc_PreferredCategory | string | Calc | Primary: Dry Red, Dry White, Rosé, etc. |
| sc_SecondaryCategory | string | Calc | Secondary preference if mixed buyer |
| sc_PriceMin | number | Calc | Lowest bottle price purchased |
| sc_PriceMax | number | Calc | Highest bottle price purchased |
| sc_PriceMedian | number | Calc | Typical price point |
| sc_RedIntensityAvg | number | Calc | Avg intensity (1-5) of purchased reds |
| sc_RedComplexityAvg | number | Calc | Avg complexity (1-5) of purchased reds |
| sc_WhiteComplexityAvg | number | Calc | Avg complexity (1-5) of purchased whites |
| sc_WhiteAcidityAvg | number | Calc | Avg acidity (1-5) of purchased whites |
| sc_TopWineries | string | Calc | Top 3 wineries by purchase count |
| sc_KashrutPrefs | string | Calc | Observed patterns (mevushal, heter mechira) |
| sc_GrapeVarieties | string | Calc | Top grape varieties purchased |
| sc_BundleBuyer | boolean | Calc | Has purchased bundles |
| sc_AvgBottlesPerOrder | number | Calc | Typical order size |
| sc_NewWineryExplorer | boolean | Calc | Buys from 5+ different wineries |
| **System** |
| sc_Tags | string | Manual | Comma-separated tags |
| sc_Notes | string | Manual | Free-form notes |
| sc_CreatedDate | date | System | Record creation |
| sc_LastUpdated | date | System | Last refresh |

### SysContactActivity Schema (Timeline Events)

| Field | Type | Description |
|-------|------|-------------|
| sca_ActivityId | string | **Primary Key** |
| sca_Email | string | **FK to SysContacts** |
| sca_Timestamp | datetime | When event occurred |
| sca_Type | string | Event type (see below) |
| sca_Summary | string | Human-readable summary |
| sca_Details | string | JSON with type-specific data |
| sca_CreatedBy | string | system/user email |

**Activity Types:**
- `order.placed` - New order (details: orderId, total, itemCount, couponUsed)
- `bundle.purchased` - Bundle in order (details: orderId, bundleName, bundleId)
- `status.changed` - Lifecycle status change (details: from, to)
- `type.changed` - Customer type change (details: from, to)
- `comm.whatsapp` - WhatsApp exchange (details: template, outcome, notes)
- `comm.email` - Email sent (details: subject)
- `comm.mailchimp` - Included in Mailchimp segment export (details: segmentName)
- `coupon.offered` - Coupon shared with contact (details: code, channel, campaignName)
- `coupon.used` - Contact redeemed a coupon (details: code, orderId, discount)
- `note.added` - Manual note (details: note text)
- `mailchimp.subscribed` - New subscription detected
- `mailchimp.unsubscribed` - Subscription removed

**Wine Recommendation Logic:**

The attribute system enables precise suggestions:
- For Dry Red buyers: Match on category + price range + intensity + complexity
- For Dry White buyers: Match on category + price range + complexity + acidity
- Cross-sell: Same winery, different category
- Upsell: Same profile, higher price tier
- Explore: New winery with matching attribute profile

### SysCoupons Schema (Coupon Reference)

Imported from WooCommerce coupon export (`coupon_export_*.csv`).

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| sco_Code | string | post_title | **Primary Key** |
| sco_WooId | number | ID | WooCommerce ID |
| sco_Description | string | post_excerpt | Description |
| sco_Status | string | post_status | publish/draft/trash |
| sco_CreatedDate | date | post_date | Created date |
| **Discount** |
| sco_DiscountType | string | discount_type | percent, fixed_cart, fixed_product |
| sco_Amount | number | coupon_amount | Discount value |
| sco_FreeShipping | boolean | free_shipping | Includes free shipping |
| **Restrictions** |
| sco_MinSpend | number | minimum_amount | Minimum cart |
| sco_MaxSpend | number | maximum_amount | Maximum cart |
| sco_Categories | string | product_categories | Restricted categories |
| sco_FirstPurchaseOnly | boolean | meta:_wjecf_first_purchase_only | New customers only |
| sco_FreeProductId | string | meta:_wjecf_free_product_ids | Free gift product |
| **Limits** |
| sco_UsageLimit | number | usage_limit | Max uses (0=unlimited) |
| sco_UsageLimitPerUser | number | usage_limit_per_user | Per customer limit |
| sco_UsageCount | number | usage_count | Times used |
| sco_ExpiryDate | date | date_expires | Expiration |
| **Classification** |
| sco_Tags | string | *Derived* | war-support, welcome, threshold, gift |
| sco_IsActive | boolean | *Calc* | Usable now |
| sco_LastImported | date | *System* | Last sync |

**Auto-Tag Rules:**
- `war-support`: efrat, roshtzurim, gushwarriors, gush, tekoa
- `welcome`: FirstPurchaseOnly=true
- `threshold`: MinSpend > 0
- `gift`: FreeProductId set
- `shipping-only`: FreeShipping=true AND Amount=0

### SysCampaigns Schema (Mailchimp Campaigns)

Imported from Mailchimp campaign export (`mailchimp campaigns.csv`).

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| scm_CampaignId | string | Unique Id | **Primary Key** |
| scm_Title | string | Title | Internal title |
| scm_Subject | string | Subject | Email subject line |
| scm_SendDate | date | Send Date | When sent |
| scm_SendWeekday | string | Send Weekday | Day of week |
| **Delivery** |
| scm_Recipients | number | Total Recipients | Audience size |
| scm_Delivered | number | Successful Deliveries | Delivered count |
| scm_Bounces | number | Total Bounces | Hard + soft |
| **Engagement** |
| scm_UniqueOpens | number | Unique Opens | Unique openers |
| scm_OpenRate | number | Open Rate | Open % |
| scm_TotalOpens | number | Total Opens | All opens |
| scm_UniqueClicks | number | Unique Clicks | Unique clickers |
| scm_ClickRate | number | Click Rate | Click % |
| scm_TotalClicks | number | Total Clicks | All clicks |
| scm_Unsubscribes | number | Unsubscribes | Unsubscribe count |
| **Revenue** |
| scm_TotalOrders | number | Total Orders | Orders attributed |
| scm_GrossSales | number | Total Gross Sales | Revenue generated |
| scm_Revenue | number | Total Revenue | Net revenue |
| **Classification** |
| scm_CampaignType | string | *Derived* | seasonal, value, explore, bundle |
| scm_LastImported | date | *System* | Last sync |

**Campaign Type Detection** (from Title):
- `seasonal`: Contains holiday names (Rosh, Pesach, Chanukah, Purim, Shavuot, Sukkot)
- `value`: Title contains "value" or "bargain"
- `explore`: Title contains "explore"
- `bundle`: Title contains "bundle"
- `news`: Title contains "news" or "update"

### SysCouponUsage Schema (Coupon Performance)

Built from order history - tracks each coupon use.

| Field | Type | Description |
|-------|------|-------------|
| scu_Id | string | **Primary Key** |
| scu_Code | string | **FK to SysCoupons** |
| scu_Email | string | **FK to SysContacts** |
| scu_OrderId | string | Order ID |
| scu_OrderDate | date | Order date |
| scu_DiscountAmount | number | Discount given |
| scu_OrderTotal | number | Order total after discount |
| scu_WasFirstOrder | boolean | Customer's first order? |
| scu_ConvertedToRepeat | boolean | Ordered again within 90 days? |

---

## Contact List View (Phase 4)

### Layout
```
+----------------------------------------------------------+
| CONTACTS                                    [Export] [+]  |
+----------------------------------------------------------+
| Filters: [Type ▼] [Status ▼] [Language ▼] [Subscribed ▼] |
|          [Search by name/email...              ] [Clear] |
+----------------------------------------------------------+
| Name          | Type      | Status  | Orders | Last      |
|---------------|-----------|---------|--------|-----------|
| יוסי כהן      | core.rep  | Cooling | 4      | 92 days   |
| Sarah Miller  | core.new  | Active  | 1      | 12 days   |
| ...           |           |         |        |           |
+----------------------------------------------------------+
```

### Contact Detail Panel (Right Side)
```
+----------------------------------------+
| YOSSI COHEN                    [Close] |
| yossi@example.com                      |
| 052-123-4567                           |
+----------------------------------------+
| [WhatsApp] [Email] [Add Note]          |
+----------------------------------------+
| METRICS                                |
| Type: core.repeat    Status: Cooling   |
| Orders: 4            Total: ₪2,340     |
| Last Order: 92 days ago                |
| Next Expected: Overdue by 44 days      |
+----------------------------------------+
| WINE PREFERENCES                       |
| Types: Red, White                      |
| Range: Mid-range (₪50-100)             |
| Favorites: Golan Heights, Teperberg    |
+----------------------------------------+
| ACTIVITY TIMELINE                      |
| Dec 15: Status changed Active→Cooling  |
| Sep 18: Order #12345 (₪580)            |
| Sep 01: WhatsApp sent (reorder)        |
| Jun 22: Order #11234 (₪420)            |
| ...                                    |
+----------------------------------------+
| TAGS: [VIP] [wine-club-interest] [+]   |
+----------------------------------------+
| NOTES                                  |
| Prefers delivery on Thursdays          |
| [Add note...]                          |
+----------------------------------------+
```

---

## Communication Features

### WhatsApp Integration

**How it works:**
1. User selects contact(s) in list view
2. Clicks "WhatsApp" button
3. System generates message from template
4. Opens WhatsApp Web/app with pre-filled message
5. User sends manually (no automation - personal touch)
6. Activity logged after send confirmation

**Message Templates** (stored in SysConfig):
```
template.whatsapp.reorder_reminder:
  name_en: "Reorder Reminder"
  name_he: "תזכורת להזמנה"
  body_en: "Hi {name}, it's been a while since your last order! We have some new arrivals from {favorite_winery} that might interest you. Let me know if you'd like recommendations. - JLMwines"
  body_he: "היי {name}, עבר זמן מההזמנה האחרונה שלך! יש לנו כמה יינות חדשים מ{favorite_winery} שאולי יעניינו אותך. ספר לי אם תרצה המלצות. - JLMwines"

template.whatsapp.welcome:
  name_en: "Welcome"
  body_en: "Hi {name}, thank you for your first order! I hope you enjoy the wines. Feel free to reach out if you have any questions. - JLMwines"

template.whatsapp.cooling_nudge:
  name_en: "Gentle Nudge"
  body_en: "Hi {name}, we've missed you! Your favorites from {favorite_winery} are in stock. Would you like me to put together a selection for you?"
```

**WhatsApp Phone Formatting:**
- Israeli numbers: Remove leading 0, add +972
- International: Keep as-is with +

### Year in Wine Summary

A personalized annual recap for each contact - engaging, shareable, builds relationship.

**Data Points Used:**
- Total orders & bottles
- Total spend
- Favorite category (most purchased)
- Top winery
- Taste profile summary
- New discoveries (first-time wineries)
- Price range
- Comparison to previous year (if repeat customer)

**English Template:**
```
🍷 Your 2024 Year in Wine 🍷

Hi {name},

What a year! Here's your JLMwines journey:

📦 {order_count} orders | {bottle_count} bottles | ₪{total_spend}

🏆 YOUR FAVORITES
• Go-to category: {preferred_category}
• Top winery: {top_winery}
• Your style: {taste_summary}

{if_new_discoveries}
🌟 NEW DISCOVERIES
You explored {new_winery_count} new wineries this year, including {new_winery_example}
{/if}

{if_repeat_customer}
📈 VS LAST YEAR
{year_comparison}
{/if}

🔮 FOR 2025
Based on your taste, I think you'd love {recommendation}

Thank you for being part of our wine community!

L'chaim! 🥂
- JLMwines
```

**Hebrew Template:**
```
🍷 השנה שלך ביין 2024 🍷

היי {name},

איזו שנה! הנה המסע שלך עם JLMwines:

📦 {order_count} הזמנות | {bottle_count} בקבוקים | ₪{total_spend}

🏆 המועדפים שלך
• הקטגוריה האהובה: {preferred_category}
• היקב המוביל: {top_winery}
• הסגנון שלך: {taste_summary}

{if_new_discoveries}
🌟 גילויים חדשים
גילית {new_winery_count} יקבים חדשים השנה, כולל {new_winery_example}
{/if}

{if_repeat_customer}
📈 לעומת שנה שעברה
{year_comparison}
{/if}

🔮 ל-2025
בהתאם לטעם שלך, אני חושב שתאהב את {recommendation}

תודה שאת/ה חלק מקהילת היין שלנו!

לחיים! 🥂
- JLMwines
```

**Taste Summary Examples:**
| Profile | English | Hebrew |
|---------|---------|--------|
| High intensity + complexity | "Bold & complex - you like wines that make a statement" | "עוצמתי ומורכב - את/ה אוהב/ת יינות עם אופי" |
| Low intensity, high complexity | "Elegant & nuanced - you appreciate subtlety" | "אלגנטי ועדין - את/ה מעריך/ה ניואנסים" |
| High acidity whites | "Crisp & refreshing - you love bright, zesty whites" | "פריך ורענן - את/ה אוהב/ת לבנים חיים" |
| Mixed categories | "The Explorer - you enjoy variety across styles" | "החוקר/ת - את/ה נהנה/ית ממגוון סגנונות" |
| Budget-focused | "Smart sipper - great taste at great value" | "טעם חכם - יינות מעולים במחיר נוח" |
| Premium buyer | "The Connoisseur - you invest in excellence" | "המבין/ה - את/ה משקיע/ה באיכות" |

**Year Comparison Examples:**
- "You ordered 2 more times than last year!"
- "Your average order grew from ₪450 to ₪580"
- "You discovered 3 new wineries"
- "You tried white wines for the first time!"

**Generation Logic:**
```javascript
function generateYearInWine(contact, year) {
  // Pull order history for contact in year
  // Calculate stats
  // Select appropriate taste_summary based on profile
  // Generate conditional sections
  // Return filled template in contact's language
}
```

### Email Integration

**Simple approach:**
- Button generates `mailto:` link with subject/body
- Opens user's default email client
- Activity logged when user confirms send

**Future enhancement:**
- Google Workspace integration for send-from-app
- Email templates

### Mailchimp Segment Export

**Workflow:**
1. User filters contacts (e.g., "Cooling" + "Hebrew" + "Subscribed")
2. Clicks "Export for Mailchimp"
3. System generates CSV with required Mailchimp fields
4. User downloads and imports to Mailchimp
5. Activity logged for all exported contacts

**Export fields:**
- Email Address, First Name, Last Name
- TAGS (add segment name as tag)
- Custom fields: CustomerType, LastOrderDays, TotalSpend

---

## Smart Features

### Churn Risk Calculation

Simple heuristic based on:
- Days since last order vs historical frequency
- Order count (single-order = higher risk)
- Total spend (higher spend = lower risk)

```
Risk = LOW if:
  - DaysSinceOrder < HistoricalAvgInterval * 1.5
  - AND (OrderCount > 2 OR TotalSpend > 1000)

Risk = HIGH if:
  - DaysSinceOrder > HistoricalAvgInterval * 2
  - OR (OrderCount == 1 AND DaysSinceOrder > 90)

Risk = MEDIUM otherwise
```

### Next Order Prediction

```
For repeat customers:
  NextExpected = LastOrderDate + PersonalAvgInterval

For single-order customers:
  NextExpected = LastOrderDate + GlobalMedianInterval (48 days)
```

### Auto-Tags (Generated from Behavior)

| Tag | Criteria |
|-----|----------|
| `bundle-buyer` | Has purchased any bundle product |
| `gift-giver` | Has orders with different billing/shipping |
| `holiday-orderer` | Orders within 2 weeks of Rosh Hashana/Pesach |
| `high-value` | Top 20% by total spend |
| `frequent` | Orders more than 4x per year |
| `price-sensitive` | Uses coupons on >50% of orders |

---

## Task Types (CRM-Specific)

| Task Type | Trigger | Priority | Description |
|-----------|---------|----------|-------------|
| `task.crm.cooling_repeat` | Repeat customer hits 91 days | High | Personal outreach needed |
| `task.crm.lapsed_repeat` | Repeat customer hits 181 days | Normal | Win-back attempt |
| `task.crm.welcome_followup` | New customer at 14 days | Normal | Check satisfaction |
| `task.crm.vip_attention` | VIP customer hits 60 days | High | Don't lose VIPs |
| `task.crm.convert_subscriber` | Subscriber at 90 days, no order | Low | Newsletter conversion |
| `task.crm.capture_email` | Core customer not in Mailchimp | Low | Build email list |

---

## Dashboard Integration

### CRM Widget (Dashboard v2)

```
+----------------------------------------+
| CUSTOMER HEALTH                        |
+----------------------------------------+
| Active Customers      | 20   (+3)      |
| Cooling (need nudge)  | 15   [View]    |
| Lapsed (win-back)     | 29   [View]    |
+----------------------------------------+
| PENDING OUTREACH                       |
| WhatsApp pending      | 8              |
| Welcome follow-ups    | 3              |
+----------------------------------------+
| QUICK STATS                            |
| Repeat rate (90-day)  | 28%            |
| Avg order value       | ₪542           |
+----------------------------------------+
```

---

## Implementation Phases

### Phase 1: Data Foundation

**Decisions:**
- Import ALL historical orders (full history)
- Orders use upsert model - full history always available
- Contact phone = most recent billing phone from orders

**Tasks:**
1. Create sheets:
   - SysContacts (contact records)
   - SysContactActivity (timeline events)
   - SysCoupons (coupon reference)
   - SysCampaigns (Mailchimp campaigns)
   - SysCouponUsage (redemption tracking)
2. Add schemas to DATA_MODEL.md
3. Add sheet names and prefixes to config/schemas.json
4. Build ContactService.js:
   - `importFromOrders()` - Full history, upsert by email
   - `importFromMailchimp()` - Add subscriber data
   - `mergeContacts()` - Deduplicate by email, keep most recent phone
   - `calculateMetrics()` - Compute derived fields
   - `classifyCustomer()` - Determine type (core/gift/war-support)
5. Build CouponService.js:
   - `importCoupons()` - Load from WooCommerce export
   - `importCampaigns()` - Load from Mailchimp export
   - `buildUsageHistory()` - Extract from order coupon_items

**Field Mappings:**

#### Mapping 1: Order Export → SysContacts

Source: `order_export_*.csv`
Strategy: Aggregate by `customer_email`, keep most recent values

| Source Column | Target Field | Notes |
|---------------|--------------|-------|
| `customer_email` | `sc_Email` | **Primary Key** (lowercase, trim) |
| `billing_first_name` + `billing_last_name` | `sc_Name` | Most recent order |
| `billing_phone` | `sc_Phone` | Most recent order |
| `billing_phone` | `sc_WhatsAppPhone` | Format: 05x→+9725x |
| `meta:wpml_language` | `sc_Language` | `en`→`EN`, `he`→`HE` |
| `shipping_city` | `sc_City` | Most recent order |
| `shipping_country` | `sc_Country` | Most recent order |
| `billing_country` ≠ `shipping_country` | `sc_IsCore` | FALSE if different (gift) |
| `billing_last_name` ≠ `shipping_last_name` | `sc_IsCore` | FALSE if different (gift) |
| `coupon_items` contains war coupons | `sc_IsCore` | FALSE if war-support |
| MIN(`order_date`) | `sc_FirstOrderDate` | Earliest order |
| MAX(`order_date`) | `sc_LastOrderDate` | Most recent order |
| COUNT(*) | `sc_OrderCount` | Completed orders only |
| SUM(`order_total`) | `sc_TotalSpend` | Completed orders only |
| AVG(`order_total`) | `sc_AvgOrderValue` | Calculated |

**Order Status Filter:** Only include orders with `status` = `completed`

**War-Support Coupons:** `efrat`, `roshtzurim`, `gushwarriors`, `gush`, `tekoa`

**Gift Detection Logic:**
```javascript
function isGiftOrder(order) {
  // Different countries
  if (order.billing_country !== order.shipping_country) return true;

  // Different last names (fuzzy)
  const billName = order.billing_last_name.toLowerCase().trim();
  const shipName = order.shipping_last_name.toLowerCase().trim();
  if (billName !== shipName && billName.length > 0 && shipName.length > 0) return true;

  return false;
}
```

**Coupon Extraction:**
```javascript
// coupon_items format: "code:SHIPFREE|amount:0.00;code:WELCOME10|amount:44.03"
function extractCoupons(couponItems) {
  if (!couponItems) return [];
  return couponItems.split(';').map(item => {
    const match = item.match(/code:([^|]+)/);
    return match ? match[1].toLowerCase() : null;
  }).filter(Boolean);
}
```

#### Mapping 2: Mailchimp Export → SysContacts

Source: `subscribed_email_audience_export_*.csv`
Strategy: Upsert by email, add subscriber data to existing contacts or create new

| Source Column | Target Field | Notes |
|---------------|--------------|-------|
| `Email Address` | `sc_Email` | **Primary Key** (lowercase, trim) |
| `First Name` + `Last Name` | `sc_Name` | Only if sc_Name empty |
| `Phone Number` | `sc_Phone` | Only if sc_Phone empty |
| `Language` | `sc_Language` | `English`→`EN`, `Hebrew`→`HE` |
| `Address` | `sc_City` | Parse city from address (if possible) |
| `CC` | `sc_Country` | Country code |
| (exists in MC) | `sc_IsSubscribed` | TRUE |
| `OPTIN_TIME` or `CONFIRM_TIME` | `sc_SubscribedDate` | Prefer CONFIRM_TIME |
| `NOTES` | `sc_SubscriptionSource` | Extract "Subscribed via..." |

**Subscription Source Extraction:**
```javascript
// NOTES format: "[2023-01-26 14:00:41] Subscribed via Divi Builder."
function extractSubscriptionSource(notes) {
  if (!notes) return null;
  const match = notes.match(/Subscribed via ([^.]+)/);
  return match ? match[1].trim() : 'Unknown';
}
```

**New Contact from Mailchimp:**
- `sc_IsCustomer` = FALSE
- `sc_CustomerType` = `prospect.subscriber`
- `sc_IsCore` = FALSE (no orders yet)

#### Mapping 3: Coupon Export → SysCoupons

Source: `coupon_export_*.csv`

| Source Column | Target Field | Notes |
|---------------|--------------|-------|
| `post_title` | `sco_Code` | **Primary Key** (as-is, case-sensitive) |
| `ID` | `sco_WooId` | Integer |
| `post_excerpt` | `sco_Description` | |
| `post_status` | `sco_Status` | publish/draft/trash |
| `post_date` | `sco_CreatedDate` | Parse datetime |
| `discount_type` | `sco_DiscountType` | percent/fixed_cart/fixed_product |
| `coupon_amount` | `sco_Amount` | Number |
| `free_shipping` | `sco_FreeShipping` | `yes`→TRUE |
| `individual_use` | `sco_IndividualUse` | `yes`→TRUE |
| `minimum_amount` | `sco_MinSpend` | Number, empty→0 |
| `maximum_amount` | `sco_MaxSpend` | Number, empty→NULL |
| `product_categories` | `sco_Categories` | As-is |
| `meta:_wjecf_first_purchase_only` | `sco_FirstPurchaseOnly` | `yes`→TRUE |
| `meta:_wjecf_free_product_ids` | `sco_FreeProductId` | First ID if multiple |
| `usage_limit` | `sco_UsageLimit` | Number, 0=unlimited |
| `usage_limit_per_user` | `sco_UsageLimitPerUser` | Number |
| `usage_count` | `sco_UsageCount` | Number |
| `date_expires` | `sco_ExpiryDate` | Parse date |
| `customer_email` | `sco_CustomerEmail` | For email-restricted coupons |

**Auto-Tag Derivation:**
```javascript
function deriveCouponTags(coupon) {
  const tags = [];
  const code = coupon.sco_Code.toLowerCase();

  // War-support
  if (['efrat', 'roshtzurim', 'gushwarriors', 'gush', 'tekoa'].some(w => code.includes(w))) {
    tags.push('war-support');
  }

  // Welcome/first-purchase
  if (coupon.sco_FirstPurchaseOnly || code.includes('welcome')) {
    tags.push('welcome');
  }

  // Threshold
  if (coupon.sco_MinSpend > 0) {
    tags.push('threshold');
  }

  // Gift
  if (coupon.sco_FreeProductId) {
    tags.push('gift');
  }

  // Shipping-only
  if (coupon.sco_FreeShipping && coupon.sco_Amount === 0) {
    tags.push('shipping-only');
  }

  return tags.join(',');
}
```

**IsActive Calculation:**
```javascript
function isCouponActive(coupon) {
  if (coupon.sco_Status !== 'publish') return false;
  if (coupon.sco_ExpiryDate && coupon.sco_ExpiryDate < new Date()) return false;
  if (coupon.sco_UsageLimit > 0 && coupon.sco_UsageCount >= coupon.sco_UsageLimit) return false;
  return true;
}
```

#### Mapping 4: Campaign Export → SysCampaigns

Source: `mailchimp campaigns.csv`

| Source Column | Target Field | Notes |
|---------------|--------------|-------|
| `Unique Id` | `scm_CampaignId` | **Primary Key** |
| `Title` | `scm_Title` | |
| `Subject` | `scm_Subject` | |
| `Send Date` | `scm_SendDate` | Parse "Mon DD, YYYY HH:MM pm" |
| `Send Weekday` | `scm_SendWeekday` | |
| `Total Recipients` | `scm_Recipients` | Integer |
| `Successful Deliveries` | `scm_Delivered` | Integer |
| `Total Bounces` | `scm_Bounces` | Integer |
| `Unique Opens` | `scm_UniqueOpens` | Integer |
| `Open Rate` | `scm_OpenRate` | Parse "XX.XX%" → decimal |
| `Total Opens` | `scm_TotalOpens` | Integer |
| `Unique Clicks` | `scm_UniqueClicks` | Integer |
| `Click Rate` | `scm_ClickRate` | Parse "XX.XX%" → decimal |
| `Total Clicks` | `scm_TotalClicks` | Integer |
| `Unsubscribes` | `scm_Unsubscribes` | Integer |
| `Total Orders` | `scm_TotalOrders` | Integer |
| `Total Gross Sales` | `scm_GrossSales` | Number |
| `Total Revenue` | `scm_Revenue` | Number |

**Campaign Type Derivation:**
```javascript
function deriveCampaignType(title) {
  const t = title.toLowerCase();

  // Seasonal (check first - most specific)
  const holidays = ['rosh', 'pesach', 'chanukah', 'purim', 'shavuot', 'sukkot', 'seder', 'year'];
  if (holidays.some(h => t.includes(h))) return 'seasonal';

  // Value
  if (t.includes('value') || t.includes('bargain')) return 'value';

  // Explore
  if (t.includes('explore')) return 'explore';

  // Bundle
  if (t.includes('bundle')) return 'bundle';

  // News
  if (t.includes('news') || t.includes('update')) return 'news';

  return 'general';
}
```

**Date Parsing:**
```javascript
// Format: "Jun 29, 2021 05:16 pm"
function parseMailchimpDate(dateStr) {
  return new Date(dateStr);  // JavaScript handles this format
}

// Format: "47.54%"
function parsePercent(pctStr) {
  if (!pctStr || pctStr === 'n/a') return null;
  return parseFloat(pctStr.replace('%', '')) / 100;
}
```

#### Mapping 5: Order Export → SysContactActivity

For each order, create activity record:

| Derived | Target Field | Notes |
|---------|--------------|-------|
| UUID | `sca_ActivityId` | Generate unique ID |
| `customer_email` | `sca_Email` | Lowercase |
| `order_date` | `sca_Timestamp` | |
| `'order.placed'` | `sca_Type` | |
| `'Order #' + order_number` | `sca_Summary` | |
| JSON object | `sca_Details` | See below |
| `'system'` | `sca_CreatedBy` | |

**Activity Details JSON:**
```javascript
{
  orderId: order.order_id,
  orderNumber: order.order_number,
  total: order.order_total,
  itemCount: countLineItems(order),
  couponUsed: extractCoupons(order.coupon_items)[0] || null
}
```

#### Mapping 6: Order Export → SysCouponUsage

For each order with coupon, create usage record:

| Derived | Target Field | Notes |
|---------|--------------|-------|
| UUID | `scu_Id` | Generate unique ID |
| Coupon code | `scu_Code` | From coupon_items |
| `customer_email` | `scu_Email` | Lowercase |
| `order_id` | `scu_OrderId` | |
| `order_date` | `scu_OrderDate` | |
| Discount amount | `scu_DiscountAmount` | From coupon_items |
| `order_total` | `scu_OrderTotal` | |
| First order check | `scu_WasFirstOrder` | Is this customer's first order? |
| Repeat check | `scu_ConvertedToRepeat` | Did they order again within 90 days? |

### Phase 2: Daily Refresh

**Decisions:**
- Runs with other overnight housekeeping
- Status changes: LOG only, do NOT auto-create tasks
- User can request task generation on-demand if relevant
- Dashboard stats: growth KPIs, sales metrics, email subscriber counts

**Tasks:**
1. Add contact refresh to HousekeepingService (with existing overnight jobs)
2. Detect new orders → update metrics
3. Detect status changes → log activity (no auto-task creation)
4. Update predictions (NextOrderExpected, ChurnRisk)
5. Generate auto-tags
6. Report CRM health stats to dashboard:
   - Customer count by type/status
   - New customers (period)
   - Subscriber growth
   - Revenue metrics

### Phase 3: Task & Campaign System

**Design Philosophy:**
- Campaigns are the action unit, not individual contacts
- Tasks guide workflows, don't flood the system
- Content lives externally (Google Docs, website) - system orchestrates
- One weekly review task suggests campaigns, not per-contact tasks

**Decisions:**
- Weekly singleton task shows CRM health, suggests campaign opportunities
- Campaign = Project with workflow tasks
- Content tasks link to external URLs (Google Docs, images)
- `st_LinkedEntityType` = `asset_url` for content tasks
- `st_LinkedEntityId` = the external URL

---

#### Task Categories

**1. Weekly Review (Singleton)**
One task, regenerated weekly, shows aggregate CRM health.

**2. Campaign Project Tasks**
Created when user initiates a campaign - guides through the workflow.

**3. Content Tasks**
Reusable for any content creation (campaigns, bundles, coupons, posts).

---

#### Task Definitions JSON (config/taskDefinitions.json)

```json
[
    "task.template",
    "task.crm.weekly_review",
    "Weekly CRM review - shows customer health metrics and suggests campaign opportunities.",
    "stable",
    "topic", "CRM",
    "default_priority", "Normal",
    "initial_status", "New",
    "flow_pattern", "manager_direct",
    "due_pattern", "one_week"
],
[
    "task.template",
    "task.campaign.define",
    "Define campaign audience and goals.",
    "stable",
    "topic", "Campaign",
    "default_priority", "Normal",
    "initial_status", "New",
    "flow_pattern", "admin_direct",
    "due_pattern", "next_business_day"
],
[
    "task.template",
    "task.campaign.export",
    "Export audience list for Mailchimp or other channel.",
    "stable",
    "topic", "Campaign",
    "default_priority", "Normal",
    "initial_status", "New",
    "flow_pattern", "admin_direct",
    "due_pattern", "next_business_day"
],
[
    "task.template",
    "task.campaign.execute",
    "Send campaign via Mailchimp, WhatsApp, or other channel.",
    "stable",
    "topic", "Campaign",
    "default_priority", "High",
    "initial_status", "New",
    "flow_pattern", "admin_direct",
    "due_pattern", "immediate"
],
[
    "task.template",
    "task.campaign.record",
    "Log campaign activity to all targeted contacts.",
    "stable",
    "topic", "Campaign",
    "default_priority", "Normal",
    "initial_status", "New",
    "flow_pattern", "admin_direct",
    "due_pattern", "next_business_day"
],
[
    "task.template",
    "task.content.draft",
    "Create initial content draft.",
    "stable",
    "topic", "Content",
    "default_priority", "Normal",
    "initial_status", "New",
    "flow_pattern", "admin_direct",
    "due_pattern", "one_week"
],
[
    "task.template",
    "task.content.edit",
    "Review and refine content.",
    "stable",
    "topic", "Content",
    "default_priority", "Normal",
    "initial_status", "New",
    "flow_pattern", "admin_direct",
    "due_pattern", "next_business_day"
],
[
    "task.template",
    "task.content.translate",
    "Translate content to other language.",
    "stable",
    "topic", "Content",
    "default_priority", "Normal",
    "initial_status", "New",
    "flow_pattern", "admin_direct",
    "due_pattern", "one_week"
],
[
    "task.template",
    "task.content.imagery",
    "Source or create images for content.",
    "stable",
    "topic", "Content",
    "default_priority", "Normal",
    "initial_status", "New",
    "flow_pattern", "admin_direct",
    "due_pattern", "one_week"
],
[
    "task.template",
    "task.content.approve",
    "Manager approval of final content.",
    "stable",
    "topic", "Content",
    "default_priority", "High",
    "initial_status", "New",
    "flow_pattern", "manager_direct",
    "due_pattern", "next_business_day"
],
[
    "task.template",
    "task.content.publish",
    "Post or schedule approved content.",
    "stable",
    "topic", "Content",
    "default_priority", "Normal",
    "initial_status", "New",
    "flow_pattern", "admin_direct",
    "due_pattern", "immediate"
]
```

---

#### Weekly Review Task

**Purpose:** Single task showing CRM health, regenerated each week.

**Summary Format:**
```
CRM Review: 15 cooling, 8 lapsed, 2 VIP, 3 welcome
```

**Notes JSON:**
```json
{
  "generatedDate": "2025-12-18",
  "audiences": {
    "cooling_repeat": { "count": 15, "filter": "status=Cooling&type=core.repeat" },
    "lapsed_repeat": { "count": 8, "filter": "status=Lapsed&type=core.repeat" },
    "vip_attention": { "count": 2, "filter": "type=core.vip&daysSince>60" },
    "welcome_followup": { "count": 3, "filter": "type=core.new&daysSince=14" },
    "convert_subscriber": { "count": 25, "filter": "type=prospect.subscriber&daysSubscribed>90" },
    "capture_email": { "count": 12, "filter": "isCore=true&isSubscribed=false" }
  },
  "suggestions": [
    { "audience": "cooling_repeat", "action": "Re-engagement email with personal touch" },
    { "audience": "vip_attention", "action": "WhatsApp check-in, offer preview of new arrivals" }
  ]
}
```

**Linked Entity:** None (singleton task)

**Generation Logic:**
```javascript
function generateWeeklyReviewTask() {
  // Close any existing open review task
  closeOpenReviewTasks();

  // Calculate audience counts
  const audiences = calculateAudienceCounts();

  // Generate suggestions based on counts and patterns
  const suggestions = generateCampaignSuggestions(audiences);

  // Build summary
  const parts = [];
  if (audiences.cooling_repeat.count > 0) parts.push(`${audiences.cooling_repeat.count} cooling`);
  if (audiences.lapsed_repeat.count > 0) parts.push(`${audiences.lapsed_repeat.count} lapsed`);
  if (audiences.vip_attention.count > 0) parts.push(`${audiences.vip_attention.count} VIP`);
  if (audiences.welcome_followup.count > 0) parts.push(`${audiences.welcome_followup.count} welcome`);

  const summary = `CRM Review: ${parts.join(', ')}`;

  return TaskService.createTask({
    st_TaskTypeId: 'task.crm.weekly_review',
    st_ProjectId: getCrmProjectId(),
    st_Summary: summary,
    st_Notes: JSON.stringify({ generatedDate: new Date().toISOString().split('T')[0], audiences, suggestions }),
    st_Priority: 'Normal',
    st_Status: 'New'
  });
}
```

---

#### Campaign Project Workflow

When user decides to run a campaign, system creates a project with guided tasks.

**Campaign Types:**
- `retention` - Re-engage cooling/lapsed customers
- `welcome` - New customer follow-up series
- `vip` - VIP attention and exclusive offers
- `conversion` - Turn subscribers into customers
- `seasonal` - Holiday promotions
- `product` - New product/bundle announcements

**Project Creation:**
```javascript
function createCampaignProject(campaignType, audience, options = {}) {
  const project = ProjectService.createProject({
    sp_Name: options.name || `Campaign: ${campaignType} - ${new Date().toISOString().split('T')[0]}`,
    sp_Description: options.description || `${campaignType} campaign targeting ${audience.count} contacts`,
    sp_Type: 'CAMPAIGN',
    sp_Status: 'Active'
  });

  const projectId = project.sp_ProjectId;

  // Create workflow tasks
  const tasks = [];

  // 1. Define audience
  tasks.push(createTask(projectId, 'task.campaign.define', {
    summary: `Define audience: ${audience.name} (${audience.count} contacts)`,
    notes: { audienceFilter: audience.filter, estimatedCount: audience.count }
  }));

  // 2. Content tasks (if content needed)
  if (options.needsContent !== false) {
    const docUrl = options.docUrl || createContentDoc(project.sp_Name);

    tasks.push(createTask(projectId, 'task.content.draft', {
      summary: `Draft: ${campaignType} message`,
      linkedEntityType: 'asset_url',
      linkedEntityId: docUrl,
      notes: { assetType: 'campaign_content', languages: ['EN', 'HE'] }
    }));

    tasks.push(createTask(projectId, 'task.content.edit', {
      summary: `Edit: ${campaignType} message`,
      linkedEntityType: 'asset_url',
      linkedEntityId: docUrl,
      notes: { assetType: 'campaign_content' }
    }));

    tasks.push(createTask(projectId, 'task.content.translate', {
      summary: `Translate: ${campaignType} message`,
      linkedEntityType: 'asset_url',
      linkedEntityId: docUrl,
      notes: { assetType: 'campaign_content', targetLanguage: 'HE' }
    }));

    if (options.needsImagery) {
      tasks.push(createTask(projectId, 'task.content.imagery', {
        summary: `Images: ${campaignType} campaign`,
        notes: { assetType: 'campaign_imagery' }
      }));
    }

    tasks.push(createTask(projectId, 'task.content.approve', {
      summary: `Approve: ${campaignType} content`,
      linkedEntityType: 'asset_url',
      linkedEntityId: docUrl,
      notes: { assetType: 'campaign_content' }
    }));
  }

  // 3. Export audience
  tasks.push(createTask(projectId, 'task.campaign.export', {
    summary: `Export: ${audience.count} contacts for Mailchimp`,
    notes: { audienceFilter: audience.filter, format: 'mailchimp_csv' }
  }));

  // 4. Execute
  tasks.push(createTask(projectId, 'task.campaign.execute', {
    summary: `Send: ${campaignType} campaign`,
    notes: { channel: options.channel || 'mailchimp' }
  }));

  // 5. Record activity
  tasks.push(createTask(projectId, 'task.campaign.record', {
    summary: `Log activity for ${audience.count} contacts`,
    notes: { audienceFilter: audience.filter, activityType: 'comm.mailchimp' }
  }));

  return { project, tasks };
}
```

---

#### Content Task Details

Content tasks link to external assets. The system tracks workflow state, not content.

**Linked Entity Pattern:**
- `st_LinkedEntityType` = `asset_url`
- `st_LinkedEntityId` = URL to Google Doc, image, etc.

**Task Notes JSON:**
```json
{
  "assetType": "campaign_content",
  "parentType": "campaign",
  "parentId": "project_123",
  "languages": ["EN", "HE"],
  "channel": "email"
}
```

**Asset Types:**
| Type | Description | Typical Location |
|------|-------------|------------------|
| `campaign_content` | Email/message text | Google Doc |
| `campaign_imagery` | Hero images, banners | Website media library |
| `bundle_description` | Bundle marketing text | Google Doc |
| `coupon_text` | Coupon offer description | Google Doc |
| `social_post` | Social media content | Google Doc or direct |
| `blog_post` | Blog article | Google Doc |

**Content Workflow Roles:**
1. **Admin** creates draft (task.content.draft)
2. **Admin/Editor** refines (task.content.edit)
3. **Translator** localizes (task.content.translate)
4. **Manager** approves final (task.content.approve)
5. **Admin** publishes/schedules (task.content.publish)

---

#### Audience Definitions

Standard audience filters for campaign targeting:

```javascript
const AUDIENCE_DEFINITIONS = {
  cooling_repeat: {
    name: 'Cooling Repeat Customers',
    description: 'Repeat customers 91-180 days since last order',
    filter: (c) => c.sc_OrderCount >= 2 && c.sc_DaysSinceOrder >= 91 && c.sc_DaysSinceOrder <= 180 && c.sc_IsCore,
    suggestedCampaign: 'retention',
    suggestedChannel: 'email'
  },

  lapsed_repeat: {
    name: 'Lapsed Repeat Customers',
    description: 'Repeat customers 181-365 days since last order',
    filter: (c) => c.sc_OrderCount >= 2 && c.sc_DaysSinceOrder >= 181 && c.sc_DaysSinceOrder <= 365 && c.sc_IsCore,
    suggestedCampaign: 'retention',
    suggestedChannel: 'email'
  },

  vip_attention: {
    name: 'VIP Needing Attention',
    description: 'VIP customers over 60 days since last order',
    filter: (c) => c.sc_CustomerType === 'core.vip' && c.sc_DaysSinceOrder > 60,
    suggestedCampaign: 'vip',
    suggestedChannel: 'whatsapp'
  },

  welcome_followup: {
    name: 'New Customer Follow-up',
    description: 'New customers at 14 days after first order',
    filter: (c) => c.sc_OrderCount === 1 && c.sc_DaysSinceOrder >= 12 && c.sc_DaysSinceOrder <= 16 && c.sc_IsCore,
    suggestedCampaign: 'welcome',
    suggestedChannel: 'email'
  },

  convert_subscriber: {
    name: 'Subscribers to Convert',
    description: 'Newsletter subscribers 90+ days who never ordered',
    filter: (c) => c.sc_IsSubscribed && !c.sc_IsCustomer && c.sc_DaysSubscribed >= 90,
    suggestedCampaign: 'conversion',
    suggestedChannel: 'email'
  },

  capture_email: {
    name: 'Customers Not Subscribed',
    description: 'Core customers not in Mailchimp',
    filter: (c) => c.sc_IsCore && !c.sc_IsSubscribed,
    suggestedCampaign: 'capture',
    suggestedChannel: 'whatsapp'
  }
};
```

---

#### Campaign Activity Recording

When campaign executes, log activity for all targeted contacts:

```javascript
function recordCampaignActivity(campaignProjectId, audienceFilter, activityType) {
  const contacts = getContactsByFilter(audienceFilter);
  const campaign = ProjectService.getProject(campaignProjectId);

  for (const contact of contacts) {
    ContactActivityService.createActivity({
      sca_Email: contact.sc_Email,
      sca_Type: activityType,  // 'comm.mailchimp', 'comm.whatsapp', etc.
      sca_Summary: `Campaign: ${campaign.sp_Name}`,
      sca_Details: JSON.stringify({
        campaignId: campaignProjectId,
        campaignName: campaign.sp_Name,
        channel: activityType.split('.')[1]
      }),
      sca_CreatedBy: 'system'
    });
  }

  return { contactsUpdated: contacts.length };
}
```

---

#### CRM Operations Project

Singleton project for ongoing CRM tasks (weekly reviews, etc.):

```javascript
function getCrmProjectId() {
  const existing = ProjectService.findProject({ sp_Name: 'CRM Operations' });
  if (existing) return existing.sp_ProjectId;

  return ProjectService.createProject({
    sp_Name: 'CRM Operations',
    sp_Description: 'Ongoing customer relationship management',
    sp_Type: 'OPERATIONAL',
    sp_Status: 'Active',
    sp_IsOngoing: true
  }).sp_ProjectId;
}
```

### Phase 4: Contact List View

**Decisions:**
- Navigate via sidebar menu item
- Layout: 8/4 column split (list/detail) like AdminProjectsView.html
- Timeline: filterable by activity type
- Mobile: yes eventually, immediately if easy

**Tasks:**
1. Add "Contacts" to sidebar navigation
2. AdminContactsView.html - main UI component
3. WebAppContacts.js - data provider functions
4. Filter controls: Type, Status, Language, Subscribed, Search
5. Detail panel with collapsible sections
6. Activity timeline with type filter
7. CRM dashboard widget (customer health summary)

---

#### Full Page Wireframe (AdminContactsView.html)

```
+-----------------------------------------------------------------------------------+
| CONTACTS                                           [Export CSV] [Create Campaign] |
+-----------------------------------------------------------------------------------+
|                                                                                   |
| +------ LEFT COLUMN (col-md-8) ------+  +------ RIGHT COLUMN (col-md-4) ------+  |
| |                                    |  |                                      |  |
| | FILTER BAR                         |  | DETAIL PANEL                         |  |
| | [Type ▼] [Status ▼] [Lang ▼]       |  | (shows when contact selected)        |  |
| | [Subscribed ▼] [Search...] [Clear] |  |                                      |  |
| +------------------------------------+  | +----------------------------------+ |  |
| |                                    |  | | HEADER                           | |  |
| | COLUMN HEADERS                     |  | | Name          [WhatsApp] [Email] | |  |
| | Name    | Type   | Status | Orders |  | | email@example.com                | |  |
| +------------------------------------+  | | 052-123-4567                     | |  |
| |                                    |  | +----------------------------------+ |  |
| | CONTACT LIST                       |  |                                      |  |
| | יוסי כהן  core.rep Cooling   4     |  | +----------------------------------+ |  |
| | Sarah M.  core.new Active    1     |  | | ▼ METRICS                        | |  |
| | David L.  core.vip Recent    8     |  | | Type: core.repeat                | |  |
| | ...                                |  | | Status: Cooling (92 days)        | |  |
| |                                    |  | | Orders: 4    Total: ₪2,340       | |  |
| |                                    |  | | Expected: Overdue 44 days        | |  |
| |                                    |  | +----------------------------------+ |  |
| |                                    |  |                                      |  |
| |                                    |  | +----------------------------------+ |  |
| |                                    |  | | ▼ WINE PREFERENCES               | |  |
| |                                    |  | | Primary: Dry Red                 | |  |
| |                                    |  | | Secondary: Dry White             | |  |
| |                                    |  | | Price: ₪60-120 (mid)             | |  |
| |                                    |  | | Wineries: Golan, Teperberg       | |  |
| |                                    |  | | Style: Bold, complex             | |  |
| |                                    |  | +----------------------------------+ |  |
| |                                    |  |                                      |  |
| |                                    |  | +----------------------------------+ |  |
| |                                    |  | | ▼ ACTIVITY [Filter ▼]            | |  |
| |                                    |  | | Dec 15 - Status: Active→Cooling  | |  |
| |                                    |  | | Sep 18 - Order #12345 (₪580)     | |  |
| |                                    |  | | Sep 01 - WhatsApp (reorder)      | |  |
| |                                    |  | | Jun 22 - Order #11234 (₪420)     | |  |
| |                                    |  | +----------------------------------+ |  |
| |                                    |  |                                      |  |
| |                                    |  | +----------------------------------+ |  |
| |                                    |  | | TAGS: [VIP] [holiday-buyer] [+]  | |  |
| |                                    |  | +----------------------------------+ |  |
| |                                    |  |                                      |  |
| |                                    |  | +----------------------------------+ |  |
| |                                    |  | | NOTES                            | |  |
| |                                    |  | | Prefers Thursday delivery        | |  |
| |                                    |  | | [Add note...]                    | |  |
| |                                    |  | +----------------------------------+ |  |
| +------------------------------------+  +--------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

#### Filter Bar Detail

```html
<div class="border-bottom bg-light px-2 py-2">
  <div class="row align-items-center">
    <!-- Row 1: Dropdowns -->
    <div class="col-auto">
      <select id="filter-type" class="form-control form-control-sm">
        <option value="all">All Types</option>
        <option value="core.new">Core: New</option>
        <option value="core.repeat">Core: Repeat</option>
        <option value="core.vip">Core: VIP</option>
        <option value="prospect.subscriber">Prospect</option>
      </select>
    </div>
    <div class="col-auto">
      <select id="filter-status" class="form-control form-control-sm">
        <option value="all">All Status</option>
        <option value="Active">Active (0-30d)</option>
        <option value="Recent">Recent (31-90d)</option>
        <option value="Cooling">Cooling (91-180d)</option>
        <option value="Lapsed">Lapsed (181-365d)</option>
        <option value="Dormant">Dormant (365+d)</option>
      </select>
    </div>
    <div class="col-auto">
      <select id="filter-language" class="form-control form-control-sm">
        <option value="all">Lang</option>
        <option value="EN">EN</option>
        <option value="HE">HE</option>
      </select>
    </div>
    <div class="col-auto">
      <select id="filter-subscribed" class="form-control form-control-sm">
        <option value="all">Subscribed</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
    <div class="col">
      <input type="text" id="search-input" class="form-control form-control-sm"
             placeholder="Search name or email...">
    </div>
    <div class="col-auto">
      <button id="btn-clear-filters" class="btn btn-sm btn-outline-secondary">Clear</button>
    </div>
  </div>
  <!-- Row 2: Results count -->
  <div class="row mt-1">
    <div class="col">
      <small class="text-muted">Showing <span id="result-count">0</span> contacts</small>
    </div>
  </div>
</div>
```

---

#### Contact List Row

```html
<div class="contact-row row border-bottom py-2 px-2" data-email="user@example.com">
  <div class="col-4 text-truncate">
    <strong>יוסי כהן</strong>
    <br><small class="text-muted">yossi@example.com</small>
  </div>
  <div class="col-2">
    <span class="badge badge-info">core.repeat</span>
  </div>
  <div class="col-2">
    <span class="text-warning">Cooling</span>
    <br><small class="text-muted">92 days</small>
  </div>
  <div class="col-2 text-center">
    <strong>4</strong>
    <br><small class="text-muted">₪2,340</small>
  </div>
  <div class="col-2 text-right">
    <span class="badge badge-light">HE</span>
    <span class="badge badge-success" title="Subscribed">✓</span>
  </div>
</div>
```

**Status Colors:**
- Active: `text-success` (green)
- Recent: `text-info` (blue)
- Cooling: `text-warning` (yellow)
- Lapsed: `text-danger` (red)
- Dormant: `text-muted` (gray)

**Type Badges:**
- `core.new`: `badge-primary`
- `core.repeat`: `badge-info`
- `core.vip`: `badge-warning` with star icon
- `prospect.*`: `badge-secondary`
- `noncore.*`: `badge-light`

---

#### Detail Panel - Header Section

```html
<div class="card-header py-2 d-flex justify-content-between align-items-start">
  <div>
    <h5 class="mb-1" id="detail-name">יוסי כהן</h5>
    <small class="text-muted" id="detail-email">yossi@example.com</small>
    <br><small id="detail-phone">052-123-4567</small>
  </div>
  <div class="btn-group">
    <button id="btn-whatsapp" class="btn btn-sm btn-success" title="Open WhatsApp">
      <i class="fab fa-whatsapp"></i> WhatsApp
    </button>
    <button id="btn-email" class="btn btn-sm btn-outline-primary" title="Send Email">
      <i class="fas fa-envelope"></i>
    </button>
  </div>
</div>
```

---

#### Detail Panel - Metrics Card

```html
<div class="card mb-2">
  <div class="card-header py-1 d-flex justify-content-between"
       data-toggle="collapse" data-target="#section-metrics" style="cursor:pointer;">
    <small class="font-weight-bold">METRICS</small>
    <small>▼</small>
  </div>
  <div id="section-metrics" class="collapse show">
    <div class="card-body py-2">
      <div class="row small">
        <div class="col-6">
          <div class="text-muted">Type</div>
          <div><span class="badge badge-info">core.repeat</span></div>
        </div>
        <div class="col-6">
          <div class="text-muted">Status</div>
          <div class="text-warning">Cooling (92 days)</div>
        </div>
      </div>
      <hr class="my-2">
      <div class="row small">
        <div class="col-4">
          <div class="text-muted">Orders</div>
          <div class="font-weight-bold">4</div>
        </div>
        <div class="col-4">
          <div class="text-muted">Total</div>
          <div class="font-weight-bold">₪2,340</div>
        </div>
        <div class="col-4">
          <div class="text-muted">Avg</div>
          <div>₪585</div>
        </div>
      </div>
      <hr class="my-2">
      <div class="row small">
        <div class="col-6">
          <div class="text-muted">Last Order</div>
          <div>Sep 18, 2025</div>
        </div>
        <div class="col-6">
          <div class="text-muted">Next Expected</div>
          <div class="text-danger">Overdue 44 days</div>
        </div>
      </div>
      <div class="row small mt-2">
        <div class="col-12">
          <div class="text-muted">Churn Risk</div>
          <div class="progress" style="height: 8px;">
            <div class="progress-bar bg-warning" style="width: 65%"></div>
          </div>
          <small class="text-warning">Medium</small>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

#### Detail Panel - Wine Preferences Card

```html
<div class="card mb-2">
  <div class="card-header py-1 d-flex justify-content-between"
       data-toggle="collapse" data-target="#section-preferences" style="cursor:pointer;">
    <small class="font-weight-bold">WINE PREFERENCES</small>
    <small>▼</small>
  </div>
  <div id="section-preferences" class="collapse show">
    <div class="card-body py-2 small">
      <div class="row mb-2">
        <div class="col-6">
          <div class="text-muted">Primary</div>
          <div>🍷 Dry Red</div>
        </div>
        <div class="col-6">
          <div class="text-muted">Secondary</div>
          <div>🥂 Dry White</div>
        </div>
      </div>
      <div class="row mb-2">
        <div class="col-12">
          <div class="text-muted">Price Range</div>
          <div>₪60 - ₪120 <small class="text-muted">(mid-range)</small></div>
        </div>
      </div>
      <div class="row mb-2">
        <div class="col-12">
          <div class="text-muted">Taste Profile (Reds)</div>
          <div class="d-flex justify-content-between">
            <span>Intensity: <strong>4</strong>/5</span>
            <span>Complexity: <strong>3.5</strong>/5</span>
          </div>
          <small class="text-muted">Bold, structured wines</small>
        </div>
      </div>
      <div class="row mb-2">
        <div class="col-12">
          <div class="text-muted">Top Wineries</div>
          <div>
            <span class="badge badge-light">Golan Heights</span>
            <span class="badge badge-light">Teperberg</span>
            <span class="badge badge-light">Barkan</span>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col-12">
          <div class="text-muted">Grapes</div>
          <div>Cabernet Sauvignon, Merlot, Chardonnay</div>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

#### Detail Panel - Activity Timeline

```html
<div class="card mb-2">
  <div class="card-header py-1 d-flex justify-content-between align-items-center">
    <small class="font-weight-bold">ACTIVITY</small>
    <select id="activity-type-filter" class="form-control form-control-sm" style="width:auto;">
      <option value="all">All</option>
      <option value="order">Orders</option>
      <option value="comm">Communications</option>
      <option value="status">Status Changes</option>
      <option value="coupon">Coupons</option>
    </select>
  </div>
  <div class="card-body py-0" style="max-height: 200px; overflow-y: auto;">
    <div class="activity-list">

      <!-- Order activity -->
      <div class="activity-item py-2 border-bottom">
        <div class="d-flex justify-content-between">
          <small class="text-muted">Sep 18, 2025</small>
          <span class="badge badge-primary">order</span>
        </div>
        <div>Order #12345</div>
        <small class="text-muted">₪580 · 4 items · SHIPFREE</small>
      </div>

      <!-- Communication activity -->
      <div class="activity-item py-2 border-bottom">
        <div class="d-flex justify-content-between">
          <small class="text-muted">Sep 01, 2025</small>
          <span class="badge badge-success">whatsapp</span>
        </div>
        <div>Reorder reminder sent</div>
        <small class="text-muted">Outcome: Will order next week</small>
      </div>

      <!-- Status change -->
      <div class="activity-item py-2 border-bottom">
        <div class="d-flex justify-content-between">
          <small class="text-muted">Dec 15, 2025</small>
          <span class="badge badge-warning">status</span>
        </div>
        <div>Status changed</div>
        <small class="text-muted">Active → Cooling</small>
      </div>

      <!-- Coupon activity -->
      <div class="activity-item py-2 border-bottom">
        <div class="d-flex justify-content-between">
          <small class="text-muted">Jun 22, 2025</small>
          <span class="badge badge-info">coupon</span>
        </div>
        <div>Coupon used: KSB8</div>
        <small class="text-muted">Order #11234 · ₪48 discount</small>
      </div>

    </div>
  </div>
</div>
```

**Activity Badge Colors:**
- `order.placed`, `bundle.purchased`: `badge-primary`
- `comm.whatsapp`: `badge-success`
- `comm.email`: `badge-info`
- `comm.mailchimp`: `badge-secondary`
- `status.changed`, `type.changed`: `badge-warning`
- `coupon.offered`, `coupon.used`: `badge-info`
- `note.added`: `badge-light`

---

#### Detail Panel - Tags Section

```html
<div class="card mb-2">
  <div class="card-body py-2">
    <small class="font-weight-bold text-muted">TAGS</small>
    <div class="mt-1">
      <span class="badge badge-warning">VIP</span>
      <span class="badge badge-info">holiday-buyer</span>
      <span class="badge badge-secondary">bundle-buyer</span>
      <button class="btn btn-sm btn-outline-secondary py-0" id="btn-add-tag">+</button>
    </div>
  </div>
</div>
```

---

#### Detail Panel - Notes Section

```html
<div class="card mb-2">
  <div class="card-body py-2">
    <small class="font-weight-bold text-muted">NOTES</small>
    <div class="mt-1 small" id="notes-display">
      Prefers Thursday delivery. Wife's birthday in March - gift reminder.
    </div>
    <textarea id="notes-input" class="form-control form-control-sm mt-2"
              rows="2" placeholder="Add a note..." style="display:none;"></textarea>
    <div class="mt-2">
      <button id="btn-edit-notes" class="btn btn-sm btn-outline-secondary">Edit</button>
      <button id="btn-save-notes" class="btn btn-sm btn-primary" style="display:none;">Save</button>
    </div>
  </div>
</div>
```

---

#### Summary Panel (No Selection)

When no contact is selected, show CRM overview stats:

```html
<div id="detail-summary">
  <h6 class="text-muted mb-3">CRM Overview</h6>

  <!-- Quick Stats -->
  <div class="row text-center mb-4">
    <div class="col-3">
      <div class="h4 mb-0" id="stat-total">223</div>
      <small class="text-muted">Contacts</small>
    </div>
    <div class="col-3">
      <div class="h4 mb-0 text-success" id="stat-active">20</div>
      <small class="text-muted">Active</small>
    </div>
    <div class="col-3">
      <div class="h4 mb-0 text-warning" id="stat-cooling">15</div>
      <small class="text-muted">Cooling</small>
    </div>
    <div class="col-3">
      <div class="h4 mb-0 text-danger" id="stat-lapsed">29</div>
      <small class="text-muted">Lapsed</small>
    </div>
  </div>

  <!-- Suggested Actions -->
  <div class="card">
    <div class="card-header py-2">
      <small class="font-weight-bold">SUGGESTED CAMPAIGNS</small>
    </div>
    <div class="card-body py-2 small">
      <div class="mb-2">
        <strong>15 cooling repeat customers</strong>
        <br><small class="text-muted">Re-engagement email recommended</small>
        <br><button class="btn btn-sm btn-outline-primary mt-1">Create Campaign</button>
      </div>
      <hr>
      <div class="mb-2">
        <strong>2 VIPs need attention</strong>
        <br><small class="text-muted">WhatsApp check-in suggested</small>
        <br><button class="btn btn-sm btn-outline-primary mt-1">View Contacts</button>
      </div>
    </div>
  </div>
</div>
```

---

#### State Management (JavaScript)

```javascript
var state = {
  contacts: [],
  activities: [],

  // Filters
  filterType: 'all',
  filterStatus: 'all',
  filterLanguage: 'all',
  filterSubscribed: 'all',
  searchQuery: '',

  // Selection
  selectedEmail: null,

  // Activity filter
  activityTypeFilter: 'all',

  // Sort
  sortField: 'name',
  sortDir: 'asc'
};
```

---

#### Data Provider Functions (WebAppContacts.js)

```javascript
// Get contacts with optional filters
function WebAppContacts_getContacts(filters) {
  // filters: { type, status, language, subscribed, search, limit, offset }
  // Returns: { data: [...], total: N }
}

// Get single contact with full details
function WebAppContacts_getContact(email) {
  // Returns: { contact: {...}, activities: [...], orders: [...] }
}

// Get activities for a contact
function WebAppContacts_getActivities(email, typeFilter) {
  // typeFilter: 'all', 'order', 'comm', 'status', 'coupon'
  // Returns: [...activities]
}

// Update contact notes
function WebAppContacts_updateNotes(email, notes) {
  // Returns: { success: true }
}

// Add tag to contact
function WebAppContacts_addTag(email, tag) {
  // Returns: { success: true }
}

// Remove tag from contact
function WebAppContacts_removeTag(email, tag) {
  // Returns: { success: true }
}

// Log communication activity
function WebAppContacts_logActivity(email, type, summary, details) {
  // type: 'comm.whatsapp', 'comm.email', 'note.added'
  // Returns: { activityId: '...' }
}

// Get CRM stats for overview
function WebAppContacts_getStats() {
  // Returns: { total, active, cooling, lapsed, dormant, subscribers, ... }
}

// Get campaign suggestions
function WebAppContacts_getCampaignSuggestions() {
  // Returns: [{ audience, count, action, filter }, ...]
}

// Export contacts to CSV
function WebAppContacts_exportCsv(filters, format) {
  // format: 'mailchimp' or 'full'
  // Returns: { downloadUrl: '...' } or { csvData: '...' }
}
```

### Phase 5: Communication Actions

**Decisions:**
- WhatsApp: user opens link with pre-filled message, has conversation, logs outcome
- Follow-up scheduling: after conversation, user can schedule coupon, email, or other action
- Bulk actions: NOT anticipated (system maintains contacts, user queries occasionally)

---

#### WhatsApp Flow

**Step 1: Initiate Contact**
- User clicks [WhatsApp] button on contact detail
- System generates wa.me URL with:
  - Formatted phone (+972...)
  - Pre-filled first message (from template, language-appropriate)
- Opens in new tab/WhatsApp app

**Step 2: Conversation**
- User sends message, has conversation with customer
- System waits (no tracking during conversation)

**Step 3: Log Outcome**
- User returns to contact detail
- Modal or inline form appears:
  ```
  +----------------------------------+
  | LOG WHATSAPP OUTCOME             |
  +----------------------------------+
  | Outcome: [Dropdown]              |
  |   - Will order soon              |
  |   - Needs more time              |
  |   - Not interested               |
  |   - No response                  |
  |   - Other                        |
  |                                  |
  | Notes: [Text area]               |
  | ________________________________ |
  |                                  |
  | Schedule follow-up?              |
  | [ ] Send coupon offer            |
  | [ ] Send email                   |
  | [ ] Create reminder task         |
  |                                  |
  | Follow-up date: [Date picker]    |
  |                                  |
  | [Cancel]              [Save Log] |
  +----------------------------------+
  ```

**Step 4: Schedule Follow-up**
- If user selects follow-up action:
  - **Send coupon**: opens coupon selection (Phase 6 flow)
  - **Send email**: queues email task in campaign project
  - **Create reminder**: creates task with due date

**Activity Created:**
```json
{
  "sca_Type": "comm.whatsapp",
  "sca_Summary": "WhatsApp: reorder check-in",
  "sca_Details": {
    "outcome": "will_order_soon",
    "notes": "Customer said next week after holiday",
    "followUp": {
      "type": "coupon",
      "scheduled": "2025-12-25"
    }
  }
}
```

---

#### WhatsApp Message Templates

Stored in SysConfig, keyed by purpose and language:

```json
{
  "whatsapp.template.reorder_checkin.en": "Hi {name}! It's been a while since your last order from JLMwines. Just checking in - need any wine recommendations?",
  "whatsapp.template.reorder_checkin.he": "היי {name}! עבר זמן מאז ההזמנה האחרונה שלך מ-JLMwines. רצינו לבדוק - צריך המלצות ליינות?",
  "whatsapp.template.vip_exclusive.en": "Hi {name}! As one of our valued customers, I wanted to give you a heads up about some new arrivals...",
  "whatsapp.template.vip_exclusive.he": "היי {name}! כלקוח מוערך, רצינו לתת לך הצצה ראשונה ליינות החדשים שלנו..."
}
```

---

#### Phone Formatting Utility

```javascript
function formatPhoneForWhatsApp(phone, country = 'IL') {
  if (!phone) return null;

  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');

  // Israeli number handling
  if (country === 'IL') {
    // 05x... → +9725x...
    if (digits.startsWith('05')) {
      digits = '972' + digits.substring(1);
    }
    // Already has country code
    else if (digits.startsWith('9725')) {
      // Good as is
    }
  }

  return '+' + digits;
}

function generateWhatsAppUrl(phone, message) {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) return null;

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone.replace('+', '')}?text=${encodedMessage}`;
}
```

---

### Phase 6: Mailchimp & Coupon Integration

**Decisions:**
- Coupon list: shown during campaign creation (not separate view)
- System suggests existing coupons OR user creates new one
- Email-restricted coupons: export email list is part of workflow
- Order with coupon: creates TWO activity records (order.placed + coupon.used)

---

#### Coupon Offer Workflow

**Trigger:** User selects "Offer coupon" in campaign or follow-up

**Step 1: System Suggests Coupons**
- Show existing active coupons matching campaign:
  ```
  +------------------------------------------+
  | SELECT OR CREATE COUPON                  |
  +------------------------------------------+
  | Suggested for this audience:             |
  |                                          |
  | [●] KSB8 - 8% off + free shipping (₪600) |
  |     Used: 15x | Conversion: 73%          |
  |                                          |
  | [ ] FIVE - 5% off (₪400 min)             |
  |     Used: 8x | Conversion: 50%           |
  |                                          |
  | [ ] Create new coupon...                 |
  |                                          |
  | [Cancel]                        [Select] |
  +------------------------------------------+
  ```

**Step 2: Create New Coupon (if needed)**
- User creates coupon in WooCommerce
- System provides guidance:
  - Suggested code format
  - If email-restricted: "Export email list" button
  - Discount type recommendation based on audience

**Step 3: Email List Export (for restricted coupons)**
- If coupon is email-restricted:
  ```
  +------------------------------------------+
  | COUPON: VIPHOLIDAY                        |
  | Type: Email-restricted                   |
  +------------------------------------------+
  | This coupon requires customer emails.    |
  |                                          |
  | Target audience: 15 contacts             |
  |                                          |
  | [Download Email List CSV]                |
  |                                          |
  | After adding emails to coupon in         |
  | WooCommerce, click Continue.             |
  |                                          |
  | [Back]                       [Continue]  |
  +------------------------------------------+
  ```

**Step 4: Translate Coupon Text**
- Content task created: `task.content.translate`
- Linked to Google Doc with coupon description
- Fields to translate:
  - `sco_Description` (shown at checkout)
  - Marketing text (for email/social)

**Step 5: Make Coupon Live**
- Task: `task.content.publish`
- User sets coupon to "publish" in WooCommerce
- System verifies coupon is active (status check)

---

#### Coupon Selection Data

```javascript
function getCouponsForCampaign(audienceType) {
  const coupons = CouponService.getActiveCoupons();

  return coupons.map(coupon => ({
    code: coupon.sco_Code,
    description: coupon.sco_Description,
    discountType: coupon.sco_DiscountType,
    amount: coupon.sco_Amount,
    minSpend: coupon.sco_MinSpend,
    freeShipping: coupon.sco_FreeShipping,
    usageCount: coupon.sco_UsageCount,
    conversionRate: calculateConversionRate(coupon.sco_Code),
    isEmailRestricted: !!coupon.sco_CustomerEmail,
    tags: coupon.sco_Tags
  }));
}

function calculateConversionRate(couponCode) {
  // Orders within 7 days of coupon offer ÷ total offers
  const offers = ActivityService.countByType('coupon.offered', { code: couponCode });
  const redemptions = ActivityService.countByType('coupon.used', { code: couponCode });

  if (offers === 0) return null;
  return Math.round((redemptions / offers) * 100);
}
```

---

#### Activity Records for Coupons

**When coupon is offered:**
```json
{
  "sca_Type": "coupon.offered",
  "sca_Summary": "Offered coupon: KSB8",
  "sca_Details": {
    "code": "KSB8",
    "channel": "whatsapp",
    "campaignId": "CAMP-123"
  }
}
```

**When coupon is redeemed (on order import):**
```json
{
  "sca_Type": "coupon.used",
  "sca_Summary": "Redeemed coupon: KSB8",
  "sca_Details": {
    "code": "KSB8",
    "orderId": "66789",
    "discount": 48.00,
    "daysFromOffer": 3
  }
}
```

---

#### Mailchimp Integration

**Import (refresh subscribers):**
1. User uploads Mailchimp audience export CSV
2. System upserts contacts:
   - New subscribers → create contact record
   - Existing → update `sc_IsSubscribed`, `sc_SubscribedDate`
3. Log `mailchimp.subscribed` activity for new subscribers

**Export (campaign audience):**
1. User filters contacts for campaign
2. Clicks [Export for Mailchimp]
3. System generates CSV with:
   - Email, First Name, Last Name
   - Language (for segmentation)
   - Tags (customer type, preferences)
4. User imports to Mailchimp segment

### Phase 7: Wine Preferences & Recommendations

**Strategic Importance:**
Personalized wine recommendations are JLMwines' unique selling feature and primary competitive advantage. The intensity/complexity/acidity ratings are from in-house tastings - this data is gold. The recommendation engine is not a "nice to have" - it's core to the business value proposition.

---

#### Data Sources for Preferences

**Primary Category Options:**

| Source | Field | Pros | Cons |
|--------|-------|------|------|
| Comax | Division/Group | Single definitive value | Requires Comax lookup |
| WooCommerce | `wpm_TaxProductCat` | Already in WebProdM | May contain multiple categories |

**Decision:** Use WooCommerce categories, extract primary by priority:
```javascript
const CATEGORY_PRIORITY = [
  'Dry Red', 'Dry White', 'Rosé', 'Semi-Dry',
  'Dessert', 'Fortified', 'Sparkling'
];

function extractPrimaryCategory(categories) {
  // categories may be comma-separated or array
  const catList = Array.isArray(categories)
    ? categories
    : String(categories).split(',').map(c => c.trim());

  for (const priority of CATEGORY_PRIORITY) {
    if (catList.includes(priority)) return priority;
  }
  return catList[0] || 'Unknown';
}
```

**Taste Attributes (from WebDetM):**

| Field | Scale | Description |
|-------|-------|-------------|
| `wdm_Intensity` | 1-5 | Body/weight of wine |
| `wdm_Complexity` | 1-5 | Depth of flavors |
| `wdm_Acidity` | 1-5 | Tartness/freshness |

Note: `wdm_Pairing` exists but is for packing slips, not campaigns.

**Winery Source:**
- Current: Parse from product name (e.g., "Golan Heights Yarden Cabernet" → "Golan Heights")
- Future: Populate WooCommerce brand field for cleaner data

**Kashrut:**
- Lower priority for now
- Key rule: Never recommend heter mechira to customers who've never bought it
- Values to track: Mevushal, Heter Mechira, Mehadrin, Badatz

---

#### Preference Calculation

Run during daily housekeeping refresh. For each contact with orders:

```javascript
function calculateContactPreferences(email) {
  const orders = getOrdersForContact(email);
  const products = extractProductsFromOrders(orders); // includes bundle contents

  return {
    // Category preferences
    sc_PreferredCategory: calculatePrimaryCategory(products),
    sc_SecondaryCategory: calculateSecondaryCategory(products),

    // Price behavior
    sc_PriceMin: Math.min(...products.map(p => p.price)),
    sc_PriceMax: Math.max(...products.map(p => p.price)),
    sc_PriceMedian: calculateMedian(products.map(p => p.price)),

    // Taste profile (averages for purchased wines)
    sc_RedIntensityAvg: avgAttribute(products, 'red', 'intensity'),
    sc_RedComplexityAvg: avgAttribute(products, 'red', 'complexity'),
    sc_WhiteComplexityAvg: avgAttribute(products, 'white', 'complexity'),
    sc_WhiteAcidityAvg: avgAttribute(products, 'white', 'acidity'),

    // Winery & variety
    sc_TopWineries: getTopWineries(products, 3).join(','),
    sc_GrapeVarieties: getTopGrapes(products, 5).join(','),

    // Behavior flags
    sc_BundleBuyer: orders.some(o => o.hasBundle),
    sc_AvgBottlesPerOrder: calculateAvgBottles(orders),
    sc_NewWineryExplorer: countUniqueWineries(products) >= 5,

    // Kashrut (conservative approach)
    sc_KashrutPrefs: deriveKashrutPrefs(products)
  };
}

function deriveKashrutPrefs(products) {
  const kashrut = products.map(p => p.kashrut).filter(Boolean);
  const flags = [];

  // Only flag restrictions, not preferences
  if (!kashrut.includes('Heter Mechira')) {
    flags.push('no-heter-mechira');
  }
  if (kashrut.every(k => k === 'Mevushal')) {
    flags.push('mevushal-only');
  }

  return flags.join(',');
}
```

---

#### Bundle Handling

When processing orders containing bundles:

1. **Extract contents** - Get individual products from SysBundles/SysBundleSlots
2. **Include in preferences** - Bundle products count toward taste profile
3. **Log activity** - Create `bundle.purchased` event

```javascript
function extractBundleProducts(orderId, bundleProductId) {
  const bundle = BundleService.getBundleByProductId(bundleProductId);
  if (!bundle) return [];

  const slots = BundleService.getBundleSlots(bundle.sb_BundleId);
  return slots.map(slot => ({
    productId: slot.sbs_ProductId,
    source: 'bundle',
    bundleName: bundle.sb_Name
  }));
}
```

---

#### Recommendation Engine

**This is the crown jewel.** Match customer taste profile to available products.

**Matching Algorithm:**

```javascript
function getRecommendations(contact, options = {}) {
  const { limit = 6, excludePurchased = true, category = null } = options;

  const products = ProductService.getActiveProducts();
  const purchased = excludePurchased
    ? new Set(getProductsPurchasedBy(contact.sc_Email))
    : new Set();

  // Filter by category if specified
  let candidates = category
    ? products.filter(p => p.primaryCategory === category)
    : products;

  // Exclude already purchased
  candidates = candidates.filter(p => !purchased.has(p.productId));

  // Apply kashrut filter
  if (contact.sc_KashrutPrefs?.includes('no-heter-mechira')) {
    candidates = candidates.filter(p => p.kashrut !== 'Heter Mechira');
  }

  // Score each candidate
  const scored = candidates.map(product => ({
    product,
    score: calculateMatchScore(contact, product)
  }));

  // Sort by score, return top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => ({
    ...s.product,
    matchScore: s.score,
    matchReason: explainMatch(contact, s.product)
  }));
}

function calculateMatchScore(contact, product) {
  let score = 0;
  const category = product.primaryCategory;

  // Category match (40 points max)
  if (category === contact.sc_PreferredCategory) score += 40;
  else if (category === contact.sc_SecondaryCategory) score += 25;

  // Taste profile match (30 points max)
  if (category.includes('Red')) {
    score += 15 - Math.abs(product.intensity - contact.sc_RedIntensityAvg) * 3;
    score += 15 - Math.abs(product.complexity - contact.sc_RedComplexityAvg) * 3;
  } else if (category.includes('White')) {
    score += 15 - Math.abs(product.complexity - contact.sc_WhiteComplexityAvg) * 3;
    score += 15 - Math.abs(product.acidity - contact.sc_WhiteAcidityAvg) * 3;
  }

  // Price fit (20 points max)
  const priceScore = calculatePriceFit(product.price,
    contact.sc_PriceMin, contact.sc_PriceMedian, contact.sc_PriceMax);
  score += priceScore * 20;

  // Winery affinity (10 points)
  const topWineries = (contact.sc_TopWineries || '').split(',');
  if (topWineries.includes(product.winery)) score += 10;

  return Math.max(0, Math.round(score));
}

function explainMatch(contact, product) {
  const reasons = [];

  if (product.primaryCategory === contact.sc_PreferredCategory) {
    reasons.push(`Matches your preference for ${product.primaryCategory}`);
  }

  if (product.intensity >= 4 && contact.sc_RedIntensityAvg >= 3.5) {
    reasons.push('Bold and intense, like wines you enjoy');
  }

  const topWineries = (contact.sc_TopWineries || '').split(',');
  if (topWineries.includes(product.winery)) {
    reasons.push(`From ${product.winery}, a winery you love`);
  }

  return reasons.slice(0, 2).join('. ');
}
```

---

#### Recommendation Output Options

**1. Contact Detail Panel**
Show top 3-4 recommendations with match scores:
```
+----------------------------------+
| RECOMMENDED FOR YOU              |
+----------------------------------+
| Golan Heights Yarden Cab  (92%)  |
| Bold red, matches your style     |
|                                  |
| Recanati Reserve Merlot   (87%)  |
| From a winery you enjoy          |
|                                  |
| [See More Recommendations]       |
+----------------------------------+
```

**2. Campaign Export**
Include recommendations in Mailchimp export:
```csv
email,first_name,recommendation_1,rec_1_reason,recommendation_2,rec_2_reason
yossi@example.com,Yossi,Yarden Cabernet,Bold red you'll love,Teperberg Merlot,Great value
```

**3. Bundle Builder**
Suggest bundle contents based on audience profile:
```javascript
function suggestBundleForAudience(audienceFilter) {
  const contacts = getContactsByFilter(audienceFilter);
  const avgProfile = calculateAverageProfile(contacts);

  return getRecommendations(avgProfile, {
    limit: 4,
    excludePurchased: false
  });
}
```

---

#### Tasks Summary

1. **Preference calculator** - Run in housekeeping, populate sc_ fields
2. **Bundle extraction** - Parse bundle contents for preference data
3. **Recommendation engine** - Scoring algorithm with explainability
4. **UI integration** - Recommendations in contact detail panel
5. **Export integration** - Include recommendations in campaign exports
6. **Bundle suggestions** - AI-assisted bundle building from audience profile

### Phase 8: AI Assistant Integration

**Vision:**
Integrate Claude directly into JLMops for natural language queries, content generation, and intelligent automation. The AI becomes a collaborator in campaign creation and customer engagement.

**Technical Foundation:**

```javascript
// ClaudeService.js
function callClaude(prompt, systemContext) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemContext,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  return JSON.parse(response.getContentText()).content[0].text;
}
```

**System Context (provided to Claude):**
```
You are an AI assistant for JLMwines, an Israeli wine retailer. You have access to:
- Customer contacts with purchase history and preferences
- Wine products with taste attributes (intensity, complexity, acidity)
- Coupons and campaign history
- Bundle configurations

When asked to query contacts, return structured filter criteria.
When asked to draft messages, use the customer's language preference.
When suggesting wines, match to customer taste profile.
```

**AI-Powered Features:**

| Feature | Description | Trigger |
|---------|-------------|---------|
| **Natural Language Queries** | "Show me VIPs who haven't ordered in 60 days" | User input |
| **Campaign Drafting** | Generate EN/HE copy from brief | Campaign creation |
| **Year in Wine Generation** | Personalized narrative from stats | Button click |
| **Message Personalization** | WhatsApp/email with personal touches | Template expansion |
| **Bundle Suggestions** | "What wines for someone who likes X?" | Recommendation request |
| **Insight Generation** | "Why is Tel Aviv retention low?" | Analytics query |

**Use Case 1: Natural Language Contact Queries**

```
User: "Find Hebrew-speaking repeat customers in Jerusalem who
       like bold reds and haven't ordered in 2+ months"

Claude interprets → returns structured filter:
{
  "language": "HE",
  "type": ["core.repeat"],
  "city": "Jerusalem",
  "sc_RedIntensityAvg": { "min": 3.5 },
  "sc_DaysSinceOrder": { "min": 60 }
}

System executes filter → displays 6 matching contacts
```

**Use Case 2: Campaign Content Generation**

```
User initiates campaign for 12 cooling customers

System provides Claude:
- Audience summary (12 Hebrew speakers, avg spend ₪450, prefer reds)
- Selected bundle (Special Value)
- Coupon (10% off)

Claude generates:
- Subject line (HE): "יינות מיוחדים מחכים לך 🍷"
- Body (HE): Personalized message with {name}, {favorite_winery}
- Subject line (EN): "Your favorite wines are waiting"
- Body (EN): English version

User reviews, edits, approves
```

**Use Case 3: Year in Wine Generation**

```
System provides Claude:
- Contact: Yossi Cohen
- Stats: 4 orders, ₪2,340 total, 14 bottles
- Preferences: Bold reds, Golan Heights fan, mid-range prices
- New discoveries: Tried 2 new wineries
- Comparison: +2 orders vs last year

Claude generates personalized narrative:
"Yossi, what a year! You explored 14 bottles across 4 orders,
with Golan Heights remaining your go-to winery. Your taste
for bold, complex reds led you to discover Teperberg and
Tabor this year. You're ordering more than ever - 2 more
orders than last year! For 2025, I think you'd love..."
```

**Use Case 4: Intelligent Campaign Suggestions**

```
Daily/weekly, system asks Claude:
"Given these contact segments and recent patterns,
what campaigns would you suggest?"

Claude analyzes:
- 15 cooling customers (opportunity: win-back)
- 8 customers share Cabernet preference (opportunity: themed bundle)
- Pesach in 3 weeks (opportunity: seasonal)
- 5 VIPs approaching 60 days (opportunity: retention)

Returns prioritized suggestions with rationale
```

**Use Case 5: Conversational Interface**

```
┌─────────────────────────────────────────────────────┐
│ ASK CLAUDE                                     [×]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ You: What campaigns should I run this week?         │
│                                                     │
│ Claude: Based on your current contacts:             │
│                                                     │
│ 1. **Win-back (High Priority)**                     │
│    15 cooling Hebrew customers                      │
│    Suggest: Special Value + 10% personal codes      │
│    [Create Campaign]                                │
│                                                     │
│ 2. **VIP Attention (High Priority)**                │
│    5 VIPs approaching 60 days                       │
│    Suggest: Personal WhatsApp outreach              │
│    [View Contacts]                                  │
│                                                     │
│ 3. **Cabernet Lovers (Medium)**                     │
│    8 customers, themed Explorer opportunity         │
│    Suggest: "Cabernet Journey" bundle               │
│    [Create Campaign]                                │
│                                                     │
│ ─────────────────────────────────────────────────── │
│ [Ask another question...]                           │
└─────────────────────────────────────────────────────┘
```

**Implementation Tasks:**

1. **ClaudeService.js** - API wrapper
   - `callClaude(prompt, context)` - Basic API call
   - `queryContacts(naturalLanguage)` - Parse to filter criteria
   - `generateMessage(contact, template, language)` - Personalized content
   - `generateYearInWine(contact)` - Annual summary
   - `suggestCampaigns(contactStats)` - Campaign recommendations
   - `explainRecommendation(contact, products)` - Why these wines

2. **System Context Builder**
   - Provide Claude with relevant data schema
   - Include current contact stats summary
   - Include available bundles and coupons
   - Include product attribute ranges

3. **UI Components**
   - "Ask Claude" button/modal
   - Conversational interface panel
   - AI-generated content review/edit flow
   - Loading states for API calls

4. **Integration Points**
   - Contact List View: natural language search
   - Campaign Creation: content generation
   - Contact Detail: personalized insights
   - Dashboard: campaign suggestions widget

**Cost Estimation:**
- Claude Sonnet: ~$3/M input, ~$15/M output tokens
- Average query: ~800 tokens in, ~400 out ≈ $0.008
- 200 queries/month ≈ $1.60
- Heavy usage (500/month) ≈ $4.00

**Security:**
- API key stored in Script Properties (not in code)
- No PII sent beyond what's needed for query
- Audit log of AI interactions (optional)

**Phased Rollout:**
1. Start with campaign content generation (highest value, contained scope)
2. Add natural language contact queries
3. Add Year in Wine generation
4. Add conversational interface
5. Add proactive campaign suggestions

---

## Coupon & Campaign Strategy

### Coupon Targeting Workflow

1. **Identify Target Segment**
   - Filter contacts (e.g., Cooling + Hebrew + Repeat)
   - Review segment in contact list

2. **Select/Create Coupon**
   - View available coupons from SysCoupons
   - See historical performance of similar coupons
   - Choose appropriate coupon for segment

3. **Distribute via Channel**
   - **Mailchimp**: Export segment CSV, create campaign with coupon code
   - **WhatsApp**: Generate messages with coupon code embedded
   - **Individual Email**: Include code in message

4. **Log Offer**
   - System logs `coupon.offered` activity for each contact
   - Links to coupon code and distribution channel

5. **Track Redemption**
   - When order comes in with coupon, log `coupon.used` activity
   - Update SysCouponUsage for analytics

### Campaign Performance Analytics

**From Mailchimp campaign data:**
- Revenue per campaign
- Orders per campaign
- Best performing campaign types (seasonal > value > explore)
- Best send days (data shows Saturday/Tuesday perform well)
- Open rate trends over time
- Unsubscribe patterns

**From coupon data:**
- Most effective coupon structures (% vs fixed, thresholds)
- First-order conversion by coupon type
- Repeat conversion rate by coupon type
- War-support campaign impact

### Recommended Coupon Strategies (From Historical Data)

| Strategy | Structure | Best For |
|----------|-----------|----------|
| **SHIPFREE** | Free shipping @ ₪399+ | 616 uses - most popular |
| **Threshold Discount** | 5-8% @ ₪600+ w/ free ship | KSB8, FIVESIX effective |
| **Welcome Gift** | Free product + modest discount | pop (33 uses) good conversion |
| **War Support** | 10% + free pickup | Community building |
| **Win-back** | 10% one-time use | Lapsed customer reactivation |

---

## Targeted Bundle Offers

### The Opportunity

Combine three systems for personalized, high-conversion offers:
1. **Contact preferences** → Know what they like
2. **Bundles** → Curated selections at free shipping threshold
3. **Coupons** → Incentives that can auto-apply

### Bundle Hierarchy

**Current & Planned Bundles:**

| Bundle | Focus | Price Range | Target Audience |
|--------|-------|-------------|-----------------|
| **Special Value** | Best QPR wines, lower price point | ~₪399 | Budget-focused, price-sensitive, first-timers |
| **Premium Value** | Better wines, still "Special Value" category | ~₪450-500 | Graduating budget buyers, mid-range |
| **Explorer** | Flexible theming (grape, vertical, etc.) | ~₪450 | Enthusiasts, explorers, themed campaigns |

**Special Value Bundle** (most popular):
- Flexible contents, curated for price/quality ratio
- Target: `sc_PriceMedian < 80` or `price-sensitive` tag
- Perfect for: New customers, lapsed budget buyers, subscribers who never ordered

**Premium Value Bundle** (planned):
- Slightly elevated from Special Value
- Target: Repeat Special Value buyers ready to "graduate"
- Pitch: "Loved the Special Value? Try the next level"

### Profitability & Featured Products

**Featured Products** = exceptional margin wines. Use strategically in bundles to:
- Absorb discount costs while maintaining profit
- Introduce high-margin products to customers
- Balance bundle economics when offering coupons

**Bundle Composition Strategy:**

| Bundle Type | Coupon | Composition Strategy |
|-------------|--------|---------------------|
| Special Value | None/SHIPFREE | Standard QPR selection |
| Special Value | 5-10% off | Include 1-2 Featured products to offset |
| Premium Value | 5% off | Mix Featured + premium QPR |
| Explorer | 8-10% off | Anchor with Featured products |

**Future Enhancement:** When Comax profitability data available:
- `cpm_Margin` or `cpm_Profitability` field
- Auto-suggest bundle compositions that maintain target margin
- Flag when discount + composition = below threshold

### Price Point Strategy

Target ₪399+ (free shipping threshold):

| Bundle | Base Price | With Coupon | Net to Customer |
|--------|------------|-------------|-----------------|
| Special Value | ₪399 | SHIPFREE | ₪399 + free ship |
| Special Value | ₪420 | 5% off | ₪399 + free ship |
| Premium Value | ₪500 | 5% off | ₪475 + free ship |
| Premium Value | ₪530 | 8% off | ₪488 + free ship |
| Explorer | ₪450 | 10% off | ₪405 + free ship |

### The Explorer Bundle

The Explorer Bundle is a flexible-content bundle that can be themed for any audience. Contents are curated by the manager, not fixed. This makes it the perfect vehicle for targeted campaigns.

**Theming Options:**

| Theme Type | Example | Target Audience |
|------------|---------|-----------------|
| **Grape Variety** | "Cabernet Journey" - 4 Cabs from different wineries | Cab lovers (from sc_GrapeVarieties) |
| **Attribute Spectrum** | "Intensity Explorer" - light to bold progression | Curious drinkers, new customers |
| **Horizontal** | "Merlot 2021" - same grape/vintage, different wineries | Wine enthusiasts |
| **Vertical** | "Golan Heights Through the Years" - same winery, multiple vintages | Winery loyalists |
| **Regional** | "Taste of the Galilee" | Geographic preference |
| **Price Discovery** | "Hidden Gems Under ₪60" | Budget-focused (sc_PriceMedian < 70) |
| **Style Match** | "Bold & Complex Selection" | High intensity+complexity buyers |
| **Seasonal** | "Summer Whites" / "Winter Warmers" | Seasonal campaigns |
| **New Arrivals** | "Just Landed" - newest inventory | Explorer types |

**Workflow:**
1. Manager curates Explorer Bundle contents for a theme
2. System identifies contacts matching that theme's target audience
3. Campaign sent with personalized pitch
4. Bundle link same for all (contents already set)
5. Track which themes convert best

### Preference → Explorer Theme Matching

| Contact Preference | Suggested Theme |
|--------------------|-----------------|
| High intensity reds | "Bold Reds" / "Full-Body Experience" |
| Elegant/complex reds | "Cellar Classics" / vertical from top winery |
| Crisp whites | "Bright & Fresh" / "Summer Whites" |
| sc_NewWineryExplorer = true | "New Discoveries" / horizontal comparison |
| Budget-focused | "Value Explorer" / "Hidden Gems" |
| Premium buyer | "Reserve Selection" / aged verticals |
| Top grape = Cabernet | "Cabernet Journey" |
| Top winery = X | "{Winery} Vertical" |

**Bundle Suggestion Logic:**
```javascript
function suggestBundle(contact) {
  // 1. Get contact preferences
  const prefs = {
    category: contact.sc_PreferredCategory,
    intensity: contact.sc_RedIntensityAvg,
    complexity: contact.sc_RedComplexityAvg,
    priceMedian: contact.sc_PriceMedian,
    topWinery: contact.sc_TopWineries.split(',')[0],
    isExplorer: contact.sc_NewWineryExplorer
  };

  // 2. Find bundles matching profile
  // 3. Filter to ₪399-450 range (free shipping sweet spot)
  // 4. Rank by match score
  // 5. Return top suggestions with personalized pitch
}
```

### Coupon + Bundle Combinations

**Tiered Incentive Structure:**

| Cart Value | Incentive | Coupon Type |
|------------|-----------|-------------|
| ₪399+ | Free shipping | SHIPFREE (auto-apply at checkout) |
| ₪500+ | Free shipping + 5% | FIVE (manual or auto by email) |
| ₪600+ | Free shipping + 8% | KSB8 (threshold auto-apply) |

**Auto-Apply Strategies (WooCommerce capabilities):**

1. **By Email** - Coupon restricted to specific customer emails
   - Use: Win-back offers, VIP rewards
   - "Your personal 10% code - already applied at checkout"

2. **By Logged-In Status** - Auto-apply for registered users
   - Use: Loyalty program feel
   - "Members always get free shipping"

3. **By Cart Contents** - Apply when bundle in cart
   - Use: Bundle-specific discounts
   - "Explorer Pack + 5% off automatically"

4. **By Threshold** - Apply when cart hits minimum
   - Use: Encourage larger orders
   - "You unlocked 8% off!"

### Audience → Bundle → Coupon Matrix

| Audience Segment | Suggested Bundle | Coupon Strategy |
|------------------|------------------|-----------------|
| **Cooling repeat, high-value** | Their taste profile match @ ₪450 | Personal 10% by email |
| **Lapsed, was budget buyer** | Value Collection @ ₪399 | SHIPFREE only |
| **New subscriber, never ordered** | Explorer Starter @ ₪399 | WELCOME10 (first order) |
| **VIP, premium buyer** | Reserve Selection @ ₪600 | Auto 8% at threshold |
| **Explorer type** | Discovery Pack (new wineries) | 5% for trying new |
| **Single winery loyal** | Best of {Winery} pack | No discount needed |

### Campaign as Project

Campaigns leverage the existing project/task system. User initiates a campaign project, system generates tasks, users collaborate to execute.

**Project Type:** `CAMPAIGN`

**Campaign Project Creation:**
```
User: "Create campaign for cooling Hebrew customers with Special Value bundle"

System creates:
  Project: "Special Value - Cooling Hebrew - Dec 2024"
  Type: CAMPAIGN
  Status: PLANNING
```

**Auto-Generated Task Workflow:**

| Task | Type | Assignee | Description |
|------|------|----------|-------------|
| 1. Define audience | `task.campaign.audience` | Manager | Confirm segment filters |
| 2. Curate bundle | `task.campaign.bundle` | Manager | Select/update bundle contents |
| 3. Select coupon | `task.campaign.coupon` | Manager | Choose or create coupon |
| 4. Draft message (EN) | `task.campaign.content_en` | Content | Write English copy |
| 5. Draft message (HE) | `task.campaign.content_he` | Content | Write Hebrew copy |
| 6. Review & approve | `task.campaign.review` | Manager | Final approval |
| 7. Schedule send | `task.campaign.schedule` | Manager | Set send date/time |
| 8. Execute campaign | `task.campaign.execute` | System | Send via channels |
| 9. Log activities | `task.campaign.log` | System | Record coupon.offered |
| 10. Track results | `task.campaign.results` | Manager | Review redemptions |

**Task Dependencies:**
```
1 → 2 → 3 → 4,5 (parallel) → 6 → 7 → 8 → 9 → 10
```

**Campaign Project Fields (SysProjects):**

| Field | Value |
|-------|-------|
| spro_ProjectId | `CAMP-2024-12-COOLING-HE` |
| spro_Name | "Special Value - Cooling Hebrew" |
| spro_Type | `CAMPAIGN` |
| spro_Status | PLANNING → ACTIVE → COMPLETED |
| spro_StartDate | Campaign creation date |
| spro_EndDate | Results review deadline |

**Campaign Metadata (in st_Notes JSON):**

```json
{
  "campaignType": "bundle_offer",
  "audienceFilter": {
    "status": "Cooling",
    "language": "HE",
    "type": "core.repeat"
  },
  "audienceCount": 15,
  "bundleId": "special-value",
  "couponCode": "COOLING10",
  "channels": ["mailchimp", "whatsapp"],
  "scheduledDate": "2024-12-20",
  "results": {
    "sent": 15,
    "opened": 8,
    "clicked": 4,
    "converted": 2,
    "revenue": 798
  }
}
```

### System-Generated Campaign Suggestions

The system analyzes contact data and proactively suggests campaign opportunities. Displayed on dashboard or in Projects view.

**Suggestion Triggers:**

| Trigger | Suggested Campaign |
|---------|-------------------|
| 10+ contacts hit "Cooling" status | Win-back campaign for cooling segment |
| 5+ repeat customers share same top winery | "{Winery} Lovers" themed Explorer |
| Seasonal date approaching | Holiday campaign (Pesach wines, etc.) |
| New bundle created | Launch campaign to matching audience |
| High-margin Featured products need movement | Special offer campaign |
| Subscribers 90+ days without order | Conversion campaign with welcome offer |
| VIP customers approaching 60 days | VIP attention campaign |

**Campaign Suggestion Card (UI):**

```
┌─────────────────────────────────────────────────────┐
│ 💡 SUGGESTED CAMPAIGN                               │
├─────────────────────────────────────────────────────┤
│ "Win Back Cooling Hebrew Customers"                 │
│                                                     │
│ Audience: 15 contacts                               │
│ • Cooling status (91-180 days)                      │
│ • Hebrew language                                   │
│ • Repeat customers                                  │
│                                                     │
│ Suggested Offer:                                    │
│ • Bundle: Special Value (₪399)                      │
│ • Coupon: 10% off (personal codes)                  │
│ • Channel: WhatsApp (personal touch)                │
│                                                     │
│ Estimated: ₪1,200-2,000 revenue potential           │
│                                                     │
│ [Create Campaign]  [Dismiss]  [Remind Later]        │
└─────────────────────────────────────────────────────┘
```

**One-Click Campaign Creation:**

User clicks "Create Campaign" → System auto-generates:

```
Project: "Win Back Cooling Hebrew - Dec 2024"
Type: CAMPAIGN
Status: PLANNING

Pre-filled:
├── Audience: 15 contacts (filter saved)
├── Bundle: Special Value
├── Coupon: COOLING10-HE (new, 10%, email-restricted)
├── Channel: WhatsApp
└── Draft message: Hebrew template with personalization

Tasks created:
1. ✓ Define audience (pre-filled, needs confirm)
2. ✓ Select bundle (pre-filled)
3. ✓ Select coupon (pre-created)
4. □ Draft message - review/customize
5. □ Review & approve
6. □ Schedule send
...
```

**Suggestion Generation Logic:**

```javascript
function generateCampaignSuggestions() {
  const suggestions = [];

  // Check for cooling customers
  const cooling = contacts.filter(c => c.sc_LifecycleStatus === 'Cooling');
  if (cooling.length >= 5) {
    suggestions.push({
      name: "Win Back Cooling Customers",
      audience: cooling,
      bundle: suggestBundle(cooling), // Match to audience preferences
      coupon: suggestCoupon(cooling), // Based on price sensitivity
      channel: suggestChannel(cooling), // WhatsApp for small, Mailchimp for large
      priority: calculatePriority(cooling) // Revenue potential
    });
  }

  // Check for winery clusters
  const wineryGroups = groupByTopWinery(contacts);
  for (const [winery, group] of wineryGroups) {
    if (group.length >= 5) {
      suggestions.push({
        name: `${winery} Lovers Campaign`,
        audience: group,
        bundle: "Explorer - " + winery + " Vertical",
        coupon: null, // Loyalists don't need discount
        channel: "email"
      });
    }
  }

  // Check seasonal opportunities
  const upcomingHoliday = getNextHoliday();
  if (upcomingHoliday && daysUntil(upcomingHoliday) < 21) {
    suggestions.push({
      name: `${upcomingHoliday.name} Campaign`,
      audience: contacts.filter(c => c.sc_IsCore),
      bundle: upcomingHoliday.suggestedBundle,
      coupon: "SHIPFREE",
      channel: "mailchimp"
    });
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}
```

**Dashboard Widget - Campaign Opportunities:**

```
┌─────────────────────────────────────────┐
│ CAMPAIGN OPPORTUNITIES                  │
├─────────────────────────────────────────┤
│ 🔴 15 Cooling customers need attention  │
│    → Win-back campaign ready [Create]   │
│                                         │
│ 🟡 8 Cab lovers identified              │
│    → "Cabernet Journey" Explorer [Create]│
│                                         │
│ 🟢 Pesach in 3 weeks                    │
│    → Holiday campaign suggested [Create] │
└─────────────────────────────────────────┘
```

### User-Initiated Campaign Creation

User can also query system to create custom campaigns:

**Example Interactions:**

```
User: "Show me cooling repeat customers who like reds"
System: Returns 12 contacts matching criteria

User: "Create a campaign for them with Special Value + 10% coupon"
System:
  - Creates CAMPAIGN project
  - Generates task list
  - Pre-fills audience (12 contacts)
  - Suggests bundle: Special Value
  - Suggests coupon: Create new "COOLING10" or use existing
  - Drafts message template with {variables}

User: "Assign content tasks to Evyatar"
System: Updates task assignments

User: "Schedule for Sunday 4pm"
System: Sets schedule, creates reminder task
```

### Campaign Execution Flow

1. **Segment contacts** by preference profile (Task 1)
2. **Match bundles** to segment (Task 2)
3. **Assign coupons** - create if needed, set email restriction (Task 3)
4. **Create content** - draft, translate, review (Tasks 4-6)
5. **Schedule & send** (Tasks 7-8)
6. **Log offers** as `coupon.offered` activity for each contact (Task 9)
7. **Track redemption** when orders come in (Task 10)

### Bundle Offer Message Template

**English:**
```
Hi {name},

Based on your love of {preference_summary}, I put together something special:

🍷 {bundle_name} - ₪{bundle_price}
{bundle_description}

✓ Free shipping included
{if_coupon}✓ Use code {coupon_code} for {discount}% off{/if}

{bundle_link}

Let me know if you'd like me to customize it!
- JLMwines
```

**Hebrew:**
```
היי {name},

בהתאם לאהבה שלך ל{preference_summary}, הכנתי משהו מיוחד:

🍷 {bundle_name} - ₪{bundle_price}
{bundle_description}

✓ משלוח חינם כלול
{if_coupon}✓ קוד {coupon_code} ל-{discount}% הנחה{/if}

{bundle_link}

ספר/י לי אם תרצה שאתאים אישית!
- JLMwines
```

### Dynamic Bundle Creation (Future)

Instead of fixed bundles, generate on-the-fly:

1. **Input:** Contact preferences + target price (₪399)
2. **Query:** Products matching category, intensity, price range
3. **Select:** 3-4 bottles that sum to target
4. **Output:** Personalized bundle suggestion

```javascript
function createDynamicBundle(contact, targetPrice = 399) {
  // Find products matching contact's taste profile
  // Optimize selection to hit target price
  // Prioritize: in-stock, good margin, not recently purchased by contact
  // Return product list with personalized description
}
```

### Metrics to Track

| Metric | Description |
|--------|-------------|
| Bundle suggestion → click rate | Are suggestions relevant? |
| Bundle suggestion → purchase rate | Conversion |
| Coupon redemption by segment | Which audiences respond? |
| Avg order value by bundle type | Revenue optimization |
| Repeat rate after bundle purchase | Did bundle create loyalty? |

---

## Customer Classification Rules

**War-Support Coupons** (from order data):
- `efrat`, `roshtzurim`, `gushwarriors`, `gush`, `tekoa`
- Any order with these coupons → `noncore.war_support`

**Gift Detection:**
- Billing country != Shipping country
- OR Billing last name != Shipping last name (with fuzzy match)

---

## Data Sources

| Data | Source | Import Method |
|------|--------|---------------|
| Order history | `order_export_*.csv` from WooCommerce | One-time load + ongoing sync |
| Order data | WebOrdM + WebOrdM_Archive | Live system (verify for gaps) |
| Subscribers | `subscribed_email_audience_export_*.csv` | Periodic Mailchimp export |
| Coupons | `coupon_export_*.csv` from WooCommerce | Periodic import |
| Campaigns | `mailchimp campaigns.csv` | Periodic Mailchimp export |

**Note:** Full order history available in export file. During implementation, verify live system data and backfill if gaps exist.

---

## Decisions Made

| Topic | Decision |
|-------|----------|
| WhatsApp | Manual send via WhatsApp Web (personal touch) |
| Mailchimp | CSV import/export only (no API) |
| Customer notes | Simple text field |
| Wine preferences | Start with infrastructure, enable smart recommendations |
| Coupon tracking | Log offers as activity, analyze redemption patterns |

---

## Not In Scope (Now)

- Direct Mailchimp API integration
- SMS sending
- Automated message sending (all comms are user-initiated)
- Complex wine recommendation engine
- Customer portal / self-service
- Lead scoring beyond simple churn risk

---

## Status

### Planning Complete ✓

- [x] Data analysis complete (223 core customers, patterns identified)
- [x] Customer segmentation defined (types + lifecycle status)
- [x] Contact schema designed (includes wine preferences)
- [x] Activity log schema designed (timeline events)
- [x] Coupon & campaign schemas designed
- [x] Communication features designed (WhatsApp, email, Mailchimp)
- [x] Year in Wine summary template
- [x] Bundle hierarchy & strategy (Special Value, Premium Value, Explorer)
- [x] Profitability strategy (Featured products as margin buffer)
- [x] Targeted bundle offers with coupon combinations
- [x] Campaign as Project integration
- [x] System-generated campaign suggestions
- [x] **AI Assistant integration designed (Claude API)**
- [x] Data sources identified
- [x] Key decisions documented

### Ready for Implementation

- [ ] **Plan approval**
- [ ] Phase 1: Data Foundation
- [ ] Phase 2: Daily Refresh
- [ ] Phase 3: Task Generation
- [ ] Phase 4: Contact List View
- [ ] Phase 5: Communication Actions
- [ ] Phase 6: Mailchimp & Coupon Integration
- [ ] Phase 7: Wine Preferences & Recommendations
- [ ] Phase 8: AI Assistant Integration

---

## Document History

| Date | Changes |
|------|---------|
| 2025-12-16 | v1 - Initial data analysis and basic schema |
| 2025-12-18 | v2 - Complete redesign with campaigns, bundles, preferences |

---

Updated: 2025-12-18
