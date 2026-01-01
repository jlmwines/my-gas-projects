# Campaign System Plan

Strategic campaign planning system leveraging CRM data and AI for targeted customer engagement.

---

## Business Context

### Value Proposition
- **Curated Selection**: Every wine tasted each season, chosen for quality, value, and interesting characteristics
- **Winery Mix**: Well-known and emerging Israeli wineries
- **Direct Communication**: Personal relationship with customers
- **Proprietary Scale**: Intensity, complexity, acidity ratings for wine characteristics
- **Expert Guidance**: Helping customers discover wines that match their preferences

### Business Goals
1. **Acquisition**: More new customers
2. **Loyalty**: Convert one-time buyers to repeat customers
3. **Engagement**: Active communication and personalized recommendations
4. **Retention**: Reduce churn, win back lapsed customers
5. **Profitability**: Use AI + data as competitive advantage to grow active customer base

### Available Levers
| Lever | Description |
|-------|-------------|
| Featured Wines | Higher-margin wines to offset discounts |
| Bundles | Curated sets with better margins |
| Coupons | Discount codes, auto-applied by email |
| Free Gifts | Wine accessories, gourmet food items (note: free bottles may have legal issues - verify) |
| Referral Rewards | Contact-unique coupons for referrers |
| Auto-Coupons | Discount/gift applied automatically by email list (tested; bulk upload not tested) |

### Attribute System Opportunity
Product pages show intensity/complexity/acidity but customers generally ignore them. Campaign messaging can:
- Reference attributes to build trust ("wines similar to ones you enjoyed")
- Position as faster/simpler way to choose wine in opaque retail environment
- Extend authority through personalized recommendations

### Content Assets (Planned)
- FAQ additions to website
- Glossary of wine terms
- Both are natural candidates for package inserts

### Brand Voice
The manager is beloved - popular in wine world, humble home-grown celebrity. Physical store built following through word of mouth. Messaging principles:
- **Honest and straightforward** - no marketing fluff
- **No snobbery** - wine should be accessible, not intimidating
- **Customer-first** - genuinely cares if customers enjoy the wine, not just if transaction is profitable
- **Helpful guide** - "keys to enjoying the wine you prefer"

Existing content: Blog posts, video clips. Packing slips already include attributes, pairing suggestions, decanting details.

---

## Campaign Types

### 1. Acquisition Campaigns
**Goal**: New customers

| Strategy | Mechanism |
|----------|-----------|
| Referral Program | Existing customer gets unique coupon to share; reward on first purchase |
| Welcome Offer | Fixed amount preferred (NIS 50 off NIS 399 min vs 10% - fixed feels more valuable) |
| Subscriber Conversion | Move email subscribers to first purchase |

### 2. Retention Campaigns
**Goal**: Keep active customers engaged

| Segment | Trigger | Offer |
|---------|---------|-------|
| Cooling (91-180 days) | Automated | Personalized recommendation + small incentive |
| Lapsed (181-365 days) | Monthly batch | Win-back offer with featured wine |
| Dormant (365+ days) | Quarterly | Aggressive offer or sunset |

### 3. Loyalty Campaigns
**Goal**: Increase repeat purchase rate

| Strategy | Mechanism |
|----------|-----------|
| VIP Recognition | Currently no recognition - opportunity for loyalty + referral entry |
| Bundle Builder | Personalized bundles based on preferences |
| Seasonal Picks | Curated selection matching customer taste profile |

**VIP Notes**: Most VIPs need no encouragement to buy. Recognition is about:
- Loyalty reinforcement
- Opening door to referral conversations
- Acknowledging relationship, not pushing sales

### 4. Engagement Campaigns
**Goal**: Maintain relationship, gather feedback

| Type | Content |
|------|---------|
| New Arrivals | Wines matching customer preferences |
| Tasting Notes | Expert insights on wines they've purchased |
| Educational | Wine knowledge based on their interest areas |

---

## Segment Targeting

### Available Segments (from CRM)

**By Customer Type:**
- core.vip (5+ orders OR 3000+ NIS)
- core.repeat (2+ orders)
- core.new (1 order)
- noncore.gift (all orders are gifts) - **lowest priority, wait**
- prospect.subscriber (no orders yet) - **include in Year in Wine with variant content**

**By Lifecycle Status:**
- Active (0-30 days)
- Recent (31-90 days)
- Cooling (91-180 days)
- Lapsed (181-365 days)
- Dormant (365+ days) - **sunset threshold TBD after 2026 testing**

**By Preferences:**
- Wine type: Dry Red, Dry White, Rosé, Sparkling, etc.
- Price range: Budget, Mid, Premium
- Attributes: High intensity, low acidity, etc.
- Wineries: Top purchased wineries
- Kashrut: Important to some customers, but **don't emphasize in broad messaging** (could cool secular Israeli customers)

**By Language:**
- English (en) - 66% of repeat customers
- Hebrew (he) - 34% of core, 31% of repeat (retention opportunity)

### Language Campaign Strategy

**Phase 1: Parallel Messaging**
- Same targeting criteria, same offer structure
- Content translated but conceptually identical
- Send to EN and HE segments in parallel
- Track metrics separately per language

**Phase 2: Independent Optimization**
- Adjust timing independently (HE may respond differently to day/time)
- Adjust content tone/style based on engagement data
- Test different offer structures if one language underperforms
- A/B test within each language segment

**Translation Workflow:**
Admin creates → Manager translates → Admin drafts post/email → Manager confirms → Admin schedules

**Timing Notes:**
- Tuesday evenings work well for email
- Israel 6-day work week + Shabbat challenges conventional wisdom
- No experience yet with WhatsApp/SMS timing - open to testing

**Hebrew Retention Gap - Context:**
- Website historically more appealing to English speakers
- English speakers have fewer local alternatives
- English speakers more disposed to online shopping, higher spend
- Hebrew is newer focus (much larger audience, less experience)
- Hebrew market culture makes marketing more complex

Start unified, let data guide divergence.

### Segment Export Function
```javascript
// Proposed: CampaignService.getTargetSegment(options)
{
  customerType: ['core.repeat', 'core.vip'],  // filter by type
  lifecycleStatus: ['Cooling', 'Lapsed'],     // filter by status
  language: 'en',                              // 'en', 'he', or null for all
  preferences: {
    categories: ['Dry Red'],                   // must have purchased
    priceMin: 80,                              // price range
    priceMax: 200
  },
  limit: 100,                                  // max contacts
  sortBy: 'totalSpend',                        // prioritization
  exclude: ['recent_campaign_30d']             // don't over-contact
}
```

---

## Offer Structures

### Margin-Aware Offers
| Offer Type | Margin Impact | Use When |
|------------|---------------|----------|
| Featured Wine Bundle | Positive | Default for all campaigns |
| Discount Code (10-15%) | Negative | Win-back, first purchase |
| Free Shipping | N/A | Already included at NIS 399+ |
| Free Gift (accessory) | Low negative | VIP appreciation |
| Auto-Coupon | Variable | Targeted retention |

**Free Shipping:** NIS 399 minimum (else NIS 40). Required for almost any order except gifts. Bundles designed to exceed threshold.

**Featured/High-Margin Products:**
- Private label wines
- Special purchases
- Can mark products as 'featured' in system
- Comax has cost/profit data (not yet imported - future enhancement)

**Bundle Discounts:** Prominently displayed when applicable.

### Bundle Strategy
- Include 1-2 featured (high-margin) wines in every bundle
- Match bundle to customer preferences
- Offer at attractive total vs. individual pricing

### Bundle Variants (Year-End 2025)

| Bundle | Target Preference | Match Criteria |
|--------|-------------------|----------------|
| Special Reds | Red wine buyers | sc_FrequentCategories contains "Dry Red" |
| Special Whites/Rosés | White/rosé buyers | sc_FrequentCategories contains "Dry White" or "Rosé" |
| Special Variety | Explorers | 3+ different categories in history |
| Premium Value | Premium buyers | sc_PriceMax >= 150 |

**Matching Logic:**
- Each customer gets 2-3 bundle options based on preferences
- Most customers match multiple bundles
- Offer applies to any bundle they choose

**Example personalization:**
- VIP who buys premium reds → Special Reds + Premium Value
- Repeat buyer of whites → Special Whites/Rosés + Special Variety
- New customer with mixed orders → Special Variety + most-purchased category

### Referral Mechanics

See **Ambassador System** section below for full referral program design.

---

## Ambassador System

Referral-based tier above VIP. Ambassadors earn rewards for bringing new customers.

### Tier Structure (Gemstones)

```
core.vip (by spend) → ambassador.garnet (by referrals) → ambassador.ruby → ambassador.sapphire → ...
```

| Tier | Threshold | Reward Level |
|------|-----------|--------------|
| Garnet | 1 successful referral | Entry reward (accessory) |
| Ruby | TBD referrals | Mid-tier reward |
| Sapphire | TBD referrals | Premium reward |
| *Emerald, Diamond...* | *Future* | *Reserved for top ambassadors* |

Gemstone naming allows adding more precious tiers at the top as needed.

### Entry Criteria

- **1 successful referral = Ambassador (Garnet)**
- Immediate reward upon first referral conversion
- VIP status based on spend is separate from Ambassador status based on referrals
- A customer can be both VIP and Ambassador

### Coupon Code Format

Based on email prefix for memorability:

```
david@gmail.com    → DAVID
sarah@company.co   → SARAH
david@yahoo.com    → DAVID1  (duplicate handling)
```

**Generation rules:**
1. Extract email prefix (before @)
2. Uppercase
3. If duplicate exists, append incrementing digit
4. Store mapping in SysContacts

### Referral URL & QR Codes

**JLMOPS exports checkout URLs with coupon:**
```
https://shop.example.com/?coupon=DAVID
```

**Short URL workflow (manual via T2M):**
1. JLMOPS exports CSV: contact, referral code, checkout URL
2. Upload to T2M bulk shortener
3. Download CSV with short URLs
4. Use short URLs for Canva QR generation

Benefits of short URLs:
- Cleaner QR codes (less dense, scans easier)
- Shareable verbally
- Click tracking via T2M analytics
- Editable destination without regenerating QR

**QR Code Generation (Canva):**
1. Import CSV with short URLs to Canva
2. Mail merge creates personalized QR cards
3. QR codes are permanent assets (same code reused across campaigns)

### Reusable Campaign Model

Referral infrastructure is permanent, not disposable:

```
Campaign 1 (Month 1):
  Activate coupons → Run campaign → Deactivate at month end

Campaign 2 (Month 4):
  Reactivate same coupons → Run again → Deactivate

...repeat as needed
```

**Permanent assets:**
- Coupon codes (toggle active/inactive in WooCommerce)
- QR codes (print once, valid forever)
- Package inserts (reusable across campaigns)
- Short URLs (persist in T2M)

### Reward Structure

Ambassadors earn **free items** (not discounts):

| Tier | Coupon Code | Reward Type | Examples |
|------|-------------|-------------|----------|
| Garnet | `fgr01` | Accessory | Wine stopper, opener, pourer |
| Ruby | `fgr02` | Entry wine | Value bottle from featured selection |
| Sapphire | `fgr03` | Premium wine | Mid-range bottle |

**Coupon setup (WooCommerce):**
- Codes are anonymous (not obviously tier-related)
- Each coupon configured with multiple free product options via Soft79
- Customer chooses their item at checkout
- Rotate product options by editing the coupon (same code, new choices)

**Mechanism:**
- Admin assigns reward coupon to ambassador's user ID based on tier
- Coupon grants free item selection at checkout
- Easy to adjust: change coupon assignments or product options, not system logic

### Future: Ongoing Referral Rewards

Tracking referral relationships enables affiliate-style rewards:
- Ambassador earns credit on referral's future purchases
- Could be fixed credit per order or % of order value
- Tier multiplier (Sapphire earns more than Garnet)

*Not in initial implementation - design allows for it later.*

### Referral Coupon Generation UI

**CSV export for WooCommerce import:**

| Column | UI Element | Default |
|--------|------------|---------|
| `post_title` | Generated | Email prefix (uppercase, dots removed) |
| `post_status` | Fixed | `publish` |
| `discount_type` | Fixed | `fixed_cart` |
| `coupon_amount` | Input field | 50 |
| `usage_limit_per_user` | Fixed | 1 |
| `date_expires` | Date picker | Campaign end date |
| `meta:_wjecf_first_purchase_only` | Checkbox | Yes (checked) |

**Code generation rules:**
```
shelly.robertson@outlook.com → SHELLYROBERTSON
david@gmail.com             → DAVID
john.smith.jr@company.co    → JOHNSMITHJR
```
- Extract prefix (before @)
- Remove dots/periods
- Uppercase
- If duplicate, append digit (DAVID1, DAVID2)

**UI workflow:**
1. Campaign setup: set expiry date, discount amount, first-purchase toggle
2. Select contacts for referral program
3. Generate coupon codes from email prefixes
4. Export CSV
5. Import to WooCommerce

### Required Fields

**SysContacts additions:**
| Field | Purpose |
|-------|---------|
| `sc_WooUserId` | WooCommerce user ID (for coupon targeting) |
| `sc_AmbassadorTier` | Current tier: garnet, ruby, sapphire, or null |
| `sc_ReferralCode` | Their unique coupon code (email prefix) |
| `sc_ReferralCount` | Number of successful referrals |
| `sc_ReferredBy` | Contact ID of who referred them (if any) |
| `sc_DoNotContact` | Boolean: exclude from all campaigns/outreach |
| `sc_DoNotContactReason` | Why: "competitor", "problem customer", "legal", etc. |

**Do Not Contact:**
Internal business flag - contact record stays intact for order history, just excluded from all campaign segments and outreach lists. Examples:
- Competitors buying to check prices/selection
- Problem customers (chronic complaints, return abuse)
- Legal issues or disputes
- Manager discretion

**Tracking:**
- Coupon usage links to ambassador via `sc_ReferralCode`
- New customer's `sc_ReferredBy` links to ambassador's contact ID
- `sc_ReferralCount` increments on each successful referral

### WooCommerce User ID - Universal Coverage

**Status (Dec 2025): COMPLETE** - All contacts have WooCommerce user IDs.

| Contact Type | WooUserId | Marketing Email | Order Email |
|--------------|-----------|-----------------|-------------|
| Subscriber + Customer | ✓ | ✓ Mailchimp | ✓ transactional |
| Subscriber only | ✓ | ✓ Mailchimp | n/a |
| Customer only (not subscribed) | ✓ | ✗ | ✓ transactional |

**What this enables:**
- Coupon targeting by user ID works for everyone
- Ambassador program can cover entire contact base
- Subscriber conversion campaigns can use auto-applied coupons
- Every contact has at least one contact method

**Campaign channel by contact type:**

| Campaign Goal | Subscribers | Customers (not subscribed) |
|---------------|-------------|---------------------------|
| Marketing offers | Mailchimp | WhatsApp / order insert |
| Referral program | Mailchimp | WhatsApp / order insert |
| Win-back | Mailchimp | WhatsApp / phone |
| Transactional | n/a | Order confirmation email |

**Subscriber conversion unlocked:**
- Create first-purchase coupon (e.g., NW20A6)
- Restrict to subscriber user IDs
- Coupon auto-applies at checkout - no code entry needed
- Removes friction from first purchase

---

## Channels

### Email (Mailchimp)
- Primary mass communication channel
- Strong correlation observed between campaigns and purchases
- **Already segmented EN/HE** - data imported

### Manager Direct Outreach
Personal contact by manager for high-value interactions:

| Segment | Trigger | Action |
|---------|---------|--------|
| New customers | First order shipped | Welcome call/WhatsApp |
| Recent shipments | Order delivered | Check-in, gather feedback |
| Loyal customers | VIP status | Referral conversation |
| Cooling customers | 90+ days | Personal win-back |

Tasks created in SysTasks, outcomes logged in SysContactActivity.

**Capacity:** ~10 personal contacts per week to start

### WhatsApp (New)
- Currently personal WhatsApp, not Business
- Manager very active with customers via WhatsApp
- WhatsApp dominant in Israel for business communication
- **2026 project**: Investigate WhatsApp Business + language options

### SMS (via Mailchimp)
- Available but unused
- SMS marketing common in Israel
- Consider for time-sensitive offers

### 2026 Improvement Projects
- Branding (still recycling winery shipping boxes)
- WhatsApp Business setup
- Website focus on bundles/discounts (rarely mention sales currently)
- Package inserts

---

## Automation Capabilities

### WooCommerce Coupon System
Capabilities available via import/export:
- **Email-restricted coupons**: Auto-apply by customer email
- **Minimum purchase**: Require threshold (e.g., ₪200)
- **Usage limits**: 1 use per customer
- **Free gift choice**: Offer selection of gifts

Workflow:
1. Generate coupon CSV with unique codes per contact
2. Import to WooCommerce
3. Notify customers via email/WhatsApp
4. Track redemptions

### Coupon Code Naming Convention

Standard format for campaign coupon codes across Mailchimp, WooCommerce, and JLMOPS:

**Structure:** `[Campaign][Discount][Month][Year]`

**Campaign Types:**
| Code | Campaign |
|------|----------|
| `WB` | Win-back (Lapsed 181-365 days) |
| `RE` | Re-engage (Cooling 91-180 days) |
| `NW` | New customer welcome |

**Month Codes (A-L = January-December):**
| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |

**Year:** Single digit (5 = 2025, 6 = 2026, etc.)

**Examples:**
| Code | Meaning |
|------|---------|
| `WB60L5` | Win-back, 60% off, Dec 2025 |
| `WB60A6` | Win-back, 60% off, Jan 2026 |
| `RE10K5` | Re-engage, 10% off, Nov 2025 |
| `NW20A6` | New customer, 20% off, Jan 2026 |

**Notes:**
- Different audience segments can share the same offer code
- Codes expire, so month/year suffix distinguishes reissued offers
- Keep codes short and functional (not customer-friendly phrases)

### Referral Coupons
- Unique code per referrer (e.g., REFER-DAVID-X7K2)
- Referrer reward: discount or free gift on next order
- Referee reward: first-purchase discount
- Track via coupon usage reports

### WooCommerce User ID for Coupon Targeting

WooCommerce coupons can be restricted to specific users by uploading a comma-separated list of user IDs. To support this:

**New Field:** `sc_WooUserId` in SysContacts

**Status (Dec 2025): COMPLETE** - All contacts have WooCommerce user IDs. See **Ambassador System** section for contact coverage details.

**Data Flow (going forward):**
1. WooCommerce order export includes `customer_user` field
2. Maps to `wos_CustomerUser` in staging (already configured)
3. Add mapping: `wos_CustomerUser` → `wom_CustomerUser` (new)
4. ContactImportService captures and stores as `sc_WooUserId`

**Implementation Steps:**
1. Add `wom_CustomerUser` to WebOrdM schema (`schemas.json`)
2. Add staging→master mapping (`mappings.json`)
3. Add `sc_WooUserId` to SysContacts schema
4. Update ContactImportService to capture user ID from orders

**Backfill (one-time): COMPLETE**
- ✓ WooCommerce accounts created for past guest orders
- ✓ WooCommerce accounts created for Mailchimp subscribers
- ✓ User IDs matched to SysContacts by email
- ✓ `sc_WooUserId` populated for all contacts

**Usage:**
- Export campaign segment with `sc_WooUserId` values
- Paste comma-separated list into WooCommerce coupon "Allowed emails" field
- Coupon auto-applies only for those users

### Trigger-Based Campaigns
| Trigger | Action |
|---------|--------|
| 90 days since order | Send cooling customer email |
| VIP threshold reached | Send VIP welcome + benefit |
| ~~Birthday~~ | Not relevant (2-5 day delivery doesn't fit birthday gifting) |
| New wine matching preferences | Send notification |
| Holidays | Major opportunity - Rosh Hashanah, Pesach, etc. |

**VIP Insight:** Best customers drink wine regularly (not occasion-driven). They don't need reminders to buy - they need recognition and referral opportunities.

---

## Data Sync

### Sync Overview

| Data | Source of Truth | Direction | Current | API Available |
|------|-----------------|-----------|---------|---------------|
| Orders | WooCommerce | Woo → JLMOPS | Daily (automated) | n/a |
| Coupon usage | WooCommerce | Woo → JLMOPS | Via order import | n/a |
| Coupon definitions | WooCommerce | Bidirectional | Manual CSV | ✓ Woo REST |
| Subscribers | Mailchimp | MC → JLMOPS | Manual CSV | ✓ Mailchimp API |
| WooCommerce User IDs | WooCommerce | Woo → JLMOPS | Manual CSV | ✓ Woo REST |
| Contact preferences | JLMOPS | JLMOPS only | n/a | n/a |

**API strategy:** Start manual, automate when volume/frequency justifies the build effort.

### Coupon Sync (Bidirectional)

WooCommerce is source of truth for active coupons.

**API access available** - REST API keys can be created in WooCommerce.

**Option A: Manual CSV (current)**
- Export/import coupon CSV
- Works, but manual round-trip

**Option B: REST API automation (future)**
| Action | API Endpoint |
|--------|--------------|
| Get all coupons | `GET /wp-json/wc/v3/coupons` |
| Create coupon | `POST /wp-json/wc/v3/coupons` |
| Update coupon | `PUT /wp-json/wc/v3/coupons/{id}` |
| Add user restrictions | Update `email_restrictions` field |

**API benefits:**
- Create referral coupons directly from JLMOPS
- Update allowed user IDs without CSV round-trip
- Real-time coupon status/usage sync
- No manual export/import steps

**Note on Soft79 Extended Coupon Features plugin:**
- REST API supports core WooCommerce coupon fields (sufficient for referral coupons)
- Extended features (BOGO, auto-apply rules) need CSV/admin
- Key Soft79 field: `meta:_wjecf_first_purchase_only` - not via REST, use CSV/admin
- Referee coupons may need first-purchase restriction → create via CSV or set manually

**Why sync matters:**
- Campaign projects named after coupon codes (e.g., "WB60L5 Campaign")
- Need current data for planning
- Usage tracking for ROI measurement

**Recommendation:** Start with manual CSV. Build API integration when referral/ambassador program launches - that's when automated coupon creation becomes valuable.

### Mailchimp Sync

**API access available** - can automate if needed.

**Option A: Manual CSV (current)**
1. Export audience CSV from Mailchimp
2. Import to SysContacts
3. Frequency: Monthly or before major campaigns

**Option B: API automation (future)**
1. Scheduled job pulls subscriber changes via Mailchimp API
2. Creates/updates contacts in SysContacts
3. Could run daily or weekly

**Fields synced:**
- Email, name
- Subscribe status (subscribed, unsubscribed, cleaned)
- Language preference
- Tags

**Recommendation:** Start with manual CSV. Build API sync when volume/frequency justifies it.

### WooCommerce User Sync

**For new subscribers (not yet customers):**
1. Create WooCommerce accounts for Mailchimp subscribers
2. Get user IDs into JLMOPS
3. Populates `sc_WooUserId`

**Option A: Manual CSV**
- Export user list from WooCommerce
- Import to SysContacts (match by email)
- Frequency: After Mailchimp sync, or before coupon campaigns

**Option B: REST API**
| Action | API Endpoint |
|--------|--------------|
| Get all users | `GET /wp-json/wc/v3/customers` |
| Get user by email | `GET /wp-json/wc/v3/customers?email=x` |
| Create user | `POST /wp-json/wc/v3/customers` |

**API benefits:**
- Look up user ID immediately when needed
- Could even create WooCommerce accounts from JLMOPS
- No CSV export/import cycle

**Recommendation:** Manual CSV sufficient for now. API useful if creating many subscriber accounts frequently.

### Order Sync (Existing)

Daily automated sync already handles:
- New orders → ContactImportService
- Customer info updates
- Order history for preferences
- Coupon usage (`wom_CouponItems`)

---

## Measurement & Feedback

### Email Philosophy
- Email reminds/stimulates regular buyers (not direct conversion)
- ~50% of emails feature updated value wines
- Frequency: ~2x per month to keep messages desired (not over-communicate)
- Attribution is fuzzy - hard to directly attribute orders to specific campaigns

### Success Metrics
- **Revenue** (primary)
- **Dormant customer revival** (key goal)
- Coupon redemptions (direct attribution)
- New orders from subscribers (conversion)

**Attribution Window:** 7-14 days from campaign send. Order in January with coupon = score.

**Note:** Customers don't order frequently. Many targets will be "due to order" when email arrives - campaign reminds/triggers.

### Campaign Tracking Fields (SysCampaigns)
```
scm_CampaignId
scm_Name
scm_Goal (acquisition, retention, engagement, loyalty)
scm_TargetSegment (JSON: criteria used)
scm_OfferType (discount, bundle, gift, referral)
scm_OfferValue
scm_SendDate
scm_AudienceSize
scm_ResultOpens
scm_ResultClicks
scm_ResultOrders
scm_ResultRevenue
scm_ResultNewCustomers
scm_ROI
```

### Learning Loop
1. Track campaign → outcome by segment
2. Identify what works for which customer types
3. AI analyzes patterns and improves recommendations
4. A/B test offers and messaging

---

## Export System

Flexible export interface for campaign and coupon management.

### Export Types

| Export Type | Destination | Purpose |
|-------------|-------------|---------|
| Campaign contacts | Mailchimp | Segment with referral codes, reward tier, etc. |
| Referral coupons | WooCommerce | New coupon CSV for import |
| Reward user IDs | WooCommerce | Add to fgr01/02/03 eligibility |
| Long URLs | T2M | Bulk shorten, get short URLs back |

### UI Design

```
Export Builder
├── Select preset or custom
├── Filter contacts
│   ├── Segment (core.vip, core.repeat, etc.)
│   ├── Date range (orders in 2025)
│   ├── Spend range (₪1,000+, ₪2,000+, etc.)
│   └── Exclude do-not-contact
├── Select fields / transformations
│   ├── Email → Referral code
│   ├── Spend → Reward tier (fgr01/02/03)
│   ├── Generate checkout URL
│   └── Standard contact fields
├── Preview
└── Download CSV
```

### Presets

| Preset | Filters | Fields |
|--------|---------|--------|
| Year in Wine 2025 | 2025 orders, ₪1,000+ spend | See detailed fields below |
| Referral Coupons | Selected contacts | post_title, post_status, discount_type, amount, expiry, first_purchase |
| Reward Assignments | By tier | WooCommerce user IDs (comma-separated list) |
| T2M URLs | Selected contacts | Referral code, checkout URL |

**Year in Wine 2025 - Export Fields:**

| Category | Fields |
|----------|--------|
| Identity | sc_Email, sc_Name, sc_Language |
| Top Wineries | sc_TopWineries_En/He |
| Red Grapes | sc_TopRedGrapes_En/He |
| White Grapes | sc_TopWhiteGrapes_En/He |
| Red Wine Attributes | sc_RedIntensityRange, sc_RedComplexityRange |
| White Wine Attributes | sc_WhiteComplexityRange, sc_WhiteAcidityRange |
| **Generated** | Referral code (from email), Reward tier (fgr01/02/03) |

**Internal (filter/segment by, not exported):**
- 2025 spend (for reward tier assignment)
- Average price (for segmentation)
- Order count, total spend

**Customer-facing (exported to Mailchimp):**
- Taste preferences only - never mention their spending

### Workflow Example: Year in Wine

1. **Run preset "Year in Wine 2025"**
   - Filters: orders in 2025, spend ≥ ₪1,000
   - Output: contact list with referral codes + reward tiers

2. **Export referral coupons CSV**
   - From same contacts
   - WooCommerce coupon format
   - Import to WooCommerce

3. **Export reward user IDs**
   - Three lists: fgr01 users, fgr02 users, fgr03 users
   - Add to each coupon's eligibility in WooCommerce

4. **Export for Mailchimp**
   - Contact data with referral code, reward tier
   - Use in Year in Wine campaign

---

## AI Integration Points

### 1. Segment Analysis
- Summarize segment characteristics
- Identify high-opportunity groups
- Spot trends and patterns

### 2. Campaign Recommendations
- Suggest target segments for business goals
- Recommend offer structures based on history
- Propose timing based on engagement patterns

### 3. Content Generation
- Email copy tailored to segment
- Wine descriptions matching customer vocabulary
- Personalized recommendations

### 4. Performance Review
- Analyze campaign results
- Compare effectiveness across segments
- Recommend optimizations

---

## Existing Infrastructure

### Available Services
| Service | Relevant Capabilities |
|---------|----------------------|
| **ContactService** | Contact CRUD, preferences, activity logging |
| **ContactEnrichmentService** | Preference calculation from order history |
| **CouponService** | Import/track coupons, usage tracking, conversion rates |
| **CampaignService** | Mailchimp history (extend for planning) |
| **BundleService** | Bundle management, slot criteria matching |
| **ProjectService** | CAMPAIGN project type ready |
| **TaskService** | Task creation, de-duplication, auto-assignment |

### Data Available
- **SysContacts**: Customer profiles with preferences, lifecycle status
- **SysContactActivity**: Activity history per contact
- **SysCoupons + SysCouponUsage**: Coupon tracking
- **SysCampaigns**: Mailchimp campaign history
- **SysProjects + SysTasks**: Project/task management

### Build vs Extend
- **Extend CampaignService**: Add `getTargetSegment()` for campaign planning
- **Extend CouponService**: Add bulk coupon generation for campaigns
- **Use existing**: Project/Task system for campaign workflow

---

## Implementation Phases

### Phase 1: Foundation (Current)
- [x] SysContacts with preferences
- [x] Segment classification
- [x] Activity history
- [x] Dual-language preference storage
- [x] WooCommerce User ID for coupon targeting (backfill complete Dec 2025)
- [ ] Segment export function

### Phase 2: Small Batch Tests
Manual tests to learn what works before building automation:

| Test | Segment | Channel | Size | Goal |
|------|---------|---------|------|------|
| Cooling nudge | 91-180 days | Email | 10-15 | Test win-back messaging |
| Win-back offer | 181-365 days | Email + coupon | 10-15 | Test discount vs bundle |
| Subscriber convert | prospect.subscriber | Email | 20-30 | First purchase offer |
| New customer welcome | First order | Manager call | 5-10 | Personal touch impact |
| VIP referral | core.vip | Manager WhatsApp | 5-10 | Referral conversation |

Track outcomes in SysContactActivity. No automation yet - learn patterns first.

### Phase 3: Manager Task System
- [ ] Task type: crm.outreach (contact customer)
- [ ] Auto-create tasks for manager based on segment triggers
- [ ] Log outcomes in SysContactActivity
- [ ] Simple dashboard of pending outreach tasks

### Phase 4: Campaign Automation
Build automation based on Phase 2 learnings:
- [ ] Segment export with parameters
- [ ] Coupon CSV generation for WooCommerce import
- [ ] Trigger-based task creation
- [ ] Campaign project type with basic metrics

### Phase 5: AI Enhancement
- [ ] AI-assisted segment analysis
- [ ] Content generation for emails
- [ ] "Year in Wine" personalized summaries
- [ ] Performance pattern analysis

### Phase 6: Order Insertions (Future)
Physical inserts in shipment boxes:
- Monthly newsletter with blog teaser + QR code
- Email subscribe pitch for non-subscribers
- Seasonal wine recommendations
- **Ambassador referral card** with personalized QR code

**Referral Card Workflow:**
1. JLMOPS exports contact list with referral codes and short URLs
2. Canva mail merge generates personalized QR code cards per customer
3. Cards printed and included in shipments
4. QR codes are permanent assets (same coupon, reusable across campaigns)
5. Campaign activation/deactivation controlled in WooCommerce

**Card contains:**
- Customer's unique referral code (email prefix)
- QR code linking to T2M short URL → checkout with coupon
- Brief value prop for sharing

Requires: Canva template design, print workflow, T2M account for bulk URL shortening

---

## Year-End 2025 Campaigns

### Campaign 1: Year in Wine (Customers)

**Audience:** All contacts with orders in 2025
**Channel:** Mailchimp (PDF attachment), WhatsApp/email for non-subscribers
**Timing:** Late December / Early January

**Content - Light PDF (Spotify Wrapped style):**
Keep it simple. Core message: "We can help you get more of what you enjoy with less hassle and risk."
- Highlights only (not every bottle)
- Top categories/preferences
- Brief taste profile
- Invitation to continue in 2026

**Tiered Rewards by 2025 Spend:**
| 2025 Spend (NIS) | Reward Coupon | Reward Level |
|------------------|---------------|--------------|
| 1,000 - 1,999 | `fgr01` | Accessory (stopper, opener, etc.) |
| 2,000 - 3,999 | `fgr02` | Entry wine |
| 4,000+ | `fgr03` | Premium wine |

**Referral Coupon:**
Every Year in Wine recipient also gets a personalized referral coupon to share:
- Code generated from email prefix (SHELLYROBERTSON, DAVID, etc.)
- New customer discount (₪50 fixed cart)
- First purchase only
- Launches ambassador program for that contact

**What recipients receive:**
1. Year in Wine PDF summary
2. Reward coupon (fgr01/02/03) based on spend tier
3. Personal referral coupon to share with friends

**Delivery:**
- Subscribers: Mailchimp with PDF stored per contact
- Non-subscribers: Direct email/WhatsApp with PDF attached

### Campaign 1b: Year in Wine (Subscribers - No Orders)

**Audience:** prospect.subscriber with no 2025 orders
**Subject:** "Your Year in Wine" (same enticing subject)

**Content - Forward-Looking:**
- "We don't have history with you yet..."
- "We're planning a great 2026"
- Choice of 3 great bundles
- Big first-purchase discount

**Goal:** Convert subscribers to first purchase

### Campaign 2: Comeback Offer (Lapsed/Dormant)

**Audience:** No orders in 2025 (lapsed 181-365d, dormant 365+d)
**Channel:** Email, WhatsApp for known phones
**Timing:** Can START BEFORE Year in Wine - begin small group testing now

**Admin has bandwidth** for marketing testing. Start with small batches, test messaging/offers, refine before scaling.

**Content - "Here's What You Missed":**
- Showcase the attribute rating system
- Highlight seasonal curation ("We tasted X wines to pick these")
- Featured bundle based on their last known preferences
- Invitation to rediscover

**Offer:**
- Comeback discount (10-15%)
- Curated bundle at attractive price
- Focus on value and personal curation story

---

## Next Steps

### Immediate: Segment Export
1. Build `CampaignService.getTargetSegment(options)` function
2. Export segments for review:
   - 2025 customers (Year in Wine)
   - No 2025 orders (Comeback targets)
   - Subscribers without orders (Year in Wine variant)
3. Review data, identify test groups for comeback campaign

### While Building: Admin Tasks
- Research PDF generation options (Canva mail merge, Google Docs, other)
- Draft comeback messaging
- Identify bundle options for offers

### After Segment Export
1. Pull small comeback test group (10-20 contacts)
2. Test messaging via email/WhatsApp
3. Refine based on results
4. Scale or adjust approach

### System Support (As Needed)
- Add crm.outreach task type for manager tasks
- Track coupon redemptions
- Add campaign-to-project linking

---

Updated: 2025-12-28
