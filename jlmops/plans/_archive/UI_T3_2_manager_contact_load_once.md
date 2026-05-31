# UI Tier 3.2 — ManagerContactView load-once + client-filter

**Session ID:** UI_T3_2
**Status:** **SHIPPED 2026-05-29 (@165 deploy @169, commit `fd8441e`).** Load-once on mount + client-side filter live. Deviations from plan v1: (1) match scope is **email + name only** — phone dropped per user (mid-debug it was the crash source), city excluded as mutable; (2) **recent 50 contacts render on load** via a new `showDefaultList()` instead of a blank "type to search" prompt, per user request; (3) extracted a shared `renderContactList(contacts, opts)` helper (search + default view) with a "showing first N" cap note. **Root-cause caught during smoke:** the client filter called `c.phone.toLowerCase()`; phone is stored **numeric**, numbers have no `.toLowerCase()`, so the `.filter()` callback threw and the entire search rendered nothing — fixed by `String()`-guarding every field. Also fixed a load-race (the success handler reset to the empty state, clobbering a query typed during load) — now re-runs the pending query on cache ready. Closes `.claude/bugs.md` 2026-05-15 + `BUG_FIX_SEQUENCE.md` Session G. **Process note:** `deploy.ps1` now auto-stamps `VERSION.built` with real Israel-local time and owns `clasp push` (built during this session after hand-typed stamps drifted ~30 min). — Plan v1 (2026-05-28); all gaps below were resolved via code reading:
- **Search round-trip pattern confirmed:** `ManagerContactView.html:219-258` `runSearch` calls `WebAppContacts_getContactList({ search: query })` after 250ms debounce → server filter → return matched list. Per-keystroke round-trip.
- **AdminContactsView precedent verified:** loads once, filters client-side. Same backend function (`WebAppContacts_getContactList`) accepts `{}` (no filter) to return all formatted contacts. Per `WebAppContacts.js:69-79`, response shape is `{contacts, stats, filters}`.
- **Refresh strategy committed:** no explicit Refresh button — view mount IS the refresh. ManagerContactView is mobile-first; an additional button clutters; users on phone naturally re-navigate. Cache staleness on long-running views accepted as low-risk (manager uses view briefly during calls; desktop power-users navigate away+back trivially).
- **Client-side filter scope:** match against email, name, phone, city — the four fields rendered in the list. Case-insensitive substring.

**Parent:** `UI_AUDIT.md` §5 Tier 3.2
**Estimated effort:** 1 session, 1 staged deploy.
**Depends on:** Soft order: after T2.6 Stage C (ManagerContactView adopts TaskWidgets `esc`) so this session edits the post-kit file. If T2.6 hasn't shipped, simply preserve the local `esc` and ignore TaskWidgets adoption in this session — they're independent changes.

## Session goal

Replace per-keystroke server round-trip with load-once on mount + client-side filter. Closes `.claude/bugs.md` 2026-05-15 (ManagerContactView search latency) and `BUG_FIX_SEQUENCE.md` Session G. Removes one of the top 5 speed offenders identified by the optimize agent.

## Session opening checklist

1. Working tree clean (`git status`).
2. Pinned deploy ID matches `.deployment-id`.
3. clasp auth fresh.
4. Re-read `ManagerContactView.html:175-181` (state object), `:219-265` (runSearch + debounce wiring), `:481-498` (mount init). Confirm session-time state matches plan.
5. Confirm whether T2.6 Stage C has shipped (changes `esc` calls to `TaskWidgets.escape`). If shipped, use `TaskWidgets.escape` throughout new code. If not, keep local `esc`.

## Stage A — Load-once on mount + client-side filter

**Why one stage.** Single behavioral change in a single file. Atomic.

**Files.**
- Edit `jlmops/ManagerContactView.html` — state extension + mount-time fetch + runSearch refactor.

**Changes.**

### Part 1: Extend the state object

Modify `ManagerContactView.html:175-181`:

```javascript
// before:
var state = {
  currentEmail: null,
  currentContact: null,
  currentLanguage: 'en',
  openTask: null,
  searchDebounce: null
};

// after:
var state = {
  currentEmail: null,
  currentContact: null,
  currentLanguage: 'en',
  openTask: null,
  searchDebounce: null,
  contacts: null,       // cached full list; null until loadAllContacts resolves
  loadError: null       // error message if initial load failed
};
```

### Part 2: Add `loadAllContacts` function

Insert before the `runSearch` function at `:219`:

```javascript
function loadAllContacts() {
  // Initial paint already shows "Type at least 2 characters to search".
  // Replace with a brief loading marker so the user knows the cache is filling.
  if (!state.contacts && listContainer.querySelector('.mc-empty')) {
    listContainer.innerHTML = '<div class="mc-empty">Loading contacts…</div>';
  }
  google.script.run
    .withSuccessHandler(function(data) {
      if (!data || data.error) {
        state.loadError = (data && data.error) || 'Failed to load contacts';
        state.contacts = [];
        listContainer.innerHTML = '<div class="mc-empty">Error: ' + esc(state.loadError) + '</div>';
        return;
      }
      state.contacts = data.contacts || [];
      state.loadError = null;
      // Restore the initial "type to search" empty state now that cache is ready.
      listContainer.innerHTML = '<div class="mc-empty">Type at least 2 characters to search</div>';
    })
    .withFailureHandler(function(err) {
      state.loadError = (err && err.message) || String(err);
      state.contacts = [];
      listContainer.innerHTML = '<div class="mc-empty">Error: ' + esc(state.loadError) + '</div>';
    })
    .WebAppContacts_getContactList({});  // no filter — returns all contacts
}
```

If T2.6 Stage C has shipped, replace `esc(` with `TaskWidgets.escape(` per the kit-adopted file convention.

### Part 3: Rewrite `runSearch` to filter client-side

Replace the entire `runSearch` function at `:219-259`:

```javascript
function runSearch(query) {
  if (!query || query.length < 2) {
    listContainer.innerHTML = '<div class="mc-empty">Type at least 2 characters to search</div>';
    return;
  }
  if (state.contacts === null) {
    listContainer.innerHTML = '<div class="mc-empty">Still loading contacts… try again in a moment</div>';
    return;
  }
  if (state.loadError) {
    listContainer.innerHTML = '<div class="mc-empty">Error: ' + esc(state.loadError) + '</div>';
    return;
  }

  var q = query.toLowerCase();
  var matches = state.contacts.filter(function(c) {
    return (c.email || '').toLowerCase().indexOf(q) >= 0
        || (c.name || '').toLowerCase().indexOf(q) >= 0
        || (c.phone || '').toLowerCase().indexOf(q) >= 0
        || (c.city || '').toLowerCase().indexOf(q) >= 0;
  });
  var contacts = matches.slice(0, 50);

  if (contacts.length === 0) {
    listContainer.innerHTML = '<div class="mc-empty">No matches</div>';
    return;
  }

  var html = '<div class="mc-list">';
  contacts.forEach(function(c) {
    var meta = [];
    if (c.phone) meta.push(c.phone);
    if (c.city) meta.push(c.city);
    if (c.orderCount) meta.push(c.orderCount + ' order' + (c.orderCount === 1 ? '' : 's'));
    html += '<div class="mc-list-item" data-email="' + esc(c.email) + '">' +
      '<div class="mc-list-name">' + esc(c.name || c.email) + '</div>' +
      '<div class="mc-list-meta">' + esc(c.email) + (meta.length ? ' · ' + esc(meta.join(' · ')) : '') + '</div>' +
    '</div>';
  });
  html += '</div>';
  listContainer.innerHTML = html;
  Array.prototype.forEach.call(listContainer.querySelectorAll('.mc-list-item'), function(el) {
    el.addEventListener('click', function() {
      openDetail(el.getAttribute('data-email'));
    });
  });
}
```

Same kit-adoption note: replace `esc(` with `TaskWidgets.escape(` if T2.6 Stage C shipped.

### Part 4: Trigger the load on mount

Modify the mount block at `:481-498`. Add `loadAllContacts()` call BEFORE the deep-link check so the cache fills in parallel with any detail-view open:

```javascript
// before (:485-498):
var deepLinkEmail = null;
try {
  deepLinkEmail = sessionStorage.getItem('selectContactEmail');
  if (deepLinkEmail) sessionStorage.removeItem('selectContactEmail');
} catch (storageErr) {
  deepLinkEmail = null;
}

if (deepLinkEmail) {
  openDetail(deepLinkEmail);
} else {
  setTimeout(function() { searchInput.focus(); }, 50);
}

// after — add loadAllContacts() at top, rest unchanged:
loadAllContacts();

var deepLinkEmail = null;
try {
  deepLinkEmail = sessionStorage.getItem('selectContactEmail');
  if (deepLinkEmail) sessionStorage.removeItem('selectContactEmail');
} catch (storageErr) {
  deepLinkEmail = null;
}

if (deepLinkEmail) {
  openDetail(deepLinkEmail);
} else {
  setTimeout(function() { searchInput.focus(); }, 50);
}
```

The `loadAllContacts` call fires asynchronously; the rest of the mount continues immediately. If the user is fast enough to type a 2+ character query before the cache loads, the runSearch hits the "Still loading contacts…" branch and waits.

### Part 5: Keep the existing debounce wiring

The 250ms debounce at `:261-265` stays. Even with client-side filter, debouncing avoids running the filter on every keystroke for fast typists — a tiny perf consideration but harmless to preserve. (Could be reduced to 50ms or removed entirely; not worth the change in this session.)

**Smoke.**
- `clasp push`. Deploy via `pwsh -NoProfile -File jlmops/deploy.ps1 "ui T3.2: ManagerContactView load-once + client-filter (closes BUG_FIX_SEQUENCE Session G)"`.
- **Initial load smoke (phone or desktop):** open Manager Contacts. Expect "Loading contacts…" briefly, then "Type at least 2 characters to search". Open browser Network tab — confirm ONE `WebAppContacts_getContactList` round-trip on mount.
- **Search smoke:** type "ka" — expect instant filtered results (no spinner, no network round-trip per keystroke). Confirm Network tab shows NO new `getContactList` calls during typing.
- **Race condition smoke:** open the view and immediately type a 2+ character query before the cache loads (use throttled network if needed). Confirm "Still loading contacts… try again in a moment" message; retype after 1-2 sec, expect results.
- **Deep-link smoke:** from manager dashboard task widget, click "Open contact" on a `task.contact.outreach` task. Confirm contact detail opens directly (deep-link path unchanged); `loadAllContacts` still runs in parallel (Network tab shows the round-trip even though search view isn't visible).
- **Cache-staleness smoke (optional):** add a new contact via another workflow (e.g., CRM operations Refresh in AdminContactsView). Without navigating away from ManagerContactView, the new contact won't appear in search — confirm. Navigate away (e.g., to Dashboard) and back to Manager Contacts. New contact now searchable. **This is the accepted staleness behavior.**
- **Console:** zero errors.

**Rollback.**
- Git revert + redeploy.

**Risk.**
- **Low.** Backend untouched. Failure mode: if the load fails, runSearch shows the error string. View remains usable for openDetail (which doesn't depend on the cached list).

**Commit.** `ui(ManagerContact): load contacts once on mount + filter client-side (closes BUG_FIX_SEQUENCE Session G; was per-keystroke round-trip)`

## Session-end checklist

After Stage A committed + deployed:

1. **Git log review.** One commit.
2. **Live smoke** — all paths above.
3. **BUG_FIX_SEQUENCE.md update:** mark Session G as RESOLVED via UI T3.2 with deploy ref.
4. **`.claude/bugs.md` update:** strike the 2026-05-15 entry and add resolution note pointing at UI T3.2 deploy.
5. **Update `UI_AUDIT.md` §10 status:** mark T3.2 SHIPPED.
6. **Update `.claude/session-log.md`:** brief note.
7. **CCP-UI audit:**
   - CCP-UI-5 (load-once + client-filter): applied — primary CCP-UI for this session.

## Notes for future sessions

- **Server-side `WebAppContacts.js:12` `getContactList` filter branch becomes dead** for the Manager view but still serves AdminContactsView's load path (which also uses `{}` — verify) and any other consumer that might query with `{search}`. **Defer cleanup** of the server-side filter branch until a separate session can audit all callers; harmless to leave for now.
- **Cache-invalidation hook deferred:** if the manager wants live updates without navigation, future option: trigger `loadAllContacts()` after a `runCrmRefresh` action completes in AdminContactsView. Cross-view coordination is non-trivial; only worth building if the staleness becomes a real complaint.
