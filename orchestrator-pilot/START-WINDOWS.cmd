@echo off
setlocal
cd /d "%~dp0"
set PYTHONUTF8=1
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
if not errorlevel 1 goto use_py
python -c "import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
if not errorlevel 1 goto use_python
echo Python 3.10 or newer is required.
echo Download: https://www.python.org/downloads/windows/
echo Install Python, then run this file again.
pause
exit /b 1
:use_py
py -3 app.py --open
goto finished
:use_python
python app.py --open
:finished
if errorlevel 1 echo The program stopped with an error. Send a screenshot of this window.
pause
