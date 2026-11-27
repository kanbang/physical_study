@echo off
setlocal
title Jingwutai - Physics Lab Server
cd /d "%~dp0"

set "PY=%CD%\.venv\Scripts\python.exe"
set "URL=http://127.0.0.1:3000"

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python not found in PATH.
  pause
  exit /b 1
)

if not exist "%PY%" (
  echo [SETUP] Creating virtual environment .venv ...
  python -m venv .venv
  if errorlevel 1 goto :fail
)

if not exist "%PY%" (
  echo [ERROR] Virtual environment python not found.
  goto :fail
)

"%PY%" -c "import fastapi, uvicorn, httpx" >nul 2>nul
if errorlevel 1 (
  echo [SETUP] Installing backend dependencies ...
  "%PY%" -m pip install -i https://mirrors.tencent.com/pypi/simple/ --timeout 60 "fastapi>=0.115,<0.116" "uvicorn>=0.30,<0.31" "httpx>=0.27,<0.29"
  if errorlevel 1 goto :fail
)

if not exist "%CD%\frontend\dist\index.html" (
  echo [SETUP] Building frontend ...
  pushd "%CD%\frontend"
  call npm install
  if errorlevel 1 goto :fail
  call npm run build
  popd
)

netstat -ano | findstr ":3000 " >nul
if not errorlevel 1 (
  echo [INFO] Service already running. Opening %URL%
  start "" "%URL%"
  pause
  exit /b 0
)

echo [INFO] Starting server: %URL%
echo [INFO] Press Ctrl+C to stop.
if "%JW_NO_BROWSER%"=="" start "" cmd /c "timeout /t 3 /nobreak >nul & start %URL%"
"%PY%" app.py
echo.
echo [INFO] Server stopped.
pause
exit /b 0

:fail
echo [ERROR] Startup failed.
pause
exit /b 1
