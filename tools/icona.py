#!/usr/bin/env python3
"""Prepara l'icona dell'app da un'immagine PNG, senza dipendenze esterne.

Le icone iOS vanno a filo: niente margini, niente angoli arrotondati, niente
trasparenza — la maschera la applica il sistema. Un'icona già smussata, messa
dentro la maschera di iOS, mostra un doppio angolo.

Qui il margine viene ritagliato e gli angoli arrotondati vengono riempiti
estendendo il colore del pixel opaco più vicino sulla stessa riga: il risultato
prolunga il verde e il nero fin dentro gli spigoli, invece di inventare un colore.
"""
import struct
import sys
import zlib
from pathlib import Path


def leggi_png(percorso):
    dati = Path(percorso).read_bytes()
    if dati[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit("Non è un file PNG.")

    i, idat, info = 8, b"", None
    while i < len(dati):
        (lung,) = struct.unpack(">I", dati[i : i + 4])
        tag = dati[i + 4 : i + 8]
        corpo = dati[i + 8 : i + 8 + lung]
        if tag == b"IHDR":
            larg, alt, prof, tipo, comp, filtro, interlacciato = struct.unpack(">IIBBBBB", corpo)
            info = (larg, alt, prof, tipo, interlacciato)
        elif tag == b"IDAT":
            idat += corpo
        elif tag == b"IEND":
            break
        i += 12 + lung

    larg, alt, prof, tipo, interlacciato = info
    if prof != 8 or interlacciato or tipo not in (2, 6):
        raise SystemExit(f"PNG non gestito (profondità {prof}, tipo {tipo}, interlacciato {interlacciato}).")

    canali = 4 if tipo == 6 else 3
    grezzo = zlib.decompress(idat)
    passo = larg * canali

    pixel = bytearray(alt * passo)
    precedente = bytearray(passo)
    pos = 0
    for y in range(alt):
        filtro = grezzo[pos]
        pos += 1
        riga = bytearray(grezzo[pos : pos + passo])
        pos += passo
        for x in range(passo):
            a = riga[x - canali] if x >= canali else 0
            b = precedente[x]
            c = precedente[x - canali] if x >= canali else 0
            if filtro == 1:
                riga[x] = (riga[x] + a) & 0xFF
            elif filtro == 2:
                riga[x] = (riga[x] + b) & 0xFF
            elif filtro == 3:
                riga[x] = (riga[x] + (a + b) // 2) & 0xFF
            elif filtro == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                riga[x] = (riga[x] + pr) & 0xFF
        pixel[y * passo : (y + 1) * passo] = riga
        precedente = riga

    return larg, alt, canali, pixel


def scrivi_png(percorso, larg, alt, rgb):
    raw = b"".join(b"\x00" + bytes(rgb[y * larg * 3 : (y + 1) * larg * 3]) for y in range(alt))

    def blocco(tag, corpo):
        return struct.pack(">I", len(corpo)) + tag + corpo + struct.pack(">I", zlib.crc32(tag + corpo) & 0xFFFFFFFF)

    out = b"\x89PNG\r\n\x1a\n"
    out += blocco(b"IHDR", struct.pack(">IIBBBBB", larg, alt, 8, 2, 0, 0, 0))
    out += blocco(b"IDAT", zlib.compress(raw, 9))
    out += blocco(b"IEND", b"")
    Path(percorso).write_bytes(out)


def main():
    sorgente = sys.argv[1]
    destinazione = sys.argv[2] if len(sys.argv) > 2 else "icona-piena.png"

    larg, alt, canali, pixel = leggi_png(sorgente)
    print(f"origine: {larg}×{alt}, {canali} canali")

    def campiona(x, y):
        i = (y * larg + x) * canali
        r, g, b = pixel[i], pixel[i + 1], pixel[i + 2]
        a = pixel[i + 3] if canali == 4 else 255
        return r, g, b, a

    # Un pixel è "margine" se trasparente oppure quasi bianco.
    def margine(x, y):
        r, g, b, a = campiona(x, y)
        return a < 24 or (r > 244 and g > 244 and b > 244)

    ang = campiona(0, 0)
    print(f"angolo in alto a sinistra: rgba{ang} → {'margine' if margine(0, 0) else 'contenuto'}")

    # riquadro del contenuto
    x0, y0, x1, y1 = larg, alt, -1, -1
    for y in range(alt):
        for x in range(larg):
            if not margine(x, y):
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
    print(f"contenuto: da ({x0},{y0}) a ({x1},{y1}) — {x1 - x0 + 1}×{y1 - y0 + 1}")

    lato = min(x1 - x0 + 1, y1 - y0 + 1)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    sx, sy = cx - lato // 2, cy - lato // 2

    # ritaglia e riempi gli angoli con il pixel opaco più vicino sulla riga
    fuori = 0
    out = bytearray(lato * lato * 3)
    for y in range(lato):
        riga_src = sy + y
        # estremi opachi della riga
        sinistra = None
        destra = None
        for x in range(lato):
            if not margine(sx + x, riga_src):
                if sinistra is None:
                    sinistra = x
                destra = x
        for x in range(lato):
            if sinistra is None:
                r, g, b = 0, 0, 0
            elif x < sinistra:
                r, g, b, _ = campiona(sx + sinistra, riga_src); fuori += 1
            elif x > destra:
                r, g, b, _ = campiona(sx + destra, riga_src); fuori += 1
            else:
                r, g, b, _ = campiona(sx + x, riga_src)
            i = (y * lato + x) * 3
            out[i], out[i + 1], out[i + 2] = r, g, b

    scrivi_png(destinazione, lato, lato, out)
    print(f"scritta {destinazione}: {lato}×{lato}, {fuori} pixel di bordo riempiti per estensione")


if __name__ == "__main__":
    main()
