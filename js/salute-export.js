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
const FC_ISTANTE = "HKQuantityTypeIdentifierHeartRate";
const SONNO = "HKCategoryTypeIdentifierSleepAnalysis";

/* Le statistiche scritte dentro un <Workout>: sono già calcolate da Salute su
   quell'allenamento, non vanno ricostruite dai campioni. La distanza cambia
   nome col tipo di attività (a piedi, in bici, in acqua) e finisce comunque nel
   campo `km`: per chi legge è «quanta strada», qualunque fosse il mezzo. */
const DENTRO_WORKOUT = {
  HKQuantityTypeIdentifierActiveEnergyBurned: "kcal",
  HKQuantityTypeIdentifierBasalEnergyBurned: "kcalBasale",
  HKQuantityTypeIdentifierDistanceWalkingRunning: "km",
  HKQuantityTypeIdentifierDistanceCycling: "km",
  HKQuantityTypeIdentifierDistanceSwimming: "km",
};

/* Lo «Sforzo» che l'orologio mostra da 1 a 10 («7 · Difficile»).
   Apple lo scrive in due modi a seconda che l'abbia stimato lui o che tu
   l'abbia corretto a mano, e a seconda della versione di iOS può stare dentro
   il blocco dell'allenamento oppure essere una riga a sé con la sua ora. Qui si
   accettano tutte le forme: quella che c'è viene letta, e se non c'è nessuna
   la scheda dello sforzo semplicemente non compare, invece di mostrare un
   numero inventato. */
const SFORZO = new Set([
  "HKQuantityTypeIdentifierWorkoutEffortScore",
  "HKQuantityTypeIdentifierEstimatedWorkoutEffortScore",
]);

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
    sec: Number(m[4]) * 3600 + Number(m[5]) * 60 + Number(m[6]),
  };
}

/* La curva del battito.

   I campioni di frequenza sono righe a sé, e nell'esportazione di Apple stanno
   PRIMA degli allenamenti: quando passano non si sa ancora dentro quale
   allenamento cadranno. Tenerli tutti sarebbe decine di migliaia di oggetti,
   quindi mentre scorrono vengono raccolti in caselle da mezzo minuto — somma e
   quanti — e alla fine ogni allenamento si prende le caselle del suo intervallo.

   Mezzo minuto non è una perdita: l'orologio scrive un battito ogni pochi
   secondi, e una camminata di un'ora farebbe settecento punti per disegnare una
   linea larga tre centimetri. La curva che si vede è la stessa; l'archivio e i
   backup restano leggeri. */
const CASELLA_SEC = 30;
const CASELLE_AL_GIORNO = 86400 / CASELLA_SEC;
const PUNTI_MAX = 120;

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
  // alla fine: vince il PIÙ ALTO dei due.
  //
  // Prima comandava l'orologio ogni volta che aveva scritto qualcosa. Su una
  // giornata in cui l'orologio lo tieni poco è un disastro: il 30/08 l'app
  // diceva 634 passi mentre Salute ne contava 4575, perché i primi li aveva
  // contati l'orologio dal polso e gli altri il telefono in tasca. Un conteggio
  // parziale non è «il dato buono della fonte buona»: è meno lavoro di quello
  // che hai fatto, e sotto c'è la stessa regola già scritta per le notti — una
  // finestra o una fonte tagliata può solo TOGLIERE, mai aggiungere.
  const perGiorno = new Map();
  const perGiornoWatch = new Map();
  const fc = new Map();
  const battiti = new Map();
  const sforzi = [];
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
      if (r.indexOf("<WorkoutStatistics") >= 0) {
        const t = ATTRIBUTO(r, "type");
        const campo = DENTRO_WORKOUT[t];
        if (campo) {
          const v = numero(ATTRIBUTO(r, "sum"));
          if (v != null) dentroWorkout[campo] = (dentroWorkout[campo] || 0) + v;
        } else if (t === FC_ISTANTE) {
          // Media, minimo e massimo li ha già calcolati Salute su tutto
          // l'allenamento: sono più affidabili di quelli ricavati dalle caselle
          // da mezzo minuto, che arrotondano.
          dentroWorkout.fcMedia = numero(ATTRIBUTO(r, "average"));
          dentroWorkout.fcMin = numero(ATTRIBUTO(r, "minimum"));
          dentroWorkout.fcMax = numero(ATTRIBUTO(r, "maximum"));
        } else if (SFORZO.has(t)) {
          const v = numero(ATTRIBUTO(r, "average")) ?? numero(ATTRIBUTO(r, "maximum")) ?? numero(ATTRIBUTO(r, "sum"));
          // Lo sforzo dichiarato a mano vince su quello stimato: è la stessa
          // regola delle notti corrette a mano.
          if (v != null && (dentroWorkout.sforzo == null || t.indexOf("Estimated") < 0)) {
            dentroWorkout.sforzo = v;
          }
        }
      }
      /* Al chiuso o all'aperto non è un tipo di allenamento diverso: per Salute
         una camminata è sempre «Walking», e la differenza sta in un dato a
         parte dentro il blocco. Senza leggerlo, il tapis e il giro dell'isolato
         finivano nella stessa riga con lo stesso nome — e sul passo al
         chilometro sono due cose che non si mescolano.
         Il valore può essere scritto come 1/0 o come YES/NO. */
      if (r.indexOf("<MetadataEntry") >= 0 && /key="(HKIndoorWorkout|HKMetadataKeyIndoorWorkout)"/.test(r)) {
        const v = String(ATTRIBUTO(r, "value") || "").trim().toLowerCase();
        if (v === "1" || v === "true" || v === "yes") dentroWorkout.indoor = true;
        else if (v === "0" || v === "false" || v === "no") dentroWorkout.indoor = false;
      }
      if (r.indexOf("</Workout>") >= 0) {
        allenamenti.push(dentroWorkout);
        dentroWorkout = null;
      }
      return;
    }
    if (r.indexOf("<Workout ") >= 0) {
      const i = istante(ATTRIBUTO(r, "startDate"));
      const f = istante(ATTRIBUTO(r, "endDate"));
      const durata = numero(ATTRIBUTO(r, "duration"));
      if (i && i.giorno >= dal && i.giorno <= al) {
        dentroWorkout = {
          giorno: i.giorno,
          ora: i.ora,
          ordine: i.ordine,
          da: { giorno: i.giorno, sec: i.sec },
          // Senza `endDate` la fine si ricava dalla durata: serve a sapere
          // quali caselle di battito appartengono a questo allenamento.
          fine: f ? f.ora : null,
          a: f
            ? { giorno: f.giorno, sec: f.sec }
            : durata != null
              ? { giorno: i.giorno, sec: i.sec + Math.round(durata * 60) }
              : null,
          durataSec: durata != null ? Math.round(durata * 60) : null,
          kcal: null,
          tipo: (ATTRIBUTO(r, "workoutActivityType") || "").replace("HKWorkoutActivityType", ""),
        };
        // Un <Workout .../> che si chiude sulla stessa riga non ha statistiche.
        // Vale anche per un blocco intero scritto su una riga sola: Salute va a
        // capo, ma se un giorno non lo facesse il blocco resterebbe aperto per
        // sempre e si mangerebbe in silenzio tutti gli allenamenti successivi —
        // che è il modo peggiore di sbagliare, perché non si vede.
        if (r.trimEnd().endsWith("/>") || r.indexOf("</Workout>") >= 0) {
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
    if (tipo === FC_ISTANTE) {
      const v = numero(ATTRIBUTO(r, "value"));
      if (v == null) return;
      const chiave = `${i.giorno}|${Math.floor(i.sec / CASELLA_SEC)}`;
      const c = battiti.get(chiave);
      if (c) {
        c.somma += v;
        c.quanti++;
        // Minimo e massimo dentro la casella: sono loro a dare al grafico la
        // forma che ha sull'orologio — una barretta per momento, alta quanto il
        // battito è ballato in quei trenta secondi. Con la sola media resta una
        // linea, che dice meno.
        if (v < c.min) c.min = v;
        if (v > c.max) c.max = v;
      } else {
        battiti.set(chiave, { somma: v, quanti: 1, min: v, max: v });
      }
      return;
    }
    if (SFORZO.has(tipo)) {
      const v = numero(ATTRIBUTO(r, "value"));
      if (v != null) sforzi.push({ giorno: i.giorno, sec: i.sec, valore: v, stimato: tipo.indexOf("Estimated") >= 0 });
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
      const v = Math.max(w[chiave] || 0, i[chiave] || 0);
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

  /* Le caselle di battito che cadono dentro un allenamento, ridotte a una
     manciata di punti. Un allenamento può scavalcare la mezzanotte, quindi le
     caselle si contano camminando avanti e cambiando giorno quando serve. */
  const curvaDi = (a) => {
    if (!a.da || !a.a) return null;
    const valori = [];
    let giorno = a.da.giorno;
    let casella = Math.floor(a.da.sec / CASELLA_SEC);
    const fineGiorno = a.a.giorno;
    const fineCasella = Math.floor(a.a.sec / CASELLA_SEC);
    // Un tetto di sicurezza: senza, un `endDate` sballato farebbe girare a
    // vuoto per giorni invece di dare una curva sbagliata e visibile.
    for (let passi = 0; passi <= CASELLE_AL_GIORNO * 2; passi++) {
      const c = battiti.get(`${giorno}|${casella}`);
      valori.push(c ? { min: c.min, max: c.max } : null);
      if (giorno === fineGiorno && casella >= fineCasella) break;
      if (giorno > fineGiorno) break;
      casella++;
      if (casella >= CASELLE_AL_GIORNO) {
        casella = 0;
        giorno = piuGiorni(giorno, 1);
      }
    }
    if (!valori.some((v) => v != null)) return null;
    // Assottigliamento: gruppi uguali, e di ogni gruppo il minimo dei minimi e
    // il massimo dei massimi — la barretta resta alta quanto il battito è
    // ballato lì dentro. Un gruppo tutto vuoto resta vuoto: il grafico lascia
    // il buco invece di inventare una barretta dove non è stato misurato niente.
    const scrivi = (v) => (v == null ? "" : v.min === v.max ? String(Math.round(v.min)) : `${Math.round(v.min)}-${Math.round(v.max)}`);
    if (valori.length <= PUNTI_MAX) return valori.map(scrivi);
    const per = Math.ceil(valori.length / PUNTI_MAX);
    const fuori = [];
    for (let i = 0; i < valori.length; i += per) {
      const gruppo = valori.slice(i, i + per).filter((v) => v != null);
      fuori.push(
        gruppo.length
          ? scrivi({ min: Math.min(...gruppo.map((g) => g.min)), max: Math.max(...gruppo.map((g) => g.max)) })
          : ""
      );
    }
    return fuori;
  };

  /* Lo sforzo scritto come riga a sé: si dà all'allenamento dentro il cui
     intervallo cade. Se ce ne sono due per lo stesso allenamento — Salute ne
     scrive uno stimato e uno corretto a mano — vince quello a mano. */
  const sforzoDi = (a) => {
    if (a.sforzo != null) return a.sforzo;
    if (!a.da || !a.a) return null;
    const dentro = sforzi.filter((s) => {
      if (s.giorno === a.da.giorno && s.sec >= a.da.sec && (a.a.giorno !== a.da.giorno || s.sec <= a.a.sec)) return true;
      if (s.giorno === a.a.giorno && a.a.giorno !== a.da.giorno && s.sec <= a.a.sec) return true;
      return false;
    });
    if (!dentro.length) return null;
    const aMano = dentro.find((s) => !s.stimato);
    return (aMano || dentro[0]).valore;
  };

  allenamenti.sort((a, b) => (a.ordine < b.ordine ? -1 : a.ordine > b.ordine ? 1 : 0));
  for (const a of allenamenti) {
    const pezzi = [`ALLENAMENTO ${a.giorno} inizio=${a.ora} durata=${a.durataSec ?? 0}`];
    if (a.fine) pezzi.push(`fine=${a.fine}`);
    if (a.kcal != null) pezzi.push(`kcal=${Math.round(a.kcal)}`);
    // «Totali» come le conta Salute: attive più quelle che bruceresti comunque.
    if (a.kcal != null && a.kcalBasale != null) {
      pezzi.push(`kcaltot=${Math.round(a.kcal + a.kcalBasale)}`);
    }
    if (a.km != null) pezzi.push(`km=${a.km.toFixed(2).replace(".", ",")}`);
    if (a.fcMedia != null) pezzi.push(`fcmedia=${Math.round(a.fcMedia)}`);
    if (a.fcMin != null) pezzi.push(`fcmin=${Math.round(a.fcMin)}`);
    if (a.fcMax != null) pezzi.push(`fcmax=${Math.round(a.fcMax)}`);
    const sf = sforzoDi(a);
    if (sf != null) pezzi.push(`sforzo=${Math.round(sf)}`);
    if (a.indoor != null) pezzi.push(`indoor=${a.indoor ? 1 : 0}`);
    if (a.tipo) pezzi.push(`tipo="${a.tipo}"`);
    out.push(pezzi.join(" "));
    const curva = curvaDi(a);
    // Due punti sono un segmento, non un andamento: sotto quella soglia la
    // riga non si scrive e il dettaglio dirà che la curva non c'è.
    if (curva && curva.filter((v) => v !== "").length >= 3) {
      out.push(`BATTITO ${a.giorno} ${a.ora} ${curva.join(",")}`);
    }
  }

  return {
    testo: out.join("\n") + "\n",
    byte: letti,
    giorni: perGiorno.size + perGiornoWatch.size,
    fasi: fasi.length,
    allenamenti: allenamenti.length,
  };
}
