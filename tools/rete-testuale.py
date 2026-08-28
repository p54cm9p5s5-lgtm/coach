#!/usr/bin/env python3
"""La parte della rete che si può controllare senza un browser.

Il collaudo vero (tools/rete.js) gira dentro l'app: legge l'archivio, disegna le
schermate, mette alla prova il motore delle proposte. Bellissimo, e inutile nel
momento che conta di più — la pubblicazione — perché `pubblica.sh` è uno script
di shell e non ha un browser sotto mano.

Risultato: il 27/08 ho pubblicato ventitré volte dicendo ogni volta «la base è
identica e la rete passa», e non ne resta traccia da nessuna parte. Era la mia
parola contro niente.

Qui c'è la parte che il testo può dimostrare da solo, e `pubblica.sh` la lancia
a ogni pubblicazione. Non sostituisce la rete: ne è il pezzo che non ha bisogno
di chiedere il permesso a nessuno.

    python3 tools/rete-testuale.py

Esce 0 se tutto regge, 1 se qualcosa non torna.
"""
import json
import pathlib
import re
import sys

RADICE = pathlib.Path(__file__).resolve().parent.parent
errori = []
casi = 0


def leggi(rel):
    return (RADICE / rel).read_text(encoding="utf-8")


def prova(nome, condizione, dettaglio=""):
    global casi
    casi += 1
    if not condizione:
        errori.append(f"{nome}{': ' + dettaglio if dettaglio else ''}")


# --- 1. le regole che devono restare scritte una volta sola -------------------
# Stesse regole di tools/rete.js, stessa ragione: quattro difetti su sei del
# 27/08 erano una regola copiata due volte, e una delle due rimasta indietro.
REGOLE = [
    ("quanto è durato l'allenamento", "oraInizioLavoro ||", ["js/store.js"]),
    ("quale carico proporre", "caricoDaDecisione", ["js/store.js"]),
    ("come si scrive il bersaglio", "ripMin === v.ripMax", ["js/store.js"]),
    ("come si legge un numero scritto a mano", r"^-?\d*\.?\d+$", ["js/store.js"]),
    ("quanti giorni fra due date", "/ 86400000", ["js/ui.js"]),
    ("ogni quanto si verifica una proposta", "= 14", ["js/segnali.js"]),
    ("la scelta di un file non ascolta la finestra", "window.addEventListener", ["js/app.js"]),
]
FONTI = sorted(str(p.relative_to(RADICE)) for p in (RADICE / "js").rglob("*.js"))

for cosa, segno, solo in REGOLE:
    dove = []
    for f in FONTI:
        for riga in leggi(f).split("\n"):
            t = riga.strip()
            if t.startswith("//") or t.startswith("*"):
                continue
            if segno in riga:
                dove.append(f)
                break
    fuori = [f for f in dove if f not in solo]
    prova(f"«{cosa}» scritta una volta sola", not fuori, f"si trova anche in {', '.join(fuori)}")
    prova(f"«{cosa}» sta ancora dove deve", any(f in solo for f in dove),
          f"non si trova più in {', '.join(solo)}: la prova non controlla più niente")

# --- 2. dove può andare la rete ----------------------------------------------
AMMESSI = {"www.youtube-nocookie.com", "i.ytimg.com", "www.w3.org"}
for f in FONTI + ["index.html", "css/app.css", "manifest.webmanifest", "sw.js"]:
    for d in set(re.findall(r"https?://([A-Za-z0-9.-]+)", leggi(f))):
        prova(f"nessun dominio nuovo in {f}", d in AMMESSI, f"contatta {d}")

# --- 3. la Content-Security-Policy -------------------------------------------
html = leggi("index.html")
m = re.search(r'http-equiv="Content-Security-Policy"\s*\n?\s*content="([^"]*)"', html)
prova("la CSP c'è", bool(m))
if m:
    csp = " ".join(m.group(1).split())
    for pezzo in ["default-src 'self'", "script-src 'self'", "object-src 'none'",
                  "form-action 'none'", "frame-src https://www.youtube-nocookie.com",
                  "connect-src 'self' https://i.ytimg.com"]:
        prova(f"la CSP dice «{pezzo}»", pezzo in csp)
    prova("la CSP non permette di eseguire testo", "unsafe-eval" not in csp)
    prova("la CSP non ha caratteri jolly", " *" not in csp)
    viste = [p.strip().split()[0] for p in csp.split(";") if p.strip()]
    prova("nessuna direttiva ripetuta nella CSP", len(viste) == len(set(viste)))

# --- 4. i documenti non devono promettere quello che l'app non fa -------------
# SPEC e README hanno promesso per settimane che aprire un esercizio non
# contattava nessuno, mentre montava un player e scaricava una miniatura.
BUGIE = [
    r"copertina è disegnata dall'app, non scaricata",
    r"parte \*\*solo se tocchi il video\*\*",
    r"Aprire una scheda esercizio non produce nessuna\s*\n?\s*richiesta",
]
for doc in ["README.md", "SPEC.md"]:
    testo = leggi(doc)
    for b in BUGIE:
        prova(f"{doc} non promette di nuovo che non esce niente", not re.search(b, testo))

# --- 5. la copia locale copre tutto quello che l'app carica ------------------
sw = leggi("sw.js")
blocco = re.search(r"const ASSETS = \[(.*?)\];", sw, re.S)
prova("sw.js ha l'elenco della copia locale", bool(blocco))
if blocco:
    precache = {p.strip() for p in re.findall(r'"\./([^"]*)"', blocco.group(1))}
    attesi = {
        str(p.relative_to(RADICE))
        for p in RADICE.rglob("*")
        if p.is_file()
        and p.suffix in {".js", ".css", ".html", ".json", ".png", ".webmanifest"}
        and not str(p.relative_to(RADICE)).startswith(("tools/", "_privato/", ".claude/", ".git/"))
    } - {"sw.js"}
    fuori = sorted(attesi - precache)
    prova("ogni file dell'app è nella copia locale", not fuori, f"fuori: {', '.join(fuori)}")
    fantasmi = sorted(p for p in precache if p and not (RADICE / p).exists())
    prova("la copia locale non elenca file che non esistono", not fantasmi, f"fantasmi: {', '.join(fantasmi)}")

# --- 6. i dati che l'app porta con sé ----------------------------------------
lib = json.loads(leggi("data/esercizi.json"))
esercizi = lib if isinstance(lib, list) else lib.get("esercizi", [])
prova("la libreria non è vuota", len(esercizi) > 0)
ids, video = set(), {}
etichette = set(re.findall(r"^\s{2}(\w+):", leggi("js/store.js")[leggi("js/store.js").index("ETICHETTE_PATTERN = {"):], re.M))
for e in esercizi:
    prova("ogni esercizio ha un id", bool(e.get("id")))
    prova(f"id non ripetuto: {e.get('id')}", e.get("id") not in ids)
    ids.add(e.get("id"))
    for campo in ("nome", "pattern", "attrezzo", "setup", "esecuzione", "cue", "erroriComuni"):
        prova(f"{e.get('id')} ha «{campo}»", bool(e.get(campo)))
    v = (e.get("video") or {}).get("id")
    if v:
        prova(f"{e.get('id')}: id video di 11 caratteri", bool(re.fullmatch(r"[A-Za-z0-9_-]{11}", v)), v)
        prova(f"{e.get('id')}: video non già usato", v not in video, f"già di {video.get(v)}")
        video[v] = e.get("id")

prot = json.loads(leggi("data/riscaldamento.json"))
prova("il protocollo ha i suoi giorni", bool(prot.get("giorni")))

# --- 7. il blocco facoltativo dopo la camminata ------------------------------
# Le sue quattro posizioni non sono scritte due volte: nel file ci sono solo i
# nomi, e le istruzioni si leggono dal blocco di mobilità. Un nome che non
# combacia sparirebbe dalla schermata senza dire niente.
tenute = {v["nome"] for v in (prot.get("tenuteStatiche") or {}).get("passi", [])}
postcardio = prot.get("stretchingPostCardio") or {}
if postcardio:
    prova("il blocco dopo la camminata e dichiarato facoltativo", postcardio.get("facoltativo") is True)
    for nome in postcardio.get("passi", []):
        prova(f"«{nome}» esiste fra le tenute", nome in tenute, "nome che non si risolve")
    prova(
        "il blocco dopo la camminata non entra nel punteggio",
        "stretchingPostCardio" not in leggi("js/punteggio.js"),
        "punteggio.js lo nomina: e dichiarato facoltativo, non deve pesare",
    )
    prova(
        "nessuno lo fa valere nel punteggio Salute",
        "stretchingPostCardio" not in leggi("js/store.js").split("export async function punteggioSalute")[-1][:6000],
        "compare dentro punteggioSalute",
    )

# --- verdetto -----------------------------------------------------------------
print()
if errori:
    print(f"  LA RETE TESTUALE NON PASSA — {len(errori)} problemi su {casi} controlli")
    for e in errori[:12]:
        print(f"    · {e}")
    if len(errori) > 12:
        print(f"    · … e altri {len(errori) - 12}")
    print()
    sys.exit(1)
print(f"  Rete testuale: {casi} controlli, nessun problema.")
print()
