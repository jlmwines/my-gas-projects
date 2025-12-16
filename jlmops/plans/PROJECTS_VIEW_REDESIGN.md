# AdminProjectsView Redesign

## Layout

Two columns: Left (40%) for navigation, Right (60%) for details.

## Left Panel - Drill-Down Navigation

Two modes with adaptive header and subheader:

### Header Row
- [⌂] Home icon - always returns to projects list
- [←] Back arrow - only shows when drilled down
- Breadcrumb: "Projects" or "Projects > [Project Name]"
- [+ New] - context-aware: project at top level, task when in project

### Subheader Row
Adapts to current mode with sortable column headers and inline filters:

**Projects mode:**
| Name ▾ | Type | Status [All▾] | Tasks |

**Tasks mode:**
| Title ▾ | Status [All▾] | Due ▾ | Pri |

- Click column header to sort
- Dropdowns for filterable columns

### List Area
- Projects list or Tasks list based on mode
- Click row → selects item, shows details on right
- Click project row → drills down to tasks mode

## Right Panel - Detail View

Single context-sensitive panel (no tabs):
- Project selected → Project details/edit form
- Task selected → Task details/edit form
- Nothing selected → Stats summary

## State

```javascript
var state = {
  projects: [],
  tasks: [],
  mode: 'projects',        // 'projects' or 'tasks'
  selectedProjectId: null,
  selectedTaskId: null,
  statusFilter: 'all',
  sortField: 'name',
  sortDir: 'asc'
};
```

## Status Filter

Pull from `WebAppTasks_getStatusOptions()` - not hardcoded.

## Confirmation Modal

Required for: Mark Done, Cancel Task

## Button Standard

`btn btn-sm btn-light` for all buttons.
