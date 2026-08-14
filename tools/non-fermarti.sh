#!/bin/bash
#
# La guardia che impedisce di fermarsi a metà del controllo.
#
# Gira a ogni tentativo di smettere di lavorare (hook «Stop»). Finché in
# ESITO.md resta anche una sola voce DA FARE, risponde «no» e il lavoro
# riprende da solo. È l'unico modo per non dipendere dal buon proposito di
# chi lavora: la regola sta scritta qui e non in una promessa.
#
# Agisce SOLO se esiste il file sentinella `.controllo-in-corso`. Fuori dal
# controllo — qualunque altro lavoro sul progetto — non fa niente. E per
# fermare tutto basta cancellare quel file: è la via d'uscita, e deve
# restare sempre a portata di mano.

# La cartella del progetto è quella sopra a questo script. Scritta come
# percorso assoluto conterrebbe il nome dell'utente del Mac — un dato
# personale, e infatti il controllo di pubblicazione la rifiutava.
cd "$(dirname "$0")/.." 2>/dev/null || exit 0

# Nessun controllo in corso: non è compito di questo script dire niente.
[ -f .controllo-in-corso ] || exit 0

# Il registro non c'è o non si legge: meglio lasciar passare che bloccare
# per sempre su un file sparito.
[ -r ESITO.md ] || exit 0

# `grep -c` stampa già «0» quando non trova niente, ma esce con codice 1: un
# `|| echo 0` in coda ci attacca un secondo zero e il conto diventa «0 0»,
# che non è un numero. Il confronto allora fallisce e la guardia blocca per
# sempre, proprio quando il lavoro è finito. Si prende l'output e basta, si
# tolgono le cifre-non-cifre, e il vuoto vale zero.
# Si conta la COLONNA dello stato, non la riga intera: da quando il registro
# cita quello che l'app scrive a schermo, dentro le spiegazioni compaiono
# frasi come «CARDIO DA FARE» — testo virgolettato, non voci aperte. Contando
# la riga intera la guardia avrebbe bloccato per sempre su un lavoro finito.
APERTE="$(grep -cE '^\|[^|]*\|[^|]*\|[^|]*\| DA FARE \|' ESITO.md 2>/dev/null)"
APERTE="${APERTE//[^0-9]/}"
[ -z "$APERTE" ] && APERTE=0
[ "$APERTE" -eq 0 ] && exit 0

# Da qui in giù: si va avanti.
#
# Il messaggio non dice solo «no». Dice anche cosa fare nei due casi in cui
# fermarsi sembrerebbe legittimo — una voce che dipende da una decisione sua,
# e il contesto che si riempie — perché sono esattamente le due scuse con cui
# ci si è fermati le altre volte.
printf '{"decision":"block","reason":"Restano %s voci DA FARE in ESITO.md: il controllo non è finito e non ci si ferma. Riprendi dal primo blocco aperto seguendo PIANO.md, senza riepiloghi intermedi.\\n\\nSe una voce dipende da una decisione sua: NON aspettare. Chiudila come SOLO TELEFONO scrivendo la domanda nel campo «come», e vai avanti: le domande si consegnano tutte insieme in §8 alla fine.\\n\\nSe il contesto si sta riempiendo: NON scrivere un resoconto. La conversazione viene riassunta da sola e il lavoro riprende; la continuità sta in _privato/controllo-2026-08/04-come-si-riprende.md, che va aggiornata mentre si lavora e non alla fine. Ogni colpo speso a riferire è un colpo tolto alle voci aperte.\\n\\nSi parla solo quando questo comando dà zero:\\n    grep -cE \\"^\\\\|.*DA FARE\\" ESITO.md"}' "$APERTE"
