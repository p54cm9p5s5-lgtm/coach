/* Grafici in SVG, senza librerie.
   Un solo grafico in Home: il movimento giornaliero con i giorni di allenamento
   in evidenza, e i giorni già in programma sulla destra. */

import { h, num, dataBreve, weekdayOf, isoDate, sheet } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) n.setAttribute(k, String(v));
  }
  return n;
};

/**
 * Dove hai toccato, in coordinate del disegno.
 * Il disegno non riempie sempre tutto il riquadro: se le proporzioni non
 * combaciano il browser lo centra e lascia due margini ai lati. Contando solo
 * la larghezza del riquadro il tocco risultava spostato, e usciva il giorno
 * sbagliato. Questa conversione parte dal disegno vero, quindi è esatta comunque.
 */
function xNelDisegno(svg, clientX, clientY = 0) {
  const ctm = typeof svg.getScreenCTM === "function" ? svg.getScreenCTM() : null;
  if (ctm && typeof svg.createSVGPoint === "function") {
    const p = svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const dentro = p.matrixTransform(ctm.inverse());
    if (Number.isFinite(dentro.x)) return dentro.x;
  }
  return null;
}

/**
 * Un valore che non è un numero finito vale «non lo so», come un valore
 * assente.
 *
 * NaN e Infinity nascono da una divisione andata storta a monte, e arrivavano
 * fin dentro le coordinate del disegno: il browser rifiuta un attributo che
 * vale «NaN» e il grafico spariva tutto, non solo il punto sbagliato. Meglio
 * un buco nella linea — quello l'app lo sa già disegnare. */
const soloNumeri = (punti) =>
  (punti || []).map((p) => (Number.isFinite(p?.valore) ? p : { ...p, valore: null }));

const GIORNI_ABBR = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

/**
 * @param dati [{ data, kcal|null, obiettivo, allenamento: bool, presente, futuro, previsto }]
 */
export function graficoAttivita(dati, { altezza = 128, obiettivoRipiego = null } = {}) {
  // Stesso motivo di «soloNumeri»: un movimento che non è un numero finito è un
  // giorno senza dati, e va disegnato come tale — un trattino, non una barra
  // alta «NaN» che porta giù tutto il grafico.
  dati = (dati || []).map((d) => (Number.isFinite(d?.kcal) ? d : { ...d, kcal: null }));
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
  // L'obiettivo di riferimento è quello più recente, non il primo dell'elenco:
  // se lo cambi su Salute, la linea restava quella di settimane fa.
  const obiettivo =
    [...dati].reverse().find((d) => !d.futuro && d.obiettivo)?.obiettivo ||
    dati.find((d) => d.obiettivo)?.obiettivo ||
    obiettivoRipiego ||
    600;
  const massimo = Math.max(obiettivo * 1.2, ...valori, 1);
  const passo = L / Math.max(dati.length, 1);
  const larghezza = Math.max(1.5, Math.min(9, passo * 0.42));

  // linea dell'obiettivo
  const yObiettivo = areaBarre - (obiettivo / massimo) * areaBarre;
  svg.append(
    el("line", {
      x1: 0, x2: L, y1: yObiettivo, y2: yObiettivo,
      stroke: "currentColor", "stroke-width": 1, "stroke-dasharray": "3 4", opacity: 0.35,
    }),
    el("text", {
      x: L - 1, y: yObiettivo - 4, "font-size": 9.5, "text-anchor": "end",
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
            // In programma: contorno tratteggiato. Lo stato lo dice la forma,
            // non la tinta — qui la tinta è una sola.
            x, y: areaBarre - 9, width: larghezza, height: 9, rx: 0,
            fill: "none", stroke: "var(--label-tertiary)", "stroke-width": 1,
            "stroke-dasharray": "2 2",
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
          x, y: areaBarre - alt, width: larghezza, height: alt, rx: 0,
          fill: "var(--label)",
          opacity: d.allenamento ? 1 : 0.24,
        })
      );
    }


    // Etichette solo i lunedì e l'ultimo giorno — ma non tutte e due quando
    // cadono vicine: «31/08» e «01/09» finivano una sopra l'altra all'estremo
    // destro, e si leggeva una parola sola fatta di due date.
    const wd = new Date(d.data + "T00:00:00").getDay();
    const xCentro = x + larghezza / 2;
    const troppoVicinoAllEstremo = i !== dati.length - 1 && L - xCentro < 34;
    if ((wd === 1 && !troppoVicinoAllEstremo) || i === dati.length - 1) {
      const ultimo = i === dati.length - 1;
      const t = el("text", {
        x: ultimo ? L - 1 : xCentro, y: A - 8, "font-size": 9,
        "text-anchor": ultimo ? "end" : "middle",
        fill: "var(--label-tertiary)",
      });
      t.textContent = dataBreve(d.data).slice(0, 5);
      if (d.futuro) t.setAttribute("opacity", "0.55");
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
  const pallino = el("circle", { r: 2.6, fill: "var(--label)", opacity: 0 });
  svg.append(evidenza, pallino);

  const descrivi = (d) => {
    const giorno = GIORNI_ABBR[weekdayOf(d.data)];
    const data = `${giorno} ${dataBreve(d.data)}`;
    if (d.futuro) {
      if (d.origine?.scaduta) return `${data} · calendario non aggiornato`;
      if (d.origine?.oltreProgrammato) return `${data} · non ancora programmato`;
      if (d.origine?.nonLetta) return `${data} · calendario non letto`;
      return `${data} · ${d.previsto ? "allenamento in programma" : "niente in programma"}`;
    }
    if (!d.presente || d.kcal == null) {
      return `${data} · nessun dato${d.allenamento ? " · allenamento registrato" : d.previsto ? " · era previsto un allenamento" : ""}`;
    }
    // Oggi non è ancora finito: dire «riposo» a metà giornata è una sentenza
    // su qualcosa che deve ancora succedere.
    if (d.data === isoDate() && !d.allenamento) {
      const kcalOggi = `${Math.round(d.kcal).toLocaleString("it-IT")} kcal`;
      return `${data} · ${kcalOggi} · giornata in corso`;
    }
    const kcal = `${Math.round(d.kcal).toLocaleString("it-IT")} kcal`;
    const quota = d.obiettivo ? ` (${num((d.kcal / d.obiettivo) * 100)}% dell'obiettivo)` : "";
    // «Riposo» solo se il riposo era previsto: un allenamento in programma e
    // non fatto è un'altra cosa, e chiamarlo riposo lo nascondeva.
    const natura = d.allenamento ? "allenamento" : d.previsto ? "previsto ma non fatto" : "riposo";
    return `${data} · ${kcal}${quota} · ${natura}`;
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

  const indiceDa = (clientX, clientY) => {
    const x = xNelDisegno(svg, clientX, clientY);
    if (x == null) return null;
    return Math.max(0, Math.min(dati.length - 1, Math.floor(x / passo)));
  };

  let premuto = false;
  const aggiorna = (e) => {
    const i = indiceDa(e.clientX, e.clientY);
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
        h(
          "p",
          {
            style:
              "margin:0;font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--label-tertiary)",
          },
          v.etichetta
        ),
        h(
          "p",
          { style: "margin:6px 0 0;font-size:26px;font-weight:700;letter-spacing:-0.04em;font-variant-numeric:tabular-nums lining-nums;white-space:nowrap" },
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
      h("span", { style: `width:8px;height:8px;border-radius:2px;flex:none;box-sizing:border-box;${stile}` }),
      testo
    );
  return h(
    "div",
    { style: "display:flex;flex-wrap:wrap;gap:12px;margin-top:8px" },
    // Le chiavi hanno la forma della barra che spiegano: pieno, mezzo tono,
    // pallino, contorno tratteggiato. In una pagina di un colore solo la
    // legenda non può essere fatta di colori.
    punto("background:var(--label);border-radius:0;width:7px;height:12px", "allenamento"),
    punto("background:var(--label);opacity:.24;border-radius:0;width:7px;height:12px", "riposo"),
    punto("background:var(--label-tertiary);width:5px;height:5px;border-radius:50%", "nessun dato"),
    punto("background:none;border:1px dashed var(--label-tertiary);border-radius:0;width:7px;height:12px", "in programma")
  );
}

/* ---------- periodo mostrato ----------
   Tre finestre, uguali ovunque. Il grafico non va mai oltre il mese: piu
   indietro le colonne diventano illeggibili e non dicono niente in piu. */

export const PERIODI = [
  // «1 gg» è la giornata di oggi: un solo punto sul grafico, e le medie
  // diventano il valore di oggi. Serve a guardare la giornata da sola.
  { id: "1", etichetta: "1 gg", giorni: 1, graficoGiorni: 1, futuri: 0 },
  { id: "7", etichetta: "7 gg", giorni: 7, graficoGiorni: 7, futuri: 3 },
  { id: "30", etichetta: "1 mese", giorni: 30, graficoGiorni: 30, futuri: 7 },
  { id: "tutto", etichetta: "Sempre", giorni: null, graficoGiorni: 30, futuri: 7 },
];

/* La finestra è una sola per tutta l'app: cambiarla da un grafico qualunque
   sposta anche tutti gli altri, così i numeri che guardi insieme parlano
   sempre dello stesso periodo. */
const CHIAVE_PERIODO = "coach-periodo";
/** Il punteggio Salute in Home ha il suo, staccato da tutti gli altri grafici. */
export const CHIAVE_PERIODO_SALUTE = "coach-periodo-salute";

/**
 * Il periodo scelto. Chi non dice niente usa quello condiviso da tutti i
 * grafici; chi passa una chiave sua ne tiene uno indipendente — serve al
 * punteggio Salute in Home, che si guarda con un occhio diverso dal resto e
 * non deve trascinare tutte le altre schede quando lo sposti.
 */
export function periodoSalvato(predefinito = "tutto", chiave = CHIAVE_PERIODO) {
  try {
    const id = localStorage.getItem(chiave);
    return PERIODI.find((p) => p.id === id) || PERIODI.find((p) => p.id === predefinito) || PERIODI[1];
  } catch {
    return PERIODI.find((p) => p.id === predefinito) || PERIODI[1];
  }
}

export function selettorePeriodo(periodo, onCambia, chiave = CHIAVE_PERIODO) {
  return h(
    "div.segmented",
    { style: "margin:0 0 12px" },
    ...PERIODI.map((p) =>
      h(
        "button",
        {
          "aria-pressed": p.id === periodo.id,
          // 44 px come tutto il resto: erano 34 e in quattro su una riga sola
          // il dito ne prendeva facilmente uno accanto a quello mirato.
          style: "min-height:44px;font-size:14px",
          onclick: async () => {
            if (p.id === periodo.id) return;
            try {
              localStorage.setItem(chiave, p.id);
            } catch {
              /* senza localStorage la scelta vale solo per questa schermata */
            }
            await onCambia();
          },
        },
        p.etichetta
      )
    )
  );
}

/** Come si chiama la finestra scelta, per scriverlo accanto ai numeri. */
export function etichettaPeriodo(periodo) {
  if (periodo.id === "1") return "oggi";
  if (periodo.id === "7") return "ultimi 7 giorni";
  if (periodo.id === "30") return "ultimo mese";
  return "tutto lo storico";
}

/** Prima data compresa nella finestra, o null se la finestra e «sempre». */
export function inizioPeriodo(periodo, oggi) {
  if (!periodo.giorni) return null;
  const d = new Date(oggi + "T00:00:00");
  d.setDate(d.getDate() - (periodo.giorni - 1));
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
  // Con l'asse che parte sempre da zero una curva di battito — che vive fra 70
  // e 160 — si schiaccia in una striscia alta un dito. `minimo` la lascia
  // respirare; a zero, che è il valore di prima, tutti gli altri grafici
  // restano identici.
  minimo = 0,
  // Un punto non è per forza un giorno: dentro un allenamento è un istante, e
  // «gio 13/08 · 132» sarebbe la data sbagliata ripetuta duecento volte. Chi
  // chiama può dire come si legge un punto e cosa scrivere ai due estremi.
  etichetta = null,
  estremo = null,
}) {
  punti = soloNumeri(punti);
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
  const massimo = Math.max(obiettivo ? obiettivo * 1.08 : 0, ...valori, minimo + 1);
  const passo = L / Math.max(punti.length, 1);
  const x = (i) => i * passo + passo / 2;
  const y = (v) => margineAlto + area - ((v - minimo) / (massimo - minimo)) * area;

  // L'etichetta del bersaglio si disegna per ultima: messa qui, la linea dei
  // dati le passava sopra e il rettangolo di carta non serviva a niente.
  let etichettaSopra = null;
  if (obiettivo) {
    const yo = y(obiettivo);
    svg.append(
      el("line", {
        x1: 0, x2: L, y1: yo, y2: yo,
        stroke: "currentColor", "stroke-width": 1, "stroke-dasharray": "3 4", opacity: 0.28,
      })
    );
    if (etichettaObiettivo) {
      // Il bersaglio scritto sulla sua riga: è l'unica riga di quel paragrafo
      // grigio che serviva a ogni occhiata, e adesso sta dove serve.
      // A destra ci finisce sempre l'ultimo punto — quello grande, quello che
      // guardi — e l'etichetta ci passava sopra. A sinistra c'è più spazio, ma
      // «più spazio» non è «sempre libero»: la linea può passare di lì. Sotto
      // l'etichetta si stampa un rettangolo del colore della carta, e la
      // scritta resta leggibile qualunque cosa le passi sotto.
      const larghezzaStimata = etichettaObiettivo.length * 5.4 + 6;
      etichettaSopra = el("g", {});
      etichettaSopra.append(
        el("rect", { x: 0, y: yo - 13, width: larghezzaStimata, height: 12, fill: "var(--bg)" })
      );
      const t = el("text", {
        x: 3, y: yo - 4, "font-size": 9.5, "text-anchor": "start",
        fill: "var(--label-tertiary)", "letter-spacing": "0.04em",
      });
      t.textContent = etichettaObiettivo;
      etichettaSopra.append(t);
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
          stroke: "var(--label)",
          "stroke-width": 1.4,
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
  // L'ultimo punto con un dato è quello che stai guardando: si vede di più.
  // Che abbia passato il bersaglio o no lo dice la sua posizione rispetto alla
  // riga tratteggiata — che è lì apposta — non una tinta diversa.
  let ultimoConDato = -1;
  punti.forEach((p, i) => {
    if (p.valore != null) ultimoConDato = i;
  });
  punti.forEach((p, i) => {
    if (p.valore == null) return;
    const finale = i === ultimoConDato;
    svg.append(
      el("circle", {
        cx: x(i), cy: y(p.valore), r: finale ? raggio + 1.6 : p.evidenza ? raggio + 1 : raggio,
        fill: "var(--label)",
        opacity: finale || p.evidenza ? 1 : 0.55,
      })
    );
  });

  if (etichettaSopra) svg.append(etichettaSopra);

  const aiBordi = estremo || ((p) => dataBreve(p.data));
  if (punti.length) {
    const primo = el("text", { x: 0, y: A - 4, "font-size": 9.5, fill: "var(--label-tertiary)" });
    primo.textContent = aiBordi(punti[0]);
    svg.append(primo);
    // Un solo giorno: la stessa data ai due estremi sembrava un intervallo.
    if (punti.length > 1 && aiBordi(punti[0]) !== aiBordi(punti[punti.length - 1])) {
      const ultimo = el("text", {
        x: L - 1, y: A - 4, "font-size": 9.5, "text-anchor": "end", fill: "var(--label-tertiary)",
      });
      ultimo.textContent = aiBordi(punti[punti.length - 1]);
      svg.append(ultimo);
    }
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
    r: 4, fill: "var(--label)", stroke: "var(--bg)", "stroke-width": 1.6, opacity: 0,
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
    if (etichetta) {
      lettura.textContent = etichetta(p);
      return;
    }
    const giorno = GIORNI_ABBR[weekdayOf(p.data)];
    lettura.textContent =
      p.valore == null
        ? `${giorno} ${dataBreve(p.data)} · nessun dato`
        : `${giorno} ${dataBreve(p.data)} · ${formatta(p.valore)}${p.nota ? ` · ${p.nota}` : ""}`;
  };

  let premuto = false;
  const aggiorna = (e) => {
    const px = xNelDisegno(svg, e.clientX, e.clientY);
    if (px == null) return;
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
export function schedaGrafico({ titolo, valore, unita, nota, grafico, piede, selettore = null }) {
  return h(
    "div.group",
    h(
      "div",
      { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px" },
      // L'unità di misura sta qui, nell'occhiello, non accanto alla cifra:
      // con «1144» a corpo 56 la parola «kcal» finiva a capo su una riga sua.
      h(
        "h2",
        { style: "margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.16em;color:var(--label-tertiary)" },
        unita ? `${titolo} · ${unita}` : titolo
      ),
      // Difetto numero uno: sotto ogni grafico c'era un paragrafo grigio di
      // tre righe — obiettivo, provenienza del dato, che cosa vogliono dire i
      // punti grandi. Roba giusta, letta una volta sola e poi per sempre in
      // mezzo ai piedi. Non si butta: si mette qui dietro, e ci si torna
      // quando serve. Quello che invece serve OGNI volta — il bersaglio — è
      // rimasto sul grafico, scritto sulla sua riga tratteggiata.
      piede ? tastoSpiegazione(titolo, piede) : null
    ),
    selettore,
    // La cifra su una riga sua e la copertura sotto: affiancate, «12.421» e
    // «27 giorni con dati · tutto lo storico» non ci stanno insieme in 350
    // punti, e la seconda usciva dallo schermo a destra.
    h(
      "div",
      { style: "margin:2px 0 14px" },
      h(
        "p",
        {
          style:
            "margin:0;font-size:56px;font-weight:700;letter-spacing:-0.055em;line-height:.9;" +
            "font-variant-numeric:tabular-nums lining-nums;white-space:nowrap;" +
            "overflow:hidden;text-overflow:clip",
        },
        valore
      ),
      nota
        ? h("p", { style: "margin:8px 0 0;font-size:12.5px;line-height:1.35;color:var(--label-tertiary)" }, nota)
        : null
    ),
    grafico
  );
}

/** Il tondino «i»: apre la spiegazione che prima stava sotto al grafico. */
export function tastoSpiegazione(titolo, testo) {
  const b = h(
    "button",
    {
      type: "button",
      "aria-label": `Come si legge: ${titolo}`,
      style:
        "flex:none;width:26px;height:26px;min-width:26px;border-radius:999px;border:1px solid var(--separator);" +
        "background:none;color:var(--label-tertiary);font-size:12px;font-weight:700;font-style:italic;cursor:pointer;" +
        "display:flex;align-items:center;justify-content:center;padding:0",
      onclick: () =>
        sheet((close) =>
          h(
            "div",
            h("h2", { style: "text-align:center" }, titolo),
            h(
              "p",
              { style: "margin:10px 22px 0;font-size:15px;line-height:1.5;color:var(--label-secondary)" },
              testo
            ),
            h("div.btn-wrap", h("button.btn", { onclick: () => close(true) }, "Ho capito"))
          )
        ),
    },
    "i"
  );
  // L'area toccabile arriva a 44 punti senza che il tondino cresca.
  b.style.padding = "0";
  b.style.margin = "-9px 0";
  b.style.boxSizing = "content-box";
  b.style.borderWidth = "1px";
  b.style.outlineOffset = "2px";
  const guscio = h(
    "span",
    { style: "display:flex;align-items:center;justify-content:center;width:44px;height:44px;margin:-9px -9px -9px 0" },
    b
  );
  return guscio;
}

/**
 * Il battito di un allenamento, come lo disegna l'orologio.
 *
 * Una barretta per momento, alta quanto il battito è ballato in quei secondi:
 * è la forma che ha sull'Apple Watch, e dice una cosa in più della linea —
 * quanto era stabile. Dove l'orologio non ha misurato non c'è barretta, e il
 * vuoto si vede.
 *
 * Il rosso non viene dal tema: il battito è rosso ovunque, sull'orologio e
 * nell'app Salute, e cambiarlo col tema significherebbe non farlo riconoscere.
 * Il fondo della scheda invece è quello del tema, e le due tinte sono scelte
 * per restare leggibili sia sul chiaro sia sullo scuro.
 */
export function graficoBattito({ caselle, inizioSec, durataSec, media = null, altezza = 150 }) {
  const validi = caselle.filter((c) => c != null);
  const L = 320;
  const A = altezza;
  const bassoTesti = 16;
  const altoTesti = 12;
  const area = A - bassoTesti - altoTesti;

  const massimo = Math.max(...validi.map((c) => c.max));
  const minimo = Math.min(...validi.map((c) => c.min));
  // Un po' d'aria sopra e sotto, come fa l'orologio: le barrette non toccano
  // mai i bordi, se no sembrano tagliate.
  const alto = Math.ceil((massimo + 6) / 5) * 5;
  const basso = Math.max(0, Math.floor((minimo - 6) / 5) * 5);
  const y = (v) => altoTesti + area - ((v - basso) / Math.max(1, alto - basso)) * area;

  const svg = el("svg", {
    viewBox: `0 0 ${L} ${A}`,
    width: "100%",
    height: A,
    role: "img",
    "aria-label": `Battito durante l'allenamento, da ${Math.round(minimo)} a ${Math.round(massimo)} battiti al minuto`,
    style: "display:block",
  });

  const passo = L / Math.max(caselle.length, 1);
  const larghezza = Math.max(1.4, Math.min(4, passo * 0.55));

  // Le due righe verticali dei terzi, come sull'orologio: danno il senso del
  // tempo senza riempire il grafico di griglia.
  for (const frazione of [1 / 3, 2 / 3]) {
    svg.append(
      el("line", {
        x1: L * frazione, x2: L * frazione, y1: altoTesti, y2: altoTesti + area,
        stroke: "currentColor", "stroke-width": 1, opacity: 0.16,
      })
    );
  }

  caselle.forEach((c, i) => {
    if (!c) return;
    const x = i * passo + passo / 2;
    const yAlto = y(c.max);
    const yBasso = y(c.min);
    svg.append(
      el("line", {
        x1: x, x2: x, y1: yAlto, y2: Math.max(yBasso, yAlto + larghezza * 0.9),
        stroke: "var(--battito)",
        "stroke-width": larghezza,
        "stroke-linecap": "round",
      })
    );
  });

  // Il massimo scritto in alto a destra: è il numero che si cerca per primo.
  const etMax = el("text", {
    x: L - 1, y: altoTesti - 3, "font-size": 9, "text-anchor": "end",
    fill: "currentColor", opacity: 0.5,
  });
  etMax.textContent = String(Math.round(massimo));
  svg.append(etMax);

  const oraDa = (sec) => {
    const s = ((Math.round(sec) % 86400) + 86400) % 86400;
    const p = (n) => String(n).padStart(2, "0");
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}`;
  };
  [0, 1 / 3, 2 / 3].forEach((frazione) => {
    const t = el("text", {
      x: frazione === 0 ? 0 : L * frazione + 2,
      y: A - 4, "font-size": 8, fill: "currentColor", opacity: 0.45,
    });
    t.textContent = oraDa(inizioSec + durataSec * frazione);
    svg.append(t);
  });

  const lettura = h("p", {
    style:
      "margin:0 0 6px;min-height:17px;font-size:12px;line-height:17px;color:var(--label-secondary);" +
      "font-variant-numeric:tabular-nums",
  });
  lettura.textContent = "Tocca il grafico per leggere un momento";

  const guida = el("line", {
    y1: altoTesti, y2: altoTesti + area, stroke: "currentColor", "stroke-width": 1, opacity: 0,
  });
  svg.append(guida);

  let scelto = null;
  const mostra = (i) => {
    const c = caselle[i];
    if (i === scelto) return;
    scelto = i;
    const x = i * passo + passo / 2;
    guida.setAttribute("x1", x);
    guida.setAttribute("x2", x);
    guida.setAttribute("opacity", "0.28");
    /* L'ora si ricava dalla stessa frazione con cui la barretta è disegnata
       — il suo centro, `(i + 0,5) / quante` — non da `i / (quante − 1)`.
       Sono due conti diversi: il secondo spalma le caselle fra il primo e
       l'ultimo pixel, il disegno le mette al centro del loro spicchio. La
       differenza è mezza casella, e su una camminata di tre ore divisa in
       dodici caselle diventava **undici minuti**: il dito su «10:00»
       dell'asse leggeva «09:49». Con questa frazione la riga verticale, l'ora
       scritta e l'etichetta dell'asse cadono tutte sullo stesso pixel. */
    const ora = oraDa(inizioSec + (durataSec * (i + 0.5)) / Math.max(1, caselle.length));
    lettura.textContent = !c
      ? `${ora} · nessuna misura`
      : c.min === c.max
        ? `${ora} · ${Math.round(c.min)} bpm`
        : `${ora} · da ${Math.round(c.min)} a ${Math.round(c.max)} bpm`;
  };

  let premuto = false;
  const aggiorna = (e) => {
    const px = xNelDisegno(svg, e.clientX, e.clientY);
    if (px == null) return;
    mostra(Math.max(0, Math.min(caselle.length - 1, Math.floor(px / passo))));
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

  return h(
    "div",
    { style: "background:var(--bg-grouped);border-radius:14px;padding:12px 14px 6px" },
    lettura,
    svg,
    media != null
      ? h(
          "p",
          { style: "margin:6px 0 4px;font-size:11px;font-weight:700;letter-spacing:0.4px;color:var(--battito)" },
          `${Math.round(media)} BPM IN MEDIA`
        )
      : null
  );
}
