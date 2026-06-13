@echo off
REM Double-click this to run the site locally.
REM Starts the Vite dev server and opens it in your browser.

REM Work from this script's folder, wherever the repo lives.
cd /d "%~dp0"

REM Install dependencies the first time (no node_modules yet).
if not exist "node_modules" (
  echo Installing dependencies, this only happens the first time...
  call npm install || goto :error
)

REM Open the dev server in the default browser shortly after it boots.
start "" /min cmd /c "timeout /t 3 >nul & start http://localhost:5173"

echo.
echo Starting the dev server. Close this window or press Ctrl+C to stop it.
echo.
call npm run dev
goto :eof

:error
echo.
echo Something went wrong. Make sure Node.js is installed (https://nodejs.org).
pause
