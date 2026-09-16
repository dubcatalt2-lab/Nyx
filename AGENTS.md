# Nyx Agent Guidance

## Completion sound

- Play the sound only immediately before either (1) a final response that completes an explicit user request or (2) a message or UI prompt that requests user input needed to continue.
- User-input requests include clarification questions, required choices, approval prompts, missing-information requests, and blocking questions. Play the sound immediately before asking, even though the overall task is not yet complete.
- Do not play it for commentary, progress updates, unsolicited messages, proactive suggestions, waiting or monitoring notices that do not request input, or any other non-final response.
- A direct answer to an explicit user question counts as completing that request, including short answers and tasks that do not modify files.
- For either eligible event, run the following louder two-hit sound from the repository root in the foreground:

  `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\play-completion-sound.ps1"`

- Wait for the command to finish successfully before sending the eligible final response or requesting user input.
- After the sound command succeeds, immediately send the eligible final response or issue the user-input request. Do not run additional work tools or commands; the product's user-input request mechanism is the only permitted tool after the sound.
- Do not run the sound command as a background process.
- If the two-note sound fails, run this fallback sound in the foreground:

  `powershell.exe -NoProfile -Command "[Console]::Beep(440,300); Start-Sleep -Milliseconds 80; [Console]::Beep(360,420)"`

- If both commands fail or are unavailable, state that plainly in the eligible final response or user-input request.

## Platform

- These commands are intended for Windows 10 or Windows 11.
- When using WSL, invoke `powershell.exe` as shown so the sound plays through Windows.
- A remote SSH or container host may not have access to the local computer's speakers.

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
