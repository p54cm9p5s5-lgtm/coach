/* Coach — service worker.
   Ogni pubblicazione cambia VERSION: la nuova versione prende il comando
   subito e i file si aggiornano da soli, senza conferme da toccare. */

const VERSION = "20260804-053451";
const CACHE = `coach-${VERSION}`;

const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./data/esercizi.json",
  "./data/riscaldamento.json",
  "./js/app.js",
  "./js/db.js",
  "./js/store.js",
  "./js/brief.js",
  "./js/ui.js",
  "./js/plates.js",
  "./js/salute.js",
  "./js/segnali.js",
  "./js/export.js",
  "./js/grafico.js",
  "./js/punteggio.js",
  "./js/calendario.js",
  "./js/screens/oggi.js",
  "./js/screens/proposte.js",
  "./js/screens/export.js",
  "./js/screens/seduta.js",
  "./js/screens/corpo.js",
  "./js/screens/salute.js",
  "./js/screens/storico.js",
  "./js/screens/impostazioni.js",
];

self.addEventListener("install", (e) => {
  // Prende il posto della versione precedente senza aspettare che tutte le
  // schede si chiudano: su un telefono l'app non si "chiude" mai davvero, e la
  // versione vecchia resterebbe al comando per giorni.
  self.skipWaiting();
  // Promise.all e non allSettled: se anche un solo file non si scarica
  // l'installazione FALLISCE, la cache nuova non viene attivata e quella
  // vecchia resta al suo posto. Con allSettled una rete ballerina produceva
  // una versione monca che poi cancellava l'unica copia funzionante.
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.all(ASSETS.map((u) => c.add(new Request(u, { cache: "reload" })))))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    // Le cache vecchie si cancellano solo dopo aver verificato che quella nuova
    // contenga davvero il necessario per aprire l'app senza rete.
    caches
      .open(CACHE)
      .then((c) => Promise.all(["./index.html", "./js/app.js", "./css/app.css"].map((u) => c.match(u))))
      .then((essenziali) => {
        if (essenziali.some((x) => !x)) return [];
        return caches.keys();
      })
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  // Chi sta girando davvero risponde da sé. Prima la schermata Impostazioni
  // leggeva sw.js dal server: mostrava la versione pubblicata, non quella
  // installata sul telefono, cioè proprio il numero che serve per capire se
  // l'app è rimasta indietro.
  if (e.data === "VERSIONE" && e.ports && e.ports[0]) e.ports[0].postMessage(VERSION);
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // Con la rete lenta (o un wifi che non porta da nessuna parte) l'attesa
    // non deve essere infinita: dopo tre secondi si apre la copia salvata e
    // l'allenamento comincia lo stesso. Il download continua per suo conto e
    // aggiorna la copia per la volta dopo.
    const conAttesaMassima = (promessa) =>
      Promise.race([
        promessa,
        new Promise((ok) =>
          setTimeout(() => ok(caches.match("./index.html").then((s) => s || promessa)), 3000)
        ),
      ]);
    e.respondWith(
      conAttesaMassima(
      fetch(new Request(req.url, { cache: "no-cache" }))
        .then((r) => {
          // Solo una risposta valida diventa la pagina dell'app. Senza questo
          // controllo una pagina di errore, o quella di un wifi con login,
          // prendeva il posto dell'app fino al caricamento successivo.
          if (r && r.ok && r.status === 200 && r.type !== "opaque") {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put("./index.html", copy));
            return r;
          }
          return caches.match("./index.html").then((salvata) => salvata || r);
        })
        .catch(() => caches.match("./index.html"))
      )
    );
    return;
  }

  // Serve subito dalla cache e intanto riscarica: la volta dopo l'app è
  // aggiornata anche se VERSION non è cambiata. Senza questo, una modifica
  // pubblicata resterebbe invisibile finché non si tocca il service worker.
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req).then((hit) => {
        // no-cache: la rivalidazione deve parlare col server, non con la
        // cache HTTP, altrimenti l'aggiornamento arriva con dieci minuti di ritardo
        const rete = fetch(new Request(req.url, { cache: "no-cache" }))
          .then((r) => {
            if (r.ok) c.put(req, r.clone());
            return r;
          })
          .catch(() => hit);
        return hit || rete;
      })
    )
  );
});
