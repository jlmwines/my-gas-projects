# Meta Ads Plan — Jerusalem Test Campaign (Bulk Edit Workflow)

**Purpose.** Test paid Facebook/Instagram advertising in Jerusalem, run by your partner directly in Meta Ads Manager. No custom API/MCP integration exists or is planned (see decision below) — this doc is the process guide for using Ads Manager's built-in **Bulk Edit** spreadsheet tool (download → edit → upload) to control and iterate the test over time.

**Status.** Not started. No campaign built yet, no ad account access confirmed, Meta Pixel not found on jlmwines.com (checked 2026-07-29 — no `fbq(`/pixel script in `website/`).

**Decision (2026-07-29).** No Meta Ads MCP connector exists in the registry (checked — only read-only analytics connectors like Windsor.ai/Supermetrics are available, and they don't do campaign management). A custom MCP against Meta's Marketing API is technically possible but requires app registration, tokens, and hosted code — not worth it for a first test. Ads Manager's native Bulk Edit spreadsheet is the right tool: no dev work, and it's exactly the "upload/download control over time" mechanism needed.

---

## Creative Strategy

**Testing approach — two phases, cheapest-first.**

- **Phase 1 (smoke test).** Default test unit is a **short video stitched from stills with Canva transitions** (slide/fade/wipe) — not filming, not full animation, just stills + a transition. Revised 2026-07-29: plain static images work fine for concepts that don't need a reveal (e.g. the proof/aftermath bucket), but carousels were ruled out — swipe-through engagement on cold feed traffic is unreliable, so any concept that relied on a carousel "swipe reveal" (e.g. the app-bucket scanner→JLM reveal) gets restaged as a stills-with-transitions video instead. **No text baked into the visuals** either way — headline/primary text lives in Meta's ad-copy fields, so the same asset can be paired with several copy variants without new Canva work. Run several hooks in one ad set on a small daily budget (~₪20–50/day) for a few days; let Meta's delivery data (CTR, cost-per-click, cost-per-result) show which hook wins before spending more effort on it.
- **Phase 2 (scale the winner).** Once a hook proves out, invest the heavier production (full animation, Evyatar's advisor entrance, full Reel sequences) only on that validated concept. Keeps expensive production limited to what's already proven — this is what serves the "lowest cost long-term" goal, not skipping testing to go straight to polished video.

**Visual format.** Subject/scenario large (fills the frame — this is the scroll-stopping hook), Evyatar as a small constant inset rather than the hero. Produce **one** Evyatar cutout/inset asset once, reuse it across every scenario's stills — only the scenario art changes per variant. Mirrors the flyer's "large hero + small resolution inset" logic, with the roles flipped to suit a cold-scroll hook instead of an already-warm local audience.

**Advisor character — Evyatar, decided.** Evyatar plays the recurring "I know a guy" advisor across scenes. Stronger than an anonymous actor since he's already the brand's face (see `FLYER_PLAN.md` — "it's Evyatar's palate," not "we sell wine"). For Phase 1, use a still photo (cutout, transparent background) animated into frame with Canva's built-in Pan/Fade/Rise effects — no video shoot needed. A fully stylized/illustrated version is an option if a photo reads too literal next to the more graphic scenario art, but needs a consistent look nailed down first.

### Creative buckets (candidate Phase 1 hooks)

**1. Gambling / luck.** Umbrella line: *"Wine shouldn't be a gamble."* Casino-game scenarios, each its own image/scene: slot machine (bottles as reels, mid-pull, "lose"), roulette, poker, blackjack, craps, scratch ticket. Advisor line format: *"Don't [game action]. I know a guy."* — e.g. *"Don't pull that handle. I know a guy."* Other standalone lines from this bucket: *"Shopping for wine is not the time to gamble,"* *"Would you buy wine in a casino?,"* *"Buying wine shouldn't feel like a slot machine."*

**2. Confusion / jargon.** Ties directly to the anti-snob/no-jargon brand voice. Concepts: shelf with a huge dictionary (staged desk+lamp+dictionary in the aisle, or — cheaper and funnier — a shopping trolley rigged into a book stand); blindfolded in the supermarket; telling the pharmacist "I'll have what the last customer bought" (blind-trust gag).

**3. Proof / aftermath.** Quiet, evidence-based, no actors needed — cheapest bucket to actually produce (still-life shots only). Apt 4 (half-full bottles, morning-after leftovers nobody finished) vs. Apt 7 (JLM box, all empties) comparison. Dinner table where only the JLM glasses/bottles are empty — makes "no wasted money" literal instead of stated.

**4. App / gadget wish-fulfillment.** Twist: "you already have one." Started as a sci-fi ray gun (scans wine, flags bad bottles), refined to a phone-scanner-app framing since that's a real, relatable behavior (Vivino-style apps already exist) rather than sci-fi. Visual template: person mid-gesture about to scan/translate a label with their phone → reveal it's just the JLM site (a stills-with-transitions video, not a carousel — see testing-approach note above). Stacked/combined line: *"Click to enable your phone to detect wines you'll enjoy, match the occasion, and make them appear at your door."* Splits into individually testable single-benefit hooks:

- **Selection** — *"An app that narrows down hundreds of bottles to the one you'll actually like? You already have one."*
- **Transporting** — *"An app that gets your wine from the shelf to your door without you carrying a thing? You already have one."*
- **Pairing to food/context** — *"An app that knows exactly what goes with tonight's dinner? You already have one."*
- **Finding special value** — *"An app that finds the bottle that punches above its price, before everyone else does? You already have one."*
- **Finding wines to try** — *"An app that suggests something new you wouldn't have picked yourself — and gets it right? You already have one."*
- **Cutting shelf noise (promote/demote/accept)** — *"An app that turns a wall of a hundred bottles into a short list — you promote, demote, accept? You already have one."* Richest of the set: the promote/demote/accept motion maps onto an actual swipe/decision interaction, so it's staged as a stills-with-transitions video showing cards being sorted, not a literal tappable carousel.

**Note:** buckets 1–4 are different tonal registers (luck / confusion / proof / sci-fi-gadget) — keep them as separate hook candidates rather than mixing metaphors within one ad, so each stays legible on its own.

---

## Prerequisites (confirm all before Step 1)

1. **Business Manager access** — partner has admin/advertiser access to the JLM Wines Facebook Page and an ad account under it (or can create one).
2. **Payment method** attached to the ad account.
3. **Meta Pixel — currently NOT installed.** Grepped `website/` for `fbq(`, pixel script tags, `connect.facebook.net` — no matches. Without it, Meta can't see on-site purchases, so ad-level "it converted" signals won't exist and campaign auto-optimization (which relies on the Pixel) won't have data to learn from.
   - **Decision needed:** install the Pixel (website/theme change, one-time) before running paid traffic, or accept UTM-only attribution (see below) for this first round and treat it as a click/traffic test rather than a conversion-optimized one. Recommend installing it — cheap, one-time, and every future round benefits.
4. **Landing page + offer decided.** The flyer plan (`FLYER_PLAN.md`) uses the bundles category page + `50NEW` first-order coupon. Reuse that pattern unless there's a reason for a Meta-specific offer — keeps the message consistent across channels and the offer plumbing already exists.

---

## Step-by-step: Bulk Edit workflow

Bulk Edit iterates on an *existing* campaign structure — it's not for building from a blank sheet. First round is built by hand in the UI; every round after is spreadsheet-driven.

1. **Build the base structure manually, once**, in Ads Manager UI: one campaign, one ad set (audience, budget, placements), one ad (creative, copy, destination URL with UTM parameters — see Attribution below).
   → **CONFIRM before continuing:** campaign name, objective, and initial budget reported back and agreed.
2. Select the campaign in Ads Manager → **⋯ menu → Bulk Edit** (sometimes labeled Bulk Create/Edit) → **Export/Download** as `.xlsx`.
3. **Before editing anything, save an untouched copy** of the downloaded file with a timestamp in the name (e.g. `meta-ads-round1-backup-260729.xlsx`). This is the rollback point if an upload goes wrong.
4. Edit the working copy. **Change only one variable per round** — audience OR budget OR creative, not several at once. Same discipline as the flyer plan's neighborhood rotation: mixing changes makes results unreadable.
5. Re-upload the edited sheet via the same **Bulk Edit → Upload/Import** path.
   → **CONFIRM before publishing:** Ads Manager shows a review/diff screen after upload — read it and confirm the changes shown match intent *before* clicking Publish/Apply. This is the checkpoint that catches a bad edit before it goes live.
6. Let the round run a **minimum set duration** (agree the number of days before launching — don't judge or edit mid-flight; Meta's delivery needs a stabilization window and early numbers are noisy).
7. At the end of the round, export fresh performance data (same Bulk Edit export, or Ads Manager's reporting export) and log results before starting the next round's edit.

---

## Attribution (no Pixel yet)

Until the Pixel is installed, rely on the same mechanism the flyer plan uses: **UTM parameters + order data**, not on-platform conversion tracking.

- Every ad's destination URL carries UTM parameters (e.g. `utm_source=facebook&utm_medium=paid&utm_campaign=jerusalem-round1`) unique enough to distinguish rounds/variants.
- Cross-reference order source/referrer data (or the same coupon-code approach as the flyer, if the offer uses one) against the campaign's spend and reach numbers to read results manually, round over round.
- Once the Pixel is installed, this manual step becomes a cross-check rather than the only signal.

---

## Confirmation checklist (repeat every round)

- [ ] Base/prior campaign structure confirmed correct before export
- [ ] Backup copy of the exported sheet saved before editing
- [ ] Only one variable changed this round
- [ ] Upload diff reviewed and confirmed before publishing
- [ ] Minimum run duration agreed and respected before judging results
- [ ] Results exported and logged at round end

---

## Open items

1. Confirm partner's Business Manager / ad account access (or create one).
2. Decide: install Meta Pixel before Round 1, or start UTM-only.
3. Round 1 specifics — budget, audience definition, offer, minimum run duration. (Flyer plan's local-first framing — warm/nearby audience before cold/wide — is a reasonable starting logic to borrow, but Meta's audience targeting works differently, so this needs its own pass, not a copy-paste.)
4. Whether Round 1 reuses the `50NEW` coupon or gets its own code (own code would sharpen attribution once volume is real).
5. Pick which 3–4 hooks (from the four creative buckets above, including the app-bucket's individual benefit variants) go into the first Phase 1 test set.
6. Produce the one reusable Evyatar inset asset (photo/cutout), then the scenario stills for the chosen hooks.

## Out of scope (for now)

- Custom Meta Marketing API integration / MCP server — ruled out above, revisit only if manual Bulk Edit proves too limiting after real test rounds.
- Automated bid/budget optimization tooling — first test is about learning the channel, not building infrastructure.
