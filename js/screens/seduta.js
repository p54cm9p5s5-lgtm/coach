import {
  h, qs, clear, toast, mmss, num, chiedi, sheet,
  avviaAllarme, fermaAllarme, allarmeAttivo, sbloccaAudio, unaVoltaSola, tick,
  tieniSchermoAcceso, rilasciaSchermo, durataUmana, isoDate, dataLunga, aggiungi } from "../ui.js";
import { intestazione, ridisegna } from "../app.js";
import * as store from "../store.js";
import { descriviDischi, carichoPiuVicino } from "../plates.js";
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
    return vistaRisultato(p.riepilogo, vaiA);
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
    esercizi: giorno?.esercizi || [],
    vaiA,
    contenitore: h("div.session"),
    recuperoFine: sed.progresso?.recuperoFine || null,
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
          previsto ? previsto.nome : "Riposo"
        ),
        previsto
          ? h(
              "p",
              { style: "margin:6px 0 0;font-size:13px;opacity:.72;text-align:center" },
              `${previsto.esercizi.length} esercizi${previsto.cardio ? " + cardio" : ""}` +
                (fatteOggi.some((s) => s.tipoId === previsto.id) ? " · già completato oggi" : "")
            )
          : h(
              "p",
              { style: "margin:6px 0 0;font-size:13px;color:var(--label-secondary);text-align:center" },
              origine.riposo
                ? "Riposo, dal calendario"
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

async function vistaRisultato(id, vaiA) {
  const wrap = h("div.screen");
  const sed = await store.seduta(id);
  aggiungi(wrap, intestazione("Risultato", { etichetta: "Programma", onclick: () => vaiAlProgramma() }));

  if (!sed) {
    aggiungi(wrap, h("div.empty", h("h3", "Allenamento non trovato")));
    return wrap;
  }

  const serie = await store.serieDi(id);
  const logs = await store.questionariDi(id);
  const durataSec = sed.oraFine ? Math.round((sed.oraFine - sed.oraInizio) / 1000) : null;
  const recuperi = serie.map((s) => s.recuperoRealeSec).filter((x) => x != null);
  const recMedio = recuperi.length ? Math.round(recuperi.reduce((a, b) => a + b, 0) / recuperi.length) : null;
  const bersagli = serie.map((s) => s.recuperoTargetSec).filter((x) => x != null);
  const recTarget = bersagli.length ? Math.round(bersagli.reduce((a, b) => a + b, 0) / bersagli.length) : null;
  // Completezza dell'allenamento intero: esercizi, cardio, riscaldamento e
  // stretching. Il volume totale in kg non guida nessuna decisione — cambia con
  // il numero di esercizi, non con la qualità del lavoro.
  const comp = await store.completezzaSeduta(id);
  const completezza = comp?.totale ?? null;
  const previsti = store.giornoSplit(sed.tipoId)?.esercizi?.length ?? logs.length;
  const svolti = logs.filter((l) => !l.saltato).length;
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
          comp.limite
            ? `Fermo a ${comp.totale}: ${comp.limite.perche}.`
            : comp.totale >= 90
              ? "Allenamento pieno: niente resta indietro."
              : `Il punto debole è ${[...comp.voci].sort((a, b) => a.quota - b.quota)[0].nome.toLowerCase()}.`
        )
      ),
      h("div.group", h("h2", "Da cosa viene il punteggio"), scomposizione(comp))
    );
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
  for (const l of logs) {
    const def = store.esercizio(l.esercizioId);
    if (l.saltato) {
      aggiungi(righe,
        h(
          "div.row",
          h("div.main", h("span.title", def?.nome || l.esercizioId), h("span.sub", `saltato — ${l.saltato.motivo}`)),
          h("span.pill.warn", "non svolto")
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

  if (sed.cardio?.previsto) {
    const r = store.regole().cardio;
    const fuori = sed.cardio.eseguito && sed.cardio.kmh > r.kmhMax;
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
              h("span.title", sed.cardio.eseguito ? `${num(sed.cardio.kmh)} km/h per ${sed.cardio.durataMin} min` : "Non eseguito"),
              h("span.sub", `previsto ${num(r.kmhMin)}-${num(r.kmhMax)} km/h`)
            ),
            fuori ? h("span.pill.warn", "sopra protocollo") : sed.cardio.eseguito ? h("span.pill.ok", "a protocollo") : null
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
      h("button.btn.secondary", { onclick: () => vaiAlProgramma() }, "Programma del giorno"),
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
  const fase = S.sed.progresso?.fase || "riscaldamento";
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
    passo = "Stretching";
    avanzamento = 96;
  } else if (fase === "fine") {
    passo = "Riepilogo";
    avanzamento = 100;
  } else if (fase !== "riscaldamento") {
    passo = `Esercizio ${Math.min(i + 1, n)} di ${n}`;
    avanzamento = n ? 6 + (i / n) * 88 : 6;
  } else {
    avanzamento = 3;
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
      { etichetta: "Salta al cardio", valore: "cardio" },
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

async function vistaRiscaldamento(corpo, piede) {
  const conTapis = S.sed.riscaldamento?.modalita !== "senzaTapis";
  const prot = store.riscaldamento(S.sed.tipoId);
  const camminata = conTapis ? prot?.cardio?.conTapis : prot?.cardio?.senzaTapis;

  const passo = (n, nome, dose, come) =>
    h(
      "div.passo",
      h("div.n", String(n)),
      h(
        "div.testo",
        h("span.nome", nome),
        dose ? h("span.dose", dose) : null,
        come ? h("span.come", come) : null
      )
    );

  const passi = [];
  let n = 1;
  if (camminata) passi.push(passo(n++, camminata.titolo, "5 min", camminata.dettaglio));
  for (const m of prot?.mobilita || []) passi.push(passo(n++, m.nome, m.dose, m.come));
  if (prot?.serieDiAvvicinamento) {
    passi.push(passo(n++, prot.serieDiAvvicinamento.titolo, "1 serie", prot.serieDiAvvicinamento.dettaglio));
  }

  aggiungi(corpo, 
    h(
      "div.hero",
      h("p.kicker", "Prima di iniziare"),
      h("h2", "Riscaldamento"),
      h("p.target", `${S.sed.tipoNome} · ${passi.length} passaggi, circa 10 minuti`)
    ),
    h(
      "div.segmented",
      h(
        "button",
        {
          "aria-pressed": conTapis,
          onclick: async () => {
            S.sed = await store.aggiornaSeduta(S.sed.id, {
              riscaldamento: { ...S.sed.riscaldamento, modalita: "tapis" },
            });
            await disegna();
          },
        },
        "Con tapis"
      ),
      h(
        "button",
        {
          "aria-pressed": !conTapis,
          onclick: async () => {
            S.sed = await store.aggiornaSeduta(S.sed.id, {
              riscaldamento: { ...S.sed.riscaldamento, modalita: "senzaTapis" },
            });
            await disegna();
          },
        },
        "Senza tapis"
      )
    ),
    h("div.guida", { style: "margin-top:12px" }, ...passi),
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
    )
  );

  aggiungi(piede, 
    h(
      "button.btn",
      {
        onclick: azione(async () => {
          sbloccaAudio();
          S.sed = await store.aggiornaSeduta(S.sed.id, {
            riscaldamento: { ...S.sed.riscaldamento, fatto: true },
          });
          await salvaProgresso({ fase: "esercizio", indice: 0 });
          await disegna();
        }),
      },
      "Riscaldamento fatto"
    )
  );
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

  const caricoPrec =
    fatte.at(-1)?.carico ??
    obiettivo?.carico ??
    (await store.ultimoCarico(v.esercizioId, v.carico ?? null));
  S.caricoCorrente = S.caricoCorrente ?? caricoPrec;

  const bersaglio = v.aTempo
    ? `${v.serie} × ${v.durataSec}s`
    : obiettivo?.rip != null
      ? `${v.serie} × ${obiettivo.rip}`
      : `${v.serie} × ${v.ripMin === v.ripMax ? v.ripMin : `${v.ripMin}-${v.ripMax}`}`;

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

  if (obiettivo) {
    aggiungi(
      corpo,
      h("div.plates", h("span.etichetta", "Proposta accettata"), h("b", obiettivo.titolo))
    );
  }

  if (S.caricoCorrente != null && def?.attrezzo === "bilanciere") {
    const d = descriviDischi(S.caricoCorrente, inv);
    aggiungi(corpo, 
      h(
        "div.plates",
        h("span.etichetta", "Da montare"),
        d ? h("b", d) : h("span", "carico non componibile con i dischi disponibili")
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

  aggiungi(piede, 
    h(
      "button.btn",
      {
        onclick: azione(async () => {
          sbloccaAudio();
          await completaSerie(v, def, n);
        }),
      },
      "Serie completata"
    ),
    h(
      "div",
      { style: "display:grid;grid-template-columns:1fr 1fr;gap:8px" },
      h("button.btn.secondary", { onclick: unaVoltaSola(() => modificaCarico(def, inv)) }, "Cambia carico"),
      h("button.btn.secondary", { onclick: unaVoltaSola(() => saltaEsercizio(v, def)) }, "Salta esercizio")
    )
  );
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
      const v = Number(String(campo.value).replace(",", ".").trim());
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
  await disegna();
}

async function completaSerie(v, def, numero) {
  const target = v.aTempo ? v.durataSec : S.obiettivo?.rip ?? v.ripMax ?? v.ripMin;
  const rec = await store.registraSerie({
    sedutaId: S.sed.id,
    esercizioId: v.esercizioId,
    numero,
    carico: S.caricoCorrente ?? null,
    ripFatte: target,
    ripTarget: target,
    aTempo: Boolean(v.aTempo),
    tsInizioSerie: S.tsInizioSerie,
    recuperoTargetSec: def?.recuperoDefaultSec ?? 120,
  });

  const ultima = numero >= v.serie;
  const durata = (S.recuperoTarget ?? def?.recuperoDefaultSec ?? 120) * 1000;
  S.serieCorrenteId = rec.id;
  S.recuperoFine = ultima ? null : Date.now() + durata;
  S.tsInizioSerie = null;

  await salvaProgresso({
    fase: ultima ? "questionario" : "recupero",
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
  if (prossimo >= S.esercizi.length) {
    await salvaProgresso({ fase: S.sed.cardio?.previsto ? "cardio" : "stretching", indice: prossimo });
  } else {
    await salvaProgresso({ fase: "esercizio", indice: prossimo, recuperoFine: null });
  }
  await disegna();
}

// ---------- recupero ----------

async function vistaRecupero(corpo, piede) {
  const v = vocePrevista();
  const def = store.esercizio(v.esercizioId);
  const fatte = await serieFatte(v.esercizioId);
  const ultima = fatte.at(-1);
  // Riletto invece che dato per scontato: se l'app riparte a metà recupero,
  // S è nuovo di zecca e l'obiettivo accettato non deve sparire dallo schermo.
  S.obiettivo = v.aTempo ? null : await store.obiettivoCorrente(v.esercizioId);
  const bersaglio = v.aTempo ? v.durataSec : S.obiettivo?.rip ?? v.ripMax ?? v.ripMin;

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
    `Prossima: serie ${Math.min(fatte.length + 1, v.serie)} di ${v.serie}`
  );
  aggiungi(corpo, h("div.hero", h("p.kicker", "Recupero"), quadrante, sottotitolo));

  // campi della serie appena chiusa
  let rip = ultima?.ripFatte ?? bersaglio;
  let carico = ultima?.carico ?? null;
  const inv = await store.inventario();
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
            h("button", { onclick: async () => { rip = Math.max(0, rip - (v.aTempo ? 5 : 1)); valRip.textContent = `${rip}${v.aTempo ? "s" : ""}`; await salva({ ripFatte: rip }); } }, "−"),
            valRip,
            h("button", { onclick: async () => { rip += v.aTempo ? 5 : 1; valRip.textContent = `${rip}${v.aTempo ? "s" : ""}`; await salva({ ripFatte: rip }); } }, "+")
          )
        ),
        carico != null
          ? h(
              "div.field",
              h("label", "Carico usato"),
              h(
                "div.stepper",
                h("button", { onclick: async () => { carico = bilanciere ? carichoPiuVicino(carico, -1, inv) : Math.max(0, carico - 1); valCar.textContent = `${num(carico)} kg`; S.caricoCorrente = carico; await salva({ carico }); } }, "−"),
                valCar,
                h("button", { onclick: async () => { carico = bilanciere ? carichoPiuVicino(carico, 1, inv) : carico + 1; valCar.textContent = `${num(carico)} kg`; S.caricoCorrente = carico; await salva({ carico }); } }, "+")
              )
            )
          : null
      ),
      h("p.footnote", "I valori sono precompilati con l'obiettivo: correggili solo se hai fatto altro.")
    )
  );

  const pulsante = h("button.btn", { onclick: azione(chiudiRecupero) }, "Pronto");
  aggiungi(piede, 
    h(
      "div",
      { style: "display:grid;grid-template-columns:1fr 1fr;gap:8px" },
      h("button.btn.secondary", { onclick: () => spostaTimer(-15) }, "−15 s"),
      h("button.btn.secondary", { onclick: () => spostaTimer(15) }, "+15 s")
    ),
    pulsante
  );

  const totale = (ultima?.recuperoTargetSec || def?.recuperoDefaultSec || 120) * 1000;

  const aggiorna = () => {
    if (!S.recuperoFine) return;
    const restanti = (S.recuperoFine - Date.now()) / 1000;
    const quota = Math.max(0, Math.min(1, (restanti * 1000) / totale));
    anello.style.strokeDashoffset = String(CIRC * (1 - quota));

    if (restanti > 0) {
      testoTimer.textContent = mmss(restanti);
      quadrante.classList.remove("done");
      testoTimer.classList.remove("done");
      if (restanti <= 3.05 && restanti > 2.95) tick();
      pulsante.textContent = "Pronto";
    } else {
      testoTimer.textContent = "00:00";
      quadrante.classList.add("done");
      testoTimer.classList.add("done");
      if (!allarmeAttivo()) {
        avviaAllarme();
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
  S.tsInizioSerie = Date.now();
  S.recuperoFine = null;
  await salvaProgresso({ fase: "esercizio", recuperoFine: null, tsInizioSerie: S.tsInizioSerie });
  await disegna();
}

// ---------- questionario ----------

async function vistaQuestionario(corpo, piede) {
  const v = vocePrevista();
  const def = store.esercizio(v.esercizioId);

  const stato = { rpe: null, tecnica: null, polso: null, quando: null, intensita: null };

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

  const verifica = () => {
    const ok =
      stato.rpe != null &&
      stato.tecnica != null &&
      stato.polso != null &&
      (stato.polso === false || (stato.quando && stato.intensita));
    avanti.disabled = !ok;
  };

  const righello = (onPick, zona) => {
    const box = h("div.scale");
    for (let i = 1; i <= 10; i++) {
      const b = h(
        "button",
        {
          "aria-pressed": "false",
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

  const calcolaPunteggio = () =>
    punteggioEsercizio({
      variante: v,
      serie: serieFatteQui,
      rpe: stato.rpe,
      tecnica: stato.tecnica,
      dolorePolso: stato.polso === true,
      regole: regoleOra,
    });

  const ridisegnaPunteggio = () => {
    const r = calcolaPunteggio();
    clear(zonaPunteggio);
    aggiungi(zonaPunteggio,
      anello(r.totale),
      legendaPunteggio(),
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
    let rip = ultimaSerie.ripFatte ?? (v.aTempo ? v.durataSec : v.ripMax ?? v.ripMin);
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
                  rip += v.aTempo ? 5 : 1;
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
                  h("button", {
                    onclick: async () => {
                      carico = Math.max(0, Math.round((carico - 0.5) * 10) / 10);
                      valCar.textContent = `${num(carico)} kg`;
                      await salvaUltima({ carico });
                    },
                  }, "−"),
                  valCar,
                  h("button", {
                    onclick: async () => {
                      carico = Math.round((carico + 0.5) * 10) / 10;
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
    h("div.hero", { style: "padding-bottom:2px" }, h("p.kicker", "Fine esercizio"), h("h2", def?.nome || v.esercizioId)),
    zonaPunteggio,
    correzione,

    h("p.footnote", { style: "margin:14px 16px 0" }, "Quanto è stata dura l'ultima serie?"),
    righello((i) => {
      stato.rpe = i;
      hintRpe.textContent = RIR[i] || "molto lontano dal limite";
    }, [zona.min, zona.max]),
    hintRpe,
    h("p.footnote", { style: "margin:6px 16px 0;text-align:center" }, `Zona prevista dal programma: ${zona.min}-${zona.max}`),

    h("p.footnote", { style: "margin:22px 16px 0" }, "Com'è andata la tecnica?"),
    righello((i) => {
      stato.tecnica = i;
      hintTec.textContent =
        i >= 8 ? "pulita" : i >= 5 ? "qualche cedimento" : "tecnica insufficiente";
    }),
    hintTec,

    h("p.footnote", { style: "margin:22px 16px 0" }, `Dolore al polso destro?${def?.sollecitaPolso ? " (esercizio che lo sollecita)" : ""}`),
    h(
      "div.segmented.danger",
      h("button", { "aria-pressed": "false", onclick: (e) => setPolso(e, false) }, "NO"),
      h("button", { "aria-pressed": "false", onclick: (e) => setPolso(e, true) }, "SÌ")
    ),
    dettaglioPolso,

    h("p.footnote", { style: "margin:22px 16px 0" }, "Nota (facoltativa — vuota significa nessun segnale)"),
    h("textarea.note", { id: "nota-es", placeholder: "Solo se c'è qualcosa da segnalare" })
  );

  aggiungi(piede, avanti);
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
      dettaglioPolso.append(
        h(
          "div.segmented",
          h("button", { "aria-pressed": "false", onclick: (ev) => pick(ev, "quando", "durante") }, "Durante"),
          h("button", { "aria-pressed": "false", onclick: (ev) => pick(ev, "quando", "dopo") }, "Dopo")
        ),
        h(
          "div.segmented",
          h("button", { "aria-pressed": "false", onclick: (ev) => pick(ev, "intensita", "lieve") }, "Lieve"),
          h("button", { "aria-pressed": "false", onclick: (ev) => pick(ev, "intensita", "medio") }, "Medio"),
          h("button", { "aria-pressed": "false", onclick: (ev) => pick(ev, "intensita", "forte") }, "Forte")
        )
      );
    }
    verifica();
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

  const controlla = () => {
    if (kmh > r.kmhMax) {
      avviso.textContent = `Sopra protocollo: previsto ${num(r.kmhMin)}-${num(r.kmhMax)} km/h. Il cardio non deve essere il lavoro più duro della giornata.`;
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
            h("button", { onclick: () => { durata = Math.max(5, durata - 5); valD.textContent = `${durata} min`; } }, "−"),
            valD,
            h("button", { onclick: () => { durata += 5; valD.textContent = `${durata} min`; } }, "+")
          )
        )
      ),
      avviso
    ),
    h("textarea.note", { id: "nota-cardio", placeholder: "Nota sul cardio (facoltativa)" })
  );
  controlla();

  aggiungi(piede,
    h(
      "button.btn",
      {
        onclick: azione(async () => {
          sbloccaAudio();
          S.sed = await store.aggiornaSeduta(S.sed.id, {
            // durataPrevistaMin resta quella scelta alla partenza: serve per
          // sapere quanto del cardio è stato davvero fatto.
          cardio: { ...S.sed.cardio, kmh, durataMin: durata, durataPrevistaMin: durata, note: qs("#nota-cardio")?.value || null },
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
    const trascorsi = Math.max(1, Math.round((Date.now() - inizio) / 60000));
    S.sed = await store.aggiornaSeduta(S.sed.id, {
      cardio: { ...S.sed.cardio, eseguito: true, durataMin: trascorsi },
    });
    S.cardioFine = null;
    await salvaProgresso({ fase: "stretching", cardioInizio: null, cardioFine: null });
    await disegna();
  };

  const pulsante = h("button.btn", { onclick: azione(chiudiCardio) }, "Ho finito");

  aggiungi(piede,
    h(
      "div",
      { style: "display:grid;grid-template-columns:1fr 1fr;gap:8px" },
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
  const prot = store.riscaldamento(S.sed.tipoId);
  const voci = prot?.stretchingFinale || [];

  const passo = (n, nome, dose, come) =>
    h(
      "div.passo",
      h("div.n", String(n)),
      h(
        "div.testo",
        h("span.nome", nome),
        dose ? h("span.dose", dose) : null,
        come ? h("span.come", come) : null
      )
    );

  aggiungi(corpo,
    h(
      "div.hero",
      h("p.kicker", "Ultimo passo"),
      h("h2", "Stretching"),
      h("p.target", `${S.sed.tipoNome} · ${voci.length} allungamenti, circa 3 minuti`)
    ),
    voci.length
      ? h("div.guida", { style: "margin-top:12px" }, ...voci.map((v, i) => passo(i + 1, v.nome, v.dose, v.come)))
      : h("div.group", h("div.list", h("div.row", h("div.main", h("span.title", "Nessun allungamento previsto per questo giorno"))))),
    h(
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
  );

  aggiungi(piede,
    h(
      "button.btn",
      {
        onclick: azione(async () => {
          S.sed = await store.aggiornaSeduta(S.sed.id, {
            stretching: { fatto: true, quando: Date.now() },
          });
          await salvaProgresso({ fase: "fine" });
          await disegna();
        }),
      },
      "Stretching fatto"
    ),
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
    )
  );
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

// ---------- riepilogo ----------

async function vistaFine(corpo, piede) {
  const serie = await store.serieDi(S.sed.id);
  const logs = await store.questionariDi(S.sed.id);
  const durataSec = Math.round(((S.sed.oraFine || Date.now()) - S.sed.oraInizio) / 1000);
  const recuperi = serie.map((s) => s.recuperoRealeSec).filter((x) => x != null);
  const recMedio = recuperi.length ? Math.round(recuperi.reduce((a, b) => a + b, 0) / recuperi.length) : null;
  const densita = durataSec > 0 ? (serie.length / (durataSec / 60)).toFixed(2).replace(".", ",") : "—";

  const mancanti = [];
  for (const v of S.esercizi) {
    const log = logs.find((l) => l.esercizioId === v.esercizioId);
    const def = store.esercizio(v.esercizioId);
    if (!log) mancanti.push(`${def?.nome || v.esercizioId}: nessun dato`);
    else if (log.saltato) mancanti.push(`${def?.nome || v.esercizioId}: saltato (${log.saltato.motivo})`);
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
    h("p.footnote", { style: "margin:22px 16px 0" }, "Nota generale (dolori, sensazioni — solo se presenti)"),
    h("textarea.note", { id: "nota-seduta", value: S.sed.notaGenerale || "" })
  );

  aggiungi(piede, 
    h("button.btn", {
      onclick: azione(async () => {
        await store.chiudiSeduta(S.sed.id, { notaGenerale: qs("#nota-seduta")?.value || null });
        await store.snapshotAutomatico("fine allenamento");
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
        await salvaProgresso({ fase: "esercizio", indice: 0 });
        await disegna();
      },
    }, "Torna agli esercizi")
  );
}
