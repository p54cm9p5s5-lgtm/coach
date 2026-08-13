# Esito — registro dei controlli

Una riga per voce. Generato da VERIFICA.md, **non a mano**: se il totale qui non
corrisponde a quello di VERIFICA.md, uno dei due si è perso qualcosa.

Stati: `DA FARE` · `CORRETTO` · `NON CORREGGO` · `NON RIPRODOTTO` · `SOLO TELEFONO`

Ho finito quando questo comando dà **0**:

    grep -cE '^\|.*DA FARE' ESITO.md

Adesso dà 502. Il numero può **salire** — le verifiche fanno vedere difetti che
le letture non mostrano — e va bene: quello che non deve succedere è che scenda
senza che una riga sia stata davvero chiusa.

| Fase | ! | Voce | Stato | Come / commit | Sezione |
|---|---|---|---|---|---|
| 0 |  | **0.1** | CORRETTO | tag `prima-del-controllo` su a582344; ritorno con `git reset --hard prima-del-controllo && pubblica.sh` | Blocco 0 — Protezione |
| 0 |  | **0.2** | NON RIPRODOTTO | `pubblica.sh --controlla` eseguito: 18 parole vietate, lista bianca pulita, sw.js completo, staging ripristinato | Blocco 0 — Protezione |
| 0 |  | **0.3** | CORRETTO | provati 4 controlli su 6 con file finti: lista bianca ✓, immagine incorporata ✓, file fuori da sw.js ✓, nomi personali ✗ → vedi 11.AE.6 | Blocco 0 — Protezione |
| 0 |  | **0.4** | CORRETTO | decisione presa con lui: i tre .md restano online; lista bianca ora li elenca uno per uno (11.AE.6) | Blocco 0 — Protezione |
| 0 |  | **0.5** | CORRETTO | fotografia di partenza in _privato/controllo-2026-08/: console pulita su 12 rotte, backup 8600, brief di prova, base invarianti (0/59/48/10), guida di ripresa | Blocco 0 — Protezione |
| 1 | ! | **11.AF.1** | CORRETTO | `registraSaltoVero` ora parte dal record esistente: RPE, tecnica, dolori e nota dell'esercizio restano; cambia solo che risulta saltato | 11.AF — Voci raccolte finendo i file già cominciati |
| 1 | ! | **11.B.1** | CORRETTO | riprodotto con «abc» (con «8a4» non si riproduce: parseFloat legge 8 → vedi 11.B.19). Toccando − il campo torna valido e ora esce da `nonValidi`: «Salva» non rifiuta più un campo che a schermo è giusto | 11.B — `js/screens/corpo.js` |
| 1 | ! | **11.B.2** | CORRETTO | il `break` secco è diventato una domanda: «manca ancora una posa, continuo?». Un annullamento involontario del selettore non porta più via il resto del set | 11.B — `js/screens/corpo.js` |
| 1 |  | **11.B.3** | CORRETTO | la cancellazione del set è dentro try/catch e dice quante foto sono uscite davvero, come già fa il salvataggio parziale delle misure | 11.B — `js/screens/corpo.js` |
| 1 | ! | **11.P.1** | CORRETTO | stessa correzione di 13.1: il record vecchio veniva letto e mai usato. Ora un campo assente vale «non lo so», non «azzeralo» | 11.P — `js/store.js`, importazione da Salute e agenda |
| 1 | ! | **11.S.13** | CORRETTO | nuova `store.aggiornaSerie(id, patch)` in coda (`inFila`), che rilegge il record prima di scrivere; le tre scritture dirette in seduta.js (recupero, questionario, correzione del riposo) ci passano | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 1 | ! | **11.T.1** | CORRETTO | il ripiego non è più `indice: 0` ma l'ultimo esercizio: a fine seduta «Torna agli esercizi» non riporta più sul primo, già chiuso | 11.T — `js/screens/seduta.js`, riepilogo e chiusura |
| 1 | ! | **11.U.2** | CORRETTO | `aggiornaProgresso` al posto di `aggiornaSeduta` con la fotografia vecchia: si scrive solo la fase, fusa su quella salvata | 11.U — `js/screens/oggi.js` |
| 1 | ! | **13.1** | CORRETTO | riprodotto su 8602: importato un pacchetto ricco (km 5,2 · FC 118/88/141 · sforzo 6 · indoor · fine · 8 caselle di battito), poi uno povero → tutto svuotato. Ora `importaSalute` fonde invece di sostituire: dopo il povero i campi ricchi restano. Invarianti 0/10/48/59 identici | Blocco 13 — I tre strumenti da computer |
| 2 | ! | **11.G.1** | CORRETTO | `?nosw` ora vale solo su localhost/127.0.0.1: sul sito pubblicato viene ignorato e non può più cancellare la copia offline. Provato in locale: continua a funzionare (0 service worker registrati) | 11.G — `js/app.js` |
| 2 | ! | **11.G.2** | DA FARE |  | 11.G — `js/app.js` |
| 2 | ! | **11.I.3** | CORRETTO | gli arretrati portano il numero di giorni: «Backup su file: mai fatto», «Dati salute: N giorni da importare». Un ritardo che cresce si vede crescere invece di restare la stessa frase | 11.I — `js/calendario.js` |
| 2 | ! | **11.N.1** | CORRETTO | l'avviso dice adesso che oltre i 30 giorni i dati non si recuperano «per sempre» e che non va fatto lontano da casa senza il file di Salute | 11.N — `js/screens/impostazioni.js` |
| 2 | ! | **11.O.4** | DA FARE |  | 11.O — `js/store.js` |
| 2 | ! | **11.P.3** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 2 | ! | **11.P.4** | NON CORREGGO | confermato: 8 scritture separate. Racchiuderle in una transazione sola richiede di riscrivere importaSalute (IndexedDB chiude la transazione al primo await senza operazioni, e in mezzo ci sono letture e un import dinamico). Il danno è recuperabile: l'import è idempotente per costruzione (chiave = data), quindi un import interrotto si ripara reimportando lo stesso pacchetto. Vedi §8 | 11.P — `js/store.js`, importazione da Salute e agenda |
| 2 | ! | **11.Q.3** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 2 |  | **11.U.6** | CORRETTO | stessa correzione di 11.I.3: la riga in fondo al calendario adesso dice quanto sono in ritardo | 11.U — `js/screens/oggi.js` |
| 3 | ! | **11.AD.1** | DA FARE |  | 11.AD — `ISTRUZIONI-BRIEF.md` |
| 3 | ! | **11.AD.2** | DA FARE |  | 11.AD — `ISTRUZIONI-BRIEF.md` |
| 3 | ! | **11.AD.3** | DA FARE |  | 11.AD — `ISTRUZIONI-BRIEF.md` |
| 3 | ! | **11.AD.4** | DA FARE |  | 11.AD — `ISTRUZIONI-BRIEF.md` |
| 3 |  | **11.AD.5** | DA FARE |  | 11.AD — `ISTRUZIONI-BRIEF.md` |
| 3 |  | **11.AD.6** | DA FARE |  | 11.AD — `ISTRUZIONI-BRIEF.md` |
| 3 | ! | **11.J.1** | DA FARE |  | 11.J — `js/screens/export.js` |
| 3 | ! | **11.W.3** | DA FARE |  | 11.W — `js/export.js` |
| 3 | ! | **12.A.1** | DA FARE |  | 12.A — Contraddizioni sulla privacy |
| 3 | ! | **12.A.2** | DA FARE |  | 12.A — Contraddizioni sulla privacy |
| 3 | ! | **12.B.1** | DA FARE |  | 12.B — `SPEC.md` |
| 3 | ! | **12.B.2** | DA FARE |  | 12.B — `SPEC.md` |
| 3 | ! | **12.B.3** | DA FARE |  | 12.B — `SPEC.md` |
| 3 | ! | **12.B.4** | DA FARE |  | 12.B — `SPEC.md` |
| 3 |  | **12.B.5** | DA FARE |  | 12.B — `SPEC.md` |
| 3 |  | **12.B.6** | DA FARE |  | 12.B — `SPEC.md` |
| 3 |  | **12.B.7** | DA FARE |  | 12.B — `SPEC.md` |
| 3 |  | **12.B.8** | DA FARE |  | 12.B — `SPEC.md` |
| 3 |  | **12.B.9** | DA FARE |  | 12.B — `SPEC.md` |
| 3 | ! | **12.C.1** | DA FARE |  | 12.C — `COME-FUNZIONA.md` |
| 3 |  | **12.C.10** | DA FARE |  | 12.C — `COME-FUNZIONA.md` |
| 3 | ! | **12.C.2** | DA FARE |  | 12.C — `COME-FUNZIONA.md` |
| 3 | ! | **12.C.3** | DA FARE |  | 12.C — `COME-FUNZIONA.md` |
| 3 | ! | **12.C.4** | DA FARE |  | 12.C — `COME-FUNZIONA.md` |
| 3 | ! | **12.C.5** | DA FARE |  | 12.C — `COME-FUNZIONA.md` |
| 3 | ! | **12.C.6** | DA FARE |  | 12.C — `COME-FUNZIONA.md` |
| 3 |  | **12.C.7** | DA FARE |  | 12.C — `COME-FUNZIONA.md` |
| 3 |  | **12.C.8** | DA FARE |  | 12.C — `COME-FUNZIONA.md` |
| 3 |  | **12.C.9** | DA FARE |  | 12.C — `COME-FUNZIONA.md` |
| 3 |  | **12.D.1** | DA FARE |  | 12.D — Il resto degli strumenti |
| 3 |  | **12.D.2** | DA FARE |  | 12.D — Il resto degli strumenti |
| 3 | ! | **13.2** | DA FARE |  | Blocco 13 — I tre strumenti da computer |
| 3 | ! | **14.C.1** | DA FARE |  | 14.C — I file piccoli, mai aperti |
| 3 |  | **14.C.2** | DA FARE |  | 14.C — I file piccoli, mai aperti |
| 3 |  | **14.C.3** | DA FARE |  | 14.C — I file piccoli, mai aperti |
| 3 |  | **14.C.4** | DA FARE |  | 14.C — I file piccoli, mai aperti |
| 4 |  | **11.F.5** | DA FARE |  | 11.F — `js/screens/fumo.js` |
| 4 | ! | **11.K.3** | DA FARE |  | 11.K — `js/screens/storico.js` |
| 4 | ! | **11.O.2** | DA FARE |  | 11.O — `js/store.js` |
| 4 | ! | **11.O.5** | DA FARE |  | 11.O — `js/store.js` |
| 4 | ! | **11.Q.1** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 4 | ! | **11.S.11** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 4 | ! | **11.W.1** | DA FARE |  | 11.W — `js/export.js` |
| 4 | ! | **11.W.2** | DA FARE |  | 11.W — `js/export.js` |
| 5 |  | **1.1** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.10** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.11** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.12** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.13** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.14** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.15** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.16** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.2** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.3** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.4** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.5** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.6** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.7** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.8** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.9** | DA FARE |  | Blocco 1 — Il flusso quotidiano |
| 5 |  | **10.1** | DA FARE |  | Blocco 10 — Condizioni, non funzioni |
| 5 |  | **10.2** | DA FARE |  | Blocco 10 — Condizioni, non funzioni |
| 5 |  | **10.3** | DA FARE |  | Blocco 10 — Condizioni, non funzioni |
| 5 |  | **10.4** | DA FARE |  | Blocco 10 — Condizioni, non funzioni |
| 5 | ! | **11.A.1** | DA FARE |  | 11.A — `js/punteggio.js` |
| 5 |  | **11.A.10** | DA FARE |  | 11.A — `js/punteggio.js` |
| 5 |  | **11.A.11** | DA FARE |  | 11.A — `js/punteggio.js` |
| 5 |  | **11.A.12** | DA FARE |  | 11.A — `js/punteggio.js` |
| 5 |  | **11.A.2** | DA FARE |  | 11.A — `js/punteggio.js` |
| 5 |  | **11.A.3** | DA FARE |  | 11.A — `js/punteggio.js` |
| 5 |  | **11.A.4** | DA FARE |  | 11.A — `js/punteggio.js` |
| 5 |  | **11.A.5** | DA FARE |  | 11.A — `js/punteggio.js` |
| 5 |  | **11.A.6** | DA FARE |  | 11.A — `js/punteggio.js` |
| 5 |  | **11.A.7** | DA FARE |  | 11.A — `js/punteggio.js` |
| 5 |  | **11.A.8** | DA FARE |  | 11.A — `js/punteggio.js` |
| 5 |  | **11.A.9** | DA FARE |  | 11.A — `js/punteggio.js` |
| 5 | ! | **11.AA.1** | DA FARE |  | 11.AA — `js/salute.js` |
| 5 | ! | **11.AA.2** | DA FARE |  | 11.AA — `js/salute.js` |
| 5 |  | **11.AA.3** | DA FARE |  | 11.AA — `js/salute.js` |
| 5 |  | **11.AA.4** | DA FARE |  | 11.AA — `js/salute.js` |
| 5 |  | **11.AA.5** | DA FARE |  | 11.AA — `js/salute.js` |
| 5 |  | **11.AA.6** | DA FARE |  | 11.AA — `js/salute.js` |
| 5 |  | **11.AA.7** | DA FARE |  | 11.AA — `js/salute.js` |
| 5 |  | **11.AA.8** | DA FARE |  | 11.AA — `js/salute.js` |
| 5 | ! | **11.AB.1** | DA FARE |  | 11.AB — `js/screens/allenamenti.js` |
| 5 |  | **11.AB.2** | DA FARE |  | 11.AB — `js/screens/allenamenti.js` |
| 5 |  | **11.AB.3** | DA FARE |  | 11.AB — `js/screens/allenamenti.js` |
| 5 |  | **11.AB.4** | DA FARE |  | 11.AB — `js/screens/allenamenti.js` |
| 5 | ! | **11.AC.1** | DA FARE |  | 11.AC — `index.html` |
| 5 |  | **11.AC.2** | DA FARE |  | 11.AC — `index.html` |
| 5 |  | **11.AC.3** | DA FARE |  | 11.AC — `index.html` |
| 5 |  | **11.AC.4** | DA FARE |  | 11.AC — `index.html` |
| 5 |  | **11.AC.5** | DA FARE |  | 11.AC — `index.html` |
| 5 | ! | **11.AE.1** | DA FARE |  | 11.AE — `tools/pubblica.sh` |
| 5 |  | **11.AE.2** | DA FARE |  | 11.AE — `tools/pubblica.sh` |
| 5 |  | **11.AE.3** | DA FARE |  | 11.AE — `tools/pubblica.sh` |
| 5 |  | **11.AE.4** | DA FARE |  | 11.AE — `tools/pubblica.sh` |
| 5 |  | **11.AE.5** | DA FARE |  | 11.AE — `tools/pubblica.sh` |
| 0 | ! | **11.AE.6** | CORRETTO | provato con DATI.md contenente «peso 84,5 kg»: prima passava tutti e 6 i controlli, ora blocca. Documenti elencati uno per uno invece di «qualunque .md maiuscolo» | 11.AE — `tools/pubblica.sh` |
| 5 |  | **11.AF.10** | DA FARE |  | 11.AF — Voci raccolte finendo i file già cominciati |
| 5 | ! | **11.AF.2** | DA FARE |  | 11.AF — Voci raccolte finendo i file già cominciati |
| 5 | ! | **11.AF.3** | DA FARE |  | 11.AF — Voci raccolte finendo i file già cominciati |
| 5 |  | **11.AF.4** | DA FARE |  | 11.AF — Voci raccolte finendo i file già cominciati |
| 5 |  | **11.AF.5** | DA FARE |  | 11.AF — Voci raccolte finendo i file già cominciati |
| 5 |  | **11.AF.6** | DA FARE |  | 11.AF — Voci raccolte finendo i file già cominciati |
| 5 |  | **11.AF.7** | DA FARE |  | 11.AF — Voci raccolte finendo i file già cominciati |
| 5 |  | **11.AF.8** | DA FARE |  | 11.AF — Voci raccolte finendo i file già cominciati |
| 5 |  | **11.AF.9** | DA FARE |  | 11.AF — Voci raccolte finendo i file già cominciati |
| 5 |  | **11.B.10** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.11** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.12** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.13** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.14** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.15** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.16** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.17** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.18** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 | ! | **11.B.19** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.4** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.5** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.6** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.7** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.8** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 |  | **11.B.9** | DA FARE |  | 11.B — `js/screens/corpo.js` |
| 5 | ! | **11.C.1** | DA FARE |  | 11.C — `js/ui.js` |
| 5 |  | **11.C.10** | DA FARE |  | 11.C — `js/ui.js` |
| 5 |  | **11.C.11** | DA FARE |  | 11.C — `js/ui.js` |
| 5 |  | **11.C.12** | DA FARE |  | 11.C — `js/ui.js` |
| 5 |  | **11.C.13** | DA FARE |  | 11.C — `js/ui.js` |
| 5 | ! | **11.C.2** | DA FARE |  | 11.C — `js/ui.js` |
| 5 |  | **11.C.3** | DA FARE |  | 11.C — `js/ui.js` |
| 5 |  | **11.C.4** | DA FARE |  | 11.C — `js/ui.js` |
| 5 |  | **11.C.5** | DA FARE |  | 11.C — `js/ui.js` |
| 5 |  | **11.C.6** | DA FARE |  | 11.C — `js/ui.js` |
| 5 |  | **11.C.7** | DA FARE |  | 11.C — `js/ui.js` |
| 5 |  | **11.C.8** | DA FARE |  | 11.C — `js/ui.js` |
| 5 |  | **11.C.9** | DA FARE |  | 11.C — `js/ui.js` |
| 5 | ! | **11.D.1** | DA FARE |  | 11.D — `js/db.js` |
| 5 |  | **11.D.2** | DA FARE |  | 11.D — `js/db.js` |
| 5 |  | **11.D.3** | DA FARE |  | 11.D — `js/db.js` |
| 5 |  | **11.D.4** | DA FARE |  | 11.D — `js/db.js` |
| 5 |  | **11.D.5** | DA FARE |  | 11.D — `js/db.js` |
| 5 |  | **11.D.6** | DA FARE |  | 11.D — `js/db.js` |
| 5 |  | **11.D.7** | DA FARE |  | 11.D — `js/db.js` |
| 5 |  | **11.D.8** | DA FARE |  | 11.D — `js/db.js` |
| 5 |  | **11.D.9** | DA FARE |  | 11.D — `js/db.js` |
| 5 | ! | **11.E.1** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 |  | **11.E.10** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 |  | **11.E.11** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 |  | **11.E.12** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 |  | **11.E.13** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 |  | **11.E.14** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 | ! | **11.E.2** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 | ! | **11.E.3** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 | ! | **11.E.4** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 |  | **11.E.5** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 |  | **11.E.6** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 |  | **11.E.7** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 |  | **11.E.8** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 |  | **11.E.9** | DA FARE |  | 11.E — `js/segnali.js` |
| 5 | ! | **11.F.1** | DA FARE |  | 11.F — `js/screens/fumo.js` |
| 5 | ! | **11.F.2** | DA FARE |  | 11.F — `js/screens/fumo.js` |
| 5 |  | **11.F.3** | DA FARE |  | 11.F — `js/screens/fumo.js` |
| 5 |  | **11.F.4** | DA FARE |  | 11.F — `js/screens/fumo.js` |
| 5 |  | **11.F.6** | DA FARE |  | 11.F — `js/screens/fumo.js` |
| 5 |  | **11.F.7** | DA FARE |  | 11.F — `js/screens/fumo.js` |
| 5 |  | **11.F.8** | DA FARE |  | 11.F — `js/screens/fumo.js` |
| 5 |  | **11.F.9** | DA FARE |  | 11.F — `js/screens/fumo.js` |
| 5 |  | **11.G.10** | DA FARE |  | 11.G — `js/app.js` |
| 5 |  | **11.G.11** | DA FARE |  | 11.G — `js/app.js` |
| 5 |  | **11.G.12** | DA FARE |  | 11.G — `js/app.js` |
| 5 | ! | **11.G.3** | DA FARE |  | 11.G — `js/app.js` |
| 5 |  | **11.G.4** | DA FARE |  | 11.G — `js/app.js` |
| 5 |  | **11.G.5** | DA FARE |  | 11.G — `js/app.js` |
| 5 |  | **11.G.6** | DA FARE |  | 11.G — `js/app.js` |
| 5 |  | **11.G.7** | DA FARE |  | 11.G — `js/app.js` |
| 5 |  | **11.G.8** | DA FARE |  | 11.G — `js/app.js` |
| 5 |  | **11.G.9** | DA FARE |  | 11.G — `js/app.js` |
| 5 |  | **11.H.1** | DA FARE |  | 11.H — `js/screens/acqua.js` |
| 5 |  | **11.H.2** | DA FARE |  | 11.H — `js/screens/acqua.js` |
| 5 |  | **11.H.3** | DA FARE |  | 11.H — `js/screens/acqua.js` |
| 5 |  | **11.H.4** | DA FARE |  | 11.H — `js/screens/acqua.js` |
| 5 |  | **11.H.5** | DA FARE |  | 11.H — `js/screens/acqua.js` |
| 5 |  | **11.H.6** | DA FARE |  | 11.H — `js/screens/acqua.js` |
| 5 |  | **11.H.7** | DA FARE |  | 11.H — `js/screens/acqua.js` |
| 5 |  | **11.H.8** | DA FARE |  | 11.H — `js/screens/acqua.js` |
| 5 | ! | **11.I.1** | DA FARE |  | 11.I — `js/calendario.js` |
| 5 | ! | **11.I.2** | DA FARE |  | 11.I — `js/calendario.js` |
| 5 |  | **11.I.4** | DA FARE |  | 11.I — `js/calendario.js` |
| 5 |  | **11.I.5** | DA FARE |  | 11.I — `js/calendario.js` |
| 5 |  | **11.I.6** | DA FARE |  | 11.I — `js/calendario.js` |
| 5 |  | **11.I.7** | DA FARE |  | 11.I — `js/calendario.js` |
| 5 |  | **11.I.8** | DA FARE |  | 11.I — `js/calendario.js` |
| 5 |  | **11.I.9** | DA FARE |  | 11.I — `js/calendario.js` |
| 5 |  | **11.J.10** | DA FARE |  | 11.J — `js/screens/export.js` |
| 5 |  | **11.J.11** | NON RIPRODOTTO | il ripiego funziona: cliccato «Copia il pacchetto» sul profilo di prova, la scrittura negli appunti fallisce e compare «Copia non riuscita — tieni premuto sull'anteprima e usa Seleziona tutto → Copia» | 11.J — `js/screens/export.js` |
| 5 |  | **11.J.12** | DA FARE |  | 11.J — `js/screens/export.js` |
| 5 |  | **11.J.13** | DA FARE |  | 11.J — `js/screens/export.js` |
| 5 |  | **11.J.14** | DA FARE |  | 11.J — `js/screens/export.js` |
| 5 | ! | **11.J.2** | DA FARE |  | 11.J — `js/screens/export.js` |
| 5 | ! | **11.J.3** | DA FARE |  | 11.J — `js/screens/export.js` |
| 5 | ! | **11.J.4** | DA FARE |  | 11.J — `js/screens/export.js` |
| 5 |  | **11.J.5** | DA FARE |  | 11.J — `js/screens/export.js` |
| 5 |  | **11.J.6** | DA FARE |  | 11.J — `js/screens/export.js` |
| 5 |  | **11.J.7** | DA FARE |  | 11.J — `js/screens/export.js` |
| 5 |  | **11.J.8** | DA FARE |  | 11.J — `js/screens/export.js` |
| 5 |  | **11.J.9** | DA FARE |  | 11.J — `js/screens/export.js` |
| 5 | ! | **11.K.1** | DA FARE |  | 11.K — `js/screens/storico.js` |
| 5 |  | **11.K.10** | DA FARE |  | 11.K — `js/screens/storico.js` |
| 5 |  | **11.K.11** | DA FARE |  | 11.K — `js/screens/storico.js` |
| 5 |  | **11.K.12** | DA FARE |  | 11.K — `js/screens/storico.js` |
| 5 | ! | **11.K.2** | DA FARE |  | 11.K — `js/screens/storico.js` |
| 5 |  | **11.K.4** | DA FARE |  | 11.K — `js/screens/storico.js` |
| 5 |  | **11.K.5** | DA FARE |  | 11.K — `js/screens/storico.js` |
| 5 |  | **11.K.6** | DA FARE |  | 11.K — `js/screens/storico.js` |
| 5 |  | **11.K.7** | DA FARE |  | 11.K — `js/screens/storico.js` |
| 5 |  | **11.K.8** | DA FARE |  | 11.K — `js/screens/storico.js` |
| 5 |  | **11.K.9** | DA FARE |  | 11.K — `js/screens/storico.js` |
| 5 | ! | **11.L.1** | DA FARE |  | 11.L — `js/screens/extra.js` |
| 5 | ! | **11.L.2** | DA FARE |  | 11.L — `js/screens/extra.js` |
| 5 |  | **11.L.3** | DA FARE |  | 11.L — `js/screens/extra.js` |
| 5 |  | **11.L.4** | DA FARE |  | 11.L — `js/screens/extra.js` |
| 5 |  | **11.L.5** | DA FARE |  | 11.L — `js/screens/extra.js` |
| 5 |  | **11.L.6** | DA FARE |  | 11.L — `js/screens/extra.js` |
| 5 |  | **11.L.7** | DA FARE |  | 11.L — `js/screens/extra.js` |
| 5 |  | **11.M.1** | DA FARE |  | 11.M — `js/grafico.js` |
| 5 |  | **11.M.2** | DA FARE |  | 11.M — `js/grafico.js` |
| 5 |  | **11.M.3** | DA FARE |  | 11.M — `js/grafico.js` |
| 5 |  | **11.M.4** | DA FARE |  | 11.M — `js/grafico.js` |
| 5 |  | **11.M.5** | DA FARE |  | 11.M — `js/grafico.js` |
| 5 |  | **11.M.6** | DA FARE |  | 11.M — `js/grafico.js` |
| 5 |  | **11.M.7** | DA FARE |  | 11.M — `js/grafico.js` |
| 5 |  | **11.M.8** | DA FARE |  | 11.M — `js/grafico.js` |
| 5 |  | **11.M.9** | DA FARE |  | 11.M — `js/grafico.js` |
| 5 |  | **11.N.10** | DA FARE |  | 11.N — `js/screens/impostazioni.js` |
| 5 | ! | **11.N.2** | DA FARE |  | 11.N — `js/screens/impostazioni.js` |
| 5 |  | **11.N.3** | DA FARE |  | 11.N — `js/screens/impostazioni.js` |
| 5 |  | **11.N.4** | DA FARE |  | 11.N — `js/screens/impostazioni.js` |
| 5 |  | **11.N.5** | DA FARE |  | 11.N — `js/screens/impostazioni.js` |
| 5 |  | **11.N.6** | DA FARE |  | 11.N — `js/screens/impostazioni.js` |
| 5 |  | **11.N.7** | DA FARE |  | 11.N — `js/screens/impostazioni.js` |
| 5 | ! | **11.N.8** | DA FARE |  | 11.N — `js/screens/impostazioni.js` |
| 5 |  | **11.N.9** | DA FARE |  | 11.N — `js/screens/impostazioni.js` |
| 5 | ! | **11.O.1** | DA FARE |  | 11.O — `js/store.js` |
| 5 |  | **11.O.10** | DA FARE |  | 11.O — `js/store.js` |
| 5 |  | **11.O.11** | DA FARE |  | 11.O — `js/store.js` |
| 5 |  | **11.O.12** | DA FARE |  | 11.O — `js/store.js` |
| 5 |  | **11.O.13** | DA FARE |  | 11.O — `js/store.js` |
| 5 |  | **11.O.14** | DA FARE |  | 11.O — `js/store.js` |
| 5 | ! | **11.O.3** | DA FARE |  | 11.O — `js/store.js` |
| 5 | ! | **11.O.6** | DA FARE |  | 11.O — `js/store.js` |
| 5 | ! | **11.O.7** | DA FARE |  | 11.O — `js/store.js` |
| 5 |  | **11.O.8** | DA FARE |  | 11.O — `js/store.js` |
| 5 |  | **11.O.9** | DA FARE |  | 11.O — `js/store.js` |
| 5 |  | **11.P.10** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.P.11** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.P.12** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 | ! | **11.P.2** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 | ! | **11.P.5** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.P.6** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.P.7** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.P.8** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.P.9** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.Q.10** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 | ! | **11.Q.2** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 | ! | **11.Q.4** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 |  | **11.Q.5** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 |  | **11.Q.6** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 |  | **11.Q.7** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 |  | **11.Q.8** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 |  | **11.Q.9** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 |  | **11.R.1** | DA FARE |  | 11.R — `js/store.js`, motore delle proposte |
| 5 |  | **11.R.2** | DA FARE |  | 11.R — `js/store.js`, motore delle proposte |
| 5 |  | **11.R.3** | DA FARE |  | 11.R — `js/store.js`, motore delle proposte |
| 5 |  | **11.R.4** | DA FARE |  | 11.R — `js/store.js`, motore delle proposte |
| 5 |  | **11.R.5** | DA FARE |  | 11.R — `js/store.js`, motore delle proposte |
| 5 |  | **11.R.6** | DA FARE |  | 11.R — `js/store.js`, motore delle proposte |
| 5 | ! | **11.S.1** | DA FARE |  | 11.S — `js/screens/seduta.js` |
| 5 |  | **11.S.10** | DA FARE |  | 11.S — `js/screens/seduta.js` |
| 5 | ! | **11.S.12** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 | ! | **11.S.14** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 | ! | **11.S.15** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 | ! | **11.S.16** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 |  | **11.S.17** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 |  | **11.S.18** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 |  | **11.S.19** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 | ! | **11.S.2** | DA FARE |  | 11.S — `js/screens/seduta.js` |
| 5 |  | **11.S.20** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 |  | **11.S.21** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 |  | **11.S.22** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 |  | **11.S.23** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 |  | **11.S.24** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 |  | **11.S.25** | DA FARE |  | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 5 | ! | **11.S.3** | DA FARE |  | 11.S — `js/screens/seduta.js` |
| 5 |  | **11.S.4** | DA FARE |  | 11.S — `js/screens/seduta.js` |
| 5 |  | **11.S.5** | DA FARE |  | 11.S — `js/screens/seduta.js` |
| 5 |  | **11.S.6** | DA FARE |  | 11.S — `js/screens/seduta.js` |
| 5 |  | **11.S.7** | DA FARE |  | 11.S — `js/screens/seduta.js` |
| 5 |  | **11.S.8** | DA FARE |  | 11.S — `js/screens/seduta.js` |
| 5 |  | **11.S.9** | DA FARE |  | 11.S — `js/screens/seduta.js` |
| 5 |  | **11.T.2** | DA FARE |  | 11.T — `js/screens/seduta.js`, riepilogo e chiusura |
| 5 |  | **11.T.3** | DA FARE |  | 11.T — `js/screens/seduta.js`, riepilogo e chiusura |
| 5 |  | **11.T.4** | DA FARE |  | 11.T — `js/screens/seduta.js`, riepilogo e chiusura |
| 5 |  | **11.T.5** | DA FARE |  | 11.T — `js/screens/seduta.js`, riepilogo e chiusura |
| 5 |  | **11.T.6** | DA FARE |  | 11.T — `js/screens/seduta.js`, riepilogo e chiusura |
| 5 | ! | **11.U.1** | DA FARE |  | 11.U — `js/screens/oggi.js` |
| 5 |  | **11.U.10** | DA FARE |  | 11.U — `js/screens/oggi.js` |
| 5 |  | **11.U.11** | DA FARE |  | 11.U — `js/screens/oggi.js` |
| 5 |  | **11.U.12** | DA FARE |  | 11.U — `js/screens/oggi.js` |
| 5 | ! | **11.U.13** | DA FARE |  | 11.U — `js/screens/oggi.js` |
| 5 | ! | **11.U.3** | DA FARE |  | 11.U — `js/screens/oggi.js` |
| 5 |  | **11.U.4** | DA FARE |  | 11.U — `js/screens/oggi.js` |
| 5 |  | **11.U.5** | DA FARE |  | 11.U — `js/screens/oggi.js` |
| 5 |  | **11.U.7** | DA FARE |  | 11.U — `js/screens/oggi.js` |
| 5 |  | **11.U.8** | DA FARE |  | 11.U — `js/screens/oggi.js` |
| 5 |  | **11.U.9** | DA FARE |  | 11.U — `js/screens/oggi.js` |
| 5 | ! | **11.V.1** | DA FARE |  | 11.V — `js/screens/salute.js` |
| 5 |  | **11.V.2** | DA FARE |  | 11.V — `js/screens/salute.js` |
| 5 |  | **11.V.3** | DA FARE |  | 11.V — `js/screens/salute.js` |
| 5 |  | **11.V.4** | DA FARE |  | 11.V — `js/screens/salute.js` |
| 5 |  | **11.V.5** | DA FARE |  | 11.V — `js/screens/salute.js` |
| 5 |  | **11.V.6** | DA FARE |  | 11.V — `js/screens/salute.js` |
| 5 |  | **11.V.7** | DA FARE |  | 11.V — `js/screens/salute.js` |
| 5 |  | **11.V.8** | DA FARE |  | 11.V — `js/screens/salute.js` |
| 5 |  | **11.W.10** | DA FARE |  | 11.W — `js/export.js` |
| 5 |  | **11.W.11** | DA FARE |  | 11.W — `js/export.js` |
| 5 |  | **11.W.12** | DA FARE |  | 11.W — `js/export.js` |
| 5 |  | **11.W.13** | DA FARE |  | 11.W — `js/export.js` |
| 5 |  | **11.W.14** | DA FARE |  | 11.W — `js/export.js` |
| 5 | ! | **11.W.4** | DA FARE |  | 11.W — `js/export.js` |
| 5 |  | **11.W.5** | DA FARE |  | 11.W — `js/export.js` |
| 5 |  | **11.W.6** | DA FARE |  | 11.W — `js/export.js` |
| 5 |  | **11.W.7** | DA FARE |  | 11.W — `js/export.js` |
| 5 |  | **11.W.8** | DA FARE |  | 11.W — `js/export.js` |
| 5 |  | **11.W.9** | DA FARE |  | 11.W — `js/export.js` |
| 5 | ! | **11.X.1** | DA FARE |  | 11.X — `js/screens/seduta.js`, terza tornata |
| 5 |  | **11.X.10** | DA FARE |  | 11.X — `js/screens/seduta.js`, terza tornata |
| 5 | ! | **11.X.2** | DA FARE |  | 11.X — `js/screens/seduta.js`, terza tornata |
| 5 |  | **11.X.3** | DA FARE |  | 11.X — `js/screens/seduta.js`, terza tornata |
| 5 |  | **11.X.4** | DA FARE |  | 11.X — `js/screens/seduta.js`, terza tornata |
| 5 |  | **11.X.5** | DA FARE |  | 11.X — `js/screens/seduta.js`, terza tornata |
| 5 |  | **11.X.6** | DA FARE |  | 11.X — `js/screens/seduta.js`, terza tornata |
| 5 |  | **11.X.7** | DA FARE |  | 11.X — `js/screens/seduta.js`, terza tornata |
| 5 |  | **11.X.8** | DA FARE |  | 11.X — `js/screens/seduta.js`, terza tornata |
| 5 |  | **11.X.9** | DA FARE |  | 11.X — `js/screens/seduta.js`, terza tornata |
| 5 | ! | **11.Y.1** | DA FARE |  | 11.Y — `js/brief.js` |
| 5 |  | **11.Y.10** | DA FARE |  | 11.Y — `js/brief.js` |
| 5 |  | **11.Y.11** | DA FARE |  | 11.Y — `js/brief.js` |
| 5 |  | **11.Y.12** | DA FARE |  | 11.Y — `js/brief.js` |
| 5 | ! | **11.Y.2** | DA FARE |  | 11.Y — `js/brief.js` |
| 5 | ! | **11.Y.3** | DA FARE |  | 11.Y — `js/brief.js` |
| 5 |  | **11.Y.4** | DA FARE |  | 11.Y — `js/brief.js` |
| 5 |  | **11.Y.5** | DA FARE |  | 11.Y — `js/brief.js` |
| 5 |  | **11.Y.6** | DA FARE |  | 11.Y — `js/brief.js` |
| 5 |  | **11.Y.7** | DA FARE |  | 11.Y — `js/brief.js` |
| 5 |  | **11.Y.8** | DA FARE |  | 11.Y — `js/brief.js` |
| 5 |  | **11.Y.9** | DA FARE |  | 11.Y — `js/brief.js` |
| 5 |  | **11.Z.1** | DA FARE |  | 11.Z — `js/screens/seduta.js`, quarta tornata |
| 5 |  | **11.Z.2** | DA FARE |  | 11.Z — `js/screens/seduta.js`, quarta tornata |
| 5 |  | **11.Z.3** | DA FARE |  | 11.Z — `js/screens/seduta.js`, quarta tornata |
| 5 |  | **11.Z.4** | DA FARE |  | 11.Z — `js/screens/seduta.js`, quarta tornata |
| 5 |  | **11.Z.5** | DA FARE |  | 11.Z — `js/screens/seduta.js`, quarta tornata |
| 5 |  | **11.Z.6** | DA FARE |  | 11.Z — `js/screens/seduta.js`, quarta tornata |
| 5 | ! | **13.3** | DA FARE |  | Blocco 13 — I tre strumenti da computer |
| 5 |  | **13.4** | DA FARE |  | Blocco 13 — I tre strumenti da computer |
| 5 |  | **13.5** | DA FARE |  | Blocco 13 — I tre strumenti da computer |
| 5 |  | **13.6** | DA FARE |  | Blocco 13 — I tre strumenti da computer |
| 5 |  | **13.7** | DA FARE |  | Blocco 13 — I tre strumenti da computer |
| 5 | ! | **14.A.1** | DA FARE |  | 14.A — `data/riscaldamento.json` |
| 5 | ! | **14.A.2** | DA FARE |  | 14.A — `data/riscaldamento.json` |
| 5 | ! | **14.A.3** | DA FARE |  | 14.A — `data/riscaldamento.json` |
| 5 |  | **14.A.4** | DA FARE |  | 14.A — `data/riscaldamento.json` |
| 5 |  | **14.A.5** | DA FARE |  | 14.A — `data/riscaldamento.json` |
| 5 |  | **14.A.6** | DA FARE |  | 14.A — `data/riscaldamento.json` |
| 5 |  | **14.A.7** | DA FARE |  | 14.A — `data/riscaldamento.json` |
| 5 |  | **14.A.8** | DA FARE |  | 14.A — `data/riscaldamento.json` |
| 5 |  | **14.B.1** | DA FARE |  | 14.B — `data/esercizi.json` |
| 5 |  | **14.B.2** | DA FARE |  | 14.B — `data/esercizi.json` |
| 5 |  | **14.B.3** | DA FARE |  | 14.B — `data/esercizi.json` |
| 5 |  | **14.B.4** | DA FARE |  | 14.B — `data/esercizi.json` |
| 5 |  | **14.B.5** | DA FARE |  | 14.B — `data/esercizi.json` |
| 5 |  | **14.B.6** | DA FARE |  | 14.B — `data/esercizi.json` |
| 5 | ! | **15.A.1** | DA FARE |  | 15.A — Cose che si vedono in palestra |
| 5 | ! | **15.A.2** | DA FARE |  | 15.A — Cose che si vedono in palestra |
| 5 | ! | **15.A.3** | DA FARE |  | 15.A — Cose che si vedono in palestra |
| 5 | ! | **15.A.4** | DA FARE |  | 15.A — Cose che si vedono in palestra |
| 5 | ! | **15.A.5** | DA FARE |  | 15.A — Cose che si vedono in palestra |
| 5 |  | **15.B.1** | DA FARE |  | 15.B — Classificazioni da verificare |
| 5 |  | **15.B.2** | DA FARE |  | 15.B — Classificazioni da verificare |
| 5 |  | **15.B.3** | DA FARE |  | 15.B — Classificazioni da verificare |
| 5 |  | **15.B.4** | DA FARE |  | 15.B — Classificazioni da verificare |
| 5 |  | **15.B.5** | DA FARE |  | 15.B — Classificazioni da verificare |
| 5 |  | **1b.1** | DA FARE |  | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.2** | DA FARE |  | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.3** | DA FARE |  | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.4** | DA FARE |  | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.5** | DA FARE |  | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.6** | DA FARE |  | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.7** | DA FARE |  | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.8** | DA FARE |  | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.9** | DA FARE |  | Blocco 1-bis — Gli invarianti |
| 5 |  | **2.1** | DA FARE |  | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.2** | DA FARE |  | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.3** | DA FARE |  | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.4** | DA FARE |  | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.5** | DA FARE |  | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.6** | DA FARE |  | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.7** | DA FARE |  | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.8** | DA FARE |  | Blocco 2 — I dati che non si recuperano |
| 5 |  | **3.1** | DA FARE |  | Blocco 3 — Le novità di oggi |
| 5 |  | **3.10** | DA FARE |  | Blocco 3 — Le novità di oggi |
| 5 | ! | **3.2** | DA FARE |  | Blocco 3 — Le novità di oggi |
| 5 |  | **3.3** | DA FARE |  | Blocco 3 — Le novità di oggi |
| 5 |  | **3.4** | DA FARE |  | Blocco 3 — Le novità di oggi |
| 5 |  | **3.5** | DA FARE |  | Blocco 3 — Le novità di oggi |
| 5 |  | **3.6** | DA FARE |  | Blocco 3 — Le novità di oggi |
| 5 |  | **3.7** | DA FARE |  | Blocco 3 — Le novità di oggi |
| 5 |  | **3.8** | DA FARE |  | Blocco 3 — Le novità di oggi |
| 5 |  | **3.9** | DA FARE |  | Blocco 3 — Le novità di oggi |
| 5 |  | **4.1** | DA FARE |  | Blocco 4 — Il ciclo col coach |
| 5 |  | **4.2** | DA FARE |  | Blocco 4 — Il ciclo col coach |
| 5 |  | **4.3** | DA FARE |  | Blocco 4 — Il ciclo col coach |
| 5 |  | **4.4** | DA FARE |  | Blocco 4 — Il ciclo col coach |
| 5 | ! | **4.5** | DA FARE |  | Blocco 4 — Il ciclo col coach |
| 5 |  | **4.6** | DA FARE |  | Blocco 4 — Il ciclo col coach |
| 5 |  | **4.7** | DA FARE |  | Blocco 4 — Il ciclo col coach |
| 5 |  | **5.1** | DA FARE |  | Blocco 5 — Salute e importazione |
| 5 |  | **5.2** | DA FARE |  | Blocco 5 — Salute e importazione |
| 5 |  | **5.3** | DA FARE |  | Blocco 5 — Salute e importazione |
| 5 |  | **5.4** | DA FARE |  | Blocco 5 — Salute e importazione |
| 5 |  | **5.5** | DA FARE |  | Blocco 5 — Salute e importazione |
| 5 |  | **5.6** | DA FARE |  | Blocco 5 — Salute e importazione |
| 5 |  | **6.1** | DA FARE |  | Blocco 6 — Il resto delle sezioni |
| 5 |  | **6.2** | DA FARE |  | Blocco 6 — Il resto delle sezioni |
| 5 |  | **6.3** | DA FARE |  | Blocco 6 — Il resto delle sezioni |
| 5 |  | **6.4** | DA FARE |  | Blocco 6 — Il resto delle sezioni |
| 5 |  | **6.5** | DA FARE |  | Blocco 6 — Il resto delle sezioni |
| 5 |  | **6.6** | DA FARE |  | Blocco 6 — Il resto delle sezioni |
| 5 |  | **7.1** | DA FARE |  | Blocco 7 — Trasversali |
| 5 |  | **7.2** | DA FARE |  | Blocco 7 — Trasversali |
| 5 |  | **7.3** | DA FARE |  | Blocco 7 — Trasversali |
| 5 |  | **7.4** | DA FARE |  | Blocco 7 — Trasversali |
| 5 |  | **7.5** | DA FARE |  | Blocco 7 — Trasversali |
| 5 |  | **7.6** | DA FARE |  | Blocco 7 — Trasversali |
| 5 |  | **7.7** | DA FARE |  | Blocco 7 — Trasversali |
| 5 |  | **7.8** | DA FARE |  | Blocco 7 — Trasversali |
| 5 |  | **8b.1** | DA FARE |  | Blocco 8-bis — Gli strumenti |
| 5 |  | **8b.2** | DA FARE |  | Blocco 8-bis — Gli strumenti |
| 5 |  | **8b.3** | DA FARE |  | Blocco 8-bis — Gli strumenti |
| 5 |  | **8b.4** | DA FARE |  | Blocco 8-bis — Gli strumenti |
| 5 |  | **8b.5** | DA FARE |  | Blocco 8-bis — Gli strumenti |
| 5 |  | **9.1** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.10** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.11** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.12** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.13** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.14** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.15** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.2** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.3** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.4** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.5** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.6** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.7** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.8** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **9.9** | DA FARE |  | Blocco 9 — Lettura integrale dei moduli mai aperti |
| 5 |  | **A.1** | DA FARE |  | Blocco A — Il fuso orario ⚠️ |
| 5 |  | **A.2** | DA FARE |  | Blocco A — Il fuso orario ⚠️ |
| 5 |  | **A.3** | DA FARE |  | Blocco A — Il fuso orario ⚠️ |
| 5 |  | **A.4** | DA FARE |  | Blocco A — Il fuso orario ⚠️ |
| 5 |  | **A.5** | DA FARE |  | Blocco A — Il fuso orario ⚠️ |
| 5 |  | **A.6** | DA FARE |  | Blocco A — Il fuso orario ⚠️ |
| 5 |  | **B.1** | DA FARE |  | Blocco B — Lo schermo bianco ⚠️ |
| 5 |  | **B.2** | DA FARE |  | Blocco B — Lo schermo bianco ⚠️ |
| 5 |  | **B.3** | DA FARE |  | Blocco B — Lo schermo bianco ⚠️ |
| 5 |  | **B.4** | DA FARE |  | Blocco B — Lo schermo bianco ⚠️ |
| 6* |  | **8.1** | DA FARE |  | Blocco 8 — Solo sul telefono, prima di partire |
| 6* |  | **8.2** | DA FARE |  | Blocco 8 — Solo sul telefono, prima di partire |
| 6* |  | **8.3** | DA FARE |  | Blocco 8 — Solo sul telefono, prima di partire |
| 6* |  | **8.4** | DA FARE |  | Blocco 8 — Solo sul telefono, prima di partire |
| 6* |  | **8.5** | DA FARE |  | Blocco 8 — Solo sul telefono, prima di partire |
| 6* |  | **8.6** | DA FARE |  | Blocco 8 — Solo sul telefono, prima di partire |

## Conteggio di partenza

| Fase | Voci |
|---|---|
| 0 · protezione | 5 |
| 1 · perdita dati | 9 |
| 2 · si rompe in vacanza | 9 |
| 3 · bugie sulla carta | 36 |
| 4 · due risposte | 8 |
| 5 · il resto, blocco per blocco | 429 |
| solo sul telefono | 6 |
| **totale** | **502** |
