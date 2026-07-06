# Post HTML Block — Construction Guide

How to build the Gutenberg HTML that goes after `Paste below into WordPress Code Editor:` in a `.post.md` file. Read this before writing any post's HTML block, especially anything with images in a multi-column layout — this is the exact area that cost an entire session's worth of back-and-forth to get right once (2026-07-06, Negev post), because the HTML was invented from scratch instead of copied from precedent.

## Check precedent first, always

Before writing a single line of column/image HTML: look at `content/existing-layouts/*.raw.txt` (raw HTML dumps of already-published posts) and an already-shipped bilingual pair like `content/Handling EN.post.md` / `content/Handling HE.post.md`. Copy the actual structure — don't invent column widths, classes, or CSS from first principles. This mirrors the jlmops UI rule ("find the same element type already working and copy it exactly") — it applies just as much to content HTML.

## The one rule that matters most: HE is a structural copy of EN

**The Hebrew HTML block is the identical structure as the English one — same columns, same widths, same classes, same column order. Only the text is translated.** Confirmed by diffing `Handling EN.post.md` against `Handling HE.post.md`: every `wp:columns`/`cols-flip` occurrence lines up 1:1 between the two files, in the same sequence, with the same classes.

**Do not try to "mirror" or flip column/image position between EN and HE.** There is no cross-language reversal mechanism on this site, and building one (generic `.wp-block-columns { flex-direction: row-reverse }`, or applying `cols-flip` asymmetrically between languages) does not produce a correct result and is not how any live post is actually built. If a HE draft's column layout looks wrong, the fix is almost always "make the HTML match the EN file's structure exactly," not "add more CSS."

## `cols-flip` — what it's actually for

`cols-flip` is a **same-language visual-rhythm tool**, not an RTL/mirroring tool. Applying `className: "cols-flip"` to a `wp:columns` block reverses that row's flex direction, used to alternate which side the image sits on **across consecutive sections within one post** (e.g. Handling EN: section 1 no-flip, section 2 `cols-flip`, section 3 no-flip...). Copy this exact CSS into the post's own `<style>` block (inside a `wp:html` block, near the top of the post) — do not invent a different selector:

```css
.cols-flip { flex-direction: row-reverse; }
@media (max-width: 781px) {
  .cols-flip { flex-direction: column; }
}
```

Apply the class to whichever `wp:columns` blocks need alternating rhythm — and apply it **identically** in both the EN and HE files (same sections flagged, same sections not).

## `img-first-mobile` — mobile stacking order

Separate, unrelated concern: on mobile, columns stack in source order. If an image column is not first in a row's HTML (e.g. a 3-column row: text, text, image), it'll appear last on mobile — after all the text. Fix with a mobile-only `order` rule, added to the post's own `<style>` block alongside `cols-flip` if both are needed:

```css
@media (max-width: 781px) {
  .img-first-mobile { order: -1; }
}
```

Apply `className: "img-first-mobile"` to the specific column that needs to jump to the front on mobile. This is a per-post, per-row fix based on where that row's image actually sits in the DOM — apply it wherever needed, identically in EN and HE (since the HE file has the same DOM order as EN per the rule above).

## Column width conventions seen in practice

- `25%/75%` — image + a lot of supporting text (Handling's pattern for short, list-heavy sections).
- `40%/60%` — image + a moderate paragraph or two (common default).
- `50%/50%` — image sharing a column with several paragraphs, remaining paragraphs in the other column (used when a section's text is long enough that a single small image column would look sparse next to it).
- `33.3%/33.3%/33.3%` (3-column) — two text columns plus one image column, used when a section is long enough to want two text columns instead of stretching one.

Pick based on how much text is actually in that section — not a fixed rule, but stay consistent with an existing example rather than inventing a new ratio.

## Verifying a push

`push-posts.js` only updates `post_content` (and `featured_media`/`categories` if configured) — it never sets `post_status`. After pushing, checking correctness means reading the actual saved HTML back via the REST API (`?context=edit` with the site's Application Password), not assuming the push succeeded. A browser preview of a **draft** requires a logged-in cookie session — `curl`/`WebFetch` cannot load it (returns "Page not found"), so draft-preview visual bugs can only be diagnosed by the human looking at the actual page, or by briefly publishing so the real permalink becomes fetchable. Don't try to reverse-engineer rendering behavior (RTL flex direction, cascade specificity, etc.) from CSS spec theory alone — check a live, working precedent instead; theory repeatedly gave wrong answers this session where checking Handling's actual committed source gave the right one immediately.
