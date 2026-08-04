import { h, dataBreve, dataLunga, durataUmana, mmss, num, oraDi, aggiungi, chiedi, toast } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";

function parametri() {
  const q = location.hash.split("?")[1] || "";
  return Object.fromEntries(new URLSearchParams(q));
}

export async function render({ vaiA }) {
  const p = parametri();
  if (p.seduta) return dettaglioSeduta(p.seduta);
  if (p.esercizio) return dettaglioEsercizio(p.esercizio);
  return elenco(vaiA);
}

async function elenco(vaiA) {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Storico"));

  const allenamenti = await store.allenamenti();
  const completate = allenamenti.filter((s) => s.stato === "completata");

  if (!completate.length) {
    aggiungi(wrap, h("div.empty", h("h3", "Nessun allenamento registrato"), h("p", "Gli allenamenti completati compaiono qui.")));
  } else {
    const lista = h("div.list");
    for (const s of completate) {
      const serie = await store.serieDi(s.id);
      const logs = await store.questionariDi(s.id);
      const saltati = logs.filter((l) => l.saltato).length;
      const durata = s.oraFine ? durataUmana(Math.round((s.oraFine - s.oraInizio) / 1000)) : "—";
      aggiungi(lista, 
        h(
          "a.row",
          { href: `#/storico?seduta=${s.id}` },
          h(
            "div.main",
            h("span.title", `${dataBreve(s.data)} · ${s.tipoNome}`),
            h("span.sub", `${serie.length} serie · ${durata}${saltati ? ` · ${saltati} saltati` : ""}`)
          ),
          h("span.chevron", "›")
        )
      );
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
          h("div.main", h("span.title", def?.nome || id), h("span.sub", `${esp.length} esposizioni`)),
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

async function dettaglioSeduta(id) {
  const wrap = h("div.screen");
  const s = await store.seduta(id);
  aggiungi(wrap, intestazione(s ? s.tipoNome : "Allenamento", { etichetta: "Indietro", onclick: () => (location.hash = "#/storico") }));
  if (!s) {
    aggiungi(wrap, h("div.empty", h("h3", "Allenamento non trovato")));
    return wrap;
  }

  const serie = await store.serieDi(id);
  const logs = await store.questionariDi(id);
  const perEs = new Map();
  for (const x of serie) {
    if (!perEs.has(x.esercizioId)) perEs.set(x.esercizioId, []);
    perEs.get(x.esercizioId).push(x);
  }
  for (const l of logs) if (!perEs.has(l.esercizioId)) perEs.set(l.esercizioId, []);

  aggiungi(wrap, 
    h(
      "div.group",
      h("div.list",
        h("div.row", h("div.main", h("span.title", "Data")), h("span.value", dataLunga(s.data))),
        h("div.row", h("div.main", h("span.title", "Orario")), h("span.value", `${oraDi(s.oraInizio)}${s.oraFine ? `–${oraDi(s.oraFine)}` : ""}`)),
        s.tipoProgrammatoId && s.tipoProgrammatoId !== s.tipoId
          ? h("div.row", h("div.main", h("span.title", "In programma era")), h("span.value", store.giornoSplit(s.tipoProgrammatoId)?.nome || s.tipoProgrammatoId))
          : null,
        s.riscaldamento?.fatto
          ? h("div.row", h("div.main", h("span.title", "Riscaldamento")), h("span.value", s.riscaldamento.modalita === "senzaTapis" ? "senza tapis" : "con tapis"))
          : null,
        s.cardio?.previsto
          ? h("div.row", h("div.main", h("span.title", "Cardio")), h("span.value", s.cardio.eseguito ? `${num(s.cardio.kmh)} km/h · ${s.cardio.durataMin} min` : "non eseguito"))
          : null
      )
    )
  );

  for (const [esId, righe] of perEs) {
    const def = store.esercizio(esId);
    const log = logs.find((l) => l.esercizioId === esId);
    const corpo = h("div.list");

    // Anche un esercizio saltato può avere serie già registrate (interrotto a
    // metà): nasconderle faceva sparire dallo storico lavoro davvero fatto.
    if (log?.saltato) {
      aggiungi(corpo, h("div.row", h("div.main",
        h("span.title", righe.length ? `Interrotto dopo ${righe.length} ${righe.length === 1 ? "serie" : "serie"}: ${log.saltato.motivo}` : `Saltato: ${log.saltato.motivo}`),
        log.saltato.nota ? h("span.sub", log.saltato.nota) : null)));
    }
    {
      for (const r of righe) {
        aggiungi(corpo, 
          h(
            "div.row",
            h("div.main", h("span.title", `Serie ${r.numero}`), r.recuperoRealeSec != null ? h("span.sub", `recupero ${mmss(r.recuperoRealeSec)}`) : null),
            h("span.value", `${r.carico != null ? num(r.carico) + " kg · " : ""}${r.ripFatte ?? "—"}${r.aTempo ? "s" : " rip"}`)
          )
        );
      }
      if (log && !log.saltato) {
        aggiungi(corpo, 
          h("div.row", h("div.main", h("span.title", "RPE ultima serie")), h("span.value", String(log.rpe ?? "—"))),
          h("div.row", h("div.main", h("span.title", "Tecnica")), h("span.value", String(log.tecnica ?? "—"))),
          h("div.row", h("div.main", h("span.title", "Polso destro")), h("span.value", log.dolorePolso ? `${log.dolorePolsoIntensita} · ${log.dolorePolsoQuando}` : "nessun dolore"))
        );
        if (log.nota) aggiungi(corpo, h("div.row", h("div.main", h("span.sub", log.nota))));
      }
    }

    aggiungi(wrap, h("div.group", h("h2", def?.nome || esId), corpo));
  }

  if (s.notaGenerale) {
    aggiungi(wrap, h("div.group", h("h2", "Nota generale"), h("div.list", h("div.row", h("div.main", h("span.title", s.notaGenerale))))));
  }

  aggiungi(wrap,
    h(
      "div.btn-wrap",
      { style: "margin-top:26px" },
      h(
        "button.btn.secondary",
        {
          style: "color:var(--red)",
          onclick: async () => {
            const conferma = await chiedi({
              titolo: "Eliminare l'allenamento?",
              testo: `${s.tipoNome} del ${dataLunga(s.data)}. Spariscono anche serie e questionari, e le proposte vengono ricalcolate senza di esso.`,
              opzioni: [{ etichetta: "Elimina", valore: "si", stile: "danger" }],
            });
            if (conferma !== "si") return;
            await store.annullaSeduta(s.id);
            await store.aggiornaMotore();
            toast("Allenamento eliminato.");
            location.hash = "#/storico";
          },
        },
        "Elimina questo allenamento"
      ),
      h("p.footnote", { style: "margin:8px 0 0" }, "Non si recupera.")
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
        `${esp.length} ${esp.length === 1 ? "esposizione registrata" : "esposizioni registrate"}, di cui ${store.esposizioniSvolte(esp).length} svolte (le altre saltate o senza serie). Le proposte di progressione richiedono almeno ${store.regole().progressione.esposizioniMinime} esposizioni svolte.`
      )
    )
  );

  return wrap;
}
