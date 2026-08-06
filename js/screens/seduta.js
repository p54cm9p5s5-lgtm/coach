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
              `${previsto.esercizi.length} ${previsto.esercizi.length === 1 ? "esercizio" : "esercizi"}${previsto.cardio ? " + cardio" : ""}` +
                (fatteOggi.some((s) => s.tipoId === previsto.id) ? " · già completato oggi" : "")
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
        ? h(
            "button.btn",
            {
              onclick: unaVoltaSola(async () => {
                sbloccaAudio();
                const gia = await store.sedutaInCorso();
                if (!gia) await store.iniziaSeduta({ data: oggi, giornoId: previsto.id });
                await ridisegna();
              }),
            },
            "Inizia allenamento"
          )
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
  const durataSec = sed.oraFine
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
  const completezza = comp?.totale ?? null;
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

  // Anche a allenamento chiuso: l'orologio lo guardi con calma dopo, e i
  // numeri devono poter entrare lo stesso.
  // Anche a allenamento chiuso: l'orologio lo guardi con calma dopo, e i
  // numeri devono poter entrare lo stesso.
  const salvaOrologio = async (orologio) => {
    await store.aggiornaSeduta(sed.id, { orologio });
    sed.orologio = orologio;
  };
  aggiungi(wrap, bloccoOrologio(sed, "pesi", salvaOrologio));
  if (sed.cardio?.previsto || sed.cardio?.eseguito) {
    aggiungi(wrap, bloccoOrologio(sed, "cardio", salvaOrologio));
  }

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
      scheda("Durata", durataSec != null ? durataUmana(durataSec) : "—", "dall'inizio alla chiusura"),
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
          h("span.sub", [carico != null ? `${num(carico)} kg` : "corpo libero", `${mie.length}×${rip}`, confronto].filter(Boolean).join(" · "))
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
        l.dolorePolso ? h("span.pill.bad", "polso") : null
      )
    );
  }
  aggiungi(wrap, h("div.group", h("h2", "Esercizio per esercizio"), righe));

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
        { style: "color:var(--red)", onclick: () => eliminaAllenamento(sed) },
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
async function eliminaAllenamento(sed) {
  const conferma = await chiedi({
    titolo: "Eliminare l'allenamento?",
    testo: `${sed.tipoNome} del ${dataLunga(sed.data)}. Spariscono anche le serie e i questionari, e le proposte vengono ricalcolate senza di esso.`,
    opzioni: [{ etichetta: "Elimina", valore: "si", stile: "danger" }],
  });
  if (conferma !== "si") return;
  await store.annullaSeduta(sed.id);
  await store.aggiornaMotore();
  toast("Allenamento eliminato.");
  // L'hash può essere già «#/seduta»: in quel caso il router non riparte da
  // solo e va richiamato a mano.
  if (location.hash === "#/seduta") await ridisegna();
  else location.hash = "#/seduta";
}

function bloccoStretchingPer(tipoId) {
  const prot = store.riscaldamento(tipoId);
  const voci = prot?.stretchingFinale || [];
  if (!voci.length) return null;
  return h(
    "div.group",
    h("h2", "Stretching di fine allenamento"),
    h(
      "div.guida",
      { style: "margin:0" },
      ...voci.map((s, i) =>
        h(
          "div.passo",
          h("div.n", String(i + 1)),
          h("div.testo", h("span.nome", s.nome), h("span.dose", s.dose), h("span.come", s.come))
        )
      )
    )
  );
}

// ---------- utilità di stato ----------

async function salvaProgresso(patch) {
  S.sed = await store.aggiornaSeduta(S.sed.id, {
    progresso: { ...S.sed.progresso, ...patch },
  });
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

async function menuSeduta() {
  const scelta = await chiedi({
    titolo: "Allenamento",
    opzioni: [
      // Il cardio si può saltare solo se era previsto: portarci l'allenamento
      // quando il programma non lo chiede faceva comparire una schermata di
      // cardio inventata dal nulla.
      ...(S.sed.cardio?.previsto ? [{ etichetta: "Salta al cardio", valore: "cardio" }] : []),
      { etichetta: "Vai allo stretching", valore: "stretching" },
      { etichetta: "Chiudi l'allenamento adesso", valore: "chiudi" },
      { etichetta: "Annulla l'allenamento (elimina i dati)", valore: "annulla", stile: "destructive" },
    ],
  });
  if (scelta === "cardio") {
    await salvaProgresso({ fase: "cardio" });
    await disegna();
  } else if (scelta === "stretching") {
    await salvaProgresso({ fase: "stretching" });
    await disegna();
  } else if (scelta === "chiudi") {
    await salvaProgresso({ fase: "fine" });
    await disegna();
  } else if (scelta === "annulla") {
    const conferma = await chiedi({
      titolo: "Eliminare l'allenamento?",
      testo: "Serie, questionari e note di questo allenamento vengono cancellati. Non si può annullare.",
      opzioni: [{ etichetta: "Elimina tutto", valore: "si", stile: "destructive" }],
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
  if (camminata) passi.push({ nome: camminata.titolo, dose: "5 min", come: camminata.dettaglio });
  for (const m of prot?.mobilita || []) passi.push({ nome: m.nome, dose: m.dose, come: m.come });
  if (prot?.serieDiAvvicinamento) {
    passi.push({
      nome: prot.serieDiAvvicinamento.titolo,
      dose: "1 serie",
      come: prot.serieDiAvvicinamento.dettaglio,
    });
  }
  return passi;
}

function passiStretching() {
  const prot = store.riscaldamento(S.sed.tipoId);
  return (prot?.stretchingFinale || []).map((v) => ({ nome: v.nome, dose: v.dose, come: v.come }));
}

async function vistaRiscaldamento(corpo, piede) {
  const conTapis = S.sed.riscaldamento?.modalita !== "senzaTapis";
  const prot = store.riscaldamento(S.sed.tipoId);

  await vistaGuidata(corpo, piede, {
    chiave: "risc",
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
  // si passa al questionario invece di proporne un'altra.
  if (fatte.length >= v.serie) {
    await salvaProgresso({ fase: "questionario" });
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
  const caricoPrec =
    fatte.at(-1)?.carico ??
    obiettivo?.carico ??
    (v.carico > 0 ? v.carico : null) ??
    (await store.ultimoCarico(v.esercizioId, v.carico ?? null));
  // L'ordine conta: prima quello che c'è in memoria, poi quello salvato nella
  // seduta (l'app è ripartita), infine il carico dedotto dallo storico.
  S.caricoCorrente = S.caricoCorrente ?? S.sed.progresso?.caricoCorrente ?? caricoPrec;

  const bersaglio = v.aTempo
    ? `${v.serie} × ${v.durataSec}s`
    : obiettivo?.rip != null
      ? `${v.serie} × ${obiettivo.rip}`
      : `${v.serie} × ${v.ripMin === v.ripMax ? v.ripMin : `${v.ripMin}-${v.ripMax}`}`;

  // Col cronometro in corso il numero grande è il tempo che scorre, non il
  // carico: è l'unica cosa che serve guardare mentre tieni la posizione.
  if (v.aTempo && S.cronoFine) {
    aggiungi(corpo, quadranteCronometro(v, n));
  } else {
    aggiungi(corpo, 
      h(
        "div.hero",
        h("p.kicker", `Serie ${n} di ${v.serie}`),
        h("h2", def?.nome || v.esercizioId),
        S.caricoCorrente != null
          ? h("p.load", `${num(S.caricoCorrente)} kg`)
          : h("p.load", "corpo libero"),
        h("p.target", `Obiettivo ${bersaglio}`)
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
    aggiungiPiede(piede, ...piedeCronometro(v, def, n));
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
  const testo = h("p.timer", `${v.durataSec}`);
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
      testo.textContent = String(Math.ceil(restanti));
      quadrante.classList.remove("done");
      testo.classList.remove("done");
      if (restanti <= 3 && !preavvisoFatto) {
        preavvisoFatto = true;
        tick();
      }
    } else {
      // Arrivato a zero: la posizione l'hai tenuta tutta. Suona, e resta lì
      // finché non tocchi «Fine» — il tempo in più non viene contato.
      testo.textContent = "0";
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
    h("p.kicker", `Serie ${n} di ${v.serie} · tieni la posizione`),
    quadrante,
    h("p.target", `Previsti ${v.durataSec}s · «Fine» se molli prima`)
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
  const sec = t.match(/(\d+)\s*(?:s|sec|secondi)\b/);
  const min = t.match(/(\d+)\s*(?:min|minuti)\b/);
  const durata = sec ? Number(sec[1]) : min ? Number(min[1]) * 60 : null;
  if (!durata || durata <= 0) return null;
  const giriMatch = t.match(/(\d+)\s*[×x]\s*\d/);
  const serie = giriMatch ? Number(giriMatch[1]) : 1;
  const perLato = /per lato/.test(t);
  return { durata, serie, perLato, tenute: serie * (perLato ? 2 : 1) };
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
  if (tempo.perLato) parti.push(g % 2 === 0 ? "primo lato" : "altro lato");
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
    aggiungi(corpo,
      h("div.hero", h("p.kicker", kicker), h("h2", titolo), h("p.target", S.sed.tipoNome)),
      h("div.group", h("div.list", h("div.row", h("div.main", h("span.title", cfg.vuoto || "Niente da fare in questo giorno")))))
    );
    aggiungiPiede(piede, ...(cfg.tastiExtra?.(passi.length) || []), h("button.btn", { onclick: azione(onFine) }, etichettaFine));
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
    }, ultimaTenuta ? (ultimo ? etichettaFine : "Fatto · avanti") : "Fatto · altro lato");
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

function piedeCronometro(v, def, n) {
  const inCorso = Boolean(S.cronoFine);
  if (!inCorso) {
    return [
      h(
        "div",
        { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px" },
        h("button.btn.secondary", { onclick: unaVoltaSola(() => modificaCarico(def, null)) }, "Cambia carico"),
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
        `Avvia · ${v.durataSec}s`
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

  const copertina = h("img", {
    src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    alt: "",
    loading: "lazy",
    onerror: (e) => {
      e.target.remove();
    },
  });

  const riquadro = h(
    "button.video",
    { onclick: apri, "aria-label": `Riproduci: ${titolo || def.nome}` },
    copertina,
    h("span.play", h("span", "▶"))
  );

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

/** Sostituzione del video di un esercizio, salvata sul dispositivo. */
async function cambiaVideo(def) {
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
      h(
        "div.btn-wrap",
        h(
          "button.btn",
          {
            onclick: async () => {
              const m = campo.value.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
              if (!m) {
                toast("Link non riconosciuto: serve un indirizzo YouTube.");
                return;
              }
              await store.db.put("esercizi", {
                ...def,
                video: { id: m[1], titolo: "Video scelto da te", canale: "YouTube" },
                videoPersonalizzato: true,
              });
              await store.ricaricaLibreria();
              close();
              await disegna();
              toast("Video sostituito.");
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
      if (!bilanciere) {
        aiuto.textContent = `${num(v)} kg per manubrio`;
        return;
      }
      const d = descriviDischi(v, inv);
      aiuto.textContent = d
        ? `Da montare: ${d}`
        : `${num(v)} kg non si compone con i dischi che hai. Puoi salvarlo lo stesso.`;
    };
    campo.addEventListener("input", aggiorna);
    setTimeout(aggiorna, 0);

    return h(
      "div",
      h("h2", "Carico"),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
        bilanciere ? "Peso totale, bilanciere compreso." : "Peso di un singolo manubrio."
      ),
      campo,
      aiuto,
      h(
        "div.btn-wrap",
        h(
          "button.btn",
          {
            onclick: () => {
              const v = leggi();
              if (v === null) {
                toast("Numero non valido.");
                return;
              }
              close(v);
            },
          },
          "Usa questo carico"
        )
      )
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
    recuperoTargetSec: def?.recuperoDefaultSec ?? 120,
  });

  // Il recupero serve anche dopo l'ultima serie: prima si andava dritti alla
  // valutazione, cioè si chiedeva un giudizio mentre il fiato non era ancora
  // tornato, e il riposo prima dell'esercizio dopo spariva. Quando il recupero
  // finisce, `vistaEsercizio` vede che le serie previste sono tutte fatte e
  // manda al questionario da sé.
  const durata = (S.recuperoTarget ?? def?.recuperoDefaultSec ?? 120) * 1000;
  S.serieCorrenteId = rec.id;
  S.recuperoFine = Date.now() + durata;
  S.tsInizioSerie = null;

  await salvaProgresso({
    fase: "recupero",
    recuperoFine: S.recuperoFine,
    tsInizioSerie: null,
  });
  await disegna();
}

async function saltaEsercizio(v, def) {
  const nome = def?.nome || v.esercizioId;
  const motivo = await chiedi({
    titolo: `Saltare ${nome}?`,
    testo: "Il motivo distingue una scelta da un buco di dati.",
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
      "Salta esercizio"
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
  toast(`${nome} segnato come non eseguito.`);
  await avanzaEsercizio();
}

async function avanzaEsercizio() {
  const prossimo = S.sed.progresso.indice + 1;
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
    const dopo = S.sed.cardio?.previsto ? "il cardio" : "lo stretching";
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
    (prossima.carico > 0 ? prossima.carico : null) ??
    (await store.ultimoCarico(prossima.esercizioId, prossima.carico ?? null));
  const bersaglio = prossima.aTempo
    ? `${prossima.serie} × ${prossima.durataSec}s`
    : obiettivo?.rip != null
      ? `${prossima.serie} × ${obiettivo.rip}`
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
  const bersaglio = v.aTempo ? v.durataSec : S.obiettivo?.rip ?? v.ripMax ?? v.ripMin;
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
  const sottotitolo = h(
    "p.target",
    fatte.length >= v.serie
      ? "Ultima serie: rispondi qui sotto mentre recuperi"
      : `Prossima: serie ${fatte.length + 1} di ${v.serie}`
  );
  aggiungi(corpo, h("div.hero", h("p.kicker", "Recupero"), quadrante, sottotitolo));

  const ultimaSerie = fatte.length >= v.serie;

  // campi della serie appena chiusa
  let rip = ultima?.ripFatte ?? bersaglio;
  let carico = ultima?.carico ?? null;
  const bilanciere = def?.attrezzo === "bilanciere";

  // Rileggere prima di scrivere: partendo dalla copia caricata al disegno, la
  // seconda correzione riscriveva sopra la prima e la cancellava.
  const salva = async (patch) => {
    if (!ultima) return;
    const attuale = (await store.serieDi(S.sed.id)).find((x) => x.id === ultima.id) || ultima;
    await store.db.put("serie", { ...attuale, ...patch });
  };

  const valRip = h("span.val", `${rip}${v.aTempo ? "s" : ""}`);
  const valCar = h("span.val", carico != null ? `${num(carico)} kg` : "—");

  aggiungi(corpo, 
    h(
      "div.group",
      h("h2", `Serie ${ultima?.numero ?? fatte.length} appena chiusa`),
      h(
        "div.list",
        h(
          "div.field",
          h("label", v.aTempo ? "Secondi tenuti" : "Ripetizioni fatte"),
          h(
            "div.stepper",
            h("button", { "aria-label": v.aTempo ? "meno 5 secondi" : "una ripetizione in meno", onclick: async () => { rip = Math.max(0, rip - (v.aTempo ? 5 : 1)); valRip.textContent = `${rip}${v.aTempo ? "s" : ""}`; await salva({ ripFatte: rip }); } }, "−"),
            valRip,
            h("button", { "aria-label": v.aTempo ? "più 5 secondi" : "una ripetizione in più", onclick: async () => { rip = Math.min(v.aTempo ? 3600 : 200, rip + (v.aTempo ? 5 : 1)); valRip.textContent = `${rip}${v.aTempo ? "s" : ""}`; await salva({ ripFatte: rip }); } }, "+")
          )
        ),
        carico != null
          ? h(
              "div.field",
              h("label", "Carico usato"),
              h(
                "div.stepper",
                h("button", { "aria-label": "carico più basso", onclick: async () => { carico = passoCarico(carico, -1, def, inv); valCar.textContent = `${num(carico)} kg`; await impostaCarico(carico); await salva({ carico }); } }, "−"),
                valCar,
                h("button", { "aria-label": "carico più alto", onclick: async () => { carico = passoCarico(carico, 1, def, inv); valCar.textContent = `${num(carico)} kg`; await impostaCarico(carico); await salva({ carico }); } }, "+")
              )
            )
          : null
      ),
      h("p.footnote", "I valori sono precompilati con l'obiettivo: correggili solo se hai fatto altro.")
    )
  );

  // Dopo l'ultima serie il recupero è il momento buono per due cose: rispondere
  // sull'esercizio appena finito, mentre ce l'hai ancora nelle braccia, e
  // prepararsi al prossimo. In quest'ordine — prima le domande, poi il
  // prossimo esercizio — perché la seconda cosa serve quando ti alzi, la prima
  // adesso. Prima le domande arrivavano in una schermata a parte, dopo il
  // recupero: un passaggio in più e il tempo del riposo buttato.
  let quiz = null;
  if (ultimaSerie) {
    quiz = await vistaQuestionario(corpo, piede, true);
    aggiungi(corpo, await bloccoProssimo(inv));
  }

  const pulsante = h(
    "button.btn",
    ultimaSerie
      ? { disabled: true, onclick: azione(async () => { fermaTimer(); await quiz.conferma(); }) }
      : { onclick: azione(chiudiRecupero) },
    ultimaSerie ? "Avanti" : "Pronto"
  );
  aggiungiPiede(piede, 
    h(
      "div",
      { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px" },
      h("button.btn.secondary", { onclick: () => spostaTimer(-15) }, "−15 s"),
      h("button.btn.secondary", { onclick: () => spostaTimer(15) }, "+15 s")
    ),
    pulsante
  );

  const totale = (ultima?.recuperoTargetSec || def?.recuperoDefaultSec || 120) * 1000;

  let preavvisoFatto = false;
  // Una volta zittito, il suono non riparte da solo: il controllo gira ogni
  // 250 ms e senza questa memoria lo farebbe ripartire subito dopo averlo
  // spento, cioè renderebbe il bottone inutile.
  let suonoSpento = false;
  const aggiorna = () => {
    if (!S.recuperoFine) return;
    const restanti = (S.recuperoFine - Date.now()) / 1000;
    if (restanti > 3.5) {
      preavvisoFatto = false; // il timer è stato allungato
      suonoSpento = false;
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
      if (ultimaSerie) {
        pulsante.textContent = "Avanti";
        pulsante.disabled = !quiz?.completo();
      } else {
        pulsante.textContent = "Pronto";
      }
    } else {
      testoTimer.textContent = "00:00";
      quadrante.classList.add("done");
      testoTimer.classList.add("done");
      if (!allarmeAttivo() && !suonoSpento) {
        avviaAllarme();
      }
      // Col suono acceso il bottone deve poterlo spegnere anche se le domande
      // non sono finite: un allarme che non si zittisce finché non compili un
      // questionario è una trappola.
      if (ultimaSerie && !quiz?.completo()) {
        pulsante.disabled = false;
        pulsante.textContent = "Ferma il suono";
        pulsante.onclick = () => {
          suonoSpento = true;
          fermaAllarme();
          aggiorna();
        };
      } else if (ultimaSerie) {
        pulsante.disabled = false;
        pulsante.textContent = "Avanti · ferma il suono";
        pulsante.onclick = azione(async () => { fermaAllarme(); fermaTimer(); await quiz.conferma(); });
      } else {
        pulsante.textContent = "Pronto · ferma il suono";
      }
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
  const target = (ultima?.recuperoTargetSec || 120) * 1000;
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
      await store.db.put("serie", { ...ultima, tsFineSerie: Date.now() - target });
    }
  }
  S.tsInizioSerie = Date.now();
  S.recuperoFine = null;
  await salvaProgresso({ fase: "esercizio", recuperoFine: null, tsInizioSerie: S.tsInizioSerie });
  await disegna();
}

// ---------- questionario ----------

async function vistaQuestionario(corpo, piede, dentroRecupero = false) {
  const v = vocePrevista();
  const def = store.esercizio(v.esercizioId);
  // Servono alla correzione dell'ultima serie: i passi del carico devono
  // essere quelli montabili davvero, come nella schermata di recupero.
  const invQui = await store.inventario();
  const bilanciereQui = def?.attrezzo === "bilanciere";

  // Se questo esercizio è già stato valutato (si torna indietro dal riepilogo,
  // o l'app è ripartita), il questionario riparte da quello che avevi scritto:
  // prima era vuoto, e confermarlo cancellava nota e risposte già date.
  const gia = (await store.questionariDi(S.sed.id)).find((l) => l.esercizioId === v.esercizioId && !l.saltato) || null;
  const stato = {
    rpe: gia?.rpe ?? null,
    tecnica: gia?.tecnica ?? null,
    polso: gia?.dolorePolso ?? null,
    quando: gia?.dolorePolsoQuando ?? null,
    intensita: gia?.dolorePolsoIntensita ?? null,
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
  const dettaglioPolso = h("div");
  const avanti = h("button.btn", { disabled: true, onclick: azione(conferma) }, "Avanti");
  // Un bottone spento senza spiegazione, a metà allenamento, è una trappola:
  // premi e non succede niente. Il commento sotto al punteggio parla solo di
  // intensità e tecnica, quindi rispondendo a quelle spariva anche l'unico
  // indizio e restavano fuori le domande sul polso. Qui c'è sempre scritto
  // cosa manca, con le parole delle domande.
  const mancano = h("p.footnote", { style: "margin:0 0 8px;text-align:center" }, "");

  const verifica = () => {
    const manca = [];
    if (stato.rpe == null) manca.push("quanto è stata dura");
    if (stato.tecnica == null) manca.push("com'è andata la tecnica");
    if (stato.polso == null) manca.push("il dolore al polso");
    else if (stato.polso === true) {
      if (!stato.quando) manca.push("quando faceva male");
      if (!stato.intensita) manca.push("quanto faceva male");
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

  const calcolaPunteggio = () =>
    punteggioEsercizio({
      variante: v,
      serie: serieFatteQui,
      rpe: stato.rpe,
      tecnica: stato.tecnica,
      dolorePolso: stato.polso === true,
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

  // L'ultima serie non passa dalla schermata di recupero: senza questi campi
  // resterebbe registrata al bersaglio previsto qualunque cosa sia successo,
  // e una serie su tre nel log del coach sarebbe inventata.
  const ultimaSerie = serieFatteQui.at(-1) || null;
  const correzione = h("div");
  if (ultimaSerie) {
    let rip = ultimaSerie.ripFatte ?? (v.aTempo ? v.durataSec : v.ripMin ?? v.ripMax);
    let carico = ultimaSerie.carico ?? null;
    const valRip = h("span.val", `${rip}${v.aTempo ? "s" : ""}`);
    const valCar = h("span.val", carico != null ? `${num(carico)} kg` : "—");

    const salvaUltima = async (patch) => {
      const attuale = (await store.serieDi(S.sed.id)).find((x) => x.id === ultimaSerie.id) || ultimaSerie;
      const nuova = { ...attuale, ...patch };
      await store.db.put("serie", nuova);
      Object.assign(ultimaSerie, patch);
      const i = serieFatteQui.findIndex((x) => x.id === ultimaSerie.id);
      if (i >= 0) serieFatteQui[i] = { ...serieFatteQui[i], ...patch };
      ridisegnaPunteggio();
    };

    aggiungi(correzione,
      h(
        "div.group",
        h("h2", `Serie ${ultimaSerie.numero} appena chiusa`),
        h(
          "div.list",
          h(
            "div.field",
            h("label", v.aTempo ? "Secondi tenuti" : "Ripetizioni fatte"),
            h(
              "div.stepper",
              h("button", {
                onclick: async () => {
                  rip = Math.max(0, rip - (v.aTempo ? 5 : 1));
                  valRip.textContent = `${rip}${v.aTempo ? "s" : ""}`;
                  await salvaUltima({ ripFatte: rip });
                },
              }, "−"),
              valRip,
              h("button", {
                onclick: async () => {
                  // Un tetto largo, ma un tetto: il carico ce l'ha (l'inventario),
                  // le ripetizioni no, e con il dito fermo sul «+» si arrivava a
                  // numeri che nessuno ha mai fatto.
                  rip = Math.min(v.aTempo ? 3600 : 200, rip + (v.aTempo ? 5 : 1));
                  valRip.textContent = `${rip}${v.aTempo ? "s" : ""}`;
                  await salvaUltima({ ripFatte: rip });
                },
              }, "+")
            )
          ),
          carico != null
            ? h(
                "div.field",
                h("label", "Carico usato"),
                h(
                  "div.stepper",
                  // Gli stessi passi della schermata di recupero. Prima qui si
                  // andava di mezzo chilo alla volta e senza tetto: con dischi
                  // da 1,25 il passo più piccolo montabile è 2,5 kg, e si
                  // finiva per registrare 70,5 kg, un carico che non esiste in
                  // casa. Correggere 70 in 60 chiedeva venti tocchi.
                  h("button", {
                    "aria-label": "carico più basso",
                    onclick: async () => {
                      carico = passoCarico(carico, -1, def, invQui);
                      valCar.textContent = `${num(carico)} kg`;
                      await salvaUltima({ carico });
                    },
                  }, "−"),
                  valCar,
                  h("button", {
                    "aria-label": "carico più alto",
                    onclick: async () => {
                      carico = passoCarico(carico, 1, def, invQui);
                      valCar.textContent = `${num(carico)} kg`;
                      await salvaUltima({ carico });
                    },
                  }, "+")
                )
              )
            : null
        ),
        h("p.footnote", "Correggi solo se l'ultima serie è andata diversamente dal previsto.")
      )
    );
  }

  aggiungi(corpo, 
    // Dentro al recupero l'intestazione e la correzione dell'ultima serie ci
    // sono già: qui si aggiungono solo le domande, altrimenti la stessa cosa
    // comparirebbe due volte nella stessa schermata.
    dentroRecupero
      ? h("h2", { style: "margin:22px 16px 0" }, "Come è andato l'esercizio")
      : h("div.hero", { style: "padding-bottom:2px" }, h("p.kicker", "Fine esercizio"), h("h2", def?.nome || v.esercizioId)),
    dentroRecupero ? null : zonaPunteggio,
    dentroRecupero ? null : correzione,

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

    h("p.footnote", { style: "margin:22px 16px 0" }, `Dolore al polso destro?${def?.sollecitaPolso ? " (esercizio che lo sollecita)" : ""}`),
    h(
      "div.segmented.danger",
      h("button", { "aria-pressed": stato.polso === false ? "true" : "false", onclick: (e) => setPolso(e, false) }, "NO"),
      h("button", { "aria-pressed": stato.polso === true ? "true" : "false", onclick: (e) => setPolso(e, true) }, "SÌ")
    ),
    dettaglioPolso,

    h("p.footnote", { style: "margin:22px 16px 0" }, "Nota (facoltativa — vuota significa nessun segnale)"),
    h("textarea.note", {
      id: "nota-es",
      placeholder: "Solo se c'è qualcosa da segnalare",
      value: gia?.nota || "",
    }),
    zonaDettaglio
  );

  // Se il polso era già segnato, i dettagli devono ricomparire senza toccare
  // niente, altrimenti «Avanti» resterebbe spento con le risposte già date.
  if (stato.polso === true) mostraDettaglioPolso();

  if (dentroRecupero) {
    // Il punteggio dell'esercizio va comunque mostrato, ma sotto le domande:
    // in cima c'è già il timer del recupero. E la riga che dice cosa manca
    // deve stare qui accanto alle domande, non nel piede: nel piede il bottone
    // è quello del recupero e la riga sparirebbe.
    aggiungi(corpo, mancano, zonaPunteggio);
    verifica();
    ridisegnaPunteggio();
    // Il recupero ha bisogno di sapere se può far avanzare e come salvare.
    return { completo: () => !avanti.disabled, mancano, conferma, verifica };
  }
  aggiungiPiede(piede, mancano, avanti);
  verifica();
  ridisegnaPunteggio();

  function setPolso(e, valore) {
    const gruppo = e.target.parentElement;
    for (const b of gruppo.children) b.setAttribute("aria-pressed", "false");
    e.target.setAttribute("aria-pressed", "true");
    stato.polso = valore;
    ridisegnaPunteggio();
    clear(dettaglioPolso);
    if (valore) {
      stato.quando = null;
      stato.intensita = null;
      mostraDettaglioPolso();
    }
    verifica();
  }

  function mostraDettaglioPolso() {
    const premuto = (campo, valore) => (stato[campo] === valore ? "true" : "false");
    clear(dettaglioPolso);
    dettaglioPolso.append(
      h(
        "div.segmented",
        h("button", { "aria-pressed": premuto("quando", "durante"), onclick: (ev) => pick(ev, "quando", "durante") }, "Durante"),
        h("button", { "aria-pressed": premuto("quando", "dopo"), onclick: (ev) => pick(ev, "quando", "dopo") }, "Dopo")
      ),
      h(
        "div.segmented",
        h("button", { "aria-pressed": premuto("intensita", "lieve"), onclick: (ev) => pick(ev, "intensita", "lieve") }, "Lieve"),
        h("button", { "aria-pressed": premuto("intensita", "medio"), onclick: (ev) => pick(ev, "intensita", "medio") }, "Medio"),
        h("button", { "aria-pressed": premuto("intensita", "forte"), onclick: (ev) => pick(ev, "intensita", "forte") }, "Forte")
      )
    );
  }

  function pick(ev, campo, valore) {
    const gruppo = ev.target.parentElement;
    for (const b of gruppo.children) b.setAttribute("aria-pressed", "false");
    ev.target.setAttribute("aria-pressed", "true");
    stato[campo] = valore;
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
      dolorePolso: stato.polso,
      dolorePolsoQuando: stato.quando,
      dolorePolsoIntensita: stato.intensita,
      nota: qs("#nota-es")?.value,
    });
    await avanzaEsercizio();
  }
}

// ---------- cardio ----------

async function vistaCardio(corpo, piede) {
  const r = store.regole().cardio;
  if (S.sed.progresso?.cardioFine) return vistaCardioInCorso(corpo, piede, r);

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
    // Qui la parte pesi è finita e sull'orologio hai il suo riepilogo davanti:
    // è il momento giusto per copiarlo, prima di far partire il cardio.
    bloccoOrologio(S.sed, "pesi", async (orologio) => {
      S.sed = await store.aggiornaSeduta(S.sed.id, { orologio });
    }),
    h(
      "div.group",
      h(
        "div.list",
        h(
          "div.field",
          h("label", "Velocità impostata sul tapis"),
          h(
            "div.stepper",
            h("button", { onclick: () => { kmh = Math.max(0, Math.round((kmh - 0.1) * 10) / 10); valK.textContent = `${num(kmh)} km/h`; controlla(); } }, "−"),
            valK,
            h("button", { onclick: () => { kmh = Math.round((kmh + 0.1) * 10) / 10; valK.textContent = `${num(kmh)} km/h`; controlla(); } }, "+")
          )
        ),
        h(
          "div.field",
          h("label", "Durata"),
          h(
            "div.stepper",
            h("button", { onclick: () => { durata = Math.max(5, durata - 5); valD.textContent = `${durata} min`; controlla(); } }, "−"),
            valD,
            h("button", { onclick: () => { durata += 5; valD.textContent = `${durata} min`; controlla(); } }, "+")
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
              note: qs("#nota-cardio")?.value ?? notaPrec ?? null,
            },
          });
          await salvaProgresso({ cardioInizio: Date.now(), cardioFine: Date.now() + durata * 60000 });
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
            cardio: { ...S.sed.cardio, eseguito: false, saltatoMotivo: motivo },
          });
          await salvaProgresso({ fase: "stretching" });
          await disegna();
        },
      },
      "Non eseguito"
    )
  );
}

/** Cardio in corso: conto alla rovescia sulla durata impostata. */
async function vistaCardioInCorso(corpo, piede, r) {
  const inizio = S.sed.progresso.cardioInizio;
  // La fine vive in memoria e viene salvata in sottofondo: leggere ogni volta
  // il valore salvato farebbe perdere i tocchi rapidi su +5 e −5.
  S.cardioFine = S.sed.progresso.cardioFine;
  const totale = Math.max(1, S.cardioFine - inizio);

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

  aggiungi(corpo,
    h(
      "div.hero",
      h("p.kicker", "Cardio in corso"),
      quadrante,
      h("p.target", `${num(S.sed.cardio.kmh)} km/h · FC ${r.fcMin}-${r.fcMax}, mai sopra ${r.fcLimite}`)
    ),
    h(
      "div.group",
      h(
        "p.footnote",
        { style: "text-align:center" },
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
      const scelta = await chiedi({
        titolo: "Quanto è durato davvero?",
        testo: `Dall'avvio sono passati ${durataUmana(trascorsi * 60)}, ma erano previsti ${previsti} minuti. Se il telefono è rimasto acceso a fine cardio, il conto è più lungo del vero.`,
        opzioni: [
          { etichetta: `${previsti} minuti, come previsto`, valore: "previsti" },
          { etichetta: `${trascorsi} minuti, è giusto`, valore: "trascorsi" },
        ],
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
    S.cardioFine = null;
    await salvaProgresso({ fase: "stretching", cardioInizio: null, cardioFine: null });
    await disegna();
  };

  const pulsante = h("button.btn", { onclick: azione(chiudiCardio) }, "Ho finito");

  aggiungiPiede(piede,
    h(
      "div",
      { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px" },
      h("button.btn.secondary", { onclick: () => spostaCardio(-5) }, "−5 min"),
      h("button.btn.secondary", { onclick: () => spostaCardio(5) }, "+5 min")
    ),
    pulsante
  );

  const aggiorna = () => {
    const restanti = (S.cardioFine - Date.now()) / 1000;
    const quota = Math.max(0, Math.min(1, (restanti * 1000) / totale));
    anelloCardio.style.strokeDashoffset = String(CIRC * (1 - quota));
    if (restanti > 0) {
      testoTimer.textContent = mmss(restanti);
      quadrante.classList.remove("done");
      pulsante.textContent = "Ho finito";
    } else {
      testoTimer.textContent = "00:00";
      quadrante.classList.add("done");
      if (!allarmeAttivo()) avviaAllarme();
      pulsante.textContent = "Ho finito · ferma il suono";
    }
  };
  aggiorna();
  S.timerHandle = setInterval(aggiorna, 250);
}

function spostaCardio(min) {
  const base = Math.max(S.cardioFine || Date.now(), min > 0 ? Date.now() : 0);
  S.cardioFine = Math.max(Date.now(), base + min * 60000);
  if (S.cardioFine > Date.now()) fermaAllarme();
  salvaProgresso({ cardioFine: S.cardioFine });
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
      // I numeri dell'orologio stanno sull'ultimo allungamento: è lì che hai
      // finito di muoverti e ce l'hai ancora al polso col riepilogo aperto.
      i === passi.length - 1 && S.sed.cardio?.eseguito
        ? bloccoOrologio(S.sed, "cardio", async (orologio) => {
            S.sed = await store.aggiornaSeduta(S.sed.id, { orologio });
          })
        : null,
      i === passi.length - 1 && !S.sed.cardio?.previsto
        ? bloccoOrologio(S.sed, "pesi", async (orologio) => {
            S.sed = await store.aggiornaSeduta(S.sed.id, { orologio });
          })
        : null,
    ],
    tastiExtra: () => [
      h(
        "button.btn.secondary",
        {
          onclick: azione(async () => {
            S.sed = await store.aggiornaSeduta(S.sed.id, { stretching: { fatto: false } });
            await salvaProgresso({ fase: "fine" });
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
      await salvaProgresso({ fase: "fine" });
      await disegna();
    },
  });
}

// ---------- stretching di fine seduta ----------

function bloccoStretching() {
  const prot = store.riscaldamento(S.sed.tipoId);
  const voci = prot?.stretchingFinale || [];
  if (!voci.length) return null;

  return h(
    "div.group",
    h("h2", "Stretching di fine allenamento"),
    h(
      "div.guida",
      { style: "margin:0" },
      ...voci.map((s, i) =>
        h(
          "div.passo",
          h("div.n", String(i + 1)),
          h(
            "div.testo",
            h("span.nome", s.nome),
            h("span.dose", s.dose),
            h("span.come", s.come)
          )
        )
      )
    ),
    h("p.footnote", "Adesso ha senso: a muscolo caldo e a lavoro finito, senza togliere forza all'allenamento.")
  );
}

/**
 * I numeri che l'orologio mostra a fine allenamento, scritti a mano.
 * I Comandi Rapidi non sanno leggere gli allenamenti dell'Apple Watch (nella
 * lista dei tipi di dato l'allenamento non esiste), e ricavare i battiti da
 * una finestra di ore darebbe una media sporca. Scriverli qui costa dieci
 * secondi ed è il dato esatto.
 *
 * Sono due blocchi distinti perché l'orologio registra due allenamenti
 * separati: la parte pesi e il cardio, con dati diversi.
 */
const CAMPI_OROLOGIO = {
  pesi: [
    { id: "durata", nome: "Durata allenamento", esempio: "1:35:40", testo: true },
    { id: "kcalAttive", nome: "Chilocalorie attive", unita: "kcal" },
    { id: "kcalTotali", nome: "Chilocalorie totali", unita: "kcal" },
    { id: "fcMedia", nome: "Media battito", unita: "bpm" },
    { id: "fcMax", nome: "Battito massimo", unita: "bpm" },
    { id: "sforzo", nome: "Sforzo", unita: "su 10" },
  ],
  cardio: [
    { id: "durata", nome: "Durata allenamento", esempio: "0:30:13", testo: true },
    { id: "km", nome: "Distanza", unita: "km", dec: 2 },
    { id: "kcalAttive", nome: "Chilocalorie attive", unita: "kcal" },
    { id: "kcalTotali", nome: "Chilocalorie totali", unita: "kcal" },
    { id: "ritmo", nome: "Media ritmo", esempio: "10'02\"", testo: true },
    { id: "fcMedia", nome: "Media battito", unita: "bpm" },
    { id: "sforzo", nome: "Sforzo", unita: "su 10" },
  ],
};

function bloccoOrologio(sed, quale, salva) {
  // Compatibilità con la prima versione, che teneva un blocco solo e piatto.
  const tutto = sed.orologio || {};
  const vecchioPiatto = tutto.fcMedia != null || tutto.fcMax != null || tutto.kcal != null;
  const valori = { ...(quale === "pesi" && vecchioPiatto ? tutto : tutto[quale] || {}) };

  const lista = h("div.list");
  for (const c of CAMPI_OROLOGIO[quale]) {
    // type="text" e tastiera numerica: con type="number" il telefono butta via
    // quello che scrivi appena metti la virgola o i due punti.
    const campo = h("input.val", {
      type: "text",
      inputmode: c.testo ? "text" : "decimal",
      placeholder: c.esempio || "—",
      "aria-label": `${c.nome}${c.unita ? ` in ${c.unita}` : ""}`,
      value: valori[c.id] != null ? (c.testo ? String(valori[c.id]) : num(valori[c.id], c.dec ?? 1)) : "",
      style: c.testo ? "width:120px" : "",
    });
    // Quello che non si riesce a leggere come numero non veniva salvato, ma
    // restava scritto nel campo: sembrava registrato e non lo era. Adesso lo
    // dice, e appena lasci il campo rimette quello che c'è davvero in archivio.
    const avviso = h(
      "p.footnote",
      { style: "margin:2px 16px 6px;color:var(--orange);display:none" },
      ""
    );
    const rimettiSalvato = () => {
      campo.value = valori[c.id] != null ? (c.testo ? String(valori[c.id]) : num(valori[c.id], c.dec ?? 1)) : "";
    };
    campo.addEventListener("input", async () => {
      const t = campo.value.trim();
      if (t === "") valori[c.id] = null;
      else if (c.testo) valori[c.id] = t;
      else {
        const n = Number(t.replace(",", "."));
        if (!Number.isFinite(n) || n < 0) {
          campo.setAttribute("aria-invalid", "true");
          avviso.textContent = `«${t}» non è un numero: il campo resta come prima.`;
          avviso.style.display = "block";
          return;
        }
        // I decimali che servono, campo per campo: la distanza ne vuole due
        // (3,01 km diventava 3) e i battiti nessuno.
        const p10 = 10 ** (c.dec ?? 1);
        valori[c.id] = Math.round(n * p10) / p10;
      }
      campo.removeAttribute("aria-invalid");
      avviso.style.display = "none";
      await salva({ ...tutto, [quale]: { ...valori } });
    });
    // L'avviso resta scritto anche dopo: se il campo si svuotasse in silenzio
    // sembrerebbe di non aver mai scritto niente.
    campo.addEventListener("blur", () => {
      if (campo.getAttribute("aria-invalid") !== "true") return;
      rimettiSalvato();
      campo.removeAttribute("aria-invalid");
    });
    aggiungi(
      lista,
      h("div.field", h("label", `${c.nome}${c.unita ? ` (${c.unita})` : ""}`), h("div.stepper", campo)),
      avviso
    );
  }
  return h(
    "div.group",
    h("h2", quale === "pesi" ? "Dall'orologio — pesi" : "Dall'orologio — cardio"),
    lista,
    h(
      "p.footnote",
      "Copia i numeri dal riepilogo dell'allenamento sull'orologio. Facoltativi: quelli che scrivi finiscono nel pacchetto per il coach."
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

  const polso = logs.filter((l) => l.dolorePolso);

  aggiungi(corpo, 
    h("div.hero", h("p.kicker", "Riepilogo"), h("h2", S.sed.tipoNome)),
    h(
      "div.group",
      h("div.list",
        h("div.row", h("div.main", h("span.title", "Durata")), h("span.value", durataUmana(durataSec))),
        h("div.row", h("div.main", h("span.title", "Serie registrate")), h("span.value", String(serie.length))),
        h("div.row", h("div.main", h("span.title", "Densità")), h("span.value", `${densita} serie/min`)),
        h("div.row", h("div.main", h("span.title", "Recupero medio reale")), h("span.value", recMedio != null ? mmss(recMedio) : "—")),
        S.sed.cardio?.previsto
          ? h("div.row", h("div.main", h("span.title", "Cardio")), h("span.value", S.sed.cardio.eseguito ? `${num(S.sed.cardio.kmh)} km/h · ${S.sed.cardio.durataMin} min` : "non eseguito"))
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
    polso.length
      ? h("div.group", h("h2", "Polso destro"),
          h("div.list", ...polso.map((l) => {
            const def = store.esercizio(l.esercizioId);
            return h("div.row", h("div.main", h("span.title", def?.nome || l.esercizioId)), h("span.pill.bad", `${l.dolorePolsoIntensita} · ${l.dolorePolsoQuando}`));
          }))
        )
      : null,
    mancanti.length
      ? h("div.group", h("h2", "Dati mancanti"), h("div.list", ...mancanti.map((m) => h("div.row", h("div.main", h("span.title", m))))))
      : null,
    bloccoOrologio(S.sed, "pesi", async (orologio) => {
      S.sed = await store.aggiornaSeduta(S.sed.id, { orologio });
    }),
    S.sed.cardio?.previsto || S.sed.cardio?.eseguito
      ? bloccoOrologio(S.sed, "cardio", async (orologio) => {
          S.sed = await store.aggiornaSeduta(S.sed.id, { orologio });
        })
      : null,
    h("p.footnote", { style: "margin:22px 16px 0" }, "Nota generale (dolori, sensazioni — solo se presenti)"),
    h("textarea.note", { id: "nota-seduta", value: S.sed.notaGenerale || "" })
  );

  aggiungiPiede(piede, 
    h("button.btn", {
      onclick: azione(async () => {
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
        await salvaProgresso({
          fase: "esercizio",
          indice: primoAperto >= 0 ? primoAperto : 0,
          recuperoFine: null,
          caricoCorrente: null,
          tsInizioSerie: null,
        });
        await disegna();
      },
    }, "Torna agli esercizi")
  );
}
