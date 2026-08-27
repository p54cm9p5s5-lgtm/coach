/* Verifica esaustiva del nucleo deterministico.
 *
 * Non è una raccolta di esempi: dove lo spazio degli ingressi è finito, questo
 * file lo percorre TUTTO. Per quelle funzioni «nessun difetto» smette di essere
 * una speranza e diventa una frase dimostrata — non su un campione scelto da
 * me, ma su ogni caso possibile.
 *
 * Cosa può stare qui: solo funzioni deterministiche, senza archivio, senza
 * rete, senza orologio. I dischi da montare, le date, le durate, i numeri.
 * Cosa NON può starci: tutto ciò che dipende da iOS, dal telefono, dai dati che
 * arrivano da fuori o dal momento in cui gira. Quella parte si prova, non si
 * dimostra, ed è bene che la differenza resti visibile.
 *
 * Si lancia dalla console dell'app:
 *     const v = await import('/tools/verifica-esaustiva.js'); await v.tutto();
 */

import {
  INVENTARIO_DEFAULT, combinazioneEsatta, carichiPossibili,
  combinazioneManubrio, carichiManubrio,
} from "../js/plates.js";
import { isoDate, parseIso, weekdayOf, dataLunga, dataBreve, giorniTra, durataUmana, mmss, num, oraDi } from "../js/ui.js";
import { punteggioEsercizio, punteggioAllenamento } from "../js/punteggio.js";
import * as store from "../js/store.js";

const arrotonda = (n) => Math.round(n * 100) / 100;

/** Un errore raccolto: cosa si stava provando e cosa è uscito. */
function esito(nome, casi, errori) {
  return { nome, casi, errori: errori.length, primi: errori.slice(0, 5), passata: errori.length === 0 };
}

/* ------------------------------------------------------------------ dischi */

/**
 * Tutte le combinazioni di dischi montabili su un lato, senza eccezioni.
 * Con l'inventario dichiarato sono 270: si generano una per una e si confronta
 * ognuna con quello che dice l'app.
 */
function tutteLeCombinazioniPerLato(inv) {
  const pesi = Object.keys(inv.dischi).map(Number);
  const perLato = Object.fromEntries(pesi.map((p) => [p, Math.floor(inv.dischi[p] / 2)]));
  const out = [];
  const gira = (i, presi, somma) => {
    if (i === pesi.length) {
      out.push({ presi: { ...presi }, somma: arrotonda(somma), quanti: Object.values(presi).reduce((a, b) => a + b, 0) });
      return;
    }
    const p = pesi[i];
    for (let n = 0; n <= perLato[p]; n++) {
      if (n) presi[p] = n;
      gira(i + 1, presi, somma + n * p);
      delete presi[p];
    }
  };
  gira(0, {}, 0);
  return out;
}

export function verificaDischi(inv = INVENTARIO_DEFAULT) {
  const errori = [];
  const combinazioni = tutteLeCombinazioniPerLato(inv);

  // Il carico minimo per ogni somma raggiungibile: serve a controllare che
  // l'app non solo trovi UNA combinazione giusta, ma la più economica.
  const minimoDischi = new Map();
  for (const c of combinazioni) {
    const tot = arrotonda(inv.barra + 2 * c.somma);
    if (!minimoDischi.has(tot) || c.quanti < minimoDischi.get(tot)) minimoDischi.set(tot, c.quanti);
  }

  // 1. ogni carico raggiungibile deve avere una combinazione, esatta e minima
  for (const [tot, quantiMin] of minimoDischi) {
    const r = combinazioneEsatta(tot, inv);
    if (!r) { errori.push(`${tot} kg è componibile ma l'app dice di no`); continue; }
    const somma = r.perLato.reduce((a, d) => a + d.peso * d.n, 0);
    const rifatto = arrotonda(r.barra + 2 * somma);
    if (Math.abs(rifatto - tot) > 0.001) errori.push(`${tot} kg: la combinazione fa ${rifatto}`);
    const quanti = r.perLato.reduce((a, d) => a + d.n, 0);
    if (quanti > quantiMin) errori.push(`${tot} kg: usa ${quanti} dischi, ne bastano ${quantiMin}`);
    for (const d of r.perLato) {
      const disponibili = Math.floor((inv.dischi[d.peso] ?? 0) / 2);
      if (d.n > disponibili) errori.push(`${tot} kg: chiede ${d.n}×${d.peso} per lato, ne hai ${disponibili}`);
      if (d.n <= 0 || !Number.isInteger(d.n)) errori.push(`${tot} kg: quantità assurda ${d.n}×${d.peso}`);
    }
  }

  // 2. ogni carico NON raggiungibile deve dire di no, su tutta la scala a passi
  //    di un quarto di chilo — più fine del disco più piccolo diviso due
  let controllatiNegativi = 0;
  const massimo = Math.max(...minimoDischi.keys());
  for (let x = 0; x <= massimo + 20; x = arrotonda(x + 0.25)) {
    if (minimoDischi.has(x)) continue;
    controllatiNegativi++;
    if (combinazioneEsatta(x, inv)) errori.push(`${x} kg non è componibile ma l'app dà una risposta`);
  }

  // 3. l'elenco dei carichi possibili deve coincidere, in tutt'e due i versi
  const elenco = new Set(carichiPossibili(inv).map(arrotonda));
  for (const t of minimoDischi.keys()) if (!elenco.has(t)) errori.push(`${t} kg manca dall'elenco dei carichi`);
  for (const t of elenco) if (!minimoDischi.has(t)) errori.push(`${t} kg è nell'elenco ma non è componibile`);

  // 4. carichi impossibili per natura
  for (const x of [-1, -0.5, -100]) {
    if (combinazioneEsatta(x, inv)) errori.push(`${x} kg: carico negativo accettato`);
  }

  return esito(
    "dischi del bilanciere",
    `${combinazioni.length} combinazioni · ${minimoDischi.size} carichi componibili · ${controllatiNegativi} non componibili`,
    errori
  );
}

export function verificaManubri(inv = INVENTARIO_DEFAULT) {
  const errori = [];
  let casi = 0;
  for (const paio of [true, false]) {
    const elenco = carichiManubrio(inv, paio) || [];
    for (const kg of elenco) {
      casi++;
      const r = combinazioneManubrio(kg, inv, paio);
      if (!r) { errori.push(`${paio ? "paio" : "singolo"} ${kg} kg: nell'elenco ma senza combinazione`); continue; }
      const somma = (r.perLato || []).reduce((a, d) => a + d.peso * d.n, 0);
      const rifatto = arrotonda((r.scarico ?? inv.manubri.regolabili.scaricoKg) + 2 * somma);
      if (Math.abs(rifatto - kg) > 0.001) errori.push(`${paio ? "paio" : "singolo"} ${kg} kg: la combinazione fa ${rifatto}`);
      for (const d of r.perLato || []) {
        const disponibili = Math.floor((inv.dischi[d.peso] ?? 0) / (paio ? 4 : 2));
        if (d.n > disponibili) errori.push(`${paio ? "paio" : "singolo"} ${kg} kg: chiede ${d.n}×${d.peso}, ne hai ${disponibili}`);
      }
    }
    // i pesi fuori elenco devono dire di no
    const set = new Set(elenco.map(arrotonda));
    for (let x = 0; x <= 60; x = arrotonda(x + 0.25)) {
      if (set.has(x)) continue;
      casi++;
      if (combinazioneManubrio(x, inv, paio)) errori.push(`${paio ? "paio" : "singolo"} ${x} kg: non componibile ma accettato`);
    }
  }
  return esito("dischi dei manubri", `${casi} casi, paio e singolo`, errori);
}

/* -------------------------------------------------------------------- date */

/** Ogni giorno dal 2020 al 2035: giro completo, non un campione. */
export function verificaDate() {
  const errori = [];
  const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  let casi = 0;
  const d = new Date(2020, 0, 1);
  const fine = new Date(2035, 11, 31);
  let precedente = null;
  while (d <= fine) {
    casi++;
    const iso = isoDate(d);
    // 1. andata e ritorno
    const tornata = parseIso(iso);
    if (isoDate(tornata) !== iso) errori.push(`${iso}: andata e ritorno dà ${isoDate(tornata)}`);
    // 2. giorno della settimana coerente con il calendario
    if (weekdayOf(iso) !== d.getDay()) errori.push(`${iso}: giorno della settimana ${weekdayOf(iso)} invece di ${d.getDay()}`);
    // 3. le forme leggibili non devono mai contenere buchi
    const lunga = dataLunga(iso), breve = dataBreve(iso);
    for (const [nome, testo] of [["lunga", lunga], ["breve", breve]]) {
      if (/NaN|undefined|Invalid|—/.test(testo)) errori.push(`${iso}: forma ${nome} = «${testo}»`);
    }
    if (!lunga.startsWith(GIORNI[d.getDay()])) errori.push(`${iso}: «${lunga}» non comincia con ${GIORNI[d.getDay()]}`);
    // 4. distanza fra giorni consecutivi = 1, e simmetrica
    if (precedente) {
      if (giorniTra(precedente, iso) !== 1) errori.push(`${precedente}→${iso}: distanza ${giorniTra(precedente, iso)}`);
      if (giorniTra(iso, precedente) !== -1) errori.push(`${iso}→${precedente}: distanza ${giorniTra(iso, precedente)}`);
    }
    precedente = iso;
    d.setDate(d.getDate() + 1);
  }
  return esito("date, ogni giorno dal 2020 al 2035", `${casi} giorni`, errori);
}

/** Date impossibili: devono dare «—», mai un giorno plausibile e sbagliato. */
export function verificaDateImpossibili() {
  const errori = [];
  let casi = 0;
  const p = (n) => String(n).padStart(2, "0");
  for (let m = 1; m <= 13; m++) {
    for (let g = 1; g <= 32; g++) {
      const iso = `2026-${p(m)}-${p(g)}`;
      const vera = new Date(2026, m - 1, g);
      const esiste = m >= 1 && m <= 12 && g >= 1 && vera.getMonth() === m - 1 && vera.getDate() === g;
      if (esiste) continue;
      casi++;
      if (dataBreve(iso) !== "—") errori.push(`${iso} non esiste ma dataBreve dà «${dataBreve(iso)}»`);
      if (dataLunga(iso) !== "—") errori.push(`${iso} non esiste ma dataLunga dà «${dataLunga(iso)}»`);
    }
  }
  for (const brutta of ["", "ieri", "2026", "2026-13-45", "26/08/2026", null, undefined, 12345, {}]) {
    casi++;
    if (dataBreve(brutta) !== "—") errori.push(`«${String(brutta)}» dà «${dataBreve(brutta)}»`);
  }
  return esito("date impossibili e scritte male", `${casi} casi`, errori);
}

/* ---------------------------------------------------------------- durate */

/** Ogni secondo da 0 a 25 ore: nessun buco, nessun salto all'indietro. */
export function verificaDurate() {
  const errori = [];
  let casi = 0;
  let precMinuti = -1;
  for (let s = 0; s <= 90000; s++) {
    casi++;
    const u = durataUmana(s), q = mmss(s);
    if (/NaN|undefined|Infinity/.test(u)) errori.push(`${s}s: durataUmana = «${u}»`);
    if (/NaN|undefined|Infinity/.test(q)) errori.push(`${s}s: mmss = «${q}»`);
    if (!/^\d{2,}:\d{2}$/.test(q)) errori.push(`${s}s: mmss fuori formato «${q}»`);
    // i minuti dichiarati non devono mai diminuire al crescere dei secondi
    const minuti = Math.round(s / 60);
    if (minuti < precMinuti) errori.push(`${s}s: i minuti tornano indietro`);
    precMinuti = minuti;
  }
  // Nessuna eccezione: un tempo negativo è un dato rotto per tutt'e due le
  // funzioni. Qui prima `-1` era escluso dal controllo su `mmss`, e quella
  // esclusione nascondeva proprio il difetto che questa verifica ha trovato.
  for (const brutto of [null, undefined, NaN, Infinity, -Infinity, -1, -0.5, -600, "", "molti", {}]) {
    casi++;
    if (durataUmana(brutto) !== "—") errori.push(`durataUmana(${String(brutto)}) = «${durataUmana(brutto)}»`);
    if (mmss(brutto) !== "—") errori.push(`mmss(${String(brutto)}) = «${mmss(brutto)}»`);
  }
  return esito("durate, ogni secondo fino a 25 ore", `${casi} casi`, errori);
}

/* ---------------------------------------------------------------- numeri */

export function verificaNumeri() {
  const errori = [];
  let casi = 0;
  for (let x = -100000; x <= 100000; x += 7) {
    casi++;
    const v = x / 10;
    const t = num(v);
    if (/NaN|undefined|Infinity|\./.test(t)) errori.push(`num(${v}) = «${t}»`);
    if (/^-0(,0*)?$/.test(t)) errori.push(`num(${v}) = «${t}» (meno zero)`);
  }
  for (const brutto of [null, undefined, NaN, Infinity, -Infinity, "", "tanti", {}]) {
    casi++;
    if (num(brutto) !== "—") errori.push(`num(${String(brutto)}) = «${num(brutto)}»`);
  }
  // orari: ogni minuto di una giornata
  const base = new Date(2026, 7, 26, 0, 0, 0).getTime();
  for (let m = 0; m < 1440; m++) {
    casi++;
    const t = oraDi(base + m * 60000);
    if (!/^\d{2}:\d{2}$/.test(t)) errori.push(`oraDi(+${m}min) = «${t}»`);
  }
  if (oraDi(NaN) !== "—") errori.push("oraDi(NaN) non dà il trattino");
  return esito("numeri e orari", `${casi} casi`, errori);
}

/* ------------------------------------------------------------------ tutto */

export async function tutto() {
  const regole = await store.regole();
  const prove = [verificaDischi(), verificaManubri(), verificaDate(), verificaDateImpossibili(), verificaDurate(), verificaNumeri(),
                 verificaInvariantiEsercizio(regole), verificaInvariantiAllenamento(regole)];
  const casiTotali = prove.reduce((a, p) => a + (parseInt(p.casi, 10) || 0), 0);
  const erroriTotali = prove.reduce((a, p) => a + p.errori, 0);
  return {
    prove,
    passate: prove.filter((p) => p.passata).length,
    suTotali: prove.length,
    erroriTotali,
    verdetto: erroriTotali === 0 ? "NESSUN DIFETTO su tutti i casi possibili" : `${erroriTotali} difetti`,
    nota: "Vale solo per il nucleo deterministico. iOS, il telefono, i dati che arrivano da fuori e il momento in cui gira restano fuori: quelli si provano, non si dimostrano.",
  };
}

/* --------------------------------------------------------------- punteggi */


/**
 * Gli invarianti del punteggio: le regole che devono valere SEMPRE, qualunque
 * siano gli ingressi.
 *
 * Non si controlla che un caso dia il numero atteso — quello è già coperto
 * dalla base di riferimento. Si controlla che certe cose non possano succedere
 * mai: un totale fuori dalla scala, un valore non numerico, un dolore che alza
 * il voto, un esercizio saltato che migliora la seduta. Sono gli errori che non
 * rompono niente e non si vedono: producono solo un numero sbagliato che sembra
 * giusto.
 */
export function verificaInvariantiEsercizio(regole) {
  const errori = [];
  let casi = 0;
  const serieDa = (n, rip, carico) =>
    Array.from({ length: n }, () => ({ ripFatte: rip, ripTarget: 10, carico, recuperoRealeSec: 90, recuperoTargetSec: 90 }));
  const variante = { esercizioId: "panca-piana", serie: 3, ripMin: 8, ripMax: 10, carico: 30, recuperoSec: 90 };

  const valuta = (o) => punteggioEsercizio({ variante, serie: serieDa(3, 10, 30), rpe: 7, tecnica: 8, dolori: [], dolorePolso: false, regole, ...o });

  for (let rip = 0; rip <= 20; rip++) {
    for (let carico = 0; carico <= 60; carico += 5) {
      for (let rpe = 1; rpe <= 10; rpe++) {
        for (let tec = 1; tec <= 10; tec++) {
          casi++;
          const base = { serie: serieDa(3, rip, carico), rpe, tecnica: tec };
          const r = valuta(base);
          // 1. il totale sta nella scala e non è mai un non-numero
          if (!Number.isFinite(r.totale)) { errori.push(`rip ${rip} carico ${carico} rpe ${rpe} tec ${tec}: totale ${r.totale}`); continue; }
          if (r.totale < 0 || r.totale > 100) errori.push(`rip ${rip} carico ${carico} rpe ${rpe} tec ${tec}: totale ${r.totale} fuori scala`);
          // 2. ogni voce ha peso positivo e quota nulla o fra 0 e 1
          for (const v of r.voci || []) {
            if (!(v.peso > 0)) errori.push(`${v.nome}: peso ${v.peso}`);
            if (v.quota !== null && !(v.quota >= 0 && v.quota <= 1)) errori.push(`${v.nome}: quota ${v.quota}`);
          }
          // 3. un dolore non può MAI alzare il voto
          const conDolore = valuta({ ...base, dolori: [{ id: "polso", nome: "polso destro", quando: "durante", intensita: "medio" }] });
          if (Number.isFinite(conDolore.totale) && conDolore.totale > r.totale)
            errori.push(`rip ${rip} rpe ${rpe} tec ${tec}: col dolore ${conDolore.totale} > senza ${r.totale}`);
          // 4. una tecnica migliore non può MAI abbassare il voto
          if (tec < 10) {
            const meglio = valuta({ ...base, tecnica: tec + 1 });
            if (Number.isFinite(meglio.totale) && meglio.totale < r.totale)
              errori.push(`rip ${rip} carico ${carico} rpe ${rpe}: tecnica ${tec + 1} dà ${meglio.totale} < tecnica ${tec} che dà ${r.totale}`);
          }
        }
      }
    }
  }
  return esito("invarianti del punteggio di un esercizio", `${casi} combinazioni`, errori);
}

export function verificaInvariantiAllenamento(regole) {
  const errori = [];
  let casi = 0;
  const cardio = { previsto: true, eseguito: true, durataMin: 30, durataPrevistaMin: 30, kmh: 4.5 };
  const chiama = (o) => punteggioAllenamento({
    previsti: 5, punteggi: [90, 90, 90, 90, 90], saltati: 0, cardio,
    riscaldamento: { fatto: true }, stretching: { fatto: true }, mobilita: { fatto: true }, regole, ...o,
  });

  for (let previsti = 0; previsti <= 8; previsti++) {
    for (let fatti = 0; fatti <= previsti; fatti++) {
      for (let saltati = 0; saltati <= previsti - fatti; saltati++) {
        for (const voto of [0, 40, 70, 100]) {
          casi++;
          const punteggi = Array.from({ length: fatti }, () => voto);
          const r = chiama({ previsti, punteggi, saltati });
          if (!Number.isFinite(r.totale)) { errori.push(`previsti ${previsti} fatti ${fatti} saltati ${saltati} voto ${voto}: totale ${r.totale}`); continue; }
          if (r.totale < 0 || r.totale > 100) errori.push(`previsti ${previsti} fatti ${fatti} saltati ${saltati} voto ${voto}: ${r.totale} fuori scala`);
          for (const v of r.voci || []) {
            if (!(v.peso > 0)) errori.push(`voce ${v.nome}: peso ${v.peso}`);
            if (v.quota !== null && !(v.quota >= 0 && v.quota <= 1)) errori.push(`voce ${v.nome}: quota ${v.quota}`);
          }
          // un esercizio saltato in più non può MAI far salire il punteggio
          if (saltati < previsti - fatti) {
            const peggio = chiama({ previsti, punteggi, saltati: saltati + 1 });
            if (Number.isFinite(peggio.totale) && peggio.totale > r.totale)
              errori.push(`previsti ${previsti} fatti ${fatti} voto ${voto}: con ${saltati + 1} saltati ${peggio.totale} > con ${saltati} che dà ${r.totale}`);
          }
          // saltare il cardio non può MAI far salire il punteggio
          const senzaCardio = chiama({ previsti, punteggi, saltati, cardio: { ...cardio, eseguito: false, durataMin: null } });
          if (Number.isFinite(senzaCardio.totale) && senzaCardio.totale > r.totale)
            errori.push(`previsti ${previsti} fatti ${fatti} saltati ${saltati} voto ${voto}: senza cardio ${senzaCardio.totale} > con cardio ${r.totale}`);
        }
      }
    }
  }
  return esito("invarianti del punteggio di una seduta", `${casi} combinazioni`, errori);
}
