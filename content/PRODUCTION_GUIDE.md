# JLM Wines — Content Production Guide

*How a blog post moves from idea to live, who does each step, and where you do it.*
*Source of truth: jlmops `docs/WORKFLOWS.md` §13. This PDF is a snapshot — regenerate it if the workflow changes.*

---

## Where you work

- **Manager:** the **Dashboard** task queue is your workbench. Everything you do happens there.
- **Admin:** the **Tasks** view is your workbench. The **Library** is for browsing content (the catalog), seeing what's due (the **Deficiency** view), and opening a piece's documents and history (the entity drawer).

---

## The blog chain — who does what

When a blog post is started, the system creates an **English + Hebrew pair** and all the steps below at once. Each step is a task that lands with the right person:

1. **Create WP Stubs** — Admin
2. **Draft (English)** — Admin / Claude writes the first draft
3. **Admin Review** — Admin checks the draft
4. **Edit (English)** — **Manager**  ← your job
5. **Translate (Hebrew)** — Admin / Claude creates the Hebrew
6. **Translate Edit (Hebrew)** — **Manager**  ← your job
7. **Images** — Admin
8. **Publish** — Admin puts it live (both languages)

**You (manager) own the two editing passes — the English Edit and the Hebrew Translation Edit.** Everything else is Admin.

---

## How to turn around an **Edit (English)**

1. Open the app → you land on the **Dashboard**.
2. In the task list, find **"Edit: [title]"** → tap the row to open it.
3. You'll see **Open Doc**, a **Notes** box, and **Lock + Version**.
4. Tap **Open Doc** → edit the post in Google Docs.
5. Back in the app, tap **Lock + Version**.
6. It asks: *does the Hebrew version need editing too?*
   - **No, just lock** — finishes your task.
   - **Yes, spawn realign** — finishes your task **and** creates a Hebrew follow-up task.
7. Done. The piece is versioned and your task closes.

---

## How to turn around a **Translation Edit (Hebrew)**

Same as the English Edit, with one extra:

- You also get an **Open EN source** link, so you can read the locked English next to the Hebrew while you work.
- The "does the other version need editing?" question is about the **English** side this time.

---

## Good to know

- There is **no "In Progress" button** on content tasks — a task is simply open until you **Lock + Version** it.
- **Can't do a task?** Tap **Revert** to send it back to Admin.
- **Publishing and going live are always Admin steps.**
- State only changes by finishing the task that owns it — nobody sets status by hand.
