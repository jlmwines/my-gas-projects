/**
 * @file Globals.gs
 * @description Centralized Project Constants & State Helpers for the Frontend.
 * @version 2025-07-27-1042
 * @environment Frontend
 */

const G = {
    WEB_APP_URL: 'https://script.google.com/a/macros/jlmwines.com/s/AKfycbze93HFqmZ9wZSsho_SyN1e2i4363yRQDK_YZqGqitddf32RtjySl-klmId7TvEDzzQdw/exec',
    FILE_IDS: {
        REFERENCE: '1YLqfcX0zqXrRbJccduaWgcnY6qLjL39Y5bbD4Lu5tXc',
        PRINT_FOLDER: '1ptdfhaan6tVMQ4INAoFYRE6RULkxMEch',
        PACKING_SLIP_TEMPLATE: '1QmdebRD-vk0gsbN5jRz5klE8ttW5KUjSbfl9ql-9VqU',
        CUSTOMER_NOTE_TEMPLATE: '1muXXF2gQUeIM1MALbkZINwZPcS2SXXbiGqKL3841gPw'
    },
    SHEET_NAMES: {
        DASHBOARD: 'Dashboard',
        CONFIG: 'Config',
        REFERENCE_CONFIG: 'Config',
        USERS: 'Users',
        TASKQ: 'TaskQ',
        COMAX_M: 'ComaxM',
        AUDIT: 'Audit',
        BRURYA: 'Brurya',
        INVENTORY: 'Inventory',
        PACKING_DISPLAY: 'PackingDisplay',
        ORDERS_M: 'OrdersM',
        ORDER_LOG: 'OrderLog',
        PACKING_QUEUE: 'PackingQueue',
        PACKING_ROWS: 'PackingRows',
        PACKING_TEXT: 'PackingText',
        COMAX_DIRECTORY: 'Comax'
    },
    HEADERS: {
        ORDER_ID: 'order_id',
        ORDER_NUMBER: 'order_number',
        PACKING_QUEUE_ORDER_NUMBER: 'Order Number'
    },
    CELL_REFS: {
        USER_DROPDOWN: 'A2',
        ACTIVE_USER: 'A1'
    },
    COLUMN_INDICES: {
        USERS: { NAME: 1, BRURYA_ACCESS: 5 },
        AUDIT: { ID: 1, SKU: 2, LAST_COUNT: 3, COMAX_QTY: 4, NEW_QTY: 5, BRURYA_QTY: 6, STORAGE_QTY: 7, OFFICE_QTY: 8, SHOP_QTY: 9 },
        TASKQ: { TIMESTAMP: 1, SESSION_ID: 2, TYPE: 3, SOURCE: 4, DETAILS: 5, RELATED_ENTITY: 6, STATUS: 7, PRIORITY: 8, ASSIGNED_TO: 9, START_DATE: 10, END_DATE: 11, DONE_DATE: 12, NOTES: 13 },
        REFERENCE_CONFIG: { SETTING: 1, VALUE: 2, NOTES: 3 },
        ORDERLOG: { ORDER_ID: 1, ORDER_DATE: 2, PACKING_PRINT_DATE: 3, CUSTOMER_NOTE_DOC_ID: 4, EXPORT_DATE: 5 }
    },
    SETTINGS: {
        PACKING_DATA_CREATED: 'PackingDataCreated'
    },
    SESSION_FLAGS: {
        BRURYA_ACTIVE: 'bruryaSessionActive',
        INVENTORY_ACTIVE: 'inventorySessionActive'
    }
};

// --- CONFIG SHEET UTILITY ---
function getConfigSheet_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(G.SHEET_NAMES.CONFIG);
    if (!sheet) {
        sheet = ss.insertSheet(G.SHEET_NAMES.CONFIG);
        sheet.hideSheet();
    }
    return sheet;
}

// --- ACTIVE USER STATE ---
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

// --- REFERENCE FILE SHEET ACCESS ---
function getReferenceSheet(name) {
    const refSS = SpreadsheetApp.openById(G.FILE_IDS.REFERENCE);
    const sheet = refSS.getSheetByName(name);
    if (!sheet) {
        throw new Error(`Reference sheet "${name}" not found.`);
    }
    return sheet;
}

function getReferenceSetting(settingName) {
    const configSheet = getReferenceSheet(G.SHEET_NAMES.REFERENCE_CONFIG);
    const data = configSheet.getDataRange().getValues();
    for (let i = 0; i < data.length; i++) {
        if (data[i][G.COLUMN_INDICES.REFERENCE_CONFIG.SETTING - 1] === settingName) {
            return data[i][G.COLUMN_INDICES.REFERENCE_CONFIG.VALUE - 1];
        }
    }
    return null;
}