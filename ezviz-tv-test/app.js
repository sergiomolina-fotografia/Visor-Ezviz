(function () {
  "use strict";

  var CONFIG = {
    serverUrl: "http://192.168.18.29:8080",
    cam1Serial: "BE3871590",
    cam2Serial: "J92500664"
  };

  if (window.EZVIZ_LOCAL_CONFIG) {
    for (var k in window.EZVIZ_LOCAL_CONFIG) {
      if (Object.prototype.hasOwnProperty.call(window.EZVIZ_LOCAL_CONFIG, k)) {
        CONFIG[k] = window.EZVIZ_LOCAL_CONFIG[k];
      }
    }
  }

  var currentCam = CONFIG.cam1Serial;
  var currentCamName = "Galería";
  var selectedDaysAgo = 0;
  var focusZone = "controls"; // "controls" | "dates" | "records"
  var controlButtons = [];
  var dateButtons = [];
  var recordItems = [];
  var focusIdx = 0;

  var logPanel = document.getElementById("log-panel");
  var statusBar = document.getElementById("status-bar");
  var recordsList = document.getElementById("records-list");
  var recordsCamLabel = document.getElementById("records-cam-label");

  // === 1. REGISTRO EN PANTALLA ===
  function appendLog(level, args) {
    var now = new Date();
    var ts = now.toTimeString().split(" ")[0];
    var text = Array.prototype.slice.call(args).map(function (item) {
      if (typeof item === "object" && item !== null) {
        try { return JSON.stringify(item); } catch (e) { return String(item); }
      }
      return String(item);
    }).join(" ");

    var line = document.createElement("div");
    line.className = "log-" + level;
    line.textContent = "[" + ts + "] " + text;
    logPanel.appendChild(line);
    logPanel.scrollTop = logPanel.scrollHeight;
  }

  var origLog = console.log, origWarn = console.warn, origError = console.error;
  console.log = function () { appendLog("info", arguments); origLog.apply(console, arguments); };
  console.warn = function () { appendLog("warn", arguments); origWarn.apply(console, arguments); };
  console.error = function () { appendLog("error", arguments); origError.apply(console, arguments); };

  window.onerror = function (msg, src, line, col, err) {
    appendLog("error", ["UNCAUGHT:", msg, "en", src + ":" + line + ":" + col, err ? err.stack : ""]);
    return false;
  };

  // Monitor de memoria cada 5s
  setInterval(function () {
    var ramText = "--";
    if (window.performance && performance.memory) {
      ramText = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)) + " MB";
    }
    var v = document.querySelector("video");
    var state = (v && !v.paused) ? "Reproduciendo" : "Detenido";
    statusBar.textContent = currentCamName + " | " + state + " | RAM: " + ramText;
  }, 5000);

  // === 2. REPRODUCCIÓN NATIVA HLS (LG <video>) ===
  function stopPlayer(callback) {
    var container = document.getElementById("video-container");
    var video = container.querySelector("video");
    if (video) {
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch (e) {}
    }
    container.innerHTML = "";
    if (callback) callback();
  }

  function startNativeHls(url, label) {
    stopPlayer(function () {
      appendLog("ok", ["Iniciando transmisión (" + (label || "Video") + ")..."]);
      var container = document.getElementById("video-container");
      var video = document.createElement("video");
      video.autoplay = true;
      video.controls = true;
      video.playsInline = true;

      video.addEventListener("loadedmetadata", function () {
        appendLog("ok", ["Metadata lista: " + video.videoWidth + "x" + video.videoHeight]);
      });
      video.addEventListener("playing", function () {
        appendLog("ok", ["Reproduciendo por hardware nativo"]);
      });
      video.addEventListener("error", function () {
        var err = video.error;
        var msg = err ? "Código " + err.code + " (" + (err.message || "Fallo decodificación/red") + ")" : "Error de red/servidor";
        appendLog("err", ["Error en reproductor:", msg]);
        if (currentCam === CONFIG.cam2Serial && url.indexOf("playback") !== -1) {
          appendLog("warn", ["Nota: El modelo C3TN no expone RTSP directo para microSD."]);
        }
      });

      video.src = url;
      container.appendChild(video);
      var p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(function (e) {
          console.warn("Aviso play():", e.message);
          appendLog("warn", ["Aviso reproducción:", e.message]);
        });
      }
    });
  }

  function playLive(serial, name) {
    currentCam = serial;
    currentCamName = name;
    recordsCamLabel.textContent = name;
    document.getElementById("btn-cam1").classList.toggle("active-cam", serial === CONFIG.cam1Serial);
    document.getElementById("btn-cam2").classList.toggle("active-cam", serial === CONFIG.cam2Serial);
    var url = CONFIG.serverUrl + "/api/stream/" + serial + "/live.m3u8";
    startNativeHls(url, "En vivo: " + name);
  }

  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function parseUtcDate(isoStr) {
    if (!isoStr) return null;
    var s = isoStr.endsWith("Z") ? isoStr : (isoStr + "Z");
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatRealLocalTime(isoStr) {
    var d = parseUtcDate(isoStr);
    if (!d) return isoStr.split("T")[1] || isoStr;
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
  }

  function formatRealLocalDate(isoStr) {
    var d = parseUtcDate(isoStr);
    if (!d) return "";
    return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1);
  }

  function calculateDuration(beginStr, endStr) {
    var b = parseUtcDate(beginStr);
    var e = parseUtcDate(endStr);
    if (!b || !e) return "";
    var sec = Math.round((e.getTime() - b.getTime()) / 1000);
    if (sec <= 0) return "";
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    if (m > 0) return m + "m " + (s < 10 ? "0" + s : s) + "s";
    return s + "s";
  }

  function getDateString(daysAgo) {
    var d = new Date();
    d.setDate(d.getDate() - daysAgo);
    var yyyy = d.getFullYear();
    var mm = pad2(d.getMonth() + 1);
    var dd = pad2(d.getDate());
    return yyyy + "-" + mm + "-" + dd;
  }

  function loadRecords(daysAgo) {
    selectedDaysAgo = daysAgo;
    var dateStr = getDateString(daysAgo);
    recordsList.innerHTML = '<div style="color: #38bdf8; text-align: center; margin-top: 40px; font-size: 18px;">Buscando grabaciones del ' + dateStr + '...</div>';
    appendLog("info", ["Consultando grabaciones de", currentCamName, "en fecha", dateStr]);

    var xhr = new XMLHttpRequest();
    xhr.open("GET", CONFIG.serverUrl + "/api/cameras/" + currentCam + "/records?date=" + dateStr + "&size=100");
    xhr.timeout = 10000;
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          var res = JSON.parse(xhr.responseText);
          renderRecords(res.records || [], dateStr);
        } catch (e) {
          recordsList.innerHTML = '<div style="color: #f87171; text-align: center;">Error al procesar respuesta JSON</div>';
        }
      } else {
        recordsList.innerHTML = '<div style="color: #f87171; text-align: center;">Error del servidor (' + xhr.status + ')</div>';
      }
    };
    xhr.onerror = function () {
      recordsList.innerHTML = '<div style="color: #f87171; text-align: center;">No se pudo conectar con el servidor local</div>';
    };
    xhr.send();
  }

  function renderRecords(records, dateStr) {
    recordsList.innerHTML = "";
    if (records.length === 0) {
      recordsList.innerHTML = '<div style="color: #94a3b8; text-align: center; margin-top: 50px; font-size: 18px;">No hay eventos grabados el ' + dateStr + '</div>';
      return;
    }

    appendLog("ok", ["Encontradas " + records.length + " grabaciones (Hora real convertida a tu zona horaria)"]);
    recordItems = [];

    records.forEach(function (rec, index) {
      var item = document.createElement("div");
      item.className = "record-item";
      item.tabIndex = 0;
      
      var localStart = formatRealLocalTime(rec.begin);
      var localEnd = formatRealLocalTime(rec.end);
      var localDate = formatRealLocalDate(rec.begin);
      var duration = calculateDuration(rec.begin, rec.end);
      var utcStart = rec.begin.split("T")[1] || "";

      var tagLabel = rec.type === "ALARM" ? "🚨 MOVIMIENTO" : (rec.type || "CLIP");

      item.innerHTML = 
        '<div class="record-thumb">' +
          '<span class="thumb-tag">' + (rec.type || "REC") + '</span>' +
          '<span class="play-icon">▶</span>' +
          (duration ? '<span class="thumb-dur">' + duration + '</span>' : '') +
        '</div>' +
        '<div class="record-info">' +
          '<div class="record-time-real">' + localStart + ' ➔ ' + localEnd + '</div>' +
          '<div class="record-meta-row">' +
            '<span class="badge-alarm">' + tagLabel + '</span>' +
            (localDate ? '<span>📅 ' + localDate + '</span>' : '') +
            '<span class="badge-utc-hint">UTC: ' + utcStart + '</span>' +
          '</div>' +
        '</div>';
      
      item.addEventListener("click", function () {
        playRecordClip(rec, localStart, localEnd);
      });

      recordsList.appendChild(item);
      recordItems.push(item);
    });

    // Actualizar botones de fechas
    dateButtons.forEach(function (btn, idx) {
      btn.classList.toggle("active-date", idx === selectedDaysAgo);
    });
  }

  function playRecordClip(rec, localStart, localEnd) {
    var lStart = localStart || formatRealLocalTime(rec.begin);
    var lEnd = localEnd || formatRealLocalTime(rec.end);
    var utcStart = rec.begin.split("T")[1] || rec.begin;
    appendLog("ok", ["Reproduciendo grabación: " + lStart + " a " + lEnd + " (Hora real) [UTC: " + utcStart + "]"]);
    var b = rec.begin.replace(/[-:]/g, "");
    if (!b.endsWith("Z")) b += "Z";
    var e = rec.end.replace(/[-:]/g, "");
    if (!e.endsWith("Z")) e += "Z";
    var url = CONFIG.serverUrl + "/api/stream/" + currentCam + "/playback/live.m3u8?begin=" + b + "&end=" + e;
    startNativeHls(url, "microSD " + currentCamName + " " + lStart);
  }

  // === 4. NAVEGACIÓN Y CONTROL REMOTO ===
  function updateFocus() {
    // Limpiar focos anteriores
    document.querySelectorAll(".focused").forEach(function (el) { el.classList.remove("focused"); });

    if (focusZone === "controls") {
      if (controlButtons[focusIdx]) {
        controlButtons[focusIdx].classList.add("focused");
        controlButtons[focusIdx].focus();
      }
    } else if (focusZone === "dates") {
      if (dateButtons[focusIdx]) {
        dateButtons[focusIdx].classList.add("focused");
        dateButtons[focusIdx].focus();
      }
    } else if (focusZone === "records") {
      if (recordItems[focusIdx]) {
        recordItems[focusIdx].classList.add("focused");
        recordItems[focusIdx].focus();
        recordItems[focusIdx].scrollIntoView({ block: "nearest" });
      }
    }
  }

  function handleAction(action) {
    if (action === "cam1") playLive(CONFIG.cam1Serial, "Galería");
    else if (action === "cam2") playLive(CONFIG.cam2Serial, "Living");
    else if (action === "load-records") loadRecords(selectedDaysAgo);
    else if (action === "stop") stopPlayer(function () { appendLog("info", ["Reproductor detenido"]); });
    else if (action === "clear") { logPanel.innerHTML = ""; appendLog("ok", ["Registro limpiado"]); }
  }

  document.addEventListener("keydown", function (ev) {
    var code = ev.keyCode;

    // Atajos directos numéricos en cualquier momento
    if (code === 53) { playLive(CONFIG.cam1Serial, "Galería"); return; } // Tecla 5
    if (code === 54) { playLive(CONFIG.cam2Serial, "Living"); return; }  // Tecla 6
    if (code === 51) { handleAction("stop"); return; }                   // Tecla 3
    if (code === 52) { handleAction("clear"); return; }                  // Tecla 4
    if (code === 82) { loadRecords(selectedDaysAgo); return; }           // Tecla R

    // Tecla BACK de webOS (461) o Escape
    if (code === 461 || code === 27) {
      stopPlayer(function () {
        if (window.webOSSystem && window.webOSSystem.platformBack) window.webOSSystem.platformBack();
        else window.close();
      });
      return;
    }

    // Flecha DERECHA (39)
    if (code === 39) {
      if (focusZone === "controls") {
        if (focusIdx < controlButtons.length - 1) focusIdx++;
        else { focusZone = "dates"; focusIdx = 0; }
      } else if (focusZone === "dates") {
        if (focusIdx < dateButtons.length - 1) focusIdx++;
      }
      updateFocus();
    }
    // Flecha IZQUIERDA (37)
    else if (code === 37) {
      if (focusZone === "dates") {
        if (focusIdx > 0) focusIdx--;
        else { focusZone = "controls"; focusIdx = controlButtons.length - 1; }
      } else if (focusZone === "records") {
        focusZone = "controls"; focusIdx = 0;
      } else if (focusZone === "controls") {
        if (focusIdx > 0) focusIdx--;
      }
      updateFocus();
    }
    // Flecha ABAJO (40)
    else if (code === 40) {
      if (focusZone === "dates") {
        if (recordItems.length > 0) { focusZone = "records"; focusIdx = 0; }
      } else if (focusZone === "records") {
        if (focusIdx < recordItems.length - 1) focusIdx++;
      }
      updateFocus();
    }
    // Flecha ARRIBA (38)
    else if (code === 38) {
      if (focusZone === "records") {
        if (focusIdx > 0) focusIdx--;
        else { focusZone = "dates"; focusIdx = 0; }
      }
      updateFocus();
    }
    // Tecla ENTER / OK (13)
    else if (code === 13) {
      if (focusZone === "controls") {
        handleAction(controlButtons[focusIdx].getAttribute("data-action"));
      } else if (focusZone === "dates") {
        var days = parseInt(dateButtons[focusIdx].getAttribute("data-days"), 10);
        loadRecords(days);
      } else if (focusZone === "records") {
        if (recordItems[focusIdx]) recordItems[focusIdx].click();
      }
    }
  });

  window.addEventListener("load", function () {
    controlButtons = Array.prototype.slice.call(document.querySelectorAll("#controls button"));
    dateButtons = Array.prototype.slice.call(document.querySelectorAll(".date-row button"));

    controlButtons.forEach(function (btn) {
      btn.addEventListener("click", function () { handleAction(this.getAttribute("data-action")); });
    });

    dateButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var days = parseInt(this.getAttribute("data-days"), 10);
        loadRecords(days);
      });
    });

    updateFocus();
    appendLog("ok", ["EZVIZ TV iniciado - webOS 6.0 listo"]);
    appendLog("info", ["Servidor configurado en: " + CONFIG.serverUrl]);
  });
})();
