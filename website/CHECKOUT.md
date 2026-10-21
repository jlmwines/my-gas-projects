# Checkout — Reference

How the jlmwines.com checkout behaves beyond stock WooCommerce. Present-tense system doc; all customizations live in `website/jlmwines-theme/inc/woocommerce.php` (PHP) and `assets/js/main.js` (JS). Live and tested EN + HE as of 2026-10-21.

## Basics

- Checkout is the classic `[woocommerce_checkout]` shortcode (page 10), not the block checkout, so the classic hooks apply and the form is `form.checkout` with `#place_order`.
- Shipping country is hidden and forced to Israel (`woocommerce_checkout_posted_data`). Billing country is visible.
- "Ship to a different address" is shown and unticked by default. When unticked, WooCommerce copies billing into shipping and skips shipping-field validation.
- When ticked, the shipping block requires the "Shipping address and phone are both Israeli" checkbox (`shipping_israel_confirm`) and a recipient phone (`shipping_phone`, "Recipient phone in Israel"). The checkbox is permanent: it reminds every gift sender that the driver needs an Israeli phone.

## Israel-only guard

Stops orders we can't ship. Shipping is forced to IL, so "outside Israel" is detected through billing: the guard fires when **billing country is not IL** and any of:

1. "Ship to a different address" is unticked (shipping is the foreign billing address);
2. shipping street line 1 and city equal billing's (trimmed, lower-cased);
3. the shipping phone isn't Israeli: after stripping spaces, dashes, dots and parentheses it must match `^(\+?972|0)\d{8,9}$`.

A gift message never exempts. A real gift from abroad ticks the box and enters an Israeli address and the recipient's Israeli phone, so it passes. Israeli-billing orders are untouched.

**Popup (friendly path).** A capture-phase `submit` listener in `main.js` checks the same rule before WooCommerce's handler and, on a match, blocks submission and opens `#ship-guard-popup` (rendered on `wp_footer` on checkout only, reusing the offer-popup CSS classes; strings by `is_rtl()`):
- **Cancel order** follows the popup's `data-cancel-url`: `?jlm_empty_cart=1&jlm_lang=<en|he>&_wpnonce=…` (nonce action `jlm_empty_cart`). A `wp_loaded` handler (priority 20) empties the cart and redirects to the gift page in that language (`/send-wine-gifts-in-israel/` or `/he/send-wine-gifts-in-israel/`, resolved via WPML). The param is `jlm_lang` because `lang` is WPML's query var.
- **Enter Israeli address** ticks "ship to a different address" (firing `change` so WooCommerce reveals the fields), clears shipping street/city that match billing, and focuses the shipping block.

**Server check (the real gate).** The same rule runs in `woocommerce_after_checkout_validation` and adds error `jlm_israel_only`, catching anything that bypasses the popup. The AJAX checkout request can't rely on `is_rtl()`, so the form carries a hidden `jlm_checkout_lang` field (echoed on `woocommerce_after_order_notes`) that picks the error's language.

**Text.** EN: "Sorry, we can only ship to addresses in Israel. If you're sending a gift to someone in Israel, enter their Israeli address and phone number for shipping." Buttons "Cancel order" / "Enter Israeli address". HE text and buttons are the manager's (in `jlmwines_ship_guard_strings()`).

Background: foreign buyers arrived via a third-party site listing us as a source for Hollander liqueurs (example: cancelled order 67876). Design history: `website/_archive/ISRAEL_ONLY_CHECKOUT_PLAN.md`.
