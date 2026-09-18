#!/usr/bin/env python3
"""L'app, più un GitHub finto sulla stessa origine — per provare la
sincronizzazione senza toccare il repository vero né usare un token vero.

    python3 tools/github-finto.py 8611 /percorso/deposito.json

Due processi con lo stesso file di deposito sono due dispositivi che parlano
con lo stesso repository: uno fa l'iPhone, l'altro il Mac. Risponde come
l'API dei contenuti di GitHub nelle parti che l'app usa: informazioni sul
repository, elenco della radice, lettura (sotto un mega il contenuto sta nella
risposta, sopra va chiesto «grezzo»), scrittura con lo sha obbligatorio per
sovrascrivere. Token accettato: «prova». Con «sola-lettura» il token vede ma
non scrive, per provare quel messaggio.
"""
import base64
import hashlib
import json
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PREFISSO = "/finto-github/repos/"
BLOCCO = threading.Lock()
UN_MEGA = 1024 * 1024


def leggi(deposito):
    try:
        return json.loads(Path(deposito).read_text())
    except (FileNotFoundError, ValueError):
        return {"file": {}, "privato": True}


def scrivi(deposito, stato):
    Path(deposito).write_text(json.dumps(stato))


class Gestore(SimpleHTTPRequestHandler):
    deposito = None

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, *args):
        pass

    def rispondi(self, codice, corpo, tipo="application/json"):
        dati = corpo if isinstance(corpo, bytes) else json.dumps(corpo).encode()
        self.send_response(codice)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(dati)))
        self.end_headers()
        self.wfile.write(dati)

    def api(self):
        if not self.path.startswith(PREFISSO):
            return None
        token = self.headers.get("Authorization", "").removeprefix("Bearer ").strip()
        if token not in ("prova", "sola-lettura"):
            return self.rispondi(401, {"message": "Bad credentials"}) or True
        resto = self.path[len(PREFISSO):].split("?")[0]
        pezzi = resto.split("/", 3)
        return pezzi, token

    def do_GET(self):
        a = self.api()
        if a is None:
            return super().do_GET()
        if a is True:
            return
        pezzi, token = a
        stato = leggi(self.deposito)
        if len(pezzi) == 2:
            return self.rispondi(200, {"private": stato.get("privato", True),
                                       "permissions": {"push": token == "prova", "pull": True}})
        nome = pezzi[3] if len(pezzi) > 3 else ""
        if nome == "":
            if not stato["file"]:
                return self.rispondi(404, {"message": "This repository is empty."})
            return self.rispondi(200, [{"name": n, "sha": f["sha"], "size": len(f["testo"])}
                                       for n, f in stato["file"].items()])
        f = stato["file"].get(nome)
        if not f:
            return self.rispondi(404, {"message": "Not Found"})
        if "raw" in self.headers.get("Accept", ""):
            return self.rispondi(200, f["testo"].encode(), "application/vnd.github.raw")
        grande = len(f["testo"]) > UN_MEGA
        return self.rispondi(200, {
            "name": nome, "sha": f["sha"],
            "encoding": "none" if grande else "base64",
            "content": "" if grande else base64.encodebytes(f["testo"].encode()).decode(),
        })

    def do_PUT(self):
        a = self.api()
        if a is None:
            return self.rispondi(405, {"message": "no"})
        if a is True:
            return
        pezzi, token = a
        if token != "prova":
            return self.rispondi(403, {"message": "Resource not accessible by personal access token"})
        nome = pezzi[3] if len(pezzi) > 3 else ""
        corpo = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        testo = base64.b64decode(corpo["content"]).decode()
        with BLOCCO:
            stato = leggi(self.deposito)
            vecchio = stato["file"].get(nome)
            if vecchio and corpo.get("sha") != vecchio["sha"]:
                return self.rispondi(409, {"message": f"{nome} does not match {corpo.get('sha')}"})
            if not vecchio and corpo.get("sha"):
                return self.rispondi(422, {"message": "sha wasn't supplied"})
            sha = hashlib.sha1(f"blob {len(testo)}\0{testo}".encode()).hexdigest()
            stato["file"][nome] = {"sha": sha, "testo": testo}
            scrivi(self.deposito, stato)
        return self.rispondi(201 if not vecchio else 200, {"content": {"name": nome, "sha": sha}})


def main():
    porta = int(sys.argv[1])
    Gestore.deposito = sys.argv[2]
    handler = partial(Gestore, directory=str(ROOT))
    print(f"http://127.0.0.1:{porta}/index.html  (deposito {sys.argv[2]})")
    ThreadingHTTPServer(("127.0.0.1", porta), handler).serve_forever()


if __name__ == "__main__":
    main()
