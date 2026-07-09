# Content Creation Checklist

This is the mechanical procedure a session follows when creating and placing any piece of content (blog, email, newsletter, print, template, image). It exists because sessions have repeatedly drifted into inventing titles, associations, or folder names instead of using what's already supplied. Follow this in order; don't improvise around it. Drive-placement mechanics live in `.claude/CLAUDE.md` ("Drive Asset Placement") — this doc sequences the steps and adds the rules that section doesn't cover.

## The four required inputs

Every piece of content traces back to one calendar row (`JLMops_Publishing`): `cal_Date`, `cal_Name`, `cal_Type`, `cal_Slug`. Nothing else is structurally required — folder path, EN/HE sibling slugs, and filenames all derive mechanically from these four. If a calendar row doesn't exist yet for the content you're about to draft, that's the first gap to close (add the row), not a title or slug to invent.

## Title rule — non-negotiable

**The Library title is always `cal_Name` (or an explicit title the user gives you), never derived or invented.** Do not:
- Build a title from the slug's own words.
- Attach a region, campaign, or theme to a title unless the user said so for that specific piece.
- Reuse a "grouping" label (a slot, a rotation, a batch comment) as if it describes the content itself — a shared production batch is not shared subject matter.

Enforced in code as of jlmops @458: `_ensureEntity` (`LibraryService.js`) now looks up the originating task's `st_LinkedEntityName` (the `cal_Name` `spawnContentChain` passed in as `contentName`, via `TaskService.js:199`) and uses it as the title, falling back to slug-derivation only if no matching task is found (e.g. an entity created outside the calendar/task flow entirely).

## Drafting language

Default to English only. Hebrew only when explicitly asked for, and even then it's a draft for review, never framed as ready to apply directly (see `feedback_hebrew_review_before_update` — AYIW/newsletter content is a documented exception where the manager does his own translation, see `feedback_ayiw_english_only_manager_translates`).

## AYIW source

The monthly AYIW email is not freshly drafted — it's extracted verbatim from the pre-written full-year master Doc "A Year in Wine: From Vine to Glass" (Drive id `1SPPfmN_9Ldz6ACvYw-pYVKRiRjZCB14a`), which has one `## <Month>` section per month plus the exact Subject/Preview/CTA to use (see the doc's own "Email:" section at the bottom). Pull the current month's section as-is — don't invent new prose.

## Sequence for a new piece of content

1. Confirm the calendar row exists (`cal_Date`/`cal_Name`/`cal_Type`/`cal_Slug`). If not, that's step zero — get it added and merged first.
2. Draft the content in English, matching the calendar row's actual topic — not a publication-date inference, not a region/campaign guess. If the user tells you what the content is (e.g. "July vineyard content"), that instruction is the topic; don't second-guess it against send dates or newsletter cadence.
3. Place the file at the canonical Drive path (`.claude/CLAUDE.md`, Drive Asset Placement): `<Library root>/<type>/<concept>/<full-slug> <yy-MM-dd-HH-mm>`, where `<concept>` is the slug with only the language suffix stripped, the type prefix stays (matches `LibraryService.js`'s `_deriveConcept` exactly — verify your folder name against that function, not intuition).
4. Set (or verify) the Library title to `cal_Name`, per the rule above.
5. Leave attachment (`attachExistingDoc`) to the live app — a session has no API path to it. Flag the Doc as ready for the admin to attach.

## Do not

- Don't invent a region, campaign, or theme association a piece of content doesn't have.
- Don't treat "created in the same batch/slot as X" as "is about X."
- Don't trust legacy `slb_Notes`/dates from before 2026-07-08 (the Calendar/Library/Task redesign) without cross-checking the live calendar — several carry stale or simply wrong metadata (see `CALENDAR_LIBRARY_LOOP_PLAN.md` for the incident history).
