import { h, sheet, chiedi, num, dataBreve, dataLunga, isoDate, durataUmana, aggiungi, toast } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";
import { analizza } from "../salute.js";
import { graficoLinea, schedaGrafico, periodoSalvato, selettorePeriodo, inizioPeriodo, etichettaPeriodo } from "../grafico.js";
import { anello, giudizio } from "../punteggio.js";

const NOME_SHORTCUT = "Coach Salute";

export async function render({ ridisegna }) {
  const wrap = h("div.screen");
  const oggiIso = isoDate();
  aggiungi(wrap, intestazione("Salute", { etichetta: "Aggiorna", onclick: () => aggiorna(ridisegna) }));

  const giorni = await store.giorniSalute();
  const notti = await store.notti();
  const imp = await store.impostazioni();

  if (!giorni.length && !notti.length) {
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

  // Ogni scheda ha il suo periodo, ricordato separatamente: si può guardare i
  // passi sul mese e il sonno sugli ultimi sette giorni.
  // Un solo periodo per tutta la schermata e per la Home: ogni selettore lo
  // legge e lo scrive nello stesso posto.
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

  const media = (righe, campo) => {
    // La giornata in corso è a metà: nella media entrerebbe come un giorno
    // fiacco e farebbe sembrare che stai peggiorando. Nel grafico resta.
    const v = righe
      .filter((r) => r.presente && r.data < oggiIso)
      .map((r) => r[campo])
      .filter((x) => x != null);
    return v.length ? { valore: Math.round(v.reduce((a, b) => a + b, 0) / v.length), quanti: v.length } : null;
  };

  const allenati = new Set(
    (await store.allenamenti()).filter((x) => x.stato === "completata").map((x) => x.data)
  );

  // ---- completezza degli allenamenti ----
  const fComp = conPeriodo();
  const chiuse = (await store.allenamenti())
    .filter((x) => x.stato === "completata" && fComp.dentro(x))
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  if (chiuse.length) {
    const voci = [];
    for (const sed of chiuse) {
      const comp = await store.completezzaSeduta(sed.id);
      voci.push({ sed, totale: comp?.totale ?? null });
    }
    const validi = voci.map((v) => v.totale).filter((x) => x != null);
    const mediaComp = validi.length
      ? Math.round(validi.reduce((a, b) => a + b, 0) / validi.length)
      : null;

    const pillola = (n) => {
      const g = giudizio(n);
      return h(
        "span.pill",
        {
          style:
            `font-variant-numeric:tabular-nums;background:${g.livello === 1 ? "var(--fill-tertiary)" : "color-mix(in srgb, var(--accent) 18%, transparent)"};` +
            `color:${g.livello === 1 ? "var(--orange)" : "var(--accent)"}`,
        },
        String(n)
      );
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
            : h("p", { style: "margin:0;text-align:center;color:var(--label-secondary)" }, "Nessun punteggio registrato"),
          h(
            "div.list",
            { style: "margin-top:16px;background:none" },
            ...voci.slice(0, 8).map((v) =>
              h(
                "a.row",
                { href: `#/seduta?riepilogo=${v.sed.id}` },
                h("div.main", h("span.title", v.sed.tipoNome), h("span.sub", dataLunga(v.sed.data))),
                v.totale != null ? pillola(v.totale) : h("span.value", "—"),
                h("span.chevron", "›")
              )
            )
          )
        ),
        h(
          "p.footnote",
          "Quanto ogni allenamento ha rispettato il programma: esercizi, cardio, riscaldamento e stretching. Tocca un allenamento per aprirne il risultato."
        )
      )
    );
  }

  // ---- movimento ----
  const fMov2 = conPeriodo();
  const giorniMov = perGrafico(giorni.filter(fMov2.dentro));
  const mKcal = media(giorniMov, "kcalAttive");
  if (giorniMov.length) {
    aggiungi(wrap,
      schedaGrafico({
        selettore: fMov2.selettore,
        titolo: "Movimento",
        valore: mKcal ? String(mKcal.valore) : "—",
        unita: "kcal",
        nota: mKcal ? `${mKcal.quanti} ${mKcal.quanti === 1 ? "giorno" : "giorni"} con dati · ${fMov2.etichetta}` : `nessun dato · ${fMov2.etichetta}`,
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
  const giorniPassi = perGrafico(giorni.filter(fPassi.dentro));
  const mPassi = media(giorniPassi, "passi");
  if (giorniPassi.some((g) => g.passi != null)) {
    aggiungi(wrap,
      schedaGrafico({
        selettore: fPassi.selettore,
        titolo: "Passi",
        valore: mPassi ? mPassi.valore.toLocaleString("it-IT") : "—",
        nota: mPassi ? `${mPassi.quanti} ${mPassi.quanti === 1 ? "giorno" : "giorni"} con dati · ${fPassi.etichetta}` : `nessun dato · ${fPassi.etichetta}`,
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

  // ---- sonno ----
  const fSonno2 = conPeriodo();
  const nottiOrd = perGrafico(notti.filter(fSonno2.dentro));
  const mSonno = media(nottiOrd, "durataMin");
  if (nottiOrd.length) {
    aggiungi(wrap,
      schedaGrafico({
        selettore: fSonno2.selettore,
        titolo: "Sonno",
        valore: mSonno ? durataUmana(mSonno.valore * 60) : "—",
        nota: mSonno ? `${mSonno.quanti} ${mSonno.quanti === 1 ? "notte" : "notti"} con dati · ${fSonno2.etichetta}` : `nessun dato · ${fSonno2.etichetta}`,
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

  const allenamenti = (await store.db.all("allenamentiWatch")).sort((a, b) => (a.data < b.data ? 1 : -1));
  if (allenamenti.length) {
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Allenamenti dal Watch"),
        h(
          "div.list",
          ...allenamenti.slice(0, 8).map((a) =>
            h(
              "div.row",
              h(
                "div.main",
                h("span.title", `${dataBreve(a.data)} · ${a.tipo || "allenamento"}`),
                h(
                  "span.sub",
                  [
                    a.durataSec ? durataUmana(a.durataSec) : null,
                    a.kcalAttive != null ? `${Math.round(a.kcalAttive)} kcal attive` : null,
                    a.fcMedia != null ? `FC ${Math.round(a.fcMedia)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                )
              ),
              h("span.pill", { class: a.sedutaId ? "pill ok" : "pill" }, a.sedutaId ? "collegato" : "non collegato")
            )
          )
        ),
        h("p.footnote", "Il collegamento con l'allenamento avviene per data, quando quel giorno ce n'è una sola.")
      )
    );
  }

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
    testo: "Il comando rapido legge gli ultimi 30 giorni e copia il risultato negli appunti. Poi torni qui e incolli.",
    shortcut: NOME_SHORTCUT,
  });
}

/**
 * Stesso flusso per qualunque pacchetto: il formato è uno solo e il testo
 * incollato può contenere salute, calendario o tutti e due insieme.
 */
export async function apriImport(ridisegna, { titolo, testo, shortcut }) {
  const scelta = await chiedi({
    titolo,
    testo,
    opzioni: [
      { etichetta: `Apri «${shortcut}»`, valore: "apri" },
      { etichetta: "Ho già copiato: incolla adesso", valore: "incolla" },
    ],
  });
  if (!scelta) return;

  if (scelta === "apri") {
    location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcut)}`;
    return;
  }
  await incolla(ridisegna);
}

async function incolla(ridisegna) {
  let testo = null;
  try {
    testo = await navigator.clipboard.readText();
  } catch {
    testo = null;
  }

  if (!testo) {
    testo = await sheet((close) => {
      const area = h("textarea.note", {
        style: "min-height:160px",
        placeholder: "Incolla qui il testo copiato dal comando rapido",
      });
      return h(
        "div",
        h("h2", "Incolla i dati"),
        h(
          "p",
          { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
          "iOS non ha concesso la lettura automatica degli appunti: incolla a mano nel riquadro."
        ),
        area,
        h("div.btn-wrap", h("button.btn", { onclick: () => close(area.value) }, "Importa"))
      );
    });
  }
  if (!testo) return;

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
        (conteggio.aggiornati ? ` (${conteggio.aggiornati} aggiornati)` : "")
    );
  }
  if (conteggio.notti) righe.push(`${conteggio.notti} ${conteggio.notti === 1 ? "notte" : "notti"} di sonno`);
  if (conteggio.allenamenti) righe.push(`${conteggio.allenamenti} allenamenti dal Watch`);
  if (conteggio.agenda) {
    righe.push(`${conteggio.agenda} ${conteggio.agenda === 1 ? "giorno" : "giorni"} dal calendario`);
  }
  if (conteggio.vuoti) righe.push(`${conteggio.vuoti} giorni senza dati, segnati come non registrati`);
  if (pacchetto.avvisi.length) righe.push(`Avvisi: ${pacchetto.avvisi.slice(0, 3).join(" · ")}`);

  await chiedi({
    titolo: righe.length ? "Importato" : "Niente da importare",
    testo: righe.length ? righe.join("\n") : "Il pacchetto era vuoto.",
    opzioni: [{ etichetta: "Bene", valore: "ok" }],
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
  const esempio = [
    "COACH-SALUTE v1",
    "FINESTRA AAAA-MM-GG AAAA-MM-GG",
    `GIORNO ${oggi} kcal=NNN obiettivo=NNN passi=NNNN esercizio=NN fc=NN`,
    "NOTTE AAAA-MM-GG durata=NNN profondo=NN rem=NN veglia=NN risvegli=N",
    `ALLENAMENTO ${oggi} inizio=HH:MM durata=NNNN kcal=NNN kcalTot=NNN fcMedia=NNN fcMax=NNN tipo="Rafforzamento funzionale"`,
  ].join("\n");

  await sheet((close) =>
    h(
      "div",
      h("h2", "Comando rapido"),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
        "Si costruisce una volta sola nell'app Comandi Rapidi. Prima la sonda, per scoprire cosa il tuo iPhone espone davvero."
      ),

      h(
        "div.group",
        h("h2", "1. La sonda, 5 minuti"),
        h(
          "div.guida",
          { style: "margin:0" },
          passo(1, "Nuovo comando rapido", "App Comandi Rapidi → «+» in alto a destra. Chiamalo «Coach Sonda»."),
          passo(2, "Azione «Trova campioni di salute»", "Tipo: Energia attiva. Ordina per data di inizio, decrescente. Limite: 5."),
          passo(3, "Azione «Ripeti con ciascuno»", "Dentro metti «Ottieni dettagli di campione di salute» e guarda quali voci propone: Valore, Data di inizio, Unità."),
          passo(4, "Azione «Mostra risultato»", "Eseguilo e mandami cosa esce. Da lì scrivo il comando definitivo sui campi che esistono davvero, non su ipotesi.")
        )
      ),

      h(
        "div.group",
        h("h2", "2. Cosa deve produrre"),
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
              h("li", "La prima riga è sempre COACH-SALUTE v1."),
              h("li", "FINESTRA dice quali giorni copre il pacchetto: quelli senza riga GIORNO diventano «non registrati»."),
              h("li", "Sonno in minuti, durata allenamento in secondi."),
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
          passo(1, "Automazione alle 5:00", "Comandi Rapidi → Automazione → Ora del giorno → 05:00 → esegui «Coach Salute», senza chiedere conferma."),
          passo(2, "Ultima azione: Copia negli appunti", "Niente esce dal telefono."),
          passo(3, "Qui: Aggiorna → Incolla", "Se salti dei giorni non perdi niente: la finestra è di 30 giorni e reimportare riscrive senza duplicare.")
        )
      ),

      h("div.btn-wrap", h("button.btn", { onclick: () => close() }, "Chiudi"))
    )
  );
}
