---
name: Live demo command behavior
description: Why the Chips.gg landing-page live demo errors on some commands
---

- The landing page live demo calls `GET /api/command/:name`, which runs the real command handler with a stub ctx whose `getString` returns query params and `getArg` returns null.
- Commands that require arguments (e.g. `/promotions` needs a category, `/search` needs a game name) throw when invoked with no args, so the demo surfaces a terminal `ERROR:` line for them. Arg-less commands like `/prices` return full data.

**Why:** Prevents future confusion that a redesign "broke" the demo — the error path is pre-existing handler behavior surfaced by arg-less invocation, not a regression.

**How to apply:** To make an arg-required button return real data, give it a `data-query="key=value"` attribute — the demo JS appends it as a query string to the fetch. The handler must read that arg via `getString` on the `api` platform (commands gate on `platform === "discord"`; add `|| platform === "api"` so the api ctx's `getString` query lookup is used). Example already wired: `/stats` uses `data-query="username=tacyarg"`.
