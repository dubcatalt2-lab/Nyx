@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo This local launcher needs Node.js installed. Install Node.js, then run this file again.
  pause
  exit /b 1
)
node "%~dp0serve-mini.mjs"
pause
