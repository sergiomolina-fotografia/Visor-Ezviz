# 📺 EZVIZ TV — Visor de Cámaras para LG Smart TV (webOS)

**Tus cámaras de seguridad EZVIZ directamente en tu televisor LG, con video en vivo y reproducción de grabaciones de microSD.**

---

## 🚀 Estado Actual del Proyecto (Noviembre 2026)

**Hitos alcanzados y 100% validados en hardware real (LG 50UP7750PSB webOS 6.0):**
- [x] **Video en directo fluido en 1080p** para ambas cámaras mediante decodificación por hardware nativo (`<video>` con HLS).
- [x] **Cámara Galería (`H3c`)**: En vivo y reproducción completa de eventos grabados en la microSD vía RTSP con enrutamiento HLS dedicado (`/playback/live.m3u8`).
- [x] **Cámara Living (`C3TN`)**: En vivo fluido en 1080p por RTSP local y consulta de registros microSD.
- [x] **Resolución dinámica de IPs**: Detección en tiempo real de la IP de cada cámara por su número de serie en la API de EZVIZ, tolerante a cambios de IP por DHCP.
- [x] **Identidad visual completa**: Iconos maestros, splash 16:9, favicons y assets empaquetados en la aplicación nativa IPK.
- [x] **Interfaz de TV para grabaciones microSD**: Selector de fechas (Hoy, Ayer, Hace 2 días), consulta de eventos a la API y listado interactivo navegable 100% con el control remoto del televisor.
- [x] **Manejo de errores amigable en pantalla**: Diagnósticos claros en el panel de eventos en caso de desconexiones o limitaciones de formato por modelo de cámara.

---

## 🏗️ Arquitectura del Sistema (Vía B)

Debido a que Chromium 79 en webOS no soporta el decodificador WASM moderno de `ezuikit-js` (sintaxis `?.` y consumo excesivo de CPU), se implementó una **arquitectura híbrida liviana**:

```
[ Cámaras EZVIZ ] (RTSP / ISAPI / Nube)
       │
       ▼ (LAN / Wi-Fi)
[ Servidor Proxy Local (PC / Raspberry Pi) ]
  ├── FastAPI (REST API para listado de cámaras y clips microSD)
  └── ffmpeg (Transcodificación de baja latencia a HLS H.264/AAC)
       │
       ▼ (HTTP / HLS)
[ Smart TV LG webOS 6.0 (IPK) ]
  └── Reproductor nativo <video> por hardware (sin saturación de CPU)
```

---

## 📂 Estructura del Repositorio

```text
Visor-Ezviz/
├── assets/                     # Paquete completo de identidad visual (iconos, splash, web, logo)
├── dist/                       # Paquetes compilados listos para instalar (.ipk)
├── ezviz-tv-test/              # Código fuente de la app nativa webOS (HTML5/JS ES5)
│   ├── appinfo.json            # Metadatos del paquete webOS
│   ├── index.html              # Interfaz de usuario adaptada a 1920x1080
│   ├── app.js                  # Control de reproducción, API de clips y navegación
│   ├── icon.png                # Icono 80x80 para el lanzador
│   └── largeIcon.png           # Icono 130x130
├── server/                     # Servidor proxy local
│   ├── app.py                  # API FastAPI (puente RTSP -> HLS y consulta de eventos)
│   └── requirements.txt        # Dependencias (fastapi, uvicorn, pyezvizapi)
├── scripts/                    # Scripts auxiliares
│   └── test_login.py           # Inicio de sesión inicial con 2FA y volcado de sesión
├── iniciar_servidor.bat        # Script de un solo clic para iniciar el servidor en Windows
└── README.md
```

---

## 🎮 Controles de la Aplicación en el Televisor

La aplicación está diseñada para ser utilizada con el control remoto del televisor:

| Tecla / Botón | Acción |
| :--- | :--- |
| **Tecla [5]** | Transmisión en directo: **Galería (`H3c`)** |
| **Tecla [6]** | Transmisión en directo: **Living (`C3TN`)** |
| **Tecla [R]** | Consultar grabaciones de la microSD para la cámara seleccionada |
| **Flechas ⬅️ ➡️ ⬆️ ⬇️** | Navegar entre controles, selector de fechas y lista de clips grabados |
| **Tecla [OK] / Enter** | Seleccionar cámara, cambiar fecha o reproducir el evento elegido |
| **Tecla [3]** | Detener reproducción actual |
| **Tecla [4]** | Limpiar panel de eventos y registro |
| **Tecla [Back]** | Salir limpiamente de la aplicación |

---

## ⚙️ Puesta en Marcha

### 1. Iniciar el servidor local (en la PC)
Solo tenés que hacer doble clic sobre:
```bat
iniciar_servidor.bat
```
El servidor quedará disponible en el puerto `8080` de tu red local.

*(Para el futuro en una **Raspberry Pi**, basta con clonar el repo, instalar `requirements.txt` y correr `uvicorn server.app:app --host 0.0.0.0 --port 8080`).*

### 2. Instalar el paquete IPK en el televisor
El paquete compilado más reciente se encuentra en `dist/`:
```bash
# Instalación estándar vía CLI de webOS:
ares-install --device <nombre_tv> dist/com.manuel.ezviztv.test_0.1.1_all.ipk
ares-launch --device <nombre_tv> com.manuel.ezviztv.test

# O mediante el script automático para TVs rooteadas:
python scripts/deploy_tv.py
```

---

## 🔐 Seguridad y Privacidad
- El repositorio **no contiene ninguna contraseña, token ni credencial privada**.
- Los archivos de configuración local (`token.local.json`, `cameras.local.json`, `config.local.js`) están excluidos por `.gitignore`.
- Los segmentos temporales de video (`server/_hls/`) se generan en memoria/disco local y se eliminan automáticamente al detener la reproducción.

- Cada usuario genera su propia sesión local mediante `scripts/test_login.py`.
