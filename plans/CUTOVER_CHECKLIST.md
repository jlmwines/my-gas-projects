# JLM Wines — Theme Cutover Checklist

**Status:** ✅ **CUTOVER COMPLETE 2026-05-05.** `jlmwines-theme` v1.2.x live. Approach used: **SiteGround staging→live promote** (after a failed activate-in-place attempt revealed page content existed only on staging — About EN/HE pages had been authored on staging via REST API push and never replicated). Document retained as the playbook for any future cutover.

**Key lesson learned:** activate-in-place doesn't catch staging-only content drift. For theme + DB-content cutovers, **default to staging→live promote**: refresh staging from live, install everything on staging, promote. Reversible at every step until the final promote. Update this checklist's stage structure if used as a template for future cutovers.

**Pending items from the original checklist** (these were not gated on cutover and remain open in `STATUS.md` post-cutover follow-ups #4 and #6):
- Stage 2.6 cutover-day test order (real EN+HE checkout opt-in test) — may have happened informally; verify or run retroactively.
- Stage 3 post-cutover stability check (24–48hr error log + order monitoring) — initial window has passed; confirm or run retroactive check.
- SG Optimizer re-enablement test (currently fully OFF on live — see post-cutover follow-up #6).

---

**Original goal:** Switch the live site's active theme from `kowine-child` to `jlmwines-theme` with zero customer-facing regression.

**Original target window:** 2026-05-04 (per session 2026-05-03). Actual cutover: 2026-05-05.

**Time estimate (original):** ~1.5 hours focused work for a clean run; ~3.5 hours if remediation needed. (Stage 0.1 `.po` import dropped 2026-05-04 — saves ~10 min of pre-flight + the import-failure remediation path.)

**Authority:** Only the user (Baruch) executes cutover steps. Claude verifies, never pushes to live without explicit per-step confirmation.

---

## Stage 0 — Pre-flight (DO BEFORE CUTOVER DAY)

These must be GREEN before scheduling the cutover.

### 0.1 — ~~Translation pipeline complete~~ → **DROPPED 2026-05-04**

The `.po` import pipeline was retired on 2026-05-04. Theme v1.0.88+ bakes Hebrew inline via `is_rtl()` per the rule in `plans/TRANSLATION_PLAN.md` — text is stored in the correct language in advance, not translated at runtime. No `.po` import, no WPML String Translation work, no `'jlmwines'` textdomain in use anywhere in the theme (verified by grep).

Carryover items if you want to clean up:
- [ ] *Optional:* delete the orphaned `exchange/strings/jlmwines-he-draft.po` draft, or keep as a Hebrew-copy reference.
- [ ] *Optional:* clean up any `jlmwines`-domain orphan strings still showing in live's WPML String Translation UI from earlier scans — harmless if left, will simply never resolve.

### 0.2 — Mailchimp flow tests on staging
- [x] **EN footer signup** → VERIFIED 2026-05-04 (theme v1.0.91): subscriber lands in Mailchimp with English Language interest correctly assigned.
- [x] **HE footer signup** → VERIFIED 2026-05-04 (theme v1.0.91): subscriber lands with Hebrew Language interest correctly assigned.
- [ ] **Inline confirmation message** (theme v1.0.93) — submit footer signup on EN and HE (use plus-addressed emails like `accounts+jlmtest-en-001@jlmwines.com` for repeat tests). Verify subscriber stays on jlmwines.com, sees inline message in matching language ("Thanks! Check your email to confirm…" / "תודה! בדקו את המייל לאישור הרשמה."), no redirect to Mailchimp's hosted page.
- [ ] ~~EN/HE checkout opt-in tests~~ → **Folded into the cutover-day test order** (Stage 2.6 — place a real test order with the opt-in box ticked, verify subscriber lands in Mailchimp with correct Language interest). Idempotency check (processing→completed) bundled into the same pass.
- [ ] **`mailchimp-woocommerce` plugin deactivated on staging.** Replacement code shipped in v1.0.92 (`inc/mailchimp-language-group.php`). At cutover, plugin must also be deactivated on live (see Stage 2.4).

### 0.3 — Plugin state target for live (simplified 2026-05-04)
The original "baseline JSON parity" framing assumed cutover was theme-only. It's not anymore — cutover deactivates `mailchimp-woocommerce` and removes the wishlist plugin's nav presence. Simpler approach: write down what should be active post-cutover, eyeball the live plugin list, fix any drift.

**Plugins that should be ACTIVE on live post-cutover:**
- WooCommerce
- WPML (sitepress-multilingual-cms) + WooCommerce Multilingual
- WPClever Product Bundles (woo-product-bundle-premium)
- Pojo Accessibility (ea11y)
- Complianz GDPR
- SG Cachepress (SiteGround Optimizer)
- RankMath SEO (stays active on live)
- Woocommerce Google Analytics Integration

**Plugins to DEACTIVATE on live at cutover:**
- `mailchimp-woocommerce` (replaced by `inc/mailchimp-language-group.php` in theme — see Stage 2.4)
- `woo-smart-wishlist` (wishlist functionality removed in new theme — Stage 2.3 also strips menu links)
- Elementor + Elementor Pro (only kept active if any Elementor pages still in use; new theme replaces all 16 Elementor-built pages — confirm no remaining dependencies before deactivating)
- WPBingo (kowine theme dependency — gone with kowine)

**Action:**
- [ ] Eyeball live's wp-admin → Plugins page; list anything currently active that's NOT in the "should be active" list above. Resolve before cutover (deactivate, or add to expected list with reason).

### 0.4 — Sanity walk on staging (final smoke test before cutover day)
Walk every critical flow on staging in **incognito** (no cached state):

**Homepage (EN + HE):**
- [ ] Hero renders, CTA links to `#packages`
- [ ] Bundles, Packages, Why Trust Me, Browse Collection, Testimonials carousel, Wine Talk, Trust Banner all render
- [ ] Testimonials carousel: arrows work, swipes on mobile, RTL chevron flip on HE
- [ ] Footer: contact, social, payment image, legal links, language switcher, cookie-consent link

**Product detail page (EN + HE):**
- [ ] PDP image gallery, price, add to cart, description, customer details
- [ ] WhatsApp floating button visible bottom-right (LTR) / bottom-left (RTL)
- [ ] No "Additional information" tab, no SKU, no cat/tag meta block

**Catalog / shop / category pages:**
- [ ] Loop cards aligned (titles 2-line clamp, prices line up, buttons line up)
- [ ] Sale flash differentiated (Save ₪X for simple, Bundle Savings for woosb)
- [ ] WhatsApp button visible

**Cart + checkout:**
- [ ] Cart drawer opens/closes, items render, quantity controls work
- [ ] Mini-cart updates on add-to-cart
- [ ] Checkout fields per spec (no postcode, +972 phone prefill, gift message)
- [ ] Free-shipping monitor renders correctly (cart page + slim strip)
- [ ] Auto-select free shipping when threshold met

**Cross-language:**
- [ ] Language switcher in header + footer works
- [ ] Cookie persistence: switch EN → HE → EN, no re-prompt for age-gate

**Age verification:**
- [ ] Fresh incognito → modal appears in current language
- [ ] Yes → modal closes, cookie set, no re-prompt across pages
- [ ] No → redirects to google.com
- [ ] Logged-in user → no modal, cookie auto-set
- [ ] HE: Yes-button on right (RTL flip), Hebrew strings render

**Search:**
- [ ] Header search → product results
- [ ] Mobile bottom-nav search opens drawer
- [ ] Empty state: "No results found. Try a different search."

**Account + posts:**
- [ ] Articles page renders blog roll
- [ ] Single blog post: featured-image hero, title overlay, body
- [ ] My account login + dashboard (use a test account)

**Performance baseline** *(optional, dropped 2026-05-04 — pre-cutover Lighthouse run isn't load-bearing; we move forward regardless of the comparison. Existing rough numbers from 2026-04-15 in STATUS.md serve as informal baseline if needed)*

**If any of the above fails: do not proceed to cutover.** Fix on staging, redeploy, re-test.

---

## Stage 1 — Cutover-day pre-flight (immediately before pulling trigger)

### 1.1 — Live backup
- [ ] **SiteGround → Tools → Backups → Create Manual Backup** of live
- [ ] Confirm backup completes successfully and shows in backup list
- [ ] **Note the backup timestamp** — this is the rollback target

### 1.2 — Confirm theme files on live
- [ ] wp-admin (live) → Appearance → Themes → confirm `JLM Wines` theme is **installed but inactive**
- [ ] If outdated (older than current staging deploy): re-upload latest zip from `exchange/zip/jlmwines-theme-vX.Y.Z.zip` to refresh

### 1.3 — Confirm settings carried from earlier work
- [ ] **Site Icon** — Customize → Site Identity → confirms `jlm-wines-600-white-solid.jpg` (set 2026-05-03)
- [ ] **RankMath Local SEO Logo** — wp-admin → RankMath → Titles & Meta → Local SEO → confirms same image (set 2026-05-03)
- [ ] ~~**Translations** — confirm WPML String Translation has `jlmwines` domain entries with HE translations~~ → **N/A 2026-05-04**: theme bakes HE inline; no WPML String Translation step needed. Verify by spot-checking a HE staging page (homepage, footer, PDP) and confirming all visible strings are Hebrew.

### 1.4 — Final go/no-go
- [ ] All Stage 0 items GREEN
- [ ] Live backup confirmed
- [ ] Time of day OK (low-traffic window, avoid lunchtime / Friday close-to-Shabbat)
- [ ] You're at your desk for at least the next 90 min in case of issues

---

## Stage 2 — Execute cutover

### 2.1 — Switch active theme
- [ ] wp-admin (live) → Appearance → Themes
- [ ] Hover **JLM Wines** → click **Activate**
- [ ] Theme is now active; kowine-child becomes inactive

### 2.2 — Reconcile Customizer settings
The active theme just changed; some Customize values may need re-setting because they're per-theme.

- [ ] Customize → Site Identity → Site Icon → re-confirm `jlm-wines-600-white-solid.jpg` (should persist; verify)
- [ ] Customize → Homepage Hero → upload/select hero image (check default, may need to set)
- [ ] Customize → Theme Options (jlmwines-specific theme mods if any added today) — confirm contact details, social URLs, business ID, payment image override, etc.

### 2.3 — Remove wishlist nav link + redirect
New theme has no wishlist feature. Menu edits are DB-stored (would affect kowine-child too if done pre-switch), so do this AFTER theme activation.

- [ ] wp-admin → Appearance → Menus → **EN primary menu** → remove the wishlist/favorites item → Save Menu
- [ ] Switch menu language → **HE primary menu** → remove the wishlist/favorites item → Save Menu
- [ ] Check footer/secondary menus for wishlist link too — remove if present (EN + HE)
- [ ] Set up 301 redirect for `/wishlist/` (and HE counterpart if separate slug) → home or shop. Use RankMath → General Settings → Redirections, or whatever redirect tool is in use.
- [ ] Verify redirect: hit `/wishlist/` in incognito → confirm 301 lands on target

### 2.4 — Deactivate `mailchimp-woocommerce` plugin on live
The replacement code (`inc/mailchimp-language-group.php`, v1.0.92) handles the checkout-opt-in subscribe + Language interest in one upsert PUT. With the plugin still active, both paths would fire — risk of double-subscribing.

- [ ] wp-admin (live) → Plugins → **Deactivate** `Mailchimp for WooCommerce`. **Do not delete** — the API key it stored in `wp_options` (`mailchimp-woocommerce` option) is what our replacement code reads. Deletion would lose the credential.
- [ ] Confirm plugin shows as inactive in the plugins list

### 2.5 — Flush all caches
- [ ] **SiteGround Optimizer** → Caching → Purge All Caches
- [ ] **WPML** → Support → Troubleshooting → Clear cache (if available in your version)
- [ ] **RankMath** → Tools → Database Tools → Update SEO Schema

### 2.6 — Smoke test on live (mirror Stage 0.4, but on live)
Same flows as 0.4. Speed-run version: visit each in incognito, no cached state.

- [ ] Homepage EN + HE
- [ ] Sample PDP EN + HE (pick a real wine you know)
- [ ] Cart drawer + checkout flow start
- [ ] Search
- [ ] Articles page + a blog post
- [ ] Age-gate appears on first visit, persists after Yes
- [ ] Footer contact/legal links working
- [ ] Language switcher works without breaking the page
- [ ] **Place a real test order** (small product, your own card). Tick the newsletter opt-in checkbox at checkout. After order completes:
  - Verify confirmation email arrives in correct language with custom on-hold copy
  - Check Mailchimp audience: subscriber added with correct Language interest (English or Hebrew matching the order's WPML language)
  - Move order processing→completed in WC admin → confirm `_jlmwines_mc_lang_synced` order meta is set, no double-PUT in Mailchimp activity feed
  - If possible, place a second test order in the OTHER language to cover both EN and HE paths

### 2.7 — Verify SEO outputs are unbroken
- [ ] `view-source:` on live homepage EN — confirm `<title>`, meta description, og: tags, hreflang, canonical all present
- [ ] Same on HE homepage — confirm `og:locale="he_IL"` (NEW — our seo-fixes filter activates at cutover)
- [ ] `https://jlmwines.com/sitemap_index.xml` loads, sub-sitemaps load
- [ ] `https://jlmwines.com/robots.txt` unchanged

### 2.8 — Visual sanity (10-min walk)
- [ ] Tablet viewport: home, PDP, catalog
- [ ] Mobile viewport: home, PDP, catalog, cart
- [ ] Cookie consent banner still works (Complianz)
- [ ] WhatsApp floating button visible only on PDP/catalog/shop
- [ ] No console errors (F12 → Console) on home + PDP

---

## Stage 3 — Post-cutover monitoring (first 24-48 hrs)

### 3.1 — Immediate (first 30 min)
- [ ] Check error logs: SiteGround → Tools → Error Logs → look for spikes since theme switch
- [ ] Watch live order flow — first real customer order is the truest test (gateway, emails, language)

### 3.2 — Performance re-tune
- [ ] Lighthouse mobile + desktop — record post-cutover scores
- [ ] Compare against pre-cutover baseline (Stage 0.4 capture)
- [ ] Re-tune SG Optimizer if needed (font optimization, combine CSS/JS, etc.)

### 3.3 — Search Console (24 hrs after cutover)
- [ ] Google Search Console → Coverage → check for new indexing errors
- [ ] Performance → check for click-rate drop on key product pages

### 3.4 — Customer-side checks (sample feedback)
- [ ] Test on at least 3 different devices (your phone, partner's phone, desktop)
- [ ] Test in HE locale specifically — partner's perspective
- [ ] Watch for support emails / WhatsApp messages flagging issues

### 3.5 — Cleanup (within 1 week)
- [ ] *Optional:* delete orphan `jlmwines`-domain entries in WPML String Translation (from earlier scans). Harmless if left — never resolve, since the textdomain is no longer used.
- [ ] Remove `inc/mc4wp.php` orphan if any deploy-script issue surfaces (already cleaned today)
- [ ] Re-snapshot `staging-plugin-baseline.json` if anything changed

---

## Stage 4 — Rollback procedure (if needed)

**Trigger condition:** any critical issue discovered post-cutover that can't be hot-fixed in <30 min.

Examples:
- Checkout broken
- HE pages don't render
- Major perf regression
- Login system broken

### 4.1 — Revert theme
- [ ] wp-admin (live) → Appearance → Themes → Activate **kowine-child**
- [ ] kowine-child becomes active; jlmwines-theme inactive
- [ ] Customers see old site on next page load

### 4.2 — Flush caches
- [ ] SG Optimizer → Purge All
- [ ] WPML cache clear
- [ ] If using browser caching directives, customers may see old new-theme assets briefly until their browser cache expires

### 4.3 — Diagnose and fix on staging
- [ ] Reproduce the issue on staging
- [ ] Fix in jlmwines-theme code, deploy, re-test
- [ ] When green, schedule re-cutover (back to Stage 1)

### 4.4 — Last resort: SiteGround backup restore
- [ ] If site is completely broken (white screen of death etc.) and theme switch alone doesn't fix it:
- [ ] SiteGround → Tools → Backups → restore the manual backup from Stage 1.1
- [ ] **WARNING:** this restores the entire site to that point — any orders, customer registrations, content changes since the backup are LOST
- [ ] Only use if no other option

---

## Quick reference

| Decision | Path |
|---|---|
| Switch theme | wp-admin → Appearance → Themes → Activate JLM Wines |
| Backup live | SiteGround Site Tools → Backups → Create Manual |
| Purge cache | SG Optimizer → Purge All |
| Rollback | wp-admin → Themes → Activate kowine-child |
| Plugin baseline apply | `node website/wp-plugins.js apply staging-plugin-baseline.json` |

---

## Success criteria

After Stage 2 + Stage 3.1, the cutover is "successful" when:

1. ✓ Live site renders jlmwines-theme on home, PDP, catalog, cart, checkout, articles
2. ✓ HE pages render with HE translations
3. ✓ Real test order completes end-to-end (place → pay → email arrives)
4. ✓ No console errors on key pages
5. ✓ No spike in error logs in first 30 min

If all 5 are green, breathe and start Stage 3.2 (perf re-tune).

---

**Authored:** 2026-05-03
**Target execution:** 2026-05-04 or later
**Owner:** Baruch (user)
**Review tool:** This checklist; mark each box as you complete it.
