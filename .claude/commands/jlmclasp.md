Run clasp for JLM Wines using project-local credentials.

JLM Wines uses a different Google account (`accounts@jlmwines.com`) than the default.
Credentials are stored at `jlmwines/jlmops/.clasprc.json`.

**Run the user's clasp command with the auth flag:**

```
cd /c/Users/B/projects/jlmwines/jlmops && clasp --auth /c/Users/B/projects/jlmwines/jlmops/.clasprc.json $ARGUMENTS
```

Pass through whatever arguments the user provides (push, pull, status, deploy, etc.).

If the credentials file is missing, tell the user to run:
```
clasp login
```
from the jlmwines directory, authenticate as `accounts@jlmwines.com` in Firefox, then copy `~/.clasprc.json` to `jlmwines/jlmops/.clasprc.json`.
