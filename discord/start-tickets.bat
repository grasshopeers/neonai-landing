@echo off
title NeonAi Tickets
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-tickets.ps1"
echo.
echo ----------------------------------------
echo The bot stopped. Read the messages above.
echo ----------------------------------------
pause
