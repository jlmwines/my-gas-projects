# Product Text Update Plan

## Problem

Product pages have redundant SEO content. Each product repeats long explanatory text for intensity, complexity, acidity, and pairing that should live in dedicated content pages.

## Solution

1. Replace long per-product text with shorter attribute-based descriptions
2. Add links to content pages for customers who want more detail
3. Display circles (●●●○○) instead of numbers for visual clarity
4. Packing slips: circles only (no links needed)

---

## Current System

### Lookup Sheet: `SysLkp_Texts`

| Code | Purpose |
|------|---------|
| IN01-IN05 | Intensity paragraph text (long) |
| CO02-CO05 | Complexity paragraph text (long) |
| AC01-AC05 | Acidity paragraph text (long) |
| MILD, RICH, INTENSE, SWEET | Food category descriptions |
| HARMONIZE, CONTRAST | Pairing type headers |
| P0-P9 | Promo text by SKU last digit |

### Code Locations

**WooCommerceFormatter.js**
- Lines 254-259: Output raw numbers for intensity/complexity/acidity
- Lines 329-391: Append lookup paragraphs for export (IN0X, CO0X, AC0X)

**PackingSlipService.js**
- Line 117: `Intensity: ${intensity}, Complexity: ${complexity}, Acidity: ${acidity}`

---

## Changes

### 1. SysLkp_Texts Sheet Updates

**Add URL lookup codes:**

| Code | slt_TextEN | slt_TextHE |
|------|------------|------------|
| URL_INTENSITY | https://jlmwines.com/red-wine-intensity/ | https://jlmwines.com/he/red-wine-intensity/ |
| URL_COMPLEXITY | https://jlmwines.com/wine-complexity/ | https://jlmwines.com/he/wine-complexity/ |
| URL_ACIDITY | https://jlmwines.com/white-rose-wine-acidity/ | https://jlmwines.com/he/white-rose-wine-acidity/ |
| URL_PAIRING | https://jlmwines.com/pairing-food-and-wine/ | https://jlmwines.com/he/pairing-food-and-wine/ |

**Add circle lookup codes:**

| Code | slt_TextEN | slt_TextHE |
|------|------------|------------|
| CIRCLES1 | ●○○○○ | ●○○○○ |
| CIRCLES2 | ●●○○○ | ●●○○○ |
| CIRCLES3 | ●●●○○ | ●●●○○ |
| CIRCLES4 | ●●●●○ | ●●●●○ |
| CIRCLES5 | ●●●●● | ●●●●● |

**Add label lookup codes:**

| Code | slt_TextEN | slt_TextHE |
|------|------------|------------|
| LABEL_IN1 | Very Low | נמוכה מאוד |
| LABEL_IN2 | Low | נמוכה |
| LABEL_IN3 | Moderate | בינונית |
| LABEL_IN4 | High | גבוהה |
| LABEL_IN5 | Very High | גבוהה מאוד |
| LABEL_CO2 | Low | נמוכה |
| LABEL_CO3 | Moderate | בינונית |
| LABEL_CO4 | High | גבוהה |
| LABEL_CO5 | Very High | גבוהה מאוד |
| LABEL_AC1 | Very Low | נמוכה מאוד |
| LABEL_AC2 | Low | נמוכה |
| LABEL_AC3 | Moderate | בינונית |
| LABEL_AC4 | High | גבוהה |
| LABEL_AC5 | Very High | גבוהה מאוד |

**Update existing paragraph codes with shorter text (no embedded URLs - URLs looked up separately):**

Source: `content/guide/PRODUCT_TEXT_REVIEW.md`

| Code | slt_TextEN | slt_TextHE |
|------|------------|------------|
| IN01 | These wines are delicate and subtle. The overall experience is gentle and light on the palate. | יינות אלה עדינים ומעודנים. החוויה הכוללת עדינה וקלילה בחך. |
| IN02 | Low-intensity wines offer a more noticeable but still gentle character. Flavors and aromas are present but not overpowering. | יינות בעוצמה נמוכה מציעים אופי בולט יותר אך עדיין עדין. טעמים וארומות נוכחים אך לא מציפים. |
| IN03 | Wines of moderate intensity showcase a balanced expression of aromas and flavors. They offer a satisfying presence on the palate without being heavy. | יינות בעוצמה בינונית מציגים ביטוי מאוזן של ארומות וטעמים. הם מציעים נוכחות מספקת בחך מבלי להיות כבדים. |
| IN04 | High-intensity wines are bold and expressive, with pronounced aromas and concentrated flavors. They deliver a more impactful wine experience. | יינות בעוצמה גבוהה הם נועזים ואקספרסיביים, עם ארומות בולטות וטעמים מרוכזים. הם מעניקים חוויית יין משמעותית יותר. |
| IN05 | Powerful and concentrated wine, boasting intense aromas and a rich, often complex palate. The wine experience is significant and commanding. | יין עוצמתי ומרוכז, עם ארומות אינטנסיביות וחך עשיר ולעתים מורכב. חוויית היין משמעותית ושולטת. |

Same pattern for CO02-CO05, AC01-AC05 from PRODUCT_TEXT_REVIEW.md.

**Code constructs links by combining URL lookup + text:**
```javascript
const url = getLookupText('URL_INTENSITY', 'texts');
const text = getLookupText('IN0' + intensityCode, 'texts');
html += `<a href="${url}">${labelText}</a> ${text}`;
```

### 2. WooCommerceFormatter.js Changes

**Lines 254-259** - Change from raw numbers to circles + linked label:

```javascript
// Current:
if (intensityCode) html += addDetailLine('Intensity', 'עוצמה', intensityCode);

// New:
if (intensityCode) {
    const circles = getLookupText('CIRCLES' + intensityCode, 'texts', '');
    const label = getLookupText('LABEL_IN' + intensityCode, 'texts', intensityCode);
    const url = getLookupText('URL_INTENSITY', 'texts', '');
    const linkedLabel = url ? `<a href="${url}">${label}</a>` : label;
    html += addDetailLine('Intensity', 'עוצמה', circles + ' ' + linkedLabel);
}
```

Same pattern for complexity (URL_COMPLEXITY, LABEL_CO) and acidity (URL_ACIDITY, LABEL_AC).

**Lines 329-391 (export appendix)** - Update to use URL lookups:

```javascript
if (intensityCode) {
    const intensityKey = 'IN0' + intensityCode;
    const text = getLookupText(intensityKey, 'texts');
    const url = getLookupText('URL_INTENSITY', 'texts');
    if (text) {
        const label = getLookupText('LABEL_IN' + intensityCode, 'texts', '');
        appendedParagraphs.push(`<a href="${url}">${label}</a> - ${text}`);
    }
}
```

### 3. PackingSlipService.js Changes

**Line 117** - Add helper function and use circles:

```javascript
// Add helper at top of file:
function _numToCircles(num) {
    const n = parseInt(num, 10);
    if (isNaN(n) || n < 1 || n > 5) return '';
    return '●'.repeat(n) + '○'.repeat(5 - n);
}

// Line 117 change from:
detailsEn.push(`Intensity: ${intensity || 'N/A'}, Complexity: ${complexity || 'N/A'}, Acidity: ${acidity || 'N/A'}`);

// To:
if (intensity || complexity || acidity) {
    detailsEn.push(`Intensity: ${_numToCircles(intensity)}  Complexity: ${_numToCircles(complexity)}  Acidity: ${_numToCircles(acidity)}`);
}
```

### 4. Backfill Process

One-time export of descriptions for all simple products in both languages:

1. Query all simple products from WebDetM
2. Generate new description HTML using updated WooCommerceFormatter
3. Export as CSV with columns: SKU, Description_EN, Description_HE
4. Import to WooCommerce via standard CSV import

This can be done via a new function `exportProductDescriptions()` or manually through the existing export workflow.

---

## Implementation Order

### Phase 1: Lookup Sheet Updates
1. Add CIRCLES1-5 codes to SysLkp_Texts
2. Add LABEL_IN1-5, LABEL_CO2-5, LABEL_AC1-5 codes
3. Update IN01-05, CO02-05, AC01-05 with shorter text + links (EN)
4. Update Hebrew versions with Hebrew links

### Phase 2: Code Changes
1. Update WooCommerceFormatter.js lines 254-259
2. Update PackingSlipService.js line 117
3. Test preview in Admin Products View
4. Test packing slip generation

### Phase 3: Backfill
1. Export all simple product descriptions in both languages
2. Review sample descriptions
3. Import to WooCommerce
4. Verify on live site

---

## Files Modified

| File | Change |
|------|--------|
| SysLkp_Texts (sheet) | Add URL_*, CIRCLES*, LABEL_* codes; update IN*, CO*, AC* text |
| WooCommerceFormatter.js | Lines 254-259: circles + linked label; Lines 329-391: use URL lookups |
| PackingSlipService.js | Line 117: circles helper |

---

---

## Success Criteria

1. Product descriptions use shorter text with embedded links
2. Circles display instead of numbers in description and packing slips
3. All simple products updated in both languages
4. No functional regressions in edit/review/export workflow
