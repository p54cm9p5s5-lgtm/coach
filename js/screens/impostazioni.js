import { h, toast, sheet, chiedi, num, dataLunga, isoDate, aggiungi, provaSuono, versioneInstallata } from "../ui.js";
import { intestazione, applicaTema, temaCorrente } from "../app.js";
import * as store from "../store.js";
import { estraiBlocco, valida, confronta } from "../brief.js";
import { apriImport } from "./salute.js";

const NOME_SHORTCUT_CALENDARIO = "Coach Calendario";

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
  // `true` protetto, `false` cancellabile, `null` il telefono non risponde.
  const archivioProtetto = await (async () => {
    try {
      const r = await navigator.storage?.persisted?.();
      return typeof r === "boolean" ? r : null;
    } catch {
      return null;
    }
  })();
  const installata = appInstallata();

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
        ),
        // L'obiettivo di movimento lo decidi su Salute: l'app non lo sa leggere,
        // e finora ne dava per scontato uno solo. Adesso si può allineare.
        h(
          "button.row.accent",
          { onclick: () => cambiaObiettivoMovimento(ridisegna) },
          h(
            "div.main",
            h("span.title", "Obiettivo movimento"),
            h("span.sub", "il numero che vedi su Salute: serve alle percentuali")
          ),
          h("span.value", `${imp.obiettivoMovimentoKcal} kcal`)
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
            h(
              "div.row",
              // Non `num()`: arrotonda a un decimale e i dischi da 1,25 kg
              // diventavano «1,3 kg», un peso che non esiste. In allenamento
              // sono già scritti giusti, qui devono leggersi uguale.
              h("div.main", h("span.title", `Dischi da ${String(Number(peso)).replace(".", ",")} kg`)),
              h("span.value", `×${q}`)
            )
          ),
        // I manubri fanno parte dell'inventario quanto i dischi: senza vederli
        // qui non c'è modo di accorgersi che il brief non li dichiara, e le
        // istruzioni di montaggio sui manubri sparirebbero in silenzio.
        ...righeManubri(inv.manubri)
      ),
      h(
        "p.footnote",
        "L'inventario arriva dal master brief e serve a calcolare i dischi da montare." +
          (inv.manubri ? " I manubri regolabili usano gli stessi dischi del bilanciere." : "")
      )
    )
  );

  // ---- calendario ----
  const eventi = await store.agenda();
  // Data locale: con toISOString, dopo le 22 in Italia il giorno risultava
  // già quello dopo e gli eventi di oggi sparivano dal conto.
  const oggiIso = isoDate();
  const futuri = eventi.filter((e) => e.data >= oggiIso);
  aggiungi(wrap,
    h(
      "div.group",
      h("h2", "Calendario"),
      h(
        "div.list",
        h(
          "div.row",
          h("div.main", h("span.title", "Eventi letti"), h("span.sub", futuri.length ? `${futuri.length} da oggi in avanti` : "nessuno in programma")),
          h("span.value", String(eventi.length))
        ),
        h(
          "div.row",
          h("div.main", h("span.title", "Ultima lettura")),
          h("span.value", imp.ultimoImportAgenda ? new Date(imp.ultimoImportAgenda).toLocaleString("it-IT") : "mai")
        ),
        h(
          "button.row.accent",
          {
            onclick: () =>
              apriImport(ridisegna, {
                titolo: "Leggi il calendario",
                testo: `Il comando rapido «${NOME_SHORTCUT_CALENDARIO}» legge gli eventi delle prossime settimane e li copia negli appunti. Poi torni qui e incolli.`,
                shortcut: NOME_SHORTCUT_CALENDARIO,
              }),
          },
          h("div.main", h("span.title", "Leggi il calendario adesso")),
          h("span.chevron", "›")
        ),
        eventi.length
          ? h(
              "button.row.accent",
              {
                style: "color:var(--red)",
                onclick: async () => {
                  const ok = await chiedi({
                    titolo: "Dimenticare gli eventi letti?",
                    testo: "L'app torna a disegnare i giorni dallo split del master brief finché non rileggi il calendario. Sul calendario dell'iPhone non cambia niente.",
                    opzioni: [{ etichetta: "Dimentica", valore: "si", stile: "danger" }],
                  });
                  if (ok !== "si") return;
                  await store.svuotaAgenda();
                  toast("Eventi dimenticati.");
                  await ridisegna();
                },
              },
              h("div.main", h("span.title", "Dimentica gli eventi letti")),
              h("span.chevron", "›")
            )
          : null
      ),
      h(
        "p.footnote",
        eventi.length
          ? "Gli allenamenti li decide il coach e li scrive su Google Calendar, che si sincronizza col Calendario dell'iPhone. L'app legge e basta: nei giorni senza evento non mette niente di suo."
          : "Finché non leggi il calendario, l'app disegna i giorni dallo split scritto nel master brief."
      )
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
        // «1 questionari» e «1 notti»: il numero al singolare con la parola al
        // plurale fa sembrare rotto un conto che è giusto.
        h("div.row", h("div.main", h("span.title", "Allenamenti registrati"), h("span.sub", `${conta.serie} serie · ${conta.questionari} ${conta.questionari === 1 ? "questionario" : "questionari"}`)), h("span.value", String(conta.allenamenti))),
        h("div.row", h("div.main", h("span.title", "Misure del corpo"), h("span.sub", `${conta.foto} foto`)), h("span.value", String(conta.misure))),
        h("div.row", h("div.main", h("span.title", "Giorni di salute"), h("span.sub", `${conta.notti} ${conta.notti === 1 ? "notte" : "notti"} di sonno`)), h("span.value", String(conta.giorniSalute))),
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
        // L'app chiede a iOS di non considerare cancellabile l'archivio, ma la
        // risposta può essere no — e finora nessuno lo diceva. È l'unica riga
        // che cambia il peso di tutte le altre: se il telefono non lo protegge,
        // il backup su file non è prudenza, è l'unica copia che resta.
        (() => {
          const s = statoArchivio({ protetto: archivioProtetto, installata });
          return h(
            "div.row",
            h("div.main", h("span.title", s.titolo), h("span.sub", s.testo)),
            s.pillola === "ok"
              ? h("span.pill.ok", s.etichetta)
              : s.pillola === "warn"
                ? h("span.pill.warn", s.etichetta)
                : h("span.value", s.etichetta)
          );
        })(),
        h(
          "button.row.accent",
          { onclick: () => esportaBackup(ridisegna) },
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
          : null,
        // Quando un comando rapido cambia (o sbagliava), i giorni già scritti
        // restano com'erano per i campi che il pacchetto nuovo non contiene:
        // «assente non vuol dire zero» protegge i dati parziali, ma impedisce
        // anche di correggerli. Questo azzera solo la parte importata.
        h(
          "button.row.accent",
          { onclick: () => svuotaSalute(ridisegna) },
          h(
            "div.main",
            h("span.title", "Cancella i dati importati da Salute"),
            h("span.sub", "per rileggerli da zero col comando rapido")
          ),
          h("span.chevron", "›")
        )
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

/**
 * L'obiettivo di movimento è quello che hai impostato sull'anello di Salute.
 * L'app non può leggerlo (nessun accesso ai dati di Salute se non da te), e
 * dava per scontato 600: tutte le percentuali erano sbagliate se il tuo era
 * un altro numero.
 */
async function cambiaObiettivoMovimento(ridisegna) {
  const attuale = await store.impostazione("obiettivoMovimentoKcal");
  let scelto = Number(attuale) || 600;
  const val = h("span.val", `${scelto} kcal`);
  const esito = await sheet((close) =>
    h(
      "div",
      h("div.hero", h("p.kicker", "Salute"), h("h2", "Obiettivo movimento"), h("p.target", "kcal attive al giorno")),
      h(
        "div.group",
        h(
          "div.list",
          h(
            "div.field",
            h("label", "Obiettivo giornaliero"),
            h(
              "div.stepper",
              h("button", { onclick: () => { scelto = Math.max(100, scelto - 50); val.textContent = `${scelto} kcal`; } }, "−"),
              val,
              h("button", { onclick: () => { scelto = Math.min(3000, scelto + 50); val.textContent = `${scelto} kcal`; } }, "+")
            )
          )
        ),
        h("p.footnote", "Su iPhone: Salute › Sfoglia › Attività › Movimento. Copia qui lo stesso numero.")
      ),
      h("div.btn-wrap", h("button.btn", { onclick: () => close(scelto) }, "Salva"))
    )
  );
  if (!esito) return;
  await store.setImpostazione("obiettivoMovimentoKcal", esito);
  toast(`Obiettivo movimento: ${esito} kcal.`);
  await ridisegna();
}

/**
 * Le righe dei manubri, se il brief li dichiara. Un elenco di fissi si
 * raggruppa per peso: «×2» dice che ce ne sono due uguali, ed è proprio quello
 * che serve sapere per un esercizio a due manubri.
 */
function righeManubri(manubri) {
  if (!manubri) return [];
  const righe = [];
  const reg = manubri.regolabili;
  if (reg && reg.quantita > 0) {
    righe.push(
      h(
        "div.row",
        h(
          "div.main",
          h("span.title", "Manubri regolabili"),
          h("span.sub", `a vuoto ${String(reg.scaricoKg ?? 0).replace(".", ",")} kg ciascuno`)
        ),
        h("span.value", `×${reg.quantita}`)
      )
    );
  }
  const fissi = Array.isArray(manubri.fissi) ? manubri.fissi : [];
  const perPeso = new Map();
  for (const f of fissi) perPeso.set(f, (perPeso.get(f) || 0) + 1);
  for (const [peso, quanti] of [...perPeso.entries()].sort((a, b) => b[0] - a[0])) {
    righe.push(
      h(
        "div.row",
        h("div.main", h("span.title", `Manubrio fisso da ${String(peso).replace(".", ",")} kg`)),
        h("span.value", `×${quanti}`)
      )
    );
  }
  return righe;
}

async function caricaBrief(ridisegna) {
  const file = await scegliFile(".md,.markdown,.txt,text/markdown,text/plain");
  if (!file) return;

  let dati;
  try {
    const testo = await file.text();
    dati = estraiBlocco(testo);
  } catch (e) {
    await chiedi({ titolo: "Non caricato", testo: e.message, opzioni: [{ etichetta: "Ho capito", valore: "ok" }], annulla: false });
    return;
  }

  const problemi = valida(dati, store.libreria());
  if (problemi.length) {
    await chiedi({
      titolo: "Blocco non valido",
      testo: problemi.slice(0, 6).join("\n"),
      opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      annulla: false,
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

async function esportaBackup(ridisegna) {
  let dump;
  try {
    dump = await store.esportaCompleto();
  } catch (e) {
    await chiedi({
      titolo: "Backup non riuscito",
      testo: `Non sono riuscito a leggere l'archivio: ${e.message}`,
      opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      annulla: false,
    });
    return;
  }
  const oggi = isoDate();
  scarica(`coach-backup-${oggi}.json`, JSON.stringify(dump));

  // Il browser non dice se il file è stato davvero salvato: lo chiediamo a te,
  // invece di segnare «fatto» e lasciarti credere di avere una copia.
  const esito = await chiedi({
    titolo: "Hai salvato il file?",
    testo: `Dovrebbe chiamarsi coach-backup-${oggi}.json. Salvalo in File o iCloud Drive: è l'unica copia che sopravvive alla perdita del telefono.`,
    opzioni: [
      { etichetta: "Sì, l'ho salvato", valore: "si" },
      { etichetta: "No, riprovo", valore: "no" },
    ],
  });
  if (esito === "si") {
    await store.setImpostazione("ultimoExport", new Date().toISOString());
    toast("Backup registrato.");
    if (ridisegna) await ridisegna();
  }
}

async function svuotaSalute(ridisegna) {
  const giorni = (await store.giorniSalute()).length;
  const tutteLeNotti = await store.notti();
  // Le notti scritte a mano non le cancella: vanno tolte dal conto, se no il
  // foglio annuncia un numero e ne tocca un altro.
  const aMano = tutteLeNotti.filter((n) => n.fonte === "mano").length;
  const notti = tutteLeNotti.length - aMano;
  // Anche gli allenamenti letti dall'orologio vengono cancellati: vanno contati
  // qui, se no il foglio annuncia meno di quello che tocca.
  const daWatch = await store.db.count("allenamentiWatch");
  if (!giorni && !notti && !daWatch) {
    toast("Non c'è niente da cancellare: nessun dato importato da Salute.");
    return;
  }
  const conferma = await chiedi({
    titolo: "Cancellare i dati importati da Salute?",
    testo:
      `Vengono cancellati ${giorni} ${giorni === 1 ? "giorno" : "giorni"} di movimento e ${notti} ${notti === 1 ? "notte" : "notti"} di sonno` +
      (daWatch ? `, e ${daWatch} ${daWatch === 1 ? "allenamento letto" : "allenamenti letti"} dall'orologio` : "") +
      ".\n\n" +
      (aMano
        ? `${aMano === 1 ? "La notte che hai scritto tu resta" : `Le ${aMano} notti che hai scritto tu restano`}: reimportare non ${aMano === 1 ? "la" : "le"} riporterebbe, tornerebbe il numero sbagliato dell'orologio.\n\n`
        : "") +
      "Gli allenamenti che hai registrato nell'app, le misure, le foto e il programma NON si toccano.\n\n" +
      "ATTENZIONE: tornano solo gli ultimi 30 giorni. Tutto quello che è più " +
      "vecchio — giorni di movimento, notti, allenamenti dell'orologio — non si " +
      "può più rileggere da nessuna parte e va perso per sempre.\n\n" +
      "Se sei lontano da casa o senza il file di esportazione di Salute, non " +
      "farlo adesso: questa cancellazione si ripara solo reimportando, e " +
      "reimportare richiede il telefono con i dati sotto mano.",
    opzioni: [{ etichetta: "Cancella e rileggo", valore: "si", stile: "danger" }],
  });
  if (conferma !== "si") return;
  // Anche qui: se l'archivio non risponde, senza rete il tocco non faceva
  // niente e il messaggio «cancellati» non arrivava mai — impossibile capire
  // se erano stati cancellati o no.
  try {
    await store.svuotaSalute();
  } catch (e) {
    await chiedi({
      titolo: "Cancellazione non riuscita",
      testo: `${e.message}\n\nI dati sono rimasti dov'erano: non è stato cancellato niente a metà.`,
      opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      annulla: false,
    });
    return;
  }
  toast("Dati salute cancellati. Ora reimporta col comando rapido.");
  await ridisegna();
}

async function ripristinaSnapshot() {
  const dump = await store.snapshotSalvato();
  if (!dump) {
    toast("Nessuna copia interna disponibile.");
    return;
  }
  const scelta = await chiedi({
    titolo: "Ripristinare la copia interna?",
    testo: `Copia del ${dump.creatoIl ? new Date(dump.creatoIl).toLocaleString("it-IT") : "?"}. Tutto il resto torna a com'era in quel momento. Le foto del corpo non sono nella copia e restano dove sono: non vengono né toccate né perse.`,
    opzioni: [{ etichetta: "Ripristina", valore: "si", stile: "destructive" }],
  });
  if (scelta !== "si") return;

  // Prima di sovrascrivere: una copia dello stato attuale, così un ripristino
  // sbagliato non è un vicolo cieco. Il dump non contiene la copia interna
  // (si escluderebbe da sola), quindi senza questo il ripristino cancellerebbe
  // proprio la rete di sicurezza che si sta usando.
  let indietro = null;
  try {
    indietro = await store.snapshotAutomatico("prima del ripristino");
  } catch {
    /* se non riesce si prosegue: il ripristino resta l'operazione richiesta */
  }

  try {
    // Il tetto dichiarato sulle sigarette non si perde ripristinando una copia
    // fatta prima della decisione: è la via più involontaria per annullarla.
    const tettoPrima = await store.tettoFumoDichiarato();
    await store.db.importaTutto(dump, "sostituisci");
    await store.proteggiTettoFumo(tettoPrima);
  } catch (e) {
    // La copia di sicurezza appena fatta ha preso il posto di quella che
    // stavi ripristinando: se il ripristino fallisce va rimessa quella
    // originale, altrimenti resti senza la copia che volevi.
    let copiaRimessa = true;
    try {
      await store.setImpostazione("snapshotAutomatico", JSON.stringify(dump));
      await store.setImpostazione("ultimoSnapshot", dump.creatoIl || new Date().toISOString());
    } catch {
      // Se nemmeno rimettere a posto la copia riesce, tacere sarebbe la bugia
      // peggiore di tutte: la schermata continuerebbe ad annunciare una copia
      // interna che non c'è più, e la rete di sicurezza risulterebbe intatta
      // proprio nel momento in cui non lo è.
      copiaRimessa = false;
      try {
        await store.setImpostazione("ultimoSnapshot", null);
      } catch {
        /* qui non resta niente da fare: lo dice la frase qui sotto */
      }
    }
    await chiedi({
      titolo: "Ripristino non riuscito",
      testo:
        `${e.message}\n\nL'archivio è rimasto com'era` +
        (copiaRimessa
          ? " e la copia interna è ancora quella di prima."
          : ".\n\nNon sono riuscito a rimettere a posto la copia interna: adesso non c'è. Fai subito un backup su file."),
      opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      annulla: false,
    });
    return;
  }

  // Il ripristino ha svuotato le impostazioni: la copia di sicurezza appena
  // fatta va rimessa, altrimenti dopo l'operazione non resta niente a cui
  // tornare e la schermata continuerebbe ad annunciare una copia inesistente.
  try {
    if (indietro) {
      await store.setImpostazione("snapshotAutomatico", JSON.stringify(indietro));
      await store.setImpostazione("ultimoSnapshot", new Date().toISOString());
    } else {
      await store.setImpostazione("ultimoSnapshot", null);
    }
  } catch {
    // Meglio «mai» che una data falsa: se la copia non è stata riscritta, la
    // schermata deve dire che non c'è, non annunciarne una che non esiste.
    try {
      await store.setImpostazione("ultimoSnapshot", null);
    } catch {
      /* niente da fare */
    }
  }
  location.reload();
}

/** L'app aperta dalla schermata Home, non dentro Safari. */
export function appInstallata() {
  try {
    // `standalone` è la strada di iOS; `display-mode` quella standard.
    if (navigator.standalone === true) return true;
    if (navigator.standalone === false) return false;
    if (window.matchMedia?.("(display-mode: standalone)")?.matches) return true;
    return false;
  } catch {
    return null;
  }
}

/**
 * Quanto è al sicuro l'archivio, detto in modo che significhi qualcosa.
 *
 * `navigator.storage.persist()` su iPhone risponde quasi sempre di no: non è un
 * allarme, è la risposta normale di Safari a chiunque. Mostrarla nuda spaventava
 * per una cosa che non è quella che conta.
 *
 * Quello che conta è **dove gira l'app**. Dentro Safari i dati di un sito sono
 * roba di passaggio, e il sistema può farli fuori dopo qualche giorno che non la
 * apri. Aggiunta alla schermata Home diventa un'app installata: i dati restano
 * finché non la togli tu. Il consiglio non cambia mai — il backup su file è
 * l'unica copia che sopravvive comunque — ma il pericolo sì, ed è giusto
 * distinguerli.
 *
 * Sta fuori dalla schermata e si esporta apposta: così le sei combinazioni si
 * possono provare una per una, invece che sperare di incontrarle.
 */
export function statoArchivio({ protetto, installata }) {
  if (protetto === true) {
    return {
      titolo: "Archivio protetto dal telefono",
      testo: "il telefono si è impegnato a non cancellarlo per fare spazio",
      pillola: "ok",
      etichetta: "sì",
    };
  }
  if (installata === true) {
    return {
      titolo: "Archivio protetto dal telefono",
      testo:
        "il telefono non lo promette (su iPhone risponde così a tutti), ma l'app è installata dalla schermata Home: i dati restano finché non la togli. Il backup su file resta l'unica copia che sopravvive al telefono.",
      pillola: "neutra",
      etichetta: "installata",
    };
  }
  if (installata === false) {
    return {
      titolo: "App non installata: archivio a rischio",
      testo:
        "stai usando Coach dentro il browser, e lì i dati di un sito possono essere cancellati dal sistema dopo qualche giorno che non lo apri. Aggiungi Coach alla schermata Home (Condividi → «Aggiungi a Home»): i dati diventano quelli di un'app installata.",
      pillola: "warn",
      etichetta: "da installare",
    };
  }
  return {
    titolo: "Archivio protetto dal telefono",
    testo: "questo telefono non sa dirlo: tieni il backup su file aggiornato",
    pillola: "neutra",
    etichetta: "—",
  };
}

/**
 * Cosa c'è nel file, accanto a cosa c'è adesso nel telefono.
 *
 * Si contano le tre cose che si perdono davvero — allenamenti, misure e
 * attività extra — e si dice fin dove arriva ciascuna delle due parti. Se il
 * file è più vecchio, la riga lo dice con le parole giuste: quello che hai
 * registrato dopo non c'è là dentro.
 */
async function confrontoBackup(dump) {
  const dati = dump?.dati && typeof dump.dati === "object" ? dump.dati : {};
  const righe = [];
  const ultimo = (elenco) => {
    const date = (Array.isArray(elenco) ? elenco : []).map((x) => x?.data).filter(Boolean).sort();
    return date.length ? date[date.length - 1] : null;
  };
  const conta = async (archivio, singolare, plurale) => {
    const nel = Array.isArray(dati[archivio]) ? dati[archivio] : [];
    let ora = [];
    try {
      ora = await store.db.all(archivio);
    } catch {
      ora = [];
    }
    if (!nel.length && !ora.length) return;
    const parola = (n) => `${n} ${n === 1 ? singolare : plurale}`;
    const fin = (elenco) => {
      const d = ultimo(elenco);
      return d ? `, fino al ${d.slice(8, 10)}/${d.slice(5, 7)}` : "";
    };
    righe.push(`${plurale.charAt(0).toUpperCase()}${plurale.slice(1)}: nel file ${parola(nel.length)}${fin(nel)} · adesso ${parola(ora.length)}${fin(ora)}`);
  };
  await conta("sedute", "allenamento", "allenamenti");
  await conta("misure", "misura", "misure");
  await conta("extra", "attività", "attività extra");
  return righe.length ? righe.join("\n") : "Il file non contiene allenamenti, misure o attività.";
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

  // «I dati attuali vengono sostituiti» è vero ma cieco: non dice cosa stai
  // per rimettere né cosa stai per togliere. Un backup di tre settimane fa si
  // riconosce solo da lì, e chi lo apre per recuperare una cosa sola non si
  // accorge di riportare indietro tutto il resto. La copia di sicurezza qui
  // sotto rende l'errore rimediabile; questo lo rende evitabile.
  const quantoCe = await confrontoBackup(dump);

  const scelta = await chiedi({
    titolo: modo === "unisci" ? "Importare questi dati?" : "Ripristinare il backup?",
    testo:
      modo === "unisci"
        ? `File del ${quando}. I dati vengono aggiunti a quelli già presenti. Le voci con lo stesso identificativo vengono sostituite da quelle del file; il resto resta com'è.`
        : `Backup del ${quando}. I dati attuali vengono sostituiti.\n\n${quantoCe}`,
    opzioni: [
      {
        etichetta: modo === "unisci" ? "Importa" : "Sostituisci tutto",
        valore: "si",
        stile: modo === "unisci" ? "secondary" : "destructive",
      },
    ],
  });
  if (scelta !== "si") return;

  // Rete di sicurezza: prima di sovrascrivere con un file si tiene una copia
  // interna di com'era. Un backup sbagliato non deve essere un vicolo cieco.
  let indietro = null;
  try {
    indietro = await store.snapshotAutomatico("prima dell'import da file");
  } catch {
    /* se non riesce si prosegue: l'import resta l'operazione richiesta */
  }

  let esito = null;
  try {
    const tettoPrima2 = await store.tettoFumoDichiarato();
    esito = await store.db.importaTutto(dump, modo);
    await store.proteggiTettoFumo(tettoPrima2);
    if (indietro && modo === "sostituisci") {
      // Il file importato ha riscritto anche le impostazioni: la copia di
      // sicurezza appena fatta va rimessa, altrimenti sparisce proprio quella.
      try {
        await store.setImpostazione("snapshotAutomatico", JSON.stringify(indietro));
        // Anche la data, altrimenti le Impostazioni mostrano una copia interna
        // «di ieri» che in realtà è stata fatta un minuto fa.
        await store.setImpostazione("ultimoSnapshot", new Date().toISOString());
      } catch {
        // Come sopra: se la copia non è stata riscritta, «mai» è la verità.
        try {
          await store.setImpostazione("ultimoSnapshot", null);
        } catch {
          /* niente da fare */
        }
      }
    }
  } catch (e) {
    toast(e.message, 5000);
    return;
  }
  if (esito?.ignorati?.length) {
    // Se una parte del file non è entrata bisogna saperlo prima di credere di
    // avere tutto: succede se il file viene da una versione più nuova dell'app.
    await chiedi({
      titolo: "Ripristinato, ma non tutto",
      testo: `Queste parti del file non sono entrate perché questa versione dell'app non le conosce: ${esito.ignorati.join(", ")}. Tieni il file: aggiornando l'app potrai riprovare.`,
      opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      annulla: false,
    });
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

  // Solo gli archivi che questo telefono ha davvero, e in un colpo solo: uno
  // svuotamento a pezzi che si ferma a metà lasciava l'app con dati parziali
  // e nessun messaggio, e nominare un archivio inesistente lo faceva fallire
  // proprio all'inizio.
  // Il massimo dichiarato sulle sigarette non è un dato come gli altri: è una
  // decisione presa una volta e messa dove due tocchi non possano disfarla.
  // «Elimina tutti i dati» era rimasta l'unica strada per annullarla senza
  // dirlo, e le due strade del ripristino sono già protette allo stesso modo.
  try {
    // Anche la lettura del tetto sta dentro: legge l'archivio, e se l'archivio
    // non risponde falliva qui fuori — l'errore usciva dal gestore e il tocco
    // su «Elimina definitivamente» non faceva assolutamente niente, senza
    // nemmeno un messaggio.
    const tettoPrima = await store.tettoFumoDichiarato();
    await store.db.svuotaTutto();
    await store.proteggiTettoFumo(tettoPrima);
  } catch (e) {
    await chiedi({
      titolo: "Eliminazione non riuscita",
      testo: `${e.message}\n\nL'archivio è rimasto com'era: non è stato cancellato niente a metà.`,
      opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      annulla: false,
    });
    return;
  }
  location.reload();
}



async function forzaAggiornamento() {
  const scelta = await chiedi({
    titolo: "Scaricare l'ultima versione?",
    testo: "Vengono svuotate le copie locali dei file dell'app. I tuoi dati non si toccano: restano nell'archivio del telefono.",
    opzioni: [{ etichetta: "Aggiorna adesso", valore: "si" }],
  });
  if (scelta !== "si") return;

  // Prima si controlla che i file si scarichino davvero, POI si buttano quelli
  // che hai. Al contrario, senza rete (o con il wifi che chiede il login)
  // l'app restava senza niente: schermata bianca e nessun modo di rimediare
  // finché non tornava la linea.
  const daControllare = ["index.html", "js/app.js", "css/app.css"];
  try {
    const risposte = await Promise.all(
      daControllare.map((f) => fetch(`${f}?prova=${Date.now()}`, { cache: "no-store" }))
    );
    const rotta = risposte.find((r) => !r.ok);
    if (rotta) throw new Error(`il server ha risposto ${rotta.status}`);
  } catch (e) {
    await chiedi({
      titolo: "Aggiornamento non fatto",
      testo: `I file dell'app non si scaricano (${e.message}). Non ho toccato niente: l'app resta quella che hai, e funziona anche senza rete. Riprova quando sei connesso.`,
      opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      annulla: false,
    });
    return;
  }

  // Se svuotare la copia locale non riesce, ricaricare non serve a niente: si
  // riparte dagli stessi file di prima. Tacere farebbe sembrare fatto un
  // aggiornamento che non è avvenuto — ed è esattamente il tasto che si tocca
  // quando si sospetta che l'app sia rimasta indietro.
  let svuotata = true;
  try {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  } catch (e) {
    // Niente service worker è normale (in locale senza https): in quel caso
    // non c'è copia da svuotare e il ricarico basta davvero.
    svuotata = !navigator.serviceWorker || !(await caches.keys().catch(() => [])).length;
    if (!svuotata) {
      await chiedi({
        titolo: "Copia locale non svuotata",
        testo: `Non sono riuscito a cancellare la copia dell'app su questo telefono (${e.message}). Ricarico lo stesso, ma se resta la versione vecchia chiudi l'app e riaprila.`,
        opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
        annulla: false,
      });
    }
  }
  location.reload(true);
}
