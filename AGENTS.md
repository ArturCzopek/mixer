<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working roles

- Artur owns product decisions. Codex leads the project. Codex and Claude are equal partners; whoever works with Artur in a session plans, implements, verifies, and pushes the work. The other may provide review on request.
- Before a roadmap task, explain to Artur in Polish what it changes and why. Whenever citing a task or decision ID, add a short description.
- Do not change the balancing algorithm without Artur's explicit decision.
- Manually check every Supabase/PostgREST embed before pushing. `mixes` and `mix_participants` have two foreign-key relationships, so embeds must name the intended foreign key explicitly. PGlite does not catch this ambiguity; it once broke Production.
- For code changes, add or update focused tests and run the affected tests, lint, typecheck, format check, and production build before delivery. Report any validation not run. Read the installed Next.js guide before using an unfamiliar Next.js API.
- Keep code and repository documentation in English.

## Codex subagent model selection

- When launching Codex as a subagent, use gpt-6-sol with medium effort (high for deeper analysis) for important work such as schema/integrity, authorization, concurrency, balancing inputs, and larger features. Use gpt-6-luna with xhigh effort (or high to finish faster) for UI, copy, small queries, docs, and simple fixes.
- Set and confirm the model and effort explicitly for each Codex subagent task, and tell Artur which were used. If the delegation mechanism cannot confirm them, tell Artur; a prompt alone does not guarantee model selection.
