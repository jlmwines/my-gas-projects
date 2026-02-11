# Exit Intent Popup & WhatsApp Icon Plan

## Overview

Two features to capture leaving visitors and encourage direct contact:
1. **Exit Intent Popup** - Triggers when cursor leaves viewport
2. **Floating WhatsApp Icon** - Persistent contact button

---

## Exit Intent Popup

### Purpose
Single CTA - WhatsApp contact to save the order/gain the customer

### Content
- **Photo:** Evyatar in his shop
- **Message:** Minimal, bilingual or language-specific
- **CTA:** WhatsApp button with pre-filled message

### Display Rules

| Rule | Value |
|------|-------|
| Trigger | Exit intent (cursor leaves viewport) |
| Reshow after dismiss | 7 days |
| Exclude | Logged-in users |
| Exclude | Post-purchase (thank-you/order-received pages) |
| Implementation | Single Elementor popup for both EN/HE (prevents double-show) |

### Pre-filled WhatsApp Message
- **Hebrew:** `היי אביתר,`
- **English:** `Hi Evyatar,`

The comma invites user to continue typing their question naturally.

---

## Floating WhatsApp Icon

### Behavior

| Setting | Value |
|---------|-------|
| Position | Bottom-right (standard) |
| Delay | 7 seconds after page load |
| Color | Standard WhatsApp green |
| Persistence | Visible across all pages |
| Mobile | Ensure <20% screen height (Google compliance) |

### Pre-filled Message
Same as popup: `היי אביתר,` / `Hi Evyatar,`

---

## Implementation Notes

### Elementor Popup Settings
- Use display conditions to exclude logged-in users
- Exclude thank-you and order-received pages
- Set cookie duration to 7 days after close
- Single popup works for both languages (photo + WhatsApp icon is universal)

### WhatsApp Link Format
```
https://wa.me/972XXXXXXXXX?text=היי%20אביתר,
https://wa.me/972XXXXXXXXX?text=Hi%20Evyatar,
```

### Bilingual Popup Option
If using single popup for both languages, minimal text works:
- Photo of Evyatar
- WhatsApp icon/button
- Optional: `שאלות? בואו נדבר / Questions? Let's talk`

---

## Design Principles

1. **Personal, not corporate** - Evyatar's photo humanizes the brand
2. **One goal only** - WhatsApp contact, no email signup, no discount
3. **Low friction** - Pre-filled greeting, user adds their question
4. **Respectful** - 7-day reshow, excludes customers and logged-in users

---

## Best Practices Applied

- Exit popups can recover 10-15% of abandoning visitors
- 7 days reshow frequency is industry standard
- Pre-filled messages reduce friction and increase conversion
- Personal photo increases trust and differentiates from generic popups
- Single CTA outperforms multiple options

---

## References

- [Wisepops - Popup Best Practices](https://wisepops.com/blog/popup-best-practice)
- [OptiMonk - Popup Timing](https://www.optimonk.com/popup-timing/)
- [OptinMonster - Exit Popup Strategies](https://optinmonster.com/40-exit-popup-hacks-that-will-grow-your-subscribers-and-revenue/)
- [Click to Chat - Pre-Filled Messages](https://holithemes.com/plugins/click-to-chat/pre-filled-message/)
