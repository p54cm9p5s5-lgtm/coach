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
| 2 | ! | **11.G.2** | CORRETTO | al posto del toast di 6 secondi ora resta a schermo una pagina che dice cosa è successo, che i dati non sono stati toccati, e due tasti (Ricarica · Vai alle impostazioni per il backup). ATTENZIONE: la correzione è scritta e ragionata ma **non l'ho vista scattare**: la prova con un guasto finto su una copia servita da 8603 non si è riprodotta (il server di prova non manda no-store e il browser aveva store.js in cache). Da riprovare | 11.G — `js/app.js` |
| 2 | ! | **11.I.3** | CORRETTO | gli arretrati portano il numero di giorni: «Backup su file: mai fatto», «Dati salute: N giorni da importare». Un ritardo che cresce si vede crescere invece di restare la stessa frase | 11.I — `js/calendario.js` |
| 2 | ! | **11.N.1** | CORRETTO | l'avviso dice adesso che oltre i 30 giorni i dati non si recuperano «per sempre» e che non va fatto lontano da casa senza il file di Salute | 11.N — `js/screens/impostazioni.js` |
| 2 | ! | **11.O.4** | NON CORREGGO | confermato leggendo `statoFinestra`: le settimane si contano a ritroso da oggi, quindi dieci giorni senza import lasciano la settimana in corso a zero e la finestra torna incompleta fino a tre settimane dopo il rientro. Non è un difetto ma la regola dichiarata nel brief (3 settimane × almeno 5 giorni): cambiarla è una decisione sul brief, non una correzione. Vedi §8 | 11.O — `js/store.js` |
| 2 | ! | **11.P.3** | NON RIPRODOTTO | misurato sul profilo di prova: letto il calendario il 13/08, la copertura arriva al **10/09** — 28 giorni pieni. I dieci giorni di vacanza sono coperti **se il calendario viene letto prima di partire**. Il caso «scaduta» si presenta solo dopo 28 giorni senza letture. Raccomandazione in §8 | 11.P — `js/store.js`, importazione da Salute e agenda |
| 2 | ! | **11.P.4** | NON CORREGGO | confermato: 8 scritture separate. Racchiuderle in una transazione sola richiede di riscrivere importaSalute (IndexedDB chiude la transazione al primo await senza operazioni, e in mezzo ci sono letture e un import dinamico). Il danno è recuperabile: l'import è idempotente per costruzione (chiave = data), quindi un import interrotto si ripara reimportando lo stesso pacchetto. Vedi §8 | 11.P — `js/store.js`, importazione da Salute e agenda |
| 2 | ! | **11.Q.3** | NON RIPRODOTTO | `data/riscaldamento.json` è dentro gli ASSETS di sw.js, quindi con il service worker attivo c'è anche senza rete; e al primissimo avvio senza rete non si carica nemmeno l'app. Resta il caso teorico del fetch che fallisce per altri motivi, senza ritentativo | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 2 |  | **11.U.6** | CORRETTO | stessa correzione di 11.I.3: la riga in fondo al calendario adesso dice quanto sono in ritardo | 11.U — `js/screens/oggi.js` |
| 3 | ! | **11.AD.1** | CORRETTO | ISTRUZIONI-BRIEF §7: stessa correzione di 12.C.5, sul documento che legge chi scrive il brief | 11.AD — `ISTRUZIONI-BRIEF.md` |
| 3 | ! | **11.AD.2** | CORRETTO | le istruzioni dentro l'app non descrivono più solo il comando rapido: adesso dicono che le azioni di Salute possono restare appese e spiegano la strada dell'esportazione, che funziona dal telefono senza computer. Titolo della sezione da «Comandi rapidi» a «Come arrivano i dati» | 11.AD — `ISTRUZIONI-BRIEF.md` |
| 3 | ! | **11.AD.3** | CORRETTO | ISTRUZIONI-BRIEF §9: la riga «manca barra mentre c'è l'inventario» non era più vera; ora dice che ometterla è lecito | 11.AD — `ISTRUZIONI-BRIEF.md` |
| 3 | ! | **11.AD.4** | CORRETTO | ISTRUZIONI-BRIEF §6: i giorni con protocollo sono 17, non 5; ed è scritto che i cinque nuovi e il fine settimana non hanno mobilità in riscaldamento né stretching finale | 11.AD — `ISTRUZIONI-BRIEF.md` |
| 3 |  | **11.AD.5** | NON RIPRODOTTO | rifatto il confronto a macchina: i 38 esercizi della libreria sono tutti e soli quelli elencati nel documento, nessuno in più né in meno | 11.AD — `ISTRUZIONI-BRIEF.md` |
| 3 |  | **11.AD.6** | CORRETTO | ISTRUZIONI-BRIEF §7: elencate le soglie che esistono e non erano nominate (finestra, sonnoOraLimite, sonnoCostoOraTardi, fumoQuotaMinima, esposizioniPerRiproporre, fotoAncora) | 11.AD — `ISTRUZIONI-BRIEF.md` |
| 3 | ! | **11.J.1** | CORRETTO | js/export.js: le due frasi che rimandavano ai numeri «trascritti dall'atleta leggendo il quadrante» dicono ora che quel riquadro resta solo sulle sedute vecchie | 11.J — `js/screens/export.js` |
| 3 | ! | **11.W.3** | CORRETTO | js/export.js: «Misure e indici, solo se aggiornati di recente» → dichiarato che non c'è nessun filtro di recenza e che la data è scritta accanto a ogni valore | 11.W — `js/export.js` |
| 3 | ! | **12.A.1** | CORRETTO | README: «la copertina di un video quando il riquadro entra sullo schermo» → «l'unica richiesta è il player, e parte solo se tocchi il video; la copertina è disegnata dall'app» | 12.A — Contraddizioni sulla privacy |
| 3 | ! | **12.A.2** | CORRETTO | SPEC §9 allineata al §1: la copertina è disegnata, non scaricata; aprire una scheda esercizio non produce nessuna richiesta | 12.A — Contraddizioni sulla privacy |
| 3 | ! | **12.B.1** | CORRETTO | SPEC §3.4 e §4.4 allineate al §3.3: gli allenamenti del Watch non si collegano alle sedute | 12.B — `SPEC.md` |
| 3 | ! | **12.B.2** | CORRETTO | SPEC §4.1: tolto «cambiabile con un tap», che diceva il contrario del codice. Ora dice che l'allenamento lo decide il brief o il calendario e l'app non offre di cambiarlo | 12.B — `SPEC.md` |
| 3 | ! | **12.B.3** | CORRETTO | SPEC §4.3: tolti i «grafici vita, peso, rapporto vita/altezza» che in Corpo non esistono; scritto che l'andamento si guarda in Salute | 12.B — `SPEC.md` |
| 3 | ! | **12.B.4** | CORRETTO | SPEC §1: il modo «unisci» esiste nel codice ma l'app non produce backup che lo dichiarino; scritto che il ripristino sostituisce sempre | 12.B — `SPEC.md` |
| 3 |  | **12.B.5** | CORRETTO | SPEC §2: «nessuna palette personalizzata» → dichiarato il tema «nero e lime», che è l'unica palette non di sistema | 12.B — `SPEC.md` |
| 3 |  | **12.B.6** | CORRETTO | SPEC §3.2: `orologio` marcato «solo sulle sedute vecchie»; la domanda sul dolore non è più fissa sul polso ma una per punto dichiarato | 12.B — `SPEC.md` |
| 3 |  | **12.B.7** | CORRETTO | SPEC §3.6: nomi veri delle impostazioni (ultimoExport, ultimoSnapshot, fumoTettoDichiarato, agenda…) al posto di ultimoBackup e versioneBrief, che non esistono | 12.B — `SPEC.md` |
| 3 |  | **12.B.8** | CORRETTO | SPEC §3.1: `giorni[5]` → 5-7, con sabato e domenica di sola mobilità | 12.B — `SPEC.md` |
| 3 |  | **12.B.9** | CORRETTO | SPEC §4.4: il comando rapido per la salute non viene più offerto; resta quello del calendario | 12.B — `SPEC.md` |
| 3 | ! | **12.C.1** | CORRETTO | COME-FUNZIONA §5.6: tolto «qui si copiano i numeri dall'orologio», che contraddiceva il §5.4-bis venti righe sopra | 12.C — `COME-FUNZIONA.md` |
| 3 |  | **12.C.10** | NON RIPRODOTTO | confermato: la scelta sulle sigarette è dichiarata per esteso in COME-FUNZIONA §10. Non è una svista ma una decisione, e resta in §8 come 11.O.3 | 12.C — `COME-FUNZIONA.md` |
| 3 | ! | **12.C.2** | CORRETTO | COME-FUNZIONA §12: tolta la colonna «cos'era» (il ruolo, rimosso), scritto che l'app non li interpreta e che vanno letti accanto al log | 12.C — `COME-FUNZIONA.md` |
| 3 | ! | **12.C.3** | CORRETTO | COME-FUNZIONA §12: tolto dal contenuto del pacchetto il riquadro «Letti dall'Apple Watch» trascritto a mano | 12.C — `COME-FUNZIONA.md` |
| 3 | ! | **12.C.4** | CORRETTO | COME-FUNZIONA §4: i pesi del punteggio Salute ora includono acqua 12 e dicono che le voci assenti ridistribuiscono il peso — combaciano col §6.3 | 12.C — `COME-FUNZIONA.md` |
| 3 | ! | **12.C.5** | CORRETTO | COME-FUNZIONA §3: la fusione delle regole è dichiarata «a un livello solo», con l'esempio di salute.pesi che sostituisce l'intero blocco | 12.C — `COME-FUNZIONA.md` |
| 3 | ! | **12.C.6** | CORRETTO | COME-FUNZIONA: tolta la data «dal 24/08/2026» per un blocco già attivo nei dati | 12.C — `COME-FUNZIONA.md` |
| 3 |  | **12.C.7** | CORRETTO | COME-FUNZIONA §11: aggiunto il terzo indice, vita/fianchi, con la nota che 0,95 è la soglia maschile | 12.C — `COME-FUNZIONA.md` |
| 3 |  | **12.C.8** | CORRETTO | COME-FUNZIONA §9: il formato ALLENAMENTO non promette più `uuid` e mostra i campi veri più la riga BATTITO | 12.C — `COME-FUNZIONA.md` |
| 3 |  | **12.C.9** | CORRETTO | COME-FUNZIONA §14: la misura «zero richieste fuori dal telefono» è datata 13/08/2026, dopo le correzioni | 12.C — `COME-FUNZIONA.md` |
| 3 |  | **12.D.1** | NON RIPRODOTTO | `serve.py` ascolta su 127.0.0.1: dal telefono non si raggiunge, ed è giusto così (per il telefono c'è passa-file.py, che lega su 0.0.0.0 con chiave casuale e spegnimento a 10 minuti) | 12.D — Il resto degli strumenti |
| 3 |  | **12.D.2** | NON RIPRODOTTO | riletti i quattro strumenti pubblicati cercando percorsi personali: l'unico riferimento era il nome del brief in passa-file.py (chiuso come 13.5). `salute-da-export.py` nomina solo la cartella `_privato/`, che è già pubblica come concetto | 12.D — Il resto degli strumenti |
| 3 | ! | **13.2** | CORRETTO | COME-FUNZIONA: tolto «identico byte per byte», che era falso e verificabile; scritto che lo strumento da computer produce un pacchetto più povero e che ormai non fa danno perché l'import fonde | Blocco 13 — I tre strumenti da computer |
| 3 | ! | **14.C.1** | CORRETTO | manifest: background_color e theme_color da #08080a (il nero del tema lime) a #000000, il nero di sistema — la schermata d'avvio non impone più il tema scuro alternativo | 14.C — I file piccoli, mai aperti |
| 3 |  | **14.C.2** | NON RIPRODOTTO | riletto `.gitignore`: copre `_privato/`, i backup, i dati iniziali e `.claude/*` tranne launch.json. La cartella di lavoro del controllo (`_privato/controllo-2026-08/`) è coperta: verificato con `git check-ignore` | 14.C — I file piccoli, mai aperti |
| 3 |  | **14.C.3** | NON CORREGGO | `robots.txt` è `Disallow: /` ma il repository GitHub resta pubblico e leggibile: il file scoraggia i motori, non protegge niente. È così per scelta e non c'è correzione possibile senza rendere privato il repository — che romperebbe GitHub Pages | 14.C — I file piccoli, mai aperti |
| 3 |  | **14.C.4** | NON CORREGGO | `orientation: portrait` è voluto: l'app è disegnata per una colonna sola, e i grafici in orizzontale non guadagnerebbero abbastanza da giustificare il rifacimento delle schermate | 14.C — I file piccoli, mai aperti |
| 4 |  | **11.F.5** | CORRETTO | stessa correzione nella schermata Fumo: la pastiglia «nuovo minimo» diventa «sotto il massimo» quando non è un minimo vero. Il minimo dei giorni precedenti si calcola una volta sola, in avanti | 11.F — `js/screens/fumo.js` |
| 4 | ! | **11.K.3** | CORRETTO | nel dettaglio della proposta l'esito della verifica si legge «non confermata» invece di `nonConfermata`, come già faceva lo Storico | 11.K — `js/screens/storico.js` |
| 4 | ! | **11.O.2** | NON CORREGGO | confermato: `punteggiSalute` ricalcola ogni volta e usa `giornoPrevisto(data)`, cioè lo split di oggi, per sapere se quel giorno era previsto un allenamento. Congelarlo vorrebbe dire un archivio nuovo con un punteggio per giorno, scritto quando la giornata si chiude — cioè un cambiamento di modello, non una correzione, e con una migrazione dei dati che il piano vieta. Vedi §8 | 11.O — `js/store.js` |
| 4 | ! | **11.O.5** | CORRETTO | `previstoStretching` viene congelato alla nascita della seduta, accanto a `previstiElenco` e alle soglie del cardio; `completezzaSeduta` lo usa se c'è e ripiega sul protocollo corrente solo per le sedute vecchie. Prima una stessa seduta era giudicata metà col programma di allora e metà con quello di oggi | 11.O — `js/store.js` |
| 4 | ! | **11.Q.1** | CORRETTO | `varianteDi` scorre ora `giorniInOrdineDiValidita()` come `varianti()`: con due programmi nel brief, motore e schermata leggono la stessa riga. Contorno e invarianti (0/10/48/59) invariati | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 4 | ! | **11.S.11** | CORRETTO | in `vistaRecupero` il bersaglio era `ripMax ?? ripMin` (il tetto) mentre `completaSerie` e il questionario usano `ripMin ?? ripMax` (il fondo): uniformato al fondo del range, come dice il commento di `completaSerie` | 11.S-bis — `js/screens/seduta.js`, seconda tornata |
| 4 | ! | **11.W.1** | CORRETTO | la densità nel pacchetto si calcolava su «dalla prima all'ultima serie», il riepilogo su `durataLavoroSec`: due numeri per la stessa seduta. Ora comanda il tempo di lavoro netto in tutti e due, e l'arco resta scritto accanto come contesto. Verificato a schermo: «0,00 serie/min su 2 min di lavoro» | 11.W — `js/export.js` |
| 4 | ! | **11.W.2** | CORRETTO | «nuovo minimo» nella tabella FUMO ora si scrive solo se quel giorno è più basso di tutti i precedenti; gli altri giorni sotto soglia dicono «sotto la soglia». Non verificabile a schermo su questo profilo (una sola sigaretta in archivio): da riguardare con dati veri | 11.W — `js/export.js` |
| 5 |  | **1.1** | NON RIPRODOTTO | provati tutti e tre gli avvii: giorno previsto dallo split (tasto «Inizia allenamento»), giorno senza niente in programma (nessun tasto, frase che spiega perché), e giorno di sola mobilità. Con il calendario collegato la Home dichiara «gli allenamenti arrivano dal calendario del coach, letti l'ultima volta il …» | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.10** | NON RIPRODOTTO | stretching di «Spalle» percorso tutto: 3 passaggi, ognuno con le due tenute per lato («Avvia · 30s · primo lato» → «Fatto · altro lato»), più il tasto «Salta». Su un giorno di sola mobilità (domenica nel brief di prova) la fase stretching non compare affatto | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.11** | NON RIPRODOTTO | riepilogo e chiusura percorsi tre volte: durata, densità, recuperi, punteggio scomposto, «Il punto debole è esercizi», nota generale, e i due tasti «Torna agli esercizi / Chiudi allenamento» | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.12** | NON RIPRODOTTO | menu ••• aperto durante la seduta: contiene «Salta al cardio», «Vai allo stretching», «Chiudi l'allenamento adesso» e «Annulla l'allenamento», e la voce del cardio compare solo se quel giorno lo prevede | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.13** | NON RIPRODOTTO | uscito e rientrato più volte a fasi diverse (riscaldamento, esercizio, recupero, cardio, stretching, riepilogo) ricaricando la pagina: la fase e il passaggio esatto si ritrovano sempre, perché stanno nel progresso salvato e non in memoria | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.14** | NON RIPRODOTTO | martellato davvero: tre tocchi in un istante su «Inizia allenamento» → **una sola** seduta aperta; quattro tocchi su «Serie completata» → **una sola** serie registrata (numero 1). Le due reti (`inCoda` sull'avvio e `azione()` dentro la seduta) tengono | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.15** | SOLO TELEFONO | una seduta a cavallo della mezzanotte si può solo vivere: il controllo al minuto e quello al ritorno in primo piano non si simulano dal browser senza falsare l'orologio, e falsarlo proverebbe un'altra cosa | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.16** | NON RIPRODOTTO | c'è già la rete: `inizioStimato` e `durataLavoroSec` scartano i buchi sopra le tre ore, e la Home mostra il blocco «aperto dal …» con «Chiudi e archivia». Verificato leggendo, e la seduta del 29/07 in archivio è proprio un caso di seduta vecchia | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.2** | NON RIPRODOTTO | percorso davvero: riscaldamento di «Spalle», 7 passaggi uno per volta, con il cronometro sulle dosi a tempo («Avvia · 20s · una direzione» → «Fatto · l'altra direzione») e il tasto Indietro. La camminata legge «5 min» dalla dose. Nessun errore in console | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.3** | NON RIPRODOTTO | schermata esercizio vista a schermo su Military press e Alzate laterali: carico, obiettivo, dischi da montare, guida. La serie di avvicinamento dice l'esercizio e il carico: «Serie di avvicinamento: Military press — 1 × 8-10 · bilanciere scarico (10 kg)» | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.4** | NON RIPRODOTTO | «Cambia carico» aperto a schermo: campo di testo con tastiera decimale, e la conferma in due tempi quando il numero è fuori scala. La virgola si scrive e si rilegge come virgola (provato sulle misure, stessa regola) | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.5** | NON RIPRODOTTO | tre serie di fila con recupero cronometrato fra l'una e l'altra («−15 s / +15 s / Pronto»), e dopo l'ultima il passaggio al questionario invece del recupero | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.6** | NON CORREGGO | il brief di prova ha un blocco («A»: flessioni + estensioni tricipiti) ma sta sul giorno `push`, che oggi non cade. Per provarlo servirebbe ricaricare il brief B e rifare una seduta intera: lo faccio in Fase 6, dove le prove a schermo sono raggruppate. Segnato lì, non perso | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.7** | NON RIPRODOTTO | salto provato su Military press: i quattro motivi compaiono, la conferma resta SPENTA finché la nota è vuota e si accende scrivendo «panca occupata, non ho aspettato». Poi l'app avanza all'esercizio dopo | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.8** | NON RIPRODOTTO | questionario percorso tre volte: due righelli 1-10, una domanda per ciascuno dei due punti dolenti dichiarati nel brief di prova (polso e ginocchio), tasto «Avanti al recupero» spento finché manca una risposta | Blocco 1 — Il flusso quotidiano |
| 5 |  | **1.9** | NON RIPRODOTTO | schermata cardio vista con i tre tasti «Non eseguito / Rimanda il cardio / Parti con il cardio»; avviato e chiuso con «Ho finito», registrato 1 min su 30 previsti e la voce Cardio è andata a 0% — il tetto sul cardio troppo corto funziona | Blocco 1 — Il flusso quotidiano |
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
| 5 |  | **11.O.12** | NON RIPRODOTTO | stessa prova di 1.14: il triplo tocco su «Inizia» lascia una sola seduta aperta | 11.O — `js/store.js` |
| 5 |  | **11.O.13** | DA FARE |  | 11.O — `js/store.js` |
| 5 |  | **11.O.14** | DA FARE |  | 11.O — `js/store.js` |
| 5 | ! | **11.O.3** | DA FARE |  | 11.O — `js/store.js` |
| 5 | ! | **11.O.6** | DA FARE |  | 11.O — `js/store.js` |
| 5 | ! | **11.O.7** | DA FARE |  | 11.O — `js/store.js` |
| 5 |  | **11.O.8** | DA FARE |  | 11.O — `js/store.js` |
| 5 |  | **11.O.9** | DA FARE |  | 11.O — `js/store.js` |
| 5 |  | **11.P.10** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.P.11** | NON RIPRODOTTO | «Dimentica gli eventi letti» in Impostazioni svuota agenda, copertura e finestre: la Home torna subito a disegnare lo split del brief («Spalle» invece di «Non ancora programmato») | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.P.12** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 | ! | **11.P.2** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 | ! | **11.P.13** | CORRETTO | trovato provando 1b.7: il pavimento valeva solo per l'export XML, non per il pacchetto incollato, e la riga FINESTRA creava 73 giorni vuoti più vecchi della storia. Corretto in `importaSalute` (punto unico) e nel ciclo della finestra; provato: 0 giorni prima del 29/07, riepilogo «1 riga più vecchia: lasciata fuori» | 11.P — importazione |
| 5 | ! | **11.P.5** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.P.6** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.P.7** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.P.8** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.P.9** | DA FARE |  | 11.P — `js/store.js`, importazione da Salute e agenda |
| 5 |  | **11.Q.10** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 | ! | **11.Q.2** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 | ! | **11.Q.4** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 |  | **11.Q.5** | DA FARE |  | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 |  | **11.Q.6** | NON RIPRODOTTO | provate tre uscite di `origineGiorno` su dati veri: **split** (senza calendario, «Inizia allenamento»), **oltreProgrammato** (calendario letto con eventi solo nel passato → «Non ancora programmato · Il coach ha programmato fino al 04/08»), e il ritorno allo split dopo «Dimentica gli eventi letti». Le frasi sono comprensibili e non si contraddicono | 11.Q — `js/store.js`, programma, regole e origine del giorno |
| 5 |  | **11.Q.7** | NON RIPRODOTTO | confermato a schermo: con il calendario attivo e nessun evento per oggi, `giornoPrevisto` torna null e il tasto «Inizia allenamento» sparisce — la Home spiega perché invece di dire «riposo» | 11.Q — `js/store.js`, programma, regole e origine del giorno |
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
| 5 |  | **13.5** | CORRETTO | `tools/passa-file.py` non contiene più il nome del documento privato: i percorsi arrivano da COACH_DATI e COACH_BRIEF o dalla riga di comando. Provato: senza variabili resta il solo dati.json, con COACH_BRIEF impostato compare il brief | Blocco 13 — I tre strumenti da computer |
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
| 5 |  | **1b.1** | NON RIPRODOTTO | provato davvero: caricato un brief che toglie il Plank da Spalle e ci mette il Crunch, poi aperto lo Storico (dove il ricalcolo scatterebbe). I cinque punteggi congelati — 0 · 10 · 27 · 48 · 59 — sono rimasti identici | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.2** | NON RIPRODOTTO | sulla stessa prova: il riepilogo della seduta da 59 mostra ancora **Plank**, cioè l'esercizio di allora, non il Crunch di adesso, e conta 3 previsti. `previstiElenco` congelato: military-press, alzate-laterali, plank | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.3** | NON RIPRODOTTO | le soglie del cardio nella seduta sono quelle di quel giorno (30 min · 4,5-5 km/h · FC 105-115 · limite 125) e il riepilogo scrive «previsto 4,5-5 km/h» leggendole da lì, non dalle regole correnti | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.4** | NON RIPRODOTTO | verificato a schermo: con il calendario attivo e nessun evento per oggi la Home dice «Non ancora programmato · il coach ha programmato fino al 04/08» e non offre nessun allenamento — non lo riempie con lo split | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.5** | NON RIPRODOTTO | provate tutte e tre le strade sul profilo di prova: dichiarato «da domani il massimo è zero» (il tasto sparisce subito e non torna), poi «il conteggio riparte da oggi» → tetto intatto, poi **ripristinata la copia interna fatta prima della dichiarazione** → tetto ancora intatto. `proteggiTettoFumo` regge anche sulla strada peggiore | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.6** | NON RIPRODOTTO | cercato in tutto il codice: la parola «protocollo» accanto alle foto compare solo come `checklist.protocollo` (un campo) e nella frase «Ripeti le stesse pose del set di riferimento». Il set con `daLibreria` è etichettato «set di riferimento» nella griglia e dentro la foto ingrandita. Nessuna occorrenza di «fuori protocollo» sulle foto: quella frase esiste solo per il cardio e per le misure con condizioni mancanti | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.7** | CORRETTO | provato incollando un pacchetto con giugno dentro: prima entrava, adesso no. Vedi 11.P.13, il difetto che questa prova ha fatto uscire | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.8** | NON RIPRODOTTO | confermato leggendo `aggiornaProposte`: se il brief ha già portato il carico a un valore pari o superiore a quello proposto (o le ripetizioni al bersaglio), la proposta viene tolta anche se non le è mai stato risposto | Blocco 1-bis — Gli invarianti |
| 5 |  | **1b.9** | NON RIPRODOTTO | confermato leggendo `completezzaSeduta` e `punteggiSalute`: nessuna delle due tocca `allenamentiWatch`, che non compare in nessuna delle voci di punteggio. Nel pacchetto è una tabella a sé, con l'intestazione che dice di leggerla accanto al log e non al posto suo | Blocco 1-bis — Gli invarianti |
| 5 |  | **2.1** | NON RIPRODOTTO | su 8602: impronta dei 17 archivi → backup → «Elimina tutti i dati» (due conferme) → ripristino dal file. **17 archivi su 17 identici byte per byte**; le uniche due differenze sono `snapshotAutomatico` e `ultimoSnapshot`, cioè la fotografia che il ripristino stesso scatta prima di sostituire | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.2** | NON RIPRODOTTO | sei file sbagliati provati di fila (vuoto · di un'altra app · versione 9 dal futuro · JSON troncato a metà · sezione `sedute` che è una stringa invece di un elenco · riga senza chiave): rifiutati tutti, **nessun archivio cambiato**, nessun foglio rimasto aperto. Il pacchetto salute senza intestazione dice esattamente cosa manca: «la prima riga deve essere COACH-DATI v1» | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.3** | NON CORREGGO | confermato che «unisci» non è raggiungibile da nessun tasto (già registrato come 11.N.2 e 11.AF.3): il ripristino ha due soli bottoni, «Sostituisci tutto» e «Annulla». Non è un difetto da correggere ma codice non collegato — vedi §8 | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.4** | CORRETTO | provato con un backup povero (1 allenamento su 5, 3 notti su 74): il confronto nominava **solo allenamenti e misure**, e le 71 notti che stavano per sparire non le diceva nessuno. Ora `confrontoBackup` conta anche foto, sigarette, notti, giorni di salute e allenamenti letti dal Watch. Verificato a schermo: «Notti: nel file 3 notti, fino al 03/06 · adesso 74 notti, fino al 13/08» | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.5** | NON RIPRODOTTO | la fotografia automatica scatta davvero prima di sostituire: dopo il ripristino di 2.1 gli unici due valori cambiati erano `snapshotAutomatico` e `ultimoSnapshot` (18:51 → 18:55). È il punto di ritorno se il file ripristinato è quello sbagliato. Il caso «non riesce» è coperto in tutti e cinque i punti che la scattano (fine allenamento, misure, foto, foto importate, import salute): sempre dentro try/catch, sempre **dopo** che il dato vero è già salvato, così un archivio pieno non fa fallire la chiusura di un allenamento. Che la copia non si faccia più si vede in Impostazioni, dove la data dell'ultima copia resta indietro | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.6** | NON RIPRODOTTO | «Elimina tutti i dati» chiede due conferme in fila e poi svuota davvero: 15 archivi a zero. Restano solo la libreria degli esercizi (38, si ricarica dal file) e due impostazioni — fra cui **il tetto di sigarette a 0 bloccato**, che sopravvive alla cancellazione totale. Quarta strada provata per 1b.5 | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.7** | NON RIPRODOTTO | file più vecchio del telefono: il confronto lo dice con la data e con il «fino al» di ogni riga (2.4), quindi si vede prima di confermare. File di versione più alta (9): rifiutato senza toccare niente (2.2). Archivio del browser aperto a una versione più alta da un'altra connessione: già provato nella tornata del 9 agosto | Blocco 2 — I dati che non si recuperano |
| 5 |  | **2.8** | NON RIPRODOTTO | scritte a mano `nota` e `qualita` sulla notte del 29/07, poi reimportato un pacchetto che copre la stessa notte (durata 999): **nota e qualità restano**, i dati dell'orologio si aggiungono accanto. `fondi()` parte dal record esistente e sovrascrive solo i campi che arrivano davvero; e una notte con `fonte: "mano"` non viene toccata proprio, ma il dato dell'orologio si conserva in `orologio` per il tasto «torna al dato dell'orologio» | Blocco 2 — I dati che non si recuperano |
| 5 |  | **3.1** | NON RIPRODOTTO | elenco piatto con 5 allenamenti importati apposta; dettaglio della corsa del 12/08 completo (50:00 · 430/510 kcal · media 132 · 6,40 km · **7'49" al km**, che è il conto giusto di 3000 s su 6,40 km · max 171 · min 94 · sforzo 7 «Difficile»). Grafico del battito con lettura a tocco provata in cinque punti: 18:30·96 → 18:44·135 → 18:55·168 → 19:09·133 → 19:20·102, cioè esattamente i valori importati e le ore che coprono la durata dichiarata | Blocco 3 — Le novità di oggi |
| 5 |  | **3.10** | NON RIPRODOTTO | girate 12 rotte di fila contando le richieste di rete: **zero richieste fuori dall'origine**, zero errori in console, nessun `img`/`video`/`iframe` con sorgente esterna. La copertina del video è disegnata, non scaricata | Blocco 3 — Le novità di oggi |
| 5 | ! | **3.2** | CORRETTO | scala Apple verificata riga per riga (1-2 molto facile · 3-4 facile · 5-6 moderato · 7-8 difficile · 9-10 massimo) e provata a schermo con 7 → «Difficile». Provato anche **fuori scala**: `sforzo=12` viene scartato in lettura e nel dettaglio la riga Sforzo non compare affatto, invece di mostrare un numero che non vuol dire niente. Resta da confermare sul pacchetto vero di lui — vedi 8.1 | Blocco 3 — Le novità di oggi |
| 5 |  | **3.3** | NON RIPRODOTTO | provati tutti e tre i rami con allenamenti costruiti apposta: `Walking indoor=0` → «Camminata outdoor», `Running indoor=1` → «Corsa indoor», camminata senza il dato → «Camminata» e basta, senza inventare. Il suffisso vale solo per i tre tipi in cui la differenza esiste davvero | Blocco 3 — Le novità di oggi |
| 5 |  | **3.4** | CORRETTO | **difetto trovato e corretto.** I conti sono giusti — «Passo a piedi» dà 11'29" su 3 allenamenti e 12,2 km, che è la somma delle distanze e delle durate (8400 s / 12,2 km), non la media delle medie; l'esclusione è dichiarata in fondo («1 allenamento è rimasto fuori dal conto: sotto 0,5 km»); i quattro periodi rispondono davvero e ognuno dice il proprio ambito (oggi 1 all./5,2 km · 7 giorni 1 all./5,2 km · mese e sempre 3 all./12,2 km). Ma toccando «1 gg» in un giorno senza corse **la scheda «Passo di corsa» spariva tutta insieme ai suoi tasti**, e non tornava più: il periodo scelto viene ricordato, quindi la sezione restava invisibile anche uscendo e rientrando. Ora la scheda resta e dice «— nessun dato · oggi»; verificato che da lì si torna a «Sempre» e riappare 10'00" · 1 allenamento · 4 km | Blocco 3 — Le novità di oggi |
| 5 |  | **3.5** | NON RIPRODOTTO | messo un allenamento con il cardio rimandato: in Home compare il riquadro «Cardio da fare · pesi finiti alle 20:43 · manca solo il cardio» con il tasto «Fai il cardio» al posto del solito «Riprendi». Portato indietro di due giorni, il richiamo **resta** e aggiunge la decadenza: «È aperto dal 11/08. Se lo riprendi, quello che registri oggi resta datato 11/08», con «Chiudi e archivia» ed «Elimina». L'avviso alla chiusura senza cardio c'è nel codice (`Chiudi senza cardio`, in rosso) e si prova a schermo in Fase 6 | Blocco 3 — Le novità di oggi |
| 5 |  | **3.6** | NON RIPRODOTTO | nel riepilogo dell'allenamento non c'è più nessun numero dell'orologio; nel pacchetto per il coach quei numeri hanno la loro sezione **WATCH (ultimi 7 giorni)** con data, giorno, ora, tipo, durata, km, kcal attive e totali, FC media e max, sforzo. Gli allenamenti senza un dato mostrano «—», e lo sforzo fuori scala non compare affatto | Blocco 3 — Le novità di oggi |
| 5 |  | **3.7** | NON RIPRODOTTO | in Home un riquadro solo, intitolato «Watch», con le righe degli ultimi allenamenti (giorno, ora, durata, kcal, battito medio) e la porta «Tutti gli allenamenti · N in archivio». Nessun calendario, nessun tasto di ruolo | Blocco 3 — Le novità di oggi |
| 5 |  | **3.8** | NON RIPRODOTTO | provato il conto su **tutti e otto i giorni** (i cinque del nuovo split, sabato, domenica e un giorno vecchio stile), con `data/riscaldamento.json` alla mano: `push/pull/legs/upper/lower` non hanno stretching finale ma hanno il blocco di mobilità → voci «Riscaldamento» e «Mobilità», nessuna penalità inventata (94/100 con tre esercizi a 90). `spalle` prevede lo stretching → saltandolo la voce scende al 50% e il totale a 80. Sabato e domenica: esercizi e riscaldamento restano **fuori dal conto** e la mobilità è tutto il punteggio — 100 se fatta, 0 se saltata, invece dello zero secco di prima. Il riscaldamento resta previsto ovunque perché la camminata iniziale non dipende dal giorno, ed è vero anche nel codice della seduta: per un giorno del nuovo split i passi restano camminata + serie di avvicinamento | Blocco 3 — Le novità di oggi |
| 5 |  | **3.9** | NON RIPRODOTTO | scritte le tre note e rilette dallo Storico → riepilogo: la nota di **salto** («saltato — attrezzo · panca occupata, non ho aspettato»), la nota di **esercizio** sotto il suo esercizio, e la nota **generale** sotto l'etichetta «Nota». La quarta — una nota per singola serie — non esiste: il campo c'è nell'archivio ma nessuna schermata lo scrive, quindi non è un dato che si perde | Blocco 3 — Le novità di oggi |
| 5 |  | **4.1** | CORRETTO | pacchetto generato con tutte e sette le caselle: **7 tabelle**, e le barre verticali cadono alla stessa colonna in ogni riga (verificato contando le posizioni, non a occhio) tranne l'ultima colonna delle note, che per scelta dichiarata non viene riempita di spazi. Zero `undefined`, zero `null`, zero `NaN`, zero `[object Object]`. Provata una nota con dentro `|`, un a capo e una tabulazione: la barra esce protetta `\|`, l'a capo diventa « · ». La **tabulazione invece restava** e spostava tutto quello che le stava dopo → corretta in `js/export.js` (tab, ritorno carrello e affini diventano uno spazio). Riverificato: nessuna tabulazione dentro le tabelle | Blocco 4 — Il ciclo col coach |
| 5 |  | **4.2** | NON RIPRODOTTO | tutti i blocchi presenti e nominati anche nell'intestazione «Contenuto:» — seduta, dettaglio serie per serie, dati salute (giorni), sonno (notti), WATCH, EXTRA (provato aggiungendo un padel: 1h 30m, colonne mancanti a «—»), FUMO, proposte, segnali, CORPO | Blocco 4 — Il ciclo col coach |
| 5 |  | **4.3** | NON RIPRODOTTO | con quattro allenamenti chiusi lo stesso giorno il pacchetto apre con la NOTA: «lo stesso giorno ci sono altri allenamenti chiusi: Spalle (8 serie), Spalle (5 serie), Spalle (0 serie). Nel pacchetto ne entra uno solo, il più recente: quelli vanno mandati con un pacchetto a parte» | Blocco 4 — Il ciclo col coach |
| 5 |  | **4.4** | NON RIPRODOTTO | «Copia il pacchetto» copia un testo **identico** carattere per carattere all'anteprima (10.396 caratteri nella prova) e dice «Copiato. Incollalo nella chat». Se iOS nega gli appunti non mente: apre un foglio che spiega di tenere premuto sull'anteprima e usare Seleziona tutto → Copia | Blocco 4 — Il ciclo col coach |
| 5 | ! | **4.5** | NON RIPRODOTTO | ⚠️ la prova che conta di più: caricato un brief nuovo (che sposta Spalle da giovedì a lunedì e Push da martedì a giovedì) **senza toccare il computer**, dal file. Validato, «Cosa cambia» corretto voce per voce, con la rassicurazione «Allenamenti, misure, foto e note registrate non vengono toccate». Applicato: lo split cambia davvero, e **gli invarianti sono identici** — punteggi congelati 0 · 59 · 48 · 10 · 27, elenchi previsti, 17 serie, 7 questionari. Nessun blocco, nessun rifiuto | Blocco 4 — Il ciclo col coach |
| 5 |  | **4.6** | CORRETTO | fatta nascere una proposta vera (due esposizioni piene di panca piana al tetto del range): il motore propone 40 → 41 kg, livello 4, con le **quattro domande** tutte compilate — perché, quali dati (le due esposizioni con data, serie, carico, RPE, tecnica), perché è meglio delle alternative (con la gerarchia dei livelli e il perché di +1 kg e non +4), risultato atteso — e la regola §11 in fondo. «Accetto» chiede conferma, la proposta passa a «accettata», nasce la **decisione nel registro** (livello, oggetto, verifica a 14 giorni) e **il brief non viene toccato**: il carico scritto resta quello del coach. **Difetto trovato e corretto**: gli esercizi la cui proposta è già superata dal brief sparivano dalla schermata — né proposti né spiegati — perché chi salva le proposte applicava una regola che chi spiega il silenzio non applicava. Ora la regola sta in una funzione sola (`propostaSuperataDalBrief`) usata da tutti e due, con tre frasi distinte per salita, discesa e carico invariato. Verificato: tutti e sei gli esercizi del programma hanno una spiegazione | Blocco 4 — Il ciclo col coach |
| 5 |  | **4.7** | NON RIPRODOTTO | provati tutti e tre: **dolore ripetuto** (stessa spalla in due allenamenti diversi degli ultimi quattro → segnale `patternDolore`, gravità attenzione, e il motore smette di proporre su quell'esercizio: «nessuna progressione finché il segnale non sparisce»), **buchi dati** («Dati incompleti in 1 degli ultimi 4 allenamenti»), **cardio fuori protocollo** (7,5 km/h contro un massimo di 5 → «Cardio fuori protocollo in 1 allenamento su 3», attenzione). In più si è acceso da solo `taraturaRpe`: «RPE dichiarato basso ma serie chiuse sotto il tetto del range in 4 casi su 6» | Blocco 4 — Il ciclo col coach |
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
| 5 |  | **A.1** | NON RIPRODOTTO | `isoDate()` usa sempre la data locale del telefono (64 usi, nessuno passa da UTC) e la seduta porta la data di quando è cominciata, congelata alla nascita: allenarsi in un fuso e chiudere in un altro non sposta la data della seduta. L'unico punto che passava da UTC era quello di A.4 | Blocco A — Il fuso orario ⚠️ |
| 5 |  | **A.2** | NON RIPRODOTTO | i giorni si generano sempre con `new Date(iso + "T00:00:00")` e `setDate(+1)`, che è aritmetica locale: nessun giorno può essere duplicato o saltato cambiando fuso. Cercato `toISOString().slice(0,10)` in tutto il codice: zero occorrenze rimaste | Blocco A — Il fuso orario ⚠️ |
| 5 |  | **A.3** | NON RIPRODOTTO | il cambio di giorno con l'app aperta è gestito da `seCambiatoGiorno` (controllo al minuto + al ritorno in primo piano), che confronta `new Date().toDateString()`, cioè la data locale. Dentro la seduta è sospeso apposta, e il commento lo dichiara | Blocco A — Il fuso orario ⚠️ |
| 5 |  | **A.4** | CORRETTO | misurato nel browser (Europe/Rome, −120): fra mezzanotte e le 02:00 la data UTC e quella locale sono due giorni diversi. `ultimoExport` e `ultimoImportSalute` sono istanti UTC e il calendario ne prendeva i primi dieci caratteri: un backup fatto all'una di notte risultava del giorno prima. Ora si convertono in data locale con `isoDate(new Date(iso))` | Blocco A — Il fuso orario ⚠️ |
| 5 |  | **A.5** | NON RIPRODOTTO | il conteggio sigarette usa `isoDate()` per il giorno e `Date.now()` per l'ora della singola riga: il tetto giornaliero si applica alla data locale, che è quella che vedi sul telefono | Blocco A — Il fuso orario ⚠️ |
| 5 |  | **A.6** | NON RIPRODOTTO | gli eventi del calendario arrivano già come date (`AGENDA 2026-08-05`), senza ora: non c'è nessun istante da convertire, quindi nessun fuso da sbagliare | Blocco A — Il fuso orario ⚠️ |
| 5 |  | **B.1** | NON RIPRODOTTO | provato davvero: copia dell'app su 8604 con `corpo.js` reso sintatticamente invalido. Aprendo #/corpo non c'è nessuno schermo bianco — compare «Questa sezione non si è caricata» con Riprova e Torna alla Home, e la barra delle schede resta accesa. Le altre sezioni continuano a funzionare (salute, storico, oggi: ok) | Blocco B — Lo schermo bianco ⚠️ |
| 5 |  | **B.2** | NON RIPRODOTTO | dalla schermata di errore «Torna alla Home» riporta a #/oggi e la Home si disegna. La via d'uscita c'è e funziona senza ricaricare | Blocco B — Lo schermo bianco ⚠️ |
| 5 |  | **B.3** | NON RIPRODOTTO | il messaggio minimo c'è già in tutti e due i casi: modulo che non arriva → «Questa sezione non si è caricata»; archivio irraggiungibile → «Archivio non accessibile» con il motivo e la nota sulla navigazione privata (provato con init() che lancia) | Blocco B — Lo schermo bianco ⚠️ |
| 5 |  | **B.4** | NON RIPRODOTTO | provato con `store.init()` che lancia: compare «Archivio non accessibile», il messaggio dell'errore e «Se stai usando la navigazione privata, i dati non possono essere salvati». Nessuno schermo bianco | Blocco B — Lo schermo bianco ⚠️ |
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
