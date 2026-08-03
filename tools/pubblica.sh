#!/bin/bash
# Pubblica l'app su GitHub Pages.
# La prima volta il Terminale chiede utente e password: come password si incolla
# un token generato su GitHub (Settings → Developer settings → Personal access
# tokens → Fine-grained → accesso "Contents: read and write" sul repo coach).
# Da lì in poi macOS lo tiene nel Portachiavi e non lo chiede più.

set -e
cd "$(dirname "$0")/.."

UTENTE="p54cm9p5s5-lgtm"
REPO="coach"

if [ -n "$(git status --porcelain)" ]; then
  echo "Ci sono modifiche non salvate. Le includo nel commit."
  git add -A
  git commit -m "${1:-Aggiornamento app}"
fi

git push -u origin main

echo
echo "Fatto. Fra un minuto l'app è qui:"
echo "  https://${UTENTE}.github.io/${REPO}/"
echo
echo "Se è la prima volta, attiva le Pages:"
echo "  github.com/${UTENTE}/${REPO} → Settings → Pages"
echo "  Source: Deploy from a branch · Branch: main · Cartella: / (root) · Save"
