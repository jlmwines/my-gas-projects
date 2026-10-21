# Session Log — JLM Wines

_Claude-internal. Append session notes at session end (≤ 10 lines per entry: date, what shipped, what's next, anything a future session needs that won't be obvious from the diff). Human-facing files (`STATUS.md`, `plans/*.md`) should not contain session entries. Older entries below can be pruned over time._

---

## 2026-10-20/21 — FAQ refresh, Israel-only checkout guard, packing slip insert

- FAQ EN refreshed and pushed; launch waits on the Google reviews link (manager, today) and HE translation.
- Israel-only checkout guard deployed (theme) and tested EN+HE; facts in new `website/CHECKOUT.md`, plan archived. @581-@584 tested; WORKFLOWS §12/§13, PRODUCTION_GUIDE, PUBLISHING updated; both plans archived; leftovers in `jlmops/plans/CONTENT_CHAIN_SCHEDULING_PLAN.md`.
- Packing slip insert: intro and seasonal format agreed in chat (`website/PACKING_SLIP_EXPLAINER_PLAN.md`). Next: draft the other seasons in chat, then glossary and greeting. Apps Script Hebrew-date conversion verified live.
- Flyer Round 2 cancelled; cartons will be 6-bottle.
- Process: content development happens in chat, plan written once settled (memory widened). jlmops `ask` rule narrowed to code + config, so docs/plans no longer prompt. `git -C` is denied in settings; run plain `git` from the repo root.

---

## 2026-10-19 — /review-claude + portfolio cleanup

- Review found portfolio STATUS 52 days stale; rebuilt it and the portfolio CALENDAR. jlmwines STATUS/CALENDAR drift collapsed; CODE_AUDIT_PLAN archived; clasp-auth memory and two CLAUDE.md contradictions fixed. Details in both `last-cleanup.md` files.
- Next: user's call on the open items listed in `last-cleanup.md` (wishlist briefs, Reds/Whites status, portfolio memory duplication). Testing @581-@584 still pending from 10-18.
- Images: value-bundle redesign tried and dropped (user judged it a decline vs. current images). Package folk-art set uploaded and live on all 12 EN/HE products; rule graduated to `website/BRAND.md`, plan archived. HE alt = HE product name until the manager translates. Lesson: look at the live images before proposing a redesign.
- Also: packages category share image (folk-art, shared EN/HE attachment); theme main.css fix keeps sale badges inside grid images (Woo core loop rule outranked ours); "so your always get" typo fixed in 82 EN descriptions (source SysLkp_Texts P2 fixed by user). Bundle descriptions not mirrored in WebProdM logged low in bugs.md.
- Next: manager translates 6 HE package alt texts. Portfolio repo is local-only now (memory).
- 10-20: AYIW diary post planned conversationally (`content/plans/VINEYARD_DIARY_PLAN.md`); user checking for Evyatar's photos. BRAND.md now lists real photos as part of the style. User prefers discussing points briefly before any plan is written.

---

## 2026-10-18 — Woo non-JSON logging, content task dialog, task states keyed on due date (@580-@584)

- @580 logs Woo 2xx HTML bodies (suspect SiteGround anti-bot); next failure gives the page for a SiteGround ticket.
- @581 Create Content Tasks dialog pruned (Extracts/Review Extracts stages, type-filtered core chain, A/M labels). @582-@584 due date = Open/visibility, Unscheduled/Open/Done/All everywhere, manager view-only admin tasks, AdminTasksView full width, start-date sort.
- Coastal Plain Title+Body in the Library Doc, awaiting manager lock.
- Next: user tests @581-@584, then WORKFLOWS.md §12/§13 doc updates and plan archives. Backward chain scheduling is required but deferred (STATUS Next Action 12). Translate still admin_direct (user wants Manager; not done).
- Process: user stating a sequence is not authorization. clasp push and jlmops edits now prompt (hook + ask rule). An unauthorized memory file (`feedback_sequence_is_not_go_ahead.md`) still awaits the user's call on removal.

---

## 2026-10-15 — Central Mountains HE resync

- Manager revised the HE Library Doc; HE post 67857 re-pushed and HE email HTML + preview text updated (user replaced both in Mailchimp).
- jlmops @579: Calendar/Library status now counts tasks in SysTasks_Archive (archived chains showed "no tasks yet"). Verified live by user.
- Next: unchanged (Coastal Plain awaits manager lock).

---

## 2026-10-14 — Central Mountains published; jlmops @577/@578; Wine Talk heading (all areas)

- jlmops @577: task archive ages from `st_DoneDate` (late-finished library tasks were archived immediately). @578: order activity amount includes tax. Both untested until the next nightly housekeeping.
- Central Mountains region post published EN+HE ("The Wine Backbone: Central Mountains"); companion email HTML EN+HE built; Hebrew Mailchimp footer text recorded in `NEWSLETTER_REFERENCE.md`.
- Theme: Wine Talk heading now above "with Evyatar" on /articles/ and homepage.
- Preview text ≤150 now a counted (not estimated) drafting step in `content/CLAUDE.md`.
- Gotcha: publishing from a wp-admin editor tab opened before a push overwrites the pushed content.
- Next: user answers the stale Next Action questions; Coastal Plain (Slot D, 2026-10-19) awaits manager lock.

---

## 2026-10-13/14 — Cleanup pass; September AYIW email built + scheduled (all areas)

- Bugs/session-log/STATUS/RELIABILITY_AUDIT groomed; details in `.claude/last-cleanup.md`.
- September AYIW HTML built from the canonical Library Docs (`content/newsletter/2026-09/`), rebuilt after manager edits, scheduled in Mailchimp. Newsletter files live in `content/newsletter/`, not `marketing/newsletter/issues/` (doc paths fixed).
- Logged bug: welcome-outreach should skip first-time gift buyers. Inventory push "Unexpected token '<'" (HTML from host) was transient; Retry cleared it.
- Suggested to user: permanently delete bot sign-ups in Mailchimp, check double opt-in; footer-form honeypot check offered, not done.
- Next: user to answer the stale Next Action questions (newsletters, flyer round 2, Google Ads, region posts, cartons/tastings, 50NEW repeat test), then rewrite those STATUS items.
- Context: user confirmed content slippage is a manager-attention problem they handle in person; don't propose process redesigns for it unless asked.

---

## 2026-10-12 — attachExistingDoc ownership fix (jlmops @576)

- Admin attaching a manager-owned Doc failed at `setOwner` (only the owner can transfer). Now three-way branch: admin-owned attach as-is, clicker-owned transfer then attach, otherwise copy into the canonical folder and attach the copy ("Copy attached" toast). Deployed @576, verified. `DATA_MODEL.md` updated.
- No session-end entry was written that day; backfilled during the 2026-10-13 cleanup.

---

## 2026-09-03 — Two "customer treated as new" bugs found and fixed (welcome-outreach archive-blindness, 50NEW coupon dead hook); SYNC_HARDENING_PLAN step 9 finalized to a firm decision

- User reported repeat customers getting welcome-outreach tasks and using the first-purchase-only coupon. Welcome fix: `sc_FirstCompletedDate` floor check, jlmops @575 (verified live 2026-10-10). Coupon fix: rehooked from the nonexistent `woocommerce_coupon_is_valid_for_user` to `woocommerce_coupon_is_valid`, live, still awaiting a real repeat-use test.
- `SYNC_HARDENING_PLAN.md` step 9 (JLMops_Logs workbook cleanup) is now a firm decision: remove `SysSyncSession`/`SysSyncStatus`/`SysLog_Archive` outright. Queued behind Test Suite Tier 4.

---

## 2026-09-01/02 — Sync widget skip-log + double-submit fixes verified live (@571/@572); newsletter task-stage bug (@573); bundle-health automation removed (@574)

- Skip-log real reasons (@571); `GENERATING_WEB_EXPORT` stage closes the Generate double-submit (@572, `SYNC_HARDENING_PLAN.md` Bug 2), verified on a real sync 9/2.
- Bug 5 Stages C/E 5+ days live, zero errors; Stage E's narrower inside-lock re-check still formally unexercised.
- "Newsletter" content stage removed (@573) — correct doc-attach stages are "Assemble EN/HE Newsletter." Bundle-health auto-checks removed, review manual-only (@574). Calendar Holidays toggle defaults to Hide.
- Next: Bugs 1/3 still need a live repro; Test Suite Tier 4 and `JLMops_Logs` cleanup still queued.

---

## Pruned — entries before 2026-09-01 (cleanup 2026-10-13, consolidates all earlier pruned blocks)

Entries through 2026-08-31 were condensed per this file's header and the kernel's 30-day pruning default. Their durable facts live in current docs: sync hardening (Bug 5 A-E, D1-D4, Bug 6, script-lock concurrency) in `SYNC_HARDENING_PLAN.md` and `jlmops/docs/ARCHITECTURE.md` §2.5; test suite Tiers 1-3 in `TEST_SUITE_EXTENSION_PLAN.md`; welcome-outreach recency/dedup in `CONTACT_MANAGER_PLAN.md`; the SysLog cell-limit crisis fix and error-message relay fix in git (@547-@548); new-visitor popup and the deploy-theme incident/hardening in `website/EXIT_INTENT_POPUP_PLAN.md` and `deploy-theme.ps1`; region posts (Negev, Galilee live; Central Mountains, Coastal Plain, Golan, Judea in pipeline) in `content/plans/REGION_POSTS_PLAN.md`; Meta Ads test (ended 2026-08-31) in `marketing/plans/META_ADS_PLAN.md`; code-audit fix sequence in `CODE_AUDIT_FIX_SEQUENCE.md`; Content Library, PublishingView, product verification, product-detail performance, bundles, KPI summary, and calendar/library loop in `jlmops/docs/DATA_MODEL.md`, `WORKFLOWS.md`, `ARCHITECTURE.md` and `jlmops/plans/_archive/`.

Lessons from that period already captured as standing rules: "bug report ≠ ship order" (`.claude/CLAUDE.md`), check git log first on "this broke" (memory), theme deploy is live not staging (`.claude/CLAUDE.md`), session never originates Hebrew for blog posts (memory), body-first drafting gate (`content/CLAUDE.md`). One open gap noted 2026-07-31: `UNIFIED_TASK_UI_PLAN.md` no longer exists anywhere, its facts unverified against `ARCHITECTURE.md`. Full narrative is in git history.
