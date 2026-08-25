import {
  h, qs, clear, toast, mmss, num, chiedi, sheet,
  avviaAllarme, fermaAllarme, allarmeAttivo, sbloccaAudio, unaVoltaSola, tick,
  tieniSchermoAcceso, rilasciaSchermo, durataUmana, isoDate, dataLunga, dataBreve, aggiungi } from "../ui.js";
import { intestazione, ridisegna } from "../app.js";
import * as store from "../store.js";
import { descriviDischi, carichoPiuVicino, descriviManubri, manubrioPiuVicino, aPaio, conosceManubri } from "../plates.js";
import { punteggioEsercizio, anello, scomposizione, legenda as legendaPunteggio, commento, giudizio } from "../punteggio.js";

export let nascondiTabBar = true;

let S = null; // stato in memoria della sessione aperta

function parametri() {
  const q = location.hash.split("?")[1] || "";
  return Object.fromEntries(new URLSearchParams(q));
}

export async function render({ vaiA, ridisegna }) {
  // Prima di ricostruire lo stato: se resta un timer del disegno precedente,
  // da qui in poi nessuno saprebbe più fermarlo.
  pulisci();
  const p = parametri();
  if (p.riepilogo) {
    nascondiTabBar = false;
    // `da` dice da dove si è arrivati, così il tasto per tornare indietro
    // riporta dove ci si aspetta invece che sempre al programma di oggi.
    return vistaRisultato(p.riepilogo, vaiA, p.da || null);
  }

  const sed = await store.sedutaInCorso();
  if (!sed) {
    nascondiTabBar = false;
    // Se oggi un allenamento è già stato chiuso, la schermata di partenza è il
    // suo risultato: il programma di un lavoro già fatto non serve a niente.
    // Non dipende dal passaggio di schermata appena finito l'allenamento — se
    // il telefono ricarica l'app, il risultato è ancora qui.
    if (!p.programma) {
      const oggi = isoDate();
      const fatte = (await store.allenamenti())
        .filter((s) => s.data === oggi && s.oraFine)
        .sort((a, b) => a.oraFine - b.oraFine);
      if (fatte.length) return vistaRisultato(fatte.at(-1).id, vaiA);
    }
    return vistaProgramma(vaiA, ridisegna);
  }
  nascondiTabBar = true;

  const giorno = store.giornoSplit(sed.tipoId);
  S = {
    sed,
    giorno,
    // Gli esercizi sono quelli congelati all'avvio: se il coach cambia il
    // programma a metà allenamento, quello che stai facendo non cambia sotto
    // le mani (ed è lo stesso elenco su cui viene calcolato il punteggio).
    esercizi: sed.previstiElenco?.length ? sed.previstiElenco : giorno?.esercizi || [],
    vaiA,
    contenitore: h("div.session"),
    recuperoFine: sed.progresso?.recuperoFine || null,
    // Il cronometro di un esercizio a tempo vive nel progresso salvato come il
    // recupero: bloccare lo schermo o riaprire l'app non deve azzerarlo.
    cronoFine: sed.progresso?.cronoFine || null,
    tsInizioSerie: sed.progresso?.tsInizioSerie || null,
    timerHandle: null,
  };

  tieniSchermoAcceso();
  await disegna();
  return S.contenitore;
}


// ---------- programma del giorno (nessun allenamento in corso) ----------

async function vistaProgramma(vaiA, ridisegna) {
  const oggi = isoDate();
  const wrap = h("div.screen");
  const previsto = store.giornoPrevisto(oggi);
  const fatteOggi = (await store.allenamenti()).filter(
    (s) => s.data === oggi && s.stato === "completata"
  );

  const origine = store.origineGiorno(oggi);
  const ultimaOggi = fatteOggi.filter((s) => s.oraFine).sort((a, b) => a.oraFine - b.oraFine).at(-1);
  aggiungi(wrap,
    intestazione(
      "Oggi",
      ultimaOggi
        ? { etichetta: "Risultato", onclick: () => (location.hash = `#/seduta?riepilogo=${ultimaOggi.id}`) }
        : null
    )
  );

  if (!store.programma()) {
    aggiungi(wrap,
      h("div.empty", h("h3", "Nessun programma caricato"), h("p", "Carica il master brief dalle impostazioni."))
    );
    return wrap;
  }

  aggiungi(wrap,
    h(
      "div.group",
      h("h2", dataLunga(oggi)),
      h(
        "div",
        {
          // Nei giorni di riposo resta neutro: il lime segnala che c'è da fare.
          style: previsto
            ? "background:var(--accent);color:var(--su-accent);border-radius:14px;padding:18px 16px"
            : "background:var(--bg-grouped);border-radius:14px;padding:18px 16px",
        },
        h(
          "p",
          { style: "margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;text-align:center" },
          previsto
            ? previsto.nome
            : origine.riposo
              ? "Riposo"
              : origine.sconosciuto
                ? origine.titolo || "Da vedere sul calendario"
                : origine.scaduta
                  ? "Calendario da aggiornare"
                  : origine.oltreProgrammato
                    ? "Non ancora programmato"
                    : origine.nonLetta
                      ? "Giorno non letto"
                      : "Riposo"
        ),
        previsto
          ? h(
              "p",
              { style: "margin:6px 0 0;font-size:13px;opacity:.72;text-align:center" },
              // Sabato e domenica di esercizi non ne hanno: contarli dava
              // «0 esercizi» su un giorno che di lavoro ne ha cinque passaggi,
              // e sembrava una giornata vuota o un programma rotto.
              (() => {
                if (store.giornoDiSolaMobilita(previsto.id)) {
                  const quanti = (store.riscaldamento(previsto.id)?.mobilitaFinale || []).length;
                  return `${quanti} ${quanti === 1 ? "passaggio" : "passaggi"} di mobilità`;
                }
                return `${previsto.esercizi.length} ${previsto.esercizi.length === 1 ? "esercizio" : "esercizi"}${previsto.cardio ? " + cardio" : ""}`;
              })() + (fatteOggi.some((s) => s.tipoId === previsto.id) ? " · già completato oggi" : "")
            )
          : h(
              "p",
              { style: "margin:6px 0 0;font-size:13px;color:var(--label-secondary);text-align:center" },
              origine.riposo
                ? "Riposo, dal calendario"
                : origine.scaduta
                  ? `Il calendario letto arriva al ${dataBreve(origine.fine)}: rileggilo con «Coach Calendario»`
                  : origine.sconosciuto
                    ? `«${origine.titolo}» non è un allenamento del programma`
                    : origine.oltreProgrammato
                      ? `Il coach ha programmato fino al ${dataBreve(origine.ultimoEvento)}`
                      : origine.nonLetta
                      ? "Nessuna lettura del calendario copre questo giorno"
                      : origine.vuoto
                      ? "Niente sul calendario per oggi"
                      : "Lo split non prevede allenamenti oggi"
            ),
        // Da dove arriva questo giorno: il calendario del coach o lo split del
        // brief. Se i due dicono cose diverse, comanda il calendario e si vede.
        origine.fonte === "calendario" && origine.titolo
          ? h(
              "p",
              { style: "margin:10px 0 0;font-size:11px;opacity:.66;text-align:center" },
              `Dal calendario: «${origine.titolo}»`
            )
          : null,
        // Quello che il coach ha scritto nell'evento va letto prima di
        // cominciare, non cercato dentro il calendarietto.
        origine.nota
          ? h(
              "p",
              { style: "margin:8px 0 0;font-size:13px;opacity:.9;text-align:center" },
              origine.nota
            )
          : null,
        origine.sconosciuto
          ? h(
              "p",
              { style: "margin:6px 0 0;font-size:11px;opacity:.66;text-align:center" },
              "Evento non riconosciuto: serve il brief aggiornato per sapere cosa contiene."
            )
          : null
      )
    )
  );

  if (previsto) {
    const inv = await store.inventario();
    const lista = h("div.list");
    for (const v of previsto.esercizi) {
      const def = store.esercizio(v.esercizioId);
      const carico = v.carico != null ? v.carico : await store.ultimoCarico(v.esercizioId, null);
      const dischi =
        carico != null && def?.attrezzo === "bilanciere" ? descriviDischi(carico, inv) : null;
      aggiungi(lista,
        h(
          "div.row",
          h(
            "div.main",
            h("span.title", def?.nome || v.esercizioId),
            h(
              "span.sub",
              [
                v.aTempo ? `${v.serie} × ${v.durataSec}s` : `${v.serie} × ${v.ripMin === v.ripMax ? v.ripMin : `${v.ripMin}-${v.ripMax}`}`,
                dischi,
              ]
                .filter(Boolean)
                .join(" · ")
            )
          ),
          h("span.value", carico != null ? `${num(carico)} kg` : "corpo libero")
        )
      );
    }
    if (previsto.cardio) {
      const r = store.regole().cardio;
      aggiungi(lista,
        h(
          "div.row",
          h(
            "div.main",
            h("span.title", "Cardio"),
            h("span.sub", `${r.durataMin} min · ${num(r.kmhMin)}-${num(r.kmhMax)} km/h · FC ${r.fcMin}-${r.fcMax}`)
          )
        )
      );
    }
    aggiungi(wrap, h("div.group", h("h2", "In programma"), lista));
  }

  aggiungi(wrap,
    h(
      "div.btn-wrap",
      previsto
        ? (() => {
            // Se quello di oggi è già stato fatto, il tasto diceva lo stesso
            // «Inizia allenamento» e ne apriva un secondo in silenzio: due
            // allenamenti sullo stesso giorno, con lo storico e il pacchetto
            // che poi devono raccontarli tutti e due. Adesso il tasto dice
            // cosa fa, e prima di aprirlo lo chiede.
            const giaFatto = fatteOggi.some((s) => s.tipoId === previsto.id);
            return h(
              "button.btn" + (giaFatto ? ".secondary" : ""),
              {
                onclick: unaVoltaSola(async () => {
                  sbloccaAudio();
                  const gia = await store.sedutaInCorso();
                  if (!gia) {
                    if (giaFatto) {
                      const scelta = await chiedi({
                        titolo: "Un secondo allenamento oggi?",
                        testo:
                          `«${previsto.nome || previsto.id}» risulta già fatto oggi. Iniziandone un altro restano tutti e due in archivio, sulla stessa data, e il coach li vedrà tutti e due.`,
                        opzioni: [{ etichetta: "Sì, iniziane un altro", valore: "vai" }],
                      });
                      if (scelta !== "vai") return;
                    }
                    await store.iniziaSeduta({ data: oggi, giornoId: previsto.id });
                  }
                  await ridisegna();
                }),
              },
              giaFatto ? "Inizia un altro allenamento" : "Inizia allenamento"
            );
          })()
        : h(
            // Quale allenamento tocca oggi lo dice lo split del master brief:
            // l'app lo esegue, non lo mette in discussione.
            "p.footnote",
            { style: "text-align:center;margin:0" },
            origine.fonte === "calendario"
              ? "Gli allenamenti li mette il coach sul calendario. Se oggi non c'è niente, non c'è niente da fare."
              : "Il riposo fa parte del programma. Se serve un allenamento diverso, lo decide il coach e arriva con il brief aggiornato."
          )
    )
  );

  return wrap;
}

// ---------- risultato dell'allenamento appena chiuso ----------

async function vistaRisultato(id, vaiA, da = null) {
  const wrap = h("div.screen");
  const sed = await store.seduta(id);
  const daStorico = da === "storico";
  aggiungi(wrap, 
    intestazione("Risultato", 
      daStorico
        ? { etichetta: "Indietro", onclick: () => (location.hash = "#/storico") }
        : { etichetta: "Programma", onclick: () => vaiAlProgramma() }
    )
  );

  if (!sed) {
    aggiungi(wrap, h("div.empty", h("h3", "Allenamento non trovato")));
    return wrap;
  }

  const serie = await store.serieDi(id);
  const logs = await store.questionariDi(id);
  // La durata dell'allenamento, non quella dell'orologio da parete.
  //
  // `oraFine − oraInizio` conta anche i buchi: con il **cardio rimandato** —
  // pesi alle 17, cardio fatto alle 21 e chiusura lì — lo Storico annunciava
  // «4h 30m» di allenamento, e quel numero finisce nel pacchetto del coach.
  // `durataLavoroSec` è calcolata alla chiusura proprio per questo: somma i
  // tratti fra un gesto e l'altro e scarta le pause oltre le tre ore.
  const durataSec =
    sed.durataLavoroSec != null
      ? sed.durataLavoroSec
      : sed.oraFine
        ? Math.round((sed.oraFine - (sed.oraInizioLavoro || sed.oraInizio)) / 1000)
        : null;
  // Le due medie si calcolano sulle STESSE serie: prima il reale veniva da
  // quelle cronometrate e il previsto da tutte, e il confronto «100s su 120»
  // metteva a paragone due insiemi diversi.
  const cronometrate = serie.filter((s) => s.recuperoRealeSec != null && s.recuperoTargetSec != null);
  const media = (arr, campo) =>
    arr.length ? Math.round(arr.reduce((t, x) => t + x[campo], 0) / arr.length) : null;
  const recMedio = media(cronometrate, "recuperoRealeSec");
  const recTarget = media(cronometrate, "recuperoTargetSec");
  // Completezza dell'allenamento intero: esercizi, cardio, riscaldamento e
  // stretching. Il volume totale in kg non guida nessuna decisione — cambia con
  // il numero di esercizi, non con la qualità del lavoro.
  const comp = await store.completezzaSeduta(id);
  // Con un punteggio congelato si usano i suoi numeri: altrimenti la scheda
  // «Esercizi» diceva 4 e l'anello era stato calcolato su 3, perché nel
  // frattempo il coach aveva cambiato lo split.
  const previsti = comp?.previsti ?? store.giornoSplit(sed.tipoId)?.esercizi?.length ?? logs.length;
  const svolti = comp?.svolti ?? logs.filter((l) => !l.saltato).length;
  const valutati = logs.filter((l) => !l.saltato && l.rpe != null);
  const rpeMedio = valutati.length ? valutati.reduce((a, b) => a + b.rpe, 0) / valutati.length : null;
  const tecMedia = valutati.length ? valutati.reduce((a, b) => a + (b.tecnica || 0), 0) / valutati.length : null;

  aggiungi(wrap,
    h(
      "div.hero",
      { style: "padding-top:8px;padding-bottom:6px" },
      h("p.kicker", dataLunga(sed.data)),
      h("h2", sed.tipoNome),
      h("p.target", durataSec != null ? durataUmana(durataSec) : "durata non registrata")
    )
  );

  // L'anello è la prima cosa che si vede: il resto lo spiega.
  if (comp) {
    aggiungi(wrap,
      h(
        "div",
        { style: "margin:6px 0 2px" },
        anello(comp.totale, { dimensione: 224, sottotitolo: giudizio(comp.totale).testo }),
        h(
          "p",
          { style: "margin:14px 16px 0;text-align:center;font-size:13px;color:var(--label-secondary);line-height:1.4" },
          // «Pieno» solo se lo è davvero: con 90 di media ma il cardio a metà,
          // dire «niente resta indietro» è falso. Se c'è una voce debole si
          // nomina quella, qualunque sia il totale.
          (() => {
            if (comp.limite) return `Fermo a ${comp.totale}: ${comp.limite.perche}.`;
            const peggiore = [...comp.voci].filter((v) => v.quota != null).sort((a, b) => a.quota - b.quota)[0];
            if (comp.totale >= 90 && (!peggiore || peggiore.quota >= 0.9)) {
              return "Allenamento pieno: niente resta indietro.";
            }
            return peggiore ? `Il punto debole è ${peggiore.nome.toLowerCase()}.` : "";
          })()
        )
      ),
      h("div.group", h("h2", "Da cosa viene il punteggio"), scomposizione(comp))
    );
  }

  // I numeri dell'orologio non si scrivono più a mano: li legge l'importazione
  // da Salute, per intero e senza errori di trascrizione. Quelli scritti a mano
  // prima che esistesse quella strada restano, in sola lettura: sono lavoro di
  // qualcuno e nel pacchetto per il coach continuano a viaggiare.
  aggiungi(wrap, orologioScritto(sed, "pesi"));
  if (sed.cardio?.previsto || sed.cardio?.eseguito) aggiungi(wrap, orologioScritto(sed, "cardio"));

  const scheda = (etichetta, valore, nota) =>
    h(
      "div",
      { style: "background:var(--bg-grouped);border-radius:12px;padding:13px" },
      h("p", { style: "margin:0;font-size:11px;color:var(--label-secondary)" }, etichetta),
      h(
        "p",
        { style: "margin:4px 0 0;font-size:20px;font-weight:700;letter-spacing:-0.4px;font-variant-numeric:tabular-nums" },
        valore
      ),
      nota ? h("p", { style: "margin:2px 0 0;font-size:11px;color:var(--label-tertiary)" }, nota) : null
    );

  aggiungi(wrap,
    h(
      "div",
      { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:6px 16px 0" },
      scheda("Esercizi", `${svolti}/${previsti}`, `${serie.length} serie in tutto`),
      scheda(
        "Durata",
        durataSec != null ? durataUmana(durataSec) : "—",
        // L'etichetta segue il numero: da quando la durata è il lavoro vero
        // (pause lunghe escluse) dire «dall'inizio alla chiusura» sarebbe
        // falso proprio nel caso che l'ha resa necessaria, il cardio
        // rimandato di quattro ore.
        sed.durataLavoroSec != null ? "tempo di allenamento" : "dall'inizio alla chiusura"
      ),
      scheda("RPE medio", rpeMedio != null ? num(rpeMedio) : "—", tecMedia != null ? `tecnica ${num(tecMedia)}` : `zona ${store.regole().rpeTarget.min}-${store.regole().rpeTarget.max}`),
      scheda(
        "Recupero medio",
        recMedio != null ? mmss(recMedio) : "—",
        recTarget ? `previsti ${mmss(recTarget)}` : "cronometrato dall'app"
      )
    )
  );

  // confronto con l'esposizione precedente, esercizio per esercizio
  const righe = h("div.list");
  // Un esercizio con serie registrate ma senza questionario (uscito prima di
  // rispondere) non compariva da nessuna parte: né qui né fra i mancanti.
  const senzaQuestionario = [...new Set(serie.map((x) => x.esercizioId))].filter(
    (esId) => !logs.some((l) => l.esercizioId === esId)
  );
  for (const id of senzaQuestionario) {
    const def = store.esercizio(id);
    const mie = serie.filter((x) => x.esercizioId === id);
    aggiungi(righe,
      h(
        "div.row",
        h(
          "div.main",
          h("span.title", def?.nome || id),
          h("span.sub", `${mie.length} ${mie.length === 1 ? "serie" : "serie"} · questionario non compilato`),
          h(
            "span.sub",
            `${mie.at(-1)?.carico != null ? `${num(mie.at(-1).carico)} kg · ` : ""}${mie.map((x) => x.ripFatte ?? "—").join("/")}`
          )
        ),
        h("span.pill.warn", "senza valutazione")
      )
    );
  }
  for (const l of logs) {
    const def = store.esercizio(l.esercizioId);
    if (l.saltato) {
      // Un esercizio interrotto a metà ha comunque delle serie registrate: qui
      // sparivano, e il riepilogo diceva «non svolto» su un lavoro fatto.
      const fatte = serie.filter((x) => x.esercizioId === l.esercizioId);
      aggiungi(righe,
        h(
          "div.row",
          h(
            "div.main",
            h("span.title", def?.nome || l.esercizioId),
            h(
              "span.sub",
              fatte.length
                ? `interrotto dopo ${fatte.length} ${fatte.length === 1 ? "serie" : "serie"} — ${l.saltato.motivo}`
                : `saltato — ${l.saltato.motivo}`
            ),
            // Il perché scritto a parole finiva solo nel pacchetto per il
            // coach: riaprendo l'allenamento dallo storico restava il motivo
            // secco («attrezzo») e spariva la frase che lo spiegava.
            (l.saltato.nota || "").trim()
              ? h("span.sub", { style: "white-space:pre-wrap" }, l.saltato.nota)
              : null,
            fatte.length
              ? h(
                  "span.sub",
                  `${fatte.at(-1)?.carico != null ? `${num(fatte.at(-1).carico)} kg · ` : ""}${fatte.map((x) => x.ripFatte ?? "—").join("/")}`
                )
              : null
          ),
          h("span.pill.warn", fatte.length ? "interrotto" : "non svolto")
        )
      );
      continue;
    }
    const mie = serie.filter((s) => s.esercizioId === l.esercizioId);
    const carico = mie.at(-1)?.carico ?? null;
    const rip = mie.map((s) => s.ripFatte ?? "—").join("/");

    const storiche = (await store.esposizioni(l.esercizioId)).filter((e) => e.sedutaId !== id);
    const prima = storiche[0];
    let confronto = null;
    if (prima?.caricoLavoro != null && carico != null) {
      const d = carico - prima.caricoLavoro;
      confronto = d === 0 ? "stesso carico" : `${d > 0 ? "+" : ""}${num(d)} kg dalla volta prima`;
    } else if (!prima) confronto = "prima volta";

    aggiungi(righe,
      h(
        "div.row",
        h(
          "div.main",
          h("span.title", def?.nome || l.esercizioId),
          h("span.sub", [carico != null ? `${num(carico)} kg` : "corpo libero", `${mie.length}×${rip}`, confronto].filter(Boolean).join(" · ")),
          // Stesso motivo della nota generale: quello che scrivi a parole
          // sull'esercizio si rivedeva solo nel riepilogo di fine allenamento,
          // e riaprendo la stessa seduta dallo storico non c'era più.
          (l.nota || "").trim() ? h("span.sub", { style: "white-space:pre-wrap" }, l.nota) : null
        ),
        h("span.value", `RPE ${l.rpe ?? "—"}`),
        (() => {
          const p = comp?.perEsercizio?.get(l.esercizioId);
          if (!p) return null;
          const g = giudizio(p.totale);
          return h(
            "span.pill",
            {
              style: `font-variant-numeric:tabular-nums;background:${g.livello === 1 ? "var(--fill-tertiary)" : "color-mix(in srgb, var(--accent) 18%, transparent)"};color:${g.livello === 1 ? "var(--orange)" : "var(--accent)"}`,
            },
            String(p.totale)
          );
        })(),
        ...store.doloriDi(l).map((d) => h("span.pill.bad", d.nome))
      )
    );
  }
  aggiungi(wrap, h("div.group", h("h2", "Esercizio per esercizio"), righe));

  // La nota scritta chiudendo l'allenamento finiva solo nel pacchetto per il
  // coach: qui dentro non si rivedeva più. Vale per tutto quello che scrivi a
  // parole (qui, sull'esercizio e sul salto): serve prima di tutto a te — «il
  // ginocchio alla terza serie» va riletto la volta dopo, non ritrovato dentro
  // un testo lungo dieci pagine.
  if ((sed.notaGenerale || "").trim()) {
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Nota"),
        h("div.list", h("div.row", h("div.main", h("span.title", { style: "white-space:pre-wrap" }, sed.notaGenerale))))
      )
    );
  }

  // Anche un cardio non previsto ma fatto va mostrato: era stato registrato e
  // poi sparito dal riepilogo, come se non l'avessi fatto.
  if (sed.cardio?.previsto || sed.cardio?.eseguito) {
    // Le soglie di quel giorno: quelle di oggi possono essere altre.
    const r = { ...store.regole().cardio, ...(sed.cardio.soglie || {}) };
    // Fuori protocollo vale da tutte e due le parti: andare troppo piano non è
    // «a protocollo» più di quanto lo sia andare troppo forte.
    const fuori =
      sed.cardio.eseguito &&
      ((r.kmhMax != null && sed.cardio.kmh > r.kmhMax) || (r.kmhMin != null && sed.cardio.kmh < r.kmhMin));
    const attesi = r.durataMin || sed.cardio.durataPrevistaMin || 0;
    const corto = sed.cardio.eseguito && attesi && (sed.cardio.durataMin || 0) < attesi * 0.9;
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Cardio"),
        h(
          "div.list",
          h(
            "div.row",
            h(
              "div.main",
              h(
                "span.title",
                sed.cardio.eseguito
                  ? `${num(sed.cardio.kmh)} km/h per ${sed.cardio.durataMin} min`
                  : sed.cardio.saltatoMotivo
                    ? `Non eseguito — ${sed.cardio.saltatoMotivo}`
                    : "Non eseguito"
              ),
              h(
                "span.sub",
                `previsto ${num(r.kmhMin)}-${num(r.kmhMax)} km/h${attesi ? ` · ${attesi} min` : ""}`
              )
            ),
            // «A protocollo» dipende anche dalla durata, non solo dalla
            // velocità: un cardio di 5 minuti su 30 non è a protocollo.
            fuori
              ? h(
                  "span.pill.warn",
                  r.kmhMin != null && sed.cardio.kmh < r.kmhMin ? "sotto protocollo" : "sopra protocollo"
                )
              : corto
                ? h("span.pill.warn", "più corto del previsto")
                : sed.cardio.eseguito
                  ? h("span.pill.ok", "a protocollo")
                  : null
          )
        )
      )
    );
  }

  const mancanti = logs.filter((l) => !l.saltato && (l.rpe == null || l.tecnica == null));
  if (mancanti.length) {
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Dati mancanti"),
        h("div.list", ...mancanti.map((l) => h("div.row", h("div.main", h("span.title", store.esercizio(l.esercizioId)?.nome || l.esercizioId)))))
      )
    );
  }

  if (sed.stretching) {
    aggiungi(wrap,
      h(
        "div.group",
        h(
          "div.list",
          h(
            "div.row",
            h("div.main", h("span.title", "Stretching di fine allenamento")),
            sed.stretching.fatto ? h("span.pill.ok", "fatto") : h("span.pill.warn", "saltato")
          )
        )
      )
    );
  }

  aggiungi(wrap,
    h(
      "div.btn-wrap",
      h("button.btn", { onclick: () => vaiA("export") }, "Claude"),
      h("div", { style: "height:8px" }),
      daStorico
        ? h("button.btn.secondary", { onclick: () => (location.hash = "#/storico") }, "Torna allo storico")
        : h("button.btn.secondary", { onclick: () => vaiAlProgramma() }, "Programma del giorno"),
      h("div", { style: "height:8px" }),
      h("button.btn.secondary", { onclick: () => (location.hash = "#/oggi") }, "Torna alla Home")
    ),
    h(
      "div.btn-wrap",
      { style: "margin-top:26px" },
      h(
        "button.btn.secondary",
        { style: "color:var(--red)", onclick: () => eliminaAllenamento(sed, daStorico) },
        "Elimina questo allenamento"
      ),
      h(
        "p.footnote",
        { style: "margin:8px 0 0" },
        "Cancella serie, questionari e punteggi di questo allenamento. Non si recupera."
      )
    )
  );

  return wrap;
}

/** Il programma del giorno resta raggiungibile anche quando l'allenamento è chiuso. */
function vaiAlProgramma() {
  location.hash = "#/seduta?programma=1";
}

/** Serve per le prove: toglie un allenamento finto senza lasciare tracce nei numeri. */
async function eliminaAllenamento(sed, daStorico = false) {
  const conferma = await chiedi({
    titolo: "Eliminare l'allenamento?",
    testo: `${sed.tipoNome} del ${dataLunga(sed.data)}. Spariscono anche le serie e i questionari, e le proposte vengono ricalcolate senza di esso.`,
    opzioni: [{ etichetta: "Elimina", valore: "si", stile: "danger" }],
  });
  if (conferma !== "si") return;
  await store.annullaSeduta(sed.id);
  await store.aggiornaMotore();
  toast("Allenamento eliminato.");
  // Si torna dove si stava guardando. Chi arriva dallo Storico stava sfogliando
  // l'elenco: buttarlo sul programma di oggi gli fa perdere il posto, e il
  // tasto «Indietro» di questa stessa scheda rispetta già la provenienza.
  if (daStorico) {
    location.hash = "#/storico";
    return;
  }
  // L'hash può essere già «#/seduta»: in quel caso il router non riparte da
  // solo e va richiamato a mano.
  if (location.hash === "#/seduta") await ridisegna();
  else location.hash = "#/seduta";
}

// ---------- utilità di stato ----------

/**
 * Scrive solo le voci del progresso che cambiano, fondendole su quello salvato
 * e non sulla copia che questa schermata ha in memoria: due tocchi ravvicinati
 * partivano tutti e due dalla stessa fotografia, e il secondo a scrivere
 * rimetteva quello che il primo aveva appena tolto.
 */
async function salvaProgresso(patch) {
  S.sed = await store.aggiornaProgresso(S.sed.id, patch);
}

/**
 * I blocchi: due esercizi che si fanno attaccati.
 *
 * Una serie del primo, subito una del secondo senza pausa, POI il recupero, e
 * si ricomincia finché i giri non sono finiti. Solo dopo si valuta — prima uno
 * poi l'altro — e si passa al blocco dopo.
 *
 * Un esercizio senza `blocco` si comporta come ha sempre fatto: tutte le sue
 * serie di fila. Chi non usa i blocchi non si accorge di niente.
 */
/**
 * Quanto dura il recupero di questo esercizio.
 *
 * Comanda il programma («recuperoSec» nel brief); la libreria è il ripiego per
 * chi non lo dichiara. Dentro un blocco il recupero è UNO SOLO, alla fine del
 * giro, ed è quello del primo esercizio della coppia: prenderlo dal secondo
 * significava usare un numero scelto a caso fra i due.
 */
function recuperoDi(i = S.sed.progresso.indice) {
  const ind = indiciBlocco(i);
  const v = S.esercizi[ind[0]] || S.esercizi[i];
  const def = v ? store.esercizio(v.esercizioId) : null;
  return v?.recuperoSec ?? def?.recuperoDefaultSec ?? 120;
}

/**
 * «Serie 2 di 3» da solo; dentro un blocco anche a che punto sei del giro e con
 * chi è accoppiato, perché la prossima cosa da fare non è riposare ma l'altro
 * esercizio.
 */
function etichettaSerie(n, v) {
  const ind = indiciBlocco();
  if (ind.length < 2) return `Serie ${n} di ${v.serie}`;
  const pos = ind.indexOf(S.sed.progresso.indice) + 1;
  return `Blocco · esercizio ${pos} di ${ind.length} · giro ${n} di ${v.serie}`;
}

function indiciBlocco(i = S.sed.progresso.indice) {
  const v = S.esercizi[i];
  if (!v?.blocco) return [i];
  const fuori = [];
  for (let k = 0; k < S.esercizi.length; k++) {
    if (S.esercizi[k]?.blocco === v.blocco) fuori.push(k);
  }
  return fuori.length ? fuori : [i];
}

/** Quante serie risultano fatte per ciascun esercizio del blocco. */
async function fatteNelBlocco(indici) {
  const out = [];
  for (const k of indici) out.push((await serieFatte(S.esercizi[k].esercizioId)).length);
  return out;
}

function vocePrevista(i = S.sed.progresso.indice) {
  return S.esercizi[i] || null;
}

async function serieFatte(esercizioId) {
  const tutte = await store.serieDi(S.sed.id);
  return tutte.filter((s) => s.esercizioId === esercizioId);
}

/**
 * Protegge dal doppio tocco: finché la transizione precedente non è finita,
 * ogni altro tocco viene ignorato. Senza questo, due tap ravvicinati su
 * "Serie completata" registrano due serie.
 */
function azione(fn) {
  return async (e) => {
    // Ogni tocco dentro l'allenamento è un gesto valido per autorizzare
    // l'audio: quando il recupero finirà, il suono potrà partire.
    sbloccaAudio();
    if (S.occupato) return;
    S.occupato = true;
    const bottone = e?.currentTarget;
    if (bottone) bottone.disabled = true;
    try {
      await fn(e);
    } catch (err) {
      console.error(err);
      toast("Qualcosa non ha funzionato: " + err.message, 5000);
      if (bottone) bottone.disabled = false;
    } finally {
      S.occupato = false;
      // Se la schermata non è stata ridisegnata, il tasto è ancora quello di
      // prima e va riacceso: lasciarlo spento vuol dire un tasto che da lì in
      // poi non risponde più, senza dire perché. Dopo un ridisegno il nodo è
      // staccato dal documento e non serve toccarlo.
      if (bottone && bottone.isConnected) bottone.disabled = false;
    }
  };
}

/** Chiamata dal router quando si lascia questa schermata. */
export function pulisci() {
  if (S?.timerHandle) clearInterval(S.timerHandle);
  if (S) S.timerHandle = null;
  fermaAllarme();
  rilasciaSchermo();
}

function fermaTimer() {
  if (S.timerHandle) clearInterval(S.timerHandle);
  S.timerHandle = null;
  fermaAllarme();
}

// ---------- disegno ----------

async function disegna() {
  fermaTimer();
  S.occupato = false;
  let fase = S.sed.progresso?.fase || "riscaldamento";

  // Il coach può cambiare il programma mentre l'allenamento è aperto: se
  // l'esercizio a cui eri arrivato non c'è più, le schermate che lo cercavano
  // si rompevano e l'allenamento restava bloccato. Si va avanti da dove è
  // possibile, senza perdere niente di quello che hai già registrato.
  if ((fase === "esercizio" || fase === "recupero" || fase === "questionario") && !vocePrevista()) {
    const successivo = S.esercizi.findIndex((_, i) => i >= (S.sed.progresso?.indice ?? 0));
    if (successivo >= 0 && S.esercizi[successivo]) {
      await salvaProgresso({ fase: "esercizio", indice: successivo, recuperoFine: null });
    } else {
      await salvaProgresso({
        fase: S.sed.cardio?.previsto ? "cardio" : "stretching",
        indice: S.esercizi.length,
        recuperoFine: null,
      });
    }
    fase = S.sed.progresso.fase;
  }

  // Chi era dentro l'app nella fase «numeri del cardio» quando è arrivato
  // l'aggiornamento: quella schermata non esiste più, e senza questa riga
  // resterebbe su un allenamento che non sa più disegnare.
  if (fase === "valutazioneCardio") {
    await salvaProgresso({ fase: "stretching" });
    fase = S.sed.progresso.fase;
  }

  // Sui giorni del nuovo split lo stretching finale non c'è: al suo posto c'è
  // il blocco di mobilità. Ci si fermava lo stesso su una schermata vuota che
  // chiedeva «fatto o saltato?» di niente — e rispondere «saltato» tirava giù
  // il punteggio per una cosa che il programma non chiede.
  if (fase === "stretching" && !passiStretching().length) {
    await salvaProgresso({ fase: dopoLoStretching() });
    fase = S.sed.progresso.fase;
  }

  clear(S.contenitore);
  S.contenitore.append(testata());

  const corpo = h("div.session-body");
  const piede = h("div.session-foot");
  S.contenitore.append(corpo, piede);

  if (fase === "riscaldamento") await vistaRiscaldamento(corpo, piede);
  else if (fase === "esercizio") await vistaEsercizio(corpo, piede);
  else if (fase === "recupero") await vistaRecupero(corpo, piede);
  else if (fase === "questionario") await vistaQuestionario(corpo, piede);
  else if (fase === "cardio") await vistaCardio(corpo, piede);
  else if (fase === "stretching") await vistaStretching(corpo, piede);
  else if (fase === "mobilita") await vistaMobilita(corpo, piede);
  else await vistaFine(corpo, piede);
}

function testata() {
  const fase = S.sed.progresso?.fase;
  const i = S.sed.progresso?.indice ?? 0;
  const n = S.esercizi.length;

  let passo = "Riscaldamento";
  let avanzamento = 0;
  if (fase === "cardio") {
    passo = "Cardio";
    avanzamento = 90;
  } else if (fase === "stretching") {
    // Anche qui si va un passaggio per volta: la testata dice quale, come fa
    // con gli esercizi.
    const q = passiStretching().length;
    const k = Math.min((S.sed.progresso?.strPasso ?? 0) + 1, Math.max(q, 1));
    passo = q ? `Stretching ${k} di ${q}` : "Stretching";
    avanzamento = q ? 96 + ((k - 1) / q) * 4 : 96;
  } else if (fase === "mobilita") {
    const q = passiMobilita().length;
    const k = Math.min((S.sed.progresso?.mobPasso ?? 0) + 1, Math.max(q, 1));
    passo = q ? `Mobilità ${k} di ${q}` : "Mobilità";
    avanzamento = 100;
  } else if (fase === "fine") {
    passo = "Riepilogo";
    avanzamento = 100;
  } else if (fase !== "riscaldamento") {
    passo = `Esercizio ${Math.min(i + 1, n)} di ${n}`;
    avanzamento = n ? 6 + (i / n) * 88 : 6;
  } else {
    const q = passiRiscaldamento().length;
    const k = Math.min((S.sed.progresso?.riscPasso ?? 0) + 1, Math.max(q, 1));
    passo = q ? `Riscaldamento ${k} di ${q}` : "Riscaldamento";
    avanzamento = q ? ((k - 1) / q) * 6 : 3;
  }

  return h(
    "div",
    h(
      "div.session-head",
      h("button", { onclick: unaVoltaSola(esci) }, "Esci"),
      h("span.step", `${S.sed.tipoNome} · ${passo}`),
      h("button", { onclick: unaVoltaSola(menuSeduta), "aria-label": "Altre azioni dell'allenamento" }, "•••")
    ),
    h("div.progressline", h("i", { style: `width:${avanzamento}%` }))
  );
}

async function esci() {
  fermaTimer();
  rilasciaSchermo();
  S.vaiA("oggi");
}

/**
 * Il cronometro del cardio lasciato acceso dietro le spalle.
 *
 * Uscendo dal cardio con il menu — «vai allo stretching», «chiudi
 * l'allenamento» — il cronometro restava avviato: la camminata non veniva
 * registrata (l'allenamento si chiudeva col cardio «non fatto» anche se
 * l'avevi fatto) e tornandoci il conto comprendeva pure il tempo passato
 * altrove. Qui si chiede cosa farne, una volta, con i minuti veri davanti.
 *
 * @returns false se hai annullato: allora non si esce nemmeno dal cardio.
 */
async function cardioDaChiudere() {
  const inizio = S.sed.progresso?.cardioInizio;
  if (!inizio) return true;
  const minuti = Math.max(1, Math.round((Date.now() - inizio) / 60000));
  const scelta = await chiedi({
    titolo: "Il cardio è ancora in corso",
    testo: `Il cronometro va da ${durataUmana(minuti * 60)}. Se esci adesso, quel tempo o lo registro o lo butto via: dopo non c'è più modo di recuperarlo.`,
    opzioni: [
      { etichetta: `Registralo: ${minuti} min`, valore: "registra" },
      { etichetta: "Buttalo via", valore: "butta", stile: "destructive" },
    ],
  });
  if (scelta !== "registra" && scelta !== "butta") return false;
  if (scelta === "registra") {
    S.sed = await store.aggiornaSeduta(S.sed.id, {
      cardio: {
        ...S.sed.cardio,
        eseguito: true,
        durataMin: minuti,
        finitoIl: Date.now(),
      },
    });
  }
  fermaTimer();
  await salvaProgresso({ cardioInizio: null, cardioFine: null });
  return true;
}

async function menuSeduta() {
  const fase = S.sed.progresso?.fase;
  const scelta = await chiedi({
    titolo: "Allenamento",
    opzioni: [
      // Il cardio si può saltare solo se era previsto: portarci l'allenamento
      // quando il programma non lo chiede faceva comparire una schermata di
      // cardio inventata dal nulla. E non si offre di andare dove sei già: una
      // voce che non fa niente sembra una voce che non funziona.
      // A cardio già registrato «salta al» è falso: il cardio l'hai fatto, e
      // quella schermata serve semmai a rifarlo. La voce resta (serve a
      // correggere una camminata sbagliata) ma dice quello che fa davvero.
      ...(S.sed.cardio?.previsto && fase !== "cardio"
        ? [{ etichetta: S.sed.cardio?.eseguito ? "Torna al cardio" : "Salta al cardio", valore: "cardio" }]
        : []),
      // Il nome dice dove si va davvero: senza stretching finale quella voce
      // portava alla mobilità, e prometteva una schermata che non esiste.
      ...(fase !== "stretching" &&
      fase !== "mobilita" &&
      (passiStretching().length || passiMobilita().length)
        ? [
            {
              etichetta: passiStretching().length ? "Vai allo stretching" : "Vai alla mobilità",
              valore: "stretching",
            },
          ]
        : []),
      ...(fase !== "fine" ? [{ etichetta: "Chiudi l'allenamento adesso", valore: "chiudi" }] : []),
      { etichetta: "Annulla l'allenamento (elimina i dati)", valore: "annulla", stile: "destructive" },
    ],
  });
  if (scelta === "cardio") {
    await salvaProgresso({ fase: "cardio" });
    await disegna();
  } else if (scelta === "stretching") {
    if (!(await cardioDaChiudere())) return;
    await salvaProgresso({ fase: "stretching" });
    await disegna();
  } else if (scelta === "chiudi") {
    if (!(await cardioDaChiudere())) return;
    await salvaProgresso({ fase: "fine" });
    await disegna();
  } else if (scelta === "annulla") {
    const conferma = await chiedi({
      titolo: "Eliminare l'allenamento?",
      testo: "Serie, questionari e note di questo allenamento vengono cancellati. Non si può annullare.",
      opzioni: [{ etichetta: "Elimina tutto", valore: "si", stile: "danger" }],
    });
    if (conferma === "si") {
      await store.annullaSeduta(S.sed.id);
      fermaTimer();
      rilasciaSchermo();
      S.vaiA("oggi");
    }
  }
}

// ---------- riscaldamento ----------

/**
 * I passaggi del riscaldamento, in ordine: camminata, mobilità, serie di
 * avvicinamento. Sta fuori dalla vista perché anche la testata deve sapere
 * quanti sono per scrivere «3 di 7».
 */
function passiRiscaldamento() {
  const conTapis = S.sed.riscaldamento?.modalita !== "senzaTapis";
  const prot = store.riscaldamento(S.sed.tipoId);
  const camminata = conTapis ? prot?.cardio?.conTapis : prot?.cardio?.senzaTapis;
  const passi = [];
  if (camminata) {
    // La durata della Fase 1 la decide il giorno: il full body ne chiede di più.
    const f1 = prot?.fase1 || {};
    passi.push({
      nome: camminata.titolo,
      dose: f1.dose || "5 min",
      come: f1.nota ? `${camminata.dettaglio} ${f1.nota[0].toUpperCase()}${f1.nota.slice(1)}.` : camminata.dettaglio,
    });
  }
  for (const m of prot?.mobilita || []) passi.push({ nome: m.nome, dose: m.dose, come: m.come, video: m.video });
  if (prot?.serieDiAvvicinamento) {
    const a = avvicinamento(prot.serieDiAvvicinamento, prot?.mobilita || []);
    // «Una serie con bilanciere scarico o metà carico» non vuol dire niente
    // davanti a un esercizio che carico non ne ha: nei giorni che aprono a
    // corpo libero il passaggio non si mostra invece di chiedere otto ripetizioni
    // di una cosa che non si può alleggerire.
    if (a) passi.push({ nome: a.nome, dose: a.dose, come: a.come, video: a.video });
  }
  return passi;
}

const PAROLE_DI_SERVIZIO = new Set([
  "corpo", "libero", "vuoto", "lente", "lenti", "bilanciere", "manubri", "manubrio", "panca",
  "sulla", "sulle", "dell", "della", "delle", "degli", "adesso",
]);

/* I qualificatori che cambiano l'esercizio pur lasciando lo stesso nome
   d'apertura: alzate LATERALI e alzate POSTERIORI non sono lo stesso gesto. */
const QUALIFICATORI = new Set(["lateral", "posterior", "anterior", "frontal", "invers", "larg", "strett", "alternat"]);

/** Singolare e plurale della stessa parola devono contare come una: «estensione» ed «estensioni». */
function radice(parola) {
  return parola.length > 4 ? parola.replace(/[aeio]$/, "") : parola;
}

/** Le parole che contano di un nome, in ordine, per capire se due esercizi sono lo stesso gesto. */
function paroleChiave(nome) {
  return String(nome || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4 && !PAROLE_DI_SERVIZIO.has(p))
    .map(radice);
}

/**
 * La serie di avvicinamento, detta per intero.
 *
 * Il protocollo dice «sul primo esercizio della seduta»: giusto sulla carta,
 * inutile davanti al bilanciere, perché quel primo esercizio bisogna andarselo
 * a cercare. E quando il gesto è lo stesso della mobilità — squat a corpo
 * libero in riscaldamento e squat con bilanciere come primo esercizio —
 * sembrava di dover fare venti squat di riscaldamento senza motivo. Qui
 * l'esercizio ha un nome, il carico un numero, e la differenza con la mobilità
 * è scritta: prima a corpo libero, adesso sotto il bilanciere.
 */
function avvicinamento(def, mobilita) {
  const v = S.esercizi[0];
  const es = v ? store.esercizio(v.esercizioId) : null;
  if (!es) return null;

  // L'inventario si legge dal programma già in memoria: qui non si può aspettare.
  const barra = Number.isFinite(store.programma()?.inventario?.barra)
    ? store.programma().inventario.barra
    : 10;
  const lavoro = Number.isFinite(v.carico) && v.carico > 0 ? v.carico : null;
  const attrezzo = es.attrezzo || "";

  let carico;
  let scala = null; // quanto pesa davvero, se è un numero
  if (attrezzo === "bilanciere") {
    carico = `bilanciere scarico (${num(barra)} kg)`;
    scala = barra;
  } else if (attrezzo === "manubri" || attrezzo === "manubrio") {
    carico = lavoro ? `metà carico (${num(lavoro / 2)} kg)` : "il manubrio più leggero che hai";
    scala = lavoro ? lavoro / 2 : null;
  } else {
    return null;
  }

  // Se lo stesso gesto sta già nella mobilità, dirlo: è la differenza fra
  // «rifallo un'altra volta» e «lo stesso movimento, adesso con il ferro».
  // Bastava UNA parola in comune di quattro lettere, e l'app dichiarava «lo
  // stesso gesto» fra cose diverse: «Abduzioni d'anca» con «Flessori
  // dell'anca» (anca), «Ponte per glutei con piedi sulla panca» con
  // «Quadricipite in piedi» (piedi). Adesso servono tre cose insieme: la
  // stessa parola d'apertura — quella che dice il gesto —, nessun
  // qualificatore in contrasto (laterali contro posteriori), e a parità vince
  // chi ha più parole in comune.
  const mie = paroleChiave(es.nome);
  const primaMia = mie[0];
  const dirMie = mie.filter((p) => QUALIFICATORI.has(p));
  let gemello = null;
  let miglior = 0;
  for (const m of mobilita || []) {
    const sue = paroleChiave(m.nome);
    if (!primaMia || sue[0] !== primaMia) continue;
    const dirSue = sue.filter((p) => QUALIFICATORI.has(p));
    if (dirMie.length && dirSue.length && !dirMie.some((d) => dirSue.includes(d))) continue;
    const comuni = sue.filter((p) => mie.includes(p)).length;
    if (comuni > miglior) {
      miglior = comuni;
      gemello = m;
    }
  }
  let nota = "";
  if (gemello) {
    // Quando l'avvicinamento pesa quanto la serie vera non c'è nessuna rampa da
    // promettere: è solo un giro di prova prima di quello che conta.
    const rampa = lavoro != null && scala != null && lavoro > scala;
    nota = rampa
      ? ` Lo stesso gesto di «${gemello.nome}», che hai appena fatto: questa volta con il carico addosso, per ritrovarlo prima della serie vera da ${num(lavoro)} kg.`
      : ` Lo stesso gesto di «${gemello.nome}», che hai appena fatto: questa volta con il ferro in mano. Pesa quanto la serie vera, quindi tienila facile e curata — è un giro di prova, non la prima serie.`;
  }

  return {
    nome: `${def.titolo}: ${es.nome}`,
    dose: `1 × 8-10 · ${carico}`,
    video: es.video,
    // Il nome dell'esercizio sta già nel titolo: ripeterlo qui dentro dava
    // «di Squat con bilanciere con bilanciere scarico».
    come: `Una serie da 8-10 ripetizioni con ${carico}.${nota} Non va registrata: serve solo a scaldare il movimento.`,
  };
}

function passiMobilita() {
  const prot = store.riscaldamento(S.sed.tipoId);
  return (prot?.mobilitaFinale || []).map((v) => ({ nome: v.nome, dose: v.dose, come: v.come, video: v.video }));
}

function passiStretching() {
  const prot = store.riscaldamento(S.sed.tipoId);
  return (prot?.stretchingFinale || []).map((v) => ({ nome: v.nome, dose: v.dose, come: v.come, video: v.video }));
}

async function vistaRiscaldamento(corpo, piede) {
  const conTapis = S.sed.riscaldamento?.modalita !== "senzaTapis";
  const prot = store.riscaldamento(S.sed.tipoId);

  await vistaGuidata(corpo, piede, {
    chiave: "risc",
    // La mobilità si fa, non si tiene: «tieni la posizione» andrebbe bene per
    // un allungamento, non per dei cerchi con le braccia.
    tenuta: false,
    kicker: "Riscaldamento",
    titolo: "Riscaldamento",
    passi: passiRiscaldamento(),
    etichettaFine: "Riscaldamento fatto",
    // La scelta del tapis cambia la camminata, quindi vive sul passaggio della
    // camminata e non sta a ingombrare gli altri sei.
    extra: (i) =>
      i === 0
        ? [
            h(
              "div.segmented",
              h(
                "button",
                {
                  "aria-pressed": conTapis,
                  onclick: azione(async () => {
                    S.sed = await store.aggiornaSeduta(S.sed.id, {
                      riscaldamento: { ...S.sed.riscaldamento, modalita: "tapis" },
                    });
                    await disegna();
                  }),
                },
                "Con tapis"
              ),
              h(
                "button",
                {
                  "aria-pressed": !conTapis,
                  onclick: azione(async () => {
                    S.sed = await store.aggiornaSeduta(S.sed.id, {
                      riscaldamento: { ...S.sed.riscaldamento, modalita: "senzaTapis" },
                    });
                    await disegna();
                  }),
                },
                "Senza tapis"
              )
            ),
            h(
              "div.guida",
              h(
                "section",
                h("h3", "Sul Watch"),
                h(
                  "p",
                  "Avvia una sola sessione «Rafforzamento funzionale» che comprenda riscaldamento e pesi. Non tracciare il riscaldamento come camminata separata."
                )
              ),
              prot?.nota ? h("section", h("h3", "Perché niente stretching adesso"), h("p", prot.nota)) : null
            ),
          ]
        : [],
    onFine: async () => {
      sbloccaAudio();
      S.sed = await store.aggiornaSeduta(S.sed.id, {
        riscaldamento: { ...S.sed.riscaldamento, fatto: true },
      });
      await salvaProgresso({ fase: "esercizio", indice: 0 });
      await disegna();
    },
  });
}

// ---------- esercizio ----------

async function vistaEsercizio(corpo, piede) {
  const v = vocePrevista();
  if (!v) {
    await salvaProgresso({ fase: S.sed.cardio?.previsto ? "cardio" : "stretching" });
    return disegna();
  }
  const def = store.esercizio(v.esercizioId);
  const fatte = await serieFatte(v.esercizioId);

  // Rete di sicurezza: se le serie registrate hanno già raggiunto il previsto,
  // si passa al questionario invece di proporne un'altra. Dentro un blocco vale
  // solo quando li ha finiti tutti e due: il compagno indietro di un giro va
  // fatto, non saltato.
  if (fatte.length >= v.serie) {
    const ind = indiciBlocco();
    const quante = await fatteNelBlocco(ind);
    const indietro = ind.findIndex((k, j) => quante[j] < (S.esercizi[k].serie || 0));
    if (indietro >= 0) {
      await salvaProgresso({ fase: "esercizio", indice: ind[indietro], recuperoFine: null });
      return disegna();
    }
    await salvaProgresso({ fase: "questionario", indice: ind[0] });
    return disegna();
  }

  const n = fatte.length + 1;
  const inv = await store.inventario();

  // Una proposta accettata vale per la prossima esposizione: qui è dove si vede.
  // Non è l'app che decide, è la decisione dell'atleta che torna a galla.
  const obiettivo = v.aTempo ? null : await store.obiettivoCorrente(v.esercizioId);
  S.obiettivo = obiettivo;

  // L'ordine è: quello che hai già usato oggi, poi l'obiettivo accettato, poi
  // il carico scritto nel brief, e solo alla fine quello dedotto dallo storico.
  // Prima lo storico veniva prima del brief, e un brief nuovo non si vedeva.
  // Uno zero scritto nel brief è una dichiarazione, non un buco: vuol dire
  // corpo libero. Prima non fermava la catena, e l'app tirava fuori dallo
  // storico il carico dell'ultima volta — proponendo un bilanciere su un
  // esercizio che il coach aveva appena tolto dal ferro.
  const senzaCarico = v.carico === 0;
  const caricoPrec = senzaCarico
    ? null
    : fatte.at(-1)?.carico ??
      obiettivo?.carico ??
      // Una decisione già presa su questo carico viene prima del numero del
      // brief: l'obiettivo si consuma dopo una esposizione, la decisione no.
      (await store.caricoDaDecisione(v.esercizioId)) ??
      (v.carico > 0 ? v.carico : null) ??
      (await store.ultimoCarico(v.esercizioId, v.carico ?? null));
  // L'ordine conta: prima quello che c'è in memoria, poi quello salvato nella
  // seduta (l'app è ripartita), infine il carico dedotto dallo storico.
  S.caricoCorrente = S.caricoCorrente ?? S.sed.progresso?.caricoCorrente ?? caricoPrec;

  const bersaglio = v.aTempo
    ? `${v.serie} × ${durataScritta(v.durataSec || 0)}`
    : obiettivo?.rip != null
      ? `${v.serie} × ${obiettivo.rip}`
      : senzaBersaglio(v)
        ? null
        : `${v.serie} × ${v.ripMin === v.ripMax ? v.ripMin : `${v.ripMin}-${v.ripMax}`}`;

  // Col cronometro in corso il numero grande è il tempo che scorre, non il
  // carico: è l'unica cosa che serve guardare mentre tieni la posizione.
  if (v.aTempo && S.cronoFine) {
    aggiungi(corpo, quadranteCronometro(v, n));
  } else {
    aggiungi(corpo, 
      h(
        "div.hero",
        h("p.kicker", etichettaSerie(n, v)),
        h("h2", def?.nome || v.esercizioId),
        S.caricoCorrente != null
          ? h("p.load", `${num(S.caricoCorrente)} kg`)
          : h("p.load", "corpo libero"),
        bersaglio ? h("p.target", `Obiettivo ${bersaglio}`) : null
      )
    );
  }

  if (obiettivo) {
    aggiungi(
      corpo,
      h("div.plates", h("span.etichetta", "Proposta accettata"), h("b", obiettivo.titolo))
    );
  }

  // Anche i manubri regolabili si montano: dire quali dischi mettere vale per
  // loro esattamente come per il bilanciere. Prima l'app lo diceva solo per il
  // bilanciere e sui manubri lasciava fare il conto a mente.
  if (S.caricoCorrente != null && (def?.attrezzo || "").includes("manubri") && conosceManubri(inv, aPaio(def))) {
    const d = descriviManubri(S.caricoCorrente, inv, aPaio(def));
    aggiungi(corpo,
      h(
        "div.plates",
        h("span.etichetta", "Da montare"),
        d
          ? h("b", d)
          : h(
              "span",
              `${num(S.caricoCorrente)} kg per manubrio non si compone con quello che hai: i più vicini sono ` +
                `${num(manubrioPiuVicino(S.caricoCorrente, -1, inv, aPaio(def)))} e ` +
                `${num(manubrioPiuVicino(S.caricoCorrente, 1, inv, aPaio(def)))} kg`
            )
      )
    );
  }

  if (S.caricoCorrente != null && def?.attrezzo === "bilanciere") {
    const d = descriviDischi(S.caricoCorrente, inv);
    aggiungi(corpo, 
      h(
        "div.plates",
        h("span.etichetta", "Da montare"),
        // Dire solo «non componibile» lascia in mano al palestrato il conto dei
        // dischi: i due carichi vicini l'app li sa già, tanto vale scriverli.
        d
          ? h("b", d)
          : h(
              "span",
              `carico non componibile: con i tuoi dischi i più vicini sono ` +
                `${num(carichoPiuVicino(S.caricoCorrente, -1, inv))} e ` +
                `${num(carichoPiuVicino(S.caricoCorrente, 1, inv))} kg`
            )
      )
    );
  }

  if (fatte.length) {
    aggiungi(corpo, 
      h(
        "div.group",
        h("h2", "Serie fatte"),
        h(
          "div.list",
          ...fatte.map((s) =>
            h(
              "div.row",
              h("div.main", h("span.title", `Serie ${s.numero}`), s.recuperoRealeSec != null ? h("span.sub", `recupero ${mmss(s.recuperoRealeSec)}`) : null),
              h("span.value", `${s.carico != null ? num(s.carico) + " kg · " : ""}${s.ripFatte ?? "—"}${v.aTempo ? "s" : " rip"}`)
            )
          )
        )
      )
    );
  }

  aggiungi(corpo, 
    h(
      "div.guida",
      def?.video ? riquadroVideo(def) : null,
      def?.esecuzione ? sezione("Esecuzione", def.esecuzione, "ol") : null,
      def?.setup ? sezione("Setup", def.setup) : null,
      def?.erroriComuni ? sezione("Errori da evitare", def.erroriComuni) : null,
      def?.cue ? h("section.cue", h("h3", "Cue"), h("p", def.cue)) : null,
      def?.sicurezza ? h("section.sicurezza", h("h3", "Sicurezza"), h("p", def.sicurezza)) : null
    )
  );

  // Su un esercizio a tempo la serie non è una cosa che «completi»: è una cosa
  // che tieni, e quanto la tieni è il dato. Il cronometro parte con «Avvia» e
  // «Fine» registra i secondi davvero fatti — perché mollare a 38 su 45 va
  // scritto, non arrotondato al previsto.
  if (v.aTempo) {
    aggiungiPiede(piede, ...piedeCronometro(v, def, n, inv));
  } else {
    // I due tasti di servizio stanno SOPRA e il tasto vero in fondo. È la
    // stessa posizione che ha «Pronto» nel recupero: durante una serie si
    // alterna fra queste due schermate decine di volte, e avere il tasto
    // principale ora in alto ora in basso faceva centrare «Salta esercizio»
    // a chi mirava a «Serie completata». In fondo, per giunta, un tocco
    // troppo basso finisce sul bordo dello schermo invece che su un tasto
    // che salta l'esercizio.
    aggiungiPiede(piede,
      h(
        "div",
        { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px" },
        h("button.btn.secondary", { onclick: unaVoltaSola(() => modificaCarico(def, inv)) }, "Cambia carico"),
        h("button.btn.secondary", { onclick: unaVoltaSola(() => saltaEsercizio(v, def)) }, "Salta esercizio")
      ),
      h(
        "button.btn",
        {
          onclick: azione(async () => {
            sbloccaAudio();
            await completaSerie(v, def, n);
          }),
        },
        "Serie completata"
      )
    );
    const ind = indiciBlocco();
    if (ind.length > 1) {
      const mio = ind.indexOf(S.sed.progresso.indice);
      const dopo = ind.find((k, j) => j > mio);
      const altro = dopo != null ? store.esercizio(S.esercizi[dopo].esercizioId) : null;
      aggiungi(corpo,
        h(
          "p.footnote",
          { style: "margin:14px 16px 24px" },
          altro
            ? `Subito dopo, senza riposo: ${altro.nome}. Il recupero viene dopo tutti e due.`
            : `Chiusa questa, riposo e si ricomincia il blocco dal primo esercizio.`
        )
      );
    }
  }
}

/**
 * Il cronometro degli esercizi a tempo.
 *
 * Conta alla rovescia dal previsto. Se arrivi in fondo suona e la serie vale
 * quello che chiedeva il programma; se molli prima, «Fine» registra i secondi
 * che hai davvero tenuto. L'istante di fine sta nel progresso salvato, quindi
 * bloccare lo schermo o riaprire l'app non falsa il conto: il tempo si misura
 * sull'orologio, non su un contatore che gira solo mentre guardi.
 */
function quadranteCronometro(v, n) {
  // Un plank da 45 secondi si legge bene come numero secco; una camminata da
  // 3600 mostrerebbe «3600», che non vuol dire niente. Sopra il minuto si
  // passa ai minuti, come nel recupero.
  const lungo = (v.durataSec || 0) >= 60;
  const mostra = (sec) => (lungo ? mmss(sec) : String(Math.ceil(sec)));
  const testo = h("p.timer", mostra(v.durataSec || 0));
  const CIRC = 2 * Math.PI * 100;
  const anello = h("circle.prog", {
    cx: 108, cy: 108, r: 100,
    style: `stroke-dasharray:${CIRC};stroke-dashoffset:0`,
  });
  const quadrante = h(
    "div.timer-wrap",
    h("svg.timer-ring", { viewBox: "0 0 216 216" }, h("circle.track", { cx: 108, cy: 108, r: 100 }), anello),
    testo
  );
  const totale = (v.durataSec || 1) * 1000;
  let preavvisoFatto = false;
  const aggiorna = () => {
    if (!S.cronoFine) return;
    const restanti = (S.cronoFine - Date.now()) / 1000;
    const quota = Math.max(0, Math.min(1, (restanti * 1000) / totale));
    anello.style.strokeDashoffset = String(CIRC * (1 - quota));
    if (restanti > 0) {
      testo.textContent = mostra(restanti);
      quadrante.classList.remove("done");
      testo.classList.remove("done");
      if (restanti <= 3 && !preavvisoFatto) {
        preavvisoFatto = true;
        tick();
      }
    } else {
      // Arrivato a zero: la posizione l'hai tenuta tutta. Suona, e resta lì
      // finché non tocchi «Fine» — il tempo in più non viene contato.
      testo.textContent = lungo ? "00:00" : "0";
      quadrante.classList.add("done");
      testo.classList.add("done");
      if (!allarmeAttivo()) avviaAllarme();
    }
  };
  aggiorna();
  fermaTimer();
  S.timerHandle = setInterval(aggiorna, 200);
  return h(
    "div.hero",
    // Un plank si tiene, una sessione di Pilates o una camminata da un'ora si
    // fanno: il verbo lo decide la durata, non la schermata.
    h("p.kicker", `Serie ${n} di ${v.serie} · ${lungo ? "in corso" : "tieni la posizione"}`),
    quadrante,
    h("p.target", `Previsti ${durataScritta(v.durataSec || 0)} · «Fine» se molli prima`)
  );
}

/**
 * Legge la dose scritta a parole e dice se quel passaggio si fa a tempo.
 *
 * Le dosi arrivano dal protocollo come le scriverebbe un istruttore: «30 s per
 * lato», «3 × 15 s per lato», «5 min», «10 per verso». Le prime tre sono tenute
 * a cronometro e meritano un timer vero; le altre si contano a ripetizioni e un
 * timer lì sarebbe solo rumore. Nessuna durata riconosciuta significa nessun
 * cronometro: meglio niente che un conto inventato.
 */
function tempoDaDose(dose) {
  if (!dose) return null;
  const t = String(dose).toLowerCase();
  // Il numero può avere la virgola («1,5 min»): leggerne solo la parte intera
  // faceva diventare novanta secondi cinque minuti. E «minuto» al singolare va
  // riconosciuto come «min», altrimenti quella dose resta senza cronometro.
  const numero = (x) => Number(String(x).replace(",", "."));
  // Una dose può essere un intervallo («6-7 min»): si prende il minimo, che è
  // quello che il protocollo chiede davvero. Prima veniva letto il massimo,
  // perché è il numero attaccato all'unità di misura.
  const gamma = t.match(/(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*(secondi|secondo|sec|s|minuti|minuto|min|m)\b/);
  const sec = t.match(/(\d+(?:[.,]\d+)?)\s*(?:secondi|secondo|sec|s)\b/);
  const min = t.match(/(\d+(?:[.,]\d+)?)\s*(?:minuti|minuto|min|m)\b/);
  const inMinuti = gamma ? /^m/.test(gamma[3]) : !sec && Boolean(min);
  const grezzo = gamma ? numero(gamma[1]) : sec ? numero(sec[1]) : min ? numero(min[1]) : null;
  if (grezzo == null) return null;
  const durata = Math.round(inMinuti ? grezzo * 60 : grezzo);
  if (!durata || durata <= 0) return null;
  const giriMatch = t.match(/(\d+)\s*[×x]\s*\d/);
  const serie = giriMatch ? Number(giriMatch[1]) : 1;
  // «per lato» si scrive in molti modi — con la barra, per gamba, per braccio —
  // e ogni direzione di un cerchio è una tenuta come lo è un lato. Riconoscerne
  // uno solo faceva partire un cronometro invece di due, cioè metà del lavoro.
  const m = t.match(/(?:per|\/)\s*(lato|gamba|braccio|direzione|verso)/);
  const perLato = Boolean(m);
  // Due giri di cerchi con le braccia non sono «due lati»: la parola giusta
  // la dice la dose stessa.
  const parola = m ? m[1] : null;
  return { durata, serie, perLato, parola, tenute: serie * (perLato ? 2 : 1) };
}

/**
 * Una voce che si fa e basta, senza un bersaglio da dichiarare: serie singola,
 * una «ripetizione» sola. È il caso di una sessione di Pilates o di una
 * camminata segnate come attività, non come esercizio. Scrivere «Obiettivo
 * 1 × 1» sarebbe una riga senza significato.
 */
function senzaBersaglio(v) {
  return !v?.aTempo && v?.serie === 1 && v?.ripMin === 1 && v?.ripMax === 1;
}

/**
 * «al polso destro», «all'anca». Il brief scrive il nome del punto dolente
 * senza preposizione, ma la domanda in italiano la vuole. Se il brief scrive
 * già la domanda intera questa non viene usata: è solo il ripiego.
 */
function conArticolo(nome) {
  const n = String(nome || "").trim();
  if (/^(al |allo |all'|alla |ai |alle )/i.test(n)) return n;
  return /^[aeiouàèéìòù]/i.test(n) ? `all'${n}` : `al ${n}`;
}

/** «45s», «5 min»: i secondi nudi sopra il minuto non si leggono. */
function durataScritta(sec) {
  return sec >= 60 && sec % 60 === 0 ? `${sec / 60} min` : sec >= 60 ? mmss(sec) : `${sec}s`;
}

/**
 * Come si chiama la tenuta numero `g` di una dose a tempo.
 * «3 × 15 s per lato» sono sei tenute: giro 1 primo lato, giro 1 altro lato,
 * giro 2 primo lato... Dirlo mentre sei in posizione evita di perdere il conto.
 */
function nomeTenuta(tempo, g) {
  const parti = [];
  if (tempo.serie > 1) parti.push(`giro ${Math.floor(g / (tempo.perLato ? 2 : 1)) + 1} di ${tempo.serie}`);
  if (tempo.perLato) {
    const p = tempo.parola === "direzione" || tempo.parola === "verso"
      ? ["una direzione", "l'altra direzione"]
      : tempo.parola === "gamba"
        ? ["prima gamba", "altra gamba"]
        : tempo.parola === "braccio"
          ? ["primo braccio", "altro braccio"]
          : ["primo lato", "altro lato"];
    parti.push(g % 2 === 0 ? p[0] : p[1]);
  }
  return parti.join(" · ");
}

/** Il quadrante del conto alla rovescia, uguale a quello degli esercizi a tempo. */
function quadranteTempo(fine, totaleSec, kicker, sotto) {
  const testo = h("p.timer", "");
  const CIRC = 2 * Math.PI * 100;
  const anelloTempo = h("circle.prog", {
    cx: 108, cy: 108, r: 100,
    style: `stroke-dasharray:${CIRC};stroke-dashoffset:0`,
  });
  const quadrante = h(
    "div.timer-wrap",
    h("svg.timer-ring", { viewBox: "0 0 216 216" }, h("circle.track", { cx: 108, cy: 108, r: 100 }), anelloTempo),
    testo
  );
  const totale = Math.max(1, totaleSec) * 1000;
  let preavvisoFatto = false;
  const aggiorna = () => {
    const restanti = (fine - Date.now()) / 1000;
    const quota = Math.max(0, Math.min(1, (restanti * 1000) / totale));
    anelloTempo.style.strokeDashoffset = String(CIRC * (1 - quota));
    if (restanti > 0) {
      // Sotto il minuto i secondi netti si leggono meglio di «00:27»; sopra,
      // «300» non vuol dire niente e ci vuole il minutaggio.
      testo.textContent = totaleSec >= 60 ? mmss(restanti) : String(Math.ceil(restanti));
      quadrante.classList.remove("done");
      testo.classList.remove("done");
      if (restanti <= 3 && !preavvisoFatto) {
        preavvisoFatto = true;
        tick();
      }
    } else {
      testo.textContent = totaleSec >= 60 ? "00:00" : "0";
      quadrante.classList.add("done");
      testo.classList.add("done");
      if (!allarmeAttivo()) avviaAllarme();
    }
  };
  aggiorna();
  fermaTimer();
  S.timerHandle = setInterval(aggiorna, 200);
  return h("div.hero", h("p.kicker", kicker), quadrante, sotto ? h("p.target", sotto) : null);
}

/**
 * Un passaggio per volta, non la lista intera.
 *
 * Riscaldamento e stretching erano due muri di testo con tutti i passaggi
 * insieme: per sapere a che punto eri dovevi ricordartelo tu, e le tenute a
 * secondi le contavi a occhio. Qui c'è un passaggio alla volta, con il suo
 * cronometro quando la dose è a tempo, e il posto in cui sei sta nel progresso
 * salvato — chiudere l'app a metà riscaldamento non fa ricominciare da capo.
 */
async function vistaGuidata(corpo, piede, cfg) {
  const { chiave, kicker, titolo, passi, etichettaFine, onFine, extra } = cfg;
  const kPasso = `${chiave}Passo`;
  const kGiro = `${chiave}Giro`;
  const kFine = `${chiave}Fine`;

  if (!passi.length) {
    // «Niente da fare in questo giorno» e «il file del protocollo non è
    // arrivato» sono due cose diverse, e prima erano la stessa schermata: si
    // spuntava un riscaldamento che nessuno aveva scritto. Se il protocollo
    // manca lo si dice, e si offre di riprovare.
    const senzaProtocollo = !store.protocolloCaricato();
    aggiungi(corpo,
      h("div.hero", h("p.kicker", kicker), h("h2", titolo), h("p.target", S.sed.tipoNome)),
      h(
        "div.group",
        h(
          "div.list",
          h(
            "div.row",
            h(
              "div.main",
              h("span.title", senzaProtocollo ? "Protocollo non caricato" : cfg.vuoto || "Niente da fare in questo giorno"),
              senzaProtocollo
                ? h("span.sub", "I passaggi stanno in un file che non è arrivato: non so dirti cosa prevede questo giorno. Riprova, oppure vai avanti e fallo a memoria.")
                : null
            )
          )
        )
      )
    );
    aggiungiPiede(piede, 
      ...(senzaProtocollo
        ? [
            h(
              "button.btn.secondary",
              {
                onclick: azione(async () => {
                  const preso = await store.riprovaProtocollo();
                  toast(preso ? "Protocollo caricato." : "Ancora niente: serve la rete una volta sola.");
                  await disegna();
                }),
              },
              "Riprova a caricarlo"
            ),
          ]
        : []),
      ...(cfg.tastiExtra?.(passi.length) || []),
      h("button.btn", { onclick: azione(onFine) }, etichettaFine)
    );
    return;
  }

  const i = Math.min(S.sed.progresso?.[kPasso] ?? 0, passi.length - 1);
  const p = passi[i];
  const tempo = tempoDaDose(p.dose);
  const giro = tempo ? Math.min(S.sed.progresso?.[kGiro] ?? 0, tempo.tenute - 1) : 0;
  const fine = tempo ? S.sed.progresso?.[kFine] || null : null;
  const ultimo = i === passi.length - 1;
  const ultimaTenuta = !tempo || giro >= tempo.tenute - 1;

  const vai = async (patch) => {
    fermaAllarme();
    await salvaProgresso(patch);
    await disegna();
  };

  // ---- corpo ----
  if (fine) {
    // «Tieni la posizione» vale per un allungamento, non per cinque minuti di
    // camminata: il verbo lo decide la dose, non la schermata.
    const tenuta = cfg.tenuta ?? tempo.perLato;
    aggiungi(corpo,
      quadranteTempo(
        fine,
        tempo.durata,
        `${p.nome} · ${tenuta ? "tieni la posizione" : "in corso"}`,
        nomeTenuta(tempo, giro) || `Previsti ${durataScritta(tempo.durata)}`
      )
    );
  } else {
    aggiungi(corpo,
      h(
        "div.hero",
        h("p.kicker", `${kicker} · ${i + 1} di ${passi.length}`),
        h("h2", p.nome),
        p.dose ? h("p.target", p.dose) : null
      )
    );
  }

  aggiungi(corpo, ...(extra?.(i, p) || []).filter(Boolean));

  // Il video sta dove sta negli esercizi: sopra le istruzioni scritte, e si
  // carica solo se lo tocchi. La spiegazione a parole resta comunque la fonte:
  // in palestra senza rete l'anteprima non parte, il testo sì.
  if (p.video?.id) aggiungi(corpo, riquadroVideo({ video: p.video, nome: p.nome }));

  if (p.come) aggiungi(corpo, h("div.guida", h("section", h("h3", "Come si fa"), h("p", p.come))));

  if (tempo && tempo.tenute > 1) {
    aggiungi(corpo,
      h("p.footnote", { style: "margin:12px 16px 0" },
        `${tempo.tenute} tenute da ${durataScritta(tempo.durata)}: sei alla ${giro + 1}.`)
    );
  }

  aggiungi(corpo,
    h("p.footnote", { style: "margin:12px 16px 24px" },
      ultimo ? "È l'ultimo passaggio." : `Dopo questo: ${passi[i + 1].nome}.`)
  );

  // ---- piede ----
  const servizio = [];
  if (i > 0 || giro > 0 || fine) {
    servizio.push(
      h("button.btn.secondary", {
        onclick: azione(async () => {
          // Indietro annulla prima il cronometro in corso, poi la tenuta, poi
          // il passaggio: è l'ordine in cui uno se ne pente.
          if (fine) return vai({ [kFine]: null });
          if (giro > 0) return vai({ [kGiro]: giro - 1 });
          const prima = passi[i - 1];
          const tPrima = tempoDaDose(prima.dose);
          return vai({ [kPasso]: i - 1, [kGiro]: tPrima ? tPrima.tenute - 1 : 0, [kFine]: null });
        }),
      }, "Indietro")
    );
  }
  servizio.push(...(cfg.tastiExtra?.(i) || []));

  let principale;
  if (tempo && !fine) {
    principale = h("button.btn", {
      onclick: azione(async () => {
        sbloccaAudio();
        await vai({ [kFine]: Date.now() + tempo.durata * 1000, [kGiro]: giro });
      }),
    }, `Avvia · ${durataScritta(tempo.durata)}${nomeTenuta(tempo, giro) ? ` · ${nomeTenuta(tempo, giro)}` : ""}`);
  } else if (tempo && fine) {
    principale = h("button.btn", {
      onclick: azione(async () => {
        if (!ultimaTenuta) return vai({ [kGiro]: giro + 1, [kFine]: null });
        if (!ultimo) return vai({ [kPasso]: i + 1, [kGiro]: 0, [kFine]: null });
        fermaAllarme();
        await onFine();
      }),
    }, ultimaTenuta
      ? ultimo ? etichettaFine : "Fatto · avanti"
      : `Fatto · ${nomeTenuta(tempo, giro + 1) || "continua"}`);
  } else {
    principale = h("button.btn", {
      onclick: azione(async () => {
        if (!ultimo) return vai({ [kPasso]: i + 1, [kGiro]: 0, [kFine]: null });
        await onFine();
      }),
    }, ultimo ? etichettaFine : "Fatto · avanti");
  }

  aggiungiPiede(piede,
    servizio.length === 1
      ? servizio[0]
      : servizio.length
        ? h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px" }, ...servizio)
        : null,
    principale
  );
}

/**
 * Mette i tasti nel piede della seduta con una regola sola: **il tasto che
 * porta avanti sta sempre in fondo**, sotto ai tasti di servizio.
 *
 * Durante una serie si passa dalla schermata dell'esercizio a quella del
 * recupero decine di volte. Finché il tasto principale stava in alto qui e in
 * basso là, il pollice andava a memoria e centrava «Salta esercizio» al posto
 * di «Serie completata». Mettendolo in fondo dappertutto il bersaglio è
 * sempre nello stesso punto, ed è il punto più comodo da raggiungere; un tocco
 * che scivola troppo in basso finisce sul bordo dello schermo invece che su un
 * tasto che salta l'esercizio.
 */
function aggiungiPiede(piede, ...figli) {
  const vivi = figli.filter(Boolean);
  const avanti = vivi.filter((x) => x.classList?.contains("btn") && !x.classList.contains("secondary"));
  aggiungi(piede, ...vivi.filter((x) => !avanti.includes(x)), ...avanti);
}

function piedeCronometro(v, def, n, inv) {
  const inCorso = Boolean(S.cronoFine);
  if (!inCorso) {
    return [
      h(
        "div",
        { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px" },
        h("button.btn.secondary", { onclick: unaVoltaSola(() => modificaCarico(def, inv)) }, "Cambia carico"),
        h("button.btn.secondary", { onclick: unaVoltaSola(() => saltaEsercizio(v, def)) }, "Salta esercizio")
      ),
      h(
        "button.btn",
        {
          onclick: azione(async () => {
            sbloccaAudio();
            S.cronoFine = Date.now() + (v.durataSec || 0) * 1000;
            S.tsInizioSerie = S.tsInizioSerie || Date.now();
            await salvaProgresso({ cronoFine: S.cronoFine, tsInizioSerie: S.tsInizioSerie });
            await disegna();
          }),
        },
        `Avvia · ${durataScritta(v.durataSec || 0)}`
      ),
    ];
  }

  const fine = h("button.btn", {}, "Fine");
  fine.onclick = azione(async () => {
    const restanti = Math.max(0, (S.cronoFine - Date.now()) / 1000);
    const tenuti = Math.max(0, (v.durataSec || 0) - restanti);
    fermaAllarme();
    fermaTimer();
    S.cronoFine = null;
    await salvaProgresso({ cronoFine: null });
    await completaSerie(v, def, n, tenuti);
  });
  return [fine];
}

function sezione(titolo, voci, tag = "ul") {
  return h("section", h("h3", titolo), h(tag, ...voci.map((x) => h("li", x))));
}

/** Anteprima cliccabile: il player si carica solo se lo chiedi. */
function riquadroVideo(def) {
  const { id, titolo, canale } = def.video;
  const box = h("div");

  const apri = () => {
    clear(riquadro).append(
      h("iframe", {
        src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`,
        title: titolo || def.nome,
        allow: "accelerometer; autoplay; encrypted-media; picture-in-picture",
        allowfullscreen: true,
        loading: "lazy",
      })
    );
  };

  // La copertina vera del video, scaricata una volta sola.
  //
  // Per un periodo è stata disegnata dall'app: l'anteprima di YouTube parte da
  // `i.ytimg.com`, e caricarla a ogni scheda voleva dire dire a Google, ogni
  // volta, quale esercizio stavi facendo. Ma un rettangolo nero non dice cosa
  // stai per guardare, e in palestra quella miniatura serve.
  //
  // La via di mezzo: si scarica **una volta per video** e si tiene
  // nell'archivio (`store.scaricaCopertina`). Da lì in poi zero richieste, e la
  // copertina c'è anche senza rete — che è il caso in cui il rettangolo nero
  // dava più fastidio. Finché non arriva, e se non arriva mai, resta la
  // copertina disegnata con su scritto dove va a prenderlo.
  const verticale = Boolean(def.video?.verticale);
  // Titolo e canale stanno già nella riga qui sotto, insieme a «Cambia»:
  // ripeterli qui sopra era la stessa cosa scritta due volte a due centimetri
  // di distanza. Sulla copertina resta l'unica cosa che lì sotto non c'è, ed è
  // quella che serve prima di toccare: dove va a prenderlo.
  const copertina = h("span.copertina", h("span.dove", "si apre su YouTube"));

  const riquadro = h(
    verticale ? "button.video.verticale" : "button.video",
    { onclick: apri, "aria-label": `Riproduci: ${titolo || def.nome}` },
    copertina,
    h("span.play", h("span", "▶"))
  );

  // La miniatura arriva quando arriva: se il riquadro nel frattempo è stato
  // sostituito (esercizio cambiato, player aperto) non si tocca più niente.
  store
    .scaricaCopertina(id)
    .then((immagine) => {
      if (!immagine || !copertina.isConnected) return;
      copertina.style.backgroundImage = `url("${immagine}")`;
      copertina.classList.add("con-foto");
    })
    .catch(() => {
      /* resta quella disegnata */
    });

  box.append(
    riquadro,
    h(
      "div.video-meta",
      h("span", `${titolo || "Video"} · ${canale || "YouTube"}`),
      h(
        "button",
        {
          onclick: (e) => {
            e.stopPropagation();
            cambiaVideo(def);
          },
        },
        "Cambia"
      )
    )
  );
  return box;
}

/**
 * Sostituzione del video, salvata sul dispositivo.
 *
 * Due strade, perché i video vengono da due posti diversi: quelli degli
 * esercizi stanno nella libreria e si scrivono lì; quelli di mobilità e
 * stretching arrivano dal file del protocollo e non hanno un id, quindi si
 * salvano a parte, per nome del passaggio. Prima passavano tutti dalla prima
 * strada: sui passaggi del riscaldamento «Salva» falliva in silenzio, il
 * pannello restava aperto e non veniva scritto niente.
 */
async function cambiaVideo(def) {
  const personalizzato = def.id
    ? Boolean(def.videoPersonalizzato)
    : Boolean(store.videoPassoPersonalizzato?.(def.nome));
  await sheet((close) => {
    const campo = h("textarea.note", {
      placeholder: "Incolla qui il link YouTube del video che preferisci",
      style: "min-height:60px",
    });
    return h(
      "div",
      h("h2", "Cambia video"),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
        `${def.nome} — attuale: ${def.video?.titolo || "nessuno"}.`
      ),
      campo,
      // Un video sbagliato dev'essere disfacibile. Prima l'unico modo di
      // togliere un link incollato male era incollarne un altro: quello di
      // partenza non tornava più, e restava lì per sempre.
      personalizzato
        ? h(
            "p",
            { style: "margin:8px 16px 0;color:var(--label-secondary);font-size:13px" },
            "Lascia il campo vuoto e tocca Salva per rimettere il video di partenza."
          )
        : null,
      h(
        "div.btn-wrap",
        h(
          "button.btn",
          {
            onclick: async () => {
              const vuoto = !campo.value.trim();
              if (vuoto && !personalizzato) {
                toast("Link non riconosciuto: serve un indirizzo YouTube.");
                return;
              }
              const m = vuoto ? null : campo.value.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
              if (!vuoto && !m) {
                toast("Link non riconosciuto: serve un indirizzo YouTube.");
                return;
              }
              const video = vuoto ? null : { id: m[1], titolo: "Video scelto da te", canale: "YouTube" };
              try {
                if (def.id) {
                  if (vuoto) {
                    // Si toglie la scelta personale e si ricarica dal file: il
                    // video di libreria torna da solo, senza doverlo conoscere.
                    const { video: _v, videoPersonalizzato: _p, ...pulito } = def;
                    await store.db.put("esercizi", pulito);
                  } else {
                    await store.db.put("esercizi", { ...def, video, videoPersonalizzato: true });
                  }
                  await store.ricaricaLibreria();
                } else {
                  await store.cambiaVideoPasso(def.nome, video);
                }
              } catch (e) {
                // Meglio dirlo che lasciare il pannello aperto come se il tocco
                // non fosse arrivato.
                toast("Non sono riuscito a salvare il video: " + e.message, 5000);
                return;
              }
              close();
              await disegna();
              toast(vuoto ? "Rimesso il video di partenza." : "Video sostituito.");
            },
          },
          "Salva"
        )
      )
    );
  });
}

async function modificaCarico(def, inv) {
  const bilanciere = def?.attrezzo === "bilanciere";
  // Un esercizio a corpo libero può avere lo stesso un carico addosso: un disco
  // sulla coscia nelle abduzioni, un manubrio sul bacino nel ponte. Chiamarlo
  // «peso di un singolo manubrio» era sbagliato, e chiamarlo «peso totale
  // bilanciere compreso» pure.
  const conManubri = (def?.attrezzo || "").toLowerCase().includes("manubri");
  const partenza = S.caricoCorrente ?? 0;

  const scelto = await sheet((close) => {
    const campo = h("input", {
      type: "text",
      inputmode: "decimal",
      value: String(partenza).replace(".", ","),
      "aria-label": "Carico totale in chilogrammi",
      style:
        "width:calc(100% - 32px);margin:14px 16px 0;padding:14px 16px;border:0;border-radius:12px;" +
        "background:var(--bg-grouped);font-size:32px;font-weight:700;text-align:center;" +
        "font-variant-numeric:tabular-nums;color:var(--label)",
    });

    // riga d'aiuto ad altezza fissa: se cambiasse altezza sposterebbe i tasti
    const aiuto = h("p", {
      style:
        "margin:10px 16px 0;min-height:34px;font-size:13px;line-height:1.3;" +
        "color:var(--label-secondary);text-align:center",
    });

    const leggi = () => {
      // Campo vuoto NON è zero: `Number("")` fa 0, e un campo lasciato in
      // bianco sarebbe passato per «zero chili» senza che nessuno lo dicesse.
      const t = String(campo.value).replace(",", ".").trim();
      if (t === "") return null;
      const v = Number(t);
      return Number.isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : null;
    };

    const aggiorna = () => {
      const v = leggi();
      if (v === null) {
        aiuto.textContent = "Scrivi un numero, per esempio 22,5";
        return;
      }
      if (conManubri) {
        aiuto.textContent = `${num(v)} kg per manubrio`;
        return;
      }
      if (!bilanciere) {
        aiuto.textContent = `${num(v)} kg aggiunti al corpo libero`;
        return;
      }
      const d = descriviDischi(v, inv);
      aiuto.textContent = d
        ? `Da montare: ${d}`
        : `${num(v)} kg non si compone con i dischi che hai. Puoi salvarlo lo stesso.`;
    };

    // La virgola dimenticata sul tastierino: 17,5 battuto «1750». Veniva preso
    // per buono in silenzio e diventava il carico di lavoro, la storia
    // dell'esercizio, il numero che legge il coach e la base delle proposte.
    // Non si vieta — un carico strano può essere vero — ma si chiede una volta,
    // e solo quando è fuori scala rispetto a quello che l'app stava proponendo.
    // Il massimo che si puo davvero montare con quello che hai in casa: barra
    // piu tutti i dischi. Serve al primissimo carico di un esercizio, quando
    // non c'e nessun numero di partenza con cui confrontarsi — ed era proprio
    // il caso scoperto: «1750» entrava senza una domanda.
    const massimoMontabile = (() => {
      const barra = Number.isFinite(inv?.barra) ? inv.barra : 0;
      const dischi = Object.entries(inv?.dischi || {}).reduce(
        (tot, [peso, quanti]) => tot + Number(peso) * Number(quanti || 0),
        0
      );
      const manubri = Math.max(0, ...(inv?.manubri?.fissi || [0]));
      const tetto = Math.max(barra + dischi, manubri, 0);
      return tetto > 0 ? tetto : null;
    })();

    const fuoriScala = (v) => {
      if (v == null) return null;
      if (partenza > 0) {
        if (v > partenza * 3 && v - partenza >= 20) return true;
        if (v * 3 < partenza && partenza - v >= 20) return true;
        return null;
      }
      // Primo carico in assoluto: l'unico metro e quello che hai in casa.
      if (massimoMontabile && v > massimoMontabile) return "oltre";
      return null;
    };

    const conferma = h("button.btn");
    let inAttesaDiConferma = false;
    const rimettiAPosto = () => {
      inAttesaDiConferma = false;
      conferma.textContent = "Usa questo carico";
      conferma.classList.remove("secondary");
    };
    conferma.onclick = () => {
      const v = leggi();
      if (v === null) {
        toast("Numero non valido.");
        return;
      }
      const strano = fuoriScala(v);
      if (strano && !inAttesaDiConferma) {
        inAttesaDiConferma = true;
        aiuto.textContent =
          strano === "oltre"
            ? `${num(v)} kg: con quello che hai in casa il massimo è ${num(massimoMontabile)} kg. Se è giusto, tocca ancora.`
            : `${num(v)} kg: prima erano ${num(partenza)}. Se è giusto, tocca ancora.`;
        conferma.textContent = `Sì, ${num(v)} kg`;
        conferma.classList.add("secondary");
        return;
      }
      close(v);
    };

    // Se il numero cambia, la conferma appena chiesta non vale più: si riparte.
    campo.addEventListener("input", () => {
      rimettiAPosto();
      aggiorna();
    });
    rimettiAPosto();
    setTimeout(aggiorna, 0);

    return h(
      "div",
      h("h2", "Carico"),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
        bilanciere
          ? "Peso totale, bilanciere compreso."
          : conManubri
            ? "Peso di un singolo manubrio."
            : "Peso che tieni addosso o in mano."
      ),
      campo,
      aiuto,
      h("div.btn-wrap", conferma)
    );
  });

  if (scelto === undefined || scelto === null) return;
  S.caricoCorrente = scelto;
  // Il carico scelto va scritto subito: restava solo in memoria, e se l'app
  // ripartiva fra una serie e l'altra la serie dopo veniva registrata con il
  // carico vecchio, senza che niente lo dicesse.
  await salvaProgresso({ caricoCorrente: scelto });
  await disegna();
}

/**
 * Il carico corrente si scrive sempre anche nella seduta: correggerlo durante
 * il recupero lo cambiava solo in memoria, e dopo un riavvio la serie dopo
 * tornava al carico di prima.
 */
async function impostaCarico(carico) {
  S.caricoCorrente = carico;
  await salvaProgresso({ caricoCorrente: carico });
}

/**
 * Il passo del selettore del carico, secondo l'attrezzo: il bilanciere e i
 * manubri regolabili si muovono sui pesi davvero montabili, tutto il resto di
 * un chilo alla volta. Serviva in tre punti diversi e in due erano rimasti
 * passi da un chilo anche sul bilanciere.
 */
function passoCarico(carico, verso, def, inv) {
  const attrezzo = (def?.attrezzo || "").toLowerCase();
  if (attrezzo === "bilanciere") return carichoPiuVicino(carico, verso, inv);
  if (attrezzo.includes("manubri") && conosceManubri(inv, aPaio(def))) {
    return manubrioPiuVicino(carico, verso, inv, aPaio(def));
  }
  return verso > 0 ? carico + 1 : Math.max(0, carico - 1);
}

async function completaSerie(v, def, numero, secondiTenuti = null) {
  // Il bersaglio è il fondo del range, non il tetto: «8-10» chiede 8, e chi ne
  // fa 8 ha fatto il suo lavoro. Prima veniva registrato 10 — cioè il massimo,
  // che non avevi detto di aver fatto — e il punteggio ti giudicava contro
  // quello: fare il compito risultava «da rivedere».
  const target = v.aTempo ? v.durataSec : S.obiettivo?.rip ?? v.ripMin ?? v.ripMax;
  // Su un esercizio a tempo i secondi arrivano dal cronometro: quelli tenuti
  // davvero, non quelli previsti. Se il cronometro non c'è stato (serie chiusa
  // a mano) resta il bersaglio, come per le ripetizioni.
  const fatte = secondiTenuti != null ? Math.max(0, Math.round(secondiTenuti)) : target;
  // Dentro un blocco il riposo è uno solo per giro, e cade prima del PRIMO
  // esercizio della coppia: la serie del secondo non ha nessun riposo davanti,
  // e giudicarla contro i due minuti del blocco significava contarle come
  // «recupero saltato» una pausa che il programma non prevede.
  const indiciQui = indiciBlocco();
  const dentroBlocco = indiciQui.length > 1;
  const primoDelBlocco = !dentroBlocco || indiciQui[0] === S.sed.progresso.indice;
  const rec = await store.registraSerie({
    sedutaId: S.sed.id,
    esercizioId: v.esercizioId,
    numero,
    carico: S.caricoCorrente ?? null,
    caricoTarget: S.obiettivo?.carico ?? (v.carico > 0 ? v.carico : null),
    ripFatte: fatte,
    ripTarget: target,
    aTempo: Boolean(v.aTempo),
    tsInizioSerie: S.tsInizioSerie,
    recuperoTargetSec: primoDelBlocco ? recuperoDi() : null,
    misuraDallaSeduta: dentroBlocco,
  });

  const durata = recuperoDi() * 1000;
  S.serieCorrenteId = rec.id;
  S.tsInizioSerie = null;

  // Dopo l'ULTIMA serie la valutazione viene prima, e da sola. Stava insieme al
  // recupero, e il tasto che mandava la valutazione chiudeva anche il riposo:
  // rispondendo si saltava il recupero, che è la parte che conta. Adesso sono
  // due schermate: prima si risponde, poi parte il cronometro con il prossimo
  // esercizio davanti.
  const indici = indiciQui;
  if (indici.length > 1) {
    // Dentro un blocco: se il compagno è indietro di una serie, si va da lui
    // SENZA riposo — è tutto il senso del blocco. Il recupero arriva solo dopo
    // che tutti e due hanno fatto il giro.
    const fatte = await fatteNelBlocco(indici);
    const mio = indici.indexOf(S.sed.progresso.indice);
    const giroMio = fatte[mio];
    const dopo = indici.findIndex((k, j) => j > mio && fatte[j] < giroMio);
    if (dopo >= 0) {
      S.caricoCorrente = null;
      S.obiettivo = null;
      S.tsInizioSerie = Date.now();
      await salvaProgresso({
        fase: "esercizio",
        indice: indici[dopo],
        recuperoFine: null,
        caricoCorrente: null,
        tsInizioSerie: S.tsInizioSerie,
      });
      await disegna();
      return;
    }
    // Giro completo. Restano altri giri? Riposo e si riparte dal primo.
    const giriFatti = Math.min(...fatte);
    const giriPrevisti = Math.max(...indici.map((k) => S.esercizi[k].serie || 0));
    if (giriFatti < giriPrevisti) {
      S.caricoCorrente = null;
      S.obiettivo = null;
      S.recuperoFine = Date.now() + durata;
      await salvaProgresso({
        fase: "recupero",
        indice: indici[0],
        recuperoFine: S.recuperoFine,
        caricoCorrente: null,
        tsInizioSerie: null,
      });
      await disegna();
      return;
    }
    // Blocco finito: si valuta, un esercizio alla volta, partendo dal primo.
    S.recuperoFine = null;
    await salvaProgresso({ fase: "questionario", indice: indici[0], recuperoFine: null, tsInizioSerie: null });
    await disegna();
    return;
  }

  const fatteOra = await serieFatte(v.esercizioId);
  if (fatteOra.length >= v.serie) {
    S.recuperoFine = null;
    await salvaProgresso({ fase: "questionario", recuperoFine: null, tsInizioSerie: null });
    await disegna();
    return;
  }

  S.recuperoFine = Date.now() + durata;
  await salvaProgresso({
    fase: "recupero",
    recuperoFine: S.recuperoFine,
    tsInizioSerie: null,
  });
  await disegna();
}

async function saltaEsercizio(v, def) {
  const nome = def?.nome || v.esercizioId;
  // Dentro un blocco si salta la coppia, non un pezzo solo: l'app va avanti
  // oltre tutto il blocco, e il compagno restava senza nessuna riga — nel
  // riepilogo risultava «mai iniziato», come un dato perso invece di una
  // scelta. Qui viene scritto anche lui, con lo stesso motivo, ma solo se non
  // ha già fatto il suo lavoro.
  const ind = indiciBlocco();
  const compagni = [];
  for (const k of ind) {
    if (k === S.sed.progresso.indice) continue;
    const altro = S.esercizi[k];
    if (!altro) continue;
    const sue = await serieFatte(altro.esercizioId);
    if (sue.length >= (altro.serie || 1)) continue;
    compagni.push({ indice: k, voce: altro, nome: store.esercizio(altro.esercizioId)?.nome || altro.esercizioId });
  }

  const motivo = await chiedi({
    titolo: compagni.length ? `Saltare il blocco?` : `Saltare ${nome}?`,
    testo: compagni.length
      ? `${nome} va in coppia con ${compagni.map((c) => c.nome).join(" e ")}: si saltano insieme. Il motivo distingue una scelta da un buco di dati.`
      : "Il motivo distingue una scelta da un buco di dati.",
    opzioni: [
      { etichetta: "Tempo", valore: "tempo" },
      { etichetta: "Dolore", valore: "dolore" },
      { etichetta: "Attrezzo non disponibile", valore: "attrezzo" },
      { etichetta: "Altro", valore: "altro" },
    ],
  });
  if (!motivo) return;

  const SUGGERIMENTI = {
    tempo: "Es. «finito il tempo prima del quarto esercizio»",
    dolore: "Es. «fitta al polso destro alla seconda serie, sparita a riposo»",
    attrezzo: "Es. «panca occupata, non ho aspettato»",
    altro: "Cos'è successo?",
  };

  // La nota è obbligatoria: fra tre settimane «saltato» senza spiegazione non
  // dice niente, e un esercizio saltato senza motivo è indistinguibile da un
  // dato perso.
  const nota = await sheet((close) => {
    const ta = h("textarea.note", { placeholder: SUGGERIMENTI[motivo], style: "min-height:96px" });
    const conferma = h(
      "button.btn",
      { disabled: true, onclick: () => close(ta.value.trim()) },
      compagni.length ? "Salta il blocco" : "Salta esercizio"
    );
    ta.addEventListener("input", () => {
      conferma.disabled = ta.value.trim().length < 3;
    });
    return h(
      "div",
      h("h2", "Perché lo salti"),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
        "Scrivi cos'è successo: senza, fra tre settimane «saltato» non vorrà dire niente."
      ),
      ta,
      h("div.btn-wrap", conferma)
    );
  });

  // chiuso senza scrivere: l'esercizio non viene saltato
  if (!nota) return;

  await store.registraSalto({
    sedutaId: S.sed.id,
    esercizioId: v.esercizioId,
    ordine: S.sed.progresso.indice,
    motivo,
    nota,
  });
  for (const c of compagni) {
    await store.registraSalto({
      sedutaId: S.sed.id,
      esercizioId: c.voce.esercizioId,
      ordine: c.indice,
      motivo,
      nota: `${nota} (saltato insieme a ${nome}: stesso blocco)`,
    });
  }
  toast(
    compagni.length
      ? `Blocco segnato come non eseguito: ${[nome, ...compagni.map((c) => c.nome)].join(", ")}.`
      : `${nome} segnato come non eseguito.`
  );
  await avanzaEsercizio();
}

async function avanzaEsercizio() {
  const ind = indiciBlocco();
  const prossimo = ind[ind.length - 1] + 1;
  S.caricoCorrente = null;
  S.recuperoFine = null;
  S.tsInizioSerie = null;
  S.obiettivo = null;
  // Il carico appartiene all'esercizio che finisce qui: se restasse scritto,
  // il prossimo partirebbe dal carico di quello precedente.
  if (prossimo >= S.esercizi.length) {
    await salvaProgresso({
      fase: S.sed.cardio?.previsto ? "cardio" : "stretching",
      indice: prossimo,
      caricoCorrente: null,
    });
  } else {
    await salvaProgresso({ fase: "esercizio", indice: prossimo, recuperoFine: null, caricoCorrente: null });
  }
  await disegna();
}

// ---------- recupero ----------

/**
 * Cosa viene dopo l'esercizio appena finito: si mostra durante l'ultimo
 * recupero, per arrivare al prossimo con il bilanciere già montato.
 */
async function bloccoProssimo(inv) {
  const prossima = vocePrevista(S.sed.progresso.indice + 1);

  if (!prossima) {
    // Un cardio già rimandato non è «il prossimo passo»: dirlo lo stesso
    // manderebbe a cercare una schermata che quella strada non apre più.
    const cardioDaFare = S.sed.cardio?.previsto && !S.sed.cardio?.rimandato && !S.sed.cardio?.eseguito;
    const dopo = cardioDaFare ? "il cardio" : "lo stretching";
    return h(
      "div.group",
      h("h2", "Dopo questo"),
      h("div.list", h("div.row", h("div.main", h("span.title", `Finiti i pesi: tocca ${dopo}`)))),
      h("p.footnote", "È l'ultimo esercizio della seduta.")
    );
  }

  const def = store.esercizio(prossima.esercizioId);
  const obiettivo = prossima.aTempo ? null : await store.obiettivoCorrente(prossima.esercizioId);
  const carico =
    obiettivo?.carico ??
    (await store.caricoDaDecisione(prossima.esercizioId)) ??
    (prossima.carico > 0 ? prossima.carico : null) ??
    (await store.ultimoCarico(prossima.esercizioId, prossima.carico ?? null));
  const bersaglio = prossima.aTempo
    ? `${prossima.serie} × ${durataScritta(prossima.durataSec || 0)}`
    : obiettivo?.rip != null
      ? `${prossima.serie} × ${obiettivo.rip}`
      : senzaBersaglio(prossima)
        ? null
        : `${prossima.serie} × ${prossima.ripMin === prossima.ripMax ? prossima.ripMin : `${prossima.ripMin}-${prossima.ripMax}`}`;

  const gruppo = h(
    "div.group",
    h("h2", "Prossimo esercizio"),
    h(
      "div.list",
      h(
        "div.row",
        h("div.main", h("span.title", def?.nome || prossima.esercizioId), h("span.sub", bersaglio)),
        h("span.value", carico != null ? `${num(carico)} kg` : "corpo libero")
      )
    )
  );

  if (carico != null && def?.attrezzo === "bilanciere") {
    const dischi = descriviDischi(carico, inv);
    aggiungi(gruppo,
      h(
        "div.plates",
        h("span.etichetta", "Da montare"),
        dischi
          ? h("b", dischi)
          : h(
              "span",
              `carico non componibile: con i tuoi dischi i più vicini sono ` +
                `${num(carichoPiuVicino(carico, -1, inv))} e ${num(carichoPiuVicino(carico, 1, inv))} kg`
            )
      )
    );
  }

  if (obiettivo?.titolo) aggiungi(gruppo, h("p.footnote", `Proposta accettata: ${obiettivo.titolo}`));
  if (def?.video?.id) aggiungi(gruppo, riquadroVideo(def));

  return gruppo;
}

async function vistaRecupero(corpo, piede) {
  const v = vocePrevista();
  const def = store.esercizio(v.esercizioId);
  const fatte = await serieFatte(v.esercizioId);
  const ultima = fatte.at(-1);
  // Riletto invece che dato per scontato: se l'app riparte a metà recupero,
  // S è nuovo di zecca e l'obiettivo accettato non deve sparire dallo schermo.
  S.obiettivo = v.aTempo ? null : await store.obiettivoCorrente(v.esercizioId);
  // Il fondo del range, come in `completaSerie` e nel questionario: qui era
  // il tetto, e la stessa parola voleva dire due cose diverse in tre punti
  // dello stesso file. Conta solo quando la serie non ha `ripFatte`, ma è
  // esattamente il caso in cui un numero sbagliato non si nota.
  const bersaglio = v.aTempo ? v.durataSec : S.obiettivo?.rip ?? v.ripMin ?? v.ripMax;
  const inv = await store.inventario();

  const testoTimer = h("p.timer", "--:--");
  const CIRC = 2 * Math.PI * 100;
  const anello = h("circle.prog", {
    cx: 108, cy: 108, r: 100,
    style: `stroke-dasharray:${CIRC};stroke-dashoffset:0`,
  });
  const quadrante = h(
    "div.timer-wrap",
    h(
      "svg.timer-ring",
      { viewBox: "0 0 216 216" },
      h("circle.track", { cx: 108, cy: 108, r: 100 }),
      anello
    ),
    testoTimer
  );
  // Questo riposo porta al prossimo esercizio o a un altro giro dello stesso?
  // Lo dice una cosa sola: se quello che stai facendo è già stato valutato,
  // allora è finito e si va avanti. Contare le serie non basta dentro un
  // blocco — una coppia con giri diversi faceva saltare oltre il compagno
  // rimasto indietro — e nemmeno guardare solo il blocco, perché anche il
  // riposo che segue le valutazioni cade su un indice del blocco.
  const ind = indiciBlocco();
  const logsOra = await store.questionariDi(S.sed.id);
  const valutato = (k) =>
    logsOra.some((l) => l.esercizioId === S.esercizi[k]?.esercizioId && !l.saltato);
  const ultimaSerie = ind.every(valutato) || (ind.length === 1 && fatte.length >= v.serie);
  const dentroBlocco = ind.length > 1 && !ultimaSerie;
  const sottotitolo = h(
    "p.target",
    ultimaSerie
      ? "Esercizio finito: riposa prima del prossimo"
      : dentroBlocco
        ? `Poi si ricomincia il blocco: giro ${Math.min(fatte.length + 1, v.serie)} di ${v.serie}`
        : `Prossima: serie ${fatte.length + 1} di ${v.serie}`
  );
  // Il modo per zittire l'allarme restando sul recupero. Prima la memoria
  // «suonoSpento» c'era, con tanto di commento che spiegava come funzionava,
  // ma non la metteva a vero nessuno: l'unico modo di fermare il suono era
  // «Pronto», che però chiude il riposo. In palestra capita di non essere
  // pronti quando suona, e l'allarme restava lì a suonare.
  const notaSuono = h("p.footnote", { style: "margin:6px 16px 0;text-align:center" }, "");
  aggiungi(corpo, h("div.hero", h("p.kicker", "Recupero"), quadrante, sottotitolo, notaSuono));

  // Campi della serie appena chiusa — ma SOLO fra una serie e l'altra.
  //
  // Quando l'esercizio è finito questo riposo serve a un'altra cosa: il
  // cronometro e il prossimo esercizio da preparare. Le sue serie si correggono
  // nella scheda di valutazione, che viene prima e le mostra tutte; rimetterle
  // qui vuol dire chiedere di sistemare una cosa già sistemata, in una pagina
  // che parla del prossimo esercizio.
  // Dentro un blocco il giro chiude DUE serie, una per esercizio, e il riposo
  // arriva solo alla fine del giro. Qui si mostrava una sola riga — quella
  // dell'esercizio che riparte per primo — chiamandola «appena chiusa»: era
  // falso (l'ultima chiusa era quella del compagno) e l'altra serie restava
  // correggibile solo alla fine dell'esercizio. Adesso ci sono tutte e due,
  // ognuna col suo nome.
  const daCorreggere = [];
  for (const k of ind) {
    const voce = S.esercizi[k];
    if (!voce) continue;
    const serieSue = k === S.indice ? fatte : await serieFatte(voce.esercizioId);
    const suUltima = serieSue.at(-1);
    if (!suUltima) continue;
    daCorreggere.push({ voce, def: store.esercizio(voce.esercizioId), serie: suUltima, numero: suUltima.numero ?? serieSue.length });
  }

  const campiDi = ({ voce, def: sudDef, serie: sua, numero }) => {
    const conNome = daCorreggere.length > 1;
    const mioBersaglio = voce.aTempo
      ? voce.durataSec
      : (voce.esercizioId === v.esercizioId ? S.obiettivo?.rip : null) ?? voce.ripMin ?? voce.ripMax;
    let mioRip = sua.ripFatte ?? mioBersaglio;
    let mioCarico = sua.carico ?? null;
    const valR = h("span.val", `${mioRip}${voce.aTempo ? "s" : ""}`);
    const valC = h("span.val", mioCarico != null ? `${num(mioCarico)} kg` : "—");
    // Rileggere prima di scrivere: partendo dalla copia caricata al disegno, la
    // seconda correzione riscriveva sopra la prima e la cancellava.
    const salvaSua = (patch) => store.aggiornaSerie(sua.id, patch);
    const etichetta = (testo) => (conNome ? `${sudDef?.nome || voce.esercizioId} · ${testo.toLowerCase()}` : testo);
    return [
      h(
        "div.field",
        h("label", etichetta(voce.aTempo ? "Secondi tenuti" : "Ripetizioni fatte")),
        h(
          "div.stepper",
          h("button", { "aria-label": voce.aTempo ? "meno 5 secondi" : "una ripetizione in meno", onclick: async () => { mioRip = Math.max(0, mioRip - (voce.aTempo ? 5 : 1)); valR.textContent = `${mioRip}${voce.aTempo ? "s" : ""}`; await salvaSua({ ripFatte: mioRip }); } }, "−"),
          valR,
          h("button", { "aria-label": voce.aTempo ? "più 5 secondi" : "una ripetizione in più", onclick: async () => { mioRip = Math.min(voce.aTempo ? 3600 : 200, mioRip + (voce.aTempo ? 5 : 1)); valR.textContent = `${mioRip}${voce.aTempo ? "s" : ""}`; await salvaSua({ ripFatte: mioRip }); } }, "+")
        )
      ),
      mioCarico != null
        ? h(
            "div.field",
            h("label", etichetta("Carico usato")),
            h(
              "div.stepper",
              h("button", { "aria-label": "carico più basso", onclick: async () => { mioCarico = passoCarico(mioCarico, -1, sudDef, inv); valC.textContent = `${num(mioCarico)} kg`; if (voce.esercizioId === v.esercizioId) await impostaCarico(mioCarico); await salvaSua({ carico: mioCarico }); } }, "−"),
              valC,
              h("button", { "aria-label": "carico più alto", onclick: async () => { mioCarico = passoCarico(mioCarico, 1, sudDef, inv); valC.textContent = `${num(mioCarico)} kg`; if (voce.esercizioId === v.esercizioId) await impostaCarico(mioCarico); await salvaSua({ carico: mioCarico }); } }, "+")
            )
          )
        : null,
    ];
  };

  if (!ultimaSerie && daCorreggere.length) aggiungi(corpo,
    h(
      "div.group",
      h(
        "h2",
        daCorreggere.length > 1
          ? `Giro ${daCorreggere[0].numero} appena chiuso`
          : `Serie ${daCorreggere[0].numero} appena chiusa`
      ),
      h("div.list", ...daCorreggere.flatMap(campiDi)),
      h("p.footnote", "I valori sono precompilati con l'obiettivo: correggili solo se hai fatto altro.")
    )
  );

  // Dopo l'ultima serie qui c'è solo il riposo, con il prossimo esercizio già
  // in vista. Le domande sono state fatte prima, in una schermata loro: stando
  // insieme al cronometro, il tasto che mandava le risposte chiudeva anche il
  // recupero, e rispondendo si finiva per saltare il riposo — che è la parte
  // che conta.
  const pulsante = h(
    "button.btn",
    { onclick: azione(ultimaSerie ? avanzaEsercizio : chiudiRecupero) },
    "Pronto"
  );
  if (ultimaSerie) aggiungi(corpo, await bloccoProssimo(inv));
  aggiungiPiede(piede, 
    h(
      "div",
      { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px" },
      h("button.btn.secondary", { onclick: () => spostaTimer(-15) }, "−15 s"),
      h("button.btn.secondary", { onclick: () => spostaTimer(15) }, "+15 s")
    ),
    pulsante
  );

  const totale = (ultima?.recuperoTargetSec || recuperoDi()) * 1000;

  let preavvisoFatto = false;
  // Una volta zittito, il suono non riparte da solo: il controllo gira ogni
  // 250 ms e senza questa memoria lo farebbe ripartire subito dopo averlo
  // spento, cioè renderebbe il bottone inutile.
  let suonoSpento = false;
  const zittisci = () => {
    if (!allarmeAttivo()) return;
    suonoSpento = true;
    fermaAllarme();
    notaSuono.textContent = "Suono fermato. Il recupero continua a contare.";
  };
  quadrante.setAttribute("role", "button");
  quadrante.setAttribute("tabindex", "0");
  quadrante.setAttribute("aria-label", "Ferma il suono senza chiudere il recupero");
  quadrante.style.cursor = "pointer";
  quadrante.addEventListener("click", zittisci);
  quadrante.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      zittisci();
    }
  });
  const aggiorna = () => {
    if (!S.recuperoFine) return;
    const restanti = (S.recuperoFine - Date.now()) / 1000;
    if (restanti > 3.5) {
      preavvisoFatto = false; // il timer è stato allungato
      suonoSpento = false;
      if (notaSuono.textContent) notaSuono.textContent = "";
    }
    const quota = Math.max(0, Math.min(1, (restanti * 1000) / totale));
    anello.style.strokeDashoffset = String(CIRC * (1 - quota));

    if (restanti > 0) {
      testoTimer.textContent = mmss(restanti);
      quadrante.classList.remove("done");
      testoTimer.classList.remove("done");
      // Il preavviso suona una volta sola quando si scende sotto i 3 secondi.
      // Prima doveva capitare che un controllo cadesse esattamente in una
      // finestra di un decimo di secondo: quasi sempre non suonava.
      if (restanti <= 3 && !preavvisoFatto) {
        preavvisoFatto = true;
        tick();
      }
      pulsante.textContent = "Pronto";
    } else {
      testoTimer.textContent = "00:00";
      quadrante.classList.add("done");
      testoTimer.classList.add("done");
      if (!allarmeAttivo() && !suonoSpento) {
        avviaAllarme();
        notaSuono.textContent = "Tocca il cerchio per fermare il suono senza chiudere il recupero.";
      }
      pulsante.textContent = "Pronto · ferma il suono";
    }
  };
  aggiorna();
  S.timerHandle = setInterval(aggiorna, 250);
}

function spostaTimer(sec) {
  if (!S.recuperoFine) return;
  // Se il tempo è già scaduto, «+15 s» deve dare quindici secondi da adesso:
  // sommarli a un istante passato lasciava il pulsante morto.
  const base = Math.max(S.recuperoFine, sec > 0 ? Date.now() : 0);
  S.recuperoFine = Math.max(Date.now(), base + sec * 1000);
  if (S.recuperoFine > Date.now()) {
    fermaAllarme();
    }
  salvaProgresso({ recuperoFine: S.recuperoFine });
}

async function chiudiRecupero() {
  fermaTimer();
  // Un recupero durato molto più del previsto è quasi sempre una pausa vera
  // (telefono in tasca, chiacchiere): registrarlo com'è falserebbe la media
  // dei recuperi e la densità dell'allenamento.
  const ultima = (await store.serieDi(S.sed.id)).at(-1);
  // Dentro un blocco la serie appena chiusa non porta un riposo previsto — ce
  // l'ha il giro, non lei — quindi il riferimento è quello del blocco.
  const target = (ultima?.recuperoTargetSec || recuperoDi()) * 1000;
  const passato = ultima?.tsFineSerie ? Date.now() - ultima.tsFineSerie : 0;
  if (ultima && passato > target + 10 * 60000) {
    const scelta = await chiedi({
      titolo: "Quanto è durato il recupero?",
      testo: `Dall'ultima serie sono passati ${durataUmana(passato / 1000)}, ma erano previsti ${mmss(target / 1000)}. Se hai fatto una pausa vera, registriamo il previsto invece del tempo dell'orologio.`,
      opzioni: [
        { etichetta: `${mmss(target / 1000)}, come previsto`, valore: "previsto" },
        { etichetta: "Registra il tempo davvero passato", valore: "reale" },
      ],
    });
    // Solo una scelta esplicita cambia il dato: annullando la domanda (tocco
    // fuori dal pannello) non si tocca niente e la si rifà alla prossima.
    if (scelta === "previsto") {
      await store.aggiornaSerie(ultima.id, { tsFineSerie: Date.now() - target });
    }
  }
  S.tsInizioSerie = Date.now();
  S.recuperoFine = null;
  await salvaProgresso({ fase: "esercizio", recuperoFine: null, tsInizioSerie: S.tsInizioSerie });
  await disegna();
}

// ---------- questionario ----------

async function vistaQuestionario(corpo, piede) {
  const v = vocePrevista();
  const def = store.esercizio(v.esercizioId);
  // Servono alla correzione dell'ultima serie: i passi del carico devono
  // essere quelli montabili davvero, come nella schermata di recupero.
  const invQui = await store.inventario();

  // Se questo esercizio è già stato valutato (si torna indietro dal riepilogo,
  // o l'app è ripartita), il questionario riparte da quello che avevi scritto:
  // prima era vuoto, e confermarlo cancellava nota e risposte già date.
  const gia = (await store.questionariDi(S.sed.id)).find((l) => l.esercizioId === v.esercizioId && !l.saltato) || null;
  // I punti dolenti da chiedere li dice il brief: uno, due o nessuno, ognuno
  // con la sua domanda. Se il questionario era già stato compilato le risposte
  // tornano su come le avevi lasciate, punto per punto.
  const siti = store.sitiDolore();
  const giaDolori = gia ? store.doloriDi(gia) : [];
  const stato = {
    rpe: gia?.rpe ?? null,
    tecnica: gia?.tecnica ?? null,
    dolori: new Map(
      siti.map((s) => {
        const d = giaDolori.find((x) => x.id === s.id) || null;
        // Nessuna risposta è diverso da «no»: senza questa distinzione il
        // questionario risulterebbe già completo appena aperto.
        if (d) return [s.id, { c: true, quando: d.quando, intensita: d.intensita }];
        return [s.id, { c: gia ? false : null, quando: null, intensita: null }];
      })
    ),
  };

  const RIR = {
    10: "non ne avevo più nessuna",
    9: "ne avevo ancora 1",
    8: "ne avevo ancora 2",
    7: "ne avevo ancora 3",
    6: "ne avevo ancora 4",
    5: "ne avevo ancora 5 o più",
  };

  const hintRpe = h("p.scale-hint", "");
  const hintTec = h("p.scale-hint", "");
  const avanti = h("button.btn", { disabled: true, onclick: azione(conferma) }, "Avanti al recupero");
  // Un bottone spento senza spiegazione, a metà allenamento, è una trappola:
  // premi e non succede niente. Il commento sotto al punteggio parla solo di
  // intensità e tecnica, quindi rispondendo a quelle spariva anche l'unico
  // indizio e restavano fuori le domande sul dolore. Qui c'è sempre scritto
  // cosa manca, con le parole delle domande.
  const mancano = h("p.footnote", { style: "margin:0 0 8px;text-align:center" }, "");

  const verifica = () => {
    const manca = [];
    if (stato.rpe == null) manca.push("quanto è stata dura");
    if (stato.tecnica == null) manca.push("com'è andata la tecnica");
    for (const s of siti) {
      const d = stato.dolori.get(s.id);
      if (d.c == null) manca.push(`il dolore (${s.nome})`);
      else if (d.c === true) {
        if (!d.quando) manca.push(`quando faceva male ${s.nome}`);
        if (!d.intensita) manca.push(`quanto faceva male ${s.nome}`);
      }
    }
    avanti.disabled = manca.length > 0;
    mancano.textContent = manca.length
      ? `Manca ancora: ${manca.join(", ")}.`
      : "";
    mancano.style.display = manca.length ? "block" : "none";
  };

  const righello = (onPick, zona, scelto = null) => {
    const box = h("div.scale");
    for (let i = 1; i <= 10; i++) {
      const b = h(
        "button",
        {
          "aria-pressed": i === scelto ? "true" : "false",
          class: zona && i >= zona[0] && i <= zona[1] ? "target-zone" : "",
          onclick: () => {
            for (const x of box.children) x.setAttribute("aria-pressed", "false");
            b.setAttribute("aria-pressed", "true");
            onPick(i);
            verifica();
            ridisegnaPunteggio();
          },
        },
        String(i)
      );
      box.append(b);
    }
    return box;
  };

  const zona = store.regole().rpeTarget;

  const serieFatteQui = await serieFatte(v.esercizioId);
  const regoleOra = store.regole();
  const zonaPunteggio = h("div", { style: "padding:4px 0 2px" });
  const zonaDettaglio = h("div");

  const doloriSegnati = () =>
    siti
      .filter((s) => stato.dolori.get(s.id)?.c === true)
      .map((s) => ({ id: s.id, nome: s.nome, ...stato.dolori.get(s.id) }));

  const calcolaPunteggio = () =>
    punteggioEsercizio({
      variante: v,
      serie: serieFatteQui,
      rpe: stato.rpe,
      tecnica: stato.tecnica,
      dolori: doloriSegnati(),
      regole: regoleOra,
    });

  // Il punteggio è diviso in due: sopra l'anello, che ha sempre la stessa
  // altezza, sotto le spiegazioni, che cambiano secondo le risposte. Prima
  // stava tutto sopra i righelli: ogni tocco allungava le spiegazioni e il
  // righello dopo si spostava via da sotto il dito.
  const ridisegnaPunteggio = () => {
    const r = calcolaPunteggio();
    clear(zonaPunteggio);
    aggiungi(zonaPunteggio, anello(r.totale), legendaPunteggio());
    clear(zonaDettaglio);
    aggiungi(zonaDettaglio,
      h(
        "p",
        { style: "margin:12px 16px 0;text-align:center;font-size:13px;color:var(--label-secondary);line-height:1.35" },
        commento(r, def?.nome || v.esercizioId)
      ),
      h("div.group", { style: "margin-top:14px" }, scomposizione(r))
    );
  };

  // TUTTE le serie dell'esercizio, non solo l'ultima.
  //
  // Prima si poteva correggere soltanto quella appena chiusa: le altre erano
  // passate dalla schermata di recupero e lì restavano. Ma un paio di
  // ripetizioni in più te ne accorgi dopo, quando riprendi fiato, e questa è
  // l'ultima schermata in cui l'esercizio è ancora sotto gli occhi: se non si
  // può correggere qui, nel log del coach resta un numero sbagliato per sempre.
  const correzione = h("div");
  if (serieFatteQui.length) {
    const salvaSerie = async (id, patch) => {
      const agg = await store.aggiornaSerie(id, patch);
      if (!agg) return;
      const i = serieFatteQui.findIndex((x) => x.id === id);
      if (i >= 0) serieFatteQui[i] = agg;
      ridisegnaPunteggio();
    };

    // Un righello per ogni serie: quello delle ripetizioni e, dove il carico
    // c'è, quello del carico. I passi sono gli stessi della schermata di
    // recupero, così correggere qui o correggere lì è lo stesso gesto.
    const righelli = serieFatteQui.flatMap((s, idx) => {
      const numeroSerie = s.numero ?? idx + 1;
      const ultima = idx === serieFatteQui.length - 1;
      // Con una sola serie il titolo del gruppo dice già tutto: ripetere
      // «Serie 1 · appena chiusa» su ogni righello sarebbe solo rumore.
      const sola = serieFatteQui.length === 1;
      const quale = sola ? "" : `Serie ${numeroSerie}${ultima ? " · appena chiusa" : ""}`;
      const etichetta = (testo) => (sola ? `${testo[0].toUpperCase()}${testo.slice(1)}` : `${quale} · ${testo}`);
      let rip = s.ripFatte ?? (v.aTempo ? v.durataSec : v.ripMin ?? v.ripMax);
      let carico = s.carico ?? null;
      const valRip = h("span.val", `${rip}${v.aTempo ? "s" : ""}`);
      const valCar = h("span.val", carico != null ? `${num(carico)} kg` : "—");
      const passoRip = async (verso) => {
        // Un tetto largo, ma un tetto: il carico ce l'ha (l'inventario), le
        // ripetizioni no, e con il dito fermo sul «+» si arrivava a numeri che
        // nessuno ha mai fatto.
        const passo = v.aTempo ? 5 : 1;
        rip = verso > 0 ? Math.min(v.aTempo ? 3600 : 200, rip + passo) : Math.max(0, rip - passo);
        valRip.textContent = `${rip}${v.aTempo ? "s" : ""}`;
        await salvaSerie(s.id, { ripFatte: rip });
      };
      const passoCar = async (verso) => {
        // Prima qui si andava di mezzo chilo alla volta e senza tetto: con
        // dischi da 1,25 il passo più piccolo montabile è 2,5 kg, e si finiva
        // per registrare 70,5 kg, un carico che non esiste in casa.
        carico = passoCarico(carico, verso, def, invQui);
        valCar.textContent = `${num(carico)} kg`;
        await salvaSerie(s.id, { carico });
      };
      return [
        h(
          "div.field",
          h("label", etichetta(v.aTempo ? "secondi tenuti" : "ripetizioni fatte")),
          h(
            "div.stepper",
            h("button", { "aria-label": etichetta("una in meno"), onclick: () => passoRip(-1) }, "−"),
            valRip,
            h("button", { "aria-label": etichetta("una in più"), onclick: () => passoRip(1) }, "+")
          )
        ),
        carico != null
          ? h(
              "div.field",
              h("label", etichetta("carico usato")),
              h(
                "div.stepper",
                h("button", { "aria-label": etichetta("carico più basso"), onclick: () => passoCar(-1) }, "−"),
                valCar,
                h("button", { "aria-label": etichetta("carico più alto"), onclick: () => passoCar(1) }, "+")
              )
            )
          : null,
      ];
    });

    aggiungi(correzione,
      h(
        "div.group",
        h("h2", serieFatteQui.length === 1 ? "La serie appena chiusa" : "Le serie di questo esercizio"),
        h("div.list", ...righelli),
        h(
          "p.footnote",
          serieFatteQui.length === 1
            ? "Correggi solo se è andata diversamente dal previsto."
            : "Qui si correggono tutte, non solo l'ultima: è l'ultimo momento in cui questo esercizio è ancora aperto. Il punteggio qui sopra si aggiorna a ogni tocco."
        )
      )
    );
  }

  // Una sezione per ogni punto dolente dichiarato dal brief: domanda, sì/no e,
  // solo se la risposta è sì, quando e quanto. Sono indipendenti fra loro:
  // rispondere di uno non tocca l'altro.
  const blocchiDolore = siti.flatMap((s) => {
    const d = stato.dolori.get(s.id);
    const dettaglio = h("div");
    const sollecita = s.flagEsercizio && def?.[s.flagEsercizio];
    const mostraDettaglio = () => {
      const premuto = (campo, valore) => (d[campo] === valore ? "true" : "false");
      clear(dettaglio);
      dettaglio.append(
        h(
          "div.segmented",
          h("button", { "aria-pressed": premuto("quando", "durante"), onclick: (ev) => pick(ev, d, "quando", "durante") }, "Durante"),
          h("button", { "aria-pressed": premuto("quando", "dopo"), onclick: (ev) => pick(ev, d, "quando", "dopo") }, "Dopo")
        ),
        h(
          "div.segmented",
          h("button", { "aria-pressed": premuto("intensita", "lieve"), onclick: (ev) => pick(ev, d, "intensita", "lieve") }, "Lieve"),
          h("button", { "aria-pressed": premuto("intensita", "medio"), onclick: (ev) => pick(ev, d, "intensita", "medio") }, "Medio"),
          h("button", { "aria-pressed": premuto("intensita", "forte"), onclick: (ev) => pick(ev, d, "intensita", "forte") }, "Forte")
        )
      );
    };
    const setC = (e, valore) => {
      const gruppo = e.target.parentElement;
      for (const b of gruppo.children) b.setAttribute("aria-pressed", "false");
      e.target.setAttribute("aria-pressed", "true");
      d.c = valore;
      ridisegnaPunteggio();
      clear(dettaglio);
      if (valore) {
        d.quando = null;
        d.intensita = null;
        mostraDettaglio();
      }
      verifica();
    };
    // Se era già segnato, i dettagli devono ricomparire senza toccare niente,
    // altrimenti «Avanti» resterebbe spento con le risposte già date.
    if (d.c === true) mostraDettaglio();
    return [
      h("p.footnote", { style: "margin:22px 16px 0" }, `${s.domanda || `Dolore ${conArticolo(s.nome)}?`}${sollecita ? " (esercizio che lo sollecita)" : ""}`),
      h(
        "div.segmented.danger",
        h("button", { "aria-pressed": d.c === false ? "true" : "false", onclick: (e) => setC(e, false) }, "NO"),
        h("button", { "aria-pressed": d.c === true ? "true" : "false", onclick: (e) => setC(e, true) }, "SÌ")
      ),
      dettaglio,
    ];
  });

  aggiungi(corpo,
    h("div.hero", { style: "padding-bottom:2px" }, h("p.kicker", "Fine esercizio"), h("h2", def?.nome || v.esercizioId)),
    zonaPunteggio,
    correzione,

    h("p.footnote", { style: "margin:14px 16px 0" }, "Quanto è stata dura l'ultima serie?"),
    righello(
      (i) => {
        stato.rpe = i;
        hintRpe.textContent = RIR[i] || "molto lontano dal limite";
      },
      [zona.min, zona.max],
      stato.rpe
    ),
    hintRpe,
    h("p.footnote", { style: "margin:6px 16px 0;text-align:center" }, `Zona prevista dal programma: ${zona.min}-${zona.max}`),

    h("p.footnote", { style: "margin:22px 16px 0" }, "Com'è andata la tecnica?"),
    righello(
      (i) => {
        stato.tecnica = i;
        hintTec.textContent =
          i >= 8 ? "pulita" : i >= 5 ? "qualche cedimento" : "tecnica insufficiente";
      },
      null,
      stato.tecnica
    ),
    hintTec,

    ...blocchiDolore,

    h("p.footnote", { style: "margin:22px 16px 0" }, "Nota (facoltativa — vuota significa nessun segnale)"),
    h("textarea.note", {
      id: "nota-es",
      placeholder: "Solo se c'è qualcosa da segnalare",
      value: gia?.nota || "",
    }),
    zonaDettaglio
  );

  aggiungiPiede(piede, mancano, avanti);
  verifica();
  ridisegnaPunteggio();

  function pick(ev, dove, campo, valore) {
    const gruppo = ev.target.parentElement;
    for (const b of gruppo.children) b.setAttribute("aria-pressed", "false");
    ev.target.setAttribute("aria-pressed", "true");
    dove[campo] = valore;
    verifica();
    ridisegnaPunteggio();
  }

  async function conferma() {
    const r = calcolaPunteggio();
    await store.registraQuestionario({
      punteggio: r.totale,
      sedutaId: S.sed.id,
      esercizioId: v.esercizioId,
      ordine: S.sed.progresso.indice,
      rpe: stato.rpe,
      tecnica: stato.tecnica,
      dolori: doloriSegnati(),
      nota: qs("#nota-es")?.value,
    });
    // In un blocco si valuta un esercizio alla volta: finito il primo si passa
    // al secondo, senza riposo in mezzo — il riposo l'hai già fatto fra i giri.
    const ind = indiciBlocco();
    if (ind.length > 1) {
      const risposti = new Set(
        (await store.questionariDi(S.sed.id)).filter((l) => !l.saltato).map((l) => l.esercizioId)
      );
      const manca = ind.findIndex((k) => !risposti.has(S.esercizi[k].esercizioId));
      if (manca >= 0) {
        await salvaProgresso({ fase: "questionario", indice: ind[manca] });
        await disegna();
        return;
      }
    }
    // Adesso il riposo: il cronometro parte da qui, con il prossimo esercizio
    // già in vista. È l'ultimo pezzo prima di cambiare esercizio, e nessun
    // tasto lo salta per sbaglio.
    const def = store.esercizio(v.esercizioId);
    const durata = recuperoDi() * 1000;
    S.recuperoFine = Date.now() + durata;
    await salvaProgresso({ fase: "recupero", indice: ind[ind.length - 1], recuperoFine: S.recuperoFine });
    await disegna();
  }
}

// ---------- cardio ----------

// I due tasti +/− non avevano fondo né tetto: a furia di toccare la velocità
// arrivava a 0 km/h — un cardio «eseguito» da fermo, che non è un dato ma un
// buco — e la durata saliva senza fermarsi mai (venticinque ore). I limiti sono
// quelli veri di un tapis roulant, non del protocollo: fuori protocollo si può
// andare e l'app lo dice, ma un numero impossibile non deve nemmeno entrare.
const KMH_MIN = 0.5;
const KMH_MAX = 20;
const DURATA_MIN = 5;
const DURATA_MAX = 180;

async function vistaCardio(corpo, piede) {
  const r = store.regole().cardio;
  // Il cardio è in corso se è stato AVVIATO: prima si guardava l'ora di fine,
  // che con un cronometro che sale non esiste più.
  if (S.sed.progresso?.cardioInizio) return vistaCardioInCorso(corpo, piede, r);

  let kmh = S.sed.cardio?.kmh ?? r.kmhMin;
  let durata = S.sed.cardio?.durataMin ?? r.durataMin;

  const valK = h("span.val", `${num(kmh)} km/h`);
  const valD = h("span.val", `${durata} min`);
  const avviso = h("p.footnote", { style: "margin:10px 16px 0" }, "");
  // La nota scritta prima non si perde tornando su questa schermata.
  const notaPrec = S.sed.cardio?.note || "";

  const controlla = () => {
    // Anche la durata scelta conta: partire con 10 minuti su 30 previsti è già
    // fuori protocollo, e dirlo dopo servirebbe a poco.
    if (r.durataMin && durata < r.durataMin * 0.9) {
      avviso.textContent = `Più corto del previsto: ${durata} min invece di ${r.durataMin}.`;
      avviso.style.color = "var(--orange)";
      return;
    }
    if (kmh > r.kmhMax) {
      avviso.textContent = `Sopra protocollo: previsto ${num(r.kmhMin)}-${num(r.kmhMax)} km/h. Il cardio non deve essere il lavoro più duro della giornata.`;
      avviso.style.color = "var(--orange)";
    } else if (kmh < r.kmhMin) {
      // Anche sotto il minimo si è fuori dal protocollo: il cardio ha una
      // fascia, non un tetto soltanto.
      avviso.textContent = `Sotto protocollo: previsto ${num(r.kmhMin)}-${num(r.kmhMax)} km/h.`;
      avviso.style.color = "var(--orange)";
    } else {
      avviso.textContent = `A protocollo. Riferimento FC ${r.fcMin}-${r.fcMax}, mai sopra ${r.fcLimite}.`;
      avviso.style.color = "var(--label-secondary)";
    }
  };

  aggiungi(corpo,
    h(
      "div.hero",
      h("p.kicker", "Dopo i pesi"),
      h("h2", "Cardio"),
      h("p.target", `${r.durataMin} min · ${num(r.kmhMin)}-${num(r.kmhMax)} km/h · FC ${r.fcMin}-${r.fcMax}`)
    ),
    // Il cardio già fatto va detto: tornando qui dal menu la schermata
    // ripartiva da zero e rifarlo sovrascriveva quello registrato.
    S.sed.cardio?.eseguito
      ? h(
          "div.group",
          h(
            "p.footnote",
            { style: "color:var(--orange)" },
            `Il cardio di oggi è già registrato: ${num(S.sed.cardio.kmh)} km/h per ${S.sed.cardio.durataMin} min. Se ricominci, quello di prima viene sostituito.`
          )
        )
      : null,
    h(
      "div.group",
      h(
        "div.list",
        h(
          "div.field",
          h("label", "Velocità impostata sul tapis"),
          h(
            "div.stepper",
            h("button", { onclick: () => { kmh = Math.max(KMH_MIN, Math.round((kmh - 0.1) * 10) / 10); valK.textContent = `${num(kmh)} km/h`; controlla(); } }, "−"),
            valK,
            h("button", { onclick: () => { kmh = Math.min(KMH_MAX, Math.round((kmh + 0.1) * 10) / 10); valK.textContent = `${num(kmh)} km/h`; controlla(); } }, "+")
          )
        ),
        h(
          "div.field",
          h("label", "Durata"),
          h(
            "div.stepper",
            h("button", { onclick: () => { durata = Math.max(DURATA_MIN, durata - 5); valD.textContent = `${durata} min`; controlla(); } }, "−"),
            valD,
            h("button", { onclick: () => { durata = Math.min(DURATA_MAX, durata + 5); valD.textContent = `${durata} min`; controlla(); } }, "+")
          )
        )
      ),
      avviso
    ),
    h("textarea.note", { id: "nota-cardio", placeholder: "Nota sul cardio (facoltativa)", value: notaPrec })
  );
  controlla();

  aggiungiPiede(piede,
    h(
      "button.btn",
      {
        onclick: azione(async () => {
          // Il cardio già registrato non si sovrascrive di nascosto.
          if (S.sed.cardio?.eseguito) {
            const ok = await chiedi({
              titolo: "Rifare il cardio?",
              testo: `Oggi è già registrato: ${num(S.sed.cardio.kmh)} km/h per ${S.sed.cardio.durataMin} min. Ricominciando, quel dato viene sostituito.`,
              opzioni: [{ etichetta: "Ricomincia", valore: "si", stile: "destructive" }],
            });
            if (ok !== "si") return;
          }
          sbloccaAudio();
          S.sed = await store.aggiornaSeduta(S.sed.id, {
            // durataPrevistaMin resta quella scelta alla partenza: serve per
            // sapere quanto del cardio è stato davvero fatto. `eseguito` torna
            // falso finché non lo chiudi: prima restava «fatto» con la durata
            // vecchia mentre il nuovo cardio era ancora in corso.
            cardio: {
              ...S.sed.cardio,
              kmh,
              durataMin: null,
              durataPrevistaMin: durata,
              eseguito: false,
              finitoIl: null,
              saltatoMotivo: null,
              rimandato: false,
              note: qs("#nota-cardio")?.value ?? notaPrec ?? null,
            },
          });
          // Solo l'istante di partenza: il cronometro sale da lì e la durata
          // prevista sta già in `cardio.durataPrevistaMin`. `cardioFine` si
          // azzera perché una seduta lasciata aperta con la versione di prima
          // ce l'ha ancora dentro.
          await salvaProgresso({ cardioInizio: Date.now(), cardioFine: null });
          await disegna();
        }),
      },
      "Parti con il cardio"
    ),
    h(
      "button.btn.secondary",
      {
        onclick: async () => {
          if (S.sed.cardio?.eseguito) {
            const ok = await chiedi({
              titolo: "Cancellare il cardio registrato?",
              testo: `Oggi risulta ${num(S.sed.cardio.kmh)} km/h per ${S.sed.cardio.durataMin} min. Segnandolo «non eseguito» quel dato sparisce.`,
              opzioni: [{ etichetta: "Sì, cancellalo", valore: "si", stile: "danger" }],
            });
            if (ok !== "si") return;
          }
          const motivo = await chiedi({
            titolo: "Cardio non eseguito",
            opzioni: [
              { etichetta: "Tempo", valore: "tempo" },
              { etichetta: "Tapis non disponibile", valore: "attrezzo" },
              { etichetta: "Altro", valore: "altro" },
            ],
          });
          if (!motivo) return;
          S.sed = await store.aggiornaSeduta(S.sed.id, {
            cardio: {
              ...S.sed.cardio,
              eseguito: false,
              saltatoMotivo: motivo,
              rimandato: false,
              // Il foglio dice «quel dato sparisce»: allora deve sparire anche
              // dal record. Punteggio e pacchetto lo ignorano già quando
              // «eseguito» è falso, ma una durata che resta scritta accanto a
              // «non eseguito» è una riga che si contraddice da sola — e la
              // prima cosa che qualcuno ci leggerà dentro sarà il numero.
              durataMin: null,
              finitoIl: null,
            },
          });
          await salvaProgresso({ fase: "stretching" });
          await disegna();
        },
      },
      "Non eseguito"
    ),
    /* Il cardio si può rimandare senza dichiararlo saltato.
       Capita di finire i pesi e di dover aspettare — il tapis occupato, un
       impegno in mezzo — e siccome il cardio viene prima dello stretching, si
       finiva per saltare lo stretching, che è la parte che non si recupera.
       Rimandandolo si va dritti allo stretching; il cardio resta da fare e la
       Home lo tiene lì, con l'allenamento aperto, finché non lo fai o non lo
       dichiari non eseguito. */
    h(
      "button.btn.secondary",
      {
        onclick: azione(async () => {
          S.sed = await store.aggiornaSeduta(S.sed.id, {
            cardio: { ...S.sed.cardio, rimandato: true, saltatoMotivo: null },
          });
          toast("Cardio rimandato: lo trovi in Home finché non lo fai.");
          // Rimandandolo una seconda volta lo stretching è già stato fatto:
          // rimandarci sopra significherebbe rifare da capo passaggi già
          // chiusi. In quel caso si va al riepilogo, che e il punto in cui si
          // decide cosa fare dell'allenamento.
          await salvaProgresso({ fase: S.sed.stretching ? "fine" : "stretching" });
          await disegna();
        }),
      },
      "Rimanda il cardio"
    )
  );
}

/** Cardio in corso: conto alla rovescia sulla durata impostata. */
/**
 * Il cardio si conta all'insù, da zero, e finisce quando lo dici tu.
 *
 * Prima era un conto alla rovescia da mezz'ora: chi voleva camminare di più
 * doveva stare lì a premere «+5 min» mentre camminava, e chi smetteva prima
 * lasciava correre il timer. Un cronometro che sale non ha bisogno di sapere
 * in anticipo quanto durerà: i minuti che finiscono nel pacchetto sono quelli
 * fra l'avvio e il tocco su «Ho finito», nient'altro.
 *
 * La durata prevista resta scritta, ma solo come traguardo: l'anello si riempie
 * fino a lì e il suono arriva una volta sola quando ci arrivi. Dopo, il tempo
 * continua a salire in silenzio.
 */
async function vistaCardioInCorso(corpo, piede, r) {
  const inizio = S.sed.progresso.cardioInizio;
  const previstiMin = S.sed.cardio?.durataPrevistaMin || r.durataMin || 0;
  const traguardo = previstiMin ? inizio + previstiMin * 60000 : null;

  const testoTimer = h("p.timer", "--:--");
  const CIRC = 2 * Math.PI * 100;
  const anelloCardio = h("circle.prog", {
    cx: 108,
    cy: 108,
    r: 100,
    style: `stroke-dasharray:${CIRC};stroke-dashoffset:0`,
  });
  const quadrante = h(
    "div.timer-wrap",
    h("svg.timer-ring", { viewBox: "0 0 216 216" }, h("circle.track", { cx: 108, cy: 108, r: 100 }), anelloCardio),
    testoTimer
  );

  const sottoQuadrante = h("p.target", "");
  aggiungi(corpo,
    h(
      "div.hero",
      h("p.kicker", "Cardio in corso"),
      quadrante,
      sottoQuadrante,
      h("p.target", `${num(S.sed.cardio.kmh)} km/h · FC ${r.fcMin}-${r.fcMax}, mai sopra ${r.fcLimite}`)
    ),
    h(
      "div.group",
      h(
        "p.footnote",
        { style: "text-align:center" },
        "Il cronometro sale e non si ferma da solo: cammina quanto vuoi e tocca «Ho finito» quando scendi. " +
          "Il tempo si conta sull'orologio: puoi bloccare lo schermo, al ritorno il conto è giusto."
      )
    )
  );

  const chiudiCardio = async () => {
    fermaTimer();
    let trascorsi = Math.max(1, Math.round((Date.now() - inizio) / 60000));
    // Il tempo è quello dell'orologio: se il telefono resta in tasca a cardio
    // finito, «Ho finito» registrava tutte le ore passate. Un cardio molto più
    // lungo del previsto è quasi sempre questo, e finiva dritto nel pacchetto
    // per il coach e nel punteggio.
    const previsti = S.sed.cardio?.durataPrevistaMin || r.durataMin || 0;
    if (previsti && trascorsi > previsti + 20) {
      // Camminare più del previsto adesso è una cosa che si fa apposta, quindi
      // la risposta giusta viene per prima. La domanda resta perché l'app non
      // può distinguere «ho camminato un'ora» da «ho toccato Ho finito un'ora
      // dopo essere sceso», e sbagliare qui sporca il pacchetto per il coach.
      const scelta = await chiedi({
        titolo: "Quanto è durato davvero?",
        testo: `Dall'avvio sono passati ${durataUmana(trascorsi * 60)}, contro i ${previsti} minuti previsti. Se hai camminato davvero tanto va benissimo; se invece hai toccato «Ho finito» un po' dopo essere sceso, il conto è più lungo del vero.`,
        opzioni: [
          { etichetta: `${trascorsi} minuti, ho camminato così`, valore: "trascorsi" },
          { etichetta: `${previsti} minuti, come previsto`, valore: "previsti" },
        ],
        annulla: false,
      });
      if (scelta !== "trascorsi") trascorsi = previsti;
    }
    S.sed = await store.aggiornaSeduta(S.sed.id, {
      // Quando è finito il cardio resta scritto nella seduta: il progresso
      // viene azzerato subito dopo, e senza questo la durata dell'allenamento
      // perdeva mezz'ora di tapis.
      cardio: {
        ...S.sed.cardio,
        eseguito: true,
        durataMin: trascorsi,
        // Coerente con i minuti dichiarati: se correggi la durata verso il
        // basso, l'ora di fine non può restare quella del tocco.
        finitoIl: Math.min(Date.now(), inizio + trascorsi * 60000),
      },
    });
    // Una volta qui si chiedevano i numeri dell'orologio, finché l'unico modo di
    // averli era ricopiarli dal quadrante. Adesso li porta l'importazione da
    // Salute — tutti, compreso lo sforzo — e si va dritti allo stretching.
    // Se il cardio era stato rimandato, lo stretching è già stato fatto prima:
    // rimandarci sopra vorrebbe dire rifare da capo passaggi già chiusi.
    await salvaProgresso({
      fase: S.sed.stretching ? "fine" : "stretching",
      cardioInizio: null,
      cardioFine: null,
    });
    await disegna();
  };

  const pulsante = h("button.btn", { onclick: azione(chiudiCardio) }, "Ho finito");

  // Il suono del traguardo si spegne senza chiudere il cardio: se vuoi
  // camminare ancora, zittirlo non deve costarti la fine dell'esercizio. Il
  // tasto esiste solo mentre suona.
  const zittisci = h(
    "button.btn.secondary",
    { style: "display:none", onclick: () => { fermaAllarme(); aggiorna(); } },
    "Ferma il suono e continua"
  );

  // Rimandare si poteva solo PRIMA di partire, ed è il caso opposto a quello
  // per cui la funzione è nata: il tapis che si libera, cominci, e dopo due
  // minuti devi smettere. Restava solo la strada storta dal menu. Qui il tempo
  // camminato finora non diventa un dato — sarebbe un cardio da due minuti
  // registrato come fatto — e viene detto prima di farlo.
  const rimanda = h(
    "button.btn.secondary",
    {
      onclick: azione(async () => {
        const trascorsi = Math.max(0, Math.round((Date.now() - inizio) / 60000));
        const scelta = await chiedi({
          titolo: "Rimandare il cardio?",
          testo:
            `Il cronometro va da ${durataUmana(trascorsi * 60 || 60)}. Rimandandolo quel tempo non viene registrato: il cardio resta da fare e lo ritrovi in Home, con l'allenamento aperto.\n\n` +
            "Se invece hai camminato e vuoi tenerlo, tocca «Ho finito».",
          opzioni: [{ etichetta: "Rimanda, non registrare niente", valore: "rimanda" }],
        });
        if (scelta !== "rimanda") return;
        fermaTimer();
        fermaAllarme();
        S.sed = await store.aggiornaSeduta(S.sed.id, {
          cardio: { ...S.sed.cardio, rimandato: true, eseguito: false, durataMin: null, finitoIl: null, saltatoMotivo: null },
        });
        toast("Cardio rimandato: lo trovi in Home finché non lo fai.");
        await salvaProgresso({
          fase: S.sed.stretching ? "fine" : "stretching",
          cardioInizio: null,
          cardioFine: null,
        });
        await disegna();
      }),
    },
    "Rimanda il cardio"
  );

  // Niente più «−5 / +5»: non c'è nessun conto alla rovescia da allungare.
  aggiungiPiede(piede, zittisci, rimanda, pulsante);

  // Il traguardo suona una volta sola. Zittito, resta zitto: il cronometro
  // continua a salire e nessuno ti richiama ogni cinque minuti.
  let traguardoSuonato = Boolean(traguardo && Date.now() >= traguardo);

  const aggiorna = () => {
    const trascorsi = Math.max(0, (Date.now() - inizio) / 1000);
    testoTimer.textContent = mmss(trascorsi);

    if (!traguardo) {
      anelloCardio.style.strokeDashoffset = "0";
      sottoQuadrante.textContent = "";
      return;
    }
    const quota = Math.min(1, (trascorsi * 1000) / (previstiMin * 60000));
    anelloCardio.style.strokeDashoffset = String(CIRC * (1 - quota));
    const oltre = Math.floor((Date.now() - traguardo) / 60000);
    if (oltre >= 0) {
      quadrante.classList.add("done");
      sottoQuadrante.textContent =
        oltre >= 1 ? `${previstiMin} min previsti · ${oltre} in più` : `${previstiMin} min previsti, raggiunti`;
      if (!traguardoSuonato) {
        traguardoSuonato = true;
        avviaAllarme();
      }
      zittisci.style.display = allarmeAttivo() ? "" : "none";
    } else {
      quadrante.classList.remove("done");
      sottoQuadrante.textContent = `${previstiMin} min previsti`;
      zittisci.style.display = "none";
    }
  };
  aggiorna();
  S.timerHandle = setInterval(aggiorna, 250);
}


// ---------- stretching, come passo dell'allenamento ----------

async function vistaStretching(corpo, piede) {
  const passi = passiStretching();

  await vistaGuidata(corpo, piede, {
    chiave: "str",
    tenuta: true,
    kicker: "Stretching",
    titolo: "Stretching",
    passi,
    vuoto: "Nessun allungamento previsto per questo giorno",
    etichettaFine: "Stretching fatto",
    extra: (i) => [
      i === 0
        ? h(
            "div.guida",
            h(
              "section",
              h("h3", "Perché adesso"),
              h(
                "p",
                "A muscolo caldo e a lavoro finito. Prima dell'allenamento allungare a freddo un muscolo che deve spingere riduce la forza espressa: per quello all'inizio c'è la mobilità, non questo."
              )
            )
          )
        : null,
    ],
    tastiExtra: () => [
      h(
        "button.btn.secondary",
        {
          onclick: azione(async () => {
            S.sed = await store.aggiornaSeduta(S.sed.id, { stretching: { fatto: false } });
            await salvaProgresso({ fase: dopoLoStretching() });
            await disegna();
          }),
        },
        "Salta"
      ),
    ],
    onFine: async () => {
      S.sed = await store.aggiornaSeduta(S.sed.id, {
        stretching: { fatto: true, quando: Date.now() },
      });
      await salvaProgresso({ fase: dopoLoStretching() });
      await disegna();
    },
  });
}

/** Dopo lo stretching c'è la mobilità, se quel giorno ne ha una. */
const dopoLoStretching = () => (passiMobilita().length ? "mobilita" : "fine");

/**
 * Il blocco di mobilità di fine seduta.
 *
 * Non è un esercizio: niente carico, niente ripetizioni da registrare, niente
 * RPE. È una dose fissa, come il riscaldamento — e come il riscaldamento entra
 * nel punteggio solo per il fatto di essere stata fatta o saltata. Su sabato e
 * domenica, che di esercizi non ne hanno, è tutto il contenuto della giornata.
 */
async function vistaMobilita(corpo, piede) {
  const passi = passiMobilita();
  await vistaGuidata(corpo, piede, {
    chiave: "mob",
    tenuta: true,
    kicker: "Mobilità",
    titolo: "Mobilità",
    passi,
    vuoto: "Nessuna mobilità prevista per questo giorno",
    etichettaFine: "Mobilità fatta",
    extra: (i) =>
      i === 0
        ? [
            h(
              "div.guida",
              h(
                "section",
                h("h3", "Perché adesso"),
                h(
                  "p",
                  // Sui giorni che lo stretching finale non ce l'hanno, «dopo
                  // lo stretching» mandava a cercare un passaggio mai visto.
                  `${passiStretching().length ? "Dopo lo stretching, a lavoro finito." : "A lavoro finito: su questo giorno prende il posto dello stretching."} Copre le zone che il riscaldamento di oggi non ha toccato: caviglia, anca, colonna, spalle. Dose fissa, non si progredisce.`
                )
              )
            ),
          ]
        : [],
    tastiExtra: () => [
      h(
        "button.btn.secondary",
        {
          onclick: azione(async () => {
            S.sed = await store.aggiornaSeduta(S.sed.id, { mobilita: { fatto: false } });
            await salvaProgresso({ fase: "fine" });
            await disegna();
          }),
        },
        "Salta"
      ),
    ],
    onFine: async () => {
      S.sed = await store.aggiornaSeduta(S.sed.id, { mobilita: { fatto: true, quando: Date.now() } });
      await salvaProgresso({ fase: "fine" });
      await disegna();
    },
  });
}

/**
 * I numeri dell'orologio scritti a mano, in sola lettura.
 *
 * Fino a che l'unica strada per averli era ricopiarli dal quadrante, l'app
 * apriva sei caselle a fine allenamento e chiedeva di riempirle. Adesso li
 * legge l'importazione da Salute — durata, calorie attive e totali, battito
 * medio e massimo, sforzo — quindi chiederli sarebbe far rifare a mano un
 * lavoro già fatto, con l'aggiunta degli errori di trascrizione.
 *
 * Quelli scritti prima restano: sono lavoro di qualcuno, stanno nello storico e
 * nel pacchetto per il coach, e sparire sarebbe peggio che essere superati.
 */
const NOMI_OROLOGIO = {
  durata: "Durata allenamento",
  km: "Distanza",
  kcalAttive: "Chilocalorie attive",
  kcalTotali: "Chilocalorie totali",
  ritmo: "Media ritmo",
  fcMedia: "Media battito",
  fcMax: "Battito massimo",
  sforzo: "Sforzo",
};
const UNITA_OROLOGIO = { km: "km", kcalAttive: "kcal", kcalTotali: "kcal", fcMedia: "bpm", fcMax: "bpm", sforzo: "su 10" };

function orologioScritto(sed, quale) {
  // Compatibilità con la prima versione, che teneva un blocco solo e piatto.
  const tutto = sed.orologio || {};
  const vecchioPiatto = tutto.fcMedia != null || tutto.fcMax != null || tutto.kcal != null;
  const valori = quale === "pesi" && vecchioPiatto ? tutto : tutto[quale] || {};
  const righe = Object.entries(NOMI_OROLOGIO)
    .filter(([id]) => valori[id] != null && valori[id] !== "")
    .map(([id, nome]) =>
      h(
        "div.row",
        h("div.main", h("span.title", nome)),
        h("span.value", `${valori[id]}${UNITA_OROLOGIO[id] ? ` ${UNITA_OROLOGIO[id]}` : ""}`)
      )
    );
  if (!righe.length) return null;
  return h(
    "div.group",
    h("h2", quale === "pesi" ? "Dall'orologio — pesi" : "Dall'orologio — cardio"),
    h("div.list", ...righe),
    h(
      "p.footnote",
      "Scritti a mano prima che l'app leggesse gli allenamenti dall'app Salute. Adesso arrivano da soli: li trovi in Home, sotto Watch."
    )
  );
}

// ---------- riepilogo ----------

async function vistaFine(corpo, piede) {
  const serie = await store.serieDi(S.sed.id);
  const logs = await store.questionariDi(S.sed.id);
  // Lo stesso conto della chiusura: l'orologio da solo contava anche il tempo
  // in cui il riepilogo restava aperto, e il numero qui non corrispondeva a
  // quello che poi finiva in archivio.
  const durataSec = Math.round(
    ((S.sed.oraFine || store.fineStimata(S.sed, serie)) - store.inizioStimato(S.sed, serie)) / 1000
  );
  const recuperi = serie.map((s) => s.recuperoRealeSec).filter((x) => x != null);
  const recMedio = recuperi.length ? Math.round(recuperi.reduce((a, b) => a + b, 0) / recuperi.length) : null;
  // Sul tempo di lavoro netto, come nel pacchetto per il coach.
  const netto = store.durataLavoroSec(S.sed, serie) || durataSec;
  const densita = netto > 0 ? (serie.length / (netto / 60)).toFixed(2).replace(".", ",") : "—";
  // Durata e densita stavano una sotto l'altra e raccontavano due tempi
  // diversi: la durata contava anche le pause (col cardio rimandato erano ore),
  // la densita no. E la durata qui non era nemmeno quella che poi finiva in
  // archivio alla chiusura. Adesso e la stessa, con lo stesso nome che ha nel
  // risultato: il tempo di allenamento.
  const durataMostrata = netto;

  const mancanti = [];
  for (const v of S.esercizi) {
    const log = logs.find((l) => l.esercizioId === v.esercizioId);
    const def = store.esercizio(v.esercizioId);
    const fatte = serie.filter((x) => x.esercizioId === v.esercizioId);
    const nome = def?.nome || v.esercizioId;
    // «Nessun dato» solo se davvero non c'è niente: con le serie registrate e
    // il questionario mancante il lavoro c'è, manca la valutazione.
    if (!log && !fatte.length) mancanti.push(`${nome}: mai iniziato`);
    else if (!log) mancanti.push(`${nome}: ${fatte.length} serie, questionario non compilato`);
    else if (log.saltato) mancanti.push(`${nome}: saltato (${log.saltato.motivo})`);
  }

  // Un gruppo per punto dolente: se hanno fatto male sia il ginocchio sia
  // l'anca, sommarli in un elenco solo renderebbe illeggibile quale esercizio
  // ha dato fastidio a cosa.
  const perDolore = new Map();
  for (const l of logs) {
    for (const d of store.doloriDi(l)) {
      if (!perDolore.has(d.id)) perDolore.set(d.id, { nome: d.nome, righe: [] });
      perDolore.get(d.id).righe.push({ log: l, d });
    }
  }

  aggiungi(corpo, 
    h("div.hero", h("p.kicker", "Riepilogo"), h("h2", S.sed.tipoNome)),
    h(
      "div.group",
      h("div.list",
        h(
          "div.row",
          h("div.main", h("span.title", "Durata"), h("span.sub", "tempo di allenamento")),
          h("span.value", durataUmana(durataMostrata))
        ),
        h("div.row", h("div.main", h("span.title", "Serie registrate")), h("span.value", String(serie.length))),
        h("div.row", h("div.main", h("span.title", "Densità")), h("span.value", `${densita} serie/min`)),
        h("div.row", h("div.main", h("span.title", "Recupero medio reale")), h("span.value", recMedio != null ? mmss(recMedio) : "—")),
        S.sed.cardio?.previsto
          ? h("div.row", h("div.main", h("span.title", "Cardio")), h("span.value", S.sed.cardio.eseguito
                ? `${num(S.sed.cardio.kmh)} km/h · ${S.sed.cardio.durataMin} min`
                // «Non eseguito» e «rimandato» non sono la stessa cosa: il
                // primo l'hai deciso, il secondo è ancora da fare e
                // l'allenamento puo restare aperto ad aspettarlo.
                : S.sed.cardio.rimandato
                  ? "rimandato"
                  : "non eseguito"))
          : null
      )
    ),
    logs.length
      ? h("div.group", h("h2", "RPE e tecnica"),
          h("div.list", ...logs.filter((l) => !l.saltato).map((l) => {
            const def = store.esercizio(l.esercizioId);
            return h("div.row",
              h("div.main", h("span.title", def?.nome || l.esercizioId), l.nota ? h("span.sub", l.nota) : null),
              h("span.value", `RPE ${l.rpe ?? "—"} · tec ${l.tecnica ?? "—"}`)
            );
          }))
        )
      : null,
    ...[...perDolore.values()].map((g) =>
      h("div.group", h("h2", g.nome.charAt(0).toUpperCase() + g.nome.slice(1)),
        h("div.list", ...g.righe.map(({ log, d }) => {
          const def = store.esercizio(log.esercizioId);
          return h("div.row",
            h("div.main", h("span.title", def?.nome || log.esercizioId)),
            h("span.pill.bad", `${d.intensita || "—"} · ${d.quando || "—"}`)
          );
        }))
      )
    ),
    mancanti.length
      ? h("div.group", h("h2", "Dati mancanti"), h("div.list", ...mancanti.map((m) => h("div.row", h("div.main", h("span.title", m))))))
      : null,
    orologioScritto(S.sed, "pesi"),
    S.sed.cardio?.previsto || S.sed.cardio?.eseguito ? orologioScritto(S.sed, "cardio") : null,
    h("p.footnote", { style: "margin:22px 16px 0" }, "Nota generale (dolori, sensazioni — solo se presenti)"),
    // La scritta qui sopra si vede ma non è collegata al campo: chi usa
    // VoiceOver sentirebbe «campo di testo» e basta. È l'unico campo dell'app
    // rimasto senza nome — tutti gli altri ce l'hanno nel segnaposto.
    h("textarea.note", {
      id: "nota-seduta",
      "aria-label": "Nota generale sull'allenamento",
      placeholder: "Dolori, sensazioni — solo se c'è qualcosa da segnalare",
      value: S.sed.notaGenerale || "",
    })
  );

  aggiungiPiede(piede, 
    h("button.btn", {
      onclick: azione(async () => {
        // Un cardio rimandato e mai fatto: chiudere qui lo trasforma in un
        // cardio non eseguito, con quello che comporta sul punteggio. È una
        // conseguenza, non una punizione, ma va detta prima e non dopo.
        if (S.sed.cardio?.previsto && S.sed.cardio?.rimandato && !S.sed.cardio?.eseguito) {
          const scelta = await chiedi({
            titolo: "Il cardio è ancora da fare",
            testo:
              "L'avevi rimandato. Chiudendo adesso l'allenamento resta senza cardio, e nel punteggio conta come non eseguito.\n\n" +
              "Se lo fai più tardi, lascia l'allenamento aperto: lo trovi in Home.",
            opzioni: [
              { etichetta: "Lascia aperto, lo faccio dopo", valore: "aspetta" },
              { etichetta: "Chiudi senza cardio", valore: "chiudi", stile: "destructive" },
            ],
          });
          if (scelta !== "chiudi") {
            // «Lo trovi in Home» va preso alla lettera: restando qui, sul
            // riepilogo, l'unica cosa a portata di dito era di nuovo «Chiudi
            // allenamento». Il cronometro si ferma e lo schermo si libera,
            // l'allenamento resta aperto ad aspettare il cardio.
            if (scelta === "aspetta") {
              fermaTimer();
              rilasciaSchermo();
              location.hash = "#/oggi";
            }
            return;
          }
        }
        await store.chiudiSeduta(S.sed.id, { notaGenerale: qs("#nota-seduta")?.value || null });
        try {
          await store.snapshotAutomatico("fine allenamento");
        } catch {
          // l'allenamento è già chiuso e salvato: la copia interna non deve
          // far fallire la chiusura né bloccare il passaggio al risultato
        }
        // I dati di oggi entrano nel motore solo adesso, a seduta chiusa.
        const { proposte } = await store.aggiornaMotore();
        fermaTimer();
        rilasciaSchermo();
        toast(
          proposte.create
            ? `Allenamento chiuso. ${proposte.create} ${proposte.create === 1 ? "nuova proposta" : "nuove proposte"} in Home.`
            : "Allenamento chiuso e salvato.",
          proposte.create ? 4000 : 2200
        );
        location.hash = `#/seduta?riepilogo=${S.sed.id}`;
      }),
    }, "Chiudi allenamento"),
    h("button.btn.secondary", {
      onclick: async () => {
        // La nota che stavi scrivendo si salva prima di cambiare schermata:
        // tornare indietro la cancellava senza dire niente.
        const nota = qs("#nota-seduta")?.value;
        if (nota != null) S.sed = await store.aggiornaSeduta(S.sed.id, { notaGenerale: nota || null });
        // Si riparte davvero dal primo esercizio: carico e obiettivo del
        // vecchio non devono restare appiccicati, e il cronometro della serie
        // riparte adesso (altrimenti il recupero della prima serie risultava
        // lungo quanto tutto il tempo passato nel riepilogo).
        S.caricoCorrente = null;
        S.obiettivo = null;
        // Niente cronometro finto: la serie ripresa risulta «recupero non
        // misurato» invece di portarsi dietro il tempo passato nel riepilogo.
        S.tsInizioSerie = null;
        // Si torna al primo esercizio ANCORA da fare, non al primo in assoluto:
        // ricominciare da uno già chiuso significava rifare il questionario di
        // un esercizio finito.
        const serieOra = await store.serieDi(S.sed.id);
        const logsOra = await store.questionariDi(S.sed.id);
        const primoAperto = S.esercizi.findIndex(
          (v) =>
            !logsOra.some((l) => l.esercizioId === v.esercizioId) &&
            serieOra.filter((x) => x.esercizioId === v.esercizioId).length < (v.serie || 1)
        );
        // Se non c'è più niente di aperto, non si torna al primo esercizio.
        //
        // Il ripiego era `indice: 0`, cioè proprio quello che il commento qui
        // sopra dice di voler evitare: a esercizi tutti finiti si finiva sul
        // primo, già chiuso, con il questionario da rifare da capo. Chi tocca
        // «Torna agli esercizi» a fine seduta vuole rivedere il lavoro, non
        // ricominciarlo: si va sull'ULTIMO esercizio, quello appena chiuso.
        const ultimo = Math.max(0, S.esercizi.length - 1);
        await salvaProgresso({
          fase: "esercizio",
          indice: primoAperto >= 0 ? primoAperto : ultimo,
          recuperoFine: null,
          caricoCorrente: null,
          tsInizioSerie: null,
        });
        await disegna();
      },
    }, "Torna agli esercizi")
  );
}
