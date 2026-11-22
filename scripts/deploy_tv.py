import json
import subprocess
import sys

def main():
    payload = json.dumps({"id": "com.sergio.ezviztv.test", "ipkUrl": "/tmp/app.ipk", "subscribe": False})
    # Run luna-send on TV with the exact payload
    cmd = ["ares-shell", "-d", "tv50", "-r", f"luna-send -n 1 -f palm://com.webos.appInstallService/dev/install '{payload}'"]
    print("Running:", " ".join(cmd))
    res = subprocess.run(cmd, capture_output=True, text=True, shell=True)
    print("STDOUT:", res.stdout)
    print("STDERR:", res.stderr)

if __name__ == "__main__":
    main()
