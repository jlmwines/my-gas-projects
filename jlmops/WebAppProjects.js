/**
 * @file WebAppProjects.js
 * @description Controller functions for the Admin Projects view.
 * These functions are called from AdminProjectsView.html via google.script.run.
 */

/**
 * Gets all projects for the project list.
 * @returns {Object} { error: string|null, data: Object[] }
 */
function WebAppProjects_getAllProjects() {
  try {
    const projects = ProjectService.getAllProjects();

    // Enrich with task counts
    const enrichedProjects = projects.map(project => {
      const projectId = project.projectid || project.spro_ProjectId;
      const tasks = ProjectService.getTasksForProject(projectId);
      const completedTasks = tasks.filter(t => t.st_Status === 'Done' || t.st_Status === 'Closed').length;

      return {
        ...project,
        taskCount: tasks.length,
        completedTaskCount: completedTasks
      };
    });

    return { error: null, data: enrichedProjects };
  } catch (e) {
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
    const stats = ProjectService.getProjectStats();
    return { error: null, data: stats };
  } catch (e) {
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
