# Critical Housekeeping Bug Fix - Source Files Deleted

**Date:** 2025-12-08
**Severity:** 🔴 CRITICAL
**Status:** ✅ FIXED

---

## Problem Identified

**HousekeepingService.manageFileLifecycle()** was incorrectly deleting source import files from import folders during daily maintenance.

### The Bug

**Location:** HousekeepingService.js lines 284-302 (BEFORE FIX)

```javascript
// 1. Trashing processed source files (tracked in SysFileRegistry)
let trashedSourceFiles = 0;
for (let i = 1; i < fileRegistryData.length; i++) {
    const row = fileRegistryData[i];
    const sourceFileId = row[sourceFileIdCol];
    if (sourceFileId) {
        try {
            DriveApp.getFileById(sourceFileId).setTrashed(true);  // ← TRASHES ALL!
            trashedSourceFiles++;
        } catch (e) {
            logger.warn(...);
        }
    }
}
```

**What Happened:**
- Daily housekeeping runs at midnight
- Iterates through ALL rows in SysFileRegistry
- Trashes EVERY source file, regardless of:
  - ❌ Age
  - ❌ Processing status
  - ❌ Which folder it's in
  - ❌ Whether it's needed for re-processing

---

## Impact

### Files Affected
- ✅ **ComaxProducts.csv** - Trashed from import folder
- ✅ **Web Products exports** - Trashed from import folder
- ✅ **Web Orders** - Trashed from import folder
- ✅ **Translation files** - Trashed from import folder

### Consequences
1. **Lost ability to re-process files** - Source files gone after first import
2. **Manual re-exports required** - Had to regenerate files from Comax/WooCommerce
3. **Audit trail broken** - Original import files deleted
4. **Recovery impossible** - Files permanently deleted after 30 days in trash

---

## Root Cause Analysis

### Design Flaw

The original design misunderstood the file lifecycle:

**Intended Flow:**
```
Source Folder → Archive Folder → Trash (after X days)
     ↓               ↓
   [KEEP]      [Age-based cleanup]
```

**Actual Flow (BUG):**
```
Source Folder → Archive Folder → Trash
     ↓               ↓
  [TRASHED!]   [Age-based cleanup]
```

### Why It Was Written This Way

**Assumption:** "If a file is in the registry, it's been processed, so trash the source"

**Reality:** Source files should be kept indefinitely for:
- Manual re-processing if imports fail
- Audit/compliance requirements
- Debugging data issues
- Historical reference

---

## The Fix

**Location:** HousekeepingService.js lines 284-287 (AFTER FIX)

### Changed Code

```javascript
// BEFORE (WRONG):
// 1. Trashing processed source files (tracked in SysFileRegistry)
let trashedSourceFiles = 0;
for (let i = 1; i < fileRegistryData.length; i++) {
    const row = fileRegistryData[i];
    const sourceFileId = row[sourceFileIdCol];
    if (sourceFileId) {
        DriveApp.getFileById(sourceFileId).setTrashed(true);
        trashedSourceFiles++;
    }
}

// AFTER (FIXED):
// 1. SOURCE FILES ARE EXEMPT FROM HOUSEKEEPING
// Source files in import folders should be kept for manual re-processing
// Only archived copies and exports are subject to lifecycle management
logger.info('HousekeepingService', 'manageFileLifecycle',
    'Source import files are exempt from housekeeping. Skipping source file cleanup.');
```

### What Changed

**Removed:**
- ❌ Loop through SysFileRegistry
- ❌ Trash source files

**Added:**
- ✅ Log message explaining exemption
- ✅ Clear comment about policy

---

## Corrected File Lifecycle

### 1. Source Import Files (EXEMPT)
**Location:** Import source folders (`source_folder_id` in jobs.json)
**Policy:** **NEVER DELETE**
**Reason:** Needed for manual re-processing and audit trail

**Example:**
- `ComaxProducts.csv` in folder `1bPsgqtH2Wcd_vuLGFQGQiYP85TKHD-3j`
- Kept indefinitely
- Manual cleanup only

---

### 2. Archived Import Files
**Location:** Archive folder (`system.folder.archive`)
**Policy:** Delete after **365 days** (ARCHIVE_FOLDER_RETENTION_DAYS)
**Reason:** Archived copies processed successfully, source still available

**Implementation (UNCHANGED):**
```javascript
// lines 289-323
const archiveFolderId = _getConfigValue('system.folder.archive', 'id');
const archiveFolder = DriveApp.getFolderById(archiveFolderId);
const archiveFiles = archiveFolder.getFiles();
const archiveThresholdDate = _getThresholdDate(ARCHIVE_FOLDER_RETENTION_DAYS);

while (archiveFiles.hasNext()) {
    const file = archiveFiles.next();
    if (file.getLastUpdated() < archiveThresholdDate) {
        file.setTrashed(true);  // ✅ Correct - trash old archives
    }
}
```

---

### 3. Export Files
**Location:** Exports folder (`system.folder.jlmops_exports`)
**Policy:**
- Move to `_Old_Exports` after **7 days** (EXPORT_RETENTION_DAYS)
- Trash from `_Old_Exports` after **90 days** (OLD_EXPORTS_RETENTION_DAYS)

**Reason:** Recent exports needed for download, old exports cleaned up

**Implementation (UNCHANGED):**
```javascript
// lines 325-377
const exportMoveThresholdDate = _getThresholdDate(EXPORT_RETENTION_DAYS);
const oldExportTrashThresholdDate = _getThresholdDate(OLD_EXPORTS_RETENTION_DAYS);

// Move to _Old_Exports after 7 days
if (file.getLastUpdated() < exportMoveThresholdDate) {
    file.moveTo(oldExportsFolder);  // ✅ Correct
}

// Trash from _Old_Exports after 90 days
if (file.getLastUpdated() < oldExportTrashThresholdDate) {
    file.setTrashed(true);  // ✅ Correct
}
```

---

## Testing the Fix

### Verify Source Files NOT Deleted

**Before Fix:**
```javascript
// Run housekeeping
housekeepingService.performDailyMaintenance();

// Check source folder
// Result: Files gone! ❌
```

**After Fix:**
```javascript
// Run housekeeping
housekeepingService.performDailyMaintenance();

// Check source folder
// Result: Files still there! ✅

// Check logs
// Expected: "Source import files are exempt from housekeeping. Skipping source file cleanup."
```

### Test Cases

**Test 1: Source Files Preserved**
1. Place `ComaxProducts.csv` in source folder
2. Run import (creates registry entry)
3. Run `housekeepingService.performDailyMaintenance()`
4. Verify source file still in folder ✅

**Test 2: Archives Still Cleaned**
1. Place old file (>365 days) in Archive folder
2. Run `housekeepingService.performDailyMaintenance()`
3. Verify old archive file trashed ✅

**Test 3: Exports Still Managed**
1. Place old export (>7 days) in Exports folder
2. Run `housekeepingService.performDailyMaintenance()`
3. Verify file moved to `_Old_Exports` ✅
4. Wait 90 days or manually set date
5. Verify file trashed from `_Old_Exports` ✅

---

## Prevention

### Code Review Checklist

When adding file lifecycle management:
- [ ] Is this file in a SOURCE import folder?
- [ ] Does user need it for re-processing?
- [ ] Is there an archive/backup elsewhere?
- [ ] What's the audit/compliance requirement?
- [ ] Is deletion age-based or event-based?

### Policy Documentation

**File Retention Policies:**

| Location | Type | Retention | Rationale |
|----------|------|-----------|-----------|
| **Import Source Folders** | Source files | **Indefinite** | Manual re-processing, audit trail |
| **Archive Folder** | Processed copies | 365 days | Already processed, source exists |
| **Exports Folder** | Recent exports | 7 days | Active downloads |
| **_Old_Exports** | Archived exports | 90 days | Historical reference |

---

## Recovery Steps (If Files Already Deleted)

If source files were already deleted before this fix:

### Step 1: Check Google Drive Trash
1. Open Google Drive trash
2. Search for deleted files by date
3. Files deleted <30 days ago can be restored

### Step 2: Request Re-Export
If files >30 days in trash (permanently deleted):
1. **Comax:** Re-export `ComaxProducts.csv` from Comax ERP
2. **WooCommerce:** Re-export products from WooCommerce admin
3. **Orders:** May need to pull from order history

### Step 3: Restore to Source Folders
1. Upload re-exported files to correct source folders
2. Rename to match expected patterns (e.g., `ComaxProducts.csv`)
3. Files will be picked up on next import cycle

---

## Related Issues

This bug fix is part of the larger Phase 0/0A emergency fixes addressing:
1. ✅ Quarantine enforcement
2. ✅ Schema/mapping validation
3. ✅ **File lifecycle management** ← This fix
4. ✅ Enhanced sanity checks

---

## Deployment

### Pre-Deployment
- [x] Bug identified
- [x] Fix implemented
- [x] Documentation created
- [ ] Testing completed

### Deployment Steps
1. Upload modified `HousekeepingService.js`
2. Verify daily maintenance trigger
3. Monitor logs for "Source import files are exempt" message

### Post-Deployment Monitoring
- [ ] Verify source files NOT deleted after first run
- [ ] Verify archive cleanup still works
- [ ] Verify export cleanup still works
- [ ] Check logs for exemption message

---

## Summary

**Bug:** Daily housekeeping deleted ALL source import files
**Impact:** Lost ability to re-process imports, broken audit trail
**Fix:** Source files now exempt from housekeeping
**Result:** Import files preserved indefinitely for manual re-processing

**Files Modified:** 1 (HousekeepingService.js)
**Lines Changed:** 19 → 4 (removed deletion loop)
**Status:** ✅ FIXED - Ready for deployment

---

**Fixed By:** Claude (Anthropic)
**Date:** 2025-12-08
**Related:** Phase 0/0A Emergency Fixes
