@echo off
setlocal

:: Configuration
set CONDA_ENV=toby
set BACKEND_PORT=8000
set FRONTEND_PORT=5173

echo 🚀 Starting n8n Factory Synergy Mode (Windows)...

:: --- IP Synchronization Step ---
echo 🔄 Synchronizing IP addresses...
where conda >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo 📦 Checking backend dependencies...
    conda run -n %CONDA_ENV% python backend/sync_n8n_ip.py
    conda run -n %CONDA_ENV% pip install -r backend/requirements.txt
) else (
    echo 📦 Checking backend dependencies...
    python backend/sync_n8n_ip.py
    pip install -r backend/requirements.txt
)

:: Start Backend in a separate window
echo 📦 Starting Backend (FastAPI) on port %BACKEND_PORT%...
where conda >nul 2>&1
if %ERRORLEVEL% equ 0 (
    start "n8n Factory Backend" cmd /k "conda run -n %CONDA_ENV% python backend/main.py"
) else (
    start "n8n Factory Backend" cmd /k "python backend/main.py"
)

:: Wait for backend to initialize
timeout /t 2 /nobreak >nul

:: Start Frontend
echo 🎨 Starting Frontend (Vite) on port %FRONTEND_PORT%...
cd frontend

:: Check for node_modules
if not exist "node_modules\" (
    echo 📦 node_modules not found. Installing dependencies...
    call npm install
)

start "n8n Factory Frontend" cmd /k "npm run dev"

echo.
echo ✨ n8n Factory is now starting!
echo 📍 Dashboard:    http://localhost:%FRONTEND_PORT%
echo 📍 Backend API:  http://localhost:%BACKEND_PORT%
echo.
echo 💡 Windows 說明: 後端與前端已在獨立視窗啟動，關閉視窗即可停止服務。

pause
