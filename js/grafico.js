/* Grafici in SVG, senza librerie.
   Un solo grafico in Home: quattro settimane di movimento, allenamenti e sonno
   nello stesso spazio. Sono le tre cose che le regole del brief guardano. */

import { h, num, dataBreve } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  }
  return n;
};

const GIORNI_CORTI = ["D", "L", "M", "M", "G", "V", "S"];

/**
 * @param dati [{ data, kcal|null, obiettivo, allenamento: bool, sonnoMin|null, presente }]
 */
export function graficoAttivita(dati, { altezza = 150 } = {}) {
  const L = 320;
  const A = altezza;
  const margineBasso = 26;
  const altezzaSonno = 22;
  const areaBarre = A - margineBasso - altezzaSonno - 6;

  const svg = el("svg", {
    viewBox: `0 0 ${L} ${A}`,
    width: "100%",
    height: A,
    role: "img",
    "aria-label": "Movimento, allenamenti e sonno delle ultime quattro settimane",
    style: "display:block",
  });

  const valori = dati.map((d) => d.kcal).filter((v) => v != null);
  const obiettivo = dati.find((d) => d.obiettivo)?.obiettivo || 600;
  const massimo = Math.max(obiettivo * 1.2, ...valori, 1);
  const passo = L / Math.max(dati.length, 1);
  const larghezza = Math.max(2, passo * 0.62);

  // linea dell'obiettivo
  const yObiettivo = areaBarre - (obiettivo / massimo) * areaBarre;
  svg.append(
    el("line", {
      x1: 0, x2: L, y1: yObiettivo, y2: yObiettivo,
      stroke: "currentColor", "stroke-width": 1, "stroke-dasharray": "3 4", opacity: 0.35,
    }),
    el("text", {
      x: 2, y: yObiettivo - 4, "font-size": 8, fill: "currentColor", opacity: 0.5,
    })
  );
  svg.lastChild.textContent = `obiettivo ${obiettivo}`;

  dati.forEach((d, i) => {
    const x = i * passo + (passo - larghezza) / 2;

    if (!d.presente || d.kcal == null) {
      // giorno senza dati: un trattino, non una barra a zero
      svg.append(
        el("circle", {
          cx: x + larghezza / 2, cy: areaBarre - 2, r: 1.6,
          fill: "currentColor", opacity: 0.3,
        })
      );
    } else {
      const alt = Math.max(2, (d.kcal / massimo) * areaBarre);
      svg.append(
        el("rect", {
          x, y: areaBarre - alt, width: larghezza, height: alt, rx: Math.min(2, larghezza / 2),
          fill: d.allenamento ? "var(--accent)" : "currentColor",
          opacity: d.allenamento ? 0.95 : 0.3,
        })
      );
    }

    // fascia sonno
    const ySonno = areaBarre + 8;
    if (d.sonnoMin != null) {
      const quota = Math.min(1, d.sonnoMin / (9 * 60));
      svg.append(
        el("rect", {
          x, y: ySonno + (altezzaSonno - quota * altezzaSonno), width: larghezza,
          height: Math.max(2, quota * altezzaSonno), rx: 1,
          fill: "currentColor", opacity: d.sonnoMin < 6 * 60 ? 0.55 : 0.28,
        })
      );
    } else {
      svg.append(
        el("line", {
          x1: x, x2: x + larghezza, y1: ySonno + altezzaSonno, y2: ySonno + altezzaSonno,
          stroke: "currentColor", "stroke-width": 1.5, opacity: 0.15, "stroke-linecap": "round",
        })
      );
    }

    // etichette solo i lunedì e l'ultimo giorno
    const wd = new Date(d.data + "T00:00:00").getDay();
    if (wd === 1 || i === dati.length - 1) {
      const ultimo = i === dati.length - 1;
      const t = el("text", {
        x: ultimo ? L - 1 : x + larghezza / 2, y: A - 8, "font-size": 8,
        "text-anchor": ultimo ? "end" : "middle",
        fill: "currentColor", opacity: 0.45,
      });
      t.textContent = dataBreve(d.data).slice(0, 5);
      svg.append(t);
    }
  });

  return svg;
}

/** Riga di numeri sopra il grafico. */
export function fascia(voci) {
  return h(
    "div",
    { style: "display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 14px" },
    ...voci.map((v) =>
      h(
        "div",
        h("p", { style: "margin:0;font-size:11px;color:var(--label-secondary);letter-spacing:.2px" }, v.etichetta),
        h(
          "p",
          { style: "margin:3px 0 0;font-size:21px;font-weight:700;letter-spacing:-0.5px;font-variant-numeric:tabular-nums" },
          v.valore,
          v.unita ? h("span", { style: "font-size:12px;font-weight:400;color:var(--label-secondary)" }, ` ${v.unita}`) : null
        ),
        v.nota ? h("p", { style: "margin:2px 0 0;font-size:11px;color:var(--label-tertiary)" }, v.nota) : null
      )
    )
  );
}

/** Legenda compatta sotto il grafico. */
export function legenda() {
  const punto = (stile, testo) =>
    h(
      "span",
      { style: "display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--label-secondary)" },
      h("span", { style: `width:8px;height:8px;border-radius:2px;${stile}` }),
      testo
    );
  return h(
    "div",
    { style: "display:flex;flex-wrap:wrap;gap:12px;margin-top:8px" },
    punto("background:var(--accent)", "allenamento"),
    punto("background:currentColor;opacity:.3", "riposo"),
    punto("background:currentColor;opacity:.3;width:5px;height:5px;border-radius:50%", "nessun dato"),
    punto("background:currentColor;opacity:.5;height:5px", "sonno")
  );
}

export { GIORNI_CORTI };
