/* Avvio, routing, aggiornamenti. */

import { h, qs, qsa, clear, toast, sbloccaAudio } from "./ui.js";
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

export async function ridisegna() {
  const nome = nomeRotta();
  rottaCorrente = nome;
  const mod = await ROTTE[nome]();
  const nodo = await mod.render({ vaiA, ridisegna });

  clear(view);
  view.append(nodo);
  window.scrollTo(0, 0);

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
    let ricaricato = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (ricaricato) return;
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
  document.addEventListener("pointerdown", sbloccaAudio, { once: true });

  await ridisegna();
  registraServiceWorker();
}

avvia().catch((e) => {
  console.error(e);
  toast("Errore all'avvio: " + e.message, 6000);
});
