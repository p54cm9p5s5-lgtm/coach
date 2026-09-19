#!/bin/bash
# Genera le icone dell'app da un'immagine PNG.
#   uso: tools/icona-da-immagine.sh percorso/immagine.png
#
# icona-da-immagine.py ritaglia il margine e riempie gli angoli arrotondati
# estendendo il colore adiacente: le icone iOS vanno a filo, la maschera la
# mette il sistema. Scrive lui tutte le misure; qui si tengono le tre che il
# manifest e iOS usano.
#
# Fino al 19/09 questo file chiamava icona.py, che dal 26/08 è un'altra cosa
# (disegna l'anello, e prende una cartella): lo script si fermava con un
# errore e non generava niente.

set -e
cd "$(dirname "$0")/.."

SORGENTE="${1:-$HOME/Downloads/icona-coach-originale.png}"
[ -f "$SORGENTE" ] || { echo "Non trovo l'immagine: $SORGENTE"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

python3 tools/icona-da-immagine.py "$SORGENTE" "$TMP" >/dev/null

mkdir -p icons
for LATO in 180 192 512; do
  cp "$TMP/icon-${LATO}.png" "icons/icon-${LATO}.png"
  printf "icon-%s.png  %s\n" "$LATO" "$(du -h "icons/icon-${LATO}.png" | cut -f1)"
done

echo
echo "Fatto. iOS tiene in cache l'icona di un'app già sulla Home:"
echo "per vederla cambiata va rimossa dalla Home e reinstallata."
