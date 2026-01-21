/**
 * @file ProjectService.js
 * @description Service for managing projects (campaigns, operational improvements, one-off tasks).
 * Projects serve as containers for tasks, providing a unified way to organize work.
 */

const ProjectService = (function() {
  'use strict';

  const SERVICE_NAME = 'ProjectService';

  // Project types
  const PROJECT_TYPES = {
    CAMPAIGN: 'CAMPAIGN',
    OPERATIONAL: 'OPERATIONAL',
    ONE_OFF: 'ONE_OFF'
  };

  // Project statuses
  const PROJECT_STATUSES = {
    PLANNING: 'PLANNING',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    ARCHIVED: 'ARCHIVED'
  };

  /**
   * Gets the SysProjects sheet.
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  function _getProjectsSheet() {
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const sheetName = (sheetNames && sheetNames.SysProjects) || 'SysProjects';
    return SheetAccessor.getDataSheet(sheetName, false);
  }

  /**
   * Gets the schema headers for SysProjects.
   * @returns {string[]}
   */
  function _getHeaders() {
    const allConfig = ConfigService.getAllConfig();
    const schema = allConfig['schema.data.SysProjects'];
    if (!schema || !schema.headers) {
      throw new Error('SysProjects schema not found in configuration');
    }
    return schema.headers.split(',');
  }

  /**
   * Converts a row array to a project object.
   * @param {Array} row - The row data
   * @param {string[]} headers - The column headers
   * @returns {Object}
   */
  function _rowToProject(row, headers) {
    const project = {};
    headers.forEach((header, index) => {
      const key = header.replace('spro_', '').toLowerCase();
      // Use camelCase for keys
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      project[camelKey] = row[index];
    });
    // Also add raw prefixed keys for consistency
    headers.forEach((header, index) => {
      project[header] = row[index];
    });
    return project;
  }

  /**
   * Gets all projects.
   * @returns {Object[]}
   */
  function getAllProjects() {
    console.log('ProjectService.getAllProjects: Starting');
    const sheet = _getProjectsSheet();
    if (!sheet) {
      console.log('ProjectService.getAllProjects: Sheet not found!');
      logger.warn(SERVICE_NAME, 'getAllProjects', 'SysProjects sheet not found');
      return [];
    }
    console.log('ProjectService.getAllProjects: Sheet found - ' + sheet.getName());

    const data = sheet.getDataRange().getValues();
    console.log('ProjectService.getAllProjects: Data rows = ' + data.length);
    if (data.length <= 1) return []; // Only headers or empty

    const headers = data[0];
    console.log('ProjectService.getAllProjects: Headers = ' + headers.join(','));
    const projects = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) { // Has project ID
        projects.push(_rowToProject(row, headers));
      }
    }

    console.log('ProjectService.getAllProjects: Returning ' + projects.length + ' projects');
    return projects;
  }

  /**
   * Gets a single project by ID.
   * @param {string} projectId
   * @returns {Object|null}
   */
  function getProject(projectId) {
    const sheet = _getProjectsSheet();
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null;

    const headers = data[0];
    const idIndex = headers.indexOf('spro_ProjectId');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === projectId) {
        return _rowToProject(data[i], headers);
      }
    }

    return null;
  }

  /**
   * Creates a new project.
   * @param {Object} projectData - Project data (name, type, status, startDate, endDate)
   * @returns {Object} The created project with ID
   */
  function createProject(projectData) {
    const sheet = _getProjectsSheet();
    if (!sheet) {
      throw new Error('SysProjects sheet not found');
    }

    const headers = _getHeaders();
    const projectId = 'PROJ-' + Utilities.getUuid().substring(0, 8).toUpperCase();

    const newRow = headers.map(header => {
      switch (header) {
        case 'spro_ProjectId':
          return projectId;
        case 'spro_Name':
          return projectData.name || '';
        case 'spro_Type':
          return projectData.type || PROJECT_TYPES.ONE_OFF;
        case 'spro_Status':
          return projectData.status || PROJECT_STATUSES.PLANNING;
        case 'spro_StartDate':
          return projectData.startDate || '';
        case 'spro_EndDate':
          return projectData.endDate || '';
        default:
          return '';
      }
    });

    sheet.appendRow(newRow);
    logger.info(SERVICE_NAME, 'createProject', `Project created: ${projectId} - ${projectData.name}`);

    return {
      projectid: projectId,
      name: projectData.name || '',
      type: projectData.type || PROJECT_TYPES.ONE_OFF,
      status: projectData.status || PROJECT_STATUSES.PLANNING,
      startdate: projectData.startDate || '',
      enddate: projectData.endDate || '',
      spro_ProjectId: projectId,
      spro_Name: projectData.name || '',
      spro_Type: projectData.type || PROJECT_TYPES.ONE_OFF,
      spro_Status: projectData.status || PROJECT_STATUSES.PLANNING,
      spro_StartDate: projectData.startDate || '',
      spro_EndDate: projectData.endDate || ''
    };
  }

  /**
   * Updates an existing project.
   * @param {string} projectId
   * @param {Object} updates - Fields to update
   * @returns {boolean} Success
   */
  function updateProject(projectId, updates) {
    const sheet = _getProjectsSheet();
    if (!sheet) return false;

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return false;

    const headers = data[0];
    const idIndex = headers.indexOf('spro_ProjectId');

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === projectId) {
        // Update the row
        const updatedRow = [...data[i]];

        if (updates.name !== undefined) {
          const nameIdx = headers.indexOf('spro_Name');
          if (nameIdx !== -1) updatedRow[nameIdx] = updates.name;
        }
        if (updates.type !== undefined) {
          const typeIdx = headers.indexOf('spro_Type');
          if (typeIdx !== -1) updatedRow[typeIdx] = updates.type;
        }
        if (updates.status !== undefined) {
          const statusIdx = headers.indexOf('spro_Status');
          if (statusIdx !== -1) updatedRow[statusIdx] = updates.status;
        }
        if (updates.startDate !== undefined) {
          const startIdx = headers.indexOf('spro_StartDate');
          if (startIdx !== -1) updatedRow[startIdx] = updates.startDate;
        }
        if (updates.endDate !== undefined) {
          const endIdx = headers.indexOf('spro_EndDate');
          if (endIdx !== -1) updatedRow[endIdx] = updates.endDate;
        }

        sheet.getRange(i + 1, 1, 1, updatedRow.length).setValues([updatedRow]);
        logger.info(SERVICE_NAME, 'updateProject', `Project updated: ${projectId}`);
        return true;
      }
    }

    return false;
  }

  /**
   * Deletes a project (sets status to ARCHIVED).
   * @param {string} projectId
   * @returns {boolean} Success
   */
  function deleteProject(projectId) {
    // Protect system projects from deletion
    if (projectId && projectId.startsWith('PROJ-SYS_')) {
      throw new Error('Cannot delete system project');
    }
    return updateProject(projectId, { status: PROJECT_STATUSES.ARCHIVED });
  }

  /**
   * Gets projects filtered by status.
   * @param {string} status
   * @returns {Object[]}
   */
  function getProjectsWithStatus(status) {
    return getAllProjects().filter(p => p.status === status || p.spro_Status === status);
  }

  /**
   * Gets projects filtered by type.
   * @param {string} type
   * @returns {Object[]}
   */
  function getProjectsByType(type) {
    return getAllProjects().filter(p => p.type === type || p.spro_Type === type);
  }

  /**
   * Gets tasks linked to a specific project.
   * @param {string} projectId
   * @returns {Object[]}
   */
  function getTasksForProject(projectId) {
    // Delegate to TaskService if it has project support
    if (typeof TaskService !== 'undefined' && TaskService.getTasksByProject) {
      return TaskService.getTasksByProject(projectId);
    }

    // Fallback: manual query
    const allConfig = ConfigService.getAllConfig();
    const sheetNames = allConfig['system.sheet_names'];
    const sheetName = (sheetNames && sheetNames.SysTasks) || 'SysTasks';
    const sheet = SheetAccessor.getDataSheet(sheetName, false);

    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data[0];
    const projectIdIndex = headers.indexOf('st_ProjectId');
    if (projectIdIndex === -1) return [];

    const tasks = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][projectIdIndex] === projectId) {
        const task = {};
        headers.forEach((h, idx) => {
          task[h] = data[i][idx];
        });
        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * Gets project statistics.
   * @returns {Object} Stats by status and type
   */
  function getProjectStats() {
    const projects = getAllProjects();

    const stats = {
      total: projects.length,
      byStatus: {
        PLANNING: 0,
        ACTIVE: 0,
        COMPLETED: 0,
        ARCHIVED: 0
      },
      byType: {
        CAMPAIGN: 0,
        OPERATIONAL: 0,
        ONE_OFF: 0
      }
    };

    projects.forEach(p => {
      const status = p.status || p.spro_Status;
      const type = p.type || p.spro_Type;

      if (stats.byStatus.hasOwnProperty(status)) {
        stats.byStatus[status]++;
      }
      if (stats.byType.hasOwnProperty(type)) {
        stats.byType[type]++;
      }
    });

    return stats;
  }

  /**
   * Gets a project with its associated tasks.
   * @param {string} projectId
   * @returns {Object|null} Project with tasks array
   */
  function getProjectWithTasks(projectId) {
    const project = getProject(projectId);
    if (!project) return null;

    project.tasks = getTasksForProject(projectId);
    return project;
  }

  // Public API
  return {
    // Constants
    PROJECT_TYPES: PROJECT_TYPES,
    PROJECT_STATUSES: PROJECT_STATUSES,

    // CRUD
    getAllProjects: getAllProjects,
    getProject: getProject,
    createProject: createProject,
    updateProject: updateProject,
    deleteProject: deleteProject,

    // Queries
    getProjectsWithStatus: getProjectsWithStatus,
    getProjectsByType: getProjectsByType,
    getTasksForProject: getTasksForProject,
    getProjectStats: getProjectStats,
    getProjectWithTasks: getProjectWithTasks
  };
})();
