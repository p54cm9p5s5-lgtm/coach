/* Genera il pacchetto di testo da incollare nella chat con il coach.
   Formato §12 del master brief per il log seduta, più il contorno che serve
   a leggerlo: dati salute del giorno, stato delle finestre, proposte aperte. */

import { dataBreve, dataLunga, durataUmana, mmss, num, isoDate, oraDi } from "./ui.js";
import { doloriDi } from "./punteggio.js";

// Il pacchetto si legge per righe: una nota scritta con l'invio ne produceva
// una senza etichetta, e il coach leggeva una frase sospesa senza sapere di chi
// fosse. Gli a capo diventano separatori, come già nelle tabelle.
const riga = (etichetta, valore) =>
  valore == null || valore === ""
    ? null
    : `${etichetta}: ${String(valore).replace(/\s*\n+\s*/g, " · ")}`;

const GIORNI_ABBR = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

/**
 * I motivi vengono salvati con una parola sola («attrezzo»), che è comoda per
 * il codice e oscura per chi legge: al coach arrivava «cardio non eseguito
 * (attrezzo)» invece delle parole che l'app aveva mostrato all'atleta.
 */
const MOTIVI_ESERCIZIO = {
  tempo: "tempo finito",
  dolore: "dolore",
  attrezzo: "attrezzo non disponibile",
  altro: "altro",
};
const MOTIVI_CARDIO = {
  tempo: "tempo finito",
  attrezzo: "tapis non disponibile",
  altro: "altro",
};
const inParole = (codice, tabella) =>
  codice == null ? null : tabella[codice] || String(codice).replace(/\s*\n+\s*/g, " · ");

/**
 * Come va letto un carico, secondo l'attrezzo. «4 kg» su un esercizio con i
 * manubri non dice se sono per manubrio o in tutto, e chi legge deve tirare a
 * indovinare. Col bilanciere il numero comprende la barra.
 */
const unitaCarico = (def) => {
  const a = (def?.attrezzo || "").toLowerCase();
  if (a.includes("manubri")) return "per manubrio";
  if (a.includes("bilanciere")) return "barra compresa";
  return null;
};

/**
 * Carico e ripetizioni, serie per serie.
 *
 * Con un carico costante la forma compatta va benissimo: «60 kg» e «4x8/6/6/6».
 * Quando il carico cambia in mezzo all'esercizio no: «4/6 kg» accanto a
 * «2x12/10» costringe a incrociare due colonne, e non si capisce se è un range,
 * una salita o un refuso. In quel caso ogni serie si scrive per intero.
 */
function caricoESerie(righeSerie, def) {
  const aTempo = righeSerie.some((s) => s.aTempo);
  const conCarico = righeSerie.filter((s) => s.carico != null);
  const distinti = [...new Set(conCarico.map((s) => s.carico))];
  const unita = unitaCarico(def);
  const suffisso = unita ? ` ${unita}` : "";
  const rip = (s) => `${s.ripFatte ?? "—"}${aTempo ? "s" : ""}`;

  if (!conCarico.length) {
    return { carico: "corpo libero", serie: `${righeSerie.length}x${righeSerie.map(rip).join("/")}` };
  }
  if (distinti.length === 1) {
    return {
      carico: `${num(distinti[0])} kg${suffisso}`,
      serie: `${righeSerie.length}x${righeSerie.map(rip).join("/")}`,
    };
  }
  // Carico cambiato in corsa: si accoppia serie per serie e si dice in che
  // direzione è andato, così la riga si legge senza doverla ricostruire.
  const primo = conCarico[0].carico;
  const ultimo = conCarico[conCarico.length - 1].carico;
  return {
    carico: `${num(primo)} → ${num(ultimo)} kg${suffisso}`,
    serie: righeSerie
      .map((s, i) => `s${i + 1} ${s.carico != null ? `${num(s.carico)} kg` : "—"}×${rip(s)}`)
      .join(" · "),
  };
}

/**
 * I numeri copiati dall'orologio a fine allenamento. Sono due allenamenti
 * distinti — pesi e cardio — e vanno letti così anche dal coach.
 */
function descriviOrologio(o, quale) {
  if (!o) return null;
  // La prima versione dell'app teneva un blocco solo e piatto: se arriva
  // quello, vale come parte pesi.
  const parti = [
    o.durata ? `durata ${o.durata}` : null,
    quale === "cardio" && o.km != null ? `${num(o.km, 2)} km` : null,
    quale === "cardio" && o.ritmo ? `ritmo ${o.ritmo}/km` : null,
    o.kcalAttive != null ? `${num(o.kcalAttive, 0)} kcal attive` : o.kcal != null ? `${num(o.kcal, 0)} kcal attive` : null,
    o.kcalTotali != null ? `${num(o.kcalTotali, 0)} kcal totali` : null,
    o.fcMedia != null ? `FC media ${num(o.fcMedia, 0)}` : null,
    o.fcMax != null ? `FC massima ${num(o.fcMax, 0)}` : null,
    o.sforzo != null ? `sforzo ${num(o.sforzo, 0)}/10` : null,
  ].filter(Boolean);
  return parti.length ? parti.join(" · ") : null;
}

function tabella(intestazioni, righe) {
  if (!righe.length) return "";
  // Una barra verticale scritta in una nota («ho sentito un click | poi
  // niente») spezzava la riga in colonne che non esistono, e il coach leggeva
  // una tabella sfasata. Qui viene protetta una volta sola, per tutte le
  // tabelle: gli a capo diventano separatori per lo stesso motivo.
  const cella = (v) =>
    String(v ?? "")
      .replace(/\s*\n+\s*/g, " · ")
      .replace(/\|/g, "\\|");
  righe = righe.map((r) => r.map(cella));
  intestazioni = intestazioni.map(cella);
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
export function logSeduta({ seduta, serie, questionari, esercizio, giornoSplit, previsti = [], completezza = null }) {
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
      const motivo = `${inParole(log.saltato.motivo, MOTIVI_ESERCIZIO)}${log.saltato.nota ? `: ${String(log.saltato.nota).replace(/\s*\n+\s*/g, " · ")}` : ""}`;
      if (!righeSerie.length) {
        righe.push([nome, "—", "—", "—", "—", `NON ESEGUITO (${motivo})`]);
        continue;
      }
      // Interrotto a metà: le serie già fatte restano, altrimenti sparirebbe
      // lavoro davvero svolto dal log che legge il coach.
      const c = caricoESerie(righeSerie, def);
      righe.push([
        nome,
        c.carico,
        c.serie,
        log?.rpe != null ? String(log.rpe) : "non registrato",
        log?.tecnica != null ? `${num(log.tecnica)}/10` : "non registrata",
        `INTERROTTO dopo ${righeSerie.length} ${righeSerie.length === 1 ? "serie" : "serie"} (${motivo})`,
      ]);
      continue;
    }

    if (!righeSerie.length && !log) {
      righe.push([nome, "—", "—", "—", "—", "NON INIZIATO (previsto dal programma)"]);
      continue;
    }

    const c = caricoESerie(righeSerie, def);

    const note = [];
    for (const d of doloriDi(log)) note.push(`DOLORE ${d.nome.toUpperCase()} ${d.intensita || ""} ${d.quando || ""}`.trim());
    // Gli a capo dentro una cella spezzerebbero la tabella a formato fisso che
    // il coach si aspetta: diventano separatori.
    if (log?.nota) note.push(String(log.nota).replace(/\s*\n+\s*/g, " · "));

    righe.push([
      nome,
      c.carico,
      c.serie,
      log?.rpe != null ? String(log.rpe) : "non registrato",
      log?.tecnica != null ? `${num(log.tecnica)}/10` : "non registrata",
      note.join(" · ") || "—",
    ]);
  }

  // Recuperi esercizio per esercizio, non solo la media della seduta: la media
  // nasconde proprio il caso che interessa, cioè l'esercizio in cui il recupero
  // è saltato e la serie dopo ne ha risentito.
  const recuperiPerEsercizio = [...perEsercizio.entries()]
    .map(([esId, righeSerie]) => {
      const r = righeSerie.map((x) => x.recuperoRealeSec).filter((x) => x != null);
      if (!r.length) return null;
      const target = righeSerie.find((x) => x.recuperoTargetSec)?.recuperoTargetSec ?? null;
      const media = Math.round(r.reduce((a, b) => a + b, 0) / r.length);
      const nome = esercizio(esId)?.nome || esId;
      // Il secondo esercizio di un blocco non ha nessun riposo davanti: è così
      // che è scritto il programma. Senza dirlo, «00:00» si legge come un
      // recupero saltato, cioè il contrario di quello che è successo.
      if (target == null) {
        const inBlocco = (previsti || []).find((x) => x.esercizioId === esId)?.blocco;
        return inBlocco ? `${nome} ${mmss(media)} (in blocco, nessun riposo previsto)` : `${nome} ${mmss(media)}`;
      }
      return `${nome} ${mmss(media)} su ${mmss(target)}`;
    })
    .filter(Boolean);

  // Cosa ha chiesto l'app, quando è diverso da quello che c'è scritto nel
  // brief: è l'unico modo di capire perché una serie da 13 non è un errore ma
  // una proposta accettata.
  const chiestiDiversi = [];
  for (const [esId, righeSerie] of perEsercizio) {
    if (!righeSerie.length) continue;
    const v = (previsti || []).find((x) => x.esercizioId === esId);
    if (!v) continue;
    // Un esercizio a tempo non ha un range di ripetizioni da confrontare: il
    // bersaglio è la durata, e le proposte accettate non lo toccano mai.
    // Confrontarlo lo stesso scriveva «45 rip (brief undefined-undefined)».
    if (v.aTempo) continue;
    const ripChiesta = righeSerie.map((x) => x.ripTarget).filter((x) => x != null).at(-1);
    const carChiesto = righeSerie.map((x) => x.caricoTarget).filter((x) => x != null).at(-1);
    const parti = [];
    if (ripChiesta != null && ripChiesta !== v.ripMax && ripChiesta !== v.ripMin) {
      parti.push(`${ripChiesta} rip (brief ${v.ripMin}-${v.ripMax})`);
    }
    if (carChiesto != null && v.carico != null && carChiesto !== v.carico) {
      parti.push(`${num(carChiesto)} kg (brief ${num(v.carico)})`);
    }
    if (parti.length) chiestiDiversi.push(`${esercizio(esId)?.nome || esId}: ${parti.join(" · ")}`);
  }

  // Nella media entrano solo i riposi che il programma prevedeva davvero. Il
  // secondo esercizio di un blocco si fa attaccato al primo: quello zero non è
  // un recupero saltato, è il programma. Mescolandolo agli altri, una seduta a
  // blocchi eseguita alla lettera risultava con «media un minuto» su due
  // minuti previsti, cioè come se avessi tirato via.
  const conRiposoPrevisto = serie.filter((s) => s.recuperoRealeSec != null && s.recuperoTargetSec);
  const recuperi = conRiposoPrevisto.map((s) => s.recuperoRealeSec);
  const senzaRiposoPrevisto = serie.filter((s) => s.recuperoRealeSec != null && !s.recuperoTargetSec).length;
  // L'inizio del lavoro vero (una seduta ripresa il giorno dopo comincia
  // quando riprendi, non quando l'avevi aperta).
  const durata = seduta.oraFine
    ? Math.round((seduta.oraFine - (seduta.oraInizioLavoro || seduta.oraInizio)) / 1000)
    : null;

  // Il dettaglio completo, serie per serie. La tabella qui sopra è il riassunto
  // che si legge a colpo d'occhio; questa è la registrazione integrale, dove
  // non si perde nemmeno una ripetizione, un recupero o un orario. Serve quando
  // il riassunto non basta: cedimenti a metà esercizio, recuperi saltati,
  // carichi cambiati in corsa.
  const righeDettaglio = [];
  let ordine = 0;
  for (const [esId, righeSerie] of perEsercizio) {
    ordine++;
    const def = esercizio(esId);
    const nome = def?.nome || esId;
    const log = questionari.find((q) => q.esercizioId === esId);
    const v = (previsti || []).find((x) => x.esercizioId === esId);
    const unita = unitaCarico(def);
    if (!righeSerie.length) {
      righeDettaglio.push([
        `${ordine}. ${nome}`,
        "—",
        "—",
        "—",
        "—",
        "—",
        log?.saltato ? `non eseguito (${inParole(log.saltato.motivo, MOTIVI_ESERCIZIO)})` : "mai iniziato",
      ]);
      continue;
    }
    righeSerie.forEach((x, i) => {
      const aTempo = Boolean(x.aTempo);
      const chiesto = [
        x.ripTarget != null ? `${x.ripTarget}${aTempo ? "s" : " rip"}` : null,
        x.caricoTarget != null ? `${num(x.caricoTarget)} kg` : null,
      ]
        .filter(Boolean)
        .join(" @ ");
      righeDettaglio.push([
        i === 0 ? `${ordine}. ${nome}` : "",
        `s${x.numero ?? i + 1}`,
        x.carico != null ? `${num(x.carico)} kg${unita ? ` ${unita}` : ""}` : "corpo libero",
        `${x.ripFatte ?? "—"}${aTempo ? "s" : ""}`,
        chiesto || "—",
        i === 0
          ? "—"
          : x.recuperoRealeSec != null
            ? `${mmss(x.recuperoRealeSec)}${x.recuperoTargetSec ? ` / ${mmss(x.recuperoTargetSec)}` : ""}`
            : "non misurato",
        x.tsFineSerie ? oraDi(x.tsFineSerie) : "—",
      ]);
    });
    // Quello che chiude l'esercizio: risposte, dolore, nota. Sta sotto le sue
    // serie, non in fondo alla seduta, perché è di quell'esercizio che parla.
    const coda = [];
    if (log?.rpe != null) coda.push(`RPE ${log.rpe}`);
    if (log?.tecnica != null) coda.push(`tecnica ${log.tecnica}/10`);
    if (v) {
      coda.push(
        `brief ${v.serie}×${v.aTempo ? `${v.durataSec}s` : `${v.ripMin}-${v.ripMax}`}${v.carico != null ? ` @ ${num(v.carico)} kg` : ""}`
      );
    }
    for (const d of doloriDi(log)) {
      coda.push(`DOLORE ${d.nome.toUpperCase()} ${d.intensita || "intensità non detta"} ${d.quando || ""}`.trim());
    }
    if (log?.saltato) {
      coda.push(
        `INTERROTTO: ${inParole(log.saltato.motivo, MOTIVI_ESERCIZIO)}${log.saltato.nota ? ` — ${String(log.saltato.nota).replace(/\s*\n+\s*/g, " · ")}` : ""}`
      );
    }
    if (log?.nota) coda.push(`nota: ${String(log.nota).replace(/\s*\n+\s*/g, " · ")}`);
    if (coda.length) righeDettaglio.push(["", "", "", "", "", "", coda.join(" · ")]);
  }

  return [
    `SEDUTA — ${dataBreve(seduta.data)} — Giorno: ${seduta.tipoNome}`,
    "",
    tabella(["Esercizio", "Carico", "Serie x Rip", "RPE", "Tecnica", "Nota"], righe),
    "",
    riga(
      "Recuperi reali (cronometrati dall'app)",
      recuperi.length
        ? `media ${mmss(recuperi.reduce((a, b) => a + b, 0) / recuperi.length)}, da ${mmss(Math.min(...recuperi))} a ${mmss(Math.max(...recuperi))}` +
          (senzaRiposoPrevisto
            ? ` — fuori dal conto ${senzaRiposoPrevisto} ${senzaRiposoPrevisto === 1 ? "serie fatta" : "serie fatte"} in blocco, senza riposo previsto`
            : "")
        : null
    ),
    riga("Recuperi per esercizio", recuperiPerEsercizio.join(" · ") || null),
    riga(
      "Obiettivi chiesti dall'app diversi dal brief",
      chiestiDiversi.length ? `${chiestiDiversi.join(" · ")} — vengono da proposte accettate` : null
    ),
    // Il motivo per cui il cardio non è stato fatto è un dato clinico, non un
    // dettaglio: veniva registrato nell'app e poi non arrivava al coach.
    // L'etichetta cambia con il caso: «Velocità impostata sul tapis: cardio non
    // eseguito» era una frase che non voleva dire niente.
    (() => {
      if (!seduta.cardio?.eseguito && !seduta.cardio?.previsto) return null;
      // La nota che hai scritto sul cardio è un dato come gli altri: restava
      // nell'app e non arrivava mai al coach.
      const nota = seduta.cardio.note
        ? ` — ${String(seduta.cardio.note).replace(/\s*\n+\s*/g, " · ")}`
        : "";
      if (seduta.cardio.eseguito) {
        return riga(
          "Velocità impostata sul tapis",
          `${num(seduta.cardio.kmh)} km/h per ${seduta.cardio.durataMin} min${nota}`
        );
      }
      const motivo = inParole(seduta.cardio.saltatoMotivo, MOTIVI_CARDIO);
      return riga("Cardio", `non eseguito${motivo ? ` (${motivo})` : ""}${nota}`);
    })(),
    riga("Durata allenamento", durata ? durataUmana(durata) : null),
    // La densità si misura sul tempo di lavoro, non sul tempo passato: con una
    // seduta ripresa il giorno dopo veniva «0,01 serie/min».
    // E si misura sui PESI: contando dentro anche i trenta minuti di cardio, i
    // giorni con cardio risultavano sempre meno densi degli altri e i due
    // numeri non erano confrontabili fra loro.
    riga(
      "Densità sui pesi",
      (() => {
        const gesti = serie
          .map((x) => ({ da: x.tsInizioSerie || x.tsFineSerie, a: x.tsFineSerie }))
          .filter((x) => x.da && x.a);
        const inizio = Math.min(...gesti.map((x) => x.da));
        const fine = Math.max(...gesti.map((x) => x.a));
        const secondi = gesti.length > 1 ? Math.round((fine - inizio) / 1000) : null;
        const netto = secondi || seduta.durataLavoroSec || durata;
        return netto
          ? `${(serie.length / (netto / 60)).toFixed(2).replace(".", ",")} serie/min` +
              (secondi ? ` (dalla prima all'ultima serie, ${durataUmana(secondi)})` : "")
          : null;
      })()
    ),
    // Il punteggio che l'app si è data, con il motivo se è stato tenuto fermo da
    // un tetto: senza, il coach vede i pezzi e non la lettura che ne fa l'app.
    riga(
      "Punteggio dell'app",
      completezza?.totale != null
        ? `${completezza.totale}/100` +
          (completezza.limite ? ` — fermo a ${completezza.limite.tetto}: ${completezza.limite.perche}` : "") +
          (completezza.voci?.length
            ? ` (${completezza.voci
                .filter((v) => v.quota != null)
                .map((v) => `${v.nome.toLowerCase()} ${Math.round(v.quota * 100)}%`)
                .join(", ")})`
            : "")
        : null
    ),
    // Ad allenamento chiuso «non registrato» è una scusa: o l'hai fatto o l'hai
    // saltato, e il coach deve leggere quale delle due.
    riga(
      "Riscaldamento",
      // Anche «con tapis» va scritto: prima si dichiarava solo il caso senza, e
      // un «fatto» secco non diceva se il riscaldamento cardiovascolare c'era
      // stato o no.
      seduta.riscaldamento?.fatto
        ? [
            // La regola è la stessa che usa la schermata del riscaldamento:
            // tutto ciò che non è «senzaTapis» vuol dire con il tapis. Qui si
            // cercava la parola «conTapis», che l'app non ha mai scritto: un
            // riscaldamento col tapis arrivava al coach come un «fatto» secco,
            // cioè senza l'informazione che questa riga esiste per dare.
            seduta.riscaldamento.modalita === "senzaTapis" ? "fatto, senza tapis" : "fatto, con tapis",
            seduta.riscaldamento.note
              ? String(seduta.riscaldamento.note).replace(/\s*\n+\s*/g, " · ")
              : null,
          ]
            .filter(Boolean)
            .join(" — ")
        : seduta.oraFine
          ? "saltato"
          : "non registrato"
    ),
    // Lo stretching pesa nel punteggio quanto il riscaldamento: ometterlo dal
    // log lasciava il coach senza metà di quella voce.
    riga("Stretching finale", seduta.stretching ? (seduta.stretching.fatto ? "fatto" : "saltato") : "non registrato"),
    riga("Mobilità", seduta.mobilita ? (seduta.mobilita.fatto ? "fatta" : "saltata") : null),
    // Letti sull'orologio a fine allenamento: i Comandi Rapidi non sanno
    // leggere gli allenamenti dell'Apple Watch, quindi questi numeri li scrive
    // l'atleta a mano — e sono quelli esatti della seduta, non di una finestra.
    //
    // L'etichetta dice da dove vengono, per esteso. Erano due righe che
    // dicevano «Dall'orologio», e chi legge il pacchetto non aveva modo di
    // sapere che sono misure dell'Apple Watch trascritte dall'atleta e non
    // numeri calcolati dall'app: la stessa durata poteva sembrare una stima.
    ...(() => {
      const pesi = descriviOrologio(seduta.orologio?.pesi || seduta.orologio, "pesi");
      const cardio = descriviOrologio(seduta.orologio?.cardio, "cardio");
      if (!pesi && !cardio) return [];
      return [
        "",
        "LETTI DALL'APPLE WATCH (trascritti dall'atleta a fine seduta)",
        riga("Pesi", pesi),
        riga("Cardio", cardio),
        "Sono le misure dell'orologio per questa seduta, non stime dell'app: i Comandi Rapidi non sanno leggere gli allenamenti dell'Apple Watch, quindi li scrive l'atleta leggendoli dal quadrante.",
        "",
      ];
    })(),
    riga("Nota generale", seduta.notaGenerale),
    giornoSplit && seduta.tipoProgrammatoId && seduta.tipoProgrammatoId !== seduta.tipoId
      ? `Nota: in programma era ${giornoSplit(seduta.tipoProgrammatoId)?.nome || seduta.tipoProgrammatoId}`
      : null,
    righeDettaglio.length ? "" : null,
    righeDettaglio.length ? "DETTAGLIO SERIE PER SERIE" : null,
    righeDettaglio.length
      ? tabella(
          ["Esercizio", "Serie", "Carico", "Fatte", "Chiesto", "Recupero prima", "Ora"],
          righeDettaglio
        )
      : null,
    righeDettaglio.length
      ? "«Recupero prima» è il tempo cronometrato fra la fine della serie precedente e l'inizio di questa, con accanto quello previsto. «Chiesto» è quello che l'app ha domandato in quel momento, proposte accettate comprese."
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Dati di salute recenti e stato delle finestre. */
const ore = (min) => (min == null ? "—" : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`);

/**
 * Le tabelle rispettano alla lettera §9-bis e §9-ter del master brief: stesse
 * colonne, stesso ordine, stesse etichette. Non è pignoleria — è il formato
 * che il coach legge, e riformattarlo costringe a rileggere invece che a
 * confrontare.
 */
export function bloccoSalute({ giorni, notti, finestraMovimento, finestraSonno, obiettivo, tipoGiorno, quantiGiorni = 21 }) {
  // Quante righe: tutta la finestra, non una settimana.
  //
  // Erano sette, e la finestra ne dichiara ventuno: il coach leggeva
  // «11/21 notti» sopra una tabella che gliene mostrava sette, quindi le altre
  // quattordici non poteva controllarle. Quando il conteggio è sceso da un
  // pacchetto all'altro ha verificato «riga per riga» e ha trovato tutto
  // identico — perché le notti sparite erano fuori dalle sette visibili. Una
  // tabella che non copre quello che il numero sopra dichiara è una tabella
  // che nasconde proprio l'errore che si sta cercando.
  const righeG = giorni.slice(0, quantiGiorni).map((g) => {
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
      // La giornata in corso è a metà: senza dirlo, il coach legge «34% dell'
      // obiettivo» e pensa a una giornata fiacca invece che a una non finita.
      g.data === isoDate() ? "giornata in corso, non finita" : "",
    ];
  });

  const righeN = notti.slice(0, quantiGiorni).map((n) =>
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
 * Le attività fuori scheda: corse, camminate, bici, nuoto.
 *
 * È un log a sé, non una parte del programma: nessun giorno le prevede e non
 * farle non toglie niente. Ma farle conta, e il coach le deve poter confrontare
 * voce per voce nel tempo — per questo è una tabella con colonne fisse e non
 * una riga di prosa.
 *
 * Il talk-test è la sola risposta soggettiva: dice a che intensità si stava
 * andando senza bisogno di una fascia cardio. Dove manca resta «non
 * registrato», come ogni altro campo vuoto — mai zero.
 */
export function bloccoExtra(righe, { talkTest = [], oggi = isoDate() } = {}) {
  if (!righe?.length) return null;
  const parola = (id) => talkTest.find((t) => t.id === id)?.testo?.toLowerCase() || "—";
  const tab = righe.slice(0, 30).map((x) => [
    dataBreve(x.data),
    GIORNI_ABBR[new Date(x.data + "T00:00:00").getDay()],
    x.tipo || "—",
    x.durataMin != null ? durataUmana(x.durataMin * 60) : "—",
    x.km != null ? num(x.km, 2) : "—",
    x.ritmo || "—",
    x.fcMedia != null ? num(x.fcMedia, 0) : "—",
    x.fcMax != null ? num(x.fcMax, 0) : "—",
    x.kcalAttive != null ? num(x.kcalAttive, 0) : "—",
    x.kcalTotali != null ? num(x.kcalTotali, 0) : "—",
    parola(x.talkTest),
    [x.data === oggi ? "giornata in corso, non finita" : null, x.nota].filter(Boolean).join(" · "),
  ]);
  return [
    "EXTRA — ATTIVITÀ FUORI SCHEDA",
    "",
    tabella(
      ["Data", "G", "Tipo", "Durata", "km", "Ritmo", "FC media", "FC max", "Kcal att.", "Kcal tot.", "Talk-test", "Note"],
      tab
    ),
    "",
    "Non sono esercizi tracciati: niente carico, niente tecnica, niente RPE. Nessun giorno le prevede, quindi non farle non toglie niente al punteggio.",
    "Una giornata con un'attività qui vale come giornata di allenamento nel punteggio Salute, ma solo se il talk-test è stato risposto: senza resta fuori dal conto invece di valere zero.",
    "Talk-test: «frasi intere comode» zona bassa · «frasi intere con fiatone» zona media · «a fatica» zona alta.",
  ].join("\n");
}

/**
 * Gli allenamenti letti dall'Apple Watch, come sono.
 *
 * L'app li importa da Salute e li mostra, ma nel pacchetto per il coach non
 * entravano: una camminata di 79 minuti a FC 87, o la pausa vera fra i pesi e
 * il cardio, restavano dentro il telefono. Il coach vedeva l'allenamento
 * registrato a mano e non il resto della giornata, e quello che l'atleta
 * scriveva nell'app non arrivava a destinazione — che è il modo più sicuro di
 * far nascere confusione su chi ha letto cosa.
 *
 * L'intestazione dice a chiare lettere da dove vengono: sono misure
 * dell'orologio, non stime dell'app né numeri scritti a mano.
 */
export function bloccoWatch(allenamenti, { giorni = 7, nomeSeduta = null } = {}) {
  // Questa tabella esiste solo se il pacchetto di Salute porta righe
  // ALLENAMENTO. Molti Comandi Rapidi non le mandano — l'Apple Watch non
  // espone i suoi allenamenti a Comandi — e in quel caso i numeri
  // dell'orologio arrivano lo stesso, ma dal riquadro «Letti dall'Apple Watch»
  // dentro il log della seduta, che l'atleta compila leggendo il quadrante.
  if (!allenamenti?.length) return null;
  const righe = allenamenti.slice(0, 20).map((a) => [
    dataBreve(a.data),
    GIORNI_ABBR[new Date(a.data + "T00:00:00").getDay()],
    a.inizio || "—",
    a.tipo || "—",
    a.durataSec ? durataUmana(a.durataSec) : "—",
    a.kcalAttive != null ? num(a.kcalAttive, 0) : "—",
    a.kcalTotali != null ? num(a.kcalTotali, 0) : "—",
    a.fcMedia != null ? num(a.fcMedia, 0) : "—",
    a.fcMax != null ? num(a.fcMax, 0) : "—",
    // Collegato a una seduta registrata o no: è la differenza fra «questo è
    // l'allenamento che trovi nel log» e «questo è movimento in più».
    a.sedutaId ? (nomeSeduta?.(a.sedutaId) || "sì") : "—",
  ]);
  return [
    `ALLENAMENTI LETTI DALL'APPLE WATCH (ultimi ${giorni} giorni)`,
    "",
    tabella(
      ["Data", "G", "Ora", "Tipo", "Durata", "Kcal att.", "Kcal tot.", "FC media", "FC max", "Nel log"],
      righe
    ),
    "",
    "Sono i dati misurati dall'orologio e importati da Salute, non stime dell'app.",
    "«Nel log» dice se quell'allenamento corrisponde a una seduta registrata nell'app: dove c'è un trattino è movimento che sta fuori dal programma (camminate, attività della giornata).",
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

/**
 * L'acqua, per i profili che la contano. È l'altra metà del fumo: una
 * abitudine dichiarata nel brief, chiesta ogni giorno e pesata nel punteggio
 * di giornata. Senza questo blocco il coach vedeva un punteggio che l'acqua la
 * conta e un pacchetto che non la nominava mai.
 *
 * Un giorno senza risposta non è un «no»: resta scritto che non c'è, come
 * ovunque nell'app.
 */
export function bloccoAcqua({ perGiorno, litri }) {
  if (!perGiorno?.length) return null;
  const risposti = perGiorno.filter((g) => g.bevuto !== null);
  if (!risposti.length) return null;
  const si = risposti.filter((g) => g.bevuto).length;
  return [
    "ACQUA",
    "",
    tabella(
      ["Data", "Giorno", `Almeno ${num(litri)} litri`],
      perGiorno.map((g) => [
        dataBreve(g.data),
        GIORNI_ABBR[new Date(g.data + "T00:00:00").getDay()],
        g.bevuto === null ? "non risposto" : g.bevuto ? "sì" : "no",
      ])
    ),
    "",
    `${si} ${si === 1 ? "giorno" : "giorni"} su ${risposti.length} ${risposti.length === 1 ? "risposto" : "risposti"} con almeno ${num(litri)} litri` +
      (risposti.length < perGiorno.length
        ? ` (${perGiorno.length - risposti.length} ${perGiorno.length - risposti.length === 1 ? "giorno senza risposta" : "giorni senza risposta"}, fuori dal conto).`
        : "."),
    "La risposta è binaria e manuale: vale quello che è stato segnato, i bicchieri non si contano.",
  ].join("\n");
}

/**
 * Il fumo. È un dato clinico che cambia la lettura di tutto il resto — sonno,
 * recupero, frequenza a riposo — e tenerlo dentro l'app significherebbe far
 * commentare al coach dei numeri senza sapere una delle cause.
 */
export function bloccoFumo({ perGiorno, tollerate, primoGiorno }) {
  if (!primoGiorno || !perGiorno.length) return null;
  const valori = perGiorno.map((g) => g.quante);
  const media = valori.reduce((a, b) => a + b, 0) / valori.length;
  const zero = valori.filter((v) => v === 0).length;
  // Ogni giorno va giudicato con la soglia che aveva LUI: quella scende nel
  // tempo, e usare quella di oggi farebbe risultare «oltre» giornate che
  // quando sono state vissute erano dentro il limite.
  const sogliaDi = (g) => g.tollerate ?? tollerate;
  const oltre = perGiorno.filter((g) => g.quante > sogliaDi(g));
  return [
    "FUMO",
    "",
    tabella(
      ["Data", "Giorno", "Sigarette", "Soglia", "Note"],
      perGiorno.map((g) => [
        dataBreve(g.data),
        GIORNI_ABBR[new Date(g.data + "T00:00:00").getDay()],
        String(g.quante),
        String(sogliaDi(g)),
        g.quante > sogliaDi(g)
          ? `${g.quante - sogliaDi(g)} oltre la soglia`
          : g.quante === 0
            ? "nessuna"
            : g.quante < sogliaDi(g)
              ? "nuovo minimo"
              : "",
      ])
    ),
    "",
    `Media ${num(media, 1)} al giorno su ${perGiorno.length} ${perGiorno.length === 1 ? "giorno" : "giorni"} contati (dal ${dataBreve(primoGiorno)}).`,
    `Giorni a zero: ${zero} su ${perGiorno.length}. Soglia tollerata oggi: ${tollerate} al giorno${oltre.length ? `, superata ${oltre.length} ${oltre.length === 1 ? "volta" : "volte"}` : ""}.`,
    `La soglia parte da quella concordata e scende da sé: ogni giornata chiusa sotto il limite diventa il limite dal giorno dopo, e non risale più.`,
    "Il conteggio è manuale: vale quello che è stato segnato, non c'è modo di verificarlo.",
  ].join("\n");
}

/**
 * I segnali aperti: quello che l'app ha notato e che non è una proposta.
 * Restavano dentro l'app, cioè invisibili proprio a chi deve decidere.
 */
export function bloccoSegnali(segnali) {
  if (!segnali.length) return null;
  const ordine = { attenzione: 0, info: 1 };
  const ordinati = [...segnali].sort(
    (a, b) => (ordine[a.gravita] ?? 2) - (ordine[b.gravita] ?? 2)
  );
  return [
    "SEGNALI APERTI",
    "",
    ...ordinati.map((s, i) =>
      [
        `${i + 1}. ${s.messaggio}${s.gravita === "attenzione" ? " [attenzione]" : ""}`,
        s.dettaglio ? `   ${s.dettaglio}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    ),
    "",
    "Osservazioni, non proposte: nessuna di queste tocca il programma.",
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
  // Con l'archivio ancora vuoto l'elenco diceva «Contenuto: 0 proposte.», che
  // sembra un guasto invece di quello che è: non c'è ancora niente da mandare.
  // Le voci a zero non si elencano: «0 proposte» è rumore, non contenuto.
  const utili = cosa.filter((c) => !/^0\b/.test(c));
  return [
    `COACH — pacchetto del ${dataLunga(isoDate())}`,
    utili.length ? `Contenuto: ${utili.join(", ")}.` : "Contenuto: ancora niente da mandare.",
    "Generato dall'app: i numeri non sono trascritti a mano.",
  ].join("\n");
}
