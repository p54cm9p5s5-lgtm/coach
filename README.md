# Coach

App personale di allenamento. PWA, nessun build step, nessun server, nessuna dipendenza.
I dati restano sul dispositivo (IndexedDB): nessun account, nessun server, niente
che venga inviato. Le uniche richieste che escono sono verso YouTube, e sono due:
il player (`youtube-nocookie.com`) e la miniatura del video (`i.ytimg.com`).
Partono **quando la scheda dell'esercizio compare a schermo**, non al tocco: il
player è già montato, così parte subito quando lo tocchi, e la miniatura serve il
giorno in cui la rete non c'è. Il prezzo, detto chiaro: YouTube vede il tuo
indirizzo e quale esercizio stai guardando. Nient'altro esce dal telefono, e
`tools/rete.js` controlla a ogni collaudo che i domini contattati restino questi.

Specifica funzionale: [SPEC.md](SPEC.md).

## Struttura

```
index.html            shell dell'app
manifest.webmanifest  installazione sulla schermata Home
sw.js                 service worker (offline + aggiornamenti)
css/app.css           stile iOS nativo, chiaro/scuro automatico
js/app.js             avvio e routing
js/ui.js              mattoni comuni: DOM, fogli, suoni, date
js/db.js              IndexedDB e backup
js/store.js           logica di dominio
js/brief.js           lettura del blocco COACH-DATA dal master brief
js/plates.js          calcolo dei dischi da montare
js/salute.js          formato e lettura del pacchetto dati Salute
js/segnali.js         motore deterministico di segnali e proposte
js/punteggio.js       i tre punteggi e il loro disegno
js/export.js          il pacchetto di testo per il coach
js/grafico.js         grafici in SVG, senza librerie
js/calendario.js      calendario mensile e cose attese
js/screens/*.js       una schermata per file
data/esercizi.json    libreria esercizi (contenuto generico)
data/riscaldamento.json  protocolli di riscaldamento e stretching per giorno
tools/icona.py        ritaglia e riquadra l'icona sorgente
tools/icona-da-immagine.sh  genera le tre misure delle icone
tools/serve.py        server di sviluppo senza cache
tools/pubblica.sh     pubblica su GitHub Pages, con i controlli anti-fuga dati
tools/passa-file.py   passa i file personali al telefono sulla Wi-Fi di casa
tools/salute-da-export.py  dall'export di Salute al pacchetto, senza Comandi Rapidi
```

## Sviluppo

```bash
python3 tools/serve.py 8787
```

Poi `http://127.0.0.1:8787/index.html`. In sviluppo aggiungere `?nosw` per disattivare
il service worker, altrimenti le modifiche restano nascoste dalla cache.

Rigenerare icone e file personali:

```bash
tools/icona-da-immagine.sh ~/Downloads/icona-coach-originale.png
python3 _privato/seed.py   # solo in locale: genera i file personali
```

## Pubblicazione

GitHub Pages su repository pubblico. Nel repository **non entra alcun dato personale**:
programma e storico arrivano sul telefono importando i file generati in `_privato/`,
che è escluso da git.

`tools/pubblica.sh` mette in staging tutto (`git add -A`) e poi verifica quattro cose
prima di lasciar passare: niente file di `_privato/`, niente backup o brief, nessuna
immagine incorporata, nessuna delle parole dell'elenco personale — e una **lista
bianca**: passa solo quello di cui l'app è fatta (`index.html`, `sw.js`, il manifest,
`robots.txt`, `.nojekyll`, `.gitignore`, i `.md` in radice, e le cartelle `css/`,
`js/`, `data/`, `icons/`, `tools/`). Qualunque altro file ferma la pubblicazione e
viene stampato per nome: i primi quattro controlli sanno solo riconoscere il male che
qualcuno ha già immaginato, la lista bianca ferma anche quello che non abbiamo previsto.
Se serve pubblicare qualcosa di nuovo si aggiunge una riga alla lista, come decisione
presa una volta.

**L'elenco delle parole vietate sta in `_privato/parole-vietate.txt`**, perché le parole
stesse sono dati personali. Senza quel file lo script si rifiuta di pubblicare: è voluto,
ma vuol dire che da un computer che non ha `_privato/` non si pubblica finché non lo si
rimette. Non esiste una scorciatoia per saltare il controllo, ed è giusto così.

Un cambio di `VERSION` in `sw.js` pubblica un aggiornamento: la versione nuova prende
il comando e l'app si ricarica **da sola**, senza chiedere niente — tranne mentre sei
dentro un allenamento, dove l'aggiornamento resta in attesa e entra appena esci, per
non perdere schermata, cronometro e audio sbloccato. I dati salvati non vengono mai
toccati dagli aggiornamenti.

## Stato

L'app è completa e in uso su due telefoni, con dati separati: programma, Modalità
Seduta guidata passo per passo, blocchi di esercizi incatenati, storico e volumi,
misure e foto, ponte con l'app Salute e col calendario, conteggio delle sigarette
o dell'acqua, segnali e proposte di progressione con registro decisioni, pacchetto
di testo per la chat col coach e caricamento del master brief.

Quello che cambia da una persona all'altra lo dichiara il **brief**, non il codice:
giorni e carichi, punti dolenti da chiedere dopo ogni esercizio, blocchi, recuperi,
e se contare le sigarette o l'acqua.

Il motore delle proposte è deterministico e non applica mai niente da solo:
propone, l'atleta accetta o rifiuta, e ogni esito finisce nel registro con una
data di verifica.
