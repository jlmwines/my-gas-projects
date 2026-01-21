# JLM Wines Website Update Plan

## Goals
1. Align website with updated content and brand messaging
2. Guide visitors toward bundles/packages (curated selections) over individual wines
3. Emphasize trust differentiator: wines curated by someone who knows what they're doing
4. Streamline navigation for clarity and focus

---

## Part 1: Navigation Menu Restructure

### Current State (11 top-level items)
Home, Suggestions, Shop, Favorites, Gifts, Cart, Account, About, Articles, Contact, Language

### New Structure (6 top-level items + cart/language)

| Menu Item | Type | Contents |
|-----------|------|----------|
| **Home** | link | — |
| **We Recommend** | submenu | Bundles, Packages, Gifts (page), Seasonal |
| **Shop** | submenu | All wine categories (Dry Red, Dry White, Rosé, Semi-Dry, Dessert, Fortified, Liqueurs, Accessories) |
| **My Account** | submenu | Account, Favorites |
| **Info** | submenu | Meet Evyatar, FAQ, Wine Talk |
| **Cart** | link | — |

### Changes Summary
- **Suggestions → We Recommend** — warmer, emphasizes curation
- **Gifts** — becomes page link under We Recommend (not its own submenu)
- **About → Meet Evyatar** — personal, trust-building
- **Articles → Wine Talk** — conversational, not educational
- **Contact** — demoted to footer only (WhatsApp icon handles urgent contact)
- **Favorites + Account** — combined into My Account

### Blog/Newsletter Branding
- **Name:** Wine Talk
- **Tagline:** from Evyatar
- **Used for:** Blog section and email newsletter (consistent branding)

---

## Part 2: Homepage Update

**Strategy reference:** `website/WEBSITE_STRATEGY.md` (for copy/phrases)

### Key Phrases (use these)
- "The Second Sip Rule"
- "You're buying our palate"
- "We put our reputation on every packing slip"
- "An honest guide in a complicated world"

### Alignment Notes
- Menu "We Recommend" covers occasions — bundles/packages already include Shabbat, holidays, etc.
- No separate occasion navigation needed

---

## Homepage Layout (Section by Section)

### Section 1: Hero
**Purpose:** Answer "why trust you?" in 3 seconds

| Element | Desktop | Mobile |
|---------|---------|--------|
| Layout | 2 columns (text left, image right) | Stack (image top, text below) |
| Image | Evyatar tasting or in shop — warm, personal | Same, cropped square |
| Headline | "Wine without the guesswork" | Same |
| Subhead | "Every bottle personally tasted. Your collection, curated before you browse." | Same |
| CTA | Single button: "See What We Recommend" → /we-recommend/ | Same, full width |

**No slider.** Static hero converts better.

---

### Section 2: Bundles
**Purpose:** Show the flexible path — "we recommend, you choose"

| Element | Desktop | Mobile |
|---------|---------|--------|
| Heading | "Build Your Own" | Same |
| Subhead | "We recommend. You choose." | Same |
| Layout | **3-4 columns** | 2 columns |
| Products | Value bundles (Special Value, etc.) | Same, scrollable |
| Card style | Image + title + price range | Same |

**Key message:** Flexibility. Customer picks from curated options.

**CTA below:** "See All Bundles" → /we-recommend/bundles/

---

### Section 3: Packages
**Purpose:** Show the easy path — "we choose, you save"

| Element | Desktop | Mobile |
|---------|---------|--------|
| Heading | "Ready-Made Packages" | Same |
| Subhead | "We choose. You save. A perfect gift for someone special — like yourself." | Same |
| Layout | **3-4 columns** | 2 columns |
| Products | BBQ, Shabbat, Sure Bets, Red Wine Lover, etc. | Same, scrollable |
| Card style | Image + title + discount badge + price | Same |

**Key message:** Occasion-themed. Discounted. Gift-ready.

**CTA below:** "See All Packages" → /we-recommend/packages/

---

### Section 4: Trust Builder (How We Choose)
**Purpose:** Deepen trust for visitors who need more

| Element | Desktop | Mobile |
|---------|---------|--------|
| Layout | 2 columns (text left, image right) | Stack |
| Image | Tasting setup or wine samples | Same |
| Heading | "How We Choose" | Same |
| Body | "We taste every wine before it reaches the site. Most don't make the cut. The ones that do? We'd serve them at our own table." | Same |
| CTA | "Meet Evyatar" → /meet-evyatar/ | Same |

**Keep short.** 2-3 sentences max. Link to full story.

---

### Section 5: Shop by Category
**Purpose:** Fallback for browsers who want to explore

| Element | Desktop | Mobile |
|---------|---------|--------|
| Heading | "Browse the Collection" | Same |
| Layout | **4 columns** (4 category cards) | 2 columns |
| Categories | Reds, Whites, Rosé, More (links to full shop) | Same |
| Card style | Image + category name only | Same |

**Deliberately compact.** Third priority after Bundles and Packages. Just entry points for those who want to browse.

---

### Section 6: Decision Helper
**Purpose:** Catch visitors who are overwhelmed or scrolled past products

| Element | Desktop | Mobile |
|---------|---------|--------|
| Layout | Centered card, standout background | Same |
| Heading | "Not sure where to start?" | Same |
| Body | "Tell us the occasion. We'll handle the rest." | Same |
| Options | 2-3 buttons: "Shabbat Dinner" / "Sending a Gift" / "Just for Me" | Stack vertical |
| Alt CTA | "Or chat with us" + WhatsApp icon | Same |

**Links to:** Relevant package pages or WhatsApp

---

### Section 7: Social Proof
**Purpose:** Reinforce trust with real voices

| Element | Desktop | Mobile |
|---------|---------|--------|
| Layout | **3 columns** (3 testimonials) | 1 column, carousel or stack |
| Content | Short quotes about curation/trust | Same |
| Attribution | Name + location (no photos needed) | Same |

**Source:** Real 5-star Google reviews (currently on About Us page — duplicate here).

Do not use placeholder quotes. Pull actual customer testimonials.

---

### Section 8: Trust Strip (Pre-footer)
**Purpose:** Final reassurance before footer

| Element | Desktop | Mobile |
|---------|---------|--------|
| Layout | **3 columns** (3 trust points) | Stack or horizontal scroll |
| Content | Icons + short text | Same |

**Trust points:**
- ✓ Every wine personally tasted
- ✓ Delivery anywhere in Israel
- ✓ Questions? We're on WhatsApp

---

### Section 9: Footer
Standard footer with:
- Contact info
- Quick links (Shop, About, FAQ, Wine Talk)
- Social links
- Email signup (see Subscription Strategy below)

---

## Subscription Strategy

### Two Separate Optins (Email vs WhatsApp)

Each channel has different content and requires its own optin with persuasion reason.

#### Email (Mailchimp)

**Content:** Topics from Evyatar + special offers. Newsletter excerpts from blog posts.

**Persuasion copy:**
> "Wine Talk — from Evyatar"
> "Honest advice, new arrivals, and the occasional deal. No spam, just wine."

**Placement:**
- Footer (persistent)
- Exit-intent popup (offer help + subscribe)
- Post-purchase thank you page

#### WhatsApp

**Content:** Notes, video, and deals from Evyatar. More personal, more immediate.

**Persuasion copy:**
> "Get Evyatar in your pocket"
> "Quick notes, new videos, and deals before anyone else. Direct from Evyatar."

**Placement:**
- Checkout (new optin during purchase flow)
- Exit-intent popup (alongside email option)
- Floating button already exists for questions

### Exit-Intent Popup

**Trigger:** Mouse moves toward browser close/back

**Purpose:** Offer help + capture subscription

| Element | Content |
|---------|---------|
| Heading | "Leaving so soon?" or "Need a hand?" |
| Body | "Not sure what to get? Evyatar can help." |
| Option 1 | "Chat now" → WhatsApp |
| Option 2 | "Get recommendations by email" → Email signup |
| Option 3 | "Just browsing" → Close |

**Tone:** Helpful, not desperate. Offer assistance, not discount.

### Checkout WhatsApp Optin

**Placement:** After payment, before confirmation

**Copy:**
> "Want updates on your order — and first look at new arrivals?"
> "Get notes from Evyatar on WhatsApp."
> [Checkbox] "Yes, add me to Evyatar's WhatsApp list"

### Physical Touchpoints (Shipments)

| Item | Content | Call to Action |
|------|---------|----------------|
| **Packing slip** | Pairing notes, handling tips unique to order | QR code → relevant blog post or reorder page |
| **Newsletter insert** | Printed excerpt from latest Wine Talk post | QR code → full post + subscribe |

QR codes bridge physical → digital, but website remains primary subscription point.

---

## Section Summary (Desktop)

| # | Section | Columns | Content |
|---|---------|---------|---------|
| 1 | Hero | 2 | Evyatar + headline + help link |
| 2 | Bundles | 3-4 | Value bundles (flexible, you choose) |
| 3 | Decision Helper | 1 | "Not sure?" intro + WhatsApp/Email CTAs |
| 4 | Packages | 3-4 | Occasion packages (discounted, we choose, gift add-ons) |
| 5 | Trust Builder | 2 | How I choose + Evyatar link |
| 6 | Categories | 4 | Reds, Whites, Rosé, More |
| 7 | Testimonials | 3 | Real Google reviews |
| 8 | Trust Strip | 3 | 3 trust points |
| 9 | Footer | — | Contact, links, newsletter |

---

## Part 3: Supporting Content

### Already Complete
- [x] Featured images for all 14 blog posts (Canva AI, impressionist style)
- [x] Image recipe saved: `content/IMAGE_RECIPE.md`

### Pending
- [ ] Blog posts ready for publishing
- [ ] Homepage copy aligned with content strategy
- [ ] "Meet Evyatar" page content
- [ ] Gifts destination page content

---

## Implementation Notes

- Website is WooCommerce/WordPress
- Menu changes are admin configuration (Appearance > Menus)
- Homepage likely uses page builder or theme customizer
- No code changes required for menu restructure

---

## Reference Documents
- `website/HOMEPAGE_COPY.md` — Draft copy for all homepage sections
- `website/MARKET_CONTEXT.md` — Customer segments, competitor analysis, Israeli consumer behavior
- `website/WEBSITE_STRATEGY.md` — Homepage treatment, key phrases, slider content
- `business/CONTENT_STRATEGY.md` — Brand voice, content approach
- `content/` — Blog posts and guides
- `content/IMAGE_RECIPE.md` — Canva AI prompt formula for images
