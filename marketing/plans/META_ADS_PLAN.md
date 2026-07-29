# Meta Ads Plan — Jerusalem Test Campaign (Bulk Edit Workflow)

**Purpose.** Test paid Facebook/Instagram advertising in Jerusalem, run by your partner directly in Meta Ads Manager. No custom API/MCP integration exists or is planned (see decision below) — this doc is the process guide for using Ads Manager's built-in **Bulk Edit** spreadsheet tool (download → edit → upload) to control and iterate the test over time.

**Status.** Not started. No campaign built yet, no ad account access confirmed, Meta Pixel not found on jlmwines.com (checked 2026-07-29 — no `fbq(`/pixel script in `website/`).

**Decision (2026-07-29).** No Meta Ads MCP connector exists in the registry (checked — only read-only analytics connectors like Windsor.ai/Supermetrics are available, and they don't do campaign management). A custom MCP against Meta's Marketing API is technically possible but requires app registration, tokens, and hosted code — not worth it for a first test. Ads Manager's native Bulk Edit spreadsheet is the right tool: no dev work, and it's exactly the "upload/download control over time" mechanism needed.

---

## Creative Strategy

**Testing approach — champion/challenger, cheapest-first.**

- **Method (revised 2026-07-29).** Not a multi-cell simultaneous test — a small daily budget spread across many variants at once doesn't generate a readable signal per variant. Instead: **champion/challenger**, two hooks at a time. Current champion runs against one fresh challenger from the library each round; winner stays up, loser gets replaced by the next untested concept. Each round = one pairing in the existing Bulk Edit round structure (see Step-by-step below). Slow by design — the point is a clean read each round, not maximum coverage per round.
- **Phase 1 unit.** Default is a **short video stitched from stills with Canva transitions** (slide/fade/wipe) — not filming, not full animation. Plain static images are fine for concepts that don't need a reveal (proof/aftermath, unboxing). Carousels are ruled out — swipe-through engagement on cold feed traffic is unreliable, so any "reveal" concept is staged as stills-with-transitions instead of a tappable carousel. **No text baked into the visuals** — headline/primary text lives in Meta's ad-copy fields, so one asset can pair with several copy variants without new Canva work.
- **Phase 2 (scale the winner).** Once a hook wins enough rounds to be trusted, invest heavier production (full animation, Evyatar's advisor entrance, full Reel sequences) only on that concept.

**Budget & schedule (researched 2026-07-29).** Israel-wide Meta CPM averaged **$8.38** in 2025 (range $4.85–$14.90 depending on season; source: superads.ai Israel benchmark). A Jerusalem-only geo-test likely sits at or a little below that range. Starting budget: **₪30–60/day** for the ad set — same order of magnitude as the flyer's ₪2,000/round test scale. **No ads Friday afternoon through Saturday night** (Shabbat) — extending the pause through Sunday noon is also reasonable (Sunday is the start of the Israeli work week, not a lazy weekend morning). Two independent reasons behind the Friday pause, not just observance: delivery can't happen same-night regardless, and Friday-night planning genuinely starts Wednesday/Thursday in Israel, so that's when intent (and the ad) should show up. **Dayparting should also track staffing, not just browsing hours** — if responsiveness to on-site questions is a real differentiator, ads should run when someone's actually available to answer, so a visitor's question doesn't hit a quiet site.

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

**5. Occasion.** Maps directly to "Context" — one of the documented core content topics in `business/CONTENT_STRATEGY.md` (weather, guests, occasion → confidence in choosing). Same "sorted" closer across each: *"Friends just showed up? Wine's already sorted."* / *"Invited to dinner? Bring the bottle, not the anxiety — it's sorted."* / *"Something worth celebrating? Wine's already sorted."* / *"Just a quiet night in? Still sorted."* / *"Game night, wine sorted too."* / *"Friday night wine, sorted"* — this last one needs Wednesday/Thursday lead-time framing, not same-day (see Budget & schedule above). Cheapest bucket to test in volume since occasion-lines can likely share one visual template, swapping only the text field. **Montage format:** rapid-fire split-screen cycling through all the occasions on one side, a calm phone-tap-to-bundle on the other — works as a standalone "hero" piece demonstrating breadth, separate from testing individual occasion lines.

**6. Buy-ahead / stop the gamble permanently.** Sharper reframe of the gambling bucket (2026-07-29): the real problem isn't a single bad bottle, it's that buying reactively (last-minute, wherever's nearby) means gambling *every time*, so bad outcomes stack up. The fix isn't speed/convenience, it's deciding once, in advance, and never having to gamble again — buy a 9–10 bottle bundle (free-delivery threshold) before any specific occasion exists in mind, and every occasion after is already covered. **Don't state the economics — show it.** Audience is assumed sophisticated enough to infer that a ₪400 bundle means more wine bought at once than a reactive purchase would be; no need to explain. Best execution found so far: **split-screen, no narration, no text at all** — real bundle-unboxing footage on one side (bottles coming out of the box, rack getting stocked), the various occasions playing out successfully on the other (nobody scrambling, because there's nothing to scramble for). Ties `CONTENT_STRATEGY.md`'s own principle — contrast should be "felt, not stated" — about as literally as an ad can. Candidate lines if any text is used at all: *"Buy it before you need it, and you'll never have to gamble when you do,"* *"Stock up once. Stop gambling every single time you need a bottle."*

**7. Proof of curation.** New bucket, distinct from bucket 3 (which shows customer outcomes) — this one shows JLM's own process. A case of bottles, most crossed out/rejected, one survives and ships. No joke, no metaphor, no advisor — just the actual curation the brand claims (`CONTENT_STRATEGY.md`: "We taste everything. We reject what doesn't meet the bar"), made visible. Lowest risk of misfire in the library since it isn't inventing a claim, just showing one already made. Could also draw on the documented "10 AM tasting ritual" as a few seconds of real, undressed documentary footage.

**Note:** buckets are different tonal registers (luck / confusion / proof / sci-fi-gadget / occasion / buy-ahead / curation) — keep them as separate hook candidates rather than mixing metaphors within one ad, so each stays legible on its own. This is a library to draw from over many rounds, not a shortlist to test all at once.

---

## Format & Angle Library

Ideas that aren't tied to one specific bucket — reusable across whichever hooks get tested.

**Copy angles (pull from documented brand content, not invented):**
- *"You'll know by the second sip. We already did."* — from the brand's own "second sip rule" content topic.
- *"We reject the wine so you don't have to."* — near-verbatim from `CONTENT_STRATEGY.md`.
- *"Stop paying to find out."*

**Video formats (not yet assigned to a specific bucket):**
- **Split-screen, same night** — one side mid-gamble/scramble, other side calm and already covered (general version of the bucket-6 execution above; could restage with any bucket's "problem" side).
- **POV shelf-scan** — camera as the viewer's own eyes, quick disorienting cuts across labels, hard cut to calm. Native-feeling first-person format for Reels.
- **UGC-style unboxing** — shot to look like a real customer's own phone recording, deliberately unpolished; native-feeling ads often outperform produced ones on Meta. A production-style choice, could apply to any bucket's message, not just bucket 6/7.

**Targeting/local angles:**
- **Neighborhood-name personalization** — *"Katamon, meet your new wine guy"* — digital version of the flyer's local-first logic; copy-only via Meta's geo-targeting, same image, near-free to test.
- **Social proof, local numbers** — *"X Jerusalem households already stopped guessing."*

**Policy flag (media-buyer catch, unresolved):** casino/gambling imagery (bucket 1) may trip Meta's ad-review policies on gambling-related content even though the ad isn't promoting gambling. Needs a policy check before producing anything for that bucket specifically.

**Brand-voice flag (unresolved):** `CONTENT_STRATEGY.md` — customers "don't want to feel stupid or talked down to." Casino and dictionary buckets both risk reading as mocking the *viewer's* past choice rather than rescuing a friend from one. Needs the Evyatar-advisor delivery to land as warm, not corrective, or it cuts against brand.

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

## Team review (2026-07-29, pass over buckets 5–7 + library)

Five-lens pass (copywriter / video CD / media buyer / local Jerusalem read / brand-voice guardian), grounded in `business/CONTENT_STRATEGY.md` and `website/BRAND.md`.

- **Buckets 6 (buy-ahead/unboxing) and 7 (proof of curation) are the strongest on brand-fit** — both enact the doc's own principle that contrast should be "felt, not stated," need no invented metaphor, and carry no risk of reading as talking down to the customer (the "don't want to feel stupid" line in `CONTENT_STRATEGY.md`) since there's no joke to land.
- **Also the cheapest and lowest-risk to produce first** — real footage (unboxing, a case of bottles) rather than staged scenario art, and no localization risk (no pun/jargon-joke that might not translate to the Hebrew side).
- **Bucket 1 (gambling) still needs a Meta ad-policy check** before any production spend — casino/gambling imagery can trip Meta's review even when not promoting gambling.
- **Occasion bucket (5)** is the cheapest to test in *volume* (shared visual template, copy-only swaps) but is a breadth play, not a single strong hook — better suited to many quick low-cost rounds than an opening test.

## Round 1 — proposed first pairing (not yet decided)

Given the review above, a reasonable **champion vs. challenger** opening pair:

- **A — Buy-ahead unboxing split-screen (bucket 6).** Real bundle unboxing vs. occasions going well, no narration, no text.
- **B — Proof of curation (bucket 7).** Case of bottles, most rejected, one ships.

Both are cheap, safe, and high brand-fit, and the pairing itself tests something genuinely useful: does proof of *your* good outcome (A) resonate more than proof of *our* process (B)? Winner becomes the champion for round 2 against the next challenger from the library (occasion bucket or app bucket are reasonable next challengers).

**This is a proposal, not a lock** — flag if a different opening pair is preferred before anything gets built.

---

## Open items

1. Confirm partner's Business Manager / ad account access (or create one).
2. Decide: install Meta Pixel before Round 1, or start UTM-only.
3. Round 1 specifics — budget, audience definition, offer, minimum run duration. (Flyer plan's local-first framing — warm/nearby audience before cold/wide — is a reasonable starting logic to borrow, but Meta's audience targeting works differently, so this needs its own pass, not a copy-paste.)
4. Whether Round 1 reuses the `50NEW` coupon or gets its own code (own code would sharpen attribution once volume is real).
5. Confirm or revise the proposed Round 1 pairing (A vs. B above).
6. Produce the bucket-6/7 footage (unboxing, rejected-case) for whichever pairing is confirmed; Evyatar inset asset only needed once a bucket that uses the advisor character gets tested.
7. Meta ad-policy check on casino/gambling imagery before bucket 1 is ever produced.

## Out of scope (for now)

- Custom Meta Marketing API integration / MCP server — ruled out above, revisit only if manual Bulk Edit proves too limiting after real test rounds.
- Automated bid/budget optimization tooling — first test is about learning the channel, not building infrastructure.
