import { h, aggiungi, dataBreve, dataLunga, num, toast, chiedi, sheet } from "../ui.js";
import { intestazione } from "../app.js";
import { nomeLivello } from "../segnali.js";
import * as store from "../store.js";

function parametri() {
  const q = location.hash.split("?")[1] || "";
  return Object.fromEntries(new URLSearchParams(q));
}

const indietro = () => (location.hash = "#/proposte");

export async function render({ vaiA, ridisegna }) {
  const p = parametri();
  if (p.proposta) return dettaglio(p.proposta);
  return elenco(vaiA, ridisegna);
}

// ---------- elenco ----------

async function elenco(vaiA, ridisegna) {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Proposte", { etichetta: "Home", onclick: () => vaiA("oggi") }));

  await store.aggiornaMotore();

  const sospese = await store.proposteInSospeso();
  const verifiche = await store.verificheDovute();
  const avvisi = await store.segnali();

  if (!sospese.length && !verifiche.length && !avvisi.length) {
    aggiungi(
      wrap,
      h(
        "div.empty",
        h("h3", "Niente da decidere"),
        h("p", "Nessuna proposta in sospeso e nessun segnale aperto.")
      )
    );
  }

  if (verifiche.length) {
    const lista = h("div.list");
    for (const p of verifiche) {
      aggiungi(
        lista,
        h(
          "button.row",
          { onclick: () => apriVerifica(p, ridisegna) },
          h(
            "div.main",
            h("span.title", p.titolo),
            // La data in cui hai risposto, non quella in cui la proposta è nata.
            h("span.sub", `Accettata il ${dataBreve((p.rispostoIl || p.data).slice(0, 10))} · verifica prevista ${dataBreve(p.dataVerifica)}`)
          ),
          h("span.pill.warn", "da verificare"),
          h("span.chevron", "›")
        )
      );
    }
    aggiungi(
      wrap,
      h(
        "div.group",
        h("h2", "Verifiche in scadenza"),
        lista,
        h("p.footnote", "Una decisione senza verifica è un'opinione: qui si chiude il cerchio.")
      )
    );
  }

  if (sospese.length) {
    const lista = h("div.list");
    for (const p of sospese) {
      aggiungi(
        lista,
        h(
          "a.row",
          { href: `#/proposte?proposta=${p.id}` },
          h(
            "div.main",
            h("span.title", p.titolo),
            h("span.sub", `Livello ${p.livelloGerarchia} — ${nomeLivello(p.livelloGerarchia)} · ${dataBreve(p.data)}`)
          ),
          h("span.chevron", "›")
        )
      );
    }
    aggiungi(
      wrap,
      h(
        "div.group",
        h("h2", `In sospeso (${sospese.length})`),
        lista,
        h(
          "p.footnote",
          "L'app propone, non decide: il programma scritto non lo tocca. Se accetti, usa quel valore come obiettivo alla prossima esposizione e lo scrive nel pacchetto per Claude, che resta l'unico a cambiare la scheda."
        )
      )
    );
  }

  if (avvisi.length) {
    const lista = h("div.list");
    for (const s of avvisi) {
      aggiungi(
        lista,
        h(
          "button.row",
          { onclick: () => apriSegnale(s, ridisegna) },
          h("div.main", h("span.title", s.messaggio)),
          h("span.pill", { class: s.gravita === "attenzione" ? "pill warn" : "pill" }, s.gravita),
          h("span.chevron", "›")
        )
      );
    }
    aggiungi(wrap, h("div.group", h("h2", "Segnali"), lista));
  }

  aggiungi(wrap, await bloccoSilenzio());
  return wrap;
}

/** Perché il motore tace: un esercizio per riga, con il motivo. */
async function bloccoSilenzio() {
  const diagnosi = (await store.diagnosiProgressione()).filter((d) => !d.proposta);
  if (!diagnosi.length) return null;
  const lista = h("div.list");
  for (const d of diagnosi) {
    aggiungi(
      lista,
      h("div.row", h("div.main", h("span.title", d.nome), h("span.sub", d.motivo)))
    );
  }
  return h(
    "div.group",
    h("h2", "Perché non c'è altro"),
    lista,
    h("p.footnote", "Il motore è deterministico: se non propone, c'è una regola che glielo impedisce.")
  );
}

// ---------- dettaglio ----------

async function dettaglio(id) {
  const wrap = h("div.screen");
  const p = await store.proposta(id);
  aggiungi(wrap, intestazione("Proposta", { etichetta: "Indietro", onclick: indietro }));

  if (!p) {
    aggiungi(wrap, h("div.empty", h("h3", "Proposta non trovata"), h("p", "Forse è stata superata da dati più recenti.")));
    return wrap;
  }

  const def = store.esercizio(p.esercizioId);
  const v = store.varianteDi(p.esercizioId);

  aggiungi(
    wrap,
    h("div.hero", h("p.kicker", `Livello ${p.livelloGerarchia} — ${nomeLivello(p.livelloGerarchia)}`), h("h2", p.titolo)),
    h(
      "div.group",
      h(
        "div.list",
        h("div.row", h("div.main", h("span.title", "Esercizio")), h("span.value", def?.nome || p.esercizioId)),
        h(
          "div.row",
          h("div.main", h("span.title", "Adesso")),
          h("span.value", descriviBersaglio(p.da, v))
        ),
        h(
          "div.row.accent",
          h("div.main", h("span.title", "Proposta")),
          h("span.value", descriviBersaglio(p.a, v))
        ),
        h("div.row", h("div.main", h("span.title", "Verifica")), h("span.value", dataBreve(p.dataVerifica)))
      )
    )
  );

  aggiungi(
    wrap,
    h(
      "div.group",
      h("h2", "Le quattro domande"),
      h(
        "div.guida",
        { style: "margin:0" },
        domanda("Perché modificare?", p.quattroDomande.perche),
        domanda("Quali dati lo dimostrano?", p.quattroDomande.quali),
        domanda("Perché è meglio delle alternative?", p.quattroDomande.alternative),
        domanda("Quale risultato ci si aspetta?", p.quattroDomande.atteso)
      ),
      h("p.footnote", "Regola del master brief §11: se non si risponde a tutte e quattro, non si modifica nulla.")
    )
  );

  if (p.stato !== "inSospeso") {
    aggiungi(
      wrap,
      h(
        "div.group",
        h("h2", "Esito"),
        h(
          "div.list",
          h("div.row", h("div.main", h("span.title", "Risposta")), h("span.value", p.stato)),
          p.notaRisposta ? h("div.row", h("div.main", h("span.sub", p.notaRisposta))) : null,
          p.esitoVerifica
            ? h(
                "div.row",
                h("div.main", h("span.title", "Verifica")),
                h("span.value", `${p.esitoVerifica.esito} · ${dataBreve(p.esitoVerifica.data)}`)
              )
            : null
        )
      )
    );
    return wrap;
  }

  const rispondi = (stato) => async () => {
    const nota = await chiediNota(stato);
    if (nota === undefined) return;
    await store.rispondiAProposta(p.id, stato, { nota });
    toast(
      stato === "accettata"
        ? `Accettata. Il nuovo obiettivo compare nella prossima seduta, verifica il ${dataBreve(p.dataVerifica)}.`
        : `Proposta ${stato}.`,
      3600
    );
    indietro(); // il cambio di hash ridisegna da solo
  };

  aggiungi(
    wrap,
    h(
      "div.btn-wrap",
      h("button.btn", { onclick: rispondi("accettata") }, "Accetto"),
      h("div", { style: "height:8px" }),
      h("button.btn.secondary", { onclick: rispondi("rimandata") }, "Rimando"),
      h("div", { style: "height:8px" }),
      h("button.btn.secondary", { onclick: rispondi("rifiutata") }, "Rifiuto")
    ),
    h(
      "p.footnote",
      { style: "margin:14px 16px 0" },
      "Rimando: la proposta torna dopo la prossima esposizione. Rifiuto: non torna finché i dati restano questi."
    )
  );

  return wrap;
}

function domanda(titolo, testo) {
  return h("section", h("h3", titolo), h("p", testo));
}

function descriviBersaglio(b, v) {
  const parti = [];
  if (b.carico != null) parti.push(`${num(b.carico)} kg`);
  if (b.rip != null) parti.push(`${v?.serie ? `${v.serie}×` : ""}${b.rip}`);
  return parti.join(" · ") || "—";
}

/** Nota facoltativa: `undefined` significa annullato, `null` nessuna nota. */
function chiediNota(stato) {
  const titoli = {
    accettata: "Accetto la proposta",
    rifiutata: "Rifiuto la proposta",
    rimandata: "Rimando la proposta",
  };
  return sheet((close) => {
    const area = h("textarea.note", { placeholder: "Nota facoltativa", rows: 3 });
    return h(
      "div",
      h("h2", titoli[stato]),
      area,
      h(
        "div.btn-wrap",
        h("button.btn", { onclick: () => close(area.value.trim() || null) }, "Conferma"),
        h("div", { style: "height:8px" }),
        h("button.btn.secondary", { onclick: () => close(undefined) }, "Annulla")
      )
    );
  });
}

// ---------- verifica ----------

async function apriVerifica(p, ridisegna) {
  const esito = await chiedi({
    titolo: p.titolo,
    testo: `Accettata il ${dataLunga((p.rispostoIl || p.data).slice(0, 10))}. Il risultato atteso era: ${p.quattroDomande.atteso}`,
    opzioni: [
      { etichetta: "Confermata", valore: "confermata" },
      { etichetta: "Non confermata", valore: "nonConfermata" },
    ],
  });
  if (!esito) return;
  await store.chiudiVerifica(p.id, esito);
  toast("Verifica registrata nel registro decisioni.");
  await ridisegna();
}

// ---------- segnale ----------

async function apriSegnale(s, ridisegna) {
  const scelta = await chiedi({
    titolo: s.messaggio,
    testo: s.dettaglio,
    opzioni: [{ etichetta: "Ho preso nota", valore: "archivia" }],
  });
  if (scelta !== "archivia") return;
  await store.archiviaSegnale(s.id);
  await ridisegna();
}
