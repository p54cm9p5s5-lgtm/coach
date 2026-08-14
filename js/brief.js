/* Lettura del blocco tecnico COACH-DATA dal master brief.
   Funzioni pure: estrazione, validazione, confronto. L'applicazione sta in store.js. */

import { num } from "./ui.js";

export const VERSIONE_SUPPORTATA = 1;

const APERTURA = /<!--\s*COACH-DATA\s+v(\d+)\s*-->/i;
const CHIUSURA = /<!--\s*\/COACH-DATA\s*-->/i;
// Forma di riserva, senza il commento HTML: una riga che contiene soltanto
// «COACH-DATA v1» e più sotto una che contiene soltanto «/COACH-DATA».
//
// Serve perché il brief viaggia per chat, e una chat che interpreta il markdown
// i commenti HTML NON LI MOSTRA: chi copia quello che vede si porta via un file
// senza marcatori, e l'app rispondeva «non c'è il blocco» su un file che a
// schermo sembrava completo. La forma col commento resta quella giusta, questa
// è una rete.
const APERTURA_NUDA = /^[ \t]*COACH-DATA\s+v(\d+)[ \t]*$/im;
const CHIUSURA_NUDA = /^[ \t]*\/COACH-DATA[ \t]*$/im;

export function estraiBlocco(testo) {
  let apre = testo.match(APERTURA);
  let nuda = false;
  if (!apre) {
    apre = testo.match(APERTURA_NUDA);
    nuda = Boolean(apre);
  }
  if (!apre) {
    // Dire «manca il blocco» e basta lascia a indovinare cosa cercare. Se la
    // scritta c'è ma in una forma diversa, quello è l'indizio che serve.
    const traccia = /COACH-?DATA/i.test(testo);
    throw new Error(
      traccia
        ? "Nel file la scritta COACH-DATA c'è, ma non nella forma che apre il blocco. Serve una riga fatta esattamente così:\n\n<!-- COACH-DATA v1 -->\n\ne più sotto una che chiude:\n\n<!-- /COACH-DATA -->\n\nSe il brief è stato copiato da una chat, i commenti HTML possono essere spariti nella copia: sono invisibili a schermo. Chiedi il file .md allegato, oppure il blocco dentro un riquadro di codice."
        : "Nel file non c'è il blocco COACH-DATA. Deve stare in coda al master brief, aperto da una riga «<!-- COACH-DATA v1 -->» e chiuso da «<!-- /COACH-DATA -->»."
    );
  }
  const versione = Number(apre[1]);
  if (versione !== VERSIONE_SUPPORTATA) {
    throw new Error(
      `Il blocco è in versione v${versione}, l'app legge la v${VERSIONE_SUPPORTATA}. Non applico niente.`
    );
  }
  const dopo = testo.slice(apre.index + apre[0].length);
  const chiude = nuda ? dopo.match(CHIUSURA_NUDA) : dopo.match(CHIUSURA);
  if (!chiude) {
    throw new Error(
      `Il blocco COACH-DATA è aperto ma non chiuso: manca la riga «${nuda ? "/COACH-DATA" : "<!-- /COACH-DATA -->"}» in fondo al blocco.`
    );
  }

  let corpo = dopo.slice(0, chiude.index);
  // Dentro al blocco possono esserci commenti HTML e un recinto ```json: si tolgono entrambi.
  corpo = corpo.replace(/<!--[\s\S]*?-->/g, "");
  corpo = corpo.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  if (!corpo) throw new Error("Il blocco COACH-DATA è vuoto.");

  try {
    return JSON.parse(corpo);
  } catch (e) {
    throw new Error(`Il blocco COACH-DATA non è JSON valido: ${e.message}`);
  }
}

export function valida(dati, libreria) {
  const problemi = [];
  const noti = new Set(libreria.map((e) => e.id));

  if (!Array.isArray(dati.split) || !dati.split.length) {
    problemi.push("Manca lo split settimanale.");
  }

  // Due giorni con lo stesso id, o due giorni sullo stesso giorno della
  // settimana: vinceva il primo scritto e l'altro spariva senza dirlo. Succede
  // davvero quando nel brief convivono due programmi (quello vecchio e quello
  // nuovo), ed è il tipo di errore di cui ci si accorge solo in palestra.
  const idVisti = new Map();
  const settimanaVisti = new Map();
  for (const giorno of dati.split || []) {
    if (giorno?.id) {
      if (idVisti.has(giorno.id)) {
        problemi.push(
          `Due giorni con lo stesso id "${giorno.id}": «${idVisti.get(giorno.id)}» e «${giorno.nome || giorno.id}». L'app ne userebbe uno solo.`
        );
      } else idVisti.set(giorno.id, giorno.nome || giorno.id);
    }
    if (typeof giorno?.giorno === "number") {
      const gia = settimanaVisti.get(giorno.giorno);
      if (gia) {
        problemi.push(
          `Due allenamenti sullo stesso giorno della settimana (${GIORNI_SETTIMANA[giorno.giorno] || giorno.giorno}): «${gia}» e «${giorno.nome || giorno.id}». Il calendario ne può proporre uno solo.`
        );
      } else settimanaVisti.set(giorno.giorno, giorno.nome || giorno.id);
    }
  }

  for (const giorno of dati.split || []) {
    const visti = new Set();
    // I blocchi si fanno attaccati: gli esercizi di una stessa lettera devono
    // essere uno dopo l'altro. Con un terzo esercizio in mezzo l'app accoppia
    // comunque il primo con l'ultimo e quello in mezzo non viene mai proposto —
    // sparisce dall'allenamento senza che nessuno lo dica. E una lettera su un
    // esercizio solo non è un blocco: è una dichiarazione che non fa niente.
    const posizioni = new Map();
    (giorno.esercizi || []).forEach((v, i) => {
      if (!v?.blocco) return;
      if (!posizioni.has(v.blocco)) posizioni.set(v.blocco, []);
      posizioni.get(v.blocco).push(i);
    });
    for (const [lettera, pos] of posizioni) {
      const dove = giorno.nome || giorno.id;
      if (pos.length < 2) {
        problemi.push(`Blocco "${lettera}" in ${dove}: c'è un esercizio solo. Un blocco ne vuole almeno due.`);
      } else if (pos[pos.length - 1] - pos[0] !== pos.length - 1) {
        problemi.push(
          `Blocco "${lettera}" in ${dove}: gli esercizi non sono di seguito. Un blocco si fa attaccato, quindi vanno scritti uno dopo l'altro.`
        );
      } else {
        // Le serie di un blocco sono i suoi GIRI: se i compagni ne dichiarano
        // un numero diverso, «giro 2 di 3» vuol dire due cose diverse nella
        // stessa coppia, e uno dei due finisce prima lasciando l'altro a
        // girare da solo. Le istruzioni per chi scrive il brief lo chiedono
        // già; era l'unica delle tre regole del blocco che l'app non
        // controllava, e un brief così veniva accettato in silenzio.
        const serie = [...new Set(pos.map((i) => giorno.esercizi[i]?.serie))];
        if (serie.length > 1) {
          problemi.push(
            `Blocco "${lettera}" in ${dove}: gli esercizi hanno un numero di serie diverso (${serie.join(", ")}). Le serie di un blocco sono i suoi giri e devono essere uguali.`
          );
        }
      }
    }
    if (!giorno.id || !giorno.nome) problemi.push("Un giorno dello split è senza id o nome.");
    // L'id è la chiave con cui l'app ritrova il giorno, negli allenamenti già
    // in archivio e negli abbinamenti col calendario: la specifica lo chiede
    // minuscolo con trattini, e finora era l'unica riga di quella tabella che
    // l'app non controllava davvero. Due id che differiscono per una maiuscola
    // o uno spazio diventerebbero due giorni diversi senza che si veda.
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(giorno.id)) {
      problemi.push(`Id del giorno non valido: "${giorno.id}". Va scritto minuscolo con trattini, per esempio "gambe-core".`);
    }
    if (typeof giorno.giorno !== "number" || giorno.giorno < 0 || giorno.giorno > 6) {
      problemi.push(`Giorno della settimana non valido in "${giorno.nome || giorno.id}".`);
    }
    for (const v of giorno.esercizi || []) {
      if (!noti.has(v.esercizioId)) {
        problemi.push(`Esercizio sconosciuto: "${v.esercizioId}" in ${giorno.nome || giorno.id}.`);
      }
      if (!(v.serie > 0)) problemi.push(`Serie non valide per ${v.esercizioId}.`);
      // Un carico negativo (o scritto a parole) arrivava fino alla schermata
      // dell'esercizio e ci restava: «-20 kg da montare» non vuol dire niente,
      // e quel numero entra anche nel punteggio come carico previsto.
      if (v.carico != null && !(Number.isFinite(v.carico) && v.carico >= 0)) {
        problemi.push(`Carico non valido per ${v.esercizioId}: dev'essere un numero di chili, zero o più.`);
      }
      if (v.recuperoSec != null && !(v.recuperoSec > 0)) {
        problemi.push(`Recupero non valido per ${v.esercizioId}: dev'essere un numero di secondi.`);
      }
      // Lo stesso esercizio due volte nello stesso giorno manderebbe in
      // confusione punteggio e proposte, che ragionano per esercizio.
      if (visti.has(v.esercizioId)) {
        problemi.push(`${v.esercizioId} compare due volte in ${giorno.nome || giorno.id}.`);
      }
      visti.add(v.esercizioId);
      // A tempo si controlla la durata, a ripetizioni il range: prima un
      // esercizio a tempo senza durata passava tutti i controlli e poi in
      // allenamento chiedeva «0 secondi».
      if (v.aTempo) {
        if (!(v.durataSec > 0)) problemi.push(`Durata non valida per ${v.esercizioId}.`);
      } else if (!(v.ripMax >= v.ripMin && v.ripMin > 0)) {
        problemi.push(`Range ripetizioni non valido per ${v.esercizioId}.`);
      }
      // Un esercizio che si tiene a tempo (il plank) scritto a ripetizioni
      // passerebbe tutti i controlli e poi in palestra chiederebbe «8-10
      // ripetizioni di plank». La libreria sa che si tiene: se il brief non lo
      // dice, è una svista e va corretta prima, non scoperta sotto il bilanciere.
      const def = libreria.find((e) => e.id === v.esercizioId);
      if (def?.aTempo && !v.aTempo) {
        problemi.push(
          `${v.esercizioId} si tiene a tempo: serve «"aTempo": true» e «durataSec», non un range di ripetizioni.`
        );
      }
    }
  }

  // I punti dolenti sono domande che compaiono dopo ogni esercizio: una lista
  // scritta male svuoterebbe il questionario senza dire perché.
  const dol = dati.regole?.dolori;
  if (dol != null) {
    if (!Array.isArray(dol)) {
      problemi.push("«regole.dolori» deve essere un elenco di punti dolenti.");
    } else {
      const visti = new Set();
      for (const s of dol) {
        if (!s || typeof s !== "object" || !s.id || typeof s.id !== "string") {
          problemi.push("Un punto dolente è senza «id».");
          continue;
        }
        if (visti.has(s.id)) problemi.push(`Punto dolente ripetuto: "${s.id}".`);
        visti.add(s.id);
        if (s.nome != null && typeof s.nome !== "string") {
          problemi.push(`Nome non valido per il punto dolente "${s.id}".`);
        }
      }
    }
  }

  // Le regole non venivano guardate affatto: un blocco scritto a metà passava
  // e poi spegneva in silenzio metà del punteggio. Qui non si giudica il
  // merito (i numeri li decide il coach), si controlla solo la forma: dove
  // l'app si aspetta un numero dev'esserci un numero.
  const reg = dati.regole;
  if (reg != null) {
    if (typeof reg !== "object" || Array.isArray(reg)) {
      problemi.push("«regole» deve essere un blocco di voci, non un elenco.");
    } else {
      const numeriPositivi = {
        "cardio.kmhMin": reg.cardio?.kmhMin,
        "cardio.kmhMax": reg.cardio?.kmhMax,
        "cardio.fcMin": reg.cardio?.fcMin,
        "cardio.fcMax": reg.cardio?.fcMax,
        "cardio.fcLimite": reg.cardio?.fcLimite,
        "cardio.durataMin": reg.cardio?.durataMin,
        "finestra.settimane": reg.finestra?.settimane,
        "finestra.minimoSettimana": reg.finestra?.minimoSettimana,
        "progressione.esposizioniMinime": reg.progressione?.esposizioniMinime,
        "progressione.rpePerSalire": reg.progressione?.rpePerSalire,
        "progressione.tecnicaMinima": reg.progressione?.tecnicaMinima,
        "progressione.esposizioniPerRiproporre": reg.progressione?.esposizioniPerRiproporre,
        "rpeTarget.min": reg.rpeTarget?.min,
        "rpeTarget.max": reg.rpeTarget?.max,
        "salute.sonnoOreBersaglio": reg.salute?.sonnoOreBersaglio,
        "salute.movimentoBersaglio": reg.salute?.movimentoBersaglio,
        "salute.passiBersaglio": reg.salute?.passiBersaglio,
        "salute.sigaretteTollerate": reg.salute?.sigaretteTollerate,
      };
      for (const [dove, valore] of Object.entries(numeriPositivi)) {
        if (valore != null && !(Number.isFinite(valore) && valore >= 0)) {
          problemi.push(`«regole.${dove}» dev'essere un numero, zero o più.`);
        }
      }
      for (const [dove, valore] of Object.entries({
        cardio: reg.cardio, finestra: reg.finestra, progressione: reg.progressione,
        rpeTarget: reg.rpeTarget, salute: reg.salute, cadenze: reg.cadenze,
      })) {
        if (valore != null && (typeof valore !== "object" || Array.isArray(valore))) {
          problemi.push(`«regole.${dove}» dev'essere un blocco di voci.`);
        }
      }
      if (reg.cardio?.kmhMin != null && reg.cardio?.kmhMax != null && reg.cardio.kmhMin > reg.cardio.kmhMax) {
        problemi.push("«regole.cardio»: la velocità minima è più alta della massima.");
      }
      if (reg.cardio?.fcMin != null && reg.cardio?.fcMax != null && reg.cardio.fcMin > reg.cardio.fcMax) {
        problemi.push("«regole.cardio»: il battito minimo è più alto del massimo.");
      }
      if (reg.rpeTarget?.min != null && reg.rpeTarget?.max != null && reg.rpeTarget.min > reg.rpeTarget.max) {
        problemi.push("«regole.rpeTarget»: il minimo è più alto del massimo.");
      }
      const pesi = reg.salute?.pesi;
      if (pesi != null) {
        if (typeof pesi !== "object" || Array.isArray(pesi)) {
          problemi.push("«regole.salute.pesi» dev'essere un blocco di voci (nome del peso: numero).");
        } else {
          for (const [voce, valore] of Object.entries(pesi)) {
            if (!(Number.isFinite(valore) && valore >= 0)) {
              problemi.push(`«regole.salute.pesi.${voce}» dev'essere un numero, zero o più.`);
            }
          }
        }
      }
      for (const [dove, valore] of Object.entries({
        "salute.contaSigarette": reg.salute?.contaSigarette,
        "salute.contaAcqua": reg.salute?.contaAcqua,
      })) {
        if (valore != null && typeof valore !== "boolean") {
          problemi.push(`«regole.${dove}» dev'essere vero o falso.`);
        }
      }
    }
  }

  const inv = dati.inventario;
  if (inv) {
    // La barra è facoltativa quanto i manubri: chi si allena con soli manubri
    // fissi non ha nessun bilanciere, e le istruzioni per chi scrive il brief
    // gli dicono proprio di omettere barra e dischi. Pretenderla faceva
    // respingere in blocco un inventario legittimo, con un messaggio che
    // parlava di un attrezzo che quella persona non possiede.
    if (inv.barra != null && !(inv.barra >= 0)) {
      problemi.push("Peso della barra non valido nell'inventario.");
    }
    for (const [peso, q] of Object.entries(inv.dischi || {})) {
      if (!(Number(peso) > 0) || !(q >= 0)) problemi.push(`Disco non valido: ${peso} kg ×${q}.`);
      if (q % 2 !== 0) problemi.push(`Disco ${peso} kg in numero dispari (${q}): non è montabile a coppie.`);
    }
    // I manubri sono facoltativi: se ci sono, devono avere una forma sensata,
    // altrimenti l'app calcolerebbe carichi che non si possono montare.
    const m = inv.manubri;
    if (m != null) {
      if (typeof m !== "object" || Array.isArray(m)) {
        problemi.push("«inventario.manubri» deve essere un oggetto con «regolabili» e/o «fissi».");
      } else {
        const reg = m.regolabili;
        if (reg != null) {
          if (!(reg.scaricoKg >= 0)) problemi.push("Peso a vuoto dei manubri regolabili non valido.");
          if (!Number.isInteger(reg.quantita) || reg.quantita < 0) {
            problemi.push("Quantità dei manubri regolabili non valida: serve un numero intero.");
          }
        }
        if (m.fissi != null) {
          if (!Array.isArray(m.fissi)) {
            problemi.push("«inventario.manubri.fissi» deve essere un elenco di pesi, uno per manubrio.");
          } else {
            for (const f of m.fissi) {
              if (!(Number(f) > 0)) problemi.push(`Manubrio fisso non valido: ${f}.`);
            }
          }
        }
      }
    }
  }

  return problemi;
}

/** Differenze leggibili tra programma attuale e nuovo, per la conferma. */
/** Nomi dei giorni della settimana, indice 0 = domenica come in JavaScript. */
const GIORNI_SETTIMANA = [
  "domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato",
];

/**
 * Un carico scritto come si scrive qui: 37,5 e non 37.5.
 *
 * Il punto arrivava dritto dal JSON del brief, e si vedeva solo sui mezzi
 * chili — cioè proprio nelle righe che contano, perché una progressione di
 * mezzo chilo è la modifica più frequente che il coach fa.
 */
const kg = (v) => (v == null ? "—" : String(v).replace(".", ","));


/* I nomi per esteso delle soglie, cosi la riga del confronto si legge come una
   frase invece che come un percorso di chiavi. Quelle che non stanno qui si
   mostrano col loro nome tecnico: meglio una parola tecnica che il silenzio. */
const NOMI_REGOLE = {
  "cardio.kmhMin": "cardio · velocità minima (km/h)",
  "cardio.kmhMax": "cardio · velocità massima (km/h)",
  "cardio.fcMin": "cardio · battito minimo",
  "cardio.fcMax": "cardio · battito massimo",
  "cardio.fcLimite": "cardio · battito da non superare",
  "cardio.durataMin": "cardio · durata (min)",
  "finestra.settimane": "finestra dati · settimane",
  "finestra.minimoSettimana": "finestra dati · giorni minimi a settimana",
  "finestra.soglia": "finestra dati · soglia dello scarto",
  "progressione.esposizioniMinime": "progressione · esposizioni minime",
  "progressione.rpePerSalire": "progressione · RPE per salire",
  "progressione.tecnicaMinima": "progressione · tecnica minima",
  "progressione.tecnicaRiduzione": "progressione · tecnica sotto cui si scende",
  "progressione.esposizioniPerRiproporre": "progressione · esposizioni per riproporre",
  "rpeTarget.min": "zona RPE · minimo",
  "rpeTarget.max": "zona RPE · massimo",
  "salute.sonnoOreBersaglio": "salute · ore di sonno bersaglio",
  "salute.sonnoOreMinime": "salute · ore di sonno minime",
  "salute.sonnoOraLimite": "salute · ora limite per andare a letto",
  "salute.sonnoCostoOraTardi": "salute · costo di ogni ora tardi",
  "salute.movimentoBersaglio": "salute · bersaglio movimento (kcal)",
  "salute.passiBersaglio": "salute · bersaglio passi",
  "salute.minutiEsercizioBersaglio": "salute · bersaglio minuti di esercizio",
  "salute.minutiInPiediBersaglio": "salute · bersaglio minuti in piedi",
  "salute.sigaretteTollerate": "salute · sigarette tollerate",
  "salute.contaSigarette": "salute · conta le sigarette",
  "salute.contaAcqua": "salute · conta l'acqua",
  "salute.acquaLitriBersaglio": "salute · litri d'acqua",
  "salute.fumoQuotaMinima": "salute · quanto può scendere la voce Fumo",
  "salute.pesi.sonno": "punteggio Salute · quanto pesa il sonno",
  "salute.pesi.allenamento": "punteggio Salute · quanto pesa l'allenamento",
  "salute.pesi.fumo": "punteggio Salute · quanto pesa il fumo",
  "salute.pesi.movimento": "punteggio Salute · quanto pesa il movimento",
  "salute.pesi.passi": "punteggio Salute · quanto pesano i passi",
  "salute.pesi.esercizio": "punteggio Salute · quanto pesano i minuti di esercizio",
  "salute.pesi.inPiedi": "punteggio Salute · quanto pesa il tempo in piedi",
  "salute.pesi.acqua": "punteggio Salute · quanto pesa l'acqua",
  "cadenze.misureGiornoSettimana": "cadenze · giorno delle misure",
  "cadenze.fotoGiornoSettimana": "cadenze · giorno delle foto",
  "cadenze.fotoOgniSettimane": "cadenze · foto ogni quante settimane",
  "cadenze.fotoAncora": "cadenze · data di riferimento delle foto",
};

function scrivibile(v) {
  if (v == null) return "non dichiarato";
  if (typeof v === "boolean") return v ? "sì" : "no";
  if (typeof v === "number") return num(v);
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

/** Le regole cambiate, una riga per voce, con il prima e il dopo. */
export function differenzeRegole(vecchie, nuove, prefisso = "") {
  const righe = [];
  const chiavi = [...new Set([...Object.keys(vecchie || {}), ...Object.keys(nuove || {})])].sort();
  for (const k of chiavi) {
    // I punti dolenti hanno un elenco tutto loro: si dicono a parte, per nome.
    if (!prefisso && k === "dolori") {
      const p = (x) => (Array.isArray(x) ? x.map((s) => s?.nome || s?.id).filter(Boolean) : []);
      const a = p(vecchie[k]);
      const b = p(nuove[k]);
      if (a.join("|") !== b.join("|")) {
        righe.push(`punti dolenti chiesti dopo ogni esercizio: ${a.length ? a.join(", ") : "nessuno"} → ${b.length ? b.join(", ") : "nessuno"}`);
      }
      continue;
    }
    const va = vecchie?.[k];
    const vb = nuove?.[k];
    const dove = prefisso ? `${prefisso}.${k}` : k;
    const oggetto = (x) => x && typeof x === "object" && !Array.isArray(x);
    if (oggetto(va) || oggetto(vb)) {
      righe.push(...differenzeRegole(oggetto(va) ? va : {}, oggetto(vb) ? vb : {}, dove));
      continue;
    }
    if (JSON.stringify(va) === JSON.stringify(vb)) continue;
    righe.push(`${NOMI_REGOLE[dove] || dove}: ${scrivibile(va)} → ${scrivibile(vb)}`);
  }
  return righe;
}

export function confronta(corrente, nuovo, libreria) {
  const nome = (id) => libreria.find((e) => e.id === id)?.nome || id;
  const righe = [];

  if (!corrente) {
    const tot = (nuovo.split || []).reduce((n, g) => n + (g.esercizi?.length || 0), 0);
    righe.push({ tipo: "nuovo", testo: `Primo caricamento: ${nuovo.split.length} giorni, ${tot} esercizi.` });
    return righe;
  }

  const mappa = (p) => {
    const m = new Map();
    for (const g of p.split || []) {
      for (const v of g.esercizi || []) m.set(`${g.id}::${v.esercizioId}`, { g, v });
    }
    return m;
  };

  const a = mappa(corrente);
  const b = mappa(nuovo);

  const giorniA = new Set((corrente.split || []).map((g) => g.id));
  const giorniB = new Set((nuovo.split || []).map((g) => g.id));
  for (const g of giorniB) if (!giorniA.has(g)) righe.push({ tipo: "aggiunto", testo: `Nuovo giorno: ${g}` });
  for (const g of giorniA) if (!giorniB.has(g)) righe.push({ tipo: "rimosso", testo: `Giorno rimosso: ${g}` });

  // Il giorno della settimana, il nome e il cardio non venivano confrontati:
  // spostare Spalle dal mercoledì al sabato cambia tutto il calendario, e
  // passava senza una riga. Stessa cosa per il cardio tolto o aggiunto.
  const perId = (p) => new Map((p.split || []).map((g) => [g.id, g]));
  const gA = perId(corrente);
  const gB = perId(nuovo);
  for (const [id, g] of gB) {
    const vecchio = gA.get(id);
    if (!vecchio) continue;
    if (vecchio.giorno !== g.giorno) {
      righe.push({
        tipo: "modificato",
        testo: `${g.nome || id}: spostato da ${GIORNI_SETTIMANA[vecchio.giorno] ?? vecchio.giorno} a ${GIORNI_SETTIMANA[g.giorno] ?? g.giorno}`,
      });
    }
    if ((vecchio.nome || "") !== (g.nome || "")) {
      righe.push({ tipo: "modificato", testo: `Giorno rinominato: ${vecchio.nome || id} → ${g.nome || id}` });
    }
    if (Boolean(vecchio.cardio) !== Boolean(g.cardio)) {
      righe.push({
        tipo: "modificato",
        testo: `${g.nome || id}: cardio ${g.cardio ? "aggiunto" : "tolto"}`,
      });
    }
  }

  for (const [k, { g, v }] of b) {
    if (!a.has(k)) {
      righe.push({ tipo: "aggiunto", testo: `${g.nome}: aggiunto ${nome(v.esercizioId)}` });
      continue;
    }
    const vecchio = a.get(k).v;
    const cambi = [];
    if (vecchio.serie !== v.serie) cambi.push(`serie ${vecchio.serie} → ${v.serie}`);
    if (vecchio.ripMin !== v.ripMin || vecchio.ripMax !== v.ripMax) {
      cambi.push(`rip ${vecchio.ripMin}-${vecchio.ripMax} → ${v.ripMin}-${v.ripMax}`);
    }
    if ((vecchio.carico ?? null) !== (v.carico ?? null)) {
      cambi.push(`carico ${kg(vecchio.carico)} → ${kg(v.carico)} kg`);
    }
    // Su un esercizio a tempo la durata è la prescrizione: un plank che passa
    // da 60 a 90 secondi cambiava in silenzio.
    if ((vecchio.durataSec ?? null) !== (v.durataSec ?? null)) {
      cambi.push(`durata ${vecchio.durataSec ?? "—"}s → ${v.durataSec ?? "—"}s`);
    }
    if (Boolean(vecchio.aTempo) !== Boolean(v.aTempo)) {
      cambi.push(v.aTempo ? "ora è a tempo" : "ora è a ripetizioni");
    }
    // Il recupero e l'accoppiamento in blocco cambiano l'allenamento quanto le
    // ripetizioni: senza queste due righe un brief che rifà tutti i riposi, o
    // che scioglie una coppia, veniva presentato come «nessuna differenza».
    if ((vecchio.recuperoSec ?? null) !== (v.recuperoSec ?? null)) {
      // «—s» non vuol dire niente: il trattino dice già che il recupero non era
      // dichiarato, e la «s» attaccata lo faceva sembrare un numero.
      const dice = (x) => (x == null ? "non dichiarato" : `${x}s`);
      cambi.push(`recupero ${dice(vecchio.recuperoSec)} → ${dice(v.recuperoSec)}`);
    }
    if ((vecchio.blocco ?? null) !== (v.blocco ?? null)) {
      cambi.push(
        v.blocco
          ? vecchio.blocco
            ? `blocco ${vecchio.blocco} → ${v.blocco}`
            : `entra nel blocco ${v.blocco}`
          : `esce dal blocco ${vecchio.blocco}`
      );
    }
    if (cambi.length) {
      righe.push({ tipo: "modificato", testo: `${g.nome} · ${nome(v.esercizioId)}: ${cambi.join(", ")}` });
    }
  }

  for (const [k, { g, v }] of a) {
    if (!b.has(k)) righe.push({ tipo: "rimosso", testo: `${g.nome}: tolto ${nome(v.esercizioId)}` });
  }

  // «Regole e soglie aggiornate» era tutto quello che si leggeva quando il
  // coach spostava le soglie del cardio, i pesi del punteggio o le esposizioni
  // minime: proprio le modifiche che non si vedono da nessun'altra parte,
  // mentre per un carico da 20 a 22 kg l'app scrive la differenza esatta.
  // Adesso le regole si confrontano voce per voce, con i nomi che si leggono.
  for (const riga of differenzeRegole(corrente.regole || {}, nuovo.regole || {})) {
    righe.push({ tipo: "modificato", testo: riga });
  }

  const ic = JSON.stringify(corrente.inventario || {});
  const inuovo = JSON.stringify(nuovo.inventario || {});
  if (ic !== inuovo) righe.push({ tipo: "modificato", testo: "Inventario dischi aggiornato." });

  if (!righe.length) righe.push({ tipo: "uguale", testo: "Nessuna differenza rispetto al programma attuale." });
  return righe;
}
