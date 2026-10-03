Nook - Windows companion

1. Install Node.js 22 or 24 LTS from https://nodejs.org/ if needed.
2. Extract this entire ZIP. Double-click Start-Nyx-Agents.cmd.
3. Choose a project folder. The launcher opens nook.nyxlearning.org.
4. Sign in with your Nyx account and click Connect. Accept the browser's
   local-network permission, then confirm the connection on your desktop.
5. Choose Code, then select a text model and describe your task.

To start through Node directly, run node start.mjs from this extracted folder.
The companion uses built-in Node modules; npm install is not required.
For a standalone window, use Chrome or Edge: Install this page as an app.
Install the web page opened by the companion, then connect your folder.

Keep the companion window open while working. Closing it disconnects the
agent. File edits and commands require a separate Windows approval dialog.
Commands execute with your Windows permissions, NOT in an isolated sandbox.
They can access outside the selected workspace. Inspect each command.
File tools refuse symbolic links, drive/home roots, .env files, private-key
files and common credential folders. These checks do not sandbox commands.
Read file contents and command output are sent through Nyx to the AI provider.
There is no background startup, password storage or permanent pairing.
Chat history is saved in this browser under your signed-in account.
Temporary chats are not saved. Pairing lasts only for the current page session.
Screen sharing sends a still frame with each request, not continuous video.
Dictation works in Chat and Code. Native model voice replies require Chat
mode and a supported conversational audio model; Code does not read edits aloud.

Undo applies to companion file writes/deletions in the current session and
refuses to overwrite newer edits. It cannot undo arbitrary terminal commands.
Backups are stored in the private temporary folder printed by the launcher;
retain them until you no longer need recovery. Native approval previews may
be shortened; the website displays the full proposed file contents.

Local development:
Set NYX_AGENTS_ORIGIN=http://localhost:6767 before starting the launcher.
The same website must be open at that origin. Default companion port:6768.
This package is a source-based preview, not a signed Windows installer.
