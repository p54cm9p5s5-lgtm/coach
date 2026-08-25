"""L'icona di Coach: l'anello del punteggio, disegnato a mano.

   Stessa grammatica della direzione «Referto»: fondo di carta calda, un arco
   d'inchiostro, la traccia grigia sotto. Nessun degradé, nessuna ombra,
   nessun rilievo — la stessa cosa che l'app mostra a schermo tutto il giorno.

   Niente librerie: si scrive il PNG a mano con zlib. Il cerchio si calcola
   per-pixel con 4x4 campioni, così il bordo è morbido come quello di un SVG.
"""

import math
import struct
import zlib

CARTA = (0xFA, 0xF9, 0xF6)
INCHIOSTRO = (0x10, 0x11, 0x13)
TRACCIA = (0xD9, 0xD6, 0xCD)

# Quanto dell'anello è pieno: 85%, come il punteggio nelle schermate.
# Non 100: l'app non finge mai di essere a posto.
QUOTA = 0.85
# Raggio e spessore in frazione del lato. Il margine tiene l'anello dentro la
# «zona sicura» dell'80% che Android ritaglia sulle icone mascherate.
RAGGIO = 0.315
SPESSORE = 0.088
SPESSORE_TRACCIA = 0.020
CAMPIONI = 4

# Il bilanciere è lo stesso disegno della scheda «Oggi» nella barra in basso:
# cinque segmenti su una griglia 24x24. Dentro l'anello diventa il secondo
# segno dell'app — la misura fuori, l'allenamento dentro.
BILANCIERE = [(3, 9, 3, 15), (6, 7, 6, 17), (18, 7, 18, 17), (21, 9, 21, 15), (6, 12, 18, 12)]
BILANCIERE_LATO = 0.455   # frazione del lato dell'icona
BILANCIERE_TRATTO = 2.6   # nella griglia 24x24


def dist_segmento(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    lung2 = vx * vx + vy * vy
    t = 0.0 if lung2 == 0 else max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / lung2))
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))


def colore_pixel(x, y, lato):
    """Media dei campioni: carta, traccia o inchiostro."""
    cx = cy = lato / 2
    r = RAGGIO * lato
    mezzo_arco = SPESSORE * lato / 2
    mezza_traccia = SPESSORE_TRACCIA * lato / 2
    acc = [0.0, 0.0, 0.0]
    passo = 1.0 / CAMPIONI
    for i in range(CAMPIONI):
        for j in range(CAMPIONI):
            px = x + (i + 0.5) * passo
            py = y + (j + 0.5) * passo
            dx, dy = px - cx, py - cy
            d = math.hypot(dx, dy)
            # L'angolo parte dalle 12 e gira in senso orario, come l'anello
            # dell'app (che ruota di -90° e disegna in avanti).
            ang = (math.degrees(math.atan2(dx, -dy))) % 360
            dentro_arco = abs(d - r) <= mezzo_arco and ang <= QUOTA * 360
            dentro_traccia = abs(d - r) <= mezza_traccia
            # il bilanciere, riportato dalla griglia 24x24 al centro dell'icona
            lato_g = BILANCIERE_LATO * lato
            gx = (px - (cx - lato_g / 2)) * 24 / lato_g
            gy = (py - (cy - lato_g / 2)) * 24 / lato_g
            mezzo_tratto = BILANCIERE_TRATTO / 2
            dentro_bilanciere = any(
                dist_segmento(gx, gy, *seg) <= mezzo_tratto for seg in BILANCIERE
            )
            c = (
                INCHIOSTRO
                if (dentro_arco or dentro_bilanciere)
                else (TRACCIA if dentro_traccia else CARTA)
            )
            for k in range(3):
                acc[k] += c[k]
    n = CAMPIONI * CAMPIONI
    return tuple(int(round(v / n)) for v in acc)


def scrivi_png(percorso, lato):
    righe = bytearray()
    for y in range(lato):
        righe.append(0)  # filtro «nessuno»
        for x in range(lato):
            righe.extend(colore_pixel(x, y, lato))

    def blocco(tipo, dati):
        return (
            struct.pack(">I", len(dati))
            + tipo
            + dati
            + struct.pack(">I", zlib.crc32(tipo + dati) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += blocco(b"IHDR", struct.pack(">IIBBBBB", lato, lato, 8, 2, 0, 0, 0))
    png += blocco(b"IDAT", zlib.compress(bytes(righe), 9))
    png += blocco(b"IEND", b"")
    with open(percorso, "wb") as f:
        f.write(png)
    return len(png)


if __name__ == "__main__":
    import sys

    cartella = sys.argv[1]
    for lato in (60, 120, 180, 192, 512):
        peso = scrivi_png(f"{cartella}/icon-{lato}.png", lato)
        print(f"icon-{lato}.png  {peso // 1024} kB")
