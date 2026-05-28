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

// ===== ACTION WRAPPERS (CONTENT_LIBRARY_PLAN §17 phase 7) =====
// State-changing endpoints. Action envelope per §11:
//   { ok, updated: {entity?, entities?, tasks?}, error?, validation? }
// Read endpoint (WebAppLibrary_getData above) keeps its existing
// {success, data, error} shape — settled 2026-05-26.

/**
 * Creates a SysLibrary entity row.
 * @param {Object} params - { slug, type, language, title, references, typeFields }
 * @returns {Object} { ok, updated: { entity }, error?, validation? }
 */
function WebAppLibrary_addEntity(params) {
  const serviceName = 'WebAppLibrary';
  const functionName = 'addEntity';

  try {
    const result = LibraryService.addEntity(params || {});
    const shaped = _getLibraryEntities([result.entity])[0];
    return {
      ok: true,
      updated: { entity: shaped },
      deduplicated: result.deduplicated
    };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { ok: false, error: e.message };
  }
}

/**
 * Spawns a content task chain: entity rows + tasks attached via the polymorphic
 * SysTasks columns. For sibling-language types (blog/news/mention/email/social)
 * creates EN+HE entity rows; otherwise creates a single row.
 * @param {Object} params - { entityType, baseSlug, contentName, stages, streamId }
 * @returns {Object} { ok, updated: { entities, tasks }, streamCode, deduplicated_entities, error? }
 */
function WebAppLibrary_spawnContentChain(params) {
  const serviceName = 'WebAppLibrary';
  const functionName = 'spawnContentChain';

  try {
    const result = LibraryService.spawnContentChain(params || {});
    const shapedEntities = _getLibraryEntities(result.entities);
    // Tasks come back from TaskService.createTask as {id}; UI re-fetches via
    // WebAppLibrary_getData to pick up the full queue shape.
    return {
      ok: true,
      updated: {
        entities: shapedEntities,
        tasks: result.tasks
      },
      streamCode: result.streamCode,
      deduplicated_entities: result.deduplicated_entities
    };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { ok: false, error: e.message };
  }
}

/**
 * Creates a blank Google Doc at the canonical Drive path for this entity.
 * @param {Object} params - { entityId }
 * @returns {Object} { ok, updated: { entity }, docUrl, error? }
 */
function WebAppLibrary_createBlankDoc(params) {
  const serviceName = 'WebAppLibrary';
  const functionName = 'createBlankDoc';

  try {
    const result = LibraryService.createBlankDoc(params || {});
    const shaped = _getLibraryEntities([result.entity])[0];
    return {
      ok: true,
      updated: { entity: shaped },
      docUrl: result.docUrl
    };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { ok: false, error: e.message };
  }
}

/**
 * Attaches an existing Drive file to this entity (moves to canonical folder + renames).
 * @param {Object} params - { entityId, driveUrl }
 * @returns {Object} { ok, updated: { entity }, docUrl, error? }
 */
function WebAppLibrary_attachExistingDoc(params) {
  const serviceName = 'WebAppLibrary';
  const functionName = 'attachExistingDoc';

  try {
    const result = LibraryService.attachExistingDoc(params || {});
    const shaped = _getLibraryEntities([result.entity])[0];
    return {
      ok: true,
      updated: { entity: shaped },
      docUrl: result.docUrl
    };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { ok: false, error: e.message };
  }
}

/**
 * Locks the entity at next version, closes the originating task, optionally
 * spawns a realign task on the peer-language sibling, logs the lock.
 * @param {Object} params - { entityId, taskId, peerNeedsRealignment }
 * @returns {Object} { ok, updated: { entity, task, related_tasks }, error? }
 */
function WebAppLibrary_lockVersion(params) {
  const serviceName = 'WebAppLibrary';
  const functionName = 'lockVersion';

  try {
    const result = LibraryService.lockVersion(params || {});
    const shapedEntity = _getLibraryEntities([result.entity])[0];
    return {
      ok: true,
      updated: {
        entity: shapedEntity,
        task: result.task,
        related_tasks: result.related_tasks
      }
    };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { ok: false, error: e.message };
  }
}

/**
 * Composite read for the entity detail drawer (phase 9).
 * Returns entity row + attached tasks + references-in + activity log,
 * each shaped to the same camelCase API as WebAppLibrary_getData consumers.
 * @param {Object} params - { entityId }
 * @returns {Object} { success, data: { entity, attached_tasks, references_in, activity_log }, error? }
 */
function WebAppLibrary_getEntityDetail(params) {
  const serviceName = 'WebAppLibrary';
  const functionName = 'getEntityDetail';

  try {
    const allConfig = ConfigService.getAllConfig();
    const raw = LibraryService.getEntityDetail(params || {});

    const entity = _getLibraryEntities([raw.entity])[0];
    const attachedTasks = _getQueueTasks(raw.attached_tasks, allConfig);
    const referencesIn = _getLibraryEntities(raw.references_in);
    const activityLog = raw.activity_log.map(row => ({
      activityId: row.slba_ActivityId,
      entityType: row.slba_EntityType,
      entityId: row.slba_EntityId,
      timestamp: _safeDate(row.slba_Timestamp),
      actor: row.slba_Actor,
      actionType: row.slba_ActionType,
      summary: row.slba_Summary,
      details: row.slba_Details,
      referencedEntities: row.slba_ReferencedEntities
    }));

    return {
      success: true,
      data: {
        entity: entity,
        attached_tasks: attachedTasks,
        references_in: referencesIn,
        activity_log: activityLog
      }
    };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { success: false, error: e.message };
  }
}

/**
 * Appends a row to SysLibraryActivity for this entity.
 * @param {Object} params - { entityId, actionType, details, referencedEntities, entityType? }
 * @returns {Object} { ok, activityId, error? }
 */
function WebAppLibrary_logEntityActivity(params) {
  const serviceName = 'WebAppLibrary';
  const functionName = 'logEntityActivity';

  try {
    const result = LibraryService.logEntityActivity(params || {});
    return {
      ok: true,
      activityId: result.activityId
    };
  } catch (e) {
    LoggerService.error(serviceName, functionName, e.message, e);
    return { ok: false, error: e.message };
  }
}
