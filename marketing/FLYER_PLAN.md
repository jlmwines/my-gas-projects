# Flyer Plan — Printed Mailbox Insert

**Purpose.** Two-sided printed flyer (EN / HE) distributed via mailbox insertion in selected Jerusalem neighborhoods. Acquisition channel: drive new (first-order) customers to jlmwines.com using the existing ₪50-off-first-order coupon as the incentive.

**Status.** EN design complete 2026-06-24 — file in `marketing/flyer/flyer-50new-26-06-24-16-19.jpg`. Hebrew copy sent for translation review; expected back by ~2026-07-01. Coupon code: `50NEW`. QR links to bundles category (UTM-tagged). Vendor quote received 2026-06-21. Print run pending HE copy approval.

**Strategic frame.** Acquisition test, not a proven channel. ₪2,000/round is right-scaled as a test, not a campaign. Round 1 produces the data that decides whether the channel scales. Round 1 targets the local area first: new-customer acquisition is the goal, in a warm, well-matched, Evyatar-aware audience, with some offline-only regulars converting online as a secondary benefit; colder, further-out neighborhoods come in Round 2+. Going in with that expectation makes a "this didn't work" outcome a useful result, not a sunk cost.

---

## Targeting

**Principle (revised 2026-05-31, local-first; supersedes the original "beyond walking distance" frame).** Start with the roughly 2km radius around the Katamon shop, then expand outward in later rounds.

**Why local-first.** The original plan assumed nearby people already know the shop and can just walk in, so flyers should chase colder prospects further out. That undervalued the local area. It is a strong acquisition target in its own right (high-income, high-English, right age bracket, already aware of Evyatar and the shop), and that awareness helps rather than hurts conversion. So the goal stays acquisition, just local-first: the primary target is NEW customers nearby, where a warm, well-matched audience should convert better than a cold drop further out. A secondary benefit comes along for free, since some loyal customers who only ever buy offline (shop delivery, by age or order size) get nudged into their first online order off the same flyer. Local-first also validates the online funnel on a warm audience before money goes to colder, further-out drops.

**One EN + one HE demographic neighborhood per round** still applies to the outward rounds. Round 1's local radius is English-leaning, so the English side does most of the work; the Hebrew side covers the mixed local population.

### Round 1 (local acquisition, roughly 2km around the shop)

Target the mailboxes within about 2km of the Katamon store: Katamon / Old Katamon and the close-in surrounds the radius reaches (Gonen / San Simon, Baka, German Colony, the Talbiyeh / Rehavia edge). High-income, high-English, right age bracket, already aware of Evyatar and the shop. The distribution vendor can map mailbox routes to the radius.

- **Primary target: new customers in the local area.** The warm, well-matched, Evyatar-aware audience should convert better than a cold drop further out.
- **Secondary benefit: nudging offline-only locals online.** Some loyal customers who only buy via shop delivery (by age or order size) place their first online order off the same flyer.
- **English side does the primary work** (the radius skews Anglo and the audience is English-leaning); the **Hebrew side** stays present for the mixed local population.

The existing ₪50-off-first-order coupon fits both: a genuinely new customer and an offline-only regular placing a first Woo order both count as a first order.

### Round 2+ strategy

**Round 2+ expands outward to the beyond-walking-distance, cold-acquisition neighborhoods the original plan favored** (French Hill EN, Beit HaKerem HE, and the wider pool below). That logic was sound for cold acquisition; it just belongs after the warm local round, not before it.

**Rotate to fresh neighborhoods, do not re-drop round 1.** Reasons:
- Single-neighborhood saturation is real; same flyer twice = diminishing returns.
- ₪2,000/round is too small to do significance-testing on a single neighborhood, so re-running for "validation" doesn't actually validate.
- Sampling more areas builds a coarse map of *where this channel works at all*, which is more useful than re-confirming one point.
- A round-1 winner can return *later* with a different angle (seasonal, holiday tie-in) — but not as round 2.

Candidate alternates (outward / cold): French Hill (EN), Beit HaKerem (HE), Arnona (EN-rising), Kiryat HaYovel (HE, younger demo), Ein Kerem, Nayot. The existing 8-neighborhood list from `.claude/wishlist.md` (2026-02-09) is the candidate pool. (Talbiyeh now falls partly inside the Round 1 radius, so it drops from the outward list.)

---

## Message + Design

**Lead with Evyatar.** The brand's whole thesis is "Evyatar's palate," not "we sell wine." Flyer should look like a friendly local-business note, not a wine ad with vineyard imagery.

### Visual

- **Single image:** large photo of Evyatar tasting wine (in the shop, natural scene). Small inset showing the "happy outcome" — customer enjoying wine with food. The inset reads as the result, not as a competing visual.
- **No two co-equal images.** Two images compete with the headline.

### Discount treatment

- ₪50 off first order = the offer.
- **Stylized green/banknote-typography ₪50 treatment, NOT a literal banknote reproduction.** Bank of Israel restricts commercial reproduction of currency imagery (typically requires permission, size/color modifications, or SPECIMEN marking). Stylized version sidesteps the legal exposure AND avoids the discount-voucher feel.
- ₪50 should be the second-loudest element on the page after Evyatar.

### Style

- Friendly, anti-snob — match brand voice.
- Brand colors and typography from the website, but with **more print contrast** than a screen design. Flyer competes with takeout menus and political flyers in a mailbox; faithful color match without graphic punch will disappear. Lean on Evyatar's photo for the contrast hit.
- Two-sided EN/HE — same essential message, native phrasing for each (don't transliterate, don't translate literally).

### Required elements per side

1. Evyatar photo (with inset)
2. One sentence of brand framing (e.g., "Wine you'll like, picked by us, delivered to you.")
3. ₪50 off first order — stylized treatment
4. Coupon code in plain readable text
5. QR code → bundles category landing
6. Brief contact (web URL, phone or store address as anchor)

---

## Offer + Attribution

- **Coupon:** ₪50 off first order (existing coupon plumbing, first-order-restricted at code level).
- **Code:** `50NEW` — single code across all flyers. One print version = lower cost. Round-by-round code rotation not needed; billing-address attribution carries the per-neighborhood signal.
- **Attribution mechanism:** every redemption order has a billing address. Israeli 7-digit postal codes (assigned 2013+) map fairly cleanly to neighborhoods. Post-flyer analysis groups redemptions by postal code → reads which area drove what.
- **Timing:** stagger drops between rounds (2–3 weeks minimum) so coupon redemptions cluster in time and round-level effectiveness is readable. Within a round, simultaneous drops are fine — billing addresses do the per-neighborhood split.

---

## Distribution

- **Method:** mailbox insertion. Doorhanger annoys recipients. Mailbox is the standard method in Jerusalem for this kind of drop.
- **Size:** half-A4 (standard offering from local distribution vendors).
- **Vendor candidates:** `yoterplus.co.il`, `dilen.co.il` (surfaced 2026-02-09).
- **Budget:** ~₪2,000/round (test scale; was originally speculation, vendor quotes will refine).
- **Volume per neighborhood:** roughly 2,000–3,000 units depending on actual print + distribution rates (~₪0.30–0.50/unit). Vendor quotes confirm.

---

## QR Landing — Bundles Category Page

**Target:** the EN + HE bundles category page. Bundles are the bestseller and the natural flyer-to-purchase path. The flyer does the narrative work (Evyatar lead, story, offer); the QR is the "shop now" button. Continuity is honest because Evyatar IS the bundle curator — the bundles ARE his picks.

**Polish before printing:**

1. Add a short intro paragraph (1–2 sentences, EN + HE) to the bundles category description — "Evyatar's hand-picked boxes" framing. Closes the flyer→landing loop. WC category description supports this; existing categories already use it.
2. **Pre-print mobile rendering check** (5 minutes): scan a draft QR with a phone, confirm both EN and HE bundles category pages load fast, layout is clean, images render. Cheap insurance.

**Skip auto-apply.** URL coupon auto-apply in Woo is brittle and config-dependent. Print the code prominently on the flyer; customer types it at checkout. Always works, and the printed code stays useful even when the QR fails.

---

## Effectiveness Expectations

Industry-typical benchmarks (no JLM- or Israel-specific data; hold loosely):

**Round 1 is warm, not cold.** The benchmarks below describe cold drops, so treat them as a floor and as the expectation for the outward Round 2+ neighborhoods. A warm, Evyatar-aware local audience should redeem above the cold rate, so raise the Round 1 decision-trigger bar once vendor volumes are known.

- **Cold mailbox flyer redemption:** ~0.3–1% for lifestyle/F&B with a strong offer. Lower in saturated markets (Jerusalem mailboxes are busy).
- **At ~2,500 flyers per neighborhood (≈ half a ₪2,000 round split):** expect 7–25 first-time customers per neighborhood per round. So 14–50 across both.
- **First-to-repeat conversion in wine/beverage:** ~25–35% rough estimate. → 4–17 actual repeat customers per round.

LTV math: if a repeat customer's first-year revenue lands at ₪1,500–₪3,000, even ~5 repeat customers from a round covers the print + coupon-redemption cost. Could be net-positive or a wash; depends on round 1 actual numbers.

**Decision triggers:**

- < 5 first orders/round → rethink design or targeting before scaling.
- 5–15 first orders/round → channel works, iterate on neighborhoods.
- 15+ first orders/round → strong signal, consider ramping budget.

---

## Open items / Next steps

(Roughly in order. None scheduled.)

1. **Vendor outreach** — quote yoterplus.co.il + dilen.co.il for half-A4, two-sided, mailbox-insertion in target neighborhoods. Confirm price/unit, drop volumes possible at ₪2,000, lead time, design file specs.
2. **Designer engagement** — decide in-house vs. external. The Evyatar photo + inset + ₪50 treatment isn't a 30-min job; it's a real design ask.
3. **Photo asset** — confirm the Evyatar shop photo + customer-with-wine inset images are available, or whether new shoots are needed.
4. **Coupon code creation** — issue `JLMFLYER50` (or chosen name) in WooCommerce, first-order-restricted, expiry-bounded for the test window.
5. **Bundles category description copy** — write 1–2 sentences in EN + HE, install via WC category description.
6. **Round 1 timing** — pick a drop date that makes sense relative to current inventory state (avoid the magnums-phase-out window; align with category fill-in completion).
7. **Round 2 neighborhood pre-selection** — defer until round 1 redemption data is in. Round 2 is the first outward / cold drop (French Hill, Beit HaKerem, wider pool).

---

## Out of scope (deferred)

- **Per-neighborhood coupon codes** — single code is the decision. If at some point fine-grained per-area attribution becomes valuable AND billing-address attribution proves insufficient, revisit.
- **A/B creative testing across neighborhoods** — single flyer creative for the whole test. Variant testing is round 3+ if the channel proves out.
- **Shop-walk-in attribution** — flyer drives online orders only. If walk-ins from flyer become measurable (people mention it at the counter), great, but not engineered for.
