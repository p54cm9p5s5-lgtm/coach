# Coach — Specifica funzionale

Documento di progetto. Fonte di verità per la costruzione dell'app.
Ultimo aggiornamento: 3 agosto 2026.

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
- **Backup, due livelli distinti e dichiarati come tali:**
  - *copia interna*, automatica a fine di ogni seduta, salvata nel dispositivo.
    Protegge da errori dell'app e cancellazioni accidentali, non dalla perdita
    del telefono. Non contiene le foto.
  - *backup su file*, manuale, completo, da salvare in File/iCloud Drive.
    È l'unico che sopravvive al telefono; se manca da oltre 7 giorni l'app lo
    segnala in Oggi.
  - Un file di backup può dichiarare `modo: "unisci"`: viene aggiunto ai dati
    presenti invece di sostituirli. Serve ai dati iniziali, così l'ordine tra
    importazione e caricamento del brief non conta.
- **Offline:** service worker, tutto funzionante senza rete tranne i video YouTube.
- **Schermo:** Wake Lock attivo per l'intera durata della Modalità Seduta.
- **Test locale:** `python3 -m http.server` + browser.

### Limiti accettati e dichiarati
- Nessuna notifica push (i promemoria restano in Promemoria iOS).
- Nessuna vibrazione (Safari iOS non la espone).
- Nessuna app Apple Watch.
- Import da Salute non automatico: a tap, tramite Shortcut.

---

## 2. Estetica

**Look iOS nativo.** L'app deve sembrare un'app di sistema, non un sito.

- Font: `-apple-system` / SF. Nessun font caricato dalla rete.
- Colori: variabili di sistema, `prefers-color-scheme` automatico chiaro/scuro.
  Accento: blu di sistema. Nessuna palette personalizzata.
- Struttura: liste raggruppate in stile Impostazioni, `border-radius` 10px,
  separatori sottili, header grandi (Large Title) che si contraggono allo scroll.
- Navigazione: **tab bar in basso, 5 voci** — Oggi · Seduta · Corpo · Salute · Storico.
  Impostazioni raggiungibile dall'header di Oggi.
- Safe area rispettata (notch e barra Home). Nessuno scroll orizzontale mai.
- Tocco: target minimo 44px; in Modalità Seduta minimo 64px.

**Eccezione — Modalità Seduta.** Esce dallo stile "lista" e va a schermo pieno:
un'informazione dominante per volta, numeri grandi (carico 52pt, timer 56pt in un
anello di avanzamento), tasto principale ancorato in basso, tab bar nascosta, e
una barra sottile che mostra a che punto è la seduta.
I pulsanti restano contenuti: 50px il principale, 38px i secondari.
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
Programma        versione, dataBrief, giorni[5], regole, note
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
Seduta           id, data, tipoProgrammato, tipoEseguito, stato (inCorso|completata|interrotta),
                 oraInizio, oraFine, riscaldamento { fatto, modalita, note },
                 cardio { eseguito, kmh, durataMin, note }, notaGenerale
SerieLog         id, sedutaId, esercizioId, numero, carico, ripFatte, ripTarget,
                 tsFineSerie, recuperoRealeSec, recuperoTargetSec
EsercizioLog     id, sedutaId, esercizioId, ordine,
                 rpe (1–10, riferito all'ultima serie), tecnica (1–10),
                 dolorePolso: bool, dolorePolsoQuando (durante|dopo),
                 dolorePolsoIntensita (lieve|medio|forte),
                 nota, saltato { motivo (tempo|dolore|attrezzo|altro), nota }
```
`nota` vuota = **nessun segnale**, esplicito, non campo dimenticato:
il questionario è obbligatorio per avanzare.

### 3.3 Corpo
```
Misura           id, data, tipo, valore, condizioniStandard: bool
                 tipo ∈ peso · vitaOmbelico (primaria) · vitaStretta · fianchi ·
                        petto · bicipiteRilassato · coscia
Foto             id, data, posa (fronte|schiena|profiloDx|profiloSx), blob,
                 checklist { mattina, digiuno, dopoBagno, stessaLuce, bracciaLungoFianchi }
```

### 3.4 Salute (importata)
```
GiornoSalute     data (PK), presente: bool, kcalAttive, obiettivoKcal, passi,
                 minutiEsercizio, fcRiposo
Notte            data (PK, notte del), presente: bool, durataMin,
                 profondoMin, remMin, vegliaMin, risvegli
AllenamentoWatch uuid (PK), inizio, fine, durataSec, kcalAttive, kcalTotali,
                 fcMedia, fcMax, tipo, sedutaId (collegamento manuale o automatico per orario)
```
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
obiettivoMovimentoKcal (default 600) · inventarioDischi · finestraImportGiorni (30)
suonoFineRecupero · ultimoBackup · ultimoImportSalute · versioneBrief
```

---

## 4. Funzionalità per schermata

### 4.1 Oggi
- Seduta prevista oggi secondo lo split, con tasto **[Inizia]**; cambiabile con un tap.
- Cosa manca: peso settimanale scaduto, foto attese, import Salute vecchio di N giorni.
- Stato finestre: `Movimento 12/21 giorni · Sonno 9/21 notti`.
- Proposte in sospeso.
- I promemoria a orario restano in Promemoria iOS; qui se ne vede solo lo **stato**.

### 4.2 Modalità Seduta
Sequenza rigida, un passo per volta.

1. **Riscaldamento specifico per il giorno** — camminata 5 minuti a 5 km/h (con
   alternativa concreta senza tapis), poi mobilità mirata al lavoro previsto:
   5 esercizi per giorno dello split, ciascuno con dose e istruzione. Chiude con
   la serie di avvicinamento sul primo esercizio. Avviso: avviare sul Watch
   un'unica sessione "Rafforzamento funzionale" che comprenda riscaldamento e pesi.
   **Lo stretching statico non sta qui ma a fine seduta**: allungare a freddo un
   muscolo che poi deve spingere riduce la forza espressa. Il riepilogo mostra
   2-4 allungamenti specifici per il giorno appena fatto.
2. **Esercizio N** — una sola scheda, tutta visibile, senza niente da aprire:
   **video in testa**, poi esecuzione, setup, errori da evitare, cue, sicurezza.
   Video YouTube specifico per esercizio (inglese ammesso), verificato esistente
   e sostituibile dall'app incollando un altro link. Carico suggerito
   **e quali dischi montare** dall'inventario.
3. **Serie** — `[SERIE COMPLETATA]` → timer parte nello stesso istante.
   Durante il recupero: ripetizioni fatte (precompilate) e carico (precompilato
   dall'ultima volta). +15 / −15 s. Timer per esercizio, default 120 s.
   **Avviso di fine: suono ripetuto finché non tocchi**, più cambio colore schermo.
4. **Questionario di fine esercizio** (obbligatorio):
   - "Quanto è stata dura l'ultima serie?" → 10 tasti, zona 6–8 evidenziata,
     sotto la selezione la traduzione in ripetizioni rimaste (8 = "ne avevo ancora 2").
   - "Com'è andata la tecnica?" → 10 tasti.
   - "Dolore al polso destro?" NO/SÌ → se SÌ compare una riga: durante/dopo,
     lieve/medio/forte.
   - Nota facoltativa, dettatura vocale ammessa.
5. **Salto esercizio** — motivo obbligatorio (tempo | dolore | attrezzo | altro) + nota.
6. **Cardio** — step guidato in coda alla seduta (mai dopo Gambe/Core):
   velocità target 4,5–5 km/h e FC 105–115 in evidenza, avviso sopra 125.
   Chiede velocità impostata sul tapis e durata. Nessun video.
7. **Fine seduta** — riepilogo: durata, densità (serie/minuto), recuperi medi
   reali, RPE per esercizio, dati mancanti. Tasto per generare il pacchetto export.

Dati derivati automaticamente dagli orari, senza inserimento manuale:
recuperi reali su tutti gli esercizi, densità della seduta, tempo per esercizio.

### 4.3 Corpo
- Peso e circonferenze, con **vita ombelico in evidenza** come metrica primaria.
- Promemoria condizioni standard (mattino, digiuno, dopo il bagno, prima di bere).
- Foto: 4 pose, **griglia fissa e foto precedente in trasparenza** per allineare
  posa e distanza, checklist condizioni prima dello scatto. Restano sul dispositivo.
- Grafici: vita, peso, rapporto vita/altezza.

### 4.4 Salute
- Tasto **[Aggiorna dati salute]** → lancia lo Shortcut → si torna e si incolla.
- Finestra mobile **30 giorni**, import **idempotente** (chiave = tipo + data),
  riscrive i dati di Salute, **non tocca mai** note, RPE, carichi, misure manuali.
- Tabelle movimento e sonno equivalenti a §9-bis e §9-ter, calcolate non digitate.
- Stato delle finestre di 3 settimane con giorni mancanti evidenziati.
- Collegamento allenamento Watch ↔ seduta per orario, correggibile a mano.

### 4.5 Storico e progressione
- Per esercizio: carico, ripetizioni, RPE, tecnica nel tempo.
- **Volume settimanale per pattern**, calcolato dallo split (tabella §5-ter automatica).
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
  compare in Modalità Seduta e poi il motore rivaluta sui dati nuovi.
  **Rifiutata** non torna finché i dati restano quelli; **rimandata** torna dopo
  la prossima esposizione. Una proposta in sospeso che non regge più ai dati
  viene tolta: meglio niente che un consiglio scaduto.

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
- Non manda dati fuori dal telefono.
