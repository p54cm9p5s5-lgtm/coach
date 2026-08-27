# Coach — Specifica funzionale

Documento di progetto. Fonte di verità per la costruzione dell'app.
Ultimo aggiornamento: 9 agosto 2026 (modello dati e §2 riallineati al codice).

---

## 0. Cos'è

App personale di allenamento e salute per iPhone, ad uso di un solo utente.
Sostituisce le tabelle a mano del *master brief coaching.md* per tutto ciò che è
registrazione, calcolo e promemoria. Non sostituisce il coaching: il giudizio
resta nella conversazione con Claude.

**Divisione di competenze, non negoziabile:**

| Cosa | Chi la possiede |
|---|---|
| Programma, regole, soglie, gerarchia delle modifiche | master brief (Claude) → caricato nell'app |
| Sedute, serie, RPE, tecnica, dolori, misure, foto | app |
| Sonno, movimento, passi, FC, allenamenti Watch, pressione | app Salute → importata |
| Decisioni su carichi, volume, esercizi | atleta, su proposta dell'app o di Claude |

---

## 1. Vincoli tecnici (decisi, non rivedibili senza motivo)

- **PWA** installata sulla schermata Home. Nessuna app nativa: niente account
  sviluppatore Apple, niente scadenza a 7 giorni.
- **Zero build step.** HTML/CSS/JS vanilla, nessun framework, nessun bundler.
  Sull'host non esistono node/npm. Il repo si serve così com'è.
- **Hosting:** GitHub Pages, repo **pubblico** → *nel repo non entra alcun dato
  personale*. Codice e contenuti generici sì; dati di salute mai. Il caricamento
  dei dati avviene sul telefono, importando i file.
- **Persistenza:** IndexedDB sul dispositivo. Nessun server, nessun account,
  nessun dato in rete.
- **Due sole richieste esterne, tutt'e due verso YouTube.** Nessuna schermata
  contatta niente, tranne la scheda di un esercizio: quando compare a schermo
  monta il player (`youtube-nocookie.com`) e scarica la miniatura (`i.ytimg.com`),
  che poi resta salvata e serve quando la rete non c'è.
  Questo vincolo è stato **rivisto il 27/08/2026**, ed è giusto che si veda: prima
  diceva «parte solo se lo tocchi, la copertina è disegnata dall'app». Il player
  è stato montato insieme alla scheda perché al tocco parta subito, e il prezzo
  dichiarato è che YouTube vede l'indirizzo e quale esercizio stai guardando.
  Il documento è rimasto indietro di settimane mentre l'app faceva un'altra cosa:
  adesso l'elenco dei domini ammessi è controllato a ogni collaudo da
  `tools/rete.js`, così a restare indietro non può più essere in silenzio.
- **iOS può cancellare l'archivio** quando lo spazio scarseggia. L'app chiede la
  persistenza all'avvio; la risposta è mostrata in Impostazioni («Archivio
  protetto dal telefono», sì/no), perché cambia quanto conta il backup su file.
- **Backup, due livelli distinti e dichiarati come tali:**
  - *copia interna*, automatica a fine di ogni seduta, salvata nel dispositivo.
    Protegge da errori dell'app e cancellazioni accidentali, non dalla perdita
    del telefono. Non contiene le foto.
  - *backup su file*, manuale, completo, da salvare in File/iCloud Drive.
    È l'unico che sopravvive al telefono; se manca da oltre 7 giorni l'app lo
    segnala in Oggi.
  - Il ripristino da file **sostituisce** sempre: l'app non produce backup con
    `modo: "unisci"`, quindi quella strada esiste nel codice ma non si può
    imboccare da qui. Prima di sostituire, il ripristino dice cosa c'è nel file
    e cosa c'è adesso sul telefono, e tiene da parte una copia interna.
- **Offline:** service worker, tutto funzionante senza rete tranne i video YouTube.
- **Schermo:** Wake Lock attivo per l'intera durata della Modalità Seduta.
- **Test locale:** `python3 tools/serve.py 8787` (serve senza cache) + browser.

### Limiti accettati e dichiarati
- Nessuna notifica push (i promemoria restano in Promemoria iOS).
- Nessuna vibrazione (Safari iOS non la espone).
- Nessuna app Apple Watch.
- Import da Salute non automatico: a tap, tramite Shortcut.

---

## 2. Estetica

**Look iOS nativo.** L'app deve sembrare un'app di sistema, non un sito.

- Font: `-apple-system` / SF. Nessun font caricato dalla rete.
- Colori — **due regole in una riga: l'interfaccia è nera su carta, i dati
  tengono i colori con cui li hai misurati.**
  - **Interfaccia**: inchiostro `#101113` per tutto quello che si legge e si
    tocca (tasti, barra delle sezioni, titoli, anelli, calendario, righe).
    **Niente blu, da nessuna parte.** Anche i punteggi sono inchiostro: quanto
    sei andato bene lo dicono la cifra, che è grande apposta, e la parola sotto
    («ottimo», «sufficiente», «da rivedere»).
  - **Dati misurati**: tengono la tinta dell'orologio — calorie `#1C6E31`,
    battito `#C9271B`, sforzo `#6B2FB5`, durata `#AB8800`, bpm `#8A5100`. Non
    sono decorazione: sono i colori con cui quei numeri ti sono già stati
    mostrati al polso, e cambiarli vorrebbe dire non farli riconoscere.
  - **Rosso `#A3241A`**: allarme e cancellazione, mai decorazione.
  - Fondo di carta calda `#FAF9F6`, uno solo. Non c'è tema scuro e non si segue
    `prefers-color-scheme`: l'app ha un fondo solo, e i colori non dipendono più
    da cosa fa l'iPhone. Il tema «nero e lime» e l'interruttore in Impostazioni
    non esistono più.
- Struttura: **nessuna scheda.** Quello che divide due blocchi è una riga da
  1 px, non un rettangolo bianco; `border-radius` 2px, e solo dove un pieno
  serve davvero (tasto premuto, segmento scelto). Header grandi (Large Title)
  che si contraggono allo scroll.
- Gerarchia: dentro l'interfaccia la fanno **corpo, peso e posizione**, non la
  tinta. Le cifre sono
  l'elemento grafico dominante (fino a 76 pt negli anelli, 56 pt nelle schede
  di Salute); gli anelli sono fili da 2 px, i grafici linee da 1,4 px senza
  riempimenti.
- Stati che non sono testo si codificano con la **forma**, non col colore:
  barra piena = allenamento, mezzo tono = riposo, pallino = nessun dato,
  contorno tratteggiato = in programma.
- Le spiegazioni lunghe sotto i grafici stanno dietro un tondino **ⓘ**: quello
  che serve a ogni occhiata — il bersaglio — resta scritto sul grafico, sulla
  sua riga tratteggiata.
- Un solo selettore di periodo per schermata, in testata: il periodo è il
  contesto di lettura, non una proprietà della singola scheda.
- Navigazione: **tab bar in basso, 6 voci** — Home · Oggi · Salute · Fumo ·
  Acqua · Allenamenti. Fumo e Acqua compaiono solo per chi le dichiara nel brief:
  chi non conta le sigarette non vede la scheda, e viceversa per l'acqua, quindi
  in pratica sono cinque. **Corpo e Storico si aprono da dentro Salute**, in
  fondo alla schermata: sono due letture dei dati, non due posti dove si
  registra qualcosa ogni giorno, e la barra resta per quello che si tocca
  durante la giornata. Mentre sono aperti la scheda accesa resta Salute.
  Impostazioni raggiungibile dall'header di Home.
- Safe area rispettata (notch e barra Home). Nessuno scroll orizzontale mai.
- Tocco: target minimo 44px. In Modalità Seduta il tasto che porta avanti è a
  54px e quelli di servizio a 44px, separati da un fosso di 10px: con i tasti
  attaccati un tocco un po' alto su «Serie completata» finiva su «Salta
  esercizio», e il polpastrello è largo quasi un centimetro.

**Eccezione — Modalità Seduta.** Esce dallo stile "lista" e va a schermo pieno:
un'informazione dominante per volta, numeri grandi (carico 52pt, timer 56pt in un
anello di avanzamento), tasto principale ancorato in basso, tab bar nascosta, e
una barra sottile che mostra a che punto è la seduta.
I pulsanti restano contenuti: 54px il principale, 44px i secondari (vedi §2).
Il contenuto dominante **alterna** secondo il momento:

| Momento | Cosa domina |
|---|---|
| Prima della serie | carico, serie N di M, ripetizioni target |
| Durante il recupero | timer countdown |
| Questionario | i due righelli 1–10 |

**Tono dei testi:** consulente asciutto. "Serie 2 di 3. Recupero 120 s."
Nessun incoraggiamento, nessun punto esclamativo, nessuna gamification.
Coerente con §17 del master brief.

---

## 3. Modello dati

Chiavi primarie sempre esplicite. Ogni entità porta `creatoIl` e `fonte`
(`app` | `salute` | `brief` | `import`).

### 3.1 Programma (da master brief)
```
Programma        versione, dataBrief, giorni[] (5-7: sabato e domenica sono di sola mobilità), regole, note
GiornoSplit      id, nome (Petto/Tricipiti…), giornoSettimana, esercizi[], cardio: bool
EsercizioDef     id, nome, pattern, attrezzo,
                 serieTarget, ripTargetMin, ripTargetMax,
                 recuperoDefaultSec (120 compound / 90 isolamenti),
                 caricoIniziale, sollecitaPolso: bool,
                 istruzioni { setup, esecuzione, erroriComuni, cue },
                 videoUrl (YouTube, EN ammesso), animazioneId
Regole           soglieFinestre, gerarchia[8], targetCardio { kmhMin, kmhMax, fcMin, fcMax, fcLimite },
                 rpeTarget { min, max }, promemoria[], inventarioDischi[]
```
`pattern` ∈ spinta · tirataOrizzontale · tirataVerticale · quadricipiti ·
femorali · polpacci · core · deltoideLaterale · deltoidePosteriore · trapezi ·
bicipiti · tricipiti · dorsaliAltro.
Serve al calcolo automatico della tabella volume/pattern (§5-ter del brief).
Il pullover è `dorsaliAltro` e non `tirataVerticale`: così la tirata verticale
resta a 0 serie, come nel brief.

### 3.2 Allenamento
```
Seduta           id, data, tipoId, tipoNome, tipoProgrammatoId,
                 stato (inCorso|completata), oraInizio, oraFine, oraInizioLavoro,
                 durataLavoroSec, riscaldamento { fatto, modalita, note },
                 cardio { previsto, eseguito, kmh, durataMin, durataPrevistaMin,
                          finitoIl, saltatoMotivo, note, soglie },
                 stretching { fatto }, mobilita { fatto },
                 previstiElenco[], progresso, completezza, notaGenerale,
                 orologio { … } (solo sulle sedute vecchie: non si scrive più)
SerieLog         id, sedutaId, esercizioId, numero, carico, caricoTarget,
                 ripFatte, ripTarget, aTempo, tsInizioSerie, tsFineSerie,
                 recuperoRealeSec, recuperoTargetSec
EsercizioLog     id, sedutaId, esercizioId, ordine, punteggio,
                 rpe (1–10, riferito all'ultima serie), tecnica (1–10),
                 dolori[] { id, nome, quando (durante|dopo),
                            intensita (lieve|medio|forte) },
                 nota, saltato { motivo (tempo|dolore|attrezzo|altro), nota }

I punti dolenti li dichiara il brief (`regole.dolori`), uno per uno: non sono
fissi. I campi `dolorePolso*` restano solo per leggere gli archivi vecchi.
```
`nota` vuota = **nessun segnale**, esplicito, non campo dimenticato:
il questionario è obbligatorio per avanzare.

### 3.3 Corpo
```
Misura           id, data, tipo, valore, condizioniStandard: bool
                 tipo ∈ peso · vitaOmbelico (primaria) · vitaStretta · fianchi ·
                        petto · bicipiteRilassato · coscia
AllenamentoWatch uuid (PK), data, inizio, fine, durataSec, tipo (nome di Apple),
                 km, kcalAttive, kcalTotali, fcMedia, fcMin, fcMax, sforzo (1-10),
                 battito[] ({min,max} ogni ~30s, `null` dove non ha misurato;
                            i pacchetti vecchi hanno un numero solo, si legge uguale),
                 Letti da Salute, mai scritti dall'app. Non vengono collegati
                 alle sedute e non hanno un ruolo da assegnare: nel pacchetto
                 arrivano come dati dell'orologio, da leggere accanto al log.
                 Fuori da ogni punteggio.
Foto             id, data, posa (fronte|profiloDx|schiena|profiloSx),
                 immagine (data URL, NON un Blob: il backup è JSON e un Blob
                           dentro JSON sparirebbe senza dire niente),
                 checklist { protocollo, riferimento?, daLibreria? }
```

### 3.4 Salute (importata)
```
GiornoSalute     data (PK), presente: bool, kcalAttive, obiettivoKcal, passi,
                 minutiEsercizio, minutiInPiedi, pianiSaliti, distanzaKm, fcRiposo
Notte            data (PK, notte del), presente: bool, durataMin,
                 profondoMin, remMin, vegliaMin, risvegli
AllenamentoWatch  vedi §3.3: non viene collegato alle sedute (il campo
                  `sedutaId` resta a null e non lo scrive più nessuno)
NotaWatch        uuid (PK, lo stesso dell'allenamento), talkTest, nota
```
`NotaWatch` sta in un archivio **a parte** e non dentro l'allenamento, per una
ragione precisa: quello è roba dell'orologio, si riscrive a ogni import e si può
svuotare in blocco. Quello che scrivi tu non deve sparire con lui.

Il **talk-test** è l'unica colonna scritta dall'atleta e non misurata: dice se
durante l'allenamento riusciva a parlare. Si risponde solo su camminate, corse
ed escursioni — altrove l'intensità la dicono carico e RPE del log. Una giornata
con un'attività a cui il talk-test è stato risposto vale come giornata di
allenamento nel punteggio Salute; senza risposta la giornata **resta fuori dal
conto**, non vale zero.
**Invariante critica:** `presente: false` ≠ valore 0. Un giorno senza dati è
escluso dalle medie e dal conteggio delle finestre, e segnalato.

### 3.5 Decisioni e segnali
```
Proposta         id, data, esercizioId, livelloGerarchia (3|4|…),
                 da, a, quattroDomande { perche, quali, alternative, atteso },
                 stato (inSospeso|accettata|rifiutata|rimandata),
                 dataVerifica, esitoVerifica
Decisione        id, data, oggetto, livello, testo, fonte (app|chat), dataVerifica
Segnale          id, data, tipo, gravita (info|attenzione), messaggio, riferimenti[]
```

### 3.6 Impostazioni
```
obiettivoMovimentoKcal (default 600) · finestraImportGiorni (30) · suonoFineRecupero
ultimoExport · ultimoSnapshot · snapshotAutomatico · ultimoImportSalute
fumoContatoDal · fumoTettoDichiarato · agenda · videoRiscaldamento
```

---

## 4. Funzionalità per schermata

### 4.1 Oggi
- Seduta prevista oggi secondo lo split, con tasto **[Inizia]**. Quale
  allenamento tocca lo decide il brief (o il calendario del coach): l'app lo
  esegue e non offre di cambiarlo, perché non è una scelta che le spetta.
- Cosa manca: peso settimanale scaduto, foto attese, import Salute vecchio di N giorni.
- Stato finestre: `Movimento 12/21 giorni · Sonno 9/21 notti`.
- Proposte in sospeso.
- I promemoria a orario restano in Promemoria iOS; qui se ne vede solo lo **stato**.

### 4.2 Modalità Seduta
Sequenza rigida, un passo per volta.

1. **Riscaldamento specifico per il giorno** — camminata 5 minuti a 5 km/h (con
   alternativa concreta senza tapis), poi la mobilità mirata al lavoro previsto,
   ciascun movimento con dose e istruzione: **4-7 movimenti** a seconda del
   giorno, circa dieci minuti in tutto. Chiude con la serie di avvicinamento sul
   primo esercizio. Avviso: avviare sul Watch
   un'unica sessione "Rafforzamento funzionale" che comprenda riscaldamento e pesi.
   **Lo stretching statico non sta qui ma a fine seduta**: allungare a freddo un
   muscolo che poi deve spingere riduce la forza espressa. Il riepilogo mostra
   **3-5 allungamenti** specifici per il giorno appena fatto, e sui giorni del
   nuovo split, dopo lo stretching, il blocco di mobilità di fine seduta.
2. **Esercizio N** — una sola scheda, tutta visibile, senza niente da aprire:
   **video in testa**, poi esecuzione, setup, errori da evitare, cue, sicurezza.
   Video YouTube specifico per esercizio (inglese ammesso), verificato esistente
   e sostituibile dall'app incollando un altro link. Carico suggerito
   **e quali dischi montare** dall'inventario.
3. **Serie** — `[SERIE COMPLETATA]` → timer parte nello stesso istante.
   Durante il recupero **fra una serie e l'altra**: ripetizioni fatte
   (precompilate) e carico (precompilato dall'ultima volta). Nel recupero che
   segue la valutazione quei campi non ci sono: restano il cronometro e il
   prossimo esercizio. +15 / −15 s. Timer per esercizio, default 120 s.
   **Avviso di fine: suono ripetuto finché non tocchi**, più cambio colore schermo.
   Il suono si dichiara a iOS come **`transient`**: si sente anche col telefono in
   silenzioso e la musica che stavi ascoltando **riprende da sola** appena lo
   spegni. In tutti gli altri momenti l'app si dichiara **`ambient`** — sblocco
   dell'audio compreso — e non tiene acceso nessun contesto audio: chi ha detto a
   iOS di essere un lettore musicale, anche una volta sola, la musica non la
   restituisce più.
4. **Questionario di fine esercizio** (obbligatorio):
   - "Quanto è stata dura l'ultima serie?" → 10 tasti, zona 6–8 evidenziata,
     sotto la selezione la traduzione in ripetizioni rimaste (8 = "ne avevo ancora 2").
   - "Com'è andata la tecnica?" → 10 tasti.
   - Una domanda per ogni punto dolente dichiarato in `regole.dolori` (senza
     dichiarazione: il polso destro) → NO/SÌ, e se SÌ una riga: durante/dopo,
     lieve/medio/forte.
   - Nota facoltativa, dettatura vocale ammessa.
5. **Salto esercizio** — motivo obbligatorio (tempo | dolore | attrezzo | altro) + nota.
6. **Cardio** — step guidato in coda alla seduta (mai dopo Gambe/Core):
   velocità target 4,5–5 km/h e FC 105–115 in evidenza, avviso sopra 125.
   Chiede velocità impostata sul tapis e durata prevista. Nessun video.
   **Cronometro all'insù, senza fine**: parte da zero, la durata prevista è solo
   un traguardo (anello + un suono una volta sola, zittibile senza chiudere), e
   i minuti registrati sono quelli fra l'avvio e «Ho finito». Sopra i previsti
   +20 min l'app chiede conferma: non sa distinguere una camminata lunga da un
   «Ho finito» toccato tardi.
7. **Fine seduta** — riepilogo: durata, densità (serie/minuto), recuperi medi
   reali, RPE per esercizio, dati mancanti. Tasto per generare il pacchetto export.

Dati derivati automaticamente dagli orari, senza inserimento manuale:
recuperi reali su tutti gli esercizi, densità della seduta, tempo per esercizio.

### 4.3 Corpo
- Peso e circonferenze, con **vita ombelico in evidenza** come metrica primaria.
- Promemoria condizioni standard (mattino, digiuno, dopo il bagno, prima di bere).
- Foto: 4 pose, **griglia fissa e foto precedente in trasparenza** per allineare
  posa e distanza, checklist condizioni prima dello scatto. Restano sul dispositivo.
- Nessun grafico: in Corpo ci sono i valori, la variazione rispetto alla
  misura precedente e gli indici. L'andamento nel tempo si guarda in Salute.

### 4.4 Salute
- Tasto **[Aggiorna dati salute]** → si incolla il pacchetto, oppure si sceglie
  l'`export.xml` di Salute. Il comando rapido per la salute **non viene più
  offerto**: le azioni di Salute dentro Comandi Rapidi restano appese. Resta
  quello del calendario, che funziona.
- Finestra mobile **30 giorni**, import **idempotente** (chiave = tipo + data),
  riscrive i dati di Salute, **non tocca mai** note, RPE, carichi, misure manuali.
- Tabelle movimento e sonno equivalenti a §9-bis e §9-ter, calcolate non digitate.
- Stato delle finestre di 3 settimane con giorni mancanti evidenziati.
- Gli allenamenti del Watch **non si collegano** alle sedute e non hanno un
  ruolo da assegnare: è stato provato e serviva solo a far perdere tempo per
  un'informazione che nessuno usava. Arrivano al coach come quello che sono,
  da leggere accanto al log e non al posto suo.

### 4.5 Storico e progressione
- Per esercizio: carico, ripetizioni, RPE, tecnica nel tempo.
- **Volume settimanale per pattern**, calcolato sui **prossimi sette giorni**
  (tabella §5-ter automatica). Non è la somma dello split: nel brief possono
  convivere due programmi — quello che finisce e quello che comincia — e a
  decidere quale vale in un certo giorno è il calendario. Senza calendario ogni
  giorno della settimana conta una volta sola, come per `giornoPrevisto`.
- Elenco sedute, dati mancanti, esercizi saltati con motivo.
- Registro decisioni con data di verifica e esito.

### 4.6 Segnali e proposte
Motore deterministico. **Propone, non applica mai.**

*Progressione (dopo almeno 2 esposizioni dello stesso esercizio):*

| Condizione sull'ultima serie | Proposta |
|---|---|
| RPE ≤ 7, tutte le rip, tecnica ≥ 8, nessun dolore, per 2 esposizioni | +1 ripetizione; se al tetto del range, +incremento minimo di carico |
| RPE 8, tutte le rip, tecnica buona | nessuna modifica (zona corretta) |
| RPE ≥ 9 o ripetizioni mancate | nessuna modifica |
| Tecnica < 5 | riduzione del carico |
| Dati mancanti in una delle esposizioni | nessuna proposta |

Doppia progressione: ripetizioni fino al tetto del range (livello 3), poi carico
con ritorno al fondo del range (livello 4).

**Incremento minimo reale: 1 kg totale, non 4.** Il §16 del master brief assume che
si aggiungano dischi a una configurazione esistente (2×1 kg per lato = +4 kg). In
realtà i dischi si possono ricomporre: 30 kg = 5+5 per lato, 31 kg = 5+2,5+2+1 per
lato. Con l'inventario attuale sono realizzabili 82 carichi distinti da 10 a 96 kg.
L'app calcola sempre la combinazione esatta con meno dischi possibile, quindi la
progressione di carico può essere fine (+1 o +2 kg, cioè +3% su 30 kg) invece che
brutale (+13%). Questo va corretto nel brief.

*Altri segnali:* cardio fuori protocollo (km/h e FC), inversione di intensità
(RPE pesi < sforzo cardio), pattern polso su più sedute, finestre completate,
soglie ±20% di movimento e sonno, taratura RPE (dichiarato vs ripetizioni poi eseguite),
buchi di dati.

Ogni proposta si presenta con **le 4 domande già compilate**, il livello della
gerarchia dichiarato e una data di verifica. Tre tasti: Accetto / Rifiuto / Rimando.
L'esito finisce nel registro decisioni.

**Definizioni operative** (scelte in fase 4, servono a rendere le regole calcolabili):

- *Ripetizioni di una esposizione* = la **serie peggiore**, non la media: se una
  serie resta indietro l'esercizio non è stato completato.
- *Ripetizioni mancate* = serie peggiore sotto `ripMin`, cioè sotto il fondo del
  range. *Tetto del range* = serie peggiore a `ripMax`.
- *Riduzione per tecnica* è **livello 1** (correzione della tecnica), non 4:
  il carico è il mezzo, la tecnica è l'oggetto. Basta una sola osservazione,
  come previsto dal §7 del master brief per i livelli 1-2. Lo scarico è del 10%,
  arrotondato al carico componibile inferiore.
- *Incremento di carico*: il più piccolo realizzabile con l'inventario per il
  bilanciere, 1 kg per manubri e macchine (stesso passo del selettore in seduta).
- *Corpo libero al tetto del range*: nessuna proposta automatica ma un segnale.
  La variante più difficile è una scelta da fare in conversazione, non un calcolo.
- Una proposta **accettata** vale come obiettivo per la **prossima esposizione**:
  compare in Modalità Seduta e poi il motore rivaluta sui dati nuovi. Il
  **carico** deciso però resta: dopo che l'obiettivo è stato consumato comanda
  ancora lui, prima del numero scritto nel brief, finché non arriva un brief
  nuovo o una decisione più recente. Serve agli esercizi che tornano due volte
  a settimana, dove altrimenti la seconda volta l'app richiedeva il carico
  vecchio. Il bersaglio di **ripetizioni** non resta: deve poter risalire dentro
  il range, che è la doppia progressione.
  **Rifiutata** non torna finché i dati restano quelli; **rimandata** torna dopo
  la prossima esposizione. Una proposta in sospeso che non regge più ai dati
  viene tolta: meglio niente che un consiglio scaduto.
- Una proposta che il **brief ha già realizzato** sparisce da sola, anche se
  non le è mai stato risposto. Le proposte nascono da quello che è stato
  alzato, non da quello che c'è scritto: dopo un brief che porta la panca da 30
  a 35, l'app continuava a chiedere «30 → 31», cioè una decisione già presa —
  e presa più in grande, tanto che accettarla avrebbe abbassato il carico.

### 4.7 Impostazioni
- **Carica master brief (.md)** → aggiorna **programma e regole**, mai i dati
  registrati. Mostra un riepilogo delle differenze prima di applicare.
  Esercizi rimossi vengono archiviati, non cancellati: lo storico resta.
- Export/import backup JSON.
- Inventario dischi, obiettivo movimento, suoni.

---

## 5. Contratto master brief ↔ app

Il master brief resta di competenza di Claude e leggibile da un umano.
In coda al documento viene aggiunto un **blocco tecnico** delimitato:

```
<!-- COACH-DATA v1 -->
{ … programma, esercizi, regole, soglie, inventario … }
<!-- /COACH-DATA -->
```

- L'app legge **solo** quel blocco; il resto del documento lo ignora.
- Se il blocco manca o la versione non è supportata, l'app lo dice e non applica nulla.
- Il file caricato non viene conservato: l'app ne estrae il blocco e lo scarta.

---

## 6. Ponte con Salute (Shortcut)

1. **Shortcut sonda** — primo pezzo da costruire: legge tutto ciò che Shortcuts
   espone su questo iPhone e ne stampa l'elenco. L'ingestione si progetta su
   quello che risulta davvero disponibile, non su ipotesi.
2. **Shortcut di import** — finestra 30 giorni: sonno (durata e fasi), energia
   attiva, passi, minuti esercizio, FC a riposo, allenamenti.
   Output compatto negli appunti.
3. **Riserva** — esportazione completa di Salute per lo storico e per i campi
   che Shortcuts non espone. Obiettivo dichiarato: zero screenshot.

Se l'obiettivo Movimento (600 kcal) non è leggibile, resta una costante nelle
impostazioni.

---

## 7. Ordine di costruzione

| Fase | Contenuto | Utilizzabile da sola | Stato |
|---|---|---|---|
| 1 | Modalità Seduta completa + programma + storico + seed dal brief | sì, ci si allena | fatta |
| 2 | Corpo: misure, pressione, foto con guida | sì | fatta |
| 3 | Ponte Salute: sonda, import, tabelle, finestre | sì | fatta |
| 4 | Segnali, proposte di progressione, registro decisioni | sì | fatta |
| 5 | Export per la chat, caricamento .md, backup, rifinitura | completa | fatta |
| 6 | Seconda persona: differenze dichiarate dal brief, non dal codice | sì | fatta |

Ogni fase si chiude solo quando è verificata sul dispositivo simulato e usabile.
Il motore della fase 4 è deterministico e quindi verificabile fuori dal telefono,
ma le prove si fanno dentro il browser, contro il codice davvero pubblicato: sul
Mac non c'è node, e uno script a parte finiva per provare una copia del motore
invece del motore.

---

## 8. Dati di partenza

Lo storico già raccolto (sedute svolte, misure, movimento, sonno, decisioni prese)
entra nell'app importando il file generato in `_privato/`, mai committato.
Il generatore stesso sta in `_privato/seed.py`: contiene dati personali e non
appartiene al repository pubblico.

---

## 9. Cosa l'app non fa, per scelta

- Non modifica mai il programma da sola.
- Non tratta pressione arteriosa né ECG: restano fuori dall'app, nel master brief.
  Il modello dati lascia lo spazio per aggiungerli in seguito senza rifare niente.
- Non interpreta alcun dato clinico: mostra numeri, nessuna diagnosi.
- Non calcola fabbisogni calorici né dà indicazioni alimentari.
- Non manda **dati** fuori dal telefono: niente account, niente server, nessun
  numero che esce. Le uniche richieste in uscita sono le due verso YouTube — il
  player e la miniatura — e partono quando la scheda di un esercizio compare a
  schermo (vedi §1). Non portano con sé nessun tuo dato, ma YouTube vede
  l'indirizzo e quale esercizio stai guardando. Senza rete il player non parte,
  resta la miniatura salvata e l'app funziona lo stesso.
