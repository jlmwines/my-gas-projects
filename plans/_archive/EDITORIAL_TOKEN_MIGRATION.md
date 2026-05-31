# Editorial Token Migration

**Status:** Plan — not yet implemented
**Date:** 2026-04-27
**Workstream:** Theme replacement prep — gap #1 of the foundation review
**Related:** `THEME_FOUNDATIONS.md` (strategic anchor), `THEME_REPLACEMENT_PLAN.md`, `design-system/RATIONALE.md`

---

## Purpose

The published editorial content (8 blog posts × EN/HE, plus the About page × EN/HE) was authored before the design system was locked. Its inline color, border-radius, and box-shadow values were chosen ad-hoc — warm tan + cream + soft brown + drop shadows — and do not align with the design system tokens (cream + ink + terracotta, no shadows, decisive radius).

This migration brings every editorial inline style into the new token system so the content renders coherently on the new theme without theme-side override gymnastics.

This is the first concrete task in the theme replacement prep. Subsequent gaps (hero imagery direction, voice policy in `.po` strings, gift path, bundle parity, open design-system items, performance criteria) are tracked separately and will be planned in order.

---

## Scope

**18 files in `content/`:**

`.post.md` (16 — 8 topics × EN/HE):
- `About Evyatar EN_2026-01-08.post.md`, `About Evyatar HE.post.md`
- `Acidity EN_2025-01-12.post.md`, `Acidity HE_2025-01-12.post.md`
- `Complexity EN_2025-01-12.post.md`, `Complexity HE.post.md`
- `Intensity EN 2026-01-15 A.post.md`, `Intensity HE.post.md`
- `Pairing EN_2026-01-06.post.md`, `Pairing HE.post.md`
- `Price vs Quality EN 2026-01-18 B.post.md`, `Price vs Quality HE 2026-01-18 B.post.md`
- `What is a Good Wine EN_2026-01-06.post.md`, `What is a Good Wine HE.post.md`
- `Your Private Selection EN_2026-01-06.post.md`, `Your Private Selection HE.post.md`

`.page.md` (2):
- `About Page EN.page.md`, `About Page HE.page.md`

---

## Color mapping (decision locked)

| Old hex | New token | New hex | Where it shows up |
|---|---|---|---|
| `#faf6f1` | `--c-surface` | `#ffffff` | Group/callout/testimonial backgrounds — turns them into elevated surfaces on the cream page |
| `#5a4a3a` | `--c-ink` | `#1a1612` | Pullquote text, About lead, About testimonial heading |
| `#3a3a3a` | `--c-ink` | `#1a1612` | About body color |
| `#2a2a2a` | `--c-ink` | `#1a1612` | About h1 + section title |
| `#3a3020` | `--c-ink` | `#1a1612` | About value + testimonial titles |
| `#7a6a5a` | `--c-muted` | `#7a6e62` | About muted body text |
| `#C0A483` | `--c-accent` | `#a83920` | Pullquote left border, About links/labels/stars/value top-rules — **the substantive change**: warm tan → terracotta |
| `#e8ddd0` | ink @ 12% | `rgba(26, 22, 18, 0.12)` | About `.about-divider` border |
| `#fff` / `#ffffff` | `--c-surface` | `#ffffff` | About `.about-test-card` surface (no change) |

The dominant shift is `#C0A483` → `#a83920`. That accent runs through the About page links, labels, stars, value-card top rules, and every blog post's pullquote border. After this migration, every accent moment in editorial content is the same terracotta the new theme will use for CTAs and links — one accent across the site.

---

## Structural changes (decision locked)

Border radius and box shadow on all editorial blocks are migrated to the new system, which has neither. The design system uses surface contrast and 1px ink-12 borders for definition; soft drop shadows and rounded corners do not exist.

**`.post.md` group/callout blocks:**
- WP block JSON: remove `,"border":{"radius":"6px"},"shadow":"var:preset|shadow|natural"`
- Inline `style=` attribute: remove `;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.08)`

**`.post.md` pullquotes:**
- No radius/shadow to remove. Color migration only (text → ink, border → terracotta).

**`.page.md` embedded `<style>` block:**
- `border-radius: 10px;` → `border-radius: 0;` (covers `.about-img`, `.about-values`, `.about-testimonials`)
- `border-radius: 8px;` → `border-radius: 0;` (covers `.about-test-card`)
- `box-shadow: 0 2px 8px rgba(0,0,0,0.06);` → `box-shadow: none;` (`.about-values`)
- `box-shadow: 0 1px 4px rgba(0,0,0,0.06);` → `box-shadow: none;` (`.about-test-card`)

---

## What is intentionally NOT changing

- WP block markup structure (columns, headings, lists, tables, images, layout)
- Two-column flex-basis percentages (editorial layout choice, not theme-related)
- `.mobile-only` / `.desktop-only` image switching
- `1.15em` lead paragraph treatment — corresponds to a body-lead size; if the design system later formalizes a "lead body" token we can revisit
- Image references (URLs, IDs, alt text)
- Copy

This migration is surgical: tokens only, nothing else.

---

## Implementation approach

Two `sed` passes, one per file shape. Patterns are literal strings (identical across all files because the source was generated, not hand-authored), so substitution is deterministic.

### Pass 1 — `.post.md` (16 files)

```bash
cd "content" && for f in *.post.md; do
  sed -i \
    -e 's/#faf6f1/#ffffff/g' \
    -e 's/#5a4a3a/#1a1612/g' \
    -e 's/#C0A483/#a83920/g' \
    -e 's/,"border":{"radius":"6px"},"shadow":"var:preset|shadow|natural"//g' \
    -e 's/;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.08)//g' \
    "$f"
done
```

### Pass 2 — `.page.md` (2 files)

```bash
cd "content" && for f in *.page.md; do
  sed -i \
    -e 's/#faf6f1/#ffffff/g' \
    -e 's/#5a4a3a/#1a1612/g' \
    -e 's/#3a3a3a/#1a1612/g' \
    -e 's/#2a2a2a/#1a1612/g' \
    -e 's/#3a3020/#1a1612/g' \
    -e 's/#7a6a5a/#7a6e62/g' \
    -e 's/#C0A483/#a83920/g' \
    -e 's/#e8ddd0/rgba(26, 22, 18, 0.12)/g' \
    -e 's/border-radius: 10px;/border-radius: 0;/g' \
    -e 's/border-radius: 8px;/border-radius: 0;/g' \
    -e 's/box-shadow: 0 2px 8px rgba(0,0,0,0.06);/box-shadow: none;/g' \
    -e 's/box-shadow: 0 1px 4px rgba(0,0,0,0.06);/box-shadow: none;/g' \
    "$f"
done
```

### Why sed and not the Edit tool
Patterns are identical literal strings. 18 files × ~5–12 substitutions = unwieldy via per-file Edit calls. Sed with literal strings (no regex hazards: no `/`, no special chars in replacements, dots in numbers don't matter for substitution) is the right size of tool.

### Why not a Node helper script
One-shot operation. Doesn't earn a committed tool.

---

## Verification

After running both passes:

1. **No old hexes remain**:
   ```bash
   grep -E '#(faf6f1|5a4a3a|C0A483|3a3a3a|2a2a2a|3a3020|7a6a5a|e8ddd0)' content/*.post.md content/*.page.md
   ```
   Expected: zero matches.

2. **Spot-read** three representative files for structure integrity (no broken JSON, no orphan semicolons, no malformed CSS):
   - `About Evyatar EN_2026-01-08.post.md` (has the full group block + pullquote pattern)
   - `Acidity EN_2025-01-12.post.md` (has the simpler group block + pullquote pattern)
   - `About Page EN.page.md` (has the embedded `<style>` block)

3. **Re-push to staging6** via existing pipeline:
   ```bash
   node content/push-posts.js
   ```
   Posts upsert by ID. About page pushed via WP REST.

4. **Visual verification on staging6** (user does this):
   - One blog post EN — pullquote terracotta border + ink text, callout white-on-cream, no rounded corners, no drop shadow
   - One blog post HE — same checks, RTL renders cleanly
   - About page EN — testimonial cards white-on-cream, no radius, no shadow; links/stars/labels are terracotta; value-card top rules are terracotta
   - About page HE — same checks, RTL

5. **Roll back if needed**: `git checkout content/*.post.md content/*.page.md` restores all 18 files.

---

## Open question (one — confirm before implementation)

Callout backgrounds default to **`#ffffff` (surface)** on the cream page (`#f7f3ec`) — turns them into elevated cards. Alternative: a tinted cream like the package-card gradient (`#f0e9d8`) for a quieter, less elevated callout that still differentiates from page background.

**Default proposal:** `#ffffff` (surface). Coherent with how cards work in the design system (white surface on cream page, 1px ink-12 border for definition).

**Pushback option:** tinted cream `#f0e9d8` everywhere callouts appear, if "quiet" reads better than "elevated" for editorial sidebars.

---

## Sequence

1. ✅ Plan written (this document)
2. ⏸ User confirms callout background choice (surface white vs tinted cream)
3. ⏸ User says "go" — implementation runs
4. ⏸ Verification grep + spot-read
5. ⏸ Re-push via `push-posts.js`
6. ⏸ User verifies on staging6
7. ⏸ Plan marked complete; STATUS.md updated; move to gap #2

---

## Decisions locked

- Color tokens map per the table above. No alternatives under consideration.
- Border radius → 0 across all editorial blocks.
- Box shadow → none across all editorial blocks.
- Scope is 18 files in `content/`. Not touching theme code, not touching design system, not touching copy or layout.
- Re-push uses the existing `content/push-posts.js` pipeline. No new tooling.
- This migration ships in advance of the new theme — once applied, the editorial content harmonizes with the design system whether viewed on the current site (where new tokens aren't defined as variables, so the literal hex values render correctly) or on the new theme post-cutover.
