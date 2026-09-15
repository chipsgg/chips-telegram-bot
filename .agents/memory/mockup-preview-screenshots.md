---
name: Screenshotting mockup-sandbox previews
description: Why the screenshot tool returns "Cannot GET /__mockup/..." for mockup previews and how to capture them correctly
---

# Screenshotting mockup-sandbox previews

When verifying mockup-sandbox component previews with the `screenshot` (app_preview) tool,
you MUST pass the mockup server's own port explicitly. Find it in the preview-server
workflow logs (the `vite ... ready` line, e.g. `http://localhost:23636/__mockup/`).

**Why:** The app_preview screenshot tool defaults to port 5000. In these bot/web projects
port 5000 is the main Express app, which has no `/__mockup/` route and replies
`Cannot GET /__mockup/preview/...` (an Express 404). That looks like the mockup is broken
when it is actually fine — the request just hit the wrong server. The mockup preview runs on
a *separate* vite port and is proxied at the domain level under `/__mockup/`.

**How to apply:**
- `screenshot(type=app_preview, path=/__mockup/preview/landing-pages/<Component>, port=<vite-port>)`.
- A quick sanity check that the preview is genuinely up: `curl -s -o /dev/null -w "%{http_code}" http://localhost:<vite-port>/__mockup/preview/landing-pages/<Component>` returns 200 (note: vite SPA returns 200 for any path, so 200 only proves the server is up, not that the component rendered — use the screenshot to confirm rendering).
- The canvas iframes themselves use the full domain `/__mockup/` URL and route correctly via the domain proxy, so a port-5000 false-negative on screenshots does NOT mean the iframes are broken.
