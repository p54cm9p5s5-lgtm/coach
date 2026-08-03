import { h, isoDate, dataLunga, chiedi, num, aggiungi } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";

async function daFare() {
  const voci = [];

  const gPeso = await store.giorniDaUltimaMisura("peso");
  if (gPeso === null) voci.push({ testo: "Peso mai registrato", stato: "warn", rotta: "corpo" });
  else if (gPeso >= 7)
    voci.push({ testo: `Peso: ${gPeso} giorni fa`, stato: "warn", rotta: "corpo" });

  const gVita = await store.giorniDaUltimaMisura("vitaOmbelico");
  if (gVita === null) voci.push({ testo: "Vita ombelico mai registrata", stato: "warn", rotta: "corpo" });
  else if (gVita >= 7)
    voci.push({ testo: `Vita ombelico: ${gVita} giorni fa`, stato: "warn", rotta: "corpo" });

  const foto = await store.db.all("foto");
  if (foto.length) {
    const ultima = foto.map((f) => f.data).sort().at(-1);
    const g = Math.round((new Date(isoDate()) - new Date(ultima)) / 86400000);
    if (g >= 14) voci.push({ testo: `Foto: ${g} giorni fa`, stato: "warn", rotta: "corpo" });
  } else {
    voci.push({ testo: "Foto mai scattate", stato: "info", rotta: "corpo" });
  }

  const gExport = await store.giorniDaUltimoExport();
  if (gExport === null)
    voci.push({ testo: "Backup su file mai fatto", stato: "warn", rotta: "impostazioni" });
  else if (gExport >= 7)
    voci.push({ testo: `Backup su file: ${gExport} giorni fa`, stato: "warn", rotta: "impostazioni" });

  const ultimoImport = await store.impostazione("ultimoImportSalute");
  if (!ultimoImport) {
    voci.push({ testo: "Dati Salute mai importati", stato: "info", rotta: "salute" });
  } else {
    const g = Math.round((Date.now() - new Date(ultimoImport)) / 86400000);
    if (g >= 2) voci.push({ testo: `Dati Salute: ${g} giorni fa`, stato: "warn", rotta: "salute" });
  }

  return voci;
}

async function statoFinestre() {
  const giorni = await store.db.all("giorniSalute");
  const notti = await store.db.all("notti");
  const gPresenti = giorni.filter((g) => g.presente).length;
  const nPresenti = notti.filter((n) => n.presente).length;
  if (!gPresenti && !nPresenti) return null;
  return { movimento: gPresenti, sonno: nPresenti, richiesti: 21 };
}

export async function render({ vaiA, ridisegna }) {
  const oggi = isoDate();
  const prog = store.programma();
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Oggi", { etichetta: "Impostazioni", onclick: () => vaiA("impostazioni") }));

  if (!prog) {
    aggiungi(wrap, 
      h(
        "div.empty",
        h("h3", "Nessun programma caricato"),
        h("p", "Carica il master brief: l'app legge il blocco tecnico in coda al documento e imposta split, esercizi e regole."),
        h(
          "div.btn-wrap",
          h("button.btn", { onclick: () => vaiA("impostazioni") }, "Carica master brief")
        )
      )
    );
    return wrap;
  }

  aggiungi(wrap, 
    h("div.group", h("div.list", h("div.row", h("div.main", h("span.title", dataLunga(oggi))))))
  );

  // ---- seduta in corso ----
  const inCorso = await store.sedutaInCorso();
  if (inCorso) {
    aggiungi(wrap, 
      h(
        "div.group",
        h("h2", "Seduta aperta"),
        h(
          "div.list",
          h(
            "button.row",
            { onclick: () => vaiA("seduta") },
            h(
              "div.main",
              h("span.title", inCorso.tipoNome),
              h("span.sub", `Iniziata ${new Date(inCorso.oraInizio).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} · ${inCorso.data === oggi ? "oggi" : inCorso.data}`)
            ),
            h("span.chevron", "›")
          )
        ),
        h("div.btn-wrap", h("button.btn", { onclick: () => vaiA("seduta") }, "Riprendi seduta"))
      )
    );
    aggiungi(wrap, await bloccoDaFare(vaiA));
    return wrap;
  }

  // ---- già fatto oggi ----
  const fatteOggi = (await store.sedute()).filter((s) => s.data === oggi && s.stato === "completata");
  if (fatteOggi.length) {
    aggiungi(wrap, 
      h(
        "div.group",
        h("h2", "Già fatto oggi"),
        h(
          "div.list",
          ...fatteOggi.map((s) =>
            h(
              "a.row",
              { href: `#/storico?seduta=${s.id}` },
              h(
                "div.main",
                h("span.title", s.tipoNome),
                h("span.sub", `chiusa alle ${new Date(s.oraFine).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`)
              ),
              h("span.pill.ok", "completata"),
              h("span.chevron", "›")
            )
          )
        )
      )
    );
  }

  // ---- seduta prevista ----
  const previsto = store.giornoPrevisto(oggi);
  const giaFatta = fatteOggi.some((s) => s.tipoId === previsto?.id);
  const lista = h("div.list");

  if (previsto) {
    for (const v of previsto.esercizi || []) {
      const def = store.esercizio(v.esercizioId);
      aggiungi(lista, 
        h(
          "div.row",
          h(
            "div.main",
            h("span.title", def?.nome || v.esercizioId),
            h(
              "span.sub",
              v.aTempo
                ? `${v.serie} × ${v.durataSec}s`
                : `${v.serie} × ${v.ripMin === v.ripMax ? v.ripMin : `${v.ripMin}-${v.ripMax}`}`
            )
          ),
          v.carico != null ? h("span.value", `${num(v.carico)} kg`) : null
        )
      );
    }
    if (previsto.cardio) {
      const r = store.regole().cardio;
      aggiungi(lista, 
        h(
          "div.row",
          h(
            "div.main",
            h("span.title", "Cardio"),
            h("span.sub", `${r.durataMin} min · ${num(r.kmhMin)}-${num(r.kmhMax)} km/h · FC ${r.fcMin}-${r.fcMax}`)
          )
        )
      );
    }

    aggiungi(wrap, 
      h(
        "div.group",
        h("h2", giaFatta ? "Seduta di oggi — già completata" : "Seduta di oggi"),
        h("div.list", h("div.row", h("div.main", h("span.title", previsto.nome)))),
        h("div", { style: "height:10px" }),
        lista,
        h(
          "div.btn-wrap",
          h(
            "button",
            {
              class: giaFatta ? "btn secondary" : "btn",
              onclick: async () => {
                await store.iniziaSeduta({ data: oggi, giornoId: previsto.id });
                vaiA("seduta");
              },
            },
            giaFatta ? "Rifai questa seduta" : "Inizia seduta"
          ),
          h("div", { style: "height:8px" }),
          h(
            "button.btn.secondary",
            { onclick: () => cambiaSeduta(vaiA, ridisegna) },
            "Fai un'altra seduta"
          )
        )
      )
    );
  } else {
    aggiungi(wrap, 
      h(
        "div.group",
        h("h2", "Seduta di oggi"),
        h(
          "div.list",
          h(
            "div.row",
            h("div.main", h("span.title", "Riposo"), h("span.sub", "Nessuna seduta prevista dallo split"))
          )
        ),
        h(
          "div.btn-wrap",
          h("button.btn.secondary", { onclick: () => cambiaSeduta(vaiA, ridisegna) }, "Allenati comunque")
        )
      )
    );
  }

  aggiungi(wrap, await bloccoDaFare(vaiA));

  const fin = await statoFinestre();
  if (fin) {
    aggiungi(wrap, 
      h(
        "div.group",
        h("h2", "Finestre dati"),
        h(
          "div.list",
          h(
            "div.row",
            h("div.main", h("span.title", "Movimento")),
            h("span.value", `${fin.movimento}/${fin.richiesti} giorni`)
          ),
          h(
            "div.row",
            h("div.main", h("span.title", "Sonno")),
            h("span.value", `${fin.sonno}/${fin.richiesti} notti`)
          )
        ),
        h("p.footnote", "Finché la finestra non è completa i dati restano raccolta, non azione.")
      )
    );
  }

  return wrap;
}

async function bloccoDaFare(vaiA) {
  const voci = await daFare();
  if (!voci.length) return h("div");
  const lista = h("div.list");
  for (const v of voci) {
    aggiungi(lista, 
      h(
        "button.row",
        { onclick: () => vaiA(v.rotta) },
        h("div.main", h("span.title", v.testo)),
        h("span.pill", { class: v.stato === "warn" ? "pill warn" : "pill" }, v.stato === "warn" ? "scaduto" : "manca"),
        h("span.chevron", "›")
      )
    );
  }
  return h("div.group", h("h2", "Da registrare"), lista);
}

async function cambiaSeduta(vaiA, ridisegna) {
  const giorni = store.giorniSplit();
  const scelta = await chiedi({
    titolo: "Quale seduta stai per fare?",
    testo: "Viene registrata la seduta che fai davvero, non quella in programma.",
    opzioni: giorni.map((g) => ({ etichetta: g.nome, valore: g.id })),
  });
  if (!scelta) return;
  await store.iniziaSeduta({ data: isoDate(), giornoId: scelta });
  vaiA("seduta");
  if (location.hash.includes("seduta")) ridisegna();
}
