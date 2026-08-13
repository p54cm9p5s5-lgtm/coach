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
import { graficoLinea } from "../grafico.js";

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
  aggiungi(wrap,
    intestazione(nomeTipo(a.tipo), {
      etichetta: "Indietro",
      onclick: () => (location.hash = `#/allenamenti?giorno=${a.data}`),
    })
  );

  const sedute = await store.allenamenti();
  const suo = a.sedutaId ? sedute.find((s) => s.id === a.sedutaId) : null;

  aggiungi(wrap,
    h(
      "div.hero",
      h("p.kicker", dataLunga(a.data)),
      h("h2", durata(a.durataSec)),
      h("p.target", a.fine ? `dalle ${a.inizio} alle ${a.fine}` : `dalle ${oraDi(a)}`)
    )
  );

  const scheda = (etichetta, valore, nota) =>
    h(
      "div",
      { style: "background:var(--bg-grouped);border-radius:12px;padding:13px" },
      h("p", { style: "margin:0;font-size:11px;color:var(--label-secondary)" }, etichetta),
      h(
        "p",
        { style: "margin:4px 0 0;font-size:20px;font-weight:700;letter-spacing:-0.4px;font-variant-numeric:tabular-nums" },
        valore
      ),
      nota ? h("p", { style: "margin:2px 0 0;font-size:11px;color:var(--label-tertiary)" }, nota) : null
    );

  const passo = passoMedio(a.km, a.durataSec);
  // La durata sta già grande in cima: ripeterla in una scheda faceva sembrare
  // che ci fossero due dati dove ce n'era uno, e su un allenamento povero
  // riempiva la griglia di niente.
  const schede = [
    a.km != null ? scheda("Distanza", `${num(a.km, 2)} km`, passo ? `${passo} al km` : null) : null,
    a.kcalAttive != null
      ? scheda("Kcal attive", String(Math.round(a.kcalAttive)), a.kcalTotali != null ? `${Math.round(a.kcalTotali)} totali` : null)
      : null,
    a.fcMedia != null
      ? scheda("FC media", `${Math.round(a.fcMedia)}`, [
          a.fcMin != null ? `min ${Math.round(a.fcMin)}` : null,
          a.fcMax != null ? `max ${Math.round(a.fcMax)}` : null,
        ].filter(Boolean).join(" · ") || null)
      : null,
    a.fine ? scheda("Orario", `${a.inizio}–${a.fine}`, "inizio e fine") : null,
  ].filter(Boolean);

  if (schede.length) {
    aggiungi(wrap,
      h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:6px 16px 0" }, ...schede)
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

  // ---- la curva del battito ----
  if (Array.isArray(a.battito) && a.battito.filter((v) => v != null).length >= 3) {
    const n = a.battito.length;
    const inizioSec = oraInSecondi(a.inizio);
    const passoSec = a.durataSec && n > 1 ? a.durataSec / (n - 1) : 30;
    const punti = a.battito.map((v, i) => ({
      data: a.data,
      valore: v,
      ora: oraDaSecondi(inizioSec + Math.round(i * passoSec)),
    }));
    const validi = a.battito.filter((v) => v != null);
    // L'asse non parte da zero: un battito vive fra 60 e 180, e con lo zero in
    // fondo la curva diventerebbe una linea piatta in cima al grafico.
    const minimo = Math.max(0, Math.floor((Math.min(...validi) - 8) / 5) * 5);
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Battito"),
        h(
          "div",
          { style: "padding:0 16px 8px" },
          graficoLinea({
            punti,
            minimo,
            altezza: 132,
            invito: "Tocca la curva per leggere un momento",
            etichetta: (p) => (p.valore == null ? `${p.ora} · nessuna misura` : `${p.ora} · ${Math.round(p.valore)} bpm`),
            estremo: (p) => p.ora,
          })
        ),
        h(
          "p.footnote",
          `${validi.length} ${validi.length === 1 ? "misura" : "misure"} dall'orologio, una ogni mezzo minuto circa. ` +
            "I tratti interrotti sono i momenti in cui non ha misurato."
        )
      )
    );
  } else {
    aggiungi(wrap,
      h("div.group", h("h2", "Battito"), h("p.footnote", "Per questo allenamento l'orologio non ha lasciato una curva del battito."))
    );
  }

  // ---- che cos'era ----
  const proposta = a.ruoloDeciso ? null : store.ruoloProbabile(a, sedute, store.regole().cardio);
  const sceltaCorrente = a.ruolo || null;
  const delGiorno = sedute.filter((s) => s.data === a.data && s.stato === "completata");

  const pastiglia = (chiave, testo) =>
    h(
      "button",
      {
        "aria-pressed": sceltaCorrente === chiave ? "true" : "false",
        onclick: async () => {
          try {
            if (chiave === "seduta" || chiave === "cardio") {
              if (!delGiorno.length) {
                toast("Quel giorno non c'è nessun allenamento registrato a cui collegarlo.");
                return;
              }
              let scelta = delGiorno[0].id;
              if (delGiorno.length > 1) {
                scelta = await chiedi({
                  titolo: "A quale allenamento?",
                  testo: "Quel giorno ne hai registrati più di uno.",
                  opzioni: delGiorno.map((s) => ({ etichetta: `${s.tipoNome}`, valore: s.id })),
                });
                if (!scelta) return;
              }
              await store.decidiRuoloWatch(a.uuid, { ruolo: chiave, sedutaId: scelta });
            } else {
              await store.decidiRuoloWatch(a.uuid, { ruolo: chiave });
            }
            toast("Segnato.");
            // Si rientra nella stessa schermata: l'hash non cambia, quindi si
            // passa dal giorno e si torna, che è anche il gesto che farebbe
            // uno a mano — e così l'elenco del giorno mostra subito il nuovo
            // ruolo invece di restare indietro.
            location.hash = `#/allenamenti?giorno=${a.data}`;
          } catch (e) {
            toast(e.message);
          }
        },
      },
      testo
    );

  aggiungi(wrap,
    h(
      "div.group",
      h("h2", "Che cos'era"),
      h("div.scelte.righe", pastiglia("seduta", "La seduta"), pastiglia("cardio", "Il cardio della seduta"), pastiglia("extra", "Attività a parte")),
      h(
        "p.footnote",
        sceltaCorrente
          ? suo
            ? `Collegato a: ${suo.tipoNome} del ${dataBreve(suo.data)}.`
            : "Non è collegato a nessun allenamento registrato."
          : proposta && proposta.ruolo
            ? `L'app direbbe: ${RUOLI[proposta.ruolo]}. Non lo scrive da sola — decidi tu.`
            : "Scegli cos'era: serve al coach per non leggere una camminata come se fosse la seduta."
      ),
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
