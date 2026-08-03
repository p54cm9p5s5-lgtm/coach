import { h, toast, sheet, chiedi, num, dataLunga, aggiungi, provaSuono } from "../ui.js";
import { intestazione, applicaTema, temaCorrente } from "../app.js";
import * as store from "../store.js";
import { estraiBlocco, valida, confronta } from "../brief.js";

function scegliFile(accept) {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept, style: "display:none" });
    input.addEventListener("change", () => {
      resolve(input.files?.[0] || null);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

function scarica(nome, contenuto, tipo = "application/json") {
  const blob = new Blob([contenuto], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = h("a", { href: url, download: nome, style: "display:none" });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1500);
}

export async function render({ vaiA, ridisegna }) {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Impostazioni", { etichetta: "Fine", onclick: () => vaiA("oggi") }));

  const prog = store.programma();
  const imp = await store.impostazioni();
  const giorniExport = await store.giorniDaUltimoExport();

  // ---- programma ----
  aggiungi(wrap, 
    h(
      "div.group",
      h("h2", "Programma"),
      h(
        "div.list",
        h(
          "div.row",
          h("div.main", h("span.title", "Brief caricato")),
          h("span.value", prog ? dataLunga(prog.aggiornatoIl) : "nessuno")
        ),
        prog
          ? h(
              "div.row",
              h("div.main", h("span.title", "Giorni di allenamento")),
              h("span.value", String((prog.split || []).length))
            )
          : null,
        h(
          "button.row.accent",
          { onclick: () => caricaBrief(ridisegna) },
          h("div.main", h("span.title", "Carica master brief (.md)")),
          h("span.chevron", "›")
        )
      ),
      h(
        "p.footnote",
        "Aggiorna programma e regole leggendo il blocco tecnico in coda al documento. Non tocca mai allenamenti, misure e note già registrate."
      )
    )
  );

  // ---- versione e aggiornamento ----
  const versione = await versioneInstallata();
  aggiungi(wrap,
    h(
      "div.group",
      h("h2", "App"),
      h(
        "div.list",
        h("div.row", h("div.main", h("span.title", "Versione installata")), h("span.value", versione || "—")),
        h(
          "button.row.accent",
          { onclick: () => { provaSuono(); toast("Se non senti nulla, alza il volume con i tasti laterali."); } },
          h("div.main", h("span.title", "Prova il suono del timer"), h("span.sub", "deve suonare anche col telefono in silenzioso")),
          h("span.chevron", "›")
        ),
        h(
          "button.row.accent",
          { onclick: forzaAggiornamento },
          h("div.main", h("span.title", "Scarica l'ultima versione"), h("span.sub", "svuota la copia locale e ricarica")),
          h("span.chevron", "›")
        )
      ),
      h("p.footnote", "Normalmente l'app si aggiorna da sola alla riapertura. Questo serve solo se resta indietro.")
    )
  );

  // ---- aspetto ----
  const tema = temaCorrente();
  aggiungi(wrap,
    h(
      "div.group",
      h("h2", "Aspetto"),
      h(
        "div.segmented",
        { style: "margin-left:0;margin-right:0" },
        ...[
          ["sistema", "Sistema"],
          ["lime", "Nero e lime"],
        ].map(([valore, etichetta]) =>
          h(
            "button",
            {
              "aria-pressed": tema === valore,
              onclick: async () => {
                applicaTema(valore);
                await ridisegna();
              },
            },
            etichetta
          )
        )
      ),
      h("p.footnote", "«Sistema» segue chiaro e scuro dell'iPhone. «Nero e lime» resta sempre scuro.")
    )
  );

  // ---- inventario ----
  const inv = await store.inventario();
  aggiungi(wrap, 
    h(
      "div.group",
      h("h2", "Inventario"),
      h(
        "div.list",
        h("div.row", h("div.main", h("span.title", "Bilanciere")), h("span.value", `${num(inv.barra)} kg`)),
        ...Object.entries(inv.dischi || {})
          .sort((a, b) => Number(b[0]) - Number(a[0]))
          .map(([peso, q]) =>
            h("div.row", h("div.main", h("span.title", `Dischi da ${num(Number(peso))} kg`)), h("span.value", `×${q}`))
          )
      ),
      h("p.footnote", "L'inventario arriva dal master brief e serve a calcolare i dischi da montare.")
    )
  );

  // ---- dati ----
  // Conteggi a vista: quando ci si chiede «è rimasto dentro qualcosa di una
  // prova?», questa riga risponde senza aprire un backup.
  const conta = await store.conteggioArchivio();
  aggiungi(wrap,
    h(
      "div.group",
      h("h2", "Cosa c'è in archivio"),
      h(
        "div.list",
        h("div.row", h("div.main", h("span.title", "Allenamenti registrati"), h("span.sub", `${conta.serie} serie · ${conta.questionari} questionari`)), h("span.value", String(conta.allenamenti))),
        h("div.row", h("div.main", h("span.title", "Misure del corpo"), h("span.sub", `${conta.foto} foto`)), h("span.value", String(conta.misure))),
        h("div.row", h("div.main", h("span.title", "Giorni di salute"), h("span.sub", `${conta.notti} notti di sonno`)), h("span.value", String(conta.giorniSalute))),
        conta.aperti
          ? h("div.row", h("div.main", h("span.title", "Allenamenti aperti e mai chiusi")), h("span.pill.warn", String(conta.aperti)))
          : null
      ),
      h(
        "p.footnote",
        conta.primo
          ? `Dal ${conta.primo} a oggi. Gli allenamenti si eliminano uno per uno dallo Storico.`
          : "Nessun allenamento registrato."
      )
    )
  );

  aggiungi(wrap,
    h(
      "div.group",
      h("h2", "Dati"),
      h(
        "div.list",
        h(
          "div.row",
          h("div.main", h("span.title", "Ultimo backup su file"), h("span.sub", "l'unico che sopravvive al telefono")),
          h(
            "span.value",
            imp.ultimoExport ? new Date(imp.ultimoExport).toLocaleDateString("it-IT") : "mai"
          ),
          giorniExport === null || giorniExport >= 7 ? h("span.pill.warn", "da fare") : null
        ),
        h(
          "div.row",
          h("div.main", h("span.title", "Copia interna"), h("span.sub", "automatica a fine allenamento, resta nel telefono")),
          h(
            "span.value",
            imp.ultimoSnapshot ? new Date(imp.ultimoSnapshot).toLocaleString("it-IT") : "mai"
          )
        ),
        h(
          "button.row.accent",
          { onclick: esportaBackup },
          h("div.main", h("span.title", "Esporta backup su file")),
          h("span.chevron", "›")
        ),
        h(
          "button.row.accent",
          { onclick: () => importaBackup(ridisegna) },
          h("div.main", h("span.title", "Ripristina da file")),
          h("span.chevron", "›")
        ),
        imp.ultimoSnapshot
          ? h(
              "button.row.accent",
              { onclick: () => ripristinaSnapshot() },
              h("div.main", h("span.title", "Ripristina la copia interna")),
              h("span.chevron", "›")
            )
          : null
      ),
      h(
        "p.footnote",
        "La copia interna protegge da errori dell'app e cancellazioni accidentali, non dalla perdita del telefono — e non contiene le foto. Per quello serve il backup su file, da salvare in File o iCloud Drive."
      )
    )
  );

  // ---- pericolo ----
  aggiungi(wrap, 
    h(
      "div.group",
      h("div.list", h("button.row.danger", { onclick: () => azzera(ridisegna) }, h("div.main", h("span.title", "Elimina tutti i dati"))))
    )
  );

  aggiungi(wrap, 
    h("p.footnote", { style: "margin:24px 16px" }, "Coach · i dati restano su questo dispositivo, non vengono inviati da nessuna parte.")
  );

  return wrap;
}

async function caricaBrief(ridisegna) {
  const file = await scegliFile(".md,.markdown,.txt,text/markdown,text/plain");
  if (!file) return;

  let dati;
  try {
    const testo = await file.text();
    dati = estraiBlocco(testo);
  } catch (e) {
    await chiedi({ titolo: "Non caricato", testo: e.message, opzioni: [{ etichetta: "Ho capito", valore: "ok" }] });
    return;
  }

  const problemi = valida(dati, store.libreria());
  if (problemi.length) {
    await chiedi({
      titolo: "Blocco non valido",
      testo: problemi.slice(0, 6).join("\n"),
      opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
    });
    return;
  }

  const differenze = confronta(store.programma(), dati, store.libreria());

  const conferma = await sheet((close) =>
    h(
      "div",
      h("h2", "Cosa cambia"),
      h(
        "div.group",
        h(
          "div.list",
          ...differenze.slice(0, 40).map((d) =>
            h(
              "div.row",
              h("div.main", h("span.title", d.testo)),
              h(
                "span.pill",
                {
                  class:
                    d.tipo === "rimosso" ? "pill bad" : d.tipo === "aggiunto" ? "pill ok" : "pill",
                },
                d.tipo
              )
            )
          )
        )
      ),
      h(
        "p.footnote",
        { style: "margin:10px 16px 0" },
        "Allenamenti, misure, foto e note registrate non vengono toccate."
      ),
      h(
        "div.btn-wrap",
        h("button.btn", { onclick: () => close("si") }, "Applica"),
        h("div", { style: "height:8px" }),
        h("button.btn.secondary", { onclick: () => close(undefined) }, "Annulla")
      )
    )
  );

  if (conferma !== "si") return;

  await store.applicaBrief(dati);
  toast("Programma aggiornato.");
  await ridisegna();
}

async function esportaBackup() {
  const dump = await store.esportaCompleto();
  const oggi = new Date().toISOString().slice(0, 10);
  scarica(`coach-backup-${oggi}.json`, JSON.stringify(dump, null, 2));
  toast("Backup esportato.");
}

async function ripristinaSnapshot() {
  const dump = await store.snapshotSalvato();
  if (!dump) {
    toast("Nessuna copia interna disponibile.");
    return;
  }
  const scelta = await chiedi({
    titolo: "Ripristinare la copia interna?",
    testo: `Copia del ${dump.creatoIl ? new Date(dump.creatoIl).toLocaleString("it-IT") : "?"}. Le foto non sono incluse e andrebbero perse.`,
    opzioni: [{ etichetta: "Ripristina", valore: "si", stile: "destructive" }],
  });
  if (scelta !== "si") return;
  await store.db.importaTutto(dump, "sostituisci");
  location.reload();
}

async function importaBackup(ridisegna) {
  const file = await scegliFile(".json,application/json");
  if (!file) return;

  let dump;
  try {
    dump = JSON.parse(await file.text());
  } catch {
    toast("File non leggibile.");
    return;
  }

  const modo = dump.modo === "unisci" ? "unisci" : "sostituisci";
  const quando = dump.creatoIl ? new Date(dump.creatoIl).toLocaleString("it-IT") : "?";

  const scelta = await chiedi({
    titolo: modo === "unisci" ? "Importare questi dati?" : "Ripristinare il backup?",
    testo:
      modo === "unisci"
        ? `File del ${quando}. I dati vengono aggiunti a quelli già presenti, niente viene cancellato.`
        : `Backup del ${quando}. I dati attuali vengono sostituiti.`,
    opzioni: [
      {
        etichetta: modo === "unisci" ? "Importa" : "Sostituisci tutto",
        valore: "si",
        stile: modo === "unisci" ? "secondary" : "destructive",
      },
    ],
  });
  if (scelta !== "si") return;

  try {
    await store.db.importaTutto(dump, modo);
  } catch (e) {
    toast(e.message, 5000);
    return;
  }
  toast("Backup ripristinato.");
  location.reload();
}

async function azzera(ridisegna) {
  const uno = await chiedi({
    titolo: "Eliminare tutti i dati?",
    testo: "Allenamenti, misure, foto, programma. Non si può annullare.",
    opzioni: [{ etichetta: "Continua", valore: "si", stile: "destructive" }],
  });
  if (uno !== "si") return;
  const due = await chiedi({
    titolo: "Confermi?",
    testo: "Esporta prima un backup se non l'hai fatto.",
    opzioni: [{ etichetta: "Elimina definitivamente", valore: "si", stile: "destructive" }],
  });
  if (due !== "si") return;

  for (const s of Object.keys(store.db.SCHEMA)) await store.db.clearStore(s);
  location.reload();
}


/** Versione del service worker attivo: dice quale copia sta girando davvero. */
async function versioneInstallata() {
  try {
    const r = await fetch("sw.js", { cache: "no-store" });
    const t = await r.text();
    return t.match(/const VERSION = "([^"]+)"/)?.[1] || null;
  } catch {
    return null;
  }
}

async function forzaAggiornamento() {
  const scelta = await chiedi({
    titolo: "Scaricare l'ultima versione?",
    testo: "Vengono svuotate le copie locali dei file dell'app. I tuoi dati non si toccano: restano nell'archivio del telefono.",
    opzioni: [{ etichetta: "Aggiorna adesso", valore: "si" }],
  });
  if (scelta !== "si") return;
  try {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  } catch {
    /* niente service worker: si ricarica e basta */
  }
  location.reload(true);
}
