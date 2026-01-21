# Manager UI Plan

## Manager Role Scope

Manager has a **limited, focused role**:

**Dedicated Views (operational workflows):**
- ManagerOrdersView - packing slips, open orders
- ManagerInventoryView - product counts, Brurya stock
- ManagerProductsView - product detail edits

**Dashboard Task Widget (all manager tasks):**
- Content: `task.content.edit`, `task.content.translate_edit`
- Inventory-related tasks from stock workflows
- Product-related tasks from detail workflows
- Filterable by topic to focus on specific area

**Future:**
- CRM-related tasks (will need CRM view)

**Everything else is admin-only** - all other content tasks, deficiency, validation, data sync, system tasks, CRM (current).

---

## Design Philosophy

**Single dashboard with role-based visibility**, not separate dashboards.

Benefits:
- Shared codebase, easier maintenance
- Manager sees context (dimmed admin-only items) rather than isolated view
- Admin can preview manager experience
- Graceful degradation if roles change

---

## 1. Role-Based CSS Visibility

### Approach

Detect user role on page load, apply class to body:
```html
<body class="role-manager">  <!-- or role-admin -->
```

CSS classes for elements:
```css
/* Hide completely for this role */
.role-manager .admin-only { display: none; }

/* Dim to show context but not focus */
.role-manager .admin-focus { opacity: 0.4; pointer-events: none; }

/* Highlight for this role */
.role-manager .manager-focus { background: #fffde7; }
```

### Widget-Level Visibility

| Widget | Admin | Manager |
|--------|-------|---------|
| System Health | visible | hidden |
| Sync Status | visible | hidden |
| Orders Summary | visible | dimmed (context) |
| Inventory Alerts | visible | manager rows highlighted |
| Products Summary | visible | manager rows highlighted |
| Projects Summary | visible | visible |
| **Tasks Widget** | visible | **primary focus** |

### Row-Level Visibility (within widgets)

Inventory widget rows:
- "Low stock requiring reorder decision" → manager-focus
- "Sync validation errors" → admin-focus (dimmed)

Products widget rows:
- "Translation review needed" → manager-focus
- "SKU mapping issues" → admin-focus (dimmed)

---

## 2. Manager Task Widget

### Location & Size

Full-width card below the summary widgets, showing all manager-relevant tasks.

### Scope

Shows all tasks assigned to manager:
- Content review: `task.content.edit`, `task.content.translate_edit`
- Inventory-related tasks (from counts, stock workflows)
- Product detail tasks (from product updates workflow)
- Future: CRM tasks

### Filtering

| Filter | Options |
|--------|---------|
| Project/Topic | All / Content / Inventory / Products |
| Task Type | All / specific types |
| Status | Open / Done / All |

Manager can focus on content tasks when needed, but see full workload context.

### Columns

| Column | Width | Notes |
|--------|-------|-------|
| Title | 30% | Click to expand inline |
| Topic | 12% | Content, Inventory, Products |
| Entity | 18% | Content name, SKU, etc. |
| Due | 12% | Red if overdue |
| Status | 13% | Dropdown: New/In Progress/Done |
| Link | 15% | Open in Drive / Navigate to view |

### Inline Editing (Manager)

**Allowed:**
- Status: New ↔ In Progress ↔ Done
- Notes: Free text (feedback, rejection reason)

**Not Allowed:**
- Title, dates, priority, assignee (admin sets these)

### Click Behavior by Task Type

| Task Type | Click Action |
|-----------|--------------|
| Content tasks | Expand inline + Drive link |
| Inventory tasks | Navigate to ManagerInventoryView |
| Product tasks | Navigate to ManagerProductsView |

### Row Expansion

Click row to expand inline:
```
┌─────────────────────────────────────────────────┐
│ ▼ Edit: Intensity                   Due: Jan 25 │
├─────────────────────────────────────────────────┤
│ Stream: INTABC                                  │
│                                                 │
│ [Open in Drive]                                 │
│                                                 │
│ Notes:                                          │
│ ┌─────────────────────────────────────────────┐ │
│ │ Good draft. Tightened intro paragraph.      │ │
│ │ Ready for translation.                      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Status: [Done ▼]                        [Save]  │
└─────────────────────────────────────────────────┘
```

Manager workflow:
1. See task in list
2. Click to expand
3. Click "Open in Drive" → review/edit document
4. Return, add notes (feedback or rejection reason)
5. Set status: Done (approve) or keep open with notes (reject)
6. Save

---

## 3. List View vs Calendar View

### List View (Default)

The task widget described above. Sorted, filterable list of all manager tasks.

### Calendar View (Toggle)

Week or month view showing all manager tasks by due date.

```
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Sun │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│     │ 20  │ 21  │ 22  │ 23  │ 24  │ 25  │
│     │     │ ●●  │ ●   │ ●   │ ●●● │     │
│     │     │Edit │Trans│Count│Prod │     │
│     │     │x2   │     │     │x3   │     │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘

● = task dot, color-coded by topic (Content, Inventory, Products)
```

Click date cell → filter list to that date's tasks.

Filters apply to both views - filter to Content topic shows only content tasks in calendar.

**Implementation:** CSS grid, no external library. Tasks positioned by due date.

---

## 4. Click-Through Navigation

### Widget → View Navigation

Dashboard widgets link to dedicated Manager views:

| Widget | Click Action |
|--------|--------------|
| Orders widget | Navigate to ManagerOrdersView |
| Inventory widget | Navigate to ManagerInventoryView |
| Products widget | Navigate to ManagerProductsView |

### Content Tasks (Dashboard Only)

Manager's content tasks stay on dashboard - work happens externally in Drive:

| Task Type | Click Action |
|-----------|--------------|
| `task.content.edit` | Expand inline + open Drive link |
| `task.content.translate_edit` | Expand inline + open Drive link |

### Future: CRM Tasks

When CRM view is implemented:

| Task Type | Click Action |
|-----------|--------------|
| `task.crm.*` | Navigate to ManagerCRMView |

### Inline Expansion for Project Tasks

When work happens externally, dashboard provides everything manager needs:

```
┌─────────────────────────────────────────────────────────┐
│ ▼ Edit: Intensity                          Due: Jan 25 │
├─────────────────────────────────────────────────────────┤
│ Entity: Intensity                                       │
│ Link: [Open in Drive]                                   │
│                                                         │
│ Notes:                                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Good draft. Changed intro paragraph for clarity.    │ │
│ │ Ready for translation.                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Status: [Done ▼]                            [Save]      │
└─────────────────────────────────────────────────────────┘
```

Manager workflow:
1. Click task row → expands inline
2. Click "Open in Drive" → new tab with document
3. Do the work externally
4. Return to dashboard, add notes
5. Change status to Done (or add rejection notes)
6. Save

---

## 5. Integration Strategy

### Manager vs Admin Task Ownership

**Manager tasks:**
- `task.content.edit` - Review/edit content draft
- `task.content.translate_edit` - Review/edit translation
- Future: CRM-related tasks

**Admin tasks (everything else):**
- All other content tasks (draft, translate, images, publish, etc.)
- All validation tasks
- All deficiency tasks
- All system tasks (orders_ready, brurya_reminder, data sync)
- All CRM tasks (current implementation)

### Content Workflow - Manager's Role

```
Admin: Draft
         ↓
    [task.content.edit] ──→ Manager reviews in Drive
                              ↓
                         Adds notes, marks Done
                              ↓
Admin: Translate
         ↓
    [task.content.translate_edit] ──→ Manager reviews translation
                                        ↓
                                   Adds notes, marks Done
                                        ↓
Admin: Images, Publish, etc.
```

### Manager's Operational Workflows

These happen in dedicated views, not through the task system:

| Workflow | View | Actions |
|----------|------|---------|
| Order processing | ManagerOrdersView | Packing slips, order review |
| Inventory counts | ManagerInventoryView | Product counts, Brurya stock updates |
| Product edits | ManagerProductsView | Detail updates, data maintenance |

### Manager's Daily View

1. **Dashboard loads** → sees dimmed admin widgets for context
2. **Task widget** → shows content edit/translate tasks only
3. **Widget clicks** → navigate to dedicated Manager views
4. **Content tasks** → expand inline, work in Drive, update status
5. **Calendar toggle** → see week's deadlines at a glance

### Manager Views (Existing)

| View | Purpose | Workflow |
|------|---------|----------|
| ManagerOrdersView | Packing slips, open orders | Order processing |
| ManagerInventoryView | Product counts, Brurya stock | Inventory management |
| ManagerProductsView | Product detail edits | Product data maintenance |
| **Dashboard** | Content review tasks | `task.content.edit`, `task.content.translate_edit` |

### Future

| View | Purpose | Task Types |
|------|---------|------------|
| ManagerCRMView (future) | Contact management | CRM-related tasks |

### Content Task Workflow (Manager's Role)

```
Admin: Draft → [creates task.content.edit]
                    ↓
Manager: Reviews draft in Drive
         Opens task in dashboard
         Adds notes (feedback)
         Status: Done (approve) or Back to Admin (reject via notes)
                    ↓
Admin: Sees task closed, moves to Translate
       [creates task.content.translate_edit]
                    ↓
Manager: Reviews translation...
```

---

## 6. Implementation Phases

### Phase 1: Role Detection + CSS

1. Add role detection to WebApp.js (check user email against config)
2. Add body class based on role
3. Add CSS visibility rules
4. Test admin vs manager views

### Phase 2: Manager Task Widget

1. Create task widget component (full-width card)
2. Implement filters (status, topic, search)
3. Implement row expansion with notes editing
4. Implement status change (limited options)
5. Test manager editing flow

### Phase 3: Click-Through Navigation

1. Add navigation handler based on task type
2. Implement sessionStorage hand-off to target pages
3. Test navigation from dashboard → Projects, Products

### Phase 4: Calendar View

1. Create calendar grid component
2. Position tasks by due date
3. Click cell → filter list
4. Toggle between list/calendar views

### Phase 5: Future Task Types

1. Add CRM task types to config
2. Add Operations/Sourcing task types
3. Create manual task creation for these types
4. Route to appropriate views or inline expansion

---

## Open Questions

1. **Widget visibility for manager:**
   - Show all widgets dimmed for context?
   - Or hide admin-only widgets entirely?

2. **Calendar view: week or month default?**
   - Week is more focused for content tasks
   - Month shows broader planning horizon

3. **Content reject workflow:**
   - Manager adds notes explaining rejection
   - Does task auto-reopen for admin, or manual pickup?

4. **CRM view timeline:**
   - Future work - not in current scope
   - Task types exist but admin handles for now

5. **Product detail view:**
   - Neither user can currently examine a product's task history
   - Defer until product data validation is implemented?

---

## Files to Modify

| File | Changes |
|------|---------|
| `WebApp.js` | Role detection, pass to template |
| `AdminDashboardView_v2.html` | Add role class, CSS rules |
| `WebAppDashboardV2.js` | Add manager task data functions (content.edit, translate_edit only) |

**Not needed (simpler scope):**
- No new task types (content tasks already exist)
- No new views (manager views exist, CRM is future)

---

## Implementation Approach

**v2 Dashboard Strategy:**
- Build as ManagerDashboardView_v2.html (separate from current)
- Add sidebar link "Dashboard v2" for testing
- Once tested, both Admin and Manager v2 replace main dashboard

---

## Implementation Phases

### Phase 1: Base Dashboard + Role Detection
1. Create ManagerDashboardView_v2.html (copy from AdminDashboardView_v2.html)
2. Add role detection to WebApp.js
3. Add body class based on role (`role-admin`, `role-manager`)
4. Add sidebar link for testing
5. Add CSS visibility rules for widgets

### Phase 2: Manager Task Widget
1. Full-width task card with all manager-assigned tasks
2. Filters: topic, type, status
3. Sortable columns
4. Inline row expansion with notes editing
5. Status change (limited to New/In Progress/Done)
6. Click behavior by task type (expand vs navigate)

### Phase 3: Calendar View
1. Toggle button: List | Calendar
2. Week grid with task dots by due date
3. Color-coded by topic
4. Click date → filter list to that date
5. Filters apply to both views

### Phase 4: Polish + Cutover
1. Test both admin and manager v2 dashboards
2. Verify role-based visibility
3. Replace main dashboard with v2 versions
4. Remove testing sidebar links

### Future: CRM View
1. Create ManagerCRMView when CRM tasks assigned to manager
2. Route CRM tasks appropriately

---

## Status

**Plan approved.** Ready for Phase 1 implementation.
