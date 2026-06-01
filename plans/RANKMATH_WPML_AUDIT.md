# RankMath × WPML — Admin Audit Checklist

**Purpose.** Verify that HE pages get their own translated SEO meta (title, description, focus keyword, OG image) instead of inheriting EN. Most-common breakage: per-page SEO custom fields are not marked translatable in WPML, so HE pages serve EN meta to search engines and social platforms.

**Run from:** wp-admin on live (or staging — same WPML config). All steps read-only except where flagged "**FIX**".

**Updated:** 2026-05-31 (Rank Math MCP tooling + usage decision added — see bottom)

---

## A. Custom Fields Translation (highest-impact)

The single most-common WPML × RankMath gap. Each `_rank_math_*` field needs to be set to **Translate** so HE versions of pages can have their own values. If any field is set to **Copy** or **Don't translate**, that field is shared/inherited across languages.

**Path:** wp-admin → WPML → Settings → scroll to **Custom Fields Translation**

Verify each of the following is set to **Translate**:

- [ ] `_rank_math_title` — the SEO title shown in search results
- [ ] `_rank_math_description` — the meta description
- [ ] `_rank_math_focus_keyword` — focus keyword for analysis
- [ ] `_rank_math_robots` — index/noindex settings
- [ ] `_rank_math_canonical_url` — canonical URL
- [ ] `_rank_math_facebook_title` — Facebook OG title
- [ ] `_rank_math_facebook_description` — Facebook OG description
- [ ] `_rank_math_facebook_image` — Facebook OG image URL
- [ ] `_rank_math_facebook_image_id` — Facebook OG image attachment ID
- [ ] `_rank_math_twitter_title` — Twitter card title
- [ ] `_rank_math_twitter_description` — Twitter card description
- [ ] `_rank_math_twitter_image` — Twitter card image URL
- [ ] `_rank_math_twitter_image_id` — Twitter card image attachment ID
- [ ] `_rank_math_breadcrumb_title` — breadcrumb override
- [ ] `_rank_math_news_sitemap_robots` — news-sitemap robots (if news SEO active)
- [ ] `_rank_math_advanced_robots` — advanced robots tag

**FIX (if any are wrong):** click the dropdown for that field → select **Translate** → Save. WPML will then surface the field in its translation editor for each translatable page.

**FIX (after switching to Translate):** existing HE pages may need their `_rank_math_*` values populated manually — switching the setting doesn't auto-translate existing values. Edit each HE page → RankMath sidebar → set the SEO fields per HE page.

---

## B. Sitemap Structure

RankMath generates `sitemap.xml`. With WPML active, the sitemap should include URLs for both languages with proper hreflang.

**Path:** Visit `https://jlmwines.com/sitemap_index.xml`

Verify:
- [ ] Sitemap loads without error
- [ ] Includes `post-sitemap.xml`, `page-sitemap.xml`, `product-sitemap.xml`, `product-cat-sitemap.xml` (or equivalents)
- [ ] Each URL section contains both EN and HE URLs (e.g., `https://jlmwines.com/about/` AND `https://jlmwines.com/he/about/` — depending on URL format)

**Path:** wp-admin → RankMath → Sitemap Settings

Verify:
- [ ] Sitemap is enabled
- [ ] Post types and taxonomies that should be indexed are listed
- [ ] Excluded post types are intentionally excluded

**FIX (if HE URLs missing from sitemap):** WPML → Settings → SEO Translation Settings → ensure language-specific sitemaps are enabled. Some RankMath versions require additional WPML sitemap configuration.

---

## C. hreflang Tags

Each page should declare its translations to search engines via `hreflang` link tags.

**Path:** Open `view-source:https://jlmwines.com/` in browser, search for `hreflang`

Expected (homepage):
```html
<link rel="alternate" hreflang="en-US" href="https://jlmwines.com/" />
<link rel="alternate" hreflang="he-IL" href="https://jlmwines.com/he/" />
<link rel="alternate" hreflang="x-default" href="https://jlmwines.com/" />
```

Verify:
- [ ] `hreflang="en-US"` (or `en`) tag present, points to EN URL
- [ ] `hreflang="he-IL"` (or `he`) tag present, points to HE URL
- [ ] `hreflang="x-default"` present, points to default (EN)
- [ ] Repeat the check on a sample product page and a sample blog post

**FIX (if missing):** WPML → Languages → check "Include hreflang tags" or equivalent. Or check RankMath's **WPML Compatibility** mode (some versions need it explicitly enabled).

---

## D. Schema.org JSON-LD Translation

RankMath emits structured data. HE pages should emit HE-localized JSON-LD.

**Path:** `view-source:https://jlmwines.com/he/` (or any HE URL), find `<script type="application/ld+json">`

Verify on a HE page:
- [ ] `inLanguage` field reads `"he-IL"` or `"he"`, NOT `"en-US"`
- [ ] `name` and `description` in JSON-LD are in Hebrew
- [ ] Article schemas use HE `headline`, `description`
- [ ] Product schemas use HE `name`, `description`, `category`

**FIX:** Often resolves automatically once Custom Fields Translation (Section A) is set correctly. If still wrong, RankMath → General Settings → check WPML compatibility flag.

---

## E. OG Image Per Language (optional)

EN and HE pages can share the same OG image, OR have separate language-specific images. If you want separate images:

- [ ] On a HE page, RankMath sidebar → Social tab → set Facebook/Twitter image to a HE-specific image (e.g., a Hebrew-text version of the stamp)
- [ ] Verify via `view-source:` → `og:image` tag → URL matches the HE image

If shared image is fine (both languages use the same English-text logo): no action needed; default OG image picks up automatically.

---

## F. Spot-Check Verification (run after fixes)

Pick one EN page and its HE counterpart. For each, verify in `view-source:`:

- [ ] `<title>` differs between EN and HE
- [ ] `<meta name="description">` differs
- [ ] `<meta property="og:title">` differs
- [ ] `<meta property="og:description">` differs
- [ ] `<meta property="og:locale">` reads `en_US` on EN, `he_IL` on HE
- [ ] `<link rel="canonical">` points to the SAME-language URL (EN canonical → EN URL, HE canonical → HE URL)
- [ ] JSON-LD `inLanguage` matches the page language
- [ ] `hreflang` tags correctly link the pair

If any of these fail, drop back to Section A — most issues trace to Custom Fields Translation settings.

---

## Common gotchas

- **Switching a custom field from Copy to Translate doesn't auto-fill existing translations.** You'll need to edit each HE page manually after the switch, or use WPML's Translation Management to bulk-trigger translation jobs.
- **RankMath Pro features (Local SEO, News Sitemap) have their own custom fields** that also need to be marked Translate. The fields above cover Free + most Pro setups.
- **WPML caches.** After config changes, clear WPML cache (WPML → Support → Troubleshooting) AND any page caching plugin (SG Optimizer, etc.) before re-checking.
- **Permalink format matters.** If using `?lang=he` query param style, hreflang and sitemap structure differ from `/he/` directory style. The `/he/` directory style is what JLM Wines appears to use (based on the homepage source).

---

## Cross-references

- `plans/STATUS.md` — current project state
- WPML's own checklist: https://wpml.org/documentation/getting-started-guide/seo-multilingual-content/
- RankMath × WPML guide: https://rankmath.com/kb/wpml-compatibility/

---

## Rank Math MCP — tooling + usage decision (2026-05-31)

Rank Math ships a built-in MCP server (no plugin install needed). It was found already live on jlmwines.com and registered in Claude Code this session.

**Endpoint / connection (already configured):**
- Endpoint: `https://jlmwines.com/wp-json/mcp/mcp-adapter-default-server` (streamable HTTP)
- Auth: WordPress Application Password (Basic auth), user `gamboruch` (administrator). Credentials live in `exchange/rankmath-mcp.credentials.csv` (gitignored via `*.credentials.csv`).
- Registered as Claude Code MCP server `rankmath` (local scope). Verify with `claude mcp list`.
- **The in-Claude MCP client HANGS on every `rankmath` tool call (confirmed 2026-05-31) — do NOT call `mcp__rankmath__*` tools, the session stalls.** The endpoint itself is healthy; drive it directly with `curl` instead. Working lifecycle (all read-only steps):
  1. `initialize` → POST the endpoint, capture the `Mcp-Session-Id` response header.
  2. `notifications/initialized` → POST with that header (no body response).
  3. `tools/call` → POST with the header. Audit call: `{"method":"tools/call","params":{"name":"mcp-adapter-execute-ability","arguments":{"ability_name":"rank-math/audit-site-seo","parameters":{"refresh":true}}}}`.
  - Headers: `Content-Type: application/json`, `Accept: application/json, text/event-stream`, Basic auth `gamboruch:<app-password>`. Use a generous `-m` timeout (audit takes ~30–60s; it hits the remote rankmath.com API).
  - Abilities (from `discover-abilities`): `rank-math/audit-site-seo` (read-only) + `rank-math/fix-site-seo` (writes — never auto-run). `audit-site-seo` params: `refresh` (bool) + optional `url` (per-URL audit; remote tests only). **No `wpml_language` param — the audit is WPML-blind / global; the §A–F walk below is the only way to check per-language meta.**

**What it exposes — only two tools (the official Rank Math set, NOT the 23-ability open stack):**
- `rank-math/audit-site-seo` — **read-only.** Runs Rank Math's site-wide test suite, returns score + categorized findings. Can also audit a specified URL / competitor URL (competitor audits are PRO).
- `rank-math/fix-site-seo` — **writes.** Auto-toggles a fixed checklist (blog visibility, permalink structure, tagline, sitemap/schema modules, robots.txt, missing focus keywords). Global and WPML-blind.

**Usage decision for JLM:**
- **`audit-site-seo` — use freely as an on-demand read-only SEO pulse.** Fold a periodic run into the **monthly review** "SEO & Content" check (STATUS.md Review Cadence) as a cheap input alongside the GSC/GA4 glance. Matches the user's stated preference for periodic manual review over a built dashboard.
- **`fix-site-seo` — DO NOT auto-run on this site.** Its fixes are global and WPML-blind; auto-toggling sitemap/schema/robots on a bilingual live store is exactly the blast radius the house rules guard against. If it flags something real, apply the fix by hand, per-language-aware, with explicit OK — never via the auto-fixer.

**Fit with existing plans:**
- **Hardening plan (`jlmops/plans/RELIABILITY_AUDIT.md`): no fit, by design.** That plan is entirely jlmops (GAS middleware) data-integrity/ops; it has zero SEO surface. The Rank Math MCP touches WordPress, a separate system. Do not add it there.
- **KPI plan: light fit only.** Tier 3.2's status-file KPI block is orders/revenue/customers (WebOrdM), not SEO; `KPI_SUMMARY_TAB` is deferred. The only real touchpoint is the monthly-review SEO check above.
- **Open SEO backlog overlap: essentially none.** JLM's open items (homepage hreflang `http` #1, gtin13 #9, EN-only post #8, WPML Custom Fields Translation §A, HE front-page mapping #3) are all architecture/theme-code/WPML-settings work that `fix-site-seo` cannot touch. The generic auto-fixer and the real backlog do not overlap.

**Net:** keep the MCP as a read-only SEO monitoring pulse on the monthly cadence; never wire the auto-fixer; it stays out of the hardening plan.
