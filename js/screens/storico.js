import { h, dataBreve, dataLunga, durataUmana, mmss, num, oraDi, aggiungi, chiedi, toast } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";

function parametri() {
  const q = location.hash.split("?")[1] || "";
  return Object.fromEntries(new URLSearchParams(q));
}

export async function render({ vaiA }) {
  const p = parametri();
  // Un allenamento passato si guarda nella STESSA schermata di uno appena
  // chiuso: anello, punteggio scomposto, esercizio per esercizio, numeri
  // dall'orologio. Prima lo Storico ne disegnava una versione ridotta, e lo
  // stesso allenamento aveva due facce diverse secondo da dove lo aprivi.
  // I collegamenti vecchi continuano a funzionare: portano lì anche loro.
  if (p.seduta) {
    location.replace(`#/seduta?riepilogo=${p.seduta}&da=storico`);
    return h("div.screen");
  }
  if (p.esercizio) return dettaglioEsercizio(p.esercizio);
  return elenco(vaiA);
}

// Data breve con l'anno a due cifre: serve dove due date lontane potrebbero
// sembrare vicine («10/07» e «09/07» a un anno di distanza).
const conAnno = (iso) => `${dataBreve(iso)}/${iso.slice(2, 4)}`;

async function elenco(vaiA) {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Storico"));

  const allenamenti = await store.allenamenti();
  const completate = allenamenti.filter((s) => s.stato === "completata");

  if (!completate.length) {
    aggiungi(wrap, h("div.empty", h("h3", "Nessun allenamento registrato"), h("p", "Gli allenamenti completati compaiono qui.")));
  } else {
    // Un anno di allenamenti sono trecento righe: la pagina diventava lunga
    // decine di metri e per ritrovare la seduta di ieri bisognava scorrerla
    // tutta. Se ne mostrano le ultime, il resto si apre con un tocco: niente
    // viene nascosto, solo rimandato.
    const A_VISTA = 20;
    const lista = h("div.list");
    const riga = async (s) => {
      const serie = await store.serieDi(s.id);
      const logs = await store.questionariDi(s.id);
      // Interrotto a metà non è «saltato»: il lavoro c'è. Si contano solo gli
      // esercizi in cui non hai fatto proprio niente.
      const saltati = logs.filter(
        (l) => l.saltato && !serie.some((x) => x.esercizioId === l.esercizioId)
      ).length;
      const durata = s.oraFine
        ? durataUmana(Math.round((s.oraFine - (s.oraInizioLavoro || s.oraInizio)) / 1000))
        : "—";
      return h(
        "a.row",
        { href: `#/seduta?riepilogo=${s.id}&da=storico` },
        h(
          "div.main",
          h("span.title", `${dataBreve(s.data)} · ${s.tipoNome}`),
          h("span.sub", `${serie.length} serie · ${durata}${saltati ? ` · ${saltati} ${saltati === 1 ? "saltato" : "saltati"}` : ""}`)
        ),
        h("span.chevron", "›")
      );
    };
    for (const s of completate.slice(0, A_VISTA)) aggiungi(lista, await riga(s));

    const restanti = completate.slice(A_VISTA);
    if (restanti.length) {
      const altri = h(
        "button.row",
        {
          onclick: async () => {
            altri.disabled = true;
            altri.querySelector(".title").textContent = "Carico…";
            for (const s of restanti) lista.insertBefore(await riga(s), altri);
            altri.remove();
          },
        },
        h(
          "div.main",
          // Al singolare non si dice «gli altri 1»: quando ne resta uno solo la
          // riga diventa «Mostra l'ultimo», e la riga sotto smette di dire
          // «dal … al …» per lo stesso giorno.
          h(
            "span.title",
            restanti.length === 1 ? "Mostra l'ultimo" : `Mostra gli altri ${restanti.length}`
          ),
          // Con l'anno: senza, «dal 10/07 al 09/07» sembrava un giorno solo
          // mentre erano dodici mesi.
          h(
            "span.sub",
            restanti.length === 1
              ? conAnno(restanti[0].data)
              : `dal ${conAnno(restanti[restanti.length - 1].data)} al ${conAnno(restanti[0].data)}`
          )
        ),
        h("span.chevron", "›")
      );
      aggiungi(lista, altri);
    }
    aggiungi(wrap, h("div.group", h("h2", `Allenamenti (${completate.length})`), lista));
  }

  // volumi
  const vol = store.volumePerPattern();
  if (vol.length) {
    const righe = vol.map((v) =>
      h(
        "tr",
        h("td", store.ETICHETTE_PATTERN[v.pattern] || v.pattern),
        h("td.num", String(v.serie))
      )
    );
    const spinta = vol.find((v) => v.pattern === "spinta")?.serie || 0;
    const tirata = vol.find((v) => v.pattern === "tirataOrizzontale")?.serie || 0;
    const verticale = vol.find((v) => v.pattern === "tirataVerticale")?.serie || 0;

    aggiungi(wrap, 
      h(
        "div.group",
        h("h2", "Volume settimanale per pattern"),
        h(
          "div.table-wrap",
          h(
            "table",
            h("thead", h("tr", h("th", "Pattern"), h("th.num", "Serie/sett"))),
            h("tbody", ...righe)
          )
        ),
        h(
          "p.footnote",
          `Calcolato dallo split. Rapporto spinta/tirata orizzontale ${tirata ? (spinta / tirata).toFixed(1).replace(".", ",") : "—"}:1. Tirata verticale ${verticale} serie.`
        )
      )
    );
  }

  // per esercizio
  const usati = new Set(store.giorniSplit().flatMap((g) => (g.esercizi || []).map((v) => v.esercizioId)));
  if (usati.size) {
    const lista = h("div.list");
    for (const id of usati) {
      const def = store.esercizio(id);
      const esp = store.esposizioniSvolte(await store.esposizioni(id));
      aggiungi(lista, 
        h(
          "a.row",
          { href: `#/storico?esercizio=${id}` },
          h("div.main", h("span.title", def?.nome || id), h("span.sub", `${esp.length} ${esp.length === 1 ? "esposizione" : "esposizioni"}`)),
          h("span.chevron", "›")
        )
      );
    }
    aggiungi(wrap, h("div.group", h("h2", "Per esercizio"), lista));
  }

  const dec = await store.decisioni();
  if (dec.length) {
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Registro decisioni"),
        h(
          "div.list",
          ...dec.slice(0, 20).map((d) => {
            const riga = d.propostaId
              ? h("a.row", { href: `#/proposte?proposta=${d.propostaId}` })
              : h("div.row");
            aggiungi(
              riga,
              h(
                "div.main",
                h("span.title", d.oggetto),
                h(
                  "span.sub",
                  `${dataBreve(d.data)}${d.livello ? ` · livello ${d.livello}` : ""} · ${d.testo}`
                ),
                d.dataVerifica
                  ? h(
                      "span.sub",
                      d.esitoVerifica
                        ? `Verificata il ${dataBreve(d.esitoVerifica.data)}: ${d.esitoVerifica.esito === "confermata" ? "confermata" : "non confermata"}`
                        : `Verifica prevista il ${dataBreve(d.dataVerifica)}`
                    )
                  : null
              ),
              d.dataVerifica && !d.esitoVerifica ? h("span.pill.warn", "in verifica") : null,
              d.propostaId ? h("span.chevron", "›") : null
            );
            return riga;
          })
        ),
        h(
          "p.footnote",
          `${dec.length} ${dec.length === 1 ? "decisione registrata" : "decisioni registrate"}. Ogni modifica accettata porta una data di verifica: senza esito resta aperta.`
        )
      )
    );
  }

  aggiungi(wrap,
    h(
      "div.group",
      h(
        "div.list",
        h(
          "a.row",
          { href: "#/proposte" },
          h(
            "div.main",
            h("span.title", "Proposte e segnali"),
            h("span.sub", "Progressioni proposte dal motore, segnali aperti e verifiche in scadenza")
          ),
          h("span.chevron", "›")
        )
      )
    )
  );

  return wrap;
}

async function dettaglioEsercizio(id) {
  const wrap = h("div.screen");
  const def = store.esercizio(id);
  aggiungi(wrap, intestazione(def?.nome || id, { etichetta: "Indietro", onclick: () => (location.hash = "#/storico") }));

  const esp = await store.esposizioni(id);
  if (!esp.length) {
    aggiungi(wrap, h("div.empty", h("h3", "Nessuna esposizione registrata")));
    return wrap;
  }

  const righe = esp.map((e) =>
    h(
      "tr",
      h("td", dataBreve(e.data)),
      h("td.num", e.caricoLavoro != null ? num(e.caricoLavoro) : "—"),
      h("td.num", e.serie.map((s) => s.ripFatte ?? "—").join("/")),
      h("td.num", e.rpe ?? "—"),
      h("td.num", e.tecnica != null ? num(e.tecnica) : "—")
    )
  );

  aggiungi(wrap, 
    h(
      "div.group",
      h("h2", "Esposizioni"),
      h(
        "div.table-wrap",
        h(
          "table",
          h("thead", h("tr", h("th", "Data"), h("th.num", "kg"), h("th.num", "Rip"), h("th.num", "RPE"), h("th.num", "Tec"))),
          h("tbody", ...righe)
        )
      ),
      h(
        "p.footnote",
        `${esp.length} ${esp.length === 1 ? "esposizione registrata" : "esposizioni registrate"}, di cui ${store.esposizioniSvolte(esp).length} ${store.esposizioniSvolte(esp).length === 1 ? "svolta" : "svolte"} (le altre saltate o senza serie). Le proposte di progressione richiedono almeno ${store.regole().progressione.esposizioniMinime} esposizioni svolte.`
      )
    )
  );

  return wrap;
}
