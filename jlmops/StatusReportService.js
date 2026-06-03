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

  /**
   * Regenerate the live blocks of jlmops-status.md. Never throws.
   * @param {string} sessionId correlation id (CCP-2).
   */
  function refreshLiveBlocks(sessionId) {
    const fnName = 'refreshLiveBlocks';
    try {
      const allConfig = ConfigService.getAllConfig();
      const md = [
        '# JLMops System Status',
        '',
        '_Generated ' + _il(new Date()) + ' (Asia/Jerusalem) · live blocks (15-min cadence). KPI block: not yet wired._',
        '',
        _systemBlock(allConfig),
        _integrationsBlock(allConfig),
        _queueBlock(allConfig),
        _dataQualityBlock(),
        _capacityBlock(),
        _errorsBlock()
      ].join('\n');

      const file = _findOrCreateFile(allConfig);
      file.setContent(md);
      logger.info(SERVICE_NAME, fnName, 'Status file refreshed: ' + file.getUrl(), { sessionId: sessionId });
      return { success: true, fileId: file.getId() };
    } catch (e) {
      NotificationService.reportFailure('status_export.refresh',
        'Status export regeneration failed: ' + e.message, 'Normal', { error: e.message }, sessionId);
      return { success: false, error: e.message };
    }
  }

  return {
    refreshLiveBlocks: refreshLiveBlocks
  };
})();
