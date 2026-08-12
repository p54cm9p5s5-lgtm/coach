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
    // Anche i pallini delle cose attese valgono solo da quando il programma
    // esiste: prima erano segnati arretrati mesi che non ti erano mai stati
    // chiesti.
    if (dentroProgramma) {
      for (const a of attese.slice(0, 2)) aggiungi(punti, h("i", { class: `p-${a.tipo}` }));
    }

    // I pallini si vedono, ma chi legge lo schermo ad alta voce sentiva solo il
    // numero: la stessa informazione va scritta anche a parole.
    const voce = [
      dataLunga(data),
      fatto?.completato ? `${fatto.nome} completato` : previsto ? `${previsto.nome}${passato ? " non fatto" : " in programma"}` : null,
      ...(dentroProgramma ? attese.slice(0, 2).map((a) => (a.tipo === "scaduto" ? `${a.testo} in ritardo` : a.testo)) : []),
    ]
      .filter(Boolean)
      .join(", ");

    aggiungi(griglia,
      h(
        "button",
        { class: classi.join(" "), "aria-label": voce, onclick: () => ctx.onGiorno(data) },
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
  cadenze = null,
  // Tutte le date registrate, non solo l'ultima: per dire se un giovedì di due
  // settimane fa è stato rispettato serve sapere cosa c'era ALLORA, non cosa
  // c'è adesso. Con la sola ultima misura, una pesata fatta dopo faceva
  // risultare «in ordine» tutti i giovedì saltati prima.
  datePeso = null,
  dateVita = null,
  dateFoto = null,
}) {
  const cad = {
    misureGiornoSettimana: 4,
    fotoGiornoSettimana: 3,
    fotoOgniSettimane: 2,
    fotoAncora: "2026-08-12",
    ...(cadenze || {}),
  };
  const attese = new Map();
  /**
   * `risolto` distingue due domande diverse che finivano nella stessa risposta:
   * «quel giorno eri in regola?» — che resta segnata sul calendario, ed è la
   * costanza — e «manca ancora adesso?», che è quello che dice il piede della
   * Home. Una pesata fatta venerdì invece che giovedì lascia il giovedì
   * arretrato per sempre, ma adesso non manca più niente.
   */
  const aggiungiA = (data, tipo, testo, risolto = false) => {
    if (!attese.has(data)) attese.set(data, []);
    attese.get(data).push({ tipo, testo, risolto: tipo === "scaduto" ? Boolean(risolto) : false });
  };

  // L'ultima data registrata che non sia successiva al giorno guardato: è
  // quella che conta per sapere se in quel giorno eri in regola.
  const ultimaEntro = (elenco, unica, data) => {
    const tutte = Array.isArray(elenco) && elenco.length ? elenco : unica ? [unica] : [];
    let migliore = null;
    for (const x of tutte) if (x && x <= data && (!migliore || x > migliore)) migliore = x;
    return migliore;
  };

  // Come stanno le cose ADESSO: serve a dire se un arretrato è stato recuperato
  // dopo, anche di un giorno solo.
  const pesoOra = ultimaEntro(datePeso, ultimoPeso, oggi);
  const vitaOra = ultimaEntro(dateVita, ultimaVita, oggi);
  const fotoOra = ultimaEntro(dateFoto, ultimaFoto, oggi);
  const misuraMancaOra =
    !pesoOra || !vitaOra || giorniTra(pesoOra, oggi) >= 7 || giorniTra(vitaOra, oggi) >= 7;
  const fotoMancanoOra = !fotoOra || giorniTra(fotoOra, oggi) >= 7 * (cad.fotoOgniSettimane || 1);

  const periodiche = () => {
    const d = parseIso(oggi);
    for (let i = -21; i <= 21; i++) {
      const g = new Date(d);
      g.setDate(g.getDate() + i);
      if (g.getDay() === cad.misureGiornoSettimana) {
        const data = iso(g);
        const peso = ultimaEntro(datePeso, ultimoPeso, data);
        const vita = ultimaEntro(dateVita, ultimaVita, data);
        // L'evento chiede DUE misure: basta che una manchi perché sia arretrato.
        const scaduto =
          data <= oggi && (!peso || !vita || giorniTra(peso, data) >= 7 || giorniTra(vita, data) >= 7);
        aggiungiA(data, scaduto ? "scaduto" : "misura", "Peso e circonferenza vita", !misuraMancaOra);
      }
      if (g.getDay() === cad.fotoGiornoSettimana) {
        const settimane = Math.round(giorniTra(cad.fotoAncora, iso(g)) / 7);
        if (((settimane % cad.fotoOgniSettimane) + cad.fotoOgniSettimane) % cad.fotoOgniSettimane === 0) {
          const data = iso(g);
          const foto = ultimaEntro(dateFoto, ultimaFoto, data);
          const scaduto = data <= oggi && (!foto || giorniTra(foto, data) >= 7 * cad.fotoOgniSettimane);
          aggiungiA(data, scaduto ? "scaduto" : "foto", "Set di foto", !fotoMancanoOra);
        }
      }
    }
  };

  // Le cadenze del protocollo — pesata, circonferenze, set di foto — valgono
  // SOLO quando il calendario non c'è.
  //
  // Con il calendario collegato comanda lui, e non a metà: se decide cosa si
  // allena, decide anche quando ti pesi e quando fai le foto. Sommandoci anche
  // le cadenze dell'app uscivano due cose sbagliate insieme — un doppione, con
  // «peso, vita, misure e foto» scritto dal coach e accanto «Peso e
  // circonferenza vita» messo dall'app, e soprattutto roba inventata: foto
  // «in ritardo» in un giorno in cui il coach non aveva chiesto nessuna foto.
  // L'app non ha titolo per aggiungere scadenze a un programma che sta
  // leggendo da qualcun altro.
  const comandaIlCalendario = Array.isArray(eventi);
  if (!comandaIlCalendario) periodiche();

  if (eventi) {
    // Calendario collegato: le cose da fare sono quelle che ci ha scritto il
    // coach, con le sue parole. L'app non aggiunge scadenze di sua invenzione.
    for (const e of eventi) {
      // Una riga vuota nell'elenco non deve fermare tutto il calcolo delle
      // scadenze: si salta e si va avanti con le altre.
      if (!e) continue;
      // Il titolo principale conta solo se non è l'allenamento (quello ha già
      // il suo segno sul calendario); gli altri eventi del giorno sempre.
      // `altri` può contenere stringhe o {titolo, nota}: qui serve il titolo.
      const titoli = [...(e.giornoId ? [] : [e.titolo]), ...(e.altri || []).map((x) => (typeof x === "string" ? x : x?.titolo))]
        .filter(Boolean);
      for (const titolo of titoli) {
        const t = titolo.toLowerCase();
        // Solo quello che l'app registra davvero può essere «in ritardo»: la
        // pressione, per esempio, non la tiene e resta un promemoria e basta.
        // Cosa chiede l'evento, guardato pezzo per pezzo. Peso e circonferenze
        // sono due misure diverse: prima bastava essersi pesati per dare per
        // fatto anche «misura vita», e il promemoria del coach spariva senza
        // che tu l'avessi fatta.
        // Confini di parola: senza, «evitare» diventava una misura della vita,
        // «sospeso» una pesata e «fotocopia» un set di foto.
        const chiedeFoto = /\bfoto\b|\bfotografi/.test(t);
        const chiedePeso = /\bpes[oi]\b|\bpesat/.test(t);
        const chiedeVita = /\bvit[ae]\b|\bcirconferenz/.test(t);
        const tipo = chiedeFoto ? "foto" : chiedePeso || chiedeVita ? "misura" : "info";
        // Conta la cosa fatta più indietro nel tempo fra quelle chieste: se
        // una non è MAI stata fatta, l'evento resta da fare (niente data).
        // Anche qui vale solo quello che era stato fatto ENTRO quel giorno: con
        // l'ultima misura in assoluto, una pesata di oggi cancellava il ritardo
        // di tutte le pesate chieste dal coach e mai fatte. Il giovedì del
        // protocollo lo faceva già; l'evento scritto sul calendario no, e la
        // stessa cosa mancante risultava scaduta in un posto e in ordine
        // nell'altro.
        const richieste = [
          chiedeFoto ? ultimaEntro(dateFoto, ultimaFoto, e.data) : null,
          chiedePeso ? ultimaEntro(datePeso, ultimoPeso, e.data) : null,
          chiedeVita ? ultimaEntro(dateVita, ultimaVita, e.data) : null,
        ].filter((_, i) => [chiedeFoto, chiedePeso, chiedeVita][i]);
        const fattoDa = richieste.some((d) => !d)
          ? null
          : richieste.filter(Boolean).sort()[0] || null;
        const scaduto =
          e.data <= oggi && tipo !== "info" && (!fattoDa || giorniTra(fattoDa, e.data) >= 1);
        // Recuperato dopo: tutto quello che l'evento chiedeva è stato fatto in
        // un giorno successivo a quello scritto dal coach.
        const recuperato = [
          chiedeFoto ? fotoOra : null,
          chiedePeso ? pesoOra : null,
          chiedeVita ? vitaOra : null,
        ]
          .filter((_, i) => [chiedeFoto, chiedePeso, chiedeVita][i])
          .every((d) => d && d > e.data);
        aggiungiA(e.data, scaduto ? "scaduto" : tipo, titolo, recuperato);
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
  // Senza una data vera non c'è niente da riassumere: meglio dirlo che
  // scrivere in testa al riquadro «undefined NaN undefined».
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || "")) {
    return { titolo: "Giorno non riconosciuto", righe: [{ testo: "Data non valida", stato: "info" }] };
  }
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
    const riga = (
      origine?.riposo
        ? {
            // Il riposo scritto dal coach è un'informazione, non un'assenza:
            // dire «niente sul calendario» era il contrario del vero. Se però
            // l'evento si chiama proprio «Riposo», ripeterlo dava «Riposo —
            // Riposo».
            testo:
              origine.titolo && origine.titolo.trim().toLowerCase() !== "riposo"
                ? `Riposo — ${origine.titolo}`
                : "Riposo, dal calendario",
            stato: "info",
          }
        : origine?.scaduta
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
          : origine?.sconosciuto
          ? // Sul calendario c'è qualcosa: la riga che lo spiega viene aggiunta
            // più sotto, e dire «niente sul calendario» la contraddiceva.
            null
          : {
              testo: origine?.fonte === "calendario" ? "Niente sul calendario" : "Riposo",
              stato: "info",
            }
    );
    if (riga) righe.push(riga);
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
  // La nota che il coach ha scritto nell'evento vale quanto il titolo, e va
  // letta DOPO di lui: prima arrivava per prima e sembrava riferita ad altro.
  if (origine?.nota) righe.push({ testo: origine.nota, stato: "info" });

  for (const a of attese) righe.push({ testo: a.testo, stato: a.tipo === "scaduto" ? "warn" : "info" });
  return { titolo: dataLunga(data), righe };
}
