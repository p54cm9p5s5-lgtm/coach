#!/usr/bin/env python3
"""Dall'esportazione dell'app Salute al pacchetto che Coach sa leggere.

Serve quando i Comandi Rapidi non funzionano — su una beta di iOS capita che le
azioni di Salute restino a girare senza rispondere. Questa strada non li usa:
legge il file che Salute esporta da sola e scrive lo stesso testo che avrebbe
prodotto il comando.

    Sul telefono: Salute -> foto profilo in alto a destra -> «Esporta tutti i
    dati» -> esce «export.zip», che passi al Mac come vuoi.

    python3 tools/salute-da-export.py ~/Downloads/export.zip --giorni 21

Il pacchetto finisce in `_privato/`, che è fuori da git: quei dati non entrano
mai nel repository. Poi si passa al telefono con `tools/passa-file.py` e si
incolla in Salute -> Aggiorna.

Quello che NON c'è qui dentro: gli eventi del calendario, che nell'export di
Salute non ci sono. Quelli restano al comando «Coach Calendario».
"""

import argparse
import datetime as dt
import re
import sys
import zipfile
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree

PRIVATO = Path(__file__).resolve().parent.parent / "_privato"

# I tipi di Salute che servono, e dove finiscono nella riga GIORNO.
QUANTITA = {
    "HKQuantityTypeIdentifierActiveEnergyBurned": "kcal",
    "HKQuantityTypeIdentifierStepCount": "passi",
    "HKQuantityTypeIdentifierAppleExerciseTime": "esercizio",
    "HKQuantityTypeIdentifierAppleStandTime": "inpiedi",
    "HKQuantityTypeIdentifierFlightsClimbed": "piani",
    "HKQuantityTypeIdentifierDistanceWalkingRunning": "km",
}
# La frequenza a riposo è una misura al giorno, non una somma: si somma solo
# quello che si accumula.
FC_RIPOSO = "HKQuantityTypeIdentifierRestingHeartRate"
SONNO = "HKCategoryTypeIdentifierSleepAnalysis"

# Quello che sta DENTRO un <Workout>, e la curva del battito. Fino al 27/08/2026
# questo strumento scriveva solo inizio, durata, kcal e tipo: nove campi e tutta
# la curva restavano indietro rispetto al lettore dentro l'app, che legge lo
# stesso file. Due strade per la stessa cosa che davano risultati diversi, e chi
# usava il Mac perdeva il battito senza saperlo.
FC_ISTANTE = "HKQuantityTypeIdentifierHeartRate"
DENTRO_WORKOUT = {
    "HKQuantityTypeIdentifierActiveEnergyBurned": "kcal",
    "HKQuantityTypeIdentifierBasalEnergyBurned": "kcalBasale",
    "HKQuantityTypeIdentifierDistanceWalkingRunning": "km",
    "HKQuantityTypeIdentifierDistanceCycling": "km",
    "HKQuantityTypeIdentifierDistanceSwimming": "km",
}
SFORZO = {
    "HKQuantityTypeIdentifierWorkoutEffortScore",
    "HKQuantityTypeIdentifierEstimatedWorkoutEffortScore",
}
CASELLA_SEC = 30
CASELLE_AL_GIORNO = 86400 // CASELLA_SEC
PUNTI_MAX = 120

# I nomi delle fasi come li scrive Apple, tradotti in quelli che l'app riconosce.
FASI = {
    "HKCategoryValueSleepAnalysisAsleepDeep": "Profondo",
    "HKCategoryValueSleepAnalysisAsleepREM": "REM",
    "HKCategoryValueSleepAnalysisAsleepCore": "Principale",
    "HKCategoryValueSleepAnalysisAsleepUnspecified": "Sonno",
    "HKCategoryValueSleepAnalysisAsleep": "Sonno",
    "HKCategoryValueSleepAnalysisAwake": "Veglia",
    "HKCategoryValueSleepAnalysisInBed": "A letto",
}

QUANDO = re.compile(r"^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})")


def istante(testo):
    """«2026-08-12 07:30:00 +0200» -> datetime locale (l'ora è già quella del posto)."""
    m = QUANDO.match(testo or "")
    if not m:
        return None
    y, mo, d, h, mi, s = (int(x) for x in m.groups())
    try:
        return dt.datetime(y, mo, d, h, mi, s)
    except ValueError:
        return None


def numero(testo):
    try:
        return float(str(testo).replace(",", "."))
    except (TypeError, ValueError):
        return None


def sorgente_orologio(nome):
    return "watch" in (nome or "").lower()


def apri(percorso):
    """Restituisce un flusso su export.xml, dallo zip o dal file già estratto."""
    p = Path(percorso).expanduser()
    if not p.exists():
        sys.exit(f"Non trovo {p}")
    if p.suffix.lower() == ".zip":
        z = zipfile.ZipFile(p)
        # Non per nome fisso: Salute lo chiama «export.xml» in inglese ma segue
        # la lingua del telefono, e chi rinomina lo zip si porta dietro il file
        # («dati esportati.xml»). Si prende il più grande fra gli XML, saltando
        # «export_cda.xml», che è il riassunto clinico e non serve.
        nomi = [
            n
            for n in z.namelist()
            if n.lower().endswith(".xml") and "cda" not in n.lower() and not n.startswith("__MACOSX")
        ]
        if not nomi:
            sys.exit("Dentro lo zip non c'è nessun file .xml: è l'export di Salute?")
        nomi.sort(key=lambda n: z.getinfo(n).file_size, reverse=True)
        return z.open(nomi[0])
    return open(p, "rb")


def piuGiorni(iso, n):
    """Il giorno dopo, in date locali. Serve alla curva del battito quando un
    allenamento scavalca la mezzanotte."""
    d = dt.date.fromisoformat(iso) + dt.timedelta(days=n)
    return d.isoformat()


def leggi(percorso, dal, al):
    """Un giro solo sul file, buttando via ogni elemento appena letto.

    L'export di Salute di chi lo usa da anni pesa parecchie centinaia di
    megabyte: caricarlo tutto in memoria non è un'opzione.
    """
    # I passi li registrano sia iPhone sia Watch, e sommarli conta due volte i
    # periodi in cui li avevi entrambi addosso. Si tengono separati e si sceglie
    # dopo: se per quel giorno l'orologio ha scritto qualcosa, comanda lui.
    giorni = defaultdict(lambda: defaultdict(float))
    giorni_watch = defaultdict(lambda: defaultdict(float))
    fc = {}
    fasi = []
    allenamenti = []
    # Le caselle da mezzo minuto del battito, come le fa il lettore dentro
    # l'app: tenere ogni campione sarebbe decine di migliaia di oggetti.
    battiti = {}
    sforzi = []

    for _, el in ElementTree.iterparse(apri(percorso), events=("end",)):
        tag = el.tag
        if tag == "Record":
            tipo = el.get("type")
            inizio = istante(el.get("startDate"))
            if inizio is None:
                el.clear()
                continue
            giorno = inizio.date().isoformat()
            if tipo == SONNO:
                fine = istante(el.get("endDate"))
                fase = FASI.get(el.get("value"))
                # «A letto» non è sonno e l'app lo scarta comunque: non serve
                # gonfiare il pacchetto con righe che verranno buttate.
                if fine and fase and fase != "A letto" and fine > inizio:
                    if dal <= fine.date().isoformat() <= al or dal <= giorno <= al:
                        fasi.append((inizio, fine, fase))
            elif dal <= giorno <= al:
                if tipo == FC_RIPOSO:
                    v = numero(el.get("value"))
                    if v is not None:
                        fc[giorno] = v
                elif tipo == FC_ISTANTE:
                    v = numero(el.get("value"))
                    if v is not None:
                        sec = inizio.hour * 3600 + inizio.minute * 60 + inizio.second
                        chiave = (giorno, sec // CASELLA_SEC)
                        c = battiti.get(chiave)
                        if c:
                            c[0] = min(c[0], v)
                            c[1] = max(c[1], v)
                        else:
                            battiti[chiave] = [v, v]
                elif tipo in SFORZO:
                    v = numero(el.get("value"))
                    if v is not None:
                        sforzi.append({
                            "giorno": giorno,
                            "sec": inizio.hour * 3600 + inizio.minute * 60 + inizio.second,
                            "valore": v,
                            "stimato": "Estimated" in tipo,
                        })
                elif tipo in QUANTITA:
                    v = numero(el.get("value"))
                    if v is not None:
                        dove = giorni_watch if sorgente_orologio(el.get("sourceName")) else giorni
                        dove[giorno][QUANTITA[tipo]] += v
        elif tag == "Workout":
            inizio = istante(el.get("startDate"))
            if inizio and dal <= inizio.date().isoformat() <= al:
                durata = numero(el.get("duration")) or 0  # minuti
                fine = istante(el.get("endDate"))
                campi = {}
                fcmedia = fcmin = fcmax = sforzo = None
                for st in el.findall("WorkoutStatistics"):
                    t = st.get("type")
                    campo = DENTRO_WORKOUT.get(t)
                    if campo:
                        v = numero(st.get("sum"))
                        if v is not None:
                            campi[campo] = (campi.get(campo) or 0) + v
                    elif t == FC_ISTANTE:
                        # Media, minimo e massimo li ha già calcolati Salute
                        # sull'allenamento intero: valgono più di quelli
                        # ricavati dalle caselle, che arrotondano.
                        fcmedia = numero(st.get("average"))
                        fcmin = numero(st.get("minimum"))
                        fcmax = numero(st.get("maximum"))
                    elif t in SFORZO:
                        v = numero(st.get("average")) or numero(st.get("maximum")) or numero(st.get("sum"))
                        # Lo sforzo corretto a mano vince su quello stimato.
                        if v is not None and (sforzo is None or "Estimated" not in t):
                            sforzo = v
                indoor = None
                for m in el.findall("MetadataEntry"):
                    if m.get("key") in ("HKIndoorWorkout", "HKMetadataKeyIndoorWorkout"):
                        v = str(m.get("value") or "").strip().lower()
                        if v in ("1", "true", "yes"):
                            indoor = True
                        elif v in ("0", "false", "no"):
                            indoor = False
                allenamenti.append(
                    {
                        "inizio": inizio,
                        "fine": fine,
                        "durataSec": int(round(durata * 60)),
                        "kcal": campi.get("kcal"),
                        "kcalBasale": campi.get("kcalBasale"),
                        "km": campi.get("km"),
                        "fcMedia": fcmedia,
                        "fcMin": fcmin,
                        "fcMax": fcmax,
                        "sforzo": sforzo,
                        "indoor": indoor,
                        "tipo": (el.get("workoutActivityType") or "").replace("HKWorkoutActivityType", ""),
                    }
                )
        if tag in ("Record", "Workout"):
            el.clear()

    return giorni, giorni_watch, fc, fasi, allenamenti, battiti, sforzi


def righe(dal, al, giorni, giorni_watch, fc, fasi, allenamenti, battiti=None, sforzi=None):
    out = ["COACH-DATI v1", f"FINESTRA {dal} {al}"]

    tutte = sorted(set(giorni) | set(giorni_watch))
    for g in tutte:
        w, i = giorni_watch.get(g, {}), giorni.get(g, {})
        campi = []

        def prendi(chiave, forma):
            # L'orologio ha la precedenza; l'iPhone entra solo dove l'orologio
            # non ha scritto niente, così non si somma due volte lo stesso passo.
            v = w.get(chiave) if w.get(chiave) else i.get(chiave)
            if v:
                campi.append(forma(v))

        prendi("kcal", lambda v: f"kcal={round(v)}")
        prendi("passi", lambda v: f"passi={round(v)}")
        prendi("esercizio", lambda v: f"esercizio={round(v)}")
        prendi("inpiedi", lambda v: f"inpiedi={round(v)}")
        prendi("piani", lambda v: f"piani={round(v)}")
        prendi("km", lambda v: f"km={v:.2f}".replace(".", ","))
        if g in fc:
            campi.append(f"fc={round(fc[g])}")
        if campi:
            out.append(f"GIORNO {g} " + " ".join(campi))

    for inizio, fine, fase in sorted(fasi):
        out.append(
            f"FASE {inizio:%Y-%m-%d %H:%M} {fine:%Y-%m-%d %H:%M} {fase}"
        )

    battiti = battiti or {}
    sforzi = sforzi or []

    def secondi(t):
        return t.hour * 3600 + t.minute * 60 + t.second

    def scrivi(v):
        if v is None:
            return ""
        lo, hi = v
        return str(round(lo)) if round(lo) == round(hi) else f"{round(lo)}-{round(hi)}"

    def curva_di(a):
        """Le caselle di battito dentro l'allenamento, ridotte a pochi punti.

        Stessa logica del lettore dentro l'app: si cammina avanti di casella in
        casella e si cambia giorno quando serve, perché un allenamento può
        scavalcare la mezzanotte. Il tetto sui passi evita che un `endDate`
        sballato faccia girare a vuoto.
        """
        if not a.get("fine"):
            return None
        giorno = a["inizio"].date().isoformat()
        casella = secondi(a["inizio"]) // CASELLA_SEC
        fine_giorno = a["fine"].date().isoformat()
        fine_casella = secondi(a["fine"]) // CASELLA_SEC
        valori = []
        for _ in range(CASELLE_AL_GIORNO * 2 + 1):
            c = battiti.get((giorno, casella))
            valori.append(tuple(c) if c else None)
            if giorno == fine_giorno and casella >= fine_casella:
                break
            if giorno > fine_giorno:
                break
            casella += 1
            if casella >= CASELLE_AL_GIORNO:
                casella = 0
                giorno = piuGiorni(giorno, 1)
        if not any(v is not None for v in valori):
            return None
        if len(valori) <= PUNTI_MAX:
            return [scrivi(v) for v in valori]
        per = -(-len(valori) // PUNTI_MAX)
        fuori = []
        for i in range(0, len(valori), per):
            gruppo = [v for v in valori[i : i + per] if v is not None]
            fuori.append(scrivi((min(g[0] for g in gruppo), max(g[1] for g in gruppo))) if gruppo else "")
        return fuori

    def sforzo_di(a):
        """Lo sforzo scritto come riga a sé va all'allenamento che lo contiene.
        Se ce ne sono due — uno stimato e uno corretto a mano — vince quello a mano."""
        if a.get("sforzo") is not None:
            return a["sforzo"]
        if not a.get("fine"):
            return None
        g0, s0 = a["inizio"].date().isoformat(), secondi(a["inizio"])
        g1, s1 = a["fine"].date().isoformat(), secondi(a["fine"])
        dentro = [
            x for x in sforzi
            if (x["giorno"] == g0 and x["sec"] >= s0 and (g1 != g0 or x["sec"] <= s1))
            or (x["giorno"] == g1 and g1 != g0 and x["sec"] <= s1)
        ]
        if not dentro:
            return None
        a_mano = next((x for x in dentro if not x["stimato"]), None)
        return (a_mano or dentro[0])["valore"]

    for a in sorted(allenamenti, key=lambda x: x["inizio"]):
        pezzi = [f"ALLENAMENTO {a['inizio']:%Y-%m-%d} inizio={a['inizio']:%H:%M} durata={a['durataSec']}"]
        if a.get("fine"):
            pezzi.append(f"fine={a['fine']:%H:%M}")
        if a["kcal"] is not None:
            pezzi.append(f"kcal={round(a['kcal'])}")
        # «Totali» come le conta Salute: attive più quelle che bruceresti comunque.
        if a["kcal"] is not None and a.get("kcalBasale") is not None:
            pezzi.append(f"kcaltot={round(a['kcal'] + a['kcalBasale'])}")
        if a.get("km") is not None:
            pezzi.append(f"km={a['km']:.2f}".replace(".", ","))
        if a.get("fcMedia") is not None:
            pezzi.append(f"fcmedia={round(a['fcMedia'])}")
        if a.get("fcMin") is not None:
            pezzi.append(f"fcmin={round(a['fcMin'])}")
        if a.get("fcMax") is not None:
            pezzi.append(f"fcmax={round(a['fcMax'])}")
        sf = sforzo_di(a)
        if sf is not None:
            pezzi.append(f"sforzo={round(sf)}")
        if a.get("indoor") is not None:
            pezzi.append(f"indoor={1 if a['indoor'] else 0}")
        if a["tipo"]:
            pezzi.append(f'tipo="{a["tipo"]}"')
        out.append(" ".join(pezzi))
        curva = curva_di(a)
        # Due punti sono un segmento, non un andamento.
        if curva and len([v for v in curva if v != ""]) >= 3:
            out.append(f"BATTITO {a['inizio']:%Y-%m-%d} {a['inizio']:%H:%M} " + ",".join(curva))

    return out


def main():
    ap = argparse.ArgumentParser(description="Trasforma l'export di Salute nel pacchetto per Coach.")
    ap.add_argument("export", help="export.zip di Salute, oppure l'export.xml già estratto")
    ap.add_argument("--giorni", type=int, default=30, help="quanti giorni indietro (default 30, come l'app)")
    ap.add_argument("--al", default=None, help="ultimo giorno, AAAA-MM-GG (default oggi)")
    ap.add_argument("--dal", default=None, help="primo giorno, AAAA-MM-GG: niente di più vecchio")
    ap.add_argument("--out", default=None, help="dove scrivere (default _privato/pacchetto-salute.txt)")
    args = ap.parse_args()

    al = args.al or dt.date.today().isoformat()
    try:
        fine = dt.date.fromisoformat(al)
    except ValueError:
        sys.exit(f"Data non valida: {al}")
    dal = (fine - dt.timedelta(days=max(0, args.giorni - 1))).isoformat()
    # Lo stesso pavimento che applica il telefono: l'app non fa mai entrare dati
    # più vecchi del giorno in cui è cominciata la storia, e questo strumento
    # non deve essere la strada che li fa entrare lo stesso. Se il tuo programma
    # comincia in un altro giorno, si dichiara con --dal (o si cambia qui).
    INIZIO_STORIA = "2026-07-29"
    dal = max(dal, INIZIO_STORIA)
    if args.dal:
        try:
            dt.date.fromisoformat(args.dal)
        except ValueError:
            sys.exit(f"Data non valida: {args.dal}")
        dal = max(dal, args.dal)

    print(f"Leggo {args.export} … (dal {dal} al {al})", flush=True)
    dati = leggi(args.export, dal, al)
    testo = "\n".join(righe(dal, al, *dati)) + "\n"

    destinazione = Path(args.out).expanduser() if args.out else PRIVATO / "pacchetto-salute.txt"
    destinazione.parent.mkdir(parents=True, exist_ok=True)
    destinazione.write_text(testo, encoding="utf-8")

    conta = lambda p: sum(1 for r in testo.splitlines() if r.startswith(p))
    print(f"\nScritto: {destinazione}")
    print(f"  {conta('GIORNO ')} giorni · {conta('FASE ')} fasi di sonno · {conta('ALLENAMENTO ')} allenamenti")
    if not conta("FASE "):
        print("  Nessuna fase di sonno nel periodo: controlla che l'orologio le registri.")
    print("\nPassalo al telefono e incollalo in Salute → Aggiorna:")
    print(f'  python3 tools/passa-file.py "{destinazione}"')


if __name__ == "__main__":
    main()
