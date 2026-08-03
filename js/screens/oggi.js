import {
  h, isoDate, dataLunga, dataBreve, sheet, num, giorniTra, durataUmana, aggiungi,
} from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";
import { graficoAttivita, fascia, legenda } from "../grafico.js";
import { calendario, calcolaAttese, riassuntoGiorno } from "../calendario.js";
import { anello, giudizio } from "../punteggio.js";
import { sbloccaAudio } from "../ui.js";

let meseMostrato = null;

/* Periodo scelto per i numeri della Home. Il grafico non va mai oltre il mese:
   più indietro le barre diventano illeggibili e non dicono niente in più. */
const PERIODI = [
  { id: "7", etichetta: "7 gg", giorni: 7, graficoGiorni: 7, futuri: 3 },
  { id: "30", etichetta: "1 mese", giorni: 30, graficoGiorni: 30, futuri: 7 },
  { id: "tutto", etichetta: "Sempre", giorni: null, graficoGiorni: 30, futuri: 7 },
];

function periodoCorrente() {
  try {
    const id = localStorage.getItem("coach-periodo");
    return PERIODI.find((p) => p.id === id) || PERIODI[2];
  } catch {
    return PERIODI[2];
  }
}

function salvaPeriodo(id) {
  try {
    localStorage.setItem("coach-periodo", id);
  } catch {
    /* senza localStorage la scelta vale solo per questa schermata */
  }
}

async function versioneApp() {
  try {
    const r = await fetch("sw.js", { cache: "no-store" });
    return (await r.text()).match(/const VERSION = "([^"]+)"/)?.[1] || "sconosciuta";
  } catch {
    return "non verificabile";
  }
}

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
      `versione ${await versioneApp()}`
    )
  );

  return wrap;
}

// ---------- grafico ----------

async function bloccoGrafico(ridisegna) {
  const periodo = periodoCorrente();
  const oggi = isoDate();
  const giorni = await store.giorniSalute();
  const notti = await store.notti();
  const tutti = await store.allenamenti();
  const obiettivo = await store.impostazione("obiettivoMovimentoKcal");

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
      previsto: Boolean(store.giornoPrevisto(data)),
      presente: Boolean(g?.presente),
      kcal: g?.presente ? g.kcalAttive : null,
      passi: g?.presente ? g.passi : null,
      obiettivo: g?.obiettivoKcal || obiettivo,
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
  const daQuando = periodo.giorni
    ? (() => {
        const d = new Date(oggi + "T00:00:00");
        d.setDate(d.getDate() - (periodo.giorni - 1));
        const p = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      })()
    : null;
  const dentro = (r) => !daQuando || (r.data >= daQuando && r.data <= oggi);
  const giorniConDati = giorni.filter((g) => g.presente && dentro(g));
  const nottiConDati = notti.filter((n) => n.presente && dentro(n));
  const mediaKcal = media(giorniConDati, "kcalAttive");
  const mediaPassi = media(giorniConDati, "passi");
  const mediaSonno = media(nottiConDati, "durataMin");
  const quantiKcal = giorniConDati.filter((g) => g.kcalAttive != null).length;
  const quantiPassi = giorniConDati.filter((g) => g.passi != null).length;
  const quanteNotti = nottiConDati.filter((n) => n.durataMin != null).length;

  const selettore = h(
    "div.segmented",
    { style: "margin:0 0 12px" },
    ...PERIODI.map((p) =>
      h(
        "button",
        {
          "aria-pressed": p.id === periodo.id,
          style: "min-height:34px;font-size:14px",
          onclick: async () => {
            if (p.id === periodo.id) return;
            salvaPeriodo(p.id);
            await ridisegna();
          },
        },
        p.etichetta
      )
    )
  );

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
          nota: `media su ${quantiPassi} ${quantiPassi === 1 ? "giorno" : "giorni"}`,
        },
        {
          etichetta: "Movimento",
          valore: mediaKcal != null ? String(mediaKcal) : "—",
          unita: "kcal",
          nota: `media su ${quantiKcal} ${quantiKcal === 1 ? "giorno" : "giorni"}`,
        },
        {
          etichetta: "Sonno",
          valore: mediaSonno != null ? durataUmana(mediaSonno * 60) : "—",
          nota: `media su ${quanteNotti} ${quanteNotti === 1 ? "notte" : "notti"}`,
        },
      ]),
      graficoAttivita(serie),
      legenda()
    )
  );
}

// ---------- allenamento di oggi ----------

async function bloccoAllenamento(vaiA, ridisegna, oggi) {
  const inCorso = await store.sedutaInCorso();
  if (inCorso) {
    return h(
      "div.group",
      h("h2", "Allenamento aperto"),
      h(
        "div.list",
        h(
          "button.row",
          { onclick: () => vaiA("seduta") },
          h(
            "div.main",
            h("span.title", inCorso.tipoNome),
            h("span.sub", `iniziato alle ${new Date(inCorso.oraInizio).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`)
          ),
          h("span.chevron", "›")
        )
      ),
      h("div.btn-wrap", h("button.btn", { onclick: () => vaiA("seduta") }, "Riprendi allenamento"))
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

  const titolo = previsto ? previsto.nome : "Riposo";
  const origine = store.origineGiorno(oggi);
  const sotto = giaFatto
    ? "completato oggi"
    : previsto
      ? `${previsto.esercizi?.length || 0} esercizi${previsto.cardio ? " + cardio" : ""}`
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
              onclick: async () => {
                // Il tocco che avvia l'allenamento è anche quello che autorizza
                // il suono del recupero: dopo non ci sono più occasioni utili.
                sbloccaAudio();
                await store.iniziaSeduta({ data: oggi, giornoId: previsto.id });
                vaiA("seduta");
              },
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
            origine.fonte === "calendario"
              ? "Sul calendario oggi non c'è niente."
              : "Il giorno di riposo fa parte del programma."
          )
    )
  );
}

// ---------- proposte ----------

async function bloccoProposte() {
  await store.aggiornaProposte();
  await store.aggiornaSegnali();
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
    allenamenti.set(s.data, { id: s.id, nome: s.tipoNome, completato: s.stato === "completata" });
  }

  const imp = await store.impostazioni();
  const fotoTutte = await store.foto();
  const attese = calcolaAttese({
    oggi,
    ultimoPeso: (await store.ultimaMisura("peso"))?.data || null,
    ultimaVita: (await store.ultimaMisura("vitaOmbelico"))?.data || null,
    ultimaFoto: fotoTutte[0]?.data || null,
    ultimoExport: imp.ultimoExport,
    ultimoImportSalute: imp.ultimoImportSalute,
    // Col calendario collegato le scadenze sono quelle scritte dal coach.
    eventi: store.agendaAttiva() ? await store.agenda() : null,
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
      imp.ultimoImportAgenda
        ? `Gli allenamenti arrivano dal calendario del coach, letti l'ultima volta il ${new Date(imp.ultimoImportAgenda).toLocaleDateString("it-IT")}. Orari e promemoria restano su Google Calendar: qui si vede solo cosa tocca.`
        : "Vista dell'app: disegna lo split del master brief e le sue cadenze. Gli orari e i promemoria veri restano su Google Calendar."
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
