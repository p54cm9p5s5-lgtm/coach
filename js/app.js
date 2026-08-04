/* Avvio, routing, aggiornamenti. */

import { h, qs, qsa, clear, toast, chiudiFogli } from "./ui.js";
import * as store from "./store.js";

const ROTTE = {
  oggi: () => import("./screens/oggi.js"),
  seduta: () => import("./screens/seduta.js"),
  corpo: () => import("./screens/corpo.js"),
  salute: () => import("./screens/salute.js"),
  storico: () => import("./screens/storico.js"),
  proposte: () => import("./screens/proposte.js"),
  export: () => import("./screens/export.js"),
  impostazioni: () => import("./screens/impostazioni.js"),
};

const view = qs("#view");
let rottaCorrente = null;

/** Il tema si legge prima del primo disegno per non far lampeggiare i colori. */
export function applicaTema(nome) {
  if (nome && nome !== "sistema") document.documentElement.setAttribute("data-tema", nome);
  else document.documentElement.removeAttribute("data-tema");
  try {
    localStorage.setItem("coach-tema", nome || "sistema");
  } catch {
    /* niente localStorage in navigazione privata: il tema resta solo per questa sessione */
  }
}

export function temaCorrente() {
  try {
    return localStorage.getItem("coach-tema") || "lime";
  } catch {
    return "lime";
  }
}

applicaTema(temaCorrente());

function nomeRotta() {
  const raw = location.hash.replace(/^#\/?/, "").split("?")[0];
  return ROTTE[raw] ? raw : "oggi";
}

export function vaiA(rotta) {
  location.hash = `#/${rotta}`;
}

let modCorrente = null;
/* Un aggiornamento arrivato durante l'allenamento resta in attesa: si applica
   appena la seduta è chiusa. */
let aggiornamentoInAttesa = false;

let hashDisegnato = null;

/**
 * Riporta la pagina in cima. Prova con l'animazione e poi si assicura del
 * risultato: dove lo scorrimento animato non è disponibile resterebbe a metà.
 */
export function inCima() {
  try {
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch {
    window.scrollTo(0, 0);
  }
  setTimeout(() => {
    if (window.scrollY > 0) window.scrollTo(0, 0);
  }, 400);
}

let turnoCorrente = 0;

export async function ridisegna() {
  const mioTurno = ++turnoCorrente;
  const nome = nomeRotta();
  // Cambio di schermata: un pannello aperto non deve sopravvivere alla pagina
  // che l'ha aperto.
  const cambioSchermata = hashDisegnato === null || hashDisegnato !== location.hash;
  if (hashDisegnato !== null && cambioSchermata) chiudiFogli();
  hashDisegnato = location.hash;
  rottaCorrente = nome;
  let mod;
  try {
    mod = await ROTTE[nome]();
  } catch (e) {
    // Il modulo di una schermata può non arrivare: rete caduta a metà, file
    // non ancora in cache. Senza questo la sezione restava irraggiungibile
    // per sempre, senza nessun messaggio.
    console.error("caricamento di", nome, e);
    if (mioTurno !== turnoCorrente) return;
    clear(view);
    view.append(
      h(
        "div.screen",
        intestazione("Coach"),
        h(
          "div.empty",
          h("h3", "Questa sezione non si è caricata"),
          h("p", "Probabilmente manca la connessione e il file non è ancora nella copia locale."),
          h(
            "div.btn-wrap",
            h("button.btn", { onclick: () => ridisegna() }, "Riprova"),
            h("div", { style: "height:8px" }),
            h("button.btn.secondary", { onclick: () => vaiA("oggi") }, "Torna alla Home")
          )
        )
      )
    );
    qs("#tabbar").classList.remove("hidden");
    return;
  }

  // Il modulo si carica in tempi diversi a seconda della dimensione: due tocchi
  // ravvicinati possono risolversi in ordine inverso. Chi è stato sorpassato si
  // ferma QUI, prima di toccare qualunque cosa: più avanti avrebbe già spento i
  // timer di una schermata viva o acceso quelli di una che non si vedrà mai.
  if (mioTurno !== turnoCorrente) return;

  // Una schermata che se ne va deve spegnere quello che ha acceso: senza
  // questo, i timer dell'allenamento restano vivi in sottofondo a ogni
  // cambio di scheda e possono suonare da soli.
  if (modCorrente && modCorrente !== mod) {
    try {
      modCorrente.pulisci?.();
    } catch (e) {
      console.error("pulizia schermata", e);
    }
  }
  modCorrente = mod;

  // Aggiornamento rimasto in attesa: si applica appena si esce dall'allenamento.
  if (aggiornamentoInAttesa && nome !== "seduta") {
    try {
      if (!(await store.sedutaInCorso())) {
        aggiornamentoInAttesa = false;
        location.reload();
        return;
      }
    } catch {
      /* niente: si riproverà al prossimo disegno */
    }
  }

  if (mioTurno !== turnoCorrente) return;

  let nodo;
  try {
    nodo = await mod.render({ vaiA, ridisegna });
  } catch (e) {
    // Una schermata che va in errore non deve lasciare la pagina precedente:
    // sembrerebbe che il tocco non abbia funzionato, e quella sezione
    // resterebbe irraggiungibile finché non si riavvia l'app.
    console.error("disegno di", nome, e);
    nodo = h(
      "div.screen",
      intestazione(nome === "oggi" ? "Home" : nome[0].toUpperCase() + nome.slice(1)),
      h(
        "div.empty",
        h("h3", "Questa schermata non si è aperta"),
        h("p", e?.message || "Errore sconosciuto."),
        h(
          "div.btn-wrap",
          h("button.btn", { onclick: () => ridisegna() }, "Riprova"),
          h("div", { style: "height:8px" }),
          h("button.btn.secondary", { onclick: () => vaiA("oggi") }, "Torna alla Home")
        )
      )
    );
  }

  // Un disegno più lento non deve coprire quello partito dopo. Se è successo,
  // la schermata giusta viene ridisegnata: il render sorpassato può aver
  // lasciato acceso qualcosa.
  if (mioTurno !== turnoCorrente) {
    try {
      mod.pulisci?.();
    } catch {
      /* niente */
    }
    return;
  }

  const posizione = window.scrollY;
  clear(view);
  view.append(nodo);
  // Ridisegnare la stessa schermata (freccia del mese, selettore del periodo)
  // non è una navigazione: la pagina deve restare dov'era.
  if (cambioSchermata) window.scrollTo(0, 0);
  else window.scrollTo(0, posizione);

  for (const a of qsa(".tabbar a")) {
    a.classList.toggle("active", a.dataset.tab === nome);
  }
  qs("#tabbar").classList.toggle("hidden", Boolean(mod.nascondiTabBar));
}

/** Intestazione grande in stile iOS, con ombra allo scroll. */
// Profilo calcolato: 8 denti simmetrici, non disegnato a mano.
const INGRANAGGIO =
  "M9.84 4.92 L9.88 2.02 L14.12 2.02 L14.16 4.92 L15.47 5.47 L17.56 3.45 L20.55 6.44 L18.53 8.53 L19.08 9.84 L21.98 9.88 L21.98 14.12 L19.08 14.16 L18.53 15.47 L20.55 17.56 L17.56 20.55 L15.47 18.53 L14.16 19.08 L14.12 21.98 L9.88 21.98 L9.84 19.08 L8.53 18.53 L6.44 20.55 L3.45 17.56 L5.47 15.47 L4.92 14.16 L2.02 14.12 L2.02 9.88 L4.92 9.84 L5.47 8.53 L3.45 6.44 L6.44 3.45 L8.53 5.47 Z";

export function intestazione(titolo, azione) {
  const bottone = azione
    ? azione.icona === "ingranaggio"
      ? h(
          "button.bar-action",
          { onclick: azione.onclick, "aria-label": azione.etichetta || "Impostazioni", style: "padding:6px 0 2px" },
          h(
            "svg",
            {
              viewBox: "0 0 24 24", width: 24, height: 24, fill: "none",
              stroke: "currentColor", "stroke-width": 1.7,
              "stroke-linecap": "round", "stroke-linejoin": "round",
              "aria-hidden": "true", style: "display:block",
            },
            h("circle", { cx: 12, cy: 12, r: 3 }),
            h("path", { d: INGRANAGGIO })
          )
        )
      : h("button.bar-action", { onclick: azione.onclick }, azione.etichetta)
    : null;

  const bar = h("header.topbar", h("h1", titolo), bottone);
  const onScroll = () => bar.classList.toggle("scrolled", window.scrollY > 4);
  window.removeEventListener("scroll", window.__coachScroll || (() => {}));
  window.__coachScroll = onScroll;
  window.addEventListener("scroll", onScroll, { passive: true });
  return bar;
}

// ---------- aggiornamenti ----------

function bannerAggiornamento(reg) {
  if (qs("#agg-banner")) return;
  const banner = h(
    "div.toast",
    { id: "agg-banner", style: "bottom:auto;top:calc(env(safe-area-inset-top) + 12px)" },
    "Aggiornamento disponibile · ",
    h(
      "button",
      {
        style: "background:none;border:0;color:var(--accent);font-weight:600;cursor:pointer",
        onclick: () => {
          reg.waiting?.postMessage("SKIP_WAITING");
          setTimeout(() => location.reload(), 300);
        },
      },
      "Applica"
    )
  );
  document.body.append(banner);
}

async function registraServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol === "file:") return;
  // ?nosw serve in sviluppo: niente cache, così le modifiche si vedono subito.
  if (location.search.includes("nosw")) {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
    return;
  }
  try {
    // updateViaCache: "none" impedisce al browser di servire dalla cache HTTP
    // proprio il file che decide gli aggiornamenti. Senza, GitHub Pages lo
    // tiene per dieci minuti e il telefono non si accorge delle novità.
    const reg = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
    reg.update();

    // ricontrolla quando l'app torna in primo piano: su iPhone l'app viene
    // ripresa dalla memoria e senza questo non ci sarebbe nessun controllo
    let ultimoControllo = Date.now();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultimoControllo < 30_000) return;
      ultimoControllo = Date.now();
      reg.update();
    });
    // Quando la nuova versione prende il comando, la pagina si ricarica una
    // volta sola: così i moduli già in memoria non restano quelli vecchi.
    // Al primissimo avvio non c'è nessuna versione vecchia da sostituire: il
    // service worker prende il comando per la prima volta e ricaricare
    // sarebbe solo un lampo bianco all'apertura dell'app.
    const avevaControllore = Boolean(navigator.serviceWorker.controller);
    let ricaricato = false;
    navigator.serviceWorker.addEventListener("controllerchange", async () => {
      if (!avevaControllore) return;
      if (ricaricato) return;
      // Mai ricaricare mentre un allenamento è aperto: si perderebbe la
      // schermata in corso, il timer e il gesto che ha autorizzato l'audio.
      // L'aggiornamento aspetta la fine.
      try {
        if (await store.sedutaInCorso()) {
          aggiornamentoInAttesa = true;
          return;
        }
      } catch {
        /* se non si riesce a leggere l'archivio si ricarica come prima */
      }
      ricaricato = true;
      location.reload();
    });
  } catch {
    /* in locale senza https il service worker può non registrarsi: non è un errore bloccante */
  }
}

// ---------- avvio ----------

async function avvia() {
  try {
    await store.init();
  } catch (e) {
    clear(view).append(
      h(
        "div.empty",
        h("h3", "Archivio non accessibile"),
        h("p", e.message),
        h("p", "Se stai usando la navigazione privata, i dati non possono essere salvati.")
      )
    );
    return;
  }

  window.addEventListener("hashchange", ridisegna);

  // L'app resta aperta per giorni: senza questo, a mezzanotte «oggi» resta
  // ieri finché non si ricarica, e la Home propone l'allenamento sbagliato.
  let giornoDisegnato = new Date().toDateString();
  const seCambiatoGiorno = () => {
    const adesso = new Date().toDateString();
    if (adesso === giornoDisegnato) return;
    giornoDisegnato = adesso;
    ridisegna();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") seCambiatoGiorno();
  });
  // Anche a schermo acceso: allenandoti a cavallo di mezzanotte l'app restava
  // a ieri, e il tocco su «visibilitychange» non arrivava mai perché non
  // uscivi mai dall'app.
  setInterval(seCambiatoGiorno, 60000);

  // Toccare la scheda in cui sei già riporta in cima, come nelle app di
  // sistema. Se invece sei dentro un dettaglio, il tocco torna all'elenco:
  // in quel caso è il cambio di indirizzo a fare il lavoro.
  qs("#tabbar").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-tab]");
    if (!a || a.getAttribute("href") !== location.hash) return;
    e.preventDefault();
    inCima();
  });
  // Niente sblocco audio qui: all'apertura l'app deve restare muta. Lo fa la
  // schermata dell'allenamento, al primo tocco dentro la seduta.

  await ridisegna();
  registraServiceWorker();
}

avvia().catch((e) => {
  console.error(e);
  toast("Errore all'avvio: " + e.message, 6000);
});
