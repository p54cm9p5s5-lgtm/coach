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
rovesciato, esercizio a tempo senza durata, esercizio che si tiene a tempo
scritto invece a ripetizioni, giorno della settimana fuori scala, id del giorno
non minuscolo-con-trattini, carico negativo o non numerico, recupero non
numerico, punti dolenti senza id o ripetuti, esercizi di uno stesso blocco non
scritti di seguito o lettera su un esercizio solo, dischi in numero dispari
(non montabili a coppie).

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
- `regole` — tutte le soglie del §4. Si fondono con quelle di base **a un solo
  livello**: scrivere `cardio.kmhMax` lascia intatte le altre soglie del cardio,
  ma scrivere `salute.pesi` con una voce sola **sostituisce tutto il blocco dei
  pesi**. Le voci annidate vanno riscritte per intero

### Cambiare COME si fa un esercizio, dal brief

Dal 3 settembre 2026 una riga del blocco tecnico può portarsi dietro non solo i
numeri ma anche **le istruzioni**. Serve a un caso preciso: quando cambia il
carico cambia il gesto — il ponte per glutei a 8 kg vuole il manubrio tenuto in
un modo che a corpo libero non esisteva — e quella frase, scritta nella prosa
del master, l'app non la legge.

Campi facoltativi, uno o tutti:

| Campo | Forma | Cosa cambia |
|---|---|---|
| `esecuzione` | elenco di frasi | i passaggi numerati della scheda |
| `setup` | elenco di frasi | come ti metti prima di cominciare |
| `erroriComuni` | elenco di frasi | gli errori da evitare |
| `cue` | una frase | la riga che resta in mente |
| `nota` | una frase | una nota sull'esercizio |
| `sicurezza` | una frase | l'avvertenza |

```json
{ "esercizioId": "ponte-glutei", "serie": 3, "ripMin": 10, "ripMax": 12, "carico": 8,
  "esecuzione": ["…", "…"],
  "sicurezza": "…" }
```

**Come si comporta.** Quello che arriva dal brief **copre** quello della libreria
e nella scheda c'è scritto da dove viene: *«L'esecuzione e la sicurezza arrivano
dal master brief del 3 settembre, non dalla libreria dell'app.»* La scheda di
base non viene cancellata: resta in archivio, e **togliendo quelle righe dal
brief torna quella**. Un'istruzione legata a un carico che non c'è più sarebbe
peggio che non averla mai avuta.

Non tutto si può cambiare: il nome, il pattern, l'attrezzo e il video restano
della libreria, perché descrivono l'esercizio in sé e non la prescrizione di
oggi. Un esercizio nuovo va sempre chiesto prima.

I limiti sono controllati al caricamento: un elenco vuoto, una frase al posto di
un elenco o un testo sterminato fermano il brief con un messaggio, come qualunque
altro errore del blocco tecnico.

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
acqua 12, passi 10, minuti di esercizio 8, tempo in piedi 6. Fumo e acqua ci
sono solo per chi li dichiara nel brief, e il peso delle voci assenti si
ridistribuisce sulle altre (il dettaglio è al §6.3). Bersagli: sonno **8 h**
(minimo **6 h**), movimento **1000 kcal**, passi **10.000**, esercizio **60 min**,
tempo in piedi **180 min**, sigarette tollerate **10 al giorno**.

**Orario del sonno**: a letto entro **mezzanotte** nessuna penalità; ogni ora di
ritardo costa il **12%**, e quel fattore **moltiplica** la durata invece di
sommarsi a lei. Andare a letto tardi non è una cosa che si ripaga dormendo di
più: sposta tutta la notte, e la penalità resta addosso a qualunque durata.

**Quando l'orologio sbaglia la notte.** L'Apple Watch il sonno lo deduce: se lo
togli, se perde il contatto, se ti addormenti prima che se ne accorga, registra
un pezzo di notte e chiama quello «la notte». Otto ore diventano tre, e l'ora in
cui sei andato a letto — che pesa da sola — diventa quella in cui l'orologio si
è accorto di te. In **Salute › Correggi una notte** si scrivono le due cose che
sai per certo: quando sei andato a letto e quando ti sei svegliato. La data è
quella del **risveglio**. Le fasi (profondo, REM, veglia) si perdono, perché
quelle le sa l'orologio e tu no: una durata giusta senza fasi vale più di una
sbagliata con le fasi. Da lì la notte è **tua** — l'import da Salute non la
sovrascrive, la riconciliazione non la cancella, e il riepilogo dell'import lo
dice ogni volta. Il dato dell'orologio però non si butta: resta da parte nella
stessa riga, e ogni import lo aggiorna anche quando la notte è tua. Così il
tasto per tornare indietro dice quanto misurava l'orologio e lo rimette davvero,
fasi comprese; e quando l'orologio quella notte non l'ha mai registrata il tasto
lo dichiara — «togli la correzione, l'orologio non ha un dato» — invece di
promettere un ritorno che sarebbe una cancellazione.

**Fondo del fumo**: oltre le sigarette tollerate la voce scende sotto zero, fino
a **−50%** (`fumoQuotaMinima`). Tutte le altre voci si fermano al 100%.

**Cadenze**: misure il **giovedì**; foto il **mercoledì**, **ogni 2 settimane**.

**Recupero**: lo decide il brief, esercizio per esercizio (`recuperoSec`); dove
non lo dice vale quello della scheda in libreria. Dentro un blocco è uno solo
per giro, ed è quello del primo esercizio della coppia.

**Punti dolenti**: li dichiara il brief (`regole.dolori`), uno per uno, e
diventano una domanda separata dopo ogni esercizio. Senza dichiarazione la
domanda è il polso destro.

---

## 5. Come si svolge un allenamento

L'app guida la seduta passo per passo. L'ordine è fisso:

**1. Riscaldamento** — con o senza tapis roulant. **Un passaggio per volta, non
la lista intera**: l'app mostra solo quello che devi fare adesso (nome, dose,
come si fa), dice qual è il prossimo e in testa scrive a che punto sei —
«Riscaldamento 3 di 7». Include la serie di avvicinamento sul primo esercizio
(non viene registrata).

Quanti passaggi siano dipende dal giorno, e la struttura è sempre la stessa:
**camminata di 5 minuti + mobilità specifica + serie di avvicinamento**, circa
dieci minuti in tutto. I giorni con esercizi hanno 4-7 movimenti di mobilità in
apertura, quindi il riscaldamento è di sei-nove passaggi; sabato e domenica, che
esercizi non ne hanno, c'è la sola camminata e poi cinque movimenti di mobilità.

I cinque giorni del nuovo split (push, pull, legs, upper, lower) sono rimasti
per un periodo **senza** mobilità in apertura e senza stretching finale: quelle
scalette esistevano nel master brief (§17-bis) ma non erano mai state trascritte
nei dati dell'app, e lì il riscaldamento risultava di due passaggi soli. Sono
state riempite il **14/08/2026**, con i movimenti e le dosi del master:

| Giorno | Mobilità in apertura | Stretching finale | Mobilità di fine seduta |
|---|---|---|---|
| Push | 6 | 4 | 3 |
| Pull | 5 | 4 | 2 |
| Legs | 5 | 5 | 3 |
| Upper | 5 | 5 | 3 |
| Lower | 5 | 4 | 3 |

**Il 27 agosto 2026 le ultime due colonne sono diventate una sola.** Il coach
ha chiesto due cose diverse — movimenti dinamici per *mantenere* la mobilità, e
posizioni tenute ferme per *guadagnare* escursione — e le chiama Blocco A e
Blocco B. **Nell'app sono un blocco solo, che si chiama «Mobilità»**: chi si
allena non fa due cose, ne fa una, di fila.

| | Prima del 27/08 | Dal 27/08 |
|---|---|---|
| Cosa | 2-3 movimenti, zone diverse per giorno, poi lo stretching mirato del giorno | **26 passaggi in fila**: 8 movimenti dinamici (caviglia, anca, colonna, spalle, **polso**) e poi 18 posizioni da tenere 45 secondi |
| Quando | mobilità anche il fine settimana, stretching mai | **tutti e sette i giorni**, sabato e domenica inclusi |
| Nel punteggio | due voci separate | **una voce sola**, «Mobilità» |

L'ordine dentro il blocco non è casuale ed è **di sicurezza**: prima il dinamico,
poi le tenute. Tenere a lungo un allungamento prima di spingere abbassa la forza
per un po', ed è lo stesso motivo per cui tutto il blocco sta dopo i pesi e non
all'inizio.

Lo stretching mirato per giorno **non è stato cancellato**: le scalette restano
scritte in `data/riscaldamento.json`, e se un domani si torna indietro basta una
riga. Semplicemente non è più quello che l'app fa fare, perché le 18 tenute
coprono le stesse zone e più a lungo, e farli tutti e due voleva dire mezz'ora
abbondante di allungamento in più dopo ogni seduta.

La serie di avvicinamento **dice quale esercizio è e con quanto**: «Serie di
avvicinamento: Squat con bilanciere — 1 × 8-10 · bilanciere scarico (10 kg)»,
col video di quell'esercizio. Il carico lo calcola l'app dall'inventario e dal
programma: bilanciere scarico per i bilancieri, metà carico per i manubri.
Quando il gesto è lo **stesso** di un passaggio di mobilità già fatto — squat a
corpo libero prima, squat con bilanciere adesso — l'app lo scrive, così è chiaro
che non è lo stesso lavoro due volte ma la scaletta verso il carico di lavoro.
Nei giorni che aprono con un esercizio **a corpo libero** il passaggio non
compare: «con bilanciere scarico o metà carico» non vuol dire niente su una cosa
che carico non ne ha.

Dove la dose è **a secondi**, il passaggio ha un **cronometro vero** invece di
un numero da leggere: «5 min» di camminata, «3 × 15 s per lato» di apertura del
petto. L'app riconosce la dose com'è scritta nel protocollo e conta le tenute
una per una — con «3 × 15 s per lato» sono sei tenute, e a schermo c'è scritto
«giro 2 di 3 · altro lato» perché non si perda il conto a metà. Le dosi a
ripetizioni (**«10 per verso»**, «15 ripetizioni») restano senza cronometro: lì
un timer sarebbe solo rumore. Si può tornare **indietro** di una tenuta o di un
passaggio.

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

Per ogni serie: «Serie completata» → parte il **recupero cronometrato**. Nel
riposo **fra una serie e l'altra** si correggono ripetizioni e carico davvero
fatti, precompilati con l'obiettivo. Il carico si muove **a passi di dischi
montabili davvero** e non supera l'inventario.

Il carico si può anche scrivere a mano, con «Cambia carico». Un numero **fuori
scala** rispetto a quello che l'app stava proponendo — la virgola dimenticata sul
tastierino, `17,5` battuto `1750` — non viene rifiutato ma **chiesto una volta**:
«1750 kg: prima erano 15. Se è giusto, tocca ancora». Una progressione normale
non si fa chiedere niente. Senza questo un tocco storto diventava il carico di
lavoro, la storia dell'esercizio, il numero che legge il coach e la base delle
proposte.

Nel riposo **dopo l'ultima serie** quei campi non ci sono: le serie si sono già
corrette tutte nella scheda di valutazione, che viene prima, e quella pagina
serve a un'altra cosa — il cronometro e il prossimo esercizio da preparare.

**Esercizi a tempo** (plank e simili): non si «completa» una serie, la si
tiene. «Avvia» fa partire un **cronometro alla rovescia** dal previsto; se
arrivi in fondo suona e la serie vale quello che chiedeva il programma, se molli
prima **«Fine» registra i secondi davvero tenuti** — 38 su 45 restano 38, non
vengono arrotondati al previsto. Il cronometro sta su un istante salvato, quindi
bloccare lo schermo o riaprire l'app non falsa il conto.

**2-bis. I blocchi.** Se il brief accoppia due esercizi con la stessa lettera
(`"blocco": "A"`), l'app li incatena: una serie del primo, **subito** una del
secondo senza pausa, poi il recupero, e si ricomincia finché i giri non sono
finiti. Le valutazioni arrivano alla fine del blocco, una per esercizio. In
testa c'è scritto a che punto sei — «Blocco · esercizio 2 di 2 · giro 3 di 3».
Il recupero è **uno solo per giro** e vale quello del primo esercizio della
coppia: la serie del secondo non ha nessun riposo davanti e resta fuori dal
conto dei recuperi, invece di risultare «riposo saltato». Chi non usa i blocchi
non si accorge di niente: tutte le serie di fila, come sempre.

**3. Valutazione dell'esercizio, da sola, poi il recupero.** Dopo l'ultima
serie arriva una schermata dedicata: correzione di **tutte le serie di
quell'esercizio** — ripetizioni e carico, una riga per serie, non solo l'ultima:
di due ripetizioni in più te ne accorgi dopo, riprendendo fiato, e questo è
l'ultimo momento in cui l'esercizio è ancora aperto. Il punteggio qui sopra si
rifà a ogni tocco. Poi il
punteggio dell'esercizio, e le domande — quanto è stata dura, com'è andata la
tecnica, e **se ha fatto male dove il brief ha dichiarato**: una domanda
separata per ogni punto (`regole.dolori`), con quando e quanto se la risposta è
sì. Senza dichiarazione la domanda è il polso destro, com'è sempre stata.
**Senza cronometro.** Il tasto resta spento finché manca qualcosa, e sotto c'è
scritto cosa manca con le parole delle domande.

Solo dopo aver risposto parte il **recupero cronometrato**, con il **prossimo
esercizio** già in vista (nome, carico, dischi da montare). Prima le due cose
stavano insieme: il tasto che mandava le risposte chiudeva anche il riposo, e
rispondendo si finiva per saltare il recupero — che è la parte che conta.

**4. Mobilità** — dose fissa, un passaggio per volta, come il riscaldamento:
**26 passaggi in fila**. Prima gli otto movimenti dinamici, uguali tutti i
giorni; poi le diciotto posizioni da tenere ferme, con il cronometro sui 45
secondi che parte con «Avvia» e si chiude con «Fatto · altro lato». Quindici
delle diciotto sono per lato, quindi il blocco intero è di circa **35 minuti**.
Chi vuole saltarlo può farlo con un tocco — ma è un tocco solo per tutto il
blocco, perché è un blocco solo.

**Dal 27 agosto 2026 l'ordine è questo**: riscaldamento → pesi → mobilità →
**cardio in fondo**. Prima era pesi → stretching → mobilità → cardio, e prima
ancora il cardio veniva subito dopo i pesi.

Il vincolo vero è uno solo, ed è di sicurezza: **il blocco va dopo i pesi, a
muscoli caldi**, perché tenere a lungo un allungamento prima di spingere abbassa
la forza per un po'. Col cardio non c'entra niente — camminare a 4,5-5 km/h non
è lavoro massimale — e infatti il cardio può anche essere fatto ore dopo.

Un passaggio che quel giorno non è previsto non compare affatto: si passa oltre,
invece di fermarsi su una schermata vuota che chiede «fatto o saltato?» di
niente.

**6. Cardio**, se previsto: si può eseguire, **rimandare**, o dichiarare non
eseguito con motivo obbligatorio.

**Rimandare** serve a un caso preciso: l'allenamento è finito ma il cardio non si
può fare subito — il tapis occupato, un impegno in mezzo. Da quando il cardio è
l'ultimo passaggio, la mobilità è già stata fatta: con «Rimanda il
cardio» si va dritti al riepilogo; l'allenamento resta aperto e in **Home compare «Cardio da fare»**
con un tasto che porta lì. Rimandato non vuol dire saltato: nel punteggio non
conta niente finché non lo fai o non lo dichiari non eseguito. Se si chiude
l'allenamento con il cardio ancora in sospeso, l'app lo dice prima — da lì in poi
conta come non eseguito. Dichiarandolo non eseguito, la velocità e la durata
impostate prima **non entrano**: resta scritto che non l'hai fatto, non un
cardio inventato.

Velocità e durata si scelgono con i tasti più e meno, dentro i limiti veri di un
tapis roulant: **0,5-20 km/h** e **5-180 minuti**. Fuori dal protocollo si può
andare e l'app lo dice, ma un numero impossibile non entra: prima si arrivava a
0 km/h — un cardio «eseguito» da fermo — e la durata saliva senza fermarsi mai.

Il cronometro del cardio **sale da zero e non si ferma da solo**: cammini quanto
vuoi e tocchi «Ho finito» quando scendi: i minuti registrati sono quelli fra
l'avvio e il tocco. La durata prevista resta come traguardo — l'anello si riempie
fino a lì e il suono arriva **una volta sola** quando ci arrivi, con un tasto che
lo zittisce **senza chiudere il cardio**. Dopo, il tempo continua a salire in
silenzio e sotto il cronometro c'è scritto quanto sei andato oltre. Prima era un
conto alla rovescia: per camminare di più bisognava premere «+5 min» mentre si
camminava.

**6-bis. I numeri dell'orologio non si scrivono più.** Fino a che l'unica strada
per averli era ricopiarli dal quadrante, l'app apriva sei caselle a fine
allenamento e chiedeva di riempirle. Adesso li legge l'importazione da Salute —
durata, calorie attive e totali, battito medio e massimo, sforzo, e in più la
curva del battito — quindi chiederli sarebbe far rifare a mano un lavoro già
fatto, con l'aggiunta degli errori di trascrizione. Quelli scritti prima restano
visibili nel riepilogo e nel pacchetto, in sola lettura.

Il testo che segue vale per gli allenamenti registrati prima di quel cambio: l'app chiedeva i dati dell'orologio (durata, distanza, kcal, ritmo,
battito, sforzo). Erano facoltativi e finivano nel pacchetto. Stavano lì perché
in quel momento il riepilogo era ancora quello sul quadrante: chiesti dopo lo
stretching, al polso c'è già dell'altro.

### L'archivio di un tipo di allenamento

Nella scheda «Completezza degli allenamenti» ogni riga si apre. Toccando
«Pull · media di 2 allenamenti · 94» compare l'elenco di **quei** due
allenamenti, uno per uno, con la data e il punteggio congelato di ciascuno; da
lì si entra nel dettaglio vero — esercizi, serie, recuperi, cardio.

Il periodo è **lo stesso** scelto in cima a Salute: su «7 gg» ci sono i Pull di
quei sette giorni, su «Sempre» tutti. Non è una scelta grafica: è l'unico modo
perché la media di sopra e l'elenco di sotto raccontino la stessa cosa.

### La storia di un esercizio

Nel riepilogo di un allenamento **ogni esercizio si apre**. Toccando «Panca
piana bilanciere · 36 kg · 3×10/10/10» compaiono tutte le volte che l'hai
fatta, dalla più recente: data, serie e ripetizioni davvero eseguite, RPE,
tecnica, e il carico usato — non quello previsto.

Accanto a ogni riga ci sono **le proposte decise quel giorno su quell'esercizio**,
con l'esito e la nota: «rifiutata: 30 → 31 kg — Già eseguito da coach». È il
pezzo che spiega *perché* il carico è cambiato quando è cambiato, che dentro la
singola seduta non si vede.

La riga nel riepilogo dice come è andata **rispetto alla volta prima** («+6 kg
dalla volta prima»); questa schermata dice da dove sei partito. E un carico che
scende non è sempre un passo indietro: dopo un cedimento tecnico il programma fa
scaricare apposta.

### La pagina non si ingrandisce

**Né con due tocchi né con due dita.** I numeri di questa app sono già grandi, e
l'ingrandimento qui faceva solo danni: due dita per sbaglio mentre appoggi il
telefono, o due tocchi vicini, e lo schermo restava piantato ingrandito su un
angolo da cui non si esce con un gesto ovvio.

Il foglio di stile da solo non bastava: toglie il doppio tocco ma non
l'avvicinamento con due dita, che su iPhone passa da eventi suoi e va fermato a
mano. Il secondo tocco viene fermato **solo dove non c'è niente da toccare**:
sui tasti no, perché due tocchi rapidi su «+» durante l'allenamento devono
contare due volte.

Resta l'ingrandimento di sistema dell'iPhone (Impostazioni → Accessibilità →
Zoom), che vive fuori dall'app.

### Tornare indietro dove eri

Toccare una riga e tornare **rimette la pagina dov'era**, non in cima. Dalla Home
si apre una camminata del Watch, si guarda, si torna: la Home riappare alla
stessa altezza, con la camminata sotto il dito. Vale per tutte le schermate e
anche fra una scheda e l'altra — Salute lasciata a metà si ritrova a metà.

E **«Indietro» torna da dove sei venuto**, non a una schermata decisa in
partenza: aprendo un allenamento dalla Home riportava all'elenco degli
allenamenti, cioè in un posto in cui non eri mai stato.

La posizione si rimette un paio di volte nei primi decimi di secondo: grafici e
miniature cambiano altezza subito dopo il disegno, e una posizione messa troppo
presto verrebbe tagliata dal contenuto che ancora non c'è.

### Mettere in pausa

Un allenamento **non va chiuso per forza tutto d'un fiato**. In alto a sinistra
c'è **«Pausa»** (nel menu «•••» c'è la stessa voce, «Metti in pausa»): l'allenamento resta aperto
esattamente dov'era — la fase, l'esercizio, la serie — e si torna alla Home, dove
l'app si usa normalmente. Guardare Salute o segnare una sigaretta mentre aspetti
il tapis non costa l'allenamento.

In Home compare **«Allenamento in pausa»** con scritto **da dove riprende** — «dal
cardio», «dalla mobilità», «dagli esercizi» — e il tasto dice la stessa cosa:
**«Riprendi dal cardio»**. Toccandolo si riapre esattamente quella schermata.

Il caso per cui è nato: **mobilità fatta, il cardio no.** Toccando
«Rimanda il cardio» l'allenamento si ferma lì, sul cardio, e si esce; in Home
resta «Cardio da fare» con «Fai il cardio», che riapre la schermata del cardio
pronta. Prima si finiva sul riepilogo, e da lì l'unica strada indietro era
«Torna agli esercizi»: per fare una camminata bisognava ripassare dalla
valutazione dell'ultimo esercizio e dalla mobilità già fatta.

**7. Riepilogo e chiusura.** Il cardio è l'ultimo passaggio, quindi da qui si chiude. Durata, densità, recuperi medi reali, punteggio
scomposto, dati mancanti e nota generale. I numeri dell'orologio **non si
scrivono più**: li porta l'importazione da Salute (vedi 4-bis). Quelli trascritti
a mano prima di quel cambio restano visibili, in sola lettura.

Si può **uscire a metà e riprendere**: serie, riscaldamento e posizione esatta
restano al loro posto anche dopo aver chiuso l'app — compreso il passaggio del
riscaldamento o dell'allungamento in cui eri, e il cronometro che stava
girando, perché il tempo si misura su un istante salvato e non su un contatore
che gira solo mentre guardi lo schermo.

Un esercizio si può **saltare**, ma il motivo (tempo / dolore / attrezzo / altro)
e una **nota scritta sono obbligatori**: «saltato» senza spiegazione, fra tre
settimane, non vuol dire niente.

**Quello che scrivi a parole si rilegge.** Riaprendo un allenamento dallo Storico
si ritrovano tutte e tre le cose scritte a mano: la nota generale, la nota su un
esercizio e la frase con cui hai spiegato un salto. Prima finivano solo nel
pacchetto per il coach, e dallo Storico restava il motivo secco — «attrezzo» —
senza la frase che lo spiegava. Servono prima di tutto a te: «il ginocchio alla
terza serie» va riletto la volta dopo, non ritrovato dentro un testo lungo dieci
pagine.

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

**Dolore: −20 punti per ogni punto dolente segnalato, e tetto a 70.** Due
articolazioni che fanno male nello stesso esercizio pesano il doppio di una; il
tetto resta uno solo. Finché c'è, quell'esercizio non va caricato.

Il bersaglio delle ripetizioni è **quello che l'app ha chiesto quel giorno**, non
il tetto del range: chi lavora al fondo del range fa il suo lavoro e non risulta
«da rivedere». Se una proposta accettata ha alzato l'obiettivo, il conto usa
quello.

### 6.2 Punteggio dell'allenamento (0-100)

| Voce | Peso |
|---|---|
| Esercizi (media dei loro punteggi, sul numero previsto) | 60 |
| Cardio | 20 |
| Riscaldamento | 20 |
| Mobilità di fine seduta | 20 |

**Nel conto entra solo quello che quel giorno prevede davvero.** Una voce che
non c'entra viene esclusa e il suo peso si ridistribuisce sulle altre, invece di
contare zero:

- Una schermata che quel giorno non ha contenuto non viene nemmeno mostrata, e
  non toglie punti: prima ci si fermava su una pagina vuota che chiedeva «fatto
  o saltato?» di niente, e rispondere «saltato» toglieva un quinto del punteggio
  per una cosa che il programma non chiede.
- I giorni di **sola mobilità** (sabato e domenica, che di esercizi non ne hanno)
  escludono gli esercizi e il riscaldamento — non c'è niente da scaldare: lì la
  mobilità è tutto il punteggio, 100 se fatta e 0 se saltata.
- **Le sedute già chiuse non cambiano.** Quello che il programma prevedeva viene
  congelato quando l'allenamento nasce: una seduta che aveva lo stretching come
  passaggio separato continua a mostrarlo, con il suo esito di allora.

**Tetti**: un esercizio saltato → max 75; cardio sotto metà → max 60; cardio più
corto del previsto → max 85. Cardio oltre la velocità di protocollo → quota
massima 0,7; sotto → 0,85.

Un esercizio **previsto e mai iniziato** viene detto esplicitamente, non tolto in
silenzio dal conto.

### 6.3 Punteggio Salute della giornata (0-100)

Sette voci di base, nessuna capace di decidere da sola:

| Voce | Peso | Bersaglio |
|---|---|---|
| Sonno | 22 | 8 h, **più l'ora in cui vai a letto** |
| Allenamento | 22 | completezza della seduta chiusa, o 100 se hai risposto il talk-test su un allenamento dell'orologio |
| Fumo | 20 | 0 sigarette = pieno, 10 = zero |
| Movimento | 12 | 1000 kcal attive |
| Passi | 10 | 10.000 |
| Minuti di esercizio | 8 | 60 min |
| Tempo in piedi | 6 | 180 min |

**Due voci le decide il brief**, e chi non le dichiara non se le ritrova
addosso:

| Voce | Peso | Quando c'è |
|---|---|---|
| Acqua | 12 | con `"contaAcqua": true`: una domanda al giorno, sì o no |
| Fumo | 20 | sparisce del tutto con `"contaSigarette": false` |

**Tetti**: meno di 6 ore di sonno → max 70; allenamento previsto e non fatto →
max 60; **sigarette esattamente al limite → max 70; oltre il limite → max 50**.

Un **giorno di riposo non è un vuoto da punire**: la voce allenamento resta
fuori dal conto, non vale zero.

**Tutte le voci si fermano al 100%, tranne una.** Raggiunto il bersaglio la voce
vale pieno: fare più di quello che il programma chiede non alza il voto, è
semplicemente averlo fatto. Il totale resta fra zero e cento.

L'eccezione è il **fumo**, che scende **sotto zero**. Le sigarette oltre le
tollerate portano la voce in negativo — 15 su 10 valgono −50%, ed è il fondo —
e quel negativo tira giù la media di tutta la giornata. Con la quota ferma a
zero, venti sigarette e dieci pesavano uguale, e non è vero. È l'unica voce
fatta così, per un motivo che le altre non hanno: mancare un bersaglio è non
aver fatto abbastanza, fumare oltre il tollerato è aver fatto un danno.

Resta anche il tetto sulla giornata (oltre le tollerate il totale non supera
50): sono due meccanismi diversi che convivono. Il tetto è un soffitto, il
negativo abbassa la media. Su una giornata perfetta comanda il soffitto; su una
giornata normale comanda la media, e lì la differenza fra dodici e trenta
sigarette si vede tutta.

**Tutto è espresso come rapporto al bersaglio, mai come numero fisso.** Se il
brief cambia un obiettivo, le percentuali si riadattano da sole: con il sonno a
7 h una notte da 6 h vale 71% invece del 63% che valeva con il bersaglio a 8, e
con le sigarette tollerate a 5 fumarne 5 vale 0%. Non c'è nessuna soglia scritta
a mano da aggiornare.

**Il sonno si misura in due parti.** La durata è proporzionale — quattro ore su
otto sono metà del sonno e valgono metà — perché la curva ripida usata in
palestra qui non ha senso: metà allenamento non produce metà adattamento, ma
metà notte è metà notte. L'ora in cui vai a letto moltiplica il risultato: due
notti da sei ore e mezza non sono la stessa notte se una comincia alle 23 e
l'altra alle 3 del mattino — 84% contro 50%. Nel dettaglio compaiono tutte e due
— «6,7h su 8h · a letto 23:01».

Il sonno di una notte porta la data del giorno in cui ci si sveglia: comincia la
sera prima e finisce la mattina.

### 6.4 Giudizi e colori

≥ 90 «ottimo» · ≥ 70 «sufficiente» · sotto «da rivedere».

**Il punteggio non ha colore.** Il numero è inchiostro, sempre, qualunque sia:
è il giudizio scritto accanto a dirlo, non una tinta. Prima c'era una scala
continua — rosso in basso, giallo a metà, lime in alto — e faceva sembrare un
allenamento normale un allarme. In questa app il rosso vuol dire una cosa sola,
e non è «potevi fare meglio».

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

### Gli esercizi che non progrediscono da soli

Due categorie restano fuori dalla doppia progressione, e l'app lo dice invece di
inventarsi una proposta:

- **Esercizi a tempo** (`aTempo`, come plank e suitcase hold): «la progressione
  resta una valutazione a mano». Non c'è un range di ripetizioni da scalare.
- **Esercizi a dose fissa**, cioè scritti nel brief con `ripMin` uguale a
  `ripMax` (`2×15 per lato`, `2×20`): «dose fissa, non progredisce da solo, si
  rivede in conversazione». Prima di questo controllo finivano nel gradino del
  carico e a corpo libero l'app rispondeva *«sei al tetto del range, serve una
  variante più difficile»* — falso due volte: non erano al tetto di niente, e
  nessuno aveva chiesto loro di crescere.

- **Esercizi su cui il carico non si tocca.** Nella libreria un esercizio può
  dichiarare che il peso non si aumenta: arrivato al tetto delle ripetizioni,
  l'app non propone chili e lo dice — «prima le ripetizioni piene su tutte le
  serie, poi semmai una serie in più». Il motivo sta scritto nella scheda
  dell'esercizio, sotto «Nota», così lo legge chi lo sta facendo.

  Il primo caso sono le **rotazioni esterne di spalla** (decisione del coach,
  31/08): la cuffia dei rotatori è stabilizzazione, non un distretto da carico, e
  con i dischi di casa il più piccolo aumento possibile partendo da 2 kg è
  **+1 kg, cioè +50%**. I gradini sono due — 15 ripetizioni piene su tutte e due
  le serie, poi eventualmente una terza serie — e la soluzione vera sono gli
  elastici, dove la resistenza si gradua in modo continuo.

Restano dentro la progressione normale tutti gli altri accessori scritti con un
range vero.

---

## 8. I segnali

Osservazioni che non sono proposte. Attualmente l'app sa riconoscere: cardio
fuori protocollo, inversione dell'intensità, pattern di dolore (uno per punto
dichiarato),
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
FINESTRA 2026-07-06 2026-08-04
GIORNO 2026-08-04 passi=… kcal=… obiettivo=… esercizio=… inpiedi=… piani=… km=… fc=…
NOTTE  2026-08-04 durata=… profondo=… rem=… veglia=… risvegli=…
FASE   2026-08-03 23:14 2026-08-04 00:02 Core
ALLENAMENTO 2026-08-04 inizio=18:30 durata=… kcal=… kcaltot=… km=… fcmedia=… fcmin=… fcmax=… sforzo=… indoor=… fine=… tipo=…
BATTITO     2026-08-04 18:30 95,100-110,105,…
AGENDA 2026-08-05 titolo=Gambe e core nota=…
```

Tutti i campi sono facoltativi: quelli che mancano restano «non registrato», mai
zero. Le unità: `durata` è in **secondi** su `ALLENAMENTO` e in **minuti** su
`NOTTE`; `inpiedi` sono minuti (chi ha le ore usa `inpiediore`); la distanza
si può scrivere in `km` o in `metri`; `fc` su `GIORNO` è la frequenza a riposo,
su `ALLENAMENTO` è la media dell'allenamento (si può scrivere anche `fcmedia`).

Un campo che l'app non conosce — `fcmed` invece di `fcmedia`, `step` invece di
`passi` — non viene letto, e il riepilogo dell'import **lo dice**: un errore di
battitura nel comando rapido si scopre solo così.

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

## 9-bis. Gli allenamenti che l'orologio registra da solo

Da quando i dati arrivano dall'esportazione di Salute, ogni sessione avviata
sull'Apple Watch entra nell'app per conto suo: le camminate, la sessione di
pesi, tutto. Hanno una **sezione loro nella barra in basso, «Allenamenti»**, che
si apre sulla settimana in corso — quanti allenamenti, quanto tempo, chilocalorie
e chilometri, e sette barrette che dicono quanto ti sei mosso ogni giorno — e
prosegue con l'elenco completo raggruppato settimana per settimana.

Il dettaglio è quello che l'orologio mostra a te, con gli stessi numeri e gli
stessi colori: durata, chilocalorie attive e totali, media e massimo del
battito, distanza e passo, e lo **Sforzo** da 1 a 10 con la parola che lo
traduce. Poi la **frequenza cardiaca** disegnata come sul quadrante — una
barretta per momento, dal battito più basso al più alto di quei secondi, così si
vede anche quanto è stato stabile e non solo quanto è salito. Si tocca per
leggere un momento preciso, che sull'orologio non si può fare; dove manca la
barretta, l'orologio non ha misurato. Le misure si raccolgono a caselle da mezzo
minuto: l'orologio scrive un battito ogni pochi secondi, e un'ora di allenamento
farebbe settecento punti per un grafico largo tre centimetri.

**Al chiuso o all'aperto.** Per Salute una camminata è sempre «Walking»: il
tapis e il giro dell'isolato hanno lo stesso tipo, e la differenza sta in un dato
a parte dentro il blocco dell'allenamento. L'app lo legge e lo scrive nel nome —
«Camminata indoor», «Camminata outdoor», e lo stesso per corsa e bici. Dove
quel dato non c'è (gli allenamenti importati prima) il nome resta semplice,
senza inventare.

**Il passo al chilometro.** In Salute, sotto i passi, due grafici dicono quanti
minuti ci metti a fare un chilometro: **a piedi** e **di corsa**. Quello di corsa
compare da quando l'orologio registra la prima corsa. Non è un numero che
l'orologio scrive: si ricava sommando distanza e durata degli allenamenti dello
stesso tipo nello stesso giorno, e dividendo — sommare prima e dividere dopo è
l'unico modo corretto, perché una camminata di dieci minuti non pesa quanto una
di un'ora. Camminata e corsa restano separate (mescolarle darebbe un numero che
non descrive nessuna delle due), indoor e outdoor stanno insieme: è comunque il
tempo che ci metti a fare un chilometro. Più basso vuol dire più veloce; si tocca
per vedere il passo di un giorno, con i chilometri e la durata da cui viene.

**Non tutti gli allenamenti entrano nel conto.** L'orologio registra anche
camminate che una distanza non ce l'hanno davvero: avviate e chiuse subito, o al
chiuso dove il passo non è calibrato. Trenta metri in sei minuti darebbero «191
minuti al chilometro» — un numero vero e inservibile. Entrano solo gli
allenamenti da **almeno mezzo chilometro** e con un passo dentro limiti umani
(fra 2 e 30 minuti al km): fuori di lì non è che sei andato piano, è che la
distanza non è stata registrata. Gli esclusi **restano nell'elenco** — sono
successi — e il grafico dice quanti sono. Un giorno in cui non ne resta nessuno
è un buco nel grafico, non un numero sbagliato. La stessa regola vale nel
dettaglio dell'allenamento: dove il passo non è credibile, non viene scritto.

**L'app non li interpreta.** Non decide se una camminata era il cardio del
programma o una passeggiata, non li collega alle sedute e non chiede di farlo:
è stato provato, e serviva solo a far perdere tempo per un'informazione che
nessuno usava. Nel pacchetto arrivano per quello che sono — «allenamenti
registrati dall'Apple Watch e importati dall'app Salute» — con scritto che vanno
letti **accanto** al log della seduta e non al posto suo: un allenamento di forza
compare in tutti e due, qui come lo ha visto l'orologio e là come è stato
eseguito.

**I numeri dell'orologio non entrano in nessun punteggio**: né in quello della
seduta, né in quello Salute, né nelle proposte di progressione. Sono
l'osservazione di quello che è successo, non la misura di quanto hai seguito il
programma.

**Il talk-test invece pesa, ed è l'unica cosa qui dentro che scrivi tu.** In
fondo alla scheda di una **camminata, di una corsa, di un'escursione o di
un'uscita in bici** — cioè dove l'andatura la decidi tu, e solo lì — ci sono tre
risposte alla domanda «riuscivi a parlare?» — *sì, comodo* ·
*sì, col fiatone* · *no* — più una nota libera. Su una sessione di pesi la
domanda non compare: là l'intensità la dicono carico e RPE, che stanno nel log
della seduta, e chiederla su ogni riga voleva dire lasciare per sempre due terzi
degli allenamenti «senza risposta». È la sola misura di
intensità che non esce da un sensore, ed è quella che il coach legge: nella
tabella del pacchetto diventa una colonna in più, e le note scritte a mano
arrivano per esteso sotto la tabella. Una giornata con un allenamento a cui hai
risposto **vale come giornata di allenamento nel punteggio Salute**, piena;
senza risposta resta fuori dal conto invece di valere zero, perché l'orologio
dice che ti sei mosso, non a che intensità.

Il talk-test sta **in fondo** alla scheda, dopo i numeri: quelli si leggono,
questo si scrive, e le cose da fare vanno dopo quelle da guardare. Ritoccare la
risposta già data la toglie. In cima all'elenco compaiono le uscite degli ultimi
sette giorni ancora senza risposta, con le tre pastiglie lì accanto: il
talk-test lo ricordi per un giorno o due, non per un mese.

**L'elenco è in bianco e nero, il dettaglio no.** I colori dell'orologio —
calorie verdi, battito rosso, sforzo viola, durata gialla — stanno dove sono un
dato misurato, cioè dentro la scheda di un allenamento. Nell'elenco, dove sono
nomi e somme fatte dall'app, tutto è inchiostro. Talk-test e note stanno in
un **archivio a parte**: rifare l'importazione da Salute riscrive i numeri
dell'orologio ma non tocca quello che hai scritto tu, ed entrano nei backup.

## 10. Il conteggio delle sigarette

Un contatore: un tocco per sigaretta, con l'orario. Il «−» serve per i tocchi
sbagliati. Il numero è inchiostro fino a nove e **rosso da dieci**: due stati,
non una scala. Il tetto dichiarato è zero, e davanti a una regola netta un
semaforo a quattro gradini racconterebbe una storia sfumata che non c'è. Sotto
il numero la frase dice come stai messo — «il massimo è zero, e ci sei», oppure
«1 di troppo».

Il conteggio è **manuale**: vale quello che è stato segnato, non c'è modo di
verificarlo, e nel pacchetto è scritto esplicitamente.

**La soglia scende da sé, e non risale.** Parte da quella concordata nel brief e
funziona come una tacca: appena una giornata chiude sotto il limite in vigore,
dal **giorno dopo** quel numero diventa il nuovo massimo. Se un giorno ne fumi
sei, sei è il tetto da lì in avanti — anche se il giorno dopo ne fumi nove, che
a quel punto risulta *oltre*.

Il record del giorno stesso non vale per il giorno stesso: quella giornata viene
giudicata col limite che aveva quando è cominciata. Abbassare l'asticella a cose
fatte sarebbe cambiare le regole a metà partita.

Il capolinea è **zero**: arrivati a zero il massimo è zero, e da lì una sola
sigaretta è già oltre. Una giornata a zero contro un limite di zero resta però
il giorno perfetto — 100%, senza tetti.

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

**Correggere e cancellare.** Toccando una misura nell'elenco si apre tutto il
suo storico: ogni volta che l'hai presa, con data, valore e da dove viene (a
mano, dal brief, fuori protocollo). Da lì una misura si può **eliminare**, con
una conferma che nomina data e valore — «Eliminare la misura del 25/08? Peso:
99,7 kg» — perché gli indici e i confronti si ricalcolano senza.

Serve quando hai sbagliato **il giorno**, non il numero: se il giorno è giusto
basta registrarla di nuovo con la stessa data e si sovrascrive. Prima la
sovrascrittura era l'unica strada, e una misura finita sul giorno sbagliato
restava per sempre negli indici, nei confronti e nel pacchetto per il coach.

**Indici**: vita/altezza (soglia 0,50), vita/fianchi (soglia 0,95, che è quella
maschile: sul profilo di un'atleta va letta sapendolo) e BMI, dichiarato per
quello che è — «il meno informativo dei tre», gonfiato dalla massa muscolare. Sono indicatori di
struttura, **non una diagnosi**.

**Foto**: 4 pose, ogni 2 settimane, con protocollo identico (stessa ora, stessa
luce, stesso punto sul pavimento) e una checklist da spuntare tutta prima di
poter iniziare. Le pose sono **quelle che l'atleta fa già**, sul modello del set
di riferimento esistente. Le foto restano sul telefono e **non entrano mai nel
pacchetto**.

Il **set più vecchio** porta la parola «riferimento» accanto alla data: è il
metro di paragone, quello su cui sono modellate le pose. È assegnato dalla data,
non scelto a mano, quindi ce n'è sempre **uno solo** — se un giorno entrassero
foto più vecchie, il segno si sposterebbe lì. Un'etichetta simile era già
esistita e fu tolta proprio perché finiva su ogni set caricato dalla libreria, e
con due «set di riferimento» a schermo non si capiva più quale fosse il metro.
Accanto può comparire anche «caricate a mano», che dice un'altra cosa — come
quelle foto sono entrate nell'app — e le due informazioni non si escludono.

**Portarle nella galleria del telefono.** Le foto scattate dall'app vivono nel
suo archivio, non in Foto: un'app web su iPhone **non può scrivere nella
galleria**, quel permesso iOS non lo concede a nessun sito. Quello che si può
fare è arrivare a un tocco solo, ed è quello che l'app fa: appena finito un set
compare il foglio «Salva in galleria», e lo stesso tasto sta accanto a ogni set
dell'elenco e dentro ogni singola foto. Da lì si apre la condivisione di iOS con
le quattro immagini già pronte e in ordine di posa — fronte, profilo, schiena,
braccia aperte — e si sceglie «Salva 4 immagini». Su un browser da computer,
dove quel foglio non esiste, i file vengono scaricati e l'app lo dice invece di
fingere.

---

## 12. Il pacchetto per il coach

È **testo**, mai immagini o screenshot, e i numeri arrivano dai dati registrati,
non trascritti a mano. Si sceglie cosa includere.

**Un pacchetto contiene un allenamento solo**, il più recente chiuso: è pensato
per essere mandato dopo la seduta. Se lo stesso giorno ne hai chiusi due, il
pacchetto lo dice in cima — quale è rimasto fuori e con quante serie — così il
coach non legge mezza giornata credendo di averla tutta, e tu sai che quello va
mandato a parte. Un allenamento ancora **aperto** non entra (i dati non sono
chiusi) e anche questo viene dichiarato.

Contiene:

- **Log della seduta** in formato §12: tabella esercizio / carico / serie×rip /
  RPE / nota, più recuperi reali cronometrati (media, minimo, massimo **e per
  singolo esercizio**), velocità e durata del cardio, durata dell'allenamento,
  **densità sui pesi** (serie/min dalla prima all'ultima serie), riscaldamento
  (con o senza tapis), mobilità, nota generale, il
  **punteggio che l'app si è data** con l'eventuale tetto che l'ha fermato, e
  gli **obiettivi chiesti dall'app diversi dal brief** (quando una proposta
  accettata ha cambiato il bersaglio)
- **Dettaglio serie per serie**: una riga per ogni singola serie con carico,
  ripetizioni fatte, quello che l'app aveva chiesto in quel momento, il
  **recupero cronometrato prima di quella serie** contro quello previsto, e
  l'orario. Sotto ogni esercizio: RPE, tecnica, prescrizione del brief,
  eventuali dolori con dove, quando e quanto, note. Serve quando il
  riassunto non basta — cedimenti a metà esercizio, recuperi saltati, carichi
  cambiati in corsa

**Come si leggono i carichi.** Il numero comprende sempre la barra sul
bilanciere ed è **per manubrio** sui manubri: l'app lo scrive accanto al valore,
così non resta da indovinare. Se il carico è rimasto costante la riga è
compatta (`30 kg barra compresa` · `3x8/8/6`); se è cambiato durante
l'esercizio ogni serie viene scritta per intero (`4 → 6 kg per manubrio` ·
`s1 4 kg×12 · s2 6 kg×10`), perché una forma come «4/6 kg» accanto a «2x12/10»
si può leggere in tre modi diversi
- **Mobilità**: fatta o saltata, quando quel giorno ne prevede una
- **Dati salute**: stato delle finestre a 3 settimane e la tabella giorno per
  giorno con movimento, percentuale sull'obiettivo, passi e note
- **Il talk-test sugli allenamenti dell'orologio** (sezione «Allenamenti» nella
  barra in basso, dove prima c'era «Extra»): *frasi intere comode / frasi intere
  con fiatone / a fatica*, più una nota scritta a mano. È l'unica colonna della
  tabella del Watch che l'orologio non misura — la scrivi tu, e dice a che
  intensità stavi andando davvero. Una giornata con un allenamento a cui hai
  risposto il talk-test vale come giornata di allenamento nel **punteggio
  Salute**, e vale pieno; senza risposta resta fuori dal conto invece di valere
  zero. Dove c'è anche una seduta vera comanda il punteggio della seduta, che
  dice di più.

  Prima queste attività si registravano una seconda volta a mano, nella sezione
  «Extra»: la stessa camminata che l'orologio aveva già scritto da solo, con
  durata, km e battito da ricopiare. Adesso la camminata c'è già, e sopra ci
  metti la sola cosa che mancava. Le righe scritte a mano prima del cambio
  restano in archivio finché non le butti — la sezione Allenamenti le mostra e
  le elimina in blocco, dicendo prima quali giornate perdono il punteggio
- **Allenamenti letti dall'Apple Watch** — vedi §9-bis. Degli ultimi 7 giorni:
  data, ora, tipo, durata, km, kcal attive e totali, FC media e massima, sforzo.
  L'app **non dice cos'era** ognuno — se la seduta, il cardio che le va dietro o
  movimento in più: ci ha provato e non serviva a nessuno. L'intestazione dice
  da dove vengono (misure dell'orologio importate da Salute, non stime dell'app)
  e che vanno letti **accanto** al log della seduta, non al posto suo: un
  allenamento di forza compare in tutti e due. Senza questa tabella
  il coach vedeva l'allenamento registrato a mano ma non il resto della
  giornata, e quello che l'atleta importava nell'app non arrivava a
  destinazione
- **Proposte in sospeso**, con le quattro domande già compilate
- **Segnali aperti**
- **Fumo**: sigarette al giorno, media, giorni a zero
- **Acqua**: la risposta di ogni giorno, e quanti giorni su quelli risposti
- **Misure e indici**, se registrate

Fumo e acqua sono dichiarati nel brief, uno per profilo: chi non conta le
sigarette non vede la casella «Fumo», chi non conta l'acqua non vede quella
dell'acqua. Un giorno senza risposta non vale «no»: è scritto «non risposto» e
resta fuori dal conto.

La giornata in corso è marcata **«giornata in corso, non finita»**: i suoi numeri
non sono confrontabili con quelli dei giorni chiusi.

Nella colonna «Tipo» un giorno senza allenamento è **Riposo**, anche quando sul
calendario c'è un promemoria di altro genere (una misurazione, una visita): il
titolo del promemoria compare fra parentesi come contesto, non come
classificazione della giornata.

---

Un allenamento passato si apre nella **stessa identica schermata** di uno appena
chiuso: anello della completezza, punteggio scomposto voce per voce, esercizio
per esercizio, numeri dall'orologio. Lo stesso allenamento non ha due facce
diverse secondo da dove lo apri.

---

### Se i Comandi Rapidi non funzionano

Su una beta di iOS le azioni di Salute dentro Comandi Rapidi possono restare
appese. L'app non dipende da loro — e per i dati salute il comando rapido non
viene più nemmeno offerto: **Salute → Aggiorna → «Importa» → «Scegli un file»**
prende direttamente l'`export.xml` dell'app Salute
(profilo → «Esporta tutti i dati», poi in File si estrae lo zip). Il file pesa
centinaia di megabyte e non viene caricato in memoria: viene fatto **scorrere**
a pezzi, tenendo solo i numeri che servono. Misurato su un export vero da
852 MB: letto in un paio di secondi con meno di 30 MB di memoria occupata.

Lo strumento da computer (`tools/salute-da-export.py`) fa lo stesso lavoro ma
produce un pacchetto **più povero**: scrive giorno, ora, durata, calorie e tipo,
mentre il lettore sul telefono aggiunge distanza, calorie totali, frequenze
minima/media/massima, sforzo, dentro o fuori, ora di fine e la curva del
battito. Non è un problema per i dati già in archivio — reimportare **fonde**, e
un campo assente non cancella quello che c'era — ma se puoi scegliere, la strada
del telefono porta più roba.

Non entra mai niente di più vecchio del **29 luglio 2026**, il giorno da cui
comincia questa storia: la data è scritta nel codice, non dedotta dai dati del
telefono, così sopravvive a un cambio di dispositivo, a un archivio svuotato e
a un ripristino da backup. Se un archivio cominciasse ancora prima, comanda
l'archivio: il pavimento serve a non prendere di più, mai a tagliare.

Restano fuori solo gli eventi del **calendario**, che nell'export di Salute non
ci sono: quelli continuano ad arrivare dal comando «Coach Calendario», che non
tocca Salute e infatti funziona.

---

### Il blocco di mobilità

Dopo i pesi e **prima del cardio**, ogni giorno ha un blocco di mobilità a **dose
fissa**: nessun carico, nessuna soglia tecnica, nessuna progressione. Dal
27/08/2026 è **uno solo**, uguale tutti i giorni, sabato e domenica inclusi, e
si fa di fila in **26 passaggi**:

| Parte | Passaggi | A cosa serve |
|---|---|---|
| Movimenti dinamici | mobilità di caviglia · cerchi con il bacino · cat-cow · cerchi con le braccia · rotazioni di spalla · tre movimenti di **polso** | **mantenere** l'escursione |
| Posizioni tenute | 18 tenute da 45 secondi, dai polpacci al collo agli avambracci | **guadagnare** escursione |

Prima le zone ruotavano per giorno, in modo da non ripetere quello che il
riscaldamento aveva già toccato. Per un obiettivo di mantenimento quel
ragionamento non regge — il riscaldamento prepara *quell'articolazione* per
*quel carico*, la mobilità generale è un'altra cosa — e la rotazione costava più
attrito («oggi quali zone tocca?») di quanto facesse risparmiare.

L'ordine dentro il blocco è **di sicurezza**: prima il dinamico, poi le tenute.
È lo stesso motivo per cui tutto il blocco sta dopo i pesi e non all'inizio.

I movimenti dinamici sono quelli che già conosci dal riscaldamento, con la stessa
spiegazione e lo stesso video. **Ogni passaggio ha il suo video**, tenute
comprese.

**Il polso** è entrato il 27/08 su storico pregresso, e i suoi tre movimenti
portano scritta l'avvertenza: si arriva dove il movimento va da solo, **senza
forzare il fine corsa**, e se tira o dà fastidio ci si ferma prima. Vale anche
per le due tenute sugli avambracci. Il cat-cow, che carica il polso in appoggio
disteso, dice come farlo sui pugni chiusi o sugli avambracci.

Nel punteggio entra come il riscaldamento: per il fatto di essere stata fatta o
saltata, non per quanto bene. **È una voce sola** — non due — perché è un blocco
solo. **Sabato e domenica sono giorni di sola mobilità** — nello split ci sono,
ma senza esercizi — e lì quella voce è tutto il punteggio: aprire il giorno e
farla vale 100, aprirlo e saltarla vale 0. In quei due giorni il riscaldamento
non conta, perché non c'è niente da scaldare.

### Lo stretching dopo la camminata — l'unica cosa facoltativa

Dal 28/08/2026 c'è un terzo gruppo di allungamenti, che il coach chiama Blocco
C: **quattro posizioni sulle gambe, sei minuti, dopo una camminata lunga.** Sono
le stesse quattro che stanno già dentro al blocco di mobilità — polpaccio a
gamba tesa, polpaccio a ginocchio flesso, affondo basso, femorali con
asciugamano — e infatti nell'app non sono scritte due volte: nel file ci sono
solo i loro nomi, le istruzioni si leggono da lì.

**È diverso da tutto il resto, ed è il punto:** non è prescritto, **non entra in
nessun punteggio**, saltarlo non è un errore e non produce mai un «previsto, non
fatto». Non c'è una necessità fisiologica dietro — il guadagno di flessibilità si
costruisce con la ripetizione nel tempo, e una camminata non annulla la mobilità
fatta ore prima. Si fa perché fa piacere allungare le gambe dopo aver camminato,
che è un motivo legittimo ma è comodità, non protocollo.

**Dove si trova**, in due posti, perché il cardio si fa in due momenti diversi.

**Dentro la seduta**: appena tocchi «Ho finito» sul cardio, arriva da solo —
quattro posizioni una per volta, con il cronometro sui 45 secondi e i due lati,
come le tenute. In cima c'è scritto che è facoltativo, e c'è «Salta», che porta
dritto al riepilogo **senza scrivere niente**: saltarlo non lascia traccia,
perché non c'era niente di dovuto. Se l'hai saltato e cambi idea, nel riepilogo
resta una carta con «Fallo adesso» che ti riporta lì; una volta fatto la carta
sparisce e al suo posto compare una riga di sola lettura.

**In Allenamenti**, dentro la scheda di una camminata (o di una corsa, o di
un'escursione), sotto il talk-test: è la strada per quando il cardio lo fai ore
dopo i pesi. Sono due strade allo stesso gesto: segnarlo in tutte e due non è
una contraddizione, è la stessa cosa detta due volte.

Non compare quando il cardio l'hai **rimandato**: arriverà con lui. C'è un interruttore, «Segna che
l'hai fatto», e le quattro posizioni che si aprono a leggere. Su una camminata
di mezz'ora o più l'app dice che ha senso; sulle altre lo si può segnare
lo stesso, senza che nessuno insista.

La risposta sta nello stesso archivio del talk-test — quello tuo, che non sparisce
quando rifai l'importazione da Salute — e **rispondere o togliere il talk-test non
lo cancella**, sono due cose separate che stanno nella stessa riga.

Nel pacchetto per il coach compare **solo se l'hai fatto almeno una volta**, come
elenco sotto la tabella degli allenamenti, con scritto che è facoltativo. Non c'è
una colonna: una colonna piena di trattini si legge come un obbligo disatteso, ed
è esattamente quello che questo blocco non è.

**Una cosa che il coach tiene d'occhio** (verifica al 07/09): questi sei minuti
non devono prendere il posto della mobilità di fine seduta. Sono quattro
posizioni su diciotto, e solo sulle gambe. L'app non fa niente al riguardo — è
una domanda che ti farà lui — ma lo scrive dove serve.

**Non farsi vedere pesa come saltare un Push** (verificato il 25/08/2026). Un
sabato con l'evento «Allenamento: Mobilità» sul calendario e nessuna seduta
aperta produce esattamente quello che produce un Push saltato: nel punteggio
Salute la voce Allenamento vale **zero** con lo stesso peso di sempre, nella
tabella del pacchetto per il coach la riga dice «**Non fatto (era previsto
Mobilità)**», e sul calendarietto il giorno resta senza la sottolineatura piena
dei giorni fatti, con scritto «Mobilità — non registrato». Farla vale **100** e
riporta la voce Allenamento a pieno.

---

## 13. Il calendario

Lo split del brief disegna i giorni per default. Se il coach mette un evento sul
calendario del telefono, **comanda quello**, e l'app segnala quando l'evento è
diverso da ciò che prevedeva lo split. Un giorno mai letto dal calendario non
viene mai dichiarato «scaduto».

**E comanda su tutto, non solo sugli allenamenti.** Con il calendario collegato,
anche pesata, circonferenze e set di foto sono quelli che ci ha scritto il
coach: l'app smette di aggiungere le proprie cadenze. Prima le sommava, e ne
uscivano due cose sbagliate insieme — un doppione («peso, vita, misure e foto»
scritto dal coach e accanto «Peso e circonferenza vita» messo dall'app) e
scadenze inventate, tipo un set di foto «in ritardo» in un giorno in cui il
coach non ne aveva chiesto nessuno. Senza calendario le cadenze del protocollo
tornano a valere, perché lì non c'è nessun altro a dirle. Restano sempre
dell'app soltanto due promemoria, che il coach non può conoscere: il backup su
file e l'import dei dati salute.

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
  giorno fiacco e farebbe sembrare che stai peggiorando. Il sonno fa eccezione:
  una notte è finita stamattina, non è a metà come la giornata, e nella media ci
  entra.
- **Non sovrascrive in silenzio.** Quando un giorno già chiuso cambia di molto,
  lo dice e spiega come tornare indietro.
- **Non lascia un bottone spento senza spiegare cosa manca.**
- **Non tratta pressione arteriosa né ECG**, non interpreta dati clinici, non
  calcola fabbisogni calorici e non dà indicazioni alimentari.
- **Non manda fuori dal telefono nessun tuo dato.** Allenamenti, misure, foto,
  sonno, sigarette: restano nell'archivio del telefono e non esistono altrove.
  Non c'è nessun server, nessun account, nessuna statistica raccolta.
  Le uniche richieste che possono uscire riguardano i **video degli esercizi**, e
  non portano fuori niente di tuo.

  **Il player di YouTube è già montato quando l'esercizio compare a schermo.**
  Non parte da solo — ha il suo tasto grande in mezzo — ma è caricato, e al
  tocco parte subito. Prima al suo posto c'era una copertina: toccandola
  cominciava il caricamento, e solo dopo un secondo o due si poteva guardare.
  Fra una serie e l'altra quel secondo capita sempre nel momento sbagliato, e
  una fotografia non si può mandare avanti né mettere in pausa.

  Il prezzo, detto chiaro: **la richiesta a YouTube parte quando l'esercizio ti
  compare davanti**, non quando decidi tu di guardare il video. YouTube vede
  che da quell'indirizzo si sta aprendo quell'esercizio; non vede il tuo nome,
  il tuo archivio, i tuoi carichi — quelli non escono dal telefono in nessun
  caso. Il dominio è quello «nocookie», che è il meno invadente dei due.

  Insieme al player si scarica anche la **miniatura** del video (`i.ytimg.com`),
  una volta sola per video, e resta nell'archivio del telefono: serve il giorno
  in cui la rete non c'è. **Senza rete** il player non si carica e al suo posto
  torna quella miniatura, con il suo tasto: toccandola riprova.

  Le miniature **non entrano nei backup** — non sono roba tua e si riscaricano
  da sole — e da Impostazioni si può vedere quanto pesano e buttarle via.



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
**identico byte a byte** su tutti e 17 gli archivi. Un file rovinato viene
**rifiutato senza toccare niente**, con un messaggio che dice quale sezione non
si legge (provati nove file sbagliati: vuoti, di un'altra app, di una versione
futura, rovinati a metà — nessuno ha tolto un dato).

**Prima di sostituire, il ripristino dice cosa stai per rimettere e cosa stai per
togliere**: quanti allenamenti, misure e attività ci sono nel file e quanti ce ne
sono adesso sul telefono, con la data fino a cui arrivano. Un backup di tre
settimane fa si riconosce da lì. E prima di sovrascrivere l'app tiene da parte
una copia interna di com'era: se il ripristino va storto non è un vicolo cieco —
e se non riesce nemmeno a rimettere a posto quella copia, **lo dice** invece di
lasciarti credere che la rete di sicurezza sia intatta.

**Dove vivono i dati, detto in Impostazioni.** Accanto ai backup c'è una riga che
dice quanto è al sicuro l'archivio. Non mostra la risposta nuda del sistema
(`navigator.storage.persist()`), perché su iPhone quella è **no per tutti** e
spaventava per la cosa sbagliata. Mostra quello che conta davvero, cioè dove gira
l'app:

- **installata** dalla schermata Home → i dati restano finché non togli l'app.
  Il telefono non promette niente, ma il rischio vero non c'è.
- **dentro il browser** → «App non installata: archivio a rischio». Lì i dati di
  un sito sono di passaggio e il sistema può cancellarli dopo qualche giorno che
  non lo apri. La riga spiega come installarla (Condividi → «Aggiungi a Home»).
- **sì** → il sistema si è impegnato a non cancellarlo (succede su altri
  browser, non su iPhone).

In tutti e tre i casi il **backup su file** resta l'unica copia che sopravvive
alla perdita del telefono: quella riga cambia quanto è urgente, non se serve.

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

---

## 17. Cosa è dimostrato e cosa è solo provato

Non tutte le parti dell'app si possono controllare allo stesso modo, e conviene
sapere dove passa il confine.

**Dimostrato.** Dove le possibilità sono in numero finito, `tools/verifica-esaustiva.js`
le percorre tutte, una per una: le combinazioni di dischi montabili sul
bilanciere e sui manubri, ogni giorno di calendario dal 2020 al 2035, ogni
durata al secondo fino a venticinque ore, i numeri e gli orari. Per queste
funzioni «non ha difetti» non è una speranza: è una frase verificata su ogni
caso possibile, non su un campione scelto da qualcuno.

Ai punteggi lo stesso trattamento non si può applicare — gli ingressi sono
troppi — quindi si controlla un'altra cosa: le **regole che devono valere
sempre**, su decine di migliaia di combinazioni. Un totale non può uscire dalla
scala 0-100 né diventare un non-numero; una voce non può avere peso zero o una
quota fuori da 0-1; un dolore dichiarato non può far **salire** il voto di un
esercizio; una tecnica migliore non può farlo **scendere**; un esercizio
saltato, o un cardio non fatto, non possono far salire il voto della seduta.
Sono gli errori peggiori da scoprire, perché non rompono niente: producono solo
un numero sbagliato che sembra giusto.

Queste prove sono state a loro volta messe alla prova, guastando l'app di
proposito per vedere se se ne accorgevano: con la tecnica invertita hanno
segnalato 252 casi, col dolore trasformato in premio 16.707, con l'esercizio
saltato che regalava punti 535. Un controllo che non sa fallire non sta
controllando niente.

**Provato, non dimostrato.** Tutto il resto: iOS, il telefono, i dati che
arrivano da fuori (Salute, l'orologio, il file del brief) e quello che dipende
dal momento in cui l'app gira. Lì si prova, si sbaglia e si corregge — ma non
si può dire «ogni caso possibile», e questo documento non lo dirà mai.

**I grafici a linee.** Un punto per ogni giorno con dato, tutti dello stesso
inchiostro e della stessa misura — solo l'ultimo, quello che stai guardando, è
un filo più grande. Prima i giorni con allenamento erano più scuri e più grandi
degli altri: sulla linea dei passi e su quella del sonno diventavano macchie a
tratti, e la curva sembrava fatta di due stili diversi. Era anche una differenza
di tinta, che è quello che la direzione «Referto» non vuole. In che giorni ti
sei allenato lo dice già il grafico a barre della Home, dove c'è la legenda che
lo spiega: lì la differenza è dichiarata, qui non lo era.

**La rete.** Dal 27/08 esiste un collaudo che si rilancia con una riga sola:
`tools/rete.js`. Prima il lavoro di controllo produceva un registro — voci
chiuse, nessuna ri-eseguibile — cioè un verbale, non una rete: ogni modifica
successiva faceva scadere la garanzia senza dirlo. Adesso dodici prove, oltre
centocinquantacinquemila casi, meno di un terzo di secondo, e si lancia
sull'archivio vero perché è di sola lettura.

Dentro ci sono cinque strati: il nucleo dimostrato su ogni caso possibile; **le
regole che devono restare scritte una volta sola** (la rete legge il codice e
protesta se una di quelle regole ricompare altrove); i dati che l'app porta con
sé; gli invarianti veri per qualunque archivio; e **lo stesso numero chiesto per
strade diverse**, che è la categoria che il 27/08 ha prodotto quattro difetti su
sei. Le prove che scrivono stanno a parte e si rifiutano di partire se
l'archivio non è vuoto.

Anche la rete è stata guastata apposta, quattro volte, per vedere se sapeva
fallire: ricopiando una regola in una schermata, facendo ricalcolare al
pacchetto la durata per conto suo, mettendo nella libreria uno schema che il
conto del volume non conosce, e facendo restituire una durata negativa. Le ha
prese tutte. Sulla seconda ha ritrovato da sola il difetto peggiore della
giornata, con gli stessi numeri: «il 10 agosto lo schermo dice 49 min, il
pacchetto 6h 06m».

**Le guardie della pubblicazione** hanno il loro collaudo a parte,
`tools/prova-guardie.sh`: costruisce una alla volta le cinque violazioni che
dovrebbero fermare la pubblicazione e controlla che la fermino davvero. Sono
l'ultima barriera fra i dati personali e un repository pubblico, e fino a quel
giorno nessuno le aveva mai messe alla prova — passavano sempre, e «passa
sempre» è indistinguibile da «non controlla niente».

**Quanto regge negli anni.** L'archivio è stato riempito fino a 1400
allenamenti e 21.000 serie — più di cinque anni al ritmo di cinque sedute a
settimana. Tutto cresce in modo proporzionale, niente esplode: l'avvio resta
sotto i venti millesimi di secondo, lo Storico sotto il terzo di secondo, il
backup arriva a una quindicina di megabyte. Il **pacchetto per il coach resta
lungo uguale** — circa centocinquanta righe — perché non è un riassunto di
tutta la storia ma una finestra sugli ultimi giorni: fra cinque anni si leggerà
come oggi.
