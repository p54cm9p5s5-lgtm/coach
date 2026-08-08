# Coach

App personale di allenamento. PWA, nessun build step, nessun server, nessuna dipendenza.
I dati restano sul dispositivo (IndexedDB) e non vengono inviati da nessuna parte.

Specifica funzionale: [SPEC.md](SPEC.md).

## Struttura

```
index.html            shell dell'app
manifest.webmanifest  installazione sulla schermata Home
sw.js                 service worker (offline + aggiornamenti)
css/app.css           stile iOS nativo, chiaro/scuro automatico
js/app.js             avvio e routing
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
tools/pubblica.sh     pubblica su GitHub Pages
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
