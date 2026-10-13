# AGENTS.md

## Build & tooling
- TanStack packages (`@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/router-core`, `@tanstack/react-query`, `@tanstack/router-plugin`) must stay at the exact versions pinned in `package.json` (no `^` ranges). Caret drift pulls a newer `@tanstack/react-start` that breaks the pinned `@lovable.dev/vite-tanstack-config` wrapper with `Could not resolve entry module "index.html"`. Reference versions: the `package-lock.json` snapshot.

## Architecture
- `src/server.ts` is the custom server entry (wired via `vite.config.ts` + `wrangler.jsonc`) that wraps the TanStart server entry to log SSR 500s to `error_logs` and render the custom error page. Do not remove it or revert `tanstackStart.server.entry` to the default.
