#!/bin/bash
# Pubblica l'app su GitHub Pages, dopo aver verificato che nel repository
# non finiscano dati personali.
#
# La prima volta il Terminale chiede utente e password: come password si incolla
# un token generato su GitHub (Settings → Developer settings → Personal access
# tokens → Fine-grained, permesso "Contents: read and write" sul repo coach).
# Da lì in poi macOS lo tiene nel Portachiavi e non lo chiede più.

set -e
cd "$(dirname "$0")/.."

UTENTE="p54cm9p5s5-lgtm"
REPO="coach"
VIETATE="_privato/parole-vietate.txt"

errore() {
  echo
  echo "PUBBLICAZIONE ANNULLATA"
  echo "  $1"
  echo
  exit 1
}

# --- 1. niente file personali tracciati ---------------------------------------
if git ls-files | grep -q "^_privato/"; then
  errore "La cartella _privato è tracciata da git. Esegui: git rm -r --cached _privato"
fi

if git ls-files | grep -qE "coach-backup-.*\.json|coach-dati-iniziali\.json|master brief"; then
  errore "Un file di dati personali è tracciato da git. Toglilo prima di pubblicare."
fi

# --- 2. nessuna immagine incorporata (le foto sono data URL) ------------------
# lo script stesso è escluso: contiene i modelli da cercare, non i dati
ESCLUDI=":!tools/pubblica.sh"
if git grep -qI "data:image/[a-z]\+;base64" -- . "$ESCLUDI" 2>/dev/null; then
  errore "Un file contiene un'immagine incorporata: potrebbe essere una foto personale."
fi

# --- 3. parole vietate --------------------------------------------------------
if [ -f "$VIETATE" ]; then
  TROVATE=0
  while IFS= read -r riga; do
    case "$riga" in ''|'#'*) continue ;; esac
    if git grep -nIE "$riga" -- . "$ESCLUDI" >/dev/null 2>&1; then
      echo "  trovato: $riga"
      git grep -nIE "$riga" -- . "$ESCLUDI" | head -3
      TROVATE=1
    fi
  done < "$VIETATE"
  [ "$TROVATE" -eq 1 ] && errore "Dati personali nei file da pubblicare (elenco sopra)."
else
  echo "Nota: $VIETATE non trovato, controllo delle parole vietate saltato."
fi

echo "Controlli superati: nessun dato personale nei file tracciati."

# --- 4. pubblicazione ---------------------------------------------------------
if [ -n "$(git status --porcelain)" ]; then
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
