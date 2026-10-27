# Wishlist

Feature ideas and improvements. Use `/wish [project] item` to add.
Projects: jlmops, web, marketing, content

---

## jlmops

- [ ] 2025-12-14: improve and standardize confirmation messages
- [ ] 2025-12-22: refactor config JSON files - remove empty padding, consolidate repetitive entries
- [ ] 2025-12-29: Texts lookup is random and probably inefficient - need to examine
- [ ] Smarter reprint logic: Track first immutable print separately
- [ ] Remove one-time backfill code when CRM is stable
- [ ] 2026-06-08: **Bundles — surface missed profit opportunities.** Flag high-profit wines (`wpm_ProfitRate`) that aren't used in ANY bundle (cross-bundle `usage` = 0, the Stage 6 index) so the operator can pull them into a bundle. The signals already exist (profit from Stage 2, usage from Stage 6); this is a read-only "high-margin wines not in any bundle" report/card on AdminBundles. Capstone to the Stage 7 generator.
- [ ] WhatsApp Business account is set up and in use (site links point to it); full segmentation/broadcast/automation build (labels, opt-in sync, broadcast lists) has no near-term plan. Scoped spec if revisited: `marketing/plans/_archive/WHATSAPP_TRANSITION.md`, `jlmops/plans/WHATSAPP_CRM_INTEGRATION.md`.
- [ ] Mailchimp export from CRM
- [ ] Recommendation engine
- [ ] AI/Claude integration
- [ ] 2026-10-26: Keep WebDetM sorted by `wdm_NameEn` for human editing. Designed as Stage 4 of `jlmops/plans/WEBDETM_KEY_INTEGRITY_PLAN.md`.
- [ ] 2026-05-15: Single-product ops view: Comax + Woo state, last updates, image and live-page link on one screen, for triage. No plan doc yet.
- [ ] 2026-05-15: **Outreach to unpaid orders / abandoned carts / consummated-but-not-paid.** Identify customers who intended to buy but didn't complete payment (pending orders, on-hold, abandoned carts if trackable). High-intent contacts worth reaching. Check what data we already have (WebOrdM has pending/on-hold; abandoned cart data may require a Woo API extension or plugin). Once trackable, ship as a new topic on `task.contact.outreach` so the manager surfaces and contacts them through the same Action Panel flow. (Broader scope than the @110-@111 pending-payment auto-followup which only covers `pending` Woo status.)

## web

- [ ] 2025-12-29: Risk that redundant text is affecting SEO - research enriched text in products
- [ ] 2026-10-23 (low): Remove or reverse `_invoice_note` product meta, left over from a failed attempt to get packing slip data into standard Woo output (WPML Copy field).
- [ ] 2026-01-22: Examine website cache and other speed-related settings to optimize
- [ ] 2026-05-15: **Nav menu structure + mobile review** (consolidates 2026-04-29 + 2026-05-07 notes). Audit desktop layout, mobile drawer hierarchy, deep-link targets (e.g., `#footer-contact`). What customers actually need vs. what the menu currently has. Check mobile drawer appearance against design system. Single audit pass.

## marketing

- [ ] Year in Wine 2026, low priority (2025 edition had poor response)
- [ ] Referral coupons
- [ ] Referral short URL
- [ ] Blog Posts
- [ ] Video content
- [ ] YouTube channel
- [ ] 2026-05-15: Bundle duplicate meta (titles/descriptions repeated across the category). Package imagery done (rule in `website/BRAND.md`).

## content

_(none — holiday suggestions live in the packing slip insert plan; FAQ launch is Next Action 11)_
