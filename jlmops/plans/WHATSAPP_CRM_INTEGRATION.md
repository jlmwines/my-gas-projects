# jlmops CRM — WhatsApp Integration Spec

Add WhatsApp-related fields and functionality to the jlmops contact sheet.

**Related:** `marketing/WHATSAPP_TRANSITION.md`

---

## Contact Sheet Updates

### New Fields to Add

| Field | Type | Values | Purpose |
|-------|------|--------|---------|
| `whatsapp_number` | String | Phone with country code | WhatsApp contact number |
| `whatsapp_language` | Enum | `he`, `en` | Preferred language |
| `whatsapp_optin` | Boolean | `true`, `false` | Consent to receive broadcasts |
| `whatsapp_optin_date` | Date | ISO timestamp | When consent was given |
| `whatsapp_optin_source` | Enum | See below | How consent was obtained |
| `whatsapp_optout_date` | Date | ISO timestamp | When opted out (if applicable) |

### Opt-in Source Values

| Value | Description |
|-------|-------------|
| `website_checkout` | Checkbox at WooCommerce checkout |
| `website_form` | Standalone signup form |
| `whatsapp_conversation` | Consented via WhatsApp chat |
| `manual` | Manually added by staff |

---

## Integration Points

### 1. WooCommerce → jlmops

**Trigger:** Customer checks "Keep me updated" at checkout

**Data flow:**
```
WooCommerce checkout
    │
    ├─ Customer email
    ├─ Customer phone (whatsapp_number)
    ├─ Opt-in checkbox value (whatsapp_optin)
    ├─ Page language (whatsapp_language)
    └─ Timestamp (whatsapp_optin_date)
    │
    ▼
jlmops contact sheet (upsert by email)
```

**Implementation options:**
- WooCommerce webhook → Apps Script web app
- Direct API call from checkout
- Scheduled sync from WooCommerce orders

---

### 2. jlmops → WhatsApp Labels

**Sync contact segments to WhatsApp Business labels:**

| jlmops Field | WhatsApp Label |
|--------------|----------------|
| `segment = prospect` | `Prospect` |
| `segment = core` | `Core` |
| `segment = vip` | `VIP` |
| `segment = gift` | `Gift` |
| `whatsapp_language = he` | `Hebrew` |
| `whatsapp_language = en` | `English` |
| `whatsapp_optin = true` | `Opted-In` |

**Note:** WhatsApp Business labels are manual. This sync is a reference for staff applying labels, not automated.

---

### 3. Opt-out Processing

**Trigger:** Customer replies "STOP" or "הסר" in WhatsApp

**Manual process:**
1. Staff sees STOP message in WhatsApp Business
2. Staff updates jlmops contact: `whatsapp_optin = false`, `whatsapp_optout_date = now`
3. Staff removes contact from WhatsApp broadcast lists

**Future automation:** Could build a monitoring system, but manual is fine for current volume.

---

## Existing Fields — Alignment Check

Ensure these existing fields support WhatsApp integration:

| Existing Field | Use for WhatsApp |
|----------------|------------------|
| `email` | Primary identifier for upsert |
| `phone` | Fallback if `whatsapp_number` not set |
| `segment` | Maps to WhatsApp labels |
| `language` | Can default `whatsapp_language` if not set |

---

## Reporting / Views

### New Views to Create

| View | Purpose |
|------|---------|
| WhatsApp Opted-In (Hebrew) | List for Hebrew broadcast sync |
| WhatsApp Opted-In (English) | List for English broadcast sync |
| WhatsApp Opt-outs | Audit trail of opt-outs |

---

## Implementation Tasks

### Phase 1: Schema
- [ ] Add `whatsapp_number` column to contact sheet
- [ ] Add `whatsapp_language` column
- [ ] Add `whatsapp_optin` column
- [ ] Add `whatsapp_optin_date` column
- [ ] Add `whatsapp_optin_source` column
- [ ] Add `whatsapp_optout_date` column

### Phase 2: Data Entry
- [ ] Update manual contact entry process to include WhatsApp fields
- [ ] Backfill existing contacts with WhatsApp numbers where known
- [ ] Set default language based on existing `language` field

### Phase 3: WooCommerce Integration
- [ ] Add opt-in checkbox to WooCommerce checkout
- [ ] Capture page language at checkout
- [ ] Send opt-in data to jlmops on order completion
- [ ] Test end-to-end flow

### Phase 4: Views & Reports
- [ ] Create WhatsApp opted-in views
- [ ] Create opt-out audit view
- [ ] Document process for syncing views to WhatsApp broadcast lists

---

## Privacy & Compliance

- [ ] Update privacy policy to include WhatsApp communication
- [ ] Ensure opt-in checkbox is unchecked by default
- [ ] Store consent timestamp for audit purposes
- [ ] Respect opt-outs within 24 hours
