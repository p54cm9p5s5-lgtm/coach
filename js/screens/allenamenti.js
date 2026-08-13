/* Gli allenamenti letti dall'orologio.

   Tre livelli, uno per domanda: quali giorni, cosa ho fatto quel giorno, e
   com'è andato quell'allenamento. Prima stavano in fondo alla schermata Salute,
   otto righe senza dire che ce n'erano altre, e non si potevano aprire.

   Qui NON si registra niente: è quello che il telefono ha già scritto per conto
   suo. L'unica cosa che si decide è a cosa corrisponde ciascuno — la seduta, il
   cardio del protocollo, o un'attività a parte — e serve perché il pacchetto
   per il coach non chiami «Push» una camminata. */

import { h, aggiungi, clear, dataLunga, dataBreve, durataUmana, num, chiedi, toast } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";
import { graficoBattito } from "../grafico.js";

/* I nomi di Apple sono in inglese e attaccati: «FunctionalStrengthTraining».
   Quelli che il programma usa davvero hanno il nome che usa il programma —
   «Rafforzamento funzionale» è la sessione che l'app stessa ti dice di avviare
   sull'orologio. Un tipo che non conosciamo resta scritto com'era: meglio una
   parola inglese che una traduzione inventata o, peggio, un buco. */
const TIPI = {
  Walking: "Camminata",
  Running: "Corsa",
  Hiking: "Escursione",
  Cycling: "Bici",
  IndoorCycling: "Cyclette",
  Swimming: "Nuoto",
  FunctionalStrengthTraining: "Rafforzamento funzionale",
  TraditionalStrengthTraining: "Pesi",
  CoreTraining: "Core",
  HighIntensityIntervalTraining: "Intervalli ad alta intensità",
  Yoga: "Yoga",
  Pilates: "Pilates",
  Elliptical: "Ellittica",
  Rowing: "Vogatore",
  StairClimbing: "Scale",
  Other: "Altro",
};

export const nomeTipo = (t) => TIPI[t] || t || "Allenamento";

const RUOLI = {
  seduta: "la seduta",
  cardio: "il cardio della seduta",
  extra: "attività a parte",
};

/** «2h 05m» dai secondi, o il trattino se non c'è. */
const durata = (sec) => (sec ? durataUmana(sec) : "—");

/** Il passo medio: minuti e secondi per chilometro. */
function passoMedio(km, sec) {
  if (!km || !sec || km <= 0) return null;
  const secPerKm = sec / km;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}'${String(s).padStart(2, "0")}"`;
}

const oraDi = (a) => a.inizio || "—";

/** «1:11:16», come lo scrive l'orologio, invece di «1h 11m». */
function durataOrologio(sec) {
  if (!sec) return "—";
  const h2 = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  const p = (n) => String(n).padStart(2, "0");
  return h2 ? `${h2}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/* Le parole con cui Apple traduce lo sforzo da 1 a 10: sono quelle che hai
   letto sull'orologio quando quel numero l'hai scelto. */
function parolaSforzo(v) {
  if (v <= 2) return "Molto facile";
  if (v <= 4) return "Facile";
  if (v <= 6) return "Moderato";
  if (v <= 8) return "Difficile";
  return "Massimo";
}

function parametri() {
  const q = location.hash.split("?")[1] || "";
  return Object.fromEntries(new URLSearchParams(q));
}

export async function render() {
  const p = parametri();
  if (p.id) return dettaglio(p.id);
  if (p.giorno) return giorno(p.giorno);
  return elenco();
}

// ---------- livello 1: i giorni ----------

async function elenco() {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Allenamenti", { etichetta: "Salute", onclick: () => (location.hash = "#/salute") }));

  const tutti = await store.allenamentiWatch();
  if (!tutti.length) {
    aggiungi(wrap,
      h("div.empty",
        h("h3", "Ancora niente"),
        h("p", "Qui arrivano gli allenamenti che l'orologio registra da solo, quando importi i dati da Salute.")
      )
    );
    return wrap;
  }

  const perGiorno = new Map();
  for (const a of tutti) {
    if (!perGiorno.has(a.data)) perGiorno.set(a.data, []);
    perGiorno.get(a.data).push(a);
  }

  // Il mese si sceglie qui e resta finché sei nella schermata: si apre su
  // quello dell'allenamento più recente, non sul mese di oggi, perché se
  // l'ultima importazione è di una settimana fa aprire un calendario vuoto
  // sembrerebbe che i dati non ci siano.
  const piuRecente = tutti[0]?.data || null;
  let mese = mesePreferito ?? (piuRecente ? piuRecente.slice(0, 7) : null);
  const contenitore = h("div");
  const disegna = () => {
    clear(contenitore).append(calendario(mese, perGiorno, (nuovo) => {
      mese = nuovo;
      mesePreferito = nuovo;
      disegna();
    }));
  };
  disegna();
  aggiungi(wrap, contenitore);

  // Dentro un gruppo, se no `.footnote` non prende il suo stile e la nota
  // finisce grande come il testo principale.
  aggiungi(wrap,
    h("div.group",
      h("p.footnote",
        "I giorni col pallino hanno allenamenti: toccali. Li registra l'orologio da solo, qui non si scrive niente, " +
          "e non entrano in nessun punteggio — sono quello che è successo, non quello che il programma chiedeva."
      )
    )
  );
  return wrap;
}

/* Il mese scelto sopravvive all'andata e ritorno verso un giorno: senza, si
   tornava sempre al mese dell'ultimo allenamento e chi stava guardando marzo
   doveva rifare la strada ogni volta. */
let mesePreferito = null;

const GIORNI_SETT = ["L", "M", "M", "G", "V", "S", "D"];
const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

/** Il mese `AAAA-MM` spostato di `n` mesi. */
function meseSpostato(mese, n) {
  const [a, m] = mese.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Il calendario del mese, coi giorni che hanno allenamenti da toccare.
 *
 * La settimana comincia di lunedì, come su un calendario italiano da parete e
 * come nel resto dell'app. I giorni senza allenamenti restano scritti — servono
 * a leggere il mese — ma non sono toccabili: un tasto che non fa niente è
 * peggio di nessun tasto.
 */
function calendario(mese, perGiorno, onMese) {
  if (!mese) return h("div");
  const [anno, m] = mese.split("-").map(Number);
  const primo = new Date(anno, m - 1, 1);
  const quanti = new Date(anno, m, 0).getDate();
  // getDay(): domenica 0. Con la settimana che comincia di lunedì, la domenica
  // è l'ultima colonna, non la prima.
  const salta = (primo.getDay() + 6) % 7;

  const mesiConDati = [...new Set([...perGiorno.keys()].map((d) => d.slice(0, 7)))].sort();
  const cePrima = mesiConDati.some((x) => x < mese);
  const ceDopo = mesiConDati.some((x) => x > mese);

  const celle = [];
  for (let i = 0; i < salta; i++) celle.push(h("div"));
  for (let g = 1; g <= quanti; g++) {
    const iso = `${mese}-${String(g).padStart(2, "0")}`;
    const suoi = perGiorno.get(iso) || [];
    const stile =
      "aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;" +
      "border:0;border-radius:12px;font-size:15px;font-variant-numeric:tabular-nums;padding:0;";
    if (!suoi.length) {
      celle.push(
        h("div", { style: `${stile}color:var(--label-tertiary);background:transparent` }, String(g))
      );
      continue;
    }
    celle.push(
      h(
        "button",
        {
          style: `${stile}background:var(--bg-grouped);color:var(--label);font-weight:600;cursor:pointer`,
          "aria-label": `${g} ${MESI[m - 1]}: ${suoi.length} ${suoi.length === 1 ? "allenamento" : "allenamenti"}`,
          onclick: () => (location.hash = `#/allenamenti?giorno=${iso}`),
        },
        String(g),
        // Un pallino per allenamento, fino a tre: dice quanti sono senza far
        // leggere un numero, ed è la stessa informazione del numerino di prima.
        h(
          "span",
          { style: "display:flex;gap:2px" },
          ...Array.from({ length: Math.min(suoi.length, 3) }, () =>
            h("span", { style: "width:4px;height:4px;border-radius:50%;background:var(--accent)" })
          )
        )
      )
    );
  }

  const conta = [...perGiorno.entries()].filter(([d]) => d.startsWith(mese));
  const quantiAllenamenti = conta.reduce((t, [, v]) => t + v.length, 0);

  return h(
    "div.group",
    h(
      "div",
      { style: "display:flex;align-items:center;justify-content:space-between;padding:0 4px 8px" },
      h(
        "button",
        {
          style: `border:0;background:transparent;font-size:22px;padding:6px 12px;min-height:44px;color:${cePrima ? "var(--accent)" : "var(--label-tertiary)"}`,
          disabled: !cePrima,
          "aria-label": "Mese precedente",
          onclick: () => onMese(meseSpostato(mese, -1)),
        },
        "‹"
      ),
      h(
        "span",
        { style: "font-size:15px;font-weight:600" },
        `${MESI[m - 1]} ${anno}`
      ),
      h(
        "button",
        {
          style: `border:0;background:transparent;font-size:22px;padding:6px 12px;min-height:44px;color:${ceDopo ? "var(--accent)" : "var(--label-tertiary)"}`,
          disabled: !ceDopo,
          "aria-label": "Mese successivo",
          onclick: () => onMese(meseSpostato(mese, 1)),
        },
        "›"
      )
    ),
    h(
      "div",
      { style: "display:grid;grid-template-columns:repeat(7,1fr);gap:2px;padding:0 4px" },
      ...GIORNI_SETT.map((g) =>
        h("div", { style: "text-align:center;font-size:10px;color:var(--label-secondary);padding-bottom:4px" }, g)
      ),
      ...celle
    ),
    h(
      "p.footnote",
      quantiAllenamenti
        ? `${quantiAllenamenti} ${quantiAllenamenti === 1 ? "allenamento" : "allenamenti"} in ${conta.length} ${conta.length === 1 ? "giorno" : "giorni"}.`
        : "In questo mese l'orologio non ha registrato niente."
    )
  );
}

// ---------- livello 2: il giorno ----------

async function giorno(data) {
  const wrap = h("div.screen");
  aggiungi(wrap,
    intestazione(dataBreve(data), { etichetta: "Indietro", onclick: () => (location.hash = "#/allenamenti") })
  );

  const tutti = (await store.allenamentiWatch()).filter((a) => a.data === data);
  if (!tutti.length) {
    aggiungi(wrap, h("div.empty", h("h3", "Nessun allenamento quel giorno")));
    return wrap;
  }
  // In ordine di orario: la giornata si legge dal mattino alla sera, non al
  // contrario come l'elenco dei giorni.
  tutti.sort((a, b) => (a.inizio || "").localeCompare(b.inizio || ""));

  const sedute = await store.allenamenti();
  const righe = h("div.list");
  for (const a of tutti) {
    const dettagli = [
      durata(a.durataSec),
      a.km != null ? `${num(a.km)} km` : null,
      a.kcalAttive != null ? `${Math.round(a.kcalAttive)} kcal` : null,
      a.fcMedia != null ? `FC ${Math.round(a.fcMedia)}` : null,
    ].filter(Boolean);
    const ruolo = a.ruolo || (a.ruoloDeciso ? null : store.ruoloProbabile(a, sedute, store.regole().cardio).ruolo);
    const suo = a.sedutaId ? sedute.find((s) => s.id === a.sedutaId) : null;
    aggiungi(righe,
      h(
        "button.row.accent",
        { onclick: () => (location.hash = `#/allenamenti?id=${encodeURIComponent(a.uuid)}`) },
        h(
          "div.main",
          h("span.title", `${oraDi(a)} · ${nomeTipo(a.tipo)}`),
          h("span.sub", dettagli.join(" · ")),
          // Il ruolo dedotto si scrive in corsivo di parole, non come un fatto:
          // «probabilmente» è la differenza fra una proposta e una bugia.
          h(
            "span.sub",
            a.ruolo
              ? suo
                ? `${RUOLI[a.ruolo]} — ${suo.tipoNome}`
                : RUOLI[a.ruolo]
              : ruolo
                ? `forse ${RUOLI[ruolo]}, da confermare`
                : "da assegnare"
          )
        ),
        h("span.chevron", "›")
      )
    );
  }
  aggiungi(wrap, h("div.group", h("h2", dataLunga(data)), righe));
  return wrap;
}

// ---------- livello 3: il dettaglio ----------

async function dettaglio(uuid) {
  const wrap = h("div.screen");
  const a = (await store.allenamentiWatch()).find((x) => x.uuid === uuid);
  if (!a) {
    aggiungi(wrap, intestazione("Allenamento", { etichetta: "Indietro", onclick: () => (location.hash = "#/allenamenti") }));
    aggiungi(wrap, h("div.empty", h("h3", "Allenamento non trovato")));
    return wrap;
  }
  // In cima la data, non il tipo: il tipo sta già grande due centimetri sotto,
  // e nell'intestazione un nome lungo come «Rafforzamento funzionale» veniva
  // tagliato a metà.
  aggiungi(wrap,
    intestazione(dataBreve(a.data), {
      etichetta: "Indietro",
      onclick: () => (location.hash = `#/allenamenti?giorno=${a.data}`),
    })
  );

  const sedute = await store.allenamenti();
  const suo = a.sedutaId ? sedute.find((s) => s.id === a.sedutaId) : null;

  /* La scheda dei numeri, nello stile dell'orologio: etichetta piccola sopra,
     numero grande e colorato sotto. I colori sono quelli che Apple usa per
     quelle stesse misure — giallo la durata, rosso le calorie, rosso il
     battito, viola lo sforzo — perché sono i colori con cui li hai già visti
     sul polso, e cercarli qui deve costare zero. */
  const numeroGrande = (etichetta, valore, unita, colore, nota) =>
    h(
      "div",
      { style: "padding:2px 0" },
      h("p", { style: "margin:0;font-size:14px;color:var(--label)" }, etichetta),
      h(
        "p",
        { style: `margin:1px 0 0;font-size:27px;font-weight:800;letter-spacing:-0.8px;line-height:1.1;color:${colore};font-variant-numeric:tabular-nums` },
        valore,
        unita
          ? h("span", { style: "font-size:15px;font-weight:700;letter-spacing:0;margin-left:3px" }, unita)
          : null
      ),
      nota ? h("p", { style: "margin:1px 0 0;font-size:11px;color:var(--label-tertiary)" }, nota) : null
    );

  const riquadro = (...dentro) =>
    h("div", { style: "background:var(--bg-grouped);border-radius:14px;padding:14px 16px;display:grid;gap:12px" }, ...dentro);

  const affiancati = (...dentro) =>
    h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px" }, ...dentro.filter(Boolean));

  aggiungi(wrap,
    h(
      "div.hero",
      { style: "padding-bottom:2px" },
      h("p.kicker", dataLunga(a.data)),
      h("h2", nomeTipo(a.tipo)),
      h("p.target", a.fine ? `${a.inizio}–${a.fine}` : `dalle ${oraDi(a)}`)
    )
  );

  const passo = passoMedio(a.km, a.durataSec);
  const dettagli = [
    numeroGrande("Durata allenamento", durataOrologio(a.durataSec), null, "var(--giallo)"),
    a.kcalAttive != null
      ? numeroGrande("Chilocalorie attive", String(Math.round(a.kcalAttive)), "KCAL", "var(--battito)")
      : null,
  ].filter(Boolean);

  const seconda = [
    a.kcalTotali != null
      ? numeroGrande("Chilocalorie totali", String(Math.round(a.kcalTotali)), "KCAL", "var(--battito)")
      : null,
    a.fcMedia != null
      ? numeroGrande("Media battito", String(Math.round(a.fcMedia)), "BPM", "var(--orange)")
      : null,
    a.km != null ? numeroGrande("Distanza", num(a.km, 2), "KM", "var(--accent)", passo ? `${passo} al km` : null) : null,
    a.fcMax != null
      ? numeroGrande("Battito massimo", String(Math.round(a.fcMax)), "BPM", "var(--orange)", a.fcMin != null ? `minimo ${Math.round(a.fcMin)}` : null)
      : null,
  ].filter(Boolean);

  aggiungi(wrap,
    h(
      "div",
      { style: "margin:8px 16px 0;display:grid;gap:12px" },
      riquadro(
        ...dettagli,
        ...(seconda.length
          ? [affiancati(...seconda.slice(0, 2)), ...(seconda.length > 2 ? [affiancati(...seconda.slice(2, 4))] : [])]
          : [])
      )
    )
  );

  /* Lo sforzo, com'è sull'orologio: il numero dentro un cerchio, la parola che
     lo traduce, e le tacche che salgono. Le parole sono quelle di Apple, perché
     è lì che hai deciso quel numero. */
  if (a.sforzo != null) {
    const s = Math.max(1, Math.min(10, Math.round(a.sforzo)));
    aggiungi(wrap,
      h(
        "div",
        { style: "margin:12px 16px 0" },
        h(
          "div",
          { style: "background:var(--bg-grouped);border-radius:14px;padding:14px 16px" },
          h("p", { style: "margin:0 0 8px;font-size:14px;color:var(--label)" }, "Sforzo"),
          h(
            "div",
            { style: "display:flex;align-items:center;gap:12px" },
            h(
              "span",
              {
                style:
                  "width:34px;height:34px;border-radius:50%;background:color-mix(in srgb, var(--sforzo) 22%, transparent);" +
                  "color:var(--sforzo);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px",
              },
              String(s)
            ),
            h("span", { style: "font-size:24px;font-weight:800;letter-spacing:-0.6px;color:var(--sforzo)" }, parolaSforzo(s)),
            h(
              "span",
              { style: "margin-left:auto;display:flex;align-items:flex-end;gap:3px;height:26px" },
              ...Array.from({ length: 4 }, (_, i) =>
                h("span", {
                  style:
                    `width:5px;border-radius:2px;height:${8 + i * 6}px;` +
                    `background:${s > i * 2.5 ? "var(--sforzo)" : "var(--fill-tertiary)"}`,
                })
              )
            )
          )
        )
      )
    );
  }

  /* Un allenamento importato prima dell'aggiornamento ha solo quattro numeri:
     giorno, ora, durata e calorie. Distanza, frequenze, orario di fine e curva
     del battito stanno nel file di Salute e ci sono sempre stati — è il lettore
     che non li prendeva. Dirlo qui è l'unico modo perché non sembri che
     l'orologio non li abbia misurati: basta reimportare. */
  const poveri = a.km == null && a.fcMedia == null && !a.fine && !Array.isArray(a.battito);
  if (poveri) {
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Mancano dei numeri"),
        h(
          "p.footnote",
          "Questo allenamento è stato importato da una versione dell'app che leggeva solo durata e calorie. " +
            "Distanza, frequenza cardiaca, orario di fine e curva del battito sono nel file di Salute: " +
            "rifai l'importazione da Salute e si riempiono da soli, senza perdere niente di quello che hai già deciso qui."
        ),
        h(
          "div.list",
          h(
            "a.row",
            { href: "#/salute" },
            h("div.main", h("span.title", "Vai a importare i dati da Salute")),
            h("span.chevron", "›")
          )
        )
      )
    );
  }

  // ---- il battito ----
  /* Le caselle arrivano in due forme: `{min,max}` da adesso, un numero solo dai
     pacchetti scritti prima. Si normalizzano qui, così un allenamento importato
     ieri continua a disegnarsi — con barrette alte un pelo, che è la verità:
     di quel momento sappiamo un valore solo. */
  const caselle = Array.isArray(a.battito)
    ? a.battito.map((c) =>
        c == null ? null : typeof c === "number" ? { min: c, max: c } : Number.isFinite(c.min) ? c : null
      )
    : [];
  const quante = caselle.filter(Boolean).length;
  if (quante >= 3) {
    aggiungi(wrap,
      h(
        "div",
        { style: "margin:12px 16px 0" },
        h("p", { style: "margin:0 0 8px;font-size:20px;font-weight:800;letter-spacing:-0.5px" }, "Frequenza cardiaca"),
        graficoBattito({
          caselle,
          inizioSec: oraInSecondi(a.inizio),
          durataSec: a.durataSec || quante * 30,
          media: a.fcMedia ?? null,
        }),
        h(
          "p.footnote",
          { style: "margin:8px 2px 0;padding:0" },
          `${quante} ${quante === 1 ? "momento misurato" : "momenti misurati"} dall'orologio, uno ogni mezzo minuto circa. ` +
            "Ogni barretta va dal battito più basso al più alto di quel momento; dove manca, l'orologio non ha misurato."
        )
      )
    );
  } else if (Array.isArray(a.battito)) {
    aggiungi(wrap,
      h("div.group", h("h2", "Frequenza cardiaca"), h("p.footnote", "Per questo allenamento l'orologio ha lasciato troppe poche misure per disegnare l'andamento."))
    );
  }

  // ---- che cos'era ----
  const proposta = a.ruoloDeciso ? null : store.ruoloProbabile(a, sedute, store.regole().cardio);
  const sceltaCorrente = a.ruolo || null;
  const delGiorno = sedute.filter((s) => s.data === a.data && s.stato === "completata");

  /* La scelta si fa QUI e resta qui.
     Prima ogni tocco riportava all'elenco del giorno: sembrava che il tasto non
     avesse fatto niente e ti toglieva dalla pagina che stavi guardando. Adesso
     la pastiglia si accende, la riga sotto dice cosa cambia, e non ci si muove.
     Serve a una cosa sola, ed è scritta: che il coach non legga una camminata
     come se fosse la seduta di pesi. */
  const riga = h("p.footnote");
  const pastiglie = h("div.scelte.righe");
  let scelta = a.ruolo || null;
  let collegata = suo || null;

  const spiega = () => {
    riga.textContent = scelta
      ? scelta === "extra"
        ? "Al coach arriva come movimento fuori programma."
        : collegata
          ? `Al coach arriva come ${RUOLI[scelta]}: ${collegata.tipoNome} del ${dataBreve(collegata.data)}.`
          : `Al coach arriva come ${RUOLI[scelta]}.`
      : proposta && proposta.ruolo
        ? `Non l'hai ancora detto. L'app direbbe: ${RUOLI[proposta.ruolo]} — ma non lo scrive da sola.`
        : "Non l'hai ancora detto: al coach arriva come «da assegnare».";
  };

  const disegnaPastiglie = () => {
    clear(pastiglie).append(
      ...[
        ["seduta", "La seduta"],
        ["cardio", "Il cardio della seduta"],
        ["extra", "Attività a parte"],
      ].map(([chiave, testo]) =>
        h(
          "button",
          {
            "aria-pressed": scelta === chiave ? "true" : "false",
            onclick: async () => {
              try {
                if (chiave === "seduta" || chiave === "cardio") {
                  if (!delGiorno.length) {
                    toast("Quel giorno non c'è nessun allenamento registrato a cui collegarlo.");
                    return;
                  }
                  let quale = delGiorno[0].id;
                  if (delGiorno.length > 1) {
                    quale = await chiedi({
                      titolo: "A quale allenamento?",
                      testo: "Quel giorno ne hai registrati più di uno.",
                      opzioni: delGiorno.map((s) => ({ etichetta: s.tipoNome, valore: s.id })),
                    });
                    if (!quale) return;
                  }
                  await store.decidiRuoloWatch(a.uuid, { ruolo: chiave, sedutaId: quale });
                  collegata = delGiorno.find((s) => s.id === quale) || null;
                } else {
                  await store.decidiRuoloWatch(a.uuid, { ruolo: chiave });
                  collegata = null;
                }
                scelta = chiave;
                disegnaPastiglie();
                spiega();
              } catch (e) {
                toast(e.message);
              }
            },
          },
          testo
        )
      )
    );
  };
  disegnaPastiglie();
  spiega();

  aggiungi(wrap,
    h(
      "div.group",
      h("h2", "Che cos'era"),
      pastiglie,
      riga,
      suo
        ? h(
            "div.list",
            h(
              "button.row.accent",
              { onclick: () => (location.hash = `#/seduta?riepilogo=${suo.id}`) },
              h("div.main", h("span.title", `Apri ${suo.tipoNome}`), h("span.sub", dataLunga(suo.data))),
              h("span.chevron", "›")
            )
          )
        : null
    )
  );

  aggiungi(wrap,
    h("div.group",
      h("p.footnote",
        "Questi numeri li ha scritti l'orologio. L'app non li cambia e non li fa entrare in nessun punteggio."
      )
    )
  );
  return wrap;
}

const oraInSecondi = (ora) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(ora || "");
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 : 0;
};

const oraDaSecondi = (sec) => {
  const s = ((sec % 86400) + 86400) % 86400;
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}`;
};
