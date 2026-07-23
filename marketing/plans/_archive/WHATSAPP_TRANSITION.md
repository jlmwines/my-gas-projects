# WhatsApp Business Setup — JLM Wines Website

WhatsApp Business channel for jlmwines.com online shop.

**Scope:** Website customers only (includes foreign gift purchasers). Physical shop continues on personal WhatsApp (support only, no marketing).

**Status:** Account set up and confirmed

---

## Phase 1: Customer Segmentation Setup

### Labels — Aligned with jlmops Segments

| WhatsApp Label | jlmops Segment | Description |
|----------------|----------------|-------------|
| `Prospect` | prospects | Inquired but not purchased |
| `Core` | core | Regular customers |
| `VIP` | vip | High-value/repeat customers |
| `Gift` | gift | Foreign-based gift purchasers |
| `Hebrew` | language = he | Hebrew speaker |
| `English` | language = en | English speaker |
| `Opted-In` | whatsapp_optin = true | Consented to broadcasts |

- [ ] Create all labels in WhatsApp Business
- [ ] Document label definitions for consistent use
- [ ] Ensure labels match jlmops segment names exactly

---

## Phase 2: Language Detection via Unique Links

WhatsApp does not auto-detect language. Use unique links per language:

| Page Language | Link | Pre-filled Text |
|---------------|------|-----------------|
| Hebrew | `https://wa.me/972XXXXXXXXX?text=%D7%A9%D7%9C%D7%95%D7%9D` | שלום |
| English | `https://wa.me/972XXXXXXXXX?text=Hi` | Hi |

**Implementation:**
- [ ] Hebrew website pages use Hebrew link
- [ ] English website pages use English link
- [ ] Apply language label immediately on first contact
- [ ] Record language in jlmops contact sheet

---

## Phase 3: Automated Messages

### Greeting Message (New Conversations)
- [ ] Write Hebrew version
- [ ] Write English version
- [ ] Configure in WhatsApp Business

**Draft:**
```
שלום! 🍷 תודה שפנית ל-JLM Wines.
איך אפשר לעזור?

Hi! 🍷 Thanks for reaching out to JLM Wines.
How can we help?
```

### Away Message (Out of Hours)
- [ ] Write Hebrew version
- [ ] Write English version
- [ ] Set active hours

**Draft:**
```
תודה על ההודעה! 🍷
אנחנו לא זמינים כרגע, אבל נחזור אליך בהקדם.
שעות פעילות: א'-ה' 10:00-18:00

Thanks for your message! 🍷
We're currently away but will respond soon.
Hours: Sun-Thu 10:00-18:00
```

### Quick Replies
- [ ] Create quick replies for common questions:

| Shortcut | Topic |
|----------|-------|
| `/hours` | Business hours |
| `/delivery` | Delivery info |
| `/order` | How to order |
| `/returns` | Return policy |
| `/gift` | Gift options |

---

## Phase 4: Broadcast Lists Setup

- [ ] **Create broadcast lists** by segment:

| List | Recipients |
|------|------------|
| `Hebrew - Opted-In` | Hebrew speakers who consented |
| `English - Opted-In` | English speakers who consented |
| `VIP - Hebrew` | VIP Hebrew customers |
| `VIP - English` | VIP English customers |
| `Gift - English` | Gift purchasers (typically English) |

**Broadcast rules:**
- Recipients must have your number saved
- 256 contacts per list maximum
- Can't send to people who haven't messaged you first

**Broadcast footer (include in every message):**
```
להסרה: השב "הסר"
To unsubscribe: Reply "STOP"
```

---

## Phase 5: Website Integration

### WhatsApp Chat Button
- [ ] Add floating button to website
- [ ] Hebrew pages → Hebrew wa.me link
- [ ] English pages → English wa.me link

### Opt-in at Checkout

**Single consent approach:**
- [ ] Add checkbox: "Keep me updated on offers and new wines" (Hebrew/English)
- [ ] Store consent in jlmops (source of truth)
- [ ] jlmops syncs to WhatsApp, Mailchimp, future SMS

**Architecture:**
```
WooCommerce Checkout Opt-in
         │
         ▼
    jlmops CRM ← Single source of truth
         │
    ┌────┴────┬─────────┐
    ▼         ▼         ▼
Mailchimp  WhatsApp   SMS
 (email)   Business  (future)
```

- [ ] Implement WooCommerce opt-in field (plugin or custom)
- [ ] Connect checkout to jlmops contact sheet
- [ ] Privacy policy update — Add WhatsApp communication disclosure

---

## Phase 6: Opt-in/Opt-out Management

### Source of Truth: jlmops Contacts

| Field | Purpose |
|-------|---------|
| `whatsapp_number` | Phone number for WhatsApp |
| `whatsapp_language` | `he` / `en` |
| `whatsapp_optin` | `true` / `false` |
| `whatsapp_optin_date` | Timestamp |
| `whatsapp_optin_source` | `website_checkout`, `website_form`, `manual` |
| `whatsapp_optout_date` | If opted out |

### Opt-out Channels

| Method | Implementation |
|--------|----------------|
| **WhatsApp reply** | Reply "STOP" or "הסר" |
| **Website preference center** | Account page: manage preferences |
| **Email footer** | Unsubscribe updates jlmops |

- [ ] Monitor WhatsApp for STOP/הסר replies
- [ ] Process opt-outs within 24 hours
- [ ] Record opt-out in jlmops with timestamp
- [ ] Remove from broadcast lists

---

## Phase 7: Content & Templates

- [ ] **Welcome message for new opt-ins**
- [ ] **Order confirmation template**
- [ ] **Delivery notification template**
- [ ] **Promotional message templates** (Hebrew + English)
- [ ] **Holiday/seasonal templates**

---

## Phase 8: Testing & Launch

- [ ] **Test all automated messages** — Greeting, away, quick replies
- [ ] **Test language links** — Hebrew and English pre-filled messages
- [ ] **Test website integration** — Click-to-chat, opt-in flow
- [ ] **Test jlmops sync** — Opt-in recorded correctly
- [ ] **Soft launch** — Enable on website, monitor initial contacts
- [ ] **Full launch** — Announce WhatsApp channel to email list

---

## Ongoing Operations

- [ ] **Per contact:** Apply language + segment labels
- [ ] **Daily:** Check for STOP/הסר replies, process opt-outs
- [ ] **Weekly:** Review and label new contacts
- [ ] **Monthly:** Clean up broadcast lists, sync with jlmops
- [ ] **Per campaign:** Prepare bilingual broadcast content
- [ ] **Monitor:** Response times, opt-in rates

---

## Profile Setup Reference

| Element | Spec |
|---------|------|
| Profile image | Evyatar's face, 500x500px, 60-70% face fill |
| Background image | Shop interior or wine shelves, 1200x675px |
| About | Bilingual, under 139 characters |
| Description | Bilingual, under 512 characters |

---

## Channel Separation

| Channel | Use | Marketing |
|---------|-----|-----------|
| Personal WhatsApp | Physical shop support | None |
| WhatsApp Business | Website customers | Yes — broadcasts, promotions |
