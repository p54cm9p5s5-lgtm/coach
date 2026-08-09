#!/usr/bin/env python3
"""Passa i file personali all'iPhone via rete locale, aggirando iCloud.

Serve solo i due file indicati, forzandone il download invece della
visualizzazione.

Sono file personali su una rete condivisa, quindi due protezioni che prima
erano affidate alla memoria di chi lo lancia («tienilo acceso pochi minuti»):

  - l'indirizzo contiene una chiave casuale, diversa a ogni avvio: senza
    quella si riceve 404, e chi passa sulla stessa Wi-Fi non trova niente
    nemmeno indovinando la porta;
  - il server si spegne da solo dopo DURATA_MINUTI, anche se ci si dimentica.
"""
import http.server
import secrets
import socket
import subprocess
import sys
import threading
from pathlib import Path
from urllib.parse import quote, unquote

PRIVATO = Path(__file__).resolve().parent.parent / "_privato"
FILE = {
    "dati.json": PRIVATO / "coach-dati-iniziali.json",
    "brief.md": PRIVATO / "master brief coaching.md",
}
PORTA = 8899
DURATA_MINUTI = 10
CHIAVE = secrets.token_urlsafe(9)


class Consegna(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # La query non fa parte del nome del file: «/dati.json?x=1» è la stessa
        # richiesta di «/dati.json», e senza toglierla finiva in un 404.
        percorso_pulito = unquote(self.path.split("?", 1)[0]).lstrip("/")
        parti = percorso_pulito.split("/", 1)
        if not parti or not secrets.compare_digest(parti[0], CHIAVE):
            # Nessun indizio a chi non ha la chiave: la stessa risposta sia che
            # la chiave sia sbagliata sia che il file non esista.
            self.send_error(404, "File non disponibile")
            return
        nome = parti[1] if len(parti) > 1 else ""
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
    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORTA), Consegna)
    print(f"Dall'iPhone, stessa Wi-Fi, apri:  http://{ip}:{PORTA}/{CHIAVE}/")
    print(f"Si spegne da solo fra {DURATA_MINUTI} minuti. Ctrl-C per spegnerlo prima.\n", flush=True)

    def spegni():
        print(f"\nPassati {DURATA_MINUTI} minuti: spengo. I file non sono più raggiungibili.", flush=True)
        threading.Thread(target=server.shutdown, daemon=True).start()

    threading.Timer(DURATA_MINUTI * 60, spegni).start()
    try:
        server.serve_forever()
    finally:
        server.server_close()
