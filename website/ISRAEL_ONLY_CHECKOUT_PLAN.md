# Israel-Only Checkout Guard — Plan

Stops foreign buyers from placing orders we can't ship: at "Place order," a popup explains we ship only within Israel and offers Cancel (empty the cart) or Proceed (enter an Israeli shipping address). Status: **reviewed, ready to build once the manager's Hebrew strings arrive. Nothing built.**

## Problem

An English-language site lists jlmwines.com as a source for Hollander liqueurs, sending buyers from abroad (mostly the US) to checkout. Shipping country is hidden and forced to Israel (`inc/woocommerce.php`, `woocommerce_checkout_posted_data`), but billing country is visible. These buyers pick their own country for billing, enter their home address, and the shipping side ends up holding the same foreign address under a forced "Israel." The order goes through and has to be cancelled by hand.

Example: order 67876 (2026-10-18, cancelled). Billing and shipping both read 38 Mill Street, Bayboro, NC with a US phone; only the shipping country says IL; no gift message. Its `_shipping_israel_confirm` is blank and its shipping phone is the US number, which points to "ship to a different address" being left unchecked: WooCommerce then copies billing into shipping and skips shipping-field validation, so the required Israel checkbox and the "Recipient phone in Israel" field never apply. The existing checkbox therefore can't stop this case; the guard below has to.

## Trigger rule

Any attempt to ship outside Israel gets the popup (user, 2026-10-20). Since shipping country is forced to IL, "outside Israel" is detected through billing: the guard fires when billing country is not Israel and either

1. **"Ship to a different address" is unticked** (the default, and the real-world case), so shipping is the foreign billing address; or
2. **it's ticked but the same address is typed again**: shipping street line 1 and city match billing (trimmed, lower-cased; apartment line and names ignored); or
3. **it's ticked but the recipient phone isn't Israeli.** A different-looking address alone can't prove it's in Israel ("38 Mill St" vs "Mill Street", or a friend's US address would pass rules 1-2), so foreign-billing orders must also give an Israeli recipient phone. Israeli = after stripping spaces, dashes, dots and parentheses, matches `^(\+?972|0)\d{8,9}$` (covers +972 / 972 / 05x mobile and 0x landlines). Israeli-billing orders keep the existing lenient phone handling.

A gift message never exempts an order. A real gift from abroad ticks the box and enters a different, Israeli address with the recipient's Israeli phone, so it never triggers. Trade-off accepted (user, 2026-10-20): a gift sender abroad without the recipient's number can't complete the order until they get it.

**Both languages, one build pass** (user, 2026-10-20): the manager's Hebrew strings are expected the same day, so implementation waits for them and ships EN + HE together rather than English-only first.

## Verified facts the build relies on

- Checkout is the classic `[woocommerce_checkout]` shortcode (page 10), not the block checkout, so `woocommerce_checkout_fields` / `woocommerce_after_checkout_validation` apply and the form is `form.checkout` with `#place_order`.
- "Ship to a different address" is shown and unticked by default (user).
- `main.js` is vanilla JS (no jQuery anywhere in the theme); theme JS must live there, not inline (`website/CLAUDE.md`).
- The offer popup's markup is never rendered on checkout (`exit-intent-popup.php` returns early), so this modal needs its own markup; only the CSS classes are reused.

## Behavior

**Language flag.** The server check runs inside WooCommerce's `wc-ajax=checkout` request, where `is_rtl()` isn't reliable. So the checkout form carries a hidden field `jlm_checkout_lang` set at render time from `is_rtl()` (`he`/`en`), added in the existing `woocommerce_checkout_fields` filter. The server check uses it to pick the error message's language.

**Modal markup (`inc/woocommerce.php`).** Rendered on `wp_footer` only when `is_checkout()` and not the order-received page, with strings chosen by `is_rtl()` (as the existing checkbox label does). Hidden by default. Built from the offer-popup classes in `main.css`; buttons are `type="button"`. Carries the empty-cart URL (with nonce) as a data attribute.

**Client side (`assets/js/main.js`, runs only when the modal markup exists).** A capture-phase `submit` listener on `document` checks `form.checkout` before WooCommerce's own jQuery submit handler sees it. If the rule matches (`#billing_country` ≠ `IL`, and `#ship-to-different-address-checkbox` unticked, or shipping street 1 + city equal billing's, or `#shipping_phone` fails the Israeli pattern), it calls `preventDefault()` + `stopImmediatePropagation()` and opens the modal:

> Sorry, we can only ship to addresses in Israel. If you're sending a gift to someone in Israel, enter their Israeli address and phone number for shipping.
>
> [Cancel order]  [Enter Israeli address]

- **Cancel order** empties the cart and lands on the gift page (`/send-wine-gifts-in-israel/`), so they can send a gift within Israel if they like. No order exists yet at this point (the popup comes before submission), so emptying the cart is the whole cleanup; there is no pending order to delete.
- **Enter Israeli address** closes the modal, ticks "Ship to a different address" (shown, unticked by default, per user 2026-10-20), clears any shipping street/city that matches billing, and scrolls/focuses the shipping address block. Once ticked, the shipping fields are validated, so the Israel checkbox and "Recipient phone in Israel" requirements apply too. The buyer edits and clicks Place Order again; the rule re-checks.

Ticking the box via JS must also fire a `change` event so WooCommerce reveals the shipping fields.

**Server side (`inc/woocommerce.php`).** The same rule runs in `woocommerce_after_checkout_validation` (using `$data['billing_country']`, `$data['ship_to_different_address']`, the billing/shipping street 1 + city, and `$_POST['shipping_phone']` — not in `$data` since it's a custom field), and adds a checkout error with the modal's message in the language given by the posted `jlm_checkout_lang`. This is the real gate: it catches anything that bypasses the popup (JS failure, script blockers). The popup is the friendly path; the server check is the guarantee.

**Cart emptying.** A small handler for `?jlm_empty_cart=1&_wpnonce=…` on `wp_loaded`: verify the nonce, `WC()->cart->empty_cart()`, redirect to the gift page in the checkout's language (`/send-wine-gifts-in-israel/` for EN; HE URL resolved at build via WPML's translation of that page, not guessed). The language comes from a `lang` param on the URL the modal carries.

## Text

English text is final as written above (message + "Cancel order" + "Enter Israeli address"). The manager translates the same three strings; the session does not draft Hebrew. Build starts once the Hebrew arrives.

## Open points

- None. The existing "Shipping address and phone are both Israeli" checkbox stays permanently: it only shows when "ship to a different address" is ticked (mostly gift senders), and its job is the Israeli-phone-for-driver reminder for everyone, including Israeli-billing buyers whom the guard doesn't touch.

## Build order

1. Language flag + server-side validation rule (testable on its own: a matching order is refused with the message).
2. Empty-cart handler.
3. Modal markup, then the client intercept and its two actions.
4. Theme deploy (live, needs explicit OK), then test on the English checkout: foreign billing with box unticked is blocked; ticked with the same foreign address is blocked; ticked with a different address but a US phone is blocked; Proceed then fixing address + Israeli phone lets the order through; Cancel empties the cart and lands on the gift page; gift with a different Israeli shipping address and Israeli phone passes; Israeli buyer passes. Repeat the blocked case and Cancel on the Hebrew checkout (Hebrew text, Hebrew gift page).
