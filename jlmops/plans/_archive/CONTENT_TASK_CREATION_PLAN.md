# Content Task Creation Plan

Plan to make the "Create Content Tasks" dialog (`ContentStreamModal.html`, stages from `CONTENT_STAGES` in `WebAppProjects.js`) match the real publishing workflow. Status: **built and deployed as jlmops @581 (2026-10-18), awaiting user testing**; doc updates pending.

## Problem

The dialog shows all 19 stages as one flat, unchecked checkbox list regardless of the calendar row's type. The blog chain has stages that aren't real handoffs (Create WP Stubs, Admin Review, Images) and is missing the actual middle step: extracts drafted after the body is locked, then reviewed by the manager before translation. The dialog's help text still claims an EN+HE entity pair is created at spawn (false since 2026-07-08), and it shows an optional Stream ID field nobody needs.

## Decisions (confirmed)

- **Drop Admin Review.** Creating the draft includes the admin's review before it passes to the manager. Draft closes when the admin approves it for the manager.
- **Drop Create WP Stubs as a task.** Stubs are still required (push needs the WP IDs), so they become the first step of the publishing checklist (`content/_resources/PUBLISHING.md`), done inside the Publish task.
- **Drop Images as a task.** Image upload is already part of publishing (per-post `upload-<topic>-images.js`); it moves into the Publish task's checklist too.
- **Keep the optional extras** (video, email, social, WhatsApp) available, but unchecked and visually separated from the core chain.
- **Hide the Stream ID field.** It's auto-generated when blank and only feeds the "session" column in AdminProjectsView; the calendar slug already groups a post's tasks.

## Target blog chain

1. Draft (EN, Admin/Claude) - includes admin review
2. Edit (EN, Manager) - body + title locked
3. **Extracts** (EN, Admin/Claude) - new stage: Excerpt, Email fields, Newsletter Excerpt, Print Newsletter Body, CTA, Image Prompts, derived from the locked body
4. **Review Extracts** (EN, Manager) - new stage
5. Translate (HE, Admin)
6. Edit Translation (HE, Manager)
7. Publish (EN, Admin) - checklist: create WP stubs, upload images, convert body to HTML, push

This mirrors `content/CLAUDE.md`'s work order (body lock gate, then derivatives, then manager translation).

## Dialog changes

- **Filter stages by type.** The spawned entity type comes from the dialog's own Type dropdown (`cs-entity-type`), not from `cal_Type`, and the two vocabularies don't match 1:1 (calendar rows use `newsletter`; the dropdown has `news` and `print`). So: default the Type dropdown from the picked row's `cal_Type` (blog to blog, email to email, newsletter to news, print to print), then filter and pre-check stages by the selected Type.
- **Pre-check the core chain** for the type; optional extras listed below it, unchecked.
- **Show EN/HE pairs side by side** (Draft EN/HE Email) so they read as one step with two languages.
- **Show the assignee on each stage** as "(A)" or "(M)", e.g. "Edit (M)". Derived server-side, not hardcoded: `WebAppProjects_getContentStages` adds each stage's assignee from its task type's `flow_pattern` in config (`admin_direct` = A, `manager_direct` = M, per `WORKFLOWS.md` §12.1.1), so the label stays correct if a flow pattern changes.

- Fix the help text and the success toast ("Created N entity(ies)...") to say tasks only are created; library entries appear when a Doc is first attached.
- Remove the Stream ID input (backend keeps auto-generating).
- **Pending (user, 2026-10-18):** a toggle that clears all stage checks, so a single stage can be ticked to add one task to an existing stream. Plus a "Start and assign now" choice at creation, see `TASK_STATES_AND_FILTERS_PLAN.md`.

## Pending: Translate assignee

User wants Translate assigned to the Manager; `task.content.translate` is still `admin_direct`. Change it to `manager_direct` via the config path and reassign the open Coastal Plain Translate task by hand. Not done.

## AdminTasksView default layout

Moved to `TASK_STATES_AND_FILTERS_PLAN.md` (change 10); not in @581.

## Implementation notes

- Remove `create_wp_stubs`, `admin_review`, `images` from `CONTENT_STAGES` only. Keep their `taskDefinitions.json` entries so any existing open tasks of those types still render and can be closed.
- **Repurpose existing definitions instead of adding new ones** (user preference: edit existing task types over creating new ones for the same action). Type IDs stay as-is (stored in `st_TaskTypeId`, can't be renamed safely); users only see stage labels.
  - **Extracts** (Admin) reuses `task.content.admin_review` (already `admin_direct`, freed by dropping Admin Review): new description, `pack_form` `skeleton` to `inline`, and add it to the `content_edit` pack list in `TaskPacks.html` (Open Doc then Editing Done). Stage label "Extracts", title prefix `Extracts: `.
  - **Review Extracts** (Manager) reuses `task.content.print_newsletter_body` (already `manager_direct` + `content_edit` pack, not spawned by any code, and the print body is one of the extracts): new description. New `CONTENT_STAGES` entry, label "Review Extracts", title prefix `Review Extracts: `.
  - Update `task.content.print.create-en`'s description to cover EN+HE assembly.
- Edit `config/taskDefinitions.json` for the description/pack changes above. Config method, in order: edit the JSON source (never `SetupConfig.js` directly), `node jlmops/generate-config.js`, deploy via `deploy.ps1` (it runs `clasp push`), then the user runs `rebuildSysConfigFromSource()` in `SetupConfig.gs`. Stage drops/renames are code-only (`CONTENT_STAGES` in `WebAppProjects.js`), no SysConfig change.
- Before shipping, check for open tasks of the dropped types (`create_wp_stubs`, `images`, `print.create-he`) and of the two repurposed types (`admin_review`, `print_newsletter_body`). Open repurposed-type tasks would suddenly render as Extracts/Review Extracts; close them first. Their stored titles ("Admin Review: ...") don't change.
- `WebAppProjects_getContentStages` is also used by AdminProjectsView's older content-stream form (`AdminProjectsView.html:667`), so stage drops/renames show there too. Intended; that form keeps its own Stream ID field unless removed separately.
- All stages of a chain are created at once, with no gating between them (existing behavior, accepted: admin controls dates).
- Assignee labels: every content type in `taskDefinitions.json` is `admin_direct` or `manager_direct` (verified), so A/M covers them all; any other pattern shows no label.
- After shipping, update `jlmops/docs/WORKFLOWS.md` §13.2/13.3, `content/PRODUCTION_GUIDE.md`, and `PUBLISHING.md` (stubs + images as Publish checklist steps), then archive this plan.

## Email and newsletter stages: EN/HE stay separate

Each content task is bound to one library entity and one Doc (`content_edit` pack, `TaskPacks.html`), so a per-language task is what creates and tracks that language's entity. Combining or dropping the EN/HE pairs would lose the HE entity/Doc creation and HE status. Decision (2026-10-18): **keep them as separate tasks**, shown side by side as a pair in the dialog.

- Email: keep "Draft EN Email", "Draft HE Email" (`email_create_en/he`) and "Send Email" (`email_send`) unchanged.
- Newsletter: **exception, combine into one "Assemble Newsletter" stage.** Assembly gathers four existing texts that the task can't reach anyway, and the manager prints EN and HE together, so library support per language isn't needed. Accepted loss: no HE print entity/status in the library. Implement by relabeling the `print_create_en` stage to "Assemble Newsletter" (title prefix `Assemble Newsletter: `) and dropping `print_create_he` from `CONTENT_STAGES`, reusing the existing `task.content.print.create-en` type (no new definition). Keep "Print & Distribute".
## Resolved before build (user, 2026-10-18)

- Newsletter calendar rows default the Type dropdown to `news`; the newsletter stage set (Assemble Newsletter, Print & Distribute) belongs to `news`. `print` is for fliers and other print materials; it gets no pre-checked stages (all stages shown, none checked). Types without a defined set behave the same way.
- All-at-once creation is fine: the admin controls task dates, and the manager works only assigned tasks.
- No open tasks of the dropped or repurposed types exist; only one blog post is active.

## Email rename

- Rename the `email` stage (blog companion, "Include content in email newsletter", publish-style pack with no Doc) from "Email" to "Create Email". Label confirmed by the user.
