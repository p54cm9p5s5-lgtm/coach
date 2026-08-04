import {
  h, toast, sheet, chiedi, clear, num, dataBreve, dataLunga, isoDate, giorniTra, aggiungi, unaVoltaSola,
} from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";

// `caloBuono` dice da che parte è il miglioramento: scendere di vita è un
// progresso, scendere di bicipite no. Senza, la pastiglia verde compariva
// anche quando perdevi massa.
const MISURE = [
  { id: "peso", nome: "Peso", unita: "kg", passo: 0.1, primaria: true, caloBuono: true },
  { id: "vitaOmbelico", nome: "Vita ombelico", unita: "cm", passo: 0.5, primaria: true, caloBuono: true },
  { id: "vitaStretta", nome: "Vita punto stretto", unita: "cm", passo: 0.5, caloBuono: true },
  { id: "fianchi", nome: "Fianchi", unita: "cm", passo: 0.5, caloBuono: true },
  { id: "petto", nome: "Petto", unita: "cm", passo: 0.5, caloBuono: false },
  { id: "bicipiteRilassato", nome: "Bicipite rilassato", unita: "cm", passo: 0.5, caloBuono: false },
  { id: "coscia", nome: "Coscia", unita: "cm", passo: 0.5, caloBuono: false },
];

const CONDIZIONI = [
  ["mattina", "Appena sveglio"],
  ["digiuno", "A digiuno"],
  ["dopoBagno", "Dopo il bagno"],
  ["primaDiBere", "Prima di bere"],
];

const CONDIZIONI_FOTO = [
  ["mattina", "Mattina, appena sveglio"],
  ["digiuno", "A digiuno, dopo il bagno"],
  ["stessaLuce", "Tapparella chiusa, stessa lampada"],
  ["stessoPunto", "Stesso punto segnato sul pavimento"],
  ["pose", "Le quattro pose come le fai tu, respiro normale"],
];

export async function render({ ridisegna }) {
  const wrap = h("div.screen");
  aggiungi(wrap, intestazione("Corpo", { etichetta: "Registra", onclick: unaVoltaSola(() => registra(ridisegna)) }));

  const tutte = await store.misure();
  const perTipo = new Map();
  for (const m of tutte) {
    if (!perTipo.has(m.tipo)) perTipo.set(m.tipo, []);
    perTipo.get(m.tipo).push(m);
  }

  if (!tutte.length) {
    aggiungi(wrap,
      h(
        "div.empty",
        h("h3", "Nessuna misura"),
        h("p", "Registra peso e circonferenze sempre nelle stesse condizioni: al mattino, a digiuno, dopo il bagno, prima di bere."),
        h("div.btn-wrap", h("button.btn", { onclick: () => registra(ridisegna) }, "Registra le prime misure"))
      )
    );
    aggiungi(wrap, await bloccoFoto(ridisegna));
    return wrap;
  }

  // ---- metriche principali ----
  const carte = h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:8px 16px 0" });
  for (const def of MISURE.filter((m) => m.primaria)) {
    const righe = perTipo.get(def.id) || [];
    const ultima = righe[0];
    const prec = righe[1];
    const delta = ultima && prec ? ultima.valore - prec.valore : null;
    aggiungi(carte,
      h(
        "div",
        { style: "background:var(--bg-grouped);border-radius:12px;padding:14px" },
        h("p", { style: "margin:0;font-size:12px;color:var(--label-secondary)" }, def.nome),
        h(
          "p",
          { style: "margin:6px 0 0;font-size:28px;font-weight:700;letter-spacing:-0.6px;font-variant-numeric:tabular-nums" },
          ultima ? num(ultima.valore) : "—",
          h("span", { style: "font-size:14px;font-weight:400;color:var(--label-secondary)" }, ` ${def.unita}`)
        ),
        h(
          "p",
          { style: "margin:4px 0 0;font-size:12px;color:var(--label-secondary)" },
          ultima ? dataBreve(ultima.data) : "mai",
          delta !== null ? ` · ${delta > 0 ? "+" : ""}${num(delta)} ${def.unita}` : ""
        )
      )
    );
  }
  aggiungi(wrap,
    h("div.group", { style: "margin-bottom:0" }, h("h2", "Metriche principali")),
    carte
  );

  // ---- tutte le misure ----
  const lista = h("div.list");
  for (const def of MISURE) {
    const righe = perTipo.get(def.id) || [];
    const ultima = righe[0];
    const prec = righe[1];
    const delta = ultima && prec ? ultima.valore - prec.valore : null;
    // Un confronto fra una misura a protocollo e una fuori protocollo non è un
    // progresso: è rumore. Si mostra, ma senza colore e detto chiaramente.
    const confrontabile = ultima?.condizioniStandard !== false && prec?.condizioniStandard !== false;
    aggiungi(lista,
      h(
        "div.row",
        h(
          "div.main",
          h("span.title", def.nome),
          h(
            "span.sub",
            ultima
              ? `${dataBreve(ultima.data)}${ultima.condizioniStandard === false ? " · fuori protocollo" : ""}` +
                // Un punto interrogativo accanto alla differenza non spiega
                // niente: se il confronto non vale, va detto con le parole.
                (delta !== null && delta !== 0 && !confrontabile ? " · confronto non valido" : "")
              : "mai registrata"
          )
        ),
        h("span.value", ultima ? `${num(ultima.valore)} ${def.unita}` : "—"),
        delta !== null && delta !== 0
          ? h(
              "span.pill",
              {
                class: !confrontabile
                  ? "pill"
                  : (delta < 0) === (def.caloBuono !== false)
                    ? "pill ok"
                    : "pill warn",
              },
              `${delta > 0 ? "+" : ""}${num(delta)}`
            )
          : null
      )
    );
  }
  aggiungi(wrap,
    h(
      "div.group",
      h("h2", "Tutte le misure"),
      lista,
      h("p.footnote", "La vita all'ombelico vede prima di tutto il resto: a mezzo chilo a settimana la bilancia e le foto restano indietro.")
    )
  );

  // ---- indici ----
  const ind = store.indici({
    altezzaCm: store.programma()?.atleta?.altezzaCm,
    peso: perTipo.get("peso")?.[0]?.valore,
    vitaOmbelico: perTipo.get("vitaOmbelico")?.[0]?.valore,
    fianchi: perTipo.get("fianchi")?.[0]?.valore,
  });
  // Gli indici nascono dall'ultima misura di ciascun tipo, e quelle misure
  // possono essere di giorni diversi: un vita/fianchi fra una vita di ieri e
  // dei fianchi di un mese fa non è una fotografia di oggi. Va detto.
  const dataDi = (tipo) => perTipo.get(tipo)?.[0]?.data || null;
  const INGREDIENTI = { vitaAltezza: ["vitaOmbelico"], vitaFianchi: ["vitaOmbelico", "fianchi"], bmi: ["peso"] };
  const quando = (id) => {
    const d = (INGREDIENTI[id] || []).map(dataDi).filter(Boolean);
    const uniche = [...new Set(d)].sort();
    if (!uniche.length) return "";
    return uniche.length === 1
      ? `misure del ${dataBreve(uniche[0])}`
      : `misure di giorni diversi: ${uniche.map(dataBreve).join(" e ")}`;
  };
  if (ind.length) {
    const listaInd = h("div.list");
    for (const i of ind) {
      aggiungi(listaInd,
        h(
          "div.row",
          h("div.main", h("span.title", i.nome), h("span.sub", i.nota), quando(i.id) ? h("span.sub", quando(i.id)) : null),
          h("span.value", num(i.valore, i.decimali)),
          h("span.pill", { class: i.sopraSoglia ? "pill warn" : "pill ok" }, i.sopraSoglia ? "sopra soglia" : "sotto")
        )
      );
    }
    aggiungi(wrap,
      h(
        "div.group",
        h("h2", "Indici"),
        listaInd,
        h("p.footnote", "Indicatori di struttura, non una diagnosi.")
      )
    );
  }

  aggiungi(wrap, await bloccoFoto(ridisegna));
  return wrap;
}

// ---------- registrazione misure ----------

async function registra(ridisegna) {
  const valori = {};
  for (const def of MISURE) {
    const m = await store.ultimaMisura(def.id);
    valori[def.id] = m ? m.valore : null;
  }

  const scelte = new Set();
  // Quello che è scritto nei campi ma non è un numero: veniva ignorato in
  // silenzio, e chi aveva sbagliato a scrivere leggeva «Misure registrate»
  // credendo che ci fosse anche quella.
  const nonValidi = new Map();
  let salvato = false;

  await sheet((close) => {
    const campi = h("div.list");
    for (const def of MISURE) {
      // Il valore si scrive: la prima misura partiva da zero e per arrivare a
      // 84,5 cm servivano centosettanta tocchi. I tasti − e + restano per le
      // correzioni piccole.
      // type="text" e non "number": con "number" il telefono butta via quello
      // che scrivi appena metti la virgola, e «84,5» diventava niente. La
      // tastiera numerica arriva lo stesso da inputmode.
      const val = h("input.val", {
        type: "text",
        inputmode: "decimal",
        "aria-label": `${def.nome} in ${def.unita}`,
        placeholder: "—",
        value: valori[def.id] != null ? num(valori[def.id]) : "",
      });
      const mostra = () => {
        // Si scrive con la virgola e si rilegge con la virgola: vedere «84.6»
        // dopo aver scritto «84,5» fa pensare che il telefono abbia capito altro.
        val.value = valori[def.id] != null ? num(valori[def.id]) : "";
        val.style.color = scelte.has(def.id) ? "var(--accent)" : "";
      };
      const aggiorna = (d) => {
        // Senza una misura di partenza − e + non hanno da cosa partire: invece
        // di registrare uno zero che non hai mai misurato, aprono la tastiera.
        if (valori[def.id] == null) {
          val.focus();
          return;
        }
        valori[def.id] = Math.max(0, Math.round((valori[def.id] + d) * 10) / 10);
        scelte.add(def.id);
        mostra();
      };
      val.addEventListener("input", () => {
        const n = parseFloat(val.value.replace(",", "."));
        if (val.value.trim() === "") {
          valori[def.id] = null;
          scelte.delete(def.id);
          nonValidi.delete(def.id);
          val.style.color = "";
          return;
        }
        if (!Number.isFinite(n) || n < 0) {
          nonValidi.set(def.id, def.nome);
          val.style.color = "var(--orange)";
          return;
        }
        nonValidi.delete(def.id);
        valori[def.id] = Math.round(n * 10) / 10;
        scelte.add(def.id);
        val.style.color = "var(--accent)";
      });
      aggiungi(campi,
        h(
          "div.field",
          h("label", `${def.nome} (${def.unita})`),
          h(
            "div.stepper",
            h("button", { "aria-label": `meno ${def.passo}`, onclick: () => aggiorna(-def.passo) }, "−"),
            val,
            h("button", { "aria-label": `più ${def.passo}`, onclick: () => aggiorna(def.passo) }, "+")
          )
        )
      );
    }

    const stato = {};
    const condizioni = h("div.checklist");
    for (const [id, testo] of CONDIZIONI) {
      stato[id] = true;
      const box = h("input", { type: "checkbox", checked: true });
      box.addEventListener("change", () => {
        stato[id] = box.checked;
      });
      aggiungi(condizioni, h("label", box, h("span", testo)));
    }

    return h(
      "div",
      h("h2", "Registra misure"),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
        "I valori partono dall'ultima volta: tocca solo quelli cambiati."
      ),
      h("div.group", { style: "margin-top:14px" }, campi),
      h(
        "div.group",
        h("h2", "Condizioni"),
        condizioni,
        h("p.footnote", "Se una condizione manca, il dato viene salvato e segnato come non confrontabile.")
      ),
      h(
        "div.btn-wrap",
        h(
          "button.btn",
          {
            onclick: async () => {
              // Prima di salvare: quello che non è un numero non entra, e va
              // detto adesso, non scoperto dopo guardando l'elenco.
              if (nonValidi.size) {
                toast(`Non è un numero: ${[...nonValidi.values()].join(", ")}. Correggi o svuota il campo.`);
                return;
              }
              if (!scelte.size) {
                toast("Non hai modificato nessuna misura.");
                return;
              }
              const standard = Object.values(stato).every(Boolean);
              let entrate = 0;
              try {
                for (const id of scelte) {
                  await store.registraMisura({ tipo: id, valore: valori[id], condizioniStandard: standard });
                  entrate++;
                }
              } catch (e) {
                // Se l'archivio rifiuta una misura bisogna sapere quali sono
                // entrate: prima il pannello si chiudeva come se fosse andato
                // tutto bene e mancavano dei numeri senza spiegazione.
                await chiedi({
                  titolo: "Misure salvate solo in parte",
                  testo: `Ne sono entrate ${entrate} su ${scelte.size}: ${e.message}. Riapri «Registra» e reinserisci quelle che mancano.`,
                  opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
                });
              }
              salvato = entrate > 0;
              close();
            },
          },
          "Salva"
        )
      )
    );
  });

  if (salvato) {
    try {
      await store.snapshotAutomatico("misure");
    } catch {
      // La copia interna è una comodità: se non riesce, le misure sono già
      // salvate e l'operazione non va fatta fallire per questo.
    }
    toast("Misure registrate.");
    await ridisegna();
  }
}

// ---------- foto ----------

async function bloccoFoto(ridisegna) {
  const set = await store.setFoto();
  const gruppo = h("div.group", h("h2", "Foto"));

  if (!set.length) {
    aggiungi(gruppo,
      h(
        "div.list",
        h(
          "div.row",
          h("div.main", h("span.title", "Nessun set"), h("span.sub", "4 pose, stesse condizioni, ogni 2 settimane"))
        )
      )
    );
  } else {
    for (const s of set.slice(0, 4)) {
      const griglia = h("div.foto-griglia", { style: "margin-top:8px" });
      for (const posa of store.POSE) {
        const scatto = s.scatti.find((x) => x.posa === posa.id);
        aggiungi(griglia,
          h(
            "button.foto-cella",
            { onclick: () => mostraFoto(scatto, posa) },
            scatto ? h("img", { src: scatto.immagine, alt: posa.nome, loading: "lazy" }) : h("span.vuota", posa.nome)
          )
        );
      }
      const daLibreria = s.scatti.some((x) => x.checklist?.daLibreria);
      aggiungi(gruppo,
        h(
          "div",
          { style: "display:flex;align-items:baseline;justify-content:space-between;margin:14px 4px 0;gap:10px" },
          h(
            "p",
            { style: "margin:0;font-size:13px;color:var(--label-secondary)" },
            `${dataLunga(s.data)}${daLibreria ? " · set di riferimento" : ""}`
          ),
          h(
            "button",
            {
              style: "background:none;border:0;padding:0;color:var(--red);font-size:13px;font:inherit;font-size:13px",
              onclick: async () => {
                const c = await chiedi({
                  titolo: `Eliminare il set del ${dataBreve(s.data)}?`,
                  testo: `${s.scatti.length} ${s.scatti.length === 1 ? "foto" : "foto"} di quel giorno. Non si recupera.`,
                  opzioni: [{ etichetta: "Elimina il set", valore: "si", stile: "danger" }],
                });
                if (c !== "si") return;
                for (const x of s.scatti) await store.db.del("foto", x.id);
                toast("Set eliminato.");
                await ridisegna();
              },
            },
            "Elimina"
          )
        ),
        griglia
      );
    }
  }

  const ultimo = set[0];
  const giorni = ultimo ? giorniTra(ultimo.data, isoDate()) : null;

  aggiungi(gruppo,
    h(
      "div.btn-wrap",
      { style: "margin-left:0;margin-right:0" },
      h("button.btn", { onclick: unaVoltaSola(() => nuovoSet(ridisegna)) }, ultimo ? "Nuovo set di foto" : "Primo set di foto"),
      h("div", { style: "height:8px" }),
      h("button.btn.secondary", { onclick: unaVoltaSola(() => importaSet(ridisegna)) }, "Usa foto che hai già")
    ),
    h(
      "p.footnote",
      ultimo
        ? `Ultimo set ${giorni} giorni fa. Cadenza prevista: ogni 14 giorni.`
        : "Senza protocollo identico le foto non sono confrontabili: è lo strumento meno sensibile che hai."
    )
  );
  return gruppo;
}

async function mostraFoto(scatto, posa) {
  if (!scatto) return;
  await sheet((close) =>
    h(
      "div",
      h("h2", `${posa.nome} · ${dataBreve(scatto.data)}`),
      scatto.checklist?.daLibreria
        ? h(
            "p",
            { style: "margin:6px 16px 0;font-size:13px;color:var(--label-secondary)" },
            "Fa parte del set di riferimento: le prossime foto vanno fatte con questa stessa posa, stessa distanza, stessa luce."
          )
        : null,
      h("img", {
        src: scatto.immagine,
        alt: posa.nome,
        style: "width:calc(100% - 32px);margin:12px 16px 0;border-radius:12px;display:block",
      }),
      h(
        "div.btn-wrap",
        h(
          "button.btn.destructive",
          {
            onclick: async () => {
              const c = await chiedi({
                titolo: "Eliminare questa foto?",
                opzioni: [{ etichetta: "Elimina", valore: "si", stile: "destructive" }],
              });
              if (c === "si") {
                await store.db.del("foto", scatto.id);
                close();
                location.reload();
              }
            },
          },
          "Elimina"
        )
      )
    )
  );
}

async function nuovoSet(ridisegna) {
  const oggi = isoDate();

  const pronto = await sheet((close) => {
    const stato = {};
    const lista = h("div.checklist");
    const avanti = h("button.btn", { disabled: true, onclick: () => close("si") }, "Inizia");
    const verifica = () => {
      avanti.disabled = !CONDIZIONI_FOTO.every(([id]) => stato[id]);
    };
    for (const [id, testo] of CONDIZIONI_FOTO) {
      stato[id] = false;
      const box = h("input", { type: "checkbox" });
      box.addEventListener("change", () => {
        stato[id] = box.checked;
        verifica();
      });
      aggiungi(lista, h("label", box, h("span", testo)));
    }
    return h(
      "div",
      h("h2", "Protocollo foto"),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
        "Ripeti le stesse pose del set di riferimento. Devono essere tutte spuntate."
      ),
      h("div.group", { style: "margin-top:12px" }, lista),
      h("div.btn-wrap", avanti)
    );
  });
  if (pronto !== "si") return;

  let fatte = 0;
  for (const posa of store.POSE) {
    const sagoma = await store.ultimaFoto(posa.id, oggi);
    const immagine = await cattura(posa, sagoma);
    if (!immagine) break;
    try {
      await store.registraFoto({ data: oggi, posa: posa.id, immagine, checklist: { protocollo: true } });
      fatte++;
    } catch (e) {
      // Se l'archivio rifiuta la foto (spazio finito, quasi sempre) tacere
      // sarebbe il peggio: ti ritroveresti un set che credi fatto e non c'è.
      await chiedi({
        titolo: "Foto non salvata",
        testo: `«${posa.nome}» non è entrata nell'archivio: ${e.message}. Di solito è lo spazio del telefono. Libera spazio e rifai il set: le pose già salvate restano.`,
        opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      });
      break;
    }
  }

  if (fatte) {
    try {
      await store.snapshotAutomatico("foto");
    } catch {
      // la copia interna è una comodità: le foto sono già salvate
    }
    toast(fatte === store.POSE.length ? "Set completo." : `Set parziale: ${fatte} pose su ${store.POSE.length}.`);
  }
  await ridisegna();
}

/**
 * Foto già scattate, prese dalla libreria. Servono soprattutto come
 * riferimento: una volta dentro, la vista guidata le sovrappone in trasparenza
 * agli scatti successivi. Non passano dal protocollo, e restano marcate come
 * tali: confrontare una foto qualunque con una fatta a regola d'arte darebbe
 * una differenza che non è la tua.
 */
async function importaSet(ridisegna) {
  const scelte = new Map();

  const esito = await sheet((close) => {
    const campoData = h("input", {
      type: "date",
      value: isoDate(),
      max: isoDate(),
      style:
        "width:100%;padding:12px;border-radius:10px;border:0;background:var(--fill-tertiary);color:var(--label);font:inherit",
    });

    const salva = h("button.btn", { disabled: true, onclick: () => close(campoData.value || isoDate()) }, "Salva il riferimento");
    const verifica = () => {
      salva.disabled = scelte.size === 0;
      salva.textContent = scelte.size
        ? `Salva ${scelte.size} ${scelte.size === 1 ? "posa" : "pose"}`
        : "Salva il riferimento";
    };

    const lista = h("div.list");
    for (const posa of store.POSE) {
      const anteprima = h("span.value", "—");
      const riga = h(
        "button.row.accent",
        {
          onclick: async () => {
            // Prima si dice quale posa serve, poi si apre la libreria: così
            // non si carica una foto senza sapere dove va a finire.
            const immagine = await catturaDaFile(posa);
            if (!immagine) return;
            scelte.set(posa.id, immagine);
            clear(anteprima);
            anteprima.append(
              h("img", {
                src: immagine,
                alt: posa.nome,
                style: "width:34px;height:46px;object-fit:cover;border-radius:6px;display:block",
              })
            );
            verifica();
          },
        },
        h("div.main", h("span.title", posa.nome), h("span.sub", posa.come)),
        anteprima,
        h("span.chevron", "›")
      );
      aggiungi(lista, riga);
    }

    return h(
      "div",
      h("h2", "Usa foto che hai già"),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
        "Queste diventano il set di riferimento: dal prossimo set la fotocamera guidata te le sovrappone per ripetere posa e distanza. Carica solo quelle che hai."
      ),
      h("div.group", { style: "margin-top:12px" }, lista),
      h(
        "div.group",
        h("div", { style: "padding:0 16px" },
          h("p", { style: "margin:0 0 6px;font-size:13px;color:var(--label-secondary)" }, "Quando sono state scattate"),
          campoData
        )
      ),
      h(
        "p.footnote",
        { style: "margin-top:12px" },
        "Sono il riferimento del confronto: le prossime foto vanno ripetute con le stesse pose."
      ),
      h("div.btn-wrap", salva)
    );
  });

  if (!esito || !scelte.size) return;

  let salvate = 0;
  for (const [posaId, immagine] of scelte) {
    try {
      await store.registraFoto({
        data: esito,
        posa: posaId,
        immagine,
        // È il set di riferimento: vale come metro di paragone, non è un ripiego.
        checklist: { protocollo: true, riferimento: true, daLibreria: true },
      });
      salvate++;
    } catch (e) {
      // Anche qui il silenzio sarebbe il danno peggiore: crederesti di avere il
      // set di riferimento e non ci sarebbe.
      await chiedi({
        titolo: "Foto non salvate",
        testo: `Ne sono entrate ${salvate} su ${scelte.size}: ${e.message}. Di solito è lo spazio del telefono. Libera spazio e ripeti solo le pose che mancano.`,
        opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
      });
      break;
    }
  }
  if (!salvate) {
    await ridisegna();
    return;
  }
  try {
    await store.snapshotAutomatico("foto importate");
  } catch {
    // idem: non si perde niente, la copia si rifà da sola alla prossima occasione
  }
  toast(`${salvate} ${salvate === 1 ? "posa salvata" : "pose salvate"} come riferimento.`);
  await ridisegna();
}

/** Fotocamera con reticolo e foto precedente in trasparenza. */
function cattura(posa, sagoma) {
  return new Promise((resolve) => {
    let stream = null;
    let frontale = true;

    const video = h("video", { autoplay: true, playsinline: true, muted: true });
    const conto = h("div.conto", { style: "display:none" });
    // La sagoma deve stare nello stesso verso dell'anteprima: l'anteprima è
    // specchiata (si posa come davanti a uno specchio) mentre le foto sono
    // salvate nel verso reale. Senza specchiare anche la sagoma, allinearsi era
    // impossibile: la foto vecchia guardava dalla parte opposta.
    const imgSagoma = sagoma ? h("img.sagoma", { src: sagoma.immagine, alt: "" }) : null;
    const scena = h("div.scena", video, imgSagoma, h("div.reticolo"), conto);

    const chiudi = () => {
      stream?.getTracks().forEach((t) => t.stop());
      pannello.remove();
    };

    const scatta = async () => {
      for (let i = 3; i > 0; i--) {
        conto.style.display = "flex";
        conto.textContent = String(i);
        await new Promise((r) => setTimeout(r, 1000));
      }
      conto.style.display = "none";

      const c = document.createElement("canvas");
      const scala = Math.min(1, 1440 / Math.max(video.videoWidth, video.videoHeight));
      c.width = Math.round(video.videoWidth * scala);
      c.height = Math.round(video.videoHeight * scala);
      const ctx = c.getContext("2d");
      // La foto si salva nel verso reale, NON specchiata. Lo specchio serve
      // solo all'anteprima, per posare come davanti a uno specchio: salvarlo
      // faceva sì che le foto della fotocamera frontale risultassero ribaltate
      // rispetto al set di riferimento preso dalla libreria, e la sagoma
      // sovrapposta non combaciava mai.
      ctx.drawImage(video, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/jpeg", 0.82);
      chiudi();
      resolve(dataUrl);
    };

    const pannello = h(
      "div.fotocamera",
      scena,
      h(
        "div.barra",
        h(
          "div.riga",
          h("button.testo", { onclick: () => { chiudi(); resolve(null); } }, "Annulla"),
          h("span", { style: "font-size:15px" }, posa.nome),
          h("button.testo", { onclick: () => { frontale = !frontale; avvia(); } }, "Ruota")
        ),
        h("button.scatta", { onclick: scatta, "aria-label": "Scatta dopo 3 secondi" }),
        h(
          "p",
          { style: "margin:0;text-align:center;font-size:12px;color:rgba(255,255,255,.6)" },
          sagoma
            ? "La foto precedente è sovrapposta: allinea posa e distanza prima di scattare."
            : "Telefono su un appoggio fisso. Questo scatto diventa il riferimento."
        )
      )
    );

    async function avvia() {
      stream?.getTracks().forEach((t) => t.stop());
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: frontale ? "user" : "environment", width: { ideal: 1440 } },
          audio: false,
        });
        video.srcObject = stream;
        video.style.transform = frontale ? "scaleX(-1)" : "";
        if (imgSagoma) imgSagoma.style.transform = frontale ? "scaleX(-1)" : "";
      } catch (e) {
        // Niente accesso diretto: si può comunque scattare con la fotocamera di
        // sistema. Dirlo invece di cambiare strada in silenzio, altrimenti
        // sembra che l'app sia rotta.
        chiudi();
        const negato = e?.name === "NotAllowedError" || e?.name === "SecurityError";
        const scelta = await chiedi({
          titolo: negato ? "Fotocamera non consentita" : "Fotocamera non disponibile",
          testo: negato
            ? "Il permesso alla fotocamera è stato negato, quindi la vista guidata con la sagoma non si può aprire. Puoi scattare lo stesso con la fotocamera di sistema: la foto viene salvata allo stesso modo, manca solo l'allineamento sovrapposto."
            : "Non riesco ad aprire la fotocamera guidata. Puoi scattare con quella di sistema.",
          opzioni: [
            { etichetta: "Scatta con la fotocamera di sistema", valore: "sistema" },
            negato ? { etichetta: "Come riattivare il permesso", valore: "aiuto" } : null,
          ].filter(Boolean),
        });
        if (scelta === "aiuto") {
          await chiedi({
            titolo: "Riattivare la fotocamera",
            testo:
              "Impostazioni dell'iPhone → Safari → Impostazioni per i siti web → Fotocamera: cerca l'indirizzo di Coach e mettilo su «Chiedi» o «Consenti».\n\nSe l'app compare da sola nell'elenco delle app di Impostazioni, il permesso è lì dentro.\n\nNon disinstallare l'app per rimediare: toglierla dalla schermata Home può cancellare tutti i dati. Prima fai un backup da Impostazioni → Esporta backup su file.",
            opzioni: [{ etichetta: "Scatta intanto con la fotocamera di sistema", valore: "sistema" }],
          });
        }
        resolve(await catturaDaFile(posa));
      }
    }

    document.body.append(pannello);
    avvia();
  });
}

/** Ripiego: fotocamera di sistema, senza reticolo e senza sagoma. */
function catturaDaFile(posa) {
  return new Promise((resolve) => {
    // Niente «capture»: così iOS offre anche la libreria, e puoi scattare con
    // l'app Fotocamera usando l'autoscatto — che per la posa di schiena è
    // l'unico modo sensato.
    const input = h("input", { type: "file", accept: "image/*", style: "display:none" });
    let concluso = false;
    const finisci = (valore) => {
      if (concluso) return;
      concluso = true;
      input.remove();
      document.removeEventListener("focus", alRitorno, true);
      resolve(valore);
    };

    // Annullare il selettore non produce nessun evento: senza questo la
    // sequenza delle quattro pose restava appesa per sempre.
    const alRitorno = () => {
      setTimeout(() => {
        if (!concluso && !input.files?.length) finisci(null);
      }, 800);
    };

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return finisci(null);
      try {
        const bitmap = await createImageBitmap(file);
        const c = document.createElement("canvas");
        const scala = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height));
        c.width = Math.round(bitmap.width * scala);
        c.height = Math.round(bitmap.height * scala);
        c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
        bitmap.close?.();
        finisci(c.toDataURL("image/jpeg", 0.82));
      } catch (e) {
        // Un file che il telefono non riesce a leggere non deve bloccare tutto.
        toast("Questa immagine non si riesce a leggere: provane un'altra.", 4000);
        finisci(null);
      }
    });

    document.body.append(input);
    document.addEventListener("focus", alRitorno, true);
    toast(`Posa: ${posa.nome} — scatta o scegli dalla libreria`);
    input.click();
  });
}
