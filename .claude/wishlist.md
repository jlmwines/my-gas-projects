# Wishlist

Feature ideas and improvements. Use `/wish [project] item` to add.
Projects: jlmops, web, marketing, content

---

## jlmops

- [ ] 2025-12-14: improve and standardize confirmation messages
- [ ] 2025-12-14: show task creation date in product detail update review and export
- [ ] 2025-12-22: refactor config JSON files - remove empty padding, consolidate repetitive entries
- [ ] 2025-12-29: Plan transition from current region system (regions overhaul — see CONTENT_LIBRARY_PLAN §14)
- [ ] 2025-12-29: Texts lookup is random and probably inefficient - need to examine
- [ ] 2026-01-01: add pairing to packing slip
- [ ] WooCommerce API - could replace CSV sync, enable real-time order/coupon data
- [ ] Mailchimp API - better than manual exports for campaigns/subscribers
- [ ] URL shortener integration for campaign tracking
- [ ] 2026-05-08: Newsletter UTM/QR helper — admin form takes target URL + campaign code (e.g., `may26-art`), returns canonical UTM-tagged URL, registers a short redirect (`jlmwines.com/n/<code>`), generates a print-ready QR (SVG, error-correction Q, optimized for ~3cm print) downloadable for layout. Pairs with URL shortener item above.
- [ ] Hourly order sync via WooCommerce API (infrastructure exists: runHourlyTrigger())
- [ ] Coupon Service - dedicated service for coupon management
- [ ] Smarter reprint logic: Track first immutable print separately
- [ ] Remove one-time backfill code when CRM is stable
- [ ] Remove hardcoded workaround in WebAppProducts.js:438
- [ ] 2026-06-08: **Bundles — surface missed profit opportunities.** Flag high-profit wines (`wpm_ProfitRate`) that aren't used in ANY bundle (cross-bundle `usage` = 0, the Stage 6 index) so the operator can pull them into a bundle. The signals already exist (profit from Stage 2, usage from Stage 6); this is a read-only "high-margin wines not in any bundle" report/card on AdminBundles. Capstone to the Stage 7 generator.
- [ ] WhatsApp integration
- [ ] Mailchimp export from CRM
- [ ] Recommendation engine
- [ ] AI/Claude integration
- [ ] 2026-01-23: add name of comax order export file to notifications same as done with web inventory update csv
- [ ] 2026-01-29: Back button support - hash routing should support browser back/forward navigation
- [ ] 2026-05-15: **Product-centered ops view (single product overview).** One-screen detail view per product showing Comax-side state, Web/WooCommerce-side state, last-update timestamps, product image, and a link to the live product page. Today the per-product picture is scattered across SysProducts row + WC admin + live site. Use case: ops triage when something looks off on a specific product. No plan doc yet; sized as an admin view alongside existing AdminProductsView.
- [ ] 2026-05-15: **Replace Woo App / Jetpack with jlmops order view + status update.** Jetpack currently runs on the website solely to enable the WooCommerce mobile app, which the manager uses to view orders and change status. If jlmops gets a mobile-friendly order view with status-update capability, Jetpack can be removed (reduces plugin surface + performance overhead). Not blocking; the Woo App works today.
- [ ] 2026-05-15: **Outreach to unpaid orders / abandoned carts / consummated-but-not-paid.** Identify customers who intended to buy but didn't complete payment (pending orders, on-hold, abandoned carts if trackable). High-intent contacts worth reaching. Check what data we already have (WebOrdM has pending/on-hold; abandoned cart data may require a Woo API extension or plugin). Once trackable, ship as a new topic on `task.contact.outreach` so the manager surfaces and contacts them through the same Action Panel flow. (Broader scope than the @110-@111 pending-payment auto-followup which only covers `pending` Woo status.)
- [ ] 2026-06-10: **Back button in the view title bar.** An in-UI back control in each view's title bar to return to the prior view / dashboard. Distinct from but pairs with the 2026-01-29 browser back/forward hash-routing item above.
- [ ] 2026-05-15: **Decouple Comax export + verify from sync (structural rethink).** Current sync round-trips through Comax: exports orders to reduce Comax inventory, waits for user to import the resulting Comax product file as baseline qty, then adjusts for on-hold orders not yet sent. The Comax export holds up the sync; Comax API access is too costly to use as a live check. Idea: accept the most recent Comax product file as baseline (whatever was last imported), adjust qty for ALL orders not yet exported to Comax (any status), and pull the export-to-Comax + verify steps out of the sync state machine. Net effect: sync no longer blocks on the Comax round-trip; Comax sync runs on its own cadence. Park as a structural rethink to revisit when sync architecture next opens up.

## web

- [ ] 2026-06-08: **Bundle explainer message on bundle pages (soon).** Closable/dismissible info area on jlmwines.com bundle (woosb) product pages explaining how bundles work to the customer (flexible vs fixed slots, how to swap/add, pricing). Per-language EN + HE copy — text being drafted (user). Dismissible (remember-dismissed). Theme-side, not jlmops.
- [ ] 2025-12-29: Risk that redundant text is affecting SEO - research enriched text in products
- [ ] 2026-01-22: Examine website cache and other speed-related settings to optimize
- [ ] 2026-05-15: **Nav menu structure + mobile review** (consolidates 2026-04-29 + 2026-05-07 notes). Audit desktop layout, mobile drawer hierarchy, deep-link targets (e.g., `#footer-contact`). What customers actually need vs. what the menu currently has. Check mobile drawer appearance against design system. Single audit pass.

## marketing

- [ ] 2026-07-02: **Loyalty rewards program** — not a discount (deliberately moving away from automated coupons); reward is an extra or upgraded bottle. Plan → `marketing/REWARDS_PLAN.md`.
- [ ] Year in Wine product dynamic content
- [ ] Referral coupons
- [ ] Referral short URL
- [ ] Year in Wine 2025
- [ ] Blog Posts
- [ ] Video content
- [ ] FAQ/Glossary
- [ ] YouTube channel
- [ ] Business WhatsApp
- [ ] Zadarma 055 for WhatsApp
- [ ] 2026-05-07: Bilingual flyer drop in 8 Jerusalem neighborhoods (German Colony, Emek Refaim, Rechavia, Talbiyeh, Beit HaKerem, Arnona, Nayot, Ein Kerem) — vendor candidates yoterplus.co.il + dilen.co.il; ~₪2000 test budget; first surfaced 2026-02-09
- [ ] 2026-05-07: Wine tasting / sampling events at restaurants and venues — previously planned by partner, canceled by war; QR-code + discount cards already produced for new-customer acquisition; revisit and execute
- [ ] 2026-05-15: **Bundle + package imagery refresh + bundle duplicate meta.** Two distinct Canva-generated visual systems so a glance distinguishes them. **Bundles** (flexible suggestions, no built-in discount): atmospheric/thematic imagery — palette + texture + mood, no specific bottle compositions (membership changes too often, fake labels betray AI). Loose/sketchy "suggestion" feel via fanned/spread layout or ghost-shape cues; composition rides the tier axis (value = abundant, premium = sparse/refined). **Packages** (themed problem-solvers, fixed composition + discount): situational Israeli scenes rendered in naïve Israeli folk-art idiom (Reuven Rubin / Nahum Gutman lineage) — flat color, warm earth tones (terracotta, ochre, cypress green, Jerusalem stone, deep wine red), unfussy shapes. Existing package themes stay (Cheese Please, Shabbat Shalom, Al Ha-Aish, etc.) — just re-illustrated with Israeli palette and composition cues (pita/olives/labneh, low charcoal grill, cypress + bougainvillea backdrops). Drop the slot-machine "winning combination" illustration entirely — gambling+alcohol is tonally off. Also: bundles have duplicate meta (titles/descriptions across category) — fix as part of the same pass.

## content

- [ ] Holiday wine posts (Pesach, Rosh Hashana, etc.)
- [ ] FAQ page implementation (Elementor)
