# Bundle Web Sync + Any-Wine Fix

Replaces the bundle "web → ops" machinery with a safe design: a dedicated web snapshot (`WebBundles`), per-bundle writes that can never touch other bundles, and a wine-only default for "any category" slots. Status: **draft; first independent review done 2026-11-01, its findings (§8) not yet folded into §4-§7; then a second review, then user approval.** Nothing built. Prompted by the 2026-10-30 incident (14 bundles wiped to 1, restored by hand from version history).

## 1. What happened (log-verified, `JLMops_Logs - SysLog` export)

2026-10-30, bundle 54310: 07:50 Pull from Web (14 updated) → 07:53 Re-roll 54310 → **07:55:58 editor "Update from web" → `reimportAllBundlesBatch` with one bundle → "Bundles: 1, slots: 13"** → 07:57 and 08:10 Pull from Web ("14 updated", but only `WebProdM`/`WebXltM`) → 10/31 02:26 nightly rebuild restored 14 from `WebProdM`. Re-roll itself writes only cells of its own bundle (same re-roll on 10/28 left everything intact).

## 2. Current-state findings (code-traced, live = repo: no bundle file changed since 2026-08-27, all deploys since include it)

1. **The wipe.** `BundleService.reimportAllBundlesBatch` (`BundleService.js:1968`) clears every data row of `SysBundles` + `SysBundleSlots` (`:2106-2129`) and writes back only its input. Callers: toolbar Update Composition (all from `WebProdM`), editor Update from web (`WebAppBundles.js:655`, one bundle), nightly `refreshBundleComposition` (`HousekeepingService.js:782`).
2. **Pull writes product data.** `WooProductPullService.pullBundleProducts` (`:571`) writes woosb + discount fields into `WebProdM`/`WebXltM` by reading and rewriting each whole sheet (`:679-695`). It never writes the bundle sheets, so it cannot add or restore a bundle. Web bundles not already in master are skipped.
3. **Bundle state is read from product sheets.** Compare/needs-push (`buildExportTable`, `:2392`) reads the web side from `wpm_WoosbIds`/`wxm_WoosbIds`; displayed discount from `WebProdM` woosb fields (`_buildBundleDiscountMap`, `:204`); editor descriptions from `WebProdM`/`WebXltM` (`WebAppBundles.js:102-145`); names/status in the rebuild from `WebProdM`/`WebXltM`.
4. **Nightly rebuild overwrites ops.** Every night ops compositions are reset to `WebProdM`. Slot criteria are carried by (bundle, SKU) (`:1984-2004`), so a slot whose wine changed and wasn't exported loses its criteria.
5. **"Any category" has no filter.** `_matchesSlotCriteria` (`:871`) skips the category test when blank, so any published in-stock product qualifies (liqueur, accessories, gifts). The same predicate drives the editor picker, Maintain/Re-roll and the deficiency check.
6. **No lock on bundle writes.** Slot/bundle edits address rows by cached `rowNumber` (`:638`, `:469`, `:704`); a concurrent full rebuild would shift rows under them. `LockHelpers.withScriptLock` exists; `ConfigService.setConfigLocked` takes the same script lock, so a bundle lock must be released before the push-status refresh writes config (nesting is untested).
7. **Doc drift / dead code (fix in the docs pass).** `checkBundleHealth` (needs-attention cache) is not called by housekeeping, only by Review, though its comments and `WORKFLOWS.md` say housekeeping. `ProductImportService._processBundleProducts` has no caller. `sb_Type` is always written `'Bundle'` though `DATA_MODEL.md` says it is derived. `WebCat` lookup lists Rosé twice; several `SysCategories` HE names start with a tab.

Facts the design relies on, verified: HE woosb products carry the EN id in `translations.en` (used by the full pull, `WooProductPullService.js:201,472`); `fetchBundleProducts(lang)` filters `type=woosb` and the existing guard re-checks `p.type`; export reuses each slot's original woosb token from `sbs_SlotId = <bundleId>-<token>` (`:2280-2286`); `WebProdM` holds EN rows only (766, all `en`); 14 woosb bundles today.

## 3. Rules (user, 2026-10-30)

- Bundle sheets are the only authority for bundle state. `WebProdM`/`WebXltM` are product data, owned by the product sync; bundle code reads them only for per-wine facts (WC id, price, title, categories, stock) and never writes them.
- Pull from Web pulls bundle data and never alters product data.
- Every operation (pull, compare, Maintain, Re-roll, take web version) works on all, some, or one bundle without touching any other bundle.
- Edits are exported immediately and verified by Pull + Review; no delayed edit needs to survive anything. No reliance on housekeeping to repair bundle state.

## 4. Design

**A. `WebBundles` = the web snapshot.** The blank tab gets a schema (`schema.data.WebBundles`, prefix `wb_`, key `wb_BundleId`): `wb_BundleId` (EN id), `wb_HeId`, `wb_NameEn`, `wb_NameHe`, `wb_Status` (EN WC status), `wb_WoosbIdsEn`, `wb_WoosbIdsHe`, `wb_Discount`, `wb_DiscountAmount`, `wb_CustomPrice`, `wb_DisableAutoPrice`, `wb_ShortDescEn`, `wb_LongDescEn`, `wb_ShortDescHe`, `wb_LongDescHe`, `wb_PulledAt`. Plus a `system.sheet_names` entry. It mirrors the website; only Pull writes it.

**B. Pull from Web.** Fetch EN + HE woosb products; join HE to EN by `translations.en`. Abort with no write if either fetch throws or EN returns zero bundles. Rewrite `WebBundles` from the fetch (it is a mirror, so replacing it whole is correct; the abort rule stops a bad fetch blanking it). Then, in the bundle sheets: **create** any web bundle missing from ops (bundle row + slots from the snapshot); **update header only** (name EN/HE, status) on existing bundles; **never change an existing ops composition.** Ops bundles absent from the web are reported, never deleted. Writes nothing to `WebProdM`/`WebXltM`. Then refresh push status.

**C. Compare / needs push.** `buildExportTable` compares each ops bundle's serialized woosb against `wb_WoosbIdsEn/He`; an ops bundle with no snapshot row counts as "differs (not on web)". Product-id maps for serializing (SKU→EN id, EN→HE id) and the out-of-stock check stay on `WebProdM`/`WebXltM` (per-wine facts). Discount and editor descriptions read `WebBundles`.

**D. Take web version** (replaces editor "Update from web" and toolbar "Update Composition"). For the chosen bundle ids only: rebuild each bundle's rows from its `WebBundles` row, carrying slot criteria by `sbs_SlotId` first, then by SKU, and keeping `sb_MinTotal/MaxTotal/LastGenerated/GenFlags`. Used to undo an unwanted re-roll.

**E. Safe write primitive** (`_replaceBundles(bundleRowsById, slotRowsById)`), the only path that adds/replaces bundle rows: under `withScriptLock('bundles-write')`, read both sheets fresh, keep every row whose bundle id is not a target, substitute the targets, assert non-target bundle and slot rows are byte-identical before vs after (abort on mismatch), copy current contents to `SysBundles_Backup`/`SysBundleSlots_Backup` (one-level undo, overwritten each write), then write. Never clears rows of a non-target bundle. Lock released before push-status refresh. Maintain/Re-roll/Save keep their per-cell writes, now also inside the lock.

**F. Selection.** List rows get checkboxes; toolbar Maintain, Re-roll and Take web version act on the selection (none selected = all, with the count in the confirm). Editor buttons act on the open bundle.

**G. Any-wine default.** Blank `sbs_Category` and `sbs_Category2` → the product must be an everyday wine (definition in §5, D1). Implemented inside `_matchesSlotCriteria` so picker, generator and deficiency check agree; any-category slots now holding something else show "Needs attention".

**H. Removed.** `reimportAllBundlesBatch`, `WebAppBundles_reimportAllBundles`, `WebAppBundles_updateComposition`, both Update buttons and handlers, housekeeping `refreshBundleComposition` (keep `refreshBundlePushStatus`), `pullBundleProducts` + `_upsertBundleFieldsToMaster` (keep the exported `woosbIdsString`, used by `WooProductPullServiceTest.js`), `importBundleFromWooCommerce` + its controller and dead `_processBundleProducts`.

## 5. Decisions needed before build

- **D1. Everyday-wine definition — decided (user 2026-11-01): WC category** (Dry Red, Dry White, Rosé), matching how slot criteria already work. Comax-group vs web-category contradictions are a data-quality problem to resolve regularly, outside this plan (follow-up: a recurring check). Still open: whether combined tags (below) count. Background: Option 1: WC category is Dry Red, Dry White or Rosé (the slot criteria already use WC categories). Option 2: Comax group is יין אדום יבש / יין לבן יבש / יין רוזה. On today's `WebProdM`/`CmxProdM` exports they disagree on inclusion for 13 products: 4 pass only Option 1 (3 "Rosé | Semi-Dry" in the Comax semi-dry group, 1 "Dessert | Rosé | Sparkling" in the dessert group) and 9 pass only Option 2 (WC Semi-Dry/Fortified/Dessert wines filed in a Comax dry red/white group). They also disagree on colour for 16 (e.g. 11 WC "Dry White" in the Comax red group), which matters only for named-category slots. Also: does a dry red/white/rosé that is also tagged Sparkling (11), Gift Boxed (24), Semi-Dry (3) or Dessert (1) count as everyday?
- **D1 rule detail (user 2026-11-01):** the primary (wine-type) category decides; supplementary tags (Sparkling, Gift Boxed, etc.) are ignored — "Dry Red | Sparkling | Gift Boxed" is Dry Red. Wines carrying two wine-type categories (4 today: three "Rosé | Semi-Dry", one "Dessert | Rosé | Sparkling") are data contradictions; proposed: not everyday until cleaned up.
- **D2 — decided: no backup tabs.** `WebBundles` already holds every bundle's web composition (Take web version rebuilds any/all from it); the safe-write assertion protects non-target bundles; version history is the last resort. Drop the backup step from §4E.
- **D3 — decided: no checkboxes.** Toolbar acts on all (Maintain already only on deficient bundles); editor acts on the open bundle. Drop §4F.

## 6. Build order (one change at a time, each verified)

1. Config: `WebBundles` schema + sheet name → `node jlmops/generate-config.js`. Offline: `TestRunner` unit tests for the pure parts — snapshot row builder (EN/HE join, abort rules), `_replaceBundles` row merge + non-target assertion, any-wine predicate, criteria carry by slotId-then-SKU.
2. Pull → `WebBundles` (B) + compare/discount/descriptions repoint (C).
3. Safe write primitive (E) + Take web version (D); remove the rebuild paths (H).
4. Any-wine default (G).
5. Selection UI (F), if D3 = now.
6. Docs: `WORKFLOWS.md` §15, `DATA_MODEL.md` bundle section + `WebBundles`, `ADMIN_BUNDLES_UI_PLAN.md` references to Update Composition, BUGS entries; archive this plan.

## 7. Deploy and live verification

Before deploy: user names a version of `JLMops_Data` in version history. Deploy via `deploy.ps1` (code + config) → `rebuildSysConfigFromSource()` (`SetupConfig.js`, check the log, it swallows errors) → `syncHeaders('WebBundles')` (`SetupSheets.js`). Verify: Pull fills 14 `WebBundles` rows and leaves `WebProdM`/`WebXltM` unmodified (sheet edit history) and every ops composition unchanged; Needs-push matches the pre-deploy flags; Take web version on one bundle changes only that bundle's rows (row counts of others unchanged); Re-roll on an any-category slot picks only everyday wines; next housekeeping log shows no bundle rebuild.

**Rollback:** revert the commit and redeploy; `WebBundles` is inert without the code; bundle sheets restorable from the named version.

## 8. Resume here: review findings to fold in, and open decision

**Open decision (ask first):** 9 blank-category slots hold non-everyday items on purpose and would be flagged and swapped by the any-wine rule (fresh `SysBundleSlots` export 2026-11-01: 99 product slots, 36 blank-category). All are optional slots: 61605 Cheese Please (Picual olive oil, Gift Items), 61823 Shabbat Shalom (Koroneiki olive oil, Gift Items), 66218 Elite Value (Mony M White Muscat, Dessert), 8459 Seasonal (Vintage Moscato, Dessert), 66208 Value Reds (Or Haganuz Har Meron, Dessert; Zion V.T.S Rosé Semi-Dry), 8327 Explorer (Zion V.T.S Rosé Semi-Dry), 54310 Special Value (Emerald Riesling, Semi-Dry), 66206 Value Whites & Rosés (Tabor Har Gewurztraminer Semi-Dry). Choice: user sets explicit categories in the editor, or a one-time build step sets each from its current item. Must be done before §4G ships.

**Review findings (2026-11-01), most severe first:**
1. Any-wine rule hits the 9 slots above (decision above).
2. `withScriptLock` is the one global script lock, also used by job-queue claim (`OrchestratorService.js:535`, 5 s) and sync state (`SyncStateService.js:93`, 30 s); a long Maintain/Re-roll under it would starve them. It returns `null` on timeout (`LockHelpers.js:21-23`), signature `(context, timeoutMs, fn)`. Fix: compute in memory, lock only the final write, treat `null` as failure. `setConfigLocked` nesting is a documented hang (`ConfigService.js:276-280`): never call it inside the lock.
3. Lock list incomplete: `WebAppBundles_applyReplacements` (`:486`, view :729), slot/bundle CRUD controllers (`:200-365`), `createBundle`/`deleteBundle`/`duplicateBundle`. Per-cell writers take `rowNumber` from a 60 s module cache (`BundleService.js:15`): `clearCache()` and re-read inside the lock.
4. Empty `WebBundles` would flag all 14 as needing push and open a bogus push task (`HousekeepingService.js:1597-1604`). Treat an empty/missing snapshot as "unknown"; first Pull is part of the deploy.
5. Criteria carry must match by woosb token (strip `<bundleId>-` both sides): editor slots are `SLOT-…` in ops but `<bundleId>-SLOT-…` after a web rebuild (confirmed in the export). Decide `sbs_HistoryJson`/`LastRotated` handling. Abort if woosb JSON fails to parse (`_parseWoosbJson` returns `{}`, `:1819-1822`).
6. Pull's header update must not overwrite ops-owned status (Archived is set in ops, `AdminBundlesView.html:146`); specify the header write path.
7. Abort rules: also abort if HE returns 0 or fewer bundles than EN; keep the sync-active guard (`WooProductPullService.js:578-587`).
8. Rollback re-arms the nightly rebuild (the original bug); rollback must also disable it.
9. TestRunner runs inside Apps Script (nightly, `HousekeepingService.js:752`), not offline; register the suite (`TestRunner.js:21-30`) and export what it tests.
10. Missed consumers to update: `AdminBundlesView.html:1545` text, `system.json:848` and `HousekeepingService.js:1576` comments, `ProductImportService.js:984` comment, `DATA_MODEL.md:259`, `WORKFLOWS.md:254,281`, `ARCHITECTURE.md:72-76,135`, Pull's UI response shape (`res.success/res.message`, `:1536-1546`).
11. Snapshot freshness: needs-push now depends on the last manual Pull (today the daily sync refreshes it). Decide: nightly read-only Pull into `WebBundles`, or show `wb_PulledAt` in the UI.
12. Unverified: that `translations` is returned on `type=woosb` HE responses (check on first live Pull, abort on missing).
13. Deploy order: `deploy.ps1` makes code live before `rebuildSysConfigFromSource`; code must tolerate a missing schema/sheet. A schema'd blank tab makes `ValidationLogic.js:606` throw (`getLastColumn()=0`): no housekeeping between rebuild and `syncHeaders`. Ship as one deploy, not steps 2 and 3 separately (else the nightly rebuild runs on stale woosb data).
14. Decide ownership of `sb_GenFlags` slot-id references after Take web version.
15. Log correction for §1: by 08:10 status was already "1 of 14", so the hand restore came before 08:10; the 10/31 nightly rebuild then took it to "0 of 14", i.e. it discarded an unexported ops change (evidence for §2.4). Data exports used: `WebProdM`/`CmxProdM` 10/27, `SysCategories`/`SysLkp_Texts` July; D1 counts need a re-run on fresh exports.
