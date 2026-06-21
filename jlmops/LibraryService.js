/**
 * @file LibraryService.js
 * @description State writer for the content library (CONTENT_LIBRARY_PLAN.md phase 7).
 *
 * Phase 7a shipped: addEntity + spawnContentChain.
 * Phase 7b shipped: createBlankDoc + attachExistingDoc + lockVersion + logEntityActivity.
 *
 * Activity log lives in SysLibraryActivity inside JLMops_Data (ops-only territory
 * per §8 + §17 workbook placement rule); opened via SheetAccessor.getDataSheet.
 *
 * Library workbook is JLMops_Library (separate from JLMops_Data) — opened via
 * SheetAccessor.getLibrarySheet, NOT the DriveApp.getFilesByName pattern that
 * LookupService uses for JLMops_Data tabs (see plan §4 + §17 phase 7).
 *
 */

const LibraryService = (function() {
    const _cache = new Map();

    const LIBRARY_SHEET = 'SysLibrary';

    // §6 entity types — physical library rows. Matches content/register-library.js TYPES.
    const VALID_TYPES = ['blog', 'news', 'mention', 'email', 'social', 'template', 'image', 'customer', 'other'];

    // §6 language axis — null/empty for language-agnostic entities.
    const VALID_LANGUAGES = ['en', 'he', null, ''];

    // §6 sibling-language types (the rest are language-agnostic or virtual).
    const SIBLING_LANGUAGE_TYPES = ['blog', 'news', 'mention', 'email', 'social', 'template'];

    /**
     * Opens the library sheet and reads all rows into objects keyed by header.
     * @returns {{ sheet, headers, rows }} sheet handle + header array + row objects.
     * @private
     */
    function _openLibrary() {
        const sheet = SheetAccessor.getLibrarySheet(LIBRARY_SHEET);
        const range = sheet.getDataRange();
        const values = range.getValues();
        const headers = values[0] || [];
        const rows = values.slice(1).map(row => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = row[i]; });
            return obj;
        });
        return { sheet: sheet, headers: headers, rows: rows };
    }

    /**
     * Converts a camelCase typeField key to its slb_* column name.
     * `wpPostId` → `slb_WpPostId`. `docUrl` → `slb_DocUrl`.
     * @private
     */
    function _typeFieldToColumn(key) {
        if (!key) return '';
        return 'slb_' + key.charAt(0).toUpperCase() + key.slice(1);
    }

    /**
     * Validates an entity payload per §20 slug + §6 controlled vocabulary.
     * Throws on first failure with a descriptive message.
     * @private
     */
    function _validateEntity({ slug, type, language }) {
        if (!slug || typeof slug !== 'string') {
            throw new Error('slug is required');
        }
        if (!/^[a-z0-9-]+$/.test(slug)) {
            throw new Error(`slug "${slug}" must be lowercase kebab-case (a-z, 0-9, hyphen)`);
        }
        if (VALID_TYPES.indexOf(type) === -1) {
            throw new Error(`type "${type}" not in vocabulary: ${VALID_TYPES.join(', ')}`);
        }
        if (!slug.startsWith(type + '-')) {
            throw new Error(`slug "${slug}" must start with type prefix "${type}-"`);
        }
        const lang = language || null;
        if (VALID_LANGUAGES.indexOf(lang) === -1) {
            throw new Error(`language "${language}" must be one of: en, he, null`);
        }
        if (lang && !slug.endsWith('-' + lang)) {
            throw new Error(`slug "${slug}" must end with language suffix "-${lang}"`);
        }
    }

    /**
     * Validates that every reference slug exists in the provided slug set.
     * @private
     */
    function _validateReferences(references, knownSlugs, opts) {
        const soft = !!(opts && opts.soft);
        for (let i = 0; i < references.length; i++) {
            const ref = references[i];
            if (!knownSlugs.has(ref)) {
                if (soft) continue;  // ad-hoc refs (coupon codes, free-text) per phase 11 email
                throw new Error(`reference "${ref}" does not resolve to a SysLibrary row`);
            }
        }
    }

    /**
     * Creates a SysLibrary entity row keyed by slug.
     *
     * Seeds a pre-work stub at state='draft', version=0 — per §5 "Two write paths,
     * two lifecycle moments". The session-side register-library.js writes
     * state='published', version=1 for completed work; this UI/chain-spawn path
     * writes draft/v0 for planned work. lockVersion (phase 7b) bumps to locked/v1.
     *
     * On existing slug → returns { deduplicated: true, entity: existingRow } without
     * writing. Safe to call repeatedly with the same slug.
     *
     * @param {Object} params - { slug, type, language, title, references, typeFields }
     * @returns {Object} { deduplicated: boolean, entity: Object }
     */
    function addEntity(params) {
        const slug = params.slug;
        const type = params.type;
        const language = params.language || null;
        const title = params.title || '';
        const references = Array.isArray(params.references) ? params.references : [];
        const typeFields = params.typeFields || {};
        const softReferences = !!params.softReferences;

        _validateEntity({ slug: slug, type: type, language: language });

        const { sheet, headers, rows } = _openLibrary();
        const slugColIdx = headers.indexOf('slb_Slug');
        if (slugColIdx === -1) {
            throw new Error(`SysLibrary missing column 'slb_Slug'`);
        }

        // Dedup: existing slug → return existing row without write.
        const existing = rows.find(r => r.slb_Slug === slug);
        if (existing) {
            return { deduplicated: true, entity: existing };
        }

        // Reference resolution — must exist in current SysLibrary read.
        // Note: spawnContentChain handles intra-call references (EN sibling
        // added first, then HE references it) by flushing between calls.
        // softReferences=true allows ad-hoc tokens (coupon codes, free-text)
        // through unvalidated per CONTENT_LIBRARY_PLAN §17 phase 11 email.
        const knownSlugs = new Set(rows.map(r => r.slb_Slug));
        _validateReferences(references, knownSlugs, { soft: softReferences });

        const now = new Date().toISOString();
        let createdBy = 'session';
        try {
            createdBy = Session.getActiveUser().getEmail() || 'session';
        } catch (e) {
            // Session not available in some contexts (e.g. trigger).
        }

        const fieldMap = {
            slb_Slug: slug,
            slb_Title: title,
            slb_ContentType: type,
            slb_Language: language || '',
            slb_State: 'draft',
            slb_Version: 0,
            slb_CreatedDate: now,
            slb_CreatedBy: createdBy,
            slb_LastTouched: now,
            slb_References: references.join(',')
        };

        // Optional target publish date — the deficiency-view demand signal
        // (CONTENT_WORKFLOW_REDESIGN_PLAN Decision 1). Written only when supplied;
        // ignored gracefully until slb_TargetDate is synced into the sheet header.
        if (params.targetDate) {
            fieldMap.slb_TargetDate = params.targetDate;
        }

        // Apply typeFields → slb_* columns where they exist.
        Object.keys(typeFields).forEach(key => {
            const col = _typeFieldToColumn(key);
            if (headers.indexOf(col) > -1) {
                fieldMap[col] = typeFields[key];
            }
        });

        const newRow = headers.map(h => (fieldMap[h] !== undefined ? fieldMap[h] : ''));
        sheet.appendRow(newRow);
        SpreadsheetApp.flush();

        _cache.delete('library.entities');

        // Re-shape persisted row for return.
        const persisted = {};
        headers.forEach((h, i) => { persisted[h] = newRow[i]; });
        return { deduplicated: false, entity: persisted };
    }

    /**
     * Spawns a content task chain: entity rows + tasks attached polymorphically.
     *
     * For sibling-language types (blog/news/mention/email/social/template): creates
     * two entity rows (`-en` + `-he` with HE referencing EN), then for each stage in
     * `stages` creates a task attached to the sibling identified by
     * `CONTENT_STAGES[stage].target_sibling`.
     *
     * For language-agnostic types (image): creates one entity row, all tasks
     * attach to it.
     *
     * Stream code generation matches the existing WebAppProjects_createContentStream
     * logic (first 3 letters uppercase + random suffix), or accepts a user-supplied
     * streamId.
     *
     * @param {Object} params - { entityType, baseSlug, contentName, stages, streamId?, targetDate? }
     * @returns {Object} { entities, tasks, streamCode, deduplicated_entities }
     */
    function spawnContentChain(params) {
        const entityType = params.entityType;
        const contentName = params.contentName;
        const stages = params.stages || [];
        const streamId = params.streamId;
        const targetDate = params.targetDate || '';
        const userRefs = Array.isArray(params.references)
            ? params.references.map(r => String(r).trim()).filter(Boolean)
            : [];

        if (!entityType) throw new Error('entityType is required');
        if (!contentName || !contentName.trim()) throw new Error('contentName is required');
        if (!stages.length) throw new Error('stages must not be empty');
        if (VALID_TYPES.indexOf(entityType) === -1) {
            throw new Error(`entityType "${entityType}" not in vocabulary: ${VALID_TYPES.join(', ')}`);
        }

        // Derive baseSlug from contentName if caller did not pass one.
        const baseSlug = params.baseSlug || _deriveBaseSlug(entityType, contentName);

        // Stream code per WebAppProjects.js:211–221.
        let streamCode;
        if (streamId && String(streamId).trim()) {
            streamCode = String(streamId).trim().toUpperCase();
        } else {
            const cleaned = contentName.trim().replace(/[^a-zA-Z]/g, '').toUpperCase();
            const code = cleaned.substring(0, 3) || 'CNT';
            const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
            streamCode = code + suffix;
        }

        const isSiblingLanguage = SIBLING_LANGUAGE_TYPES.indexOf(entityType) > -1;

        // 1. Create entity rows.
        const entities = [];
        const deduplicated_entities = [];

        if (isSiblingLanguage) {
            const enSlug = baseSlug + '-en';
            const heSlug = baseSlug + '-he';

            const enResult = addEntity({
                slug: enSlug, type: entityType, language: 'en',
                title: contentName, references: userRefs.slice(),
                softReferences: true, targetDate: targetDate
            });
            entities.push(enResult.entity);
            if (enResult.deduplicated) deduplicated_entities.push(enSlug);

            const heResult = addEntity({
                slug: heSlug, type: entityType, language: 'he',
                title: contentName, references: [enSlug].concat(userRefs),
                softReferences: true, targetDate: targetDate
            });
            entities.push(heResult.entity);
            if (heResult.deduplicated) deduplicated_entities.push(heSlug);
        } else {
            const result = addEntity({
                slug: baseSlug, type: entityType, language: null,
                title: contentName, references: userRefs.slice(),
                softReferences: true, targetDate: targetDate
            });
            entities.push(result.entity);
            if (result.deduplicated) deduplicated_entities.push(baseSlug);
        }

        // 2. Spawn tasks per stage.
        const tasks = [];
        for (let i = 0; i < stages.length; i++) {
            const stageId = stages[i];
            const stageDef = CONTENT_STAGES.find(s => s.id === stageId);
            if (!stageDef) {
                throw new Error(`unknown stage "${stageId}"`);
            }

            const resolvedSlug = isSiblingLanguage
                ? baseSlug + '-' + (stageDef.target_sibling || 'en')
                : baseSlug;

            const task = TaskService.createTask(
                stageDef.typeId,
                resolvedSlug,
                contentName,
                stageDef.title + contentName,
                '',
                streamCode,
                { entityType: entityType, entityId: resolvedSlug }
            );
            if (task) tasks.push(task);
        }

        return {
            entities: entities,
            tasks: tasks,
            streamCode: streamCode,
            deduplicated_entities: deduplicated_entities
        };
    }

    /**
     * Derives a baseSlug from a free-text contentName per §20.
     * "Context" → "blog-context"; "About Page" → "blog-about-page".
     * Lowercase, kebab-case, non-alphanum collapsed to hyphens.
     * @private
     */
    function _deriveBaseSlug(entityType, contentName) {
        const topic = String(contentName).toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        if (!topic) throw new Error(`could not derive slug from contentName "${contentName}"`);
        return entityType + '-' + topic;
    }

    // ===== PHASE 7b ADDITIONS =====

    const LIBRARY_ACTIVITY_SHEET = 'SysLibraryActivity';

    /**
     * Reads a single SysLibrary row by slug.
     * @returns {Object|null} Row object keyed by header, or null if not found.
     * @private
     */
    function _getEntityRow(slug) {
        const { rows } = _openLibrary();
        return rows.find(r => r.slb_Slug === slug) || null;
    }

    /**
     * Updates fields on an existing SysLibrary row identified by slug.
     * Uses header-driven fieldMap pattern (column-mismatch-resistant).
     * @returns {Object} The persisted row, keyed by header.
     * @private
     */
    function _updateEntityRow(slug, updates) {
        const sheet = SheetAccessor.getLibrarySheet(LIBRARY_SHEET);
        const range = sheet.getDataRange();
        const values = range.getValues();
        const headers = values[0] || [];
        const slugColIdx = headers.indexOf('slb_Slug');
        if (slugColIdx === -1) {
            throw new Error(`SysLibrary missing column 'slb_Slug'`);
        }
        for (let i = 1; i < values.length; i++) {
            if (values[i][slugColIdx] === slug) {
                const rowNum = i + 1;
                const row = values[i].slice();
                Object.keys(updates).forEach(key => {
                    const colIdx = headers.indexOf(key);
                    if (colIdx > -1) row[colIdx] = updates[key];
                });
                sheet.getRange(rowNum, 1, 1, headers.length).setValues([row]);
                SpreadsheetApp.flush();
                _cache.delete('library.entities');
                const persisted = {};
                headers.forEach((h, idx) => { persisted[h] = row[idx]; });
                return persisted;
            }
        }
        throw new Error(`Entity slug "${slug}" not found in SysLibrary`);
    }

    /**
     * Derives the concept folder name from a slug.
     * Concept = slug with type prefix and language suffix stripped.
     * `blog-context-en` → `context`. `blog-june-ayiw-en` → `june-ayiw`.
     * `image-context-featured` → `context-featured` (no language suffix).
     * @private
     */
    function _deriveConcept(slug, type) {
        let s = String(slug);
        if (s.indexOf(type + '-') === 0) s = s.slice(type.length + 1);
        if (s.endsWith('-en') || s.endsWith('-he')) s = s.slice(0, -3);
        return s;
    }

    /**
     * Finds or creates a child folder by name under the given parent.
     * @private
     */
    function _getOrCreateChildFolder(parentFolder, name) {
        const matches = parentFolder.getFoldersByName(name);
        if (matches.hasNext()) return matches.next();
        return parentFolder.createFolder(name);
    }

    /**
     * Resolves /JLMops_Data/Library/<type>/<concept>/ for the given entity,
     * auto-creating missing type or concept folders.
     * Root folder ID from `system.folder.library` SysConfig.
     * @private
     */
    function _getCanonicalFolder(type, concept) {
        const rootCfg = ConfigService.getConfig('system.folder.library');
        const rootFolderId = rootCfg && rootCfg.id ? String(rootCfg.id).trim() : '';
        if (!rootFolderId) {
            throw new Error('system.folder.library not configured (expected ConfigService.getConfig(...).id)');
        }
        const rootFolder = DriveApp.getFolderById(rootFolderId);
        const typeFolder = _getOrCreateChildFolder(rootFolder, type);
        return _getOrCreateChildFolder(typeFolder, concept);
    }

    /**
     * Returns the active actor identifier for activity log writes / created_by
     * fields. Falls back to 'system' if Session is not available (trigger context).
     * @private
     */
    function _getActor() {
        try {
            return Session.getActiveUser().getEmail() || 'system';
        } catch (e) {
            return 'system';
        }
    }

    /**
     * Flips a sibling-language slug to its peer.
     * `blog-context-en` → `blog-context-he` (and vice versa).
     * Returns null if slug has no language suffix.
     * @private
     */
    function _flipPeerSlug(slug) {
        const s = String(slug);
        if (s.endsWith('-en')) return s.slice(0, -3) + '-he';
        if (s.endsWith('-he')) return s.slice(0, -3) + '-en';
        return null;
    }

    /**
     * Israel-local version stamp `yy-MM-dd-HH-mm` (script TZ = Asia/Jerusalem).
     * Big-endian + zero-padded so lexical string order == chronological order.
     * @private
     */
    function _versionStamp() {
        return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yy-MM-dd-HH-mm');
    }

    /**
     * Builds the timestamped library file name for a slug: `<slug> <yy-MM-dd-HH-mm>`
     * (CONTENT_WORKFLOW_REDESIGN_PLAN Decision 7, Plan B — every file timestamped).
     * @private
     */
    function _versionedFileName(slug) {
        return slug + ' ' + _versionStamp();
    }

    /**
     * Strips the ` yy-MM-dd-HH-mm` version suffix (and any extension) from a Drive
     * file name, yielding the bare slug. A legacy bare-slug file (pre-migration,
     * no suffix) is returned unchanged. Match the suffix by exact shape so a
     * hyphenated slug tail is never mistaken for a stamp.
     * @private
     */
    function _slugFromFileName(fileName) {
        const base = String(fileName).replace(/\.[^.]+$/, '');
        return base.replace(/ \d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/, '');
    }

    /**
     * True if `fileName` already carries a `<slug> <yy-MM-dd-HH-mm>` version suffix.
     * @private
     */
    function _isVersionedFileName(fileName) {
        return / \d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(String(fileName).replace(/\.[^.]+$/, ''));
    }

    /**
     * Extracts a Drive file ID from a pasted URL, robust to messy mobile/redirect
     * links. Prefers the canonical `/d/<id>` path segment, then a `?id=<id>` query
     * param, and only falls back to the first 25+ char run (the old behaviour) when
     * neither is present — so a tracking token like `usg=...` no longer wins over
     * the real ID. Returns '' if nothing plausible is found.
     * @private
     */
    function _extractDriveFileId(url) {
        const s = String(url || '');
        const m = s.match(/\/d\/([-\w]{25,})/)
               || s.match(/[?&]id=([-\w]{25,})/)
               || s.match(/([-\w]{25,})/);
        return m ? m[1] : '';
    }

    /**
     * Resolves (creating if missing) the flat `_archive` subfolder under
     * `system.folder.library` — the single home for superseded library files
     * (Decision 7, Plan B). Underscore prefix keeps it clear of content `<type>`
     * folders and excluded from the integrity walk.
     * @private
     */
    function _getArchiveFolder() {
        const rootCfg = ConfigService.getConfig('system.folder.library');
        const rootId = rootCfg && rootCfg.id ? String(rootCfg.id).trim() : '';
        if (!rootId) throw new Error('system.folder.library not configured');
        return _getOrCreateChildFolder(DriveApp.getFolderById(rootId), '_archive');
    }

    /**
     * Supersedes a now-displaced library file: stamps "Superseded by → <successor>"
     * at the top of the old Doc (best-effort — a non-Doc file just skips the stamp)
     * and moves it into the flat `_archive` folder. The file keeps its
     * `<slug> <ts>` name so the version order survives in the archive.
     * @private
     */
    function _supersedeFile(fileId, successorUrl) {
        try {
            const doc = DocumentApp.openById(fileId);
            const stamp = 'Superseded by → ' + successorUrl + '  (' +
                Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') + ')';
            doc.getBody().insertParagraph(0, stamp);
            doc.saveAndClose();
        } catch (e) {
            if (typeof LoggerService !== 'undefined' && LoggerService.warn) {
                LoggerService.warn('LibraryService', '_supersedeFile',
                    `Could not stamp superseded file ${fileId}: ${e.message}`);
            }
        }
        DriveApp.getFileById(fileId).moveTo(_getArchiveFolder());
    }

    /**
     * Creates a blank Google Doc at the canonical Drive path for this entity.
     * Refuses silent overwrite if a file already belongs to this slug (bare or
     * versioned) in the canonical folder. New files are named `<slug> <ts>`.
     * @param {Object} params - { entityId: slug }
     * @returns {Object} { entity: updatedRow, docUrl }
     */
    function createBlankDoc(params) {
        const entityId = params && params.entityId;
        if (!entityId) throw new Error('entityId is required');

        const entity = _getEntityRow(entityId);
        if (!entity) throw new Error(`Entity "${entityId}" not found`);

        const type = entity.slb_ContentType;
        const concept = _deriveConcept(entityId, type);
        const canonicalFolder = _getCanonicalFolder(type, concept);

        // Refuse silent overwrite — any file already belonging to this slug
        // (bare legacy name or `<slug> <ts>`) means a current version exists.
        const existingFiles = canonicalFolder.getFiles();
        while (existingFiles.hasNext()) {
            if (_slugFromFileName(existingFiles.next().getName()) === entityId) {
                throw new Error(`A file for "${entityId}" already exists in the canonical folder; refusing silent overwrite`);
            }
        }

        const doc = DocumentApp.create(_versionedFileName(entityId));
        const docId = doc.getId();

        // Seed the Doc with any inline content the entity already carries.
        // Templates/emails store slb_Subject/slb_Body inline; moving it into the
        // Doc makes the Doc the editable source of truth so users can see/edit/
        // translate it uniformly. Blogs carry no inline content, so their Doc
        // stays blank (prior behavior). slb_Body is left intact — the
        // pending-payment send still reads it until that runtime read is rewired
        // to source from the Doc.
        const seedSubject = entity.slb_Subject || '';
        const seedBody = entity.slb_Body || '';
        if (seedSubject || seedBody) {
            const docBody = doc.getBody();
            if (seedSubject) {
                docBody.appendParagraph('Subject: ' + seedSubject);
                docBody.appendParagraph('');
            }
            String(seedBody).split('\n').forEach(function(line) {
                docBody.appendParagraph(line);
            });
            doc.saveAndClose();
        }

        const file = DriveApp.getFileById(docId);
        file.moveTo(canonicalFolder);
        const docUrl = file.getUrl();

        const now = new Date().toISOString();
        const updated = _updateEntityRow(entityId, {
            slb_DocUrl: docUrl,
            slb_LastTouched: now
        });

        return { entity: updated, docUrl: docUrl };
    }

    /**
     * Attaches a Drive file as the entity's new current version (Decision 7,
     * Plan B — attach-to-replace). Moves the file into the canonical folder,
     * names it `<slug> <ts>`, repoints slb_DocUrl, and supersedes the previously
     * current file (stamp "Superseded by →" + move to _archive). Drive file ID is
     * stable through move/rename so external links keep working.
     * @param {Object} params - { entityId, driveUrl }
     * @returns {Object} { entity: updatedRow, docUrl, superseded: boolean }
     */
    function attachExistingDoc(params) {
        const entityId = params && params.entityId;
        const driveUrl = params && params.driveUrl;
        if (!entityId) throw new Error('entityId is required');
        if (!driveUrl) throw new Error('driveUrl is required');

        const fileId = _extractDriveFileId(driveUrl);
        if (!fileId) throw new Error(`Could not find a Drive file ID in "${driveUrl}". Paste the Doc's share link or open URL.`);

        const entity = _getEntityRow(entityId);
        if (!entity) throw new Error(`Entity "${entityId}" not found`);

        // Capture the currently-current file so we can supersede it once the
        // new version is attached (Decision 7, Plan B — attach-to-replace).
        const oldMatch = String(entity.slb_DocUrl || '').match(/[-\w]{25,}/);
        const oldFileId = oldMatch ? oldMatch[0] : '';

        const type = entity.slb_ContentType;
        const concept = _deriveConcept(entityId, type);
        const canonicalFolder = _getCanonicalFolder(type, concept);

        const file = DriveApp.getFileById(fileId);
        // Move if not already in canonical folder.
        const parents = file.getParents();
        let inCanonical = false;
        while (parents.hasNext()) {
            if (parents.next().getId() === canonicalFolder.getId()) {
                inCanonical = true;
                break;
            }
        }
        if (!inCanonical) {
            file.moveTo(canonicalFolder);
        }
        // Ensure the file is named `<slug> <ts>` (Decision 7, Plan B). Keep an
        // existing valid versioned name for this slug; otherwise stamp a fresh one.
        if (_slugFromFileName(file.getName()) !== entityId || !_isVersionedFileName(file.getName())) {
            file.setName(_versionedFileName(entityId));
        }

        const now = new Date().toISOString();
        const newUrl = file.getUrl();
        const updated = _updateEntityRow(entityId, {
            slb_DocUrl: newUrl,
            slb_LastTouched: now
        });

        // Replace: supersede the displaced file (stamp + move to _archive) so the
        // active folder returns to one current file per slug. Skip when there was
        // no prior file or the same file was re-attached.
        let superseded = false;
        if (oldFileId && oldFileId !== fileId) {
            _supersedeFile(oldFileId, newUrl);
            superseded = true;
            logEntityActivity({
                entityId: entityId,
                actionType: 'version_superseded',
                details: { supersededFileId: oldFileId, successorUrl: newUrl }
            });
        }

        return { entity: updated, docUrl: newUrl, superseded: superseded };
    }

    /**
     * Finishes a content-edit task: closes the originating task, updates
     * last-touched, optionally spawns a realign task on the peer-language
     * sibling, and logs it. Per Decision 7 / Plan B this no longer bumps a
     * version counter or sets a 'locked' state — versioning is file-based
     * (attach-to-replace). Name kept for the existing UI/wrapper call sites.
     *
     * @param {Object} params - { entityId, taskId, peerNeedsRealignment }
     * @returns {Object} { entity: updatedRow, task: closedTask, related_tasks: [...] }
     */
    function lockVersion(params) {
        const entityId = params && params.entityId;
        const taskId = params && params.taskId;
        const peerNeedsRealignment = !!(params && params.peerNeedsRealignment);
        if (!entityId) throw new Error('entityId is required');
        if (!taskId) throw new Error('taskId is required');

        const entity = _getEntityRow(entityId);
        if (!entity) throw new Error(`Entity "${entityId}" not found`);

        const now = new Date().toISOString();
        const updatedEntity = _updateEntityRow(entityId, {
            slb_LastTouched: now
        });

        // Close the originating task via existing TaskService surface.
        TaskService.completeTask(taskId);

        // Optionally spawn realign task on peer.
        let realignTask = null;
        let peerSlug = null;
        if (peerNeedsRealignment) {
            peerSlug = _flipPeerSlug(entityId);
            if (!peerSlug) {
                throw new Error(`Entity "${entityId}" has no language suffix; cannot derive peer slug for realignment`);
            }
            const peer = _getEntityRow(peerSlug);
            if (!peer) {
                throw new Error(`Peer entity "${peerSlug}" not found; cannot spawn realign task`);
            }
            const peerLanguage = peer.slb_Language || '';
            const realignLabel = peerLanguage === 'he' ? 'Update translation'
                : peerLanguage === 'en' ? 'Update English version'
                : 'Update peer version';
            realignTask = TaskService.createTask(
                'task.content.realign',
                peerSlug,
                peer.slb_Title || peerSlug,
                realignLabel + ': ' + (peer.slb_Title || peerSlug),
                '',
                null,
                { entityType: peer.slb_ContentType, entityId: peerSlug }
            );
        }

        // Activity log entry.
        logEntityActivity({
            entityId: entityId,
            actionType: 'version_lock',
            details: {
                peerRealignmentSpawned: !!realignTask
            },
            referencedEntities: realignTask && peerSlug ? [peerSlug] : []
        });

        return {
            entity: updatedEntity,
            task: { id: taskId, status: 'Done' },
            related_tasks: realignTask ? [realignTask] : []
        };
    }

    /**
     * Requests a correction on an entity: spawns a task.content.edit against the
     * same slug (roll-forward only per CONTENT_WORKFLOW_REDESIGN Decision 5 — a
     * corrective edit = new task = new version). The entity keeps its current
     * state (e.g. published) while the corrective task is open; closing/locking it
     * bumps the version. Logs the request to the activity log.
     * @param {Object} params - { entityId }
     * @returns {Object} { entity, task }
     */
    function requestCorrection(params) {
        const entityId = params && params.entityId;
        if (!entityId) throw new Error('entityId is required');
        const entity = _getEntityRow(entityId);
        if (!entity) throw new Error(`Entity "${entityId}" not found`);

        const task = TaskService.createTask(
            'task.content.edit',
            entityId,
            entity.slb_Title || entityId,
            'Correction: ' + (entity.slb_Title || entityId),
            '',
            null,
            { entityType: entity.slb_ContentType, entityId: entityId }
        );

        logEntityActivity({
            entityId: entityId,
            actionType: 'correction_requested',
            details: { taskId: task && task.id ? task.id : null }
        });

        return { entity: entity, task: task };
    }

    /**
     * Marks an entity abandoned: sets slb_State='abandoned' and logs the state
     * change. Explicit per CONTENT_WORKFLOW_REDESIGN Decision 6 / Resolutions Q1 —
     * never inferred from absence of tasks. The deficiency preset filters
     * abandoned pieces out.
     * @param {Object} params - { entityId }
     * @returns {Object} { entity }
     */
    function abandonEntity(params) {
        const entityId = params && params.entityId;
        if (!entityId) throw new Error('entityId is required');
        const entity = _getEntityRow(entityId);
        if (!entity) throw new Error(`Entity "${entityId}" not found`);
        const fromState = entity.slb_State || '';

        const updated = _updateEntityRow(entityId, {
            slb_State: 'abandoned',
            slb_LastTouched: new Date().toISOString()
        });

        logEntityActivity({
            entityId: entityId,
            actionType: 'state_change',
            details: { from: fromState, to: 'abandoned' }
        });

        return { entity: updated };
    }

    /**
     * Transitions an entity to 'published' when its in-app publish task closes
     * (CONTENT_WORKFLOW_REDESIGN Step 6 — the one auto-transition: draft/locked →
     * published). Logs a 'published' activity entry (with the external URL when
     * supplied). Called from the Content publish pack's Mark Published action.
     * @param {Object} params - { entityId, externalUrl? }
     * @returns {Object} { entity }
     */
    function markPublished(params) {
        const entityId = params && params.entityId;
        const externalUrl = (params && params.externalUrl) || '';
        if (!entityId) throw new Error('entityId is required');
        const entity = _getEntityRow(entityId);
        if (!entity) throw new Error(`Entity "${entityId}" not found`);

        const updated = _updateEntityRow(entityId, {
            slb_State: 'published',
            slb_LastTouched: new Date().toISOString()
        });

        logEntityActivity({
            entityId: entityId,
            actionType: 'published',
            details: externalUrl ? { externalUrl: externalUrl } : {}
        });

        return { entity: updated };
    }

    /**
     * Appends an activity log entry to SysLibraryActivity (lives in JLMops_Data).
     * Uses header-driven fieldMap pattern.
     * @param {Object} params - { entityId, actionType, details, referencedEntities, entityType? }
     * @returns {Object} { activityId }
     */
    function logEntityActivity(params) {
        const entityId = params && params.entityId;
        const actionType = params && params.actionType;
        const details = (params && params.details) || {};
        const referencedEntities = (params && params.referencedEntities) || [];
        if (!entityId) throw new Error('entityId is required');
        if (!actionType) throw new Error('actionType is required');

        // Resolve entityType: explicit param wins (for virtual entity types);
        // otherwise look up slb_ContentType from the library entity row.
        let entityType = params && params.entityType;
        if (!entityType) {
            const entity = _getEntityRow(entityId);
            if (!entity) {
                throw new Error(`Cannot resolve entityType for "${entityId}" — not in SysLibrary and no explicit entityType provided`);
            }
            entityType = entity.slb_ContentType;
        }

        const sheet = SheetAccessor.getDataSheet(LIBRARY_ACTIVITY_SHEET);
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

        const activityId = Utilities.getUuid();
        const fieldMap = {
            slba_ActivityId: activityId,
            slba_EntityType: entityType,
            slba_EntityId: entityId,
            slba_Timestamp: new Date().toISOString(),
            slba_Actor: _getActor(),
            slba_ActionType: actionType,
            slba_Summary: _summaryForActionType(actionType, details),
            slba_Details: JSON.stringify(details),
            slba_ReferencedEntities: JSON.stringify(referencedEntities)
        };

        const newRow = headers.map(h => (fieldMap[h] !== undefined ? fieldMap[h] : ''));
        sheet.appendRow(newRow);
        SpreadsheetApp.flush();

        return { activityId: activityId };
    }

    /**
     * Returns a short human-readable label per action type for slba_Summary.
     * @private
     */
    function _summaryForActionType(actionType, details) {
        switch (actionType) {
            case 'version_lock':
                // Decision 7 / Plan B: this event is now "editing done" (no
                // version counter); older rows may still carry a details.version.
                return 'Editing done' + (details && details.version ? ' (v' + details.version + ')' : '');
            case 'published':
                return 'Published' + (details && details.externalUrl ? ' to ' + details.externalUrl : '');
            case 'template_send':
                return 'Template sent';
            case 'state_change':
                return 'State changed' + (details && details.to ? ' to ' + details.to : '');
            case 'correction_requested':
                return 'Correction requested';
            default:
                return actionType;
        }
    }

    /**
     * Composite payload for the entity detail drawer (phase 9).
     * Returns the entity row + attached tasks + references-in (entities that
     * point at this one) + activity log entries — all raw row objects keyed
     * by their sheet column headers. Wrapper at WebAppLibrary_getEntityDetail
     * shapes everything to the camelCase API shape.
     *
     * @param {Object} params - { entityId: slug }
     * @returns {Object} { entity, attached_tasks: [], references_in: [], activity_log: [] }
     */
    function getEntityDetail(params) {
        const entityId = params && params.entityId;
        if (!entityId) throw new Error('entityId is required');

        const entity = _getEntityRow(entityId);
        if (!entity) {
            throw new Error(`Entity "${entityId}" not found in SysLibrary`);
        }

        // Attached tasks — rows where st_EntityId matches the slug.
        const tasksSheet = SheetAccessor.getDataSheet('SysTasks');
        const tasksValues = tasksSheet.getDataRange().getValues();
        const tasksHeaders = tasksValues[0] || [];
        const taskEntityIdIdx = tasksHeaders.indexOf('st_EntityId');
        const attachedTasks = [];
        if (taskEntityIdIdx > -1) {
            for (let i = 1; i < tasksValues.length; i++) {
                if (tasksValues[i][taskEntityIdIdx] === entityId) {
                    const taskObj = {};
                    tasksHeaders.forEach((h, idx) => { taskObj[h] = tasksValues[i][idx]; });
                    attachedTasks.push(taskObj);
                }
            }
        }

        // References in — SysLibrary rows whose slb_References (comma-joined)
        // contains this entity's slug. Reverse-lookup; computed at query time
        // per §6 reverse-index pattern.
        const libSheet = SheetAccessor.getLibrarySheet(LIBRARY_SHEET);
        const libValues = libSheet.getDataRange().getValues();
        const libHeaders = libValues[0] || [];
        const refColIdx = libHeaders.indexOf('slb_References');
        const referencesIn = [];
        if (refColIdx > -1) {
            for (let i = 1; i < libValues.length; i++) {
                const refsRaw = String(libValues[i][refColIdx] || '');
                const refs = refsRaw.split(',').map(s => s.trim()).filter(Boolean);
                if (refs.indexOf(entityId) > -1) {
                    const rowObj = {};
                    libHeaders.forEach((h, idx) => { rowObj[h] = libValues[i][idx]; });
                    referencesIn.push(rowObj);
                }
            }
        }

        // Activity log — SysLibraryActivity rows where slba_EntityId matches.
        const activitySheet = SheetAccessor.getDataSheet(LIBRARY_ACTIVITY_SHEET);
        const activityValues = activitySheet.getDataRange().getValues();
        const activityHeaders = activityValues[0] || [];
        const slbaEntityIdIdx = activityHeaders.indexOf('slba_EntityId');
        const activityLog = [];
        if (slbaEntityIdIdx > -1) {
            for (let i = 1; i < activityValues.length; i++) {
                if (activityValues[i][slbaEntityIdIdx] === entityId) {
                    const actObj = {};
                    activityHeaders.forEach((h, idx) => { actObj[h] = activityValues[i][idx]; });
                    activityLog.push(actObj);
                }
            }
        }

        return {
            entity: entity,
            attached_tasks: attachedTasks,
            references_in: referencesIn,
            activity_log: activityLog
        };
    }

    /**
     * Resolves an entity's rendered content as { subject, body }. The Doc
     * (slb_DocUrl) is the source of truth when present — email templates seed the
     * Doc as "Subject: <subject>" + blank line + body; other entities are
     * body-only. Falls back to the inline slb_Subject/slb_Body fields during
     * migration or if the Doc read fails (so a missing Doc never breaks a send).
     * @param {Object} params - { entityId }
     * @returns {Object|null} { subject, body, source: 'doc'|'fields' } or null if not found
     */
    function getEntityContent(params) {
        const entityId = params && params.entityId;
        if (!entityId) throw new Error('entityId is required');
        const entity = _getEntityRow(entityId);
        if (!entity) return null;

        const docUrl = entity.slb_DocUrl || '';
        if (docUrl) {
            try {
                const m = String(docUrl).match(/[-\w]{25,}/);
                if (m) {
                    const text = DocumentApp.openById(m[0]).getBody().getText();
                    return _parseDocContent(text, entity);
                }
            } catch (e) {
                if (typeof LoggerService !== 'undefined' && LoggerService.warn) {
                    LoggerService.warn('LibraryService', 'getEntityContent',
                        `Doc read failed for ${entityId} (${docUrl}); using inline fields: ${e.message}`);
                }
            }
        }
        return {
            subject: entity.slb_Subject || '',
            body: entity.slb_Body || '',
            source: 'fields'
        };
    }

    /**
     * Parses Doc plain text into { subject, body }. Convention (matches the
     * createBlankDoc seed): an optional leading "Subject: <text>" line, then the
     * body. Leading blank paragraphs (DocumentApp.create leaves one) are skipped;
     * trailing whitespace is trimmed. No "Subject:" line → subject falls back to
     * the entity's slb_Subject and the whole text is the body (addendum case).
     * @private
     */
    function _parseDocContent(text, entity) {
        const lines = String(text).split('\n');
        let i = 0;
        while (i < lines.length && lines[i].trim() === '') i++;
        let subject = entity.slb_Subject || '';
        if (i < lines.length && /^subject:\s?/i.test(lines[i])) {
            subject = lines[i].replace(/^subject:\s?/i, '');
            i++;
            if (i < lines.length && lines[i].trim() === '') i++;
        }
        const body = lines.slice(i).join('\n').replace(/\s+$/, '');
        return { subject: subject, body: body, source: 'doc' };
    }

    /**
     * The prompt prepended to a fresh translation draft, instructing Gemini to
     * paraphrase the English into natural Hebrew in JLM's voice rather than
     * translate literally. The live prompt is **Doc-sourced** from the
     * `template-xlt` library entity so the manager can refine it (in Docs, from
     * their own Claude account) with no deploy — the `template-xlt-*` namespace
     * holds all translation assets and can grow (e.g. `template-xlt-region` term
     * lists). Falls back to the built-in default below if that entity/Doc isn't
     * present or readable.
     * @private
     */
    const XLT_PROMPT_ENTITY = 'template-xlt';
    function _getTranslationPrompt() {
        try {
            const c = getEntityContent({ entityId: XLT_PROMPT_ENTITY });
            if (c && c.body && c.body.trim()) return c.body;
        } catch (e) {
            // fall through to the built-in default
        }
        return [
            '>>> TRANSLATION INSTRUCTION — delete this block once the Hebrew is written <<<',
            'Rewrite the English article below as a Hebrew article for JLM Wines.',
            'Do NOT translate word-for-word. Paraphrase the ideas into natural, flowing Hebrew',
            'that a native speaker would actually write. Keep JLM\'s voice: friendly, plain-spoken,',
            'no jargon, never talking down. Preserve the structure and section headings, and all',
            'facts, names and numbers. Where a literal translation would sound stiff, choose the',
            'idiomatic Hebrew phrasing instead.',
            '',
            '----- ENGLISH SOURCE BELOW -----'
        ].join('\n');
    }

    /**
     * Creates a fresh Hebrew translation draft for a sibling-language HE entity:
     * copies the EN peer's current Doc, prepends the translation prompt, and
     * attaches the copy as the HE entity's current version (superseding any
     * existing HE draft, per attach-to-replace). The translator then opens the
     * Doc and lets Gemini paraphrase in place.
     * @param {Object} params - { heEntityId }
     * @returns {Object} { entity, docUrl, superseded }
     */
    function createTranslationDraft(params) {
        const heEntityId = params && params.heEntityId;
        if (!heEntityId) throw new Error('heEntityId is required');

        const heEntity = _getEntityRow(heEntityId);
        if (!heEntity) throw new Error(`Entity "${heEntityId}" not found`);

        const enSlug = _flipPeerSlug(heEntityId);
        if (!enSlug) throw new Error(`"${heEntityId}" has no language suffix; cannot find an English peer`);
        const enEntity = _getEntityRow(enSlug);
        if (!enEntity) throw new Error(`English peer "${enSlug}" not found`);
        const enFileId = _extractDriveFileId(enEntity.slb_DocUrl);
        if (!enFileId) throw new Error(`English peer "${enSlug}" has no Doc to translate yet`);

        // Copy the EN Doc, prepend the prompt (line by line so each is its own
        // paragraph), then attach the copy as the HE entity's current version.
        const copy = DriveApp.getFileById(enFileId).makeCopy();
        const copyDoc = DocumentApp.openById(copy.getId());
        const promptLines = _getTranslationPrompt().split('\n');
        for (let i = promptLines.length - 1; i >= 0; i--) {
            copyDoc.getBody().insertParagraph(0, promptLines[i]);
        }
        copyDoc.saveAndClose();

        const result = attachExistingDoc({ entityId: heEntityId, driveUrl: copy.getUrl() });

        logEntityActivity({
            entityId: heEntityId,
            actionType: 'translation_draft_created',
            details: { fromEntity: enSlug, fromFileId: enFileId }
        });

        return result;
    }

    /**
     * One-time migration (Decision 7, Plan B): renames legacy bare-`<slug>`
     * library files to `<slug> <yy-MM-dd-HH-mm>` so every active file carries a
     * version stamp and a name-sorted view is never a mix of bare + stamped
     * names. The timestamp is derived from each file's Drive last-updated time.
     * Idempotent: already-versioned files, and files whose bare name isn't a
     * known SysLibrary slug, are skipped. The `_archive` subfolder is skipped
     * (its copies are stamped at supersede time). Run once from the editor.
     * @returns {{ scanned: number, renamed: number, skipped: number }}
     */
    function migrateLibraryFileNames() {
        const rootCfg = ConfigService.getConfig('system.folder.library');
        const rootId = rootCfg && rootCfg.id ? String(rootCfg.id).trim() : '';
        if (!rootId) throw new Error('system.folder.library not configured');

        const { rows } = _openLibrary();
        const slugSet = new Set(rows.map(r => String(r.slb_Slug).trim()).filter(Boolean));
        const tz = Session.getScriptTimeZone();
        const summary = { scanned: 0, renamed: 0, skipped: 0 };

        function walk(folder) {
            const files = folder.getFiles();
            while (files.hasNext()) {
                const file = files.next();
                summary.scanned++;
                const name = file.getName();
                const base = _slugFromFileName(name);
                // Already versioned, or not a recognised slug → leave alone.
                if (_isVersionedFileName(name) || !slugSet.has(base)) {
                    summary.skipped++;
                    continue;
                }
                const stamp = Utilities.formatDate(file.getLastUpdated(), tz, 'yy-MM-dd-HH-mm');
                file.setName(base + ' ' + stamp);
                summary.renamed++;
            }
            const subs = folder.getFolders();
            while (subs.hasNext()) {
                const sub = subs.next();
                if (sub.getName() === '_archive') continue;
                walk(sub);
            }
        }

        walk(DriveApp.getFolderById(rootId));
        if (typeof LoggerService !== 'undefined' && LoggerService.info) {
            LoggerService.info('LibraryService', 'migrateLibraryFileNames',
                `Renamed ${summary.renamed}, skipped ${summary.skipped}, scanned ${summary.scanned}.`);
        }
        return summary;
    }

    /**
     * Housekeeping backstop (Decision 7 / Plan B): when more than one `<slug> <ts>`
     * file sits in an entity's canonical folder — a stray fork, a raw Sheets-API
     * write, an attach that skipped the clean path — the newest (max timestamp,
     * lexical) wins. Repoints `slb_DocUrl` to it if needed and supersedes the rest
     * (stamp + move to `_archive`). The normal attach-to-replace path keeps folders
     * to one file per slug; this only catches what skipped it. Idempotent.
     * @returns {{ entitiesChecked: number, duplicatesResolved: number, repointed: number }}
     */
    function reconcileLibraryDuplicates() {
        const { rows } = _openLibrary();
        const summary = { entitiesChecked: 0, duplicatesResolved: 0, repointed: 0 };

        rows.forEach(function(entity) {
            const slug = String(entity.slb_Slug || '').trim();
            const type = entity.slb_ContentType;
            if (!slug || !type) return;
            summary.entitiesChecked++;

            let folder;
            try {
                folder = _getCanonicalFolder(type, _deriveConcept(slug, type));
            } catch (e) { return; }

            // Files in the canonical folder belonging to this slug.
            const matches = [];
            const files = folder.getFiles();
            while (files.hasNext()) {
                const f = files.next();
                if (_slugFromFileName(f.getName()) === slug) matches.push(f);
            }
            if (matches.length < 2) return;

            // Newest wins — big-endian timestamp suffix sorts lexically.
            matches.sort(function(a, b) {
                const an = a.getName(), bn = b.getName();
                return an < bn ? 1 : (an > bn ? -1 : 0);
            });
            const current = matches[0];
            const currentUrl = current.getUrl();

            // Repoint if the entity isn't already pointing at the newest.
            if (_extractDriveFileId(entity.slb_DocUrl) !== current.getId()) {
                _updateEntityRow(slug, { slb_DocUrl: currentUrl, slb_LastTouched: new Date().toISOString() });
                summary.repointed++;
            }

            // Supersede the older duplicates (collected list, so moving is safe).
            for (let i = 1; i < matches.length; i++) {
                _supersedeFile(matches[i].getId(), currentUrl);
                summary.duplicatesResolved++;
            }

            logEntityActivity({
                entityId: slug,
                actionType: 'duplicates_reconciled',
                details: { kept: current.getName(), superseded: matches.length - 1 }
            });
        });

        if (typeof LoggerService !== 'undefined' && LoggerService.info) {
            LoggerService.info('LibraryService', 'reconcileLibraryDuplicates',
                `Checked ${summary.entitiesChecked}, resolved ${summary.duplicatesResolved} duplicate(s), repointed ${summary.repointed}.`);
        }
        return summary;
    }

    return {
        addEntity: addEntity,
        getEntityContent: getEntityContent,
        spawnContentChain: spawnContentChain,
        createBlankDoc: createBlankDoc,
        attachExistingDoc: attachExistingDoc,
        createTranslationDraft: createTranslationDraft,
        lockVersion: lockVersion,
        requestCorrection: requestCorrection,
        abandonEntity: abandonEntity,
        markPublished: markPublished,
        logEntityActivity: logEntityActivity,
        getEntityDetail: getEntityDetail,
        getEntityBySlug: _getEntityRow,
        slugFromFileName: _slugFromFileName,
        migrateLibraryFileNames: migrateLibraryFileNames,
        reconcileLibraryDuplicates: reconcileLibraryDuplicates
    };
})();

/**
 * Editor entry point for the one-time Decision 7 / Plan B file-name migration.
 * Run this once from the Apps Script editor (file: LibraryService.gs) after the
 * naming change deploys. Safe to re-run — idempotent.
 */
function runLibraryFileNameMigration() {
    return LibraryService.migrateLibraryFileNames();
}

/**
 * Editor entry point for the Decision 7 / Plan B duplicate backstop: resolves any
 * canonical folder holding more than one `<slug> <ts>` file (newest wins, rest
 * superseded to `_archive`). Also runs in the daily maintenance batch. Idempotent.
 */
function runLibraryDuplicateReconcile() {
    return LibraryService.reconcileLibraryDuplicates();
}
