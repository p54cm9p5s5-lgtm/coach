/* Punteggio 0-100 di un esercizio appena finito.
   Non è un voto morale: è la distanza fra quello che il programma chiedeva e
   quello che è stato eseguito. 100 solo se ripetizioni, carico, tecnica e
   intensità sono tutti a posto — se manca un pezzo, il punteggio dice quale. */

import { h, num } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, String(v));
  return n;
};

const limita = (v) => Math.max(0, Math.min(1, v));

/**
 * @param variante  riga dello split: serie, ripMin/ripMax, carico previsto
 * @param serie     serie registrate per questo esercizio
 * @param rpe, tecnica, dolorePolso  risposte del questionario (possono mancare)
 */
export function punteggioEsercizio({ variante, serie, rpe, tecnica, dolorePolso, regole }) {
  const voci = [];

  // --- ripetizioni: quanto del lavoro previsto è stato davvero fatto
  const bersaglioUnita = variante.aTempo ? variante.durataSec : variante.ripMax ?? variante.ripMin;
  const bersaglio = (variante.serie || 0) * (bersaglioUnita || 0);
  const fatte = serie.reduce((t, s) => t + (s.ripFatte || 0), 0);
  const quotaRip = bersaglio ? limita(fatte / bersaglio) : serie.length ? 1 : 0;
  voci.push({
    nome: variante.aTempo ? "Secondi" : "Ripetizioni",
    quota: quotaRip,
    peso: 35,
    dettaglio: bersaglio ? `${fatte} su ${bersaglio}` : `${serie.length} serie`,
  });

  // --- carico: raggiungere il previsto vale pieno, superarlo non è un merito
  const previsto = variante.carico;
  const usato = serie.filter((s) => s.carico != null).at(-1)?.carico ?? null;
  if (previsto == null) {
    voci.push({ nome: "Carico", quota: serie.length ? 1 : 0, peso: 25, dettaglio: "corpo libero" });
  } else {
    const quota = usato == null ? 0 : limita(usato / previsto);
    voci.push({
      nome: "Carico",
      quota,
      peso: 25,
      dettaglio:
        usato == null
          ? "non registrato"
          : usato > previsto
            ? `${num(usato)} kg, previsti ${num(previsto)}`
            : `${num(usato)} su ${num(previsto)} kg`,
    });
  }

  // --- tecnica: il giudizio che nel brief viene prima di tutto
  voci.push({
    nome: "Tecnica",
    quota: tecnica == null ? 0 : limita(tecnica / 10),
    peso: 30,
    dettaglio: tecnica == null ? "non valutata" : `${num(tecnica)} su 10`,
  });

  // --- intensità: dentro la zona prevista, non più su e non più giù
  const zona = regole.rpeTarget;
  let quotaRpe = 0;
  if (rpe != null) {
    if (rpe >= zona.min && rpe <= zona.max) quotaRpe = 1;
    else {
      const distanza = rpe < zona.min ? zona.min - rpe : rpe - zona.max;
      quotaRpe = limita(1 - distanza * 0.5);
    }
  }
  voci.push({
    nome: "Intensità",
    quota: quotaRpe,
    peso: 10,
    dettaglio: rpe == null ? "RPE non dato" : `RPE ${rpe}, zona ${zona.min}-${zona.max}`,
  });

  let totale = Math.round(voci.reduce((t, v) => t + v.quota * v.peso, 0));

  const penalita = [];
  if (dolorePolso) {
    penalita.push({ nome: "Dolore al polso", punti: -15 });
    totale = Math.max(0, totale - 15);
  }

  return { totale, voci, penalita, completo: rpe != null && tecnica != null };
}

export function giudizio(totale) {
  if (totale >= 90) return { testo: "ottimo", livello: 3 };
  if (totale >= 70) return { testo: "sufficiente", livello: 2 };
  return { testo: "da rivedere", livello: 1 };
}

/** Anello grande con il numero al centro. */
export function anello(totale, { etichetta = "Completezza", dimensione = 176 } = {}) {
  const R = 76;
  const CIRC = 2 * Math.PI * R;
  const svg = el("svg", {
    viewBox: "0 0 176 176",
    width: dimensione,
    height: dimensione,
    style: "transform:rotate(-90deg);display:block",
    "aria-hidden": "true",
  });
  svg.append(
    el("circle", { cx: 88, cy: 88, r: R, fill: "none", stroke: "currentColor", "stroke-width": 9, opacity: 0.14 }),
    el("circle", {
      cx: 88, cy: 88, r: R, fill: "none", stroke: "var(--accent)", "stroke-width": 9,
      "stroke-linecap": "round", "stroke-dasharray": CIRC,
      "stroke-dashoffset": CIRC * (1 - limita(totale / 100)),
      style: "transition:stroke-dashoffset .45s ease",
    })
  );

  return h(
    "div",
    { style: `position:relative;width:${dimensione}px;height:${dimensione}px;margin:0 auto` },
    svg,
    h(
      "div",
      {
        style:
          "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px",
      },
      h(
        "p",
        { style: "margin:0;font-size:44px;font-weight:700;letter-spacing:-1.5px;font-variant-numeric:tabular-nums;line-height:1" },
        String(totale)
      ),
      h(
        "p",
        { style: "margin:0;font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--label-secondary)" },
        etichetta
      )
    )
  );
}

/** Righe della scomposizione, con l'indicatore a tre segmenti. */
export function scomposizione(risultato) {
  const riga = (nome, quota, dettaglio) => {
    const g = giudizio(Math.round(quota * 100));
    const segmenti = h(
      "div",
      { style: "display:flex;gap:3px;align-items:center" },
      ...[1, 2, 3].map((i) =>
        h("span", {
          style:
            `width:14px;height:3px;border-radius:2px;background:${
              i <= g.livello
                ? g.livello === 1
                  ? "var(--orange)"
                  : g.livello === 2
                    ? "var(--label-secondary)"
                    : "var(--accent)"
                : "var(--fill-tertiary)"
            }`,
        })
      )
    );
    return h(
      "div.row",
      h("div.main", h("span.title", nome), dettaglio ? h("span.sub", dettaglio) : null),
      segmenti,
      h(
        "span.value",
        { style: "min-width:44px;font-variant-numeric:tabular-nums;color:var(--label)" },
        `${Math.round(quota * 100)}%`
      )
    );
  };

  const lista = h("div.list", ...risultato.voci.map((v) => riga(v.nome, v.quota, v.dettaglio)));
  for (const p of risultato.penalita) {
    lista.append(
      h(
        "div.row",
        h("div.main", h("span.title", p.nome)),
        h("span.pill.bad", `${p.punti}`)
      )
    );
  }
  return lista;
}

export function legenda() {
  const voce = (colore, testo) =>
    h(
      "span",
      { style: "display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--label-secondary)" },
      h("span", { style: `width:14px;height:3px;border-radius:2px;background:${colore}` }),
      testo
    );
  return h(
    "div",
    { style: "display:flex;gap:14px;justify-content:center;margin-top:10px" },
    voce("var(--orange)", "da rivedere"),
    voce("var(--label-secondary)", "sufficiente"),
    voce("var(--accent)", "ottimo")
  );
}

/** Frase che spiega il numero, invece di lasciarlo lì da interpretare. */
export function commento(risultato, nomeEsercizio) {
  if (!risultato.completo) return "Rispondi a intensità e tecnica per completare la valutazione.";
  const peggiore = [...risultato.voci].sort((a, b) => a.quota - b.quota)[0];
  if (risultato.penalita.length) {
    return `Il dolore al polso pesa più di ogni altra cosa: finché c'è, ${nomeEsercizio.toLowerCase()} non va caricato.`;
  }
  if (risultato.totale >= 90) return "Esecuzione piena: ripetizioni, carico e tecnica sono tutti al loro posto.";
  if (peggiore.quota >= 0.9) return "Manca poco al pieno, e non c'è un punto debole singolo.";
  return `Il punto debole è ${peggiore.nome.toLowerCase()}: ${peggiore.dettaglio}.`;
}
