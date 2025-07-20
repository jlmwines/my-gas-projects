/**
 * Globals.gs — Centralized Project Constants & State Helpers (v2025-07-16)
 * Change: Added the getReferenceSheet helper function.
 */

const G = {
    FILE_IDS: {
        REFERENCE: '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc'
    },
    SHEET_NAMES: {
        DASHBOARD: 'Dashboard',
        CONFIG: 'Config',
        USERS: 'Users',
        TASKQ: 'TaskQ',
        COMAX_M: 'ComaxM',
        AUDIT: 'Audit',
        BRURYA: 'Brurya',
        INVENTORY: 'Inventory'
    },
    CELL_REFS: {
        USER_DROPDOWN: 'A2',
        ACTIVE_USER: 'A1'
    },
    COLUMN_INDICES: {
    USERS: { NAME: 1, BRURYA_ACCESS: 5 },
    // Add/replace with the following full definitions:
    AUDIT: {
        ID: 1, SKU: 2, LAST_COUNT: 3, COMAX_QTY: 4, NEW_QTY: 5,
        BRURYA_QTY: 6, STORAGE_QTY: 7, OFFICE_QTY: 8, SHOP_QTY: 9
    },
    TASKQ: {
        TIMESTAMP: 1, SESSION_ID: 2, TYPE: 3, SOURCE: 4, DETAILS: 5,
        RELATED_ENTITY: 6, STATUS: 7, PRIORITY: 8, ASSIGNED_TO: 9,
        START_DATE: 10, END_DATE: 11, DONE_DATE: 12, NOTES: 13
    }
},
    SESSION_FLAGS: {
        BRURYA_ACTIVE: 'bruryaSessionActive',
        INVENTORY_ACTIVE: 'inventorySessionActive'
    }
};

// --- STATE HELPER FUNCTIONS ---

function getConfigSheet_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(G.SHEET_NAMES.CONFIG);
    if (!sheet) {
        sheet = ss.insertSheet(G.SHEET_NAMES.CONFIG);
        sheet.hideSheet();
    }
    return sheet;
}

function setActiveUser(name) {
    const sheet = getConfigSheet_();
    sheet.getRange(G.CELL_REFS.ACTIVE_USER).setValue(name);
}

function getActiveUser() {
    const sheet = getConfigSheet_();
    return sheet.getRange(G.CELL_REFS.ACTIVE_USER).getValue();
}

function clearActiveUser() {
    const sheet = getConfigSheet_();
    sheet.getRange(G.CELL_REFS.ACTIVE_USER).clearContent();
}

// --- NEW UTILITY FUNCTION ---

/**
 * Gets a sheet from the reference spreadsheet by its name.
 * @param {string} name The name of the sheet to retrieve.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The requested sheet object.
 */
function getReferenceSheet(name) {
    const refSS = SpreadsheetApp.openById(G.FILE_IDS.REFERENCE);
    const sheet = refSS.getSheetByName(name);
    if (!sheet) {
        throw new Error(`Reference sheet "${name}" not found.`);
    }
    return sheet;
}