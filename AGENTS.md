# Nyx Agent Guidance

Before changing this repository:

1. Read `docs/NYX_PROJECT_STATE.md` completely.
2. Run `git status -sb` and `git log -5 --oneline --decorate`.
3. Treat the working tree, Git history, and deployment configuration as the source of truth. The handoff is context, not a substitute for inspecting code.

Working rules:

- Preserve unrelated user changes and untracked directories. Never delete or reset them to clean the tree.
- Do not edit generated `dist/` files directly. Change source files and run `npm run build:netlify`.
- Preserve existing data flow, API behavior, animated media, effects, authentication, roles, subscriptions, proxy settings, and event handlers unless the user explicitly asks to change them.
- Diagnose regressions before editing. Avoid stacking speculative overrides or site-specific workarounds.
- Keep server-only credentials out of source, documentation, console output, and commits.
- Run `npm run check:deploy` after material changes and use targeted browser/runtime checks for the affected feature.
- Do not push, merge, deploy, change DNS, or mutate external services unless the user explicitly asks.
- Update `docs/NYX_PROJECT_STATE.md` when a change materially alters the release state, architecture, deployment setup, durable constraints, or known issues.
