# JLM Wines — Theme Cutover Checklist

**Goal:** Switch the live site's active theme from `kowine-child` to `jlmwines-theme` with zero customer-facing regression.

**Target window:** 2026-05-04 (per session 2026-05-03).

**Time estimate:** ~2 hours focused work for a clean run; ~4 hours if remediation needed.

**Authority:** Only the user (Baruch) executes cutover steps. Claude verifies, never pushes to live without explicit per-step confirmation.

---

## Stage 0 — Pre-flight (DO BEFORE CUTOVER DAY)

These must be GREEN before scheduling the cutover.

### 0.1 — Translation pipeline complete
- [ ] **HE draft `.po` reviewed and edited** — `exchange/strings/jlmwines-he-draft.po` (72 entries). User edits any HE that doesn't sit right.
- [ ] **Imported to live's WPML String Translation** — wp-admin → WPML → String Translation → Import / export .po → upload reviewed `.po`, check "Also create translations according to the .po file", language Hebrew.
- [ ] **Spot-check on live's WPML UI** — filter Domain=`jlmwines`, Language=Hebrew → confirm strings appear with translations.
- [ ] *Optional but cleaner:* clean up the 32 orphan strings on live's WPML (entries from earlier text-domain swaps) — not required, harmless.

### 0.2 — Mailchimp flow tests on staging
- [ ] **EN footer signup** — submit test email on EN footer → confirm via the email Mailchimp sends → check audience: subscriber tagged "English"
- [ ] **HE footer signup** — same on HE footer → tagged "Hebrew"
- [ ] **EN checkout opt-in** — test order on EN with Mailchimp box ticked. Once order hits **processing**, check audience → tagged "English"
- [ ] **HE checkout opt-in** — test order on HE → tagged "Hebrew"
- [ ] **Idempotency** — move test order processing→completed in WC admin → confirm `_jlmwines_mc_lang_synced` order meta set once, no double-PUT in Mailchimp

### 0.3 — Plugin baseline parity
- [ ] **`staging-plugin-baseline.json` matches live's current plugin state** — at cutover time we don't touch live's plugins; cutover is theme-only.
- [ ] **Note any plugins active on staging but inactive on live** (or vice versa) — these are post-cutover decisions, NOT part of cutover.
- [ ] *Confirmed today:* RankMath inactive on staging baseline; **RankMath stays ACTIVE on live** (no change at cutover).

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

**Performance baseline (capture for post-cutover comparison):**
- [ ] Lighthouse mobile: LCP ___ s, FCP ___ s, CLS ___, TBT ___
- [ ] Lighthouse desktop: same fields

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
- [ ] **Translations** — confirm WPML String Translation has `jlmwines` domain entries with HE translations (Stage 0.1 verified)

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

### 2.3 — Flush all caches
- [ ] **SiteGround Optimizer** → Caching → Purge All Caches
- [ ] **WPML** → Support → Troubleshooting → Clear cache (if available in your version)
- [ ] **RankMath** → Tools → Database Tools → Update SEO Schema

### 2.4 — Smoke test on live (mirror Stage 0.4, but on live)
Same flows as 0.4. Speed-run version: visit each in incognito, no cached state.

- [ ] Homepage EN + HE
- [ ] Sample PDP EN + HE (pick a real wine you know)
- [ ] Cart drawer + checkout flow start
- [ ] Search
- [ ] Articles page + a blog post
- [ ] Age-gate appears on first visit, persists after Yes
- [ ] Footer contact/legal links working
- [ ] Language switcher works without breaking the page
- [ ] **Place a real test order** (small product, your own card) — verify confirmation email arrives in correct language with custom on-hold copy

### 2.5 — Verify SEO outputs are unbroken
- [ ] `view-source:` on live homepage EN — confirm `<title>`, meta description, og: tags, hreflang, canonical all present
- [ ] Same on HE homepage — confirm `og:locale="he_IL"` (NEW — our seo-fixes filter activates at cutover)
- [ ] `https://jlmwines.com/sitemap_index.xml` loads, sub-sitemaps load
- [ ] `https://jlmwines.com/robots.txt` unchanged

### 2.6 — Visual sanity (10-min walk)
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
- [ ] Delete orphan WPML String Translation entries (32 from earlier text-domain swaps)
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
| WPML translation import | wp-admin → WPML → String Translation → Import .po |
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
