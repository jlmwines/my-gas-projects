# JLM Wines — Theme Foundations

**Status:** Living reference — update when business model, audience, or voice rules shift
**Date:** 2026-04-27
**Purpose:** Strategic anchor for the entire theme replacement workstream. Every gap plan, design decision, and copy choice should be checkable against this document. Read this first when picking up theme work cold.

This is a pointer document, not a duplicate. Source docs in `business/`, `website/`, `content/` remain the canonical place where each topic lives. This file consolidates the anchors so theme work has one place to start.

---

## Business model

**Online wine retailer in Israel. Anti-snob positioning.** Wine without pretension — accessible, convenient, easy. The owner (Evyatar) tastes everything, rejects what doesn't meet the bar, and serves customers at every price level with the same care.

**Bilingual EN+HE — the only Israeli wine retailer fully bilingual.** All major competitors (Wine Route, Haturki, Kiddush, Wine Boutique) are Hebrew-only. This is the durable moat.

**Growth strategy: retention, not acquisition.** Goal is an order every 57 days from active customers (~6 orders/year vs. current ~1.5). Content (Wine Talk blog, YouTube, WhatsApp, Mailchimp) keeps JLM top-of-mind between orders so customers reorder *from us* rather than from a catalog competitor.

**The USP is Evyatar.** Not the wines, not the prices, not the website. Evyatar's palate, judgment, and care. 13+ years in the Katamon shop, growing his own grapes, WSET-trained. *"You aren't just buying wine; you're buying our palate. We put our reputation on every packing slip."*

Source: `website/MARKET_CONTEXT.md`, `business/CONTENT_STRATEGY.md`

---

## Customer segments

Four segments, in order of strategic priority:

| Segment | Who | What they need to see first | Where the theme answers |
|---|---|---|---|
| **Frustration-Avoiders** (primary) | Like wine, hate buying it. Don't want to learn jargon. Want trusted picks. | "Can I trust you?" | Hero (Evyatar + curation promise), Trust Builder, Testimonials |
| **Curious Explorers** (secondary) | Enjoy wine, want guidance not lessons | "Where do I start?" | Decision Helper, Bundles |
| **Gift Senders** (transactional) | Often overseas, can't navigate Hebrew sites | "Can I send a gift quickly?" | Visible gift path in nav (currently `We Recommend → Gifts`) |
| **Know-What-I-Want** (rare) | Specific wine in mind | Search + categories | Header search always-visible |

**Skewed older + higher AOV:** Anglos / olim segment is 35–55 with disposable income, comfortable online shopping, cultural appreciation of wine. The English content compounds this advantage — no competitor pursues it.

Source: `website/MARKET_CONTEXT.md`

---

## Voice

**Friendly. Personal. Never talks down.** Like a trusted friend who happens to know wine — not a sommelier, not a salesperson, not a teacher giving a lecture.

### First-person vs "we"

| Context | Voice |
|---|---|
| Homepage hero, Trust Builder, exit popup, packing slip note, all video, WhatsApp/email signup framing | **First-person (Evyatar)** — *"I taste the wines"* |
| Packages, Decision Helper, blog body, FAQ answers, product descriptions, theme strings | **"We"** — represents the team's curation |

Source: `website/HOMEPAGE_COPY.md` § Voice Strategy

### Owner's tone

- Exceedingly polite — never says anything negative about a brand, winery, wine, grape, or competitor
- Earnest, upbeat, service-dedicated
- Plain-spoken — no jargon, no showing off
- The "anti-snob" positioning shows through *how* we talk, not *what* we say about others

### Don'ts

- **No "ritual"** — religious connotations in Israel. Use "tasting session" or "tasting"
- **No "cheap wine"** — use "lower-priced" or "everyday value"
- **No wine vocabulary in navigation** — customers shop by occasion, not grape/region
- **No negativity** about any wine, brand, or competitor
- **No "Shop Now" as sole CTA** — too generic; use "Browse Wines," "Find Your Bottle," "See What We Recommend"

### Key phrases (use these)

- "The Second Sip Rule" — if you want another sip, it's a good wine
- "You're buying our palate"
- "We put our reputation on every packing slip"
- "An honest guide in a complicated world"
- "Wine without the guesswork"
- "Your collection, curated before you even browse"
- "Every bottle personally tasted"

Source: `website/WEBSITE_STRATEGY.md`, `business/CONTENT_STRATEGY.md`, `content/CLAUDE.md`

---

## Sensory framework (internal only)

Wine is described along three independent dimensions: **Intensity** (volume — background music vs. concert), **Complexity** (instruments — solo vs. orchestra), **Acidity** (tone — warm cello vs. bright violin).

**This is an internal vocabulary. Customers never need to learn it.** It exists so JLM describes wines consistently across product pages, blog, video, and packing slips. Use the metaphors to *clarify*, not to teach. Never say "Intensity 4" — say "bold and full."

Catalog filter UI uses this triad ordered **intensity → complexity → acidity**. Bundles and packages have no sensory attributes; dry reds and dry whites each have 2 of 3.

Source: `content/SENSORY_FRAMEWORK.md`

---

## Israeli context (constraints that shape design and copy)

- **Price-sensitive culture.** Don't compete on price; compete on *value clarity* — "you get what you pay for because we vetted it." The "freier" instinct means nobody wants to feel ripped off.
- **Word-of-mouth heavy.** 42% more likely than global average to discover brands via friends/family. Testimonials matter; WhatsApp matters.
- **Desktop is meaningful.** ~49% complete purchases on desktop vs. ~39% on mobile. Mobile-friendly is table stakes; don't sacrifice desktop.
- **Free shipping is the top conversion driver.** Threshold is **₪399**. Must be visible and prominent (free-shipping monitor in cart, mini-cart, sticky strip on cart-bearing pages).
- **Occasion-first thinking.** Customers shop by Shabbat / gifts / Pesach / mid-week, not by grape. Navigation reflects this (`We Recommend → Bundles, Packages, Gifts, Seasonal`).
- **Bilingual peerage.** Hebrew is treated as a peer, not an afterthought. Theme `is_rtl()` flips direction; bundle and package products are managed *independently* per language (not WPML translations) — design must not assume content parity.
- **Israeli accessibility law.** Compliance widget (Ally, by Elementor) is kept; replace if it doesn't function standalone after Elementor is deactivated.

Source: `website/MARKET_CONTEXT.md`, `plans/THEME_REPLACEMENT_PLAN.md`

---

## Visual identity (locked in design system)

The visual translation of the above is documented in `plans/design-system/RATIONALE.md`. Headlines:

- **Aesthetic direction:** editorial-confident-warm. Substantial typography, generous whitespace, the bottle is the hero.
- **Palette:** cream `#f7f3ec`, ink `#1a1612`, terracotta accent `#a83920`, sage success `#4a7a3e`, amber warning `#c9882c`. Eight tokens total.
- **Type:** David Libre (display, mid-century Hebrew serif) + Rubik (UI/body, friendly sans for HE+EN). No italic anywhere — emphasis via family-shift, color, or weight.
- **Image registers:** catalog (1000×1000 transparent PNG, locked) + blog/editorial (Canva impressionist oil painting 16:9, locked) + hero/lifestyle (open — see `EDITORIAL_TOKEN_MIGRATION.md` and pending imagery direction plan).
- **Footer is the only dark surface** in the system.

Why these and not the alternatives — see RATIONALE.md.

---

## Source documents

If you need to *write* in the JLM voice or *change* a strategic position, these are the canonical files:

| Topic | File |
|---|---|
| Brand voice, customer definition, content approach | `business/CONTENT_STRATEGY.md` |
| Customer segments, competitors, growth strategy, Israeli consumer behavior | `website/MARKET_CONTEXT.md` |
| Positioning, key phrases, "About Us" + "Note from Evyatar" + "How We Choose" + "JLM Promise" copy | `website/WEBSITE_STRATEGY.md` |
| Section-by-section homepage copy + first-person/we voice strategy | `website/HOMEPAGE_COPY.md` |
| Visual identity quick reference | `website/BRAND.md` |
| Sensory metaphor system (intensity/complexity/acidity) | `content/SENSORY_FRAMEWORK.md` |
| Quick voice reference for content writers | `content/CLAUDE.md` |
| Brand voice quick reference for marketing | `marketing/CLAUDE.md` |
| About Evyatar page structure | `website/MEET_EVYATAR_PLAN.md` |
| Exit popup + WhatsApp icon spec | `website/EXIT_POPUP_PLAN.md` |
| Featured image recipe (blog, Canva impressionist) | `content/IMAGE_RECIPE.md` |

If a discrepancy arises between this document and a source, the source wins — and this document gets updated.

---

## How to use this doc

- **At session start** for theme/design/copy work: read this, then jump straight to the relevant gap plan.
- **Before drafting copy** for any theme component (hero, footer, modal, error, empty state): check the voice rules above and the relevant source doc.
- **Before making a design decision**: check it against the customer segments and the visual identity headline. The system has a strong opinion (anti-snob, editorial-confident-warm, terracotta-not-burgundy) — preserve it.
- **When something feels off**: usually the answer is "are we talking down?" or "are we showing off?" — both are out of voice.

---

## Open gaps — theme prep

Theme replacement requires resolving these gaps before the build phase. Each is tracked here with current status. Move sequentially; gap N may inform gap N+1. Update this table as gaps progress (and again when new ones surface during build).

**Audit pass on 2026-04-27b** verified each gap against the live site (homepage hero is Evyatar-photo-with-text, gifts is at `We Recommend → Gifts`, KoWine ships an IcoMoon font with the icons we need). Several "open" items in the original list were premature or already resolved by current state. Revised dashboard:

| # | Gap | Status | Plan | Resolution / next |
|---|---|---|---|---|
| 1 | Editorial post tokens — old hex / radius / shadow → design system | **Deferred until after theme creation + testing** | `EDITORIAL_TOKEN_MIGRATION.md` | Cosmetic polish on existing content; doesn't block the theme build. 92 hex occurrences verified, sed passes ready, runs in minutes when the theme is otherwise stable. Run after cutover (or late in staging if convenient). |
| 2 | Hero / marketing imagery direction | **Resolved 2026-04-27b** | — | Hybrid policy: *if Evyatar is the subject → real photo, if atmosphere is the subject → Canva impressionist*. Verified current state already matches: homepage hero is real Evyatar photo + text, About has real photos, blog is Canva, catalog is PNG. No images change. Policy applies to future slots (rare campaigns, eventual exit popup). |
| 3 | Voice in `.po` theme strings | **Deferred to theme build phase** | — | No theme code, no `.po` file, no strings to debate yet. Decide string-by-string when each is being written. Plan-time work was premature. |
| 4 | Gift Sender path visibility | **Resolved 2026-04-27b** | — | Gift senders are typically one-time customers who land directly on the gifts page from search/ads/shared links — they don't traverse the homepage. Current `We Recommend → Gifts` placement is fine. Implication for theme: gifts page is a **landing page, not a deep-funnel page** — must stand alone (trust signals on-page, free-shipping visible, fewer clicks to checkout). Recorded as a constraint for the gifts page template. |
| 5 | Bundle / package theme rendering | **Resolved 2026-04-27c** | — | Bundle/package/accessory grids are stock WooCommerce category grids — no special handling. Contextual filtering is stock WC layered nav behavior (filters only render for attributes present in the result set; bundles/packages naturally have none). EN/HE parity is handled by language-aware queries (each language returns its own products). Bundle PDP uses standard `single-product.php`; CSS tuning is routine build-phase styling. Folds into general WC theme compatibility. |
| 6 | Design system open items | **Iconography closed; Complianz deferred; rest deferred to build** | — | **Icons:** KoWine's IcoMoon font already provides hamburger, filter, search magnifier, account/profile, shop/cart, plus social glyphs — verified in use on live mobile site. Theme-build step: extract glyphs as inline SVG paths, drop into theme sprite. **Complianz scroll-jump:** wait and see if a plugin update resolves before investing time in fix or replacement. **Loading/empty states, cart layout, forms beyond newsletter:** spec during theme build, not before. |
| 7 | Performance acceptance criteria | **Resolved 2026-04-27b** | `THEME_REPLACEMENT_PLAN.md` § "Performance acceptance protocol" | Protocol locked: PSI scorecard + Lighthouse CLI median-of-3 iteration; mobile primary (Slow 4G, Moto G4, warm server, cold browser); 8 measurements/pass (4 page types × EN+HE); thresholds Performance ≥ 90, LCP < 2.5s, INP < 200ms, CLS < 0.1; lab-green = ship-ready, 30-day field watch confirms. Periodic review at staging build start, staging activation, cutover decision, 30 days post-cutover. |

**Pre-build action items remaining:** none. All blockers cleared.

**Build-phase action items:** translation harvest from WPML (per `THEME_REPLACEMENT_PLAN.md` § "WPML integration"), theme feature rebuilds (floating cart, free-shipping monitor, age gate, WhatsApp button), speed work against the locked acceptance protocol, Gap #3 (`.po` voice — string-by-string as written), Gap #6 sub-items (icons extraction from KoWine IcoMoon, loading/empty/cart/forms specs).

**Post-cutover:** Gap #1 (editorial token migration), Complianz scroll-jump watch.

The theme replacement plan can now move to the build phase per `THEME_REPLACEMENT_PLAN.md` § "Build approach (staging)".

---

## Cross-references

This document is referenced from:
- `plans/THEME_REPLACEMENT_PLAN.md` (architectural plan)
- `plans/design-system/RATIONALE.md` (design system rationale)
- `plans/EDITORIAL_TOKEN_MIGRATION.md` (gap #1)
- Future gap plans (gaps #2–#7 as they're written)
