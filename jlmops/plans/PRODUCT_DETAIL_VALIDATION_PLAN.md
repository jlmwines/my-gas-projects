# Product Detail Editing — Validation Pass

**Created:** 2026-05-13
**Status:** Plan written. Implementation pending user OK.
**Scope:** `ManagerProductsView.html` only — the product-detail edit modal used by the wine manager.
**Out of scope:** `AdminProductsView.html`, downstream renderers (`PrintService.js`, `WooCommerceFormatter.js`), backfill of existing rows, "reviewed/unreviewed" reporting surfaces.

---

## Goal

When the wine manager edits a product detail record, ensure on save that:

1. A decanting value has been actively supplied (no blank-by-oversight).
2. Description fields are mechanically tidy (no double spaces, terminal period, EN short starts capitalized).

Both apply only at the moment of manager edit. The stored data shape does not change. Downstream renderers (packing slip, WC product description, manager preview) continue to use their existing truthy-check on `wdm_Decant` — blank and `0` produce identical output, so no renderer change is needed and no data backfill is required.

---

## Changes

### 1. Decant dropdown — add a "0" option

`ManagerProductsView.html:791` — change

```js
ManagerProductsView.populateSelectRange(['edit-Decant'], [15, 30, 45, 60]);
```

to

```js
ManagerProductsView.populateSelectRange(['edit-Decant'], [0, 15, 30, 45, 60]);
```

The label shown in the dropdown is `0`. Manager interprets it as "reviewed, no decanting needed." Customer-facing renders still hide the decant line because `0` is falsy in JS — identical to today's behavior for blank values.

### 2. Refuse save if decant is blank

In `ManagerProductsView.submitChanges` (line 1263), before building `formData`:

```js
const decantVal = document.getElementById('edit-Decant').value;
if (decantVal === '') {
  alert('Please select a decanting value before saving.');
  return;
}
```

Modal still pre-fills decant from master data (`m.wdm_Decant || ''` at line 1040) — manager keeps existing value if one is already there.

### 3. Auto-normalize description fields on save

A small helper, run on all four description fields before assembling `formData`:

```js
const normalize = (id, capitalize) => {
  const el = document.getElementById(id);
  if (!el || !el.value) return;
  let t = el.value.replace(/ {2,}/g, ' ').trim();
  if (!t) { el.value = t; return; }
  if (capitalize) t = t.charAt(0).toUpperCase() + t.slice(1);
  const last = t.charAt(t.length - 1);
  if (last !== '.' && last !== '!' && last !== '?') t += '.';
  el.value = t;
};
normalize('edit-ShortDescrEn', true);
normalize('edit-ShortDescrHe', false);
normalize('edit-DescriptionEn', false);
normalize('edit-DescriptionHe', false);
```

What it does:

- Collapse runs of 2+ spaces to a single space (all four fields).
- Trim leading/trailing whitespace (so the period rule doesn't append after spaces).
- Capitalize the first character of the English short description.
- If the field doesn't already end in `.` / `!` / `?`, append `.` — applies to both short and long, English and Hebrew.

Rewrites are applied to the textarea values in-place before submit, so the manager sees the corrected text reflected if the save fails for any other reason.

Empty fields are left empty (no change).

---

## What's not changing

- **Stored data shape.** `wdm_Decant` and the description columns keep their current types.
- **Downstream renderers.** `PrintService.js`, `WooCommerceFormatter.js`, the manager preview block all keep `if (decant)` truthy checks. Blank and `0` continue to suppress the decant line.
- **Existing rows.** No backfill needed. Existing blank decant values stay blank until a manager edits the product — at which point validation requires a value to be picked.
- **`AdminProductsView.html`.** Not touched by this pass. Admin edit path is rarely used for these specific fields; can be addressed in a separate session if needed.

---

## Implementation order

1. Apply the dropdown change at line 791.
2. Add the validation block + normalize helper inside `submitChanges`.
3. `clasp push`.
4. Manager smoke-test: edit one product, leave decant blank, attempt save → alert fires. Pick `0` → saves. Edit description with `  double   spaces   ` and no terminal period → on save, textarea shows ` double spaces.`

No deploy promotion needed beyond `clasp push` — this is web-app code, no `deploymentId` involved.

---

## Future / related items (not in this plan)

- Admin-side equivalent in `AdminProductsView.html` if review reveals admin path is in active use for these fields.
- A "Products with unreviewed decanting" reporting surface — would require either backfilling existing blanks differently or adding a `wdm_DecantReviewed` flag. Not pursued now per design choice (the act of saving the modal is the only confirmation signal we capture).
- Extending normalization to other text fields (region name, etc.) if patterns of similar tidiness gaps emerge.
