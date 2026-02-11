---
description: Format docx for WordPress 2-column post
---

Convert docx to WordPress block format with 2-column layout.

**Input:** $ARGUMENTS (filepath, e.g., "content/Pairing EN.docx")

**Process:**

1. Convert docx to markdown:
   ```
   pandoc "$ARGUMENTS" -t markdown --wrap=none
   ```

2. Parse content:
   - Above `---` = post body
   - Below `---` = extract excerpt from "Blog Roll Excerpt" or "Search Engine Snippet"

3. Create `.post.md` file at same location

**Output structure:**

```
## TITLE
[First bold line - copy to WordPress title]

## EXCERPT
[From Blog Roll Excerpt or Search Engine Snippet]

## BODY
Paste below into WordPress Code Editor:

<!-- wp:columns -->
<div class="wp-block-columns">
<!-- wp:column -->
<div class="wp-block-column">

[ALL content here as blocks]

</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->
```

**Formatting:**
- Section headers → `<!-- wp:heading --><h2>Text</h2><!-- /wp:heading -->`
- Subsection headers → `<!-- wp:heading {"level":3} --><h3>Text</h3><!-- /wp:heading -->`
- Paragraphs → `<!-- wp:paragraph --><p>Text</p><!-- /wp:paragraph -->`
- Bullet lists → `<!-- wp:list --><ul><li>Item</li></ul><!-- /wp:list -->`
- Numbered lists → `<!-- wp:list {"ordered":true} --><ol><li>Item</li></ol><!-- /wp:list -->`
- *italics* → `<em>`, **bold** → `<strong>`, `&` → `&amp;`

**Rules:**
- Skip title (goes in TITLE section only)
- ALL body content in column 1
- Column 2 empty - user adds images, drags content over
- Include CTA if present

Tell user the output path when done.
