# SEO Growth Plan — JLM Wines

**Goal:** Increase organic traffic and new customer acquisition. Not a page-by-page audit — the audit lives in `SEO_AUDIT_2026-05-06.md` and `RANKMATH_WPML_AUDIT.md`. This plan organizes the work by leverage, sequences it for gradual rollout, and defines how to monitor results.

**Updated:** 2026-07-03 — added organic-traffic recovery baseline to Frame.

---

## Frame

**Background — the organic-traffic baseline this plan works from.** A prior rollout of rich, expanded product descriptions introduced too much duplicate text across product pages, which hurt organic traffic. That was fixed early 2026, and organic traffic has been recovering since — steady, involving both EN and HE, but has not yet returned to its pre-issue level. Overall sales remain below last year's, but conversion rate has increased. Read current organic-traffic numbers (`jlmops-status.md`, GA4 audience block) against this baseline: "still below last year" is an already-diagnosed, recovering trend, not a new problem to chase.

The site's technical SEO foundation is solid (87/100, clean schema, correct hreflang on all pages except homepage, language-correct canonicals).

New customers arrive via two distinct paths, which require different investments:

**Path 1 — Browse/discovery:** someone encounters JLM Wines while online, reads the content, gets interested, and converts. The persuasion happens on the site — through editorial voice, region guides, and Evyatar's personality. SEO's role here is to put interesting content in front of people already in a wine-curious mindset, not to capture purchase-intent queries. Israeli wine buyers are not typically searching "wine delivery Israel" — they're browsing, reading, getting persuaded.

**Path 2 — Product search:** a more sophisticated buyer (or someone wanting a case of something specific) searches by producer, wine name, or SKU. If JLM carries it, they should find it with a rich result — price, availability, a direct buy link. SEO's role here is product schema richness and accurate product data, not content.

Three levers in priority order:

1. **Hebrew signal quality** — every HE page is a potential new-customer surface. If HE meta is inherited from EN or titles show `jlmwines.com`, those pages underperform for Hebrew-language discovery.
2. **Product discoverability** — gtin13 in schema and clean product meta serve Path 2 directly. A buyer searching a specific wine by name should get a rich result with JLM's price and a buy link.
3. **Content quality** — editorial posts and region guides serve Path 1. The goal is compelling, on-brand content that interests and persuades a browser. Focus keyword optimization matters less here than voice and depth.

---

## Tier 1 — Foundation (do once, affects the whole site)

These fixes are one-time config or code changes. Each is low risk and has multiplied value because it affects every page of that type.

### 1a. HE site name fix
**What:** WPML → Languages → "Site name in this language" for Hebrew → set to `JLM Wines`.
**Why it matters:** currently every HE title ends with `jlmwines.com` instead of `JLM Wines`. Affects the title displayed in every HE search result. Single setting.
**Effort:** 2 minutes. **Risk:** zero.

### 1b. WPML Custom Fields Translation — verify + fix
**What:** WPML → Settings → Custom Fields Translation → confirm each `_rank_math_*` field is set to **Translate**, not Copy.
**Why it matters:** if any field is on Copy, HE pages inherit EN meta title/description/focus keyword. This is the single most-common WPML × RankMath failure mode. We don't know the current state — this is the key unknown.
**Effort:** 15-minute wp-admin walk. **Risk:** zero (read-only audit; fixes are individual field dropdowns).
**After:** for any field that was on Copy, existing HE pages need their RankMath sidebar values set manually. Audit scope: homepage, 3 product pages, 3 blog posts.
**Reference:** `RANKMATH_WPML_AUDIT.md` §A.

### 1c. Homepage meta descriptions — DONE (2026-05-06)
Both EN and HE already updated during the May 6 audit session. Live values are full-length and on-brand (EN 155 chars; HE equivalent). No action needed.

---

## Tier 2 — Product discoverability

### 2a. gtin13 in Product schema — SKIP (2026-06-28)
Google Shopping feed already maps SKU → GTIN for Shopping eligibility. Adding `gtin13` to JSON-LD schema would be a secondary signal for organic Product snippets only — marginal gain doesn't justify the theme code change + deploy. Deprioritized.

### 2b. Category page HE meta — LOW PRIORITY (2026-06-28)
Checked: all 5 HE category pages have no meta description; most EN pages also blank. Not worth fixing — category-level search queries don't fit either acquisition path. Path 1 buyers don't arrive via category searches; Path 2 buyers search specific wines and land on product pages. Google auto-generates category snippets from product names anyway.

---

## Tier 3 — Content acquisition funnel

### 3a. Region posts (already in calendar)
Region posts are the highest-acquisition content we can produce. Someone searching "יינות גולן" or "Galilee wine" has purchase intent, not just curiosity. The 2026 plan has 6 region posts + 1 canonical summary.

Negev post is template-formatted and pending winery verification. After Negev, the region sequence drives new-customer acquisition better than the sensory/education posts do.

**Stance:** treat region posts as acquisition content, not education. Each post should name specific wineries + wines available on the site, link to product pages, and be optimized for the region name as focus keyword (both EN and HE).

### 3b. Content as persuasion, not keyword capture
The sensory/education cluster (intensity, complexity, body, acidity, context) is the right kind of content for Path 1 — it's genuinely interesting to someone in a wine-curious mindset, it builds voice and authority, and it keeps a browser reading. Don't optimize this cluster for keyword density; optimize it for being worth reading.

The region posts (3a) serve both paths: they're interesting content for Path 1 browsers, and they naturally surface specific wines and producers that Path 2 searchers might look for. Each region post should name specific wines available on the site and link to their product pages — that's the editorial-to-product funnel.

What to avoid: manufacturing "commercial intent" editorial (wine delivery guides, "best of" lists designed around query volume). That model doesn't fit how Israeli wine buyers actually browse.

### 3c. Internal linking — region posts to products
When region posts publish, each should link to 3-5 specific products from that region available on the site. This is the editorial → product funnel. It also helps product pages rank for region-name queries.

---

## Monitoring cadence

### Monthly (fold into existing monthly review)
- **RankMath `audit-site-seo`** via curl — track score trend. The current baseline is 87/100 (2026-05-31). Log score + date in this doc's Monitoring Log below.
- **GA4 organic sessions + new users** — pull from GA4 sheet or manual GA4 review. Watch for Hebrew vs EN split if available.
- **New editorial posts:** run `get-post-seo-meta` on EN + HE pair within a week of publishing. Catch missing focus keywords, inherited meta, or short descriptions before they persist.

### Quarterly
- **GSC impressions/clicks/position** for key commercial queries: "wine delivery Israel", "Israeli wine", region terms. GSC is the authoritative signal; GA4 organic gives volume, GSC gives query-level data.
- **Re-run `audit-site-seo`** with `refresh:true` to pull fresh remote-API findings.
- **Spot-check category HE pages** (§2b) — view-source one HE category page and confirm title/description are HE-specific.

### After each region post publishes
- Verify HE translation has its own `_rank_math_title` + `_rank_math_description` populated (not inherited) — use `get-post-seo-meta` on the HE post ID.
- Confirm internal links to products are included in the post body.

---

## Sequencing

Do these in order. Each tier unblocks or amplifies the next.

| Step | Work | Tier | When |
|------|------|------|------|
| 1 | §1a HE site name — DONE (already correct) | Foundation | — |
| 2 | §1c Homepage meta descriptions — DONE (2026-05-06) | Foundation | — |
| 3 | §1b WPML Custom Fields audit — DONE (all Translate) | Foundation | — |
| 4 | §2b Category page HE meta | Product | After 1b clean |
| 5 | §2a gtin13 — SKIP (feed already covers Shopping) | Product | — |
| 6 | Negev region post (already templated) | Content | Per content calendar |
| 7 | Remaining region posts | Content | Per 2026 calendar |
| 8 | Commercial-intent posts | Content | After region sequence |

---

## Monitoring log

| Date | RankMath score | Notes |
|------|---------------|-------|
| 2026-05-31 | 87/100 | Baseline (post-cutover audit) |

---

## Cross-references

- `plans/SEO_AUDIT_2026-05-06.md` — technical audit findings with fix details
- `plans/RANKMATH_WPML_AUDIT.md` — WPML × RankMath checklist + MCP tooling notes
- `content/REGION_POSTS_PLAN.md` — region post sequence and calendar
- `website/HOMEPAGE_BLOCKS_PLAN.md` — Phase 1 resolves homepage hreflang http→https (#1 in audit)
