/* Contatore delle sigarette.

   Il numero occupa tutto lo schermo ed è inchiostro fino a nove, rosso da
   dieci: due stati, non una scala, perché il tetto dichiarato è zero e davanti
   a una regola netta un semaforo a quattro gradini racconta una storia sfumata
   che non c'è. Nessuna frase di rimprovero — un'app che ti sgrida a ogni tocco
   è un'app che si smette di usare, e un conteggio smesso è peggio di nessun
   conteggio, perché fa sembrare buone delle giornate che non lo sono state. */

import { h, aggiungi, chiedi, dataBreve, dataLunga, isoDate, toast, unaVoltaSola } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";

/** Due stati soli: inchiostro fino a nove, rosso da dieci. Il perché è sotto. */
function colore(n) {
  // Il tetto dichiarato è zero: qui non c'è una scala di grigi da percorrere,
  // c'è una riga superata o no. Zero è inchiostro come il resto — la parola
  // sotto dice «il massimo è zero, e ci sei» — e dalla decima il numero
  // diventa rosso, che in questa app non è un accento ma un allarme.
  //
  // Prima erano quattro gradini (giallo da 4, arancione da 7, rosso da 10): un
  // semaforo che raccontava una storia sfumata dove la regola è netta.
  if (n >= 10) return "var(--red)";
  return "var(--label)";
}

/**
 * Il segnale «vietato fumare», a sole linee.
 *
 * Prende lo stesso identico colore del numero: inchiostro fino a nove, rosso
 * da dieci. Un colore solo per tutta la schermata, così non c'è modo di
 * leggere due segnali diversi.
 */
function sigarettaSvg(tinta) {
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
    stroke: tinta,
    "stroke-width": 7,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  // Sigaretta e fumo scendono di 9 rispetto al centro geometrico. Il fumo sta
  // tutto sopra, quindi centrare la sigaretta esatta lascia il vuoto sotto e
  // l'occhio legge il disegno spostato in alto. Anche il cartello vero mette
  // la sigaretta appena sotto la metà, per la stessa ragione.
  const motivo = el("g", { transform: "translate(0 9)" });
  motivo.append(
    // la sigaretta e i tre segmenti della parte che brucia
    el("rect", { x: 40, y: 89, width: 88, height: 22, rx: 3 }),
    el("path", { d: "M138 89v22M149 89v22M160 89v22" }),
    // Le due volute salgono tutte e due dalla punta che brucia. Quella esterna
    // è più corta: più in alto il cerchio si stringe e la toccherebbe.
    el("path", { d: "M154 82C154 72 143 72 143 62 143 52 154 52 154 44" }),
    el("path", { d: "M140 82C140 70 128 70 128 58 128 46 140 46 140 34" })
  );
  g.append(
    motivo,
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
  // Aprire questa sezione accende il conteggio: da oggi «nessuna riga» vuol
  // dire zero sigarette, non «non lo stavo contando».
  await store.accendiConteggioFumo(oggi);
  // Il limite non è più fisso: scende ogni volta che una giornata chiude sotto
  // di lui, e da lì non risale. Serve quello di OGGI, non quello del brief.
  const {limiti, corrente: limiteDomani, partenza} = await store.limitiFumo(oggi);
  const tollerate = limiti.get(oggi) ?? partenza;
  const tettoDichiarato = await store.tettoFumoDichiarato();
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
        sigarettaSvg(tinta),
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
        tollerate === 0
          ? quante === 0
            ? " · il massimo è zero, e ci sei"
            : ` · il massimo è zero: ${quante} ${quante === 1 ? "di troppo" : "di troppo"}`
          : quante > tollerate
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
            // Due righe di orari e non di più: la schermata ha un'altezza fissa
            // e questa riga non deve spingere via i tasti. Ma il taglio non può
            // essere muto — con venti sigarette gli ultimi orari sparivano e
            // niente diceva che c'erano. Ora si scorre: quello che non ci sta
            // resta raggiungibile invece di svanire.
            "text-align:center;flex:none;max-height:34px;overflow-y:auto;overscroll-behavior:contain",
        },
        dOggi.length
          ? `Orari: ${dOggi.map((x) => oraDi(x.ts)).join(" · ")}`
          : "Tocca «+» ogni volta che fumi. Il «−» serve quando premi per sbaglio."
      )
    )
  );

  // ---- i giorni precedenti, sotto ----
  const primo = await store.fumoContatoDal();
  if (primo) {
    const conteggi = await store.conteggioFumo();
    const righe = h("div.list");
    const d = new Date(oggi + "T00:00:00");
    let mostrati = 0;
    let totale = 0;
    let contati = 0;
    // Il più basso fra i giorni PRECEDENTI a quello che si sta disegnando: si
    // scorre all'indietro, quindi si calcola prima, in avanti, una volta sola.
    const minimiPrecedenti = new Map();
    (() => {
      const giorni = [...conteggi.keys()].filter((g) => g >= primo && g < oggi).sort();
      let min = Infinity;
      for (const g of giorni) {
        minimiPrecedenti.set(g, min);
        min = Math.min(min, conteggi.get(g) || 0);
      }
    })();
    while (mostrati < 14) {
      const p = (n) => String(n).padStart(2, "0");
      const data = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      if (data < primo) break;
      const n = conteggi.get(data) || 0;
      const minimoFinora = minimiPrecedenti.has(data) ? minimiPrecedenti.get(data) : Infinity;
      totale += n;
      contati++;
      if (data !== oggi) {
        aggiungi(righe,
          h(
            "div.row",
            h("div.main", h("span.title", dataLunga(data))),
            h("span.value", { style: `color:${colore(n)}` }, String(n)),
            // Ogni giorno va giudicato col limite che aveva lui, non con quello di oggi.
            (() => {
              const suo = limiti.get(data) ?? partenza;
              if (n === 0) return h("span.pill.ok", "zero");
              if (n > suo) return h("span.pill.warn", "oltre");
              // «Nuovo minimo» solo se lo è davvero rispetto a tutti i giorni
              // contati prima: scritto su ogni giornata sotto soglia diventava
              // una parola d'arredamento. Il minimo di prima si tiene mentre si
              // scorre indietro, giorno per giorno.
              if (n < suo) return h("span.pill.ok", n < minimoFinora ? "nuovo minimo" : "sotto il massimo");
              return null;
            })()
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
              (tollerate === 0
                ? "Il massimo è zero: ogni sigaretta pesa sul punteggio Salute e la giornata non supera 50."
                : `Le sigarette pesano sul punteggio Salute: zero vale pieno, ${tollerate} vale zero, oltre ${tollerate} la giornata non supera 50.`) +
              (tettoDichiarato && tettoDichiarato.massimo === 0 && tettoDichiarato.dal > oggi
                ? ` Hai deciso che da domani il massimo è zero.`
                : limiteDomani < tollerate
                  ? ` Oggi hai abbassato l'asticella: da domani il massimo è ${limiteDomani}.`
                  : "")
          ),
          // Fumare senza segnare capita. Un giorno segnato a metà è peggio di un
          // giorno non segnato: il primo entra nel punteggio come dato vero e lo
          // gonfia, il secondo resta fuori e si vede che manca.
          h(
            "div.btn-wrap",
            h(
              "button.btn.secondary",
              {
                onclick: unaVoltaSola(async () => {
                  const conta = await store.conteggioFumo();
                  let quante = 0;
                  for (const [g, n] of conta) if (g < oggi) quante += n;
                  const scelta = await chiedi({
                    titolo: "Far ripartire il conteggio da oggi?",
                    testo:
                      `I giorni prima di oggi smettono di contare: non valgono «zero sigarette», valgono «non contati», e restano fuori dal punteggio Salute invece di regalare punti.` +
                      (quante
                        ? `\n\nLe ${quante} ${quante === 1 ? "sigaretta segnata" : "sigarette segnate"} prima di oggi ${quante === 1 ? "viene cancellata" : "vengono cancellate"}. Non si torna indietro.`
                        : "\n\nPrima di oggi non c'è niente di segnato."),
                    opzioni: [{ etichetta: "Riparti da oggi", valore: "si" }],
                  });
                  if (scelta !== "si") return;
                  const esito = await store.riparteConteggioFumo(oggi);
                  toast(
                    esito.rimosse
                      ? `Conteggio da oggi. ${esito.rimosse} ${esito.rimosse === 1 ? "riga rimossa" : "righe rimosse"}.`
                      : "Conteggio da oggi."
                  );
                  await ridisegna();
                }),
              },
              "Il conteggio riparte da oggi"
            ),
            // Una volta dichiarato lo zero il tasto non serve più: la decisione
            // è presa e non si può disfare da qui.
            tettoDichiarato?.massimo === 0 ? null : h("div", { style: "height:10px" }),
            // La tacca scende da sé quando tocchi un nuovo minimo, ma «da domani
            // basta» è una decisione, non una conseguenza dei numeri. Questo
            // tasto la scrive, e da lì in poi il massimo non risale più.
            tettoDichiarato?.massimo === 0 ? null : h(
              "button.btn.secondary",
              {
                onclick: unaVoltaSola(async () => {
                  const domani = (() => {
                    const d = new Date(oggi + "T00:00:00");
                    d.setDate(d.getDate() + 1);
                    const p = (n) => String(n).padStart(2, "0");
                    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
                  })();
                  const scelta = await chiedi({
                    titolo: "Da domani il massimo è zero?",
                    testo:
                      "I giorni fino a oggi restano giudicati con la soglia che avevano: non si riscrive niente del passato.\n\n" +
                      "Da domani ogni sigaretta conta come oltre il massimo, e la giornata non supera 50 nel punteggio Salute. Il massimo non risale più da solo.",
                    opzioni: [{ etichetta: "Sì, da domani zero", valore: "si" }],
                  });
                  if (scelta !== "si") return;
                  await store.dichiaraTettoFumo(0, domani);
                  toast("Da domani il massimo è zero.");
                  await ridisegna();
                }),
              },
              "Da domani il massimo è zero"
            )
          )
        )
      );
    }
  }

  return wrap;
}

function oraDi(ts) {
  const d = new Date(ts);
  // Una riga senza istante — da un backup vecchio o rovinato — stampava
  // «NaN:NaN» in mezzo agli orari veri. Un dato che manca si scrive come
  // mancante, non come un guasto.
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
