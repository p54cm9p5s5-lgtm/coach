/* Coach — service worker.
   Ogni pubblicazione cambia VERSION: la nuova versione prende il comando
   subito e i file si aggiornano da soli, senza conferme da toccare. */

const VERSION = "20260803-183847";
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
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((u) => c.add(u))))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(new Request(req.url, { cache: "no-cache" }))
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return r;
        })
        .catch(() => caches.match("./index.html"))
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
