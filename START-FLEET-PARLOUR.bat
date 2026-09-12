@echo off
setlocal
cd /d "%~dp0backend"

echo.
echo ============================================
echo   Fleet Parlour Local Website + Backend
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed or is not available in PATH.
  echo Install Node.js 20 or newer, then run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run detected. Installing backend dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Starting Fleet Parlour on http://localhost:3000/
echo Keep this window open while testing the website.
echo.
start "" "http://localhost:3000/"
call npm start

endlocal
