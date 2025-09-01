/**
 * @file WebApp.gs — Lean Web App Router
 * @description Central endpoint that routes secure commands to worker functions in other files.
 * @version 2025-07-30-1700 // Final stable version
 */

function doPost(e) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Another process is running. Please try again.' })).setMimeType(ContentService.MimeType.JSON);
    }

    try {
        const payload = JSON.parse(e.postData.contents);
        const command = payload.command;
        if (!command) {
            throw new Error('Request is missing a command.');
        }

        let result; // This will hold the output from our worker functions

        switch (command) {
            case 'populateBrurya':
                result = _server_populateBruryaSheet();
                break;
            case 'submitBruryaWithCheck':
                result = _server_submitBruryaWithCheck(payload.data);
                break;
            case 'populateInventory':
                result = _server_populateInventory(payload.data);
                break;
            case 'submitInventory':
                result = _server_submitInventory(payload.data, payload.user);
                break;
            case 'getPackingDisplayData':
                result = _server_getPackingDisplayData();
                break;
            case 'generatePackingDocs':
                result = _server_generatePackingDocs(payload.data);
                break;
            case 'syncComax':
                result = _server_getComaxData();
                break;
            case 'getUsers':
                result = _server_getUsers();
                break;
            case 'getBruryaAccess':
                result = _server_getBruryaAccess(payload.data);
                break;
            case 'getItemDetailsBySku':
                result = _server_getItemDetailsBySku(payload.data);
                break;
            case 'getStockHealthNeeds':
                result = _server_getStockHealthNeeds();
            break;

            case 'populateAndFilterNewProducts':
                result = _server_populateAndFilterNewProducts(payload.data);
                break;

        // ADD THIS NEW CASE
        case 'populateOptionalWines':
            result = _server_populateOptionalWines();
            break;

            case 'activateHomeSheet':
                result = activateHomeSheet();
                break;

            default:
                throw new Error(`Unknown command: "${command}"`);
        }
        
        // This is the single, correct return point for all successful commands
        Logger.log(JSON.stringify(result)); // Added logging
        return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        Logger.log(`doPost Error: ${err.message} \nStack: ${err.stack}`);
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `Server Error: ${err.message}` })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}

/**
 * Server-side worker to get the list of user names.
 * Returns a plain object.
 */
function _server_getUsers() {
    try {
        const usersSheet = getReferenceSheet(G.SHEET_NAMES.USERS);
        const names = usersSheet
            .getRange(2, G.COLUMN_INDICES.USERS.NAME + 1, usersSheet.getLastRow() - 1, 1)
            .getValues()
            .flat()
            .map(name => name.toString().trim())
            .filter(name => name)
            .sort();
        return { status: 'success', data: names };
    } catch (err) {
        return { status: 'error', message: err.message };
    }
}

/**
 * Server-side worker to get the 'bruryaAccess' flag for a specific user.
 * Returns a plain object.
 */
function _server_getBruryaAccess(userName) {
    try {
        let accessFlag = 'n';
        if (userName) {
            const usersSheet = getReferenceSheet(G.SHEET_NAMES.USERS);
            const data = usersSheet.getRange(2, 1, usersSheet.getLastRow(), G.COLUMN_INDICES.USERS.BRURYA_ACCESS + 1).getValues();
            const match = data.find(row =>
                row[G.COLUMN_INDICES.USERS.NAME]?.toString().trim().toLowerCase() === userName.toLowerCase()
            );
            accessFlag = match ? match[G.COLUMN_INDICES.USERS.BRURYA_ACCESS]?.toString().trim().toLowerCase() : 'n';
        }
        return { status: 'success', data: accessFlag };
    } catch (err) {
        return { status: 'error', message: err.message };
    }
}

/**
 * Server-side function to activate the sheet named 'Home'.
 */
function activateHomeSheet() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const homeSheet = spreadsheet.getSheetByName('Home');
    if (homeSheet) {
      homeSheet.activate();
      return { status: 'success', message: 'Home sheet activated.' };
    } else {
      return { status: 'error', message: 'Sheet named "Home" not found.' };
    }
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}