/**
 * @file StatusReportService.js
 * @description Generates a flat, Claude-readable system-status markdown file in
 * Drive (reliability audit 3.2). Refreshed on the frequent-maintenance cadence so
 * a CLI session (or the operator) can read "is the system healthy right now"
 * without opening the dashboard.
 *
 * Scope (this cut): live blocks only — System / Integrations / Queue / Data
 * quality / Capacity / Recent errors. The KPI block (refreshKpiBlock, daily
 * cadence) is a separate follow-up.
 *
 * Placement: find-or-create 'jlmops-status.md' in the jlmops exports folder.
 * The file is rewritten every ~15 min, so its getLastUpdated stays fresh and it
 * is never eligible for the export-folder lifecycle cleanup.
 *
 * Never throws: the status file is a reporting surface, not a critical path. A
 * regeneration failure degrades to the previous file and reportFailure(Normal).
 */
const StatusReportService = (function() {
  const SERVICE_NAME = 'StatusReportService';
  const STATUS_FILE_NAME = 'jlmops-status.md';

  function _il(tsValue) {
    if (!tsValue) return '-';
    const d = (tsValue instanceof Date) ? tsValue : new Date(tsValue);
    if (isNaN(d)) return String(tsValue);
    return Utilities.formatDate(d, 'Asia/Jerusalem', 'yyyy-MM-dd HH:mm');
  }

  function _ageStr(tsValue) {
    if (!tsValue) return 'never';
    const d = (tsValue instanceof Date) ? tsValue : new Date(tsValue);
    if (isNaN(d)) return '?';
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    if (mins < 1440) return Math.floor(mins / 60) + ' hr ago';
    return Math.floor(mins / 1440) + ' days ago';
  }

  function _systemBlock(allConfig) {
    let version = {};
    try { version = getVersion() || {}; } catch (e) { version = {}; }
    const pinned = (allConfig['system.deployment.pinned_id'] || {}).value
      || (allConfig['system.deployment'] || {}).pinned_id || '?';
    let stage = '?';
    try {
      const session = SyncStateService.getActiveSession();
      stage = (session && session.stage) || 'IDLE';
    } catch (e) { stage = '?'; }
    return [
      '## System',
      '- Version built: ' + (version.built || '?'),
      '- Deployment (pinned): ' + String(pinned).substring(0, 16) + '…',
      '- Sync stage: ' + stage,
      ''
    ].join('\n');
  }

  function _healthNotes() {
    try {
      const task = TaskService.findOpenTaskByType('task.system.health_status', '_SYSTEM');
      if (!task) return null;
      const raw = task.notes || task.st_Notes;
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) { return null; }
  }

  function _integrationsBlock(allConfig) {
    const hb = _getIntegrationHeartbeats_v2(allConfig);
    const lines = ['## Integrations', '', '| Source | Last pull | Status |', '|---|---|---|'];
    if (!hb || !hb.available) {
      lines.push('| (unavailable) | - | ' + ((hb && hb.error) || 'no data') + ' |');
    } else {
      hb.sources.forEach(function(s) {
        const h = s.hb || {};
        const status = h.stale ? 'STALE' : 'ok';
        lines.push('| ' + s.label + ' | ' + _ageStr(h.ts) + ' (' + _il(h.ts) + ') | ' + status + ' |');
      });
    }
    lines.push('');
    return lines.join('\n');
  }

  function _queueBlock(allConfig) {
    const lines = ['## Queue (SysJobQueue)'];
    try {
      const sheetNames = allConfig['system.sheet_names'];
      const sheet = SheetAccessor.getLogSheet(sheetNames.SysJobQueue, false);
      const jobSchema = allConfig['schema.log.SysJobQueue'];
      if (!sheet || !jobSchema || !jobSchema.headers) {
        lines.push('- (queue unavailable)', '');
        return lines.join('\n');
      }
      const headers = jobSchema.headers.split(',');
      const statusCol = headers.indexOf('status');
      const procCol = headers.indexOf('processed_timestamp');
      const data = sheet.getDataRange().getValues();
      const counts = { pending: 0, processing: 0, completed: 0, failed: 0, other: 0 };
      let oldestFailedMs = null;
      for (let i = 1; i < data.length; i++) {
        const st = String(data[i][statusCol]).toLowerCase();
        if (counts[st] === undefined) counts.other++; else counts[st]++;
        if (st === 'failed' && procCol !== -1 && data[i][procCol]) {
          const t = new Date(data[i][procCol]).getTime();
          if (!isNaN(t) && (oldestFailedMs === null || t < oldestFailedMs)) oldestFailedMs = t;
        }
      }
      let failedLine = '- FAILED: ' + counts.failed;
      if (counts.failed > 0 && oldestFailedMs !== null) {
        failedLine += ' (oldest ' + Math.floor((Date.now() - oldestFailedMs) / 86400000) + 'd)';
      }
      lines.push(
        '- PENDING: ' + counts.pending + ' · PROCESSING: ' + counts.processing +
        ' · COMPLETED: ' + counts.completed,
        failedLine, ''
      );
    } catch (e) {
      lines.push('- (queue read error: ' + e.message + ')', '');
    }
    return lines.join('\n');
  }

  function _dataQualityBlock() {
    const notes = _healthNotes();
    const hk = (notes && notes.last_housekeeping) || {};
    return [
      '## Data quality (last housekeeping)',
      '- Last run: ' + (hk.status || '?') + ' @ ' + _il(hk.timestamp),
      '- Unit tests: ' + (hk.unit_tests || '?') + ' · Validation issues: ' +
        (hk.validation_issues != null ? hk.validation_issues : '?') +
        ' · Schema: ' + (hk.schema_status || '?') + ' (critical ' + (hk.schema_critical != null ? hk.schema_critical : '?') + ')',
      '- Failed jobs: ' + (hk.failed_job_count != null ? hk.failed_job_count : '?') +
        (hk.failed_job_oldest_age_days != null ? ' (oldest ' + hk.failed_job_oldest_age_days + 'd)' : ''),
      ''
    ].join('\n');
  }

  function _capacityBlock() {
    const lines = ['## Capacity (rows per data sheet)', '', '| Sheet | Rows |', '|---|---|'];
    try {
      const sheets = SheetAccessor.getDataSpreadsheet().getSheets();
      sheets.forEach(function(sh) {
        lines.push('| ' + sh.getName() + ' | ' + Math.max(0, sh.getLastRow() - 1) + ' |');
      });
    } catch (e) {
      lines.push('| (unavailable) | - |');
    }
    lines.push('');
    return lines.join('\n');
  }

  function _errorsBlock() {
    const lines = ['## Recent errors (most recent first)'];
    const errs = LoggerService.getRecentErrors(10);
    if (!errs.length) {
      lines.push('- none in the recent window', '');
      return lines.join('\n');
    }
    errs.forEach(function(e) {
      lines.push('- ' + _il(e.timestamp) + ' [' + (e.service || '?') + '.' + (e.fn || '?') + '] ' +
        String(e.message || '').substring(0, 160));
    });
    lines.push('');
    return lines.join('\n');
  }

  function _findOrCreateFile(allConfig) {
    const folderCfg = allConfig['system.folder.jlmops_exports'];
    if (!folderCfg || !folderCfg.id) throw new Error('system.folder.jlmops_exports not configured');
    const folder = DriveApp.getFolderById(folderCfg.id);
    const existing = folder.getFilesByName(STATUS_FILE_NAME);
    if (existing.hasNext()) return existing.next();
    return folder.createFile(STATUS_FILE_NAME, '', 'text/plain');
  }

  // ── Section-aware write ──────────────────────────────────────────────────
  // The file carries two sentinel-wrapped sections written on independent
  // cadences (health = 15-min, kpi = daily/on-demand). Each writer reads the
  // current file, preserves the OTHER section, and re-composes the whole doc —
  // so neither cadence clobbers the other, and a pre-sentinel legacy file is
  // cleanly migrated on first write (the unparsed body is dropped, the missing
  // section becomes a placeholder).

  function _readSection(content, name) {
    if (!content) return null;
    const s = '<!-- ' + name + ':start -->', e = '<!-- ' + name + ':end -->';
    const si = content.indexOf(s), ei = content.indexOf(e);
    if (si === -1 || ei === -1 || ei < si) return null;
    return content.substring(si + s.length, ei).replace(/^\n/, '').replace(/\n$/, '');
  }

  function _composeDoc(healthInner, kpiInner) {
    return [
      '# JLMops System Status', '',
      '<!-- health:start -->',
      healthInner || '_Health: not yet generated._',
      '<!-- health:end -->', '',
      '<!-- kpi:start -->',
      kpiInner || '_KPIs: not yet generated (daily cadence, or Dev → Push Status Export)._',
      '<!-- kpi:end -->', ''
    ].join('\n');
  }

  // ── KPI helpers ──────────────────────────────────────────────────────────
  function _num(v) {
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  function _windowStart(daysBack) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - daysBack); return d;
  }
  function _monthStart() {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  function _ilDate(d) {
    return (d && !isNaN(d)) ? Utilities.formatDate(d, 'Asia/Jerusalem', 'yyyy-MM-dd') : '-';
  }
  function _parseYmd(v) {
    if (v instanceof Date) return isNaN(v) ? null : v;
    const s = String(v).trim();
    if (/^\d{8}$/.test(s)) return new Date(+s.substr(0, 4), +s.substr(4, 2) - 1, +s.substr(6, 2));
    const d = new Date(s); return isNaN(d) ? null : d;
  }

  // Orders + customers from WebOrdM / SysContacts (fresh aggregators; the V2
  // dashboard refactor is deferred to Tier 6.8 per the plan).
  function _internalKpisBlock(allConfig) {
    const lines = ['### Orders & customers (ops data)'];
    try {
      const sheetNames = allConfig['system.sheet_names'] || {};
      const ds = SheetAccessor.getDataSpreadsheet();
      const oSheet = ds.getSheetByName(sheetNames.WebOrdM || 'WebOrdM');
      if (!oSheet) { lines.push('- (WebOrdM unavailable)', ''); return lines.join('\n'); }
      const ov = oSheet.getDataRange().getValues();
      const OH = ov[0] || [];
      const oc = n => OH.indexOf(n);
      const dCol = oc('wom_OrderDate'), tCol = oc('wom_OrderTotal'), sCol = oc('wom_Status'),
            lCol = oc('wom_MetaWpmlLanguage'), eCol = oc('wom_BillingEmail');
      const today = _windowStart(0), wk = _windowStart(7), mo = _monthStart();
      const valid = st => {
        const s = String(st).replace(/^wc-/, '').toLowerCase();
        return s === 'processing' || s === 'completed' || s === 'on-hold' || s === 'onhold';
      };

      // email -> first-completed map, and first-ever buyers this month
      const firstMap = {}; let newBuyersThisMonth = 0;
      const cSheet = ds.getSheetByName(sheetNames.SysContacts || 'SysContacts');
      if (cSheet) {
        const cv = cSheet.getDataRange().getValues();
        const CH = cv[0] || [];
        const fcCol = CH.indexOf('sc_FirstCompletedDate'), emCol = CH.indexOf('sc_Email');
        for (let i = 1; i < cv.length; i++) {
          const em = String(cv[i][emCol] || '').toLowerCase();
          const fcRaw = fcCol !== -1 ? cv[i][fcCol] : null;
          const fc = fcRaw ? new Date(fcRaw) : null;
          if (em && fc && !isNaN(fc)) firstMap[em] = fc;
          if (fc && !isNaN(fc) && fc >= mo) newBuyersThisMonth++;
        }
      }

      const W = { t: { c: 0, r: 0 }, w: { c: 0, r: 0 }, m: { c: 0, r: 0, en: 0, he: 0, nw: 0, ret: 0 } };
      for (let i = 1; i < ov.length; i++) {
        const dv = dCol !== -1 ? ov[i][dCol] : null; if (!dv) continue;
        const d = new Date(dv); if (isNaN(d)) continue;
        if (!valid(ov[i][sCol])) continue;
        const tot = _num(ov[i][tCol]);
        if (d >= today) { W.t.c++; W.t.r += tot; }
        if (d >= wk) { W.w.c++; W.w.r += tot; }
        if (d >= mo) {
          W.m.c++; W.m.r += tot;
          const lang = String(ov[i][lCol] || '').toLowerCase();
          if (lang.indexOf('he') !== -1) W.m.he++; else W.m.en++;
          const em = String(ov[i][eCol] || '').toLowerCase();
          const fc = firstMap[em];
          if (fc && fc >= mo) W.m.nw++; else if (fc) W.m.ret++; else W.m.nw++;
        }
      }
      const aov = W.m.c ? Math.round(W.m.r / W.m.c) : 0;
      lines.push('- Today: ' + W.t.c + ' orders · ₪' + Math.round(W.t.r));
      lines.push('- Last 7d: ' + W.w.c + ' orders · ₪' + Math.round(W.w.r));
      lines.push('- MTD: ' + W.m.c + ' orders · ₪' + Math.round(W.m.r) + ' · AOV ₪' + aov);
      lines.push('- MTD language: ' + W.m.en + ' EN · ' + W.m.he + ' HE');
      lines.push('- MTD new-vs-returning: ' + W.m.nw + ' new · ' + W.m.ret + ' returning (· ' + newBuyersThisMonth + ' first-ever buyers this month)');
      lines.push('- _Counts exclude cancelled/refunded/failed/pending orders._');
    } catch (e) {
      lines.push('- (orders KPI error: ' + e.message + ')');
    }
    lines.push('');
    return lines.join('\n');
  }

  // GA4 add-on output: window-aggregate by the `date` column. Columns located by
  // header name (robust to position). Returns {ok,reason} on any miss — never throws.
  function _readGa4(cfg) {
    if (!cfg || !cfg.id) return { ok: false, reason: 'not configured' };
    let ss;
    try { ss = SpreadsheetApp.openById(cfg.id); } catch (e) { return { ok: false, reason: 'open failed: ' + e.message }; }
    let sheet = cfg.data_tab ? ss.getSheetByName(cfg.data_tab) : null;
    if (!sheet) sheet = ss.getSheets()[0];
    if (!sheet) return { ok: false, reason: 'no sheet' };
    const vals = sheet.getDataRange().getValues();
    let hr = -1, H = null;
    for (let i = 0; i < Math.min(vals.length, 15); i++) {
      const row = vals[i].map(c => String(c).trim().toLowerCase());
      if (row.indexOf('date') !== -1 && row.indexOf('sessions') !== -1) { hr = i; H = row; break; }
    }
    if (hr === -1) return { ok: false, reason: 'header row not found' };
    const c = {
      date: H.indexOf('date'), s: H.indexOf('sessions'), u: H.indexOf('activeusers'),
      nu: H.indexOf('newusers'), eng: H.indexOf('engagementrate'), ke: H.indexOf('keyevents'), rev: H.indexOf('totalrevenue')
    };
    const wk = _windowStart(7), mo = _monthStart();
    const blank = () => ({ s: 0, u: 0, nu: 0, ke: 0, rev: 0, engW: 0 });
    const agg = { w: blank(), m: blank() }; let maxD = null;
    for (let i = hr + 1; i < vals.length; i++) {
      const dv = vals[i][c.date]; if (dv === '' || dv == null) continue;
      const d = _parseYmd(dv); if (!d) continue;
      if (!maxD || d > maxD) maxD = d;
      const sess = _num(vals[i][c.s]);
      const add = b => { b.s += sess; b.u += _num(vals[i][c.u]); b.nu += _num(vals[i][c.nu]); b.ke += _num(vals[i][c.ke]); b.rev += _num(vals[i][c.rev]); b.engW += _num(vals[i][c.eng]) * sess; };
      if (d >= mo) add(agg.m);
      if (d >= wk) add(agg.w);
    }
    return { ok: true, maxDate: maxD, w: agg.w, m: agg.m };
  }

  // GSC (Search Analytics for Sheets) output. Requires a Date column — if the
  // report is still Page-grouped only, returns ok:false with that reason.
  function _readGsc(cfg) {
    if (!cfg || !cfg.id) return { ok: false, reason: 'not configured' };
    let ss;
    try { ss = SpreadsheetApp.openById(cfg.id); } catch (e) { return { ok: false, reason: 'open failed: ' + e.message }; }
    let sheet = cfg.data_tab ? ss.getSheetByName(cfg.data_tab) : null;
    if (!sheet) sheet = ss.getSheets()[0];
    if (!sheet) return { ok: false, reason: 'no sheet' };
    const vals = sheet.getDataRange().getValues();
    let hr = -1, H = null;
    for (let i = 0; i < Math.min(vals.length, 15); i++) {
      const row = vals[i].map(c => String(c).trim().toLowerCase());
      if (row.indexOf('clicks') !== -1 && row.indexOf('impressions') !== -1) { hr = i; H = row; break; }
    }
    if (hr === -1) return { ok: false, reason: 'header row not found' };
    const dCol = H.indexOf('date');
    if (dCol === -1) return { ok: false, reason: 'no Date dimension yet (still Page-grouped)' };
    const clCol = H.indexOf('clicks'), imCol = H.indexOf('impressions'), poCol = H.indexOf('position');
    const wk = _windowStart(7), mo = _monthStart();
    const blank = () => ({ clicks: 0, impr: 0, posW: 0 });
    const agg = { w: blank(), m: blank() }; let maxD = null;
    for (let i = hr + 1; i < vals.length; i++) {
      const dv = vals[i][dCol]; if (dv === '' || dv == null) continue;
      const d = _parseYmd(dv); if (!d) continue;
      if (!maxD || d > maxD) maxD = d;
      const cl = _num(vals[i][clCol]), im = _num(vals[i][imCol]), po = poCol !== -1 ? _num(vals[i][poCol]) : 0;
      const add = b => { b.clicks += cl; b.impr += im; b.posW += po * im; };
      if (d >= mo) add(agg.m);
      if (d >= wk) add(agg.w);
    }
    return { ok: true, maxDate: maxD, w: agg.w, m: agg.m };
  }

  function _trafficBlock(allConfig) {
    const lines = ['### Traffic (GA4 + Search Console)'];
    const ga = _readGa4(allConfig['system.sheet.ga4_report']);
    if (ga.ok) {
      const eng = w => w.s ? (w.engW / w.s * 100).toFixed(0) + '%' : '-';
      lines.push('- GA4 (latest data ' + _ilDate(ga.maxDate) + '):');
      lines.push('  - 7d: ' + ga.w.s + ' sessions · ' + ga.w.u + ' users · ' + ga.w.nu + ' new · eng ' + eng(ga.w) + ' · ' + ga.w.ke + ' key events');
      lines.push('  - MTD: ' + ga.m.s + ' sessions · ' + ga.m.u + ' users · ' + ga.m.nu + ' new · ' + ga.m.ke + ' key events · ₪' + Math.round(ga.m.rev));
    } else {
      lines.push('- GA4: no data (' + ga.reason + ')');
    }
    const gs = _readGsc(allConfig['system.sheet.gsc_report']);
    if (gs.ok) {
      const pos = w => w.impr ? (w.posW / w.impr).toFixed(1) : '-';
      lines.push('- GSC (latest data ' + _ilDate(gs.maxDate) + '):');
      lines.push('  - 7d: ' + gs.w.clicks + ' clicks · ' + gs.w.impr + ' impr · avg pos ' + pos(gs.w));
      lines.push('  - MTD: ' + gs.m.clicks + ' clicks · ' + gs.m.impr + ' impr · avg pos ' + pos(gs.m));
    } else {
      lines.push('- GSC: no data (' + gs.reason + ')');
    }
    lines.push('');
    return lines.join('\n');
  }

  function _buildKpiInner(allConfig) {
    return [
      '_KPIs — generated ' + _il(new Date()) + ' (Asia/Jerusalem) · daily cadence + on-demand._', '',
      '## KPIs',
      _internalKpisBlock(allConfig),
      _trafficBlock(allConfig)
    ].join('\n');
  }

  // ── Public refreshers ────────────────────────────────────────────────────
  /**
   * Regenerate the live (health) section of jlmops-status.md. Never throws.
   * Preserves the KPI section. @param {string} sessionId correlation id (CCP-2).
   */
  function refreshLiveBlocks(sessionId) {
    const fnName = 'refreshLiveBlocks';
    try {
      const allConfig = ConfigService.getAllConfig();
      const healthInner = [
        '_Health — generated ' + _il(new Date()) + ' (Asia/Jerusalem) · 15-min cadence._', '',
        _systemBlock(allConfig),
        _integrationsBlock(allConfig),
        _queueBlock(allConfig),
        _dataQualityBlock(),
        _capacityBlock(),
        _errorsBlock()
      ].join('\n');

      const file = _findOrCreateFile(allConfig);
      const kpiInner = _readSection(file.getBlob().getDataAsString(), 'kpi');
      file.setContent(_composeDoc(healthInner, kpiInner));
      logger.info(SERVICE_NAME, fnName, 'Status file (health) refreshed: ' + file.getUrl(), { sessionId: sessionId });
      return { success: true, fileId: file.getId() };
    } catch (e) {
      NotificationService.reportFailure('status_export.refresh',
        'Status export (health) regeneration failed: ' + e.message, 'Normal', { error: e.message }, sessionId);
      return { success: false, error: e.message };
    }
  }

  /**
   * Regenerate the KPI section (orders/customers + GA4/GSC traffic) of
   * jlmops-status.md. Never throws. Preserves the health section.
   * @param {string} sessionId correlation id (CCP-2).
   */
  function refreshKpiBlock(sessionId) {
    const fnName = 'refreshKpiBlock';
    try {
      const allConfig = ConfigService.getAllConfig();
      const kpiInner = _buildKpiInner(allConfig);
      const file = _findOrCreateFile(allConfig);
      const healthInner = _readSection(file.getBlob().getDataAsString(), 'health');
      file.setContent(_composeDoc(healthInner, kpiInner));
      logger.info(SERVICE_NAME, fnName, 'Status file (KPI) refreshed: ' + file.getUrl(), { sessionId: sessionId });
      return { success: true, fileId: file.getId() };
    } catch (e) {
      NotificationService.reportFailure('status_export.refresh',
        'Status export (KPI) regeneration failed: ' + e.message, 'Normal', { error: e.message }, sessionId);
      return { success: false, error: e.message };
    }
  }

  /**
   * Write the merged publishing calendar back to JLMops_Publishing:
   * keeps holiday/blackout/note rows (manually maintained), regenerates all
   * other rows from SysLibrary entities that have a slb_TargetDate, sorts the
   * whole sheet by date. Sessions read the result via Drive MCP. Never throws.
   * @param {string} sessionId correlation id (CCP-2).
   */
  function refreshCalendarExport(sessionId) {
    const fnName = 'refreshCalendarExport';
    const MANUAL_TYPES = ['holiday', 'blackout', 'note'];
    try {
      const allConfig = ConfigService.getAllConfig();
      const sheetId = allConfig['system.calendar.sheet_id'] && allConfig['system.calendar.sheet_id'].id;
      if (!sheetId) throw new Error('system.calendar.sheet_id not configured');

      const ss = SpreadsheetApp.openById(sheetId);
      const sheet = ss.getSheets()[0];
      if (!sheet) throw new Error('No sheet in JLMops_Publishing');

      const existing = sheet.getDataRange().getValues();
      if (existing.length < 1) throw new Error('Sheet has no header row');
      const headers = existing[0].map(function(h) { return String(h).trim(); });
      const dateIdx  = headers.indexOf('cal_Date'),  nameIdx  = headers.indexOf('cal_Name'),
            typeIdx  = headers.indexOf('cal_Type'),  notesIdx = headers.indexOf('cal_Notes');
      if (dateIdx === -1 || nameIdx === -1 || typeIdx === -1) throw new Error('Missing required headers');

      // Preserve manually-maintained rows
      const manual = existing.slice(1).filter(function(row) {
        return MANUAL_TYPES.indexOf(String(row[typeIdx] || '').trim().toLowerCase()) !== -1;
      });

      // Build entity rows from SysLibrary
      const entityRows = [];
      const libSheet = SheetAccessor.getLibrarySheet('SysLibrary');
      if (libSheet) {
        const lv = libSheet.getDataRange().getValues();
        const LH = lv[0];
        const slugC  = LH.indexOf('slb_Slug'),    titleC = LH.indexOf('slb_Title'),
              typeC  = LH.indexOf('slb_ContentType'), stateC = LH.indexOf('slb_State'),
              dateC  = LH.indexOf('slb_TargetDate'), campC  = LH.indexOf('slb_CampaignId');
        if (slugC !== -1 && dateC !== -1) {
          for (var i = 1; i < lv.length; i++) {
            var row = lv[i];
            var dv = row[dateC];
            if (!dv) continue;
            var d = dv instanceof Date ? dv : new Date(dv);
            if (isNaN(d.getTime())) continue;
            var slug  = String(row[slugC]  || '').trim(); if (!slug) continue;
            var title = String(titleC > -1 ? row[titleC] : slug).trim() || slug;
            var ctype = String(typeC  > -1 ? row[typeC]  : '').trim() || 'other';
            var state = String(stateC > -1 ? row[stateC] : '').trim();
            var camp  = String(campC  > -1 ? row[campC]  : '').trim();
            var newRow = new Array(headers.length).fill('');
            newRow[dateIdx]  = d;
            newRow[nameIdx]  = title;
            newRow[typeIdx]  = ctype;
            if (notesIdx > -1) newRow[notesIdx] = state + (camp ? ' · ' + camp : '');
            entityRows.push({ d: d, row: newRow });
          }
        }
      }

      // Merge and sort
      var allRows = manual.map(function(row) {
        var dv = row[dateIdx];
        var d = dv instanceof Date ? dv : new Date(String(dv));
        return { d: isNaN(d) ? new Date(0) : d, row: row };
      }).concat(entityRows);
      allRows.sort(function(a, b) { return a.d.getTime() - b.d.getTime(); });

      // Write back (clear data rows only, keep header)
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
      if (allRows.length > 0) {
        sheet.getRange(2, 1, allRows.length, headers.length).setValues(allRows.map(function(r) { return r.row; }));
      }

      logger.info(SERVICE_NAME, fnName,
        'Calendar refreshed: ' + manual.length + ' manual + ' + entityRows.length + ' entities = ' + allRows.length + ' rows',
        { sessionId: sessionId });
      return { success: true, rows: allRows.length };
    } catch (e) {
      NotificationService.reportFailure('status_export.calendar_refresh',
        'Calendar export failed: ' + e.message, 'Normal', { error: e.message }, sessionId);
      return { success: false, error: e.message };
    }
  }

  return {
    refreshLiveBlocks: refreshLiveBlocks,
    refreshKpiBlock: refreshKpiBlock,
    refreshCalendarExport: refreshCalendarExport
  };
})();
