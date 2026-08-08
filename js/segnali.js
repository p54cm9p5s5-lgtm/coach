/* Motore deterministico di segnali e proposte di progressione.

   Funzioni pure: ricevono i dati già letti e non toccano il database.
   La persistenza sta in store.js, la presentazione in screens/proposte.js.

   Regola non negoziabile (SPEC §4.6): propone, non applica mai. Ogni uscita è
   una proposta con le quattro domande già compilate, oppure un segnale. */

import { carichoPiuVicino, manubrioPiuVicino, aPaio, conosceManubri } from "./plates.js";
import { dataBreve, giorniTra, parseIso, isoDate, num } from "./ui.js";
import { doloriDi } from "./punteggio.js";

/**
 * I motivi di un salto sono salvati con una parola sola: comoda per il codice,
 * oscura per chi legge. Il segnale finisce nel pacchetto del coach, e «attrezzo»
 * lì dentro non vuol dire niente.
 */
const MOTIVI_SALTO = {
  tempo: "tempo finito",
  dolore: "dolore",
  attrezzo: "attrezzo non disponibile",
  altro: "altro",
};

/** Gerarchia delle modifiche, ordine fisso del master brief §7. */
export const GERARCHIA = [
  "Correzione della tecnica",
  "Miglioramento della stabilità",
  "Aumento delle ripetizioni",
  "Aumento del carico",
  "Aumento del volume",
  "Riduzione dei recuperi",
  "Modifica degli esercizi",
  "Modifica dello split",
];

export const nomeLivello = (n) => GERARCHIA[n - 1] || `Livello ${n}`;

const arrotonda = (n) => Math.round(n * 100) / 100;

export function piuGiorni(iso, giorni) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + giorni);
  return isoDate(d);
}

// ---------- lettura di una esposizione ----------

/**
 * Ripetizioni effettive di una esposizione: la serie peggiore, non la media.
 * Se una serie sola è rimasta indietro, l'esercizio non è stato completato.
 * null quando anche un solo dato manca: un buco non vale zero.
 */
export function ripetizioniEffettive(esp) {
  if (!esp.serie?.length) return null;
  let minimo = Infinity;
  for (const s of esp.serie) {
    if (s.ripFatte == null) return null;
    minimo = Math.min(minimo, s.ripFatte);
  }
  return minimo;
}

/** Un'esposizione è valutabile solo se ha tutti i dati che le regole usano. */
export function datiCompleti(esp) {
  if (!esp || esp.saltato) return false;
  if (esp.rpe == null || esp.tecnica == null) return false;
  return ripetizioniEffettive(esp) != null;
}

function incrementaCarico(carico, def, inventario) {
  if (carico == null) return null;
  const attrezzo = (def?.attrezzo || "").toLowerCase();
  if (attrezzo === "bilanciere") return carichoPiuVicino(carico, 1, inventario);
  // I manubri regolabili hanno anche loro un passo minimo reale: proporre
  // «+1 kg» dove il disco più piccolo ne aggiunge due è proporre un carico
  // che poi non si riesce a montare.
  if (attrezzo.includes("manubri") && conosceManubri(inventario, aPaio(def))) {
    return manubrioPiuVicino(carico, 1, inventario, aPaio(def));
  }
  return arrotonda(carico + 1);
}

function riduciCarico(carico, def, inventario) {
  if (carico == null) return null;
  const bersaglio = carico * 0.9; // scarico del 10%: serve a rifare il gesto, non ad allenare
  const attrezzo = (def?.attrezzo || "").toLowerCase();
  if (attrezzo === "bilanciere") return carichoPiuVicino(bersaglio, -1, inventario);
  if (attrezzo.includes("manubri") && conosceManubri(inventario, aPaio(def))) {
    return manubrioPiuVicino(bersaglio, -1, inventario, aPaio(def));
  }
  return Math.max(0, arrotonda(carico - Math.max(1, Math.round(carico * 0.1))));
}

const descriviEsposizione = (e) => {
  const rip = ripetizioniEffettive(e);
  return (
    `${dataBreve(e.data)}: ${e.serie.length} serie` +
    `${rip != null ? ` da ${rip}` : " (ripetizioni non registrate)"}` +
    `${e.caricoLavoro != null ? ` a ${num(e.caricoLavoro)} kg` : ""}` +
    `${e.rpe != null ? `, RPE ${e.rpe}` : ""}` +
    `${e.tecnica != null ? `, tecnica ${num(e.tecnica)}` : ""}`
  );
};

// ---------- proposte di progressione ----------

/**
 * Valuta un esercizio e restituisce { proposta, motivo }.
 * `proposta` è null quando non c'è niente da proporre: `motivo` dice perché,
 * ed è quello che l'app mostra invece di tacere.
 *
 * Doppia progressione: si sale di ripetizioni dentro il range (livello 3) e
 * solo al tetto si sale di carico tornando al fondo del range (livello 4).
 */
export function valutaProgressione({ variante, def, esposizioni, regole, inventario, oggi = isoDate() }) {
  const R = regole.progressione;
  const niente = (motivo) => ({ proposta: null, motivo });
  const nome = def?.nome || variante.esercizioId;

  if (variante.aTempo) {
    return niente("Esercizio a tempo: la progressione resta una valutazione a mano.");
  }

  // Un esercizio saltato non è un'esposizione: non porta dati e non deve
  // contare nel minimo richiesto.
  const svolte = esposizioni.filter((e) => !e.saltato && e.serie?.length);
  const recenti = svolte.slice(0, R.esposizioniMinime);

  // Livello 1 — la tecnica viene prima di tutto e basta una sola osservazione
  // (master brief §7: i livelli 1-2 si correggono anche con un solo dato).
  // Va valutata PRIMA del minimo di esposizioni, altrimenti un cedimento
  // tecnico grave resterebbe muto proprio quando conta di più.
  // Per il livello 1 basta che la tecnica sia stata dichiarata: un conteggio di
  // ripetizioni mancante altrove non deve zittire un cedimento tecnico.
  const piuRecente = svolte.find((e) => !e.saltato && e.tecnica != null);
  if (piuRecente && piuRecente.tecnica < R.tecnicaRiduzione) {
    const ultima = piuRecente;
    const carico = ultima.caricoLavoro;
    const rip = ripetizioniEffettive(ultima);
    const prove = descriviEsposizione(ultima);

    // Se il carico eseguito ha superato quello previsto dal programma, la
    // risposta non è una modifica ma un rientro: il master brief (§6) tratta il
    // ritorno alla baseline come compliance, non come progressione.
    if (variante.carico != null && carico != null && carico > variante.carico) {
      return {
        proposta: {
          esercizioId: variante.esercizioId,
          tipo: "rientroInProgramma",
          livelloGerarchia: 1,
          titolo: `${nome}: torna al carico previsto, ${num(variante.carico)} kg`,
          da: { carico, rip },
          a: { carico: variante.carico, rip: variante.ripMin },
          quattroDomande: {
            perche: `Tecnica ${num(ultima.tecnica)}/10 a ${num(carico)} kg, sopra i ${num(variante.carico)} kg che il programma prevede. Il carico ha superato la capacità di controllo.`,
            quali: prove,
            alternative: `Non è una modifica al programma: è tornare a eseguirlo. Ridurre di una percentuale arbitraria inventerebbe un carico che nessuno ha deciso; il valore previsto esiste già.`,
            atteso: `A ${num(variante.carico)} kg la tecnica torna sopra ${R.tecnicaMinima}. Da lì la progressione riparte secondo la gerarchia, un gradino alla volta.`,
          },
          dataVerifica: piuGiorni(oggi, 14),
        },
        motivo: null,
      };
    }

    const nuovo = riduciCarico(carico, def, inventario);
    if (nuovo == null || nuovo >= carico) {
      return niente(`Tecnica ${ultima.tecnica}: da rivedere, ma non c'è carico da togliere.`);
    }
    return {
      proposta: {
        esercizioId: variante.esercizioId,
        tipo: "riduzioneCarico",
        livelloGerarchia: 1,
        titolo: `${nome}: scarica e rifai il gesto`,
        da: { carico, rip },
        a: { carico: nuovo, rip: variante.ripMin },
        quattroDomande: {
          perche: `Tecnica dichiarata ${ultima.tecnica}/10 sull'ultima esposizione. Sotto ${R.tecnicaRiduzione} il gesto non è ripetibile: continuare a caricarlo consolida l'errore.`,
          quali: prove,
          alternative: `La gerarchia mette la tecnica al livello 1, prima di ripetizioni e carico. Aggiungere serie o ripetizioni su un gesto sbagliato peggiora il problema; fermare del tutto l'esercizio toglie l'occasione di correggerlo.`,
          atteso: `Con ${num(nuovo)} kg la tecnica torna sopra 8 entro due esposizioni. Se ci riesce, si risale di carico; se non ci riesce, l'esercizio va sostituito (livello 7).`,
        },
        dataVerifica: piuGiorni(oggi, 14),
      },
      motivo: null,
    };
  }

  // Da qui in giù si valuta la salita: serve il minimo di esposizioni svolte,
  // tutte con i dati completi.
  if (recenti.length < R.esposizioniMinime) {
    return niente(
      `${recenti.length} ${recenti.length === 1 ? "esposizione svolta" : "esposizioni svolte"} su ${R.esposizioniMinime}: troppo poco per proporre.`
    );
  }
  if (!recenti.every(datiCompleti)) {
    return niente("Dati mancanti in una delle ultime esposizioni: nessuna proposta.");
  }

  const ultima = recenti[0];
  const carico = ultima.caricoLavoro;
  const rip = ripetizioniEffettive(ultima);
  const prove = recenti.map(descriviEsposizione).join(" · ");

  const rpePeggiore = Math.max(...recenti.map((e) => e.rpe));
  const tecnicaPeggiore = Math.min(...recenti.map((e) => e.tecnica));
  const ripPeggiori = Math.min(...recenti.map(ripetizioniEffettive));
  const conDolore = recenti.filter((e) => doloriDi(e.log).length);

  if (ripPeggiori < variante.ripMin) {
    return niente(
      `Ripetizioni sotto il fondo del range (${ripPeggiori} contro ${variante.ripMin}): si resta su questo carico.`
    );
  }
  if (rpePeggiore >= 9) {
    return niente(`RPE ${rpePeggiore}: già al limite, nessuna modifica.`);
  }
  if (conDolore.length) {
    const dove = [...new Set(conDolore.flatMap((e) => doloriDi(e.log).map((d) => d.nome)))].join(", ");
    return niente(`Dolore registrato (${dove}): nessuna progressione finché il segnale non sparisce.`);
  }
  if (rpePeggiore > R.rpePerSalire) {
    return niente(`RPE ${rpePeggiore}: zona corretta ${regole.rpeTarget.min}-${regole.rpeTarget.max}, nessuna modifica.`);
  }
  if (tecnicaPeggiore < R.tecnicaMinima) {
    return niente(`Tecnica ${tecnicaPeggiore}: sopra la soglia di allarme ma sotto ${R.tecnicaMinima}, prima si consolida.`);
  }

  // Sotto il tetto del range: si sale di ripetizioni (livello 3).
  if (rip < variante.ripMax) {
    const nuovaRip = Math.min(rip + 1, variante.ripMax);
    return {
      proposta: {
        esercizioId: variante.esercizioId,
        tipo: "ripetizioni",
        livelloGerarchia: 3,
        titolo: `${nome}: ${rip} → ${nuovaRip} ripetizioni`,
        da: { carico, rip },
        a: { carico, rip: nuovaRip },
        quattroDomande: {
          perche: `${R.esposizioniMinime} esposizioni consecutive a RPE ≤ ${R.rpePerSalire} con tecnica ≥ ${R.tecnicaMinima} e nessun dolore: il carico attuale non è più uno stimolo sufficiente.`,
          quali: prove,
          alternative: `Il range arriva a ${variante.ripMax} e siamo a ${rip}: la gerarchia impone di esaurire le ripetizioni (livello 3) prima di toccare il carico (livello 4). Salire subito di carico salterebbe un livello senza motivo tecnico.`,
          atteso: `${nuovaRip} ripetizioni su tutte e ${variante.serie} le serie a ${carico != null ? num(carico) + " kg" : "carico invariato"}, con RPE che risale verso ${regole.rpeTarget.min}-${regole.rpeTarget.max}.`,
        },
        dataVerifica: piuGiorni(oggi, 14),
      },
      motivo: null,
    };
  }

  // Al tetto del range: si sale di carico (livello 4) e si torna al fondo.
  if (def?.attrezzo === "corpo libero" || carico == null) {
    return niente(
      `Al tetto del range (${variante.ripMax}) a corpo libero: senza carico da aggiungere serve una variante più difficile, che è una scelta da fare in conversazione (livello 7).`
    );
  }

  const nuovoCarico = incrementaCarico(carico, def, inventario);
  if (nuovoCarico == null || nuovoCarico <= carico) {
    return niente("Al tetto del range, ma nessun carico superiore è realizzabile con i dischi disponibili.");
  }
  const passo = arrotonda(nuovoCarico - carico);
  const perCento = num((passo / carico) * 100, 1);

  return {
    proposta: {
      esercizioId: variante.esercizioId,
      tipo: "carico",
      livelloGerarchia: 4,
      titolo: `${nome}: ${num(carico)} → ${num(nuovoCarico)} kg`,
      da: { carico, rip },
      a: { carico: nuovoCarico, rip: variante.ripMin },
      quattroDomande: {
        perche: `Tetto del range raggiunto: ${rip} ripetizioni su tutte le serie, RPE ≤ ${R.rpePerSalire} e tecnica ≥ ${R.tecnicaMinima} per ${R.esposizioniMinime} esposizioni.`,
        quali: prove,
        alternative: `Le ripetizioni sono esaurite (livello 3 chiuso), quindi tocca al carico (livello 4). Aggiungere serie sarebbe livello 5, cioè saltare un livello. L'incremento è +${num(passo)} kg (+${perCento}%), il più piccolo componibile con i dischi: non il salto da 4 kg che si otterrebbe aggiungendo dischi senza ricomporre.`,
        atteso: `Ritorno a ${variante.ripMin} ripetizioni a ${num(nuovoCarico)} kg con RPE ${regole.rpeTarget.min}-${regole.rpeTarget.max}, poi di nuovo su fino a ${variante.ripMax}.`,
      },
      dataVerifica: piuGiorni(oggi, 14),
    },
    motivo: null,
  };
}

/** Impronta stabile di una proposta: due proposte identiche non si ripetono. */
export function firmaProposta(p) {
  const v = (x) => (x == null ? "-" : String(x));
  return [p.esercizioId, p.tipo, v(p.da.carico), v(p.da.rip), v(p.a.carico), v(p.a.rip)].join("|");
}

// ---------- segnali ----------

/** Medie settimanali a partire dal primo giorno registrato, non da oggi. */
function settimaneDi(righe, campo) {
  const validi = righe
    .filter((r) => r.presente && r[campo] != null)
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  if (!validi.length) return [];

  const inizio = validi[0].data;
  const gruppi = new Map();
  for (const r of validi) {
    const n = Math.floor(giorniTra(inizio, r.data) / 7);
    if (!gruppi.has(n)) gruppi.set(n, []);
    gruppi.get(n).push(r[campo]);
  }
  return [...gruppi.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([n, valori]) => ({
      indice: n,
      da: piuGiorni(inizio, n * 7),
      a: piuGiorni(inizio, n * 7 + 6),
      giorni: valori.length,
      media: valori.reduce((s, v) => s + v, 0) / valori.length,
    }));
}

/**
 * Scostamento sostenuto rispetto alla baseline delle prime 3 settimane
 * (master brief §9 e §9-ter): serve una soglia superata per due settimane
 * consecutive nello stesso verso, non un picco isolato.
 */
function scostamentoSostenuto(righe, campo, { minimoSettimana, soglia }) {
  const sett = settimaneDi(righe, campo).filter((s) => s.giorni >= minimoSettimana);
  if (sett.length < 5) return null;

  const base = sett.slice(0, 3);
  const baseline = base.reduce((s, x) => s + x.media, 0) / base.length;
  if (!baseline) return null;

  const ultime = sett.slice(-2);
  const scarti = ultime.map((s) => (s.media - baseline) / baseline);
  if (!scarti.every((d) => d > soglia) && !scarti.every((d) => d < -soglia)) return null;

  return {
    baseline,
    settimane: ultime,
    scarti,
    verso: scarti[0] > 0 ? "sopra" : "sotto",
    medio: scarti.reduce((s, d) => s + d, 0) / scarti.length,
  };
}

/**
 * Tutti i segnali, ricalcolati da zero a ogni giro.
 * L'id è deterministico: ricalcolare aggiorna il segnale, non lo duplica.
 */
export function calcolaSegnali(ctx) {
  const {
    allenamenti = [],
    logsPerSeduta = new Map(),
    esercizi = new Map(),
    varianti = new Map(),
    esposizioniPerEsercizio = new Map(),
    giorniSalute = [],
    notti = [],
    finestraMovimento = null,
    finestraSonno = null,
    regole,
    oggi = isoDate(),
  } = ctx;

  const out = [];
  const agg = (s) => out.push({ ...s, data: oggi });
  const nome = (id) => esercizi.get(id)?.nome || id;
  const complete = allenamenti.filter((s) => s.stato === "completata");
  const ultime = complete.slice(0, 4);

  // --- cardio fuori protocollo -------------------------------------------
  const cardio = complete.filter((s) => s.cardio?.eseguito && s.cardio.kmh != null).slice(0, 3);
  const fuori = cardio.filter(
    (s) => s.cardio.kmh > regole.cardio.kmhMax || s.cardio.kmh < regole.cardio.kmhMin
  );
  if (fuori.length) {
    agg({
      id: "seg_cardio_protocollo",
      tipo: "cardioFuoriProtocollo",
      gravita: "attenzione",
      messaggio: `Cardio fuori protocollo in ${fuori.length} ${fuori.length === 1 ? "allenamento" : "allenamenti"} su ${cardio.length}.`,
      dettaglio:
        `Target ${num(regole.cardio.kmhMin)}-${num(regole.cardio.kmhMax)} km/h. ` +
        fuori.map((s) => `${dataBreve(s.data)}: ${num(s.cardio.kmh)} km/h`).join(" · ") +
        ". Il cardio in coda all'allenamento serve a restare in zona bassa, non a fare un secondo allenamento.",
      riferimenti: fuori.map((s) => s.id),
    });
  }

  // --- inversione di intensità -------------------------------------------
  // Il cardio di scarico non deve essere più duro dei pesi che dovrebbe seguire.
  for (const s of ultime) {
    if (!s.cardio?.eseguito || s.cardio.kmh == null) continue;
    if (s.cardio.kmh <= regole.cardio.kmhMax) continue;
    const logs = (logsPerSeduta.get(s.id) || []).filter((l) => !l.saltato && l.rpe != null);
    if (logs.length < 2) continue;
    const rpeMedio = logs.reduce((a, l) => a + l.rpe, 0) / logs.length;
    if (rpeMedio >= regole.rpeTarget.min) continue;
    agg({
      id: `seg_inversione_${s.id}`,
      tipo: "inversioneIntensita",
      gravita: "attenzione",
      messaggio: `${dataBreve(s.data)}: il cardio è stato più intenso dei pesi.`,
      dettaglio: `RPE medio sui pesi ${num(rpeMedio)} (target ${regole.rpeTarget.min}-${regole.rpeTarget.max}), cardio a ${num(s.cardio.kmh)} km/h contro un massimo di ${num(regole.cardio.kmhMax)}. L'ordine dello stimolo è invertito: lo sforzo va sui pesi, il cardio è scarico.`,
      riferimenti: [s.id],
    });
  }

  // --- pattern dolore, un segnale per punto -------------------------------
  // Ogni articolazione ha la sua storia: un ginocchio che fa male tre volte e
  // un'anca che fa male una volta sono due cose diverse, e sommarle in un
  // segnale solo nasconderebbe quella che si sta ripetendo.
  const perSito = new Map();
  for (const s of ultime) {
    for (const l of logsPerSeduta.get(s.id) || []) {
      for (const d of doloriDi(l)) {
        if (!perSito.has(d.id)) perSito.set(d.id, { nome: d.nome, sedute: new Map() });
        const v = perSito.get(d.id);
        if (!v.sedute.has(s.id)) v.sedute.set(s.id, new Set());
        v.sedute.get(s.id).add(nome(l.esercizioId));
      }
    }
  }
  for (const [id, v] of perSito) {
    if (v.sedute.size < 2) continue;
    const esercizi_ = new Set([...v.sedute.values()].flatMap((x) => [...x]));
    const dove = v.nome.charAt(0).toUpperCase() + v.nome.slice(1);
    agg({
      id: id === "polso" ? "seg_polso" : `seg_dolore_${id}`,
      tipo: id === "polso" ? "patternPolso" : "patternDolore",
      gravita: "attenzione",
      messaggio: `${dove} dolente in ${v.sedute.size} degli ultimi ${ultime.length} allenamenti.`,
      dettaglio: `Esercizi coinvolti: ${[...esercizi_].join(", ")}. Non è più un episodio isolato: prima di caricare oltre va cambiato qualcosa ${id === "polso" ? "nella presa" : "nell'esecuzione"} o nell'esercizio.`,
      riferimenti: [...v.sedute.keys()],
    });
  }

  // --- finestre dati -------------------------------------------------------
  // Solo il completamento è un segnale: è il momento in cui i dati cambiano
  // statuto. Lo stato di avanzamento si vede già in Oggi e non va ripetuto qui.
  for (const [chiave, fin, etichetta] of [
    ["movimento", finestraMovimento, "Movimento"],
    ["sonno", finestraSonno, "Sonno"],
  ]) {
    if (!fin?.completa) continue;
    agg({
      id: `seg_finestra_${chiave}`,
      tipo: "finestraCompleta",
      gravita: "info",
      messaggio: `Finestra ${etichetta.toLowerCase()} completa: 3 settimane consecutive registrate.`,
      dettaglio:
        "Da adesso il trend aggregato può informare una decisione, sempre passando dalla gerarchia e dalle quattro domande. Fino a ieri era solo raccolta.",
      riferimenti: [],
    });
  }

  // --- soglie ±20% ---------------------------------------------------------
  const sogliaConf = { minimoSettimana: regole.finestra.minimoSettimana, soglia: regole.finestra.soglia };
  const scMov = scostamentoSostenuto(giorniSalute, "kcalAttive", sogliaConf);
  if (scMov) {
    agg({
      id: "seg_soglia_movimento",
      tipo: "sogliaMovimento",
      gravita: "attenzione",
      messaggio: `Movimento ${scMov.verso} baseline del ${num(Math.abs(scMov.medio) * 100)}% da due settimane.`,
      dettaglio: `Baseline delle prime tre settimane ${Math.round(scMov.baseline)} kcal attive al giorno; ultime due settimane ${scMov.settimane.map((s) => Math.round(s.media)).join(" e ")} kcal. Soglia ±${Math.round(regole.finestra.soglia * 100)}% superata in entrambe. La dieta resta di competenza del nutrizionista: qui è un dato d'ingresso.`,
      riferimenti: [],
    });
  }
  const scSonno = scostamentoSostenuto(notti, "durataMin", sogliaConf);
  if (scSonno) {
    agg({
      id: "seg_soglia_sonno",
      tipo: "sogliaSonno",
      gravita: "attenzione",
      messaggio: `Sonno ${scSonno.verso} baseline del ${num(Math.abs(scSonno.medio) * 100)}% da due settimane.`,
      dettaglio: `Baseline ${Math.round(scSonno.baseline)} minuti a notte; ultime due settimane ${scSonno.settimane.map((s) => Math.round(s.media)).join(" e ")} minuti. Se il verso è in calo, il primo livello da toccare è il volume o i recuperi, non il carico.`,
      riferimenti: [],
    });
  }

  // --- taratura RPE --------------------------------------------------------
  let bassoMaFermo = 0;
  let campione = 0;
  for (const [id, esp] of esposizioniPerEsercizio) {
    const v = varianti.get(id);
    if (!v || v.aTempo) continue;
    for (const e of esp.slice(0, 3)) {
      if (!datiCompleti(e)) continue;
      campione++;
      if (e.rpe <= regole.progressione.rpePerSalire && ripetizioniEffettive(e) < v.ripMax) bassoMaFermo++;
    }
  }
  if (campione >= 6 && bassoMaFermo / campione >= 0.5) {
    agg({
      id: "seg_taratura_rpe",
      tipo: "taraturaRpe",
      gravita: "info",
      messaggio: `RPE dichiarato basso ma serie chiuse sotto il tetto del range in ${bassoMaFermo} casi su ${campione}.`,
      dettaglio: `Un RPE ≤ ${regole.progressione.rpePerSalire} dice che restavano ripetizioni in canna: se la serie finisce comunque sotto il tetto, o l'RPE è sottostimato o si sta lasciando lavoro sul tavolo. Da chiarire prima di fidarsi dell'RPE per decidere i carichi.`,
      riferimenti: [],
    });
  }

  // --- buchi di dati -------------------------------------------------------
  const buchi = [];
  for (const s of ultime) {
    const logs = logsPerSeduta.get(s.id) || [];
    const senzaDati = logs.filter((l) => !l.saltato && (l.rpe == null || l.tecnica == null));
    if (!logs.length) buchi.push(`${dataBreve(s.data)}: nessun questionario`);
    else if (senzaDati.length)
      buchi.push(`${dataBreve(s.data)}: ${senzaDati.length} ${senzaDati.length === 1 ? "esercizio" : "esercizi"} senza RPE o tecnica`);
  }
  if (buchi.length) {
    agg({
      id: "seg_buchi_dati",
      tipo: "buchiDati",
      gravita: "info",
      messaggio: `Dati incompleti in ${buchi.length} degli ultimi ${ultime.length} allenamenti.`,
      dettaglio: `${buchi.join(" · ")}. Un'esposizione incompleta blocca ogni proposta su quell'esercizio: non è prudenza, è che la regola non è verificabile.`,
      riferimenti: [],
    });
  }

  // --- tecnica ferma sotto la soglia, al carico giusto ---------------------
  // La gerarchia del brief mette la tecnica prima di tutto, e il punteggio la
  // penalizza. Ma finché il carico è quello programmato non c'è nessun carico
  // «a cui tornare», quindi non nasceva nessuna proposta e il coach non veniva
  // mai avvisato: restava una tecnica da correggere, in silenzio, per sempre.
  for (const [id, esp] of esposizioniPerEsercizio) {
    const v = varianti.get(id);
    if (!v) continue;
    const recenti = esp.slice(0, regole.progressione.esposizioniMinime);
    if (recenti.length < regole.progressione.esposizioniMinime) continue;
    if (!recenti.every(datiCompleti)) continue;
    if (!recenti.every((e) => e.tecnica < regole.progressione.tecnicaMinima)) continue;
    // Un cedimento tecnico grave sopra il carico previsto ha già la sua
    // proposta di rientro: ripeterlo qui sarebbe rumore.
    const caricoUsato = recenti[0].caricoLavoro ?? recenti[0].caricoMax ?? null;
    const sopraProgramma = v.carico != null && caricoUsato != null && caricoUsato > v.carico;
    if (sopraProgramma && recenti[0].tecnica < regole.progressione.tecnicaRiduzione) continue;
    const voti = recenti.map((e) => `${dataBreve(e.data)}: ${num(e.tecnica)}/10`).join(" · ");
    agg({
      id: `seg_tecnica_${id}`,
      tipo: "tecnicaSottoSoglia",
      gravita: "attenzione",
      messaggio: `${nome(id)}: tecnica sotto ${regole.progressione.tecnicaMinima}/10 nelle ultime ${recenti.length} volte.`,
      dettaglio:
        `${voti}. ` +
        (sopraProgramma
          ? `Il carico usato (${num(caricoUsato)} kg) è sopra i ${num(v.carico)} kg previsti dal programma: il primo passo è tornare a quello che c'è scritto, poi si guarda di nuovo la tecnica.`
          : `Il carico è quello previsto dal programma, quindi non c'è niente da ridurre: l'app non inventa un carico che nessuno ha deciso. Serve una correzione dell'esecuzione, un cue diverso o una variante — ed è una scelta del coach.`),
      riferimenti: [],
    });
  }

  // --- ripetizioni sotto il range con RPE al massimo -----------------------
  // Il contrario del tetto: il carico previsto non regge. L'app non abbassa
  // niente di sua iniziativa — non le spetta — ma tacere sarebbe peggio: è
  // esattamente il dato su cui il coach decide.
  for (const [id, esp] of esposizioniPerEsercizio) {
    const v = varianti.get(id);
    if (!v || v.aTempo || v.ripMin == null) continue;
    const recenti = esp.filter((e) => !e.saltato && e.serie?.length).slice(0, regole.progressione.esposizioniMinime);
    if (recenti.length < regole.progressione.esposizioniMinime) continue;
    if (!recenti.every(datiCompleti)) continue;
    if (!recenti.every((e) => ripetizioniEffettive(e) < v.ripMin && e.rpe >= 9)) continue;
    const prove = recenti
      .map((e) => `${dataBreve(e.data)}: ${ripetizioniEffettive(e)} rip a RPE ${num(e.rpe)}`)
      .join(" · ");
    agg({
      id: `seg_sotto_range_${id}`,
      tipo: "sottoRange",
      gravita: "attenzione",
      messaggio: `${nome(id)}: serie chiuse sotto le ${v.ripMin} ripetizioni previste, a RPE massimo.`,
      dettaglio: `${prove}. Il carico previsto non sta reggendo il range del programma. L'app non lo abbassa da sola: un carico ridotto a occhio non l'ha deciso nessuno. La scelta fra ridurre, cambiare variante o tenere duro è del coach.`,
      riferimenti: [],
    });
  }

  // --- esercizio saltato più volte di fila ---------------------------------
  for (const [id, esp] of esposizioniPerEsercizio) {
    if (!varianti.get(id)) continue;
    const recenti = esp.slice(0, 2);
    if (recenti.length < 2 || !recenti.every((e) => e.saltato)) continue;
    const motivi = recenti
      .map(
        (e) =>
          `${dataBreve(e.data)}: ${MOTIVI_SALTO[e.saltato.motivo] || e.saltato.motivo}` +
          `${e.saltato.nota ? ` (${String(e.saltato.nota).replace(/\s*\n+\s*/g, " · ")})` : ""}`
      )
      .join(" · ");
    agg({
      id: `seg_saltato_${id}`,
      tipo: "saltatoRipetuto",
      gravita: recenti.some((e) => e.saltato.motivo === "dolore") ? "attenzione" : "info",
      messaggio: `${nome(id)}: saltato le ultime ${recenti.length} volte.`,
      dettaglio: `${motivi}. Due volte di fila non è un imprevisto: o l'esercizio non è praticabile così com'è, o il momento in cui capita nella seduta è sbagliato. Senza esposizioni non nascono nemmeno proposte su questo esercizio.`,
      riferimenti: [],
    });
  }

  // --- tetto raggiunto su un esercizio a tempo -----------------------------
  // La progressione a tempo resta una valutazione a mano (non c'è un carico da
  // aggiungere), ma il fatto che il tetto sia raggiunto va detto lo stesso.
  for (const [id, esp] of esposizioniPerEsercizio) {
    const v = varianti.get(id);
    if (!v?.aTempo || !v.durataSec) continue;
    const recenti = esp.filter((e) => !e.saltato && e.serie?.length).slice(0, regole.progressione.esposizioniMinime);
    if (recenti.length < regole.progressione.esposizioniMinime) continue;
    if (!recenti.every((e) => e.rpe != null && e.tecnica != null)) continue;
    if (!recenti.every((e) => (ripetizioniEffettive(e) ?? 0) >= v.durataSec)) continue;
    if (!recenti.every((e) => e.rpe <= regole.progressione.rpePerSalire)) continue;
    if (!recenti.every((e) => e.tecnica >= regole.progressione.tecnicaMinima)) continue;
    agg({
      id: `seg_tetto_tempo_${id}`,
      tipo: "tettoTempo",
      gravita: "info",
      messaggio: `${nome(id)}: ${v.durataSec}s tenuti puliti per ${recenti.length} volte.`,
      dettaglio: `RPE ≤ ${regole.progressione.rpePerSalire} e tecnica ≥ ${regole.progressione.tecnicaMinima}/10 su tutte le serie. Su un esercizio a tempo l'app non allunga la durata da sola: quanto tenere lo decide il programma. È il momento di dirlo al coach.`,
      riferimenti: [],
    });
  }

  // --- tetto del range a corpo libero -------------------------------------
  for (const [id, esp] of esposizioniPerEsercizio) {
    const v = varianti.get(id);
    const def = esercizi.get(id);
    if (!v || v.aTempo || def?.attrezzo !== "corpo libero") continue;
    const recenti = esp.slice(0, regole.progressione.esposizioniMinime);
    if (recenti.length < regole.progressione.esposizioniMinime) continue;
    if (!recenti.every(datiCompleti)) continue;
    if (!recenti.every((e) => ripetizioniEffettive(e) >= v.ripMax)) continue;
    if (!recenti.every((e) => e.rpe <= regole.progressione.rpePerSalire)) continue;
    agg({
      id: `seg_tetto_${id}`,
      tipo: "tettoRange",
      gravita: "info",
      messaggio: `${nome(id)}: tetto del range raggiunto a corpo libero.`,
      dettaglio: `${v.ripMax} ripetizioni su tutte le serie a RPE ≤ ${regole.progressione.rpePerSalire}, per ${recenti.length} esposizioni. Senza carico da aggiungere la strada è una variante più difficile o un sovraccarico esterno: è una scelta da fare in conversazione, non una progressione automatica.`,
      riferimenti: [],
    });
  }

  return out;
}
