import {
  h, isoDate, dataLunga, dataBreve, sheet, num, giorniTra, durataUmana, aggiungi, chiedi, toast,
  versioneInstallata,
} from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";
import { graficoAttivita, fascia, legenda, periodoSalvato, selettorePeriodo, inizioPeriodo, etichettaPeriodo } from "../grafico.js";
import { calendario, calcolaAttese, riassuntoGiorno } from "../calendario.js";
import { anello, giudizio } from "../punteggio.js";
import { sbloccaAudio, unaVoltaSola } from "../ui.js";

let meseMostrato = null;

export async function render({ vaiA, ridisegna }) {
  const oggi = isoDate();
  const prog = store.programma();
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Home", { icona: "ingranaggio", etichetta: "Impostazioni", onclick: () => vaiA("impostazioni") }));

  if (!prog) {
    aggiungi(wrap,
      h(
        "div.empty",
        h("h3", "Nessun programma caricato"),
        h("p", "Carica il master brief: l'app legge il blocco tecnico in coda al documento e imposta split, esercizi e regole."),
        h("div.btn-wrap", h("button.btn", { onclick: () => vaiA("impostazioni") }, "Carica master brief"))
      )
    );
    return wrap;
  }

  aggiungi(wrap, await bloccoAllenamento(vaiA, ridisegna, oggi));
  aggiungi(wrap, await bloccoGrafico(ridisegna));
  aggiungi(wrap, await bloccoProposte());
  aggiungi(wrap, await bloccoCalendario(vaiA, ridisegna));

  aggiungi(wrap,
    h("div.btn-wrap", h("button.btn", { onclick: () => vaiA("export") }, "Claude")),
    // versione a vista: quando qualcosa "non si aggiorna", questo numero dice
    // in un colpo solo se il telefono ha ricevuto o no l'ultima pubblicazione
    h(
      "p",
      {
        style: "margin:18px 16px 0;text-align:center;font-size:11px;color:var(--label-tertiary)",
        onclick: () => vaiA("impostazioni"),
      },
      `versione ${await versioneInstallata()}`
    )
  );

  return wrap;
}

// ---------- grafico ----------

async function bloccoGrafico(ridisegna) {
  const periodo = periodoSalvato();
  const oggi = isoDate();
  const giorni = await store.giorniSalute();
  const notti = await store.notti();
  const tutti = await store.allenamenti();
  const obiettivo = await store.impostazione("obiettivoMovimentoKcal");

  const inizioProgramma = store.programma()?.aggiornatoIl || "0000-00-00";
  const perData = new Map(giorni.map((g) => [g.data, g]));
  const perNotte = new Map(notti.map((n) => [n.data, n]));
  const allenati = new Set(tutti.filter((s) => s.stato === "completata").map((s) => s.data));

  // Il grafico parte dal primo giorno per cui esiste un dato e arriva a oggi:
  // il periodo prima dell'app non racconta niente. Oltre le otto settimane la
  // finestra scorre, altrimenti le barre diventano illeggibili.
  const primeDate = [
    ...giorni.filter((g) => g.presente).map((g) => g.data),
    ...notti.filter((n) => n.presente).map((n) => n.data),
    ...[...allenati],
  ].sort();
  const inizio = primeDate[0] || oggi;
  // Il grafico non parte mai da prima del primo dato: sarebbe una fila di
  // giorni vuoti. Oltre il mese non va comunque.
  const disponibili = giorniTra(inizio, oggi) + 1;
  let quanti = Math.min(periodo.graficoGiorni, Math.max(disponibili, 7));
  if (periodo.id === "7") quanti = 7;

  const GIORNI_FUTURI = periodo.futuri;
  const serie = [];
  for (let i = quanti - 1; i >= -GIORNI_FUTURI; i--) {
    const d = new Date(oggi + "T00:00:00");
    d.setDate(d.getDate() - i);
    const p = (n) => String(n).padStart(2, "0");
    const data = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const g = perData.get(data);
    const n = perNotte.get(data);
    serie.push({
      data,
      futuro: data > oggi,
      // Prima che il programma esistesse non era previsto niente: segnarlo
      // dipingerebbe di «allenamento previsto» un passato che non c'era.
      previsto: data >= inizioProgramma && Boolean(store.giornoPrevisto(data)),
      origine: store.origineGiorno(data),
      presente: Boolean(g?.presente),
      kcal: g?.presente ? g.kcalAttive : null,
      passi: g?.presente ? g.passi : null,
      obiettivo: g?.obiettivoKcal || null,
      allenamento: allenati.has(data),
      sonnoMin: n?.presente ? n.durataMin : null,
    });
  }

  // Le medie sono su tutto quello che l'app ha, non sull'ultima settimana: si
  // muovono a ogni import e diventano più solide man mano che i dati crescono.
  const media = (arr, campo) => {
    const v = arr.map((x) => x[campo]).filter((x) => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };

  // Finestra dei numeri: quella scelta, oppure tutto lo storico.
  const daQuando = inizioPeriodo(periodo, oggi);
  const dentro = (r) => !daQuando || (r.data >= daQuando && r.data <= oggi);
  // Oggi non è finita: nella media entrerebbe come un giorno fiacco.
  const giorniConDati = giorni.filter((g) => g.presente && dentro(g) && g.data < oggi);
  const nottiConDati = notti.filter((n) => n.presente && dentro(n));
  const mediaKcal = media(giorniConDati, "kcalAttive");
  const mediaPassi = media(giorniConDati, "passi");
  const mediaSonno = media(nottiConDati, "durataMin");
  const quantiKcal = giorniConDati.filter((g) => g.kcalAttive != null).length;
  const quantiPassi = giorniConDati.filter((g) => g.passi != null).length;
  const quanteNotti = nottiConDati.filter((n) => n.durataMin != null).length;

  const selettore = selettorePeriodo(periodo, ridisegna);

  return h(
    "div.group",
    h("h2", "Andamento"),
    h(
      "div",
      { style: "background:var(--bg-grouped);border-radius:14px;padding:16px 14px 10px" },
      selettore,
      fascia([
        {
          etichetta: "Passi",
          valore: mediaPassi != null ? mediaPassi.toLocaleString("it-IT") : "—",
          nota: `${quantiPassi} ${quantiPassi === 1 ? "giorno" : "giorni"} · ${etichettaPeriodo(periodo)}`,
        },
        {
          etichetta: "Movimento",
          valore: mediaKcal != null ? String(mediaKcal) : "—",
          unita: "kcal",
          nota: `${quantiKcal} ${quantiKcal === 1 ? "giorno" : "giorni"} · ${etichettaPeriodo(periodo)}`,
        },
        {
          etichetta: "Sonno",
          valore: mediaSonno != null ? durataUmana(mediaSonno * 60) : "—",
          nota: `${quanteNotti} ${quanteNotti === 1 ? "notte" : "notti"} · ${etichettaPeriodo(periodo)}`,
        },
      ]),
      graficoAttivita(serie, { obiettivoRipiego: obiettivo }),
      legenda()
    )
  );
}

// ---------- allenamento di oggi ----------

async function bloccoAllenamento(vaiA, ridisegna, oggi) {
  const inCorso = await store.sedutaInCorso();
  if (inCorso) {
    // Un allenamento rimasto aperto da un altro giorno non è «l'allenamento di
    // oggi»: riprendendolo, le serie di oggi finirebbero registrate alla sua
    // data. Va detto, e va data la via d'uscita.
    const vecchio = inCorso.data !== oggi;
    // Un allenamento aperto e mai cominciato non ha niente da archiviare:
    // «Chiudi e archivia» avrebbe creato un allenamento vuoto nello storico.
    // Vuoto vuol dire davvero niente dentro: anche un esercizio saltato porta
    // con sé un motivo e una nota, e il cardio registrato è un dato. Prima
    // l'app diceva «niente da archiviare» e l'unica via era cancellare tutto.
    const vuoto =
      !(await store.serieDi(inCorso.id)).length &&
      !(await store.questionariDi(inCorso.id)).length &&
      !inCorso.cardio?.eseguito &&
      !inCorso.riscaldamento?.fatto;
    const ora = new Date(inCorso.oraInizio).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    return h(
      "div.group",
      h("h2", vecchio ? "Allenamento rimasto aperto" : "Allenamento aperto"),
      h(
        "div.list",
        h(
          "button.row",
          { onclick: () => vaiA("seduta") },
          h(
            "div.main",
            h("span.title", inCorso.tipoNome),
            h("span.sub", vecchio ? `iniziato ${dataLunga(inCorso.data).toLowerCase()} alle ${ora}` : `iniziato alle ${ora}`)
          ),
          h("span.chevron", "›")
        )
      ),
      vecchio
        ? h(
            "p.footnote",
            { style: "margin:10px 16px 0" },
            `È aperto dal ${dataBreve(inCorso.data)}. Se lo riprendi, quello che registri oggi resta datato ${dataBreve(inCorso.data)}. Chiudilo o eliminalo per cominciarne uno nuovo.`
          )
        : null,
      h(
        "div.btn-wrap",
        h("button.btn", { onclick: () => vaiA("seduta") }, vecchio ? `Riprendi (resta del ${dataBreve(inCorso.data)})` : "Riprendi allenamento"),
        vecchio && vuoto
          ? h(
              "p.footnote",
              { style: "margin:10px 0 0;color:var(--label-tertiary);text-align:center" },
              "Non c'è nessuna serie registrata: non c'è niente da archiviare."
            )
          : null,
        vecchio && !vuoto
          ? h(
              "button.btn.secondary",
              {
                onclick: unaVoltaSola(async () => {
                  const scelta = await chiedi({
                    titolo: `Chiudere l'allenamento del ${dataBreve(inCorso.data)}?`,
                    testo: "Resta in archivio con quello che ci hai registrato, alla sua data. Poi puoi cominciare quello di oggi.",
                    opzioni: [{ etichetta: "Chiudi e archivia", valore: "chiudi" }],
                  });
                  if (scelta !== "chiudi") return;
                  await store.chiudiSeduta(inCorso.id, {});
                  await store.aggiornaMotore();
                  toast("Allenamento archiviato alla sua data.");
                  await ridisegna();
                }),
              },
              "Chiudi e archivia"
            )
          : null,
        vecchio
          ? h(
              "button.btn.secondary",
              {
                style: "color:var(--red)",
                onclick: unaVoltaSola(async () => {
                  const scelta = await chiedi({
                    titolo: "Eliminare l'allenamento aperto?",
                    testo: "Spariscono anche le serie e i questionari che contiene. Non si recupera.",
                    opzioni: [{ etichetta: "Elimina", valore: "si", stile: "danger" }],
                  });
                  if (scelta !== "si") return;
                  await store.annullaSeduta(inCorso.id);
                  await store.aggiornaMotore();
                  toast("Allenamento eliminato.");
                  await ridisegna();
                }),
              },
              "Elimina"
            )
          : null
      )
    );
  }

  const previsto = store.giornoPrevisto(oggi);
  const fatteOggi = (await store.allenamenti()).filter((s) => s.data === oggi && s.stato === "completata");
  const giaFatto = fatteOggi.some((s) => s.tipoId === previsto?.id);

  // Allenamento già chiuso: al posto dei pulsanti si vede il punteggio, che è
  // l'unica cosa che serve sapere a lavoro finito.
  const ultima = fatteOggi.filter((s) => s.oraFine).sort((a, b) => a.oraFine - b.oraFine).at(-1);
  if (ultima) {
    const comp = await store.completezzaSeduta(ultima.id);
    return h(
      "div.group",
      h("h2", "Oggi"),
      h(
        "button",
        {
          style:
            "display:block;width:calc(100% - 32px);margin:0 16px;background:var(--bg-grouped);border:0;border-radius:14px;padding:20px 16px 18px;text-align:center;color:inherit;font:inherit",
          onclick: () => (location.hash = `#/seduta?riepilogo=${ultima.id}`),
        },
        h("p", { style: "margin:0 0 14px;font-size:26px;font-weight:700;letter-spacing:-0.5px" }, ultima.tipoNome),
        comp
          ? anello(comp.totale, { dimensione: 168, sottotitolo: giudizio(comp.totale).testo })
          : h("p", { style: "margin:0;color:var(--label-secondary)" }, "completato oggi"),
        h("p", { style: "margin:14px 0 0;font-size:13px;color:var(--label-secondary)" }, "Vedi il risultato ›")
      )
    );
  }

  const origine = store.origineGiorno(oggi);
  // «Riposo» va scritto solo quando è davvero riposo. Se il calendario dice
  // qualcosa che l'app non riconosce, o se il pacchetto è vecchio, l'app non
  // sa cosa tocca oggi: dirlo è l'unica risposta onesta.
  const titolo = previsto
    ? previsto.nome
    : origine.sconosciuto
      ? origine.titolo || "Da vedere sul calendario"
      : origine.scaduta
        ? "Calendario da aggiornare"
        : origine.oltreProgrammato
          ? "Non ancora programmato"
          : "Riposo";
  const sotto = giaFatto
    ? "completato oggi"
    : previsto
      ? `${previsto.esercizi?.length || 0} esercizi${previsto.cardio ? " + cardio" : ""}`
      : origine.riposo
        ? "riposo, dal calendario del coach"
        : origine.sconosciuto
        ? `«${origine.titolo}» non è un allenamento del programma`
        : origine.scaduta
          ? `il calendario importato arriva al ${dataBreve(origine.fine)}: aggiornalo con il comando Coach Calendario`
          : origine.oltreProgrammato
            ? `il coach ha programmato fino al ${dataBreve(origine.ultimoEvento)}`
            : origine.fonte === "calendario"
              ? "niente sul calendario per oggi"
              : "nessun allenamento previsto dallo split";

  return h(
    "div.group",
    h("h2", "Oggi"),
    h(
      "div",
      { style: "background:var(--bg-grouped);border-radius:14px;padding:20px 16px 16px;text-align:center" },
      h(
        "p",
        { style: "margin:0;font-size:26px;font-weight:700;letter-spacing:-0.5px" },
        titolo
      ),
      h("p", { style: "margin:6px 0 16px;font-size:13px;color:var(--label-secondary)" }, sotto),
      origine.fonte === "calendario" && previsto
        ? h(
            "p",
            { style: "margin:-8px 0 14px;font-size:11px;color:var(--label-tertiary)" },
            "dal calendario"
          )
        : null,
      previsto
        ? h(
            "button.btn",
            {
              class: giaFatto ? "btn secondary" : "btn",
              onclick: unaVoltaSola(async () => {
                // Il tocco che avvia l'allenamento è anche quello che autorizza
                // il suono del recupero: dopo non ci sono più occasioni utili.
                sbloccaAudio();
                // Se una seduta è già aperta non se ne crea una seconda: il
                // doppio tocco lasciava due allenamenti aperti insieme.
                const gia = await store.sedutaInCorso();
                if (!gia) await store.iniziaSeduta({ data: oggi, giornoId: previsto.id });
                vaiA("seduta");
              }),
            },
            giaFatto ? "Rifai questo allenamento" : "Inizia allenamento"
          )
        : null,
      // Quale allenamento si fa in un dato giorno lo decide lo split del master
      // brief. L'app non offre alternative: non è una scelta che spetta a lei.
      previsto
        ? null
        : h(
            "p",
            { style: "margin:10px 0 0;font-size:12px;color:var(--label-tertiary)" },
            origine.riposo
              ? "Riposo, e lo dice il calendario del coach."
              : origine.oltreProgrammato
              ? `Il coach ha programmato fino al ${dataBreve(origine.ultimoEvento)}: oltre non c'è ancora niente.`
              : origine.scaduta
              ? "Il calendario letto è vecchio: rileggilo per sapere cosa tocca."
              : origine.sconosciuto
                ? "Sul calendario c'è qualcosa, ma non è un allenamento del programma."
                : origine.vuoto
                  ? "Sul calendario oggi non c'è niente."
                  : "Il giorno di riposo fa parte del programma."
          )
    )
  );
}

// ---------- proposte ----------

async function bloccoProposte() {
  // In coda come tutti gli altri ricalcoli: aprendo la Home mentre l'app
  // chiudeva un allenamento partivano due giri insieme sugli stessi dati.
  await store.inCoda(async () => {
    await store.aggiornaProposte();
    await store.aggiornaSegnali();
  });
  const sospese = await store.proposteInSospeso();
  const avvisi = await store.segnali();
  if (!sospese.length && !avvisi.length) return null;

  const lista = h("div.list");
  for (const p of sospese.slice(0, 3)) {
    aggiungi(lista,
      h(
        "a.row",
        { href: `#/proposte?proposta=${p.id}` },
        h("div.main", h("span.title", p.titolo), h("span.sub", `Livello ${p.livelloGerarchia}`)),
        h("span.chevron", "›")
      )
    );
  }
  if (avvisi.length) {
    const attenzione = avvisi.filter((s) => s.gravita === "attenzione");
    aggiungi(lista,
      h(
        "a.row",
        { href: "#/proposte" },
        h(
          "div.main",
          h("span.title", `${avvisi.length} ${avvisi.length === 1 ? "segnale aperto" : "segnali aperti"}`),
          attenzione.length ? h("span.sub", attenzione[0].messaggio) : null
        ),
        attenzione.length ? h("span.pill.warn", "attenzione") : h("span.pill", "info"),
        h("span.chevron", "›")
      )
    );
  }

  return h("div.group", h("h2", "Da decidere"), lista);
}

// ---------- calendario ----------

async function bloccoCalendario(vaiA, ridisegna) {
  const oggi = isoDate();
  if (!meseMostrato) meseMostrato = new Date(oggi + "T00:00:00");

  const tutte = await store.allenamenti();
  const allenamenti = new Map();
  for (const s of tutte) {
    // Due allenamenti nello stesso giorno: sul calendarietto ci sta un segno
    // solo, e deve essere quello finito. Prima vinceva l'ultimo letto, così un
    // allenamento appena aperto cancellava dal calendario quello già chiuso.
    const gia = allenamenti.get(s.data);
    if (gia?.completato && s.stato !== "completata") continue;
    allenamenti.set(s.data, { id: s.id, nome: s.tipoNome, completato: s.stato === "completata" });
  }

  const imp = await store.impostazioni();
  // Solo le date: caricare tutte le immagini per sapere quando è stato
  // l'ultimo set costava decine di megabyte a ogni disegno della Home.
  const dateFoto = await store.dateFoto();
  const attese = calcolaAttese({
    oggi,
    ultimoPeso: (await store.ultimaMisura("peso"))?.data || null,
    ultimaVita: (await store.ultimaMisura("vitaOmbelico"))?.data || null,
    ultimaFoto: dateFoto[0] || null,
    ultimoExport: imp.ultimoExport,
    ultimoImportSalute: imp.ultimoImportSalute,
    // Gli eventi del coach si aggiungono ai promemoria del protocollo: gli
    // allenamenti li decide il calendario, ma pesata, misure e foto restano
    // compito dell'app, che è l'unica a sapere quando li hai fatti davvero.
    eventi: store.agendaAttiva() ? await store.agenda() : null,
    cadenze: store.regole().cadenze,
  });

  // il programma comincia dal primo allenamento registrato, o dal brief
  const primaData = tutte.map((s) => s.data).sort()[0] || null;
  const dalBrief = store.programma()?.aggiornatoIl || null;
  const dal = [primaData, dalBrief].filter(Boolean).sort()[0] || null;

  const cal = calendario({
    dal,
    mese: meseMostrato,
    giornoPrevisto: (data) => store.giornoPrevisto(data),
    allenamenti,
    attese,
    onMese: async (delta) => {
      meseMostrato = new Date(meseMostrato.getFullYear(), meseMostrato.getMonth() + delta, 1);
      await ridisegna();
    },
    onGiorno: async (data) => {
      const r = riassuntoGiorno({
        dal,
        data,
        previsto: store.giornoPrevisto(data),
        allenamento: allenamenti.get(data),
        attese: attese.get(data) || [],
        origine: store.origineGiorno(data),
      });
      const seduta = tutte.find((s) => s.data === data && s.stato === "completata");
      await sheet((close) =>
        h(
          "div",
          h("h2", r.titolo),
          h(
            "div.group",
            { style: "margin-top:12px" },
            h(
              "div.list",
              ...r.righe.map((riga) =>
                h(
                  "div.row",
                  h("div.main", h("span.title", riga.testo)),
                  riga.stato === "ok"
                    ? h("span.pill.ok", "fatto")
                    : riga.stato === "warn"
                      ? h("span.pill.warn", "in ritardo")
                      : null
                )
              )
            )
          ),
          seduta
            ? h(
                "div.btn-wrap",
                h(
                  "button.btn.secondary",
                  {
                    onclick: () => {
                      close();
                      location.hash = `#/storico?seduta=${seduta.id}`;
                    },
                  },
                  "Apri l'allenamento"
                )
              )
            : null
        )
      );
    },
  });

  const inRitardo = [...new Set(
    [...attese.values()].flat().filter((a) => a.tipo === "scaduto").map((a) => a.testo)
  )];

  return h(
    "div.group",
    h("h2", "Calendario"),
    cal,
    h(
      "p.footnote",
      { style: "margin-top:10px" },
      // Comanda il calendario solo se gli eventi ci sono davvero: la data
      // dell'ultima lettura restava scritta anche dopo averli dimenticati, e
      // l'app diceva di seguire un calendario che non aveva più.
      store.agendaAttiva()
        ? `Gli allenamenti arrivano dal calendario del coach${imp.ultimoImportAgenda ? `, letti l'ultima volta il ${new Date(imp.ultimoImportAgenda).toLocaleDateString("it-IT")}` : ""}. Orari e promemoria restano sul calendario: qui si vede solo cosa tocca.`
        : "Vista dell'app: disegna lo split del master brief e le sue cadenze. Gli orari e i promemoria veri restano sul calendario."
    ),
    inRitardo.length
      ? h(
          "p.footnote",
          { style: "color:var(--orange)" },
          `${inRitardo.length === 1 ? "Una cosa" : `${inRitardo.length} cose`} in ritardo: ${inRitardo.join(", ").toLowerCase()}.`
        )
      : h("p.footnote", "Nessun arretrato.")
  );
}
