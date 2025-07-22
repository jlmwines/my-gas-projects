/**
 * Brurya.gs — Sheet Controller (v2025-07-16)
 * Complete script with all helper functions restored and logic corrected.
 */

const ENABLE_PROTECTION = true;

// --- SESSION STATE HELPERS ---

function setBruryaSessionActive() {
    PropertiesService.getUserProperties().setProperty(G.SESSION_FLAGS.BRURYA_ACTIVE, 'true');
}

function clearBruryaSessionState() {
    PropertiesService.getUserProperties().deleteProperty(G.SESSION_FLAGS.BRURYA_ACTIVE);
}

function isBruryaSessionActive() {
    return PropertiesService.getUserProperties().getProperty(G.SESSION_FLAGS.BRURYA_ACTIVE) === 'true';
}

// --- CORE FUNCTIONS ---

function populateBruryaSheetFromAudit() {
    const ui = SpreadsheetApp.getUi();
    const selectedUser = getActiveUser();

    if (!selectedUser) {
        ui.alert('Please select a user from the Dashboard first.');
        return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(G.SHEET_NAMES.BRURYA);
    if (!sheet) {
        ui.alert(`Sheet "${G.SHEET_NAMES.BRURYA}" not found.`);
        return;
    }
    
    ss.setActiveSheet(sheet);

    try {
        if (sheet.getLastRow() > 1) {
            sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent().setBackground(null);
        }

        const auditSheet = getReferenceSheet(G.SHEET_NAMES.AUDIT);
        const comaxSheet = getReferenceSheet(G.SHEET_NAMES.COMAX_M);

        const auditData = auditSheet.getRange(2, 1, auditSheet.getLastRow() - 1, 6).getValues(); // Read through Column F
        const comaxData = comaxSheet.getRange(2, 1, comaxSheet.getLastRow() - 1, 3).getValues();

        const nameMap = new Map(comaxData.map(row => [row[0]?.toString().trim(), row[2]?.toString().trim()]).filter(([id]) => id));

        const rows = auditData.reduce((acc, row) => {
            const id = row[0]?.toString().trim();
            const sku = row[1]?.toString().trim();
            const qty = parseFloat(row[5]); // Read BruryaQty from Column F (index 5)
            const name = nameMap.get(id) || '';
            if (id && qty > 0) {
                acc.push([id, name, sku, qty]);
            }
            return acc;
        }, []);

        if (rows.length > 0) {
            sheet.getRange(2, 1, rows.length, 4).setValues(rows);
        } else {
            sheet.getRange(2, 1).setValue("No items with Brurya quantity > 0 found in the Audit sheet.");
        }

        updateBruryaProtection();
    } catch (err) {
        ui.alert(`Could not populate Brurya sheet: ${err.message}`);
    }
}

function handleBruryaEdit(e) {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const row = e.range.getRow();
    const col = e.range.getColumn();
    
    // Only trigger if editing the quantity in Column D
    if (sheet.getName() === G.SHEET_NAMES.BRURYA && row > 1 && col === 4) {
        setBruryaSessionActive();
    }
}

function updateBruryaProtection() {
    if (!ENABLE_PROTECTION) return;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(G.SHEET_NAMES.BRURYA);
    if (!sheet || sheet.getLastRow() < 2) return;

    sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => p.remove());

    const dataRangeHeight = sheet.getLastRow() - 1;
    const grayBackground = "#f3f3f3";

    // Protect non-editable columns A, B, and C
    sheet.getRange(2, 1, dataRangeHeight, 3)
        .setBackground(grayBackground)
        .protect()
        .setWarningOnly(true);
}

function submitBruryaToAudit() {
    const ui = SpreadsheetApp.getUi();
    const props = PropertiesService.getUserProperties();
    const hasAccess = props.getProperty('bruryaAccess') === 'y';

    if (!hasAccess) {
        ui.alert('You do not have permission to submit Brurya counts.');
        return;
    }
    
    if (!isBruryaSessionActive()) {
        ui.alert('No pending Brurya changes to submit.');
        return;
    }

    const response = ui.alert('Submit Brurya Counts to Audit?', 'This action cannot be undone.', ui.ButtonSet.YES_NO);
    if (response !== ui.Button.YES) return;

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
        ui.alert('Another submission is in progress. Please try again.');
        return;
    }

    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(G.SHEET_NAMES.BRURYA);
        if (!sheet || sheet.getLastRow() < 2) {
            ui.alert('Nothing to submit.');
            return;
        }

        const auditSheet = getReferenceSheet(G.SHEET_NAMES.AUDIT);
        const bruryaData = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();

        const bruryaMap = new Map();
        bruryaData.forEach(row => {
            const id = row[0]?.toString().trim();
            const qty = (row[3] === '' || row[3] === null) ? 0 : parseFloat(row[3]);
            if (id) bruryaMap.set(id, qty);
        });

        const auditRange = auditSheet.getRange(2, 1, auditSheet.getLastRow() - 1, 6); // Read through Column F
        const auditValues = auditRange.getValues();

        const newBruryaQtys = auditValues.map(row => {
            const id = row[0]?.toString().trim();
            return bruryaMap.has(id) ? [bruryaMap.get(id)] : [row[5]]; // Write back to Column F (index 5)
        });
        
        if (newBruryaQtys.length > 0) {
            auditSheet.getRange(2, 6, newBruryaQtys.length, 1).setValues(newBruryaQtys); // Write to Column F
        }

        clearBruryaSessionState();
        populateBruryaSheetFromAudit(); // Refresh the sheet after submission
        ui.alert(`Brurya submission complete.`);
    } catch (e) {
        ui.alert(`An error occurred during submission: ${e.message}`);
    } finally {
        lock.releaseLock();
    }
}