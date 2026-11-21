"""Servidor intermediario local (Vía B) para Visor-Ezviz (LG webOS 6.0).

Compatible con Windows ahora y portable a Raspberry Pi (Linux/Docker).
Provee:
- Listado de cámaras y consulta de grabaciones microSD vía pyezvizapi (token.local.json).
- Puente RTSP -> HLS (H.264/AAC) vía ffmpeg para reproducción nativa por hardware en LG <video>.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import time
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pyezvizapi import EzvizClient

ROOT_DIR = Path(__file__).resolve().parent.parent
TOKEN_FILE = ROOT_DIR / "token.local.json"
CAMERAS_LOCAL_FILE = ROOT_DIR / "cameras.local.json"
HLS_ROOT = Path(__file__).resolve().parent / "_hls"

app = FastAPI(title="Visor-Ezviz Local Proxy", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_ffmpeg_procs: dict[str, subprocess.Popen[bytes]] = {}


def _get_ezviz_client() -> EzvizClient:
    if not TOKEN_FILE.exists():
        raise HTTPException(
            status_code=503,
            detail="Falta token.local.json. Ejecutá scripts/test_login.py primero.",
        )
    token_data = json.loads(TOKEN_FILE.read_text(encoding="utf-8"))
    return EzvizClient(token=token_data)


def _load_local_codes() -> dict[str, dict[str, str]]:
    if not CAMERAS_LOCAL_FILE.exists():
        return {}
    return json.loads(CAMERAS_LOCAL_FILE.read_text(encoding="utf-8"))


def _stop_ffmpeg(serial: str) -> None:
    proc = _ffmpeg_procs.pop(serial, None)
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()


def _ensure_hls_stream(serial: str, rtsp_url: str) -> Path:
    cam_dir = HLS_ROOT / serial
    m3u8_path = cam_dir / "live.m3u8"

    proc = _ffmpeg_procs.get(serial)
    if proc and proc.poll() is None and m3u8_path.exists():
        return m3u8_path

    _stop_ffmpeg(serial)
    if cam_dir.exists():
        shutil.rmtree(cam_dir, ignore_errors=True)
    cam_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "warning",
        "-rtsp_transport",
        "tcp",
        "-i",
        rtsp_url,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        "-pix_fmt",
        "yuv420p",
        "-g",
        "50",
        "-c:a",
        "aac",
        "-ar",
        "44100",
        "-f",
        "hls",
        "-hls_time",
        "2",
        "-hls_list_size",
        "5",
        "-hls_flags",
        "delete_segments",
        str(m3u8_path),
    ]
    creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    log_file = open(cam_dir / "ffmpeg.log", "wb")
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=log_file,
        creationflags=creationflags,
    )
    _ffmpeg_procs[serial] = proc

    deadline = time.monotonic() + 20.0
    while time.monotonic() < deadline:
        if m3u8_path.exists() and m3u8_path.stat().st_size > 0:
            return m3u8_path
        if proc.poll() is not None:
            log_file.close()
            err = (cam_dir / "ffmpeg.log").read_text(encoding="utf-8", errors="replace")
            raise HTTPException(status_code=502, detail=f"ffmpeg finalizó: {err[:300]}")
        time.sleep(0.25)

    raise HTTPException(status_code=504, detail="Timeout esperando segmentos HLS de ffmpeg")


@app.on_event("shutdown")
def _shutdown() -> None:
    for serial in list(_ffmpeg_procs.keys()):
        _stop_ffmpeg(serial)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "has_token": TOKEN_FILE.exists(),
        "has_cameras_local": CAMERAS_LOCAL_FILE.exists(),
        "active_streams": [s for s, p in _ffmpeg_procs.items() if p.poll() is None],
    }


@app.get("/api/cameras")
def list_cameras() -> dict[str, Any]:
    client = _get_ezviz_client()
    cams = client.load_cameras()
    local_cfg = _load_local_codes()
    result = []
    for serial, cam in cams.items():
        result.append(
            {
                "serial": serial,
                "name": cam.get("name"),
                "model": cam.get("device_sub_category") or cam.get("device_category"),
                "online": cam.get("status") == 1,
                "local_ip": cam.get("local_ip"),
                "encrypted": bool(cam.get("encrypted")),
                "firmware": cam.get("version"),
                "rtsp_configured": serial in local_cfg,
                "hls_path": f"/api/stream/{serial}/live.m3u8",
            }
        )
    return {"cameras": result}


@app.get("/api/cameras/{serial}/records")
def list_records(
    serial: str,
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="Fecha YYYY-MM-DD"),
    size: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    client = _get_ezviz_client()
    start_time = f"{date} 00:00:00"
    stop_time = f"{date} 23:59:59"
    res = client.search_records(serial, 1, serial, start_time, stop_time, size=size)
    return {
        "serial": serial,
        "date": date,
        "records": res.get("records", []),
        "isFinished": res.get("isFinished"),
    }


@app.get("/api/stream/{serial}/live.m3u8")
def get_hls_playlist(serial: str) -> FileResponse:
    local_cfg = _load_local_codes()
    cam_cfg = local_cfg.get(serial)
    if not cam_cfg:
        raise HTTPException(
            status_code=404,
            detail=f"Falta configurar {serial} en cameras.local.json (ip y code).",
        )
    ip = cam_cfg["ip"]
    code = cam_cfg["code"]
    path = cam_cfg.get("rtsp_path", "/h264_stream")
    rtsp_url = f"rtsp://admin:{code}@{ip}:554{path}"
    m3u8_path = _ensure_hls_stream(serial, rtsp_url)
    return FileResponse(
        m3u8_path,
        media_type="application/vnd.apple.mpegurl",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/api/stream/{serial}/playback.m3u8")
def get_playback_playlist(
    serial: str,
    begin: str = Query(..., description="Inicio en formato ISO o YYYYMMDDTHHmmssZ"),
    end: str = Query(..., description="Fin en formato ISO o YYYYMMDDTHHmmssZ"),
) -> FileResponse:
    local_cfg = _load_local_codes()
    cam_cfg = local_cfg.get(serial)
    if not cam_cfg:
        raise HTTPException(
            status_code=404,
            detail=f"Falta configurar {serial} en cameras.local.json.",
        )
    ip = cam_cfg["ip"]
    code = cam_cfg["code"]
    
    # Formatear a sintaxis Hikvision/ISAPI: YYYYMMDDTHHmmssZ
    fmt_begin = begin.replace("-", "").replace(":", "")
    if not fmt_begin.endswith("Z"):
        fmt_begin += "Z"
    fmt_end = end.replace("-", "").replace(":", "")
    if not fmt_end.endswith("Z"):
        fmt_end += "Z"
        
    rtsp_url = f"rtsp://admin:{code}@{ip}:554/Streaming/tracks/101?starttime={fmt_begin}&endtime={fmt_end}"
    stream_key = f"{serial}_playback"
    m3u8_path = _ensure_hls_stream(stream_key, rtsp_url)
    return FileResponse(
        m3u8_path,
        media_type="application/vnd.apple.mpegurl",
        headers={"Cache-Control": "no-cache"},
    )


@app.get("/api/stream/{serial}/{segment}")
def get_hls_segment(serial: str, segment: str) -> FileResponse:
    if "/" in segment or "\\" in segment or ".." in segment:
        raise HTTPException(status_code=400, detail="Nombre de segmento inválido")
    seg_path = HLS_ROOT / serial / segment
    if not seg_path.exists():
        raise HTTPException(status_code=404, detail="Segmento no encontrado")
    return FileResponse(
        seg_path,
        media_type="video/mp2t",
        headers={"Cache-Control": "no-cache"},
    )


@app.post("/api/stream/{serial}/stop")
def stop_stream(serial: str) -> JSONResponse:
    _stop_ffmpeg(serial)
    _stop_ffmpeg(f"{serial}_playback")
    return JSONResponse({"stopped": serial})
