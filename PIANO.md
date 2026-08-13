# Piano di verifica e correzione

Documento operativo. Da qui in avanti **lavoro da solo**: verifico, correggo,
pubblico, e non ti interpello finché non ho finito tutte le 502 voci di
[VERIFICA.md](VERIFICA.md).

Questo file dice **come** lo faccio, **in che ordine**, **cosa non tocco** e
**come mi accorgo di aver sbagliato**. VERIFICA.md dice *cosa* c'è da guardare;
questo dice *come si lavora*.

---

## 1. Regole d'ingaggio

### Non tocco mai, per nessun motivo

| Cosa | Perché |
|---|---|
| `_privato/` | Accordo. Non lo apro, non lo leggo, non ci scrivo. Se un controllo ha bisogno di quello che c'è dentro, la voce va nella lista per te (§8) e resta lì. |
| Il tetto fumo a zero | `dichiaraTettoFumo` e `proteggiTettoFumo` non si toccano, nemmeno per «pulizia». Se una correzione ci passa vicino, la riscrivo in modo da non sfiorarle. |
| Il set foto del 29/07 | È il master. Nessuna correzione può chiamarlo «fuori protocollo», e nessuna può cambiare come viene mostrato. |
| Il punteggio congelato delle sedute chiuse | `completezza` scritta alla chiusura è un fatto avvenuto. Posso correggere **come** viene congelato d'ora in poi, mai riscrivere quello già in archivio. |
| L'elenco esercizi congelato (`previstiElenco`) e le soglie cardio (`cardio.soglie`) | Stesso motivo. |
| I dati in archivio sul telefono | Non esiste correzione che migri o riscriva dati esistenti. Se una correzione lo richiederebbe, non la faccio e la metto in §8. |

### Non chiedo, decido

Consenso permanente già dato: non chiedo il permesso di modificare file,
pubblicare, o installare niente. Se una scelta è ambigua **scelgo l'opzione che
non cambia il comportamento**, la annoto, e vado avanti.

### Le quattro decisioni prese insieme, prima di cominciare

Prese il 13 agosto 2026, prima della Fase 0. Non si rimettono in discussione da
sole: se durante il lavoro una si rivela sbagliata, la scrivo in §8 e la
rispetto lo stesso fino alla fine.

| Domanda | Decisione |
|---|---|
| Cadenza di pubblicazione | **Tutto subito, una correzione per volta**, in ogni fase — non solo nelle prime due |
| `VERIFICA.md`, `PIANO.md`, `ESITO.md` | **Restano online**, così li apri dal telefono per controllarmi |
| `?nosw` | **Funziona solo su localhost**: sul sito pubblicato viene ignorato |
| Le sette decisioni di contenuto | **Alla fine.** Fino ad allora quei sette punti non si toccano |

**Cosa comporta la prima.** Una correzione = un commit = una pubblicazione = un
confronto byte per byte. Se le correzioni saranno un centinaio, saranno un
centinaio di aggiornamenti sul tuo telefono. È il prezzo della granularità: se
qualcosa si rompe, so esattamente quale correzione è stata e torno indietro di
una sola. La regola che la rende sicura è quella di §4: **non pubblico mai una
correzione che non ho riprovato**, e il controllo del contorno (§4.1) va fatto
prima di ogni push, non a fine giornata.

**Cosa comporta la terza.** `?nosw` diventa una modifica di codice vera, con la
sua riga in ESITO.md: sta in Fase 2 (voce **11.G.1**) ed è la prima correzione
di quella fase.

### Non decido, riporto

Ci sono voci che non sono difetti ma **decisioni tue**. Su quelle non tocco
niente: le raccolgo in §8 con la mia raccomandazione. Elenco iniziale (crescerà):

- **11.O.3** — un giorno non contato vale zero sigarette e prende punti pieni.
  È dichiarato in tre punti del codice: è una scelta, e in vacanza capiterà.
- **11.J.4** — «Misure e indici» spento di default nel pacchetto.
- **14.A.1** — sui giorni del nuovo split il riscaldamento è di due passaggi.
- **15.A.2** — «Gambe al muro 5 min» sta nel riscaldamento, ma il testo dice che
  chiude la giornata.
- **15.A.5** — il Pallof press dichiara di sé stesso di essere inadatto, e il
  sostituto che indica non esiste in libreria.
- **11.K.2** — gli esercizi usciti dal programma spariscono dallo Storico.
- **15.A.1** — le istruzioni al femminile sul tuo telefono.

---

## 2. Le tre risposte possibili, e come si scrivono

Ogni voce di VERIFICA.md finisce in **uno** di questi tre stati. Nessuna resta
senza risposta.

| Esito | Significa | Come lo segno |
|---|---|---|
| **CONFERMATO → CORRETTO** | riprodotto, corretto, riprovato, pubblicato, verificato sul sito | `- [x]` in VERIFICA.md + riga in `ESITO.md` con commit |
| **CONFERMATO → NON CORREGGO** | c'è, ma correggerlo è una tua decisione o rischia più del difetto | `- [x]` + riga in ESITO.md + voce in §8 |
| **NON RIPRODOTTO** | ho provato a farlo succedere e non succede | `- [x]` + riga in ESITO.md **con scritto come ho provato** |
| **SOLO SUL TELEFONO** | non è verificabile da qui, e non lo sarà | `- [x]` + riga in ESITO.md + voce in §7 |

Il quarto stato esiste per il Blocco 8 e per le poche voci sparse che hanno
bisogno del telefono in mano (il suono col silenzioso, la fotocamera, il wake
lock). Sono **chiuse per me** e **aperte per te**: senza questo stato la lista
non arriverebbe mai a zero e resterebbe eternamente «quasi finita».

### Se trovo difetti nuovi mentre verifico

Succederà: verificare una voce fa vedere cose che leggere non mostra. Le
aggiungo a VERIFICA.md nel blocco che le riguarda, con la numerazione che
prosegue, e **il totale cresce**. Non le tengo da parte per non «sporcare il
conto»: un numero che non sale è un numero che ha smesso di dire la verità.

La terza è quella pericolosa: «non riprodotto» detto male vuol dire «non ho
guardato». In ESITO.md ci va sempre **il gesto esatto** che ho fatto, non
«verificato».

### Il registro, e perché è generato a macchina

[ESITO.md](ESITO.md) è il diario: **una riga per ognuna delle 502 voci**, con
fase, gravità, stato, come ho verificato e il commit.

Non l'ho scritto a mano: l'ho **estratto da VERIFICA.md con uno script**, e le
due liste combaciano voce per voce (502 = 502, nessuna di qua che manchi di là).
È la lezione di questo stesso controllo: alla terza volta che mi hai chiesto «sei
sicuro?» il difetto era che non avevo mai fatto l'elenco. Un piano che si affida
a me per ricordarmi cosa ho chiuso ha già lo stesso buco.

Il controllo di chiusura è un comando, non un giudizio:

```bash
grep -cE '^\|.*DA FARE' ESITO.md      # adesso: 502 · alla fine: 0
```

E il controllo che le due liste non divergano mentre lavoro:

```bash
diff <(grep -oE '^- \[ \] \*\*[^*]+' VERIFICA.md | sed 's/.*\*\*//') \
     <(grep -oE '^\| [0-9*]+ \| .? \| \*\*[^*]+' ESITO.md | sed 's/.*\*\*//') | head
```

**Prima di ogni correzione scrivo la riga, non dopo.** Se la sessione si
interrompe, ESITO.md dice esattamente dove ero.

### Come è distribuito il lavoro

| Fase | Voci | Cosa |
|---|---|---|
| 0 | 5 | protezione |
| 1 | 9 | perdita o falsificazione di dati |
| 2 | 9 | si rompe mentre sei via |
| 3 | 36 | bugie sulla carta |
| 4 | 8 | la stessa domanda con due risposte |
| 5 | **429** | il resto, blocco per blocco |
| — | 6 | solo sul telefono (Blocco 8) → §7 |
| | **502** | di cui **107** marcate ⚠️ |

---

## 3. Come si verifica senza sbagliare misura

Questa è la sezione che mi salva dal lavorare per ore contro un fantasma. Sono
tutte trappole in cui sono già caduto.

### Il server di prova

- `python3 tools/serve.py 8600` (lui) e `8601` (lei), `8602`/`8603` per le prove.
- **Sempre `?nosw` nell'indirizzo.** Su localhost il service worker dell'app si
  installa davvero e serve i moduli dalla cache: senza `?nosw` provo la versione
  di ieri credendo di provare quella di adesso. **Sintomo**: `fetch()` e `curl`
  sullo stesso indirizzo tornano lunghezze diverse.
- Il pannello del browser nascosto **congela il disegno**: i timer sembrano
  fermi e `javascript_tool` va in timeout a 30 secondi. Uno screenshot dimostra
  che l'app è viva. Non è un difetto dell'app.

### Provare lo store

- **Mai** `import('/js/store.js?v=…')`: crea una **seconda istanza** senza
  programma caricato, e ogni prova finisce in «Giorno dello split non trovato».
  Per provare lo store si **ricarica la pagina**.
- `calcolaAttese` torna una **Map**: `JSON.stringify` mostra `{}`. Si legge con
  `[...m.entries()]`.
- `tettoFumoDichiarato`, `limitiFumo`, `conteggioFumo` sono **async**: senza
  `await` confronto una Promise.
- `chiudiSeduta` timbra l'ora vera: le date finte per le prove si scrivono
  **dopo** aver chiuso, mai prima.

### Guardare lo schermo

- Gli elementi `display:none` compaiono lo stesso in `querySelectorAll`: si
  filtra con `offsetParent !== null`.
- `<input type=text>` mangia gli a capo: una nota su tre righe si prova con
  `textarea`, non con un campo.
- Le classi CSS possono trasformare il testo (`text-transform: uppercase`):
  cercare «Riposo» in un `textContent` maiuscolo fallisce.
- Cercare una sottostringa («questionario») trova anche «questionari»: si
  confrontano parole intere.

### I due profili

Parecchie voci dicono «da verificare su tutti e due i profili»: Fumo e Acqua
accese o spente, i punti dolenti, l'altezza, le soglie, la soglia vita/fianchi
maschile (**11.AF.2**), le istruzioni al femminile (**15.A.1**).

Quei profili si distinguono **per il brief**, e i brief stanno in `_privato/`.
Quindi da qui posso fare due cose e non la terza:

1. provare con un brief **finto** che accende o spegne una voce
   (`contaAcqua: true`, `contaSigarette: false`, `dolori: [...]`): serve a
   verificare che il **meccanismo** funzioni;
2. leggere nel codice cosa cambia;
3. ~~verificare che il brief **vero** di lei sia scritto bene~~ — questo no.

Le voci del terzo tipo vanno in §7, non in §8: non sono decisioni, sono cose che
solo tu puoi guardare.

### Regola generale

**Ogni volta che un'asserzione mia fallisce, il primo sospettato sono io.**
Prima di scrivere «difetto confermato» controllo: il nome del campo esiste
davvero? è async? è una Map? l'elemento è visibile? Nel controllo precedente la
maggioranza dei «guasti» erano miei errori di misura, non dell'app.

---

## 4. Come si corregge

Un difetto alla volta. Mai due insieme, perché se qualcosa si rompe non so quale
dei due è stato.

```
1. scrivo la riga in ESITO.md                      (prima, non dopo)
2. riproduco il difetto e lo faccio vedere         (screenshot o valore)
3. correggo — la modifica più piccola che lo chiude
4. riproduco di nuovo: adesso non succede
5. controllo che non abbia rotto il contorno       (§4.1)
6. spunto la voce in VERIFICA.md
```

### Quando pubblico

Non a ogni correzione. **Ogni pubblicazione è un aggiornamento sul tuo telefono
mentre sei via**, e ognuna è un'occasione di romperti l'app in un posto dove non
puoi diagnosticare niente. Quindi:

- **Fase 1 e Fase 2 → pubblico subito, una correzione per volta.** Sono i
  difetti che perdono dati o che ti si rompono in vacanza: il rischio di
  lasciarli lì è più alto del rischio di pubblicare.
- **Fase 3 in poi → pubblico a fine fase**, con il controllo del contorno fatto
  su tutte le correzioni insieme prima di mandare.
- **Mai una pubblicazione con una correzione che non ho riprovato.**

Dopo ogni pubblicazione, sempre: confronto byte per byte (§4.2).

### 4.1 Il contorno da ricontrollare dopo ogni correzione

Non basta che il difetto sia sparito: quello che gli sta intorno deve essere
rimasto identico. Dopo **ogni** correzione:

- l'app si apre (nessuno schermo bianco) su Home, Oggi, Salute, Corpo, Storico;
- si apre e si chiude una seduta di prova senza errori in console;
- il pacchetto per il coach si compone;
- **console pulita**: zero errori non gestiti.

Se la correzione tocca punteggio, motore o pacchetto, in più: **la prova degli
invarianti** (§4.4).

### 4.4 La prova degli invarianti — meccanica, non a occhio

È la regola che conta più di tutte: *un punteggio congelato non cambia mai*. Ma
finora nel piano era una buona intenzione («controllo che sia identico»), e le
buone intenzioni sono esattamente quello che ho passato sei giri a smontare.

Quindi diventa una misura. In Fase 0, sul profilo di prova, costruisco **una
base di riferimento**:

- cinque sedute chiuse, diverse fra loro: una piena, una con un esercizio
  saltato, una interrotta, una con un blocco accoppiato, una con il cardio
  rimandato e mai fatto;
- per ognuna registro in un file: `id · data · completezza.totale · le quote
  voce per voce · previsti/svolti`;
- più l'impronta (`shasum`) del **pacchetto per il coach** generato da ognuna.

Dopo **ogni** correzione che tocca `punteggio.js`, `store.js`, `segnali.js`,
`export.js` o `seduta.js`, rigenero le stesse cose e confronto:

```
totali identici · quote identiche · impronte del pacchetto identiche
```

Una sola differenza non prevista = **la correzione si annulla**, non si discute.
Se la differenza è quella che volevo (ho corretto proprio il pacchetto), la
scrivo in ESITO.md riga per riga: *cosa* è cambiato e *perché doveva*.

Questa base va rifatta anche alla fine, prima della consegna: è l'unica prova
che dopo 500 controlli il punteggio di una seduta di luglio è ancora quello di
luglio.

### 4.2 Verifica del pubblicato

Non mi fido del fatto che il push sia andato: lo dimostro.

```bash
BASE="https://p54cm9p5s5-lgtm.github.io/coach"
for f in $(git ls-files | grep -vE '^(VERIFICA|PIANO|ESITO|\.claude/)'); do
  L=$(shasum -a 256 "$f" | cut -d' ' -f1)
  R=$(curl -s "$BASE/$f?x=$(date +%s)" | shasum -a 256 | cut -d' ' -f1)
  [ "$L" != "$R" ] && echo "DIVERSO: $f"
done
```

Zero righe = pubblicato davvero. GitHub Pages può ritardare di 2-3 minuti, e a
volte risponde «Internal Server Error» al push: si rilancia, non si aggira.

### 4.3 Quando NON correggo

Mi fermo e metto in §8 se:

- la correzione richiederebbe di **migrare dati** già in archivio;
- cambierebbe un **punteggio già congelato**;
- è una **scelta di contenuto**: *quale* esercizio, *quanto* dura una dose,
  *dove* va un passaggio. La riga di confine è netta e la scrivo qui perché non
  me la possa raccontare dopo:
  - **mia**: come è scritta una cosa già decisa — «Cat-cow · 10» che diventa
    «10 ripetizioni», «Sdraiata» che diventa neutro, `nonConfermata` che diventa
    «non confermata». Non cambia niente di quello che fai, cambia quello che
    leggi;
  - **tua**: cosa viene prescritto — spostare «Gambe al muro» dal riscaldamento
    al defaticamento, togliere il Pallof press, cambiare una dose da 20s a 30s.
    Quelle vanno in §8 anche se sono di una riga;
- non riesco a riprodurre il difetto **e** correggerlo alla cieca cambierebbe
  comportamento;
- tocca `_privato/` o il tetto fumo.

---

## 5. Ordine di esecuzione

L'ordine non è quello di VERIFICA.md: è per **danno**. Prima quello che perde
dati, poi quello che si rompe mentre sei via, poi quello che dice il falso, poi
il resto.

### Fase 0 — Protezione (prima di toccare qualunque cosa)

Blocco 0 di VERIFICA.md, 5 voci.

1. **tag di ritorno** sul commit attuale:
   `git tag prima-del-controllo a582344`. Da lì si torna con
   `git reset --hard prima-del-controllo && bash tools/pubblica.sh "ritorno"`.
   È l'unica rete che funziona anche se ho capito tutto storto.
2. `bash tools/pubblica.sh --controlla` deve passare **prima** che io cambi
   qualcosa: se i controlli sono già rotti, non me ne accorgerei dopo.
   **Se non passa, mi fermo qui**: non tocco una riga di codice finché la rete
   che impedisce ai tuoi dati di finire online non funziona. Non è una fase
   preliminare da spicciare, è la condizione per avere il diritto di pubblicare;
3. verifico che i 6 controlli di pubblicazione facciano davvero quello che
   dicono, mettendo un file finto fuori lista e togliendolo;
4. decido cosa fare di `VERIFICA.md`, `PIANO.md` e `ESITO.md`: la lista bianca
   accetta ogni `.md` maiuscolo, quindi **finiranno online**. Non contengono
   dati personali (li ho scritti io, riga per riga). Li lascio, e lo scrivo qui
   perché sia una decisione e non una sorpresa.
5. **La fotografia di partenza**, senza la quale non so distinguere quello che
   rompo io da quello che era già rotto:
   - apro tutte e dodici le schermate e **registro gli errori di console che ci
     sono già** (`errori-di-partenza.txt` in `_privato/`, non nel repository);
   - genero il **brief di prova** — uno split finto, con un giorno del vecchio
     tipo e uno del nuovo, un blocco accoppiato, un esercizio a tempo, l'acqua
     accesa e due punti dolenti — perché senza un programma caricato metà delle
     prove della Fase 6 non si possono nemmeno cominciare. Sta in `_privato/`,
     non entra nel repository, e **non ha niente a che vedere con i tuoi**;
   - salvo il **pacchetto per il coach di adesso**, come pietra di paragone: dopo
     ogni correzione al punteggio o all'export, il nuovo deve differire solo per
     la riga che ho toccato.

### Fase 0 — quello che ho scoperto provandola davvero

Il piano l'ho scritto prima di eseguirlo. Poi ho eseguito i primi tre passaggi,
e tre cose sono venute fuori diverse da come le avevo immaginate.

**a) I controlli di pubblicazione passano.** `pubblica.sh --controlla` risponde
«18 parole vietate controllate, lista bianca pulita, tutti i file dell'app
elencati in sw.js, controlli superati», e lo staging torna com'era. La
condizione del punto 2 è soddisfatta: ho il diritto di pubblicare.

**b) La console di partenza è pulita.** Zero errori sulla Home. Quindi da qui in
avanti **qualunque errore in console è mio**, e non devo perdere tempo a
chiedermi se c'era già.

**c) L'archivio di prova è quasi vuoto, e questo cambia la Fase 0.** Guardato
dentro: **2 sedute, di cui 1 chiusa** (punteggio 8, senza nemmeno un
questionario), 3 serie, 0 questionari, 0 foto, 2 misure, 1 sigaretta, 30 giorni
di salute, 36 allenamenti del Watch. Un programma c'è, l'acqua è spenta.

Vuol dire due cose:

- la base di riferimento degli invarianti (§4.4) **non si può ricavare da quello
  che c'è**: le cinque sedute vanno costruite guidando l'app schermata per
  schermata. È lavoro vero, va messo in conto in Fase 0 e non dato per scontato;
- **prima di toccare qualunque cosa esporto un backup del profilo di prova**, e
  ne esporto un secondo appena la base di riferimento è pronta. Senza, la prova
  «backup → svuota → ripristino» della Fase 6 si porta via anche la base con cui
  dovrei accorgermi di aver rotto qualcosa. Era il buco più stupido possibile:
  la rete di sicurezza che si distrugge da sola nella prova che la sta provando.

**d) Un secondo profilo con l'acqua accesa.** Su 8600 `contaAcqua` è falso e la
scheda è nascosta: per provare la sezione Acqua serve un brief di prova diverso
su 8601. Due profili, due brief finti, tutti e due fuori dal repository.

### Fase 1 — I difetti che perdono o falsano dati (irreversibili)

Sono otto. Vengono prima di tutto perché il danno che fanno non si disfa.

| Voce | Difetto |
|---|---|
| **13.1 + 11.P.1** | lo strumento sul Mac scrive 4 campi invece di 12, e reimportare **svuota** distanza, battito, sforzo, indoor |
| **11.AF.1** | saltare un esercizio già valutato ne **cancella** RPE, tecnica e dolori |
| **11.U.2** | «Fai il cardio» scrive il progresso su una fotografia vecchia |
| **11.S.13** | i −/+ delle ripetizioni scrivono fuori dalla coda: due tocchi rapidi possono invertirsi |
| **11.B.1** | numero rifiutato che a schermo sembra giusto: «Salva» rifiuta e non c'è niente da correggere |
| **11.B.2** | il selettore foto annullato per sbaglio interrompe **tutto** il set |
| **11.B.3** | set foto eliminato a metà senza dirlo |
| **11.T.1** | «Torna agli esercizi» a fine seduta riporta al primo, già chiuso |

### Fase 2 — Quello che si rompe mentre sei via

Sette voci, tutte legate ai dieci giorni.

| Voce | Difetto |
|---|---|
| **11.G.1** | `?nosw` cancella la copia offline: da chiudere o almeno da rendere innocuo sul sito pubblicato |
| **11.P.3** | l'agenda scade: verifico fin dove arriva la copertura e cosa mostra la Home quando finisce |
| **11.O.4** | dieci giorni senza import rompono la finestra delle tre settimane |
| **11.P.4** | l'importazione non è una transazione |
| **11.N.1** | «Cancella i dati importati da Salute» butta anche gli allenamenti del Watch, e oltre 30 giorni non tornano |
| **11.I.3 / 11.U.6** | backup e import arretrati accesi tutti i giorni |
| **11.G.2 / 11.Q.3** | schermo bianco all'avvio e primo avvio senza rete |

### Fase 3 — Le bugie sulla carta

Costano poco e le legge il coach. Blocchi 12.A, 12.B, 12.C, 11.AD, 11.J.1,
11.W.3, 14.C, 12.D — 33 voci.

Si comincia da **12.A.1 e 12.A.2**: README e SPEC dichiarano ancora che l'app
scarica la copertina da YouTube da sola. È la promessa più importante che l'app
fa, ed è scritta al contrario in due posti pubblici.

### Fase 4 — «La stessa domanda con due risposte»

È la classe che ha prodotto più difetti in tutti i controlli. Sette voci:

- **11.Q.1** `varianteDi` (ordine del brief) contro `varianti` (ordine di validità)
- **11.S.11** «bersaglio» = fondo del range in due punti, tetto in un terzo
- **11.W.1** due densità diverse per la stessa seduta
- **11.O.5** stretching previsto non congelato mentre il resto lo è
- **11.O.2** il punteggio Salute dei giorni passati si ricalcola sullo split di oggi
- **11.W.2 / 11.F.5** «nuovo minimo» scritto su ogni giorno sotto soglia
- **11.K.3** `nonConfermata` scritto in linguaggio da codice

### Fase 5 — Il resto, blocco per blocco

Tutte le voci non ancora toccate, nell'ordine dei blocchi di VERIFICA.md:

`A` · `B` · `1` · `1-bis` · `2` · `3` · `4` · `5` · `6` · `7` · `8-bis` · `9` ·
`10` · `11.A` → `11.AF` (32 sezioni) · quello che resta di `12` e `13` ·
`14.A` · `14.B` · `14.C` · `15.A` · `15.B`.

Il **Blocco 8** non entra qui: le sue 6 voci sono «SOLO SUL TELEFONO» e vanno
in §7 senza passare da me.

Regola: **non passo al blocco successivo finché nel precedente non è rimasta
nessuna voce senza esito.**

**Cosa sono davvero queste 429 voci.** Non sono 429 difetti: la maggioranza dice
«da provare che…», ed è lavoro di verifica, non di correzione. Mi aspetto che
finiscano più o meno così — ed è una previsione, non una promessa:

| | |
|---|---|
| difetti veri da correggere | quelli marcati ⚠️ non già nelle Fasi 1-4 |
| verifiche che passano | la maggior parte, e chiuse come **NON RIPRODOTTO** con scritto **il gesto esatto** che ho fatto |
| decisioni tue | vanno in §8, non le chiudo io |

Il rischio di questa fase non è sbagliare una correzione: è **spuntare per
stanchezza**. Una riga «NON RIPRODOTTO» senza il gesto scritto accanto vale
zero, e a fine giornata è la cosa più facile del mondo da scrivere. Per questo
in ESITO.md la colonna «come» non può restare vuota: una riga senza quella
colonna piena conta come DA FARE, anche se lo stato dice altro.

### Fase 6 — Le prove a schermo

Quello che si vede solo facendolo, col browser sul server di prova:

1. una seduta intera dall'inizio alla fine, su un giorno del **nuovo** split;
2. la stessa cosa su un giorno **vecchio** (riscaldamento pieno);
3. un giorno di sola mobilità (sabato/domenica);
4. pesi → «Rimanda il cardio» → stretching → Home → «Fai il cardio» → chiusura;
5. un blocco di due esercizi accoppiati, se il brief ne ha;
6. un esercizio a tempo (plank) con il cronometro, mollando prima e tenendo oltre;
7. importazione di un pacchetto Salute finto, con giorni sospetti e valori
   impossibili;
8. backup → svuota → ripristino → confronto byte per byte;
9. tutti e tre i temi su ogni schermata, cercando testo illeggibile;
10. i quattro periodi (1 gg / 7 / 30 / sempre) su ogni grafico.

### Fase 7 — Chiusura

- nessuna voce di VERIFICA.md senza esito;
- ultimo `pubblica.sh`, ultimo confronto byte per byte;
- `ESITO.md` completo;
- §8 consegnata a te, con le raccomandazioni;
- un riassunto onesto: quante corrette, quante non riprodotte, quante lasciate.

---

## 6. Se qualcosa va storto

**Un difetto introdotto da me vale più di dieci corretti.** Le reti:

1. il tag di ritorno della Fase 0: `git reset --hard <tag>` e ripubblico;
2. dopo ogni pubblicazione, il confronto byte per byte (§4.2);
3. il controllo del contorno (§4.1) dopo **ogni** correzione, non alla fine;
4. se una correzione richiede più di due tentativi, la annullo e la metto in §8:
   vuol dire che non ho capito il difetto.

**Se rompo qualcosa e me ne accorgo dopo aver pubblicato**: torno indietro
subito, pubblico la versione buona, e solo dopo capisco cosa è successo. Prima
si rimette in piedi, poi si indaga.

**Se la sessione si interrompe**: `ESITO.md` dice dove ero. Riprendo dalla prima
voce senza esito, nell'ordine di questo piano.

---

## 7. Cosa non posso fare da qui, e resta a te

Non sono dimenticanze: sono confini.

- **`_privato/`** — i due master brief. Decine di voci dicono «da verificare
  contro il brief»: lo split in vigore, le soglie, l'altezza, l'inventario, i
  punti dolenti, `contaAcqua`, `contaSigarette`. È il controllo che rende di più
  fra quelli rimasti, e può farlo solo tu.
- **Il telefono** — Blocco 8: il suono del timer col silenzioso, il wake lock,
  la fotocamera guidata, la riga «Archivio protetto», l'installazione dalla Home,
  e un allenamento vero fatto davvero.

---

## 8. Lista per te (cresce mentre lavoro)

Qui finiscono: le decisioni che non prendo io, i difetti che ho scelto di non
correggere e perché, e le cose che solo tu puoi verificare. **Vuota adesso a
parte le sette voci di §1.** La leggo con te quando ho finito, non prima.

---

## 9. Numeri, per sapere quando ho finito

| | |
|---|---|
| Voci da chiudere | **502** |
| Sezioni | 57 |
| di cui marcate ⚠️ (danno reale) | ~90 |
| File da cui vengono | 47 pubblicati + 4 documenti |
| Commit di partenza | `a582344` |
| Versione di partenza | `20260813-180916` |

Ho finito quando **ogni voce ha uno dei quattro esiti** e ESITO.md ha una riga
per ognuna. Non prima, e non «quando le cose importanti sono a posto»: quella
frase è il modo in cui si lascia indietro proprio la voce che poi si rompe.

Il numero 502 salirà: le verifiche fanno vedere cose che le letture non
mostrano. Quello che conta è che alla fine **non resti nessuna voce senza
risposta**, non che il totale sia rimasto quello di adesso.

### Quanto ci vuole

Non lo so, e dirti un numero sarebbe inventarlo. Quello che posso dire è come
lavoro: in ordine di danno, e con le Fasi 1 e 2 — i quindici difetti che
perdono dati o che ti si rompono in vacanza — **per prime e pubblicate subito**.
Se dovessi fermarmi a metà, quello che conta di più sarebbe già a posto.
