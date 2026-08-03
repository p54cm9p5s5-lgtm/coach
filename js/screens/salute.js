import { h, sheet, chiedi, num, dataBreve, isoDate, durataUmana, aggiungi } from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";
import { analizza } from "../salute.js";
import { graficoBarre, schedaGrafico } from "../grafico.js";

const NOME_SHORTCUT = "Coach Salute";

export async function render({ ridisegna }) {
  const wrap = h("div.screen");
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
    settimane: regole.movimento?.settimane ?? 3,
    minimoSettimana: regole.movimento?.giorniMinSettimana ?? 5,
  });
  const fSonno = store.statoFinestra(notti, {
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

  const obiettivo = imp.obiettivoMovimentoKcal;

  // I giorni arrivano dal più recente: per il grafico servono in ordine di
  // calendario, e senza la coda di giorni vuoti che non racconta niente.
  const perGrafico = (righe) => [...righe].sort((a, b) => (a.data < b.data ? -1 : 1));
  const giorniOrd = perGrafico(giorni);
  const nottiOrd = perGrafico(notti);

  const media = (righe, campo) => {
    const v = righe.filter((r) => r.presente).map((r) => r[campo]).filter((x) => x != null);
    return v.length ? { valore: Math.round(v.reduce((a, b) => a + b, 0) / v.length), quanti: v.length } : null;
  };

  const mKcal = media(giorni, "kcalAttive");
  const mPassi = media(giorni, "passi");
  const mSonno = media(notti, "durataMin");

  const allenati = new Set(
    (await store.allenamenti()).filter((x) => x.stato === "completata").map((x) => x.data)
  );

  // ---- movimento ----
  if (giorniOrd.length) {
    aggiungi(wrap,
      schedaGrafico({
        titolo: "Movimento",
        valore: mKcal ? String(mKcal.valore) : "—",
        unita: "kcal",
        nota: mKcal ? `media su ${mKcal.quanti} ${mKcal.quanti === 1 ? "giorno" : "giorni"}` : "nessun dato",
        grafico: graficoBarre({
          punti: giorniOrd.map((g) => ({
            data: g.data,
            valore: g.presente ? g.kcalAttive : null,
            evidenza: allenati.has(g.data),
            nota: g.presente && g.kcalAttive != null && obiettivo
              ? `${num((g.kcalAttive / (g.obiettivoKcal || obiettivo)) * 100)}% dell'obiettivo`
              : null,
          })),
          obiettivo,
          etichettaObiettivo: `obiettivo ${obiettivo}`,
          formatta: (v) => `${Math.round(v)} kcal`,
        }),
        piede: `Obiettivo Movimento ${obiettivo} kcal. In lime i giorni con allenamento registrato.`,
      })
    );
  }

  // ---- passi ----
  if (giorniOrd.some((g) => g.passi != null)) {
    aggiungi(wrap,
      schedaGrafico({
        titolo: "Passi",
        valore: mPassi ? mPassi.valore.toLocaleString("it-IT") : "—",
        nota: mPassi ? `media su ${mPassi.quanti} ${mPassi.quanti === 1 ? "giorno" : "giorni"}` : "nessun dato",
        grafico: graficoBarre({
          punti: giorniOrd.map((g) => ({
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
  if (nottiOrd.length) {
    aggiungi(wrap,
      schedaGrafico({
        titolo: "Sonno",
        valore: mSonno ? durataUmana(mSonno.valore * 60) : "—",
        nota: mSonno ? `media su ${mSonno.quanti} ${mSonno.quanti === 1 ? "notte" : "notti"}` : "nessun dato",
        grafico: graficoBarre({
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

  // ---- completezza degli allenamenti ----
  const chiuse = (await store.allenamenti())
    .filter((x) => x.stato === "completata")
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  if (chiuse.length) {
    const punti = [];
    for (const sed of chiuse) {
      const comp = await store.completezzaSeduta(sed.id);
      punti.push({ data: sed.data, valore: comp?.totale ?? null, evidenza: true, nota: sed.tipoNome });
    }
    const validi = punti.map((p) => p.valore).filter((v) => v != null);
    const mediaComp = validi.length
      ? Math.round(validi.reduce((a, b) => a + b, 0) / validi.length)
      : null;
    aggiungi(wrap,
      schedaGrafico({
        titolo: "Completezza degli allenamenti",
        valore: mediaComp != null ? String(mediaComp) : "—",
        unita: "su 100",
        nota: `media su ${validi.length} ${validi.length === 1 ? "allenamento" : "allenamenti"}`,
        grafico: graficoBarre({
          punti,
          obiettivo: 100,
          etichettaObiettivo: "100",
          formatta: (v) => `${Math.round(v)} su 100`,
          invito: "Tocca un allenamento per vedere il punteggio",
        }),
        piede: "Quanto ogni allenamento ha rispettato il programma: esercizi, cardio, riscaldamento e stretching.",
      })
    );
  }

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
    await chiedi({ titolo: "Non importato", testo: e.message, opzioni: [{ etichetta: "Ho capito", valore: "ok" }] });
    return;
  }

  const conteggio = await store.importaSalute(pacchetto);
  await store.snapshotAutomatico("import salute");

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
