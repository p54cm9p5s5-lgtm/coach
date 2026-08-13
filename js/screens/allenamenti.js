/* Gli allenamenti letti dall'orologio.

   Due schermate: l'elenco di tutti, uno dietro l'altro dal più recente, e il
   dettaglio di uno. Niente di più: prima c'era un calendario da cui si sceglieva
   un giorno e poi il giorno da cui si sceglieva l'allenamento — due tocchi per
   arrivare dove si voleva arrivare subito.

   Qui NON si registra e non si decide niente: è quello che il telefono ha già
   scritto per conto suo, e va guardato. Non entra in nessun punteggio. */

import { h, aggiungi, dataLunga, dataBreve, durataUmana, num } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";
import { graficoBattito } from "../grafico.js";

/* I nomi di Apple sono in inglese e attaccati: «FunctionalStrengthTraining».
   Quelli che il programma usa davvero hanno il nome che usa il programma —
   «Rafforzamento funzionale» è la sessione che l'app stessa ti dice di avviare
   sull'orologio. Un tipo che non conosciamo resta scritto com'era: meglio una
   parola inglese che una traduzione inventata o, peggio, un buco. */
const TIPI = {
  Walking: "Camminata",
  Running: "Corsa",
  Hiking: "Escursione",
  Cycling: "Bici",
  IndoorCycling: "Cyclette",
  Swimming: "Nuoto",
  FunctionalStrengthTraining: "Rafforzamento funzionale",
  TraditionalStrengthTraining: "Pesi",
  CoreTraining: "Core",
  HighIntensityIntervalTraining: "Intervalli ad alta intensità",
  Yoga: "Yoga",
  Pilates: "Pilates",
  Elliptical: "Ellittica",
  Rowing: "Vogatore",
  StairClimbing: "Scale",
  Other: "Altro",
};

export const nomeTipo = (t) => TIPI[t] || t || "Allenamento";

const GIORNI_ABBR = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

/** «1:11:16», come lo scrive l'orologio, invece di «1h 11m». */
function durataOrologio(sec) {
  if (!sec) return "—";
  const o = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  const p = (n) => String(n).padStart(2, "0");
  return o ? `${o}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/* Le parole con cui Apple traduce lo sforzo da 1 a 10: sono quelle che hai
   letto sull'orologio quando quel numero l'hai scelto. */
function parolaSforzo(v) {
  if (v <= 2) return "Molto facile";
  if (v <= 4) return "Facile";
  if (v <= 6) return "Moderato";
  if (v <= 8) return "Difficile";
  return "Massimo";
}

/** Il passo medio: minuti e secondi per chilometro. */
function passoMedio(km, sec) {
  if (!km || !sec || km <= 0) return null;
  const secPerKm = sec / km;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}'${String(s).padStart(2, "0")}"`;
}

const oraInSecondi = (ora) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(ora || "");
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : 0;
};

function parametri() {
  const q = location.hash.split("?")[1] || "";
  return Object.fromEntries(new URLSearchParams(q));
}

export async function render() {
  const p = parametri();
  return p.id ? dettaglio(p.id) : elenco();
}

// ---------- l'elenco ----------

async function elenco() {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Watch", { etichetta: "Home", onclick: () => (location.hash = "#/oggi") }));

  const tutti = await store.allenamentiWatch();
  if (!tutti.length) {
    aggiungi(wrap,
      h("div.empty",
        h("h3", "Ancora niente"),
        h("p", "Qui arrivano gli allenamenti che l'orologio registra da solo, quando importi i dati da Salute.")
      )
    );
    return wrap;
  }

  const righe = h("div.list");
  for (const a of tutti) {
    const numeri = [
      durataOrologio(a.durataSec),
      a.kcalAttive != null ? `${Math.round(a.kcalAttive)} kcal` : null,
      a.km != null ? `${num(a.km, 2)} km` : null,
      a.fcMedia != null ? `${Math.round(a.fcMedia)} bpm` : null,
    ].filter(Boolean);
    const giorno = GIORNI_ABBR[new Date(a.data + "T00:00:00").getDay()];
    aggiungi(righe,
      h(
        "button.row.accent",
        { onclick: () => (location.hash = `#/allenamenti?id=${encodeURIComponent(a.uuid)}`) },
        h(
          "div.main",
          h("span.title", nomeTipo(a.tipo)),
          h("span.sub", `${giorno} ${dataBreve(a.data)} · ${a.fine ? `${a.inizio}–${a.fine}` : a.inizio || "—"}`),
          h("span.sub", numeri.join(" · "))
        ),
        h("span.chevron", "›")
      )
    );
  }

  aggiungi(wrap, h("div.group", righe));
  aggiungi(wrap,
    h("div.group",
      h("p.footnote",
        `${tutti.length} ${tutti.length === 1 ? "allenamento" : "allenamenti"} registrati dall'orologio. ` +
          "Li scrive lui, qui non si tocca niente, e non entrano in nessun punteggio: sono quello che è successo, " +
          "non quello che il programma chiedeva."
      )
    )
  );
  return wrap;
}

// ---------- il dettaglio ----------

async function dettaglio(uuid) {
  const wrap = h("div.screen");
  const a = (await store.allenamentiWatch()).find((x) => x.uuid === uuid);
  if (!a) {
    aggiungi(wrap, intestazione("Allenamento", { etichetta: "Indietro", onclick: () => (location.hash = "#/allenamenti") }));
    aggiungi(wrap, h("div.empty", h("h3", "Allenamento non trovato")));
    return wrap;
  }
  aggiungi(wrap,
    intestazione(dataBreve(a.data), { etichetta: "Indietro", onclick: () => (location.hash = "#/allenamenti") })
  );

  /* La testata come la scrive Salute: il nome dell'allenamento grande, sotto le
     calorie in verde, poi giorno e orario, poi da dove viene il dato. */
  const dataEstesa = (() => {
    const d = new Date(a.data + "T00:00:00");
    const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
    return `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
  })();

  aggiungi(wrap,
    h(
      "div",
      { style: "padding:14px 16px 4px" },
      h(
        "h2",
        { style: "margin:0;font-size:32px;font-weight:800;letter-spacing:-1px;line-height:1.05" },
        nomeTipo(a.tipo)
      ),
      a.kcalAttive != null
        ? h(
            "p",
            { style: "margin:6px 0 0;font-size:26px;font-weight:800;letter-spacing:-0.6px;color:var(--green)" },
            String(Math.round(a.kcalAttive)),
            h("span", { style: "font-size:16px;font-weight:700;margin-left:4px" }, "KCAL")
          )
        : null,
      h(
        "p",
        { style: "margin:8px 0 0;font-size:15px;color:var(--label-secondary)" },
        `${dataEstesa}, ${a.fine ? `${a.inizio}–${a.fine}` : a.inizio || "—"}`
      ),
      h("p", { style: "margin:2px 0 0;font-size:15px;color:var(--label-secondary)" }, "Apple Watch")
    )
  );

  /* I numeri, nella stessa forma dell'orologio: etichetta normale sopra, numero
     grande e colorato sotto, con l'unità piccola attaccata. I colori sono quelli
     con cui li hai già visti sul polso, così cercarli qui costa zero. */
  const numeroGrande = (etichetta, valore, unita, colore, nota) =>
    h(
      "div",
      h("p", { style: "margin:0;font-size:17px;color:var(--label)" }, etichetta),
      h(
        "p",
        { style: `margin:2px 0 0;font-size:34px;font-weight:800;letter-spacing:-1.2px;line-height:1.05;color:${colore};font-variant-numeric:tabular-nums` },
        valore,
        unita ? h("span", { style: "font-size:17px;font-weight:800;letter-spacing:0;margin-left:4px" }, unita) : null
      ),
      nota ? h("p", { style: "margin:2px 0 0;font-size:12px;color:var(--label-tertiary)" }, nota) : null
    );

  const passo = passoMedio(a.km, a.durataSec);
  const coppie = [
    a.kcalTotali != null ? numeroGrande("Chilocalorie totali", String(Math.round(a.kcalTotali)), "KCAL", "var(--battito)") : null,
    a.fcMedia != null ? numeroGrande("Media battito", String(Math.round(a.fcMedia)), "BPM", "var(--orange)") : null,
    a.km != null ? numeroGrande("Distanza", num(a.km, 2), "KM", "var(--accent)", passo ? `${passo} al km` : null) : null,
    a.fcMax != null
      ? numeroGrande("Battito massimo", String(Math.round(a.fcMax)), "BPM", "var(--orange)", a.fcMin != null ? `minimo ${Math.round(a.fcMin)}` : null)
      : null,
  ].filter(Boolean);

  const aDue = (voci) =>
    h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:18px" }, ...voci);

  aggiungi(wrap,
    h(
      "div",
      { style: "margin:14px 16px 0;background:var(--bg-grouped);border-radius:16px;padding:18px;display:grid;gap:18px" },
      numeroGrande("Durata allenamento", durataOrologio(a.durataSec), null, "var(--giallo)"),
      a.kcalAttive != null
        ? numeroGrande("Chilocalorie attive", String(Math.round(a.kcalAttive)), "KCAL", "var(--battito)")
        : null,
      ...(coppie.length ? [aDue(coppie.slice(0, 2))] : []),
      ...(coppie.length > 2 ? [aDue(coppie.slice(2, 4))] : [])
    )
  );

  // ---- lo sforzo ----
  if (a.sforzo != null) {
    const s = Math.max(1, Math.min(10, Math.round(a.sforzo)));
    aggiungi(wrap,
      h(
        "div",
        { style: "margin:12px 16px 0;background:var(--bg-grouped);border-radius:16px;padding:18px" },
        h("p", { style: "margin:0 0 10px;font-size:17px;color:var(--label)" }, "Sforzo"),
        h(
          "div",
          { style: "display:flex;align-items:center;gap:14px" },
          h(
            "span",
            {
              style:
                "width:38px;height:38px;border-radius:50%;background:color-mix(in srgb, var(--sforzo) 22%, transparent);" +
                "color:var(--sforzo);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px",
            },
            String(s)
          ),
          h("span", { style: "font-size:30px;font-weight:800;letter-spacing:-0.9px;color:var(--sforzo)" }, parolaSforzo(s)),
          h(
            "span",
            { style: "margin-left:auto;display:flex;align-items:flex-end;gap:4px;height:30px" },
            ...Array.from({ length: 4 }, (_, i) =>
              h("span", {
                style:
                  `width:6px;border-radius:2px;height:${9 + i * 7}px;` +
                  `background:${s > i * 2.5 ? "var(--sforzo)" : "var(--fill-tertiary)"}`,
              })
            )
          )
        )
      )
    );
  }

  // ---- la frequenza cardiaca ----
  /* Le caselle arrivano in due forme: `{min,max}` da adesso, un numero solo dai
     pacchetti scritti prima. Si normalizzano qui, così un allenamento importato
     ieri continua a disegnarsi — con barrette alte un pelo, che è la verità: di
     quel momento sappiamo un valore solo. */
  const caselle = Array.isArray(a.battito)
    ? a.battito.map((c) =>
        c == null ? null : typeof c === "number" ? { min: c, max: c } : Number.isFinite(c.min) ? c : null
      )
    : [];
  const quante = caselle.filter(Boolean).length;
  if (quante >= 3) {
    aggiungi(wrap,
      h(
        "div",
        { style: "margin:22px 16px 0" },
        h("p", { style: "margin:0 0 10px;font-size:22px;font-weight:800;letter-spacing:-0.6px" }, "Frequenza cardiaca"),
        graficoBattito({
          caselle,
          inizioSec: oraInSecondi(a.inizio),
          durataSec: a.durataSec || quante * 30,
          media: a.fcMedia ?? null,
        })
      )
    );
  }

  /* Un allenamento importato prima dell'aggiornamento ha solo quattro numeri:
     giorno, ora, durata e calorie. Il resto sta nel file di Salute e c'è sempre
     stato — era il lettore che non lo prendeva. Dirlo qui è l'unico modo perché
     non sembri che l'orologio non l'abbia misurato. */
  if (a.km == null && a.fcMedia == null && !a.fine && !Array.isArray(a.battito)) {
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Mancano dei numeri"),
        h(
          "p.footnote",
          "Questo allenamento è stato importato da una versione dell'app che leggeva solo durata e calorie. " +
            "Battito, sforzo, distanza e orario di fine sono nel file di Salute: rifai l'importazione e si riempiono da soli."
        ),
        h(
          "div.list",
          h(
            "a.row",
            { href: "#/salute" },
            h("div.main", h("span.title", "Vai a importare i dati da Salute")),
            h("span.chevron", "›")
          )
        )
      )
    );
  }

  aggiungi(wrap,
    h("div.group",
      h("p.footnote",
        "Numeri scritti dall'orologio e importati da Salute. L'app non li cambia, non li usa per nessun punteggio, " +
          "e li manda al coach così come sono."
      )
    )
  );
  return wrap;
}
