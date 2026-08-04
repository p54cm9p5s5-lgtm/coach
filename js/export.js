/* Genera il pacchetto di testo da incollare nella chat con il coach.
   Formato §12 del master brief per il log seduta, più il contorno che serve
   a leggerlo: dati salute del giorno, stato delle finestre, proposte aperte. */

import { dataBreve, dataLunga, durataUmana, mmss, num, isoDate } from "./ui.js";

const riga = (etichetta, valore) => (valore == null || valore === "" ? null : `${etichetta}: ${valore}`);

function tabella(intestazioni, righe) {
  if (!righe.length) return "";
  const ultima = intestazioni.length - 1;
  // L'ultima colonna (le note) non viene allineata: è lunga e variabile, e
  // riempirla di spazi renderebbe la tabella illeggibile in chat.
  const larghezze = intestazioni.map((h, i) =>
    i === ultima ? h.length : Math.max(h.length, ...righe.map((r) => String(r[i] ?? "").length))
  );
  const linea = (celle) =>
    "| " +
    celle.map((c, i) => (i === ultima ? String(c ?? "") : String(c ?? "").padEnd(larghezze[i]))).join(" | ") +
    " |";
  return [
    linea(intestazioni),
    "|" + larghezze.map((l) => "-".repeat(l + 2)).join("|") + "|",
    ...righe.map(linea),
  ].join("\n");
}

/** Log di una seduta nel formato fisso del §12. */
export function logSeduta({ seduta, serie, questionari, esercizio, giornoSplit, previsti = [] }) {
  const perEsercizio = new Map();
  for (const s of serie) {
    if (!perEsercizio.has(s.esercizioId)) perEsercizio.set(s.esercizioId, []);
    perEsercizio.get(s.esercizioId).push(s);
  }
  for (const q of questionari) if (!perEsercizio.has(q.esercizioId)) perEsercizio.set(q.esercizioId, []);
  // Gli esercizi previsti ma mai iniziati devono comparire: senza, il coach
  // legge un allenamento di tre esercizi e non sa che ne erano previsti cinque.
  for (const v of previsti) if (!perEsercizio.has(v.esercizioId)) perEsercizio.set(v.esercizioId, []);

  const righe = [];
  for (const [esId, righeSerie] of perEsercizio) {
    const def = esercizio(esId);
    const log = questionari.find((q) => q.esercizioId === esId);
    const nome = def?.nome || esId;

    if (log?.saltato) {
      // Anche qui gli a capo diventano separatori: la nota del salto si scrive
      // in un riquadro a più righe e spezzava la tabella del coach.
      const motivo = `${log.saltato.motivo}${log.saltato.nota ? `: ${String(log.saltato.nota).replace(/\s*\n+\s*/g, " · ")}` : ""}`;
      if (!righeSerie.length) {
        righe.push([nome, "—", "—", "—", `NON ESEGUITO (${motivo})`]);
        continue;
      }
      // Interrotto a metà: le serie già fatte restano, altrimenti sparirebbe
      // lavoro davvero svolto dal log che legge il coach.
      const car = righeSerie.filter((s) => s.carico != null);
      const distintiInterrotto = [...new Set(car.map((s) => s.carico))];
      righe.push([
        nome,
        !car.length
          ? "corpo libero"
          : distintiInterrotto.length === 1
            ? `${num(distintiInterrotto[0])} kg`
            : `${righeSerie.map((s) => (s.carico != null ? num(s.carico) : "—")).join("/")} kg`,
        `${righeSerie.length}x${righeSerie.map((s) => s.ripFatte ?? "—").join("/")}`,
        log?.rpe != null ? String(log.rpe) : "non registrato",
        `INTERROTTO dopo ${righeSerie.length} ${righeSerie.length === 1 ? "serie" : "serie"} (${motivo})`,
      ]);
      continue;
    }

    if (!righeSerie.length && !log) {
      righe.push([nome, "—", "—", "—", "NON INIZIATO (previsto dal programma)"]);
      continue;
    }

    // I carichi si elencano serie per serie, nello stesso ordine delle
    // ripetizioni: con i soli valori distinti «20 / 22 kg» accanto a
    // «3x10/8/8» non si capiva quale carico stesse con quale serie.
    const conCarico = righeSerie.filter((s) => s.carico != null);
    const distinti = [...new Set(conCarico.map((s) => s.carico))];
    const carico = !conCarico.length
      ? "corpo libero"
      : distinti.length === 1
        ? `${num(distinti[0])} kg`
        : `${righeSerie.map((s) => (s.carico != null ? num(s.carico) : "—")).join("/")} kg`;
    const rip = righeSerie.map((s) => s.ripFatte ?? "—").join("/");
    const aTempo = righeSerie.some((s) => s.aTempo);

    const note = [];
    if (log?.dolorePolso) note.push(`DOLORE POLSO ${log.dolorePolsoIntensita} ${log.dolorePolsoQuando}`);
    if (log?.tecnica != null) note.push(`tecnica ${num(log.tecnica)}/10`);
    // Gli a capo dentro una cella spezzerebbero la tabella a formato fisso che
    // il coach si aspetta: diventano separatori.
    if (log?.nota) note.push(String(log.nota).replace(/\s*\n+\s*/g, " · "));

    righe.push([
      nome,
      carico,
      `${righeSerie.length}x${rip}${aTempo ? "s" : ""}`,
      log?.rpe != null ? String(log.rpe) : "non registrato",
      note.join(" · ") || "—",
    ]);
  }

  const recuperi = serie.map((s) => s.recuperoRealeSec).filter((x) => x != null);
  // L'inizio del lavoro vero (una seduta ripresa il giorno dopo comincia
  // quando riprendi, non quando l'avevi aperta).
  const durata = seduta.oraFine
    ? Math.round((seduta.oraFine - (seduta.oraInizioLavoro || seduta.oraInizio)) / 1000)
    : null;

  return [
    `SEDUTA — ${dataBreve(seduta.data)} — Giorno: ${seduta.tipoNome}`,
    "",
    tabella(["Esercizio", "Carico", "Serie x Rip", "RPE", "Nota"], righe),
    "",
    riga(
      "Recuperi reali (cronometrati dall'app)",
      recuperi.length
        ? `media ${mmss(recuperi.reduce((a, b) => a + b, 0) / recuperi.length)}, da ${mmss(Math.min(...recuperi))} a ${mmss(Math.max(...recuperi))}`
        : null
    ),
    // Il motivo per cui il cardio non è stato fatto è un dato clinico, non un
    // dettaglio: veniva registrato nell'app e poi non arrivava al coach.
    riga(
      "Velocità impostata sul tapis",
      (() => {
        if (!seduta.cardio?.eseguito && !seduta.cardio?.previsto) return null;
        // La nota che hai scritto sul cardio è un dato come gli altri: restava
        // nell'app e non arrivava mai al coach.
        const nota = seduta.cardio.note
          ? ` — ${String(seduta.cardio.note).replace(/\s*\n+\s*/g, " · ")}`
          : "";
        if (seduta.cardio.eseguito) {
          return `${num(seduta.cardio.kmh)} km/h per ${seduta.cardio.durataMin} min${nota}`;
        }
        const motivo = seduta.cardio.saltatoMotivo
          ? ` (${String(seduta.cardio.saltatoMotivo).replace(/\s*\n+\s*/g, " · ")})`
          : "";
        return `cardio non eseguito${motivo}${nota}`;
      })()
    ),
    riga("Durata allenamento", durata ? durataUmana(durata) : null),
    // La densità si misura sul tempo di lavoro, non sul tempo passato: con una
    // seduta ripresa il giorno dopo veniva «0,01 serie/min».
    riga(
      "Densità",
      (() => {
        const netto = seduta.durataLavoroSec || durata;
        return netto ? `${(serie.length / (netto / 60)).toFixed(2).replace(".", ",")} serie/min` : null;
      })()
    ),
    // Ad allenamento chiuso «non registrato» è una scusa: o l'hai fatto o l'hai
    // saltato, e il coach deve leggere quale delle due.
    riga(
      "Riscaldamento",
      seduta.riscaldamento?.fatto
        ? seduta.riscaldamento.modalita === "senzaTapis"
          ? "fatto, senza tapis"
          : "fatto"
        : seduta.oraFine
          ? "saltato"
          : "non registrato"
    ),
    // Lo stretching pesa nel punteggio quanto il riscaldamento: ometterlo dal
    // log lasciava il coach senza metà di quella voce.
    riga("Stretching finale", seduta.stretching ? (seduta.stretching.fatto ? "fatto" : "saltato") : "non registrato"),
    // Letti sull'orologio a fine allenamento: i Comandi Rapidi non sanno
    // leggere gli allenamenti dell'Apple Watch, quindi questi numeri li scrive
    // l'atleta a mano — e sono quelli esatti della seduta, non di una finestra.
    riga(
      "Dall'orologio",
      (() => {
        const o = seduta.orologio || {};
        const parti = [
          o.fcMedia != null ? `FC media ${num(o.fcMedia, 0)}` : null,
          o.fcMax != null ? `FC massima ${num(o.fcMax, 0)}` : null,
          o.kcal != null ? `${num(o.kcal, 0)} kcal attive` : null,
        ].filter(Boolean);
        return parti.length ? parti.join(" · ") : null;
      })()
    ),
    riga("Nota generale", seduta.notaGenerale),
    giornoSplit && seduta.tipoProgrammatoId && seduta.tipoProgrammatoId !== seduta.tipoId
      ? `Nota: in programma era ${giornoSplit(seduta.tipoProgrammatoId)?.nome || seduta.tipoProgrammatoId}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Dati di salute recenti e stato delle finestre. */
const GIORNI_ABBR = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const ore = (min) => (min == null ? "—" : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`);

/**
 * Le tabelle rispettano alla lettera §9-bis e §9-ter del master brief: stesse
 * colonne, stesso ordine, stesse etichette. Non è pignoleria — è il formato
 * che il coach legge, e riformattarlo costringe a rileggere invece che a
 * confrontare.
 */
export function bloccoSalute({ giorni, notti, finestraMovimento, finestraSonno, obiettivo, tipoGiorno }) {
  const righeG = giorni.slice(0, 7).map((g) => {
    const giorno = GIORNI_ABBR[new Date(g.data + "T00:00:00").getDay()];
    if (!g.presente) return [dataBreve(g.data), giorno, tipoGiorno(g.data), "non registrato", "—", "—", ""];
    const obb = g.obiettivoKcal || obiettivo;
    return [
      dataBreve(g.data),
      giorno,
      tipoGiorno(g.data),
      g.kcalAttive != null ? `${Math.round(g.kcalAttive)}/${obb}` : "—",
      g.kcalAttive != null && obb ? `${num((g.kcalAttive / obb) * 100)}%` : "—",
      g.passi != null ? g.passi.toLocaleString("it-IT") : "—",
      "",
    ];
  });

  const righeN = notti.slice(0, 7).map((n) =>
    n.presente
      ? [
          dataBreve(n.data),
          ore(n.durataMin),
          "—",
          n.profondoMin != null ? ore(n.profondoMin) : "—",
          n.remMin != null ? ore(n.remMin) : "—",
          n.vegliaMin != null ? `${n.vegliaMin} min` : "—",
          n.risvegli != null ? `${n.risvegli} risvegli` : "",
        ]
      : [dataBreve(n.data), "non registrata", "—", "—", "—", "—", ""]
  );

  // Le settimane si scrivono con le date, non numerate: erano elencate dalla
  // più recente alla più vecchia ma chiamate «sett.1, 2, 3», e «sett.1 sotto
  // minimo» faceva pensare alla prima settimana del ciclo invece che a questa.
  // Le settimane finite prima che l'app esistesse non sono ammanchi.
  const stato = (f, unita) =>
    `${f.registratiTotali}/${f.richiesti} ${unita}${f.completa ? " — completa" : " — incompleta"}` +
    ` (${f.perSettimana
      .map(
        (s) =>
          `${dataBreve(s.da)}–${dataBreve(s.a)}: ${s.registrati}` +
          (s.primaDeiDati ? " prima dei dati" : s.sufficiente ? "" : " sotto minimo")
      )
      .join("; ")})`;

  return [
    "DATI SALUTE",
    "",
    `Finestra movimento: ${stato(finestraMovimento, "giorni")}`,
    `Finestra sonno: ${stato(finestraSonno, "notti")}`,
    "",
    righeG.length
      ? tabella(["Data", "Giorno", "Tipo", "Movimento kcal", "% obiettivo", "Passi", "Note"], righeG)
      : "Nessun dato di movimento.",
    "",
    // Il resto del movimento non entra nella tabella del §9-bis (le colonne
    // sono fisse e il coach le legge a colpo d'occhio): sta sotto, in una riga.
    (() => {
      const conDati = giorni.slice(0, 7).filter((g) => g.presente);
      const media = (campo, dec = 0) => {
        const v = conDati.map((g) => g[campo]).filter((x) => x != null);
        if (!v.length) return null;
        return num(v.reduce((a, b) => a + b, 0) / v.length, dec);
      };
      const parti = [
        media("minutiInPiedi")
          ? `in piedi ${durataUmana(Number(String(media("minutiInPiedi")).replace(",", ".")) * 60)}/giorno`
          : null,
        media("pianiSaliti") ? `${media("pianiSaliti")} piani/giorno` : null,
        media("distanzaKm", 1) ? `${media("distanzaKm", 1)} km/giorno` : null,
        media("minutiEsercizio") ? `${media("minutiEsercizio")} min di esercizio/giorno` : null,
        media("fcRiposo") ? `FC a riposo ${media("fcRiposo")} bpm` : null,
      ].filter(Boolean);
      return parti.length ? `Resto del movimento (media 7 giorni): ${parti.join(" · ")}` : null;
    })(),
    "",
    righeN.length
      ? tabella(
          ["Data (notte del)", "Ore sonno", "Punteggio", "Fase Profondo", "Fase REM", "Veglia", "Note"],
          righeN
        )
      : "Nessun dato di sonno.",
    "",
    "Nota: un giorno «non registrato» non vale zero, resta fuori dalle medie.",
    "La colonna Punteggio del sonno resta vuota: l'app Salute non la espone, va scritta a mano.",
    "Le kcal del Watch servono solo al confronto nel tempo, mai come base per calcoli alimentari.",
  ].join("\n");
}

/**
 * Proposte accettate dall'atleta: l'app le usa come obiettivo alla prossima
 * esposizione, quindi il coach deve saperlo. Tacerlo significherebbe lasciare
 * che il carico allenato si scosti dal brief senza che nessuno lo veda.
 */
export function bloccoAccettate(accettate, esercizio) {
  if (!accettate.length) return null;
  const riga = (p) => {
    const nome = esercizio(p.esercizioId)?.nome || p.esercizioId;
    const parti = [];
    if (p.a?.carico != null) parti.push(`${num(p.a.carico)} kg`);
    if (p.a?.rip != null) parti.push(`${p.a.rip} rip`);
    const prima = p.da?.carico != null ? `, prima ${num(p.da.carico)} kg` : "";
    // La data della risposta, non quella in cui la proposta è nata: sono cose
    // diverse e stampare la seconda faceva sembrare vecchia una decisione di ieri.
    const quando = p.rispostoIl ? isoDate(new Date(p.rispostoIl)) : p.data;
    // Lo stato della verifica: senza, il coach non sa se una decisione è stata
    // controllata o se è ancora in attesa di prova.
    const verifica = p.esitoVerifica
      ? `, verifica del ${dataBreve(p.esitoVerifica.data)}: ${p.esitoVerifica.esito === "confermata" ? "confermata" : "NON confermata"}`
      : p.dataVerifica
        ? `, verifica prevista il ${dataBreve(p.dataVerifica)}`
        : "";
    const MOTIVO = {
      usata: "già allenata dopo l'accettazione",
      annullataDalBrief: "annullata dal brief nuovo",
      superata: "sostituita da una accettata più recente",
    };
    const perche = p.inVigore ? "" : ` — ${MOTIVO[p.motivoScarto] || "non più in vigore"}`;
    return `- ${nome}: ${parti.join(" · ") || "—"}${prima} (accettata il ${dataBreve(quando)}${verifica})${perche}`;
  };
  // `inVigore` manca quando la lista arriva da una versione vecchia: in quel
  // caso si stampa tutto insieme, come prima, invece di dichiarare il falso.
  const noto = accettate.some((p) => p.inVigore !== undefined);
  const attive = noto ? accettate.filter((p) => p.inVigore) : accettate;
  const consumate = noto ? accettate.filter((p) => !p.inVigore) : [];

  return [
    "PROPOSTE ACCETTATE DALL'ATLETA",
    "",
    attive.length ? "In vigore adesso — l'app chiede questi valori alla prossima esposizione:" : null,
    ...attive.map(riga),
    attive.length ? "" : null,
    consumate.length
      ? "Non più in vigore — restano qui perché spiegano i carichi registrati:"
      : null,
    ...consumate.map(riga),
    consumate.length ? "" : null,
    "Finché il brief non li conferma o li smentisce, il programma scritto non è",
    "stato modificato.",
  ]
    .filter((r) => r !== null)
    .join("\n");
}

/** Proposte che aspettano una decisione, con le quattro domande. */
export function bloccoProposte(proposte, nomeLivello) {
  if (!proposte.length) return "PROPOSTE IN SOSPESO\n\nNessuna.";
  return [
    "PROPOSTE IN SOSPESO",
    "",
    ...proposte.map((p, i) =>
      [
        `${i + 1}. ${p.titolo}`,
        `   Livello ${p.livelloGerarchia} — ${nomeLivello(p.livelloGerarchia)}`,
        `   Perché: ${p.quattroDomande.perche}`,
        `   Dati: ${p.quattroDomande.quali}`,
        `   Alternative: ${p.quattroDomande.alternative}`,
        `   Atteso: ${p.quattroDomande.atteso}`,
        // In sospeso vuol dire non ancora accettata: la verifica parte da
        // quando l'atleta risponde, non da quando la proposta è nata.
        `   Verifica: 14 giorni dopo l'accettazione`,
      ].join("\n")
    ),
    "",
    "Materiale per la valutazione, non decisioni: l'app non tocca il programma scritto.",
    "Le soglie usate sono quelle del blocco tecnico del master brief; la decisione resta al coach.",
  ].join("\n");
}

/** Misure e indici, solo se aggiornati di recente. */
export function bloccoCorpo({ misure, indici, etichette, dateIndici = {} }) {
  if (!misure.length) return null;
  // Ogni indice nasce dall'ultima misura di ciascun tipo, e quelle misure
  // possono essere di giorni diversi: un rapporto vita/fianchi fra una vita di
  // ieri e dei fianchi di un mese fa non è una fotografia di oggi. Va detto.
  const INGREDIENTI = {
    vitaAltezza: ["vitaOmbelico"],
    vitaFianchi: ["vitaOmbelico", "fianchi"],
    bmi: ["peso"],
  };
  const quando = (id) => {
    const d = (INGREDIENTI[id] || []).map((t) => dateIndici[t]).filter(Boolean);
    if (!d.length) return "";
    const uniche = [...new Set(d)].sort();
    return uniche.length === 1
      ? ` — misure del ${dataBreve(uniche[0])}`
      : ` — misure di giorni diversi: ${uniche.map(dataBreve).join(" e ")}`;
  };
  const righe = misure.map((m) => [
    etichette[m.tipo] || m.tipo,
    `${num(m.valore)} ${m.tipo === "peso" ? "kg" : "cm"}`,
    dataBreve(m.data),
    m.condizioniStandard === false ? "fuori protocollo" : "",
  ]);
  return [
    "CORPO",
    "",
    tabella(["Misura", "Valore", "Data", "Nota"], righe),
    "",
    ...indici.map(
      (i) => `${i.nome}: ${num(i.valore, i.decimali)} (soglia ${num(i.soglia, i.decimali)})${quando(i.id)}`
    ),
  ].join("\n");
}

export function intestazionePacchetto(cosa) {
  return [
    `COACH — pacchetto del ${dataLunga(isoDate())}`,
    `Contenuto: ${cosa.join(", ")}.`,
    "Generato dall'app: i numeri non sono trascritti a mano.",
  ].join("\n");
}
