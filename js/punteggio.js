/* Punteggio 0-100 di un esercizio e dell'allenamento intero.
   Non è un voto morale: è la distanza fra quello che il programma chiedeva e
   quello che è stato eseguito. 100 solo se tutto è al suo posto — tecnica,
   ripetizioni, carico, intensità e recuperi. Le curve non sono lineari: la
   metà del lavoro non vale metà punteggio, perché un allenamento fatto a metà
   non produce metà adattamento.

   Le soglie di riferimento (zona RPE, velocità e durata del cardio, recuperi)
   NON sono decise qui: arrivano dal master brief. Qui si misura soltanto lo
   scarto rispetto a quelle. */

import { h, num } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, String(v));
  return n;
};

const limita = (v) => Math.max(0, Math.min(1, v));

/**
 * Manca poco al bersaglio ≠ ci siamo quasi: sotto il previsto si scende in
 * fretta. Raggiunto il bersaglio la voce vale pieno e si ferma lì: il bersaglio
 * è quello che il programma chiede, e farne di più non è una cosa che alza il
 * voto — è semplicemente averlo fatto.
 */
const sottoBersaglio = (rapporto, durezza = 2.5) =>
  rapporto >= 1 ? 1 : limita(1 - (1 - rapporto) * durezza);

/**
 * Quante ore dopo il limite sei andato a letto. `null` se non lo sappiamo.
 *
 * Un orario dalle 12 in poi è la sera prima: quello è andare a letto in orario,
 * e il ritardo è zero. Dopo mezzanotte il ritardo sono le ore passate.
 */
function ritardoAndataALetto(inizio, oraLimite = 0) {
  if (!inizio) return null;
  const orario = String(inizio).slice(11, 16);
  const [h, m] = orario.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h >= 12) return 0; // a letto prima di mezzanotte
  return Math.max(0, h + m / 60 - oraLimite);
}

/* La tecnica è il primo criterio del brief: sotto il 9 non è "quasi buona",
   è una tecnica da correggere prima di pensare al carico. */
const CURVA_TECNICA = { 10: 1, 9: 0.75, 8: 0.45, 7: 0.2, 6: 0.08 };
const quotaTecnica = (t) => (t == null ? 0 : CURVA_TECNICA[t] ?? (t > 10 ? 1 : 0));

/**
 * @param variante  riga dello split: serie, ripMin/ripMax, carico previsto
 * @param serie     serie registrate per questo esercizio
 * @param rpe, tecnica, dolorePolso  risposte del questionario (possono mancare)
 */
export function punteggioEsercizio({ variante, serie, rpe, tecnica, dolorePolso, regole }) {
  const voci = [];
  const tetti = []; // regole rigide: nessuna media può aggirarle

  // --- ripetizioni: quanto del lavoro previsto è stato davvero fatto
  // Il bersaglio è quello che l'app ha chiesto davvero serie per serie
  // (ripTarget, che tiene conto di un'eventuale proposta accettata). Il tetto
  // del range non è un obiettivo: chi lavora al fondo del range farebbe il suo
  // lavoro e risulterebbe lo stesso «da rivedere».
  const chiestoPerSerie = serie.map((s) => s.ripTarget).filter((x) => x != null);
  // Per le serie che non hai fatto si usa lo stesso bersaglio delle altre:
  // l'ultimo target chiesto quel giorno, non quello del brief. Se l'app ti
  // aveva chiesto 8 e ne mancano due, mancano 8+8, non 10+10.
  const bersaglioUnita = variante.aTempo
    ? variante.durataSec
    : chiestoPerSerie.at(-1) ?? variante.ripMin ?? variante.ripMax;
  const bersaglio = chiestoPerSerie.length
    ? chiestoPerSerie.reduce((a, b) => a + b, 0) +
      Math.max(0, (variante.serie || 0) - chiestoPerSerie.length) * (bersaglioUnita || 0)
    : (variante.serie || 0) * (bersaglioUnita || 0);
  const fatte = serie.reduce((t, s) => t + (s.ripFatte || 0), 0);
  const rapportoRip = bersaglio ? fatte / bersaglio : serie.length ? 1 : 0;
  voci.push({
    nome: variante.aTempo ? "Secondi" : "Ripetizioni",
    quota: sottoBersaglio(rapportoRip),
    peso: 25,
    dettaglio: bersaglio ? `${fatte} su ${bersaglio}` : `${serie.length} serie`,
  });
  if (rapportoRip < 0.9) tetti.push({ tetto: 80, perche: "lavoro previsto non completato" });
  if (rapportoRip < 0.75) tetti.push({ tetto: 60, perche: "meno di tre quarti del lavoro" });

  // --- carico: raggiungere il previsto vale pieno, superarlo non è un merito
  // Un carico previsto pari a zero è un esercizio a corpo libero scritto in un
  // altro modo: trattarlo come numero farebbe una divisione per zero.
  const chiesto = serie.map((s) => s.caricoTarget).filter((x) => x != null && x > 0);
  const previsto = chiesto.length ? chiesto.at(-1) : variante.carico > 0 ? variante.carico : null;
  const usato = serie.filter((s) => s.carico != null).at(-1)?.carico ?? null;
  if (previsto == null) {
    voci.push({ nome: "Carico", quota: serie.length ? 1 : 0, peso: 20, dettaglio: "corpo libero" });
  } else {
    const rapporto = usato == null ? 0 : usato / previsto;
    voci.push({
      nome: "Carico",
      quota: sottoBersaglio(rapporto),
      peso: 20,
      dettaglio:
        usato == null
          ? "non registrato"
          : usato > previsto
            ? `${num(usato)} kg, previsti ${num(previsto)}`
            : `${num(usato)} su ${num(previsto)} kg`,
    });
    if (rapporto < 0.9) tetti.push({ tetto: 80, perche: "carico sotto il programmato" });
  }

  // --- tecnica: il giudizio che nel brief viene prima di tutto
  voci.push({
    nome: "Tecnica",
    quota: quotaTecnica(tecnica),
    peso: 30,
    dettaglio: tecnica == null ? "non valutata" : `${num(tecnica)} su 10`,
  });
  if (tecnica != null && tecnica <= 7) tetti.push({ tetto: 65, perche: "tecnica da correggere" });
  if (tecnica != null && tecnica <= 5) tetti.push({ tetto: 40, perche: "tecnica insufficiente" });
  if (tecnica == null) tetti.push({ tetto: 70, perche: "tecnica non valutata" });

  // --- intensità: dentro la zona del brief, non più su e non più giù
  const zona = regole.rpeTarget;
  let quotaRpe = 0;
  let distanza = null;
  if (rpe != null) {
    distanza = rpe < zona.min ? zona.min - rpe : rpe > zona.max ? rpe - zona.max : 0;
    quotaRpe = distanza === 0 ? 1 : distanza === 1 ? 0.4 : distanza === 2 ? 0.15 : 0;
  }
  voci.push({
    nome: "Intensità",
    quota: quotaRpe,
    peso: 15,
    dettaglio: rpe == null ? "RPE non dato" : `RPE ${rpe}, zona ${zona.min}-${zona.max}`,
  });
  if (distanza) {
    tetti.push({
      tetto: 80,
      perche: rpe < zona.min ? "sforzo sotto la zona prevista" : "sforzo sopra la zona prevista",
    });
  }

  // --- recuperi: cronometrati dall'app, non dichiarati
  const misurati = serie.filter((s) => s.recuperoRealeSec != null && s.recuperoTargetSec);
  if (misurati.length) {
    const scarti = misurati.map((s) => {
      const d = (s.recuperoRealeSec - s.recuperoTargetSec) / s.recuperoTargetSec;
      // tagliare il recupero falsa la serie dopo; allungarlo la raffredda soltanto
      return d < 0 ? limita(1 + d * 2) : limita(1 - d * 0.8);
    });
    const media = scarti.reduce((a, b) => a + b, 0) / scarti.length;
    const mediaSec = Math.round(misurati.reduce((t, s) => t + s.recuperoRealeSec, 0) / misurati.length);
    const target = misurati[0].recuperoTargetSec;
    voci.push({
      nome: "Recupero",
      quota: media,
      peso: 10,
      dettaglio: `${mediaSec}s medi su ${target}s previsti`,
    });
    if (media < 0.6) tetti.push({ tetto: 85, perche: "recuperi non rispettati" });
  } else {
    // Senza misura non si regala il punto: il peso va sugli altri criteri.
    voci.push({ nome: "Recupero", quota: null, peso: 10, dettaglio: "non misurato" });
  }

  const pesati = voci.filter((v) => v.quota != null);
  const pesoTotale = pesati.reduce((t, v) => t + v.peso, 0) || 1;
  let totale = Math.round((pesati.reduce((t, v) => t + v.quota * v.peso, 0) / pesoTotale) * 100);

  const penalita = [];
  if (dolorePolso) {
    penalita.push({ nome: "Dolore al polso", punti: -20 });
    totale = Math.max(0, totale - 20);
    tetti.push({ tetto: 70, perche: "dolore al polso" });
  }

  const limite = tetti.sort((a, b) => a.tetto - b.tetto)[0];
  if (limite && totale > limite.tetto) totale = limite.tetto;

  return {
    totale,
    voci,
    penalita,
    limite: limite && limite.tetto <= totale ? limite : null,
    completo: rpe != null && tecnica != null,
  };
}

/**
 * Punteggio Salute di una giornata: 0-100, con la stessa architettura del
 * punteggio di allenamento — voci con un peso, tetti che nessuna media può
 * aggirare, e niente inventato dove il dato non c'è.
 *
 * Le voci senza dato restano fuori dal conto invece di valere zero: una notte
 * non registrata non è una notte insonne. Il peso si redistribuisce su quello
 * che si sa davvero, e il dettaglio dice sempre perché.
 *
 * @param notte        { durataMin } della notte cominciata la sera prima
 * @param allenamento  completezza 0-100 dell'allenamento chiuso quel giorno
 * @param previsto     se quel giorno il programma prevedeva un allenamento
 * @param giorno       riga dei dati salute: kcalAttive, obiettivoKcal
 * @param sigarette    quante ne hai segnate (null = prima che tenessi il conto)
 */
export function punteggioSalute({ notte, allenamento, previsto, giorno, sigarette, sigaretteTollerate = null, regole }) {
  const R = (regole && regole.salute) || {};
  const pesi = R.pesi || {
    sonno: 22, allenamento: 22, fumo: 20, movimento: 12, passi: 10, esercizio: 8, inPiedi: 6,
  };
  const oreBersaglio = R.sonnoOreBersaglio ?? 8;
  const oreMinime = R.sonnoOreMinime ?? 6;
  // Il limite può essere quello del giorno — scende man mano che si raggiungono
  // nuovi minimi — e in quel caso vince su quello dichiarato nel brief.
  const tollerate = sigaretteTollerate ?? R.sigaretteTollerate ?? 10;
  const passiBersaglio = R.passiBersaglio ?? 10000;
  const esercizioBersaglio = R.minutiEsercizioBersaglio ?? 60;
  const inPiediBersaglio = R.minutiInPiediBersaglio ?? 180;
  // Quanto può scendere sotto zero la voce Fumo: fumare oltre il tollerato non
  // si ferma a «zero punti», toglie punti. È dichiarato come tutto il resto.
  const fondoFumo = R.fumoQuotaMinima ?? -0.5;
  const voci = [];
  const tetti = [];

  // --- sonno: quanto hai dormito, e a che ora sei andato a letto
  //
  // La durata è proporzionale, non a curva: quattro ore su otto sono metà del
  // sonno, e valgono metà. La curva ripida serve per il lavoro in palestra, dove
  // metà allenamento non produce metà adattamento; il sonno non funziona così,
  // e con quella curva quattro ore finivano al 3%, un numero che non voleva
  // dire niente.
  //
  // L'orario pesa da solo: a letto entro mezzanotte nessuna penalità, e da lì
  // in poi ogni ora di ritardo costa. Due notti da sei ore non sono la stessa
  // notte se una comincia alle 23 e l'altra alle 4.
  if (notte?.durataMin != null) {
    const ore = notte.durataMin / 60;
    const quotaDurata = limita(ore / oreBersaglio);
    const ritardo = ritardoAndataALetto(notte.inizio, R.sonnoOraLimite ?? 0);
    const quotaOrario =
      ritardo == null ? 1 : limita(1 - ritardo * (R.sonnoCostoOraTardi ?? 0.12));
    // L'orario MOLTIPLICA la durata, non si somma a lei.
    //
    // Con la media pesata le due cose si compensavano: dormire un'ora più del
    // bersaglio produceva un bonus che annullava esattamente la penalità di
    // essere andati a letto dopo mezzanotte, e una notte cominciata all'una
    // risultava al 100%. Ma andare a letto tardi non è una cosa che si ripaga
    // dormendo di più: sposta tutta la notte, e la penalità deve restare
    // addosso a qualunque durata.
    voci.push({
      nome: "Sonno",
      quota: quotaDurata * quotaOrario,
      peso: pesi.sonno,
      dettaglio:
        `${num(ore, 1)}h su ${num(oreBersaglio, 1)}h` +
        (notte.inizio ? ` · a letto ${String(notte.inizio).slice(11, 16)}` : ""),
    });
    if (ore < oreMinime) tetti.push({ tetto: 70, perche: `meno di ${num(oreMinime, 0)} ore di sonno` });
  } else {
    voci.push({ nome: "Sonno", quota: null, peso: pesi.sonno, dettaglio: "non registrato" });
  }

  // --- allenamento: quello chiuso quel giorno, o l'assenza di quello previsto
  if (allenamento != null) {
    voci.push({
      nome: "Allenamento",
      quota: limita(allenamento / 100),
      peso: pesi.allenamento,
      dettaglio: `completezza ${Math.round(allenamento)}`,
    });
  } else if (previsto) {
    voci.push({ nome: "Allenamento", quota: 0, peso: pesi.allenamento, dettaglio: "previsto, non fatto" });
    tetti.push({ tetto: 60, perche: "allenamento previsto e non fatto" });
  } else {
    // Un giorno di riposo è parte del programma: non è un vuoto da punire.
    voci.push({ nome: "Allenamento", quota: null, peso: pesi.allenamento, dettaglio: "riposo" });
  }

  // --- movimento: le calorie attive contro l'obiettivo dell'anello
  // Il bersaglio del punteggio viene dalle regole, non dall'anello: quello che
  // conta qui è l'asticella che ti sei dato, non quella predefinita del Watch.
  const obiettivo = R.movimentoBersaglio || R.obiettivoMovimento || giorno?.obiettivoKcal || null;
  if (giorno?.kcalAttive != null && obiettivo) {
    voci.push({
      nome: "Movimento",
      quota: sottoBersaglio(giorno.kcalAttive / obiettivo, 1.5),
      peso: pesi.movimento,
      dettaglio: `${Math.round(giorno.kcalAttive)} su ${Math.round(obiettivo)} kcal`,
    });
  } else {
    voci.push({ nome: "Movimento", quota: null, peso: pesi.movimento, dettaglio: "non registrato" });
  }

  // --- passi: quanto ti sei mosso, al di là dell'allenamento
  if (giorno?.passi != null) {
    voci.push({
      nome: "Passi",
      quota: sottoBersaglio(giorno.passi / passiBersaglio, 1.2),
      peso: pesi.passi,
      dettaglio: `${Math.round(giorno.passi).toLocaleString("it-IT")} su ${passiBersaglio.toLocaleString("it-IT")}`,
    });
  } else {
    voci.push({ nome: "Passi", quota: null, peso: pesi.passi, dettaglio: "non registrati" });
  }

  // --- minuti di esercizio: l'anello verde dell'orologio
  if (giorno?.minutiEsercizio != null) {
    voci.push({
      nome: "Minuti di esercizio",
      quota: sottoBersaglio(giorno.minutiEsercizio / esercizioBersaglio, 1.2),
      peso: pesi.esercizio,
      dettaglio: `${Math.round(giorno.minutiEsercizio)} su ${esercizioBersaglio} min`,
    });
  } else {
    voci.push({ nome: "Minuti di esercizio", quota: null, peso: pesi.esercizio, dettaglio: "non registrati" });
  }

  // --- tempo in piedi: quanto NON sei stato seduto
  if (giorno?.minutiInPiedi != null) {
    voci.push({
      nome: "Tempo in piedi",
      quota: sottoBersaglio(giorno.minutiInPiedi / inPiediBersaglio, 1.2),
      peso: pesi.inPiedi,
      dettaglio: `${Math.round(giorno.minutiInPiedi)} su ${inPiediBersaglio} min`,
    });
  } else {
    voci.push({ nome: "Tempo in piedi", quota: null, peso: pesi.inPiedi, dettaglio: "non registrato" });
  }

  // --- fumo: zero vale pieno, la soglia tollerata vale zero, oltre va sotto zero
  //
  // È l'unica voce che scende sotto lo zero, e per un motivo che le altre non
  // hanno: mancare un bersaglio è non aver fatto abbastanza, fumare oltre il
  // tollerato è aver fatto un danno. Con la quota fermata a zero, venti
  // sigarette e dieci pesavano uguale — e non è vero.
  if (sigarette != null) {
    // Col limite a zero non si può dividere, e non serve: qualunque sigaretta è
    // già oltre. È il capolinea della tacca che scende — quando il massimo è
    // zero, l'unico modo di non sforare è non fumare.
    const quotaFumo =
      tollerate > 0
        ? Math.max(fondoFumo, 1 - sigarette / tollerate)
        : sigarette === 0
          ? 1
          : fondoFumo;
    voci.push({
      nome: "Fumo",
      quota: quotaFumo,
      peso: pesi.fumo,
      dettaglio: sigarette === 0 ? "nessuna sigaretta" : `${sigarette} su ${tollerate} tollerate`,
    });
    if (sigarette > tollerate) {
      tetti.push({
        tetto: 50,
        perche: tollerate > 0 ? `oltre le ${tollerate} sigarette tollerate` : "il limite ormai è zero",
      });
    } else if (sigarette > 0 && sigarette === tollerate) {
      // «Zero su zero» non è essere al limite: è il giorno perfetto, e mettergli
      // un tetto del 70 sarebbe punire proprio il risultato che si cercava.
      tetti.push({ tetto: 70, perche: `al limite delle ${tollerate} sigarette` });
    }
  } else {
    voci.push({ nome: "Fumo", quota: null, peso: pesi.fumo, dettaglio: "non ancora contate" });
  }

  const pesati = voci.filter((v) => v.quota != null);
  if (!pesati.length) return { totale: null, voci, limite: null, completo: false };
  const pesoTotale = pesati.reduce((t, v) => t + v.peso, 0) || 1;
  // Il totale sta fra zero e cento: la voce Fumo sotto zero tira giù la media
  // come deve, ma un punteggio negativo non vuol dire niente e l'anello non lo
  // sa disegnare.
  let totale = Math.max(
    0,
    Math.min(100, Math.round((pesati.reduce((t, v) => t + v.quota * v.peso, 0) / pesoTotale) * 100))
  );

  const limite = tetti.sort((a, b) => a.tetto - b.tetto)[0];
  if (limite && totale > limite.tetto) totale = limite.tetto;

  return {
    totale,
    voci,
    limite: limite && limite.tetto <= totale ? limite : null,
    completo: pesati.length === voci.length,
  };
}

/**
 * Punteggio dell'allenamento intero. Non è la media degli esercizi: un
 * allenamento è anche il riscaldamento, il cardio e lo stretching, e un
 * esercizio saltato pesa quanto uno fatto male.
 *
 * @param previsti   esercizi previsti dallo split per quel giorno
 * @param punteggi   punteggi degli esercizi effettivamente svolti
 * @param cardio     { previsto, eseguito, durataMin, durataPrevistaMin, kmh }
 */
export function punteggioAllenamento({ previsti, punteggi, saltati, cardio, riscaldamento, stretching, regole, regoleCardio = null }) {
  const voci = [];
  const tetti = [];

  const quanti = Math.max(previsti, punteggi.length + saltati);
  const somma = punteggi.reduce((a, b) => a + b, 0);
  voci.push({
    nome: "Esercizi",
    // Senza esercizi previsti la voce non ha senso: `null` la tiene fuori dal
    // conto invece di trascinare il punteggio a zero con uno «0 su 0».
    quota: quanti ? limita(somma / 100 / quanti) : null,
    peso: 60,
    // Gli esercizi previsti di cui non c'è traccia (né serie né questionario)
    // vanno detti: prima abbassavano il punteggio in silenzio e sembrava un
    // errore di conto.
    dettaglio:
      `${punteggi.length} su ${quanti}` +
      (saltati ? ` · ${saltati} ${saltati === 1 ? "saltato" : "saltati"}` : "") +
      (quanti - punteggi.length - saltati > 0
        ? ` · ${quanti - punteggi.length - saltati} mai ${quanti - punteggi.length - saltati === 1 ? "iniziato" : "iniziati"}`
        : ""),
  });
  if (saltati) tetti.push({ tetto: 75, perche: saltati === 1 ? "un esercizio saltato" : "esercizi saltati" });

  if (cardio?.previsto) {
    // Il riferimento è la durata del brief, non quella scelta al momento:
    // accorciare il cardio prima di partire non abbassa l'asticella.
    // Le soglie congelate nella seduta vincono su quelle di oggi.
    const soglie = regoleCardio || regole.cardio;
    const attesi = soglie.durataMin || cardio.durataPrevistaMin;
    const fatti = cardio.eseguito ? cardio.durataMin || 0 : 0;
    const rapporto = attesi ? fatti / attesi : 0;
    let quota = sottoBersaglio(rapporto, 1.6);
    let dettaglio = cardio.eseguito ? `${fatti} min su ${attesi}` : "non eseguito";
    if (cardio.eseguito && soglie.kmhMax != null && cardio.kmh > soglie.kmhMax) {
      quota = Math.min(quota, 0.7);
      dettaglio += ` · ${num(cardio.kmh)} km/h sopra protocollo`;
    } else if (cardio.eseguito && soglie.kmhMin != null && cardio.kmh < soglie.kmhMin) {
      quota = Math.min(quota, 0.85);
      dettaglio += ` · ${num(cardio.kmh)} km/h sotto protocollo`;
    }
    voci.push({ nome: "Cardio", quota, peso: 20, dettaglio });
    if (rapporto < 0.5) tetti.push({ tetto: 60, perche: "cardio quasi non fatto" });
    else if (rapporto < 0.9) tetti.push({ tetto: 85, perche: "cardio più corto del previsto" });
  }

  // Riscaldamento e stretching sono la stessa voce: aprono e chiudono la
  // seduta, e nel brief valgono per lo stesso motivo.
  voci.push({
    nome: "Riscaldamento e stretching",
    quota: ((riscaldamento ? 1 : 0) + (stretching ? 1 : 0)) / 2,
    peso: 20,
    dettaglio:
      riscaldamento && stretching
        ? "tutti e due fatti"
        : riscaldamento
          ? "stretching saltato"
          : stretching
            ? "riscaldamento saltato"
            : "saltati tutti e due",
  });

  // Solo le voci che hanno un valore entrano nella media: una voce «non
  // applicabile» non deve contare come zero.
  const pesate = voci.filter((v) => v.quota != null);
  const pesoTotale = pesate.reduce((t, v) => t + v.peso, 0) || 1;
  let totale = Math.round((pesate.reduce((t, v) => t + v.quota * v.peso, 0) / pesoTotale) * 100);

  const limite = tetti.sort((a, b) => a.tetto - b.tetto)[0];
  if (limite && totale > limite.tetto) totale = limite.tetto;

  // `quanti` viaggia col punteggio: quando il punteggio è congelato, chi lo
  // mostra deve poter scrivere «3 su 4» con lo stesso 4 che ha fatto il conto,
  // non con quello dello split di oggi, che nel frattempo può essere cambiato.
  return {
    totale,
    voci,
    previsti: quanti,
    svolti: punteggi.length,
    saltati: saltati || 0,
    penalita: [],
    limite: limite && limite.tetto <= totale ? limite : null,
  };
}

export function giudizio(totale) {
  if (totale >= 90) return { testo: "ottimo", livello: 3 };
  if (totale >= 70) return { testo: "sufficiente", livello: 2 };
  return { testo: "da rivedere", livello: 1 };
}

/**
 * Il colore di un punteggio, su una scala continua: lime acceso da 95 in su,
 * rosso acceso da 20 in giù, e in mezzo il passaggio graduale per giallo e
 * arancione. Un numero che scende deve VEDERSI scendere, non aspettare una
 * soglia per cambiare pastello.
 *
 * I colori sono fissi e non variabili di tema: sono un dato, come le tacche di
 * un termometro, e devono voler dire la stessa cosa su fondo chiaro e scuro.
 */
const SCALA = [
  [20, [255, 59, 48]],   // rosso acceso
  [45, [255, 140, 0]],   // arancione
  [70, [250, 204, 21]],  // giallo
  [85, [163, 230, 53]],  // lime-verde
  [95, [168, 240, 58]],  // lime acceso
];

export function coloreDaPunteggio(totale) {
  if (totale == null || Number.isNaN(totale)) return "var(--label-secondary)";
  const v = Math.max(0, Math.min(100, totale));
  if (v <= SCALA[0][0]) return `rgb(${SCALA[0][1].join(",")})`;
  if (v >= SCALA[SCALA.length - 1][0]) return `rgb(${SCALA[SCALA.length - 1][1].join(",")})`;
  for (let i = 1; i < SCALA.length; i++) {
    const [x1, c1] = SCALA[i - 1];
    const [x2, c2] = SCALA[i];
    if (v <= x2) {
      const q = (v - x1) / (x2 - x1);
      const mix = c1.map((c, k) => Math.round(c + (c2[k] - c) * q));
      return `rgb(${mix.join(",")})`;
    }
  }
  return "var(--label-secondary)";
}

/** Anello grande con il numero al centro. */
export function anello(totale, { etichetta = "Completezza", dimensione = 176, sottotitolo = null } = {}) {
  const R = 76;
  const CIRC = 2 * Math.PI * R;
  const spessore = Math.max(9, Math.round(dimensione / 18));
  const svg = el("svg", {
    viewBox: "0 0 176 176",
    width: dimensione,
    height: dimensione,
    style: "transform:rotate(-90deg);display:block",
    "aria-hidden": "true",
  });
  // Tre livelli come le barrette della scomposizione: con due soli colori,
  // «sufficiente» e «ottimo» erano indistinguibili a colpo d'occhio.
  const colore = coloreDaPunteggio(totale);
  svg.append(
    el("circle", { cx: 88, cy: 88, r: R, fill: "none", stroke: "currentColor", "stroke-width": spessore, opacity: 0.14 }),
    el("circle", {
      cx: 88, cy: 88, r: R, fill: "none", stroke: colore, "stroke-width": spessore,
      "stroke-linecap": "round", "stroke-dasharray": CIRC,
      "stroke-dashoffset": CIRC * (1 - limita(totale / 100)),
      style: "transition:stroke-dashoffset .45s ease",
    })
  );

  const scala = dimensione / 176;
  return h(
    "div",
    { style: `position:relative;width:${dimensione}px;height:${dimensione}px;margin:0 auto` },
    svg,
    h(
      "div",
      {
        style:
          "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px",
      },
      h(
        "p",
        {
          style: `margin:0;font-size:${Math.round(44 * scala)}px;font-weight:700;letter-spacing:-1.5px;font-variant-numeric:tabular-nums;line-height:1;color:${colore}`,
        },
        String(totale)
      ),
      h(
        "p",
        { style: `margin:0;font-size:${Math.max(9, Math.round(10 * scala))}px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:var(--label-secondary)` },
        etichetta
      ),
      sottotitolo
        ? h("p", { style: `margin:2px 0 0;font-size:${Math.max(10, Math.round(12 * scala))}px;color:var(--label-secondary)` }, sottotitolo)
        : null
    )
  );
}

/** Righe della scomposizione, con l'indicatore a tre segmenti. */
export function scomposizione(risultato) {
  const riga = (nome, quota, dettaglio) => {
    const nonApplicabile = quota == null;
    const g = giudizio(Math.round((quota ?? 0) * 100));
    const segmenti = h(
      "div",
      { style: "display:flex;gap:3px;align-items:center" },
      ...[1, 2, 3].map((i) =>
        h("span", {
          style:
            `width:14px;height:3px;border-radius:2px;background:${
              !nonApplicabile && i <= g.livello
                ? g.livello === 1
                  ? "var(--orange)"
                  : g.livello === 2
                    ? "var(--label-secondary)"
                    : "var(--accent)"
                : "var(--fill-tertiary)"
            }`,
        })
      )
    );
    return h(
      "div.row",
      h("div.main", h("span.title", nome), dettaglio ? h("span.sub", dettaglio) : null),
      segmenti,
      h(
        "span.value",
        { style: "min-width:44px;font-variant-numeric:tabular-nums;color:var(--label)" },
        nonApplicabile ? "—" : `${Math.round(quota * 100)}%`
      )
    );
  };

  const lista = h("div.list", ...risultato.voci.map((v) => riga(v.nome, v.quota, v.dettaglio)));
  for (const p of risultato.penalita) {
    lista.append(
      h(
        "div.row",
        h("div.main", h("span.title", p.nome)),
        h("span.pill.bad", `${p.punti}`)
      )
    );
  }
  return lista;
}

export function legenda() {
  const voce = (colore, testo) =>
    h(
      "span",
      { style: "display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--label-secondary)" },
      h("span", { style: `width:14px;height:3px;border-radius:2px;background:${colore}` }),
      testo
    );
  return h(
    "div",
    { style: "display:flex;gap:14px;justify-content:center;margin-top:10px" },
    voce("var(--orange)", "da rivedere"),
    voce("var(--label-secondary)", "sufficiente"),
    voce("var(--accent)", "ottimo")
  );
}

/** Frase che spiega il numero, invece di lasciarlo lì da interpretare. */
export function commento(risultato, nomeEsercizio) {
  if (risultato.completo === false) return "Rispondi a intensità e tecnica per completare la valutazione.";
  if (risultato.limite) {
    return `Il punteggio è fermo a ${risultato.totale}: ${risultato.limite.perche}. Finché resta così, il resto non lo alza.`;
  }
  if (risultato.penalita.length) {
    return `Il dolore al polso pesa più di ogni altra cosa: finché c'è, ${nomeEsercizio.toLowerCase()} non va caricato.`;
  }
  const validi = risultato.voci.filter((v) => v.quota != null);
  const peggiore = [...validi].sort((a, b) => a.quota - b.quota)[0];
  // «Nessun criterio resta indietro» va detto solo se è vero: con 92 di media
  // e il recupero al 40% c'era eccome un criterio indietro.
  if (risultato.totale >= 90 && peggiore && peggiore.quota >= 0.9) {
    return "Esecuzione piena: nessun criterio resta indietro.";
  }
  if (peggiore && peggiore.quota >= 0.9) return "Manca poco al pieno, e non c'è un punto debole singolo.";
  return peggiore ? `Il punto debole è ${peggiore.nome.toLowerCase()}: ${peggiore.dettaglio}.` : "";
}
