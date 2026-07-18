@echo off
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo Starting backend (FastAPI)...
start "Backend" cmd /c "cd /d "%ROOT%\backend" && .venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000 --host 127.0.0.1"

echo Starting frontend (Vite)...
start "Frontend" cmd /c "cd /d "%ROOT%\frontend" && npm run dev"

echo.
echo ===================================================
echo  Video to Article Web App is starting up!
echo ===================================================
echo  Frontend URL: http://localhost:5173
echo  Backend API:  http://localhost:8000
echo ===================================================
echo.
echo  Press any key to exit this console window.
pause >nul
