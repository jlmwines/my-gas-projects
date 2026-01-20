/**
 * @file WebAppProjects.js
 * @description Controller functions for the Admin Projects view.
 * These functions are called from AdminProjectsView.html via google.script.run.
 */

/**
 * Converts Date objects to ISO strings for JSON serialization.
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function _sanitizeForClient(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(_sanitizeForClient);
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      sanitized[key] = _sanitizeForClient(obj[key]);
    }
    return sanitized;
  }
  return obj;
}

/**
 * Gets all projects for the project list.
 * @returns {Object} { error: string|null, data: Object[] }
 */
function WebAppProjects_getAllProjects() {
  try {
    console.log('WebAppProjects_getAllProjects: Starting');
    const projects = ProjectService.getAllProjects();
    console.log('WebAppProjects_getAllProjects: Got ' + projects.length + ' projects');

    // Enrich with task counts
    const enrichedProjects = projects.map(project => {
      const projectId = project.projectid || project.spro_ProjectId;
      console.log('WebAppProjects_getAllProjects: Getting tasks for project ' + projectId);
      const tasks = ProjectService.getTasksForProject(projectId);
      const completedTasks = tasks.filter(t => t.st_Status === 'Done' || t.st_Status === 'Closed').length;

      return {
        ...project,
        taskCount: tasks.length,
        completedTaskCount: completedTasks
      };
    });

    console.log('WebAppProjects_getAllProjects: Returning ' + enrichedProjects.length + ' enriched projects');
    return { error: null, data: _sanitizeForClient(enrichedProjects) };
  } catch (e) {
    console.log('WebAppProjects_getAllProjects: ERROR - ' + e.message);
    logger.error('WebAppProjects', 'getAllProjects', e.message, e);
    return { error: e.message, data: [] };
  }
}

/**
 * Gets a single project by ID.
 * @param {string} projectId
 * @returns {Object} { error: string|null, data: Object|null }
 */
function WebAppProjects_getProject(projectId) {
  try {
    const project = ProjectService.getProject(projectId);
    return { error: null, data: project };
  } catch (e) {
    logger.error('WebAppProjects', 'getProject', e.message, e);
    return { error: e.message, data: null };
  }
}

/**
 * Creates a new project.
 * @param {Object} projectData - { name, type, status, startDate, endDate }
 * @returns {Object} { error: string|null, data: Object|null }
 */
function WebAppProjects_createProject(projectData) {
  try {
    const project = ProjectService.createProject(projectData);
    return { error: null, data: project };
  } catch (e) {
    logger.error('WebAppProjects', 'createProject', e.message, e);
    return { error: e.message, data: null };
  }
}

/**
 * Updates an existing project.
 * @param {string} projectId
 * @param {Object} updates - Fields to update
 * @returns {Object} { error: string|null, success: boolean }
 */
function WebAppProjects_updateProject(projectId, updates) {
  try {
    const success = ProjectService.updateProject(projectId, updates);
    return { error: null, success: success };
  } catch (e) {
    logger.error('WebAppProjects', 'updateProject', e.message, e);
    return { error: e.message, success: false };
  }
}

/**
 * Deletes (archives) a project.
 * @param {string} projectId
 * @returns {Object} { error: string|null, success: boolean }
 */
function WebAppProjects_deleteProject(projectId) {
  try {
    const success = ProjectService.deleteProject(projectId);
    return { error: null, success: success };
  } catch (e) {
    logger.error('WebAppProjects', 'deleteProject', e.message, e);
    return { error: e.message, success: false };
  }
}

/**
 * Gets project statistics.
 * @returns {Object} { error: string|null, data: Object }
 */
function WebAppProjects_getStats() {
  try {
    console.log('WebAppProjects_getStats: Starting');
    const stats = ProjectService.getProjectStats();
    console.log('WebAppProjects_getStats: Got stats - total: ' + stats.total);
    return { error: null, data: stats };
  } catch (e) {
    console.log('WebAppProjects_getStats: ERROR - ' + e.message);
    logger.error('WebAppProjects', 'getStats', e.message, e);
    return { error: e.message, data: null };
  }
}

/**
 * Gets a project with all its tasks.
 * @param {string} projectId
 * @returns {Object} { error: string|null, data: Object|null }
 */
function WebAppProjects_getProjectWithTasks(projectId) {
  try {
    const project = ProjectService.getProjectWithTasks(projectId);
    return { error: null, data: project };
  } catch (e) {
    logger.error('WebAppProjects', 'getProjectWithTasks', e.message, e);
    return { error: e.message, data: null };
  }
}

/**
 * Gets available project types and statuses for dropdowns.
 * @returns {Object} { types: string[], statuses: string[] }
 */
function WebAppProjects_getOptions() {
  return {
    types: Object.values(ProjectService.PROJECT_TYPES),
    statuses: Object.values(ProjectService.PROJECT_STATUSES)
  };
}

// ===== CONTENT TASK STREAM FUNCTIONS =====

/**
 * Content stage definitions with display order.
 */
const CONTENT_STAGES = [
  { id: 'draft', typeId: 'task.content.draft', label: 'Draft', title: 'Draft: ' },
  { id: 'edit', typeId: 'task.content.edit', label: 'Edit', title: 'Edit: ' },
  { id: 'translate', typeId: 'task.content.translate', label: 'Translate', title: 'Translate: ' },
  { id: 'translate_edit', typeId: 'task.content.translate_edit', label: 'Translate Edit', title: 'Review Translation: ' },
  { id: 'images', typeId: 'task.content.images', label: 'Images', title: 'Images: ' },
  { id: 'blog_publish', typeId: 'task.content.blog_publish', label: 'Blog Publish', title: 'Publish: ' },
  { id: 'video_create', typeId: 'task.content.video_create', label: 'Video Create', title: 'Create Video: ' },
  { id: 'video_publish', typeId: 'task.content.video_publish', label: 'Video Publish', title: 'Publish Video: ' },
  { id: 'email', typeId: 'task.content.email', label: 'Email', title: 'Email: ' },
  { id: 'social', typeId: 'task.content.social', label: 'Social', title: 'Social: ' },
  { id: 'whatsapp', typeId: 'task.content.whatsapp', label: 'WhatsApp', title: 'WhatsApp: ' }
];

/**
 * Gets available content stages for UI.
 * @returns {Array} Stage definitions.
 */
function WebAppProjects_getContentStages() {
  return CONTENT_STAGES.map(s => ({ id: s.id, label: s.label }));
}

/**
 * Creates a content task stream for a single content asset.
 * Tasks are created as skeleton. Drive URL is added later as admin works on each task.
 *
 * Data model:
 * - st_SessionId = Stream code (e.g., "INT" or "INTX7K") - links all tasks in same content stream
 * - st_LinkedEntityName = Content name (e.g., "Intensity") - human readable identifier
 * - st_LinkedEntityId = Drive URL for the specific file - set by admin when working
 * - st_Title = Stage: Name (e.g., "Draft: Intensity") - fully editable
 *
 * @param {Object} params - { projectId, contentName, stages, streamId (optional) }
 * @returns {Object} { error: string|null, data: { tasksCreated: number, taskIds: [], streamCode: string } }
 */
function WebAppProjects_createContentStream(params) {
  try {
    const { projectId, contentName, stages, streamId } = params;

    if (!projectId || !contentName || !stages || stages.length === 0) {
      return { error: 'Missing required fields: projectId, contentName, stages', data: null };
    }

    // Use custom stream ID if provided, otherwise auto-generate
    let streamCode;
    if (streamId && streamId.trim()) {
      streamCode = streamId.trim().toUpperCase();
    } else {
      // Generate stream code from content name (first 3 letters uppercase + random suffix)
      const baseName = contentName.trim().replace(/[^a-zA-Z]/g, '').toUpperCase();
      const code = baseName.substring(0, 3) || 'CNT';
      const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
      streamCode = code + suffix;
    }

    // SessionId = stream code (links all tasks in same content stream)
    // LinkedEntityName = content name (human readable)
    // LinkedEntityId = stream code (used for de-duplication, admin can change to Drive URL later)
    const linkedEntityName = contentName;
    const linkedEntityId = streamCode;

    // Notes left empty for user feedback on completed/rejected tasks
    const taskNotes = '';

    const taskIds = [];

    // Create tasks for each selected stage in order
    for (const stageId of stages) {
      const stageDef = CONTENT_STAGES.find(s => s.id === stageId);
      if (!stageDef) continue;

      const taskTitle = stageDef.title + contentName;

      const result = TaskService.createTask(
        stageDef.typeId,
        linkedEntityId,
        linkedEntityName,
        taskTitle,
        taskNotes,
        streamCode,
        { projectId: projectId }
      );

      if (result && result.id) {
        taskIds.push(result.id);
      }
    }

    // Invalidate task cache
    WebAppTasks.invalidateCache();

    return { error: null, data: { tasksCreated: taskIds.length, taskIds: taskIds, streamCode: streamCode } };
  } catch (e) {
    logger.error('WebAppProjects', 'createContentStream', e.message, e);
    return { error: e.message, data: null };
  }
}

/**
 * Imports content streams from CSV data.
 * CSV format: contentName,stages
 * stages separated by semicolon: draft;edit;translate;images
 * @param {string} csvData - Raw CSV string.
 * @param {string} projectId - Project to assign tasks to.
 * @returns {Object} { error: string|null, data: { imported: number, failed: number, errors: [] } }
 */
function WebAppProjects_importContentStreams(csvData, projectId) {
  try {
    if (!csvData || !projectId) {
      return { error: 'Missing csvData or projectId', data: null };
    }

    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return { error: 'CSV must have header row and at least one data row', data: null };
    }

    // Skip header row
    const dataLines = lines.slice(1);
    let imported = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      // Parse CSV (simple split - doesn't handle quoted commas)
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) {
        errors.push(`Row ${i + 2}: Invalid format - need contentName,stages`);
        failed++;
        continue;
      }

      const [contentName, stagesStr] = parts;
      const stages = stagesStr.split(/[;|]/).map(s => s.trim()).filter(s => s);

      if (!contentName || stages.length === 0) {
        errors.push(`Row ${i + 2}: Missing required fields`);
        failed++;
        continue;
      }

      const result = WebAppProjects_createContentStream({
        projectId: projectId,
        contentName: contentName,
        stages: stages
      });

      if (result.error) {
        errors.push(`Row ${i + 2}: ${result.error}`);
        failed++;
      } else {
        imported++;
      }
    }

    return { error: null, data: { imported: imported, failed: failed, errors: errors } };
  } catch (e) {
    logger.error('WebAppProjects', 'importContentStreams', e.message, e);
    return { error: e.message, data: null };
  }
}
