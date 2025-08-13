/**
 * @file WebApp.gs — Lean Web App Router
 * @description Central endpoint that routes secure commands to worker functions in other files.
 * @version 2025-07-27
 */

/**
 * Executes with owner permissions and routes commands to the appropriate server-side worker function.
 * @param {object} e The event object containing the POST data.
 * @returns {ContentService.TextOutput} A JSON response from the worker function.
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

        // This switch calls the actual worker functions, which live in their own respective files.
        // Any function called from here will execute with owner permissions.
        switch (command) {
            case 'populateBrurya':
                return _server_populateBruryaSheet();

            case 'submitBruryaWithCheck': // <-- New command
                return _server_submitBruryaWithCheck(payload.data);

            case 'populateInventory':
                return _server_populateInventory(payload.data);

            case 'submitInventory':
                return _server_submitInventory(payload.data, payload.user);

            case 'getPackingDisplayData':
                return _server_getPackingDisplayData();

            case 'generatePackingDocs':
                return _server_generatePackingDocs(payload.data);

            case 'syncComax':
                return _server_getComaxData();

            case 'getUsers':
                return _server_getUsers();

            case 'getBruryaAccess':
                return _server_getBruryaAccess(payload.data);

            case 'getItemDetailsBySku':
                return _server_getItemDetailsBySku(payload.data);

            default:
                throw new Error(`Unknown command: "${command}"`);
        }

    } catch (err) {
        Logger.log(`doPost Error: ${err.message} \nStack: ${err.stack}`);
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `Server Error: ${err.message}` })).setMimeType(ContentService.MimeType.JSON);
    } finally {
        lock.releaseLock();
    }
}
/**
 * Server-side worker to get the list of user names from the reference sheet.
 * @returns {ContentService.TextOutput} JSON response with the user list.
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
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: names })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message })).setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * Server-side worker to get the 'bruryaAccess' flag for a specific user.
 * @param {string} userName The name of the user to look up.
 * @returns {ContentService.TextOutput} JSON response with the access flag ('y' or 'n').
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
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', data: accessFlag })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message })).setMimeType(ContentService.MimeType.JSON);
    }
}