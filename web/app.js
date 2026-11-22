// EZVIZ TV Web — Exploración Remota & Entorno Gráfico Unificado (Idéntico a la TV)
document.addEventListener("DOMContentLoaded", () => {
  let cameras = [];
  let currentCam = null;
  let hlsPlayer = null;
  let selectedDaysAgo = 0;
  let selectedDate = getFormattedDate(0);
  let recordItems = [];
  let currentFocusIdx = 0;

  // Elementos DOM
  const mainVideo = document.getElementById("main-video");
  const videoOverlay = document.getElementById("video-overlay");
  const overlayMsg = document.getElementById("overlay-msg");
  const liveBadge = document.getElementById("live-badge");
  const statusBar = document.getElementById("status-bar");
  const recordsCamLabel = document.getElementById("records-cam-label");
  const recordsList = document.getElementById("records-list");
  const logPanel = document.getElementById("log-panel");
  const customDateInput = document.getElementById("custom-date");

  // Botones de cámara y acción
  const btnCam1 = document.getElementById("btn-cam1");
  const btnCam2 = document.getElementById("btn-cam2");
  const btnLoadRecords = document.getElementById("btn-load-records");
  const btnStop = document.getElementById("btn-stop");
  const btnClear = document.getElementById("btn-clear");
  const btnSnapshot = document.getElementById("btn-snapshot");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const btnRemoteInfo = document.getElementById("btn-remote-info");

  // Botones de fecha
  const dateButtons = [
    document.getElementById("btn-date-today"),
    document.getElementById("btn-date-yesterday"),
    document.getElementById("btn-date-prev"),
  ];

  // Telemetría
  const camIp = document.getElementById("cam-ip");
  const camModel = document.getElementById("cam-model");
  const camOnline = document.getElementById("cam-online");

  // Modales
  const snapshotModal = document.getElementById("snapshot-modal");
  const snapshotContent = document.getElementById("snapshot-content");
  const btnDownloadSnap = document.getElementById("btn-download-snap");
  const closeModal = document.getElementById("close-modal");
  const btnCloseSnap = document.getElementById("btn-close-snap");
  const modalBackdrop = document.getElementById("modal-backdrop");

  const remoteModal = document.getElementById("remote-modal");
  const closeRemoteModal = document.getElementById("close-remote-modal");
  const btnCloseRemote = document.getElementById("btn-close-remote");
  const remoteBackdrop = document.getElementById("remote-backdrop");
  const lanUrlDisplay = document.getElementById("lan-url-display");

  if (lanUrlDisplay) {
    lanUrlDisplay.textContent = window.location.origin;
  }

  // === REGISTRO DEL SISTEMA (IDÉNTICO A LA TV) ===
  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function appendLog(type, parts) {
    if (!logPanel) return;
    const now = new Date();
    const timeStr = pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());
    const line = document.createElement("div");
    line.className = "log-" + type;
    const prefix = type === "ok" ? "[OK]" : type === "error" ? "[ERR]" : type === "warn" ? "[WARN]" : "[INFO]";
    const text = Array.isArray(parts) ? parts.join(" ") : parts;
    line.textContent = timeStr + " " + prefix + " " + text;
    logPanel.appendChild(line);
    logPanel.scrollTop = logPanel.scrollHeight;
  }

  function formatRealLocalTime(isoStr) {
    if (!isoStr) return "";
    const t = isoStr.includes("T") ? isoStr.split("T")[1] : (isoStr.includes(" ") ? isoStr.split(" ")[1] : isoStr);
    return t.replace("Z", "").slice(0, 8);
  }

  function getFormattedDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  // === 1. INICIALIZACIÓN ===
  initApp();

  async function initApp() {
    appendLog("ok", ["EZVIZ TV Web iniciado - Entorno unificado listo"]);
    setOverlay(true, "Cargando cámaras disponibles...");
    try {
      const res = await fetch("/api/cameras");
      if (!res.ok) throw new Error("Error HTTP " + res.status);
      const data = await res.json();
      cameras = data.cameras || [];

      if (cameras.length === 0) {
        setOverlay(true, "No se encontraron cámaras configuradas.");
        appendLog("error", ["No se encontraron cámaras configuradas en el servidor"]);
        return;
      }

      appendLog("ok", ["Cámaras detectadas: " + cameras.map((c) => (c.name || c.serial) + " (" + c.model + ")").join(", ")]);

      // Asociar cámaras a botones fijos [1] y [2]
      if (cameras[0]) {
        btnCam1.textContent = "[1] " + (cameras[0].name || "Cámara 1") + " (" + (cameras[0].model || "H3c") + ")";
      }
      if (cameras[1]) {
        btnCam2.textContent = "[2] " + (cameras[1].name || "Cámara 2") + " (" + (cameras[1].model || "C3TN") + ")";
      }

      // Seleccionar por defecto la primera cámara (Galería)
      selectCamera(cameras[0]);
    } catch (err) {
      console.error("Error al cargar cámaras:", err);
      setOverlay(true, "No se pudo conectar con el servidor local. Verifique que uvicorn esté corriendo.");
      appendLog("error", ["Fallo de conexión con servidor local:", err.message]);
      statusBar.textContent = "Desconectado | Error de red";
    }
  }

  function selectCamera(cam) {
    if (!cam) return;
    currentCam = cam;

    btnCam1.classList.toggle("active-cam", cameras[0] && cameras[0].serial === cam.serial);
    btnCam2.classList.toggle("active-cam", cameras[1] && cameras[1].serial === cam.serial);

    recordsCamLabel.textContent = cam.name || cam.serial;
    statusBar.textContent = "Conectado | " + (cam.name || cam.serial) + " (1080p)";

    // Actualizar telemetría
    camIp.textContent = "IP: " + (cam.local_ip || "DHCP");
    camModel.textContent = "Modelo: " + (cam.model || "EZVIZ");
    camOnline.textContent = "Estado: " + (cam.online ? "Online" : "Offline");
    camOnline.style.color = cam.online ? "#4ade80" : "#f87171";

    appendLog("info", ["Cámara seleccionada:", cam.name || cam.serial, "IP:", cam.local_ip || "Auto"]);

    // Iniciar transmisión en vivo
    playLiveStream();

    // Cargar grabaciones de la fecha activa
    loadRecords(selectedDaysAgo);
  }

  // === 2. REPRODUCCIÓN HLS ===
  function playStreamUrl(url, label, isLive = true) {
    destroyPlayer();
    setOverlay(true, "Conectando señal de video...");
    liveBadge.classList.toggle("visible", isLive);

    if (Hls.isSupported()) {
      hlsPlayer = new Hls({
        enableWorker: true,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 8,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      });

      hlsPlayer.loadSource(url);
      hlsPlayer.attachMedia(mainVideo);

      hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
        setOverlay(false);
        const p = mainVideo.play();
        if (p && typeof p.catch === "function") {
          p.catch((e) => {
            console.warn("Autoplay bloqueado con sonido, reintentando silenciado:", e);
            mainVideo.muted = true;
            mainVideo.play().catch((err) => console.error("Fallo play():", err));
          });
        }
        appendLog("ok", [label, "- Señal HLS establecida"]);
      });

      hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error("Error fatal en Hls.js:", data);
          if (currentCam && currentCam.model === "C3TN" && url.includes("playback")) {
            setOverlay(true, "Nota: El modelo C3TN no expone reproducción directa de microSD por firmware.");
            appendLog("warn", ["El modelo C3TN no permite reproducción directa RTSP de microSD"]);
          } else {
            setOverlay(true, "Error al reproducir el flujo de video (" + data.details + ")");
            appendLog("error", ["Fallo HLS:", data.details]);
          }
          destroyPlayer();
        }
      });
    } else if (mainVideo.canPlayType("application/vnd.apple.mpegurl")) {
      // Soporte nativo para Safari (macOS / iPhone / iPad)
      mainVideo.src = url;
      mainVideo.addEventListener("loadedmetadata", () => {
        setOverlay(false);
        mainVideo.play().catch((e) => console.warn("Autoplay Safari:", e));
        appendLog("ok", [label, "- Señal Safari nativa"]);
      });
      mainVideo.addEventListener("error", () => {
        setOverlay(true, "Fallo al cargar video en el navegador.");
        appendLog("error", ["Error en reproductor nativo del navegador"]);
      });
    } else {
      setOverlay(true, "Tu navegador no soporta reproducción HLS.");
      appendLog("error", ["Navegador sin soporte HLS"]);
    }
  }

  function playLiveStream() {
    if (!currentCam) return;
    const url = `/api/stream/${currentCam.serial}/live.m3u8`;
    appendLog("info", ["Iniciando video en vivo:", currentCam.name || currentCam.serial]);
    playStreamUrl(url, "En Vivo " + (currentCam.name || currentCam.serial), true);
  }

  function playRecordClip(rec, localStart, localEnd) {
    if (!currentCam) return;
    const lStart = localStart || formatRealLocalTime(rec.begin);
    const lEnd = localEnd || formatRealLocalTime(rec.end);

    appendLog("ok", ["Reproduciendo grabación: " + lStart + " a " + lEnd + " (Hora Mendoza)"]);

    let b = rec.begin.replace(/[-:]/g, "");
    if (!b.endsWith("Z")) b += "Z";
    let e = rec.end.replace(/[-:]/g, "");
    if (!e.endsWith("Z")) e += "Z";

    const url = `/api/stream/${currentCam.serial}/playback/live.m3u8?begin=${b}&end=${e}`;
    playStreamUrl(url, `microSD ${currentCam.name || currentCam.serial} ${lStart}`, false);
  }

  function destroyPlayer() {
    if (hlsPlayer) {
      hlsPlayer.destroy();
      hlsPlayer = null;
    }
    mainVideo.pause();
    mainVideo.removeAttribute("src");
    mainVideo.load();
  }

  function setOverlay(visible, message = "") {
    if (visible) {
      videoOverlay.classList.remove("hidden");
      overlayMsg.textContent = message;
    } else {
      videoOverlay.classList.add("hidden");
    }
  }

  // === 3. GRABACIONES MICROSD EN 2 COLUMNAS (IDÉNTICO A LA TV) ===
  async function loadRecords(daysAgoOrDateStr) {
    let dateStr;
    if (typeof daysAgoOrDateStr === "number") {
      selectedDaysAgo = daysAgoOrDateStr;
      dateStr = getFormattedDate(daysAgoOrDateStr);
    } else {
      dateStr = daysAgoOrDateStr;
    }

    selectedDate = dateStr;
    if (customDateInput) customDateInput.value = dateStr;

    // Actualizar botones de fechas
    dateButtons.forEach((btn, idx) => {
      if (btn) btn.classList.toggle("active-date", typeof daysAgoOrDateStr === "number" && idx === daysAgoOrDateStr);
    });

    recordsList.innerHTML = `
      <div style="color: #38bdf8; text-align: center; margin-top: 40px; font-size: 16px; grid-column: 1 / -1;">
        <div class="spinner" style="margin: 0 auto 12px auto;"></div>
        Buscando grabaciones del ${dateStr}...
      </div>`;

    appendLog("info", ["Consultando grabaciones de", currentCam ? (currentCam.name || currentCam.serial) : "cámara", "en fecha", dateStr]);

    if (!currentCam) return;

    try {
      const res = await fetch(`/api/cameras/${currentCam.serial}/records?date=${dateStr}&limit=500`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      renderRecords(data.records || [], dateStr);
    } catch (err) {
      console.error("Error al obtener grabaciones:", err);
      recordsList.innerHTML = `
        <div style="color: #f87171; text-align: center; margin-top: 40px; grid-column: 1 / -1;">
          Error al consultar grabaciones en la cámara (${err.message})
        </div>`;
      appendLog("error", ["Fallo al consultar grabaciones microSD:", err.message]);
    }
  }

  function renderRecords(records, dateStr) {
    recordsList.innerHTML = "";
    recordItems = [];

    if (records.length === 0) {
      recordsList.innerHTML = `
        <div style="color: #94a3b8; text-align: center; margin-top: 50px; font-size: 16px; grid-column: 1 / -1;">
          No hay eventos grabados el ${dateStr}
        </div>`;
      appendLog("info", ["No se encontraron eventos grabados el " + dateStr]);
      return;
    }

    appendLog("ok", ["Encontradas " + records.length + " grabaciones (Hora Mendoza UTC-3)"]);

    // Orden descendente (más recientes arriba)
    const sortedRecords = records.slice().reverse();

    sortedRecords.forEach((rec, index) => {
      const item = document.createElement("div");
      item.className = "record-item";
      item.tabIndex = 0;

      const localStart = formatRealLocalTime(rec.begin);
      const localEnd = formatRealLocalTime(rec.end);
      const isAlarm = rec.type === "ALARM";

      item.innerHTML = `
        <div class="record-thumb">
          <span class="thumb-tag">${isAlarm ? "ALERTA" : "REC"}</span>
          <span class="play-icon">▶</span>
        </div>
        <div class="record-info">
          <div class="record-time-real">${localStart}</div>
          <div class="record-sub-real">${localStart.slice(0, 5)} a ${localEnd.slice(0, 5)}</div>
        </div>
      `;

      item.addEventListener("click", () => {
        document.querySelectorAll(".record-item").forEach((it) => it.classList.remove("focused"));
        item.classList.add("focused");
        currentFocusIdx = index;
        playRecordClip(rec, localStart, localEnd);
      });

      recordsList.appendChild(item);
      recordItems.push(item);
    });
  }

  // === 4. NAVEGACIÓN SECUENCIAL (CH+ / CH-) ===
  function goChannelUp() {
    if (recordItems && recordItems.length > 0) {
      if (currentFocusIdx > 0) {
        currentFocusIdx--;
      }
      updateFocusRecord();
      appendLog("info", ["CH+ Clip siguiente (" + (currentFocusIdx + 1) + "/" + recordItems.length + ")"]);
      if (recordItems[currentFocusIdx]) recordItems[currentFocusIdx].click();
    } else {
      if (cameras.length > 1) {
        const nextCam = currentCam === cameras[0] ? cameras[1] : cameras[0];
        selectCamera(nextCam);
      }
    }
  }

  function goChannelDown() {
    if (recordItems && recordItems.length > 0) {
      if (currentFocusIdx < recordItems.length - 1) {
        currentFocusIdx++;
      }
      updateFocusRecord();
      appendLog("info", ["CH- Clip anterior (" + (currentFocusIdx + 1) + "/" + recordItems.length + ")"]);
      if (recordItems[currentFocusIdx]) recordItems[currentFocusIdx].click();
    } else {
      if (cameras.length > 1) {
        const prevCam = currentCam === cameras[1] ? cameras[0] : cameras[1];
        selectCamera(prevCam);
      }
    }
  }

  function updateFocusRecord() {
    document.querySelectorAll(".record-item").forEach((it) => it.classList.remove("focused"));
    if (recordItems[currentFocusIdx]) {
      recordItems[currentFocusIdx].classList.add("focused");
      recordItems[currentFocusIdx].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  // === 5. EVENT LISTENERS DE CONTROLES ===
  btnCam1.addEventListener("click", () => {
    if (cameras[0]) selectCamera(cameras[0]);
  });

  btnCam2.addEventListener("click", () => {
    if (cameras[1]) selectCamera(cameras[1]);
  });

  btnLoadRecords.addEventListener("click", () => {
    loadRecords(selectedDaysAgo);
  });

  btnStop.addEventListener("click", async () => {
    destroyPlayer();
    setOverlay(true, "Transmisión detenida por el usuario");
    liveBadge.classList.remove("visible");
    appendLog("info", ["Reproductor detenido"]);
    if (currentCam) {
      try {
        await fetch(`/api/stream/${currentCam.serial}/stop`, { method: "POST" });
      } catch (e) {}
    }
  });

  btnClear.addEventListener("click", () => {
    logPanel.innerHTML = "";
    appendLog("ok", ["Registro limpiado"]);
  });

  btnFullscreen.addEventListener("click", () => {
    const box = document.getElementById("video-container");
    if (!document.fullscreenElement) {
      if (box.requestFullscreen) box.requestFullscreen();
      else if (box.webkitRequestFullscreen) box.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  });

  // Selector de botones de fecha
  dateButtons.forEach((btn, idx) => {
    if (btn) {
      btn.addEventListener("click", () => {
        loadRecords(idx);
      });
    }
  });

  // Selector de fecha personalizada
  if (customDateInput) {
    customDateInput.addEventListener("change", (e) => {
      if (e.target.value) {
        loadRecords(e.target.value);
      }
    });
  }

  // === 6. CAPTURA DE FOTOS SNAPSHOT ===
  btnSnapshot.addEventListener("click", async () => {
    if (!currentCam) return;
    openModal(snapshotModal);
    snapshotContent.innerHTML = `
      <div style="text-align: center; padding: 30px;">
        <div class="spinner" style="margin: 0 auto 12px auto;"></div>
        <p>Capturando fotografía en alta resolución desde el sensor...</p>
      </div>`;
    btnDownloadSnap.style.display = "none";

    try {
      const res = await fetch(`/api/cameras/${currentCam.serial}/snapshot`);
      const data = await res.json();
      if (!res.ok || !data.picUrl) {
        throw new Error(data.detail || "No se obtuvo URL de imagen");
      }

      snapshotContent.innerHTML = `
        <img src="${data.picUrl}" alt="Snapshot HD" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color); display: block;">
      `;
      btnDownloadSnap.href = data.picUrl;
      btnDownloadSnap.style.display = "inline-flex";
      appendLog("ok", ["Foto HD capturada con éxito"]);
    } catch (err) {
      console.error("Error al capturar foto:", err);
      snapshotContent.innerHTML = `
        <div style="color: var(--danger); text-align: center; padding: 20px;">
          <p>No se pudo capturar la foto en este momento: ${err.message}</p>
        </div>`;
      appendLog("error", ["Fallo captura snapshot:", err.message]);
    }
  });

  // === 7. MODALES ===
  function openModal(modal) {
    modal.classList.add("visible");
    modal.classList.add("open");
  }

  function closeModalFunc(modal) {
    modal.classList.remove("visible");
    modal.classList.remove("open");
  }

  closeModal.addEventListener("click", () => closeModalFunc(snapshotModal));
  btnCloseSnap.addEventListener("click", () => closeModalFunc(snapshotModal));
  modalBackdrop.addEventListener("click", () => closeModalFunc(snapshotModal));

  btnRemoteInfo.addEventListener("click", () => openModal(remoteModal));
  closeRemoteModal.addEventListener("click", () => closeModalFunc(remoteModal));
  btnCloseRemote.addEventListener("click", () => closeModalFunc(remoteModal));
  remoteBackdrop.addEventListener("click", () => closeModalFunc(remoteModal));

  // === 8. ATAJOS DE TECLADO (IDÉNTICOS AL CONTROL REMOTO DE LA TV) ===
  document.addEventListener("keydown", (ev) => {
    // Ignorar teclas si se escribe en un input
    if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA") return;

    const code = ev.keyCode;

    if (code === 49) { if (cameras[0]) selectCamera(cameras[0]); return; }           // [1] Galería
    if (code === 50) { if (cameras[1]) selectCamera(cameras[1]); return; }           // [2] Living
    if (code === 52 || code === 82) { loadRecords(selectedDaysAgo); return; }        // [4] Grabaciones o R
    if (code === 53) { btnStop.click(); return; }                                   // [5] Detener
    if (code === 54) { btnClear.click(); return; }                                  // [6] Limpiar
    if (code === 55) { loadRecords(0); return; }                                     // [7] Hoy
    if (code === 56) { loadRecords(1); return; }                                     // [8] Ayer
    if (code === 57) { loadRecords(2); return; }                                     // [9] Hace dos días
    if (code === 33 || code === 427 || ev.key === "ChannelUp") { goChannelUp(); return; }   // [CH+] Siguiente
    if (code === 34 || code === 428 || ev.key === "ChannelDown") { goChannelDown(); return; } // [CH-] Anterior
    if (code === 27) { btnStop.click(); return; }                                    // Escape
  });
});
