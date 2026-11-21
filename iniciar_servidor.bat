@echo off
title Servidor Visor EZVIZ (Local)
cd /d "%~dp0"

echo ===================================================
echo     Iniciando Servidor Local Visor EZVIZ
echo ===================================================
echo.

:: Verificar si el entorno virtual existe
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] No se encontro el entorno virtual .venv.
    echo Asegurate de crearlo primero o ejecutar scripts\test_login.py.
    pause
    exit /b 1
)

:: Detener instancias anteriores de ffmpeg o uvicorn que hayan quedado colgadas
taskkill /F /IM ffmpeg.exe >nul 2>&1

echo [*] Servidor ejecutandose en el puerto 8080...
echo [*] Web Dashboard Local: http://localhost:8080
echo [*] Para acceso desde celular / tablet en la misma red Wi-Fi, usa la IP de esta PC.
echo [*] Para detenerlo, presiona CTRL + C o cierra esta ventana.
echo.

:: Iniciar FastAPI con Uvicorn
.\.venv\Scripts\python.exe -m uvicorn server.app:app --host 0.0.0.0 --port 8080

pause
