#!/bin/bash
# Genera le icone dell'app da un'immagine PNG.
#   uso: tools/icona-da-immagine.sh percorso/immagine.png
#
# icona.py ritaglia il margine e riempie gli angoli arrotondati estendendo il
# colore adiacente: le icone iOS vanno a filo, la maschera la mette il sistema.
# sips (già su macOS) si occupa solo del ridimensionamento.

set -e
cd "$(dirname "$0")/.."

SORGENTE="${1:-$HOME/Downloads/icona-coach-originale.png}"
[ -f "$SORGENTE" ] || { echo "Non trovo l'immagine: $SORGENTE"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

python3 tools/icona.py "$SORGENTE" "$TMP/piena.png"

mkdir -p icons
for LATO in 180 192 512; do
  sips -z "$LATO" "$LATO" "$TMP/piena.png" --out "icons/icon-${LATO}.png" >/dev/null
  printf "icon-%s.png  %s\n" "$LATO" "$(du -h "icons/icon-${LATO}.png" | cut -f1)"
done

echo
echo "Fatto. iOS tiene in cache l'icona di un'app già sulla Home:"
echo "per vederla cambiata va rimossa dalla Home e reinstallata."
