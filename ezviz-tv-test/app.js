(function () {
  "use strict";

  // === 1. CONFIGURACIÓN DE PRUEBA (no subir con credenciales reales) ===
  var CONFIG = {
    accessToken: "PEGAR_ACCESS_TOKEN_AQUI",
    areaDomain: "https://isaopen.ezvizlife.com",
    liveUrl: "ezopen://CODIGO_VERIFICACION@open.ys7.com/SERIAL_CAMARA/1.live",
    recUrl: "ezopen://CODIGO_VERIFICACION@open.ys7.com/SERIAL_CAMARA/1.rec?begin=20261119120000&end=20261119120500"
  };

  var player = null;
  var buttons = [];
  var focusIndex = 0;
  var logPanel = document.getElementById("log-panel");
  var statusBar = document.getElementById("status-bar");

  // === 2. CONSOLA EN PANTALLA ===
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
    line.textContent = "[" + ts + "] [" + level.toUpperCase() + "] " + text;
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

  window.addEventListener("unhandledrejection", function (ev) {
    appendLog("error", ["PROMISE REJECTED:", ev.reason]);
  });

  // === 3. DIAGNÓSTICO DE CHROMIUM 79 ===
  function runDiagnostics() {
    appendLog("ok", ["--- Diagnóstico webOS 6.0 ---"]);
    console.log("UA:", navigator.userAgent);
    console.log("Origin:", window.location.origin, "| Protocol:", window.location.protocol);
    console.log("WebAssembly:", typeof WebAssembly === "object");
    console.log("SharedArrayBuffer:", typeof SharedArrayBuffer !== "undefined");
    console.log("EZUIKit global:", typeof window.EZUIKit, "| EZUIKitPlayer:", typeof window.EZUIKitPlayer);

    if (window.MediaSource && typeof MediaSource.isTypeSupported === "function") {
      console.log("MSE H.264:", MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'));
      console.log("MSE H.265:", MediaSource.isTypeSupported('video/mp4; codecs="hvc1.1.6.L93.B0"'));
    } else {
      console.warn("MediaSource API no disponible");
    }
  }

  setInterval(function () {
    var ramText = "--";
    if (window.performance && performance.memory) {
      ramText = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024)) + " MB";
    }
    statusBar.textContent = (player ? "Reproduciendo" : "Detenido") + " | RAM JS: " + ramText;
  }, 5000);

  // === 4. CONTROL DEL REPRODUCTOR EZUIKIT-JS ===
  function getPlayerConstructor() {
    if (window.EZUIKit && window.EZUIKit.EZUIKitPlayer) return window.EZUIKit.EZUIKitPlayer;
    if (window.EZUIKitPlayer) return window.EZUIKitPlayer;
    return null;
  }

  function stopPlayer(callback) {
    if (!player) { if (callback) callback(); return; }
    console.log("Deteniendo reproductor...");
    try {
      var p = player.destroy ? player.destroy() : player.stop();
      player = null;
      if (p && typeof p.then === "function") {
        p.then(function () {
          document.getElementById("video-container").innerHTML = "";
          if (callback) callback();
        }).catch(function (err) {
          console.warn("Error al destruir player:", err);
          document.getElementById("video-container").innerHTML = "";
          if (callback) callback();
        });
      } else {
        document.getElementById("video-container").innerHTML = "";
        if (callback) callback();
      }
    } catch (e) {
      console.error("Excepción al detener:", e.message);
      player = null;
      document.getElementById("video-container").innerHTML = "";
      if (callback) callback();
    }
  }

  function startStream(url, label) {
    var PlayerCtor = getPlayerConstructor();
    if (!PlayerCtor) {
      console.error("No se encontró EZUIKitPlayer. Verificá lib/ezuikit.js");
      return;
    }
    stopPlayer(function () {
      appendLog("ok", ["Iniciando " + label + "..."]);
      console.log("URL:", url);
      try {
        player = new PlayerCtor({
          id: "video-container",
          accessToken: CONFIG.accessToken,
          url: url,
          width: 1280,
          height: 720,
          autoplay: true,
          env: { domain: CONFIG.areaDomain },
          handleSuccess: function () { appendLog("ok", ["Stream iniciado correctamente (" + label + ")"]); },
          handleError: function (err) { console.error("EZUIKit handleError:", err); }
        });
      } catch (e) {
        console.error("Error al instanciar EZUIKitPlayer:", e.message, e.stack);
      }
    });
  }

  // === 5. NAVEGACIÓN CON CONTROL REMOTO ===
  function updateFocus() {
    for (var i = 0; i < buttons.length; i++) {
      if (i === focusIndex) { buttons[i].classList.add("focused"); buttons[i].focus(); }
      else { buttons[i].classList.remove("focused"); }
    }
  }

  function executeAction(action) {
    if (action === "live") startStream(CONFIG.liveUrl, "EN VIVO");
    else if (action === "rec") startStream(CONFIG.recUrl, "microSD");
    else if (action === "stop") stopPlayer(function () { console.log("Reproductor detenido."); });
    else if (action === "clear") { logPanel.innerHTML = ""; appendLog("ok", ["Log limpiado."]); }
  }

  document.addEventListener("keydown", function (ev) {
    var code = ev.keyCode;
    if (code === 37) { focusIndex = (focusIndex - 1 + buttons.length) % buttons.length; updateFocus(); }
    else if (code === 39) { focusIndex = (focusIndex + 1) % buttons.length; updateFocus(); }
    else if (code === 13) { executeAction(buttons[focusIndex].getAttribute("data-action")); }
    else if (code === 49) { executeAction("live"); }
    else if (code === 50) { executeAction("rec"); }
    else if (code === 51) { executeAction("stop"); }
    else if (code === 52) { executeAction("clear"); }
    else if (code === 461) {
      stopPlayer(function () {
        if (window.webOSSystem && window.webOSSystem.platformBack) window.webOSSystem.platformBack();
        else window.close();
      });
    }
  });

  window.addEventListener("load", function () {
    buttons = Array.prototype.slice.call(document.querySelectorAll("#controls button"));
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener("click", function () { executeAction(this.getAttribute("data-action")); });
    }
    updateFocus();
    runDiagnostics();
  });
})();
