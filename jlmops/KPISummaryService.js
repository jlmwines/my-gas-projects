/**
 * @file KPISummaryService.js
 * @description Pre-computes business/KPI.md's 4 jlmops-source KPIs (new
 * customers EN/HE, first-order conversion + AOV, 90-day return rate,
 * newsletter subscribers + engagement) into SysKPISummary, so
 * StatusReportService's KPI block can read 13 rows instead of walking
 * SysContacts/SysCouponUsage/SysCampaigns per session. Full spec:
 * jlmops/plans/KPI_SUMMARY_TAB.md.
 *
 * "New customer" is defined by sc_FirstCompletedDate (first COMPLETED
 * order, same definition createWelcomeOutreachTasks uses) - not
 * sc_FirstOrderDate, which includes cancelled/pending orders.
 *
 * Never throws: recomputeCurrent/closeMonth degrade to a logged failure,
 * same convention as StatusReportService. This is a reporting cache, not
 * a critical path.
 */
const KPISummaryService = (function() {
  const SERVICE_NAME = 'KPISummaryService';
  const SHEET_NAME = 'SysKPISummary';

  function _sheet() {
    const ds = SheetAccessor.getDataSpreadsheet();
    return ds.getSheetByName(SHEET_NAME);
  }

  function _headerIndex(headerRow) {
    const idx = {};
    headerRow.forEach((h, i) => { idx[h] = i; });
    return idx;
  }

  // Boolean columns in this codebase are written as either a real GAS
  // boolean or the string 'TRUE' (confirmed live, ContactService.js:933
  // checks both) - never rely on === true alone.
  function _isTrue(v) {
    return v === true || v === 'TRUE';
  }

  function _firstPurchaseCoupons(allConfig) {
    const cfg = allConfig['kpi.first_purchase_coupons'];
    const raw = cfg && cfg.value ? String(cfg.value) : '';
    return raw.split(',').map(function(s) { return s.trim().toLowerCase(); }).filter(Boolean);
  }

  /**
   * Core metrics for a [start, end) window. Return-rate/subscriber counts
   * are point-in-time snapshots as of `end`, not period-bounded sums -
   * matches the spec's "frozen at month-close" contract.
   */
  function _computeWindow(allConfig, start, end) {
    const ds = SheetAccessor.getDataSpreadsheet();
    const sheetNames = allConfig['system.sheet_names'] || {};

    // --- SysContacts: new customers EN/HE, return rate, subscribers ---
    const cSheet = ds.getSheetByName(sheetNames.SysContacts || 'SysContacts');
    let newEN = 0, newHE = 0, coreTotal = 0, return90 = 0, subscribers = 0;
    if (cSheet && cSheet.getLastRow() > 1) {
      const cv = cSheet.getDataRange().getValues();
      const CH = _headerIndex(cv[0]);
      for (let i = 1; i < cv.length; i++) {
        const row = cv[i];
        const lang = String(row[CH.sc_Language] || '').toUpperCase();
        const isCore = _isTrue(row[CH.sc_IsCore]);

        const fcdRaw = CH.sc_FirstCompletedDate !== undefined ? row[CH.sc_FirstCompletedDate] : null;
        const fcd = fcdRaw ? new Date(fcdRaw) : null;
        if (isCore && fcd && !isNaN(fcd) && fcd >= start && fcd < end) {
          if (lang === 'HE') newHE++; else newEN++;
        }

        if (isCore) {
          coreTotal++;
          if (_isTrue(row[CH.sc_IsCustomer])) {
            const days = Number(row[CH.sc_DaysSinceOrder]);
            if (!isNaN(days) && days <= 90) return90++;
          }
        }

        if (_isTrue(row[CH.sc_IsSubscribed])) subscribers++;
      }
    }

    // --- SysCouponUsage: first-order conversion rate + AOV ---
    const couSheet = ds.getSheetByName(sheetNames.SysCouponUsage || 'SysCouponUsage');
    const firstPurchaseCodes = _firstPurchaseCoupons(allConfig);
    let convCount = 0, convTotal = 0;
    if (couSheet && couSheet.getLastRow() > 1) {
      const uv = couSheet.getDataRange().getValues();
      const UH = _headerIndex(uv[0]);
      for (let i = 1; i < uv.length; i++) {
        const row = uv[i];
        const dRaw = row[UH.scu_OrderDate];
        const d = dRaw ? new Date(dRaw) : null;
        if (!d || isNaN(d) || d < start || d >= end) continue;
        if (!_isTrue(row[UH.scu_WasFirstOrder])) continue;
        const code = String(row[UH.scu_Code] || '').trim().toLowerCase();
        if (firstPurchaseCodes.length && firstPurchaseCodes.indexOf(code) === -1) continue;
        convCount++;
        convTotal += Number(row[UH.scu_OrderTotal]) || 0;
      }
    }
    const newCustomersTotal = newEN + newHE;

    // --- SysCampaigns: campaigns sent + mean open/click in window ---
    const cmSheet = ds.getSheetByName(sheetNames.SysCampaigns || 'SysCampaigns');
    let campaignsSent = 0, openSum = 0, clickSum = 0;
    if (cmSheet && cmSheet.getLastRow() > 1) {
      const mv = cmSheet.getDataRange().getValues();
      const MH = _headerIndex(mv[0]);
      for (let i = 1; i < mv.length; i++) {
        const row = mv[i];
        const dRaw = row[MH.scm_SendDate];
        const d = dRaw ? new Date(dRaw) : null;
        if (!d || isNaN(d) || d < start || d >= end) continue;
        campaignsSent++;
        openSum += Number(row[MH.scm_OpenRate]) || 0;
        clickSum += Number(row[MH.scm_ClickRate]) || 0;
      }
    }

    return {
      sk_NewCustomersEN: newEN,
      sk_NewCustomersHE: newHE,
      sk_NewCustomersTotal: newCustomersTotal,
      sk_FirstOrderConvRate: newCustomersTotal > 0 ? convCount / newCustomersTotal : '',
      sk_FirstOrderAOV: convCount > 0 ? Math.round((convTotal / convCount) * 100) / 100 : '',
      sk_Return90Rate: coreTotal > 0 ? Math.round((return90 / coreTotal) * 1000) / 1000 : '',
      sk_TotalCoreCustomers: coreTotal,
      sk_Subscribers: subscribers,
      sk_CampaignsSent: campaignsSent,
      sk_AvgOpenRate: campaignsSent > 0 ? Math.round((openSum / campaignsSent) * 1000) / 1000 : '',
      sk_AvgClickRate: campaignsSent > 0 ? Math.round((clickSum / campaignsSent) * 1000) / 1000 : ''
    };
  }

  /**
   * Insert or overwrite the row keyed by sk_Period. Returns the row's
   * previous values (for MoM deltas) or null if it didn't exist.
   */
  function _upsertRow(sheet, headers, period, metrics) {
    const HI = _headerIndex(headers);
    const lastRow = sheet.getLastRow();
    let targetRow = -1;
    let previous = null;
    if (lastRow > 1) {
      const periods = sheet.getRange(2, HI.sk_Period + 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < periods.length; i++) {
        if (String(periods[i][0]) === period) { targetRow = i + 2; break; }
      }
      if (targetRow !== -1) {
        previous = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
      }
    }
    if (targetRow === -1) targetRow = lastRow + 1;

    const out = new Array(headers.length).fill('');
    out[HI.sk_Period] = period;
    out[HI.sk_AsOfTimestamp] = new Date();
    Object.keys(metrics).forEach(function(k) {
      if (HI[k] !== undefined) out[HI[k]] = metrics[k];
    });
    sheet.getRange(targetRow, 1, 1, headers.length).setValues([out]);
    return previous;
  }

  function _monthWindow(yyyymm) {
    const parts = String(yyyymm).split('-');
    const y = Number(parts[0]), m = Number(parts[1]);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    return { start: start, end: end };
  }

  /**
   * Recompute the rolling `current` row (trailing 90 days, per the spec -
   * aligns with KPI #4's own 90-day definition). Called daily by
   * HousekeepingService, after refreshCrmContacts so sc_FirstCompletedDate
   * is fresh.
   */
  function recomputeCurrent() {
    const fnName = 'recomputeCurrent';
    try {
      const sheet = _sheet();
      if (!sheet) { logger.warn(SERVICE_NAME, fnName, SHEET_NAME + ' sheet not found - skipping.'); return { success: false }; }
      const allConfig = ConfigService.getAllConfig();
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

      const end = new Date();
      const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
      const metrics = _computeWindow(allConfig, start, end);
      _upsertRow(sheet, headers, 'current', metrics);

      logger.info(SERVICE_NAME, fnName, 'current row recomputed.');
      return { success: true };
    } catch (e) {
      logger.error(SERVICE_NAME, fnName, 'Failed: ' + e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Close a calendar month, freezing its row. Idempotent - overwrites if
   * already closed. Manual backfill path: call once per historical month.
   * @param {string} yyyymm e.g. "2026-06".
   */
  function closeMonth(yyyymm) {
    const fnName = 'closeMonth';
    try {
      const sheet = _sheet();
      if (!sheet) { logger.warn(SERVICE_NAME, fnName, SHEET_NAME + ' sheet not found - skipping.'); return { success: false }; }
      const allConfig = ConfigService.getAllConfig();
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const HI = _headerIndex(headers);

      const win = _monthWindow(yyyymm);
      const metrics = _computeWindow(allConfig, win.start, win.end);

      // Prior month's subscriber count for MoM delta.
      const priorYm = (function() {
        const d = new Date(win.start.getTime());
        d.setMonth(d.getMonth() - 1);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      })();
      const lastRow = sheet.getLastRow();
      let priorSubs = null;
      if (lastRow > 1) {
        const periods = sheet.getRange(2, HI.sk_Period + 1, lastRow - 1, 1).getValues();
        for (let i = 0; i < periods.length; i++) {
          if (String(periods[i][0]) === priorYm) {
            priorSubs = sheet.getRange(i + 2, HI.sk_Subscribers + 1, 1, 1).getValues()[0][0];
            break;
          }
        }
      }
      if (priorSubs !== null && priorSubs !== '') {
        metrics.sk_SubscriberGrowthMoM = metrics.sk_Subscribers - Number(priorSubs);
      }

      _upsertRow(sheet, headers, yyyymm, metrics);
      logger.info(SERVICE_NAME, fnName, yyyymm + ' row closed.');
      return { success: true };
    } catch (e) {
      logger.error(SERVICE_NAME, fnName, 'Failed: ' + e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Runs closeMonth for the previous calendar month if today is the 1st.
   * Called from the same daily task as recomputeCurrent - no separate
   * trigger/phase needed.
   */
  function maybeCloseMonth() {
    const today = new Date();
    if (today.getDate() !== 1) return { success: true, skipped: true };
    const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const yyyymm = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
    return closeMonth(yyyymm);
  }

  /**
   * Admin backfill path - iterate closeMonth for each given period.
   * @param {string[]} months e.g. ["2026-01", "2026-02", ...].
   */
  function backfillMonths(months) {
    const results = {};
    months.forEach(function(ym) { results[ym] = closeMonth(ym); });
    return results;
  }

  return {
    recomputeCurrent: recomputeCurrent,
    closeMonth: closeMonth,
    maybeCloseMonth: maybeCloseMonth,
    backfillMonths: backfillMonths
  };
})();

/**
 * Global function to recompute the SysKPISummary 'current' row on demand.
 */
function runKpiSummaryRecompute() {
  return KPISummaryService.recomputeCurrent();
}

/**
 * Global function for one-time backfill of historical months. Idempotent -
 * safe to re-run.
 */
function runKpiSummaryBackfill() {
  return KPISummaryService.backfillMonths(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
}
