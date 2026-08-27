import {
  h, toast, sheet, chiedi, clear, num, dataBreve, dataLunga, isoDate, giorniTra, aggiungi, unaVoltaSola,
} from "../ui.js";
import { intestazione } from "../app.js";
import * as store from "../store.js";

/* ---------------------------------------------------------------------------
   Salvare le foto nella galleria del telefono.

   Una cosa va detta subito, perché cambia cosa ci si può aspettare: **un'app
   web su iPhone non può scrivere da sola in Foto.** Quel permesso iOS non lo
   dà a nessun sito, e non è una mancanza dell'app. L'unica strada che esiste è
   il foglio di condivisione del sistema: l'app gli passa le immagini già
   pronte, tu tocchi «Salva N immagini» e finiscono nella galleria — un tocco,
   tutte insieme, senza sceglierle una per una.

   Due dettagli che fanno la differenza fra «funziona» e «a volte no»:

   - la conversione da data URL a file è **sincrona** (niente `await` prima di
     `navigator.share`). Safari concede la condivisione solo dentro il gesto
     che l'ha chiesta: bastava un `await` in mezzo per far fallire il foglio
     con «NotAllowedError», e a schermo sembrava un guasto senza motivo;
   - dove il foglio non esiste — un browser da computer — non si finge: si
     scaricano i file e lo si dice.
--------------------------------------------------------------------------- */

/** Da data URL a File, senza await: il gesto dell'utente non si può perdere. */
function fileDaScatto(scatto, indice) {
  const url = String(scatto.immagine || "");
  const virgola = url.indexOf(",");
  if (!url.startsWith("data:") || virgola < 0) return null;
  const tipo = url.slice(5, url.indexOf(";")) || "image/jpeg";
  const grezzo = atob(url.slice(virgola + 1));
  const buf = new Uint8Array(grezzo.length);
  for (let i = 0; i < grezzo.length; i++) buf[i] = grezzo.charCodeAt(i);
  const posa = store.POSE.find((p) => p.id === scatto.posa);
  const estensione = tipo.includes("png") ? "png" : "jpg";
  const nome = `coach-${scatto.data}-${indice + 1}-${(posa?.id || scatto.posa || "foto")}.${estensione}`;
  return new File([buf], nome, { type: tipo });
}

/**
 * Manda gli scatti al foglio di condivisione di iOS. Va chiamata **dentro** il
 * gestore del tocco, senza niente di asincrono prima.
 */
function salvaNellaGalleria(scatti, { quando } = {}) {
  // Nell'ordine del protocollo, non in quello in cui capitano: nella galleria
  // le quattro foto devono stare in fila come le guardi — fronte, profilo,
  // schiena, braccia aperte — e il numero nel nome serve a questo.
  const ordinati = [...scatti].sort(
    (a, b) => store.POSE.findIndex((p) => p.id === a.posa) - store.POSE.findIndex((p) => p.id === b.posa)
  );
  const file = ordinati.map(fileDaScatto).filter(Boolean);
  if (!file.length) {
    toast("Queste foto non si riescono a leggere: non le ho toccate.", 4000);
    return;
  }
  const dati = {
    files: file,
    title: `Coach — foto del ${dataBreve(quando || ordinati[0]?.data || isoDate())}`,
  };
  if (navigator.canShare && navigator.canShare({ files: file }) && navigator.share) {
    navigator
      .share(dati)
      .then(() => toast(file.length === 1 ? "Foto passata a iOS: tocca «Salva immagine»." : `${file.length} foto passate a iOS: tocca «Salva ${file.length} immagini».`, 5000))
      .catch((e) => {
        // Annullare il foglio non è un errore: è una scelta, e non va urlata.
        if (e && (e.name === "AbortError" || /abort|cancel/i.test(e.message || ""))) return;
        toast(`Il foglio di condivisione non si è aperto: ${puntoFinale(e?.message)}`, 5000);
      });
    return;
  }
  // Niente foglio: qui siamo su un computer. Si scaricano e lo si dice.
  for (const f of file) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  }
  toast(
    file.length === 1
      ? "Questo browser non ha il foglio di condivisione: la foto è stata scaricata."
      : `Questo browser non ha il foglio di condivisione: ${file.length} foto scaricate.`,
    5000
  );
}

/**
 * I messaggi degli errori a volte finiscono col punto e a volte no: incollati
 * dentro una frase davano «…e ricarica..» oppure «…spazio finito Riapri».
 * Un errore senza messaggio non lascia una frase monca: si dice che non si sa.
 */
const puntoFinale = (s) => {
  const t = String(s || "").trim();
  if (!t) return "non so dire perché.";
  return /[.!?…]$/.test(t) ? t : `${t}.`;
};

// `caloBuono` dice da che parte è il miglioramento: scendere di vita è un
// progresso, scendere di bicipite no. Senza, la pastiglia verde compariva
// anche quando perdevi massa.
// `min` e `max` non sono un limite: sono la soglia oltre la quale l'app chiede
// conferma. Un peso di 818 kg è quasi sempre 81,8 battuto male, e un numero
// così sballato non si ferma dove l'hai scritto — sporca la media, gli indici,
// il grafico e il pacchetto per il coach, e ritrovarlo dopo è un lavoro.
const MISURE = [
  { id: "peso", nome: "Peso", unita: "kg", passo: 0.1, primaria: true, caloBuono: true, min: 30, max: 250 },
  { id: "vitaOmbelico", nome: "Vita ombelico", unita: "cm", passo: 0.5, primaria: true, caloBuono: true, min: 40, max: 200 },
  { id: "vitaStretta", nome: "Vita punto stretto", unita: "cm", passo: 0.5, caloBuono: true, min: 40, max: 200 },
  { id: "fianchi", nome: "Fianchi", unita: "cm", passo: 0.5, caloBuono: true, min: 40, max: 200 },
  { id: "petto", nome: "Petto", unita: "cm", passo: 0.5, caloBuono: false, min: 50, max: 200 },
  { id: "bicipiteRilassato", nome: "Bicipite rilassato", unita: "cm", passo: 0.5, caloBuono: false, min: 15, max: 70 },
  { id: "coscia", nome: "Coscia", unita: "cm", passo: 0.5, caloBuono: false, min: 25, max: 110 },
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

/* Quanti set di foto sono in vista. Sta fuori dal disegno perché il tocco su
   «Vedi tutti» ridisegna la schermata: dentro, la scelta si perderebbe subito.
   Torna a «solo gli ultimi quattro» ogni volta che si riapre l'app, che è il
   comportamento di partenza giusto. */
let mostraTuttiISet = false;

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
        // Toccabile solo se qualcosa da mostrare c'è: una riga «mai registrata»
        // che si apre su un elenco vuoto è una porta che non porta da nessuna
        // parte.
        righe.length ? "button.row" : "div.row",
        righe.length ? { onclick: () => storicoMisura(def, righe, ridisegna) } : {},
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

// ---------- storico di una misura ----------

/**
 * Tutte le volte che hai misurato una cosa, e la strada per togliere quella
 * sbagliata.
 *
 * Fino a ieri una misura si poteva solo sovrascrivere, salvandone un'altra con
 * la stessa data: basta quando hai sbagliato il numero, non quando hai
 * sbagliato il giorno. Quella misura restava per sempre, entrava negli indici,
 * nei confronti e nel pacchetto per il coach.
 */
function storicoMisura(def, righe, ridisegna) {
  sheet((close) =>
    h(
      "div",
      h("h2", def.nome),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
        righe.length === 1
          ? "Una misura registrata. Toccala per eliminarla."
          : `${righe.length} misure registrate, dalla più recente. Toccane una per eliminarla.`
      ),
      h(
        "div.list",
        ...righe.map((m) =>
          h(
            "button.row",
            {
              onclick: unaVoltaSola(async () => {
                // La conferma nomina data e valore: è quello che mi ha
                // impedito di cancellare il set di foto sbagliato durante il
                // controllo, e vale qui allo stesso modo.
                const c = await chiedi({
                  // Il nome sta nel corpo e non nel titolo: «Eliminare peso del
                  // 25/08?» chiede un articolo che cambia con la misura, e
                  // inventarsi un campo «genere» per sette voci sarebbe più
                  // codice che lingua.
                  titolo: `Eliminare la misura del ${dataBreve(m.data)}?`,
                  testo: `${def.nome}: ${num(m.valore)} ${def.unita}, di ${dataLunga(m.data)}. Non si recupera, e gli indici si ricalcolano senza.`,
                  opzioni: [{ etichetta: "Elimina la misura", valore: "si", stile: "destructive" }],
                });
                if (c !== "si") return;
                const tolta = await store.cancellaMisura(m.id);
                close();
                // «Misura» regge il participio per tutte e sette: il nome della
                // misura sta dopo i due punti, dove il genere non serve.
                toast(
                  tolta
                    ? `Misura del ${dataBreve(m.data)} eliminata: ${def.nome}, ${num(m.valore)} ${def.unita}.`
                    : "Questa misura non c'era più."
                );
                if (ridisegna) await ridisegna();
              }),
            },
            h(
              "div.main",
              h("span.title", dataLunga(m.data)),
              h(
                "span.sub",
                m.condizioniStandard === false ? "fuori protocollo" : m.fonte === "brief" ? "dal brief" : "segnata a mano"
              )
            ),
            h("span.value", `${num(m.valore)} ${def.unita}`)
          )
        )
      ),
      h(
        "p.footnote",
        { style: "margin:14px 16px 0" },
        "Se il numero è sbagliato ma il giorno è giusto, non serve eliminare: basta registrarla di nuovo con la stessa data e si sovrascrive."
      )
    )
  );
}

// ---------- registrazione misure ----------

async function registra(ridisegna) {
  const valori = {};
  // Quanto valeva prima: serve a riconoscere i salti impossibili. Va letto
  // adesso, perché `valori` viene riscritto man mano che si tocca.
  const partenza = {};
  for (const def of MISURE) {
    const m = await store.ultimaMisura(def.id);
    valori[def.id] = m ? m.valore : null;
    partenza[def.id] = m ? m.valore : null;
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
        // Toccare − o + rimette a schermo un numero valido: quel campo non è
        // più «non è un numero», e va tolto dall'elenco che blocca il salvataggio.
        // Senza questa riga il campo mostrava 85 in color accento e «Salva»
        // rispondeva «Non è un numero: Peso», con niente di sbagliato da
        // correggere: l'unica via d'uscita era svuotare il campo.
        nonValidi.delete(def.id);
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
        // `parseFloat` legge il PREFISSO e butta via il resto senza dire niente:
        // «8a4» diventa 8, il campo resta del colore normale e in archivio
        // finiscono 8 kg come se li avessi scritti tu. Un errore di battitura
        // non deve poter entrare travestito da misura. Qui si controlla che
        // quello che resta scritto sia davvero tutto un numero.
        const scritto = val.value.trim().replace(",", ".");
        const tuttoNumero = /^-?\d*\.?\d+$/.test(scritto);
        if (!Number.isFinite(n) || n < 0 || !tuttoNumero) {
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
      // La primissima volta non c'è nessuna «ultima volta» da cui partire: i
      // campi sono tutti vuoti e quella frase manda a cercare dei valori che
      // non ci sono.
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:14px" },
        Object.values(partenza).some((v) => v != null)
          ? "I valori partono dall'ultima volta: tocca solo quelli cambiati."
          : "È la prima volta: scrivi quelli che hai misurato, gli altri lasciali vuoti."
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
              // Fuori scala non vuol dire sbagliato: chiede e basta, la
              // decisione resta di chi misura.
              //
              // Due guardie, non una. La prima è assoluta (30-250 kg per il
              // peso) e prende i tocchi di troppo sulla tastiera. La seconda è
              // relativa a quello che pesavi l'ultima volta, e prende gli
              // errori che stanno DENTRO la scala: 175 al posto di 79 è un
              // numero perfettamente possibile per un corpo umano, ma non per
              // il tuo, e passava in silenzio mostrando «+95 kg».
              const SALTO = 0.15;
              const fuoriScala = [...scelte]
                .map((id) => ({ def: MISURE.find((m) => m.id === id), valore: valori[id], prima: partenza[id] }))
                .filter(({ def, valore, prima }) =>
                  def &&
                  (valore < def.min ||
                    valore > def.max ||
                    (prima != null && prima > 0 && Math.abs(valore - prima) / prima > SALTO))
                );
              if (fuoriScala.length) {
                const elenco = fuoriScala
                  .map(({ def, valore, prima }) =>
                    prima != null && (valore >= def.min && valore <= def.max)
                      ? `${def.nome} ${num(valore)} ${def.unita} (l'ultima volta ${num(prima)})`
                      : `${def.nome} ${num(valore)} ${def.unita}`
                  )
                  .join(", ");
                // Il testo cambia con il motivo: «lontano da una misura del
                // corpo» non ha senso davanti a un peso possibilissimo che è
                // solo lontano dal tuo.
                const soloSalto = fuoriScala.every(({ def, valore }) => valore >= def.min && valore <= def.max);
                const scelta = await chiedi({
                  titolo: soloSalto
                    ? fuoriScala.length === 1
                      ? "Un salto grosso"
                      : "Salti grossi"
                    : fuoriScala.length === 1
                      ? "Numero fuori scala"
                      : "Numeri fuori scala",
                  testo: soloSalto
                    ? `${elenco}. È un cambiamento molto più grande di quello che un corpo fa fra due misure: di solito è una cifra sbagliata. Se è giusto lo salvo, ma prima te lo chiedo.`
                    : `${elenco}. È molto lontano da una misura del corpo: di solito è un tocco di troppo sulla tastiera. Se è giusto lo salvo, ma prima te lo chiedo.`,
                  opzioni: [
                    { etichetta: "È giusto, salva", valore: "salva" },
                    { etichetta: "Torno a correggere", valore: "correggi" },
                  ],
                  annulla: false,
                });
                if (scelta !== "salva") return;
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
                  // «Solo in parte» con zero entrate è una bugia gentile: se non
                  // ne è entrata nessuna bisogna dirlo, se no si crede di averne
                  // salvata almeno una e non si ricontrolla.
                  titolo: entrate ? "Misure salvate solo in parte" : "Misure non salvate",
                  testo:
                    (entrate
                      ? `Ne sono entrate ${entrate} su ${scelte.size}: `
                      : scelte.size === 1
                        ? "L'unica misura non è entrata: "
                        : `Non ne è entrata nessuna delle ${scelte.size}: `) +
                    // Il messaggio dell'errore finisce già col punto: aggiungerne
                    // un altro dava «…e ricarica..».
                    `${puntoFinale(e.message)} Riapri «Registra» e reinserisci quelle che mancano.`,
                  opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
                  annulla: false,
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
  // Il set più vecchio è il metro di paragone: è quello su cui sono modellate
  // le pose, e tutti gli altri si leggono rispetto a lui.
  //
  // Si calcola la data minima invece di prendere l'ultimo dell'elenco: `setFoto`
  // non promette un ordine, e un segno che dipende dall'ordine di lettura è un
  // segno che prima o poi finisce sul set sbagliato. Le date sono in forma
  // anno-mese-giorno, quindi il confronto fra stringhe è già cronologico.
  const dataRiferimento = set.length ? set.map((s) => s.data).sort()[0] : null;
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
    // Se ne vedevano quattro e basta: gli altri restavano in archivio e nel
    // backup, ma dall'app non c'era modo di guardarli — e niente lo diceva.
    // Si mostrano i quattro più recenti e gli altri si chiedono.
    const A_VISTA = 4;
    const mostrati = mostraTuttiISet ? set : set.slice(0, A_VISTA);
    for (const s of mostrati) {
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
          { style: "display:flex;align-items:baseline;justify-content:space-between;margin:14px 4px 0;gap:6px;flex-wrap:wrap" },
          h(
            "p",
            { style: "margin:0;font-size:13px;color:var(--label-secondary)" },
            // «Set di riferimento» compariva su OGNI set caricato dalla
            // libreria: caricandone due, a schermo ce n'erano due e non si
            // capiva quale fosse il metro di paragone.
            //
            // Adesso torna, ma assegnato al set **più vecchio**: uno solo,
            // sempre, e l'ambiguità di prima non può ripresentarsi. «Caricate a
            // mano» resta perché dice un'altra cosa — come sono entrate quelle
            // foto — e le due informazioni non si escludono.
            `${dataLunga(s.data)}` +
              (s.data === dataRiferimento ? " · riferimento" : "") +
              (daLibreria ? " · caricate a mano" : "")
          ),
          h(
            "button",
            {
              // Stesso trattamento del tasto rosso qui accanto: testo piccolo,
              // area toccabile da 44 punti.
              style:
                "background:none;border:0;color:var(--accent);font:inherit;font-size:13px;" +
                "min-height:44px;padding:0 8px;margin:-14px 0 -14px -8px;",
              // Niente `async` e niente await prima di `share`: iOS concede il
              // foglio solo dentro il gesto che l'ha chiesto.
              onclick: () => salvaNellaGalleria(s.scatti, { quando: s.data }),
            },
            "Salva in galleria"
          ),
          h(
            "button",
            {
              // Il testo resta piccolo dov'è, ma il dito ha i suoi 44 punti:
              // i margini negativi allargano l'area toccabile senza spostare
              // niente di quello che si vede.
              style:
                "background:none;border:0;color:var(--red);font:inherit;font-size:13px;" +
                "min-height:44px;padding:0 8px;margin:-14px -8px;",
              onclick: async () => {
                const c = await chiedi({
                  titolo: `Eliminare il set del ${dataBreve(s.data)}?`,
                  testo: `${s.scatti.length} ${s.scatti.length === 1 ? "foto" : "foto"} di quel giorno. Non si recupera.`,
                  opzioni: [{ etichetta: "Elimina il set", valore: "si", stile: "danger" }],
                });
                if (c !== "si") return;
                // Cancellare a pezzi può fermarsi a metà: se l'archivio
                // rifiuta una foto, prima restavano dentro le altre e il
                // messaggio diceva comunque «Set eliminato». Quante ne sono
                // uscite davvero va detto, come per il salvataggio parziale
                // delle misure.
                let tolte = 0;
                try {
                  for (const x of s.scatti) {
                    await store.db.del("foto", x.id);
                    tolte++;
                  }
                } catch (e) {
                  await chiedi({
                    titolo: tolte ? "Set eliminato solo in parte" : "Set non eliminato",
                    testo:
                      (tolte
                        ? `Ne sono uscite ${tolte} su ${s.scatti.length}: `
                        : "Non è uscita nessuna foto: ") +
                      `${puntoFinale(e.message)} Le altre sono ancora al loro posto: riprova.`,
                    opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
                    annulla: false,
                  });
                  await ridisegna();
                  return;
                }
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
    if (!mostraTuttiISet && set.length > A_VISTA) {
      const quanti = set.length - A_VISTA;
      aggiungi(gruppo,
        h(
          "div.btn-wrap",
          { style: "margin-left:0;margin-right:0" },
          h(
            "button.btn.secondary",
            {
              onclick: () => {
                mostraTuttiISet = true;
                ridisegna();
              },
            },
            `Vedi tutti i set (altri ${quanti})`
          )
        )
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
        ? `${giorni === 0 ? "Ultimo set oggi" : `Ultimo set ${giorni} ${giorni === 1 ? "giorno" : "giorni"} fa`}. Cadenza prevista: ogni 14 giorni.`
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
          "button.btn.secondary",
          { onclick: () => salvaNellaGalleria([scatto]) },
          "Salva in galleria"
        ),
        h("div", { style: "height:8px" }),
        h(
          "button.btn.destructive",
          {
            onclick: async () => {
              const c = await chiedi({
                titolo: "Eliminare questa foto?",
                opzioni: [{ etichetta: "Elimina", valore: "si", stile: "danger" }],
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
    // Una posa senza foto non ferma il set: chiede se il resto va fatto.
    //
    // «Annullato» qui non vuol dire per forza che hai cambiato idea: quando la
    // foto arriva dalla libreria, il ritorno del fuoco più 800 ms vale come
    // annullamento, e su una scelta lenta o su un file pesante capita che
    // scatti da solo. Con il `break` secco le pose successive non venivano
    // nemmeno chieste: uscivi credendo di aver fatto il set e ne avevi metà.
    if (!immagine) {
      const restanti = store.POSE.length - store.POSE.indexOf(posa) - 1;
      if (!restanti) break;
      const scelta = await chiedi({
        titolo: `«${posa.nome}» non è stata scattata`,
        testo:
          `${restanti === 1 ? "Manca ancora una posa" : `Mancano ancora ${restanti} pose`}. ` +
          "Se hai annullato apposta va bene, ma a volte il telefono chiude il selettore da solo: " +
          "in quel caso continuare è la cosa giusta.",
        opzioni: [
          { etichetta: restanti === 1 ? "Continua con l'ultima" : "Continua con le altre", valore: "avanti" },
          { etichetta: "Fermati qui", valore: "stop" },
        ],
        annulla: false,
      });
      if (scelta === "avanti") continue;
      break;
    }
    try {
      await store.registraFoto({ data: oggi, posa: posa.id, immagine, checklist: { protocollo: true } });
      fatte++;
    } catch (e) {
      // Se l'archivio rifiuta la foto (spazio finito, quasi sempre) tacere
      // sarebbe il peggio: ti ritroveresti un set che credi fatto e non c'è.
      await chiedi({
        titolo: "Foto non salvata",
        testo: `«${posa.nome}» non è entrata nell'archivio: ${puntoFinale(e.message)} Di solito è lo spazio del telefono. Libera spazio e rifai il set: le pose già salvate restano.`,
        opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
        annulla: false,
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
    // Appena finito, la galleria. Non si può salvare da soli — iOS non lo
    // concede a nessun sito — ma si può arrivare a un tocco solo, subito,
    // invece di ricordarsene tre giorni dopo.
    await offriGalleria(oggi, fatte);
  }
  await ridisegna();
}

/**
 * Il foglio che porta il set appena fatto nella galleria del telefono.
 *
 * Esiste perché il tocco su «Salva in galleria» **è** il gesto che iOS pretende
 * per aprire la condivisione: chiamarla da sola a fine set, senza che tu abbia
 * toccato niente, verrebbe rifiutata dal sistema. Un tocco è il minimo
 * possibile, e questo è quel tocco.
 */
async function offriGalleria(data, quante) {
  const scatti = (await store.db.byIndex("foto", "data", data)).sort(
    (a, b) => store.POSE.findIndex((p) => p.id === a.posa) - store.POSE.findIndex((p) => p.id === b.posa)
  );
  if (!scatti.length) return;
  await sheet((close) =>
    h(
      "div",
      h("h2", quante === 1 ? "Foto salvata" : "Set salvato"),
      h(
        "p",
        { style: "margin:6px 16px 0;color:var(--label-secondary);font-size:15px" },
        `${scatti.length} ${scatti.length === 1 ? "foto è" : "foto sono"} nell'archivio dell'app e ${scatti.length === 1 ? "entra" : "entrano"} nel backup. ` +
          "Nella galleria del telefono non ci vanno da sole: iOS non lascia che un'app web ci scriva. " +
          `Toccando qui sotto si apre il foglio di iOS con ${scatti.length === 1 ? "la foto" : `tutte e ${scatti.length}`} già ${scatti.length === 1 ? "pronta" : "pronte"}: scegli «Salva ${scatti.length === 1 ? "immagine" : `${scatti.length} immagini`}».`
      ),
      h(
        "div.btn-wrap",
        { style: "display:grid;gap:12px" },
        h(
          "button.btn",
          {
            onclick: () => {
              salvaNellaGalleria(scatti, { quando: data });
              close();
            },
          },
          "Salva in galleria"
        ),
        h("button.btn.secondary", { onclick: () => close() }, "Non adesso")
      ),
      h(
        "p.footnote",
        { style: "margin:10px 16px 0" },
        "Se salti, le foto restano nell'app: le ritrovi qui sotto, e ogni set ha il suo «Salva in galleria»."
      )
    )
  );
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
        titolo: salvate ? "Foto salvate solo in parte" : "Foto non salvate",
        testo:
          (salvate
            ? `Ne sono entrate ${salvate} su ${scelte.size}: `
            : scelte.size === 1
              ? "L'unica foto non è entrata: "
              : `Non ne è entrata nessuna delle ${scelte.size}: `) +
          `${puntoFinale(e.message)} Di solito è lo spazio del telefono. Libera spazio e ripeti solo le pose che mancano.`,
        opzioni: [{ etichetta: "Ho capito", valore: "ok" }],
        annulla: false,
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
