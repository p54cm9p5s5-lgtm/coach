/* Lettura del pacchetto dati prodotto dallo Shortcut.
   Formato a righe, volutamente tollerante: spazi, maiuscole e campi in più
   non fanno fallire l'import. */

export const VERSIONE = 1;

const NUMERO = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function coppie(resto) {
  const out = {};
  // chiave=valore, con valore eventualmente tra virgolette
  const re = /(\w+)\s*=\s*("([^"]*)"|\S+)/g;
  let m;
  while ((m = re.exec(resto))) out[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : m[2];
  return out;
}

/**
 * Restituisce { finestra, giorni, notti, allenamenti, avvisi }.
 * Lancia solo se il pacchetto non è riconoscibile del tutto.
 */
export function analizza(testo) {
  const righe = String(testo || "")
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r && !r.startsWith("#"));

  if (!righe.length) throw new Error("Non ho trovato niente da leggere: gli appunti sono vuoti.");

  const intestazione = righe[0].match(/^COACH-SALUTE\s+v(\d+)/i);
  if (!intestazione) {
    throw new Error(
      "Questo non è un pacchetto dati di Coach. La prima riga deve essere «COACH-SALUTE v1»."
    );
  }
  if (Number(intestazione[1]) !== VERSIONE) {
    throw new Error(`Pacchetto in versione v${intestazione[1]}, l'app legge la v${VERSIONE}.`);
  }

  const risultato = { finestra: null, giorni: [], notti: [], allenamenti: [], avvisi: [] };

  for (const riga of righe.slice(1)) {
    const [parola, ...resto] = riga.split(/\s+/);
    const tipo = parola.toUpperCase();
    const coda = resto.join(" ");

    if (tipo === "FINESTRA") {
      const [da, a] = resto;
      if (/^\d{4}-\d{2}-\d{2}$/.test(da || "") && /^\d{4}-\d{2}-\d{2}$/.test(a || "")) {
        risultato.finestra = { da, a };
      } else {
        risultato.avvisi.push("Riga FINESTRA con date non valide: ignorata.");
      }
      continue;
    }

    const data = resto[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || "")) {
      risultato.avvisi.push(`Riga senza data valida, ignorata: «${riga.slice(0, 40)}»`);
      continue;
    }
    const c = coppie(coda.slice(data.length));

    if (tipo === "GIORNO") {
      risultato.giorni.push({
        data,
        presente: true,
        kcalAttive: NUMERO(c.kcal),
        obiettivoKcal: NUMERO(c.obiettivo),
        passi: NUMERO(c.passi),
        minutiEsercizio: NUMERO(c.esercizio),
        fcRiposo: NUMERO(c.fc),
      });
    } else if (tipo === "NOTTE") {
      risultato.notti.push({
        data,
        presente: true,
        durataMin: NUMERO(c.durata),
        profondoMin: NUMERO(c.profondo),
        remMin: NUMERO(c.rem),
        vegliaMin: NUMERO(c.veglia),
        risvegli: NUMERO(c.risvegli),
      });
    } else if (tipo === "ALLENAMENTO") {
      risultato.allenamenti.push({
        uuid: c.uuid || `${data}-${c.inizio || "00:00"}-${c.durata || 0}`,
        data,
        inizio: c.inizio || null,
        durataSec: NUMERO(c.durata),
        kcalAttive: NUMERO(c.kcal),
        kcalTotali: NUMERO(c.kcaltot),
        fcMedia: NUMERO(c.fcmedia),
        fcMax: NUMERO(c.fcmax),
        tipo: c.tipo || null,
        sedutaId: null,
      });
    } else {
      risultato.avvisi.push(`Riga di tipo sconosciuto, ignorata: «${tipo}»`);
    }
  }

  if (!risultato.giorni.length && !risultato.notti.length && !risultato.allenamenti.length) {
    throw new Error("Pacchetto riconosciuto ma vuoto: nessun giorno, notte o allenamento.");
  }
  return risultato;
}

/** Elenco di date fra due estremi compresi. */
export function giorniDellaFinestra(da, a) {
  const out = [];
  const d = new Date(da + "T00:00:00");
  const fine = new Date(a + "T00:00:00");
  while (d <= fine) {
    const p = (n) => String(n).padStart(2, "0");
    out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}
