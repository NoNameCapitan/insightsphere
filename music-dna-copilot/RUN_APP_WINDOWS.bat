@echo off
REM Music DNA Copilot - Windows launcher. Double-click this file.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 run_app.py
) else (
  python run_app.py
)
echo.
echo The app has stopped. You can close this window.
pause
