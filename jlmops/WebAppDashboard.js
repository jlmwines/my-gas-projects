/**
 * @file WebAppDashboard.js
 * @description This script is the View Controller for the main Admin Dashboard.
 * It orchestrates the retrieval of all data needed for the dashboard view by
 * calling the appropriate Data Provider scripts (e.g., WebAppTasks, WebAppOrders).
 */

/**
 * Retrieves key health and status metrics for the admin dashboard.
 * @returns {Object} An object containing system health data.
 */
function WebAppDashboard_getDashboardData() {
    const role = AuthService.getActiveUserRole();
    
    if (role === 'admin') {
      try {
        const allConfig = ConfigService.getAllConfig();
        const logSpreadsheetId = allConfig['system.spreadsheet.logs'].id;
        const logSpreadsheet = SpreadsheetApp.openById(logSpreadsheetId);
        const sheetNames = allConfig['system.sheet_names'];
        const orderService = new OrderService(ProductService);

        const jobQueueSheet = logSpreadsheet.getSheetByName(sheetNames.SysJobQueue);
        const jobStatuses = jobQueueSheet.getRange('C2:C').getValues().flat();
        const failedJobs = jobStatuses.filter(s => s === 'FAILED').length;
        const quarantinedJobs = jobStatuses.filter(s => s === 'QUARANTINED').length;

        const openTasks = WebAppTasks.getOpenTasks();
        
        let highPriorityTasks = 0;
        const openComaxConfirmationTasks = [];
        const openProductCountConfirmationTasks = [];

        openTasks.forEach(task => {
          if (task.st_Priority === 'High') {
            highPriorityTasks++;
          }
          if (task.st_TaskTypeId === 'task.confirmation.comax_export') {
            openComaxConfirmationTasks.push({
              id: task.st_TaskId,
              title: task.st_Title,
              notes: task.st_Notes
            });
          }
          if (task.st_TaskTypeId === 'task.confirmation.product_count_export') {
            openProductCountConfirmationTasks.push({
              id: task.st_TaskId,
              title: task.st_Title,
              notes: task.st_Notes
            });
          }
        });

        const productData = WebAppProducts_getAdminProductData();

        const ordersWidgetData = WebAppOrders_getOrdersWidgetData(); // Direct call to global namespaced function

        return {
          role: role,
          failedJobs: failedJobs,
          quarantinedJobs: quarantinedJobs,
          highPriorityTasks: highPriorityTasks,
          ...ordersWidgetData, // Merge all data from WebAppOrders
          openProductCountConfirmationTasks: openProductCountConfirmationTasks,
          productData: productData
        };
      } catch (error) {
        LoggerService.error('WebApp', 'getDashboardData (admin)', error.message, error);
        return { role: role, error: 'Error loading admin data.' };
      }
    } else if (role === 'manager') {
      return {
        role: role,
        isInventoryCountNeeded: true // Placeholder
      };
    }

    return { role: role }; // Default for other roles
}