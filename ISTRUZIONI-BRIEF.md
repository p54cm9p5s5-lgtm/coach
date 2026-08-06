# Come scrivere un master brief che l'app Coach sa leggere

Questo documento è per **l'assistente che gestisce il programma di allenamento**.
Serve a produrre un file `master-brief.md` che l'app Coach carica senza errori.

L'app è una web-app che si installa sul telefono. Tiene tutti i dati **solo su
quel telefono**: nessun account, nessun server, nessuna sincronizzazione. Il
programma non lo decide l'app: lo legge da un blocco tecnico scritto in coda al
master brief. Tutto il resto del documento — il testo discorsivo, le
spiegazioni, le note — l'app lo ignora.

---

## 1. La regola d'oro

In fondo al master brief va **un blocco delimitato**, con dentro **solo JSON**:

```
<!-- COACH-DATA v1 -->
{ ...il JSON... }
<!-- /COACH-DATA -->
```

Se il brief viaggia dentro una chat, i commenti HTML **spariscono alla vista** e
chi copia si porta via un file senza marcatori. Per questo l'app accetta anche
la forma nuda, che nessuna chat nasconde:

```
COACH-DATA v1
{ ...il JSON... }
/COACH-DATA
```

Le due righe devono contenere **soltanto** quelle parole, senza altro testo
sulla stessa riga. Il JSON può stare dentro un riquadro di codice ```` ```json ````:
l'app lo toglie da sola.

**Consegna il file `.md` come allegato**, non incollato nel corpo del messaggio.

---

## 2. Lo scheletro del blocco

```json
{
  "versione": 1,
  "aggiornatoIl": "2026-08-10",
  "atleta": { "nome": "Nome" },
  "split": [ ... ],
  "inventario": { ... },
  "regole": { ... }
}
```

Solo `split` è obbligatorio. `inventario` serve a calcolare i dischi da montare,
`regole` a spostare le soglie: senza, l'app usa i suoi valori.

---

## 3. `split` — i giorni di allenamento

```json
"split": [
  {
    "id": "petto-tricipiti",
    "nome": "Petto e tricipiti",
    "giorno": 1,
    "cardio": true,
    "esercizi": [
      { "esercizioId": "panca-piana", "serie": 3, "ripMin": 8, "ripMax": 10, "carico": 30 },
      { "esercizioId": "croci-inclinata", "serie": 2, "ripMin": 12, "ripMax": 15, "carico": 6 }
    ]
  }
]
```

**Regole che l'app verifica e che, se violate, fanno rifiutare il brief:**

| Campo | Regola |
|---|---|
| `id` | obbligatorio, minuscolo con trattini (`gambe-core`) |
| `nome` | obbligatorio, come lo dice l'atleta |
| `giorno` | numero **0-6**, dove **0 = domenica**, 1 = lunedì … 6 = sabato |
| `cardio` | `true` se quel giorno prevede cardio dopo i pesi; si può omettere |
| `esercizi[].esercizioId` | **deve esistere nella libreria dell'app** (elenco al punto 5) |
| `esercizi[].serie` | numero maggiore di 0 |
| `esercizi[].ripMin` / `ripMax` | `ripMin > 0` e `ripMax >= ripMin` |
| `esercizi[].carico` | kg totali di partenza, bilanciere compreso; si omette a corpo libero |

**Non ripetere lo stesso esercizio due volte nello stesso giorno**: l'app lo
rifiuta, perché punteggio e progressioni ragionano per esercizio.

**Range aperti, non chiusi.** Scrivere `"ripMin": 10, "ripMax": 10` blocca la
progressione: l'app non ha più margine per proporre una ripetizione in più prima
di salire di carico. Usa sempre una forbice (8-10, 12-15).

**Esercizi a tempo** (plank e simili): niente ripetizioni, ci vuole la durata.

```json
{ "esercizioId": "plank", "serie": 3, "aTempo": true, "durataSec": 45 }
```

---

## 4. `inventario` — l'attrezzatura vera

```json
"inventario": {
  "barra": 10,
  "dischi": { "20": 2, "5": 4, "2.5": 4, "2": 4, "1": 8 },
  "manubri": {
    "regolabili": { "scaricoKg": 2, "quantita": 2 },
    "fissi": [10, 12]
  }
}
```

- `barra`: peso del bilanciere scarico, in kg.
- `dischi`: peso → **quantità totale posseduta**, non per lato. **Le quantità
  devono essere pari**: un disco spaiato non si monta, e l'app rifiuta il brief.
- `manubri.regolabili.scaricoKg`: quanto pesa un manubrio vuoto.
  `quantita`: quanti manubri regolabili ci sono (di solito 2).
- `manubri.fissi`: elenco dei manubri a peso fisso, uno per manubrio.
- I manubri regolabili usano **gli stessi dischi** del bilanciere: non è un
  secondo magazzino.

Da qui l'app calcola i carichi davvero montabili, e muove il selettore del peso
e le proposte di progressione solo su quelli.

Chi si allena in palestra con macchine e manubri fissi può scrivere solo
`"manubri": { "fissi": [...] }` e omettere barra e dischi.

---

## 5. Gli esercizi che l'app conosce già

Usa questi identificatori quando l'esercizio corrisponde. Sono gli unici
accettati: **un `esercizioId` che non è in questo elenco fa rifiutare il brief.**

| id | nome | attrezzo |
|---|---|---|
| `panca-piana` | Panca piana bilanciere | bilanciere |
| `panca-inclinata-manubri` | Panca inclinata manubri | manubri |
| `croci-inclinata` | Croci su panca inclinata | manubri |
| `estensioni-tricipiti` | Estensione tricipiti sopra la testa | manubrio |
| `squat` | Squat con bilanciere | bilanciere |
| `affondi` | Affondi | corpo libero |
| `rdl` | Stacco rumeno (RDL) | bilanciere |
| `ponte-glutei` | Ponte per glutei | corpo libero |
| `calf` | Calf raise (polpacci) | manubri |
| `crunch` | Crunch | corpo libero |
| `plank` | Plank | corpo libero |
| `leg-raise` | Leg raise | corpo libero |
| `military-press` | Military press | bilanciere |
| `alzate-laterali` | Alzate laterali | manubri |
| `alzate-posteriori` | Alzate posteriori | manubri |
| `scrollate` | Scrollate (shrug) | manubri |
| `rematore-bilanciere` | Rematore con bilanciere | bilanciere |
| `rematore-manubrio` | Rematore con manubrio | manubrio |
| `pullover` | Pullover con manubrio | manubrio |
| `curl-bilanciere` | Curl con bilanciere | bilanciere |
| `curl-alternato` | Curl alternato con manubri | manubri |
| `hammer` | Hammer curl | manubri |
| `flessioni` | Flessioni a terra | corpo libero |
| `ponte-glutei-piedi-rialzati` | Ponte per glutei con piedi sulla panca | manubrio |
| `military-press-manubri` | Military press con manubri | manubri |
| `dead-bug` | Dead bug | corpo libero |
| `rematore-bilanciere-presa-inversa` | Rematore bilanciere presa inversa | bilanciere |
| `box-squat` | Box squat con bilanciere | bilanciere |
| `split-squat-appoggiato` | Split squat con appoggio leggero | manubri |
| `abduzioni-decubito-laterale` | Abduzioni d'anca in decubito laterale | corpo libero |
| `rdl-manubri` | Stacco rumeno con manubri | manubri |
| `donkey-kick` | Donkey kick con appoggio sulla panca | corpo libero |
| `rematore-bilanciere-presa-larga` | Rematore bilanciere presa larga | bilanciere |
| `step-up` | Step-up sulla panca | corpo libero |
| `pallof-press-manubrio` | Pallof press con manubrio | manubrio |
| `pilates` | Sessione di Pilates | corpo libero |
| `camminata` | Camminata | corpo libero |
| `calf-manubrio` | Calf raise con un manubrio | manubrio |

### Se il programma ha esercizi che non ci sono

Non cambiare il programma per adattarlo alla lista. **Scrivilo com'è**, con un
identificatore nuovo in minuscolo con trattini (`leg-press`, `lat-machine`,
`hip-thrust`), e **allega in fondo al brief, fuori dal blocco COACH-DATA**, una
scheda per ciascun esercizio nuovo con esattamente questi dati:

- **id** e **nome** completo
- **attrezzo**: uno fra `bilanciere`, `manubri` (due, uno per mano), `manubrio`
  (uno solo), `corpo libero`, `macchina`
- **pattern**: a quale gruppo appartiene (spinta, tirataOrizzontale,
  quadricipiti, femorali, polpacci, core, bicipiti, tricipiti,
  deltoideLaterale, deltoidePosteriore, trapezi, dorsaliAltro)
- **recupero consigliato** in secondi
- **sollecita il polso?** sì/no (serve a una domanda di sicurezza)
- **setup**: 3-4 righe, come ci si mette in posizione
- **esecuzione**: 3-4 righe, il movimento passo per passo
- **errori comuni**: 3-4 righe, cosa va storto e cosa provoca
- **cue**: una frase sola da ripetersi durante la serie
- **sicurezza**: una riga, se c'è un rischio specifico
- **video**: titolo e canale YouTube di un tutorial affidabile, se lo conosci

Chi cura l'app le trasformerà in schede complete. Finché non sono aggiunte,
quel brief non si carica: mandale insieme al brief, non dopo.

---

## 6. Riscaldamento e stretching

L'app ha protocolli di riscaldamento e stretching **legati all'`id` del giorno**.
Oggi esistono per: `petto-tricipiti`, `gambe-core`, `spalle`,
`schiena-bicipiti`, `full-body`.

- Se lo split usa **questi stessi id**, riscaldamento e stretching compaiono già.
- Se usa id diversi, quelle schermate restano vuote finché non vengono scritti i
  protocolli. In quel caso **allega anche**, per ogni giorno: 5-7 passaggi di
  mobilità (nome, dose, come si fa) e 2-4 allungamenti finali.

Le dosi a tempo vengono riconosciute e l'app ci mette un cronometro:
`30 s per lato`, `3 × 15 s per lato`, `5 min`, `45s`, `1 minuto`, `1,5 min`.
Le dosi a ripetizioni (`10 per lato`, `15 ripetizioni`) restano senza cronometro.

---

## 7. `regole` — le soglie, se servono

Tutto facoltativo: si scrive solo quello che si vuole spostare, il resto resta
com'è. Le voci più usate:

```json
"regole": {
  "rpeTarget": { "min": 6, "max": 8 },
  "cardio": { "kmhMin": 4.5, "kmhMax": 5, "fcMin": 105, "fcMax": 115, "fcLimite": 125, "durataMin": 30 },
  "progressione": { "esposizioniMinime": 2, "rpePerSalire": 7, "tecnicaMinima": 8, "tecnicaRiduzione": 5 },
  "salute": {
    "sonnoOreBersaglio": 8,
    "movimentoBersaglio": 1000,
    "passiBersaglio": 10000,
    "minutiEsercizioBersaglio": 60,
    "minutiInPiediBersaglio": 180,
    "sigaretteTollerate": 10
  },
  "cadenze": { "misureGiornoSettimana": 4, "fotoGiornoSettimana": 3, "fotoOgniSettimane": 2 }
}
```

`misureGiornoSettimana` e `fotoGiornoSettimana` usano la stessa numerazione dei
giorni: 0 = domenica.

**Se l'atleta non fuma**, scrivi `"contaSigarette": false` dentro `salute`: la
sezione Fumo sparisce dal menu dell'app e la voce esce dal punteggio, invece di
restare lì a valere sempre zero.

**Un'attività che non ha un bersaglio** — una sessione di Pilates, una
camminata, una seduta di mobilità — si scrive con `"serie": 1, "ripMin": 1,
"ripMax": 1`: l'app la mostra come una voce da spuntare a fine sessione, senza
cronometro e senza obiettivo. Se invece la durata conta davvero, usa `aTempo` e
`durataSec` e avrai il conto alla rovescia.

---

## 8. Esempio completo e valido

````markdown
# Master brief — Nome Atleta

...tutto il testo discorsivo del programma, che l'app ignora...

<!-- COACH-DATA v1 -->
```json
{
  "versione": 1,
  "aggiornatoIl": "2026-08-10",
  "atleta": { "nome": "Nome" },
  "inventario": {
    "barra": 10,
    "dischi": { "10": 2, "5": 4, "2.5": 4, "1.25": 4 },
    "manubri": { "regolabili": { "scaricoKg": 2, "quantita": 2 }, "fissi": [] }
  },
  "regole": {
    "rpeTarget": { "min": 6, "max": 8 },
    "salute": { "sonnoOreBersaglio": 8, "passiBersaglio": 8000 }
  },
  "split": [
    {
      "id": "gambe-core",
      "nome": "Gambe e core",
      "giorno": 1,
      "esercizi": [
        { "esercizioId": "squat", "serie": 3, "ripMin": 8, "ripMax": 10, "carico": 20 },
        { "esercizioId": "ponte-glutei", "serie": 3, "ripMin": 12, "ripMax": 15 },
        { "esercizioId": "plank", "serie": 3, "aTempo": true, "durataSec": 45 }
      ]
    },
    {
      "id": "schiena-bicipiti",
      "nome": "Schiena e bicipiti",
      "giorno": 4,
      "cardio": true,
      "esercizi": [
        { "esercizioId": "rematore-bilanciere", "serie": 3, "ripMin": 8, "ripMax": 10, "carico": 15 },
        { "esercizioId": "curl-alternato", "serie": 3, "ripMin": 10, "ripMax": 12, "carico": 6 }
      ]
    }
  ]
}
```
<!-- /COACH-DATA -->
````

---

## 9. Errori che l'app segnala, e cosa vogliono dire

| Messaggio | Causa |
|---|---|
| «Nel file non c'è il blocco COACH-DATA» | mancano le righe di apertura e chiusura |
| «la scritta c'è ma non nella forma che apre il blocco» | i marcatori sono stati mangiati dalla chat: manda il file allegato |
| «aperto ma non chiuso» | manca la riga di chiusura |
| «non è JSON valido» | virgola di troppo, virgolette storte, parentesi non chiusa |
| «Esercizio sconosciuto: "x"» | quell'`esercizioId` non è nella libreria (punto 5) |
| «Serie non valide» | `serie` mancante o non maggiore di 0 |
| «Range ripetizioni non valido» | manca `ripMin`/`ripMax`, oppure `ripMax < ripMin` |
| «Durata non valida» | esercizio `aTempo` senza `durataSec` |
| «compare due volte» | stesso esercizio ripetuto nello stesso giorno |
| «Giorno della settimana non valido» | `giorno` fuori da 0-6 |
| «Disco X in numero dispari» | quantità dispari nell'inventario |
| «Peso della barra non valido» | manca `barra` mentre c'è l'inventario |

Ricaricare lo stesso brief non cancella niente: allenamenti, misure, foto e note
già registrate restano dove sono. Cambia solo il programma.
