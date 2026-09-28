Nook - Windows companion

1. Install Node.js 22 or 24 LTS from https://nodejs.org/ if needed.
2. Extract this entire ZIP. Double-click Start-Nyx-Agents.cmd.
3. Choose a project folder. The launcher opens nook.nyxlearning.org.
4. Sign in with your Nyx account and click Connect. Accept the browser's
   local-network permission, then confirm the connection on your desktop.
5. Select a model and describe your task.

Keep the companion window open while working. Closing it disconnects the
agent. File edits and commands require a separate Windows approval dialog.
Commands execute with your Windows permissions, NOT in an isolated sandbox.
They can access outside the selected workspace. Inspect each command.
File tools refuse symbolic links, drive/home roots, .env files, private-key
files and common credential folders. These checks do not sandbox commands.
Read file contents and command output are sent through Nyx to the AI provider.
There is no background startup, password storage or permanent pairing.
Chat is kept only in the open page. Closing or reloading the page clears it.

Undo applies to companion file writes/deletions in the current session and
refuses to overwrite newer edits. It cannot undo arbitrary terminal commands.
Backups are stored in the private temporary folder printed by the launcher;
retain them until you no longer need recovery. Native approval previews may
be shortened; the website displays the full proposed file contents.

Local development:
Set NYX_AGENTS_ORIGIN=http://localhost:6767 before starting the launcher.
The same website must be open at that origin. Default companion port:6768.
This package is a source-based preview, not a signed Windows installer.
