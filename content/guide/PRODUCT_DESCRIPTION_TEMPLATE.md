# Product Description Template

HTML structure for WooCommerce product descriptions. Text content is looked up from `PRODUCT_TEXT_REVIEW.md` based on attribute values.

---

## HTML Structure

### English

```html
<table style="width:100%; border-collapse:collapse; margin-bottom:20px; background:#f9f9f9; border-radius:4px;">
<tr style="border-bottom:1px solid #eee;">
<td style="padding:8px 12px; width:40%;"><strong>Intensity</strong></td>
<td style="padding:8px 12px; width:25%;">{INTENSITY_CIRCLES}</td>
<td style="padding:8px 12px;">{INTENSITY_LABEL}</td>
</tr>
<tr style="border-bottom:1px solid #eee;">
<td style="padding:8px 12px;"><strong>Complexity</strong></td>
<td style="padding:8px 12px;">{COMPLEXITY_CIRCLES}</td>
<td style="padding:8px 12px;">{COMPLEXITY_LABEL}</td>
</tr>
<tr style="border-bottom:1px solid #eee;">
<td style="padding:8px 12px;"><strong>Acidity</strong></td>
<td style="padding:8px 12px;">{ACIDITY_CIRCLES}</td>
<td style="padding:8px 12px;">{ACIDITY_LABEL}</td>
</tr>
<tr>
<td style="padding:8px 12px;"><strong>Pairs with</strong></td>
<td style="padding:8px 12px;" colspan="2">{PAIRING_SUMMARY}</td>
</tr>
</table>

<p><a href="{INTENSITY_URL}">{INTENSITY_TEXT}</a></p>

<p><a href="{COMPLEXITY_URL}">{COMPLEXITY_TEXT}</a></p>

<p><a href="{ACIDITY_URL}">{ACIDITY_TEXT}</a></p>

<p><strong>Food pairing:</strong> {PAIRING_TEXT} {FOOD_TEXT}</p>

<p style="font-size:0.9em; color:#666; margin-top:20px;"><em>{TRUST_STATEMENT}</em></p>
```

### Hebrew (RTL)

```html
<table dir="rtl" style="width:100%; border-collapse:collapse; margin-bottom:20px; background:#f9f9f9; border-radius:4px; text-align:right;">
<tr style="border-bottom:1px solid #eee;">
<td style="padding:8px 12px; width:40%;"><strong>עוצמה</strong></td>
<td style="padding:8px 12px; width:25%;">{INTENSITY_CIRCLES}</td>
<td style="padding:8px 12px;">{INTENSITY_LABEL_HE}</td>
</tr>
<tr style="border-bottom:1px solid #eee;">
<td style="padding:8px 12px;"><strong>מורכבות</strong></td>
<td style="padding:8px 12px;">{COMPLEXITY_CIRCLES}</td>
<td style="padding:8px 12px;">{COMPLEXITY_LABEL_HE}</td>
</tr>
<tr style="border-bottom:1px solid #eee;">
<td style="padding:8px 12px;"><strong>חומציות</strong></td>
<td style="padding:8px 12px;">{ACIDITY_CIRCLES}</td>
<td style="padding:8px 12px;">{ACIDITY_LABEL_HE}</td>
</tr>
<tr>
<td style="padding:8px 12px;"><strong>מתאים ל</strong></td>
<td style="padding:8px 12px;" colspan="2">{FOOD_CATEGORY_HE} ({PAIRING_TYPE_HE})</td>
</tr>
</table>

<p><a href="{INTENSITY_URL_HE}">{INTENSITY_TEXT_HE}</a></p>

<p><a href="{COMPLEXITY_URL_HE}">{COMPLEXITY_TEXT_HE}</a></p>

<p><a href="{ACIDITY_URL_HE}">{ACIDITY_TEXT_HE}</a></p>

<p><strong>שילוב עם אוכל:</strong> {PAIRING_TEXT_HE} {FOOD_TEXT_HE}</p>

<p style="font-size:0.9em; color:#666; margin-top:20px;"><em>{TRUST_STATEMENT_HE}</em></p>
```

---

## Circle Reference

| Level | Circles |
|-------|---------|
| 1/5   | ●○○○○   |
| 2/5   | ●●○○○   |
| 3/5   | ●●●○○   |
| 4/5   | ●●●●○   |
| 5/5   | ●●●●●   |

Unicode characters:
- Filled: ● (U+25CF BLACK CIRCLE)
- Empty: ○ (U+25CB WHITE CIRCLE)

---

## Content Page Links

Links appear in the explanatory paragraphs (not the summary table). Replace placeholders with actual URLs:

| Topic | English URL | Hebrew URL |
|-------|-------------|------------|
| Intensity | /intensity/ | /he/intensity/ |
| Complexity | /complexity/ | /he/complexity/ |
| Acidity | /acidity/ | /he/acidity/ |
| Pairing | /pairing/ | /he/pairing/ |

Links are subtle - embedded in the explanatory text so customers who want more can click, but the primary action remains "Add to Cart".

---

## Text Lookup by Level

### Intensity
| Level | Label | Text |
|-------|-------|------|
| 1 | Very Low | These wines are delicate and subtle. The overall experience is gentle and light on the palate. |
| 2 | Low | Low-intensity wines offer a more noticeable but still gentle character. Flavors and aromas are present but not overpowering. |
| 3 | Moderate | Wines of moderate intensity showcase a balanced expression of aromas and flavors. They offer a satisfying presence on the palate without being heavy. |
| 4 | High | High-intensity wines are bold and expressive, with pronounced aromas and concentrated flavors. They deliver a more impactful wine experience. |
| 5 | Very High | Powerful and concentrated wine, boasting intense aromas and a rich, often complex palate. The wine experience is significant and commanding. |

### Complexity
| Level | Label | Text |
|-------|-------|------|
| 2 | Low | Low-complexity wines offer a bit of nuance, perhaps with more discernible aromas or tastes. The experience remains relatively simple but with a touch more depth than the very basic wines. |
| 3 | Moderate | Wines of moderate complexity show a noticeable interplay of several aromas and flavors, and perhaps a developing character on the palate. The experience is more engaging, with layers that unfold. |
| 4 | High | High-complexity wines exhibit a wide array of aromas and flavors, often evolving in the glass. They offer a multi-layered and intriguing experience, with nuances that can be discovered over time. |
| 5 | Very High | These wines are exceptionally complex, displaying a multitude of aromas and flavors that can be both primary (from the grape), secondary (from winemaking), and tertiary (from aging). The experience is profound and captivating, often revealing new dimensions with each sip. |

### Acidity
| Level | Label | Text |
|-------|-------|------|
| 1 | Very Low | Lower acidity wines feel softer and rounder on the palate, lacking that sharp, tangy edge. They can feel smoother and sometimes richer. |
| 2 | Low | Lower acidity wines feel softer and rounder on the palate, lacking that sharp, tangy edge. They can feel smoother and sometimes richer. |
| 3 | Moderate | Moderate acidity wines strike a balance, showing noticeable freshness without being overly tart. They feel lively but also have a certain smoothness. |
| 4 | High | Expect a bright, tangy quality that makes feels fresh and lively. Acidity adds tartness, giving the wine a clean feel. |
| 5 | Very High | Expect noticeable tartness and freshness, often described as zesty or crisp. This lively quality can make the wine feel vibrant and mouthwatering. |

### Pairing Type
| Type | Text |
|------|------|
| Harmonizing | Harmonizing (congruent) pairings bring together wines and foods that share similar flavor components, creating a harmonious experience where the tastes reinforce each other. |
| Contrasting | Contrasting (complimentary) pairings bring together wines and foods with few shared flavor components. This creates a dynamic balance, where the different tastes complement and enhance each other. |

### Food Categories
| Category | Foods |
|----------|-------|
| Mild Flavors | Soft cheeses, white fish, lightly seasoned poultry, pasta in a light sauce. |
| Rich Flavors | Salmon and similar fish, red meats, fattier foods, and many hard cheeses. |
| Intense Flavors | Heavily seasoned and spicy dishes, and foods with strong, more noticeable flavors. |
| Sweet Flavors | Desserts and pastries, as well as foods prepared with sweet sauces, glazes, or sweet ingredients. |

---

## Google Sheets Formula Approach

For generating descriptions programmatically, you can use VLOOKUP or SWITCH formulas to assemble the HTML based on numeric attribute values in the product data.

Example structure in Sheets:
- Column A: Product SKU
- Column B: Intensity (1-5)
- Column C: Complexity (2-5)
- Column D: Acidity (1-5)
- Column E: Pairing Type (Harmonizing/Contrasting)
- Column F: Food Category
- Column G: Generated Description (formula)

The formula would concatenate the HTML template with the appropriate text lookups.

---

## Packing Slip Format

For packing slips, use only the circles without HTML:

```
Intensity:  ●●●●○  High
Complexity: ●●●○○  Moderate
Acidity:    ●●○○○  Low
Pairs with: Rich Flavors
```
