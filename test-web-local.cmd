@echo off
REM Double-click to test the static visio-as-script-web folder in your browser.
REM Serves it the same way IIS will (correct .mjs MIME type), then opens the browser.
REM Requires Node.js. Close this window to stop the server.
cd /d "%~dp0"
node "serve-web-local.mjs"
echo.
echo Server stopped.
pause
