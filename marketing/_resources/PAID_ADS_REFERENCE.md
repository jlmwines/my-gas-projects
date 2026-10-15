# Paid Ads Reference

What JLM Wines learned from paid digital advertising, for any future paid round. No paid channel is running now: the Meta Ads Jerusalem test ran in August 2026 and was concluded as not productive, with no plan to continue. The full working plan (creative bucket library, reel builds, round log) is archived at `marketing/plans/_archive/META_ADS_PLAN.md`.

## Outcome

The Meta test ran 3 reels in one ad set, Jerusalem geo, Sun-Thu, about ₪30/day (₪550 budget for August), with Traffic as the objective. It drew cheap clicks (roughly ₪0.5 per click, about 200 clicks in the first two weeks) and good engagement, but no confirmed new-customer purchases. The reels performed nearly the same as each other, so creative choice wasn't the deciding factor. The user ended the channel on 2026-08-25 (effective 2026-08-31). Much of the run fell inside Israel's summer-vacation period, which may have hurt conversion independent of the ads themselves.

A Google Search Ads test (phrase-match "wine online/delivery" keywords, Jerusalem geo, homepage landing) started 2026-08-17 and read as more promising. The current growth push has since moved to manager-led Thursday in-shop tastings plus organic social, and the site's new-visitor popup with the `50NEW` coupon now carries much of online acquisition.

## Lessons worth reusing

**Budget vs. learning phase.** At ₪30-60/day, new-customer purchases are too rare for Meta's purchase or add-to-cart optimization to exit its learning phase (Meta's guidance is roughly 50 events a week). Traffic is the only workable objective at this scale, and a paid test this size can establish a cost-per-click baseline but probably not a cost-per-acquisition one.

**Attribution.** UTM-tagged destination URLs (distinct `utm_content` per creative) plus WooCommerce's own order-attribution fields (`_wc_order_attribution_utm_*`, written server-side at checkout) give a complete first-party signal that iOS and browser tracking limits can't block. The Meta Pixel was re-enabled through the Facebook for WooCommerce plugin and is useful as a second signal, not a replacement. GA4 picks up the UTM'd sessions on its own.

**Offer.** Reuse the site-wide `50NEW` first-order coupon rather than a channel-specific code; a ~₪400 bundle order has enough margin to cover delivery plus the ₪50 discount. State the offer in the ad's text fields, not baked into the image.

**Scheduling.** No ads from Friday afternoon through Saturday night (pausing until Sunday noon is also reasonable). Friday-night planning starts Wednesday/Thursday, so intent and ad spend belong there. Run ads when someone is available to answer on-site questions.

**Reel production (Canva, near-zero cost).** 1080x1920 Reel preset, stills stitched with page transitions plus per-element animation; no filming needed. Keep 15-25s with the hook in the first 3 seconds. Keep captions and key imagery inside Meta's safe zone (about 250px clear at top, 340px at bottom); Ads Manager flagged overlay conflicts on the first versions. Captions at 60pt in light text over a dark gradient band. Build reusable assets once (an Evyatar cutout, background plates) and swap only what changes per beat.

**Creative rules.** On problem/solution pieces, keep wine (and Evyatar) out of the problem side so the reveal carries all the weight. Frame past disappointment as the uncurated shelf's fault, never the viewer's. Show the curation claim ("we taste everything, reject what doesn't meet the bar") rather than inventing a metaphor; unbriefed reviewers independently converged on that angle. Avoid gambling/casino imagery: it's off-tone for an alcohol brand and needs a Meta ad-policy check.

**Process.** Meta's Bulk Edit spreadsheet (export, back up, edit one variable, re-upload, review the diff before publishing) is the practical control tool. Sessions never touch Meta directly; no Meta MCP connector was adopted. Let each round run its agreed minimum duration before judging.

**Unbuilt candidates.** If a paid round ever restarts, the archived plan's creative library still holds unproduced hooks (buckets 3 Proof/aftermath, 9 Interruption, 13 Wish List, 18 Outsource It).
