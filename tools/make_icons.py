#!/usr/bin/env python3
"""Genera le icone PNG dell'app senza dipendenze esterne (solo zlib).

Disegna un bilanciere bianco su fondo scuro, con anti-aliasing per
supersampling 4x. Le icone iOS sono full-bleed: niente trasparenza,
gli angoli li smussa il sistema.
"""
import struct
import zlib
from pathlib import Path

BG = (17, 18, 20)
FG = (245, 245, 247)
SS = 4  # supersampling

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"


def barbell_mask(x, y, size):
    """True se il punto (in coordinate 0..size) cade sul bilanciere."""
    u = x / size
    v = y / size

    # barra centrale
    if 0.16 <= u <= 0.84 and 0.465 <= v <= 0.535:
        return True

    # dischi interni (grandi)
    for cu in (0.285, 0.715):
        if abs(u - cu) <= 0.055 and 0.30 <= v <= 0.70:
            return True

    # dischi esterni (piccoli)
    for cu in (0.395, 0.605):
        if abs(u - cu) <= 0.042 and 0.365 <= v <= 0.635:
            return True

    # fermi alle estremità
    for cu in (0.185, 0.815):
        if abs(u - cu) <= 0.030 and 0.405 <= v <= 0.595:
            return True

    return False


def render(size):
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            hits = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = px + (sx + 0.5) / SS
                    y = py + (sy + 0.5) / SS
                    if barbell_mask(x, y, size):
                        hits += 1
            a = hits / (SS * SS)
            for c in range(3):
                row.append(round(BG[c] * (1 - a) + FG[c] * a))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)
    return len(png)


def main():
    OUT.mkdir(exist_ok=True)
    for size in (180, 192, 512):
        rows = render(size)
        n = write_png(OUT / f"icon-{size}.png", size, rows)
        print(f"icon-{size}.png  {n // 1024} KB")


if __name__ == "__main__":
    main()
