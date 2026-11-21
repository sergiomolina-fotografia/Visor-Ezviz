@echo off
title Acceso Remoto Seguro (Cloudflare Tunnel) - Visor EZVIZ
cd /d "%~dp0"

echo ================================================================
echo        Acceso Remoto por Internet para Visor EZVIZ
echo ================================================================
echo.
echo [*] Este script crea un enlace seguro HTTPS accesible desde
echo     cualquier celular, tablet o PC fuera de tu casa (red 4G/5G).
echo.
echo [*] Requisito: Debes tener iniciado 'iniciar_servidor.bat'.
echo.

:: Verificar si el binario de cloudflared existe
if not exist "bin\cloudflared.exe" (
    echo [*] Descargando cliente seguro de Cloudflare Tunnel por primera vez...
    if not exist "bin" mkdir bin
    curl.exe -L -o "bin\cloudflared.exe" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
    if errorlevel 1 (
        echo [ERROR] No se pudo descargar cloudflared.exe. Verifica tu conexion a internet.
        pause
        exit /b 1
    )
    echo [*] Descarga completada con exito.
    echo.
)

echo [*] Conectando tu servidor local a la red segura de Cloudflare...
echo [*] En unos segundos veras abajo un recuadro con un enlace como:
echo     https://xxxx-xxxx-xxxx.trycloudflare.com
echo.
echo [*] Abre ese enlace en tu celular para ver tus camaras desde cualquier lugar!
echo [*] Para cerrar el acceso remoto, presiona CTRL + C o cierra esta ventana.
echo ================================================================
echo.

.\bin\cloudflared.exe tunnel --url http://localhost:8080

pause
