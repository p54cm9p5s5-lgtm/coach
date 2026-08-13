import { h, sheet, chiedi, num, dataBreve, dataLunga, isoDate, durataUmana, aggiungi, toast } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";
import { analizza } from "../salute.js";
import { graficoLinea, schedaGrafico, periodoSalvato, selettorePeriodo, inizioPeriodo, etichettaPeriodo } from "../grafico.js";
import { anello, giudizio, coloreDaPunteggio, coloraPunteggio } from "../punteggio.js";


/**
 * Il grafico delle sigarette al giorno.
 *
 * Sta fuori dal disegno principale perché deve comparire anche quando dall'app
 * Salute non è stato importato niente: il conteggio del fumo è roba nostra, non
 * dipende da quell'import, e sparire proprio nella schermata dove lo cerchi
 * sarebbe il modo peggiore di dirlo.
 */
async function schedaSigarette({ conPeriodo, oggiIso }) {
  if (store.regole().salute?.contaSigarette === false) return null;
  const primoFumo = await store.fumoContatoDal();
  if (!primoFumo) return null;
  const conteggi = await store.conteggioFumo();
  // Il massimo non è più un numero fisso: scende ogni volta che tocchi un nuovo
  // minimo e da lì non risale. Quindi ogni giorno va giudicato con la soglia che
  // aveva quel giorno, non con quella di oggi, altrimenti il grafico riscrive il
  // passato ogni volta che scendi.
  const { limiti, corrente: limiteDomani, partenza } = await store.limitiFumo(oggiIso);
  const sogliaDi = (g) => limiti.get(g) ?? partenza;
  const tollerate = sogliaDi(oggiIso);
  const fFumo = conPeriodo();
  // Dal giorno in cui hai cominciato a contare in poi, «nessuna riga» vuol
  // dire zero: è un dato, non un buco. Prima di quel giorno il conteggio non
  // esisteva e il grafico non deve inventarlo.
  const daFumo = fFumo.dentro({ data: primoFumo }) ? primoFumo : inizioPeriodo(fFumo.periodo, oggiIso) || primoFumo;
  const serieFumo = [];
  const passo = (iso, n) => {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  for (let g = daFumo > primoFumo ? daFumo : primoFumo; g <= oggiIso; g = passo(g, 1)) {
    serieFumo.push({ data: g, presente: true, sigarette: conteggi.get(g) || 0 });
  }
  if (!serieFumo.length) return null;
  const valori = serieFumo.map((x) => x.sigarette);
  const mediaFumo = Math.round((valori.reduce((a, b) => a + b, 0) / valori.length) * 10) / 10;
  return schedaGrafico({
    selettore: fFumo.selettore,
    titolo: "Sigarette",
    valore: num(mediaFumo, 1),
    unita: "al giorno",
    nota: `${serieFumo.length} ${serieFumo.length === 1 ? "giorno" : "giorni"} · ${fFumo.etichetta}`,
    grafico: graficoLinea({
      punti: serieFumo.map((x) => ({
        data: x.data,
        valore: x.sigarette,
        evidenza: x.sigarette === 0,
        nota:
          x.sigarette > sogliaDi(x.data)
            ? `${x.sigarette - sogliaDi(x.data)} oltre il massimo di quel giorno (${sogliaDi(x.data)})`
            : `massimo di quel giorno ${sogliaDi(x.data)}`,
      })),
      obiettivo: tollerate,
      etichettaObiettivo: `massimo oggi ${tollerate}`,
      formatta: (v) => `${Math.round(v)} ${Math.round(v) === 1 ? "sigaretta" : "sigarette"}`,
      invito: "Tocca un giorno per vedere quante",
    }),
    piede: `Da quando conti (${dataBreve(primoFumo)}). I punti più grandi sono i giorni a zero. Il massimo scende da solo: quando tocchi un nuovo minimo, dal giorno dopo quello diventa il tetto e non risale più. Oggi il massimo è ${tollerate}, domani ${limiteDomani}. Oltre il massimo la giornata non supera 50.`,
  });
}

export async function render({ ridisegna }) {
  const wrap = h("div.screen");
  const oggiIso = isoDate();
  aggiungi(wrap, intestazione("Salute", { etichetta: "Aggiorna", onclick: () => aggiorna(ridisegna) }));

  const giorni = await store.giorniSalute();
  const notti = await store.notti();
  // Gli allenamenti dell'orologio sono dati importati quanto gli altri: senza
  // contarli qui, un archivio che ne aveva soltanto quelli si presentava come
  // «nessun dato importato» e non c'era modo di vederli.
  const daWatch = await store.db.count("allenamentiWatch");
  const allenamentiOrologio = await store.allenamentiWatch();
  const imp = await store.impostazioni();

  // Un solo periodo per tutta la schermata e per la Home: ogni selettore lo
  // legge e lo scrive nello stesso posto. Sta qui in cima perché serve anche
  // alla scheda delle sigarette, che esce prima di tutto il resto quando
  // dall'app Salute non è stato importato niente.
  const conPeriodo = () => {
    const periodo = periodoSalvato();
    const da = inizioPeriodo(periodo, oggiIso);
    return {
      periodo,
      selettore: selettorePeriodo(periodo, ridisegna),
      dentro: (r) => !da || (r.data >= da && r.data <= oggiIso),
      etichetta: etichettaPeriodo(periodo),
    };
  };

  if (!giorni.length && !notti.length && !daWatch) {
    aggiungi(wrap,
      h(
        "div.empty",
        h("h3", "Nessun dato importato"),
        h("p", "Un comando rapido legge gli ultimi 30 giorni dall'app Salute e li porta qui. Si configura una volta sola."),
        h(
          "div.btn-wrap",
          h("button.btn", { onclick: () => aggiorna(ridisegna) }, "Importa adesso"),
          h("div", { style: "height:8px" }),
          h("button.btn.secondary", { onclick: istruzioni }, "Come si configura")
        )
      )
    );
    const soloFumo = await schedaSigarette({ conPeriodo, oggiIso });
    if (soloFumo) aggiungi(wrap, soloFumo);
    return wrap;
  }

  const regole = store.regole().finestre || {};
  const fMov = store.statoFinestra(giorni, {
    campo: "kcalAttive",
    settimane: regole.movimento?.settimane ?? 3,
    minimoSettimana: regole.movimento?.giorniMinSettimana ?? 5,
  });
  const fSonno = store.statoFinestra(notti, {
    campo: "durataMin",
    settimane: regole.sonno?.settimane ?? 3,
    minimoSettimana: regole.sonno?.nottiMinSettimana ?? 5,
  });

  const finestra = (nome, f, unita) =>
    h(
      "div.list",
      h(
        "div.row",
        h("div.main", h("span.title", nome), h("span.sub", f.completa ? "finestra completa" : "in raccolta")),
        h("span.value", `${f.registratiTotali}/${f.richiesti} ${unita}`),
        h("span.pill", { class: f.completa ? "pill ok" : "pill warn" }, f.completa ? "pronta" : "incompleta")
      ),
      ...f.perSettimana.map((s, i) =>
        h(
          "div.row",
          h("div.main", h("span.sub", `Settimana ${i + 1} · ${dataBreve(s.da)}–${dataBreve(s.a)}`)),
          h("span.value", String(s.registrati)),
          s.primaDeiDati
            ? h("span.pill", "prima dell'app")
            : h("span.pill", { class: s.sufficiente ? "pill ok" : "pill warn" }, s.sufficiente ? "ok" : "sotto minimo")
        )
      )
    );

  // Un obiettivo solo per tutta la scheda: quello più recente che Salute ha
  // mandato, altrimenti quello impostato nell'app. Prima la linea, le
  // percentuali e la nota in fondo potevano riferirsi a numeri diversi.
  const obiettivo =
    [...giorni].sort((a, b) => (a.data < b.data ? 1 : -1)).find((g) => g.obiettivoKcal)?.obiettivoKcal ||
    imp.obiettivoMovimentoKcal;

  // I giorni arrivano dal più recente: per il grafico servono in ordine di
  // calendario, e senza la coda di giorni vuoti che non racconta niente.
  const perGrafico = (righe) => {
    const ordinate = [...righe].sort((a, b) => (a.data < b.data ? -1 : 1));
    if (ordinate.length < 2) return ordinate;
    // Un punto per ogni giorno, anche quelli senza dato: prima i punti erano
    // messi in fila per posizione, così un buco di una settimana sembrava un
    // giorno solo e la linea raccontava un andamento che non c'era.
    const passo = (iso, n) => {
      const d = new Date(iso + "T00:00:00");
      d.setDate(d.getDate() + n);
      const p = (x) => String(x).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };
    const per = new Map(ordinate.map((r) => [r.data, r]));
    const out = [];
    for (let g = ordinate[0].data; g <= ordinate[ordinate.length - 1].data; g = passo(g, 1)) {
      out.push(per.get(g) || { data: g, presente: false });
    }
    return out;
  };

  // La giornata in corso è a metà: nella media entrerebbe come un giorno fiacco
  // e farebbe sembrare che stai peggiorando. Resta nel grafico — e ovviamente
  // resta anche col periodo «1 gg», che è fatto apposta per guardare oggi.
  const soloOggi = periodoSalvato().id === "1";
  // La media non viene arrotondata qui: la distanza si mostra con un decimale,
  // e arrotondando prima «5,8 km» diventava «6,0 km», cioè un numero che non è
  // mai stato vero. Arrotonda chi disegna, che sa quante cifre servono.
  // `includiOggi` esiste per il sonno: una notte è finita stamattina, non è a
  // metà come la giornata. Escluderla faceva scrivere «20 notti con dati»
  // accanto a un pannello finestre che ne contava 21, sulla stessa schermata.
  const media = (righe, campo, { includiOggi = false } = {}) => {
    const v = righe
      .filter((r) => r.presente && (soloOggi || includiOggi || r.data < oggiIso))
      .map((r) => r[campo])
      .filter((x) => x != null);
    return v.length ? { valore: v.reduce((a, b) => a + b, 0) / v.length, quanti: v.length } : null;
  };

  // «1 gg» vuol dire oggi, e basta. Se oggi il dato non c'è, si scrive che non
  // c'è: mostrare al suo posto l'ultimo giorno disponibile faceva leggere come
  // «oggi» un numero di ieri. Il sonno è l'unica eccezione, e per un motivo
  // vero: una notte comincia la sera prima e finisce stamattina.
  const conRipiego = (righeDelPeriodo) => ({ righe: righeDelPeriodo, etichetta: null });

  const allenati = new Set(
    (await store.allenamenti()).filter((x) => x.stato === "completata").map((x) => x.data)
  );

  // ---- completezza degli allenamenti ----
  const fComp = conPeriodo();
  const tutteChiuse = (await store.allenamenti()).filter((x) => x.stato === "completata");
  const chiuse = tutteChiuse
    .filter((x) => fComp.dentro(x))
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  // La scheda resta anche quando il periodo scelto è vuoto (per esempio «1 gg»
  // in un giorno di riposo): sparire fa pensare a un guasto, dire «nessun
  // allenamento oggi» è la risposta giusta.
  if (tutteChiuse.length) {
    const voci = [];
    for (const sed of chiuse) {
      const comp = await store.completezzaSeduta(sed.id);
      voci.push({ sed, totale: comp?.totale ?? null });
    }
    const validi = voci.map((v) => v.totale).filter((x) => x != null);
    const mediaComp = validi.length
      ? Math.round(validi.reduce((a, b) => a + b, 0) / validi.length)
      : null;

    // Una riga per TIPO di allenamento, non per singola seduta. L'elenco delle
    // sedute diceva soprattutto quante ne hai fatte; la media per tipo dice
    // un'altra cosa, che è quella che serve qui: quale giorno dello split
    // regge e quale no. Le sedute una per una restano nello Storico.
    //
    // Il raggruppamento è per `tipoId`, non per nome: rinominare un giorno nel
    // brief non deve spezzare in due lo stesso allenamento. Il nome mostrato è
    // il più recente, così si legge come lo chiami adesso.
    const gruppi = new Map();
    for (const v of voci) {
      if (v.totale == null) continue;
      const chiave = v.sed.tipoId || v.sed.tipoNome;
      if (!gruppi.has(chiave)) gruppi.set(chiave, { nome: v.sed.tipoNome, totali: [] });
      gruppi.get(chiave).totali.push(v.totale);
    }
    const perTipo = [...gruppi.values()]
      .map((g) => ({
        nome: g.nome,
        quanti: g.totali.length,
        media: Math.round(g.totali.reduce((a, b) => a + b, 0) / g.totali.length),
      }))
      .sort((a, b) => a.media - b.media);

    // Stessa scala di colori del punteggio Salute: lime acceso da 95 in su,
    // rosso acceso da 20 in giù, e in mezzo il passaggio graduale.
    // La pastiglia porta con sé il proprio numero (`coloraPunteggio`): se il
    // tema cambia senza ridisegnare, la tinta si rifà da sola invece di
    // restare quella del fondo di prima.
    const pillola = (n) => {
      const c = coloreDaPunteggio(n);
      const el = h(
        "span.pill",
        {
          style:
            `font-variant-numeric:tabular-nums;background:color-mix(in srgb, ${c} 16%, transparent);color:${c}`,
        },
        String(n)
      );
      return coloraPunteggio(el, n, "color", true);
    };

    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Completezza degli allenamenti"),
        h(
          "div",
          { style: "background:var(--bg-grouped);border-radius:14px;padding:16px 14px 16px" },
          fComp.selettore,
          mediaComp != null ? anello(mediaComp, { dimensione: 168 }) : null,
          mediaComp != null
            ? h(
                "p",
                { style: "margin:12px 0 0;text-align:center;font-size:13px;color:var(--label-secondary)" },
                `${giudizio(mediaComp).testo} · ${validi.length} ${validi.length === 1 ? "allenamento" : "allenamenti"} · ${fComp.etichetta}`
              )
            : h(
                "p",
                { style: "margin:0;text-align:center;color:var(--label-secondary)" },
                `Nessun allenamento · ${fComp.etichetta}`
              ),
          h(
            "div.list",
            { style: "margin-top:16px;background:none" },
            ...perTipo.map((t) =>
              h(
                "div.row",
                h(
                  "div.main",
                  h("span.title", t.nome),
                  h("span.sub", `media di ${t.quanti} ${t.quanti === 1 ? "allenamento" : "allenamenti"}`)
                ),
                pillola(t.media)
              )
            )
          )
        ),
        h(
          "p.footnote",
          "Quanto ogni tipo di allenamento ha rispettato il programma: esercizi, cardio, riscaldamento e stretching. Ogni riga è la media delle sedute di quel tipo nel periodo scelto — il singolo allenamento si apre dallo Storico."
        )
      )
    );
  }

  // ---- movimento ----
  const fMov2 = conPeriodo();
  const ripKcal = conRipiego(giorni.filter(fMov2.dentro));
  const giorniMov = perGrafico(ripKcal.righe);
  const mKcal = media(giorniMov, "kcalAttive");
  // La scheda c'è se il dato esiste in archivio, non solo dentro il periodo
  // scelto: cambiando periodo le schede sparivano e sembrava un guasto.
  if (giorni.some((g) => g.presente && g.kcalAttive != null)) {
    aggiungi(wrap,
      schedaGrafico({
        selettore: fMov2.selettore,
        titolo: "Movimento",
        valore: mKcal ? String(Math.round(mKcal.valore)) : "—",
        unita: "kcal",
        nota: mKcal
          ? `${mKcal.quanti} ${mKcal.quanti === 1 ? "giorno" : "giorni"} con dati · ${ripKcal.etichetta || fMov2.etichetta}`
          : `nessun dato · ${fMov2.etichetta}`,
        grafico: graficoLinea({
          punti: giorniMov.map((g) => ({
            data: g.data,
            valore: g.presente ? g.kcalAttive : null,
            evidenza: allenati.has(g.data),
            nota: g.presente && g.kcalAttive != null && obiettivo
              ? `${num((g.kcalAttive / obiettivo) * 100)}% dell'obiettivo`
              : null,
          })),
          obiettivo,
          etichettaObiettivo: `obiettivo ${obiettivo}`,
          formatta: (v) => `${Math.round(v)} kcal`,
        }),
        piede: `Obiettivo Movimento ${obiettivo} kcal. I punti più grandi sono i giorni con allenamento registrato.`,
      })
    );
  }

  // ---- passi ----
  const fPassi = conPeriodo();
  const ripPassi = conRipiego(giorni.filter(fPassi.dentro));
  const giorniPassi = perGrafico(ripPassi.righe);
  const mPassi = media(giorniPassi, "passi");
  if (giorni.some((g) => g.presente && g.passi != null)) {
    aggiungi(wrap,
      schedaGrafico({
        selettore: fPassi.selettore,
        titolo: "Passi",
        valore: mPassi ? Math.round(mPassi.valore).toLocaleString("it-IT") : "—",
        nota: mPassi
          ? `${mPassi.quanti} ${mPassi.quanti === 1 ? "giorno" : "giorni"} con dati · ${ripPassi.etichetta || fPassi.etichetta}`
          : `nessun dato · ${fPassi.etichetta}`,
        grafico: graficoLinea({
          punti: giorniPassi.map((g) => ({
            data: g.data,
            valore: g.presente ? g.passi : null,
            evidenza: allenati.has(g.data),
          })),
          formatta: (v) => `${Math.round(v).toLocaleString("it-IT")} passi`,
        }),
        piede: "I passi non hanno un obiettivo nel programma: servono a leggere quanto ti muovi nei giorni senza allenamento.",
      })
    );
  }

  // ---- passo al chilometro, a piedi e di corsa ----
  /* Quanto ci metti a fare un chilometro. Non è un dato che l'orologio scrive:
     si ricava dagli allenamenti, sommando distanza e durata di quelli dello
     stesso tipo nello stesso giorno. Sommare prima e dividere dopo — invece di
     fare la media dei passi di ogni allenamento — è l'unico modo corretto: una
     camminata di dieci minuti non pesa quanto una di un'ora.

     Camminata e corsa restano separate: mescolarle darebbe un numero che non
     descrive nessuna delle due. Indoor e outdoor invece stanno insieme, come
     hai chiesto: è sempre il tempo che ci metti a fare un chilometro. */
  const passoDi = (tipi) => {
    const perData = new Map();
    let scartati = 0;
    for (const a of allenamentiOrologio) {
      if (!tipi.has(a.tipo)) continue;
      // Un allenamento senza una distanza credibile non entra nel passo: la
      // regola sta nello store, così la usano allo stesso modo questo grafico e
      // il dettaglio dell'allenamento.
      if (!store.passoAttendibile(a)) {
        if (a.durataSec > 0) scartati++;
        continue;
      }
      const r = perData.get(a.data) || { km: 0, sec: 0, quanti: 0 };
      r.km += a.km;
      r.sec += a.durataSec;
      r.quanti++;
      perData.set(a.data, r);
    }
    return { perData, scartati };
  };

  const minutiAlKm = (sec, km) => sec / 60 / km;
  const scriviPasso = (v) => {
    const m = Math.floor(v);
    const sec = Math.round((v - m) * 60);
    return sec === 60 ? `${m + 1}'00"` : `${m}'${String(sec).padStart(2, "0")}"`;
  };

  const schedaPasso = (nome, tipi, piede) => {
    const { perData, scartati } = passoDi(tipi);
    if (!perData.size) return null;
    const f = conPeriodo();
    const dentro = [...perData.entries()].filter(([data]) => f.dentro({ data }));
    // Attenzione: qui la scheda NON deve sparire. Sparendo si porta via i suoi
    // stessi tasti del periodo, e chi ha appena toccato «1 gg» in un giorno
    // senza corse non ha più niente da toccare per tornare indietro: la
    // sezione resta invisibile anche uscendo e rientrando, perché la scelta
    // del periodo è ricordata. Senza dati nel periodo si mostra la scheda
    // vuota — «nessun dato» — esattamente come fanno Movimento e Passi.
    const totali = dentro.reduce((t, [, r]) => ({ km: t.km + r.km, sec: t.sec + r.sec, quanti: t.quanti + r.quanti }), { km: 0, sec: 0, quanti: 0 });
    // Il grafico copre tutti i giorni del periodo, non solo quelli con
    // allenamenti: un buco di tre giorni deve vedersi come un buco.
    const punti = perGrafico(
      giorni.filter(f.dentro).map((g) => {
        const r = perData.get(g.data);
        return { data: g.data, presente: Boolean(r), valore: r ? minutiAlKm(r.sec, r.km) : null, r };
      })
    );
    // Se in archivio non ci sono giorni di salute che coprono quelle date, il
    // grafico si costruisce comunque dai soli giorni con allenamento.
    const finali = punti.length
      ? punti
      : dentro
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
          .map(([data, r]) => ({ data, presente: true, valore: minutiAlKm(r.sec, r.km), r }));
    const validi = finali.filter((p) => p.valore != null).map((p) => p.valore);
    // Un passo vive in una fascia stretta: partendo da zero la linea si
    // schiaccerebbe in cima. Il fondo scende un minuto sotto il più veloce.
    const minimo = validi.length ? Math.max(0, Math.floor(Math.min(...validi) - 1)) : 0;
    return schedaGrafico({
      selettore: f.selettore,
      titolo: nome,
      valore: totali.km > 0 ? scriviPasso(minutiAlKm(totali.sec, totali.km)) : "—",
      // «al km» sta nella nota e non come unità: accanto a un numero già lungo
      // («12'19"») andava a capo da solo, e si leggeva «12'19" al» e sotto «km».
      nota: totali.quanti
        ? `al km · ${totali.quanti} ${totali.quanti === 1 ? "allenamento" : "allenamenti"} · ${num(totali.km, 1)} km · ${f.etichetta}`
        : `nessun dato · ${f.etichetta}`,
      grafico: finali.length
        ? graficoLinea({
            punti: finali.map((p) => ({
              data: p.data,
              valore: p.valore,
              nota: p.r
                ? `${num(p.r.km, 2)} km in ${durataUmana(p.r.sec)}${p.r.quanti > 1 ? ` · ${p.r.quanti} allenamenti` : ""}`
                : null,
            })),
            minimo,
            formatta: (v) => `${scriviPasso(v)} al km`,
            invito: "Tocca un giorno per vedere il passo",
          })
        : null,
      piede:
        piede +
        (scartati
          ? ` ${scartati} ${scartati === 1 ? "allenamento è rimasto" : "allenamenti sono rimasti"} fuori dal conto: sotto ${num(store.PASSO_KM_MIN, 1)} km, o con una distanza che l'orologio non ha registrato bene. ${scartati === 1 ? "Resta" : "Restano"} nell'elenco, ${scartati === 1 ? "ma da solo non dice" : "ma da soli non dicono"} niente sul passo.`
          : ""),
    });
  };

  const schedaCammino = schedaPasso(
    "Passo a piedi",
    new Set(["Walking", "Hiking"]),
    "Minuti per chilometro camminando, indoor e outdoor insieme. Più basso vuol dire più veloce. " +
      "Ogni giorno somma distanza e durata delle camminate di quel giorno: una camminata corta non pesa quanto una lunga."
  );
  if (schedaCammino) aggiungi(wrap, schedaCammino);

  const schedaCorsa = schedaPasso(
    "Passo di corsa",
    new Set(["Running"]),
    "Minuti per chilometro correndo. Compare da quando l'orologio registra la prima corsa."
  );
  if (schedaCorsa) aggiungi(wrap, schedaCorsa);

  // Sotto i grafici del passo, la porta per gli allenamenti da cui vengono:
  // si guarda il numero e la domanda dopo è sempre «quali?».
  if (allenamentiOrologio.length) {
    aggiungi(wrap,
      h(
        "div.group",
        h(
          "div.list",
          h(
            "a.row",
            { href: "#/allenamenti" },
            h(
              "div.main",
              h("span.title", "Tutti gli allenamenti del Watch"),
              h("span.sub", `${allenamentiOrologio.length} in archivio, con battito e dettagli`)
            ),
            h("span.chevron", "›")
          )
        )
      )
    );
  }

  // ---- sonno ----
  const fSonno2 = conPeriodo();
  // Una notte porta la data del RISVEGLIO: quella di stanotte è datata oggi.
  // Con «1 gg» si mostra soltanto quella, e se non c'è si dice che non c'è.
  // Mostrare al suo posto l'ultima notte disponibile faceva leggere come sonno
  // di stanotte una notte di giorni prima.
  const notteDiStanotte = notti.find((n) => n.presente && n.data === oggiIso) || null;
  const ultimaNotte = [...notti]
    .filter((n) => n.presente && n.data <= oggiIso)
    .sort((a, b) => (a.data < b.data ? 1 : -1))[0];
  const nottiOrd = perGrafico(
    soloOggi ? (notteDiStanotte ? [notteDiStanotte] : []) : notti.filter(fSonno2.dentro)
  );
  const etichettaSonno = soloOggi
    ? notteDiStanotte
      ? "stanotte"
      : ultimaNotte
        ? `stanotte nessun dato · ultima notte ${dataBreve(ultimaNotte.data)}`
        : "nessuna notte registrata"
    : fSonno2.etichetta;
  // Con «1 gg» la notte mostrata è di ieri: la media non deve escluderla come
  // fa con la giornata in corso.
  const mSonno = soloOggi
    ? (() => {
        const v = nottiOrd.map((n) => n.durataMin).filter((x) => x != null);
        return v.length ? { valore: Math.round(v.reduce((a, b) => a + b, 0) / v.length), quanti: v.length } : null;
      })()
    : media(nottiOrd, "durataMin", { includiOggi: true });
  if (notti.some((n) => n.presente && n.durataMin != null)) {
    aggiungi(wrap,
      schedaGrafico({
        selettore: fSonno2.selettore,
        titolo: "Sonno",
        valore: mSonno ? durataUmana(mSonno.valore * 60) : "—",
        nota: mSonno
          ? soloOggi
            ? etichettaSonno
            : `${mSonno.quanti} ${mSonno.quanti === 1 ? "notte" : "notti"} con dati · ${etichettaSonno}`
          : soloOggi
            ? etichettaSonno
            : `nessun dato · ${etichettaSonno}`,
        grafico: graficoLinea({
          punti: nottiOrd.map((n) => ({
            data: n.data,
            valore: n.presente ? n.durataMin : null,
            nota: n.presente
              ? [
                  n.profondoMin != null ? `profondo ${n.profondoMin}m` : null,
                  n.remMin != null ? `REM ${n.remMin}m` : null,
                  n.vegliaMin != null ? `veglia ${n.vegliaMin}m` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : null,
          })),
          formatta: (v) => durataUmana(v * 60),
          invito: "Tocca una notte per vedere durata e fasi",
        }),
        piede: "Il punteggio del sonno non esiste in Salute: qui ci sono durata e fasi, che sono i dati reali.",
      })
    );
    // L'orologio il sonno lo indovina, e a volte lo sbaglia di ore. Questa è
    // l'unica strada per rimettere il numero giusto: senza, un errore
    // dell'Apple Watch restava nello storico per sempre.
    aggiungi(wrap, rigaCorrezioneNotte(notti, oggiIso, ridisegna));
  }

  // ---- sigarette ----
  const cartaFumo = await schedaSigarette({ conPeriodo, oggiIso });
  if (cartaFumo) aggiungi(wrap, cartaFumo);

  // ---- il resto del movimento: in piedi, piani, distanza ----
  // Non hanno un grafico ciascuno: sarebbero quattro schede quasi uguali. Qui
  // stanno insieme, con la media del periodo e l'ultimo giorno registrato.
  const fAltro = conPeriodo();
  const giorniAltro = giorni.filter(fAltro.dentro);
  const ALTRI = [
    { campo: "minutiInPiedi", nome: "Tempo in piedi", tempo: true },
    { campo: "pianiSaliti", nome: "Piani saliti", unita: "", dec: 0 },
    { campo: "distanzaKm", nome: "Distanza", unita: "km", dec: 1 },
    { campo: "minutiEsercizio", nome: "Minuti di esercizio", unita: "min", dec: 0 },
    { campo: "fcRiposo", nome: "Frequenza a riposo", unita: "bpm", dec: 0 },
  ].filter((x) => giorni.some((g) => g[x.campo] != null));

  if (ALTRI.length) {
    const righe = h("div.list");
    for (const a of ALTRI) {
      const rip = conRipiego(giorniAltro);
      const m = media(rip.righe, a.campo);
      const ultimo = [...rip.righe]
        .sort((x, y) => (x.data < y.data ? 1 : -1))
        .find((g) => g[a.campo] != null);
      aggiungi(righe,
        h(
          "div.row",
          h(
            "div.main",
            h("span.title", a.nome),
            h(
              "span.sub",
              m
                ? `media su ${m.quanti} ${m.quanti === 1 ? "giorno" : "giorni"} · ${rip.etichetta || fAltro.etichetta}`
                : "nessun dato"
            )
          ),
          h(
            "span.value",
            m ? (a.tempo ? durataUmana(m.valore * 60) : `${num(m.valore, a.dec)}${a.unita ? ` ${a.unita}` : ""}`) : "—"
          ),
          ultimo
            ? h(
                "span.pill",
                // Con l'unità anche qui: «05/08: 6» sotto una media in km non
                // si capisce se sono chilometri o piani.
                `${dataBreve(ultimo.data)}: ${
                  a.tempo
                    ? durataUmana(ultimo[a.campo] * 60)
                    : `${num(ultimo[a.campo], a.dec)}${a.unita ? ` ${a.unita}` : ""}`
                }`
              )
            : null
        )
      );
    }
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Resto del movimento"),
        fAltro.selettore,
        righe,
        h("p.footnote", "Arrivano dal comando rapido Salute. Non entrano nel punteggio: servono a leggere le giornate.")
      )
    );
  }

  aggiungi(wrap,
    h(
      "div.group",
      h("h2", "Finestre dati"),
      finestra("Movimento", fMov, "giorni"),
      h("div", { style: "height:10px" }),
      finestra("Sonno", fSonno, "notti"),
      h(
        "p.footnote",
        "Un giorno senza dati non vale zero: resta fuori dalle medie e dal conteggio. Finché la finestra non è completa questi numeri sono raccolta, non azione."
      )
    )
  );

  // Corpo e Storico stanno qui, non nella barra in basso: sono due letture dei
  // dati, non due posti dove si registra qualcosa ogni giorno. La barra resta
  // per quello che si tocca durante la giornata.
  aggiungi(wrap,
    h(
      "div.group",
      h(
        "div.list",
        h(
          "a.row",
          { href: "#/corpo" },
          h("div.main", h("span.title", "Corpo"), h("span.sub", "peso, circonferenze, indici e foto")),
          h("span.chevron", "›")
        ),
        h(
          "a.row",
          { href: "#/storico" },
          h("div.main", h("span.title", "Storico"), h("span.sub", "allenamenti, volumi e andamento per esercizio")),
          h("span.chevron", "›")
        )
      )
    )
  );

  aggiungi(wrap,
    h(
      "div.group",
      h(
        "div.list",
        h(
          "div.row",
          h("div.main", h("span.title", "Ultimo import")),
          h("span.value", imp.ultimoImportSalute ? new Date(imp.ultimoImportSalute).toLocaleString("it-IT") : "mai")
        ),
        h("button.row.accent", { onclick: () => aggiorna(ridisegna) }, h("div.main", h("span.title", "Aggiorna dati salute")), h("span.chevron", "›")),
        h("button.row.accent", { onclick: istruzioni }, h("div.main", h("span.title", "Come si configura il comando rapido")), h("span.chevron", "›"))
      )
    )
  );

  return wrap;
}

// ---------- import ----------

async function aggiorna(ridisegna) {
  return apriImport(ridisegna, {
    titolo: "Aggiorna dati salute",
    testo:
      "Scegli l'esportazione di Salute (profilo → «Esporta tutti i dati», poi estrai lo zip in File) " +
      "oppure incolla un pacchetto già pronto.",
    // Nessun comando rapido: le azioni di Salute dentro Comandi Rapidi restano
    // appese, e un tasto che apre una cosa che non risponde è peggio che
    // nessun tasto. Il calendario, che invece funziona, il suo ce l'ha ancora.
  });
}

/**
 * Stesso flusso per qualunque pacchetto: il formato è uno solo e il testo
 * incollato può contenere salute, calendario o tutti e due insieme.
 */
/**
 * @param shortcut  nome del comando rapido da offrire, oppure `null`.
 *
 * Per i dati salute è `null`: le azioni di Salute dentro Comandi Rapidi non
 * funzionano, e offrire un tasto che apre un comando che resta appeso è peggio
 * che non offrirlo. Resta per il calendario, che invece funziona.
 */
export async function apriImport(ridisegna, { titolo, testo, shortcut = null }) {
  const opzioni = [];
  if (shortcut) opzioni.push({ etichetta: `Apri «${shortcut}»`, valore: "apri" });
  opzioni.push({ etichetta: shortcut ? "Ho già copiato: incolla adesso" : "Importa", valore: "incolla" });

  const scelta = await chiedi({ titolo, testo, opzioni });
  if (!scelta) return;

  if (scelta === "apri") {
    location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcut)}`;
    return;
  }
  await incolla(ridisegna);
}

async function incolla(ridisegna) {
  // Niente lettura automatica degli appunti: quando la pagina la chiede, iOS
  // mette il suo pulsante «Incolla» sopra a tutto e SMETTE DI DISEGNARE finché
  // non lo tocchi — il riquadro c'era ma non si vedeva, e sembrava che il tocco
  // non avesse fatto niente. Qui il riquadro appare subito e gli appunti si
  // chiedono con un pulsante, cioè con un gesto tuo, quando li vuoi.
  const testo = await sheet((close) => {
    const area = h("textarea.note", {
      style: "min-height:160px",
      placeholder: "Incolla qui il testo copiato dal comando rapido",
    });

    const nota = h(
      "p.footnote",
      { style: "margin:8px 16px 0" },
      "Tieni premuto nel riquadro e scegli Incolla. Oppure usa il pulsante qui sotto."
    );
    const daAppunti = h(
      "button.btn.secondary",
      {
        onclick: async () => {
          try {
            const t = await navigator.clipboard.readText();
            if (!t) {
              nota.textContent = "Gli appunti sono vuoti: hai eseguito il comando rapido?";
              return;
            }
            area.value = t;
            const righe = t.split("\n").filter((r) => r.trim()).length;
            nota.textContent = `Letto dagli appunti: ${righe} righe. Controlla e tocca Importa.`;
          } catch {
            nota.textContent =
              "iOS non ha concesso la lettura: tieni premuto nel riquadro e scegli Incolla.";
          }
        },
      },
      "Leggi dagli appunti"
    );

    // Da file, senza passare dagli appunti.
    //
    // Quando i Comandi Rapidi non funzionano — su una beta di iOS le azioni di
    // Salute possono restare appese — il pacchetto lo prepara lo strumento sul
    // Mac e arriva qui come file. Copiare ventimila caratteri a mano su un
    // telefono è un supplizio che non ha ragione di esistere.
    const daFile = h(
      "button.btn.secondary",
      {
        onclick: () => {
          const scelta = h("input", {
            type: "file",
            accept: ".txt,.md,.xml,text/plain,text/markdown,text/xml",
            style: "display:none",
          });
          scelta.addEventListener("change", async () => {
            const f = scelta.files?.[0];
            scelta.remove();
            if (!f) return;
            try {
              // L'export di Salute pesa centinaia di megabyte: non si legge
              // tutto insieme, si fa scorrere. Un pacchetto già pronto invece
              // è di pochi kilobyte e si legge e basta.
              const grande = /\.xml$/i.test(f.name) || f.size > 2 * 1024 * 1024;
              let t;
              if (grande) {
                const { pacchettoDaExport } = await import("../salute-export.js");
                const mega = (f.size / 1048576).toFixed(0);
                nota.textContent = `Leggo ${f.name} (${mega} MB): non lo carico tutto, lo scorro. Aspetta.`;
                // Mai dati più vecchi dell'inizio della storia. Il giorno è
                // scritto qui, non dedotto dai dati del telefono: deve
                // sopravvivere a un cambio di dispositivo, a un archivio
                // svuotato e a un ripristino da backup — cioè proprio ai casi
                // in cui i dati locali non sanno più da quando si è partiti.
                //
                // Se però l'app avesse una storia ancora più lunga di così
                // (un altro profilo, un altro atleta), comanda quella: il
                // pavimento serve a non prendere di più, mai a tagliare.
                const inizio = await store.inizioStoria();
                const esito = await pacchettoDaExport(f, {
                  giorni: 30,
                  dal: inizio,
                  onAvanzamento: (letti) => {
                    const q = Math.min(99, Math.round((letti / f.size) * 100));
                    nota.textContent = `Leggo ${f.name}: ${q}%`;
                  },
                });
                t = esito.testo;
                nota.textContent =
                  `Letto ${mega} MB: ${esito.fasi} fasi di sonno, ${esito.allenamenti} allenamenti. ` +
                  "Controlla e tocca Importa.";
              } else {
                t = await f.text();
                const righe = t.split("\n").filter((r) => r.trim()).length;
                nota.textContent = `Letto da ${f.name}: ${righe} righe. Controlla e tocca Importa.`;
              }
              area.value = t;
            } catch (e) {
              nota.textContent = `Il file non si è letto: ${e.message}`;
            }
          });
          document.body.append(scelta);
          scelta.click();
        },
      },
      "Scegli un file"
    );

    return h(
      "div",
      h("h2", "Incolla i dati"),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
        "Il testo del comando rapido, oppure un file preparato sul Mac."
      ),
      area,
      nota,
      h(
        "div.btn-wrap",
        daFile,
        h("div", { style: "height:8px" }),
        daAppunti,
        h("div", { style: "height:8px" }),
        h("button.btn", { onclick: () => close(area.value) }, "Importa")
      )
    );
  });
  if (!testo || !testo.trim()) return;

  let pacchetto;
  try {
    pacchetto = analizza(testo);
  } catch (e) {
    // Un pacchetto vuoto letto dal calendario vuol dire una cosa precisa: il
    // coach ha tolto tutto. Prima l'app diceva solo «non importato» e teneva
    // gli allenamenti vecchi, continuando a proporli.
    const eraCalendario = /COACH-DATI/i.test(testo) && (await store.agenda()).length > 0;
    if (eraCalendario && /vuoto/i.test(e.message)) {
      const ok = await chiedi({
        titolo: "Il calendario è vuoto",
        testo:
          "Il comando non ha trovato nessun evento. Se il coach ha svuotato il calendario, posso dimenticare gli allenamenti letti prima: l'app tornerà a seguire lo split del brief finché non rileggi il calendario.",
        opzioni: [
          { etichetta: "Dimentica gli allenamenti letti", valore: "svuota", stile: "danger" },
          { etichetta: "Lascia com'è", valore: "no" },
        ],
      });
      if (ok === "svuota") {
        await store.svuotaAgenda();
        toast("Allenamenti letti dimenticati.");
        if (ridisegna) await ridisegna();
      }
      return;
    }
    const dettagli = e.avvisi?.length ? `\n\nRighe scartate:\n${e.avvisi.slice(0, 5).join("\n")}` : "";
    await chiedi({
      titolo: "Non importato",
      testo: `${e.message}${dettagli}`,
      opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      annulla: false,
    });
    return;
  }

  const conteggio = await store.importaSalute(pacchetto);
  try {
    await store.snapshotAutomatico("import salute");
  } catch {
    // i dati sono già entrati: la copia interna non deve far fallire l'import
  }

  // Nel riepilogo compare solo quello che il pacchetto conteneva davvero: una
  // fila di zeri fa sembrare fallito un import riuscito.
  const righe = [];
  if (conteggio.giorni) {
    righe.push(
      `${conteggio.giorni} ${conteggio.giorni === 1 ? "giorno" : "giorni"} di movimento` +
        (conteggio.aggiornati ? ` (${conteggio.aggiornati} ${conteggio.aggiornati === 1 ? "aggiornato" : "aggiornati"})` : "")
    );
  }
  if (conteggio.notti) righe.push(`${conteggio.notti} ${conteggio.notti === 1 ? "notte" : "notti"} di sonno`);
  // Una notte che hai corretto tu non viene sovrascritta: se non lo dicessi,
  // vedresti «importato» e penseresti che il numero dell'orologio è tornato.
  if (conteggio.nottiAMano) {
    righe.push(
      `${conteggio.nottiAMano} ${conteggio.nottiAMano === 1 ? "notte scritta" : "notti scritte"} da te: ` +
        `${conteggio.nottiAMano === 1 ? "lasciata" : "lasciate"} com'${conteggio.nottiAMano === 1 ? "era" : "erano"}, l'orologio non la sovrascrive`
    );
  }
  if (conteggio.allenamenti) righe.push(`${conteggio.allenamenti} ${conteggio.allenamenti === 1 ? "allenamento" : "allenamenti"} dal Watch`);
  if (conteggio.agenda) {
    righe.push(`${conteggio.agenda} ${conteggio.agenda === 1 ? "giorno" : "giorni"} dal calendario`);
  }
  if (conteggio.troppoVecchi) {
    righe.push(
      `${conteggio.troppoVecchi} ${conteggio.troppoVecchi === 1 ? "riga più vecchia" : "righe più vecchie"} dell'inizio di questa storia: ${conteggio.troppoVecchi === 1 ? "lasciata fuori" : "lasciate fuori"}`
    );
  }
  if (conteggio.vuoti) righe.push(`${conteggio.vuoti} ${conteggio.vuoti === 1 ? "giorno" : "giorni"} senza dati, ${conteggio.vuoti === 1 ? "segnato" : "segnati"} come non ${conteggio.vuoti === 1 ? "registrato" : "registrati"}`);
  if (pacchetto.avvisi.length) righe.push(`Avvisi: ${pacchetto.avvisi.slice(0, 3).join(" · ")}`);

  // Un giorno già passato che cambia di molto vuol dire che uno dei due
  // conteggi è sbagliato — quasi sempre il comando rapido che somma iPhone e
  // Watch insieme. Sovrascrivere in silenzio sarebbe scegliere al posto tuo.
  // Notti rimosse perché rimpiazzate: va detto, non fatto di nascosto.
  if (conteggio.nottiTolte?.length) {
    righe.push(
      `${conteggio.nottiTolte.length} ${conteggio.nottiTolte.length === 1 ? "notte doppia rimossa" : "notti doppie rimosse"} (${conteggio.nottiTolte.slice(0, 6).join(", ")}${conteggio.nottiTolte.length > 6 ? "…" : ""})`
    );
  }

  // Valori impossibili: non sono entrati, e va detto prima di ogni altra cosa.
  // Un numero che l'app ha rifiutato è un numero che manca, e chi legge deve
  // sapere che manca e perché.
  if (conteggio.impossibili?.length) {
    await chiedi({
      titolo: conteggio.impossibili.length === 1 ? "Un numero non l'ho registrato" : "Alcuni numeri non li ho registrati",
      testo:
        `${conteggio.impossibili.slice(0, 8).join("\n")}` +
        (conteggio.impossibili.length > 8 ? `\n…e altri ${conteggio.impossibili.length - 8}.` : "") +
        `\n\nSono fuori da quello che una giornata umana può contenere: quasi sempre vuol dire che il comando rapido ha sommato una finestra intera in un giorno solo, oppure ha messo un campo al posto di un altro. Il resto della giornata è stato importato normalmente.` +
        `\n\nControlla su Salute il valore vero di quel giorno e come è impostato il comando rapido. Finché il numero non torna, quel campo resta vuoto invece che sbagliato.`,
      opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      annulla: false,
    });
  }

  // Una notte già archiviata che arriva con un'altra durata: l'app non sceglie
  // da sola quale credere, perché quel numero il coach lo legge nel pacchetto.
  if (conteggio.nottiDiscordanti?.length) {
    await chiedi({
      titolo:
        conteggio.nottiDiscordanti.length === 1
          ? "Una notte già registrata arriva con un'altra durata"
          : "Notti già registrate arrivano con altre durate",
      testo:
        `${conteggio.nottiDiscordanti.slice(0, 6).join("\n")}` +
        (conteggio.nottiDiscordanti.length > 6 ? `\n…e altre ${conteggio.nottiDiscordanti.length - 6}.` : "") +
        `\n\nFra le due ho tenuto la più lunga. Su una notte finita i campioni di Salute non cambiano più: quello che cambia è la finestra con cui il comando rapido li chiede, e una finestra tagliata può solo togliere sonno, mai aggiungerlo — quindi la durata corta è quella incompleta.` +
        `\n\nSe per qualche motivo quella giusta era la corta, aprila da Salute › Sonno e scrivila a mano: una notte scritta da te non viene più toccata da nessun import.`,
      opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      annulla: false,
    });
  }

  if (conteggio.sospetti?.length) {
    await chiedi({
      titolo: "Numeri cambiati su giorni già registrati",
      testo:
        `${conteggio.sospetti.slice(0, 6).join("\n")}` +
        `\n\nGiorni finiti non cambiano da soli. Di solito succede quando il comando rapido somma i campioni di iPhone e Watch: i passi, la distanza e i piani li registrano tutti e due, e i periodi in cui li avevi entrambi addosso vengono contati due volte. Le calorie attive no, le scrive solo l'orologio: se quelle restano identiche e i passi crescono, è questo.` +
        `\n\nHo tenuto i numeri nuovi, perché di solito si reimporta proprio per correggere. Se invece quelli giusti erano i vecchi: Impostazioni › «Cancella i dati importati da Salute», poi reimporta col comando sistemato.` +
        `\n\nControlla su Salute il numero vero di uno di questi giorni e, se serve, filtra l'origine dentro il comando rapido.`,
      opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      annulla: false,
    });
  }

  await chiedi({
    titolo: righe.length ? "Importato" : "Niente da importare",
    testo: righe.length ? righe.join("\n") : "Il pacchetto era vuoto.",
    opzioni: [{ etichetta: "Bene", valore: "ok" }],
    annulla: false,
  });

  await ridisegna();
}

// ---------- istruzioni ----------

function passo(n, titolo, ...dettagli) {
  return h(
    "div.passo",
    h("div.n", String(n)),
    h("div.testo", h("span.nome", titolo), ...dettagli.map((d) => h("span.come", d)))
  );
}

async function istruzioni() {
  const oggi = isoDate();
  // Il formato descritto qui è quello che l'app legge DAVVERO oggi: prima
  // queste istruzioni erano rimaste all'esplorazione iniziale e insegnavano un
  // pacchetto più povero di quello in uso.
  const esempio = [
    "COACH-DATI v1",
    "FINESTRA AAAA-MM-GG AAAA-MM-GG",
    `GIORNO ${oggi} kcal=NNN obiettivo=NNN passi=NNNN esercizio=NN inpiedi=NNN piani=NN km=N,NN fc=NN`,
    "NOTTE AAAA-MM-GG durata=NNN profondo=NN rem=NN veglia=NN risvegli=N",
    "FASE AAAA-MM-GG HH:MM AAAA-MM-GG HH:MM Core",
    `ALLENAMENTO ${oggi} inizio=HH:MM durata=NNNN kcal=NNN kcaltot=NNN fcmedia=NNN fcmax=NNN tipo="Rafforzamento funzionale"`,
    "AGENDA AAAA-MM-GG titolo=Gambe/Core nota=porta la cintura",
  ].join("\n");

  await sheet((close) =>
    h(
      "div",
      h("h2", "Come arrivano i dati"),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
        "Si costruiscono una volta sola nell'app Comandi Rapidi. Poi girano da soli e tu incolli qui."
      ),

      h(
        "div.group",
        h("h2", "1. I due comandi"),
        h(
          "div.guida",
          { style: "margin:0" },
          passo(
            1,
            "«Coach Salute»",
            "Legge dall'app Salute gli ultimi 30 giorni: movimento, passi, minuti di esercizio, tempo in piedi, piani, distanza, frequenza a riposo, e le fasi del sonno. Ultima azione: «Copia negli appunti»."
          ),
          passo(
            2,
            "«Coach Calendario»",
            "Legge gli eventi del calendario da oggi ai prossimi 28 giorni e scrive una riga AGENDA per ognuno. Serve solo se gli allenamenti te li scrive il coach sul calendario."
          )
        )
      ),

      h(
        "div.group",
        h("h2", "2. Cosa devono produrre"),
        h(
          "div.guida",
          { style: "margin:0" },
          h(
            "section",
            h("h3", "Formato"),
            h(
              "p",
              { style: "font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap;line-height:1.5" },
              esempio
            )
          ),
          h(
            "section",
            h("h3", "Regole"),
            h(
              "ul",
              h("li", "La prima riga è sempre COACH-DATI v1."),
              h("li", "FINESTRA dice quali giorni copre il pacchetto: quelli senza riga GIORNO diventano «non registrati»."),
              h("li", "Sonno in minuti, durata allenamento in secondi, distanza in km (oppure metri= e la converte l'app)."),
              h("li", "Le righe FASE sono le fasi grezze dell'orologio: durata, profondo, REM e risvegli li calcola l'app. Se ci sono sia NOTTE che FASE per la stessa notte, vince NOTTE."),
              h("li", "Un campo che manca si omette: assente non vuol dire zero."),
              h("li", "Righe sconosciute vengono ignorate senza far fallire l'import.")
            )
          )
        )
      ),

      h(
        "div.group",
        h("h2", "3. Uso quotidiano"),
        h(
          "div.guida",
          { style: "margin:0" },
          passo(1, "Se il comando rapido funziona", "Automazione alle 5:00: Comandi Rapidi → Automazione → Ora del giorno → 05:00 → esegui «Coach Salute», senza chiedere conferma. Ultima azione: «Copia negli appunti». Poi qui: Aggiorna → Incolla."),
          passo(2, "Se resta appeso — e capita", "Le azioni di Salute dentro Comandi Rapidi su alcune versioni di iOS non rispondono. Allora si passa dall'esportazione: Salute → foto profilo → «Esporta tutti i dati» → in File si estrae lo zip → qui: Aggiorna → Importa → «Scegli un file». Legge tutto dal telefono, senza computer."),
          passo(3, "In tutti e due i casi", "Se salti dei giorni non perdi niente: la finestra è di 30 giorni e reimportare riscrive senza duplicare — e da adesso un pacchetto più povero non cancella più quello che c'era.")
        )
      ),

      h("div.btn-wrap", h("button.btn", { onclick: () => close() }, "Chiudi"))
    )
  );
}

/**
 * Correggere a mano una notte che l'orologio ha sbagliato.
 *
 * L'Apple Watch il sonno lo deduce: se lo togli, se perde il contatto, se ti
 * addormenti prima che se ne accorga, registra un pezzo di notte e lo chiama
 * «la notte». Otto ore diventano tre, e l'ora in cui sei andato a letto —
 * che pesa da sola sul punteggio — diventa quella in cui l'orologio si è
 * accorto di te.
 *
 * Qui si scrivono le due cose che sai per certo: quando sei andato a letto e
 * quando ti sei svegliato. Da lì la notte è tua e nessun import la tocca più.
 */
function rigaCorrezioneNotte(notti, oggiIso, ridisegna) {
  const perData = new Map(notti.map((n) => [n.data, n]));
  const gia = notti.filter((n) => n.fonte === "mano").length;

  const apri = () =>
    sheet((close) => {
      let data = oggiIso;
      const campoData = h("input", { type: "date", value: data, style: STILE_CAMPO });
      const aLetto = h("input", { type: "time", value: "23:30", style: STILE_CAMPO });
      const sveglio = h("input", { type: "time", value: "07:30", style: STILE_CAMPO });
      const esito = h("p", {
        style: "margin:10px 16px 0;min-height:34px;font-size:13px;line-height:1.3;color:var(--label-secondary);text-align:center",
      });
      // Due tasti diversi perché sono due cose diverse: rimettere il dato
      // dell'orologio si può solo se quel dato c'è. Quando non c'è, togliere la
      // correzione lascia la notte senza niente, e il tasto lo deve dire.
      const scorda = h("button.btn.secondary", { style: "display:none" }, "Torna al dato dell'orologio");

      const mostra = () => {
        data = campoData.value || oggiIso;
        const n = perData.get(data);
        const [hL, mL] = (aLetto.value || "0:0").split(":").map(Number);
        const [hS, mS] = (sveglio.value || "0:0").split(":").map(Number);
        let minuti = hS * 60 + mS - (hL * 60 + mL);
        if (minuti <= 0) minuti += 24 * 60;
        const quanto = durataUmana(minuti * 60);
        // Quando la notte è già corretta, il numero in archivio è il TUO: dire
        // «l'orologio dice» un numero che hai scritto tu è una bugia piccola e
        // fastidiosa, proprio nel pannello che serve a togliere una bugia.
        const prima =
          n?.fonte === "mano" && n.durataMin != null
            ? ` Adesso è scritta da te: ${durataUmana(n.durataMin * 60)}.`
            : n?.presente && n.durataMin != null
              ? ` L'orologio dice ${durataUmana(n.durataMin * 60)}.`
              : n
                ? " Per quella notte l'orologio non ha registrato niente."
                : "";
        esito.textContent = `Dormito: ${quanto}.${prima}`;
        scorda.style.display = n?.fonte === "mano" ? "" : "none";
        scorda.textContent =
          n?.orologio?.durataMin != null
            ? `Torna al dato dell'orologio (${durataUmana(n.orologio.durataMin * 60)})`
            : "Togli la correzione (l'orologio non ha un dato)";
      };
      campoData.addEventListener("input", mostra);
      aLetto.addEventListener("input", mostra);
      sveglio.addEventListener("input", mostra);
      setTimeout(mostra, 0);

      scorda.onclick = async () => {
        const esitoScorda = await store.scordaCorrezioneNotte(campoData.value);
        close();
        toast(
          esitoScorda === "orologio"
            ? "Rimesso il dato dell'orologio."
            : "Correzione tolta: per quella notte non resta nessun dato."
        );
        await ridisegna();
      };

      return h(
        "div",
        h("h2", "Correggi una notte"),
        h(
          "p",
          { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
          "La data è quella del RISVEGLIO. Le fasi (profondo, REM, veglia) si perdono: " +
            "quelle l'orologio le sa e tu no, ma una durata giusta senza fasi vale più di una sbagliata con le fasi."
        ),
        h("div.field", h("label", "Notte del risveglio"), campoData),
        h("div.field", h("label", "A letto"), aLetto),
        h("div.field", h("label", "Sveglio"), sveglio),
        esito,
        h(
          "div.btn-wrap",
          h(
            "button.btn",
            {
              onclick: async () => {
                try {
                  const r = await store.correggiNotte(campoData.value, {
                    aLetto: aLetto.value,
                    sveglio: sveglio.value,
                  });
                  close();
                  toast(`Notte del ${dataBreve(r.data)}: ${durataUmana(r.durataMin * 60)}.`);
                  await ridisegna();
                } catch (e) {
                  esito.textContent = e.message;
                  esito.style.color = "var(--orange)";
                }
              },
            },
            "Salva questa notte"
          ),
          scorda
        )
      );
    });

  return h(
    "div.group",
    h(
      "div.list",
      h(
        "a.row",
        { href: "#/salute", onclick: (e) => { e.preventDefault(); apri(); } },
        h(
          "div.main",
          h("span.title", "Correggi una notte"),
          h(
            "span.sub",
            gia
              ? `${gia} ${gia === 1 ? "notte scritta" : "notti scritte"} da te · l'import non le tocca`
              : "quando l'orologio sbaglia le ore di sonno"
          )
        ),
        h("span.chevron", "›")
      )
    )
  );
}

const STILE_CAMPO =
  "border:0;background:var(--fill-tertiary);border-radius:10px;padding:10px 12px;" +
  "font:inherit;font-size:17px;color:var(--label);min-height:44px";
