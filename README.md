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
js/screens/*.js       una schermata per file
data/esercizi.json    libreria esercizi (contenuto generico)
tools/icona.py        ritaglia e riquadra l'icona sorgente
tools/icona-da-immagine.sh  genera le tre misure delle icone
tools/serve.py        server di sviluppo senza cache
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

Un cambio di `VERSION` in `sw.js` pubblica un aggiornamento: l'app mostra un avviso e
lo applica solo su conferma. I dati salvati non vengono toccati dagli aggiornamenti.

## Stato

Fase 1 completa: programma, Modalità Seduta, storico, volumi, backup.
Fasi successive: misure e foto, ponte con l'app Salute, segnali e proposte di progressione.
