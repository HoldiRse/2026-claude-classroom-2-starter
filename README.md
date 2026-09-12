# ai-tutor

A chat app where you talk to Bartholomew, a butler agent whose only duty is
your to-do list: add items, tick them off, reopen them, or ask what's
outstanding. The sidebar shows the list read-only; every tool call the agent
makes appears inline in the chat as an expandable card (what ran, its input,
its output).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript 7 + Tailwind v4
- Mastra agent (`@mastra/core`), served over AG-UI (`@ag-ui/mastra`) to a
  CopilotKit v2 chat (`@copilotkit/react-core/v2`, `@copilotkit/runtime/v2`)
- OpenRouter as the model provider, Mastra memory backed by `@mastra/libsql`
- Better Auth (email/password) for sign-in
- Drizzle ORM over SQLite (`@libsql/client`)
- Vitest + Testing Library for unit tests, Playwright for e2e

## Setup

Prerequisites: Node.js 20.9 or later (Next.js 16's minimum) and npm.

```sh
npm install
cp .env.example .env
```

`.npmrc` sets `legacy-peer-deps=true`, so a plain `npm install` resolves
cleanly despite Better Auth's peer range on Vitest.

Fill in `.env`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | SQLite file used by Drizzle, Better Auth, and Mastra memory (e.g. `file:./data/app.db`). |
| `OPENROUTER_API_KEY` | yes | API key for OpenRouter, the LLM behind the Mastra agent. |
| `BETTER_AUTH_SECRET` | yes | Better Auth's signing secret (`openssl rand -base64 32`). |
| `BETTER_AUTH_URL` | yes | Base URL Better Auth serves from (e.g. `http://localhost:3000`). |
| `OPENROUTER_BASE_URL` | no | Routes OpenRouter traffic through a local reverse proxy (e.g. mitmproxy) instead of talking to OpenRouter directly; must include `/api/v1`. |

Then:

```sh
npm run db:migrate
npx playwright install chromium   # only for the Playwright suites
npm run dev
```

## Demo data

After `npm run db:migrate`, run `npm run db:seed` to create a demo student
with twelve to-dos, then sign in as `demo@example.com` / `demo-password-123`.
Re-running it resets that account's list; it refuses to run with
`NODE_ENV=production`.

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` | Production build (also typechecks via `tsc`). |
| `npm run start` | Run the production build. |
| `npm run lint` | `biome check`. |
| `npm run format` | `biome format --write` (does not sort imports; use `npx biome check --write <path>` for that). |
| `npm test` | Vitest, single run. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:e2e` | Playwright, against its own dev server on port 3100. |
| `npm run test:e2e:llm` | Playwright against `tests/e2e-llm/`; makes real OpenRouter calls. |
| `npm run db:generate` | Write a Drizzle migration from `lib/schema.ts`. |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL`. |
| `npm run db:seed` | Create a demo account with sample to-dos; run after `db:migrate`. |
| `npm run auth:generate` | Regenerate `lib/auth-schema.ts` from the Better Auth config; follow with `db:generate` + `db:migrate`. |

## Architecture

Request flow: browser → CopilotKit chat (`components/chat.tsx`) →
`app/api/copilotkit/[...all]/route.ts`, which gates on the Better Auth
session, then builds a per-request Mastra/AG-UI agent scoped to that user
(`resourceId`, and a `RequestContext` carrying the user id) → the Mastra
agent in `lib/tutor.ts` → its tools in `lib/todos.ts`, each scoped to the
user id from the `RequestContext` → the `todos` table in SQLite via
`lib/db.ts`.

Key files:

- `app/page.tsx` — the chat page: gates on session, renders the header, chat, and sidebar
- `components/chat.tsx` — the client-side CopilotKit chat, with tool-call rendering
- `components/tool-call-card.tsx` — presentational card for one tool call
- `components/todos-sidebar.tsx`, `components/todos-refresh.tsx` — read-only list view and its auto-refresh on agent writes
- `lib/tutor.ts` — the Mastra agent (Bartholomew), instructions, memory, model
- `lib/todos.ts` — the `listTodos`/`addTodo`/`setTodoDone` tools and their per-user queries
- `lib/schema.ts` — the `todos` table (and re-exports the Better Auth tables)
- `lib/auth.ts`, `lib/auth-config.ts` — Better Auth setup
- `lib/db.ts` — the one Drizzle/libSQL connection

See `AGENTS.md` for the detailed conventions behind each of these.
