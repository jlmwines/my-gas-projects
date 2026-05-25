/**
 * @file WebAppLibrary.js
 * @description Controller for LibraryView (CONTENT_LIBRARY_PLAN.md phase 5).
 * Returns the unified task queue + library entity list in a single call.
 * Task row shape stays compatible with WebAppDashboardV2 so render scaffolding
 * can be shared during the soak window. Adds:
 *   - `packForm` per task (from taskDefinitions pack_form field)
 *   - `entityType` + `entityId` polymorphic columns (with typed-FK fallback
 *     until phase 7 chain-spawn populates them)
 *   - Library entity list from SysLibrary (via SheetAccessor.getLibrarySheet)
 *
 * Reuses these helpers from WebAppDashboardV2.js (they live in GAS global scope):
 *   - _rowsToObjects
 *   - _safeDate
 *   - _formatTaskTypeName
 *
 * Behind the `library.enabled` flag — short-circuits when off.
 */

const SYS_LIBRARY_SHEET = 'SysLibrary';

// Task types that don't appear in the queue (singletons / dashboard-backing).
const NOT_IN_QUEUE = ['task.system.health_status', 'task.system.deployment_drift'];

/**
 * Gets consolidated LibraryView data in a single call: open + recent tasks
 * for the queue, plus the library entity list.
 * @returns {Object} { success, data: { timestamp, tasks[], library[] }, error? }
 */
function WebAppLibrary_getData() {
  const serviceName = 'WebAppLibrary';
  const functionName = 'getData';

  try {
    const allConfig = ConfigService.getAllConfig();

    // Flag guard — library.enabled gates the whole subsystem.
    const flag = allConfig['library.enabled'];
    const enabled = flag && (flag.value === true || flag.value === 'true' || flag.value === 'TRUE');
    if (!enabled) {
      return { success: false, error: 'library.enabled flag is off' };
    }

    const sheetNames = allConfig['system.sheet_names'];

    // ========== READ SHEETS ==========
    const tasksSheet = SheetAccessor.getDataSheet(sheetNames.SysTasks, false);
    const tasksRaw = tasksSheet ? tasksSheet.getDataRange().getValues() : [];
    const allTasks = _rowsToObjects(tasksRaw);

    const librarySheet = SheetAccessor.getLibrarySheet(SYS_LIBRARY_SHEET, false);
    const libraryRaw = librarySheet ? librarySheet.getDataRange().getValues() : [];
    const libraryRows = _rowsToObjects(libraryRaw);

    // ========== BUILD RESULT ==========
    const result = {
      timestamp: new Date().toISOString(),
      tasks: _getQueueTasks(allTasks, allConfig),
      library: _getLibraryEntities(libraryRows)
    };

    return { success: true, data: result };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}

/**
 * Converts SysTasks rows into the queue API shape.
 * Filters out singletons; includes both open and recently-completed tasks
 * (UI's status chip filters per-view).
 * @private
 */
function _getQueueTasks(allTasks, allConfig) {
  return allTasks
    .filter(t => NOT_IN_QUEUE.indexOf(t.st_TaskTypeId) === -1)
    .filter(t => t.st_Status !== 'Cancelled')
    .map(t => {
      const taskTypeConfig = allConfig[t.st_TaskTypeId] || {};
      return {
        id: t.st_TaskId,
        typeId: t.st_TaskTypeId,
        topic: t.st_Topic || taskTypeConfig.topic || 'Other',
        name: t.st_Title || _formatTaskTypeName(t.st_TaskTypeId),
        // Polymorphic entity columns with typed-FK fallback. Once phase 7
        // chain-spawn writes st_EntityType + st_EntityId at task creation,
        // fallback paths can retire.
        entityType: t.st_EntityType || _deriveEntityType(t),
        entityId: t.st_EntityId || _deriveEntityId(t),
        entityName: t.st_LinkedEntityName || '',
        assignedTo: t.st_AssignedTo || '',
        projectId: t.st_ProjectId || '',
        sessionId: t.st_SessionId || '',
        createdDate: _safeDate(t.st_CreatedDate),
        startDate: _safeDate(t.st_StartDate),
        dueDate: _safeDate(t.st_DueDate),
        doneDate: _safeDate(t.st_DoneDate),
        status: t.st_Status,
        priority: t.st_Priority,
        notes: t.st_Notes || '',
        packForm: taskTypeConfig.pack_form || 'skeleton'
      };
    });
}

/**
 * Derives entity_type from existing typed FKs when polymorphic column is empty.
 * @private
 */
function _deriveEntityType(t) {
  const typeId = t.st_TaskTypeId || '';
  if (typeId.indexOf('task.contact.') === 0 || typeId.indexOf('task.crm.') === 0) {
    return 'customer';
  }
  if (t.st_ProjectId) {
    return 'project';
  }
  return '';
}

/**
 * Derives entity_id from existing typed FKs when polymorphic column is empty.
 * @private
 */
function _deriveEntityId(t) {
  const typeId = t.st_TaskTypeId || '';
  if (typeId.indexOf('task.contact.') === 0 || typeId.indexOf('task.crm.') === 0) {
    return t.st_LinkedEntityId || '';
  }
  if (t.st_ProjectId) {
    return t.st_ProjectId;
  }
  return t.st_LinkedEntityId || '';
}

/**
 * Converts SysLibrary rows into the library list API shape.
 * Sparse per-type extension columns; UI filters by content_type.
 * @private
 */
function _getLibraryEntities(libraryRows) {
  return libraryRows.map(row => ({
    slug: row.slb_Slug,
    title: row.slb_Title,
    contentType: row.slb_ContentType,
    language: row.slb_Language || '',
    state: row.slb_State,
    version: row.slb_Version,
    createdBy: row.slb_CreatedBy || '',
    createdDate: _safeDate(row.slb_CreatedDate),
    lastTouched: _safeDate(row.slb_LastTouched),
    tags: row.slb_Tags ? String(row.slb_Tags).split(',').map(s => s.trim()).filter(Boolean) : [],
    taxonomy: row.slb_Taxonomy ? String(row.slb_Taxonomy).split(',').map(s => s.trim()).filter(Boolean) : [],
    references: row.slb_References ? String(row.slb_References).split(',').map(s => s.trim()).filter(Boolean) : [],
    notes: row.slb_Notes || '',
    // Per-type extensions (sparse — only populated for the relevant type)
    mdUrl: row.slb_MdUrl || '',
    docUrl: row.slb_DocUrl || '',
    wpPostId: row.slb_WpPostId || '',
    canvaDesignUrl: row.slb_CanvaDesignUrl || '',
    issueNumber: row.slb_IssueNumber || '',
    printDate: _safeDate(row.slb_PrintDate),
    excerpt: row.slb_Excerpt || '',
    position: row.slb_Position || '',
    mailchimpCampaignId: row.slb_MailchimpCampaignId || '',
    subjectLine: row.slb_SubjectLine || '',
    sendDate: _safeDate(row.slb_SendDate),
    recipientCount: row.slb_RecipientCount || '',
    platform: row.slb_Platform || '',
    externalUrl: row.slb_ExternalUrl || '',
    scheduledAt: _safeDate(row.slb_ScheduledAt),
    postedAt: _safeDate(row.slb_PostedAt),
    subject: row.slb_Subject || '',
    body: row.slb_Body || '',
    channel: row.slb_Channel || '',
    kind: row.slb_Kind || '',
    index: row.slb_Index || '',
    descriptor: row.slb_Descriptor || ''
  }));
}
