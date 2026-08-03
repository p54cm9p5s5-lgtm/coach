/* Avvio, routing, aggiornamenti. */

import { h, qs, qsa, clear, toast, sbloccaAudio } from "./ui.js";
import * as store from "./store.js";

const ROTTE = {
  oggi: () => import("./screens/oggi.js"),
  seduta: () => import("./screens/seduta.js"),
  corpo: () => import("./screens/corpo.js"),
  salute: () => import("./screens/salute.js"),
  storico: () => import("./screens/storico.js"),
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
export function intestazione(titolo, azione) {
  const bar = h(
    "header.topbar",
    h("h1", titolo),
    azione && h("button.bar-action", { onclick: azione.onclick }, azione.etichetta)
  );
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
    const reg = await navigator.serviceWorker.register("sw.js");
    if (reg.waiting) bannerAggiornamento(reg);
    reg.addEventListener("updatefound", () => {
      const nuovo = reg.installing;
      nuovo?.addEventListener("statechange", () => {
        if (nuovo.state === "installed" && navigator.serviceWorker.controller) {
          bannerAggiornamento(reg);
        }
      });
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
