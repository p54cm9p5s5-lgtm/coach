/* Grafici in SVG, senza librerie.
   Un solo grafico in Home: il movimento giornaliero con i giorni di allenamento
   in evidenza, e i giorni già in programma sulla destra. */

import { h, num, dataBreve, weekdayOf } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  }
  return n;
};

const GIORNI_CORTI = ["D", "L", "M", "M", "G", "V", "S"];
const GIORNI_ABBR = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

/**
 * @param dati [{ data, kcal|null, obiettivo, allenamento: bool, presente, futuro, previsto }]
 */
export function graficoAttivita(dati, { altezza = 128 } = {}) {
  const L = 320;
  const A = altezza;
  const margineBasso = 22;
  const areaBarre = A - margineBasso;

  const svg = el("svg", {
    viewBox: `0 0 ${L} ${A}`,
    width: "100%",
    height: A,
    role: "img",
    "aria-label": "Movimento giornaliero e allenamenti",
    style: "display:block",
  });

  const valori = dati.map((d) => d.kcal).filter((v) => v != null);
  const obiettivo = dati.find((d) => d.obiettivo)?.obiettivo || 600;
  const massimo = Math.max(obiettivo * 1.2, ...valori, 1);
  const passo = L / Math.max(dati.length, 1);
  const larghezza = Math.max(1.5, Math.min(9, passo * 0.42));

  const etichettaFascia = (testo, y) => {
    const t = el("text", {
      x: 0, y, "font-size": 7.5, fill: "currentColor", opacity: 0.4,
      "letter-spacing": 0.6,
    });
    t.textContent = testo.toUpperCase();
    return t;
  };
  // linea dell'obiettivo
  const yObiettivo = areaBarre - (obiettivo / massimo) * areaBarre;
  svg.append(
    el("line", {
      x1: 0, x2: L, y1: yObiettivo, y2: yObiettivo,
      stroke: "currentColor", "stroke-width": 1, "stroke-dasharray": "3 4", opacity: 0.35,
    }),
    el("text", {
      x: L - 1, y: yObiettivo - 4, "font-size": 8, "text-anchor": "end",
      fill: "currentColor", opacity: 0.5,
    })
  );
  svg.lastChild.textContent = `obiettivo ${obiettivo}`;

  const primoFuturo = dati.findIndex((d) => d.futuro);
  if (primoFuturo > 0) {
    const xTaglio = primoFuturo * passo;
    svg.append(
      el("line", {
        x1: xTaglio, x2: xTaglio, y1: 12, y2: A - margineBasso + 12,
        stroke: "currentColor", "stroke-width": 0.5, opacity: 0.2, "stroke-dasharray": "2 3",
      })
    );
  }


  dati.forEach((d, i) => {
    const x = i * passo + (passo - larghezza) / 2;

    if (d.futuro) {
      if (d.previsto) {
        svg.append(
          el("rect", {
            x, y: areaBarre - 7, width: larghezza, height: 7, rx: 1,
            fill: "none", stroke: "var(--accent)", "stroke-width": 1, opacity: 0.45,
          })
        );
      }
    } else if (!d.presente || d.kcal == null) {
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
      if (d.futuro) t.setAttribute("opacity", "0.3");
      svg.append(t);
    }
  });

  // ---- lettura del giorno toccato ----

  // Riga sopra il grafico: altezza fissa, così toccando una colonna il grafico
  // non salta su e giù.
  const lettura = h("p", {
    style:
      "margin:0 0 6px;min-height:17px;font-size:12px;line-height:17px;color:var(--label-secondary);" +
      "font-variant-numeric:tabular-nums",
  });
  const riposo = h("span", { style: "opacity:.75" }, "Tocca una colonna per vedere il giorno");
  lettura.append(riposo);

  const evidenza = el("line", {
    y1: 0, y2: areaBarre, stroke: "currentColor", "stroke-width": 1, opacity: 0,
  });
  const pallino = el("circle", { r: 2.6, fill: "var(--accent)", opacity: 0 });
  svg.append(evidenza, pallino);

  const descrivi = (d) => {
    const giorno = GIORNI_ABBR[weekdayOf(d.data)];
    const data = `${giorno} ${dataBreve(d.data)}`;
    if (d.futuro) return `${data} · ${d.previsto ? "allenamento in programma" : "niente in programma"}`;
    if (!d.presente || d.kcal == null) {
      return `${data} · nessun dato${d.allenamento ? " · allenamento registrato" : ""}`;
    }
    const kcal = `${Math.round(d.kcal).toLocaleString("it-IT")} kcal`;
    const quota = d.obiettivo ? ` (${num((d.kcal / d.obiettivo) * 100)}% dell'obiettivo)` : "";
    return `${data} · ${kcal}${quota} · ${d.allenamento ? "allenamento" : "riposo"}`;
  };

  let selezionato = null;
  const mostra = (i) => {
    const d = dati[i];
    if (!d || i === selezionato) return;
    selezionato = i;
    const cx = i * passo + passo / 2;
    evidenza.setAttribute("x1", cx);
    evidenza.setAttribute("x2", cx);
    evidenza.setAttribute("opacity", "0.22");
    const alt = d.presente && d.kcal != null ? Math.max(2, (d.kcal / massimo) * areaBarre) : 2;
    pallino.setAttribute("cx", cx);
    pallino.setAttribute("cy", areaBarre - alt);
    pallino.setAttribute("opacity", d.futuro ? "0" : "1");
    lettura.textContent = descrivi(d);
  };

  const indiceDa = (clientX) => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return null;
    const x = ((clientX - r.left) / r.width) * L;
    return Math.max(0, Math.min(dati.length - 1, Math.floor(x / passo)));
  };

  let premuto = false;
  const aggiorna = (e) => {
    const i = indiceDa(e.clientX);
    if (i != null) mostra(i);
  };
  svg.addEventListener("pointerdown", (e) => {
    premuto = true;
    aggiorna(e);
  });
  svg.addEventListener("pointermove", (e) => {
    if (premuto) aggiorna(e);
  });
  const rilascia = () => {
    premuto = false;
  };
  svg.addEventListener("pointerup", rilascia);
  svg.addEventListener("pointercancel", rilascia);
  svg.addEventListener("pointerleave", rilascia);
  // scorrere la pagina resta possibile: si cattura solo il movimento orizzontale
  svg.style.touchAction = "pan-y";
  svg.style.cursor = "pointer";

  return h("div", lettura, svg);
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
    punto("background:var(--accent)", "giorno di allenamento"),
    punto("background:currentColor;opacity:.3", "giorno di riposo"),
    punto("background:currentColor;opacity:.3;width:5px;height:5px;border-radius:50%", "nessun dato"),
    punto("background:none;box-shadow:inset 0 0 0 1px var(--accent);opacity:.5", "in programma")
  );
}

/**
 * Grafico a barre riutilizzabile, con lettura al tocco.
 * @param punti [{ data, valore|null, evidenza?: bool, futuro?: bool }]
 * @param obiettivo linea tratteggiata, opzionale
 * @param formatta (valore) => stringa mostrata nella lettura
 * @param suffisso etichetta breve dell'unità nella lettura
 */
export function graficoBarre({
  punti,
  obiettivo = null,
  formatta = (v) => String(Math.round(v)),
  etichettaObiettivo = null,
  altezza = 96,
  invito = "Tocca una colonna per vedere il giorno",
}) {
  const L = 320;
  const A = altezza;
  const margineBasso = 18;
  const areaBarre = A - margineBasso;

  const svg = el("svg", {
    viewBox: `0 0 ${L} ${A}`,
    width: "100%",
    height: A,
    role: "img",
    style: "display:block",
  });

  const valori = punti.map((p) => p.valore).filter((v) => v != null);
  const massimo = Math.max(obiettivo ? obiettivo * 1.15 : 0, ...valori, 1);
  const passo = L / Math.max(punti.length, 1);
  const larghezza = Math.max(1.5, Math.min(11, passo * 0.5));

  if (obiettivo) {
    const y = areaBarre - (obiettivo / massimo) * areaBarre;
    svg.append(
      el("line", {
        x1: 0, x2: L, y1: y, y2: y,
        stroke: "currentColor", "stroke-width": 1, "stroke-dasharray": "3 4", opacity: 0.3,
      })
    );
    if (etichettaObiettivo) {
      const t = el("text", {
        x: L - 1, y: y - 3, "font-size": 7.5, "text-anchor": "end", fill: "currentColor", opacity: 0.45,
      });
      t.textContent = etichettaObiettivo;
      svg.append(t);
    }
  }

  punti.forEach((p, i) => {
    const x = i * passo + (passo - larghezza) / 2;
    if (p.valore == null) {
      svg.append(
        el("circle", { cx: x + larghezza / 2, cy: areaBarre - 2, r: 1.5, fill: "currentColor", opacity: 0.28 })
      );
      return;
    }
    const alt = Math.max(2, (p.valore / massimo) * areaBarre);
    svg.append(
      el("rect", {
        x, y: areaBarre - alt, width: larghezza, height: alt, rx: Math.min(2.5, larghezza / 2),
        fill: p.evidenza ? "var(--accent)" : "currentColor",
        opacity: p.evidenza ? 0.95 : 0.32,
      })
    );
  });

  // estremi sull'asse: prima e ultima data
  if (punti.length) {
    const primo = el("text", { x: 0, y: A - 5, "font-size": 8, fill: "currentColor", opacity: 0.4 });
    primo.textContent = dataBreve(punti[0].data);
    const ultimo = el("text", {
      x: L - 1, y: A - 5, "font-size": 8, "text-anchor": "end", fill: "currentColor", opacity: 0.4,
    });
    ultimo.textContent = dataBreve(punti[punti.length - 1].data);
    svg.append(primo, ultimo);
  }

  const lettura = h("p", {
    style:
      "margin:0 0 6px;min-height:17px;font-size:12px;line-height:17px;color:var(--label-secondary);" +
      "font-variant-numeric:tabular-nums",
  });
  lettura.textContent = invito;

  const evidenza = el("line", { y1: 0, y2: areaBarre, stroke: "currentColor", "stroke-width": 1, opacity: 0 });
  const pallino = el("circle", { r: 2.4, fill: "var(--accent)", opacity: 0 });
  svg.append(evidenza, pallino);

  let selezionato = null;
  const mostra = (i) => {
    const p = punti[i];
    if (!p || i === selezionato) return;
    selezionato = i;
    const cx = i * passo + passo / 2;
    evidenza.setAttribute("x1", cx);
    evidenza.setAttribute("x2", cx);
    evidenza.setAttribute("opacity", "0.22");
    const alt = p.valore != null ? Math.max(2, (p.valore / massimo) * areaBarre) : 2;
    pallino.setAttribute("cx", cx);
    pallino.setAttribute("cy", areaBarre - alt);
    pallino.setAttribute("opacity", p.valore != null ? "1" : "0");
    const giorno = GIORNI_ABBR[weekdayOf(p.data)];
    lettura.textContent =
      p.valore == null
        ? `${giorno} ${dataBreve(p.data)} · nessun dato`
        : `${giorno} ${dataBreve(p.data)} · ${formatta(p.valore)}${p.nota ? ` · ${p.nota}` : ""}`;
  };

  let premuto = false;
  const aggiorna = (e) => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const x = ((e.clientX - r.left) / r.width) * L;
    mostra(Math.max(0, Math.min(punti.length - 1, Math.floor(x / passo))));
  };
  svg.addEventListener("pointerdown", (e) => {
    premuto = true;
    aggiorna(e);
  });
  svg.addEventListener("pointermove", (e) => {
    if (premuto) aggiorna(e);
  });
  const rilascia = () => {
    premuto = false;
  };
  svg.addEventListener("pointerup", rilascia);
  svg.addEventListener("pointercancel", rilascia);
  svg.addEventListener("pointerleave", rilascia);
  svg.style.touchAction = "pan-y";
  svg.style.cursor = "pointer";

  return h("div", lettura, svg);
}

/**
 * Grafico a linea con un punto per giorno, e lettura al tocco.
 * I giorni senza dato spezzano la linea invece di essere disegnati a zero.
 */
export function graficoLinea({
  punti,
  obiettivo = null,
  formatta = (v) => String(Math.round(v)),
  etichettaObiettivo = null,
  altezza = 104,
  invito = "Tocca un punto per vedere il giorno",
}) {
  const L = 320;
  const A = altezza;
  const margineBasso = 18;
  const margineAlto = 8;
  const area = A - margineBasso - margineAlto;

  const svg = el("svg", {
    viewBox: `0 0 ${L} ${A}`,
    width: "100%",
    height: A,
    role: "img",
    style: "display:block",
  });

  const valori = punti.map((p) => p.valore).filter((v) => v != null);
  const massimo = Math.max(obiettivo ? obiettivo * 1.08 : 0, ...valori, 1);
  const minimo = 0;
  const passo = L / Math.max(punti.length, 1);
  const x = (i) => i * passo + passo / 2;
  const y = (v) => margineAlto + area - ((v - minimo) / (massimo - minimo)) * area;

  if (obiettivo) {
    const yo = y(obiettivo);
    svg.append(
      el("line", {
        x1: 0, x2: L, y1: yo, y2: yo,
        stroke: "currentColor", "stroke-width": 1, "stroke-dasharray": "3 4", opacity: 0.28,
      })
    );
    if (etichettaObiettivo) {
      const t = el("text", {
        x: L - 1, y: yo - 3, "font-size": 7.5, "text-anchor": "end", fill: "currentColor", opacity: 0.45,
      });
      t.textContent = etichettaObiettivo;
      svg.append(t);
    }
  }

  // tratti continui: ogni interruzione di dati spezza la linea
  let tratto = [];
  const chiudiTratto = () => {
    if (tratto.length >= 2) {
      svg.append(
        el("polyline", {
          points: tratto.map((p) => `${p[0]},${p[1]}`).join(" "),
          fill: "none",
          stroke: "var(--accent)",
          "stroke-width": 1.8,
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
        })
      );
    }
    tratto = [];
  };
  punti.forEach((p, i) => {
    if (p.valore == null) {
      chiudiTratto();
      svg.append(
        el("circle", { cx: x(i), cy: margineAlto + area - 1, r: 1.2, fill: "currentColor", opacity: 0.25 })
      );
      return;
    }
    tratto.push([x(i), y(p.valore)]);
  });
  chiudiTratto();

  // Un punto per ogni giorno con dato. I giorni con allenamento hanno il punto
  // più grande: la linea è tutta dello stesso colore, e senza questo si
  // perderebbe l'informazione che nel grafico a barre stava nel lime.
  const raggio = punti.length > 40 ? 1.4 : 2.2;
  punti.forEach((p, i) => {
    if (p.valore == null) return;
    svg.append(
      el("circle", {
        cx: x(i), cy: y(p.valore), r: p.evidenza ? raggio + 1.4 : raggio,
        fill: "var(--accent)", opacity: p.evidenza ? 1 : 0.85,
      })
    );
  });

  if (punti.length) {
    const primo = el("text", { x: 0, y: A - 5, "font-size": 8, fill: "currentColor", opacity: 0.4 });
    primo.textContent = dataBreve(punti[0].data);
    const ultimo = el("text", {
      x: L - 1, y: A - 5, "font-size": 8, "text-anchor": "end", fill: "currentColor", opacity: 0.4,
    });
    ultimo.textContent = dataBreve(punti[punti.length - 1].data);
    svg.append(primo, ultimo);
  }

  const lettura = h("p", {
    style:
      "margin:0 0 6px;min-height:17px;font-size:12px;line-height:17px;color:var(--label-secondary);" +
      "font-variant-numeric:tabular-nums",
  });
  lettura.textContent = invito;

  const guida = el("line", {
    y1: margineAlto, y2: margineAlto + area, stroke: "currentColor", "stroke-width": 1, opacity: 0,
  });
  const scelto = el("circle", {
    r: 4, fill: "var(--accent)", stroke: "var(--bg-grouped)", "stroke-width": 1.6, opacity: 0,
  });
  svg.append(guida, scelto);

  let selezionato = null;
  const mostra = (i) => {
    const p = punti[i];
    if (!p || i === selezionato) return;
    selezionato = i;
    guida.setAttribute("x1", x(i));
    guida.setAttribute("x2", x(i));
    guida.setAttribute("opacity", "0.2");
    if (p.valore != null) {
      scelto.setAttribute("cx", x(i));
      scelto.setAttribute("cy", y(p.valore));
      scelto.setAttribute("opacity", "1");
    } else {
      scelto.setAttribute("opacity", "0");
    }
    const giorno = GIORNI_ABBR[weekdayOf(p.data)];
    lettura.textContent =
      p.valore == null
        ? `${giorno} ${dataBreve(p.data)} · nessun dato`
        : `${giorno} ${dataBreve(p.data)} · ${formatta(p.valore)}${p.nota ? ` · ${p.nota}` : ""}`;
  };

  let premuto = false;
  const aggiorna = (e) => {
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const px = ((e.clientX - r.left) / r.width) * L;
    mostra(Math.max(0, Math.min(punti.length - 1, Math.floor(px / passo))));
  };
  svg.addEventListener("pointerdown", (e) => {
    premuto = true;
    aggiorna(e);
  });
  svg.addEventListener("pointermove", (e) => {
    if (premuto) aggiorna(e);
  });
  const rilascia = () => {
    premuto = false;
  };
  svg.addEventListener("pointerup", rilascia);
  svg.addEventListener("pointercancel", rilascia);
  svg.addEventListener("pointerleave", rilascia);
  svg.style.touchAction = "pan-y";
  svg.style.cursor = "pointer";

  return h("div", lettura, svg);
}

/** Scheda con titolo, numero grande e grafico. */
export function schedaGrafico({ titolo, valore, unita, nota, grafico, piede }) {
  return h(
    "div.group",
    h("h2", titolo),
    h(
      "div",
      { style: "background:var(--bg-grouped);border-radius:14px;padding:16px 14px 10px" },
      h(
        "div",
        { style: "display:flex;align-items:baseline;gap:8px;margin-bottom:12px" },
        h(
          "p",
          { style: "margin:0;font-size:26px;font-weight:700;letter-spacing:-0.6px;font-variant-numeric:tabular-nums" },
          valore,
          unita ? h("span", { style: "font-size:13px;font-weight:400;color:var(--label-secondary)" }, ` ${unita}`) : null
        ),
        nota ? h("p", { style: "margin:0;font-size:12px;color:var(--label-tertiary)" }, nota) : null
      ),
      grafico
    ),
    piede ? h("p.footnote", piede) : null
  );
}

export { GIORNI_CORTI };
