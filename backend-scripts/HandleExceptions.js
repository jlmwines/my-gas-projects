/**
 * @file HandleExceptions.gs
 * @description Contains all backend functions for the exception handling sidebar.
 * @version 2025-07-20
 */

// MODIFIED: Removed hardcoded IDs to use the central Globals.gs config.
const TASK_QUEUE_SHEET_NAME = 'TaskQ';
const USERS_SHEET_NAME = 'Users';

function getWorkflowSummary() {
    // MODIFIED: Uses the global activeConfig for the file ID.
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const queueSheet = referenceSS.getSheetByName(TASK_QUEUE_SHEET_NAME);
    if (!queueSheet || queueSheet.getLastRow() < 2) {
        return { activeTaskCount: 0 };
    }
    const range = queueSheet.getRange(2, 7, queueSheet.getLastRow() - 1, 1);
    const statusColumn = range.getValues();
    
    let activeTasks = 0;
    
    statusColumn.forEach(row => {
        const status = String(row[0] || '').trim();
        if (status && status !== 'Closed') {
            activeTasks++;
        }
    });
    
    return {
        activeTaskCount: activeTasks
    };
}

function getUsers() {
    // MODIFIED: Uses the global activeConfig for the file ID.
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const usersSheet = referenceSS.getSheetByName(USERS_SHEET_NAME);
    if (!usersSheet || usersSheet.getLastRow() < 2) return [];
    
    return usersSheet.getRange('A2:E' + usersSheet.getLastRow()).getValues()
        .map(row => ({ id: row[0], name: row[1], email: row[2] }))
        .filter(user => user.name);
}

function getTasks() {
    // MODIFIED: Uses the global activeConfig for the file ID.
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const sheet = referenceSS.getSheetByName(TASK_QUEUE_SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) return [];

    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 13);
    const values = range.getValues();

    const tasks = values.map((row, index) => {
        // **UPDATED LOGIC**: All returned properties are explicitly converted to Strings.
        // This prevents Date objects or other non-serializable types from breaking
        // the communication with the sidebar.
        return {
            rowNum: index + 2,
            entity: String(row[5] || ''),
            sourceSheet: String(row[3] || ''),
            testId: String(row[2] || ''),
            priority: String(row[7] || ''),
            description: String(row[4] || ''),
            details: `Entity: ${String(row[5] || '')}`, 
            status: String(row[6] || '').trim() || 'Open',
            assignee: String(row[8] || ''),
            notes: String(row[12] || ''),
        };
    });
    
    return tasks;
}

function updateTaskLifecycle(rowNum, newStatus) {
    // MODIFIED: Uses the global activeConfig for the file ID.
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const sheet = referenceSS.getSheetByName(TASK_QUEUE_SHEET_NAME);
    const timestamp = new Date();
    
    const STATUS_COL = 7;
    const START_DATE_COL = 10;
    const DONE_DATE_COL = 12;

    sheet.getRange(rowNum, STATUS_COL).setValue(newStatus);

    if (newStatus === 'Assigned' || newStatus === 'Open') {
        sheet.getRange(rowNum, START_DATE_COL).setValue(timestamp);
        sheet.getRange(rowNum, DONE_DATE_COL).setValue('');
    } else if (newStatus === 'Closed') {
        sheet.getRange(rowNum, DONE_DATE_COL).setValue(timestamp);
    }
    
    return { status: newStatus, timestamp: timestamp.toLocaleString() };
}

function assignTask(rowNum, assignee) {
    // MODIFIED: Uses the global activeConfig for the file ID.
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const sheet = referenceSS.getSheetByName(TASK_QUEUE_SHEET_NAME);
    const ASSIGNED_TO_COL = 9;

    sheet.getRange(rowNum, ASSIGNED_TO_COL).setValue(assignee);
    updateTaskLifecycle(rowNum, 'Assigned');
    return assignee;
}

function addTaskNote(rowNum, noteWithTimestamp) {
    // MODIFIED: Uses the global activeConfig for the file ID.
    const referenceSS = SpreadsheetApp.openById(activeConfig.referenceFileId);
    const sheet = referenceSS.getSheetByName(TASK_QUEUE_SHEET_NAME);
    const NOTES_COL = 13;
    const noteRange = sheet.getRange(rowNum, NOTES_COL);
    const existingNotes = noteRange.getValue();

    const updatedNotes = existingNotes ? `${existingNotes}\n\n${noteWithTimestamp}` : noteWithTimestamp;

    noteRange.setValue(updatedNotes);
    return updatedNotes;
}

/**
 * Navigates the user to the source of a task.
 * This feature is temporarily disabled.
 */
function jumpToTaskSource(entity, sourceSheetName) {
    /*
    // All code is commented out to disable the feature.
    */
}