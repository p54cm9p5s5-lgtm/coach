/* Logica di dominio: programma, allenamenti, serie, questionari, volumi. */

import * as db from "./db.js";
import { isoDate, weekdayOf, giorniTra } from "./ui.js";
import { INVENTARIO_DEFAULT } from "./plates.js";
import { valutaProgressione, firmaProposta, calcolaSegnali, nomeLivello } from "./segnali.js";
import { punteggioEsercizio, punteggioAllenamento } from "./punteggio.js";

let LIBRERIA = null;
let PROGRAMMA = null;
let RISCALDAMENTO = null;
let AGENDA = null;

// ---------- avvio ----------

export async function init() {
  await db.open();
  await caricaLibreria();
  await caricaRiscaldamento();
  PROGRAMMA = (await db.get("programma", "corrente")) || null;
  await caricaAgenda();
  return { libreria: LIBRERIA, programma: PROGRAMMA };
}

async function caricaRiscaldamento() {
  try {
    const r = await fetch("data/riscaldamento.json", { cache: "no-cache" });
    if (r.ok) RISCALDAMENTO = await r.json();
  } catch {
    /* offline al primissimo avvio: il riscaldamento resta senza dettaglio */
  }
  return RISCALDAMENTO;
}

/** Protocollo di riscaldamento per un giorno dello split. */
export function riscaldamento(giornoId) {
  if (!RISCALDAMENTO) return null;
  return {
    cardio: RISCALDAMENTO.cardio,
    serieDiAvvicinamento: RISCALDAMENTO.serieDiAvvicinamento,
    nota: RISCALDAMENTO.nota,
    ...(RISCALDAMENTO.giorni?.[giornoId] || { mobilita: [], stretchingFinale: [] }),
  };
}

/**
 * Il file è la fonte dei contenuti (istruzioni, cue, video predefiniti) e li
 * aggiorna a ogni avvio. Restano intoccate solo le personalizzazioni esplicite:
 * un video sostituito a mano non viene mai riscritto da un aggiornamento.
 */
async function caricaLibreria() {
  const salvati = await db.all("esercizi");
  const perId = new Map(salvati.map((e) => [e.id, e]));

  let dalFile = [];
  try {
    const r = await fetch("data/esercizi.json", { cache: "no-cache" });
    if (r.ok) dalFile = (await r.json()).esercizi || [];
  } catch {
    /* offline: si usa solo ciò che è già salvato */
  }

  const daScrivere = [];
  for (const nuovo of dalFile) {
    const vecchio = perId.get(nuovo.id);
    const unito = {
      ...nuovo,
      archiviato: vecchio?.archiviato ?? false,
      // il video scelto dall'utente vince sempre su quello del file
      ...(vecchio?.videoPersonalizzato
        ? { video: vecchio.video, videoPersonalizzato: true }
        : {}),
    };
    if (JSON.stringify(vecchio) !== JSON.stringify(unito)) daScrivere.push(unito);
    perId.set(nuovo.id, unito);
  }
  if (daScrivere.length) await db.putMany("esercizi", daScrivere);

  LIBRERIA = [...perId.values()];
  return LIBRERIA;
}

export const ricaricaLibreria = caricaLibreria;
export const libreria = () => LIBRERIA || [];
export const esercizio = (id) => (LIBRERIA || []).find((e) => e.id === id) || null;
export const programma = () => PROGRAMMA;

// ---------- impostazioni ----------

const DEFAULT_IMPOSTAZIONI = {
  obiettivoMovimentoKcal: 600,
  finestraImportGiorni: 30,
  suonoFineRecupero: true,
  ultimoSnapshot: null,
  ultimoExport: null,
  snapshotAutomatico: null,
  ultimoImportSalute: null,
};

export async function impostazione(chiave) {
  const r = await db.get("impostazioni", chiave);
  return r ? r.valore : DEFAULT_IMPOSTAZIONI[chiave];
}

export async function impostazioni() {
  const righe = await db.all("impostazioni");
  const out = { ...DEFAULT_IMPOSTAZIONI };
  for (const r of righe) out[r.chiave] = r.valore;
  return out;
}

export function setImpostazione(chiave, valore) {
  return db.put("impostazioni", { chiave, valore });
}

export async function inventario() {
  return (PROGRAMMA && PROGRAMMA.inventario) || INVENTARIO_DEFAULT;
}

// ---------- programma ----------

export async function applicaBrief(dati) {
  const precedente = PROGRAMMA;
  const record = {
    id: "corrente",
    versione: dati.versione,
    aggiornatoIl: dati.aggiornatoIl || isoDate(),
    caricatoIl: new Date().toISOString(),
    atleta: dati.atleta || {},
    inventario: dati.inventario || INVENTARIO_DEFAULT,
    regole: dati.regole || {},
    split: dati.split || [],
    note: dati.note || null,
  };
  await db.put("programma", record);
  PROGRAMMA = record;

  // Esercizi non più previsti: archiviati, mai cancellati (lo storico resta).
  const usati = new Set(record.split.flatMap((g) => (g.esercizi || []).map((v) => v.esercizioId)));
  const daArchiviare = (LIBRERIA || [])
    .filter((e) => !usati.has(e.id) && !e.archiviato)
    .map((e) => ({ ...e, archiviato: true }));
  const daRiattivare = (LIBRERIA || [])
    .filter((e) => usati.has(e.id) && e.archiviato)
    .map((e) => ({ ...e, archiviato: false }));
  if (daArchiviare.length) await db.putMany("esercizi", daArchiviare);
  if (daRiattivare.length) await db.putMany("esercizi", daRiattivare);
  if (daArchiviare.length || daRiattivare.length) await caricaLibreria();

  // Il brief nuovo può contenere giorni che prima non esistevano: gli eventi
  // del calendario rimasti senza abbinamento vanno riprovati adesso.
  await riabbinaAgenda();

  await registraDecisione({
    oggetto: "Programma aggiornato dal master brief",
    livello: null,
    testo: precedente
      ? `Caricato brief del ${record.aggiornatoIl}.`
      : `Primo caricamento del programma (brief del ${record.aggiornatoIl}).`,
    fonte: "app",
  });

  return record;
}

/** Giorno dello split previsto per una data, o null se è riposo. */
/**
 * Cosa tocca in un dato giorno.
 * Gli allenamenti li decide il coach e li scrive sul calendario: se per quel
 * giorno c'è un evento, comanda quello. Lo split del brief resta la regola di
 * base, usata finché il calendario non dice altro.
 */
export function agendaAttiva() {
  return Boolean(AGENDA && AGENDA.size);
}

export function giornoPrevisto(iso = isoDate()) {
  if (!PROGRAMMA) return null;
  const ev = AGENDA?.get(iso);
  if (ev) {
    if (ev.giornoId === "riposo") return null;
    if (ev.giornoId) return giornoSplit(ev.giornoId);
    // evento che non corrisponde a nessun giorno del brief: l'app non inventa
    // il contenuto, lo segnala e basta
    return null;
  }
  // Calendario collegato: comanda lui anche sui giorni che non nomina. Un
  // giorno senza evento è un giorno senza allenamento, non un giorno da
  // riempire con lo split.
  if (agendaAttiva()) return null;
  const wd = weekdayOf(iso);
  return (PROGRAMMA.split || []).find((g) => g.giorno === wd) || null;
}

/** Da dove viene quello che l'app mostra per un giorno: serve a dirlo a schermo. */
export function origineGiorno(iso = isoDate()) {
  const ev = AGENDA?.get(iso);
  if (!ev) return agendaAttiva() ? { fonte: "calendario", vuoto: true } : { fonte: "split" };
  if (ev.giornoId === "riposo") return { fonte: "calendario", titolo: ev.titolo, riposo: true };
  if (ev.giornoId) {
    const wd = weekdayOf(iso);
    const daSplit = (PROGRAMMA?.split || []).find((g) => g.giorno === wd) || null;
    return { fonte: "calendario", titolo: ev.titolo, diverso: (daSplit?.id ?? null) !== ev.giornoId };
  }
  return { fonte: "calendario", titolo: ev.titolo, sconosciuto: true };
}

export function giorniSplit() {
  return (PROGRAMMA && PROGRAMMA.split) || [];
}

export function giornoSplit(id) {
  return giorniSplit().find((g) => g.id === id) || null;
}

export function regole() {
  const r = (PROGRAMMA && PROGRAMMA.regole) || {};
  return {
    rpeTarget: { min: 6, max: 8 },
    cardio: { kmhMin: 4.5, kmhMax: 5, fcMin: 105, fcMax: 115, fcLimite: 125, durataMin: 30 },
    progressione: { esposizioniMinime: 2, rpePerSalire: 7, tecnicaMinima: 8, tecnicaRiduzione: 5 },
    finestra: { settimane: 3, minimoSettimana: 5, soglia: 0.2 },
    ...r,
  };
}

/** La riga dello split che riguarda un esercizio: serie, range, carico di partenza. */
export function varianteDi(esercizioId) {
  for (const g of giorniSplit()) {
    const v = (g.esercizi || []).find((x) => x.esercizioId === esercizioId);
    if (v) return v;
  }
  return null;
}

export function varianti() {
  const m = new Map();
  for (const g of giorniSplit()) {
    for (const v of g.esercizi || []) if (!m.has(v.esercizioId)) m.set(v.esercizioId, v);
  }
  return m;
}

// ---------- allenamenti ----------

export async function allenamenti() {
  const s = await db.all("sedute");
  return s.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

export async function seduta(id) {
  return db.get("sedute", id);
}

export async function sedutaInCorso() {
  const s = await db.all("sedute");
  return s.find((x) => x.stato === "inCorso") || null;
}

export async function iniziaSeduta({ data = isoDate(), giornoId }) {
  const g = giornoSplit(giornoId);
  if (!g) throw new Error("Giorno dello split non trovato.");
  const rec = {
    id: db.nuovoId("sed"),
    data,
    tipoId: g.id,
    tipoNome: g.nome,
    tipoProgrammatoId: giornoPrevisto(data)?.id || null,
    stato: "inCorso",
    oraInizio: Date.now(),
    oraFine: null,
    riscaldamento: { fatto: false, modalita: null, note: null },
    cardio: { previsto: Boolean(g.cardio), eseguito: false, kmh: null, durataMin: null, note: null },
    notaGenerale: null,
    progresso: { fase: "riscaldamento", indice: 0 },
    creatoIl: new Date().toISOString(),
    fonte: "app",
  };
  await db.put("sedute", rec);
  return rec;
}

export async function aggiornaSeduta(id, patch) {
  const s = await db.get("sedute", id);
  if (!s) throw new Error("Seduta non trovata.");
  const agg = { ...s, ...patch };
  await db.put("sedute", agg);
  return agg;
}

export async function chiudiSeduta(id, { notaGenerale } = {}) {
  const s = await db.get("sedute", id);
  if (!s) throw new Error("Questa seduta non esiste più: forse è stata eliminata altrove.");
  const agg = {
    ...s,
    stato: "completata",
    oraFine: Date.now(),
    notaGenerale: notaGenerale ?? s.notaGenerale,
    progresso: { fase: "fine", indice: 0 },
  };
  await db.put("sedute", agg);
  return agg;
}

export async function annullaSeduta(id) {
  const serie = await db.byIndex("serie", "sedutaId", id);
  const logs = await db.byIndex("esercizioLog", "sedutaId", id);
  for (const r of serie) await db.del("serie", r.id);
  for (const r of logs) await db.del("esercizioLog", r.id);
  await db.del("sedute", id);
}

// ---------- serie ----------

export async function serieDi(sedutaId) {
  const r = await db.byIndex("serie", "sedutaId", sedutaId);
  return r.sort((a, b) => a.tsFineSerie - b.tsFineSerie);
}

export async function registraSerie({
  sedutaId,
  esercizioId,
  numero,
  carico,
  ripFatte,
  ripTarget,
  aTempo = false,
  tsInizioSerie,
  recuperoTargetSec,
}) {
  const precedenti = (await db.byIndex("serie", "sedutaId", sedutaId)).filter(
    (s) => s.esercizioId === esercizioId
  );
  const ultima = precedenti.sort((a, b) => a.tsFineSerie - b.tsFineSerie).at(-1);
  const inizio = tsInizioSerie || (ultima ? ultima.tsFineSerie : Date.now());

  const rec = {
    id: db.nuovoId("ser"),
    sedutaId,
    esercizioId,
    numero,
    carico: carico ?? null,
    ripFatte: ripFatte ?? null,
    ripTarget: ripTarget ?? null,
    aTempo,
    tsInizioSerie: inizio,
    tsFineSerie: Date.now(),
    recuperoTargetSec: recuperoTargetSec ?? null,
    // il recupero che PRECEDE questa serie
    recuperoRealeSec: ultima ? Math.round((inizio - ultima.tsFineSerie) / 1000) : null,
    creatoIl: new Date().toISOString(),
    fonte: "app",
  };
  await db.put("serie", rec);
  return rec;
}

export async function eliminaUltimaSerie(sedutaId, esercizioId) {
  const tutte = (await db.byIndex("serie", "sedutaId", sedutaId))
    .filter((s) => s.esercizioId === esercizioId)
    .sort((a, b) => a.tsFineSerie - b.tsFineSerie);
  const ultima = tutte.at(-1);
  if (ultima) await db.del("serie", ultima.id);
  return ultima || null;
}

// ---------- questionario ----------

export async function registraQuestionario({
  sedutaId,
  esercizioId,
  ordine,
  punteggio = null,
  rpe,
  tecnica,
  dolorePolso,
  dolorePolsoQuando,
  dolorePolsoIntensita,
  nota,
}) {
  const esistenti = await db.byIndex("esercizioLog", "sedutaId", sedutaId);
  const prec = esistenti.find((l) => l.esercizioId === esercizioId);
  const rec = {
    id: prec?.id || db.nuovoId("log"),
    sedutaId,
    esercizioId,
    ordine,
    punteggio,
    rpe: rpe ?? null,
    tecnica: tecnica ?? null,
    dolorePolso: Boolean(dolorePolso),
    dolorePolsoQuando: dolorePolso ? dolorePolsoQuando || null : null,
    dolorePolsoIntensita: dolorePolso ? dolorePolsoIntensita || null : null,
    nota: (nota || "").trim() || null,
    saltato: null,
    creatoIl: new Date().toISOString(),
    fonte: "app",
  };
  await db.put("esercizioLog", rec);
  return rec;
}

export async function registraSalto({ sedutaId, esercizioId, ordine, motivo, nota }) {
  const esistenti = await db.byIndex("esercizioLog", "sedutaId", sedutaId);
  const prec = esistenti.find((l) => l.esercizioId === esercizioId);
  const rec = {
    id: prec?.id || db.nuovoId("log"),
    sedutaId,
    esercizioId,
    ordine,
    rpe: null,
    tecnica: null,
    dolorePolso: false,
    dolorePolsoQuando: null,
    dolorePolsoIntensita: null,
    nota: (nota || "").trim() || null,
    saltato: { motivo, nota: (nota || "").trim() || null },
    creatoIl: new Date().toISOString(),
    fonte: "app",
  };
  await db.put("esercizioLog", rec);
  return rec;
}

export async function questionariDi(sedutaId) {
  const r = await db.byIndex("esercizioLog", "sedutaId", sedutaId);
  return r.sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0));
}

/**
 * Completezza di un allenamento, ricalcolata dai dati grezzi ogni volta.
 * Non si legge il punteggio salvato: se i criteri cambiano, cambiano anche i
 * punteggi vecchi, e due allenamenti restano confrontabili fra loro.
 */
export async function completezzaSeduta(id) {
  const sed = await db.get("sedute", id);
  if (!sed) return null;
  const giorno = giornoSplit(sed.tipoId);
  const serie = await serieDi(id);
  const logs = await questionariDi(id);
  const reg = regole();

  const punteggi = [];
  let saltati = 0;
  const perEsercizio = new Map();
  for (const v of giorno?.esercizi || []) {
    const log = logs.find((l) => l.esercizioId === v.esercizioId);
    if (!log) continue;
    if (log.saltato) {
      saltati++;
      continue;
    }
    const r = punteggioEsercizio({
      variante: v,
      serie: serie.filter((s) => s.esercizioId === v.esercizioId),
      rpe: log.rpe,
      tecnica: log.tecnica,
      dolorePolso: Boolean(log.dolorePolso),
      regole: reg,
    });
    punteggi.push(r.totale);
    perEsercizio.set(v.esercizioId, r);
  }

  const totale = punteggioAllenamento({
    previsti: giorno?.esercizi?.length ?? logs.length,
    punteggi,
    saltati,
    cardio: sed.cardio,
    riscaldamento: Boolean(sed.riscaldamento?.fatto),
    stretching: Boolean(sed.stretching?.fatto),
    regole: reg,
  });

  return { ...totale, perEsercizio };
}

/** Quante righe ci sono davvero in archivio, per categoria. */
export async function conteggioArchivio() {
  const sedute = await db.all("sedute");
  const date = sedute.map((s) => s.data).sort();
  return {
    allenamenti: sedute.filter((s) => s.stato === "completata").length,
    aperti: sedute.filter((s) => s.stato !== "completata").length,
    serie: await db.count("serie"),
    questionari: await db.count("esercizioLog"),
    misure: await db.count("misure"),
    foto: await db.count("foto"),
    giorniSalute: (await db.all("giorniSalute")).filter((g) => g.presente !== false).length,
    notti: (await db.all("notti")).filter((n) => n.presente !== false).length,
    primo: date[0] ? date[0].split("-").reverse().join("/") : null,
  };
}

// ---------- storico per esercizio ----------

/** Esposizioni passate di un esercizio, dalla più recente. */
export async function esposizioni(esercizioId, { soloCompletate = true } = {}) {
  const serie = await db.byIndex("serie", "esercizioId", esercizioId);
  const logs = await db.byIndex("esercizioLog", "esercizioId", esercizioId);
  const tutteSedute = await db.all("sedute");
  const perId = new Map(tutteSedute.map((s) => [s.id, s]));

  const perSeduta = new Map();
  for (const s of serie) {
    if (!perSeduta.has(s.sedutaId)) perSeduta.set(s.sedutaId, { serie: [], log: null });
    perSeduta.get(s.sedutaId).serie.push(s);
  }
  for (const l of logs) {
    if (!perSeduta.has(l.sedutaId)) perSeduta.set(l.sedutaId, { serie: [], log: null });
    perSeduta.get(l.sedutaId).log = l;
  }

  const out = [];
  for (const [sedutaId, v] of perSeduta) {
    const sed = perId.get(sedutaId);
    if (!sed) continue;
    if (soloCompletate && sed.stato !== "completata") continue;
    v.serie.sort((a, b) => a.tsFineSerie - b.tsFineSerie);
    out.push({
      sedutaId,
      data: sed.data,
      serie: v.serie,
      log: v.log,
      saltato: v.log?.saltato || null,
      caricoMax: v.serie.reduce((m, s) => Math.max(m, s.carico ?? 0), 0) || null,
      caricoLavoro: v.serie.length ? v.serie.at(-1).carico ?? null : null,
      rpe: v.log?.rpe ?? null,
      tecnica: v.log?.tecnica ?? null,
    });
  }
  return out.sort((a, b) => (a.data < b.data ? 1 : -1));
}

/** Ultimo carico usato (per precompilare la serie). */
export async function ultimoCarico(esercizioId, fallback = null) {
  const e = await esposizioni(esercizioId, { soloCompletate: false });
  for (const x of e) {
    const c = x.serie.filter((s) => s.carico != null).at(-1)?.carico;
    if (c != null) return c;
  }
  return fallback;
}

// ---------- volumi ----------

/** Serie settimanali per pattern, calcolate dallo split. */
export function volumePerPattern() {
  const out = new Map();
  for (const g of giorniSplit()) {
    for (const v of g.esercizi || []) {
      const def = esercizio(v.esercizioId);
      if (!def) continue;
      const p = def.pattern || "altro";
      out.set(p, (out.get(p) || 0) + (v.serie || 0));
    }
  }
  return [...out.entries()]
    .map(([pattern, serie]) => ({ pattern, serie }))
    .sort((a, b) => b.serie - a.serie);
}

export const ETICHETTE_PATTERN = {
  spinta: "Spinta",
  tirataOrizzontale: "Tirata orizzontale",
  tirataVerticale: "Tirata verticale",
  quadricipiti: "Quadricipiti",
  femorali: "Femorali",
  polpacci: "Polpacci",
  core: "Core",
  deltoideLaterale: "Deltoide laterale",
  deltoidePosteriore: "Deltoide posteriore",
  trapezi: "Trapezi",
  bicipiti: "Bicipiti isolati",
  tricipiti: "Tricipiti isolati",
  dorsaliAltro: "Dorsali (altro)",
};

// ---------- decisioni ----------

export async function registraDecisione({
  oggetto,
  livello,
  testo,
  fonte = "app",
  dataVerifica = null,
  propostaId = null,
}) {
  const rec = {
    id: db.nuovoId("dec"),
    data: isoDate(),
    oggetto,
    livello,
    testo,
    fonte,
    dataVerifica,
    esitoVerifica: null,
    propostaId,
    creatoIl: new Date().toISOString(),
  };
  await db.put("decisioni", rec);
  return rec;
}

export async function decisioni() {
  const r = await db.all("decisioni");
  return r.sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1));
}

// ---------- proposte ----------

export async function proposte(stato = null) {
  const r = await db.all("proposte");
  const f = stato ? r.filter((p) => p.stato === stato) : r;
  return f.sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1));
}

export const proposteInSospeso = () => proposte("inSospeso");

export async function proposta(id) {
  return db.get("proposte", id);
}

/**
 * Ricalcola le proposte di progressione per tutto lo split.
 *
 * Il motore è senza memoria: ogni giro riparte dai dati. Quello che la memoria
 * serve a evitare è ripetere una proposta a cui l'atleta ha già risposto —
 * accettata o rifiutata non si ripropone, rimandata torna dopo la prossima
 * esposizione. Una proposta in sospeso che non regge più ai dati viene tolta:
 * meglio niente che un consiglio scaduto.
 */
export async function aggiornaProposte(cache = null) {
  if (!PROGRAMMA) return { create: 0, tolte: 0 };
  const oggi = isoDate();
  const reg = regole();
  const inv = await inventario();
  const esistenti = await db.all("proposte");
  let create = 0;
  let tolte = 0;

  for (const [esercizioId, variante] of varianti()) {
    const def = esercizio(esercizioId);
    if (!def || def.archiviato) continue;

    const esp = cache?.get(esercizioId) ?? (await esposizioni(esercizioId));
    const { proposta: nuova } = valutaProgressione({
      variante,
      def,
      esposizioni: esp,
      regole: reg,
      inventario: inv,
      oggi,
    });

    const mie = esistenti.filter((p) => p.esercizioId === esercizioId);
    const sospese = mie.filter((p) => p.stato === "inSospeso");

    if (!nuova) {
      for (const p of sospese) {
        await db.del("proposte", p.id);
        tolte++;
      }
      continue;
    }

    const firma = firmaProposta(nuova);
    const rispostaPrec = mie
      .filter((p) => p.firma === firma && p.stato !== "inSospeso")
      .sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1))[0];

    if (rispostaPrec) {
      if (rispostaPrec.stato !== "rimandata") continue;
      // rimandata: torna solo quando c'è un dato nuovo
      if (esp.length <= (rispostaPrec.esposizioniAllaData ?? 0)) continue;
    }

    if (sospese.some((p) => p.firma === firma)) continue;

    for (const p of sospese) {
      await db.del("proposte", p.id);
      tolte++;
    }
    await db.put("proposte", {
      id: db.nuovoId("pro"),
      data: oggi,
      stato: "inSospeso",
      firma,
      esposizioniAllaData: esp.length,
      esitoVerifica: null,
      rispostoIl: null,
      creatoIl: new Date().toISOString(),
      fonte: "app",
      ...nuova,
    });
    create++;
  }

  return { create, tolte };
}

/**
 * Perché un esercizio non ha una proposta. Serve a rendere visibile il
 * silenzio del motore: «nessuna proposta» senza motivo è indistinguibile da
 * un motore rotto.
 */
export async function diagnosiProgressione() {
  const reg = regole();
  const inv = await inventario();
  const out = [];
  for (const [esercizioId, variante] of varianti()) {
    const def = esercizio(esercizioId);
    if (!def || def.archiviato) continue;
    const esp = await esposizioni(esercizioId);
    const { proposta, motivo } = valutaProgressione({
      variante,
      def,
      esposizioni: esp,
      regole: reg,
      inventario: inv,
      oggi: isoDate(),
    });
    out.push({ esercizioId, nome: def.nome, esposizioni: esp.length, proposta, motivo });
  }
  return out;
}

const ETICHETTA_ESITO = {
  accettata: "accettata",
  rifiutata: "rifiutata",
  rimandata: "rimandata",
};

/** Accetto / Rifiuto / Rimando. L'esito finisce sempre nel registro decisioni. */
export async function rispondiAProposta(id, stato, { nota = null } = {}) {
  const p = await db.get("proposte", id);
  if (!p) throw new Error("Questa proposta non esiste più.");
  if (!ETICHETTA_ESITO[stato]) throw new Error(`Esito non previsto: ${stato}.`);

  const agg = { ...p, stato, rispostoIl: new Date().toISOString(), notaRisposta: nota };
  await db.put("proposte", agg);

  await registraDecisione({
    oggetto: p.titolo,
    livello: p.livelloGerarchia,
    testo:
      `Proposta ${ETICHETTA_ESITO[stato]} (livello ${p.livelloGerarchia} — ${nomeLivello(p.livelloGerarchia)}).` +
      (nota ? ` Nota: ${nota}` : ""),
    fonte: "app",
    dataVerifica: stato === "accettata" ? p.dataVerifica : null,
    propostaId: p.id,
  });

  return agg;
}

/**
 * L'obiettivo in vigore per un esercizio: viene da una proposta accettata e
 * vale per la prossima esposizione, poi il motore rivaluta sui dati nuovi.
 */
export async function obiettivoCorrente(esercizioId) {
  const mie = (await db.byIndex("proposte", "esercizioId", esercizioId))
    .filter((p) => p.stato === "accettata")
    .sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1));
  const p = mie[0];
  if (!p) return null;
  const esp = await esposizioni(esercizioId);
  if (esp.length !== p.esposizioniAllaData) return null; // già consumato da una nuova esposizione
  return { carico: p.a.carico, rip: p.a.rip, tipo: p.tipo, propostaId: p.id, titolo: p.titolo };
}

/** Proposte accettate arrivate alla data di verifica e ancora senza esito. */
export async function verificheDovute() {
  const oggi = isoDate();
  const r = await db.all("proposte");
  return r
    .filter((p) => p.stato === "accettata" && !p.esitoVerifica && p.dataVerifica && p.dataVerifica <= oggi)
    .sort((a, b) => (a.dataVerifica < b.dataVerifica ? -1 : 1));
}

export async function chiudiVerifica(id, esito, { nota = null } = {}) {
  const p = await db.get("proposte", id);
  if (!p) throw new Error("Questa proposta non esiste più.");
  const agg = { ...p, esitoVerifica: { esito, nota, data: isoDate() } };
  await db.put("proposte", agg);

  const decs = await db.all("decisioni");
  const legata = decs.filter((d) => d.propostaId === id).sort((a, b) => (a.creatoIl < b.creatoIl ? 1 : -1))[0];
  if (legata) await db.put("decisioni", { ...legata, esitoVerifica: { esito, nota, data: isoDate() } });

  await registraDecisione({
    oggetto: `Verifica: ${p.titolo}`,
    livello: p.livelloGerarchia,
    testo: esito === "confermata" ? `Confermata.${nota ? ` ${nota}` : ""}` : `Non confermata.${nota ? ` ${nota}` : ""}`,
    fonte: "app",
    propostaId: id,
  });

  return agg;
}

// ---------- segnali ----------

export async function segnali({ inclusiArchiviati = false } = {}) {
  const r = await db.all("segnali");
  const f = inclusiArchiviati ? r : r.filter((s) => !s.archiviato);
  const peso = { attenzione: 0, info: 1 };
  return f.sort((a, b) => (peso[a.gravita] ?? 2) - (peso[b.gravita] ?? 2));
}

/**
 * Ricalcola i segnali. Gli id sono deterministici: un segnale che persiste
 * viene riscritto, non duplicato, e quello che non regge più sparisce.
 * L'archiviazione decisa dall'atleta sopravvive al ricalcolo, ma solo finché
 * il messaggio resta identico: se il segnale cambia, torna a farsi vedere.
 */
export async function aggiornaSegnali(cache = null) {
  const complete = (await allenamenti()).filter((s) => s.stato === "completata");
  // I segnali guardano indietro di quattro allenamenti: leggere i questionari di
  // tutto lo storico a ogni giro sarebbe lavoro buttato via.
  const logsPerSeduta = new Map();
  for (const s of complete.slice(0, 4)) logsPerSeduta.set(s.id, await questionariDi(s.id));

  const mappaVarianti = varianti();
  const esposizioniPerEsercizio = cache || (await mappaEsposizioni());

  const giorni = await giorniSalute();
  const nottiTutte = await notti();
  const reg = regole();
  const conf = { settimane: reg.finestra.settimane, minimoSettimana: reg.finestra.minimoSettimana };

  const nuovi = calcolaSegnali({
    allenamenti: complete,
    logsPerSeduta,
    esercizi: new Map(libreria().map((e) => [e.id, e])),
    varianti: mappaVarianti,
    esposizioniPerEsercizio,
    giorniSalute: giorni,
    notti: nottiTutte,
    finestraMovimento: giorni.length ? statoFinestra(giorni, conf) : null,
    finestraSonno: nottiTutte.length ? statoFinestra(nottiTutte, conf) : null,
    regole: reg,
    oggi: isoDate(),
  });

  const vecchi = new Map((await db.all("segnali")).map((s) => [s.id, s]));
  const vivi = new Set(nuovi.map((s) => s.id));

  for (const s of nuovi) {
    const prec = vecchi.get(s.id);
    const invariato = prec && prec.messaggio === s.messaggio && prec.dettaglio === s.dettaglio;
    await db.put("segnali", {
      ...s,
      archiviato: invariato ? Boolean(prec.archiviato) : false,
      creatoIl: prec?.creatoIl || new Date().toISOString(),
    });
  }
  for (const id of vecchi.keys()) if (!vivi.has(id)) await db.del("segnali", id);

  return nuovi.length;
}

export async function archiviaSegnale(id) {
  const s = await db.get("segnali", id);
  if (!s) return null;
  const agg = { ...s, archiviato: true };
  await db.put("segnali", agg);
  return agg;
}

async function mappaEsposizioni() {
  const m = new Map();
  for (const id of varianti().keys()) m.set(id, await esposizioni(id));
  return m;
}

/** Un solo giro: proposte e segnali si ricalcolano insieme, sugli stessi dati. */
export async function aggiornaMotore() {
  const cache = await mappaEsposizioni();
  const p = await aggiornaProposte(cache);
  const s = await aggiornaSegnali(cache);
  return { proposte: p, segnali: s };
}

// ---------- misure ----------

export async function misure(tipo = null) {
  const r = await db.all("misure");
  const f = tipo ? r.filter((m) => m.tipo === tipo) : r;
  return f.sort((a, b) => (a.data < b.data ? 1 : -1));
}

export async function registraMisura({ data = isoDate(), tipo, valore, condizioniStandard = true }) {
  const rec = {
    id: db.nuovoId("mis"),
    data,
    tipo,
    valore,
    condizioniStandard,
    creatoIl: new Date().toISOString(),
    fonte: "app",
  };
  await db.put("misure", rec);
  return rec;
}

export async function ultimaMisura(tipo) {
  const m = await misure(tipo);
  return m[0] || null;
}

/** Giorni trascorsi dall'ultima misura di un tipo, null se non ce n'è. */
export async function giorniDaUltimaMisura(tipo) {
  const m = await ultimaMisura(tipo);
  return m ? giorniTra(m.data, isoDate()) : null;
}

// ---------- import dati Salute ----------

/**
 * Applica un pacchetto già analizzato. È idempotente: la chiave è la data
 * (o l'uuid per gli allenamenti), quindi reimportare gli stessi giorni
 * riscrive, non duplica.
 *
 * Un giorno della finestra che non compare nel pacchetto viene segnato come
 * non registrato — ma un giorno già presente non viene mai declassato: se il
 * dato c'era, un export incompleto non deve cancellarlo.
 */
export async function importaSalute(pacchetto) {
  const conteggio = { giorni: 0, notti: 0, allenamenti: 0, vuoti: 0, aggiornati: 0 };

  /**
   * Fonde solo i campi valorizzati: due righe per lo stesso giorno, una con le
   * kcal e una con i passi, si sommano invece di cancellarsi. Serve a tenere
   * semplice il comando rapido, che può produrre un blocco di righe per tipo
   * senza doverli incrociare per data.
   */
  const fondi = (prec, nuovo) => {
    const out = { ...(prec || {}), ...{ data: nuovo.data } };
    for (const [k, v] of Object.entries(nuovo)) {
      if (v !== null && v !== undefined) out[k] = v;
    }
    out.presente = Boolean(prec?.presente) || Boolean(nuovo.presente);
    return out;
  };

  for (const g of pacchetto.giorni) {
    const prec = await db.get("giorniSalute", g.data);
    if (prec?.presente) conteggio.aggiornati++;
    await db.put("giorniSalute", {
      ...fondi(prec, g),
      fonte: "salute",
      importatoIl: new Date().toISOString(),
    });
    conteggio.giorni++;
  }

  for (const n of pacchetto.notti) {
    const prec = await db.get("notti", n.data);
    await db.put("notti", {
      ...fondi(prec, n),
      fonte: "salute",
      importatoIl: new Date().toISOString(),
    });
    conteggio.notti++;
  }

  for (const a of pacchetto.allenamenti) {
    const prec = await db.get("allenamentiWatch", a.uuid);
    await db.put("allenamentiWatch", {
      ...a,
      sedutaId: prec?.sedutaId ?? null, // il collegamento a una seduta non si perde
      fonte: "salute",
      importatoIl: new Date().toISOString(),
    });
    conteggio.allenamenti++;
  }

  if (pacchetto.finestra) {
    const { giorniDellaFinestra } = await import("./salute.js");
    const conDati = new Set(pacchetto.giorni.map((g) => g.data));
    const nottiConDati = new Set(pacchetto.notti.map((n) => n.data));
    for (const data of giorniDellaFinestra(pacchetto.finestra.da, pacchetto.finestra.a)) {
      if (!conDati.has(data)) {
        const prec = await db.get("giorniSalute", data);
        if (!prec?.presente) {
          await db.put("giorniSalute", { data, presente: false, fonte: "salute" });
          conteggio.vuoti++;
        }
      }
      if (!nottiConDati.has(data)) {
        const prec = await db.get("notti", data);
        if (!prec?.presente) await db.put("notti", { data, presente: false, fonte: "salute" });
      }
    }
  }

  if (pacchetto.agenda?.length) {
    // L'agenda vive dentro le impostazioni, non in uno store suo: aggiungere
    // uno store significherebbe cambiare versione al database, e un
    // aggiornamento di schema che va storto sul telefono è un rischio che
    // questi dati non valgono.
    const precedente = (await impostazione("agenda")) || {};
    const ora = new Date().toISOString();

    // Nello stesso giorno possono esserci più eventi: l'allenamento e un
    // promemoria («Misura la pressione», «Foto progressi»). Vince quello che
    // corrisponde a un giorno del programma, indipendentemente dall'ordine in
    // cui il comando rapido li ha messi in fila.
    const perData = new Map();
    for (const e of pacchetto.agenda) {
      const giornoId = abbinaAlloSplit(e.titolo);
      const scelto = perData.get(e.data);
      if (scelto && scelto.giornoId && !giornoId) continue;
      perData.set(e.data, {
        data: e.data,
        titolo: e.titolo,
        nota: e.nota ?? null,
        giornoId,
        importatoIl: ora,
      });
    }
    // Contano i giorni, non gli eventi: due eventi lo stesso giorno restano
    // un giorno solo.
    conteggio.agenda = perData.size;
    // Il pacchetto copre un intervallo continuo: dentro quell'intervallo è la
    // verità completa. Le date che il calendario non nomina più vanno svuotate,
    // altrimenti un allenamento cancellato dal coach resterebbe qui per sempre.
    const lette = [...perData.keys()].sort();
    const da = lette[0];
    const a = lette[lette.length - 1];
    for (const data of Object.keys(precedente)) {
      if (data >= da && data <= a && !perData.has(data)) delete precedente[data];
    }
    for (const [data, voce] of perData) precedente[data] = voce;
    // Oltre le sei settimane non serve a niente e non deve crescere all'infinito.
    const limite = new Date(Date.now() - 42 * 86400000).toISOString().slice(0, 10);
    for (const d of Object.keys(precedente)) if (d < limite) delete precedente[d];

    await setImpostazione("agenda", precedente);
    AGENDA = new Map(Object.entries(precedente));
    await setImpostazione("ultimoImportAgenda", ora);
  }

  await setImpostazione("ultimoImportSalute", new Date().toISOString());
  await collegaAllenamentiASedute();
  return conteggio;
}

// ---------- agenda: il calendario dice quale allenamento, il brief cosa contiene ----------

/** Normalizza un titolo per confrontarlo: niente accenti, spazi, punteggiatura. */
const chiaveTitolo = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Trova il giorno dello split che corrisponde al titolo di un evento.
 * Il confronto è per contenimento nei due sensi: «Coach — Petto/Tricipiti» e
 * «Petto e tricipiti» trovano entrambi il giorno «Petto/Tricipiti».
 */
export function abbinaAlloSplit(titolo) {
  const t = chiaveTitolo(titolo);
  if (!t) return null;
  if (t.includes("riposo")) return "riposo";
  let migliore = null;
  for (const g of giorniSplit()) {
    const k = chiaveTitolo(g.nome);
    if (!k) continue;
    // Il contenimento al contrario vale solo per titoli abbastanza lunghi:
    // un evento chiamato «F» non deve diventare «Full Body».
    if (t.includes(k) || (t.length >= 4 && k.includes(t))) {
      if (!migliore || k.length > chiaveTitolo(migliore.nome).length) migliore = g;
    }
  }
  return migliore?.id ?? null;
}

async function caricaAgenda() {
  AGENDA = new Map(Object.entries((await impostazione("agenda")) || {}));
  return AGENDA;
}

export function agendaDi(iso) {
  return AGENDA?.get(iso) || null;
}

export async function agenda() {
  if (!AGENDA) await caricaAgenda();
  return [...AGENDA.values()].sort((a, b) => (a.data < b.data ? -1 : 1));
}

/** Riprova ad abbinare gli eventi già letti ai giorni dello split corrente. */
async function riabbinaAgenda() {
  const salvata = (await impostazione("agenda")) || {};
  if (!Object.keys(salvata).length) return;
  let cambiato = false;
  for (const e of Object.values(salvata)) {
    const id = abbinaAlloSplit(e.titolo);
    if (id !== e.giornoId) {
      e.giornoId = id;
      cambiato = true;
    }
  }
  if (cambiato) await setImpostazione("agenda", salvata);
  AGENDA = new Map(Object.entries(salvata));
}

/** Toglie tutto quello che è arrivato dal calendario e torna allo split del brief. */
export async function svuotaAgenda() {
  await setImpostazione("agenda", {});
  AGENDA = new Map();
}

/** Associa ogni allenamento del Watch a quello registrato nello stesso giorno. */
export async function collegaAllenamentiASedute() {
  const allenamenti = await db.all("allenamentiWatch");
  const tutteSedute = await db.all("sedute");
  let collegati = 0;
  for (const a of allenamenti) {
    if (a.sedutaId) continue;
    const candidate = tutteSedute.filter((s) => s.data === a.data && s.stato === "completata");
    if (candidate.length === 1) {
      await db.put("allenamentiWatch", { ...a, sedutaId: candidate[0].id });
      collegati++;
    }
  }
  return collegati;
}

export async function giorniSalute() {
  const g = await db.all("giorniSalute");
  return g.sort((a, b) => (a.data < b.data ? 1 : -1));
}

export async function notti() {
  const n = await db.all("notti");
  return n.sort((a, b) => (a.data < b.data ? 1 : -1));
}

/**
 * Stato di una finestra: quante giornate registrate nelle ultime N settimane,
 * settimana per settimana. La regola richiede un minimo di giorni a settimana:
 * le settimane sotto la soglia non contano.
 */
export function statoFinestra(righe, { settimane = 3, minimoSettimana = 5 } = {}) {
  const valide = righe.filter((r) => r.presente);
  const perSettimana = [];
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  for (let s = 0; s < settimane; s++) {
    const fine = new Date(oggi);
    fine.setDate(fine.getDate() - s * 7);
    const inizio = new Date(fine);
    inizio.setDate(inizio.getDate() - 6);
    const dentro = valide.filter((r) => {
      const d = new Date(r.data + "T00:00:00");
      return d >= inizio && d <= fine;
    });
    perSettimana.push({
      da: inizio.toISOString().slice(0, 10),
      a: fine.toISOString().slice(0, 10),
      registrati: dentro.length,
      sufficiente: dentro.length >= minimoSettimana,
    });
  }

  // Una settimana finita prima che l'app esistesse non è una settimana in cui
  // hai smesso di registrare: non va segnata come mancante.
  const primaData = valide.map((r) => r.data).sort()[0] || null;
  for (const s of perSettimana) {
    s.primaDeiDati = Boolean(primaData) && s.a < primaData;
  }

  const contano = perSettimana.filter((s) => !s.primaDeiDati);
  return {
    registratiTotali: valide.length,
    richiesti: settimane * 7,
    perSettimana,
    completa: contano.length === settimane && contano.every((s) => s.sufficiente),
  };
}

// ---------- foto ----------

export const POSE = [
  { id: "fronte", nome: "Fronte" },
  { id: "profiloDx", nome: "Profilo destro" },
  { id: "schiena", nome: "Schiena" },
  { id: "profiloSx", nome: "Profilo sinistro" },
];

/**
 * Le immagini si salvano come stringhe (data URL), non come Blob: il backup
 * su file è JSON, e un Blob dentro JSON sparirebbe senza dire niente.
 */
export async function registraFoto({ data = isoDate(), posa, immagine, checklist }) {
  const rec = {
    id: db.nuovoId("foto"),
    data,
    posa,
    immagine,
    checklist: checklist || {},
    creatoIl: new Date().toISOString(),
    fonte: "app",
  };
  await db.put("foto", rec);
  return rec;
}

export async function foto() {
  const f = await db.all("foto");
  return f.sort((a, b) => (a.data < b.data ? 1 : -1));
}

/** L'ultima foto di una posa, usata come sagoma per allineare la successiva. */
export async function ultimaFoto(posa, escludiData = null) {
  const f = await foto();
  return f.find((x) => x.posa === posa && x.data !== escludiData) || null;
}

/** Set fotografici raggruppati per data, dal più recente. */
export async function setFoto() {
  const f = await foto();
  const perData = new Map();
  for (const x of f) {
    if (!perData.has(x.data)) perData.set(x.data, []);
    perData.get(x.data).push(x);
  }
  return [...perData.entries()].map(([data, scatti]) => ({ data, scatti }));
}

// ---------- indici derivati ----------

export function indici({ peso, vitaOmbelico, fianchi, altezzaCm }) {
  const out = [];
  if (vitaOmbelico && altezzaCm) {
    const v = vitaOmbelico / altezzaCm;
    out.push({
      id: "vitaAltezza",
      nome: "Vita / altezza",
      valore: v,
      decimali: 2,
      soglia: 0.5,
      sopraSoglia: v >= 0.5,
      nota: "Soglia di riferimento 0,50.",
    });
  }
  if (vitaOmbelico && fianchi) {
    const v = vitaOmbelico / fianchi;
    out.push({
      id: "vitaFianchi",
      nome: "Vita / fianchi",
      valore: v,
      decimali: 2,
      soglia: 0.95,
      sopraSoglia: v >= 0.95,
      nota: "Soglia uomini 0,95.",
    });
  }
  if (peso && altezzaCm) {
    const m = altezzaCm / 100;
    const v = peso / (m * m);
    out.push({
      id: "bmi",
      nome: "BMI",
      valore: v,
      decimali: 1,
      soglia: 25,
      sopraSoglia: v >= 25,
      nota: "Gonfiato dalla massa muscolare: il meno informativo dei tre.",
    });
  }
  return out;
}

// ---------- backup ----------

/**
 * Copia di sicurezza interna, sullo stesso dispositivo. Protegge da errori
 * dell'app e da cancellazioni accidentali, NON dalla perdita del telefono:
 * per quello serve l'esportazione su file.
 */
export async function snapshotAutomatico(motivo = "") {
  const dump = await db.esportaTutto();
  dump.motivo = motivo;
  dump.parziale = ["foto"]; // le immagini restano fuori: peserebbero troppo
  dump.dati.foto = [];
  await setImpostazione("snapshotAutomatico", JSON.stringify(dump));
  await setImpostazione("ultimoSnapshot", new Date().toISOString());
  return dump;
}

export async function snapshotSalvato() {
  const raw = await impostazione("snapshotAutomatico");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Backup completo destinato a un file fuori dall'app. */
export async function esportaCompleto() {
  const dump = await db.esportaTutto();
  dump.motivo = "esportazione manuale";
  await setImpostazione("ultimoExport", new Date().toISOString());
  return dump;
}

/** Giorni dall'ultima esportazione su file, null se non è mai stata fatta. */
export async function giorniDaUltimoExport() {
  const iso = await impostazione("ultimoExport");
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export { db };
