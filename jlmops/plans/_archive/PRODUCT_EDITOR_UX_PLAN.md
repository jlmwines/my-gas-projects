# Product Editor UX — Round 2

Three independent UX improvements to the product workflow. **Status: All shipped @345–@346.**

---

## 1. Searchable dropdowns (ManagerProductsView.html)

**Problem.** Region, Grape 1–5, and Kashrut 1–5 are plain `<select>` elements. With a long option list (grapes especially), locating an entry requires scrolling. No keyboard filter.

**Fix.** Custom `SearchableSelect` widget — text input for display/filtering + hidden input holding the code + floating dropdown showing filtered options. The hidden input keeps the same `id` as each current `<select>`, so all save/preview code that reads `.value` works unchanged.

**Affected fields** (11 total): `edit-Region` · `edit-Grape1`–`edit-Grape5` · `edit-Kashrut1`–`edit-Kashrut5`. The numeric 1–5 selects (Intensity, Complexity, Acidity, Decant) stay as-is.

**Data shape** is uniform: `{code, textEN, textHE}` for all three lookup types. Display `textEN`; store `code`.

### What changes in ManagerProductsView.html

**CSS** — add to `<style>`:
```css
.ss-wrap { position: relative; }
.ss-dropdown { display:none; position:absolute; z-index:1050; background:#fff; border:1px solid #ced4da;
  border-radius:4px; max-height:200px; overflow-y:auto; width:100%; box-shadow:0 2px 6px rgba(0,0,0,.15); }
.ss-item { padding:6px 12px; cursor:pointer; font-size:14px; }
.ss-item:hover, .ss-item.ss-active { background:#e9ecef; }
.ss-item-empty { padding:6px 12px; color:#6c757d; font-size:14px; }
```

**HTML** — replace each `<select class="form-control" id="edit-X">` with:
```html
<div class="ss-wrap">
  <input type="text" class="form-control ss-input" id="edit-X-display" autocomplete="off" placeholder="Type to filter…">
  <input type="hidden" id="edit-X">
  <div class="ss-dropdown" id="edit-X-dd"></div>
</div>
```
Also remove the now-unused CSS rule `select#edit-Region option { text-align: right !important; }`.

**JS** — add `SearchableSelect` object (before `ManagerProductsView`):
- `init(id, items)` — registers the element, builds the `_data` list, wires `input`/`focus`/`blur`/`keydown`/document-click handlers
- On input: filter `_data` by `textEN.toLowerCase().includes(term)`, re-render dropdown items
- On item click: write `code` to hidden input, `textEN` to display input, close dropdown
- On blur: if display text is empty, clear hidden input (allows clearing a selection); if non-empty and not matched, revert display to the previously matched `textEN`
- On Escape: close dropdown
- `setValue(id, code)` — sets hidden input to `code`, sets display input to the matching `textEN` (or blank if `code` is empty)
- `isRegistered(id)` — returns true if `id` was inited
- `clearDisplay(id)` — convenience: `setValue(id, '')`

**JS changes to existing functions:**

| Function | Current | Replacement |
|---|---|---|
| `populateRegionDropdown` | populates `<select>` | call `SearchableSelect.init('edit-Region', regions)` |
| `populateSelectWithData` | populates `<select>` for each id | call `SearchableSelect.init(id, data)` for each id |
| `setInp(id, val)` | `el.value = val` | if `SearchableSelect.isRegistered(id)`, call `SearchableSelect.setValue(id, val)` instead |
| `loadTabData` — specs | `selectEl.value = regionVal` (+ textHE fallback) | `SearchableSelect.setValue('edit-Region', resolvedCode)` |
| `loadTabData` — grapes | `el.value = val` | `SearchableSelect.setValue(id, val)` |
| `loadTabData` — kashrut | `el.value = val` | `SearchableSelect.setValue(id, val)` |
| `globalClear` — specs | `getElementById('edit-Region').value = ''` | `SearchableSelect.setValue('edit-Region', '')` |
| `globalClear` — grapes | `el.value = ''` | `SearchableSelect.setValue(id, '')` |
| `globalClear` — kashrut | `el.value = ''` | `SearchableSelect.setValue(id, '')` |
| `revertTab` — grapes | `el.value = ''` | `SearchableSelect.setValue(id, '')` |
| `revertTab` — kashrut | `el.value = ''` | `SearchableSelect.setValue(id, '')` |

`loadTabData` specs has a textHE fallback path (`lookupRegions.find(r => r.textHE === regionVal)`). With `SearchableSelect`, resolve the code there and pass it to `setValue` — the widget handles display.

**Smoke:** open editor on a product, switch to Grapes tab, type "cab" — expect filtered list. Select an entry, switch away and back — value persists. Clear the input — value clears. Save — code is in payload. Repeat for Kashrut and Region.

---

## 2. Price in suggestion approval modal (AdminProductsView.html)

**Problem.** Admin clicks Accept on a suggestion row (which shows SKU, name, division, group, price, stock) and a modal opens — but only SKU and name are carried into the modal. Price context is lost.

**What's available.** `t.price` is already in the task object returned by `WebAppProducts_getSuggestionTasks` and is already rendered in the table row. It just isn't passed to `openSuggestionModal`.

**Fix — 3 changes, all in AdminProductsView.html:**

1. Row click handler: add `t.price` as 4th arg:
   ```js
   AdminProductsView.openSuggestionModal(t.taskId, t.sku, t.title, t.price)
   ```

2. Function signature: `openSuggestionModal = function(taskId, sku, title, price)`

3. Modal header: add a `<small>` after the h5 title text, set it in the function:
   ```html
   <h5 class="mb-0">Approve Suggestion <small id="sugg-price-meta" class="text-muted font-weight-normal"></small></h5>
   ```
   ```js
   document.getElementById('sugg-price-meta').textContent = price ? '— ₪' + price : '';
   ```

**Smoke:** open a suggestion — confirm price appears in modal header. Open one with no price — confirm no stale value shows (the `textContent` write covers this).

---

## 3. Price column in the detail/HTML export (ProductService.js)

**Problem.** `_buildProductDetailExport` (shared by both `generateDetailExport` for vintage-mismatch tasks and `generateNewProductExport` for new-product onboarding) has no price column. Admin needs price when importing into WooCommerce.

**What's available.** `cmxRow` is already fetched per SKU inside the builder (`const cmxRow = cmxMap.get(sku)`). `cmxRow.cpm_Price` is the Comax price.

**Fix — 3 lines in `_buildProductDetailExport` in ProductService.js:**

1. Add `'Price (₪)'` to headers as column B (index 1):
   ```js
   const headers = [
       'SKU',
       'Price (₪)',          // new
       'Product Title EN',
       'Short Description EN',
       'Long Description EN',
       'Short Description HE',
       'Long Description HE',
       'Product Title HE'
   ];
   ```

2. Add price to each data row (after SKU):
   ```js
   exportDataRows.push([
       sku,
       cmxRow ? (cmxRow.cpm_Price || '') : '',   // new
       productTitleEn,
       shortDescriptionEn,
       longDescriptionEnHtml,
       shortDescriptionHe,
       longDescriptionHeHtml,
       productTitleHe
   ]);
   ```

3. Update hardcoded column-width calls (they shift +1 since Price becomes column B):
   - `setColumnWidth(4, 550)` → `setColumnWidth(5, 550)` (Long Description EN, now col E)
   - `setColumnWidth(6, 550)` → `setColumnWidth(7, 550)` (Long Description HE, now col G)

Both export callers benefit automatically. No backend API or config changes.

**Smoke:** run the export (new-product or detail-update) — confirm the output sheet has Price as column B, that it's populated from Comax data, and that Long Description columns still get the wide column width.

---

## Deploy order

1. **Price in export** (ProductService.js — backend only, lowest risk)
2. **Price in modal** (AdminProductsView.html — 3 lines, trivial)
3. **Searchable dropdowns** (ManagerProductsView.html — largest diff, own smoke pass before proceeding)
