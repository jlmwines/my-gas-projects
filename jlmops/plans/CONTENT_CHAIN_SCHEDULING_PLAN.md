# Content Chain Scheduling Plan

Remaining work on content task creation, after the dialog rework (@581) and due-date task states (@582-@584) shipped and were tested. The shipped behavior is documented in `jlmops/docs/WORKFLOWS.md` §12.3 and §13.2. Status: **parked**; backward scheduling waits on rethinking stage durations.

## 1. Backward scheduling from the goal date

Today "Set due date now" in the content dialog means start = today, due = today + the type's `due_pattern`, counted forward, the same for every stage. Proposal: replace it with **"Schedule back from goal date"**. Walk the checked stages from last to first; each stage's due date is the next stage's start, and its start is due minus the stage's duration. Manager stages land only on Monday, Tuesday or Wednesday; admin stages land on any business day (Sun-Thu). Every date stays editable afterwards.

Decided (user, 2026-10-18):
- **Goal date = the calendar row's date** (publish date for a blog post, send date for an email, and so on). The chain's final stage is due on it.
- **Not enough time:** warn and offer to compress.
- **Duration = the type's `due_pattern`**, no new field: `immediate` = same day, `next_business_day` = 1 business day, `one_week` = 7 days, `two_weeks` = 14 days.

Why parked: almost every content type is `one_week`, so a full blog chain plans over about 7 weeks. Durations need rethinking first (changing a type's `due_pattern` in `config/taskDefinitions.json` also changes its forward deadline).

Open when it resumes: realistic per-stage durations, and what "compress" does.

## 2. Clear-all toggle in the content dialog

A toggle that clears all stage checks, so a single stage can be ticked to add one task to an existing stream; toggling back restores the type's default stages (user, 2026-10-18).

## 3. Translate assigned to the Manager

User wants Translate assigned to the Manager; `task.content.translate` is still `admin_direct`. Change it to `manager_direct` via the config path (edit `config/taskDefinitions.json`, `node jlmops/generate-config.js`, deploy, `rebuildSysConfigFromSource()` in `SetupConfig.gs`), then reassign any open Translate tasks by hand.
