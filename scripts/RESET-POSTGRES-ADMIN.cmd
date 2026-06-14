@echo off
echo Requesting administrator access to reset PostgreSQL dev credentials...
echo.
echo WHEN PROMPTED:
echo   1. Click YES on the Windows UAC dialog
echo   2. If psql asks "Password for user postgres:" press Enter (leave blank)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0reset-postgres-dev.ps1""' -Wait"
echo.
if exist "%~dp0reset-postgres-dev.log" (
  echo === Reset log ===
  type "%~dp0reset-postgres-dev.log"
) else (
  echo Reset did not complete. Approve the UAC prompt and try again.
)
echo.
pause
