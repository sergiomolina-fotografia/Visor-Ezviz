# 📺 EZVIZ TV & Web — Visor de Cámaras para LG Smart TV (webOS) y Exploración Web Remota

**Tus cámaras de seguridad EZVIZ directamente en tu Smart TV LG, monitor de PC o celular fuera de casa, con video en vivo 1080p, fotos instantáneas y reproducción de grabaciones microSD.**

---

## 🚀 Estado Actual del Proyecto (Noviembre 2026)

**Hitos alcanzados y 100% validados en hardware real (LG 50UP7750PSB webOS 6.0, PC y Móvil):**
- [x] **Video en directo fluido en 1080p** para ambas cámaras mediante decodificación por hardware nativo (`<video>` con HLS).
- [x] **Galería de grabaciones en 2 columnas y paginación ilimitada**: Recuperación automática de todas las grabaciones del día (sin tope de 50 de la API, soporta más de 180+ clips diarios) organizadas en cuadrícula de 2 columnas con hora real destacada y navegación 2D en control remoto.
- [x] **Horario real local y tarjetas con miniatura**: Conversión automática de timestamps UTC a la hora real local (UTC-3), tarjetas con miniatura gráfica/preview para cada evento de microSD y visualización limpia sin saturación de duración.
- [x] **Barra inferior de Registro del Sistema**: Panel de consola y estado en tiempo real reubicado en una barra inferior debajo del video principal, liberando el 100% del sidebar lateral para las grabaciones.
- [x] **Web Dashboard para Exploración Remota**: Interfaz web moderna y responsiva servida en el puerto `8080` para PC, Mac, tablets y celulares (iPhone / Android) con `hls.js`.
- [x] **Captura de Fotos HD instantáneas**: Disparo fotográfico en tiempo real desde los sensores con descarga directa (`/api/cameras/{serial}/snapshot`).
- [x] **Cámara Galería (`H3c`)**: En vivo y reproducción completa de eventos grabados en la microSD vía RTSP con enrutamiento HLS dedicado (`/playback/live.m3u8`).
- [x] **Cámara Living (`C3TN`)**: En vivo fluido en 1080p por RTSP local y consulta de registros microSD.
- [x] **Resolución dinámica de IPs**: Detección en tiempo real de la IP de cada cámara por su número de serie en la API de EZVIZ, tolerante a cambios de IP por DHCP.
- [x] **Identidad visual completa**: Iconos maestros, splash 16:9, favicons y assets empaquetados en la app nativa IPK y en la web.
- [x] **Explorador de microSD**: Selector de fechas (Hoy, Ayer, Antier o fecha personalizada), consulta de eventos y reproducción directa de clips.
- [x] **Manejo de errores amigable en pantalla**: Diagnósticos claros en el panel de eventos en caso de desconexiones o limitaciones de formato por modelo de cámara.

---

## 🏗️ Arquitectura del Sistema (Vía B)

```
[ Cámaras EZVIZ ] (RTSP local / Nube)
       │
       ▼ (LAN / Wi-Fi)
[ Servidor Proxy Local (PC / Raspberry Pi) ] ◄── (Cloudflare Tunnel / Tailscale / LAN)
  ├── FastAPI (REST API para cámaras, snapshots y clips microSD)
  ├── ffmpeg (Transcodificación de ultra baja latencia H.264/AAC a HLS)
  └── Static Web Server (Dashboard web moderno responsivo)
       │
       ├──► [ Smart TV LG webOS 6.0 (IPK) ] ── Decodificación por hardware nativo <video>
       └──► [ Navegadores Web (PC, Mac, iPhone, Android) ] ── Hls.js y Safari HLS nativo
```

---

## 📂 Estructura del Repositorio

```text
Visor-Ezviz/
├── assets/                     # Identidad visual (iconos, splash, web, logo)
├── dist/                       # Paquetes compilados webOS listos para instalar (.ipk)
├── ezviz-tv-test/              # App nativa para Smart TV LG webOS (HTML5/JS ES5)
├── server/                     # Servidor proxy local
│   ├── app.py                  # API FastAPI (puente RTSP -> HLS, clips y web)
│   └── requirements.txt        # Dependencias (fastapi, uvicorn, pyezvizapi)
├── web/                        # Web Dashboard responsivo para exploración remota
│   ├── index.html              # Interfaz web moderna (PC, tablet y móvil)
│   ├── style.css               # Diseño oscuro optimizado
│   ├── app.js                  # Lógica de reproducción Hls.js y visor microSD
│   └── js/hls.min.js           # Reproductor HLS autónomo integrado
├── scripts/                    # Scripts auxiliares
│   ├── test_login.py           # Inicio de sesión inicial con 2FA y volcado de sesión
│   └── deploy_tv.py            # Despliegue automatizado al televisor LG
├── iniciar_servidor.bat        # Script de 1 clic para iniciar servidor y Web en Windows
└── README.md
```

---

## 🌐 Exploración Web & Acceso Remoto

### En la Red Local (Wi-Fi de tu Casa)
Abre en cualquier navegador de tu PC, tablet o celular:
```text
http://localhost:8080
o
http://<IP_DE_TU_PC>:8080   (ej. http://192.168.18.29:8080)
```

### Fuera de Casa (Acceso Remoto por Internet)
Para ingresar desde redes 4G/5G u otras conexiones sin abrir puertos en el router ni pagar suscripciones:

1. **Cloudflare Tunnel (1 clic con script incluido):**
   Solo haz doble clic sobre:
   ```bat
   iniciar_acceso_remoto.bat
   ```
   En unos segundos se generará en pantalla un enlace seguro HTTPS (ejemplo: `https://xxxx.trycloudflare.com`) que podrás abrir en el navegador de tu celular desde cualquier lugar del mundo.

2. **Tailscale (VPN Mesh Privada):**
   Instala Tailscale en tu PC y en tu celular. Podrás acceder directamente con la IP privada de Tailscale con cifrado de punto a punto.

---

## 🎮 Controles de la Aplicación en el Televisor

La aplicación de Smart TV está diseñada para ser utilizada con el control remoto:

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

### 1. Iniciar el servidor local y Web Dashboard
Solo haz doble clic sobre:
```bat
iniciar_servidor.bat
```
El servidor y la web quedarán disponibles en el puerto `8080`.

*(Para una **Raspberry Pi**, basta con clonar el repo, instalar `requirements.txt` y correr `uvicorn server.app:app --host 0.0.0.0 --port 8080`).*

### 2. Instalar el paquete IPK en el televisor LG
El paquete compilado más reciente se encuentra en `dist/`:
```bash
# Instalación estándar vía CLI de webOS:
ares-install --device <nombre_tv> dist/com.sergio.ezviztv.test_0.1.2_all.ipk
ares-launch --device <nombre_tv> com.sergio.ezviztv.test

# O mediante el script automático para TVs rooteadas:
python scripts/deploy_tv.py
```

---

## 🔐 Seguridad y Privacidad
- El repositorio **no contiene ninguna contraseña, token ni credencial privada**.
- Los archivos de configuración local (`token.local.json`, `cameras.local.json`, `config.local.js`) están excluidos por `.gitignore`.
- Los segmentos temporales de video (`server/_hls/`) se generan en memoria/disco local y se eliminan automáticamente al detener la reproducción.
- Cada usuario genera su propia sesión local mediante `scripts/test_login.py`.
