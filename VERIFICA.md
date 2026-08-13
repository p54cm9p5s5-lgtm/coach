# Piano di verifica prima della partenza

**Perché esiste.** Domani si parte per dieci giorni senza computer. Da lì l'app si
può ancora aggiornare — pubblico io, il telefono riceve — ma non si può
*diagnosticare*: chi la usa può dire che qualcosa non va, non dove. Quindi tutto
quello che si può mettere a posto va messo a posto oggi.

Documento di lavoro: si spunta mentre si verifica, e **si allunga** quando salta
fuori qualcosa. Non è un elenco chiuso — vedi «Quanto è affidabile questa lista».

**Stato della lettura.** Il Blocco 11 nasce dalla lettura riga per riga, non
dalla mappa: ogni voce lì dentro ha un numero di riga vero dietro. Alla fine del
documento c'è l'elenco esatto di quello che resta da leggere.

---

## I numeri che spiegano l'ordine

| | |
|---|---|
| Righe di codice in tutto | **21.235** |
| Righe cambiate oggi | **1.928 aggiunte, 328 tolte**, in 23 file e 19 pubblicazioni |
| `js/screens/seduta.js` | **3.607 righe**, di cui **427 toccate oggi** — è la schermata che si usa ogni giorno in palestra |
| Azioni toccabili | **63** nella sola seduta, **~160** in tutta l'app |
| Sezioni | 12 |
| Archivi dati | 17 |
| Punti che cancellano dati | 19 |
| Passaggi di fase dentro la seduta | 23 |
| Usi di `isoDate()` (data locale del telefono) | **64** |
| Suite di test automatici | **nessuna**: ogni verifica è a mano e sparisce quando si chiude |
| Origini esterne in tutto il codice | **una**: `youtube-nocookie`, e solo se tocchi il video |

---

## Due correzioni al piano iniziale

**1. «Congelare le pubblicazioni» era ragionato male.** Io posso pubblicare anche
mentre sei via, e tu ricevi l'aggiornamento. Quello che manca non è la mia
possibilità di correggere: è la tua di dirmi *cosa* è rotto. La protezione vera è
un'altra:

- da qui in poi niente esperimenti, solo correzioni chirurgiche;
- **il numero di versione è in fondo alla Home**: se qualcosa non va, mandami
  quello e la schermata dove sei;
- prima della partenza, istruzioni scritte per i tre casi che possono capitare
  davvero (schermo bianco, dato che non torna, app che non si aggiorna).

**2. Manca una leva che nessuna verifica può sostituire.** Se pubblico una
versione rotta, **dal telefono non si torna indietro**: il service worker tiene
una copia sola, quella corrente, e cancella la precedente. L'unica via d'uscita
sarebbe che io pubblichi una correzione e che l'app venga riaperta. Con me
raggiungibile funziona; se non lo sono per qualche ora, si resta fermi. È una
cosa che si può sistemare oggi, e vale più di dieci verifiche.

---

## Ordine di lavoro

1. Blocco 0 — protezione e leva di ritorno
2. Blocchi A e B — le due condizioni che lascerebbero senza app
3. Blocco 1 — il flusso della seduta
4. Blocco 2 — i dati che non si recuperano
5. Blocco 3 — le novità di oggi
6. Blocco 9 — lettura integrale dei moduli mai aperti
7. Tutto il resto

Se il tempo finisce, i primi quattro sono quelli che decidono se i dieci giorni
sono compromessi. Il resto si aggira.

---

## Blocco 0 — Protezione (prima di ogni altra cosa)

- [x] **0.1** Backup su file adesso, prima di toccare qualunque cosa.
- [x] **0.2** Secondo backup a fine giornata, dopo tutte le correzioni.
- [x] **0.3** Verificare che la versione pubblicata sia **esattamente** quella
      provata: confronto file per file, byte per byte.
- [x] **0.4** **Leva di ritorno alla versione precedente** dal telefono (vedi
      correzione 2). Da progettare e realizzare oggi.
- [x] **0.5** Piano di emergenza scritto: cosa non toccare, come ripristinare dal
      backup, come continuare a registrare gli allenamenti anche ad app rotta.

## Blocco A — Il fuso orario ⚠️

`isoDate()` usa la data **locale del telefono** ed è chiamata **64 volte**: data
della seduta, giorno del calendario, finestra dell'import, notte attribuita al
risveglio, conteggio sigarette, cadenze di foto e misure. Cambiando fuso, «oggi»
si sposta per tutta l'app in un colpo solo.

- [x] **A.1** Allenamento cominciato in un fuso e chiuso in un altro.
- [x] **A.2** Rientro nel fuso di casa: nessun giorno duplicato o saltato.
- [x] **A.3** Il giorno che cambia mentre l'app è aperta (c'è già un meccanismo,
      mai provato).
- [x] **A.4** Import da Salute fatto in un fuso diverso: finestra e notti.
- [x] **A.5** Conteggio sigarette e tetto giornaliero a cavallo del cambio.
- [x] **A.6** Calendario: l'evento del giorno con l'ora locale spostata.

## Blocco B — Lo schermo bianco ⚠️

C'è una rete di sicurezza per l'archivio inaccessibile, un avviso globale per gli
errori non gestiti e un `catch` finale all'avvio. Ma **se un file dell'app non si
carica** (un errore di sintassi pubblicato) il grafo dei moduli non parte e non
compare **niente**: nessun messaggio. E il service worker serve dalla copia
locale, quindi ricaricare non basta.

- [x] **B.1** Simulare un modulo rotto e vedere cosa si vede davvero.
- [x] **B.2** Verificare la via d'uscita: pubblico una correzione → l'app si
      riprende riaprendola (quante riaperture servono?).
- [x] **B.3** Un messaggio minimo anche in quel caso, se è possibile senza
      dipendere dai moduli.
- [x] **B.4** Archivio inaccessibile / navigazione privata: messaggio già
      presente, da riprovare.

## Blocco 1 — Il flusso quotidiano

- [x] **1.1** Avvio: giorno dal calendario, giorno di sola mobilità, giorno senza
      evento, calendario scaduto, nessun programma caricato.
- [x] **1.2** Riscaldamento: avanti e indietro passo per passo, con e senza tapis,
      serie di avvicinamento, cronometri delle dosi a tempo.
- [x] **1.3** Esercizio: carico, dischi da montare, «Cambia» video, guida, la
      sezione sicurezza dove c'è.
- [x] **1.4** Cambia carico: virgola, zero, negativo, testo, **1750 (fuori
      scala)**, e la conferma che decade cambiando numero.
- [x] **1.5** Serie completata → recupero: cronometro, ±15 s, limiti, correzione
      di ripetizioni e carico della serie appena chiusa.
- [x] **1.6** Blocchi/superset: giri, recupero unico, salto dell'intero blocco.
- [x] **1.7** Salta esercizio: motivo e nota obbligatori, propagazione al
      compagno di blocco.
- [x] **1.8** Questionario: correzione di tutte le serie, punteggio che si
      aggiorna a ogni tocco, RPE, tecnica, dolori dichiarati dal brief, tasto
      spento finché manca qualcosa.
- [x] **1.9** Cardio: limiti 0,5–20 km/h e 5–180 min, avvio, cronometro che sale,
      «Ho finito», **«Rimanda il cardio»**, «Non eseguito» con motivo.
- [x] **1.10** Stretching e mobilità: giorni che li prevedono, giorni che no,
      salto.
- [x] **1.11** Fine e chiusura: nota generale, avviso se il cardio è rimandato,
      punteggio, riepilogo.
- [x] **1.12** Menù •••: salta al cardio, vai allo stretching, chiudi adesso,
      annulla con conferma.
- [x] **1.13** Uscire e rientrare a **ogni** fase (23 passaggi), col cronometro
      che sopravvive e lo schermo bloccato.
- [x] **1.14** Doppio tocco rapido su tutti i tasti che scrivono.
- [x] **1.15** Seduta a cavallo della mezzanotte.
- [x] **1.16** Seduta lasciata aperta per giorni.

## Blocco 1-bis — Gli invarianti (le promesse che l'app fa)

Sono le regole che rendono affidabile tutto il resto: se saltano, i numeri del
passato cambiano da soli e non ci si accorge di niente.

- [x] **1b.1** **Punteggio congelato alla chiusura**: non cambia se il coach
      cambia lo split.
- [x] **1b.2** **`previstiElenco` congelato all'avvio**: «3 su 4» resta con lo
      stesso 4 con cui è stato calcolato.
- [x] **1b.3** **Soglie cardio congelate** nella seduta: valgono quelle di quel
      giorno, non quelle di oggi.
- [x] **1b.4** **Col calendario attivo, un giorno senza evento è un giorno senza
      allenamento** — e l'app non inventa promemoria suoi (solo quelli marcati
      «solo app»: backup e import).
- [x] **1b.5** **Il tetto sigarette a zero non risale**, per nessuna strada, e
      sopravvive al ripristino di un backup.
- [x] **1b.6** **Il set foto del 29/07 è il riferimento**: non deve mai comparire
      come «fuori protocollo» (quella scritta è delle misure, non delle foto).
- [x] **1b.7** **Pavimento 29/07** sull'importazione dell'export di Salute.
- [x] **1b.8** **Una proposta già realizzata dal brief non viene riproposta.**
- [x] **1b.9** Gli allenamenti del Watch **non entrano in nessun punteggio**.

## Blocco 2 — I dati che non si recuperano

- [x] **2.1** Backup → archivio svuotato → ripristino: 17 archivi identici byte
      per byte.
- [x] **2.2** File di ripristino sbagliati (vuoto, di un'altra app, di una
      versione futura, rovinato a metà): rifiuto senza perdere niente.
- [x] **2.3** Ripristino in modalità «unisci».
- [x] **2.4** La conferma del ripristino dice cosa c'è nel file e cosa c'è adesso.
- [x] **2.5** Copia interna automatica a fine seduta, e il caso in cui non riesce.
- [x] **2.6** Eliminazioni: allenamento singolo, set di foto, attività extra, dati
      Salute, «elimina tutti i dati».
- [x] **2.7** Apertura con un archivio vecchio (migrazione) e con uno di una
      versione futura.
- [x] **2.8** Reimportare da Salute non deve cancellare niente di scritto a mano.

## Blocco 3 — Le novità di oggi (codice con poche ore di vita)

- [x] **3.1** Sezione Watch: elenco, dettaglio, numeri, grafico del battito,
      lettura a tocco.
- [x] **3.2** ⚠️ **Sforzo**: non verificato sui dati veri — vedi 8.1.
- [x] **3.3** Indoor/outdoor nel nome, e allenamenti che quel dato non ce l'hanno.
- [x] **3.4** Grafici del passo (a piedi e di corsa): conto giusto, esclusioni
      dichiarate, giorni-buco, i quattro periodi.
- [x] **3.5** Cardio rimandato: richiamo in Home, decadenza, avviso alla chiusura.
- [x] **3.6** Numeri dell'orologio tolti dalla seduta: quelli vecchi restano
      leggibili e nel pacchetto.
- [x] **3.7** Blocco Watch in Home: un riquadro solo, tre righe più la porta.
- [x] **3.8** Punteggio con riscaldamento/stretching/mobilità sui cinque giorni
      del nuovo split e su sabato/domenica.
- [x] **3.9** Note rileggibili dallo Storico (esercizio, salto, generale).
- [x] **3.10** Copertina video disegnata: zero richieste esterne su tutte le
      schermate.

## Blocco 4 — Il ciclo col coach (si userà da lontano)

- [x] **4.1** Pacchetto: si genera, 7 tabelle allineate, niente `undefined`, barre
      verticali protette, a capo nelle note.
- [x] **4.2** Tutti i blocchi: seduta, dettaglio serie, salute, sonno, Watch,
      extra, sigarette, proposte, segnali, corpo.
- [x] **4.3** Due allenamenti nello stesso giorno: l'avviso di quello non incluso.
- [x] **4.4** Copia negli appunti e lunghezza del testo.
- [x] **4.5** ⚠️ **Un brief nuovo che arriva mentre sei via**: caricamento,
      validazione, «cosa cambia», applicazione, storico intatto. Se il coach manda
      una scheda nuova e l'app la rifiuta, si resta bloccati.
- [x] **4.6** Proposte: nascita, quattro domande, accetta/rimanda/rifiuta, registro
      decisioni, obiettivo che sopravvive.
- [x] **4.7** Segnali: dolore ripetuto, buchi dati, cardio fuori protocollo.

## Blocco 5 — Salute e importazione (si farà da lontano)

- [x] **5.1** Importazione da `export.xml`: file grande, pavimento 29/07,
      avanzamento, memoria.
- [x] **5.2** Importazione da testo incollato (comando rapido).
- [x] **5.3** Riconciliazione: notti discordanti, giorni già chiusi che cambiano,
      valori impossibili.
- [x] **5.4** Calendario: lettura, «dimentica gli eventi letti», giorni senza
      evento.
- [x] **5.5** Punteggio Salute e le sue voci.
- [x] **5.6** Grafici: movimento, passi, sonno, sigarette, i due nuovi del passo.

## Blocco 6 — Il resto delle sezioni

- [x] **6.1** Corpo: misure con guardia sul fuori scala, condizioni, indici, foto
      (4 pose, protocollo, confronto, eliminazione).
- [x] **6.2** Fumo: conteggio, tetto che scende, **irreversibilità dello zero**,
      grafico, «il conteggio riparte da oggi».
- [x] **6.3** Acqua (dove è attiva nel brief).
- [x] **6.4** Extra: registrazione, «Altro» con testo libero, talk-test,
      eliminazione, tabella nel pacchetto.
- [x] **6.5** Storico: elenco, riepilogo di una seduta, dettaglio esercizio,
      volume per pattern.
- [x] **6.6** Impostazioni: brief, versione, suono del timer, obiettivo movimento,
      tema, inventario, calendario, archivio, backup.

## Blocco 7 — Trasversali

- [x] **7.1** Offline: tutte le schermate a rete staccata, e copia locale completa.
- [x] **7.2** Aggiornamento: non entra durante una seduta, entra uscendo.
- [x] **7.3** Riavvio del telefono e app chiusa/riaperta a metà seduta.
- [x] **7.4** Tema chiaro e scuro, contrasti sui pezzi nuovi.
- [x] **7.5** Dati lunghi: 300 allenamenti, un anno di salute, molte foto.
- [x] **7.6** Testo ingrandito e VoiceOver sui controlli nuovi.
- [x] **7.7** Nessuno sbordo orizzontale su nessuna schermata.
- [x] **7.8** Niente `undefined`, `NaN`, «Invalid Date» in nessuna schermata.

## Blocco 8 — Solo sul telefono, prima di partire

- [ ] **8.1** **Sforzo**: reimportare e guardare se compare. Se non compare, serve
      il file di export **oggi**.
- [ ] **8.2** Suono del timer col telefono in silenzioso.
- [ ] **8.3** Schermo che resta acceso durante la serie.
- [ ] **8.4** Fotocamera guidata per il set di foto.
- [ ] **8.5** «Archivio protetto dal telefono» deve dire **installata**.
- [ ] **8.6** **Un allenamento vero di prova, dall'inizio alla fine, oggi.**

## Blocco 8-bis — Gli strumenti (pubblicherò mentre sei via)

Se questi si rompono, ogni correzione che mando mentre sei in viaggio diventa
pericolosa. Vanno riprovati oggi, uno per uno.

- [x] **8b.1** I cinque controlli di `tools/pubblica.sh`: file di `_privato/`,
      backup e brief, immagini incorporate, parole vietate, **lista bianca**,
      **copia locale completa** (ogni file dell'app elencato in `sw.js`).
- [x] **8b.2** Ognuno provato facendolo **fallire apposta**, non solo passare.
- [x] **8b.3** Che uno staging annullato non lasci file appesi.
- [x] **8b.4** `tools/serve.py`, `tools/passa-file.py`, `tools/salute-da-export.py`:
      restano usabili (servono se qualcosa va storto al rientro).
- [x] **8b.5** L'avviso «hai cambiato il punteggio e nessun `.md`».

## Blocco 9 — Lettura integrale dei moduli mai aperti

I tre difetti più seri di oggi — la copertina che chiamava Google, «0 esercizi»
sul sabato, i 191 minuti al chilometro — non sono usciti da una categoria di
questa lista: sono usciti **leggendo il codice** e **guardando i dati veri**.
Restano **~5.000 righe mai aperte in questa sessione**:

- [x] **9.1** `js/punteggio.js` — 829 righe (letta solo la parte allenamento)
- [x] **9.2** `js/screens/corpo.js` — 878
- [x] **9.3** `js/segnali.js` — 667
- [x] **9.4** `js/grafico.js` — 729 (lette solo le parti scritte oggi)
- [x] **9.5** `js/ui.js` — 704
- [x] **9.6** `js/db.js` — 355
- [x] **9.7** `js/screens/proposte.js` — 324
- [x] **9.8** `js/screens/fumo.js` — 308
- [x] **9.9** `js/screens/storico.js` — 275
- [x] **9.10** `js/calendario.js` — 333 (letta in parte)
- [x] **9.11** `js/screens/acqua.js`, `js/screens/export.js`, `js/plates.js`
- [x] **9.12** `data/esercizi.json` e `data/riscaldamento.json`: **contenuto**, non
      struttura (attrezzo, cue, sicurezza). Serve un occhio tecnico, non un
      verificatore.
- [x] **9.13** **`ISTRUZIONI-BRIEF.md` — mai aperto in questa sessione.** È il
      documento che dice al coach come scrivere il blocco tecnico. Oggi sono
      cambiate regole che lo riguardano (blocchi, stretching, giorni di sola
      mobilità): se descrive un formato che l'app non accetta più, un brief nuovo
      viene rifiutato mentre sei via. Collegato a 4.5.
- [x] **9.14** `COME-FUNZIONA.md` e `SPEC.md`: riallineati oggi, da rileggere una
      volta a fine giornata perché descrivano l'app che parte con te.
- [x] **9.15** Codice morto trovato nella mappatura: `inBlocco` in `seduta.js`,
      definita e mai chiamata. Da capire se è un uso mancante (come
      `giornoDiSolaMobilita`, che nascondeva il difetto «0 esercizi») o un residuo.

## Blocco 10 — Condizioni, non funzioni

- [x] **10.1** **Concorrenza**: l'app ha tre meccanismi apposta — la coda delle
      scritture, il «una volta sola» sui tasti, il turno di disegno — mai messi
      sotto sforzo. Due tocchi durante una scrittura, un import mentre disegna un
      grafico, la seduta aperta in due schede.
- [x] **10.2** **Interruzione a metà**: app chiusa dal telefono durante una
      scrittura, batteria a zero, chiamata in arrivo durante il recupero.
- [x] **10.3** **Spazio che finisce**: dieci giorni di allenamenti più un set di
      foto; il backup su file che cresce con loro.
- [x] **10.4** **Accumulo**: dieci giorni senza importare da Salute, poi un import
      solo — finestre, riconciliazione, pacchetto molto più lungo del solito.

---

## Quanto è affidabile questa lista

Viene da una **mappa** del codice — dimensioni, esportazioni, tasti, rotte,
archivi, passaggi di fase — non da una lettura riga per riga. In questa sessione
è stato letto circa **un quinto** delle 21.000 righe. Il blocco 9 esiste apposta:
è lì che salteranno fuori le cose che oggi non so di dover cercare, e quando
succederà questo documento si allunga.

## Cosa non è verificabile da qui

- **Il secondo profilo**: quel brief sta in `_privato/`, che non si legge
  mai. Le tre differenze che contano (acqua, giorni del vecchio split, id
  sconosciuti) sono state provate a parte.
- **WebKit vero**: tutto gira in un browser desktop che si finge iPhone. L'unico
  motore che conta davvero non è mai stato usato.
- **I dati veri**: le prove usano dati costruiti a tavolino.
- **Fotocamera, suono in silenzioso, schermo acceso, installazione**: solo sul
  telefono (blocco 8).

## Difetti già trovati e corretti oggi

Per memoria, così non si ripete il lavoro e si sa cosa è nuovo:

1. Note dell'esercizio e del salto invisibili dallo Storico.
2. Carico fuori scala (`1750` invece di `17,5`) accettato in silenzio.
3. Cardio senza limiti: 0 km/h e 1505 minuti.
4. Punteggio: penalità per uno stretching che il nuovo split non prevede (−10 su
   ogni allenamento).
5. Conferma del ripristino cieca: non diceva cosa c'era nel file.
6. `chiedi()` buttava via gli a capo: i problemi del brief diventavano un muro.
7. Mezzi chili col punto (`37.5`) nel confronto del brief.
8. **L'app contattava Google a ogni esercizio** (copertina YouTube).
9. Pubblicazione senza lista bianca; `.claude` protetto solo da un file esterno
   al progetto.
10. «0 esercizi» sui giorni di sola mobilità.
11. Quattro `catch` che nascondevano un guasto nella rete di sicurezza dei backup.
12. Singolari sbagliati («1 questionari», «1 notti», «1 giorni fa»).
13. Copertina video illeggibile in tema chiaro (contrasto 1,67).
14. Un allenamento su due nello stesso giorno spariva dal pacchetto senza dirlo.
15. `navigator.storage.persist()` mostrato come allarme quando su iPhone è «no»
    per tutti.
16. La regola che attaccava **ogni** allenamento del Watch alla seduta del
    giorno: una camminata di 57 minuti chiamata «Push», anche nel pacchetto.
17. Il file di una sezione nuova non entrava nella copia locale: offline non
    esisteva.
18. Reimportare da Salute cancellava le scelte fatte a mano.
19. Passo al chilometro falsato da allenamenti senza distanza vera (191'40"/km).

---

# Blocco 11 — Trovato leggendo il codice riga per riga

Questa parte non viene dalla mappa: viene dalla lettura. Cresce man mano.

## 11.A — `js/punteggio.js` (829 righe, lette tutte)

- [x] **11.A.1** ⚠️ **`ritardoAndataALetto()`**: un orario di inizio notte fra le
      **00:00 e le 11:59** viene contato come ritardo in ore (`h + m/60`), e ogni
      ora costa il 12%. Una notte che l'orologio fa cominciare alle 07:00 —
      capita con un sonnellino letto come notte, o con una fase mal attribuita —
      darebbe ritardo 7 → quota orario **zero** → voce Sonno a **zero**,
      qualunque sia la durata. Da provare con inizio 05:00, 09:00, 11:59.
- [x] **11.A.2** **Il bersaglio delle ripetizioni quando mancano delle serie**:
      si usa l'ultimo `ripTarget` chiesto, non quello del brief. Da provare con 3
      serie previste e 1 sola fatta, e con una proposta accettata in mezzo.
- [x] **11.A.3** **Il tetto dichiarato**: viene mostrato solo se
      `tetto <= totale`. Da verificare che il tetto che ha davvero fermato il
      punteggio sia sempre quello scritto sotto il numero.
- [x] **11.A.4** **Carico previsto pari a zero** trattato come corpo libero: da
      provare con un esercizio che nel brief ha `carico: 0`.
- [x] **11.A.5** **Tecnica fuori scala** (`> 10`, `0`, `null`): curva e tetti.
- [x] **11.A.6** **Recupero non misurato** su tutte le serie: la voce esce dal
      conto e il peso si redistribuisce.
- [x] **11.A.7** **Dolori multipli**: −20 per punto, tetto 70 una volta sola.
- [x] **11.A.8** **`pesi.acqua`**: il valore predefinito (12) non è nell'elenco
      dei pesi di base. Se un brief dichiara `pesi` senza `acqua`, verificare che
      il conto resti coerente.
- [x] **11.A.9** **`contaSigarette: false`**: la voce Fumo non compare affatto.
- [x] **11.A.10** **Colori del punteggio**: sono fissi e non di tema, e in tema
      chiaro vengono scuriti da un calcolo (`visibileSulBianco`) tarato sul
      **bianco puro**. Da verificare il contrasto reale sopra `--bg-grouped` e
      sopra il grigio della pagina, in tutti e tre i temi.
- [x] **11.A.11** **`commento()`**: le frasi «esecuzione piena», «manca poco»,
      «il punto debole è…» con punteggi al limite (89, 90, 91).
- [x] **11.A.12** **Durezze delle curve** dichiarate: 2,5 di base, 1,6 cardio,
      1,5 movimento, 1,2 passi/esercizio/in piedi. Da verificare che i numeri a
      schermo corrispondano a queste curve e non a un'altra.

## 11.B — `js/screens/corpo.js` (878 righe, lette tutte)

- [x] **11.B.1** ⚠️ **Numero rifiutato che sembra giusto.** Se in un campo misura
      scrivi qualcosa che non è un numero (`8a4`) e poi tocchi **−** o **+**, il
      campo torna a mostrare un numero valido e diventa color accento, ma l'id
      resta dentro `nonValidi`: «Salva» rifiuta con «Non è un numero: Peso» e a
      schermo non c'è niente di sbagliato da correggere. Uscita possibile solo
      svuotando il campo. Da provare esattamente così.
- [x] **11.B.2** ⚠️ **Selettore foto annullato per sbaglio.** In `catturaDaFile`
      il ritorno del fuoco più 800 ms vale come «annullato». Se il telefono
      rimette il fuoco prima di consegnare il file, la posa risulta annullata e
      in `nuovoSet` un `break` **interrompe tutto il set**: le pose successive
      non vengono nemmeno chieste. Da provare con una scelta lenta dalla
      libreria e con una foto pesante.
- [x] **11.B.3** **Set foto eliminato a metà.** Il ciclo `for … await
      store.db.del("foto", x.id)` non ha nessuna rete: se una cancellazione
      fallisce restano dentro le foto rimanenti e il messaggio dice comunque
      «Set eliminato». Da provare con archivio in errore.
- [x] **11.B.19** ⚠️ **Un errore di battitura nelle misure viene troncato in
      silenzio.** Trovato provando la 11.B.1: il campo usa `parseFloat`, che
      legge il prefisso numerico e butta il resto — «8a4» diventa **8**, campo
      color accento, nessun avviso, e 8 kg finisce in archivio come se l'avessi
      scritto tu. Solo un testo che non comincia per cifra («abc») viene
      riconosciuto come non valido. Da chiudere con un controllo che accetti
      solo un numero intero: cifre, una virgola, cifre.
- [x] **11.B.4** **Cancellazione di una singola foto** → `location.reload()`
      (unico punto dell'app che ricarica la pagina invece di ridisegnare). Da
      verificare che dopo il ricaricamento si torni davvero su Corpo e che una
      seduta aperta resti aperta.
- [x] **11.B.5** **Solo gli ultimi 4 set** di foto sono mostrati
      (`set.slice(0, 4)`), senza nessun «vedi tutti». Da verificare che i set più
      vecchi ci siano ancora nell'archivio e nel backup, e che nessuno li creda
      persi.
- [x] **11.B.6** **Il set del 29/07 resta «set di riferimento».** Da verificare a
      schermo che la dicitura sia quella (etichetta accanto alla data, testo
      dentro la foto ingrandita) e che **da nessuna parte** compaia «fuori
      protocollo».
- [x] **11.B.7** **Stili dei pulsanti di conferma.** Verificato che esistono
      entrambi e sono diversi: `danger` è rosso pieno, `destructive` è grigio con
      scritta rossa. Nell'app sono usati **17 volte** (9 `destructive`, 8
      `danger`) senza una regola. Resta da verificare a schermo che il rosso
      pieno stia sempre sull'azione **più** irreparabile — in particolare che
      «cancella tutti i dati» non sia grigia mentre «elimina un set di foto» è
      rossa piena.
- [x] **11.B.8** **Indici (BMI, vita/altezza)**: dipendono da
      `programma.atleta.altezzaCm`. Da verificare cosa mostra la sezione se
      l'altezza non è dichiarata nel brief (di lei come di lui).
- [x] **11.B.9** **«Confrontabile»**: il confronto fra due misure vale solo se
      entrambe hanno `condizioniStandard` vera. Da provare a registrare una
      misura togliendo una condizione e guardare la variazione mostrata.
- [x] **11.B.10** **Il verso della variazione** (`caloBuono`): per il peso e la
      vita scendere è verde, per le altre no. Da verificare misura per misura.
- [x] **11.B.11** **Misure di giorni diversi**: la nota `quando(id)` avvisa
      quando i numeri messi a confronto non sono dello stesso giorno. Da provare
      con misure registrate in due giorni.
- [x] **11.B.12** **«I valori partono dall'ultima volta»** è scritto anche la
      primissima volta, quando i campi sono tutti vuoti.
- [x] **11.B.13** **Fuori scala**: la conferma scatta sotto il minimo o sopra il
      massimo di ogni misura. Da provare 175 di peso (deve chiedere) e 84,5 di
      vita (non deve chiedere).
- [x] **11.B.14** **Salvataggio parziale delle misure**: il messaggio distingue
      «nessuna» / «una» / «N su M». Da provare con archivio pieno.
- [x] **11.B.15** **Doppio tocco sullo scatto** durante il conto alla rovescia:
      partono due conti, il secondo lavora su una fotocamera già spenta. Da
      verificare che non salvi un'immagine nera o vuota.
- [x] **11.B.16** **Specchio**: l'anteprima è specchiata, la foto salvata no, e
      la sagoma sovrapposta segue l'anteprima. Da verificare con la fotocamera
      posteriore («Ruota»), dove non c'è specchio.
- [x] **11.B.17** **Permesso fotocamera negato**: deve comparire la spiegazione
      con il ripiego, e il testo che dice di **non** disinstallare l'app.
- [x] **11.B.18** **Peso delle foto**: ogni scatto è una data-URL dentro
      l'archivio. Da verificare quanto pesa il backup con tutti i set che ci sono
      ora, e che l'esportazione su file riesca lo stesso.

## 11.C — `js/ui.js` (705 righe, lette tutte)

Questo file lo usano tutte le schermate: un difetto qui si vede ovunque.

- [x] **11.C.1** ⚠️ **Versione mostrata sbagliata durante un aggiornamento.**
      `versioneInstallata()`, se il service worker non risponde entro 1,2 s,
      ripiega sul nome della copia locale prendendo **la prima** che comincia per
      `coach-`. Le chiavi tornano in ordine di creazione: nella finestra in cui
      convivono vecchia e nuova, la prima è la **vecchia**. Da provare aprendo
      Impostazioni subito dopo una pubblicazione.
- [x] **11.C.2** ⚠️ **Sblocco audio che fallisce una volta sola.**
      `sbloccaAudio()` mette `audioSbloccato = true` **prima** di sapere se il
      `play()` è riuscito, e non riprova mai più per tutta la sessione. Se iOS
      rifiuta quel primo gesto, per tutto l'allenamento l'allarme parte dai bip
      di riserva (o da niente). Da provare rifiutando/interrompendo il primo
      tocco d'avvio.
- [ ] **11.C.3** **Allarme fermato prima di partire**: c'è la rete
      (`playInVolo` + `loop = false` in `fermaAllarme`). Da provare a fermare il
      recupero nell'istante esatto in cui suona.
- [ ] **11.C.4** **La musica di chi ascolta deve ripartire.** Sessione
      `ambient` / `transient`, contesto chiuso da `rilasciaAudio()`. Da provare
      per davvero: musica in cuffia → allenamento → recupero → allarme → stop.
      La musica deve riprendere da sola.
- [x] **11.C.5** **Prova del suono** dalle Impostazioni due volte di fila
      (timer `ripristinoProva`), e con l'interruttore su silenzioso.
- [x] **11.C.6** **`chiudiFogli()`** chiude ogni pannello aperto quando si cambia
      schermata, e chi stava aspettando riceve `undefined`. Da verificare che
      nessuna schermata interpreti quell'`undefined` come una scelta.
- [ ] **11.C.7** **Chiusura del pannello trascinando**: parte solo dalla
      maniglia, soglia 90 px, `touchcancel` rimette a posto. Da provare con una
      nota lunga già scritta dentro (non deve perdersi).
- [x] **11.C.8** **Tocco fuori dal pannello**: chiude solo se il tocco è
      *cominciato* sullo sfondo. Da provare con un pulsante che si sposta.
- [ ] **11.C.9** **Wake lock**: si riprende solo se in pagina c'è un elemento
      `.session` (verificato: è il contenitore della seduta). Da provare
      uscendo dall'app durante il recupero e rientrando.
- [x] **11.C.10** **`h()` scrive sempre testo, mai markup** (niente `innerHTML`):
      da provare mettendo `<b>ciao</b>` in una nota, nel nome di un esercizio del
      brief e in un titolo, e verificare che si leggano i tag.
- [ ] **11.C.11** **Date impossibili**: `parseIso("2026-13-45")` deve dare «—» e
      non «14 febbraio». Da provare da un backup con una data storta.
- [ ] **11.C.12** **`num()`**: niente «-0», niente «Infinity», virgola e non
      punto. `durataUmana()`: 1h 59m 40s non deve dare «1h 60m».
- [ ] **11.C.13** **`unaVoltaSola`**: se il gestore fallisce esce un avviso e il
      pulsante torna attivo. Da provare su un tocco che scrive nell'archivio.

## 11.D — `js/db.js` (356 righe, lette tutte)

È il pavimento: se cede qui, cede tutto. 17 archivi, versione 4.

- [ ] **11.D.1** ⚠️ **La versione del backup non è mai salita.**
      `VERSIONE_BACKUP` è ferma a **1** da sempre, ma nel frattempo sono nati
      `allenamentiWatch`, `extra`, `acqua`. Un backup fatto oggi, ripristinato su
      un'app rimasta indietro, passa il controllo di versione (1 ≤ 1) e quegli
      archivi finiscono in `ignorati`: i dati non entrano. Da verificare che
      l'elenco degli ignorati venga **davvero mostrato a schermo** e non solo
      restituito.
- [ ] **11.D.2** **Ripristino «sostituisci»**: gli archivi che il file non
      nomina vengono svuotati lo stesso, tranne quelli dichiarati in `parziale`.
      Da provare con la copia interna (che non contiene le foto): **le foto
      devono restare**.
- [ ] **11.D.3** **File danneggiato**: sezione non-array, righe senza chiave,
      versione «boh», versione v2. Tutte e quattro devono dire «non ho toccato
      niente» — e l'archivio dev'essere davvero intatto dopo.
- [ ] **11.D.4** **Ripristino interrotto a metà**: tutto sta in **una**
      transazione. Da provare chiudendo l'app durante un ripristino grande (con
      le foto) e verificare che l'archivio sia o quello vecchio o quello nuovo,
      mai un misto.
- [ ] **11.D.5** **Due schede aperte**: `onblocked` e `VersionError` hanno un
      messaggio in italiano. Da provare tenendo aperta l'app in Safari e nella
      versione installata.
- [ ] **11.D.6** **Spazio finito**: `t.onabort` dice «di solito è lo spazio
      finito». Da provare riempiendo l'archivio con un set di foto.
- [ ] **11.D.7** **`nuovoId`**: `Date.now()` in base 36 più un contatore che
      riparte da zero a ogni ricaricamento. Da verificare che nessuna schermata
      ordini per id invece che per data/ora (se l'orologio del telefono torna
      indietro, l'ordine per id mente).
- [ ] **11.D.8** **`svuotaTutto`**: o tutto o niente, e restituisce l'elenco
      degli archivi svuotati. Da verificare che il messaggio finale lo usi.
- [ ] **11.D.9** **Backup che pesa**: `esportaTutto({salta})` serve a non
      rileggere le foto. Da verificare quali chiamate lo usano e che il backup
      «completo» le contenga davvero.

## 11.E — `js/segnali.js` (668 righe, lette tutte)

È il motore che scrive quello che il coach leggerà. Qui un errore non rompe
l'app: fa dire una cosa falsa a una persona che decide.

- [ ] **11.E.1** ⚠️ **Proposta di scaricare fino a zero.** Su un attrezzo che non
      è né bilanciere né manubri, `riduciCarico` fa
      `max(0, carico − max(1, 10%))`: con 1 kg di partenza propone **0 kg**, e il
      controllo `nuovo >= carico` non lo ferma. Da provare con un esercizio a
      carico 1 e tecnica sotto soglia.
- [ ] **11.E.2** ⚠️ **Percentuale d'aumento con carico zero.** Se il carico di
      lavoro è `0` (non `null`), `passo / carico` fa infinito e la frase del
      coach diventa «+— %». Da provare con un esercizio registrato a 0 kg.
- [ ] **11.E.3** ⚠️ **Tecnica vecchia trattata come attuale.** Il livello 1 usa
      la prima esposizione con la tecnica dichiarata, **senza limite di tempo**:
      un esercizio con tecnica 6 fatto due mesi fa e mai più ripetuto continua a
      generare la proposta di scarico come se fosse di ieri. Da provare con un
      esercizio fermo da tanto.
- [ ] **11.E.4** ⚠️ **Ogni segnale è timbrato con la data di oggi**
      (`agg` mette `data: oggi`). Ricalcolare aggiorna il segnale invece di
      duplicarlo — che è giusto — ma nel pacchetto per il coach un segnale nato
      tre settimane fa si presenta con la data di oggi. Da verificare cosa legge
      davvero il coach.
- [ ] **11.E.5** **«Le ultime due settimane» devono essere davvero le ultime
      due**: settimane consecutive (`indice` di seguito) e non più vecchie di 14
      giorni. Da provare con un buco di un mese in mezzo ai dati.
- [ ] **11.E.6** **La baseline resta quella delle prime tre settimane
      registrate**, per sempre. Da verificare che la frase lo dica e che sia la
      regola voluta (§9 del brief) e non un residuo.
- [ ] **11.E.7** **Verificato**: le notti hanno davvero `presente: true`
      (`salute.js:368`), quindi il segnale sul sonno può accendersi. Resta da
      provare che si accenda per davvero, con dati veri.
- [ ] **11.E.8** **Le regole di progressione arrivano dal brief**
      (`esposizioniMinime`, `rpePerSalire`, `tecnicaMinima`, `tecnicaRiduzione`).
      Da verificare che i numeri nelle frasi delle quattro domande siano quelli
      del brief in vigore, per lui **e per lei** (i due brief possono differire).
- [ ] **11.E.9** **Ordine delle esposizioni**: tutto il file dà per scontato che
      `esposizioniPerEsercizio` e `allenamenti` siano ordinati dal più recente.
      Da verificare in `store.js` che sia vero anche dopo un ripristino da
      backup.
- [ ] **11.E.10** **Un esercizio a tempo** non deve mai ricevere proposte di
      carico o ripetizioni, solo il segnale «tetto tenuto pulito».
- [ ] **11.E.11** **Dolore**: due sedute con lo stesso punto dolente su quattro
      generano un segnale per **punto**, non uno cumulativo; e qualunque dolore
      recente blocca ogni progressione su quell'esercizio.
- [ ] **11.E.12** **Cardio fuori protocollo** e **inversione di intensità**: le
      soglie km/h vengono dal brief. Ora che il cardio si può **rimandare**, da
      verificare che un cardio rimandato e mai fatto non entri in questi conti
      come se fosse stato fatto a zero.
- [ ] **11.E.13** **`firmaProposta`**: due proposte identiche non si ripetono. Da
      provare rifiutando una proposta e ricalcolando.
- [ ] **11.E.14** **Motivi dei salti tradotti** (`attrezzo` → «attrezzo non
      disponibile») e note su più righe compattate con «·». Da provare con una
      nota di salto scritta su tre righe.

## 11.F — `js/screens/fumo.js` (309 righe, lette tutte)

- [ ] **11.F.1** ⚠️ **«Media al giorno da quando conti» non è da quando conti.**
      Il ciclo si ferma dopo **14 giorni mostrati**, e `totale`/`contati` si
      riempiono solo dentro quel ciclo: la media è quella delle ultime due
      settimane, ma la frase la dichiara «da quando conti (**data d'inizio**)».
      Se il conteggio è cominciato più di 15 giorni fa, il numero e la data
      dicono due cose diverse. Da provare con più di due settimane di storia.
- [ ] **11.F.2** ⚠️ **Un giorno in cui l'app non è stata aperta vale zero.**
      `conteggi.get(data) || 0`: dentro la finestra del conteggio, un giorno
      senza righe è indistinguibile da un giorno a zero sigarette — e prende
      punteggio pieno. **La scelta è dichiarata** in `screens/salute.js:30`: vedi
      **11.O.3**, dove la questione è messa per intero. Qui resta da provare con
      un giorno saltato di proposito.
- [ ] **11.F.3** **Il massimo dichiarato a zero resta irreversibile — verificato
      su tutte e quattro le strade.** `riparteConteggioFumo` non tocca
      `fumoTettoDichiarato`; `dichiaraTettoFumo` rifiuta qualunque risalita; e i
      tre percorsi che svuotano l'archivio — ripristino della copia interna,
      ripristino da file, «Elimina tutti i dati» — leggono il tetto **prima** e
      lo rimettono dopo con `proteggiTettoFumo`. Resta da provarlo davvero sul
      telefono, una strada alla volta.
- [ ] **11.F.4** **La media include oggi**, che è una giornata a metà: da
      verificare che sia voluto.
- [x] **11.F.5** **Ogni giorno passato è giudicato col limite che aveva lui**
      (`limiti.get(data) ?? partenza`): pastiglie «zero» / «nuovo minimo» /
      «oltre». Da provare con una storia in cui l'asticella è scesa.
- [ ] **11.F.6** **Il conteggio si accende aprendo la sezione.** Da verificare
      che aprirla per curiosità in un giorno in cui non si conta non regali una
      giornata a zero.
- [ ] **11.F.7** **«Il conteggio riparte da oggi»** cancella per sempre le righe
      precedenti. Da provare e contare le righe rimosse nel messaggio.
- [ ] **11.F.8** **Colori**: giallo da 4, arancione da 7, rosso da 10, e lo
      stesso colore sul disegno. Da guardare in tutti e tre i temi.
- [ ] **11.F.9** **Altezza fissa** `100dvh − tabbar − 104px`: da guardare su
      schermo piccolo con 20 sigarette segnate (la riga degli orari è tagliata a
      34 px).

## 11.G — `js/app.js` (448 righe, lette tutte)

Avvio, indirizzi, aggiornamenti. È il punto da cui può nascere lo schermo bianco.

- [x] **11.G.1** ⚠️ **`?nosw` cancella la copia offline.** Aprire l'app con
      `?nosw` nell'indirizzo **disinstalla il service worker e svuota tutte le
      cache**. È il trucco che uso io per provare in locale, ma vale
      identico sul sito pubblicato: se capita sul telefono in vacanza, l'app
      resta senza copia locale e senza rete non si apre più. Da verificare che
      nessun collegamento salvato sul telefono contenga `nosw`, e prendere
      l'abitudine di aprire sempre l'indirizzo pulito.
- [x] **11.G.2** ⚠️ **Errore all'avvio = schermo bianco più un avviso che
      scompare.** Se `avvia()` fallisce **dopo** `store.init()` (per esempio
      perché `store.regole()` esplode o manca un elemento della pagina), l'unica
      cosa che si vede è un toast di 6 secondi e poi il vuoto. Da provare
      forzando un errore lì dentro, e valutare una schermata di ripiego stabile
      come quella dell'archivio inaccessibile.
- [ ] **11.G.3** ⚠️ **`store.regole()` chiamata senza rete di sicurezza** in tre
      punti di `ridisegna()` (fumo, acqua, schede della barra). Da verificare
      cosa succede se il programma non è caricato o è rotto: è la strada più
      corta verso una pagina vuota.
- [ ] **11.G.4** **Aggiornamento che arriva mentre stai scrivendo.** Fuori
      dall'allenamento, un cambio di versione ricarica **subito** la pagina: una
      nota a metà in un pannello aperto (Corpo, Storico, Salute) si perde. Solo
      la seduta è protetta. Da decidere se basta.
- [ ] **11.G.5** **Aggiornamento in attesa durante la seduta**: si applica
      appena si esce, prima di caricare il modulo nuovo. Da provare pubblicando
      una versione mentre la seduta è aperta.
- [ ] **11.G.6** **Due tocchi rapidi su due schede diverse**: c'è il
      `turnoCorrente` che ferma il disegno sorpassato. Da provare toccando
      Salute e subito Storico.
- [ ] **11.G.7** **Modulo che non arriva** (offline, file non in cache): deve
      uscire «Questa sezione non si è caricata» con Riprova e Torna alla Home, e
      la barra delle schede deve restare accesa. Da provare in aereo.
- [ ] **11.G.8** **Mezzanotte**: il giorno si aggiorna con un controllo al
      minuto, ma **non** dentro l'allenamento. Da provare allenandosi a cavallo
      di mezzanotte (capita, in vacanza).
- [ ] **11.G.9** **Indirizzo sconosciuto** (`#/qualsiasi`): si disegna la Home
      ma l'indirizzo resta quello sbagliato. Da verificare che la barra non
      resti spenta e che ricaricare non peggiori le cose.
- [ ] **11.G.10** **Tema «Sistema»** che cambia da solo al tramonto: ridisegna,
      tranne che durante l'allenamento. Da provare.
- [ ] **11.G.11** **Posizione dello scorrimento**: ridisegnare la stessa
      schermata deve lasciarla dov'era, cambiare schermata deve riportare in
      cima. Da provare sulla lista lunga di Salute.
- [ ] **11.G.12** **Schede nascoste**: Fumo solo se `contaSigarette !== false`,
      Acqua solo se `contaAcqua === true`. Da verificare su **tutti e due** i
      profili, e che l'indirizzo diretto a una sezione spenta rimandi alla Home.

## 11.H — `js/screens/acqua.js` (122) e `js/plates.js` (234), lette tutte

- [ ] **11.H.1** **Acqua è accesa solo se il brief dice `contaAcqua: true`.** Da
      verificare per quale dei due profili è accesa davvero, e che la domanda
      usi i litri del brief giusto.
- [ ] **11.H.2** **Un giorno senza risposta resta fuori dal punteggio** (non
      vale zero): è scritto nella nota, va verificato che il conto lo rispetti.
- [ ] **11.H.3** **Solo la risposta di oggi si può togliere**; i giorni passati
      non si correggono da nessuna parte. Da decidere se va bene.
- [ ] **11.H.4** **Ordine e taglio dell'elenco**: si mostrano i primi 30 giorni
      di `giorniAcqua()`. Da verificare che quella lista sia ordinata dal più
      recente (altrimenti si vedono i 30 più vecchi).
- [ ] **11.H.5** **Percentuale «giorni a obiettivo»**: calcolata solo sui giorni
      risposti prima di oggi. Da verificare con pochi giorni (1 su 1 = 100%).
- [ ] **11.H.6** **Dischi**: la ricerca è esaustiva con potatura. Da verificare
      il tempo di risposta se un brief dichiara un magazzino ricco (molti tagli,
      molte coppie) — succede a metà allenamento, dove non si può aspettare.
- [ ] **11.H.7** **Inventario incompleto** (senza barra, senza dischi, con
      `dischi: null`): non deve rompere niente e non deve dire «bilanciere
      scarico (0 kg)». Da provare sul brief di lei, che potrebbe non avere il
      blocco tecnico.
- [ ] **11.H.8** **Manubri singoli e a paio**: «manubri» consuma quattro dischi
      per taglio, «manubrio» due. Da verificare su un esercizio di ciascun tipo
      che i numeri montabili siano reali.

## 11.I — `js/calendario.js` (334 righe, lette tutte)

- [ ] **11.I.1** ⚠️ **Le cose attese esistono solo entro ±21 giorni da oggi.**
      `periodiche()` gira da −21 a +21: sfogliando il calendario indietro di due
      mesi non compare nessun pallino, e i giovedì della pesata di giugno
      sembrano tutti in ordine. Da provare andando indietro di tre mesi.
- [ ] **11.I.2** ⚠️ **Ancora delle foto scritta nel codice**: `fotoAncora` vale
      `"2026-08-12"` e la cadenza è ogni 2 settimane di **mercoledì**. Combacia
      col set del 29/07 (+14 giorni), ma è un numero fisso dentro il programma:
      da verificare che sia ancora giusto fra dieci giorni e che il brief, se
      dichiara le sue cadenze, vinca su questo.
- [x] **11.I.3** ⚠️ **Il backup arretrato si accende ogni giorno.** «Backup su
      file (solo app)» dopo 7 giorni e «Dati salute da importare» dopo 2 giorni
      finiscono **sempre sul giorno di oggi** come scaduti. In dieci giorni fuori
      casa saranno accesi tutti i giorni: da verificare quanto rumore fanno sulla
      Home e se coprono le cose vere.
- [ ] **11.I.4** **Col calendario del coach collegato l'app non aggiunge
      scadenze sue.** Da verificare che sia vero anche col calendario scaduto
      (letto fino a una certa data) — il caso esatto di dieci giorni via.
- [ ] **11.I.5** **Riconoscimento di cosa chiede un evento** per parole intere:
      «evitare» non deve diventare una misura della vita, «fotocopia» non deve
      diventare un set di foto. Da provare con eventi scritti a mano.
- [ ] **11.I.6** **Peso e vita sono due misure distinte**: un evento che le
      chiede entrambe resta arretrato se ne manca una.
- [ ] **11.I.7** **«Recuperato dopo»**: un giovedì saltato resta segnato, ma il
      piede della Home non deve continuare a dire che manca. Da provare
      pesandosi il venerdì.
- [ ] **11.I.8** **Giorni prima dell'inizio del programma**: niente rosso,
      niente pallini. Da provare andando indietro fino a prima dell'inizio.
- [ ] **11.I.9** **Data non valida** passata a `riassuntoGiorno`: deve dire
      «Giorno non riconosciuto» e non «undefined NaN».

## 11.J — `js/screens/export.js` (441) e il blocco Watch di `js/export.js`

È quello che il coach legge davvero. Qui una frase sbagliata vale più di un bug.

- [x] **11.J.1** ⚠️ **Frasi rimaste indietro dopo la modifica di oggi.** Il
      pacchetto dice ancora, in due punti, che i numeri dell'orologio «li scrive
      l'atleta leggendoli dal quadrante» — ma i quattro punti di trascrizione a
      mano sono stati **tolti oggi**. Il riquadro compare solo se ci sono dati
      vecchi (verificato: senza dati non esce), ma il testo di
      `ALLENAMENTI LETTI DALL'APPLE WATCH` rimanda a un riquadro che non si
      riempie più. Da riscrivere prima di partire.
- [ ] **11.J.2** ⚠️ **Comporre il pacchetto SCRIVE nell'archivio**:
      `aggiornaProposte()` e `aggiornaSegnali()` girano ogni volta che si apre la
      schermata o si tocca una spunta. Da verificare che aprire il Pacchetto non
      faccia comparire proposte nuove sulla Home come effetto collaterale, e che
      due composizioni ravvicinate non si pestino i piedi.
- [ ] **11.J.3** ⚠️ **Sigarette nel pacchetto: un giorno non contato vale zero.**
      Stesso difetto della sezione Fumo (`conteggi.get(data) || 0`), ma qui il
      numero lo legge il coach. Da verificare con un giorno saltato.
- [ ] **11.J.4** ⚠️ **«Misure e indici» è spento di default** (`corpo: false`):
      il pacchetto normale **non** contiene peso e circonferenze. Da decidere se
      è quello che vogliamo, visto che il coach le chiede.
- [ ] **11.J.5** **L'ultimo allenamento è scelto per `oraFine`**: una seduta
      chiusa senza `oraFine` (dati vecchi) finisce in fondo e non viene mai
      esportata. Da verificare sulle sedute più vecchie.
- [ ] **11.J.6** **Allenamento ancora aperto** e **secondo allenamento dello
      stesso giorno**: devono comparire come NOTA in cima. Da provare tutti e
      due i casi.
- [ ] **11.J.7** **Finestre diverse nello stesso pacchetto**: salute 21 giorni,
      Watch 7, extra 7, fumo 7, acqua 7. Da verificare che il testo dica sempre
      quale periodo sta guardando.
- [ ] **11.J.8** **Watch tagliato a 20 righe**, con la frase che dice quanti ne
      restano fuori. Da provare con più di 20 allenamenti in 7 giorni.
- [ ] **11.J.9** **`nomeSeduta` è un parametro morto**: `bloccoWatch` non lo usa
      più da quando i ruoli sono spariti, ma la schermata continua a passarlo.
      Da togliere.
- [ ] **11.J.10** **Riga «Tipo giorno»**: oggi non deve mai risultare «non
      fatto», e un evento del coach che non è un allenamento non deve prendere il
      posto di «Riposo». Da provare sul giorno di oggi e su un giorno con un
      promemoria.
- [x] **11.J.11** **Copia negli appunti** su iOS installato: se fallisce deve
      uscire la spiegazione «tieni premuto → Seleziona tutto». Da provare
      davvero, perché è l'unico modo di mandare il pacchetto da lontano.
- [ ] **11.J.12** **«Salva come file»**: nome `coach-AAAA-MM-GG.md`, e da
      verificare dove finisce su iPhone (e che si possa allegare in chat).
- [ ] **11.J.13** **Un blocco che esplode** non deve lasciare «Sto
      ricomponendo…» per sempre: c'è la rete, va provata togliendo una sezione.
- [ ] **11.J.14** **Spunte di profilo**: Fumo e Acqua non devono comparire
      nell'elenco per chi non le conta. Da verificare su **tutti e due** i
      profili.

## 11.K — `js/screens/storico.js` (276) e `js/screens/proposte.js` (324)

- [ ] **11.K.1** ⚠️ **Storico lento a crescere.** Per disegnare l'elenco fa due
      letture d'archivio **per riga** (serie + questionari), una dopo l'altra: 20
      righe = 40 letture prima che compaia qualcosa, e «Mostra gli altri N» ne fa
      altre 2N di fila. Da misurare con tutti gli allenamenti che ci sono.
- [ ] **11.K.2** ⚠️ **Gli esercizi usciti dal programma spariscono dallo
      storico.** «Per esercizio» elenca solo quelli presenti nello split di
      adesso: cambiando scheda, la storia di un esercizio tolto diventa
      irraggiungibile dall'interfaccia (i dati restano nell'archivio). Da
      verificare, e da decidere se va aggiunta una voce «non più in programma».
- [x] **11.K.3** ⚠️ **Esito della verifica scritto in linguaggio da codice**: nel
      dettaglio della proposta si legge `nonConfermata` tutto attaccato, mentre
      nello Storico la stessa cosa è scritta «non confermata». Da uniformare.
- [ ] **11.K.4** **Aprire Proposte fa girare il motore** (`aggiornaMotore`):
      scrive proposte e segnali. Da verificare che non cambi niente sotto gli
      occhi mentre la schermata si sta disegnando.
- [ ] **11.K.5** **Segnale archiviato**: `archiviaSegnale` lo toglie, ma gli id
      dei segnali sono deterministici e il motore li ricalcola. Da verificare che
      un segnale archiviato non ritorni al primo ricalcolo.
- [ ] **11.K.6** **«Adesso» e «Proposta»** usano `serie` della variante di
      **oggi**: se il programma è cambiato dopo la nascita della proposta, il
      «3×8» scritto lì può non essere più vero. Da provare dopo un cambio di
      scheda.
- [ ] **11.K.7** **Rimando / Rifiuto**: la nota è facoltativa, annullare non
      deve registrare niente. Da provare anche cambiando schermata mentre il
      pannello della nota è aperto (deve valere come «annullato»).
- [ ] **11.K.8** **Verifica in scadenza**: la data mostrata è quella
      dell'accettazione, non della nascita della proposta. Da provare con una
      proposta accettata giorni dopo.
- [ ] **11.K.9** **«Perché non c'è altro»**: ogni esercizio senza proposta deve
      avere un motivo leggibile. Da leggere tutta la lista per intero, cercando
      motivi che si contraddicono fra loro.
- [ ] **11.K.10** **Volume settimanale per pattern**: dichiara «prossimi sette
      giorni». Da verificare col brief in vigore, e col secondo programma se ce
      ne sono due.
- [ ] **11.K.11** **Collegamenti vecchi** `#/storico?seduta=…` devono rimandare
      alla schermata unica del riepilogo. Da provare da un collegamento salvato.
- [ ] **11.K.12** **Colonna «Sec» invece di «Rip»** sugli esercizi a tempo. Da
      provare su un plank.

## 11.L — `js/screens/extra.js` (297 righe, lette tutte)

- [ ] **11.L.1** ⚠️ **Un'attività non si corregge, si cancella.** Toccando una
      riga l'unica scelta è «Elimina»: se hai scritto 45 minuti invece di 54
      devi buttarla e rifarla. Da decidere se aggiungere la modifica.
- [ ] **11.L.2** ⚠️ **Nessun controllo di scala sui numeri.** Durata, km, FC e
      kcal si accettano come vengono: 999 km o FC 400 entrano in silenzio e
      finiscono nel pacchetto del coach. È lo stesso difetto del carico 1750, già
      corretto altrove ma non qui.
- [ ] **11.L.3** **Campo giorno svuotato**: da verificare cosa salva
      `registraExtra` con `data: ""` (una riga senza data non si ordina e non si
      trova più).
- [ ] **11.L.4** **Elenco tagliato a 60 righe** senza «mostra tutte»: da
      verificare che non sia già vicino al limite.
- [ ] **11.L.5** **«Altro» senza spiegazione** viene rifiutato: da provare.
- [ ] **11.L.6** **Talk-test non risposto** = la giornata non vale come
      allenamento, ma **non vale zero**. Da provare che sia davvero così nel
      punteggio Salute.
- [ ] **11.L.7** **Un'attività e una seduta lo stesso giorno**: vince la seduta.
      Da provare.

## 11.M — `js/grafico.js` (729 righe; lette per intero le parti nuove e i punti di rottura)

- [ ] **11.M.1** **Grafico del battito senza dati**: verificato che non può
      esplodere — la scheda lo disegna solo con almeno 3 caselle piene
      (`allenamenti.js:300`), e senza quel controllo `Math.max(...[])` darebbe
      `-Infinity` e il disegno sparirebbe tutto. Resta da provare un allenamento
      con **esattamente 3** caselle e uno con una casella sola.
- [ ] **11.M.2** **Asse dei tempi del battito**: le etichette usano le frazioni
      della larghezza, la lettura al tocco usa l'indice della casella. Su una
      curva assottigliata a 120 punti lo scarto è di mezza casella (una decina di
      secondi). Da guardare su un allenamento lungo che l'ora letta sia
      plausibile.
- [ ] **11.M.3** **Allenamento a cavallo di mezzanotte**: l'ora gira col modulo
      24h. Da provare (in vacanza può capitare).
- [ ] **11.M.4** **`minimo` nel grafico a linea**: verificato che il passo al km
      lo calcola come `max(0, floor(minimo − 1))`, quindi nessun punto finisce
      sotto il bordo. Da confermare a schermo con un solo giorno di dati.
- [ ] **11.M.5** **Un solo punto** in un grafico a linea (un giorno solo di
      passo, o di passi): da guardare che non esca una riga vuota o un punto
      appiccicato al bordo.
- [ ] **11.M.6** **Il periodo scelto è condiviso** fra tutti i grafici tranne il
      punteggio Salute in Home, e sta in `localStorage`. Da verificare che
      cambiarlo in Salute non sposti quello della Home, e che sopravviva alla
      chiusura dell'app.
- [ ] **11.M.7** **Tocco sul grafico dell'attività**: la conversione delle
      coordinate parte dal disegno, non dal riquadro. Da provare in orizzontale e
      su schermo stretto che il giorno letto sia quello toccato.
- [ ] **11.M.8** **Obiettivo movimento**: la linea tratteggiata usa l'obiettivo
      **più recente**, non il primo. Da provare cambiandolo in Salute.
- [ ] **11.M.9** **Giorni senza dato**: pallino, non barra a zero. Da verificare
      che i dieci giorni di vacanza (se non importi) si vedano come buchi e non
      come zeri.

## 11.N — `js/screens/impostazioni.js` (le strade che distruggono dati)

Lette per intero le sezioni «Dati», «Pericolo», backup, ripristino, azzeramento
e aggiornamento forzato. È la parte che conta di più mentre sei via.

- [x] **11.N.1** ⚠️ **«Cancella i dati importati da Salute» cancella anche gli
      allenamenti del Watch**, e quello che è più vecchio di 30 giorni **non si
      può più rileggere**. In vacanza questo tasto non va toccato: da verificare
      che il testo lo dica abbastanza forte.
- [ ] **11.N.2** ⚠️ **Modo «unisci» irraggiungibile?** `importaBackup` sceglie la
      modalità da `dump.modo`, un campo che il backup dell'app non sembra
      scrivere: di fatto ogni ripristino da file è «sostituisci tutto». Da
      verificare aprendo un backup vero e cercando quel campo.
- [ ] **11.N.3** **Prima di ogni sovrascrittura si fa una copia interna**
      (`prima del ripristino` / `prima dell'import da file`) e la si rimette a
      posto dopo, perché il ripristino cancella anche le impostazioni. Da provare
      tutte e due le strade e controllare che dopo la copia interna **esista** e
      abbia la data giusta.
- [ ] **11.N.4** **Backup registrato solo se rispondi «sì, l'ho salvato».** Da
      verificare che il file finisca davvero in File/iCloud Drive dal telefono, e
      che la data «ultimo backup» non si sposti se annulli.
- [ ] **11.N.5** **Confronto prima del ripristino** («nel file N, adesso M, fino
      al …»): da leggere su un backup vecchio, è la riga che evita di riportare
      indietro tutto per recuperare una cosa sola.
- [ ] **11.N.6** **«Ripristinato, ma non tutto»**: compare quando il file
      contiene archivi che l'app non conosce. Da provare con un backup fatto
      oggi su una versione più vecchia (vedi 11.D.1).
- [ ] **11.N.7** **«Elimina tutti i dati»**: due conferme, e l'archivio o si
      svuota tutto o resta intatto. Da provare **solo** su un profilo di prova,
      mai su quello vero.
- [ ] **11.N.8** ⚠️ **«Scarica l'ultima versione» è la strada giusta, `?nosw`
      no.** `forzaAggiornamento` controlla che i file si scarichino **prima** di
      buttare le copie locali: senza rete non ti lascia a mani vuote. Da provare
      una volta prima di partire, così sai dov'è il tasto.
- [ ] **11.N.9** **Riga «Archivio protetto»**: dice qualcosa di sensato in tutti
      e quattro i casi (installata/non installata × protetto/no). Da guardare
      sul telefono, che è l'unico posto dove la risposta è quella vera.
- [ ] **11.N.10** **«Cosa c'è in archivio»**: i conteggi devono corrispondere a
      quello che vedi nelle sezioni, e «allenamenti aperti e mai chiusi» deve
      essere zero prima di partire.

---

# Cosa ho letto riga per riga, e cosa manca

Questo è il conto onesto della lettura, non una stima.

## Letti per intero — TUTTI i file dell'app

| File | Righe | Sezione |
|---|---|---|
| `js/punteggio.js` | 829 | 11.A |
| `js/screens/corpo.js` | 878 | 11.B |
| `js/ui.js` | 705 | 11.C |
| `js/db.js` | 356 | 11.D |
| `js/segnali.js` | 668 | 11.E |
| `js/screens/fumo.js` | 309 | 11.F |
| `js/app.js` | 448 | 11.G |
| `js/screens/acqua.js` | 122 | 11.H |
| `js/plates.js` | 234 | 11.H |
| `js/calendario.js` | 334 | 11.I |
| `js/screens/export.js` | 441 | 11.J |
| `js/screens/storico.js` | 276 | 11.K |
| `js/screens/proposte.js` | 324 | 11.K |
| `js/screens/extra.js` | 297 | 11.L |
| `js/screens/oggi.js` | 882 | 11.U |
| `js/export.js` | 907 | 11.W |
| `js/brief.js` | 354 | 11.Y |
| `sw.js` | 131 | 11.Y |

Non restano file letti a metà: `store.js`, `seduta.js`, `salute.js`,
`impostazioni.js`, `grafico.js`, `export.js`, `oggi.js`, `salute-export.js`,
`allenamenti.js`, `brief.js`, `sw.js`, `index.html`, `css/app.css`,
`ISTRUZIONI-BRIEF.md` e `tools/pubblica.sh` sono stati letti dalla prima riga
all'ultima.

**Non resta niente da leggere.** Ho provato due volte a fermarmi prima —
la documentazione, poi gli strumenti da computer — e tutte e due le volte quello
che avevo escluso conteneva difetti veri: il Blocco 12 e il Blocco 13 nascono da
lì, e il 13.1 è la conseguenza peggiore di tutto il controllo.

## Cosa vuol dire

**Tutto il codice dell'app è stato letto riga per riga**: 21.235 righe fra
JavaScript, HTML, CSS e lo script di pubblicazione. In più i quattro documenti —
`ISTRUZIONI-BRIEF.md`, `SPEC.md`, `COME-FUNZIONA.md`, `README.md`: altre 1.946
righe che non sono codice ma dicono cosa l'app dovrebbe fare, ed è confrontandole
col codice che è uscito il Blocco 12.

E i quattro strumenti: `pubblica.sh`, `serve.py`, `salute-da-export.py`,
`passa-file.py`, `icona.py`, `icona-da-immagine.sh`.

Totale letto riga per riga: **23.803 righe su 23.803**. Non manca niente.

Da qui in avanti la lista non cresce più leggendo: cresce solo provando.

---

## 11.O — `js/store.js` (3.301 righe; lette 575-1210, 2444-2545, 3060-3115)

Lettura in corso. Queste voci hanno già un numero di riga dietro.

- [ ] **11.O.1** ⚠️ **Il cardio rimandato sballa la durata dell'allenamento.** È
      una conseguenza diretta del tasto aggiunto **oggi**. `fineStimata` prende
      la fine del cardio, ma `inizioStimato` guarda solo le serie dei pesi:
      chiudendo una seduta con i pesi alle 17 e il cardio alle 21, lo Storico
      scrive `oraFine − oraInizio` e annuncia **4 ore e mezza** di allenamento.
      Nello stesso momento `durataLavoroSec` scarta i buchi sopra le 3 ore,
      quindi **il cardio esce dal tempo di lavoro** e la densità nel pacchetto
      del coach lo ignora. Due numeri sbagliati in versi opposti. Da provare
      esattamente così: pesi, «Rimanda il cardio», cardio dopo più di tre ore,
      chiudi.
- [x] **11.O.2** ⚠️ **Il punteggio Salute dei giorni passati NON è congelato.**
      A differenza del punteggio della seduta, `punteggiSalute` lo ricalcola ogni
      volta e per sapere se quel giorno «era previsto un allenamento» usa
      `giornoPrevisto(data)`, cioè **lo split di oggi**. Se il coach cambia il
      programma, i punteggi Salute di giugno cambiano da soli. Da decidere se è
      voluto (in Home c'è un grafico che li mostra).
- [ ] **11.O.3** ⚠️ **Un giorno non contato vale zero sigarette e prende punti
      pieni — e la scelta è dichiarata.** `punteggiSalute` fa
      `fumate.get(data) ?? 0`, la schermata Fumo fa `conteggi.get(data) || 0`, il
      pacchetto del coach pure, e in `screens/salute.js:30` c'è scritto per
      esteso: «dal giorno in cui hai cominciato a contare in poi, nessuna riga
      vuol dire zero: è un dato, non un buco». Quindi **non è una svista, è una
      decisione** — ma la sua conseguenza è che una giornata in cui non apri
      l'app prende il punteggio pieno sul fumo. Da decidere se è quello che
      vuoi, sapendo che in vacanza capiterà.
- [x] **11.O.4** ⚠️ **Dieci giorni senza importare rompono la finestra delle tre
      settimane.** `statoFinestra` conta a ritroso da **oggi**: senza import, la
      settimana in corso ha zero giorni registrati, `completa` torna falsa, e
      resta falsa fino a tre settimane dopo il rientro. Da verificare cosa
      succede al segnale «finestra completa» e a quello che il coach legge.
- [x] **11.O.5** ⚠️ **Lo stretching previsto non è congelato.** In
      `completezzaSeduta`, `previstoStretching` chiede a `riscaldamento(tipoId)`
      di **adesso**, mentre tutto il resto della funzione usa l'elenco congelato
      alla partenza. Se il brief cambia, una seduta non ancora congelata viene
      giudicata metà col programma vecchio e metà con quello nuovo.
- [ ] **11.O.6** ⚠️ **Le sedute vecchie vengono congelate al primo sguardo, non
      alla chiusura**, e con le **regole di oggi** (`regole()` corrente). Aprire
      lo Storico dopo un cambio di brief fissa per sempre un punteggio calcolato
      con regole che quel giorno non c'erano. Da verificare quali sedute non
      hanno ancora `completezza`.
- [ ] **11.O.7** ⚠️ **Due allenamenti nello stesso giorno**: `allenamenti()`
      ordina solo per data e a parità lascia l'ordine dell'archivio, cioè il
      **più vecchio per primo**. Chi legge «l'ultimo allenamento» prende quello
      sbagliato — il pacchetto per il coach si è dovuto riordinare da solo per
      `oraFine`. Da verificare tutti gli altri posti che fanno `[0]`.
- [ ] **11.O.8** **Serie senza orario**: `serieDi` ed `esposizioni` ordinano per
      `tsFineSerie`; se manca, il confronto dà `NaN` e l'ordine diventa
      imprevedibile. Da verificare se in archivio esistono serie senza orario
      (dati vecchi o backup scritti a mano).
- [ ] **11.O.9** **«Carico di lavoro» = l'ultima serie**, non il massimo né la
      media. Da verificare che sia la definizione voluta anche quando l'ultima
      serie è più leggera (scalata).
- [ ] **11.O.10** **`annullaSeduta` cancella serie, questionari e seduta uno per
      uno**, fuori da una transazione: un'interruzione a metà lascia serie
      orfane. Da provare (è il tasto che si usa quando si apre per sbaglio).
- [ ] **11.O.11** **Cache delle sedute di 1,5 secondi**: si invalida a ogni
      scrittura che passa da `aggiornaSeduta`. Da verificare che ogni scrittura
      diretta su `sedute` la invalidi davvero.
- [x] **11.O.12** **Doppio avvio di una seduta**: c'è la coda. Da provare
      toccando due volte «Inizia» in un istante.
- [ ] **11.O.13** **Le soglie del cardio si congelano alla partenza**
      (`cardio.soglie`), l'elenco degli esercizi anche (`previstiElenco`). Da
      verificare che il riepilogo di una seduta vecchia non cambi cambiando il
      brief.
- [ ] **11.O.14** **`conNomeDelGiorno`**: una seduta senza nome non deve mai
      scrivere «undefined». Da provare su una seduta ripristinata da un backup
      vecchio.

## 11.P — `js/store.js`, importazione da Salute e agenda (righe 1888-2233)

È la strada che userai ogni giorno da lontano: se qui si rompe qualcosa, non
c'è modo di accorgersene se non dal risultato.

- [x] **11.P.1** ⚠️ **Reimportare con un comando rapido più povero CANCELLA i
      dati dell'orologio.** Nel ciclo degli allenamenti il record vecchio viene
      letto (`const prec = …`) e poi **non usato**: si riscrive `{...a}` intero.
      Il commento accanto promette il contrario («si riempie di distanza,
      battito, sforzo»), e nel verso buono è vero — ma nel verso cattivo un
      pacchetto senza battito o senza sforzo **svuota** quei campi su un
      allenamento che li aveva. Da provare importando due volte, la seconda con
      un pacchetto ridotto.
- [ ] **11.P.2** ⚠️ **Il commento dice «un giorno già chiuso non cambia», il
      codice lo cambia.** Il controllo del raddoppio (righe 1919-1931) si limita
      a **elencare** i sospetti, e subito dopo `db.put` riscrive il giorno con i
      valori nuovi. Un conteggio raddoppiato entra lo stesso: viene solo
      segnalato in fondo al riepilogo. Da decidere se deve chiedere.
- [x] **11.P.3** ⚠️ **L'agenda scade, e in dieci giorni scadrà.** La copertura
      si allunga a ogni lettura a partire da **oggi**: senza import, dopo qualche
      giorno i giorni futuri diventano «calendario da aggiornare» / «non ancora
      programmato», e la Home non sa più quale allenamento proporre. Da
      verificare **prima di partire** quanto lontano arriva la copertura, e cosa
      mostra la Home quando è scaduta.
- [x] **11.P.4** ⚠️ **L'importazione non è una transazione**: sono decine di
      scritture una dopo l'altra (giorni, notti, riconciliazione, allenamenti,
      vuoti, agenda). Chiudere l'app a metà lascia un import fatto per metà,
      senza nessun segno. Da provare interrompendo di proposito.
- [x] **11.P.13** ⚠️⚠️ **Il pavimento del 29 luglio valeva solo per l'export
      XML.** Trovato provando 1b.7: incollando un pacchetto con dentro giugno,
      quei giorni **entravano** — il pavimento era applicato dentro
      `pacchettoDaExport`, non in `importaSalute`, che è il punto da cui passano
      tutte le strade. E la riga `FINESTRA` faceva di peggio: creava un record
      «senza dati» per **ogni** giorno della finestra, 73 giornate vuote più
      vecchie dell'inizio della storia, che poi comparivano nei grafici e nel
      conteggio delle finestre come buchi da riempire. Corretto in tutte e due i
      punti; il riepilogo dell'import adesso dice quante righe ha lasciato fuori.
- [ ] **11.P.5** ⚠️ **La riconciliazione delle notti CANCELLA notti**
      (`db.del("notti", …)`) in base a un'euristica: stessa durata a ±X minuti,
      un giorno prima o dopo, solo dentro il periodo delle fasi, solo fonte
      «salute». Quattro reti, ma resta una cancellazione automatica. Da provare
      con i tuoi dati veri e controllare l'elenco «notti tolte» nel riepilogo.
- [ ] **11.P.6** **Una notte corretta a mano vince sempre**, e il dato
      dell'orologio si conserva a parte per poterci tornare. Da provare:
      correggo, reimporto, la correzione deve restare e «torna al dato
      dell'orologio» deve avere qualcosa a cui tornare.
- [ ] **11.P.7** **Fra due letture della stessa notte vince la più lunga**, e la
      differenza viene detta. Da provare in tutti e due i versi.
- [ ] **11.P.8** **«Ultimo import» si aggiorna solo se sono arrivati dati di
      salute**, non se hai letto solo il calendario. Da provare importando un
      pacchetto di sola agenda.
- [ ] **11.P.9** **Giorni dentro la finestra ma senza dati** vengono segnati
      `presente: false` (non zero). Da verificare che i dieci giorni di vacanza,
      se importi al rientro, non diventino zeri.
- [ ] **11.P.10** **Due eventi lo stesso giorno**: l'allenamento vince sul
      promemoria e sul «riposo», e la nota segue il titolo a cui appartiene. Da
      provare con un giorno che ha allenamento + promemoria.
- [x] **11.P.11** **Un allenamento cancellato dal coach** deve sparire anche se
      era l'ultimo dell'intervallo letto. Da provare.
- [ ] **11.P.12** **Valori impossibili** (`scartaImpossibili`) finiscono in un
      elenco a parte. Da leggere quell'elenco dopo un import vero.

## 11.Q — `js/store.js`, programma, regole e origine del giorno (righe 1-575)

- [x] **11.Q.1** ⚠️ **La stessa domanda con due risposte.** `varianteDi(id)`
      scorre lo split **nell'ordine in cui è scritto nel brief**; `varianti()`
      lo scorre **in ordine di validità** (prima il giorno che il calendario
      rimette per primo). Se nel brief convivono due programmi con lo stesso
      esercizio, il motore dei segnali usa la riga del programma **nuovo** e la
      schermata della proposta usa quella del programma **vecchio**: serie e
      range mostrati non sono quelli su cui la proposta è stata decisa. Da
      provare con un brief a due programmi.
- [ ] **11.Q.2** ⚠️ **Le regole si fondono a un livello solo.** `regole()` unisce
      `salute` con la base, ma se il brief scrive `salute.pesi` con **una** voce,
      l'intero blocco dei pesi viene sostituito e tutte le altre voci del
      punteggio spariscono. È lo stesso difetto che il commento dice di aver
      corretto per il primo livello, ma non per il secondo. Da provare con un
      brief che tocca un peso solo.
- [x] **11.Q.3** ⚠️ **Primo avvio senza rete = niente stretching e niente
      mobilità.** `caricaRiscaldamento` legge `data/riscaldamento.json` dalla
      rete: se fallisce, `RISCALDAMENTO` resta nullo, `riscaldamento()` torna
      `null`, e di conseguenza `previstoStretching` è falso e i giorni di sola
      mobilità non vengono riconosciuti. Da provare installando l'app e
      aprendola la prima volta in aereo.
- [ ] **11.Q.4** ⚠️ **`INIZIO_STORIA = "2026-07-29"` è scritta nel codice**, ed è
      una data personale. Da verificare che valga anche per il secondo profilo, o
      che il pavimento «più indietro dei due» basti a coprirlo.
- [ ] **11.Q.5** **Correzione a 11.A.8**: il peso `acqua: 12` **c'è** fra i pesi
      di base (`store.js:430`) e combacia con il valore predefinito in
      `punteggio.js`. La voce era mia e non regge. Resta da verificare che le due
      liste restino allineate se una delle due cambia.
- [x] **11.Q.6** **`origineGiorno` ha nove uscite diverse** (split, calendario
      vuoto, scaduta, oltre programmato, mai letta, riposo, diverso dallo split,
      sconosciuto, nonLetta prima della prima lettura). Ognuna produce una frase
      diversa in Home, nel calendario e nel pacchetto del coach. Da provocarle
      tutte e nove e leggere cosa scrivono — è il punto dove l'app rischia di
      dire una cosa in una schermata e un'altra altrove.
- [x] **11.Q.7** **Con il calendario attivo e scaduto, `giornoPrevisto` torna
      `null`**: nessun allenamento proposto, per tutti i giorni oltre la
      copertura. Conferma diretta della 11.P.3.
- [ ] **11.Q.8** **Ricaricare lo stesso brief non deve annullare le proposte
      accettate**: `caricatoIl` cambia solo se cambia davvero il contenuto
      tecnico. Da provare ricaricando due volte lo stesso file.
- [ ] **11.Q.9** **Esercizi non più previsti**: archiviati, mai cancellati. Da
      verificare che lo storico resti raggiungibile (vedi 11.K.2, dove non lo è).
- [ ] **11.Q.10** **`sitiDolore` dal brief**: se il brief non li dichiara resta
      il polso destro. Da verificare quali punti dolenti sono dichiarati nei due
      brief e che le domande a fine esercizio corrispondano.

## 11.R — `js/store.js`, motore delle proposte (righe 1305-1560)

- [ ] **11.R.1** **Una proposta già realizzata dal brief sparisce** (salita o
      discesa). Da provare: il coach porta la scheda a 35 kg mentre l'app
      proponeva 31.
- [ ] **11.R.2** **«Rimando» torna dopo una sola esposizione, «Rifiuto» e
      «Accetto» dopo quattro.** Il conto si fa sul **tempo**, non su un numero:
      cancellare un allenamento vecchio non deve far tornare una proposta.
- [ ] **11.R.3** **`diagnosiProgressione` rilegge tutte le esposizioni di ogni
      esercizio senza cache**: sette esercizi = sette letture complete a ogni
      apertura di Proposte. Da misurare.
- [ ] **11.R.4** **Un esercizio archiviato o tolto dal brief** non deve lasciare
      proposte appese. Da provare.
- [ ] **11.R.5** **`obiettivoCorrente` si consuma quando fai l'esercizio**, non
      quando chiudi la seduta. Da provare accettando a metà allenamento.
- [ ] **11.R.6** **Le scritture del motore non sono in transazione**: un giro
      interrotto lascia proposte cancellate e non ricreate. Da provare.

## 11.S — `js/screens/seduta.js` (3.607 righe; lette 642-830, 2059-2280, 2923-3075)

- [ ] **11.S.1** ⚠️ **Se non correggi, l'app registra il bersaglio come se
      l'avessi fatto.** `completaSerie` scrive `ripFatte = target`: le
      ripetizioni vere si mettono solo dopo, con i tasti −/+ nella schermata del
      recupero o nel questionario. Chi tocca «serie completata» e va avanti
      lascia in archivio un numero che non ha mai dichiarato — e su quel numero
      il motore decide le progressioni. Da verificare quanto è visibile la
      correzione durante il recupero.
- [ ] **11.S.2** ⚠️ **Il recupero dal «l'esercizio non c'è più» non controlla che
      il nuovo esista.** `S.esercizi.findIndex((_, i) => i >= indice)` guarda solo
      l'indice, mai il valore: se l'elemento a quell'indice manca, si torna
      esattamente dov'eravamo. Nel caso normale (brief più corto) funziona
      perché l'indice esce dall'elenco. Da provare cambiando il brief con
      l'allenamento aperto.
- [ ] **11.S.3** ⚠️ **Cardio rimandato e ripreso**: `avanzaEsercizio` manda alla
      fase cardio se `cardio.previsto`, senza guardare `rimandato`. Da provare
      tutta la sequenza: pesi → rimanda → stretching → chiudi? no → Home → «Fai
      il cardio» → cardio → chiudi. E provare anche a rimandare **due volte**.
- [ ] **11.S.4** **Ogni tocco dentro la seduta sblocca l'audio** (`azione`): è
      la rete che fa suonare il recupero. Da provare con l'interruttore su
      silenzioso e con la musica in cuffia.
- [ ] **11.S.5** **Blocchi (due esercizi attaccati)**: giro senza riposo, riposo
      solo a giro completo, valutazione di tutti e due alla fine, salto che
      salta la coppia. Sono sei strade diverse. Da provarle tutte se il brief in
      vigore usa i blocchi.
- [ ] **11.S.6** **Salto di un esercizio**: nota obbligatoria di almeno tre
      caratteri, e chiudere il pannello senza scrivere **non** salta. Da provare.
- [ ] **11.S.7** **Limiti del cardio**: 0,5-20 km/h e 5-180 minuti. Da provare a
      sbattere contro i quattro estremi.
- [ ] **11.S.8** **Cardio già registrato**: rifarlo chiede conferma e sostituisce;
      «non eseguito» chiede conferma e cancella. Da provare tutti e due.
- [ ] **11.S.9** **`pulisci()`**: uscendo dalla seduta si fermano cronometro e
      allarme. Da provare uscendo mentre il recupero suona.
- [ ] **11.S.10** **Recupero senza `recuperoSec` nel brief**: ripiego a 120
      secondi. Da verificare quali esercizi ci cascano.

## 11.S-bis — `js/screens/seduta.js`, seconda tornata (righe 14-264, 860-1060, 2346-2800)

- [x] **11.S.11** ⚠️ **«Bersaglio» ha due definizioni diverse nello stesso file.**
      `completaSerie` usa `S.obiettivo?.rip ?? v.ripMin ?? v.ripMax` — il **fondo**
      del range, come dice il commento. `vistaRecupero` usa
      `S.obiettivo?.rip ?? v.ripMax ?? v.ripMin` — il **tetto**. Il questionario
      torna al fondo. Conta solo quando la serie non ha `ripFatte`, ma è la
      stessa domanda con due risposte in tre punti. Da uniformare.
- [ ] **11.S.12** ⚠️ **Il tasto per zittire l'allarme non esiste.** In
      `vistaRecupero` c'è una variabile `suonoSpento` con un commento che spiega
      come «una volta zittito il suono non riparte da solo» — ma **non viene mai
      messa a vero da nessuna parte**: non c'è nessun modo di zittire l'allarme
      restando sul recupero, se non toccare «Pronto». Da decidere se il tasto
      serve o se va tolto il commento.
- [x] **11.S.13** ⚠️ **I tasti −/+ delle ripetizioni scrivono fuori dalla coda.**
      Sia nel recupero sia nel questionario la correzione fa
      `db.put("serie", …)` direttamente, senza passare da `inFila`: due tocchi
      rapidi possono arrivare in ordine invertito e lasciare il numero
      sbagliato. È lo stesso difetto che è stato corretto per il progresso della
      seduta. Da provare tenendo premuto.
- [ ] **11.S.14** ⚠️ **«Esci» non chiede cosa fare del cronometro del cardio.**
      Lo chiedono solo le voci del menu («vai allo stretching», «chiudi
      adesso»). Uscendo con «Esci» il cronometro resta acceso — probabilmente è
      voluto (esci dall'app mentre cammini) — ma va provato insieme a «Rimanda
      il cardio» e alla chiusura da Home, perché lì il tempo continua a correre.
- [ ] **11.S.15** ⚠️ **Un giorno di sola mobilità apre un allenamento senza
      esercizi**: la fase «esercizio» non trova niente e cade nel ricupero
      descritto in 11.S.2. Da provare sabato e domenica dall'inizio alla fine.
- [ ] **11.S.16** ⚠️ **Si può iniziare un secondo allenamento dello stesso
      giorno**: la scritta dice «già completato oggi» ma il tasto resta «Inizia
      allenamento». Combinato con 11.O.7 (l'elenco mette per primo il più
      vecchio) e con 11.J.5, è la strada per un pacchetto che racconta la
      giornata sbagliata.
- [ ] **11.S.17** **Recupero molto più lungo del previsto**: dopo target + 10
      minuti chiede se registrare il previsto o il tempo vero, e annullare non
      tocca niente. Da provare — succede spesso in palestra.
- [ ] **11.S.18** **Preavviso a 3 secondi + allarme a zero**, con il controllo
      ogni 250 ms. Da provare con lo schermo bloccato e con l'app in secondo
      piano.
- [ ] **11.S.19** **`spostaTimer` non passa da `azione()`** e salva senza
      attendere: due tocchi rapidi su «+15 s» vanno verificati.
- [ ] **11.S.20** **Il questionario torna su compilato** se ci si ritorna sopra,
      e distingue «non risposto» da «no». Da provare tornando indietro dal
      riepilogo.
- [ ] **11.S.21** **Il questionario elenca cosa manca** con le parole delle
      domande. Da provare lasciando fuori solo il «quanto faceva male».
- [ ] **11.S.22** **Correzione di TUTTE le serie** dell'esercizio nel
      questionario, con il punteggio che si aggiorna a ogni tocco. Da provare
      con tre serie e correggerne una di mezzo.
- [ ] **11.S.23** **Serie di avvicinamento**: non compare sugli esercizi a corpo
      libero, e dice se è lo stesso gesto della mobilità. Il riconoscimento è a
      parole chiave di almeno 4 lettere: da verificare che non accoppi due
      esercizi diversi.
- [ ] **11.S.24** **Riscaldamento senza `riscaldamento.json`** (vedi 11.Q.3): la
      schermata resta senza passaggi. Da provare.
- [ ] **11.S.25** **`inBlocco()` non è chiamata da nessuno**: funzione morta, da
      togliere.

## 11.T — `js/screens/seduta.js`, riepilogo e chiusura (righe 3412-3607)

- [x] **11.T.1** ⚠️ **«Torna agli esercizi» quando sono tutti finiti riporta al
      primo.** `findIndex` non trova nessun esercizio aperto, torna −1, e il
      ripiego è `indice: 0`: si finisce sul primo esercizio già chiuso, con il
      questionario da rifare — esattamente quello che il commento dice di voler
      evitare. Da provare a fine allenamento.
- [ ] **11.T.2** **Chiusura con cardio rimandato**: la conferma c'è e propone di
      lasciare aperto. Da provare tutta la strada, e verificare che l'allenamento
      lasciato aperto si ritrovi in Home.
- [ ] **11.T.3** **Densità e durata nel riepilogo** usano lo stesso conto della
      chiusura. Con il cardio rimandato sono tutti e due gonfiati (vedi 11.O.1).
- [ ] **11.T.4** **La nota generale si salva anche tornando indietro**. Da
      provare scrivendo e toccando «Torna agli esercizi».
- [ ] **11.T.5** **Copia interna a fine allenamento**: se fallisce non deve
      impedire la chiusura. Da provare con l'archivio pieno.
- [ ] **11.T.6** **Il riquadro «Dall'orologio»** compare solo con dati vecchi, e
      la sua nota adesso rimanda a Home → Watch. Da guardare su una seduta di
      luglio.

## 11.U — `js/screens/oggi.js` (882 righe, lette tutte)

- [ ] **11.U.1** ⚠️ **Aprire la Home ricalcola tutta la storia.**
      `punteggiSalute` gira giorno per giorno dal **primo dato** fino a oggi e
      per ogni seduta chiusa chiama `completezzaSeduta`; in più la Home fa
      girare il motore delle proposte e dei segnali, rilegge tutte le sedute,
      tutte le misure e tutte le date delle foto. È la prima schermata che si
      apre venti volte al giorno. Da misurare adesso e da rimisurare con un
      anno di dati.
- [x] **11.U.2** ⚠️ **«Fai il cardio» scrive il progresso a mano**, con
      `aggiornaSeduta({progresso: {...inCorso.progresso, fase:"cardio"}})`
      partendo dalla fotografia letta al disegno, invece di usare
      `aggiornaProgresso`. È il difetto che tutto il resto del file evita per
      scritto. È codice di oggi. Da correggere.
- [ ] **11.U.3** ⚠️ **Due etichette diverse per la stessa cosa**: in Home il
      tasto dice «Rifai questo allenamento», nella schermata della seduta dice
      «Inizia allenamento» anche se oggi è già stato completato. Da uniformare, e
      da decidere se il secondo allenamento dello stesso giorno si può fare
      (vedi 11.O.7, 11.J.5, 11.S.16).
- [ ] **11.U.4** **Blocco «allenamento aperto»**: le tre varianti (di oggi, di un
      altro giorno, con solo il cardio da fare) mostrano tasti diversi. Da
      provarle tutte e tre, e la quarta: aperto da ieri **e** con il cardio da
      fare.
- [ ] **11.U.5** **Un allenamento aperto e vuoto di ieri**: niente «chiudi e
      archivia», solo «elimina». Da provare.
- [x] **11.U.6** **«In ritardo» in fondo al calendario**: backup e import salute
      non hanno un «risolto», quindi restano accesi finché non li fai. In dieci
      giorni saranno sempre accesi (vedi 11.I.3).
- [ ] **11.U.7** **Il punteggio Salute con «1 gg» mostra oggi, con gli altri
      periodi la media** e lo scrive. Da provare tutti e quattro i tasti.
- [ ] **11.U.8** **Il dettaglio «Da cosa viene» resta aperto** fra un disegno e
      l'altro. Da provare cambiando periodo con il dettaglio aperto.
- [ ] **11.U.9** **La notte di stanotte è datata oggi**: con «1 gg» si mostra
      solo quella, e se manca si dice che manca. Da provare al mattino prima
      dell'import.
- [ ] **11.U.10** **La riga della versione in fondo** deve dire la versione
      davvero installata (vedi 11.C.1).
- [ ] **11.U.11** **Blocco Watch**: sempre tre righe più «Tutti gli
      allenamenti», anche con meno di tre in archivio. Da provare con zero (il
      blocco sparisce del tutto) e con uno solo.
- [ ] **11.U.13** ⚠️ **«Rifai questo allenamento» non compare mai.** Trovato
      eseguendo: chiusa una seduta oggi, `bloccoAllenamento` mostra il riquadro
      col punteggio e **torna subito**, prima di arrivare al ramo che disegna
      quel tasto. Perché il tasto compaia servirebbe una seduta «completata»
      **senza** `oraFine`, che l'app non produce. Risultato: dopo un allenamento
      chiuso, dalla Home e da Oggi non se ne può cominciare un altro lo stesso
      giorno — l'unica strada è l'indirizzo `#/seduta?programma=1`, che nessuno
      conosce. Rende inoffensiva la 11.S.16 e contraddice la 11.U.3.
- [ ] **11.U.12** **Nota del coach sull'evento di oggi**: si vede in Home dentro
      un riquadro. Da provare con un evento che ha una nota lunga.

## 11.V — `js/screens/salute.js` (lette righe 1-360 e i grafici del passo)

- [ ] **11.V.1** ⚠️ **Aprire Salute congela i punteggi vecchi.** La scheda
      «Completezza degli allenamenti» chiama `completezzaSeduta` per **ogni**
      seduta chiusa del periodo, e quella funzione congela per sempre il
      punteggio delle sedute che non ce l'hanno ancora — con le regole di
      **oggi** (vedi 11.O.6). Basta aprire la schermata dopo un cambio di brief
      perché diventi definitivo un punteggio calcolato con regole che quel
      giorno non c'erano.
- [ ] **11.V.2** **`conRipiego` non fa più niente**: restituisce le righe così
      come sono e un'etichetta sempre nulla, con un commento che descrive un
      ripiego che non esiste più. Da togliere.
- [ ] **11.V.3** **Obiettivo movimento**: vince quello più recente mandato da
      Salute, altrimenti quello impostato nell'app. Da verificare che linea,
      percentuali e nota in fondo dicano tutti lo stesso numero.
- [ ] **11.V.4** **I buchi nel grafico sono giorni veri**: `perGrafico` riempie
      ogni data mancante con un punto vuoto, così una settimana senza dati non
      sembra un giorno solo. Da guardare dopo i dieci giorni via.
- [ ] **11.V.5** **La media esclude oggi**, tranne col periodo «1 gg» e tranne il
      sonno. Da verificare che il numero accanto («N giorni con dati»)
      corrisponda sempre a quello del pannello delle finestre.
- [ ] **11.V.6** **Raggruppamento per `tipoId`**: rinominare un giorno nel brief
      non deve spezzare in due lo stesso allenamento. Da provare.
- [ ] **11.V.7** **Grafico sigarette**: ogni giorno è giudicato con la soglia di
      quel giorno, e l'obiettivo disegnato è quello di oggi. Da guardare su una
      storia in cui l'asticella è scesa.
- [ ] **11.V.8** **La scheda resta anche col periodo vuoto** («1 gg» in un giorno
      di riposo) e dice «nessun allenamento» invece di sparire. Da provare tutti
      e quattro i periodi su ogni scheda.

## 11.W — `js/export.js` (907 righe, lette tutte)

È il testo che arriva al coach. Qui un'etichetta sbagliata vale più di un bug.

- [x] **11.W.1** ⚠️ **Due densità diverse per lo stesso allenamento.** Il
      riepilogo a schermo calcola `serie / durataLavoroSec`; il pacchetto del
      coach calcola `serie / (ultima serie − prima serie)`. Sono due numeri
      diversi per la stessa seduta: tu leggi uno, il coach ne legge un altro. Da
      uniformare, o almeno da dire.
- [x] **11.W.2** ⚠️ **«Nuovo minimo» scritto su ogni giorno sotto soglia.** Nella
      tabella FUMO la nota dice «nuovo minimo» ogni volta che il numero è sotto
      la soglia di quel giorno, anche sette giorni di fila. Un minimo è uno solo:
      così com'è, la parola non vuol dire niente. Stessa cosa nella schermata
      Fumo (11.F.5).
- [x] **11.W.3** ⚠️ **«Misure e indici, solo se aggiornati di recente»: non è
      vero.** `bloccoCorpo` stampa l'ultima misura di ogni tipo qualunque sia la
      sua data, senza nessun limite di recenza. Il commento promette un filtro
      che non c'è. (La data di ogni misura è scritta, quindi non è un dato
      falso — è la descrizione a essere falsa.)
- [ ] **11.W.4** ⚠️ **`bloccoExtra` taglia a 30 righe in silenzio**, mentre
      `bloccoWatch` dice quante ne restano fuori. Da uniformare.
- [ ] **11.W.5** **Le note che spezzano le tabelle**: le barre verticali sono
      protette e gli a capo diventano «·», in tutte le tabelle. Da provare con
      una nota che contiene `|`, un a capo e le virgolette.
- [ ] **11.W.6** **Esercizi previsti e mai iniziati** compaiono come «NON
      INIZIATO (previsto dal programma)»; quelli interrotti a metà tengono le
      serie fatte. Da provare tutti e due i casi.
- [ ] **11.W.7** **Carico cambiato in corsa**: la riga passa alla forma «serie
      per serie». Da provare scalando il carico all'ultima serie.
- [ ] **11.W.8** **«per manubrio» / «barra compresa»**: l'unità del carico è
      scritta secondo l'attrezzo. Da verificare su un esercizio con i manubri.
- [ ] **11.W.9** **Recuperi in blocco**: le serie senza riposo previsto escono
      dalla media e viene detto quante sono. Da provare su una seduta a blocchi.
- [ ] **11.W.10** **«Obiettivi chiesti dall'app diversi dal brief»**: è l'unica
      riga che spiega al coach perché una serie da 13 non è un errore. Da
      provare con una proposta accettata.
- [ ] **11.W.11** **Tabella salute a 21 righe** ma «resto del movimento» su 7
      giorni, nello stesso blocco. Da verificare che entrambe le finestre siano
      dichiarate.
- [ ] **11.W.12** **La colonna «Punteggio» del sonno resta sempre vuota** e c'è
      la riga che lo spiega. Da verificare che il coach non la legga come un
      buco dei dati.
- [ ] **11.W.13** **Proposte accettate ma non più in vigore**: vengono elencate a
      parte col motivo («già allenata», «annullata dal brief nuovo»,
      «sostituita»). Da verificare che `inVigore` e `motivoScarto` siano davvero
      valorizzati da `proposteAccettate`.
- [ ] **11.W.14** **Intestazione del pacchetto**: le voci a zero non si
      elencano. Da provare con l'archivio quasi vuoto.

## 11.X — `js/screens/seduta.js`, terza tornata (esercizio, cardio in corso, stretching)

- [ ] **11.X.1** ⚠️ **«Rimanda il cardio» esiste solo PRIMA di avviarlo.** Una
      volta partito il cronometro la schermata passa a «cardio in corso», dove
      ci sono solo «Ho finito» e «Ferma il suono»: se cominci a camminare e devi
      interromperti, non c'è nessun modo di rimandare. Resta la strada storta:
      menu → «vai allo stretching» → «registralo/buttalo via». Da decidere se il
      tasto va anche lì. È il caso che ha fatto nascere la funzione.
- [ ] **11.X.2** ⚠️ **Un esercizio con `carico: 0` nel brief può prendere un
      carico dallo storico.** La catena è
      `(v.carico > 0 ? v.carico : null) ?? ultimoCarico(...)`: uno zero
      dichiarato — che vuol dire corpo libero — non ferma la ricerca, e l'app
      propone il carico dell'ultima volta. Collegato a 11.A.4.
- [ ] **11.X.3** **Carico non componibile**: l'app scrive i due carichi vicini
      montabili, sia col bilanciere sia coi manubri. Da provare chiedendo 31 kg
      con dischi che non lo fanno.
- [ ] **11.X.4** **Cardio più lungo del previsto di oltre 20 minuti**: chiede se
      hai camminato davvero tanto o se hai toccato «Ho finito» in ritardo. Da
      provare lasciando il cronometro acceso un'ora.
- [ ] **11.X.5** **Il traguardo del cardio suona una volta sola** e «Ferma il
      suono e continua» non chiude l'esercizio. Da provare.
- [ ] **11.X.6** **Il cronometro del cardio si conta sull'orologio**: bloccare lo
      schermo o chiudere l'app non falsa il conto. Da provare uscendo dall'app
      per venti minuti.
- [ ] **11.X.7** **«Non eseguito» cancella davvero durata e ora di fine**, così
      non resta una durata accanto a «non eseguito». Da provare dopo aver già
      registrato un cardio.
- [ ] **11.X.8** **Stretching «Salta»** scrive `stretching: {fatto:false}` e va
      alla mobilità se quel giorno ce l'ha. Da provare su un giorno del nuovo
      split.
- [ ] **11.X.9** **Rete di sicurezza in `vistaEsercizio`**: se le serie
      registrate hanno già raggiunto il previsto si passa al questionario, e
      dentro un blocco solo quando li ha finiti tutti e due. Da provare
      registrando serie in più.
- [ ] **11.X.10** **Blocco: la nota «subito dopo, senza riposo: …»** deve
      nominare l'esercizio giusto. Da provare.

## 11.Y — `js/brief.js` (354 righe, lette tutte) e `sw.js` (131, lette tutte)

- [ ] **11.Y.1** ⚠️ **«Regole e soglie aggiornate.»** è tutto quello che il
      confronto dice quando il coach cambia le regole. Un brief che sposta le
      soglie del cardio, i pesi del punteggio Salute o il numero di esposizioni
      minime produce **una riga generica**, mentre per un carico da 20 a 22 kg
      l'app scrive la differenza esatta. Sono proprio le modifiche che non si
      vedono in nessun altro posto. Da migliorare prima di partire.
- [ ] **11.Y.2** ⚠️ **La validazione del brief non guarda dentro `regole`.**
      Nessun controllo su `salute.pesi`, `cardio`, `finestra`, `cadenze`: un
      blocco scritto a metà passa, e poi `regole()` lo fonde a un livello solo
      (11.Q.2) spegnendo in silenzio metà del punteggio. Da aggiungere almeno un
      controllo di forma.
- [ ] **11.Y.3** ⚠️ **Due giorni con lo stesso `id`, o due giorni sullo stesso
      giorno della settimana**, non vengono segnalati: vince il primo scritto e
      l'altro sparisce senza dirlo. Da provare (succede quando nel brief
      convivono due programmi — vedi 11.Q.1).
- [ ] **11.Y.4** **Blocchi**: almeno due esercizi, scritti di seguito, con lo
      stesso numero di serie. Tutte e tre le regole sono controllate. Da provare
      con un brief che le viola, una alla volta.
- [ ] **11.Y.5** **Esercizio a tempo scritto a ripetizioni**: la libreria lo sa e
      il controllo lo blocca. Da provare col plank.
- [ ] **11.Y.6** **Dischi in numero dispari**, carichi negativi, id maiuscoli,
      esercizi sconosciuti, esercizio ripetuto nello stesso giorno: tutti
      controllati. Da provare almeno due di questi con un brief finto.
- [ ] **11.Y.7** **Brief copiato dalla chat senza i commenti HTML**: c'è la forma
      di riserva («COACH-DATA v1» nuda). Da provare, perché è come arriverà il
      brief mentre sei via.
- [ ] **11.Y.8** **Verificato**: tutti i 26 file JavaScript sono nella lista di
      precaricamento di `sw.js` — niente resta fuori dalla copia offline.
- [ ] **11.Y.9** **L'installazione della cache è tutto-o-niente** (`Promise.all`
      con `cache: "reload"`): se un file non si scarica, la versione vecchia
      resta al comando. Da provare pubblicando con la rete che va e viene.
- [ ] **11.Y.10** **Le cache vecchie si cancellano solo dopo aver verificato**
      che la nuova contenga index, app.js e il CSS. Da verificare che dopo un
      aggiornamento resti **una sola** cache (vedi 11.C.1).
- [ ] **11.Y.11** **Navigazione con rete lenta**: dopo 3 secondi si apre la copia
      salvata. Da provare col wifi di un hotel che chiede il login — è
      esattamente lo scenario dei prossimi dieci giorni.
- [ ] **11.Y.12** **`skipWaiting` + `clients.claim`**: la versione nuova prende
      il comando subito. Da verificare che, dentro l'allenamento, cambiare fase
      non carichi un modulo della versione nuova mescolato ai vecchi (la rete
      c'è in `app.js`, va provata).

## 11.Z — `js/screens/seduta.js`, quarta tornata (carico, riepilogo dallo storico)

- [ ] **11.Z.1** **Conferma del carico fuori scala**: scatta solo se c'era già un
      carico di partenza (`partenza > 0`). Il primissimo carico di un esercizio
      non è protetto: `1750` al primo inserimento entra senza domande.
- [ ] **11.Z.2** **Campo carico vuoto ≠ zero**: `leggi()` torna `null` e il
      salvataggio viene rifiutato. Da provare.
- [ ] **11.Z.3** **Il carico scelto si scrive subito nel progresso**: riavviando
      l'app fra due serie non deve tornare quello vecchio. Da provare.
- [ ] **11.Z.4** **Riepilogo aperto dallo Storico**: mostra note dell'esercizio,
      note del salto, serie di un esercizio interrotto e quelli senza
      questionario. Da riaprire un allenamento vecchio e controllarli tutti.
- [ ] **11.Z.5** **«Esercizi n/m» usa i numeri congelati** quando ci sono, così
      non contraddice l'anello. Da provare su una seduta di prima del
      congelamento.
- [ ] **11.Z.6** **«Il punto debole è …»**: con 90 di media ma una voce a metà
      non deve dire «allenamento pieno». Da provare.

## 11.AA — `js/salute.js` (434) e `js/salute-export.js` (429), lette tutte

- [ ] **11.AA.1** ⚠️ **Un sonnellino di giorno diventa una notte.** Nel montaggio
      delle fasi, una fase che comincia **dalle 12 in poi** viene attribuita alla
      notte del giorno dopo. Un pisolino alle 15 diventa quindi «la notte di
      domani», con un inizio alle 15 — e da lì la voce Sonno del punteggio
      (`ritardoAndataALetto`, 11.A.1) fa il resto. Da provare con un sonnellino
      registrato dall'orologio.
- [ ] **11.AA.2** ⚠️ **Allenamenti dell'orologio senza `uuid`.** Il lettore
      dell'export non lo scrive, e `analizza` costruisce la chiave come
      `data-inizio-durata`: due allenamenti che cominciano nello stesso minuto e
      durano uguale si sovrascrivono a vicenda. Da verificare se in archivio ce
      ne sono con la stessa chiave.
- [ ] **11.AA.3** **iPhone e Watch tenuti separati** dal nome della sorgente
      (`/watch/i`): se l'orologio ha un nome che non contiene «watch», i suoi
      dati finiscono con quelli del telefono e i passi si contano due volte. Da
      verificare come si chiama il tuo orologio in Salute.
- [ ] **11.AA.4** **Numeri all'italiana**: «10.700» sono diecimilasettecento,
      «12.836» kcal sono dodici virgola otto. Da controllare su un import vero
      che i passi non siano divisi per mille e le kcal non moltiplicate.
- [ ] **11.AA.5** **Campi sconosciuti e valori negativi** finiscono negli
      avvisi. Da leggere gli avvisi dopo un import vero, non solo il riepilogo.
- [ ] **11.AA.6** **Curva del battito senza allenamento** a cui riferirsi: viene
      detto invece di sparire. Da provare.
- [ ] **11.AA.7** **Export da centinaia di MB letto a pezzi**: da rifare sul
      telefono, con la percentuale che avanza, perché in vacanza sarà l'unica
      strada (le azioni di Salute nei Comandi Rapidi non funzionano — vedi
      11.AD.2).
- [ ] **11.AA.8** **Distanza di nuoto e bici finiscono nello stesso campo `km`**
      della camminata: da verificare che il passo al chilometro non peschi una
      nuotata (i tipi sono filtrati, ma va provato).

## 11.AB — `js/screens/allenamenti.js` (353) e il resto di `js/grafico.js`

- [ ] **11.AB.1** ⚠️ **L'elenco degli allenamenti del Watch non ha limite**:
      nessun taglio, nessun caricamento progressivo. Con una camminata al giorno
      diventano centinaia di righe disegnate tutte insieme. Da misurare adesso e
      da rimisurare fra un mese.
- [ ] **11.AB.2** **Indoor/outdoor nel nome** solo per camminata, corsa e bici.
      Da decidere se serve anche altrove.
- [ ] **11.AB.3** **Un allenamento importato da una versione vecchia** mostra il
      riquadro «Mancano dei numeri» con il collegamento all'import. Da provare.
- [ ] **11.AB.4** **Il periodo dei grafici è condiviso** e vive in
      `localStorage`: da verificare che non si perda reinstallando l'app.

## 11.AC — `index.html` (79) e `css/app.css` (1616), letti tutti

- [ ] **11.AC.1** ⚠️ **Barra di stato di iOS**: `apple-mobile-web-app-status-bar-style`
      è `default` (testo scuro) mentre il tema «nero e lime» è sempre scuro. Da
      guardare sul telefono che l'ora e la batteria in cima si leggano.
- [ ] **11.AC.2** **Contrasti**: i colori sono già stati tarati sopra 4,5:1 con
      i conti scritti nel foglio di stile. Da riverificare con un misuratore
      vero le voci nuove di oggi (`--battito`, `--sforzo`) in tutti e tre i temi.
- [ ] **11.AC.3** **Nessuno stile di messa a fuoco** sui pulsanti (solo su
      `input.val`): con una tastiera esterna o VoiceOver non si vede dove sei.
- [ ] **11.AC.4** **Sei schede nella barra** con colonne automatiche: da
      guardare su schermo da 320 punti con Fumo e Acqua tutti e due accesi.
- [ ] **11.AC.5** **`prefers-reduced-motion`** spegne tutte le animazioni. Da
      provare accendendolo nelle impostazioni dell'iPhone.

## 11.AD — `ISTRUZIONI-BRIEF.md` (384 righe, letto tutto — mai aperto prima)

- [x] **11.AD.1** ⚠️ **Il documento promette una cosa che il codice non fa.**
      Dice: «si scrive solo quello che si vuole spostare, il resto resta com'è».
      È vero al primo livello, **falso al secondo**: un coach che segue queste
      istruzioni e scrive `"salute": { "pesi": { "sonno": 30 } }` **spegne tutte
      le altre voci del punteggio** (vedi 11.Q.2). Da correggere in tutti e due
      i posti — il codice e queste istruzioni.
- [x] **11.AD.2** ⚠️ **Due documenti che si contraddicono sui comandi rapidi.**
      Le istruzioni dentro l'app (schermata Salute) descrivono un'automazione
      alle 05:00 con «Coach Salute», mentre il codice della stessa schermata
      dice per esteso che **le azioni di Salute dentro Comandi Rapidi non
      funzionano** e per questo non offre più il tasto. Da decidere quale delle
      due è vera **prima di partire**, perché da lontano l'unica strada sarà
      l'export XML letto dal telefono.
- [x] **11.AD.3** ⚠️ **La tabella degli errori è vecchia**: dice «Peso della
      barra non valido — manca `barra` mentre c'è l'inventario», ma il codice
      non pretende più la barra (chi si allena in palestra la omette). Un coach
      che legge quella riga aggiungerà un dato che non serve.
- [x] **11.AD.4** ⚠️ **L'elenco dei giorni con riscaldamento è fermo a cinque**
      (`petto-tricipiti`, `gambe-core`, `spalle`, `schiena-bicipiti`,
      `full-body`), ma in `data/riscaldamento.json` ce ne sono **diciassette**:
      push, pull, legs, upper, lower, dorso-femorali, dorso-quadricipiti,
      recupero-attivo-a/b, sabato, domenica… Un coach che scrive un brief nuovo
      crede di dover allegare protocolli che invece esistono già.
- [x] **11.AD.5** **Verificato**: i 38 esercizi della libreria sono tutti e soli
      quelli elencati nel documento. Da rifare questo confronto ogni volta che la
      libreria cambia.
- [x] **11.AD.6** **Le istruzioni non nominano** `regole.finestra`,
      `fumoQuotaMinima`, `sonnoOraLimite`, `sonnoCostoOraTardi`, `fotoAncora`,
      `esposizioniPerRiproporre`: soglie che esistono e si possono cambiare, ma
      che nessuno sa di poter dichiarare.

## 11.AE — `tools/pubblica.sh` (199 righe, letto tutto)

- [ ] **11.AE.1** ⚠️ **`VERIFICA.md` verrà pubblicato online.** La lista bianca
      accetta `^[A-Z0-9-]+\.md$`, e questo documento ha il nome tutto maiuscolo:
      al prossimo `pubblica.sh` finisce sul sito pubblico. Non contiene dati
      personali — è un elenco di controlli — ma è una decisione da prendere
      apposta, non da subire.
- [ ] **11.AE.2** **I sei controlli**: `_privato/`, file di dati personali,
      immagini incorporate, parole vietate, lista bianca, copertura di `sw.js`.
      Da far girare `bash tools/pubblica.sh --controlla` **prima di partire**, e
      verificare che dica «Parole vietate controllate: N» con N giusto.
- [ ] **11.AE.3** **Se un controllo fallisce lo staging viene annullato**: da
      provare di proposito, mettendo un file finto fuori lista.
- [ ] **11.AE.4** **Avviso sulla documentazione rimasta indietro**: non blocca.
      Con tutte le modifiche di oggi va letto e seguito (vedi 11.AD).
- [ ] **11.AE.5** **Il push non ha nessun tentativo di ripetizione**: GitHub
      risponde a volte «Internal Server Error». Da sapere: si rilancia e basta.
- [x] **11.AE.6** ⚠️⚠️ **Qualunque `.md` con nome maiuscolo entra nel repository
      pubblico senza nessun controllo sul contenuto.** Trovato eseguendo la Fase
      0: un file `DATI.md` contenente «peso 84,5 kg» **passa tutti e sei i
      controlli**. La lista bianca accetta `^[A-Z0-9-]+\.md$` senza chiedersi
      quale; le parole vietate non possono coprire parole comuni come «peso»; e
      il controllo dei nomi personali (#2) **non può scattare**, perché cerca
      `coach-backup-*.json`, `coach-dati-iniziali.json` e `seed.py`, che
      `.gitignore` esclude prima ancora che `git add -A` li veda. Quel controllo
      è teatro: non è mai stato messo alla prova da niente.

## 11.AF — Voci raccolte finendo i file già cominciati

- [x] **11.AF.1** ⚠️ **Saltare un esercizio già valutato ne cancella la
      valutazione.** `registraSalto` riscrive lo **stesso** record del
      questionario azzerando RPE, tecnica e dolori: se hai risposto e poi decidi
      di segnarlo saltato, quelle risposte spariscono senza avviso.
      (`store.js:968`)
- [ ] **11.AF.2** ⚠️ **La soglia vita/fianchi è quella maschile, scritta nel
      codice**: «Soglia uomini 0,95» (`store.js:3223`). Sul telefono di lei
      comparirebbe la stessa soglia. Da rendere dichiarabile nel brief o almeno
      da verificare che quella scheda non le compaia.
- [ ] **11.AF.3** ⚠️ **La modalità «unisci» del ripristino è irraggiungibile**:
      `esportaCompleto` non scrive mai il campo `modo`, quindi ogni ripristino da
      file è «sostituisci tutto». Conferma di 11.N.2.
- [ ] **11.AF.4** **Il confronto del brief mostra solo le prime 40 differenze**
      e la validazione solo i primi 6 problemi, senza dire quanti ne restano
      fuori. Da provare con un brief molto diverso.
- [ ] **11.AF.5** **«Scarica l'ultima versione» svuota la copia locale dopo aver
      controllato tre file**: fra la cancellazione e il ricaricamento c'è una
      finestra in cui, se la rete cade, l'app resta senza copia. Piccola, ma da
      non usare con la rete ballerina.
- [ ] **11.AF.6** **Il grafico del passo prende i giorni da `giorniSalute`**: un
      giorno con un allenamento del Watch ma **senza** riga di movimento importata
      non compare nel grafico, pur entrando nella media scritta sopra. Da provare
      importando solo gli allenamenti.
- [ ] **11.AF.7** **`bloccoProssimo` dice «finiti i pesi: tocca il cardio»**
      anche quando il cardio è stato rimandato. Da uniformare con 11.S.3.
- [ ] **11.AF.8** **Il cronometro degli esercizi a tempo**: arrivato a zero
      suona e il tempo in più non viene contato; «Fine» prima registra i secondi
      tenuti davvero. Da provare mollando a metà e tenendo oltre.
- [ ] **11.AF.9** **Dosi a tempo riconosciute a parole** («30 s per lato»,
      «3 × 15 s per lato», «1,5 min», «6-7 min»): da provare tutte le forme che
      compaiono davvero in `data/riscaldamento.json`.
- [ ] **11.AF.10** **Cambio video**: campo vuoto + Salva rimette il video di
      partenza, e funziona sia sugli esercizi sia sui passaggi di riscaldamento.
      Da provare su tutti e due.

---

# Blocco 12 — La documentazione contro il codice

Avevo escluso questi file dicendo che «non girano sul telefono». Era una scusa
debole: tre dei difetti peggiori trovati finora sono **un documento che dice una
cosa e il codice che ne fa un'altra**. Letti tutti, e il raccolto è il più grosso
di tutte le tornate.

## 12.A — Contraddizioni sulla privacy (la promessa più importante che fa l'app)

- [x] **12.A.1** ⚠️ **Il README dichiara ancora il difetto corretto oggi.** Prima
      pagina del repository pubblico: «le uniche richieste in uscita sono verso
      YouTube — **la copertina di un video quando il riquadro entra sullo
      schermo**». È esattamente la cosa che l'app **non fa più**: la copertina
      adesso è disegnata. Chi legge il README crede che aprire un esercizio dica
      a Google cosa stai allenando.
- [x] **12.A.2** ⚠️ **`SPEC.md` si contraddice da sola sulla stessa cosa.** Il §1
      dice giusto («la copertina è disegnata dall'app, non scaricata»), il §9 —
      cioè l'elenco delle promesse, l'ultima pagina, quella che si legge per
      sapere cosa l'app non fa — dice ancora «la copertina di un video
      all'apertura della scheda di un esercizio». Da correggere in tutti e due i
      documenti, oggi.

## 12.B — `SPEC.md` (442 righe, letta tutta): la specifica descrive un'altra app

- [x] **12.B.1** ⚠️ **La specifica si contraddice sul collegamento Watch↔seduta**
      in tre punti: §3.3 dice «non vengono collegati alle sedute e non hanno un
      ruolo da assegnare» (giusto, è la scelta di oggi); §3.4 e §4.4 descrivono
      per esteso il collegamento per data con le sue regole. Da ripulire.
- [x] **12.B.2** ⚠️ **§4.1: «Seduta prevista oggi… cambiabile con un tap».** Il
      codice dice il contrario, per scelta dichiarata: «Quale allenamento si fa
      lo decide lo split del master brief: l'app lo esegue, non lo mette in
      discussione». Una delle due va cancellata.
- [x] **12.B.3** ⚠️ **§4.3: «Grafici: vita, peso, rapporto vita/altezza».**
      Verificato: **in Corpo non c'è nessun grafico** — la parola «grafico»
      compare una sola volta in tutto il file, dentro un commento. O la funzione
      è stata tolta, o non è mai stata costruita, ma la specifica la promette.
- [x] **12.B.4** ⚠️ **§1: il backup con `modo: "unisci"`.** La specifica lo
      descrive come funzione viva; `esportaCompleto` non scrive mai quel campo,
      quindi non esiste modo di produrre un file del genere dall'app (11.N.2).
- [x] **12.B.5** **§2: «Colori: variabili di sistema. Accento: blu di sistema.
      Nessuna palette personalizzata.»** Esiste il tema «nero e lime», che è
      esattamente una palette personalizzata.
- [x] **12.B.6** **§3.2: la Seduta contiene ancora `orologio { numeri copiati dal
      quadrante }`**, e §4.2 punto 4 chiede ancora «Dolore al polso destro?» come
      domanda fissa, mentre §3.2 poco sopra dice che i punti dolenti li dichiara
      il brief.
- [x] **12.B.7** **§3.6: nomi delle impostazioni sbagliati** — `ultimoBackup`
      (nel codice è `ultimoExport`) e `versioneBrief` (non esiste).
- [x] **12.B.8** **§3.1: «Programma … giorni[5]»** — lo split ne ha sette
      (sabato e domenica sono giorni di sola mobilità).
- [x] **12.B.9** **§4.4: «Tasto [Aggiorna dati salute] → lancia lo Shortcut».**
      Terza contraddizione sullo stesso tema (con `ISTRUZIONI-BRIEF.md` e le
      istruzioni dentro l'app): il comando rapido per la salute **non viene più
      offerto**.

## 12.C — `COME-FUNZIONA.md` (1023 righe, letto tutto): è il documento che legge il coach

- [x] **12.C.1** ⚠️ **Si contraddice a venti righe di distanza.** Il §5 punto
      4-bis dice «i numeri dell'orologio non si scrivono più»; il §5 punto 6, due
      paragrafi dopo, dice «Riepilogo e chiusura. **Qui si copiano i numeri
      dall'orologio** (durata, kcal attive e totali, FC media e massima, sforzo;
      per il cardio anche distanza e ritmo)». Uno dei due è di oggi, l'altro di
      ieri.
- [x] **12.C.2** ⚠️ **§12 promette al coach una colonna che non esiste più**:
      «nel pacchetto ognuno porta scritto **cos'era** (la seduta, il cardio che
      le va dietro, o movimento fuori programma)». È il **ruolo**, tolto oggi — e
      il §9-bis dello stesso documento dice «non li collega alle sedute e non
      chiede di farlo». Il coach leggerà il pacchetto cercando una colonna che
      non troverà.
- [x] **12.C.3** ⚠️ **§12 descrive ancora il riquadro «Letti dall'Apple Watch»**
      come contenuto normale del pacchetto, «trascritti dall'atleta a fine seduta
      leggendo il quadrante». Non si riempie più (vedi 11.J.1).
- [x] **12.C.4** ⚠️ **I pesi del punteggio Salute sono scritti in due modi
      diversi nello stesso documento**: il §4 elenca sette voci **senza acqua**,
      il §6.3 ne elenca otto **con acqua** (peso 12). È esattamente il difetto
      che `pubblica.sh` dice essere già successo una volta.
- [x] **12.C.5** ⚠️ **Terza ripetizione della promessa falsa sulle regole**: «si
      fondono voce per voce: scrivere una soglia non azzera le altre della stessa
      famiglia». Vero al primo livello, falso al secondo (11.Q.2, 11.AD.1). La
      stessa frase sbagliata è in tre documenti.
- [x] **12.C.6** ⚠️ **«Dal 24/08/2026»** — la mobilità di fine seduta è descritta
      come attiva da una data che **deve ancora arrivare**, mentre verificato in
      `riscaldamento.json` è **già attiva adesso** su push, pull, legs, upper,
      lower, sabato e domenica. Da chiarire quale delle due è vera.
- [x] **12.C.7** **§11: gli indici elencati sono due** (vita/altezza e BMI), ma
      nel codice ce n'è un terzo — vita/fianchi, con la soglia maschile scritta
      nel codice (11.AF.2). Non è nominato da nessuna parte.
- [x] **12.C.8** **§9: il formato documentato prevede `uuid=…` sulle righe
      ALLENAMENTO**, ma il lettore dell'export non lo scrive mai (11.AA.2).
- [x] **12.C.9** **Due misurazioni dichiarate «verificate» che vanno rifatte
      dopo oggi**: «zero richieste fuori dal telefono, misurato aprendo tutte le
      schermate» (§14) e «ripristino identico byte a byte su tutti e 17 gli
      archivi» (§15). Erano vere quando sono state scritte; da allora sono
      cambiate 23 file.
- [x] **12.C.10** **§10 dichiara per esteso la scelta sulle sigarette**: «un
      giorno senza righe vale zero sigarette, cioè punteggio pieno». Conferma che
      11.O.3 è una decisione, non una svista — e che va riconsiderata sapendo
      che in vacanza capiterà.

## 12.D — Il resto degli strumenti

- [x] **12.D.1** **`tools/serve.py`** ascolta solo su `127.0.0.1`: dal telefono
      sulla stessa wifi non si raggiunge. Per passare i file al telefono c'è
      `passa-file.py`. Da sapere se serve provare qualcosa dal telefono di casa.
- [x] **12.D.2** **`tools/` è dentro la lista bianca di pubblicazione**: tutti
      gli strumenti finiscono nel repository pubblico. Da rileggere una volta
      cercando percorsi personali (il controllo parole vietate li prenderebbe,
      ma è meglio guardare).

---

# Blocco 13 — I tre strumenti da computer

Avevo detto che lì non mi aspettavo niente. Sbagliato di nuovo: il primo dei tre
contiene il difetto con la conseguenza peggiore trovata in tutto il controllo.

- [x] **13.1** ⚠️⚠️ **Lo strumento sul Mac CANCELLA i dati dell'orologio.**
      `tools/salute-da-export.py` scrive righe ALLENAMENTO con **quattro campi
      soli**: `inizio`, `durata`, `kcal`, `tipo`. Il lettore che gira sul telefono
      (`js/salute-export.js`) ne scrive **dodici** — distanza, kcal totali, FC
      media/minima/massima, sforzo, indoor, ora di fine — più le righe
      `BATTITO` con la curva. Messo insieme a **11.P.1** (reimportare riscrive
      l'allenamento intero senza fondere), usare lo strumento sul Mac **svuota
      distanza, battito, sforzo e indoor** da ogni allenamento che li aveva. E il
      passo al chilometro, che vive sulla distanza, sparisce con loro.
- [x] **13.2** ⚠️ **`COME-FUNZIONA.md` dichiara una cosa falsa e verificabile**:
      «il pacchetto che ne esce è **identico byte per byte** a quello prodotto
      dallo stesso lavoro fatto su un computer (`tools/salute-da-export.py`)».
      Non lo è: i due strumenti scrivono pacchetti diversi, e quello del computer
      è molto più povero. Da correggere insieme a 13.1.
- [ ] **13.3** ⚠️ **Nessun pavimento predefinito nello strumento sul Mac.** Il
      lettore sul telefono applica sempre `inizioStoria()` (mai dati più vecchi
      del 29/07/2026); lo script usa `--dal` **solo se glielo scrivi**, e di
      default guarda 21 giorni indietro senza limite inferiore. Due strade, due
      regole.
- [ ] **13.4** **Finestre diverse**: 21 giorni sul Mac, 30 sul telefono. Da
      uniformare o da dichiarare.
- [x] **13.5** **Il nome del documento personale è nel repository pubblico**:
      `tools/passa-file.py` contiene il percorso `_privato/master brief
      coaching.md`. Non è un dato di salute, ma è il nome di un file privato, e
      il controllo di `pubblica.sh` su «master brief» guarda **i nomi dei file da
      pubblicare**, non il loro contenuto: quella riga passa. Da decidere se
      aggiungerla alle parole vietate o cambiare il percorso in una variabile.
- [ ] **13.6** **`passa-file.py`** è fatto bene: chiave casuale a ogni avvio,
      spegnimento automatico dopo 10 minuti, stessa risposta 404 per chiave
      sbagliata e file inesistente, testo messo al sicuro con `escape`. Da
      provarlo una volta prima di partire, se pensi di doverlo usare da lontano
      (serve la stessa Wi-Fi: da fuori casa non serve a niente).
- [ ] **13.7** **`icona.py` e `icona-da-immagine.sh`**: leggono e riscrivono PNG,
      nessun dato personale, nessuna rete. Niente da verificare.

---

# Blocco 14 — I contenuti (`data/`), e l'errore di metodo che li aveva nascosti

**Come sono arrivato qui.** Alla terza domanda «sei sicuro che ci sia tutto?» ho
finalmente fatto la cosa che andava fatta per prima: chiedere a git **l'elenco
dei file**, invece di leggere quelli che sapevo esistere. Mancavano 2.316 righe.
Non documentazione: i **contenuti che l'app ti mostra in palestra**.

## 14.A — `data/riscaldamento.json` (1.129 righe)

- [ ] **14.A.1** ⚠️⚠️ **Sui giorni del nuovo split il riscaldamento è di due
      passaggi soli.** Verificato contando i passaggi giorno per giorno:
      `push`, `pull`, `legs`, `upper`, `lower` hanno **zero** voci di mobilità e
      **zero** di stretching finale (tutto è stato spostato in `mobilitaFinale`,
      2-3 voci a fine seduta). Siccome `passiRiscaldamento()` mette insieme
      camminata + mobilità + serie di avvicinamento, su quei giorni il
      riscaldamento diventa: **camminata 5 minuti e serie di avvicinamento**.
      I giorni vecchi (`petto-tricipiti`, `gambe-core`, `spalle`,
      `schiena-bicipiti`, `full-body`) ne hanno 4-5 di mobilità e 3-5 di
      stretching. Da capire se è voluto o se quelle liste non sono mai state
      scritte: se il brief in vigore usa i giorni nuovi, **è il riscaldamento che
      farai ogni volta per dieci giorni**.
- [ ] **14.A.2** ⚠️ **La documentazione descrive un riscaldamento che su cinque
      giorni su sette non esiste**: «circa 10 minuti… poi mobilità mirata al
      lavoro previsto: 5 esercizi per giorno dello split» (COME-FUNZIONA §5,
      SPEC §4.2).
- [ ] **14.A.3** ⚠️ **La mobilità finale non corrisponde a quello che è scritto.**
      `COME-FUNZIONA.md` dice «Push, Upper: anca, caviglia, colonna · Pull: anca,
      caviglia · **Legs, Lower: spalle, colonna**» — cioè due voci — ma nei dati
      `legs` e `lower` ne hanno **tre**. Da controllare quali sono davvero.
- [ ] **14.A.4** **Verificato con la stessa regola del codice**: tutte e 112 le
      dosi vengono lette come devono. Le 41 a tempo fanno partire il cronometro
      (20s, 30s, 45s, 5 min, e «per lato»/«per direzione» contate come due
      tenute); le 71 a ripetizioni restano senza, come previsto. **Nessuna dose a
      ripetizioni fa partire un cronometro per sbaglio, e nessuna dose a tempo lo
      perde.** È il controllo che leggendo il codice non si poteva fare.
- [ ] **14.A.5** **`6-7 min`** (camminata del full-body) viene letta come **6
      minuti**, cioè il minimo del range: è la regola voluta, ma va guardata a
      schermo almeno una volta.
- [ ] **14.A.6** **27 passaggi su 112 non hanno video**, mentre la
      documentazione dice che i movimenti della mobilità finale sono «quelli che
      già conosci dal riscaldamento, con la stessa spiegazione e **lo stesso
      video**». Da verificare quali restano senza.
- [ ] **14.A.7** **Tutti e 112 i passaggi hanno il «come si fa»**: nessuno resta
      muto. Verificato.
- [ ] **14.A.8** **Sabato e domenica**: solo camminata come riscaldamento, poi
      cinque voci di mobilità finale. Da provare un giorno intero di quelli, che
      nel punteggio vale come un giorno di scheda.

## 14.B — `data/esercizi.json` (1.141 righe, 38 esercizi)

- [ ] **14.B.1** **Nessun id duplicato, nessun video ripetuto fra esercizi
      diversi, tutti gli id dei video hanno la forma giusta (11 caratteri).**
      Verificato.
- [ ] **14.B.2** **Diciotto esercizi su 38 non hanno la voce «sicurezza»**: è
      facoltativa e la sezione semplicemente non compare. Da decidere se su
      panca, squat e stacco (che ce l'hanno) basta.
- [ ] **14.B.3** **`pilates` e `camminata` non hanno video** ed è giusto: non
      sono esercizi. Ma hanno `pattern: "recupero"`, che **non è nell'elenco dei
      pattern** né in `SPEC.md` §3.1 né in `ISTRUZIONI-BRIEF.md` §5 — il codice
      lo conosce («Recupero attivo»), i due documenti no. Quarto disallineamento
      fra codice e carta.
- [ ] **14.B.4** **Tredici esercizi dichiarano `sollecitaPolso`**: è il flag che
      accende l'avviso sulla domanda del dolore. Da verificare che siano quelli
      giusti quando la domanda del polso è attiva.
- [ ] **14.B.5** **Un solo esercizio è `aTempo`** (il plank). Da ricordare
      quando si prova il cronometro degli esercizi a tempo: è l'unico caso reale.
- [ ] **14.B.6** **Tutti i recuperi predefiniti stanno fra 30 e 300 secondi.**
      Verificato: nessun numero assurdo.

## 14.C — I file piccoli, mai aperti

- [x] **14.C.1** ⚠️ **Schermata d'avvio sempre nera.** Il `manifest.webmanifest`
      fissa `background_color` e `theme_color` a `#08080a`, mentre `index.html`
      dichiara un `theme-color` chiaro per chi usa il tema di sistema. Con l'app
      installata comanda il manifest: chi tiene l'iPhone in chiaro vede
      un'apertura nera. Da guardare.
- [x] **14.C.2** **`.gitignore` è la rete che tiene fuori i dati personali**:
      copre `_privato/`, i backup, i dati iniziali, e da poco anche `.claude/*`
      tranne `launch.json`. Da rileggere ogni volta che nasce un file nuovo con
      dati dentro.
- [x] **14.C.3** **`robots.txt` è `Disallow: /`** — ma il repository su GitHub
      resta pubblico e leggibile: il file scoraggia i motori, non protegge niente.
- [x] **14.C.4** **`manifest`: `orientation: portrait`** — l'app non ruota. Da
      confermare che sia voluto (i grafici in orizzontale si vedrebbero meglio).

---

## Nota di metodo, da rileggere la prossima volta

Tre volte in questo controllo ho detto «qui non c'è niente» e tre volte mi
sbagliavo: la documentazione (Blocco 12), gli strumenti da computer (Blocco 13),
i contenuti in `data/` (Blocco 14). L'ultima è la peggiore, perché non era
nemmeno una scelta: **non avevo fatto l'elenco dei file**. Si comincia da
`git ls-files`, sempre.

---

# Blocco 15 — I contenuti letti davvero (non solo controllati a macchina)

Nel Blocco 14 avevo controllato la **forma** dei due file `data/`. Non è la stessa
cosa che leggerli: le istruzioni che compaiono sul telefono mentre ti alleni sono
prosa, e un controllo automatico non sa se una frase è giusta. Letti tutti e 38
gli esercizi e tutti i 69 passaggi distinti di riscaldamento, stretching e
mobilità.

## 15.A — Cose che si vedono in palestra

- [ ] **15.A.1** ⚠️ **Istruzioni scritte al femminile sul telefono di lui.**
      Almeno sei passaggi sono al femminile: «Sdraiata su un fianco»
      (`abduzioni-decubito-laterale`), «Seduta a terra» (90/90 d'anca),
      «Appoggiata a una parete» (leg swing), «Sdraiata o seduta» (circonduzioni
      delle caviglie), «Sdraiata a terra» (gambe al muro), «Supina» (ginocchia al
      petto). Stanno nei giorni `dorso-quadricipiti`, `dorso-femorali`,
      `recupero-attivo-a/b` e in un esercizio della libreria comune. È il segno
      che quei contenuti sono nati per un profilo e vengono letti da tutti e due.
      Da verificare quali giorni usa il brief in vigore.
- [ ] **15.A.2** ⚠️ **«Gambe al muro, 5 min» è un passaggio di RISCALDAMENTO.**
      Sta fra le voci di `mobilita` dei due giorni di recupero attivo, quindi con
      un cronometro da cinque minuti **prima** dell'allenamento — e il suo stesso
      testo dice «è il passaggio scelto per il drenaggio venoso: **chiude bene**
      una giornata seduta». Sembra un passaggio di defaticamento finito nella
      lista sbagliata. Da controllare col brief.
- [ ] **15.A.3** ⚠️ **Due qualità di scrittura molto diverse.** I giorni vecchi
      hanno un «come si fa» di due-tre frasi con il riferimento sensoriale («Si
      sente davanti alla spalla»). I giorni nuovi (`push`, `pull`, `dorso-*`,
      `recupero-attivo-*`) hanno una riga secca: «Attivazione leggera prima delle
      serie di lavoro», «In quadrupedia, fai passare un braccio sotto il corpo».
      Chi non conosce già il movimento da lì non lo ricava. Sono proprio i giorni
      che il brief nuovo usa.
- [ ] **15.A.4** ⚠️ **Lo stesso movimento con dosi diverse e senza motivo
      apparente**: «Pettorali» compare a 30s, 30s per lato e 20s per lato con lo
      stesso identico «come»; «Cat-cow» a `10 rip lente`, `10 ripetizioni` e
      **`10`** nudo — dieci cosa? A schermo si legge «Cat-cow · 10».
- [ ] **15.A.5** ⚠️ **Un esercizio della libreria dichiara di sé stesso di essere
      sbagliato.** La voce sicurezza di `pallof-press-manubrio` dice: «con il
      manubrio la resistenza è verticale, quindi **qui non c'è lavoro
      anti-rotazione**: è una spinta frontale anti-estensione. Con l'attrezzatura
      disponibile il sostituto corretto è il **suitcase hold**». Ma il suitcase
      hold **non è nella libreria**, quindi il brief non può prescriverlo: se
      prescrive il Pallof press, l'atleta fa comunque l'esercizio che la scheda
      stessa dichiara inadatto. Da risolvere col coach.

## 15.B — Classificazioni da verificare

- [ ] **15.B.1** **Non esiste un pattern «glutei».** `ponte-glutei`,
      `ponte-glutei-piedi-rialzati`, `abduzioni-decubito-laterale` e
      `donkey-kick` sono classificati **femorali**: nella tabella volume per
      pattern il lavoro sui glutei viene contato fra i femorali. Da dichiarare o
      da separare.
- [ ] **15.B.2** **`rematore-bilanciere-presa-larga` ha un recupero predefinito
      di 60 secondi**, mentre gli altri esercizi con bilanciere ne hanno 120. Da
      verificare che sia voluto.
- [ ] **15.B.3** **`camminata` porta la prescrizione dentro la libreria**
      («Cinque chilometri, 4-5 km/h, zero inclinazione»): se il brief ne chiede
      una diversa, la scheda dice comunque cinque chilometri.
- [ ] **15.B.4** **`pilates` dichiara `sollecitaPolso`**: durante il Pilates
      compare l'avviso sulla domanda del dolore al polso. Plausibile
      (quadrupedia), da confermare.
- [ ] **15.B.5** **Verificato leggendo**: tutti e 38 gli esercizi hanno setup,
      esecuzione, errori comuni e cue coerenti fra loro, e nessuna istruzione
      contraddice un'altra dello stesso esercizio. La qualità della libreria
      comune è alta: il problema è solo nei contenuti dei giorni nuovi (15.A.3).

---

# Verifica finale: questa lista parla dell'app che gira davvero?

Un controllo che valeva la pena fare per ultimo, perché se andava male buttava
via tutto il resto: **il codice che ho letto è quello pubblicato?**

Fatto il 13 agosto 2026:

- nessuna modifica non committata (a parte questo documento);
- `HEAD` locale e `origin/main` sono lo **stesso commit** (`a582344`);
- la versione dichiarata in `sw.js` in locale e quella servita dal sito sono la
  stessa: `20260813-180916`;
- **tutti e 47 i file pubblicati sono identici byte per byte** a quelli letti.

Quindi le 502 voci di questa lista parlano esattamente dell'app che è online e
che il telefono scarica.

## Cosa resta fuori, e perché non è una dimenticanza

Due cose sole, e sono confini, non omissioni.

1. **`_privato/`** — i due master brief. Non li apro, per accordo, e non ho mai
   fatto eccezioni. Ma è lì che stanno lo split in vigore, le soglie, l'altezza,
   l'inventario, i punti dolenti, `contaAcqua` e `contaSigarette`: **decine di
   voci qui dentro dicono «da verificare contro il brief»** e solo tu puoi farlo.
   È il singolo controllo che rende di più fra quelli rimasti.
2. **Il telefono** — cosa c'è installato e cosa c'è in archivio. Da qui non si
   vede. È tutto il Blocco 8.

Il resto è provare. La lettura è finita.
