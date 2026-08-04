/* Contatore delle sigarette.

   Il numero occupa tutto lo schermo e cambia colore da solo: giallo da 4,
   arancione da 7, rosso da 10. Nessuna frase di rimprovero — il colore dice
   già tutto, e un'app che ti sgrida a ogni tocco è un'app che si smette di
   usare. Un conteggio smesso è peggio di nessun conteggio, perché fa sembrare
   buone delle giornate che non lo sono state. */

import { h, aggiungi, dataBreve, dataLunga, isoDate, unaVoltaSola } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";

/** Le soglie sono quelle chieste: 4-6 giallo, 7-9 arancione, 10 e oltre rosso. */
function colore(n) {
  if (n >= 10) return "var(--red)";
  if (n >= 7) return "var(--orange)";
  if (n >= 4) return "var(--giallo)";
  return "var(--label)";
}

/**
 * La sigaretta accesa.
 *
 * Il disegno resta sempre uguale — corpo bianco, filtro arancione, brace
 * accesa: è un'illustrazione, non un indicatore. A cambiare colore con le
 * soglie è il numero, che è il dato.
 */
function sigarettaSvg() {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const svg = el("svg", { viewBox: "32 15 156 125", width: "232", height: "186", "aria-hidden": "true" });
  svg.style.display = "block";
  svg.style.margin = "0 auto";

  const TRATTO = "#1c1c1e";

  // il filo di fumo che sale dalla brace
  svg.append(
    el("path", {
      d: "M176 50c-6-7 5-11 0-18s-9-5-6-13",
      stroke: "#c7c7cc", "stroke-width": 6, "stroke-linecap": "round", fill: "none", opacity: "0.75",
    })
  );

  const sig = el("g", { transform: "rotate(-27 110 90)" });
  sig.append(
    // corpo
    el("rect", { x: 34, y: 77, width: 144, height: 26, rx: 5, fill: "#f5f5f7", stroke: TRATTO, "stroke-width": 3.5 }),
    // filtro
    el("path", {
      d: "M39 77h40v26H39a5 5 0 0 1-5-5V82a5 5 0 0 1 5-5z",
      fill: "#dd9f3c", stroke: TRATTO, "stroke-width": 3.5,
    }),
    ...[[46, 84], [58, 82], [69, 85], [50, 96], [63, 97], [72, 92]].map(([cx, cy]) =>
      el("circle", { cx, cy, r: 2, fill: TRATTO, opacity: "0.6" })
    ),
    // le pieghe della carta bruciata vicino alla brace
    el("path", {
      d: "M148 79v22M156 80v20M163 82v16",
      stroke: TRATTO, "stroke-width": 2.8, "stroke-linecap": "round", fill: "none",
    }),
    // la brace
    el("ellipse", { cx: 177, cy: 90, rx: 9.5, ry: 13, fill: "#f5f5f7", stroke: TRATTO, "stroke-width": 3.5 }),
    el("ellipse", { cx: 178, cy: 90, rx: 5.5, ry: 9, fill: "#d2691e" }),
    // la cenere: qualche fiocco scuro sul rosso, non due righe nere
    el("ellipse", { cx: 177, cy: 87, rx: 2.6, ry: 3.4, fill: "#f5a623", opacity: "0.85" }),
    ...[[176, 92], [180, 88], [179, 94], [175.5, 89]].map(([cx, cy]) =>
      el("circle", { cx, cy, r: 1.35, fill: "#4a2a10", opacity: "0.85" })
    )
  );
  svg.append(sig);
  return svg;
}

export async function render({ ridisegna }) {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Fumo"));

  const oggi = isoDate();
  const tollerate = store.regole().salute?.sigaretteTollerate ?? 10;
  const dOggi = await store.sigaretteDi(oggi);
  const quante = dOggi.length;
  const tinta = colore(quante);

  const meno = h(
    "button.btn.secondary",
    {
      "aria-label": "una sigaretta in meno",
      disabled: quante === 0,
      style: "font-size:34px;line-height:1;padding:18px 0",
      onclick: unaVoltaSola(async () => {
        if (await store.togliSigaretta(oggi)) await ridisegna();
      }),
    },
    "−"
  );

  const piu = h(
    "button.btn",
    {
      "aria-label": "una sigaretta in più",
      style: "font-size:34px;line-height:1;padding:18px 0",
      onclick: unaVoltaSola(async () => {
        await store.segnaSigaretta(oggi);
        await ridisegna();
      }),
    },
    "+"
  );

  // Il conteggio prende tutta l'altezza che resta fra l'intestazione e la barra
  // in fondo: è l'unica cosa che serve guardare quando apri questa schermata.
  // I pulsanti e la riga degli orari stanno dentro la stessa colonna, così
  // niente finisce sotto la barra del menu qualunque sia lo schermo.
  aggiungi(wrap,
    h(
      "div",
      {
        style:
          "height:calc(100dvh - var(--tabbar-h) - 104px);display:flex;flex-direction:column;padding:0 16px",
      },
      h(
        "div",
        {
          style:
            "flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px",
        },
        sigarettaSvg(),
      h(
        "p",
        {
          style:
            `margin:6px 0 0;font-size:132px;line-height:0.95;font-weight:700;letter-spacing:-5px;` +
            `font-variant-numeric:tabular-nums;color:${tinta}`,
        },
        String(quante)
      ),
      h(
        "p",
        { style: "margin:10px 0 0;font-size:14px;color:var(--label-secondary);text-align:center" },
        quante === 1 ? "sigaretta oggi" : "sigarette oggi",
        quante > tollerate
          ? ` · ${quante - tollerate} oltre le ${tollerate}`
          : ` · su ${tollerate} tollerate`
        )
      ),
      h(
        "div",
        { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px;flex:none" },
        meno,
        piu
      ),
      h(
        "p",
        {
          style:
            "margin:10px 0 0;font-size:12px;line-height:1.35;color:var(--label-tertiary);" +
            "text-align:center;flex:none;max-height:34px;overflow:hidden",
        },
        dOggi.length
          ? `Orari: ${dOggi.map((x) => oraDi(x.ts)).join(" · ")}`
          : "Tocca «+» ogni volta che fumi. Il «−» serve quando premi per sbaglio."
      )
    )
  );

  // ---- i giorni precedenti, sotto ----
  const primo = await store.primoGiornoFumo();
  if (primo) {
    const conteggi = await store.conteggioFumo();
    const righe = h("div.list");
    const d = new Date(oggi + "T00:00:00");
    let mostrati = 0;
    let totale = 0;
    let contati = 0;
    while (mostrati < 14) {
      const p = (n) => String(n).padStart(2, "0");
      const data = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      if (data < primo) break;
      const n = conteggi.get(data) || 0;
      totale += n;
      contati++;
      if (data !== oggi) {
        aggiungi(righe,
          h(
            "div.row",
            h("div.main", h("span.title", dataLunga(data))),
            h("span.value", { style: `color:${colore(n)}` }, String(n)),
            n === 0 ? h("span.pill.ok", "zero") : n > tollerate ? h("span.pill.warn", "oltre") : null
          )
        );
        mostrati++;
      }
      d.setDate(d.getDate() - 1);
    }
    if (mostrati) {
      aggiungi(wrap,
        h(
          "div.group",
          h("h2", "Giorni precedenti"),
          righe,
          h(
            "p.footnote",
            `Media ${(totale / Math.max(1, contati)).toFixed(1).replace(".", ",")} al giorno da quando conti (${dataBreve(primo)}). ` +
              `Le sigarette pesano sul punteggio Salute: zero vale pieno, ${tollerate} vale zero, oltre ${tollerate} la giornata non supera 50.`
          )
        )
      );
    }
  }

  return wrap;
}

function oraDi(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
