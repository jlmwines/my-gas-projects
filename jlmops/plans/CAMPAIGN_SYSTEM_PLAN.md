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
1. Generate unique coupon per contact (e.g., REFER-{name}-{code})
2. Track coupon usage to original referrer
3. Reward referrer: credit, free gift, or discount on next order
4. Reward referee: first-purchase discount

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

### Referral Coupons
- Unique code per referrer (e.g., REFER-DAVID-X7K2)
- Referrer reward: discount or free gift on next order
- Referee reward: first-purchase discount
- Track via coupon usage reports

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
- Referral card with unique coupon code

Requires: Insert design, print workflow, inventory tracking

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

**Tiered Rewards (redeemable January):**
| Customer Type | Reward |
|---------------|--------|
| core.vip | Automatic discount (details TBD) |
| core.repeat | TBD |
| core.new | TBD |

Reward specifics to be decided closer to launch.

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

Updated: 2025-12-22
