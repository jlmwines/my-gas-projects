# Automatic Order Import via WooCommerce REST API

**Status:** Not started — planning next session
**Priority:** High — daily manual bottleneck, blocks packing slips

## Problem

Orders placed on jlmwines.com don't appear in jlmops until manual export from WooCommerce admin and import into the system. This delays packing slips and all downstream order processing. Every order waits on manual action.

## Proposed Solution

GAS time-driven trigger polls the WooCommerce REST API for new/updated orders and writes them directly into jlmops (SysOrdLog / order sheets). No file export/import step.

## Approach: Poll from GAS

- Timed trigger runs every 5–15 minutes
- Calls Woo REST API: `GET /wp-json/wc/v3/orders?after={lastCheck}&status=processing`
- Transforms response into jlmops order format
- Writes to order sheets (same format as current CSV import)
- Updates `lastCheck` timestamp in SysConfig
- Logs import activity

## Key Questions to Resolve During Planning

1. **Woo REST API auth** — consumer key/secret already set up? Or need to create?
2. **Which order statuses to pull** — processing only, or also on-hold/completed?
3. **Mapping** — how does current CSV import map Woo fields to jlmops columns? Reuse that logic.
4. **Deduplication** — how to handle orders already imported (by Woo order ID check)
5. **Error handling** — what if API is down, rate limited, or returns partial data?
6. **Impact on existing sync workflow** — does this replace the order import steps in the 12-state machine, or run independently?
7. **GAS UrlFetchApp limits** — check quotas for the polling frequency

## Longer-Term Context

This is the first step toward direct API integration with WooCommerce. Inventory/product push via Woo REST API could follow, eventually simplifying or replacing the file-based sync workflow entirely.
