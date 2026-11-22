import http.server
import socketserver
import threading
import subprocess
import json
import time
import os

PORT = 8089
IPK_NAME = "com.sergio.ezviztv.test_0.1.2_all.ipk"
APP_ID = "com.sergio.ezviztv.test"
HOST_IP = "192.168.18.29"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist"), **kwargs)

def start_server():
    server = socketserver.TCPServer(("", PORT), Handler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    return server

def main():
    print(f"[*] Iniciando servidor temporal HTTP en puerto {PORT}...")
    server = start_server()
    time.sleep(1)

    try:
        download_url = f"http://{HOST_IP}:{PORT}/{IPK_NAME}"
        print(f"[*] Descargando {download_url} en la TV...")
        curl_cmd = f"curl -s -L {download_url} -o /tmp/app.ipk && ls -lh /tmp/app.ipk"
        res = subprocess.run(["ares-shell", "-d", "tv50", "-r", curl_cmd], capture_output=True, text=True, shell=True)
        print("TV Output:", res.stdout.strip() or res.stderr.strip())

        payload = json.dumps({"id": APP_ID, "ipkUrl": "/tmp/app.ipk", "subscribe": False})
        print(f"[*] Instalando paquete {APP_ID} en la TV...")
        install_cmd = f"luna-send -n 1 -f palm://com.webos.appInstallService/dev/install '{payload}'"
        res = subprocess.run(["ares-shell", "-d", "tv50", "-r", install_cmd], capture_output=True, text=True, shell=True)
        print("Install Output:", res.stdout.strip() or res.stderr.strip())

        time.sleep(2)
        print(f"[*] Lanzando la aplicación {APP_ID} en la TV...")
        res = subprocess.run(["ares-launch", "-d", "tv50", APP_ID], capture_output=True, text=True, shell=True)
        print("Launch Output:", res.stdout.strip() or res.stderr.strip())

    finally:
        server.shutdown()
        server.server_close()
        print("[*] Servidor HTTP cerrado.")

if __name__ == "__main__":
    main()
