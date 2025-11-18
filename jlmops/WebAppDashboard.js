/**
 * @file WebAppDashboard.js
 * @description This script is the View Controller for the main Admin Dashboard.
 * It orchestrates the retrieval of all data needed for the dashboard view by
 * calling the appropriate Data Provider scripts (e.g., WebAppTasks, WebAppOrders).
 */

// eslint-disable-next-line no-unused-vars
const WebAppDashboard = (() => {
  /**
   * Retrieves key health and status metrics for the admin dashboard.
   * @returns {Object} An object containing system health data.
   */
  const getDashboardData = () => {
    const role = AuthService.getActiveUserRole();
    
    if (role === 'admin') {
      try {
        const allConfig = ConfigService.getAllConfig();
        const dataSpreadsheetId = allConfig['system.spreadsheet.data'].id;
        const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
        const dataSpreadsheet = SpreadsheetApp.openById(dataSpreadsheetId);
        const logSpreadsheet = SpreadsheetApp.openById(logSpreadsheetId);
        const sheetNames = allConfig['system.sheet_names'];
        const orderService = new OrderService(ProductService);
        const twentyFourHoursAgo = new Date(new Date().getTime() - (24 * 60 * 60 * 1000));

        // --- Job Queue Analysis ---
        const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
        const blockedJobs = [];
        let recentFailedJobs = 0;
        let quarantinedJobs = 0;
        let lastMasterValidation = null;

        if (jobQueueSheet.getLastRow() > 1) {
          const jobQueueData = jobQueueSheet.getDataRange().getValues();
          const jobQueueHeaders = jobQueueData.shift();
          const statusCol = jobQueueHeaders.indexOf('status');
          const jobTypeCol = jobQueueHeaders.indexOf('job_type');
          const createdTimestampCol = jobQueueHeaders.indexOf('created_timestamp');
          const processedTimestampCol = jobQueueHeaders.indexOf('processed_timestamp');

          jobQueueData.forEach(row => {
            const status = row[statusCol];
            const jobType = row[jobTypeCol];
            if (status === 'BLOCKED') {
              const jobConfig = allConfig[jobType];
              if (jobConfig && jobConfig.depends_on) {
                blockedJobs.push({ jobType: jobType, dependency: jobConfig.depends_on });
              }
            } else if (status === 'QUARANTINED') {
              quarantinedJobs++;
            } else if (status === 'FAILED') {
              const timestamp = new Date(row[processedTimestampCol] || row[createdTimestampCol]);
              if (timestamp > twentyFourHoursAgo) {
                recentFailedJobs++;
              }
            }
            if (jobType === 'manual.validation.master' && status === 'COMPLETED') {
              const jobTimestamp = new Date(row[processedTimestampCol]);
              if (jobTimestamp.getTime() && (!lastMasterValidation || jobTimestamp > lastMasterValidation)) {
                lastMasterValidation = jobTimestamp;
              }
            }
          });
        }

        // --- System Health Logic ---
        const alerts = [];
        if (recentFailedJobs > 0) alerts.push(`${recentFailedJobs} recent job(s) failed.`);
        if (quarantinedJobs > 0) alerts.push(`${quarantinedJobs} job(s) are quarantined.`);
        if (blockedJobs.length > 0) alerts.push(`${blockedJobs.length} job(s) are blocked.`);
        const isHealthy = alerts.length === 0;
        const systemHealthData = {
          isHealthy: isHealthy,
          alerts: alerts,
          lastValidationTimestamp: lastMasterValidation ? lastMasterValidation.toLocaleString() : 'N/A',
          isValidationRecent: lastMasterValidation && lastMasterValidation > twentyFourHoursAgo,
          recentFailedJobs: recentFailedJobs,
          quarantinedJobs: quarantinedJobs,
          blockedJobs: blockedJobs.length
        };

        // --- Task Analysis ---
        const openTasks = WebAppTasks.getOpenTasks();
        let highPriorityTasks = 0;
        let openNegativeInventoryTasksCount = 0;
        const openComaxConfirmationTasks = [];
        const openProductCountConfirmationTasks = [];
        const openComaxInventoryConfirmationTasks = [];

        openTasks.forEach(task => {
          if (task.st_Priority === 'High') highPriorityTasks++;
          switch (task.st_TaskTypeId) {
            case 'task.confirmation.comax_export':
              openComaxConfirmationTasks.push({ id: task.st_TaskId, title: task.st_Title, notes: task.st_Notes });
              break;
            case 'task.confirmation.product_count_export':
              openProductCountConfirmationTasks.push({ id: task.st_TaskId, title: task.st_Title, notes: task.st_Notes });
              break;
            case 'task.confirmation.comax_inventory_export':
              openComaxInventoryConfirmationTasks.push({ id: task.st_TaskId, title: task.st_Title, notes: task.st_Notes });
              break;
            case 'task.validation.comax_internal_audit':
              openNegativeInventoryTasksCount++;
              break;
          }
        });

        // --- Brurya Count Logic ---
        let bruryaProductCount = 0;
        let bruryaTotalStock = 0;
        const auditSheet = dataSpreadsheet.getSheetByName(sheetNames.SysProductAudit);
        if (auditSheet && auditSheet.getLastRow() > 1) {
            const auditHeaders = auditSheet.getRange(1, 1, 1, auditSheet.getLastColumn()).getValues()[0];
            const bruryaQtyColIdx = auditHeaders.indexOf('pa_BruryaQty');
            if (bruryaQtyColIdx !== -1) {
                const bruryaQtys = auditSheet.getRange(2, bruryaQtyColIdx + 1, auditSheet.getLastRow() - 1, 1).getValues();
                bruryaQtys.forEach(row => {
                    const qty = row[0];
                    if (typeof qty === 'number') {
                        bruryaTotalStock += qty;
                        if (qty > 0) {
                            bruryaProductCount++;
                        }
                    }
                });
            }
        }

        // --- Invoice Count Logic ---
        let invoiceCount = 0;
        let invoiceFolderUrl = '#';
        const invoiceFolderConfig = allConfig['system.folder.invoices'];
        if (invoiceFolderConfig && invoiceFolderConfig.id) {
          const invoiceFolder = DriveApp.getFolderById(invoiceFolderConfig.id);
          invoiceFolderUrl = invoiceFolder.getUrl();
          const files = invoiceFolder.getFiles();
          while (files.hasNext()) {
            const file = files.next();
            if (file.getMimeType() !== 'application/vnd.google-apps.shortcut') {
              invoiceCount++;
            }
          }
        }

        // --- Consolidate Data for Return ---
        const productData = getAdminProductData();
        const inventoryData = {
            invoiceCount: invoiceCount,
            invoiceFolderUrl: invoiceFolderUrl,
            bruryaProductCount: bruryaProductCount,
            bruryaTotalStock: bruryaTotalStock,
            openNegativeInventoryTasksCount: openNegativeInventoryTasksCount,
            openInventoryCountTasksCount: 0, // Placeholder for now
            openInventoryCountReviewTasksCount: 0, // Placeholder for now
            comaxInventoryExportCount: 0, // Placeholder for now
            openComaxInventoryConfirmationTask: openComaxInventoryConfirmationTasks.length > 0 ? openComaxInventoryConfirmationTasks[0] : null
        };

        return {
          role: role,
          systemHealthData: systemHealthData,
          blockedJobs: blockedJobs,
          highPriorityTasks: highPriorityTasks,
          onHoldCount: orderService.getOnHoldOrderCount(),
          processingCount: orderService.getProcessingOrderCount(),
          packingSlipsReadyCount: orderService.getPackingSlipsReadyCount(),
          comaxExportOrderCount: orderService.getComaxExportOrderCount(),
          openComaxConfirmationTasks: openComaxConfirmationTasks,
          productData: productData,
          inventoryData: inventoryData
        };

      } catch (error) {
        logger.error('WebAppDashboard', 'getDashboardData (admin)', error.message, error);
        return { role: role, error: 'Error loading admin data.' };
      }
    } else if (role === 'manager') {
      return { role: role, isInventoryCountNeeded: true };
    }

    return { role: role }; // Default for other roles
  }

  return {
    getDashboardData,
  };
})();
