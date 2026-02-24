Version stamp and deploy JLM Wines middleware.

**Steps:**

1. Get current system time
2. Read `jlmops/Code.js` (or the main entry file) — find the VERSION pattern
3. Update `VERSION.built` with current date and time (format: `YYYY-MM-DD HH:MM`)
4. Update `VERSION.commit` with a short description of what changed
5. Run: `clasp --auth /c/Users/B/projects/jlmwines/jlmops/.clasprc.json push`
6. If auth fails: STOP and tell the user to run `clasp login` from the jlmwines directory, authenticate as `accounts@jlmwines.com`, then copy `~/.clasprc.json` to `jlmwines/jlmops/.clasprc.json`
7. Report the version string

**Do NOT** deploy (create a new deployment version) unless the user explicitly asks. This is push only — updates the @HEAD development deployment.
