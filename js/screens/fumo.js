/* Contatore delle sigarette.

   Nessun giudizio scritto sullo schermo: il numero e il punteggio Salute
   dicono già tutto, e un'app che rimprovera a ogni tocco è un'app che si
   smette di usare — e un conteggio smesso vale meno di zero, perché fa
   sembrare buoni giorni che non lo sono stati. */

import { h, aggiungi, dataBreve, dataLunga, isoDate, toast, unaVoltaSola } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";
import { anello, giudizio } from "../punteggio.js";

export async function render({ ridisegna }) {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Fumo"));

  const oggi = isoDate();
  const reg = store.regole().salute || {};
  const tollerate = reg.sigaretteTollerate ?? 10;
  const dOggi = await store.sigaretteDi(oggi);
  const quante = dOggi.length;

  // ---- il contatore ----
  const numero = h(
    "p",
    {
      style:
        "margin:0;font-size:76px;line-height:1;font-weight:700;letter-spacing:-2px;" +
        `font-variant-numeric:tabular-nums;color:${quante > tollerate ? "var(--orange)" : "var(--label)"}`,
    },
    String(quante)
  );

  const meno = h(
    "button.btn.secondary",
    {
      "aria-label": "una sigaretta in meno",
      disabled: quante === 0,
      onclick: unaVoltaSola(async () => {
        const tolta = await store.togliSigaretta(oggi);
        if (!tolta) return;
        await ridisegna();
      }),
    },
    "−"
  );

  const piu = h(
    "button.btn",
    {
      "aria-label": "una sigaretta in più",
      onclick: unaVoltaSola(async () => {
        await store.segnaSigaretta(oggi);
        await ridisegna();
      }),
    },
    "+"
  );

  aggiungi(wrap,
    h(
      "div.group",
      h("h2", "Oggi"),
      h(
        "div",
        { style: "background:var(--bg-grouped);border-radius:14px;padding:22px 16px 18px;text-align:center" },
        numero,
        h(
          "p",
          { style: "margin:8px 0 0;font-size:13px;color:var(--label-secondary)" },
          quante === 1 ? "sigaretta" : "sigarette",
          quante > tollerate ? ` · ${quante - tollerate} oltre le ${tollerate} tollerate` : ` · su ${tollerate} tollerate`
        ),
        h(
          "div",
          { style: "display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-top:18px" },
          meno,
          piu
        ),
        dOggi.length
          ? h(
              "p",
              { style: "margin:14px 0 0;font-size:12px;color:var(--label-tertiary)" },
              `Orari: ${dOggi.map((x) => oraDi(x.ts)).join(" · ")}`
            )
          : null
      ),
      h(
        "p.footnote",
        `Il «−» serve quando premi per sbaglio: toglie l'ultima segnata. Le sigarette pesano sul punteggio Salute: zero vale pieno, ${tollerate} vale zero, oltre le ${tollerate} il punteggio della giornata non può superare 50 comunque sia andato il resto.`
      )
    )
  );

  // ---- gli ultimi giorni ----
  const conteggi = await store.conteggioFumo();
  const primo = await store.primoGiornoFumo();
  if (primo) {
    const righe = h("div.list");
    const d = new Date(oggi + "T00:00:00");
    let mostrati = 0;
    let totale = 0;
    let giorniContati = 0;
    while (mostrati < 14) {
      const p = (n) => String(n).padStart(2, "0");
      const data = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      if (data < primo) break;
      const n = conteggi.get(data) || 0;
      totale += n;
      giorniContati++;
      if (data !== oggi) {
        aggiungi(righe,
          h(
            "div.row",
            h("div.main", h("span.title", dataLunga(data))),
            h("span.value", String(n)),
            n > tollerate ? h("span.pill.warn", "oltre") : n === 0 ? h("span.pill.ok", "zero") : null
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
            `Media ${(totale / Math.max(1, giorniContati)).toFixed(1).replace(".", ",")} al giorno da quando conti (${dataBreve(primo)}).`
          )
        )
      );
    }
  }

  // ---- effetto sul punteggio di oggi ----
  const punteggi = await store.punteggiSalute(oggi, oggi);
  const p = punteggi[0];
  if (p?.totale != null) {
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Punteggio Salute di oggi"),
        h(
          "div",
          { style: "background:var(--bg-grouped);border-radius:14px;padding:16px 14px" },
          anello(p.totale, { etichetta: "Salute", dimensione: 150, sottotitolo: giudizio(p.totale).testo }),
          h(
            "div.list",
            { style: "margin-top:14px;background:none" },
            ...p.voci.map((v) =>
              h(
                "div.row",
                h("div.main", h("span.title", v.nome), h("span.sub", v.dettaglio)),
                h("span.value", v.quota == null ? "—" : `${Math.round(v.quota * 100)}%`)
              )
            )
          ),
          p.limite
            ? h(
                "p",
                { style: "margin:12px 0 0;font-size:13px;color:var(--orange)" },
                `Il punteggio è fermo a ${p.totale}: ${p.limite.perche}.`
              )
            : null
        ),
        h("p.footnote", "Lo stesso punteggio che vedi in Home. Le voci senza dato restano fuori dal conto invece di valere zero.")
      )
    );
  }

  return wrap;
}

function oraDi(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
