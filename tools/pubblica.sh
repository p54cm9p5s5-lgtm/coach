#!/bin/bash
# Pubblica l'app su GitHub Pages, dopo aver verificato che nel repository
# non finiscano dati personali.
#
# I controlli girano su quello che sta per essere pubblicato davvero, non su
# quello che git conosceva prima: i file nuovi vengono messi in staging PRIMA
# dei controlli, e se un controllo fallisce lo staging viene annullato e non
# si pubblica niente. È il caso che aveva fatto passare i dati la prima volta.
#
# Con --controlla esegue solo le verifiche e non pubblica: serve a provarle.
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
SOLO_CONTROLLI=0
MESSAGGIO="Aggiornamento app"

for arg in "$@"; do
  case "$arg" in
    --controlla) SOLO_CONTROLLI=1 ;;
    *) MESSAGGIO="$arg" ;;
  esac
done

# Se un controllo fallisce, lo staging torna com'era: nessun file resta
# preparato per errore.
annulla_staging() {
  git reset --quiet >/dev/null 2>&1 || true
}

errore() {
  annulla_staging
  echo
  echo "PUBBLICAZIONE ANNULLATA"
  echo "  $1"
  echo
  exit 1
}

# --- 0. metti in staging tutto quello che verrebbe pubblicato ------------------
# Da qui in poi i controlli usano l'indice (--cached): comprende i file nuovi,
# che con git ls-files e git grep semplici sarebbero invisibili.
git add -A

ESCLUDI=":!tools/pubblica.sh"

# --- 1. niente file personali fra quelli da pubblicare ------------------------
# L'elenco unisce due cose: quello che git già traccia (un file personale
# aggiunto a forza tempo fa resterebbe altrimenti invisibile) e quello che
# viene aggiunto adesso.
DA_PUBBLICARE="$( { git ls-files; git diff --cached --name-only; } | sort -u )"

if echo "$DA_PUBBLICARE" | grep -q "^_privato/"; then
  errore "Un file della cartella _privato è nel repository. Esegui: git rm -r --cached _privato"
fi

if echo "$DA_PUBBLICARE" | grep -qE "coach-backup-.*\.json|coach-dati-iniziali\.json|master brief|seed\.py"; then
  echo "  file coinvolti:"
  echo "$DA_PUBBLICARE" | grep -E "coach-backup-.*\.json|coach-dati-iniziali\.json|master brief|seed\.py" | head -5
  errore "Un file di dati personali è nel repository. Toglilo prima di pubblicare."
fi

# --- 2. nessuna immagine incorporata (le foto sono data URL) ------------------
# lo script stesso è escluso: contiene i modelli da cercare, non i dati
if git grep --cached -qI "data:image/[a-z]\+;base64" -- . "$ESCLUDI" 2>/dev/null; then
  echo "  file coinvolti:"
  git grep --cached -lI "data:image/[a-z]\+;base64" -- . "$ESCLUDI" | head -5
  errore "Un file contiene un'immagine incorporata: potrebbe essere una foto personale."
fi

# --- 3. parole vietate --------------------------------------------------------
if [ -f "$VIETATE" ]; then
  TROVATE=0
  RIGHE_LETTE=0
  while IFS= read -r riga || [ -n "$riga" ]; do
    case "$riga" in ''|'#'*) continue ;; esac
    RIGHE_LETTE=$((RIGHE_LETTE + 1))
    # -F: la parola è testo letterale, non un'espressione regolare. Un carattere
    # speciale scritto per sbaglio faceva fallire la ricerca in silenzio, e la
    # parola risultava «non trovata» senza esserlo mai stata cercata davvero.
    if git grep --cached -nIF -- "$riga" -- . "$ESCLUDI" >/dev/null 2>&1; then
      echo "  trovato: $riga"
      git grep --cached -nIF -- "$riga" -- . "$ESCLUDI" | head -3
      TROVATE=1
    fi
  done < "$VIETATE"
  if [ "$RIGHE_LETTE" -eq 0 ]; then
    errore "$VIETATE non contiene nessuna parola da controllare: verifica il file."
  fi
  [ "$TROVATE" -eq 1 ] && errore "Dati personali nei file da pubblicare (elenco sopra)."
  echo "Parole vietate controllate: $RIGHE_LETTE"
else
  errore "$VIETATE non trovato: senza l'elenco delle parole vietate non si pubblica."
fi

echo "Controlli superati: nessun dato personale fra i file da pubblicare."

if [ "$SOLO_CONTROLLI" -eq 1 ]; then
  annulla_staging
  echo "Solo controlli richiesti: niente è stato pubblicato."
  exit 0
fi

# --- 4. impronta della versione ----------------------------------------------
# Cambia VERSION in sw.js a ogni pubblicazione: garantisce che i telefoni
# scarichino la nuova versione invece di restare sulla cache.
IMPRONTA="$(date +%Y%m%d-%H%M%S)"
sed -i '' "s/^const VERSION = .*/const VERSION = \"$IMPRONTA\";/" sw.js
echo "Versione pubblicata: $IMPRONTA"

# --- 5. pubblicazione ---------------------------------------------------------
git add -A
if [ -n "$(git diff --cached --name-only)" ]; then
  git commit -m "$MESSAGGIO"
fi

git push -u origin main

echo
echo "Fatto. Fra un minuto l'app è qui:"
echo "  https://${UTENTE}.github.io/${REPO}/"
echo
echo "Se è la prima volta, attiva le Pages:"
echo "  github.com/${UTENTE}/${REPO} → Settings → Pages"
echo "  Source: Deploy from a branch · Branch: main · Cartella: / (root) · Save"
