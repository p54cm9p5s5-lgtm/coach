"""Da immagine con margini a icona quadrata a tutto sangue.

   L'icona che arriva è già disegnata con gli angoli tondi e appoggiata su un
   fondo chiaro. iOS però la maschera per conto suo: se le lascio gli angoli
   già tondi, sotto la maschera restano quattro spicchi di fondo chiaro. Quindi
   si ritaglia sul quadrato vero e si riempiono gli angoli col colore che c'è
   appena dentro l'arco — così la maschera di iOS taglia dentro il pieno.

   Nessuna libreria: PNG letto e riscritto a mano con zlib.
"""

import struct
import sys
import zlib


def leggi_png(percorso):
    d = open(percorso, "rb").read()
    assert d[:8] == b"\x89PNG\r\n\x1a\n", "non è un PNG"
    i = 8
    idat = bytearray()
    larghezza = altezza = colore = 0
    while i < len(d):
        (n,) = struct.unpack(">I", d[i : i + 4])
        tipo = d[i + 4 : i + 8]
        dati = d[i + 8 : i + 8 + n]
        if tipo == b"IHDR":
            larghezza, altezza, bit, colore, _, _, interlace = struct.unpack(">IIBBBBB", dati)
            assert bit == 8 and interlace == 0, "serve 8 bit non interlacciato"
            assert colore in (2, 6), "serve RGB o RGBA"
        elif tipo == b"IDAT":
            idat += dati
        elif tipo == b"IEND":
            break
        i += 12 + n

    canali = 4 if colore == 6 else 3
    grezzo = zlib.decompress(bytes(idat))
    riga_byte = larghezza * canali
    pixel = bytearray(altezza * riga_byte)
    prec = bytearray(riga_byte)
    p = 0
    for y in range(altezza):
        filtro = grezzo[p]
        p += 1
        riga = bytearray(grezzo[p : p + riga_byte])
        p += riga_byte
        for x in range(riga_byte):
            a = riga[x - canali] if x >= canali else 0
            b = prec[x]
            c = prec[x - canali] if x >= canali else 0
            v = riga[x]
            if filtro == 1:
                v += a
            elif filtro == 2:
                v += b
            elif filtro == 3:
                v += (a + b) // 2
            elif filtro == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                v += a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
            riga[x] = v & 0xFF
        pixel[y * riga_byte : (y + 1) * riga_byte] = riga
        prec = riga
    return larghezza, altezza, canali, pixel


def scrivi_png(percorso, larghezza, altezza, rgb):
    righe = bytearray()
    for y in range(altezza):
        righe.append(0)
        righe.extend(rgb[y * larghezza * 3 : (y + 1) * larghezza * 3])

    def blocco(tipo, dati):
        return (
            struct.pack(">I", len(dati))
            + tipo
            + dati
            + struct.pack(">I", zlib.crc32(tipo + dati) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += blocco(b"IHDR", struct.pack(">IIBBBBB", larghezza, altezza, 8, 2, 0, 0, 0))
    png += blocco(b"IDAT", zlib.compress(bytes(righe), 9))
    png += blocco(b"IEND", b"")
    open(percorso, "wb").write(png)


def main(sorgente, cartella):
    L, A, canali, px = leggi_png(sorgente)

    def pixel(x, y):
        i = (y * L + x) * canali
        return px[i], px[i + 1], px[i + 2]

    # Il fondo è il colore dell'angolo in alto a sinistra: tutto quello che se
    # ne discosta abbastanza è icona.
    fondo = pixel(0, 0)
    simile = lambda c: sum(abs(c[k] - fondo[k]) for k in range(3)) <= 40

    # Fondo NON vuol dire «di quel colore»: vuol dire «di quel colore e attaccato
    # al bordo». I riflessi sulla barra cromata sono quasi bianchi quanto il
    # fondo, e col solo confronto di colore finivano riempiti di rosso — la
    # barra veniva fuori tratteggiata. Si parte dai bordi e si allaga.
    fuori = bytearray(L * A)
    coda = []
    for x in range(L):
        for y in (0, A - 1):
            if simile(pixel(x, y)) and not fuori[y * L + x]:
                fuori[y * L + x] = 1
                coda.append((x, y))
    for y in range(A):
        for x in (0, L - 1):
            if simile(pixel(x, y)) and not fuori[y * L + x]:
                fuori[y * L + x] = 1
                coda.append((x, y))
    while coda:
        x, y = coda.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < L and 0 <= ny < A and not fuori[ny * L + nx] and simile(pixel(nx, ny)):
                fuori[ny * L + nx] = 1
                coda.append((nx, ny))
    lontano = lambda c: True  # compatibilità: la decisione ora la prende `fuori`
    dentro = lambda sx, sy: 0 <= sx < L and 0 <= sy < A and not fuori[sy * L + sx]

    xs, ys = [], []
    for y in range(A):
        for x in range(L):
            if dentro(x, y):
                xs.append(x)
                ys.append(y)
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    lato = max(x1 - x0 + 1, y1 - y0 + 1)
    # riquadro quadrato centrato sull'icona trovata
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    x0, y0 = cx - lato // 2, cy - lato // 2
    print(f"icona trovata: {lato}x{lato} px a partire da ({x0},{y0})")

    # Gli angoli.
    #
    # Cercare il colore «più vicino» pixel per pixel lungo la diagonale
    # produceva strisce: ogni pixel trovava una tinta leggermente diversa e il
    # risultato sembrava un tessuto. Ogni angolo qui è quasi in tinta unita,
    # quindi se ne prende UNA sola — la media di un quadratino preso appena
    # dentro l'arco, sulla diagonale — e si riempie con quella.
    def tinta_angolo(qx, qy):
        # qx, qy: -1 o +1, la direzione verso il centro
        px_, py_ = (0 if qx > 0 else lato - 1), (0 if qy > 0 else lato - 1)
        d = int(lato * 0.22)
        acc = [0, 0, 0]
        n = 0
        for oy in range(-6, 7):
            for ox in range(-6, 7):
                sx = x0 + px_ + qx * d + ox
                sy = y0 + py_ + qy * d + oy
                if not (0 <= sx < L and 0 <= sy < A):
                    continue
                if not dentro(sx, sy):
                    continue
                c = pixel(sx, sy)
                for k in range(3):
                    acc[k] += c[k]
                n += 1
        return tuple(v // n for v in acc) if n else fondo

    tinte = {
        (1, 1): tinta_angolo(1, 1),
        (-1, 1): tinta_angolo(-1, 1),
        (1, -1): tinta_angolo(1, -1),
        (-1, -1): tinta_angolo(-1, -1),
    }

    quadro = bytearray(lato * lato * 3)
    riempiti = 0
    for y in range(lato):
        for x in range(lato):
            sx, sy = x0 + x, y0 + y
            if dentro(sx, sy):
                c = pixel(sx, sy)
            else:
                c = tinte[(1 if x < lato / 2 else -1, 1 if y < lato / 2 else -1)]
                riempiti += 1
            i = (y * lato + x) * 3
            quadro[i], quadro[i + 1], quadro[i + 2] = c
    print(f"angoli riempiti: {riempiti} pixel, quattro tinte piatte")

    def ridimensiona(dest_lato):
        out = bytearray(dest_lato * dest_lato * 3)
        scala = lato / dest_lato
        for y in range(dest_lato):
            sy0, sy1 = int(y * scala), max(int(y * scala) + 1, int((y + 1) * scala))
            for x in range(dest_lato):
                sx0, sx1 = int(x * scala), max(int(x * scala) + 1, int((x + 1) * scala))
                acc = [0, 0, 0]
                n = 0
                for sy in range(sy0, min(sy1, lato)):
                    for sx in range(sx0, min(sx1, lato)):
                        i = (sy * lato + sx) * 3
                        acc[0] += quadro[i]
                        acc[1] += quadro[i + 1]
                        acc[2] += quadro[i + 2]
                        n += 1
                i = (y * dest_lato + x) * 3
                for k in range(3):
                    out[i + k] = acc[k] // max(n, 1)
        return out

    for misura in (512, 192, 180, 120, 60):
        scrivi_png(f"{cartella}/icon-{misura}.png", misura, misura, ridimensiona(misura))
        print(f"icon-{misura}.png")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
