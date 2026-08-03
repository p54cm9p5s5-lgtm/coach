#!/usr/bin/env python3
"""Server statico per lo sviluppo, senza cache.

Il server standard di Python lascia che il browser tenga i moduli in cache:
in sviluppo significa non vedere le modifiche appena fatte.
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class SenzaCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass


def main():
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    handler = partial(SenzaCache, directory=str(ROOT))
    print(f"http://127.0.0.1:{porta}/index.html  (cartella {ROOT})")
    ThreadingHTTPServer(("127.0.0.1", porta), handler).serve_forever()


if __name__ == "__main__":
    main()
