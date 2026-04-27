# JLM Wines — Design System

Reference design system for the WordPress theme replacement. **Not** WordPress code — a standalone HTML/CSS demo that locks in tokens, type, color, components, and image treatment before any PHP is written.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Single-page demo of the entire system. Open in a browser. |
| `styles.css` | The design system itself. ~700 lines, no dependencies. |
| `RATIONALE.md` | Design rationale: why these choices, what's locked, what's open. |

## Quick start

Open `index.html` in any modern browser. No build, no server needed.

The page walks through:
1. Color system (8 tokens)
2. Typography (David Libre + Rubik, EN + HE)
3. Buttons & links
4. Product cards (5 variants: red, white, rosé, boxed, accessory)
5. Bundles & packages (standard bundle + curated package)
6. Free shipping monitor (in-progress + qualified states)
7. Hebrew · RTL versions of hero, card, and shipping monitor
8. Image treatment notes
9. Footer (newsletter + columns + lang switcher)
10. Floating add-to-cart (sticky at bottom)

Resize the window to see responsive behavior (breakpoint at 720px).

## Where this fits

- Design system = this folder
- Theme replacement plan = `../THEME_REPLACEMENT_PLAN.md`
- Staging audit (current site state) = `../STAGING_AUDIT_2026-04-26.md`

The theme is built against this design system after it's reviewed and approved.
