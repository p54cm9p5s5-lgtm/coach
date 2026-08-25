import {
  h, isoDate, dataLunga, dataBreve, sheet, num, giorniTra, durataUmana, aggiungi, chiedi, toast,
  versioneInstallata,
} from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";
import { graficoAttivita, graficoLinea, fascia, legenda, periodoSalvato, selettorePeriodo, inizioPeriodo, etichettaPeriodo, CHIAVE_PERIODO_SALUTE } from "../grafico.js";
import { calendario, calcolaAttese, riassuntoGiorno } from "../calendario.js";
import { anello, giudizio, coloreDaPunteggio, coloraPunteggio } from "../punteggio.js";
import { unaVoltaSola } from "../ui.js";

let meseMostrato = null;

export async function render({ vaiA, ridisegna }) {
  const oggi = isoDate();
  const prog = store.programma();
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Home", { icona: "ingranaggio", etichetta: "Impostazioni", onclick: () => vaiA("impostazioni") }));

  if (!prog) {
    aggiungi(wrap,
      h(
        "div.empty",
        h("h3", "Nessun programma caricato"),
        h("p", "Carica il master brief: l'app legge il blocco tecnico in coda al documento e imposta split, esercizi e regole."),
        h("div.btn-wrap", h("button.btn", { onclick: () => vaiA("impostazioni") }, "Carica master brief"))
      )
    );
    return wrap;
  }

  // Il punteggio Salute sta in cima a tutto: è la domanda a cui l'app deve
  // rispondere per prima quando la apri — com'è andata oggi, tutto compreso.
  const grafici = await bloccoGrafico(ridisegna);
  aggiungi(wrap, grafici.salute);
  aggiungi(wrap, await bloccoAllenamento(vaiA, ridisegna, oggi));
  aggiungi(wrap, grafici.andamento);
  aggiungi(wrap, await bloccoWatch());
  aggiungi(wrap, await bloccoProposte());
  aggiungi(wrap, await bloccoCalendario(vaiA, ridisegna));

  aggiungi(wrap,
    h("div.btn-wrap", h("button.btn", { onclick: () => vaiA("export") }, "Claude")),
    // versione a vista: quando qualcosa "non si aggiorna", questo numero dice
    // in un colpo solo se il telefono ha ricevuto o no l'ultima pubblicazione
    h(
      "p",
      {
        style: "margin:18px 16px 0;text-align:center;font-size:11px;color:var(--label-tertiary)",
        onclick: () => vaiA("impostazioni"),
      },
      `versione ${await versioneInstallata()}`
    )
  );

  return wrap;
}

// ---------- grafico ----------

async function bloccoGrafico(ridisegna) {
  const periodo = periodoSalvato();
  // Il punteggio Salute ha i suoi quattro tasti, staccati: spostarlo su «1 gg»
  // non deve portarsi dietro passi, movimento e sonno qui sotto, e viceversa.
  const periodoSalute = periodoSalvato("tutto", CHIAVE_PERIODO_SALUTE);
  const oggi = isoDate();
  const giorni = await store.giorniSalute();
  const notti = await store.notti();
  const tutti = await store.allenamenti();
  const obiettivo = await store.impostazione("obiettivoMovimentoKcal");

  // La stessa regola del calendario e del punteggio Salute: la data del brief
  // da sola si sposta in avanti a ogni aggiornamento, e il grafico smetteva di
  // segnare come previsti giorni che lo erano stati davvero.
  const inizioProgramma = (await store.inizioProgramma()) || "0000-00-00";
  const perData = new Map(giorni.map((g) => [g.data, g]));
  const perNotte = new Map(notti.map((n) => [n.data, n]));
  const allenati = new Set(tutti.filter((s) => s.stato === "completata").map((s) => s.data));

  // Il grafico parte dal primo giorno per cui esiste un dato e arriva a oggi:
  // il periodo prima dell'app non racconta niente. Oltre le otto settimane la
  // finestra scorre, altrimenti le barre diventano illeggibili.
  const primeDate = [
    ...giorni.filter((g) => g.presente).map((g) => g.data),
    ...notti.filter((n) => n.presente).map((n) => n.data),
    ...[...allenati],
  ].sort();
  const inizio = primeDate[0] || oggi;
  // Il grafico non parte mai da prima del primo dato: sarebbe una fila di
  // giorni vuoti. Oltre il mese non va comunque.
  const disponibili = giorniTra(inizio, oggi) + 1;
  let quanti = Math.min(periodo.graficoGiorni, Math.max(disponibili, 7));
  if (periodo.id === "7") quanti = 7;

  const GIORNI_FUTURI = periodo.futuri;
  const serie = [];
  for (let i = quanti - 1; i >= -GIORNI_FUTURI; i--) {
    const d = new Date(oggi + "T00:00:00");
    d.setDate(d.getDate() - i);
    const p = (n) => String(n).padStart(2, "0");
    const data = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const g = perData.get(data);
    const n = perNotte.get(data);
    serie.push({
      data,
      futuro: data > oggi,
      // Prima che il programma esistesse non era previsto niente: segnarlo
      // dipingerebbe di «allenamento previsto» un passato che non c'era.
      previsto: data >= inizioProgramma && Boolean(store.giornoPrevisto(data)),
      origine: store.origineGiorno(data),
      presente: Boolean(g?.presente),
      kcal: g?.presente ? g.kcalAttive : null,
      passi: g?.presente ? g.passi : null,
      obiettivo: g?.obiettivoKcal || null,
      allenamento: allenati.has(data),
      sonnoMin: n?.presente ? n.durataMin : null,
    });
  }

  // Le medie sono su tutto quello che l'app ha, non sull'ultima settimana: si
  // muovono a ogni import e diventano più solide man mano che i dati crescono.
  const media = (arr, campo) => {
    const v = arr.map((x) => x[campo]).filter((x) => x != null);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };

  // Finestra dei numeri: quella scelta, oppure tutto lo storico.
  const daQuando = inizioPeriodo(periodo, oggi);
  const dentro = (r) => !daQuando || (r.data >= daQuando && r.data <= oggi);
  // Oggi non è finita: nella media entrerebbe come un giorno fiacco. Col
  // periodo «1 gg» invece è proprio oggi che vuoi vedere.
  const soloOggi = periodo.id === "1";
  // «1 gg» vuol dire oggi: se il dato di oggi non c'è, si scrive che non c'è.
  // Mettere al suo posto l'ultimo giorno disponibile faceva leggere come «oggi»
  // un numero di ieri. Il sonno resta l'eccezione, più sotto: una notte
  // comincia la sera prima e finisce stamattina.
  const giorniConDati = giorni.filter(
    (g) => g.presente && dentro(g) && (soloOggi || g.data < oggi)
  );
  const etichettaGiorni = etichettaPeriodo(periodo);
  // Una notte porta la data del RISVEGLIO: quella di stanotte è datata oggi.
  // Con «1 gg» si mostra soltanto quella. Prima si prendeva l'ultima notte
  // disponibile qualunque fosse: senza il dato di stanotte compariva come
  // sonno «di oggi» una notte di giorni prima, con la data scritta piccola
  // accanto — e un numero che non c'entra niente letto come se fosse tuo.
  const notteDiStanotte = notti.find((n) => n.presente && n.data === oggi) || null;
  const ultimaNotte = [...notti]
    .filter((n) => n.presente && n.data <= oggi)
    .sort((a, b) => (a.data < b.data ? 1 : -1))[0];
  const nottiConDati = soloOggi
    ? notteDiStanotte
      ? [notteDiStanotte]
      : []
    : notti.filter((n) => n.presente && dentro(n));
  const mediaKcal = media(giorniConDati, "kcalAttive");
  const mediaPassi = media(giorniConDati, "passi");
  const mediaSonno = media(nottiConDati, "durataMin");
  const quantiKcal = giorniConDati.filter((g) => g.kcalAttive != null).length;
  const quantiPassi = giorniConDati.filter((g) => g.passi != null).length;
  const quanteNotti = nottiConDati.filter((n) => n.durataMin != null).length;

  const selettore = selettorePeriodo(periodo, ridisegna);

  // Il punteggio Salute della giornata: sonno, allenamento, movimento e fumo
  // messi insieme con le stesse regole rigide del punteggio di allenamento.
  // Sta in cima perché è la domanda a cui l'app deve rispondere per prima:
  // com'è andata oggi, tutto compreso.
  const soloOggiSalute = periodoSalute.id === "1";
  const daQuandoP = inizioPeriodo(periodoSalute, oggi) || primeDate[0] || oggi;
  const punteggi = await store.punteggiSalute(daQuandoP, oggi);
  const perPunteggio = new Map(punteggi.map((p) => [p.data, p]));
  // Oggi è a metà: entra nella media come una giornata fiacca e la tira giù di
  // qualche punto, che è esattamente il motivo per cui è fuori dalle medie di
  // passi e movimento qui accanto. Con «1 gg» invece è proprio oggi che vuoi
  // vedere, e lì il numero è quello di oggi, non una media.
  const conPunteggio = punteggi.filter((p) => p.totale != null && (soloOggiSalute || p.data < oggi));
  const mediaSalute = conPunteggio.length
    ? Math.round(conPunteggio.reduce((t, p) => t + p.totale, 0) / conPunteggio.length)
    : null;
  const oggiSalute = perPunteggio.get(oggi);

  // Un anello come quello della completezza degli allenamenti: un punteggio è
  // una quota di qualcosa, e il cerchio lo dice meglio di una linea.
  //
  // Il numero segue il bottone premuto: «1 gg» è oggi, gli altri periodi sono
  // la media dei giorni che contengono. Prima mostrava sempre oggi e i quattro
  // bottoni non cambiavano niente, cioè mentivano.
  const mostrato = soloOggiSalute ? oggiSalute?.totale ?? null : mediaSalute;

  // Anche la scomposizione segue il periodo: su più giorni ogni voce è la
  // media dei giorni in cui quel dato c'era davvero.
  const voci = (() => {
    // Su un giorno solo restano anche le voci senza dato: sparire non è la
    // stessa cosa che dire «non registrato», e la notte che manca è proprio
    // quello che uno vuole sapere al mattino, prima dell'importazione.
    if (soloOggiSalute) return oggiSalute?.voci || [];
    const per = new Map();
    for (const p of conPunteggio) {
      for (const v of p.voci || []) {
        if (v.quota == null) continue;
        const acc = per.get(v.nome) || { nome: v.nome, peso: v.peso, somma: 0, quanti: 0 };
        acc.somma += v.quota;
        acc.quanti++;
        per.set(v.nome, acc);
      }
    }
    return [...per.values()].map((a) => ({
      nome: a.nome,
      peso: a.peso,
      quota: a.somma / a.quanti,
      dettaglio: `media su ${a.quanti} ${a.quanti === 1 ? "giorno" : "giorni"}`,
    }));
  })();

  // La scomposizione sta sempre a schermo.
  //
  // Stava dietro un tocco («Da cosa viene ⌄») per non allungare la Home. Ma il
  // numero da solo non dice niente di utile — 85 perché? — e la risposta è
  // sette righe che si leggono in due secondi: nasconderle voleva dire
  // costringere a un tocco ogni volta per sapere l'unica cosa che serve
  // davvero, cioè quale voce sta tirando giù il punteggio.
  const dettagli = h(
    "div",
    voci.length
      ? h(
          "div.list",
          { style: "margin-top:16px;background:none" },
          ...voci.map((v) =>
            h(
              "div.row",
              h("div.main", h("span.title", v.nome), h("span.sub", v.dettaglio)),
              v.quota == null
                ? h("span.value", { style: "color:var(--label-tertiary)" }, "—")
                : coloraPunteggio(
                    h("span.value", `${Math.round(v.quota * 100)}%`),
                    Math.round(v.quota * 100)
                  )
            )
          )
        )
      : null,
    h(
      "p.footnote",
      { style: "margin:12px 0 0" },
      oggiSalute?.limite && soloOggiSalute
        ? `Oggi il punteggio è fermo a ${oggiSalute.totale}: ${oggiSalute.limite.perche}.`
        : "Sonno, allenamento, fumo, movimento, passi, minuti di esercizio e tempo in piedi. Le voci senza dato restano fuori dal conto invece di valere zero."
    )
  );

  const bloccoSalute = h(
    "div.group",
    h("h2", "Salute"),
    h(
      "div",
      { style: "background:var(--bg-grouped);border-radius:14px;padding:16px 14px 16px" },
      selettorePeriodo(periodoSalute, ridisegna, CHIAVE_PERIODO_SALUTE),
      mostrato != null
        ? anello(mostrato, {
            etichetta: "Salute",
            sottotitolo: giudizio(mostrato).testo,
          })
        : h(
            "p",
            { style: "margin:0;text-align:center;color:var(--label-secondary)" },
            soloOggiSalute ? "Oggi non ci sono ancora dati" : "Nessun dato in questo periodo"
          ),
      h(
        "p",
        { style: "margin:12px 0 0;text-align:center;font-size:13px;color:var(--label-secondary)" },
        soloOggiSalute
          ? mostrato != null
            ? "oggi"
            : "oggi · nessun dato ancora"
          : `media di ${conPunteggio.length} ${conPunteggio.length === 1 ? "giorno" : "giorni"} · ${etichettaPeriodo(periodoSalute)}`
      ),
      mostrato != null ? dettagli : null
    )
  );

  const bloccoAndamento = h(
    "div.group",
    h("h2", "Andamento"),
    h(
      "div",
      { style: "background:var(--bg-grouped);border-radius:14px;padding:16px 14px 10px" },
      selettore,
      fascia([
        {
          etichetta: "Passi",
          valore: mediaPassi != null ? mediaPassi.toLocaleString("it-IT") : "—",
          nota: `${quantiPassi} ${quantiPassi === 1 ? "giorno" : "giorni"} · ${etichettaGiorni}`,
        },
        {
          etichetta: "Movimento",
          valore: mediaKcal != null ? String(mediaKcal) : "—",
          unita: "kcal",
          nota: `${quantiKcal} ${quantiKcal === 1 ? "giorno" : "giorni"} · ${etichettaGiorni}`,
        },
        {
          etichetta: "Sonno",
          valore: mediaSonno != null ? durataUmana(mediaSonno * 60) : "—",
          nota: soloOggi
            ? notteDiStanotte
              ? "stanotte"
              : ultimaNotte
                ? `stanotte nessun dato · ultima notte ${dataBreve(ultimaNotte.data)}`
                : "nessuna notte registrata"
            : `${quanteNotti} ${quanteNotti === 1 ? "notte" : "notti"} · ${etichettaPeriodo(periodo)}`,
        },
      ]),
      graficoAttivita(serie, { obiettivoRipiego: obiettivo }),
      legenda()
    )
  );

  return { salute: bloccoSalute, andamento: bloccoAndamento };
}

// ---------- allenamento di oggi ----------

async function bloccoAllenamento(vaiA, ridisegna, oggi) {
  const inCorso = await store.sedutaInCorso();
  if (inCorso) {
    // Un allenamento rimasto aperto da un altro giorno non è «l'allenamento di
    // oggi»: riprendendolo, le serie di oggi finirebbero registrate alla sua
    // data. Va detto, e va data la via d'uscita.
    const vecchio = inCorso.data !== oggi;
    // Un allenamento aperto e mai cominciato non ha niente da archiviare:
    // «Chiudi e archivia» avrebbe creato un allenamento vuoto nello storico.
    // Vuoto vuol dire davvero niente dentro: anche un esercizio saltato porta
    // con sé un motivo e una nota, e il cardio registrato è un dato. Prima
    // l'app diceva «niente da archiviare» e l'unica via era cancellare tutto.
    const vuoto =
      !(await store.serieDi(inCorso.id)).length &&
      !(await store.questionariDi(inCorso.id)).length &&
      !inCorso.cardio?.eseguito &&
      !inCorso.riscaldamento?.fatto;
    const ora = new Date(inCorso.oraInizio).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    /* Il cardio rimandato non è un cardio saltato: la parte pesi è finita, lo
       stretching è stato fatto, e resta quello. Va tenuto davanti agli occhi
       con un tasto che porta dritto lì, se no «lo faccio dopo» diventa «non
       l'ho fatto» senza che nessuno l'abbia deciso. */
    const cardioDaFare = Boolean(
      inCorso.cardio?.previsto && inCorso.cardio?.rimandato && !inCorso.cardio?.eseguito
    );
    return h(
      "div.group",
      h("h2", cardioDaFare ? "Cardio da fare" : vecchio ? "Allenamento rimasto aperto" : "Allenamento aperto"),
      h(
        "div.list",
        h(
          "button.row",
          { onclick: () => vaiA("seduta") },
          h(
            "div.main",
            h("span.title", inCorso.tipoNome),
            h(
              "span.sub",
              cardioDaFare
                ? `pesi finiti alle ${ora === "Invalid Date" ? "—" : ora} · manca solo il cardio`
                : vecchio
                  ? `iniziato ${dataLunga(inCorso.data).toLowerCase()} alle ${ora}`
                  : `iniziato alle ${ora}`
            )
          ),
          h("span.chevron", "›")
        )
      ),
      cardioDaFare
        ? h(
            "div.btn-wrap",
            h(
              "button.btn",
              {
                onclick: async () => {
                  // `aggiornaProgresso` e non `aggiornaSeduta`: quello che c'è
                  // qui in memoria è la fotografia scattata quando la Home è
                  // stata disegnata, e fra quel momento e questo tocco può
                  // essere cambiato qualcosa (un timer chiuso, una serie
                  // registrata da un'altra scheda). Ricostruendo il progresso
                  // da quella fotografia si riscriveva sopra a quello vero.
                  // È la stessa regola che tutto il resto dell'app rispetta:
                  // si scrive solo la voce che cambia, fusa su quella salvata.
                  await store.aggiornaProgresso(inCorso.id, { fase: "cardio" });
                  store.invalidaCacheSedute();
                  vaiA("seduta");
                },
              },
              "Fai il cardio"
            )
          )
        : null,
      vecchio
        ? h(
            "p.footnote",
            { style: "margin:10px 16px 0" },
            `È aperto dal ${dataBreve(inCorso.data)}. Se lo riprendi, quello che registri oggi resta datato ${dataBreve(inCorso.data)}. Chiudilo o eliminalo per cominciarne uno nuovo.`
          )
        : null,
      h(
        "div.btn-wrap",
        // Con il cardio da fare il tasto grande è già sopra e porta allo stesso
        // posto: due tasti identici uno sotto l'altro fanno solo dubitare.
        cardioDaFare
          ? null
          : h("button.btn", { onclick: () => vaiA("seduta") }, vecchio ? `Riprendi (resta del ${dataBreve(inCorso.data)})` : "Riprendi allenamento"),
        vecchio && vuoto
          ? h(
              "p.footnote",
              { style: "margin:10px 0 0;color:var(--label-tertiary);text-align:center" },
              "Non c'è nessuna serie registrata: non c'è niente da archiviare."
            )
          : null,
        vecchio && !vuoto
          ? h(
              "button.btn.secondary",
              {
                onclick: unaVoltaSola(async () => {
                  const scelta = await chiedi({
                    titolo: `Chiudere l'allenamento del ${dataBreve(inCorso.data)}?`,
                    testo: "Resta in archivio con quello che ci hai registrato, alla sua data. Poi puoi cominciare quello di oggi.",
                    opzioni: [{ etichetta: "Chiudi e archivia", valore: "chiudi" }],
                  });
                  if (scelta !== "chiudi") return;
                  await store.chiudiSeduta(inCorso.id, {});
                  await store.aggiornaMotore();
                  toast("Allenamento archiviato alla sua data.");
                  await ridisegna();
                }),
              },
              "Chiudi e archivia"
            )
          : null,
        vecchio
          ? h(
              "button.btn.secondary",
              {
                style: "color:var(--red)",
                onclick: unaVoltaSola(async () => {
                  const scelta = await chiedi({
                    titolo: "Eliminare l'allenamento aperto?",
                    testo: "Spariscono anche le serie e i questionari che contiene. Non si recupera.",
                    opzioni: [{ etichetta: "Elimina", valore: "si", stile: "danger" }],
                  });
                  if (scelta !== "si") return;
                  await store.annullaSeduta(inCorso.id);
                  await store.aggiornaMotore();
                  toast("Allenamento eliminato.");
                  await ridisegna();
                }),
              },
              "Elimina"
            )
          : null
      )
    );
  }

  /* La sezione «Oggi» non sta più in Home.
     C'era la carta del giorno — il nome dell'allenamento, la nota del coach,
     il tasto per cominciare — e a lavoro finito il punteggio della seduta. È
     esattamente quello che si apre toccando la scheda «Oggi» in fondo, e
     averlo in due posti voleva dire due tasti «Inizia allenamento» a due tocchi
     di distanza. In Home resta quello che in «Oggi» non c'è: il punteggio
     Salute, l'andamento, gli allenamenti del Watch, il calendario.

     Quello che NON è la sezione «Oggi» è rimasto: un allenamento lasciato
     aperto — o un cardio rimandato — continua a comparire qui sopra con la sua
     intestazione e i suoi tasti, perché è un avviso, non la scheda del giorno,
     e se sparisse dalla Home nessuno se ne accorgerebbe più. */
  return null;
}

// ---------- proposte ----------

async function bloccoProposte() {
  // In coda come tutti gli altri ricalcoli: aprendo la Home mentre l'app
  // chiudeva un allenamento partivano due giri insieme sugli stessi dati.
  await store.inCoda(async () => {
    await store.aggiornaProposte();
    await store.aggiornaSegnali();
  });
  const sospese = await store.proposteInSospeso();
  const avvisi = await store.segnali();
  // Una verifica scaduta compariva solo nella schermata Proposte: se non ci
  // passavi per caso, la decisione restava aperta per sempre. È la cosa più
  // urgente delle tre, e sta in cima.
  const verifiche = await store.verificheDovute();
  if (!sospese.length && !avvisi.length && !verifiche.length) return null;

  const lista = h("div.list");
  for (const p of verifiche.slice(0, 3)) {
    aggiungi(lista,
      h(
        "a.row",
        { href: `#/proposte` },
        h(
          "div.main",
          h("span.title", p.titolo),
          h("span.sub", `verifica prevista ${dataBreve(p.dataVerifica)}`)
        ),
        h("span.pill.warn", "da verificare"),
        h("span.chevron", "›")
      )
    );
  }
  for (const p of sospese.slice(0, 3)) {
    aggiungi(lista,
      h(
        "a.row",
        { href: `#/proposte?proposta=${p.id}` },
        h("div.main", h("span.title", p.titolo), h("span.sub", `Livello ${p.livelloGerarchia}`)),
        h("span.chevron", "›")
      )
    );
  }
  if (avvisi.length) {
    const attenzione = avvisi.filter((s) => s.gravita === "attenzione");
    aggiungi(lista,
      h(
        "a.row",
        { href: "#/proposte" },
        h(
          "div.main",
          h("span.title", `${avvisi.length} ${avvisi.length === 1 ? "segnale aperto" : "segnali aperti"}`),
          attenzione.length ? h("span.sub", attenzione[0].messaggio) : null
        ),
        attenzione.length ? h("span.pill.warn", "attenzione") : h("span.pill", "info"),
        h("span.chevron", "›")
      )
    );
  }

  return h("div.group", h("h2", "Da decidere"), lista);
}

// ---------- calendario ----------

async function bloccoCalendario(vaiA, ridisegna) {
  const oggi = isoDate();
  if (!meseMostrato) meseMostrato = new Date(oggi + "T00:00:00");

  const tutte = await store.allenamenti();
  const allenamenti = new Map();
  for (const s of tutte) {
    // Due allenamenti nello stesso giorno: sul calendarietto ci sta un segno
    // solo, e deve essere quello finito. Prima vinceva l'ultimo letto, così un
    // allenamento appena aperto cancellava dal calendario quello già chiuso.
    const gia = allenamenti.get(s.data);
    if (gia?.completato && s.stato !== "completata") continue;
    allenamenti.set(s.data, { id: s.id, nome: s.tipoNome, completato: s.stato === "completata" });
  }

  const imp = await store.impostazioni();
  // Solo le date: caricare tutte le immagini per sapere quando è stato
  // l'ultimo set costava decine di megabyte a ogni disegno della Home.
  const dateFoto = await store.dateFoto();
  // Anche le date precedenti, non solo l'ultima: servono a dire se un giorno
  // già passato era in regola quando è passato.
  const datePeso = (await store.misure("peso")).map((m) => m.data);
  const dateVita = (await store.misure("vitaOmbelico")).map((m) => m.data);
  const attese = calcolaAttese({
    oggi,
    ultimoPeso: datePeso[0] || null,
    ultimaVita: dateVita[0] || null,
    ultimaFoto: dateFoto[0] || null,
    datePeso,
    dateVita,
    dateFoto,
    ultimoExport: imp.ultimoExport,
    ultimoImportSalute: imp.ultimoImportSalute,
    // Gli eventi del coach si aggiungono ai promemoria del protocollo: gli
    // allenamenti li decide il calendario, ma pesata, misure e foto restano
    // compito dell'app, che è l'unica a sapere quando li hai fatti davvero.
    eventi: store.agendaAttiva() ? await store.agenda() : null,
    cadenze: store.regole().cadenze,
    // Niente arretrati prima del primo giorno di cui l'app sa qualcosa: il
    // calendario si sfoglia indietro anche di mesi, e su quei giorni non c'era
    // ancora niente da fare.
    dal: await store.inizioStoria(),
  });

  // il programma comincia dal primo allenamento registrato, o dal brief
  const dal = await store.inizioProgramma();

  const cal = calendario({
    dal,
    mese: meseMostrato,
    giornoPrevisto: (data) => store.giornoPrevisto(data),
    allenamenti,
    attese,
    onMese: async (delta) => {
      meseMostrato = new Date(meseMostrato.getFullYear(), meseMostrato.getMonth() + delta, 1);
      await ridisegna();
    },
    onGiorno: async (data) => {
      const r = riassuntoGiorno({
        dal,
        data,
        previsto: store.giornoPrevisto(data),
        allenamento: allenamenti.get(data),
        attese: attese.get(data) || [],
        origine: store.origineGiorno(data),
      });
      const seduta = tutte.find((s) => s.data === data && s.stato === "completata");
      await sheet((close) =>
        h(
          "div",
          h("h2", r.titolo),
          h(
            "div.group",
            { style: "margin-top:12px" },
            h(
              "div.list",
              ...r.righe.map((riga) =>
                h(
                  "div.row",
                  h("div.main", h("span.title", riga.testo)),
                  riga.stato === "ok"
                    ? h("span.pill.ok", "fatto")
                    : riga.stato === "warn"
                      ? h("span.pill.warn", "in ritardo")
                      : null
                )
              )
            )
          ),
          seduta
            ? h(
                "div.btn-wrap",
                h(
                  "button.btn.secondary",
                  {
                    onclick: () => {
                      close();
                      location.hash = `#/storico?seduta=${seduta.id}`;
                    },
                  },
                  "Apri l'allenamento"
                )
              )
            : null
        )
      );
    },
  });

  // «In ritardo» è quello che manca ADESSO. Gli arretrati vecchi restano
  // segnati sul calendario, dove servono a vedere la costanza, ma non si
  // rinfacciano: una pesata saltata a luglio e poi rifatta non è un arretrato.
  const ultimaVolta = new Map();
  for (const [data, voci] of attese) {
    if (data > oggi) continue;
    for (const a of voci) {
      const prec = ultimaVolta.get(a.testo);
      if (!prec || data > prec.data) ultimaVolta.set(a.testo, { data, tipo: a.tipo, risolto: a.risolto });
    }
  }
  // Un arretrato recuperato dopo — la pesata di giovedì fatta venerdì — resta
  // segnato sul calendario ma non si rinfaccia qui: qui c'è quello che manca
  // adesso. Prima restava scritto «in ritardo» per tutta la settimana, fino al
  // giovedì successivo, con la misura già fatta.
  const inRitardo = [...ultimaVolta]
    .filter(([, v]) => v.tipo === "scaduto" && !v.risolto)
    .map(([testo]) => testo);

  return h(
    "div.group",
    h("h2", "Calendario"),
    cal,
    h(
      "p.footnote",
      { style: "margin-top:10px" },
      // Comanda il calendario solo se gli eventi ci sono davvero: la data
      // dell'ultima lettura restava scritta anche dopo averli dimenticati, e
      // l'app diceva di seguire un calendario che non aveva più.
      store.agendaAttiva()
        ? `Gli allenamenti arrivano dal calendario del coach${imp.ultimoImportAgenda ? `, letti l'ultima volta il ${new Date(imp.ultimoImportAgenda).toLocaleDateString("it-IT")}` : ""}. Orari e promemoria restano sul calendario: qui si vede solo cosa tocca.`
        : "Vista dell'app: disegna lo split del master brief e le sue cadenze. Gli orari e i promemoria veri restano sul calendario."
    ),
    inRitardo.length
      ? h(
          "p.footnote",
          { style: "color:var(--orange)" },
          `${inRitardo.length === 1 ? "Una cosa" : `${inRitardo.length} cose`} in ritardo: ${inRitardo.join(", ").toLowerCase()}.`
        )
      : h("p.footnote", "Nessun arretrato.")
  );
}


/**
 * Gli allenamenti che l'orologio registra da solo.
 *
 * Sta in Home e non in fondo a Salute: là era una voce fra dodici sezioni e non
 * la trovava nessuno. Qui sono le ultime tre righe, e il resto si apre toccando.
 */
async function bloccoWatch() {
  const tutti = await store.allenamentiWatch();
  if (!tutti.length) return null;
  const GIORNI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  const { nomeTipo } = await import("./allenamenti.js");
  const righe = h("div.list");
  for (const a of tutti.slice(0, 3)) {
    const numeri = [
      a.durataSec ? durataUmana(a.durataSec) : null,
      a.kcalAttive != null ? `${Math.round(a.kcalAttive)} kcal` : null,
      a.fcMedia != null ? `${Math.round(a.fcMedia)} bpm` : null,
    ].filter(Boolean);
    aggiungi(righe,
      h(
        "button.row.accent",
        { onclick: () => (location.hash = `#/allenamenti?id=${encodeURIComponent(a.uuid)}`) },
        h(
          "div.main",
          h("span.title", nomeTipo(a.tipo)),
          h("span.sub", `${GIORNI[new Date(a.data + "T00:00:00").getDay()]} ${dataBreve(a.data)} · ${a.inizio || "—"}`),
          h("span.sub", numeri.join(" · "))
        ),
        h("span.chevron", "›")
      )
    );
  }
  // «Tutti gli allenamenti» sta DENTRO la stessa lista, non in una seconda:
  // due liste attaccate lasciano in mezzo un gradino che sembra un errore di
  // disegno. È una riga come le altre, e il riquadro è uno solo.
  // Sempre, anche quando in archivio ce ne sono tre: è la porta della sezione,
  // e nascondendola non ci si arrivava più da nessuna parte.
  aggiungi(righe,
    h(
      "a.row",
      { href: "#/allenamenti" },
      h(
        "div.main",
        h("span.title", "Tutti gli allenamenti"),
        h("span.sub", `${tutti.length} ${tutti.length === 1 ? "in archivio" : "in archivio"}`)
      ),
      h("span.chevron", "›")
    )
  );
  return h("div.group", h("h2", "Watch"), righe);
}
