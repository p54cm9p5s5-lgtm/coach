# Coach — come funziona l'app

Documento per il progetto che gestisce l'allenamento. Serve a capire **cosa fa
l'app, con quali regole, e come leggere quello che manda.**

Scritto leggendo il codice, non a memoria: ogni numero qui dentro è quello che
l'app usa davvero.

---

## 1. A cosa serve

L'app **non decide niente**. Registra quello che succede in palestra e fuori, lo
misura contro il programma scritto nel master brief, e prepara un pacchetto di
testo da incollare in chat.

La divisione dei ruoli è netta e non cambia mai:

| Chi | Cosa fa |
|---|---|
| **Il coach (questo progetto)** | scrive il programma, cambia la scheda, decide |
| **L'app** | misura, confronta, propone, prepara il pacchetto |
| **L'atleta** | esegue, risponde a due domande per esercizio, accetta o rifiuta le proposte |

L'app non modifica mai il programma da sola. Le sue proposte restano proposte
finché non le accetta l'atleta, e anche allora **non toccano la scheda**: valgono
come obiettivo per la prossima esposizione e finiscono nel pacchetto, dove il
coach resta l'unico a poterle mettere nero su bianco.

---

## 2. Com'è fatta

- Applicazione web installata sulla schermata Home dell'iPhone (PWA). Nessuno
  store, nessun account, nessun login.
- **Tutti i dati restano sul telefono** (IndexedDB). Niente server, niente cloud,
  niente invii automatici. L'unico modo in cui un dato esce è che l'atleta copi
  il pacchetto e lo incolli in chat.
- Funziona **completamente offline**, comprese le ricariche: verificato a rete
  staccata su tutte le schermate.
- Si aggiorna da sola alla riapertura, **tranne mentre un allenamento è aperto**:
  in quel caso l'aggiornamento aspetta la fine, per non far sparire timer e
  schermata a metà seduta.

---

## 3. Da dove arriva il programma

Il master brief è un documento `.md` con in coda un blocco tecnico:

```
<!-- COACH-DATA v1 -->
{ split, esercizi, regole, soglie, inventario }
<!-- /COACH-DATA -->
```

**Attenzione a come viaggia il brief.** Una chat che interpreta il markdown non
mostra i commenti HTML: chi copia quello che vede si porta via un documento
senza marcatori, e l'app non trova più il blocco su un file che a schermo
sembrava completo. Per questo l'app accetta anche la forma senza commenti — una
riga con solo `COACH-DATA v1` e più sotto una con solo `/COACH-DATA` — ma la via
sicura resta **allegare il file `.md`**, oppure scrivere il blocco dentro un
riquadro di codice, dove i commenti restano visibili.

L'app legge **solo quel blocco** e ignora tutto il resto del documento. Il file
non viene conservato: ne estrae il blocco e lo scarta.

**Se il blocco non va, l'app non applica niente e lo dice.** Sono verificati e
respinti: blocco assente, versione diversa dalla v1, blocco aperto e non chiuso,
blocco vuoto, JSON malformato, split mancante, esercizio non presente in
libreria, stesso esercizio due volte nello stesso giorno, range di ripetizioni
rovesciato, esercizio a tempo senza durata, giorno della settimana fuori scala,
dischi in numero dispari (non montabili a coppie).

Caricare di nuovo lo stesso brief **non azzera le proposte già accettate**: la
data di caricamento cambia solo se cambia davvero il contenuto tecnico.

Un esercizio tolto dallo split viene **archiviato, mai cancellato**: lo storico
resta.

### Cosa deve contenere il blocco

- `split[]` — per ogni giorno: `id`, `nome`, `giorno` (0 = domenica … 6 = sabato),
  `cardio` (sì/no), `esercizi[]`
- ogni esercizio: `esercizioId`, `serie`, `ripMin`, `ripMax`, `carico`, oppure
  `aTempo: true` + `durataSec`
- `inventario` — `barra`, `dischi` (peso → quantità totale posseduta, in numero
  pari perché si montano a coppie) e, facoltativo, `manubri`:

  ```json
  "manubri": {
    "regolabili": { "scaricoKg": 2, "quantita": 2 },
    "fissi": [10]
  }
  ```

  I manubri regolabili usano **gli stessi dischi del bilanciere**: non è un
  secondo magazzino. `fissi` è un elenco con un peso per ogni manubrio non
  modulabile posseduto. Il campo è facoltativo: un brief che non lo dichiara
  continua a funzionare, l'app torna al passo da un chilo e non dà istruzioni
  di montaggio sui manubri.
- `regole` — tutte le soglie del §4, che si fondono voce per voce con quelle di
  base: scrivere una soglia non azzera le altre della stessa famiglia

**Un vincolo da conoscere prima di scrivere il brief**: `esercizioId` deve
esistere nella libreria dell'app, che contiene per ogni esercizio guida completa
(setup, esecuzione, errori, cue, sicurezza) e video. Un esercizio nuovo va prima
aggiunto alla libreria, altrimenti il brief viene **rifiutato in blocco** e non
viene applicato niente — non «tutto tranne quella riga». Se serve un esercizio
che non c'è, va chiesto prima di mandare il brief.

### Se l'attrezzatura cambia

L'inventario non è un dato decorativo: da lì l'app calcola i dischi da montare a
ogni serie, i passi del selettore del carico e gli incrementi che propone. Un
inventario sbagliato produce istruzioni di montaggio sbagliate, in silenzio.

**Cose che si aggiornano cambiando un numero nel blocco:**

| Cosa compri | Cosa cambia nel blocco |
|---|---|
| Altri dischi di un peso già posseduto | la quantità in `dischi` — deve restare **pari** |
| Dischi di un peso nuovo | una chiave in più in `dischi`, per esempio `"15": 2` |
| Un bilanciere diverso | `barra` |
| Un altro manubrio regolabile | `manubri.regolabili.quantita` |
| Un manubrio fisso | un elemento in più in `manubri.fissi` — **un peso per ogni manubrio**: due da 12 kg si scrivono `[12, 12]`, non `[12]` |

Le quantità dei dischi sono sempre **il totale posseduto**, non quelli per lato.
Devono essere pari perché un disco solo non si monta: va su tutti e due i lati.
I manubri regolabili attingono agli stessi dischi del bilanciere, quindi i
dischi non vanno mai dichiarati due volte.

**Cose che richiedono lavoro sull'app, non solo una riga nel brief:**

- **Un attrezzo di tipo nuovo** — kettlebell, elastici, una macchina, una sbarra
  per trazioni. L'inventario oggi modella bilanciere, dischi e manubri: per il
  resto non c'è un posto, e non ci sono conti di montaggio da fare. Un esercizio
  con attrezzatura del genere funziona lo stesso — carico scritto in chiaro,
  selettore a passi di un chilo — ma **senza istruzioni di montaggio**. Se
  servono anche quelle, va chiesto prima: è una modifica all'app.
- **Un esercizio nuovo**, con qualunque attrezzo. Va aggiunto alla libreria con
  la sua guida completa e il video, altrimenti il brief viene respinto in blocco.

In tutti e due i casi la regola è la stessa: **chiedere prima di mandare il
brief**, non dopo che è stato rifiutato.

---

## 4. Le regole e le soglie

Sono dichiarate, non nascoste nel codice, e il master brief può cambiarle tutte.
Questi sono i valori attualmente in vigore.

**Intensità**: zona RPE **6-8**.

**Cardio**: **30 min**, **4,5-5 km/h**, FC **105-115**, mai sopra **125**.

**Progressione**: servono **2 esposizioni** consecutive che rispettino le
condizioni; RPE ≤ **7** per salire; tecnica ≥ **8** per salire; tecnica ≤ **5**
fa scattare la riduzione; una proposta rifiutata torna dopo **4 esposizioni**.

**Finestre dati**: **3 settimane**, almeno **5 giorni** a settimana.

**Soglia di scostamento** (movimento e sonno, identica per tutti e due): il
segnale scatta solo se lo scostamento supera il **20%** rispetto alla baseline
delle **prime 3 settimane** ed è **sostenuto per 2 settimane consecutive nello
stesso verso**. Servono almeno 5 settimane con dati sufficienti (3 di baseline +
2 recenti), e ogni settimana conta solo se ha almeno 5 giorni registrati.

Un giorno anomalo non produce nessun segnale, e nemmeno una settimana isolata
fuori soglia: l'eccezione è pensata per un trend lungo, non per reagire a un
trekking imprevisto. È una regola che l'app applica dal principio, non
un'aggiunta.

**Punteggio Salute** — pesi: sonno 22, allenamento 22, fumo 20, movimento 12,
passi 10, minuti di esercizio 8, tempo in piedi 6. Bersagli: sonno **8 h**
(minimo **6 h**), movimento **1000 kcal**, passi **10.000**, esercizio **60 min**,
tempo in piedi **180 min**, sigarette tollerate **10 al giorno**.

**Orario del sonno**: a letto entro **mezzanotte** nessuna penalità; ogni ora di
ritardo costa il **12%**, e l'orario vale il **25%** della voce Sonno (la durata
il restante 75%).

**Cadenze**: misure il **giovedì**; foto il **mercoledì**, **ogni 2 settimane**.

---

## 5. Come si svolge un allenamento

L'app guida la seduta passo per passo. L'ordine è fisso:

**1. Riscaldamento** — due passaggi, circa 10 minuti, con o senza tapis roulant.
Include la serie di avvicinamento sul primo esercizio (non viene registrata).

**2. Esercizi, uno alla volta.** Per ognuno mostra carico, obiettivo, **i dischi
esatti da montare per lato**, il video e la guida (esecuzione, setup, errori,
cue, sicurezza).

I dischi vengono calcolati anche **per i manubri regolabili**, e il conto tiene
di quanti manubri servono: la libreria distingue «manubri» (due, uno per mano)
da «manubrio» (uno solo), e per una coppia ogni disco va montato quattro volte
invece di due. Se un peso corrisponde a un manubrio fisso posseduto, l'app lo
dice invece di far caricare dischi inutilmente. Il selettore del carico e le
proposte di progressione si muovono sui pesi **davvero montabili**, non a passi
di un chilo.

Per ogni serie: «Serie completata» → parte il **recupero cronometrato**. Nella
schermata di recupero si correggono ripetizioni e carico davvero fatti,
precompilati con l'obiettivo. Il carico si muove **a passi di dischi montabili
davvero** e non supera l'inventario.

**Esercizi a tempo** (plank e simili): non si «completa» una serie, la si
tiene. «Avvia» fa partire un **cronometro alla rovescia** dal previsto; se
arrivi in fondo suona e la serie vale quello che chiedeva il programma, se molli
prima **«Fine» registra i secondi davvero tenuti** — 38 su 45 restano 38, non
vengono arrotondati al previsto. Il cronometro sta su un istante salvato, quindi
bloccare lo schermo o riaprire l'app non falsa il conto.

**3. Valutazione dell'esercizio, dentro il recupero.** Dopo l'ultima serie il
recupero contiene, in quest'ordine: la correzione della serie appena chiusa, **le
domande sull'esercizio**, il punteggio, e infine **il prossimo esercizio** (nome,
obiettivo, carico, video) per prepararsi. Le domande stanno prima perché si
rispondono adesso, il prossimo esercizio serve quando ti alzi.

Due domande obbligatorie: **quanto è stata dura** (RPE 1-10, con la zona prevista
evidenziata) e **com'è andata la tecnica** (1-10). Più il **dolore al polso**
(sì/no; se sì: quando e quanto). Nota facoltativa. Finché manca una risposta
l'app scrive quale, e «Avanti» resta spento.

**4. Cardio**, se previsto: si può eseguire o dichiarare non eseguito, **con
motivo obbligatorio**.

**5. Stretching.**

**6. Riepilogo e chiusura.** Qui si copiano i numeri dall'orologio (durata, kcal
attive e totali, FC media e massima, sforzo; per il cardio anche distanza e
ritmo). Sono facoltativi, e finiscono nel pacchetto.

Si può **uscire a metà e riprendere**: serie, riscaldamento e posizione esatta
restano al loro posto anche dopo aver chiuso l'app.

Un esercizio si può **saltare**, ma il motivo (tempo / dolore / attrezzo / altro)
e una **nota scritta sono obbligatori**: «saltato» senza spiegazione, fra tre
settimane, non vuol dire niente.

---

## 6. I due punteggi

Non sono voti morali: sono **la distanza fra quello che il programma chiedeva e
quello che è stato fatto**. Le curve non sono lineari — metà del lavoro non vale
metà punteggio, perché mezzo allenamento non produce mezzo adattamento.

Architettura comune ai due punteggi:
- ogni voce ha un **peso** e una quota 0-1;
- una voce **senza dato resta fuori dal conto** invece di valere zero (il peso si
  ridistribuisce sulle altre);
- ci sono **tetti**: limiti che nessuna media può aggirare;
- **niente viene inventato** dove il dato non c'è.

### 6.1 Punteggio di un esercizio (0-100)

| Voce | Peso | Come si misura |
|---|---|---|
| Ripetizioni (o secondi) | 25 | fatte / chieste davvero quel giorno |
| Carico | 20 | usato / previsto; superarlo non è un merito |
| Tecnica | 30 | curva: 10→100%, 9→75%, **8→45%**, 7→20%, 6→8% |
| Intensità | 15 | dentro zona 6-8 → 100%; a 1 fuori → 40%; a 2 → 15%; oltre → 0 |
| Recupero | 10 | cronometrato dall'app, non dichiarato |

**Tetti**: lavoro sotto il 90% → max 80; sotto il 75% → max 60; carico sotto il
90% del programmato → max 80; tecnica ≤ 7 → max 65; tecnica ≤ 5 → max 40;
tecnica non valutata → max 70; RPE fuori zona → max 80; recuperi non rispettati
→ max 85.

**Dolore al polso: −20 punti e tetto a 70.** Finché c'è, quell'esercizio non va
caricato.

Il bersaglio delle ripetizioni è **quello che l'app ha chiesto quel giorno**, non
il tetto del range: chi lavora al fondo del range fa il suo lavoro e non risulta
«da rivedere». Se una proposta accettata ha alzato l'obiettivo, il conto usa
quello.

### 6.2 Punteggio dell'allenamento (0-100)

| Voce | Peso |
|---|---|
| Esercizi (media dei loro punteggi, sul numero previsto) | 60 |
| Cardio | 20 |
| Riscaldamento e stretching | 20 |

**Tetti**: un esercizio saltato → max 75; cardio sotto metà → max 60; cardio più
corto del previsto → max 85. Cardio oltre la velocità di protocollo → quota
massima 0,7; sotto → 0,85.

Un esercizio **previsto e mai iniziato** viene detto esplicitamente, non tolto in
silenzio dal conto.

### 6.3 Punteggio Salute della giornata (0-100)

Sette voci, nessuna capace di decidere da sola:

| Voce | Peso | Bersaglio |
|---|---|---|
| Sonno | 22 | 8 h, **più l'ora in cui vai a letto** |
| Allenamento | 22 | completezza della seduta chiusa |
| Fumo | 20 | 0 sigarette = pieno, 10 = zero |
| Movimento | 12 | 1000 kcal attive |
| Passi | 10 | 10.000 |
| Minuti di esercizio | 8 | 60 min |
| Tempo in piedi | 6 | 180 min |

**Tetti**: meno di 6 ore di sonno → max 70; allenamento previsto e non fatto →
max 60; **10 sigarette esatte → max 70; oltre 10 → max 50**.

Un **giorno di riposo non è un vuoto da punire**: la voce allenamento resta
fuori dal conto, non vale zero.

**Il sonno si misura in due parti.** La durata è proporzionale — quattro ore su
otto sono metà del sonno e valgono metà — perché la curva ripida usata in
palestra qui non ha senso: metà allenamento non produce metà adattamento, ma
metà notte è metà notte. All'ora in cui vai a letto va il 25% della voce: due
notti da sei ore e mezza non sono la stessa notte se una comincia alle 23 e
l'altra alle 3 del mattino. Nel dettaglio compaiono tutte e due — «6,7h su 8h ·
a letto 23:01».

Il sonno di una notte porta la data del giorno in cui ci si sveglia: comincia la
sera prima e finisce la mattina.

### 6.4 Giudizi e colori

≥ 90 «ottimo» · ≥ 70 «sufficiente» · sotto «da rivedere».

Il colore è su **scala continua**: rosso pieno da 20 in giù, arancione, giallo
attorno a 70, lime pieno da 95 in su. Un numero che scende si vede scendere,
senza aspettare una soglia.

---

## 7. Le proposte di progressione

L'app osserva le esposizioni e, quando i dati lo giustificano, propone **un solo
passo alla volta**, seguendo la gerarchia del brief:

1. Correzione della tecnica
2. Miglioramento della stabilità
3. **Aumento delle ripetizioni**
4. **Aumento del carico**
5. Aumento del volume
6. Riduzione dei recuperi
7. Modifica degli esercizi
8. Modifica dello split

Le ripetizioni si esauriscono **prima** di toccare il carico. Non si salta un
livello senza motivo tecnico.

Ogni proposta arriva già con **le quattro domande compilate**:
- perché modificare
- quali dati lo dimostrano (con date, serie, carichi, RPE e tecnica reali)
- perché è meglio delle alternative
- quale risultato ci si aspetta

**Se non si risponde a tutte e quattro, non si modifica nulla.**

Tre risposte possibili: **Accetto** (l'obiettivo vale dalla prossima esposizione,
e nasce una **verifica a 14 giorni**), **Rimando** (torna dopo la prossima
esposizione), **Rifiuto** (non torna per le prossime 4 esposizioni di
quell'esercizio).

Le proposte in direzione opposta esistono e hanno la precedenza: **rientro al
carico previsto** se si sta lavorando sopra la scheda, e **riduzione del carico**
se la tecnica è scesa.

L'app mostra anche **perché non c'è una proposta** per gli altri esercizi
(«RPE 8: zona corretta, nessuna modifica»), così il silenzio non si confonde con
una dimenticanza.

---

## 8. I segnali

Osservazioni che non sono proposte. Attualmente l'app sa riconoscere: cardio
fuori protocollo, inversione dell'intensità, pattern di dolore al polso,
finestra dati completa, scostamento sul movimento e sul sonno (solo se
**sostenuto per due settimane consecutive**, §4),
taratura dell'RPE (RPE dichiarato basso ma serie chiuse sotto il range), buchi
nei dati, tecnica sotto soglia, lavoro sotto il range, esercizio saltato più
volte, tetto del tempo raggiunto, tetto del range raggiunto.

Si archiviano con «Ho preso nota», non si cancellano.

---

## 9. Il ponte con l'app Salute

Un comando rapido dell'iPhone legge gli ultimi 30 giorni e produce un blocco di
testo che l'app importa. Formato:

```
COACH-DATI v1
GIORNO 2026-08-04 passi=… kcal=… obiettivo=… esercizio=… inpiedi=… piani=… km=… fc=…
NOTTE  2026-08-04 durata=… profondo=… rem=… veglia=… risvegli=…
ALLENAMENTO … / FINESTRA … / AGENDA …
```

Tutti i campi sono facoltativi: quelli che mancano restano «non registrato», mai
zero.

**Un'avvertenza che vale la pena conoscere.** Il comando rapido, se non filtra
l'origine, somma i campioni di iPhone **e** Apple Watch: passi, distanza e piani
li registrano tutti e due, e i periodi in cui sono addosso entrambi vengono
contati due volte. Le calorie attive no, le scrive solo l'orologio. Se le kcal
restano identiche e i passi crescono, è quello.

L'app se ne accorge: quando un giorno **già registrato** cambia di oltre il 40%,
lo segnala, dice quali numeri ha tenuto e come fare il contrario.

**Il sonno arriva come fasi, non come totali.** Il comando rapido manda le righe
grezze dell'orologio — `FASE 2026-08-04 03:15 2026-08-04 03:40 Principale` — e i
minuti, le fasi e i risvegli li calcola l'app. Una notte porta **la data del
giorno in cui ci si sveglia**: chi va a letto all'una di notte del 4 agosto ha
dormito la notte del 4, non quella del 3. «Veglia» non entra nella durata; un
risveglio è un tratto sveglio di almeno cinque minuti.

Le righe `FASE` portano solo ore e minuti: i secondi vengono troncati dal comando
rapido prima che l'app li veda, e il totale può risultare **1-5 minuti sotto**
quello di Salute — sempre in difetto, proporzionale al numero di fasi, mai oltre
l'1%.

**Quello che non può essere vero non entra.** Sopra 5000 kcal, 100.000 passi,
1440 minuti in una giornata, 200 km, 500 piani, o una frequenza a riposo fuori
da 25-120: il campo resta vuoto invece che sbagliato, il resto della giornata
viene importato normalmente, e l'app dice cosa ha rifiutato e perché. Un numero
assurdo che entra in silenzio si ritrova mesi dopo dentro una media, ed è
troppo tardi.

**Reimportare ripara: non serve mai cancellare.** Le fasi raccontano per intero
le notti che coprono, quindi una notte archiviata sotto una data sbagliata da una
versione precedente viene sostituita dal pacchetto nuovo. Quello che viene
rimosso è sempre dichiarato. Le notti scritte a mano non si toccano, e fuori dal
periodo coperto dalle fasi non si tocca niente. Esiste comunque un comando per
cancellare i dati importati da Salute e rileggerli da zero, ma è una scelta, non
una via obbligata per correggere un errore.

---

## 10. Il conteggio delle sigarette

Un contatore: un tocco per sigaretta, con l'orario. Il «−» serve per i tocchi
sbagliati. Il numero cambia colore: bianco fino a 3, giallo 4-6, arancione 7-9,
**rosso da 10**.

Il conteggio è **manuale**: vale quello che è stato segnato, non c'è modo di
verificarlo, e nel pacchetto è scritto esplicitamente.

Da quando la sezione viene aperta la prima volta, **un giorno senza righe vale
zero sigarette**, cioè punteggio pieno — non «dato mancante». Prima di quel
giorno il conteggio non esisteva e l'app non lo inventa.

**«Il conteggio riparte da oggi»** serve quando si è fumato senza segnare. Un
giorno segnato a metà è peggio di un giorno non segnato: il primo entra nel
punteggio come dato vero e lo gonfia, il secondo resta fuori e si vede che
manca. L'azione sposta l'inizio del conteggio a oggi e cancella le righe
precedenti — quei giorni tornano «non contati» e restano fuori dal punteggio
Salute. È una scelta esplicita, con conferma, e dice quante righe rimuove.

---

## 11. Corpo: misure, indici, foto

**Misure**: peso, vita ombelico, vita punto stretto, fianchi, petto, bicipite
rilassato, coscia. Si registrano sempre nelle stesse condizioni (appena sveglio,
a digiuno, dopo il bagno, prima di bere); se una condizione manca, il dato entra
comunque ma **segnato come non confrontabile**.

Un valore fuori scala (per esempio un peso di 999 kg, quasi sempre un tocco di
troppo) **fa scattare una richiesta di conferma**: l'app non rifiuta, chiede.

**Indici**: vita/altezza (soglia 0,50) e BMI, dichiarato per quello che è — «il
meno informativo dei tre», gonfiato dalla massa muscolare. Sono indicatori di
struttura, **non una diagnosi**.

**Foto**: 4 pose, ogni 2 settimane, con protocollo identico (stessa ora, stessa
luce, stesso punto sul pavimento) e una checklist da spuntare tutta prima di
poter iniziare. Le pose sono **quelle che l'atleta fa già**, sul modello del set
di riferimento esistente. Le foto restano sul telefono e **non entrano mai nel
pacchetto**.

---

## 12. Il pacchetto per il coach

È **testo**, mai immagini o screenshot, e i numeri arrivano dai dati registrati,
non trascritti a mano. Si sceglie cosa includere. Contiene:

- **Log della seduta** in formato §12: tabella esercizio / carico / serie×rip /
  RPE / nota, più recuperi reali cronometrati (media, minimo, massimo **e per
  singolo esercizio**), velocità e durata del cardio, durata dell'allenamento,
  **densità sui pesi** (serie/min dalla prima all'ultima serie), riscaldamento
  (con o senza tapis), stretching, numeri dall'orologio, nota generale, il
  **punteggio che l'app si è data** con l'eventuale tetto che l'ha fermato, e
  gli **obiettivi chiesti dall'app diversi dal brief** (quando una proposta
  accettata ha cambiato il bersaglio)
- **Dettaglio serie per serie**: una riga per ogni singola serie con carico,
  ripetizioni fatte, quello che l'app aveva chiesto in quel momento, il
  **recupero cronometrato prima di quella serie** contro quello previsto, e
  l'orario. Sotto ogni esercizio: RPE, tecnica, prescrizione del brief,
  eventuale dolore al polso con quando e quanto, note. Serve quando il
  riassunto non basta — cedimenti a metà esercizio, recuperi saltati, carichi
  cambiati in corsa

**Come si leggono i carichi.** Il numero comprende sempre la barra sul
bilanciere ed è **per manubrio** sui manubri: l'app lo scrive accanto al valore,
così non resta da indovinare. Se il carico è rimasto costante la riga è
compatta (`30 kg barra compresa` · `3x8/8/6`); se è cambiato durante
l'esercizio ogni serie viene scritta per intero (`4 → 6 kg per manubrio` ·
`s1 4 kg×12 · s2 6 kg×10`), perché una forma come «4/6 kg» accanto a «2x12/10»
si può leggere in tre modi diversi
- **Dati salute**: stato delle finestre a 3 settimane e la tabella giorno per
  giorno con movimento, percentuale sull'obiettivo, passi e note
- **Proposte in sospeso**, con le quattro domande già compilate
- **Segnali aperti**
- **Fumo**: sigarette al giorno, media, giorni a zero
- **Misure e indici**, se registrate

La giornata in corso è marcata **«giornata in corso, non finita»**: i suoi numeri
non sono confrontabili con quelli dei giorni chiusi.

Nella colonna «Tipo» un giorno senza allenamento è **Riposo**, anche quando sul
calendario c'è un promemoria di altro genere (una misurazione, una visita): il
titolo del promemoria compare fra parentesi come contesto, non come
classificazione della giornata.

---

## 13. Il calendario

Lo split del brief disegna i giorni per default. Se il coach mette un evento sul
calendario del telefono, **comanda quello**, e l'app segnala quando l'evento è
diverso da ciò che prevedeva lo split. Un giorno mai letto dal calendario non
viene mai dichiarato «scaduto».

---

## 14. Regole di condotta dell'app

Sono la parte che conta più delle funzioni.

- **Non modifica mai il programma da sola.**
- **Non inventa un dato che non ha.** Dove manca scrive «non registrato», mai
  zero: uno zero è un'informazione, un vuoto è un'altra cosa.
- **Non dichiara come «oggi» un numero di ieri.** Col filtro «1 gg», se oggi il
  dato non c'è, scrive «nessun dato». L'unica eccezione è il sonno, per un
  motivo vero: una notte comincia la sera prima.
- **La giornata in corso non entra nelle medie**, perché entrerebbe come un
  giorno fiacco e farebbe sembrare che stai peggiorando.
- **Non sovrascrive in silenzio.** Quando un giorno già chiuso cambia di molto,
  lo dice e spiega come tornare indietro.
- **Non lascia un bottone spento senza spiegare cosa manca.**
- **Non tratta pressione arteriosa né ECG**, non interpreta dati clinici, non
  calcola fabbisogni calorici e non dà indicazioni alimentari.
- **Non manda niente fuori dal telefono.**

---

## 15. Backup

Due copie, con ruoli diversi:

- **Copia interna**, automatica a fine allenamento: protegge da errori dell'app e
  cancellazioni accidentali, resta nel telefono, **non contiene le foto**.
- **Backup su file**, da salvare in File o iCloud Drive: è l'unico che sopravvive
  alla perdita del telefono.

**Reimportare ripara, non serve cancellare.** Le fasi del sonno raccontano per
intero le notti che coprono: se dentro quel periodo l'archivio ha una notte che
il pacchetto nuovo non conferma, viene sostituita. Correggere un dato sbagliato
non costa mai la perdita dello storico — e quello che viene rimosso è sempre
dichiarato, mai fatto in silenzio. Le notti scritte a mano non si toccano, e
fuori dal periodo coperto non si tocca niente.

Il ripristino è stato verificato: esportazione, archivio svuotato, ripristino →
**identico byte a byte** su tutti e 15 gli archivi. Un file rovinato viene
**rifiutato senza toccare niente**, con un messaggio che dice quale sezione non
si legge.

---

## 16. Cosa serve sapere per leggere i numeri

Tre cose, se si vuole interpretare bene il pacchetto:

1. **Un punteggio basso non è un giudizio sulla persona.** È lo scarto dal
   programma. Un 60 con «fermo a 60: allenamento previsto e non fatto» dice una
   cosa precisa, non «giornata scarsa».
2. **I tetti spiegano i numeri strani.** Se un allenamento fatto bene si ferma a
   65, il motivo è scritto accanto: quasi sempre la tecnica, che nel brief viene
   prima di tutto.
3. **Le voci mancanti non sono zeri.** Un giorno senza import da Salute ha un
   punteggio calcolato solo su ciò che l'app sapeva davvero, e il numero di voci
   usate è sempre dichiarato.
