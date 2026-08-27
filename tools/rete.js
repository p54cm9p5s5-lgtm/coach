/* La rete.
 *
 * Un collaudo che si rilancia con una riga sola e che risponde a una domanda
 * precisa: da quando l'ho controllata, questa app si è rotta da qualche parte?
 *
 * Nasce da un limite ammesso. Fino al 27/08/2026 il lavoro di controllo
 * produceva un REGISTRO: 174 voci, tutte chiuse, nessuna ri-eseguibile. Un
 * verbale, non una rete. Il 94% del codice era protetto solo dal fatto che
 * qualcuno l'aveva guardato una volta, e ogni modifica successiva faceva
 * scadere quella garanzia senza dirlo.
 *
 * Cosa c'è dentro, in ordine di quanto pesa:
 *
 *   1. il nucleo dimostrato    — tutti i casi possibili (tools/verifica-esaustiva.js)
 *   2. la sorgente unica       — le regole che devono restare scritte una volta sola
 *   3. i dati che l'app porta  — libreria esercizi e protocollo di riscaldamento
 *   4. l'archivio              — invarianti veri per QUALUNQUE archivio
 *   5. le stesse domande       — lo stesso numero chiesto per strade diverse
 *
 * Si lancia dalla console, con l'app aperta:
 *     const r = await import('/tools/rete.js'); console.log(await r.rete());
 *
 * È SOLA LETTURA: si può lanciare sull'archivio vero senza toccarlo. Le prove
 * che scrivono stanno in `reteDistruttiva()`, che si rifiuta di partire se
 * l'archivio non è vuoto.
 *
 * Cosa NON copre, e va detto: iOS, il service worker, la memoria piena, i
 * Comandi Rapidi, il Watch, e l'app in mano a te durante un allenamento.
 * Quella parte si prova, non si dimostra.
 */

import * as store from "../js/store.js";
import * as db from "../js/db.js";
import * as ui from "../js/ui.js";
import * as ex from "../js/export.js";
import { tutto as nucleoDimostrato } from "./verifica-esaustiva.js";

const esito = (nome, casi, errori) => ({
  nome,
  casi,
  errori: errori.length,
  primi: errori.slice(0, 6),
  passata: errori.length === 0,
});

/* --------------------------------------------------- 2. la sorgente unica */

/**
 * Certe regole devono stare scritte in UN posto solo.
 *
 * Non è pignoleria di stile: il 27/08 quattro difetti su sei erano la stessa
 * cosa — una regola copiata due volte, e una delle due copie rimasta indietro.
 * «Quanto è durato l'allenamento» dava 49 minuti sullo schermo e 6h 06m nel
 * pacchetto per il coach; «quanto carico» diceva 30 kg nell'elenco del giorno
 * e 35 nell'esercizio, con i dischi sbagliati scritti sotto.
 *
 * Qui si legge il codice pubblicato e si controlla che quelle regole non siano
 * ricomparse altrove. Una prova che guarda il testo del programma è insolita,
 * ma è l'unica che può accorgersi di una copia scritta domani.
 */
export async function verificaSorgenteUnica() {
  const REGOLE = [
    { cosa: "quanto è durato l'allenamento", segno: "oraInizioLavoro ||", solo: ["js/store.js"] },
    { cosa: "quale carico proporre", segno: "caricoDaDecisione", solo: ["js/store.js"] },
    { cosa: "come si scrive il bersaglio", segno: "ripMin === v.ripMax", solo: ["js/store.js"] },
    { cosa: "come si legge un numero scritto a mano", segno: String.raw`^-?\d*\.?\d+$`, solo: ["js/store.js"] },
    { cosa: "quanti giorni dall'ultimo backup", segno: "/ 86400000", solo: ["js/ui.js"] },
  ];
  const FILE = [
    "js/store.js", "js/ui.js", "js/db.js", "js/export.js", "js/punteggio.js", "js/segnali.js",
    "js/salute.js", "js/salute-export.js", "js/brief.js", "js/calendario.js", "js/grafico.js",
    "js/plates.js", "js/app.js",
    "js/screens/oggi.js", "js/screens/seduta.js", "js/screens/storico.js", "js/screens/salute.js",
    "js/screens/corpo.js", "js/screens/fumo.js", "js/screens/acqua.js", "js/screens/proposte.js",
    "js/screens/export.js", "js/screens/allenamenti.js", "js/screens/impostazioni.js",
  ];
  const errori = [];
  const sorgenti = new Map();
  for (const f of FILE) {
    try {
      const r = await fetch(`/${f}?rete=${Math.random()}`, { cache: "no-store" });
      sorgenti.set(f, r.ok ? await r.text() : "");
      if (!r.ok) errori.push(`${f}: non si legge (${r.status})`);
    } catch (e) {
      errori.push(`${f}: non si legge (${String(e.message).slice(0, 40)})`);
    }
  }
  for (const R of REGOLE) {
    // La riga di commento non conta: solo il codice che gira.
    const dove = FILE.filter((f) =>
      (sorgenti.get(f) || "")
        .split("\n")
        .some((riga) => !riga.trim().startsWith("//") && !riga.trim().startsWith("*") && riga.includes(R.segno))
    );
    const fuori = dove.filter((f) => !R.solo.includes(f));
    if (fuori.length) {
      errori.push(`«${R.cosa}» è scritta anche in: ${fuori.join(", ")} — deve stare solo in ${R.solo.join(", ")}`);
    }
    if (!dove.some((f) => R.solo.includes(f))) {
      errori.push(`«${R.cosa}» non si trova più dove dovrebbe stare (${R.solo.join(", ")}): la prova non sta più controllando niente`);
    }
  }
  // Quali domini l'app può contattare. È l'invariante che vale più di tutti:
  // «niente esce dal telefono» non è una promessa da scrivere in un documento,
  // è una cosa che si conta. Due soli, tutti e due di YouTube. Se un domani ne
  // compare un terzo, questa prova lo dice prima che lo scopra la rete di casa.
  const AMMESSI = new Set(["www.youtube-nocookie.com", "i.ytimg.com", "www.w3.org"]);
  const domini = new Set();
  for (const [f, testo] of sorgenti) {
    for (const m of (testo || "").matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
      if (!AMMESSI.has(m[1])) errori.push(`${f} contatta un dominio nuovo: ${m[1]}`);
      domini.add(m[1]);
    }
  }
  return esito(
    "le regole scritte una volta sola, e dove va la rete",
    `${REGOLE.length} regole su ${FILE.length} file · ${domini.size} domini esterni`,
    errori
  );
}

/* ------------------------------------------------ 3. i dati che l'app porta */

export async function verificaDati() {
  const errori = [];
  let casi = 0;

  const lib = await (await fetch("/data/esercizi.json", { cache: "no-store" })).json();
  const esercizi = Array.isArray(lib) ? lib : lib.esercizi || [];
  const visti = new Set();
  const video = new Map();
  for (const e of esercizi) {
    casi++;
    if (!e.id) { errori.push(`un esercizio senza id (${e.nome || "senza nome"})`); continue; }
    if (visti.has(e.id)) errori.push(`id ripetuto: ${e.id}`);
    visti.add(e.id);
    for (const campo of ["nome", "pattern", "attrezzo", "setup", "esecuzione", "cue", "erroriComuni"]) {
      if (!e[campo] || (Array.isArray(e[campo]) && !e[campo].length)) errori.push(`${e.id}: manca «${campo}»`);
    }
    if (!store.ETICHETTE_PATTERN[e.pattern]) errori.push(`${e.id}: schema «${e.pattern}» che il conto del volume non conosce`);
    const v = e.video?.id;
    if (v) {
      if (!/^[A-Za-z0-9_-]{11}$/.test(v)) errori.push(`${e.id}: id video storto «${v}»`);
      if (video.has(v)) errori.push(`${e.id} e ${video.get(v)} puntano allo stesso video`);
      video.set(v, e.id);
    }
  }

  // Il riscaldamento deve esistere per ogni giorno che l'app può mostrare: sia
  // quelli dello split di oggi, sia quelli delle sedute già in archivio (uno
  // storico che apre su un giorno senza protocollo è una schermata vuota).
  if (!store.protocolloCaricato()) {
    errori.push("il protocollo di riscaldamento non si è caricato");
  } else {
    const tipi = new Set([
      ...store.giorniSplit().map((g) => g.id),
      ...(await db.all("sedute")).map((s) => s.tipoId),
    ]);
    for (const id of tipi) {
      if (!id) continue;
      casi++;
      if (!store.riscaldamento(id)) errori.push(`il giorno «${id}» non ha riscaldamento`);
    }
  }
  return esito("i dati che l'app porta con sé", `${casi} controlli`, errori);
}

/* --------------------------------------------------------- 4. l'archivio */

/**
 * Invarianti veri per QUALUNQUE archivio: il tuo, uno finto, uno vuoto.
 * Non controllano che i numeri siano quelli giusti — quello lo fa la base di
 * riferimento — ma che non possano essere di una forma impossibile.
 */
export async function verificaArchivio() {
  const errori = [];
  let casi = 0;
  const oggi = ui.isoDate();

  const sedute = await db.all("sedute");
  const idSedute = new Set(sedute.map((s) => s.id));
  const visti = new Set();

  for (const s of sedute) {
    casi++;
    if (visti.has(s.id)) errori.push(`seduta con id ripetuto: ${s.id}`);
    visti.add(s.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.data || "")) { errori.push(`seduta ${s.id}: data «${s.data}»`); continue; }
    if (ui.isoDate(ui.parseIso(s.data)) !== s.data) errori.push(`seduta ${s.id}: la data ${s.data} non torna indietro uguale`);
    if (s.data > oggi) errori.push(`seduta ${s.id}: datata nel futuro (${s.data})`);

    const sec = store.durataSeduta(s);
    if (sec !== null && (!Number.isFinite(sec) || sec < 0)) errori.push(`seduta ${s.data}: durata ${sec}`);

    const c = s.completezza;
    if (s.stato === "completata" && c) {
      if (!Number.isFinite(c.totale) || c.totale < 0 || c.totale > 100) errori.push(`${s.data}: punteggio ${c.totale} fuori scala`);
      for (const v of c.voci || []) {
        if (!(v.peso > 0)) errori.push(`${s.data} · ${v.nome}: peso ${v.peso}`);
        if (v.quota !== null && !(v.quota >= 0 && v.quota <= 1)) errori.push(`${s.data} · ${v.nome}: quota ${v.quota}`);
      }
      const previsti = c.previsti ?? 0;
      const svolti = c.svolti ?? 0;
      const saltati = c.saltati ?? 0;
      if (svolti + saltati > previsti) errori.push(`${s.data}: ${svolti} svolti + ${saltati} saltati su ${previsti} previsti`);
      if (svolti < 0 || saltati < 0) errori.push(`${s.data}: conteggi negativi`);
      for (const [id, p] of Object.entries(c.perEsercizio || {})) {
        const t = typeof p === "object" ? p?.totale : p;
        if (t != null && (!Number.isFinite(t) || t < 0 || t > 100)) errori.push(`${s.data} · ${id}: punteggio ${t}`);
      }
    }
  }

  // Nessuna riga deve puntare a una seduta che non c'è: un collegamento morto
  // fa sparire lavoro davvero fatto senza che nessuno se ne accorga.
  for (const [nome, campo] of [["serie", "sedutaId"], ["esercizioLog", "sedutaId"]]) {
    for (const r of await db.all(nome)) {
      casi++;
      if (r[campo] && !idSedute.has(r[campo])) errori.push(`${nome} ${r.id}: punta alla seduta ${r[campo]}, che non esiste`);
    }
  }

  // Le righe con la data per chiave devono avere una data vera.
  for (const nome of ["giorniSalute", "notti", "acqua"]) {
    for (const r of await db.all(nome)) {
      casi++;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data || "")) errori.push(`${nome}: chiave «${r.data}»`);
    }
  }
  for (const nome of ["misure", "foto", "fumo", "extra", "decisioni", "segnali"]) {
    for (const r of await db.all(nome)) {
      casi++;
      if (r.data && !/^\d{4}-\d{2}-\d{2}/.test(String(r.data))) errori.push(`${nome} ${r.id}: data «${r.data}»`);
    }
  }
  return esito("l'archivio, qualunque esso sia", `${casi} righe`, errori);
}

/* ------------------------------------------------- 5. le stesse domande */

/**
 * Lo stesso numero, chiesto per strade diverse, deve tornare uguale.
 * È la categoria che il 27/08 ha prodotto quattro difetti su sei.
 */
export async function verificaStesseDomande() {
  const errori = [];
  let casi = 0;

  // a) quanto è durato l'allenamento: schermo contro pacchetto per il coach
  for (const s of (await db.all("sedute")).filter((x) => x.stato === "completata")) {
    casi++;
    const atteso = store.durataSeduta(s);
    if (atteso == null) continue;
    const testo = ex.logSeduta({
      seduta: s,
      serie: await store.serieDi(s.id),
      questionari: await store.questionariDi(s.id),
      esercizio: store.esercizio,
      giornoSplit: store.giornoSplit,
      previsti: s.previstiElenco || [],
      completezza: s.completezza || null,
    });
    const m = /Durata allenamento:\s*([^\n|]+)/.exec(testo);
    const nelPacchetto = m ? m[1].trim() : null;
    const sulloSchermo = ui.durataUmana(atteso);
    if (nelPacchetto && nelPacchetto !== sulloSchermo) {
      errori.push(`${s.data}: lo schermo dice «${sulloSchermo}», il pacchetto «${nelPacchetto}»`);
    }
  }

  // b) quanti giorni dall'ultimo backup: Impostazioni contro Home
  const imp = await store.impostazioni();
  if (imp.ultimoExport) {
    casi++;
    const daImpostazioni = await store.giorniDaUltimoExport();
    const d = new Date(imp.ultimoExport);
    const daHome = Number.isNaN(d.getTime()) ? null : ui.giorniTra(ui.isoDate(d), ui.isoDate());
    if (daImpostazioni !== daHome) errori.push(`backup: Impostazioni dice ${daImpostazioni}, la Home ${daHome}`);
  }

  // c) lo stato delle finestre: la strada dei segnali contro quella del pacchetto
  const reg = store.regole();
  const f = reg.finestre || {};
  const giorni = await store.giorniSalute();
  const notti = await store.notti();
  for (const [nome, righe, campo, conf] of [
    ["movimento", giorni, "kcalAttive", f.movimento],
    ["sonno", notti, "durataMin", f.sonno],
  ]) {
    if (!righe.length) continue;
    casi++;
    const a = store.statoFinestra(righe, { campo, settimane: reg.finestra.settimane, minimoSettimana: reg.finestra.minimoSettimana });
    const b = store.statoFinestra(righe, { campo, settimane: conf?.settimane ?? 3, minimoSettimana: (conf?.giorniMinSettimana ?? conf?.nottiMinSettimana) ?? 5 });
    if (JSON.stringify(a) !== JSON.stringify(b)) errori.push(`finestra ${nome}: le due strade danno stati diversi`);
  }

  // d) gli indici del corpo: la schermata Corpo contro il pacchetto
  const misure = await store.misure();
  if (misure.length) {
    casi++;
    const primo = new Map();
    for (const m of misure) if (!primo.has(m.tipo)) primo.set(m.tipo, m);
    const perArray = new Map();
    for (const m of misure) {
      if (!perArray.has(m.tipo)) perArray.set(m.tipo, []);
      perArray.get(m.tipo).push(m);
    }
    const h = store.programma()?.atleta?.altezzaCm;
    const daCorpo = store.indici({ altezzaCm: h, peso: perArray.get("peso")?.[0]?.valore, vitaOmbelico: perArray.get("vitaOmbelico")?.[0]?.valore, fianchi: perArray.get("fianchi")?.[0]?.valore });
    const daPacchetto = store.indici({ altezzaCm: h, peso: primo.get("peso")?.valore, vitaOmbelico: primo.get("vitaOmbelico")?.valore, fianchi: primo.get("fianchi")?.valore });
    if (JSON.stringify(daCorpo) !== JSON.stringify(daPacchetto)) errori.push("indici del corpo: Corpo e pacchetto non coincidono");
  }

  // e) il carico e il bersaglio: una funzione sola, chiamata come la chiamano
  //    l'elenco del giorno, l'esercizio e l'anteprima del prossimo
  for (const [id, v] of store.varianti()) {
    casi++;
    const ob = v.aTempo ? null : await store.obiettivoCorrente(id);
    const elenco = await store.caricoProposto(v, { obiettivo: ob });
    const anteprima = await store.caricoProposto(v, { obiettivo: ob });
    const dentro = await store.caricoProposto(v, { obiettivo: ob, fatte: [] });
    if (!(elenco === anteprima && anteprima === dentro)) {
      errori.push(`${id}: carico ${elenco} / ${anteprima} / ${dentro}`);
    }
    if (elenco != null && (!Number.isFinite(elenco) || elenco < 0)) errori.push(`${id}: carico ${elenco}`);
    const b = store.bersaglioProposto(v, ob);
    if (b !== null && !/\d/.test(b)) errori.push(`${id}: bersaglio «${b}» senza numeri`);
  }

  // f) un numero scritto a mano si legge allo stesso modo ovunque
  for (const [scritto, atteso] of [
    ["82,5", 82.5], ["82.5", 82.5], [" 82 ", 82], ["", null], ["0", 0],
    ["8a4", null], ["82kg", null], ["-5", null], ["1e3", null], ["0x10", null],
    ["+82", null], ["5.", null], ["1,2,3", null], ["Infinity", null], ["NaN", null], ["1 000", null],
  ]) {
    casi++;
    const letto = store.numeroScritto(scritto);
    if (letto !== atteso) errori.push(`«${scritto}» letto come ${letto}, atteso ${atteso}`);
  }

  return esito("lo stesso numero per strade diverse", `${casi} confronti`, errori);
}

/* ------------------------------------------------------------- la rete */

export async function rete() {
  await store.init();
  const t0 = performance.now();
  const nucleo = await nucleoDimostrato();
  const prove = [
    ...nucleo.prove,
    await verificaSorgenteUnica(),
    await verificaDati(),
    await verificaArchivio(),
    await verificaStesseDomande(),
  ];
  const errori = prove.reduce((a, p) => a + p.errori, 0);
  const casi = prove.reduce((a, p) => a + (parseInt(p.casi, 10) || 0), 0);
  return {
    verdetto: errori === 0 ? "PASSATA" : `${errori} problemi`,
    passate: `${prove.filter((p) => p.passata).length}/${prove.length}`,
    casi,
    ms: Math.round(performance.now() - t0),
    prove: prove.map((p) => `${p.passata ? "ok " : "NO "} ${p.nome} — ${p.casi} — ${p.errori} errori`),
    problemi: prove.flatMap((p) => p.primi),
    nonCopre:
      "iOS, il service worker, la memoria piena, i Comandi Rapidi, il Watch e " +
      "l'app in mano a te durante un allenamento: quella parte si prova, non si dimostra.",
  };
}

/* ------------------------------------------- le prove che scrivono davvero */

/**
 * Il ripristino da un file rovinato: undici file storti, e dopo ognuno
 * l'archivio deve essere ancora quello di prima.
 *
 * Scrive, quindi si rifiuta di partire su un archivio che contiene qualcosa.
 * Si lancia sull'ambiente di prova, non sul telefono.
 */
export async function reteDistruttiva({ forza = false } = {}) {
  const quante = (await db.all("sedute")).length + (await db.all("misure")).length + (await db.all("foto")).length;
  if (quante && !forza) {
    return { verdetto: "NON PARTITA", perche: `l'archivio contiene ${quante} righe fra sedute, misure e foto: queste prove scrivono. Lanciala su un ambiente vuoto.` };
  }
  const errori = [];
  await db.importaTutto({ formato: "coach-backup", versione: 1, dati: {
    sedute: [{ id: "RETE1", data: "2026-01-02", stato: "completata", tipoId: "prova" }],
    serie: [{ id: "RETE-S1", sedutaId: "RETE1", esercizioId: "squat", carico: 40 }],
  } }, "sostituisci");
  const impronta = async () => JSON.stringify((await db.esportaTutto({ salta: ["copertine"] })).dati);
  const prima = await impronta();

  const casi = [
    ["file vuoto", ""],
    ["non è JSON", "questo non e un backup"],
    ["JSON troncato", '{"formato":"coach-backup","versione":1,"dati":{"sedute":[{"id":"X"'],
    ["JSON che non è un backup", '{"a":1}'],
    ["backup di un'altra app", '{"formato":"altro","versione":1,"dati":{}}'],
    ["versione non numerica", '{"formato":"coach-backup","versione":"boh","dati":{"sedute":[]}}'],
    ["versione più nuova", '{"formato":"coach-backup","versione":99,"dati":{"sedute":[]}}'],
    ["sezione illeggibile", '{"formato":"coach-backup","versione":1,"dati":{"sedute":"rotto"}}'],
    ["righe senza chiave", '{"formato":"coach-backup","versione":1,"dati":{"sedute":[{"data":"2026-01-01"},null,42]}}'],
    ["archivio inesistente", '{"formato":"coach-backup","versione":1,"dati":{"inventato":[{"id":1}]}}'],
    ["dati vuoti", '{"formato":"coach-backup","versione":1,"dati":{}}'],
    ["solo null", "null"],
  ];
  for (const [nome, testo] of casi) {
    let dump = null;
    let letto = true;
    try { dump = JSON.parse(testo); } catch { letto = false; }
    if (letto) {
      let accettato = false;
      try { await db.importaTutto(dump, "sostituisci"); accettato = true; } catch { /* respinto: è quello che deve fare */ }
      if (accettato) errori.push(`«${nome}»: ACCETTATO, doveva essere respinto`);
    }
    if ((await impronta()) !== prima) errori.push(`«${nome}»: l'archivio è cambiato`);
  }
  // e un backup buono deve ancora entrare
  await db.importaTutto({ formato: "coach-backup", versione: 1, dati: { sedute: [{ id: "RETE2", data: "2026-01-03", stato: "completata", tipoId: "prova" }] } }, "sostituisci");
  const dopo = (await db.all("sedute")).map((s) => s.id);
  if (JSON.stringify(dopo) !== JSON.stringify(["RETE2"])) errori.push(`un backup buono non è entrato: ${dopo.join(",")}`);

  const r = esito("ripristino da file rovinati", `${casi.length} file storti`, errori);
  return { verdetto: r.passata ? "PASSATA" : `${r.errori} problemi`, ...r };
}
