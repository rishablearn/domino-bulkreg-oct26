@echo off
rem BulkReg 3.4.1 - optional helper launcher for bulkreg.ps1 (no change to the machine's execution policy)
rem Usage: bulkreg.cmd <Command> [options]     e.g.  bulkreg.cmd Check
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0bulkreg.ps1" %*
exit /b %ERRORLEVEL%
