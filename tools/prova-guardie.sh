#!/usr/bin/env bash
# Le guardie di pubblicazione sanno fermarsi?
#
# tools/pubblica.sh è l'ultima barriera fra i dati personali e un repository
# pubblico. Fino al 27/08/2026 nessuno l'aveva mai messa alla prova: passava
# sempre, e «passa sempre» è indistinguibile da «non controlla niente».
#
# Qui si costruisce apposta, una alla volta, la violazione che ogni guardia
# dovrebbe fermare, e si controlla che la fermi DAVVERO e col messaggio giusto.
# Poi si rimette tutto com'era e si verifica che l'albero sia pulito.
#
#   bash tools/prova-guardie.sh
#
# Non pubblica niente: usa solo `--controlla`. Non tocca i commit.
#
# La parola vietata di prova viene letta dal file dentro _privato/ e non viene
# MAI stampata: la legge lo script, non chi guarda lo schermo.

set -u
cd "$(dirname "$0")/.."

# Com'era l'albero PRIMA: il collaudo deve restituirlo identico. Confrontarlo
# con «pulito» era sbagliato — chi lo lancia sta quasi sempre lavorando a
# qualcosa — e un avviso che grida al lupo ogni volta smette di essere letto.
PRIMA="$(git status --porcelain)"

VERDI=0
ROSSI=0
DA_PULIRE=()

pulisci() {
  for f in "${DA_PULIRE[@]:-}"; do [ -n "$f" ] && rm -f "$f"; done
  DA_PULIRE=()
  git reset --quiet >/dev/null 2>&1 || true
}
trap pulisci EXIT

prova() {
  local nome="$1" atteso="$2"
  local out
  out="$(bash tools/pubblica.sh --controlla 2>&1)"
  local codice=$?
  if [ "$codice" -eq 0 ]; then
    echo "  NO   $nome — la guardia NON ha fermato niente"
    ROSSI=$((ROSSI + 1))
  elif ! echo "$out" | grep -qi "$atteso"; then
    echo "  NO   $nome — fermata, ma per un altro motivo:"
    echo "$out" | grep -i "PUBBLICAZIONE ANNULLATA" -A 1 | sed 's/^/         /'
    ROSSI=$((ROSSI + 1))
  else
    echo "  ok   $nome"
    VERDI=$((VERDI + 1))
  fi
  pulisci
}

echo
echo "Le guardie di pubblicazione, una alla volta."
echo

# --- 1. un file personale messo in preparazione a forza ----------------------
echo '{"formato":"coach-backup","dati":{}}' > coach-backup-1970-01-01.json
DA_PULIRE+=("coach-backup-1970-01-01.json")
git add -f coach-backup-1970-01-01.json >/dev/null 2>&1
prova "un backup aggiunto a forza viene fermato" "personal\|backup\|dato"

# --- 2. un'immagine incorporata in un file dell'app --------------------------
# Il modello si compone a pezzi: scritto per intero, questo stesso file
# farebbe scattare la guardia che sta provando — come succede a pubblica.sh,
# che infatti è escluso. Meglio non aggiungere un'altra eccezione: un'eccezione
# è un buco, e i buchi si allargano.
MODELLO="data:image/png;ba""se64,iVBORw0KGgoAAAANSUhEUg=="
printf 'export const x = "%s";\n' "$MODELLO" > js/prova-immagine.js
DA_PULIRE+=("js/prova-immagine.js")
prova "un'immagine incorporata viene fermata" "immagine\|base64"

# --- 3. una parola vietata dentro un documento pubblicabile ------------------
# La stessa scrematura che fa la guardia: niente righe vuote, niente commenti.
# Prendendo la prima riga e basta si finiva per provare con un commento — che la
# guardia salta, giustamente — e la prova risultava rossa accusando una guardia
# sana. Un collaudo sbagliato che accusa il codice è peggio di nessun collaudo.
PAROLA="$(grep -m1 -vE '^[[:space:]]*(#|$)' _privato/parole-vietate.txt 2>/dev/null | tr -d '\r\n')"
if [ -z "$PAROLA" ]; then
  echo "  --   parole vietate: la lista non si legge, prova saltata"
else
  # La parola finisce in un file di prova e non viene mai stampata.
  { printf '# prova\n\n'; printf '%s\n' "$PAROLA"; } > COME-FUNZIONA.prova.md
  cp COME-FUNZIONA.md /tmp/come-funziona-vera.md
  cat COME-FUNZIONA.prova.md >> COME-FUNZIONA.md
  rm -f COME-FUNZIONA.prova.md
  out="$(bash tools/pubblica.sh --controlla 2>&1)"; codice=$?
  cp /tmp/come-funziona-vera.md COME-FUNZIONA.md; rm -f /tmp/come-funziona-vera.md
  git reset --quiet >/dev/null 2>&1 || true
  if [ "$codice" -eq 0 ]; then
    echo "  NO   una parola vietata NON viene fermata"
    ROSSI=$((ROSSI + 1))
  elif echo "$out" | grep -qi "dati personali"; then
    echo "  ok   una parola vietata viene fermata"
    VERDI=$((VERDI + 1))
  else
    echo "  NO   fermata, ma non per la parola vietata"
    ROSSI=$((ROSSI + 1))
  fi
fi

# --- 4. un file estraneo all'app (lista bianca) ------------------------------
printf 'appunti miei\n' > appunti.md
DA_PULIRE+=("appunti.md")
prova "un file fuori dalla lista bianca viene fermato" "lista bianca\|fuori"

# --- 5. un file dell'app non elencato nella copia locale ---------------------
printf 'export const y = 1;\n' > js/prova-offline.js
DA_PULIRE+=("js/prova-offline.js")
prova "un file dell'app fuori dalla copia locale viene fermato" "copia locale\|sw.js"

# --- e con l'albero pulito deve passare --------------------------------------
if bash tools/pubblica.sh --controlla >/dev/null 2>&1; then
  echo "  ok   con l'albero pulito i controlli passano"
  VERDI=$((VERDI + 1))
else
  echo "  NO   con l'albero pulito i controlli FALLISCONO"
  ROSSI=$((ROSSI + 1))
fi

echo
DOPO="$(git status --porcelain)"
if [ "$PRIMA" != "$DOPO" ]; then
  echo "  ATTENZIONE: il collaudo ha lasciato qualcosa per terra:"
  diff <(printf '%s\n' "$PRIMA") <(printf '%s\n' "$DOPO") | sed 's/^/    /'
  ROSSI=$((ROSSI + 1))
fi
echo "  guardie provate: $((VERDI + ROSSI)) · funzionanti: $VERDI · mute: $ROSSI"
echo
[ "$ROSSI" -eq 0 ]
