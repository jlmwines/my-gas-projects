# Meta Ads Plan — Jerusalem Test Campaign (Bulk Edit Workflow)

**Purpose.** Explore paid Facebook/Instagram advertising in Jerusalem, to be run by your partner directly in Meta Ads Manager if pursued. No custom API/MCP integration exists (see tooling note below) — this doc is a working guide for using Ads Manager's built-in **Bulk Edit** spreadsheet tool (download → edit → upload) to control and iterate a test over time, alongside a library of candidate creative ideas. Nothing here is a locked plan.

**Goal (2026-07-30).** New-customer acquisition at the lowest cost per acquisition achievable — not brand awareness, not engagement. There's no existing baseline for what Meta ads cost to convert a customer here — the site ran ads before, but that was pre-makeover: before the current website, the message/voice update, and the whole concept this plan is built on, so that historical data isn't comparable (unlike the flyer plan, which has industry benchmarks to set decision triggers against — see `FLYER_PLAN.md`'s Effectiveness Expectations). That means early rounds have a second job beyond finding a good creative hook: establishing what a real cost-per-acquisition baseline even looks like for this channel, so later rounds can set a real threshold instead of guessing one now.

**Status.** Not started. No campaign built yet. Account/payment covered by the user directly, ads have been run before recently. Meta Pixel not currently enabled but previously used via a plugin and re-enablable if wanted (see Prerequisites #2) — current plan is to run on UTM + WooCommerce order-attribution data instead.

**Tooling note (2026-07-29).** No Meta Ads MCP connector exists in the registry (checked — only read-only analytics connectors like Windsor.ai/Supermetrics are available, and they don't do campaign management). A custom MCP against Meta's Marketing API is technically possible but requires app registration, tokens, and hosted code. Working assumption for now: Ads Manager's native Bulk Edit spreadsheet is the practical tool — no dev work, and it's exactly the "upload/download control over time" mechanism needed. Revisit if manual Bulk Edit proves too limiting.

**Roles — the original decision, confirmed and firm** (unlike the creative content below, which is still open). Two humans, each with their own Claude account, split by function:

- **Sessions never touch Meta directly, in either account.** No Meta MCP exists, and none is planned. A session's entire relationship to Meta Business Platform is creating or viewing sheets/files that get manually passed between the two humans — never editing a live file, never uploading, never exporting. All actual work inside Meta (building/editing the campaign, uploading a Bulk Edit sheet, running the export) is done by hand, by whichever human is at the keyboard.
- **This project (JLM Wines sessions, this user)** — develops the creative candidate library and Canva prompts, and creates the sheet holding the values for the round's Bulk Edit change (the actual edited `.xlsx` is the manager's file — this project supplies the values, not the file itself, since no Drive MCP tool can edit an existing sheet in place, only create new ones). Reads whatever performance-export file the manager manually shares back, to measure the round and plan the next one. Maintains round results/decisions locally in this doc (Round Log below).
- **Manager (partner, jlmops manager role, own separate Claude account)** — creates each Canva asset from this project's prompt and registers it in the Content Library; picks up the round's Bulk Edit values sheet via a task's notes once flagged ready (see jlmops's role below); manually does everything inside Meta Business Platform (applies the round's changes in the real Bulk Edit file using the supplied values, uploads it, lets the round run, exports performance data); manually shares that export back to this user at round end.

**jlmops's role — publishing via the tasks/library workflow, at most (revised 2026-07-30 after review).** A Canva creative genuinely fits the existing Library mechanism (`image`/`social` types, Doc-based attach, per `jlmops/plans/CONTENT_CREATION_CHECKLIST.md`) — that part stands as originally described. The round's Bulk Edit values sheet does not: `SysLibrary.slb_ContentType` has no tabular/data-extract type, and the attach mechanism is built around a Doc, not a sheet — forcing it through Library would misuse an existing type (`template` was the closest fit, but semantically wrong). Resolution: the values sheet is a plain CSV or Google Sheet the session creates in Drive, with its URL placed directly in the relevant task's `st_Notes` — no Library entity, no attach step. A task's existence is still what tells the manager something is ready; the sheet just isn't a library asset. If jlmops's schema later gains a real content type for this kind of file, that's a future option, not a current requirement — nothing here is blocked on it.

**Data flow (confirmed).** Long-term data lives **locally, in this repo** (this doc, the Round Log). Outbound (this project → manager): a Canva creative is a library asset attached to a task; the round's Bulk Edit values sheet is a plain Drive file linked from a task's notes (see jlmops's role above) — either way, the task's existence is the "content is ready" signal. Inbound (manager → this project): once the round finishes, the manager manually shares the performance export back via Drive — there's no equivalent task mechanism for notifying this project's own session, so that leg is a manual hand-off. Nothing about the test's state persists in jlmops or Drive between rounds — the Round Log here is the only record.

---

## Creative Strategy

**Nothing below is decided.** This is a candidate library — buckets, hooks, and formats to draw from — not a shortlist already chosen. The variety is deliberate (many angles to pull single candidates from over successive rounds); it isn't a plan to test multiple variants at once.

**Testing approach — candidate method, not yet chosen.**

- **Method (2026-07-30, current thinking).** Start with a **single candidate run alone**, no paired challenger — see what a solo round actually looks like before deciding anything about method. Whether pairing in a challenger afterward is worth doing is itself an open question to try, not a locked design. What budget math does rule out: a small daily budget spread across many variants *simultaneously* won't produce a readable signal per variant — that's a real constraint on the *mechanics* of any given round, separate from how wide the candidate library is or how many rounds get run over time.
- **Phase 1 unit (candidate default).** A **short video stitched from stills with Canva transitions** (slide/fade/wipe) — not filming, not full animation. Plain static images are fine for concepts that don't need a reveal (proof/aftermath, unboxing). Carousels look weak for this — swipe-through engagement on cold feed traffic is unreliable, so any "reveal" concept would be staged as stills-with-transitions instead of a tappable carousel, if this approach is used at all.
- **Possible later phase (scale the winner) — if a hook proves out.** Heavier production (full animation, Evyatar's advisor entrance, full Reel sequences) only on whatever concept, if any, earns that investment.
- **Craft rule — no bottle on the "problem" side (2026-07-30, from bucket 8).** Whenever a concept has a problem/solution structure, the problem-side imagery should never show wine at all — only the need or uncertainty (a question mark, an empty spot, hands not yet holding anything). The bottle/box reveal should be the sole place wine appears in the whole piece, so the one payoff visual carries all the weight instead of being pre-empted by an earlier accidental glimpse.

**Budget & schedule (researched 2026-07-29).** Israel-wide Meta CPM averaged **$8.38** in 2025 (range $4.85–$14.90 depending on season; source: superads.ai Israel benchmark). A Jerusalem-only geo-test likely sits at or a little below that range. Starting budget: **₪30–60/day** for the ad set — same order of magnitude as the flyer's ₪2,000/round test scale. **No ads Friday afternoon through Saturday night** (Shabbat) — extending the pause through Sunday noon is also reasonable (Sunday is the start of the Israeli work week, not a lazy weekend morning). Two independent reasons behind the Friday pause, not just observance: delivery can't happen same-night regardless, and Friday-night planning genuinely starts Wednesday/Thursday in Israel, so that's when intent (and the ad) should show up. **Dayparting should also track staffing, not just browsing hours** — if responsiveness to on-site questions is a real differentiator, ads should run when someone's actually available to answer, so a visitor's question doesn't hit a quiet site.

**Visual format.** Subject/scenario large (fills the frame — this is the scroll-stopping hook), Evyatar as a small constant inset rather than the hero. Produce **one** Evyatar cutout/inset asset once, reuse it across every scenario's stills — only the scenario art changes per variant. Mirrors the flyer's "large hero + small resolution inset" logic, with the roles flipped to suit a cold-scroll hook instead of an already-warm local audience.

### Production mechanics — Canva Reels, lowest-cost method

Confirms and details the "stills stitched with transitions" approach already assumed above — this is the actual how-to, not a new decision.

- **Canvas:** Canva's native Reel/Story preset (1080×1920 vertical) — no external video tool needed at any step of this pipeline.
- **Stitching stills — multi-page + page transitions.** Build each beat as its own page in one Canva design; the video/timeline editor sets a duration per page and applies a transition between pages (Fade, Slide, Wipe, Dissolve). This is the entire "video" mechanism for any concept that's just a sequence of stills (buckets 3, 5, 7).
- **Motion on a single still — element animation, not filming.** Canva animates individual elements on one page (Pan, Rise, Fade, Pop, a slow Ken-Burns-style zoom) — this is what gives a static photo a video-like feel without ever filming: Evyatar's cutout entrance, bottles popping in/out of a box (bucket 7), bottle graphics appearing/disappearing in rack slots (bucket 6). No live-action footage needed for any bucket as specced.
- **Start from a template, don't build timing from scratch.** Canva's existing Reel/Story ad templates already have a transition/animation rhythm; swap in JLM photos and copy rather than hand-timing a blank canvas — cheapest path to something that already feels professionally paced.
- **Cutout assets, made once.** Evyatar's recurring advisor inset needs Canva's Background Remover (Pro feature) run once; reuse the same cutout across every scenario per the "produce one asset, reuse everywhere" rule above.
- **AI video generation — minimal, fallback use only.** Canva's Magic Media (text-to-video) can fill in an isolated beat that's genuinely hard to fake with stills, but it's credit-metered and less controllable than hand-timed animation. Treat it as a one-beat patch if the stills-based version of that beat doesn't read well, not as the default production method — Phase 1's whole point is near-zero cost via stills.
- **Audio + length + export.** Canva's free stock audio library avoids licensing risk. Target 15–25s (matches the ~20–25s already used for bucket 6) — Reels ads perform best under 30s with the hook in the first 3 seconds. Export as MP4 directly from Canva's "Download as Video."

**Advisor character — Evyatar (leading candidate, not locked).** Idea: Evyatar plays a recurring "I know a guy" advisor across scenes. Stronger than an anonymous actor since he's already the brand's face (see `FLYER_PLAN.md` — "it's Evyatar's palate," not "we sell wine"). For Phase 1, use a still photo (cutout, transparent background) animated into frame with Canva's built-in Pan/Fade/Rise effects — no video shoot needed. A fully stylized/illustrated version is an option if a photo reads too literal next to the more graphic scenario art, but needs a consistent look nailed down first.

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

**6. Buy-ahead / stop the gamble permanently.** Sharper reframe of the gambling bucket (2026-07-29): the real problem isn't a single bad bottle, it's that buying reactively (last-minute, wherever's nearby) means gambling *every time*, so bad outcomes stack up. The fix isn't speed/convenience, it's deciding once, in advance, and never having to gamble again — buy a 9–10 bottle bundle (free-delivery threshold) before any specific occasion exists in mind, and every occasion after is already covered. **Don't state the economics — show it.** Audience is assumed sophisticated enough to infer that a ₪400 bundle means more wine bought at once than a reactive purchase would be; no need to explain. Best execution found so far: **split-screen, no narration, no text at all, wine-rack framing** (revised 2026-07-29 — avoids an empties/overconsumption read): one side shows the rack filling (unboxing footage, bottles going in), the other shows it gradually emptying across occasion clips (glasses raised, people enjoying — not empty bottles) as the rack gets used well over time. Inventory metaphor, not a drinking-pace one. **Production note (2026-07-29):** can be done as pure stills, no live-fill footage needed — one static rack photo as background, individual bottle graphics as separate Canva elements with Appear/Disappear animation timed per slot (six pop-in/pop-out beats for a "six bottles, six quick solutions" cut — fits a ~20–25s Reel). Cheaper than shooting real fill levels. Ties `CONTENT_STRATEGY.md`'s own principle — contrast should be "felt, not stated" — about as literally as an ad can. Candidate lines if any text is used at all: *"Buy it before you need it, and you'll never have to gamble when you do,"* *"Stock up once. Stop gambling every single time you need a bottle."*

**7. Proof of curation.** New bucket, distinct from bucket 3 (which shows customer outcomes) — this one shows JLM's own process. A case of bottles, most crossed out/rejected, one survives and ships. No joke, no metaphor, no advisor — just the actual curation the brand claims (`CONTENT_STRATEGY.md`: "We taste everything. We reject what doesn't meet the bar"), made visible. Lowest risk of misfire in the library since it isn't inventing a claim, just showing one already made. Could also draw on the documented "10 AM tasting ritual" as a few seconds of real, undressed documentary footage. **Independent signal, not a decision (2026-07-29)** — three of four fresh, unbriefed agents (see Fresh-eyes library below) landed on this same core idea without seeing this bucket, worth weighing but not a conclusion that this bucket is chosen. **Visual mechanic (2026-07-29):** stills-with-transitions sequence — a run of bottles being rejected/dismissed in quick succession (wipe/slide off-frame, left side or just vanishing), then the few survivors sliding to the right side of the frame into a box graphic that fills up as they land. Simple to build in Canva: one background, bottle elements animated out on reject, animated into the box on survive.

**8. Calendar of confidence.** Built jointly across a long back-and-forth (2026-07-30) — credited as a joint concept, not a session output. The whole Reel is framed as a phone-screen recording throughout: opens on a **doorbell-cam app view** showing a delivery arriving (the "order lands" moment happens natively inside the phone screen, no physical unboxing scene needed), then moves to the phone's own calendar app for the piece's main stretch. **Timeline anchor:** the shown month starts at that order/delivery date (the rack fills, echoing bucket 6's fill motion) — it's someone else's already-lived month, resolving a coherence problem a month of "already handled" days would otherwise create for a new-customer invitation. Six recurring occasion days each get a brief zoom/projection callout (a pictogram pulled forward, held a beat, released back into the grid) — **personal dining** (cooking island), **hosting** (hot coals + food ready to grill — BBQ, culturally load-bearing in Israel), **Shabbat** (table set — deliberately separate from hosting; Friday evening is a family ritual that stands alone), **attending an occasion** (a door with balloons, no person needed), **gifting** (a calendar day with a birthday marked — reframed from "buy a gift" to "choosing which bottle you already have suits this person," tying to bucket 6's buy-ahead stock and product-attribute transparency), and **personal enjoyment** (a cozy reading nook) — each a language-agnostic pictogram, no baked-in text, per the Prompt Formula rule. **Design rule: no bottle appears on any of these six** — only a question-mark-style pictogram; the box/bottle motif lives in its own corner, pulsing in sync with each callout, so the eventual reveal stays the only place a bottle appears until the resolution. **Resolution (2026-07-30, revised):** a seventh calendar entry — **order wine** — uses the same callout mechanic but is tappable rather than passive, and its pictogram can finally show a glass/bottle or the JLM mark since it's the resolution, not a problem day. Tapping it moves the sequence to the actual site, jlmwines.com, with the already-live WhatsApp button/contact visible in that shot (WhatsApp Business is genuinely set up and site-linked, per `.claude/wishlist.md`; the floating WhatsApp button shipped in the 2026-05-03/04 theme deploys per `CALENDAR.md`) — grounding "you already know which guy" in something literally true, not a metaphor. From there the phone-screen chrome falls away, expanding to full-bleed for the first time in the piece, and Evyatar — small and still in a corner throughout everything before this point — fills the frame, addressing the viewer directly for the first time. (Simpler than two earlier, now-superseded ideas: a "page turns to a blank new month" device, and an invented incoming-call interface — neither needed once the resolution is just one more calendar day and the destination is the real site.) **Payoff structure:** the everyday-savings message stays quiet background texture through the month; the overt new-customer offer (₪50 off, code `50NEW`) appears only in the full-bleed, direct-address close, so it gets the one deliberately built impact moment instead of competing with everything else. **Closing beat sequence:** candidate copy for the breakout moment, one short line per beat — *"You already have the app."* (bucket 4's refrain, flattened to a statement) / *"You already know which guy."* (names the advisor thread as already-known) / *"You're lucky."* (reclaims bucket 1's gambling language, flipped from warning to already-won) / *"And clever."* (status close, same register as the cool-kids thread) / *"You have the solution in your hands"* (synced to the box/bottle reveal). **Adjacent idea, not folded in:** an "empty rack, trigger replenish" ending using similar visual language reads as a retention/reorder nudge for existing customers — a natural sequel piece once there's a customer base to retarget, not this bucket's scope.

**9. The Interruption.** Leans into the medium itself rather than a scenario — someone mid-scroll, thumb already moving to skip past yet another ad, and the copy names it directly: *"You were about to scroll past this. Good instinct — most ads deserve it. This one's ₪50 off wine you'll actually like — code 50NEW."* Self-aware ad copy that names ad-fatigue tends to disarm skepticism rather than trigger it, and it validates the viewer's instinct instead of correcting them — no talking-down risk, since nothing about the viewer is being corrected. Cheapest possible unit: one static phone-scroll mockup, no scene needed.

**10. The Group Chat.** A different psychological hook than advice-giving — *ending an argument*, not resolving uncertainty. A group thread, several people throwing out conflicting wine suggestions, visible chaos — then one message drops a link, thread goes quiet, one 👍. Casts the viewer as the one who ends the debate rather than the one who starts it. Same cheap text-mockup production as the "help a friend" 1-on-1 version, different psychological register.

**11. Countdown to Shabbat.** Sharper and more specific than the calendar bucket's generic Shabbat pictogram (bucket 8) — the pre-Friday scramble before candle-lighting is one of the most universally recognized time-pressure moments in Israel. A ticking clock toward sundown, resolved by "already ordered, already there." Strong enough to stand alone as a single hook rather than one day among six — a candidate to test on its own, not only as part of bucket 8.

**12. Two Kinds of Empty.** A fresh visual metaphor — glasses, not racks or boxes, which have carried most of the visual weight so far. Split-screen: one empty glass because the bottle got finished happily, one abandoned half-full because it wasn't liked. Same "reliable enjoyment vs. wasted money" contrast bucket 6 already makes, told through a more intimate object.

**Portable line (not tied to one bucket):** *"Different night. Different reason. Same answer."* Names what buckets 5 (occasion) and 8 (calendar) are both actually arguing — tight enough to anchor either execution or stand alone as a closer. See also Format & Angle Library's copy angles.

**Note:** buckets are different tonal registers (luck / confusion / proof / sci-fi-gadget / occasion / buy-ahead / curation / calendar-of-confidence / meta-interruption / group-decisiveness / Shabbat-specific / empty-glass) — keep them as separate hook candidates rather than mixing metaphors within one ad, so each stays legible on its own. This is a library to draw from over many rounds, not a shortlist to test all at once. Buckets 9–12 and the portable line above are freshly generated (2026-07-30), unweighed by any review pass — genuinely unknowns, same candidate status as everything else here.

---

## Format & Angle Library

Ideas that aren't tied to one specific bucket — reusable across whichever hooks get tested.

**Copy angles (pull from documented brand content, not invented):**
- *"You'll know by the second sip. We already did."* — from the brand's own "second sip rule" content topic.
- *"We reject the wine so you don't have to."* — near-verbatim from `CONTENT_STRATEGY.md`.
- *"Stop paying to find out."*
- *"Different night. Different reason. Same answer."* (2026-07-30) — names the mechanic buckets 5 (occasion) and 8 (calendar) both run on; portable across either execution or usable as a standalone closer.

**Video formats (not yet assigned to a specific bucket):**
- **Split-screen, same night** — one side mid-gamble/scramble, other side calm and already covered (general version of the bucket-6 execution above; could restage with any bucket's "problem" side).
- **POV shelf-scan** — camera as the viewer's own eyes, quick disorienting cuts across labels, hard cut to calm. Native-feeling first-person format for Reels.
- **UGC-style unboxing** — shot to look like a real customer's own phone recording, deliberately unpolished; native-feeling ads often outperform produced ones on Meta. A production-style choice, could apply to any bucket's message, not just bucket 6/7.

**Targeting/local angles:**
- **Neighborhood-name personalization** — *"Katamon, meet your new wine guy"* — digital version of the flyer's local-first logic; copy-only via Meta's geo-targeting, same image, near-free to test.
- **Social proof, local numbers** — *"X Jerusalem households already stopped guessing."*
- **Language sequencing (2026-07-29):** English speakers in Jerusalem are an easier-to-acquire segment per direct experience. Test English-only first (English targeting + English creative + English landing pages — site has a full parallel Hebrew page for every English page, product/blog included, so this isn't a coverage gap). Only build Hebrew versions of hooks that already win in English — avoids doubling every round's cost before a hook is proven.
- **Demographic axis (2026-07-29):** same hooks, age-targeted delivery, not new creative. Older buyers → lead with delivery/convenience (bucket 4's "gets your wine from the shelf to your door without carrying a thing" — harder for this segment to transport wine themselves). Younger buyers → lead with value/consistency (bucket 6's stop-gambling-once framing, or bucket 7's proof-of-curation).

**Policy flag (media-buyer catch, unresolved):** casino/gambling imagery (bucket 1) may trip Meta's ad-review policies on gambling-related content even though the ad isn't promoting gambling. Needs a policy check before producing anything for that bucket specifically.

**Brand-voice flag (unresolved):** `CONTENT_STRATEGY.md` — customers "don't want to feel stupid or talked down to." Casino and dictionary buckets both risk reading as mocking the *viewer's* past choice rather than rescuing a friend from one. Needs the Evyatar-advisor delivery to land as warm, not corrective, or it cuts against brand.

---

## Prompt Formula & Asset Reuse

**Division of labor (confirmed).** No Canva MCP, in this or any workflow — the user handles Canva directly. This project's only job is to write the prompt/instruction; it never generates or touches the actual asset.

**Prompt formula — adapted from `content/_resources/IMAGE_RECIPE.md`, not copied as-is.** That doc's formula shape is reusable; its style line isn't — it specifies "Impressionist oil painting," chosen for blog editorial images to contrast with the site's commercial look. Ad creative wants the opposite (real/native-feeling, per the buckets above), so the style slot gets swapped, not the formula:

```
[Style: realistic photo / candid phone-shot / UGC-style, not painterly], [Subject, close-up or wide], [Background], [Color tones], [Lighting], [Mood], 9:16 vertical (Reel/Story)
```

- **Style, by bucket:** buckets 6/7 (unboxing, case of bottles) → "candid, real-feeling photo, not staged" — deliberately un-polished per the Format & Angle Library's UGC note above. App/gadget bucket (4) → "realistic phone-in-hand photo, natural home lighting." Occasion montage (5) → flat, simple icon/photo style that can share one template across many copy swaps.
- **Say what should be in frame, don't negate.** Same caveat `IMAGE_RECIPE.md` already flags for blog images: Canva-style generation follows positive instructions poorly when phrased as "no X" — say "empty glass" not "no wine left," say "plain label, no text" rather than "avoid jargon on the label." Several buckets here are literally about absence (no confusion, no gambling, no jargon) — the prompt still has to describe the positive scene, never the negation.
- **Name hands/people explicitly when needed.** Same note carried over: generation tends to skip people/hands unless the prompt asks for them — buckets needing a pour, a phone in hand, or bottles being placed into a box must say so directly.

**Asset reuse map — build once, reuse across a round or across buckets, rather than re-briefing Canva work per variant:**

| Asset | Built once for | Reused across |
|---|---|---|
| Evyatar cutout (background removed) | Any bucket using the advisor character | Every scenario still — only the scenario art changes, the inset doesn't (Visual format, above) |
| Wine-rack background photo | Bucket 6 | All six pop-in/pop-out bottle beats — only the small bottle-graphic elements change per beat |
| Rejection/box background | Bucket 7 | Every reject/survive beat in the sequence — only which bottle element animates out vs. in changes |
| Occasion bucket's shared visual template | Bucket 5 | Every individual occasion line ("Friends just showed up," "Game night," etc.) — copy-only swap, no new Canva build per line |
| Any no-text-baked-in visual | Any bucket (Phase 1 rule, above) | Every ad-copy variant tested against that same visual — the biggest single reuse lever, since one Canva asset can serve several rounds' worth of copy tests |

This table consolidates reuse points already stated within individual buckets above — it doesn't add new creative decisions, just makes the "build once" discipline checkable in one place before briefing the manager on a new asset.

---

## Fresh-eyes library (2026-07-29)

Four agents, run independently and in parallel, each briefed only with `business/CONTENT_STRATEGY.md` + `website/BRAND.md` — none saw this document or the conversation that built it. Purpose: concepts genuinely unanchored to buckets 1–7 above. Notably, three of the four independently converged on the same core idea as bucket 7 (proof of curation) — see the validation note on that bucket.

### Copywriter lens
1. **"We Tasted 40 Wines This Week. We're Selling 6."** — Slideshow of bottle stills, most dimmed/crossed out in sequence, one stays lit. Ends: "The ones that made the cut."
2. **"You Don't Have to Know Wine. You Just Have to Like It."** — Static image, relaxed home dinner scene, no sommelier cues.
3. **"New in Jerusalem? You Don't Need Hebrew to Order Wine You'll Actually Enjoy."** — Slideshow aimed at English-speaking olim/expats: package arrives at a Jerusalem-stone apartment → opened → poured at a small gathering.
4. **"The Price Isn't About the Label. It's About What's In the Bottle."** — Single modest glass shot, deliberately no luxury cues.
5. **"The Second Sip Is the One That Tells You the Truth."** — Close-up slideshow of a glass being lifted and sipped, slow fades, unhurried pacing.
6. **"Someone Tastes Every Bottle Before It Reaches You. It's Not You."** — Tasting-ritual stills wiping to a sealed box on a doorstep.

### Visual/art-director lens
1. **The Rejection Table** — Tasting table, several bottles corked/crossed out, one lit alone. Hook: "We open a lot of bottles so you don't have to."
2. **Evyatar's Hands** — Tight, warm shot of hands mid-pour, notebook with tasting notes in soft background. Hook: "One palate. One job: finding the good stuff."
3. **The Almost-Empty Shelf** — Curated shelf with deliberate gaps, not packed like a supermarket aisle. Hook: "Fewer bottles. Better odds you'll like every one."
4. **Jerusalem Doorstep, Golden Hour** — Box on Jerusalem stone steps, warm late light. Hook: "Good wine, on your doorstep, no guesswork."
5. **Second Sip** — Two-frame fade: hesitant first sip → relaxed second sip. Hook: "You'll know by the second sip."
6. **The Never-Empty Note Card** — Flat-lay of a handwritten note card beside a glass and candle. Hook: "Every bottle picked with you in mind."

### Category-strategist lens (borrowing patterns from other industries)
1. **"1 in 10 Makes the Cut"** — Bottles wipe away except one, with a ticking "Tasted: 40 → 4 → 1" counter. *Borrows from specialty coffee/artisan food brands showing their rejection rate.*
2. **"Swipe Right on Tonight's Wine"** — Dating-app card-stack visual language (no real swiping, just the aesthetic): cards slide away, one stays with a "match" glow. *Borrows from dating-app matchmaking UI — instantly legible, reframes wine-picking as an effortless match.*
3. **"One Less Thing to Decide This Week"** — To-do list with "wine for Friday??" crossed out → doorstep delivery → relaxed dinner. *Borrows from meal-kit/subscription-box advertising (relief from a weekly decision).*
4. **"Try It Before You Trust It"** — Small first order arrives, genuine shrug-into-smile reaction. *Borrows from Warby Parker/mattress-in-a-box "try before you commit."*
5. **"Today's Verdict, 10 AM"** — Daily tasting-ritual log with a date stamp, "Approved." *Borrows from bakery/coffee-shop "today's batch" content.*
6. **"Skip the Vocabulary, Keep the Wine"** — Jargon words appear and strike through one by one, ending on "We handled the hard part." *Borrows from "permission granted" messaging used by wellness/snack D2C brands.*

### Customer-psychology lens (each tagged with its mechanism)
1. **"You Already Know What You Like — You Just Never Had a Way to Say It"** — Customer's own words as text overlay ("not too sweet," "the one from last time"). *Mechanism: identity/self-image protection — validates existing vocabulary as sufficient.*
2. **"The One That Got Rejected So Yours Wouldn't Have To"** — Implied tasting/rejection sequence, no competitor shown. *Mechanism: delegation/trust transfer.*
3. **"Dinner's at 7. You Don't Need to Think About the Wine."** — Static set table, one glass poured, calm light. *Mechanism: decision-fatigue relief.*
4. **"So You're Not Standing in the Aisle Again"** — Overwhelming shelf → uncertain hand → doorstep arrival. *Mechanism: anticipated regret + loss aversion.*
5. **"Same Bottle. Every Time You Want It To Be."** — Two-panel visual rhyme (reach for bottle / same glass, same light). *Mechanism: consistency-seeking, targets the "not what I expected" pain point directly.*
6. **"You Don't Have to Get This Right. We Already Did."** — Person mid-laugh, bottle almost incidental in frame. *Mechanism: social proof of process (not popularity) — neutralizes fear of choosing wrong, not fear of others' opinions.*

---

## Prerequisites (confirm all before Step 1)

1. **Business Manager access + payment — confirmed, not tracked here (2026-07-30).** Ads have been run before, recently; the account and payment side is the user's own to manage, not something this plan needs to gate on.
2. **Meta Pixel — not currently enabled, but previously used and re-enablable (corrected 2026-07-30); recommendation is to skip it for now regardless.** Grepped `website/` for `fbq(`, pixel script tags, `connect.facebook.net` — no matches, but that only checks this repo's custom theme code; the Pixel was historically run via the **Facebook for WooCommerce** plugin (confirmed by a `_wc_facebook_for_woocommerce_order_placed` meta field seen in a real order export), which isn't in this repo and wouldn't show up in that grep. So this is a re-enable, not a from-scratch build, if it's ever wanted. Recommending skip-for-now anyway, since the reasoning was never about install effort: (a) iOS ATT / browser tracking-prevention / cookie-consent rules block or degrade a large share of client-side Pixel events today, so its data would be incomplete regardless; (b) WooCommerce already captures first-party, server-side order attribution independent of the Pixel — real order exports include `_wc_order_attribution_utm_source/medium/campaign` meta fields, populated at checkout from session data, unaffected by client-side tracking restrictions; (c) at this test's actual scale (₪30–60/day, solo-first, learning-phase, new-customer acquisition), conversions will be genuinely rare — nowhere near the weekly volume Meta's Pixel-driven auto-optimization needs to exit its own learning phase, so that benefit likely wouldn't materialize yet even with the Pixel installed; (d) the engagement-level signal (clicks, sessions, reach) that a rare-conversion round *can* actually read is already available without the Pixel, via the existing GA4 setup (`jlmops-status.md`'s GA4 organic-traffic tracking — the same GA4 tag picks up any UTM-tagged session regardless of source, paid or organic). **Net: UTM + WooCommerce's existing order-attribution meta + GA4's existing engagement tracking covers this phase's actual need** (which creative/round produced which orders and how it engaged) **without the Pixel's incompleteness risk.** Revisit installing it if the program scales to where Meta's on-platform optimization or retargeting/lookalike audiences (both genuinely require the Pixel) become worth the investment.
3. **Landing page + offer — confirmed (2026-07-30).** Reuses the flyer plan's (`FLYER_PLAN.md`) bundles category page + `50NEW` first-order coupon rather than a Meta-specific offer/code. **Economics confirmed (2026-07-29):** a ~₪400 bundle order has enough margin to cover both delivery and the ₪50 first-order discount, so offering `50NEW` on bundle-sized orders is financially sound, not just a message-consistency choice. **State the ₪50 off upfront in the ad copy itself** (Meta's primary text/description field, not baked into the image — consistent with the no-text-in-image rule) rather than saving it as a landing-page surprise; the offer is strong enough to work as part of the hook, not just a checkout-time incentive.

---

## Step-by-step: Bulk Edit workflow

Bulk Edit iterates on an *existing* campaign structure — it's not for building from a blank sheet. First round is built by hand in the UI; every round after is spreadsheet-driven. **Steps 1–7 below are manager-side** (executed in Meta Business Platform, per Roles above); this project supplies the creative/copy/audience direction going in and reviews the exported results coming out.

1. **Build the base structure manually, once**, in Ads Manager UI: one campaign, one ad set (audience, budget, placements), one ad (creative, copy, destination URL with UTM parameters — see Attribution below).
   → **CONFIRM before continuing:** campaign name, objective, and initial budget reported back to this project and agreed.
2. Select the campaign in Ads Manager → **⋯ menu → Bulk Edit** (sometimes labeled Bulk Create/Edit) → **Export/Download** as `.xlsx`.
3. **Before editing anything, save an untouched copy** of the downloaded file with a timestamp in the name (e.g. `meta-ads-round1-backup-260729.xlsx`). This is the rollback point if an upload goes wrong.
4. Edit the working copy. **Change only one variable per round** — audience OR budget OR creative, not several at once. Same discipline as the flyer plan's neighborhood rotation: mixing changes makes results unreadable.
5. Re-upload the edited sheet via the same **Bulk Edit → Upload/Import** path.
   → **CONFIRM before publishing:** Ads Manager shows a review/diff screen after upload — read it and confirm the changes shown match intent *before* clicking Publish/Apply. This is the checkpoint that catches a bad edit before it goes live.
6. Let the round run a **minimum set duration** (agree the number of days before launching — don't judge or edit mid-flight; Meta's delivery needs a stabilization window and early numbers are noisy).
7. At the end of the round, export fresh performance data (same Bulk Edit export, or Ads Manager's reporting export) and **hand it back to this project** for the results review + next-round call (see Roles above), before starting the next round's edit.

---

## Attribution (UTM-based by choice, not just absence of a Pixel)

Same mechanism the flyer plan uses: **UTM parameters + WooCommerce's own order attribution data**, not on-platform Pixel conversion tracking (see Prerequisites #2 for why this is now a deliberate choice for this phase, not a placeholder).

- Every ad's destination URL carries UTM parameters (e.g. `utm_source=facebook&utm_medium=paid&utm_campaign=jerusalem-round1`) unique enough to distinguish rounds/variants.
- WooCommerce already writes these into each order's meta at checkout (`_wc_order_attribution_utm_source/medium/campaign` and related fields) — first-party, server-side, unaffected by iOS ATT or browser tracking-prevention. Cross-reference this against the round's spend/reach numbers (or the `50NEW` coupon-code approach, same as the flyer) to read results manually, round over round.
- If the program later scales to where Meta's on-platform optimization or retargeting/lookalikes are worth it, installing the Pixel adds a second, complementary signal — it wouldn't replace this mechanism, since UTM+order data survives regardless of Pixel status.

---

## Confirmation checklist (repeat every round)

- [ ] Base/prior campaign structure confirmed correct before export
- [ ] Backup copy of the exported sheet saved before editing
- [ ] Only one variable changed this round
- [ ] Upload diff reviewed and confirmed before publishing
- [ ] Minimum run duration agreed and respected before judging results
- [ ] Results exported and logged at round end

---

## Analysis pass (2026-07-29, over buckets 5–7 + library)

Five-lens pass (copywriter / video CD / media buyer / local Jerusalem read / brand-voice guardian), grounded in `business/CONTENT_STRATEGY.md` and `website/BRAND.md`. **This is input to weigh, not a conclusion already acted on** — nothing has been chosen from it.

- **This pass rated buckets 6 (buy-ahead/unboxing) and 7 (proof of curation) highest on brand-fit** — both enact the doc's own principle that contrast should be "felt, not stated," need no invented metaphor, and carry no risk of reading as talking down to the customer (the "don't want to feel stupid" line in `CONTENT_STRATEGY.md`) since there's no joke to land. Also flagged as cheapest and lowest-risk to produce first — real footage rather than staged scenario art, and no localization risk.
- **Bucket 1 (gambling) would need a Meta ad-policy check** before any production spend, if it's ever pursued — casino/gambling imagery can trip Meta's review even when not promoting gambling.
- **Occasion bucket (5)** was flagged as cheapest to test in *volume* (shared visual template, copy-only swaps) but is a breadth play, not a single strong hook.

**Candidate starting points (nothing chosen).** Buckets 6 and 7, above, are what this pass flagged as strong starting points — offered as options (**Candidate A** = bucket 6, **Candidate B** = bucket 7), not a pairing to run together, per the solo-first method above. If a solo-first round is run, one of these (or something else from the library) would be it; whether a paired round follows afterward is still open, not decided here.

---

## Round Log

Results and decisions live here, not in jlmops (see Roles above). One entry per completed round: what ran, what the manager exported, what this project decided for the next round.

_(No rounds run yet.)_

---

## Open items

1. Round 1 specifics — budget, audience definition, minimum run duration. (Flyer plan's local-first framing — warm/nearby audience before cold/wide — is a reasonable starting logic to borrow, but Meta's audience targeting works differently, so this needs its own pass, not a copy-paste.)
2. Confirm or revise which candidate runs first, given the solo-first method — bucket 8 (Calendar of confidence) is the user's stated favorite (2026-07-30) but hasn't been locked in.
3. Produce the assets for whichever candidate is confirmed — bucket 8 needs several pieces (calendar background, six pictogram callouts, Evyatar cutout + growth animation, corner box/bottle pulse); simpler buckets (6/7/9/10) need only one or two.
4. Meta ad-policy check on casino/gambling imagery before bucket 1 is ever produced.

Done: Business Manager access + payment (user-managed, ads run before), Meta Pixel decision (skip for now, UTM + WooCommerce order attribution + GA4 instead), landing page/offer (`50NEW`, reused from the flyer).

## Out of scope (for now)

- Custom Meta Marketing API integration / MCP server — ruled out above, revisit only if manual Bulk Edit proves too limiting after real test rounds.
- Automated bid/budget optimization tooling — first test is about learning the channel, not building infrastructure.
