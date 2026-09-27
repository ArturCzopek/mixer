<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working roles

- Artur owns product decisions. Claude proposes on product choices and owns architecture, security, and domain calls on Artur's behalf. Codex implements bounded tasks.
- Claude may delegate bounded CRUD, tests, bug fixes, and refactors when behavior and acceptance criteria are clear and no owner decision is implicit. Keep file ownership explicit when work is parallelized.
- Escalate schema/integrity, authorization, privacy, and external-data policy to Claude. Do not change the balancing algorithm without the owner's explicit decision.
- For code changes, add or update focused tests and run the affected tests, lint, typecheck, format check, and production build before delivery. Report any validation not run. Read the installed Next.js guide before using an unfamiliar Next.js API.
- Keep code and repository documentation in English.

## Codex model selection

- Default Codex delegation to gpt-6-luna with reasoning effort xhigh; set both explicitly for every task.
- For more advanced, clearly scoped work, Claude may recommend gpt-6-sol with medium effort, or high when deeper analysis or review is warranted. State why and the proposed settings to Artur. Unless Artur selects Sol, keep the Luna default.
- If the delegation mechanism cannot set and confirm the chosen model and effort, tell Artur; a prompt alone does not guarantee model selection.
