# Targeted Coupons — Plan

jlmops defines and owns targeted coupons: a shared code limited to a list of contact emails, created and maintained in WooCommerce through the REST API. Customers learn about an offer from the email (link auto-applies the code), a gentle "see your offers" line in the popup, and a checkout lookup on the billing email. Status: **planned, not started** (decided 2026-10-22).

## Decisions

- **Uses, in priority order:** rewards/retention, win-back, product/bundle promotions. Retention rewards also serve `marketing/plans/REWARDS_PLAN.md`.
- **One shared code per offer**, restricted to the offer's emails, one use per person. No per-person unique codes (only useful for share-with-a-friend, which hasn't worked).
- **jlmops owns its targeted coupons** and writes them directly through the Woo API — no pasting into WooCommerce. WooCommerce stays the checkout authority and the home of hand-made coupons (50NEW welcome, SHIPFREE etc.), which jlmops only reads.
- **Mailchimp is fed by CSV upload** (user does it; infrequent). No Mailchimp writes from jlmops.
- **Lookups show only coupons that list the person's email.** Never "any coupon this email could redeem" — that would offer 50NEW to every new customer who is already converting. 50NEW stays where it is (new-visitor popup, ads, flyer).
- **No silent returning-guest cookie.** Rejected as intrusive and unreliable; the customer opts in to look.

## Ownership and data

jlmops marks the coupons it creates (Woo meta `_jlmops_owned = 1`) and only ever writes those. Per offer it stores, appended to `SysCoupons` (append-only columns, preserved across the daily pull the way bundles preserve their owned fields): owned flag, audience description (the Contacts filter used), and optional custom offer lines EN/HE. The EN/HE lines are also written to Woo coupon meta (`_jlmops_offer_en`, `_jlmops_offer_he`) so the theme can read them.

The email list lives on the Woo coupon (`email_restrictions`). Per contact, jlmops records `coupon.offered` when added to an offer and `coupon.used` on redemption — both activity types already exist in `DATA_MODEL.md`.

The daily coupon pull gains a real job: **reconcile** jlmops-owned coupons (emails, terms, expiry) against what jlmops defined and flag differences. Hand-made coupons are pulled read-only as now.

`SysCouponUsage` is retired: nothing writes it (`CouponService.recordUsage` has no caller), so the KPI first-order figure moves to `coupon.used` activity.

## jlmops UI

Extends the existing **Admin Contacts → Export Audience** tool rather than a new screen:

1. **Coupon section in Export Audience** — code, ₪ or %, minimum spend, optional product/category limits, expiry, optional EN/HE custom line. On export: create or update the Woo coupon with exactly the exported emails, write `coupon.offered` per contact, and add the code + auto-apply link columns to the export sheet for the Mailchimp upload.
2. **Active offers list** — code, offered count, redeemed count, expiry, reconcile status; "End now" expires it in Woo.
3. **Contact drawer: "Current offers"** — answers "do I have a code?" without opening WooCommerce.

## Website (theme)

All bilingual via `is_rtl()` in the theme, per the theme's translation rule — no WPML String Translation.

1. **Email link auto-applies the coupon** (e.g. `?coupon=CODE`). Repeat clicks are harmless; the coupon stays valid until used or expired. Check first whether Extended Coupon Features already offers apply-by-URL.
2. **Checkout lookup** — when the billing email is entered, find valid coupons listing that email (not expired, not used by that email) and offer or apply them. Rate-limited. Leak is low-risk: a code only redeems with that billing email.
3. **Popup secondary line** — "Returning? See your offers": login link, or enter email → same lookup. Kept secondary so the ₪50 new-visitor offer stays the single primary CTA (`website/EXIT_INTENT_POPUP_PLAN.md`).
4. **Offer line** — generated from the coupon's terms with one fixed pattern per language (amount/percent, minimum, product/category, free shipping, expiry), plus the coupon's optional EN/HE custom line. New coupons need no theme change; only a new offer shape (e.g. buy 2 get 1) or pattern rewording does.
5. **My Account → My coupons** (optional, last) — same list for logged-in customers.

**Hebrew wording:** before the HE patterns are written, collect existing Hebrew for the same terms — WPML String Translation (WooCommerce + `woocommerce-jos-autocoupon` domains; user searches or exports, no API) and the locked popup offer copy. Assemble an EN/HE side-by-side sheet; manager fills gaps and approves. The session drafts English only.

Extended Coupon Features' per-coupon "message on apply" (WPML-translated, e.g. SHIPFREE's "Please select Free Delivery option.") is left **empty** on jlmops coupons — its Hebrew needs a manual WPML step per coupon. Hand-made coupons keep using it.

## Build order

1. **`coupon.used` daily.** Add the coupon step to `ActivityBackfillService.syncRecentOrderActivity` (today only the manual full backfill writes it). Move the KPI first-order figure to activity; retire `SysCouponUsage`. Valuable on its own.
2. **Verifications** (no user-facing change): Woo API key can create/update coupons (inventory push suggests read/write); storage key of the plugin's apply message; WooCommerce Multilingual accepts the HE translation of a product-limited coupon's product.
3. **jlmops targeted coupons:** `SysCoupons` columns, Woo create/update/expire, Export Audience coupon section, `coupon.offered`, reconcile in the daily pull, active-offers list, drawer "Current offers".
4. **Theme:** email auto-apply → checkout lookup → popup line → offer-line patterns (after the HE sheet is approved). Each theme deploy is a live-site push needing per-task OK.
5. **Optional:** My Account coupons page.
6. **Cleanup:** remove the past one-off export buttons in Contacts (Year in Wine 2025, Lapsed 2024).

## Out of scope

Per-person unique codes and referral mechanics; managing 50NEW or other hand-made coupons from jlmops; Mailchimp API writes; WPML string automation.
