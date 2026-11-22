// EZVIZ TV Web — Exploración Remota & Dashboard
document.addEventListener("DOMContentLoaded", () => {
  let cameras = [];
  let currentCam = null;
  let hlsPlayer = null;
  let selectedDate = getFormattedDate(0);

  // Elementos DOM
  const cameraButtons = document.getElementById("camera-buttons");
  const mainVideo = document.getElementById("main-video");
  const videoOverlay = document.getElementById("video-overlay");
  const overlayMsg = document.getElementById("overlay-msg");
  const liveBadge = document.getElementById("live-badge");
  const currentStreamName = document.getElementById("current-stream-name");
  const streamMeta = document.getElementById("stream-meta");
  const recordsCamName = document.getElementById("records-cam-name");
  const recordsList = document.getElementById("records-list");
  const dateShortcuts = document.getElementById("date-shortcuts");
  const customDateInput = document.getElementById("custom-date");

  // Telemetría
  const camIp = document.getElementById("cam-ip");
  const camModel = document.getElementById("cam-model");
  const camOnline = document.getElementById("cam-online");
  const serverStatus = document.getElementById("server-status");
  const statusText = document.getElementById("status-text");

  // Botones de control
  const btnSnapshot = document.getElementById("btn-snapshot");
  const btnFullscreen = document.getElementById("btn-fullscreen");
  const btnStop = document.getElementById("btn-stop");
  const btnRemoteInfo = document.getElementById("btn-remote-info");

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

  // Actualizar URL local en la guía
  if (lanUrlDisplay) {
    lanUrlDisplay.textContent = window.location.origin;
  }

  // === 1. INICIALIZACIÓN ===
  initApp();

  async function initApp() {
    setOverlay(true, "Cargando cámaras disponibles...");
    try {
      const res = await fetch("/api/cameras");
      if (!res.ok) throw new Error("Error HTTP " + res.status);
      const data = await res.json();
      cameras = data.cameras || [];

      if (cameras.length === 0) {
        setOverlay(true, "No se encontraron cámaras configuradas.");
        return;
      }

      renderCameraButtons();
      // Seleccionar por defecto la primera cámara (Galería)
      selectCamera(cameras[0]);
    } catch (err) {
      console.error("Error al cargar cámaras:", err);
      setOverlay(true, "No se pudo conectar con el servidor local. Verifique que uvicorn esté corriendo.");
      statusText.textContent = "Desconectado";
      serverStatus.querySelector(".status-dot").classList.remove("online");
    }
  }

  function renderCameraButtons() {
    cameraButtons.innerHTML = "";
    cameras.forEach((cam) => {
      const btn = document.createElement("button");
      btn.className = "cam-btn";
      btn.id = "btn-cam-" + cam.serial;
      btn.innerHTML = `<span>📹 ${cam.name || cam.serial}</span><span class="badge">${cam.model || "Cam"}</span>`;
      btn.addEventListener("click", () => {
        selectCamera(cam);
      });
      cameraButtons.appendChild(btn);
    });
  }

  function selectCamera(cam) {
    currentCam = cam;
    document.querySelectorAll(".cam-btn").forEach((b) => b.classList.remove("active"));
    const activeBtn = document.getElementById("btn-cam-" + cam.serial);
    if (activeBtn) activeBtn.classList.add("active");

    currentStreamName.textContent = cam.name || cam.serial;
    recordsCamName.textContent = cam.name || cam.serial;

    // Actualizar telemetría
    camIp.textContent = cam.local_ip || "DHCP";
    camModel.textContent = cam.model || "EZVIZ";
    camOnline.textContent = cam.online ? "Online" : "Offline";
    camOnline.style.color = cam.online ? "var(--success)" : "var(--danger)";

    // Iniciar vivo automáticamente
    playLiveStream();

    // Cargar grabaciones de la fecha activa
    loadRecords(selectedDate);
  }

  // === 2. REPRODUCCIÓN HLS (EN VIVO Y MICROSD) ===
  function playStreamUrl(url, label, isLive = true) {
    destroyPlayer();
    setOverlay(true, "Conectando señal de video...");
    liveBadge.classList.toggle("visible", isLive);
    streamMeta.textContent = isLive ? "1080p En Vivo" : "Grabación microSD";

    if (Hls.isSupported()) {
      hlsPlayer = new Hls({
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        enableWorker: true,
      });

      hlsPlayer.loadSource(url);
      hlsPlayer.attachMedia(mainVideo);

      hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
        setOverlay(false);
        mainVideo.play().catch((e) => console.warn("Autoplay bloqueado:", e));
      });

      hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error("Error fatal en Hls.js:", data);
          if (currentCam && currentCam.model === "C3TN" && url.includes("playback")) {
            setOverlay(true, "Nota: El modelo C3TN no expone reproducción directa de microSD por firmware.");
          } else {
            setOverlay(true, "Error al reproducir el flujo de video (" + data.details + ")");
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
      });
      mainVideo.addEventListener("error", () => {
        setOverlay(true, "Fallo al cargar video en el navegador.");
      });
    } else {
      setOverlay(true, "Tu navegador no soporta reproducción HLS.");
    }
  }

  function playLiveStream() {
    if (!currentCam) return;
    const url = `/api/stream/${currentCam.serial}/live.m3u8`;
    playStreamUrl(url, "En Vivo", true);
  }

  function playRecordClip(rec) {
    if (!currentCam) return;
    const tStart = rec.begin.split("T")[1] || rec.begin;
    const tEnd = rec.end.split("T")[1] || rec.end;

    let b = rec.begin.replace(/[-:]/g, "");
    if (!b.endsWith("Z")) b += "Z";
    let e = rec.end.replace(/[-:]/g, "");
    if (!e.endsWith("Z")) e += "Z";

    const url = `/api/stream/${currentCam.serial}/playback/live.m3u8?begin=${b}&end=${e}`;
    playStreamUrl(url, `microSD ${tStart} - ${tEnd}`, false);
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

  // === 3. EXPLORADOR DE GRABACIONES MICROSD ===
  function getFormattedDate(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  }

  async function loadRecords(dateStr) {
    selectedDate = dateStr;
    customDateInput.value = dateStr;
    recordsList.innerHTML = `
      <div class="empty-state">
        <div class="spinner" style="margin: 0 auto 10px auto;"></div>
        <p>Buscando grabaciones del ${dateStr}...</p>
      </div>`;

    if (!currentCam) return;

    try {
      const res = await fetch(`/api/cameras/${currentCam.serial}/records?date=${dateStr}&size=60`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      renderRecords(data.records || []);
    } catch (err) {
      console.error("Error al obtener grabaciones:", err);
      recordsList.innerHTML = `
        <div class="empty-state" style="color: var(--danger);">
          <p>Error al consultar las grabaciones en la cámara.</p>
        </div>`;
    }
  }

  function renderRecords(records) {
    recordsList.innerHTML = "";

    if (records.length === 0) {
      recordsList.innerHTML = `
        <div class="empty-state">
          <p>No se encontraron eventos grabados para esta fecha en la tarjeta microSD.</p>
        </div>`;
      return;
    }

    records.forEach((rec) => {
      const card = document.createElement("div");
      card.className = "record-card";

      const parseUtc = (s) => {
        if (!s) return null;
        const iso = s.endsWith("Z") ? s : s + "Z";
        const d = new Date(iso);
        return isNaN(d.getTime()) ? null : d;
      };

      const formatTime = (s) => {
        const d = parseUtc(s);
        if (!d) return s.split("T")[1] || s;
        return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
      };

      const localStart = formatTime(rec.begin);
      const localEnd = formatTime(rec.end);
      const utcStart = rec.begin.split("T")[1] || "";

      let durationText = "";
      const bDate = parseUtc(rec.begin);
      const eDate = parseUtc(rec.end);
      if (bDate && eDate) {
        const sec = Math.round((eDate.getTime() - bDate.getTime()) / 1000);
        if (sec > 0) {
          const m = Math.floor(sec / 60);
          const s = sec % 60;
          durationText = m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
        }
      }

      card.innerHTML = `
        <div class="record-time">
          <span class="record-hour">🕒 ${localStart} ➔ ${localEnd}</span>
          <span class="record-sub">${durationText ? `⏱️ ${durationText} | ` : ""}Hora real local (UTC: ${utcStart})</span>
        </div>
        <span class="record-tag">${rec.type || "CLIP"}</span>
      `;

      card.addEventListener("click", () => {
        document.querySelectorAll(".record-card").forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        playRecordClip(rec);
      });

      recordsList.appendChild(card);
    });
  }

  // Shortcuts de fecha
  dateShortcuts.querySelectorAll(".date-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      dateShortcuts.querySelectorAll(".date-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const days = parseInt(btn.dataset.days, 10);
      loadRecords(getFormattedDate(days));
    });
  });

  // Selector de fecha personalizada
  customDateInput.addEventListener("change", (e) => {
    if (e.target.value) {
      dateShortcuts.querySelectorAll(".date-tab").forEach((b) => b.classList.remove("active"));
      loadRecords(e.target.value);
    }
  });

  // === 4. CAPTURA DE FOTOS SNAPSHOT ===
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
    } catch (err) {
      console.error("Error al capturar foto:", err);
      snapshotContent.innerHTML = `
        <div style="color: var(--danger); text-align: center; padding: 20px;">
          <p>No se pudo capturar la foto en este momento: ${err.message}</p>
        </div>`;
    }
  });

  // === 5. CONTROLES DEL REPRODUCTOR ===
  btnStop.addEventListener("click", async () => {
    destroyPlayer();
    setOverlay(true, "Transmisión detenida por el usuario");
    liveBadge.classList.remove("visible");
    if (currentCam) {
      try {
        await fetch(`/api/stream/${currentCam.serial}/stop`, { method: "POST" });
      } catch (e) {}
    }
  });

  btnFullscreen.addEventListener("click", () => {
    const box = document.getElementById("video-box");
    if (!document.fullscreenElement) {
      if (box.requestFullscreen) box.requestFullscreen();
      else if (box.webkitRequestFullscreen) box.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  });

  // === 6. MODALES ===
  function openModal(modal) {
    modal.classList.add("open");
  }
  function closeModalFunc(modal) {
    modal.classList.remove("open");
  }

  closeModal.addEventListener("click", () => closeModalFunc(snapshotModal));
  btnCloseSnap.addEventListener("click", () => closeModalFunc(snapshotModal));
  modalBackdrop.addEventListener("click", () => closeModalFunc(snapshotModal));

  btnRemoteInfo.addEventListener("click", () => openModal(remoteModal));
  closeRemoteModal.addEventListener("click", () => closeModalFunc(remoteModal));
  btnCloseRemote.addEventListener("click", () => closeModalFunc(remoteModal));
  remoteBackdrop.addEventListener("click", () => closeModalFunc(remoteModal));
});
