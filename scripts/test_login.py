"""Script interactivo de validación rápida (Fail-Fast) contra EZVIZ Cloud API.

No guarda contraseña en disco. Solicita usuario y contraseña por teclado,
inicia sesión en el servidor regional (por defecto apiisa.ezvizlife.com),
soporta 2FA/MFA y guarda solo el token temporal en token.local.json (ignorado por Git)
para no repetir 2FA en cada prueba.
"""

from __future__ import annotations

import getpass
import json
from pathlib import Path
import sys
from pyezvizapi import EzvizClient
from pyezvizapi.exceptions import EzvizAuthVerificationCode

TOKEN_FILE = Path(__file__).resolve().parent.parent / "token.local.json"


def main() -> int:
    print("=== Test Login EZVIZ (Vía B / pyezvizapi) ===")

    client = None
    if TOKEN_FILE.exists():
        use_saved = input("Se encontró token.local.json. ¿Reutilizar sesión? [S/n]: ").strip().lower()
        if use_saved in ("", "s", "si", "y", "yes"):
            token_data = json.loads(TOKEN_FILE.read_text(encoding="utf-8"))
            client = EzvizClient(token=token_data)

    if client is None:
        account = input("Usuario EZVIZ (email o teléfono con +código país): ").strip()
        if not account:
            print("Error: usuario vacío.")
            return 1

        password = getpass.getpass("Contraseña EZVIZ (oculta): ")
        if not password:
            print("Error: contraseña vacía.")
            return 1

        region = input("Dominio regional [Enter para apiisa.ezvizlife.com]: ").strip()
        if not region:
            region = "apiisa.ezvizlife.com"

        client = EzvizClient(account=account, password=password, url=region)

        print(f"\nConectando a {region}...")
        try:
            token_info = client.login()
        except EzvizAuthVerificationCode:
            print("EZVIZ solicitó verificación en 2 pasos (2FA) y envió un código a tu email/SMS.")
            code = ""
            while not code:
                code = input("Ingresá el código recibido (o 'q' para salir): ").strip()
                if code.lower() == "q":
                    return 1
            token_info = client.login(sms_code=code)
        except Exception as exc:
            print(f"Error al iniciar sesión: {type(exc).__name__}: {exc}")
            return 1

        print("Login exitoso.")
        try:
            exported = client.export_token()
            if exported:
                TOKEN_FILE.write_text(json.dumps(exported, indent=2), encoding="utf-8")
                print(f"Sesión guardada en {TOKEN_FILE.name} (ignorado por Git).")
        except Exception as exc:
            print(f"Aviso: no se pudo guardar token.local.json ({exc}).")

    print("\nConsultando cámaras vinculadas...")
    cameras = client.load_cameras()
    if not cameras:
        print("No se encontraron cámaras en esta cuenta/región.")
        return 0

    print(f"Cámaras encontradas: {len(cameras)}\n")
    for serial, cam in cameras.items():
        print(f"- Serial: {serial}")
        print(f"  Nombre: {cam.get('name')}")
        print(f"  Modelo: {cam.get('device_sub_category') or cam.get('device_category')}")
        print(f"  Online: {cam.get('status')} | IP local: {cam.get('local_ip')} | Cifrado: {cam.get('is_encrypted')}")
        print(f"  Firmware: {cam.get('version')}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
