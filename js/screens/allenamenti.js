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

  const righe = h("div.list");
  for (const [data, elenco_] of perGiorno) {
    const secondi = elenco_.reduce((t, a) => t + (a.durataSec || 0), 0);
    const kcal = elenco_.reduce((t, a) => t + (a.kcalAttive || 0), 0);
    // Il riassunto dice di che allenamenti si tratta, non solo quanti: «3»
    // da solo non distingue tre camminate da una seduta e due camminate.
    const conteggio = new Map();
    for (const a of elenco_) {
      const n = nomeTipo(a.tipo);
      conteggio.set(n, (conteggio.get(n) || 0) + 1);
    }
    const riassunto = [...conteggio.entries()]
      .map(([n, q]) => (q > 1 ? `${q} × ${n.toLowerCase()}` : n.toLowerCase()))
      .join(" · ");
    aggiungi(righe,
      h(
        "button.row.accent",
        { onclick: () => (location.hash = `#/allenamenti?giorno=${data}`) },
        h(
          "div.main",
          h("span.title", dataLunga(data)),
          h("span.sub", riassunto),
          h("span.sub", `${durata(secondi)}${kcal ? ` · ${Math.round(kcal)} kcal attive` : ""}`)
        ),
        h("span.pill", String(elenco_.length)),
        h("span.chevron", "›")
      )
    );
  }

  aggiungi(wrap, h("div.group", h("h2", `${perGiorno.size} ${perGiorno.size === 1 ? "giorno" : "giorni"}`), righe));
  aggiungi(wrap,
    h("p.footnote",
      "Li registra l'orologio da solo: qui non si scrive niente. Non entrano in nessun punteggio — " +
        "sono quello che è successo, non quello che il programma chiedeva."
    )
  );
  return wrap;
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
  const schede = [
    a.km != null ? scheda("Distanza", `${num(a.km)} km`, passo ? `${passo} al km` : null) : null,
    a.kcalAttive != null
      ? scheda("Kcal attive", String(Math.round(a.kcalAttive)), a.kcalTotali != null ? `${Math.round(a.kcalTotali)} totali` : null)
      : null,
    a.fcMedia != null
      ? scheda("FC media", `${Math.round(a.fcMedia)}`, [
          a.fcMin != null ? `min ${Math.round(a.fcMin)}` : null,
          a.fcMax != null ? `max ${Math.round(a.fcMax)}` : null,
        ].filter(Boolean).join(" · ") || null)
      : null,
    scheda("Durata", durata(a.durataSec), a.fine ? `${a.inizio}–${a.fine}` : null),
  ].filter(Boolean);

  aggiungi(wrap,
    h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:6px 16px 0" }, ...schede)
  );

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
    h("p.footnote", { style: "margin:18px 16px 24px" },
      "Questi numeri li ha scritti l'orologio. L'app non li cambia e non li fa entrare in nessun punteggio."
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
