# Popup Admin Controls — Plan

**What:** Adds a WordPress Customizer section, "Popup Controls," so the exit-intent/new-visitor popup (`EXIT_INTENT_POPUP_PLAN.md`) can be adjusted without code edits or a redeploy.

## Why

The popup ships fully hardcoded — no admin surface at all. Toggling any part of it currently means editing `inc/exit-intent-popup.php`/`main.js` and running `deploy-theme.ps1` (a live-site FTP push, no staging). A plugin swap (OptinMonster, Popup Maker) was considered and rejected: it would mean rebuilding the existing exit-intent + mobile-timer + coupon-copy + bilingual + age-gate-coordination logic inside the plugin's own system for no real gain over a few Customizer fields on top of what's already built.

## Fields (Appearance → Customize → Popup Controls)

| Setting (theme mod) | Control | Default | Effect |
|---|---|---|---|
| `jlmwines_popup_offer_enabled` | checkbox | on | Show/hide the coupon-code offer block |
| `jlmwines_popup_whatsapp_enabled` | checkbox | on | Show/hide the WhatsApp block |
| `jlmwines_popup_email_enabled` | checkbox | on | Show/hide the email-signup block |
| `jlmwines_popup_mobile_delay` | number (seconds) | 4 | Mobile on-load trigger delay |
| `jlmwines_popup_exclude_logged_in` | checkbox | on | Skip the popup for logged-in customers |

No master on/off field — turning all three content toggles off means the popup has nothing to show, so it doesn't render (same effect, one less control). Confirmed 2026-08-25: this is the intended full-disable path, no separate master switch planned.

## Technical approach

- `inc/customize.php` — new `jlmwines_popup` section, same pattern as the existing `jlmwines_hero` section (checkbox controls default to WP's native `WP_Customize_Control` with `type => 'checkbox'`, sanitize via a local `jlmwines_sanitize_checkbox` helper since core has no built-in one; number field sanitizes via `absint`).
- `inc/exit-intent-popup.php` — reads all five mods. Offer/WhatsApp/email blocks each wrap in an `if` on their toggle. Early-`return` (render nothing) if all three are off. `is_user_logged_in()` guard becomes conditional on the exclude-logged-in toggle. Mobile delay is passed to JS via a `data-mobile-delay-ms` attribute on `#offer-popup` (no separate AJAX/localize needed — one hidden div already carries all the render-time state).
- `assets/js/main.js` — reads `MOBILE_DELAY_MS` from the popup element's `data-mobile-delay-ms` attribute instead of the hardcoded `4000`, falling back to 4000 if the attribute is missing/invalid.

## Status

**Live 2026-08-25** — deployed via `deploy-theme.ps1` (4 files: `inc/customize.php`, `inc/exit-intent-popup.php`, `assets/js/main.js`, `style.css`). Not yet smoke-tested in the Customizer or on the live popup — worth a check: Appearance → Customize → Popup Controls shows the 5 fields, and toggling one actually changes the live popup.
