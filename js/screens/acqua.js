/* Acqua: una domanda sola al giorno, sì o no.
   Non si contano i bicchieri: il bersaglio è dichiarato nel brief e la
   risposta è binaria, perché è così che te la ricordi la sera. */

import { h, num, dataBreve, dataLunga, isoDate, aggiungi, toast, chiedi } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";
import { coloraPunteggio } from "../punteggio.js";

export async function render({ ridisegna }) {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Acqua"));

  const oggi = isoDate();
  const litri = store.regole().salute?.acquaLitriBersaglio ?? 2;
  const risposta = await store.acquaDi(oggi);
  const giorni = await store.giorniAcqua();

  // ---- oggi ----
  const scelta = async (valore) => {
    await store.segnaAcqua(valore, oggi);
    await ridisegna();
  };

  const tasto = (valore, etichetta) =>
    h(
      "button",
      {
        "aria-pressed": risposta === valore ? "true" : "false",
        onclick: () => scelta(valore),
      },
      etichetta
    );

  aggiungi(wrap,
    h(
      "div.hero",
      h("p.kicker", dataLunga(oggi)),
      h("h2", `Hai bevuto almeno ${num(litri)} litri oggi?`),
      h(
        "p.target",
        risposta == null
          ? "Rispondi a fine giornata: prima è una previsione, non un dato."
          : risposta
            ? "Segnato: obiettivo raggiunto."
            : "Segnato: oggi sotto l'obiettivo."
      )
    ),
    h("div.segmented", { style: "margin:6px 16px 0" }, tasto(true, "Sì"), tasto(false, "No")),
    risposta == null
      ? null
      : h(
          "div.btn-wrap",
          h(
            "button.btn.secondary",
            {
              onclick: async () => {
                await store.cancellaAcqua(oggi);
                toast("Risposta di oggi tolta.");
                await ridisegna();
              },
            },
            "Non ho ancora risposto"
          )
        )
  );

  // ---- come sta andando ----
  const rispostiPrima = giorni.filter((g) => g.data < oggi);
  if (rispostiPrima.length) {
    const si = rispostiPrima.filter((g) => g.bevuto).length;
    const quota = Math.round((si / rispostiPrima.length) * 100);
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Come sta andando"),
        h(
          "div.list",
          h(
            "div.row",
            h("div.main", h("span.title", "Giorni a obiettivo"), h("span.sub", `su ${rispostiPrima.length} ${rispostiPrima.length === 1 ? "giorno risposto" : "giorni risposti"}`)),
            coloraPunteggio(h("span.value", `${si} · ${quota}%`), quota)
          )
        )
      )
    );

    const righe = h("div.list");
    for (const g of rispostiPrima.slice(0, 30)) {
      aggiungi(righe,
        h(
          "div.row",
          h("div.main", h("span.title", dataLunga(g.data))),
          h("span.value", g.bevuto ? "sì" : "no"),
          h("span.pill", { class: g.bevuto ? "pill ok" : "pill warn" }, g.bevuto ? "a obiettivo" : "sotto")
        )
      );
    }
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Giorni precedenti"),
        righe,
        h(
          "p.footnote",
          `L'obiettivo è ${num(litri)} litri al giorno. La risposta pesa sul punteggio Salute come le altre voci: sì vale pieno, no vale zero, e un giorno senza risposta resta fuori dal conto invece di valere zero.`
        )
      )
    );
  } else {
    aggiungi(wrap,
      h(
        "p.footnote",
        { style: "margin:20px 16px 0" },
        `L'obiettivo è ${num(litri)} litri al giorno. La risposta pesa sul punteggio Salute: sì vale pieno, no vale zero, e un giorno senza risposta resta fuori dal conto.`
      )
    );
  }

  return wrap;
}
