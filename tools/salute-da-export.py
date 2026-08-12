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
                elif tipo in QUANTITA:
                    v = numero(el.get("value"))
                    if v is not None:
                        dove = giorni_watch if sorgente_orologio(el.get("sourceName")) else giorni
                        dove[giorno][QUANTITA[tipo]] += v
        elif tag == "Workout":
            inizio = istante(el.get("startDate"))
            if inizio and dal <= inizio.date().isoformat() <= al:
                durata = numero(el.get("duration")) or 0  # minuti
                kcal = None
                for s in el.findall("WorkoutStatistics"):
                    if s.get("type") == "HKQuantityTypeIdentifierActiveEnergyBurned":
                        kcal = numero(s.get("sum"))
                allenamenti.append(
                    {
                        "inizio": inizio,
                        "durataSec": int(round(durata * 60)),
                        "kcal": kcal,
                        "tipo": (el.get("workoutActivityType") or "").replace("HKWorkoutActivityType", ""),
                    }
                )
        if tag in ("Record", "Workout"):
            el.clear()

    return giorni, giorni_watch, fc, fasi, allenamenti


def righe(dal, al, giorni, giorni_watch, fc, fasi, allenamenti):
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

    for a in sorted(allenamenti, key=lambda x: x["inizio"]):
        pezzi = [f"ALLENAMENTO {a['inizio']:%Y-%m-%d} inizio={a['inizio']:%H:%M} durata={a['durataSec']}"]
        if a["kcal"] is not None:
            pezzi.append(f"kcal={round(a['kcal'])}")
        if a["tipo"]:
            pezzi.append(f'tipo="{a["tipo"]}"')
        out.append(" ".join(pezzi))

    return out


def main():
    ap = argparse.ArgumentParser(description="Trasforma l'export di Salute nel pacchetto per Coach.")
    ap.add_argument("export", help="export.zip di Salute, oppure l'export.xml già estratto")
    ap.add_argument("--giorni", type=int, default=21, help="quanti giorni indietro (default 21)")
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
    # Un pavimento esplicito vince sulla finestra: l'archivio di Salute contiene
    # anni, e non ha senso importare giornate precedenti all'inizio del programma.
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
