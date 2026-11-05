/**
 * @file ActivityBackfillService.js
 * @description Keeps SysContactActivity's order.placed rows current (called by the
 * nightly CRM contact refresh). The one-time history backfills (orders, coupons,
 * subscriptions, campaigns) that lived here were removed 2026-11-05 once the CRM
 * was stable; restore them from git history if activity ever needs rebuilding.
 */

const ActivityBackfillService = (function () {
  const SERVICE_NAME = 'ActivityBackfillService';

  /**
   * Ongoing sync of order.placed activity for current orders.
   *
   * Wired into the CRM contact refresh so new orders log an activity row on the
   * same cadence as the aggregate update. Scans current WebOrdM only — new orders
   * always land there before archiving, and orders already in the archive were
   * recorded while they were current. Idempotent via the order.placed.{orderId}
   * dedup; counts only completed/processing orders.
   *
   * @returns {Object} { created, skipped, errors }
   */
  function syncRecentOrderActivity() {
    const fnName = 'syncRecentOrderActivity';
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const spreadsheet = SheetAccessor.getDataSpreadsheet();

    const existingIds = _getExistingActivityIds('order.placed');

    // Totals from current items only (matches the current-only order scan).
    const orderTotals = new Map();
    const itemsSheet = spreadsheet.getSheetByName(sheetNames.WebOrdItemsM);
    if (itemsSheet) {
      _processItemsSheet(itemsSheet, 'woi_', orderTotals);
    }

    const currentSheet = spreadsheet.getSheetByName(sheetNames.WebOrdM);
    if (!currentSheet) {
      return { created: 0, skipped: 0, errors: 0 };
    }

    const result = _processOrderSheet(currentSheet, 'wom_', existingIds, orderTotals);
    LoggerService.info(SERVICE_NAME, fnName,
      `Recent order activity sync: created=${result.created}, skipped=${result.skipped}, errors=${result.errors}`);
    return result;
  }

  /**
   * Processes order items to calculate totals per order.
   */
  function _processItemsSheet(sheet, prefix, totals) {
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    const headers = data[0];
    const colMap = {};
    headers.forEach((h, i) => colMap[h] = i);

    const orderIdCol = colMap[prefix + 'OrderId'];
    const qtyCol = colMap[prefix + 'Quantity'];
    const totalCol = colMap[prefix + 'ItemTotal'];

    if (orderIdCol === undefined) return;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const orderId = String(row[orderIdCol] || '');
      if (!orderId) continue;

      const qty = parseInt(row[qtyCol], 10) || 0;
      const itemTotal = parseFloat(row[totalCol]) || 0;

      if (!totals.has(orderId)) {
        totals.set(orderId, { itemCount: 0, total: 0 });
      }
      const t = totals.get(orderId);
      t.itemCount += qty;
      t.total += itemTotal;
    }
  }

  /**
   * Processes orders from a sheet and creates activities.
   * @param {Sheet} sheet - Order sheet
   * @param {string} prefix - Column prefix (wom_ or woma_)
   * @param {Set} existingIds - Set of existing activity IDs
   * @param {Map} orderTotals - Calculated totals from items
   * @returns {Object} Counts
   */
  function _processOrderSheet(sheet, prefix, existingIds, orderTotals) {
    const fnName = '_processOrderSheet';
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { created: 0, skipped: 0, errors: 0 };

    const headers = data[0];
    const colMap = {};
    headers.forEach((h, i) => colMap[h] = i);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 1; i < data.length; i++) {
      try {
        const row = data[i];
        const orderId = String(row[colMap[prefix + 'OrderId']] || '');
        const email = row[colMap[prefix + 'BillingEmail']];
        const orderNumber = row[colMap[prefix + 'OrderNumber']];
        const orderDate = row[colMap[prefix + 'OrderDate']];
        const status = String(row[colMap[prefix + 'Status']] || '').toLowerCase();

        if (!email || !orderId) {
          skipped++;
          continue;
        }

        // Skip non-completed orders
        if (status && status !== 'completed' && status !== 'processing') {
          skipped++;
          continue;
        }

        // Check for existing activity
        const activityId = `order.placed.${orderId}`;
        if (existingIds.has(activityId)) {
          skipped++;
          continue;
        }

        // Get totals from calculated map
        const totals = orderTotals.get(orderId) || { itemCount: 0, total: 0 };

        // Use the order's own total (Woo includes tax + shipping); Woo line-item
        // totals exclude tax, so the item sum is only a fallback when it's missing.
        const orderTotalNum = parseFloat(row[colMap[prefix + 'OrderTotal']]);
        const orderTotal = !isNaN(orderTotalNum) && orderTotalNum > 0 ? orderTotalNum : totals.total;

        // Create activity
        ContactService.createActivity({
          sca_ActivityId: activityId,
          sca_Email: email.toLowerCase().trim(),
          sca_Timestamp: orderDate || new Date(),
          sca_Type: 'order.placed',
          sca_Summary: `Order #${orderNumber}: ${totals.itemCount} items, ₪${Math.round(orderTotal)}`,
          sca_Details: JSON.stringify({
            orderId: orderId,
            orderNumber: orderNumber,
            total: orderTotal,
            itemCount: totals.itemCount
          }),
          sca_CreatedBy: 'import'
        });

        created++;
        existingIds.add(activityId);
      } catch (e) {
        errors++;
        if (errors < 5) {
          LoggerService.warn(SERVICE_NAME, fnName, `Error at row ${i + 1}: ${e.message}`);
        }
      }
    }

    return { created, skipped, errors };
  }

  /**
   * Gets existing activity IDs of a specific type.
   * @param {string} activityType - Activity type to filter
   * @returns {Set} Set of activity IDs
   */
  function _getExistingActivityIds(activityType) {
    const activities = ContactService.getAllActivities();
    const ids = new Set();

    for (const a of activities) {
      if (a.sca_Type === activityType && a.sca_ActivityId) {
        ids.add(a.sca_ActivityId);
      }
    }

    return ids;
  }

  return {
    syncRecentOrderActivity: syncRecentOrderActivity
  };
})();

/**
 * Editor-pickable wrapper for the ongoing order-activity sync.
 * Smoke for the durable order.placed fix: run from the editor after orders are
 * pulled, then confirm recent orders appear in the contact Activity Timeline.
 */
function runSyncRecentOrderActivity() {
  const result = ActivityBackfillService.syncRecentOrderActivity();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
