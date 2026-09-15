---
name: GitHub push authentication
description: Recovery when Replit Git authentication remains invalid after connecting GitHub
---

If `replit-git-askpass` keeps returning a credential GitHub rejects, a healthy GitHub App attachment may not repair the current shell hook. A separately reauthorized GitHub OAuth connection can still provide repository write access through the connector proxy.

**Why:** In this workspace, both normal Git pushes and the initial OAuth API request returned `Bad credentials`. Reauthorizing OAuth fixed API access, but the GitHub App askpass token remained invalid. Cloudflare also rejected source text sent inline to Git tree/blob endpoints.

**How to apply:** Prefer a normal fast-forward Git push. If askpass still fails, use the Git Data API through the OAuth connector: upload file bytes as base64 blobs, build a SHA-only tree on the current remote tree, verify the resulting tree SHA exactly matches the local tree SHA, then create a commit and update the branch without force.