#!/usr/bin/env python3
"""Passa i file personali all'iPhone via rete locale, aggirando iCloud.

Serve solo i due file indicati, forzandone il download invece della
visualizzazione. Va tenuto acceso pochi minuti: i file sono personali e in
quel lasso di tempo sono raggiungibili da chiunque sia sulla stessa Wi-Fi.
"""
import http.server
import socket
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote, unquote

PRIVATO = Path(__file__).resolve().parent.parent / "_privato"
FILE = {
    "dati.json": PRIVATO / "coach-dati-iniziali.json",
    "brief.md": PRIVATO / "master brief coaching.md",
}
PORTA = 8899


class Consegna(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        nome = unquote(self.path.lstrip("/"))
        if nome in ("", "index.html"):
            return self.indice()
        percorso = FILE.get(nome)
        if not percorso or not percorso.exists():
            self.send_error(404, "File non disponibile")
            return
        dati = percorso.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Disposition", f'attachment; filename="{quote(percorso.name)}"')
        self.send_header("Content-Length", str(len(dati)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(dati)

    def indice(self):
        voci = "".join(
            f'<li><a href="/{n}" download>{p.name}</a> — {p.stat().st_size // 1024} KB</li>'
            for n, p in FILE.items()
            if p.exists()
        )
        html = f"""<meta name=viewport content="width=device-width,initial-scale=1">
<style>body{{font:17px -apple-system;padding:24px;background:#08080a;color:#f4f4f2}}
a{{color:#b8ff4e;font-weight:600}} li{{margin:18px 0}}</style>
<h2>File per Coach</h2><ol>{voci}</ol>
<p style="color:#888;font-size:14px">Tocca un file, poi «Scarica». Finiscono in File → Download.</p>"""
        corpo = html.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def log_message(self, formato, *args):
        print(f"  richiesta: {args[0]}", flush=True)


def indirizzo_locale():
    for interfaccia in ("en0", "en1"):
        try:
            ip = subprocess.check_output(["ipconfig", "getifaddr", interfaccia], text=True).strip()
            if ip:
                return ip
        except subprocess.CalledProcessError:
            continue
    return socket.gethostbyname(socket.gethostname())


if __name__ == "__main__":
    mancanti = [str(p) for p in FILE.values() if not p.exists()]
    if mancanti:
        sys.exit("File mancanti:\n  " + "\n  ".join(mancanti))
    ip = indirizzo_locale()
    print(f"Dall'iPhone, stessa Wi-Fi, apri:  http://{ip}:{PORTA}/")
    print("Ctrl-C per spegnere.\n", flush=True)
    http.server.ThreadingHTTPServer(("0.0.0.0", PORTA), Consegna).serve_forever()
