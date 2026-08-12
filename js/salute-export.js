/* Legge l'esportazione dell'app Salute e ne ricava il pacchetto di Coach.

   Serve quando i Comandi Rapidi non funzionano — su una beta di iOS le azioni
   di Salute possono restare appese — e serve comunque a chi non vuole passare
   da un computer: qui il lavoro lo fa il telefono.

   Il file di Apple pesa centinaia di megabyte e in memoria non ci sta. Non
   viene caricato: viene fatto SCORRERE a pezzi, riga per riga, tenendo solo i
   quattro numeri che servono e buttando via il resto. Misurato su un export
   vero da 852 MB: letto per intero con 41 MB di memoria occupata.

   Quello che esce è lo stesso testo che produrrebbe il comando rapido, quindi
   da qui in poi la strada è quella di sempre: `analizza()` e `importaSalute()`.
   Non è una scorciatoia — è il motivo per cui questa strada si può fidare di
   tutti i controlli già scritti per l'altra. */

// I tipi di Salute che servono, e in quale campo della riga GIORNO finiscono.
const QUANTITA = {
  HKQuantityTypeIdentifierActiveEnergyBurned: "kcal",
  HKQuantityTypeIdentifierStepCount: "passi",
  HKQuantityTypeIdentifierAppleExerciseTime: "esercizio",
  HKQuantityTypeIdentifierAppleStandTime: "inpiedi",
  HKQuantityTypeIdentifierFlightsClimbed: "piani",
  HKQuantityTypeIdentifierDistanceWalkingRunning: "km",
};
// La frequenza a riposo è una misura del giorno, non una somma.
const FC_RIPOSO = "HKQuantityTypeIdentifierRestingHeartRate";
const SONNO = "HKCategoryTypeIdentifierSleepAnalysis";

// I nomi delle fasi come li scrive Apple, in quelli che l'app riconosce.
const FASI = {
  HKCategoryValueSleepAnalysisAsleepDeep: "Profondo",
  HKCategoryValueSleepAnalysisAsleepREM: "REM",
  HKCategoryValueSleepAnalysisAsleepCore: "Principale",
  HKCategoryValueSleepAnalysisAsleepUnspecified: "Sonno",
  HKCategoryValueSleepAnalysisAsleep: "Sonno",
  HKCategoryValueSleepAnalysisAwake: "Veglia",
  // «A letto» non è sonno: l'app lo scarterebbe comunque, non entra.
};

const ATTRIBUTO = (riga, nome) => {
  const i = riga.indexOf(` ${nome}="`);
  if (i < 0) return null;
  const da = i + nome.length + 3;
  const a = riga.indexOf('"', da);
  return a < 0 ? null : riga.slice(da, a);
};

/** «2026-08-12 07:30:00 +0200» → {giorno, minuti dal principio del giorno}. */
const QUANDO = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/;
function istante(testo) {
  const m = QUANDO.exec(testo || "");
  if (!m) return null;
  // L'ora è già quella del posto in cui eri: il fuso scritto in coda serve solo
  // a chi vuole ricostruire l'istante assoluto, e qui non serve a niente.
  //
  // `ordine` tiene anche i secondi, e non è pignoleria: una fase di venti
  // secondi ha lo stesso minuto di inizio e di fine, e confrontando al minuto
  // veniva scartata come se durasse zero. Sono sette, sul suo archivio.
  return {
    giorno: `${m[1]}-${m[2]}-${m[3]}`,
    ora: `${m[4]}:${m[5]}`,
    ordine: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`,
  };
}

const numero = (v) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const piuGiorni = (iso, n) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/**
 * @param file      il file scelto: l'`export.xml` di Salute
 * @param giorni    quanti giorni indietro tenere
 * @param onAvanzamento(byteLetti) per dire a chi guarda che sta lavorando
 * @returns il testo del pacchetto, pronto per `analizza()`
 */
export async function pacchettoDaExport(file, { giorni = 30, dal: daQuando = null, oggi = null, onAvanzamento = null } = {}) {
  const al = oggi || (() => {
    const d = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();
  // Il pavimento non è una finestra mobile ma il giorno in cui questa storia
  // comincia: l'archivio di Salute contiene anni di dati, e importarli
  // riempirebbe l'app di giornate che il programma non ha mai guardato — medie
  // calcolate su un passato che non c'entra, grafici che partono da prima che
  // l'app esistesse. Chi chiama passa `dal`; senza, si torna alla finestra.
  const finestra = piuGiorni(al, -(Math.max(1, giorni) - 1));
  const dal = daQuando && daQuando > finestra ? daQuando : daQuando || finestra;

  // I passi li registrano sia iPhone sia Watch, e sommarli conta due volte i
  // periodi in cui li avevi addosso entrambi. Si tengono separati e si sceglie
  // alla fine: dove l'orologio ha scritto qualcosa, comanda lui.
  const perGiorno = new Map();
  const perGiornoWatch = new Map();
  const fc = new Map();
  const fasi = [];
  const allenamenti = [];

  const somma = (mappa, giorno, campo, valore) => {
    if (!mappa.has(giorno)) mappa.set(giorno, {});
    const r = mappa.get(giorno);
    r[campo] = (r[campo] || 0) + valore;
  };

  let dentroWorkout = null;
  let letti = 0;
  let coda = "";

  const riga = (r) => {
    // Dentro un <Workout> ci sono più righe di statistiche — distanza, energia,
    // frequenza — e l'energia non è la prima. Il blocco si chiude SOLO su
    // «</Workout>»: chiudendolo alla prima riga che finisce per «/>» si
    // perdevano le calorie di ogni allenamento, che è il numero che il coach
    // legge per primo.
    if (dentroWorkout) {
      if (
        r.indexOf("<WorkoutStatistics") >= 0 &&
        ATTRIBUTO(r, "type") === "HKQuantityTypeIdentifierActiveEnergyBurned"
      ) {
        dentroWorkout.kcal = numero(ATTRIBUTO(r, "sum"));
      }
      if (r.indexOf("</Workout>") >= 0) {
        allenamenti.push(dentroWorkout);
        dentroWorkout = null;
      }
      return;
    }
    if (r.indexOf("<Workout ") >= 0) {
      const i = istante(ATTRIBUTO(r, "startDate"));
      const durata = numero(ATTRIBUTO(r, "duration"));
      if (i && i.giorno >= dal && i.giorno <= al) {
        dentroWorkout = {
          giorno: i.giorno,
          ora: i.ora,
          ordine: i.ordine,
          durataSec: durata != null ? Math.round(durata * 60) : null,
          kcal: null,
          tipo: (ATTRIBUTO(r, "workoutActivityType") || "").replace("HKWorkoutActivityType", ""),
        };
        // Un <Workout .../> che si chiude sulla stessa riga non ha statistiche.
        if (r.trimEnd().endsWith("/>")) {
          allenamenti.push(dentroWorkout);
          dentroWorkout = null;
        }
      }
      return;
    }
    if (r.indexOf("<Record ") < 0) return;
    const tipo = ATTRIBUTO(r, "type");
    if (!tipo) return;

    if (tipo === SONNO) {
      const fase = FASI[ATTRIBUTO(r, "value")];
      if (!fase) return;
      const i = istante(ATTRIBUTO(r, "startDate"));
      const f = istante(ATTRIBUTO(r, "endDate"));
      if (!i || !f || f.ordine <= i.ordine) return;
      // Una notte porta la data del risveglio: si tiene se uno dei due capi
      // cade nel periodo, altrimenti le notti al bordo si perderebbero a metà.
      if ((i.giorno >= dal && i.giorno <= al) || (f.giorno >= dal && f.giorno <= al)) {
        fasi.push({ da: i, a: f, fase });
      }
      return;
    }

    const i = istante(ATTRIBUTO(r, "startDate"));
    if (!i || i.giorno < dal || i.giorno > al) return;

    if (tipo === FC_RIPOSO) {
      const v = numero(ATTRIBUTO(r, "value"));
      if (v != null) fc.set(i.giorno, v);
      return;
    }
    const campo = QUANTITA[tipo];
    if (!campo) return;
    const v = numero(ATTRIBUTO(r, "value"));
    if (v == null) return;
    const daOrologio = /watch/i.test(ATTRIBUTO(r, "sourceName") || "");
    somma(daOrologio ? perGiornoWatch : perGiorno, i.giorno, campo, v);
  };

  const lettore = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { value, done } = await lettore.read();
    if (done) break;
    letti += value.length;
    const testo = coda + value;
    const righe = testo.split("\n");
    // L'ultimo pezzo può essere una riga tagliata a metà: aspetta il prossimo.
    coda = righe.pop();
    for (const r of righe) riga(r);
    if (onAvanzamento) onAvanzamento(letti);
  }
  if (coda) riga(coda);

  // ---- il testo, nello stesso formato del comando rapido ----
  const out = ["COACH-DATI v1", `FINESTRA ${dal} ${al}`];

  for (const g of [...new Set([...perGiorno.keys(), ...perGiornoWatch.keys()])].sort()) {
    const w = perGiornoWatch.get(g) || {};
    const i = perGiorno.get(g) || {};
    const campi = [];
    const prendi = (chiave, scrivi) => {
      const v = w[chiave] || i[chiave];
      if (v) campi.push(scrivi(v));
    };
    prendi("kcal", (v) => `kcal=${Math.round(v)}`);
    prendi("passi", (v) => `passi=${Math.round(v)}`);
    prendi("esercizio", (v) => `esercizio=${Math.round(v)}`);
    prendi("inpiedi", (v) => `inpiedi=${Math.round(v)}`);
    prendi("piani", (v) => `piani=${Math.round(v)}`);
    prendi("km", (v) => `km=${v.toFixed(2).replace(".", ",")}`);
    if (fc.has(g)) campi.push(`fc=${Math.round(fc.get(g))}`);
    if (campi.length) out.push(`GIORNO ${g} ${campi.join(" ")}`);
  }

  fasi.sort((a, b) => (a.da.ordine < b.da.ordine ? -1 : a.da.ordine > b.da.ordine ? 1 : 0));
  for (const f of fasi) {
    out.push(`FASE ${f.da.giorno} ${f.da.ora} ${f.a.giorno} ${f.a.ora} ${f.fase}`);
  }

  allenamenti.sort((a, b) => (a.ordine < b.ordine ? -1 : a.ordine > b.ordine ? 1 : 0));
  for (const a of allenamenti) {
    const pezzi = [`ALLENAMENTO ${a.giorno} inizio=${a.ora} durata=${a.durataSec ?? 0}`];
    if (a.kcal != null) pezzi.push(`kcal=${Math.round(a.kcal)}`);
    if (a.tipo) pezzi.push(`tipo="${a.tipo}"`);
    out.push(pezzi.join(" "));
  }

  return { testo: out.join("\n") + "\n", byte: letti, giorni: perGiorno.size + perGiornoWatch.size, fasi: fasi.length, allenamenti: allenamenti.length };
}
