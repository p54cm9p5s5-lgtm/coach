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
 * Il segnale «vietato fumare», a sole linee.
 *
 * Un colore solo — quello del testo — e nessun riempimento: così funziona
 * uguale su fondo chiaro e su fondo scuro, e non litiga col numero, che è
 * l'unica cosa colorata della schermata perché è l'unica che è un dato.
 */
function sigarettaSvg() {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  };
  const svg = el("svg", { viewBox: "0 0 200 200", width: "212", height: "212", "aria-hidden": "true" });
  svg.style.display = "block";
  svg.style.margin = "0 auto";

  const g = el("g", {
    fill: "none",
    stroke: "var(--label)",
    "stroke-width": 7,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  g.append(
    // la sigaretta e i tre segmenti della parte che brucia
    el("rect", { x: 40, y: 89, width: 88, height: 22, rx: 3 }),
    el("path", { d: "M138 89v22M149 89v22M160 89v22" }),
    // le due volute di fumo
    el("path", { d: "M137 82C137 70 122 70 122 58 122 46 137 46 137 34" }),
    el("path", { d: "M113 82C113 71 99 71 99 59 99 47 113 47 113 36" }),
    // il cerchio e la sbarra
    el("circle", { cx: 100, cy: 100, r: 80 }),
    el("path", { d: "M43.4 43.4L156.6 156.6" })
  );
  svg.append(g);
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
