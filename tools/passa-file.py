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
from html import escape
from urllib.parse import quote, unquote

PRIVATO = Path(__file__).resolve().parent.parent / "_privato"
FILE = {
    "dati.json": PRIVATO / "coach-dati-iniziali.json",
    "brief.md": PRIVATO / "master brief coaching.md",
}
PORTA = 8899
DURATA_MINUTI = 10
CHIAVE = secrets.token_urlsafe(9)


def file_da_passare(argomenti):
    """I due file soliti, più quelli chiesti sulla riga di comando.

    Serve quando quello che devi mandare sul telefono NON è il brief in corso:
    per esempio il brief precedente, se quello nuovo è arrivato a settimana
    cominciata e ti servono ancora gli allenamenti vecchi. Prima l'unica strada
    era sovrascrivere la copia di lavoro, cioè perdere quella giusta.

    Il nome sul telefono è solo il nome del file, mai il percorso: da fuori non
    si deve poter indovinare dove stanno le cose su questo computer.
    """
    scelti = dict(FILE) if not argomenti else {}
    for a in argomenti:
        p = Path(a).expanduser().resolve()
        if not p.is_file():
            sys.exit(f"Non è un file: {a}")
        scelti[p.name] = p
    return scelti


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
        # I pacchetti per l'app si INCOLLANO, non si scaricano: la schermata di
        # import è un riquadro di testo. Scaricare il file e poi ripescarlo da
        # File per copiarne il contenuto è un giro inutile — qui il testo si
        # apre e si copia da lì.
        if nome.startswith("testo/"):
            return self.pagina_testo(nome[len("testo/"):])
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

    def pagina_testo(self, nome):
        """Il contenuto in un riquadro, pronto da copiare e incollare nell'app."""
        percorso = FILE.get(nome)
        if not percorso or not percorso.exists():
            self.send_error(404, "File non disponibile")
            return
        testo = percorso.read_text(encoding="utf-8", errors="replace")
        # Il tasto prova la via breve (gli appunti via JavaScript). Su http quella
        # via iOS non la concede, quindi il ripiego non è un messaggio d'errore ma
        # il testo già tutto selezionato: da lì bastano «Copia» e via.
        html = (
            '<meta name=viewport content="width=device-width,initial-scale=1">'
            "<style>body{font:16px -apple-system;margin:0;padding:16px;background:#08080a;color:#f4f4f2}"
            "textarea{width:100%;height:60vh;box-sizing:border-box;font:12px ui-monospace,monospace;"
            "background:#111;color:#ddd;border:1px solid #333;border-radius:10px;padding:10px}"
            "button{width:100%;min-height:52px;margin:12px 0;border:0;border-radius:12px;"
            "background:#b8ff4e;color:#0b0e06;font:600 17px -apple-system}"
            "p{color:#888;font-size:14px;line-height:1.4}</style>"
            f"<h3>{escape(percorso.name)}</h3>"
            '<button onclick="copia()">Copia tutto</button>'
            f'<textarea id="t" readonly>{escape(testo)}</textarea>'
            "<p id=esito>Poi apri Coach → Salute → Aggiorna → «Ho già copiato: incolla adesso».</p>"
            "<script>function copia(){var a=document.getElementById('t');"
            "a.focus();a.setSelectionRange(0,a.value.length);"
            "if(navigator.clipboard&&navigator.clipboard.writeText){"
            "navigator.clipboard.writeText(a.value).then(function(){"
            "document.getElementById('esito').textContent='Copiato. Apri Coach → Salute → Aggiorna → «Ho già copiato».';},"
            "function(){document.getElementById('esito').textContent='Ora tocca «Copia» nel menu che è comparso.';});"
            "}else{document.getElementById('esito').textContent='Ora tocca «Copia» nel menu che è comparso.';}}</script>"
        )
        corpo = html.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def indice(self):
        def voce(n, p):
            kb = p.stat().st_size // 1024
            testuale = p.suffix.lower() in (".txt", ".md", ".json")
            apri = (
                f'<a href="/{CHIAVE}/testo/{quote(n)}">apri e copia</a> · '
                if testuale
                else ""
            )
            return f'<li>{escape(p.name)} — {kb} KB<br>{apri}<a href="/{CHIAVE}/{quote(n)}" download>scarica</a></li>'

        voci = "".join(voce(n, p) for n, p in FILE.items() if p.exists())
        html = f"""<meta name=viewport content="width=device-width,initial-scale=1">
<style>body{{font:17px -apple-system;padding:24px;background:#08080a;color:#f4f4f2}}
a{{color:#b8ff4e;font-weight:600}} li{{margin:18px 0;line-height:1.6}}</style>
<h2>File per Coach</h2><ol>{voci}</ol>
<p style="color:#888;font-size:14px">«Apri e copia» per i pacchetti da incollare nell'app.
«Scarica» per i file che servono come file: finiscono in File → Download.</p>"""
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
    FILE = file_da_passare(sys.argv[1:])
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
