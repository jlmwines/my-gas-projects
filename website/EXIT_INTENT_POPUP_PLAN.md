# New-Visitor Offer Popup — Plan

**What:** A dismissible modal offering three things — a ₪50 first-order discount (primary, copies the coupon code to clipboard), WhatsApp contact, and email signup (both secondary) — triggered by exit-intent on desktop and a delayed on-load timer on mobile. **Live and confirmed working 2026-08-20** (EN+HE, desktop+mobile).

## Why

`website/EXIT_POPUP_PLAN.md` (WhatsApp-only, desktop-only version) was killed 2026-06-11 — full spec recovered from git history (`dbf5238^`) — reasoning at the time: exit-intent is desktop-only, traffic is mobile-heavy, and the WhatsApp-contact goal was already covered by the live floating icon (still true, `inc/whatsapp-float.php`).

Revisited and redesigned 2026-08-19–20: new email subscriptions are rare despite two existing opt-in touchpoints (footer band, checkout checkbox synced to Mailchimp — `inc/mailchimp-language-group.php`). The design grew beyond the killed plan in two ways during discussion:
1. **A third, stronger element:** the existing live `50NEW` coupon (₪50 off + free delivery, first order ₪399+, code-level first-order-restricted — also used in the flyer and Meta Ads bucket 18) became the popup's primary CTA, not just a bundles mention. Real exit-intent research (single-CTA, specific-discount best practices) confirmed this should lead, with WhatsApp/email as secondary, not three co-equal asks.
2. **A second trigger, for mobile:** most ad traffic lands on mobile, where exit-intent can't fire. Rather than stay desktop-only, added a delayed on-load trigger (~4s) for mobile. Considered and dropped ad-source gating (`gclid`/`fbclid`/UTM) for this trigger — broadens reach, and the Google mobile-interstitial SEO risk that would motivate gating mainly targets *instant* popups blocking content on arrival from organic search, not a delayed, dismissible one.

**On potential harm:** fires only for non-purchasing visitors already about to leave (desktop) or a few seconds into a fresh visit (mobile) — it cannot cost a conversion that would otherwise have happened. Real costs are build effort and reshow annoyance for repeat browsers, not risk to existing customers/subscribers.

Google Search Ads deliberately does **not** mention the discount in ad copy (confirmed, not a gap) — the ads are meant to attract buying-intent searchers, not discount-seekers; the popup is where the discount is reserved for visitors who fail to convert on their own.

## Copy (locked 2026-08-20)

Three elements, one primary CTA + two secondary lines — not three competing asks:

| Element | Role | EN | HE |
|---|---|---|---|
| Offer | Primary CTA → copies `50NEW` to clipboard (button reads "Copied!" for 2s, per-language label) | Headline: **"First order? Save ₪50"**. Detail: "Get free delivery and ₪50 off your first order of ₪399 or more. Code: 50NEW". Button: "Copy Code" | Headline: **"הזמנה ראשונה? חסכו ₪50"**. Detail: "קבלו משלוח חינם ו-50 ₪ הנחה על הזמנה ראשונה של 399 ₪ ומעלה. קוד: 50NEW". Button: "העתיקו קוד" |
| WhatsApp | Secondary → WhatsApp contact | "Need help? Ask me!" [WhatsApp icon] | "צריכים עזרה? שאלו אותי!" |
| Email | Secondary → signup form | "Learn About Wine" [email field + subscribe button] | "לומדים על יין" |

"Learn About Wine" / "לומדים על יין" deliberately matches the existing footer newsletter heading (`footer.php`) for brand consistency.

HE headline/detail/WhatsApp/email lines supplied directly by the user (manager's own translation) — consistent with `content/CLAUDE.md` Hebrew Source of Truth. Small UI-chrome strings (copy-button label, close label) are session-authored theme chrome, same convention as `age-gate.php`'s own Yes/No/Close labels — not part of the manager-translated content pipeline.

**Copy-not-navigate (changed 2026-08-20):** the offer button originally linked to the bundles category page; changed to copy the coupon code to the clipboard instead, per live-testing feedback — clicking through away from the popup wasn't the goal, getting the code in hand was.

Evyatar photo alongside the WhatsApp line only (not the offer or email lines) — per `plans/THEME_FOUNDATIONS.md`'s image policy ("if Evyatar is the subject → real photo") and the killed plan's own spec ("personal, not corporate, humanizes the brand"). Photo swapped 2026-08-20 from the footer's vineyard shot (didn't read well at the popup's small avatar size) to a WhatsApp-appropriate portrait (`evyatar-cohen-04.jpg`), same image both languages. Offer headline stays graphic-clean/text-led per research (a specific number converts better than decoration).

## Triggers

| Device | Trigger |
|---|---|
| Desktop | Exit intent (`mouseleave` on `document.documentElement`, `e.clientY <= 0`, cursor toward browser chrome) |
| Mobile | Delayed on-load (~4s after page load), no ad-source gating |

One popup, two trigger conditions — not two separate popups.

**Bug found and fixed 2026-08-20:** the desktop listener was originally bound to `document` rather than `document.documentElement` — `mouseleave` is an Element-boundary event and doesn't reliably fire on `document` itself, so the trigger silently never fired (found via live private-session testing: age gate resolved fine, exit motion performed, no popup). One-line fix, redeployed, confirmed working.

## Targeting

| Rule | Value |
|---|---|
| Audience | Non-purchasers — exclude logged-in customers (mirrors `age-gate.php`'s `body.logged-in` skip) |
| Reshow suppression | 7 days, cookie-based |
| Exclude pages | Cart, checkout, thank-you (checkout already carries its own WhatsApp/email asks) |

Known limitation (carried from the killed plan): guest-checkout customers aren't logged in, so a returning guest who already ordered could still see the popup — no server-side purchase check, cookie/session-based only.

## Technical approach

Reuse existing theme patterns rather than building from scratch:
- `inc/exit-intent-popup.php` — `wp_footer`-hooked render function, bilingual via `is_rtl()` (one render function, not two popups), same shape as `age-gate.php` but dismissible (✕ + click-outside), not a forced choice.
- Persistence: cookie (not `localStorage`, matching the age-gate precedent), `jlmwines_exit_popup_dismissed`, 7-day expiry, `path=/` and language-agnostic — dismissing on one language suppresses both (mirrors `jlmwines_age_verified`).
- Trigger + cookie + copy-to-clipboard logic in `assets/js/main.js` (never inline in hook-rendered markup — the site's JS optimizer strips inline `<script>`, per `BUNDLE_MESSAGE_PLAN.md`'s recorded gotcha). Two trigger listeners: `mouseleave` on `document.documentElement` for desktop, `setTimeout` ~4s for mobile (branch on the same width breakpoint the theme already uses for `bottom-nav`). Copy button uses `navigator.clipboard.writeText` with a `document.execCommand('copy')` fallback for older browsers.
- CSS in `assets/css/main.css` — real mobile responsiveness (the popup renders on both device classes, not desktop-only as originally scoped).
- Z-index: `.offer-popup` at 9000 — above every other floating element (WhatsApp float 95, bottom-nav 90, cart drawer/consent banner well under 200) but below `.age-gate` (10000), so the compliance gate always wins if both were ever visible at once.
- Doesn't compete with `age-gate.php` — waits (polls `body.age-gate-locked`, ~30s cap) until the age gate is resolved before arming either trigger.
- WhatsApp link: reuses `jlmwines_whatsapp_number` theme mod + `wa.me` format from `whatsapp-float.php`, pre-filled greeting (`היי אביתר,` / `Hi Evyatar,`).
- Email form: reuses `footer.php`'s Mailchimp direct-POST markup/action URL, language-interest hidden field, honeypot. The page's Mailchimp JS submit handler (`main.js`) was generalized from `querySelector` (first form only) to `querySelectorAll` so both the footer's and the popup's forms work independently.

## Deploy incident along the way

The first deploy attempt (old `FtpWebRequest`-based `deploy-theme.ps1`) truncated 6 live theme files to 0 bytes mid-transfer, breaking the live site. Restored from a SiteGround backup, confirmed clean, then `deploy-theme.ps1` was hardened (upload → byte-verify → atomic rename, never writes the live filename directly) and its transport switched from .NET's `FtpWebRequest` to `curl` (root cause never conclusively identified — script/credentials unchanged for weeks, `FtpWebRequest` failed consistently against SiteGround while `curl` succeeded immediately). Full incident: `.claude/session-log.md` 2026-08-20, `.claude/bugs.md` (web, resolved).

## Status

**Live and confirmed working 2026-08-20** — smoke-tested by the user on desktop and mobile, EN and HE, after two post-deploy fixes: the `document`/`document.documentElement` exit-intent trigger bug, and the copy-code button + new WhatsApp photo. Theme v1.2.32.

## Verification

- [x] Visual check EN + HE, desktop and mobile — correct trigger per device, correct copy/layout. Confirmed by user 2026-08-20.
- [x] Exit-intent trigger fires on desktop; delayed trigger fires on mobile. Confirmed after the `document.documentElement` fix.
- [ ] Cookie suppression: dismiss, reload, confirm no reshow; confirm shared across EN/HE — not explicitly re-tested since the fixes, worth a check.
- [ ] Exclusions: logged-in test account doesn't see it; cart/checkout/thank-you don't trigger it — not explicitly re-tested.
- [ ] WhatsApp link opens with pre-filled greeting — worth a check with the new photo/link in place.
- [ ] Email form actually posts to Mailchimp (test signup lands in the audience) — not yet tested against the popup's own form specifically (footer's form already confirmed working previously).
- [x] Copy-code button copies `50NEW` to clipboard and shows "Copied!"/"הועתק!" — confirmed working.
