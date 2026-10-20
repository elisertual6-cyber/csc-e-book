# Working on this project

Use the existing checkout: cloud tasks are isolated; do not create worktrees unless asked.
Read docs/ROADMAP.md and docs/ARCHITECTURE.md before changing scope.
Run npm run lint, npm run typecheck, npm test, npm run content:check, and npm run build for major changes. Run npm run test:e2e for UI changes and npm run test:db for database changes.
Keep content marked DRAFT until independently reviewed. Never describe demo progress, prices, questions, or timing as official CSC information. Never expose answer keys in attempt responses before server-side submission.
No production checkout or admin endpoints until authentication, authorization, entitlements, and provider signature verification are tested. Never commit .env or secrets.
Phase 1 is an honest foundation/demo, not a production commerce service.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
