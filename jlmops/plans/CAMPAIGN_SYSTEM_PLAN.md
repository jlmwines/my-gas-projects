# Campaign System Plan

**This is the strategy doc, not the implementation spec.** The campaign system shipped under a different shape — see `CAMPAIGN_ARCHITECTURE.md` for the live data model + service layer (`SysMarketingCampaigns`, `SysShortUrls`, `MarketingCampaignService`, `WebAppCampaigns`, `AdminCampaignsView`, the Distribution task templates). Schemas live in `../docs/DATA_MODEL.md`. This doc keeps the durable strategy: who we target, what offers work, and the hard-won lesson from the 2026-04-30 retrospective that **simple, presence-driven campaigns beat clever personalized ones** (§ Retrospective). The dropped mechanism designs (ambassador tiers, fgr coupon system, Year-in-Wine PDFs) have been removed — see the retrospective for why.

## Business Context

**Value proposition.** Curated seasonal selection (every wine tasted, chosen for quality + value), a mix of known and emerging Israeli wineries, a direct personal relationship with customers, a proprietary intensity/complexity/acidity scale, and expert guidance toward wines that match a customer's taste.

**Goals.** Acquisition (more new customers), loyalty (one-time → repeat), engagement (active personalized communication), retention (reduce churn, win back lapsed), profitability (use AI + data to grow the active base).

**Levers.** Featured higher-margin wines (offset discounts), curated bundles (better margins), email-applied coupons, free accessory/food gifts (free *bottles* may have legal issues — verify), auto-coupons by email list.

**Brand voice.** The manager is a humble home-grown wine celebrity with a word-of-mouth following. Messaging is honest and straightforward (no fluff), never snobbish (wine should be accessible), customer-first (genuinely wants customers to enjoy the wine), a helpful guide. Existing assets: blog posts, video clips, packing slips that already carry attributes + pairing + decanting notes.

**Attribute note.** Product pages show intensity/complexity/acidity but customers mostly ignore them. Attributes are an education/positioning asset on product surfaces — **not** a marketing-copy hook (see Retrospective).

## Campaign Types

- **Acquisition** — referral (existing customer shares a unique coupon, reward on first purchase); welcome offer (fixed amount preferred: NIS 50 off NIS 399 min reads as more valuable than 10%); subscriber→first-purchase conversion.
- **Retention** — Cooling (91–180d): automated personalized rec + small incentive. Lapsed (181–365d): monthly win-back with a featured wine. Dormant (365+d): quarterly aggressive offer or sunset.
- **Loyalty** — VIP recognition (most VIPs need no push; recognition opens referral conversations), preference-based bundle builder, seasonal taste-matched picks.
- **Engagement** — new arrivals matched to preferences, tasting notes on purchased wines, educational content by interest area.

## Segment Targeting

Segments come from the CRM (`SysContacts`; customer-type and lifecycle thresholds are defined in `../docs/DATA_MODEL.md`). Targeting dimensions:

- **Customer type** — `core.vip` (5+ orders or ₪3000+), `core.repeat` (2+), `core.new` (1), `noncore.gift` (lowest priority), `prospect.subscriber` (no orders — include with variant content).
- **Lifecycle** — Active / Recent / Cooling / Lapsed / Dormant. Dormant sunset threshold TBD after 2026 testing.
- **Preferences** — wine type, price band, attributes, top wineries. Kashrut matters to some but **don't emphasize in broad messaging** (can cool secular customers).
- **Language** — EN (66% of repeat customers) vs HE (34% of core, 31% of repeat — a retention opportunity).

**Language strategy.** Phase 1: parallel messaging — same targeting + offer, content translated but conceptually identical, sent to EN/HE in parallel, metrics tracked separately. Phase 2: independent optimization — diverge timing/tone/offers per language once data justifies it. Translation workflow: Admin creates → Manager translates → Admin drafts → Manager confirms → Admin schedules. Timing: Tuesday evenings work well for email; Israel's 6-day week + Shabbat defies conventional wisdom; no WhatsApp/SMS timing experience yet. **Start unified, let data guide divergence.**

A segment-export function (`getTargetSegment({customerType, lifecycleStatus, language, preferences, limit, sortBy, exclude})`) is the intended interface for pulling a targeted list with over-contact exclusion.

## Offer Structures

**Margin-aware.** Default to featured-wine bundles (positive margin) for all campaigns; reserve discount codes (10–15%, negative margin) for win-back / first purchase; free accessory gifts for VIP appreciation. Free shipping at NIS 399+ (else NIS 40) — bundles are designed to exceed the threshold. Featured/high-margin products: private label, special purchases, system-flaggable as 'featured' (Comax cost/profit data not yet imported).

**Bundle strategy.** Include 1–2 featured (high-margin) wines in every bundle, match to customer preferences, price attractively vs individual bottles. Each customer typically matches 2–3 bundle options; the offer applies to whichever they choose.

## Channels

- **Email (Mailchimp)** — primary mass channel; strong campaign↔purchase correlation; already EN/HE segmented.
- **Manager direct outreach** — personal contact for high-value moments (welcome call after first shipment, delivery check-in, VIP referral conversation, personal win-back at 90+ days). Tasks in `SysTasks`, outcomes in `SysContactActivity`. Capacity ~10 personal contacts/week to start.
- **WhatsApp** — manager is very active via personal WhatsApp; dominant channel in Israel. 2026 project: investigate WhatsApp Business + language options.
- **SMS (via Mailchimp)** — available, unused; common in Israel; consider for time-sensitive offers.
- **2026 improvement projects** — branding (still recycling winery boxes), WhatsApp Business, website emphasis on bundles/discounts, package inserts.

Coupon automation is available through WooCommerce import/export (email-restricted coupons, minimum-purchase thresholds, per-customer usage limits, free-gift choice). The live coupon/Mailchimp/user/order sync mechanics are implemented — see `CAMPAIGN_ARCHITECTURE.md` and the code, not this doc.

## Measurement & Feedback

**Email philosophy.** Email reminds/stimulates regular buyers rather than directly converting; ~50% of emails feature updated value wines; cadence ~2× per month (keep messages wanted, don't over-communicate); attribution is fuzzy.

**Success metrics.** Revenue (primary), dormant-customer revival (key goal), coupon redemptions (direct attribution), new orders from subscribers (conversion). **Attribution window: 7–14 days** from send — a January order with the campaign coupon counts. Customers don't order frequently, so many targets are already "due to order" when the email lands; the campaign triggers the reminder.

Per-send results are tracked in `SysCampaigns` (schema in `../docs/DATA_MODEL.md`). **Learning loop:** track campaign→outcome by segment, identify what works for which types, let AI surface patterns, A/B test offers and messaging.

## Export & AI

**Export system.** A flexible export builder: campaign contacts → Mailchimp (segment + fields), coupons → WooCommerce CSV, long URLs → short-URL service. Filter by segment / date / spend with do-not-contact exclusion; never export spend to customer-facing fields (taste preferences only).

**AI integration points.** Segment analysis (summarize characteristics, spot high-opportunity groups), campaign recommendations (target segments + offer structures + timing from history), content generation (segment-tailored copy, taste-matched descriptions), performance review (analyze results, compare across segments, recommend optimizations).

## Retrospective (2026-04-30) — the strategy anchor

The Year in Wine campaign (late-Dec 2025 / early-Jan 2026) drew pleasing feedback but **no real sales**. Three lessons:

1. **Customers don't choose wine by attribute scores.** Leading copy with "your top wineries / favorite categories / intensity range" felt off. Attributes are an education/positioning asset on product surfaces, not a marketing hook. *Don't lead email with "we've analyzed your preferences."*
2. **The offer asked too much.** Auto-coupons + free-gift-at-checkout + tiered rewards (fgr01/02/03) was a complex behavior request; personal touches got buried under mechanics. *Simpler offers (single coupon, single CTA) outperform clever ones.*
3. **Email's job is a "we exist" reminder.** Customers order infrequently; when an email arrives they're often already due. *Frequency and presence beat sophistication* — the newsletter print insert (`marketing/NEWSLETTER_PLAN.md`) runs on this premise.

**Dropped from the roadmap:** Year in Wine PDFs (wrong format); tiered reward coupons (fgr01/02/03 — unredeemed, complexity > value); free-gift-at-checkout selection mechanics.

**Stays valid:** the welcome offer (NIS 50 off ₪399 min — simple, single-step, live); the comeback campaign for lapsed/dormant (small-batch testing is the right approach); WhatsApp follow-up for new customers (`CONTACT_MANAGER_PLAN.md`); Mailchimp segmentation as an EN/HE language pair only (richer microsegmentation isn't justified at current volume).
