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
# I file che finiranno sul sito: quelli già tracciati più quelli appena messi in
# preparazione, **meno quelli che si stanno togliendo**. Senza l'ultima parte,
# togliere un documento dal repository faceva fallire i controlli proprio sul
# file che si voleva far sparire: la cancellazione veniva letta come una cosa da
# pubblicare.
CANCELLATI="$(git diff --cached --name-only --diff-filter=D)"
DA_PUBBLICARE="$(
  { git ls-files; git diff --cached --name-only; } | sort -u \
    | { [ -n "$CANCELLATI" ] && grep -vxF "$CANCELLATI" || cat; }
)"

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

# --- 4. lista bianca: solo quello che l'app è --------------------------------
# I tre controlli sopra dicono cosa NON deve passare, e funzionano finché
# qualcuno ha immaginato la cosa da vietare. Un file nuovo — appunti, un export,
# le impostazioni di uno strumento, una chiave — non somiglia a niente di
# vietato e passa. Qui è il contrario: passa solo quello che l'app è fatta di, e
# qualunque altra cosa ferma la pubblicazione e viene stampata per nome.
#
# Se un giorno serve pubblicare qualcosa di nuovo, si aggiunge una riga qui: è
# una decisione, e va presa una volta, non subita a ogni pubblicazione.
#
# I documenti si elencano UNO PER UNO, non con «qualunque .md maiuscolo».
# Con la regola larga, un file chiamato DATI.md contenente «peso 84,5 kg»
# passava tutti e sei i controlli: la lista bianca lo accettava per il nome, le
# parole vietate non possono coprire parole comuni come «peso», e il controllo
# dei nomi personali qui sopra non lo vedeva nemmeno. Provato davvero, non
# immaginato. Un documento nuovo adesso ferma la pubblicazione finché qualcuno
# non decide di aggiungerlo a questa riga — che è esattamente il senso di una
# lista bianca.
#
# `|| true`: quando non c'è niente fuori lista l'ultimo grep esce con 1, e con
# `set -e` lo script moriva in silenzio proprio nel caso buono — un controllo
# che ferma tutto quando va tutto bene è peggio di nessun controllo.
# VERIFICA.md, ESITO.md e PIANO.md — il registro del controllo — sono usciti da
# qui il 14/08, per scelta sua: restano sul computer e nella storia del
# repository, ma non finiscono sul sito. Dentro non c'era niente di personale,
# ma pubblicarli era una decisione, non un automatismo.
DOCUMENTI='^(README|SPEC|COME-FUNZIONA|ISTRUZIONI-BRIEF)\.md$'
FUORI_LISTA="$(
  echo "$DA_PUBBLICARE" | grep -vE '^(index\.html|sw\.js|manifest\.webmanifest|robots\.txt|\.nojekyll|\.gitignore)$' \
    | grep -vE "$DOCUMENTI" \
    | grep -vE '^(css|js|data|icons|tools)/' \
    | grep -vE '^\.claude/launch\.json$' \
    | grep -v '^$' || true
)"

if [ -n "$FUORI_LISTA" ]; then
  echo "  file fuori dalla lista di quello che l'app pubblica:"
  echo "$FUORI_LISTA" | head -10
  errore "C'è roba che non fa parte dell'app fra i file da pubblicare (elenco sopra). Toglila, oppure aggiungila alla lista bianca in tools/pubblica.sh se è davvero dell'app."
fi

echo "Lista bianca: nessun file estraneo all'app."

# --- 5. nessun file dell'app fuori dalla copia locale ------------------------
# L'elenco dentro sw.js è quello che il telefono si porta dietro per funzionare
# senza rete. Un file nuovo che non entra lì continua a funzionare online — la
# rete lo va a prendere — e sparisce solo in palestra, dove il campo non c'è:
# il posto peggiore per accorgersene. È già successo con la sezione degli
# allenamenti dell'orologio, aggiunta e non elencata.
MANCANTI=""
for f in $(echo "$DA_PUBBLICARE" | grep -E '^(js|css|data)/.*\.(js|css|json)$'); do
  grep -q "\"\./$f\"" sw.js || MANCANTI="$MANCANTI $f"
done
if [ -n "$MANCANTI" ]; then
  echo "  file dell'app non elencati in sw.js:"
  for f in $MANCANTI; do echo "    $f"; done
  errore "Questi file non entrerebbero nella copia locale: senza rete l'app non li troverebbe. Aggiungili all'elenco in sw.js."
fi
echo "Copia locale: tutti i file dell'app sono elencati in sw.js."

echo "Controlli superati: nessun dato personale fra i file da pubblicare."

# --- documentazione rimasta indietro (avviso, non blocco) ---------------------
# COME-FUNZIONA.md è quello che si legge per sapere cosa fa l'app: quando cambia
# il punteggio, il pacchetto o il flusso della seduta e la documentazione resta
# ferma, da lì in poi descrive un'app che non esiste più. È successo: la tabella
# dei pesi del punteggio è rimasta indietro di una notte.
#
# Avvisa e basta. Bloccare sarebbe sbagliato: ci sono modifiche a quei file che
# la documentazione non deve seguire (una correzione di grammatica, un colore),
# e un blocco che si impara ad aggirare è peggio di un avviso che si legge.
CAMBIATI="$(git diff --cached --name-only)"
if echo "$CAMBIATI" | grep -qE '^js/(punteggio|export)\.js$|^js/screens/(seduta|export)\.js$'; then
  if ! echo "$CAMBIATI" | grep -qE '\.md$'; then
    echo
    echo "  NOTA: hai toccato punteggio, pacchetto o flusso della seduta"
    echo "        senza toccare nessun .md. Se il comportamento è cambiato,"
    echo "        COME-FUNZIONA.md adesso racconta un'app diversa da questa."
    echo
  fi
fi

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
