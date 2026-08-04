/* Calendario mensile: cosa c'è da fare e cosa è stato fatto.
   Sostituisce l'elenco «da registrare»: le stesse informazioni, ma collocate
   nel giorno a cui appartengono. */

import { h, isoDate, parseIso, dataLunga, dataBreve, giorniTra, aggiungi } from "./ui.js";

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
const INTESTAZIONI = ["L", "M", "M", "G", "V", "S", "D"];

const iso = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * @param ctx {
 *   mese: Date,               primo giorno del mese mostrato
 *   giornoPrevisto(iso),      giorno dello split, o null
 *   allenamenti: Map iso -> { id, nome, completato },
 *   attese: Map iso -> [{ tipo, testo }],   cose da fare (peso, foto, backup…)
 *   onGiorno(iso)
 * }
 */
export function calendario(ctx) {
  const oggi = isoDate();
  const primo = new Date(ctx.mese.getFullYear(), ctx.mese.getMonth(), 1);
  const ultimo = new Date(ctx.mese.getFullYear(), ctx.mese.getMonth() + 1, 0);

  // lunedì come primo giorno della settimana
  const offset = (primo.getDay() + 6) % 7;

  const griglia = h("div.cal-griglia");
  for (const g of INTESTAZIONI) aggiungi(griglia, h("div.cal-testa", g));
  for (let i = 0; i < offset; i++) aggiungi(griglia, h("div"));

  for (let giorno = 1; giorno <= ultimo.getDate(); giorno++) {
    const data = iso(new Date(primo.getFullYear(), primo.getMonth(), giorno));
    // Prima dell'inizio del programma non c'era niente da fare: segnare quei
    // giorni come «saltati» dipingerebbe di rosso un passato che non esiste.
    const dentroProgramma = !ctx.dal || data >= ctx.dal;
    const previsto = dentroProgramma ? ctx.giornoPrevisto(data) : null;
    const fatto = ctx.allenamenti.get(data);
    const attese = ctx.attese.get(data) || [];
    const passato = data < oggi;

    const classi = ["cal-giorno"];
    if (data === oggi) classi.push("oggi");
    if (fatto?.completato) classi.push("fatto");
    else if (previsto && passato) classi.push("saltato");
    else if (previsto) classi.push("previsto");

    const punti = h("div.cal-punti");
    if (previsto || fatto) aggiungi(punti, h("i.p-allenamento"));
    for (const a of attese.slice(0, 2)) aggiungi(punti, h("i", { class: `p-${a.tipo}` }));

    aggiungi(griglia,
      h(
        "button",
        { class: classi.join(" "), onclick: () => ctx.onGiorno(data) },
        h("span.n", String(giorno)),
        punti
      )
    );
  }

  return h(
    "div.calendario",
    h(
      "div.cal-barra",
      h("button", { onclick: () => ctx.onMese(-1), "aria-label": "Mese precedente" }, "‹"),
      h("span", `${MESI[primo.getMonth()]} ${primo.getFullYear()}`),
      h("button", { onclick: () => ctx.onMese(1), "aria-label": "Mese successivo" }, "›")
    ),
    griglia
  );
}

/** Cose attese in un giorno, calcolate dalle cadenze del brief. */
export function calcolaAttese({
  oggi,
  ultimoPeso,
  ultimaVita,
  ultimaFoto,
  ultimoExport,
  ultimoImportSalute,
  eventi = null,
}) {
  const attese = new Map();
  const aggiungiA = (data, tipo, testo) => {
    if (!attese.has(data)) attese.set(data, []);
    attese.get(data).push({ tipo, testo });
  };

  if (eventi) {
    // Calendario collegato: le cose da fare sono quelle che ci ha scritto il
    // coach, con le sue parole. L'app non aggiunge scadenze di sua invenzione.
    for (const e of eventi) {
      // Il titolo principale conta solo se non è l'allenamento (quello ha già
      // il suo segno sul calendario); gli altri eventi del giorno sempre.
      const titoli = [...(e.giornoId ? [] : [e.titolo]), ...(e.altri || [])].filter(Boolean);
      for (const titolo of titoli) {
        const t = titolo.toLowerCase();
        // Solo quello che l'app registra davvero può essere «in ritardo»: la
        // pressione, per esempio, non la tiene e resta un promemoria e basta.
        // Cosa chiede l'evento, guardato pezzo per pezzo. Peso e circonferenze
        // sono due misure diverse: prima bastava essersi pesati per dare per
        // fatto anche «misura vita», e il promemoria del coach spariva senza
        // che tu l'avessi fatta.
        const chiedeFoto = /foto/.test(t);
        const chiedePeso = /peso/.test(t);
        const chiedeVita = /vita|circonferenz/.test(t);
        const tipo = chiedeFoto ? "foto" : chiedePeso || chiedeVita ? "misura" : "info";
        // Conta la cosa fatta più indietro nel tempo fra quelle chieste: se
        // una non è MAI stata fatta, l'evento resta da fare (niente data).
        const richieste = [
          chiedeFoto ? ultimaFoto : null,
          chiedePeso ? ultimoPeso : null,
          chiedeVita ? ultimaVita : null,
        ].filter((_, i) => [chiedeFoto, chiedePeso, chiedeVita][i]);
        const fattoDa = richieste.some((d) => !d)
          ? null
          : richieste.filter(Boolean).sort()[0] || null;
        const scaduto =
          e.data <= oggi && tipo !== "info" && (!fattoDa || giorniTra(fattoDa, e.data) >= 1);
        aggiungiA(e.data, scaduto ? "scaduto" : tipo, titolo);
      }
    }
  } else {
    // peso e vita: ogni giovedì
    const d = parseIso(oggi);
    for (let i = -21; i <= 21; i++) {
      const g = new Date(d);
      g.setDate(g.getDate() + i);
      if (g.getDay() === 4) {
        const data = iso(g);
        const scaduto = data <= oggi && (!ultimoPeso || giorniTra(ultimoPeso, data) >= 7);
        aggiungiA(data, scaduto ? "scaduto" : "misura", "Peso e circonferenza vita");
      }
      // foto: mercoledì ogni 2 settimane, ancorate al 12/08/2026
      if (g.getDay() === 3) {
        const settimane = Math.round(giorniTra("2026-08-12", iso(g)) / 7);
        if (settimane % 2 === 0) {
          const data = iso(g);
          const scaduto = data <= oggi && (!ultimaFoto || giorniTra(ultimaFoto, data) >= 14);
          aggiungiA(data, scaduto ? "scaduto" : "foto", "Set di foto");
        }
      }
    }
  }

  // cose in ritardo, ancorate a oggi
  if (!ultimoExport || giorniTra(ultimoExport.slice(0, 10), oggi) >= 7) {
    aggiungiA(oggi, "scaduto", "Backup su file (solo app)");
  }
  if (!ultimoImportSalute || giorniTra(ultimoImportSalute.slice(0, 10), oggi) >= 2) {
    aggiungiA(oggi, "scaduto", "Dati salute da importare (solo app)");
  }

  return attese;
}

export function riassuntoGiorno({ data, previsto, allenamento, attese: atteseIn, dal, origine = null }) {
  let attese = atteseIn || [];
  if (dal && data < dal) {
    return { titolo: dataLunga(data), righe: [{ testo: "Prima dell'inizio del programma", stato: "info" }] };
  }
  const righe = [];
  if (allenamento?.completato) righe.push({ testo: `${allenamento.nome} — completato`, stato: "ok" });
  else if (previsto) {
    righe.push({
      testo: data < isoDate() ? `${previsto.nome} — non registrato` : previsto.nome,
      stato: data < isoDate() ? "warn" : "info",
    });
  } else if (!attese.length) {
    // Col calendario collegato «niente» non è riposo per scelta dell'app: è
    // quello che c'è scritto, o l'assenza di qualunque cosa.
    righe.push(
      origine?.scaduta
        ? {
            // Non è «niente»: è che il calendario non è stato riletto. Dirlo
            // qui evita di credere che il coach non avesse previsto nulla.
            testo: `Calendario da aggiornare — letto fino al ${dataBreve(origine.fine)}`,
            stato: "warn",
          }
        : origine?.oltreProgrammato
          ? { testo: `Non ancora programmato (il coach arriva al ${dataBreve(origine.ultimoEvento)})`, stato: "info" }
          : origine?.nonLetta
          ? { testo: "Giorno non letto dal calendario", stato: "info" }
          : {
              testo: origine?.fonte === "calendario" ? "Niente sul calendario" : "Riposo",
              stato: "info",
            }
    );
  }
  // Evita di ripetere lo stesso titolo due volte: se è già fra le cose attese
  // del giorno, basta segnalarne la natura una volta sola.
  if (origine?.sconosciuto && origine.titolo) {
    const gia = attese.findIndex((a) => a.testo === origine.titolo);
    // Se quella riga era segnata in ritardo, il ritardo va tenuto: toglierla e
    // basta faceva sparire l'avviso insieme al doppione.
    const eraScaduta = gia >= 0 && attese[gia].tipo === "scaduto";
    if (gia >= 0) attese = attese.filter((_, i) => i !== gia);
    if (eraScaduta) righe.push({ testo: `${origine.titolo} — in ritardo`, stato: "warn" });
    righe.push({ testo: `«${origine.titolo}» non è un allenamento del programma`, stato: "info" });
  }

  for (const a of attese) righe.push({ testo: a.testo, stato: a.tipo === "scaduto" ? "warn" : "info" });
  return { titolo: dataLunga(data), righe };
}
