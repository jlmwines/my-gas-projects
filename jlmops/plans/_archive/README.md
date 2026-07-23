# Archived plan docs

Plan documents whose work has fully shipped and whose value is now captured in the
code, in `git`, and in the relevant index/STATUS docs. Kept (not deleted) for
historical reference — the *why* behind a decision often isn't in the diff.

**Convention:** a plan moves here only when SHIPPED **and** carrying no open
caveat (no pending smoke, no deferred sub-stage, no "ready to ship" status). Active,
deferred, or partially-verified plans stay in `jlmops/plans/`.

## Contents

UI-audit per-session deep-dives, all SHIPPED 2026-05-29 (see `../UI_AUDIT.md` §10
shipped log for the canonical record):

- `UI_T1_0_quick_wins.md`
- `UI_T2_2_crm_nav.md`
- `UI_T2_3_orders_merge.md`
- `UI_T2_5_taskwidgets_extend_dashboard.md`
- `UI_T2_6_taskwidgets_adoption_rollout.md`
- `UI_T3_1_admin_products_refresh.md`
- `UI_T3_2_manager_contact_load_once.md`
- `UI_T3_3_admin_bundles_consolidate.md`
- `UI_T4_1_orders_mobile.md`
- `UI_T4_2_dashboard_expanded_row.md`
- `UI_T4_4_products_mobile.md`
- `UI_T4_5_library_mobile.md`

Archived 2026-05-31.

- `UI_T5_2_admin_products_modals.md` — SHIPPED (3 `btn-primary` sites fixed, modals already `modal-overlay`). Archived 2026-07-23 (portfolio cleanup pass — was sitting as "ready to ship" though the code fix had already landed).

## Still active in `jlmops/plans/` (deliberately NOT archived)

- `UI_T2_1_admin_bundles.md` — never shipped; superseded 2026-06-07 by `ADMIN_BUNDLES_UI_PLAN.md`'s deeper redesign of the same view
- `UI_T2_4_content_stream_modal.md` — deferred-with-reasoning (live decision doc)
- `UI_T4_3_inventory_mobile.md` — shipped but Stage B count modal unsmoked
- `UI_T5_1_admin_contacts_modals.md` — shipped but smoke pending + Contact Action Ribbon Phase 2 rework
- `UI_T5_3_shared_list_component.md` — conditional-defer decision doc
