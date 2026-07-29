# Meta Ads Plan — Jerusalem Test Campaign (Bulk Edit Workflow)

**Purpose.** Test paid Facebook/Instagram advertising in Jerusalem, run by your partner directly in Meta Ads Manager. No custom API/MCP integration exists or is planned (see decision below) — this doc is the process guide for using Ads Manager's built-in **Bulk Edit** spreadsheet tool (download → edit → upload) to control and iterate the test over time.

**Status.** Not started. No campaign built yet, no ad account access confirmed, Meta Pixel not found on jlmwines.com (checked 2026-07-29 — no `fbq(`/pixel script in `website/`).

**Decision (2026-07-29).** No Meta Ads MCP connector exists in the registry (checked — only read-only analytics connectors like Windsor.ai/Supermetrics are available, and they don't do campaign management). A custom MCP against Meta's Marketing API is technically possible but requires app registration, tokens, and hosted code — not worth it for a first test. Ads Manager's native Bulk Edit spreadsheet is the right tool: no dev work, and it's exactly the "upload/download control over time" mechanism needed.

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
3. Round 1 specifics — budget, audience definition, creative, offer, minimum run duration. (Flyer plan's local-first framing — warm/nearby audience before cold/wide — is a reasonable starting logic to borrow, but Meta's audience targeting works differently, so this needs its own pass, not a copy-paste.)
4. Whether Round 1 reuses the `50NEW` coupon or gets its own code (own code would sharpen attribution once volume is real).

## Out of scope (for now)

- Custom Meta Marketing API integration / MCP server — ruled out above, revisit only if manual Bulk Edit proves too limiting after real test rounds.
- Automated bid/budget optimization tooling — first test is about learning the channel, not building infrastructure.
