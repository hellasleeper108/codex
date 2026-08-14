"""Shared CODEX logic for the local server and Vercel functions."""

from __future__ import annotations

import json
import os
import re
import unicodedata
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent


def _data_dir() -> Path:
    for path in (ROOT / "data", Path.cwd() / "data"):
        if (path / "tractates.json").exists():
            return path
    return ROOT / "data"


DATA = _data_dir()
PORT = int(os.environ.get("CODEX_PORT", "1987"))
HOST = os.environ.get("CODEX_HOST", "127.0.0.1")

HEBREW = {
    "א": 1, "ב": 2, "ג": 3, "ד": 4, "ה": 5, "ו": 6, "ז": 7, "ח": 8, "ט": 9,
    "י": 10, "כ": 20, "ך": 20, "ל": 30, "מ": 40, "ם": 40, "נ": 50, "ן": 50,
    "ס": 60, "ע": 70, "פ": 80, "ף": 80, "צ": 90, "ץ": 90, "ק": 100, "ר": 200,
    "ש": 300, "ת": 400,
}
HEBREW_GADOL = dict(HEBREW)
HEBREW_GADOL.update({"ך": 500, "ם": 600, "ן": 700, "ף": 800, "ץ": 900})

ATBASH_ABC = "אבגדהוזחטיכלמנסעפצקרשת"
ATBASH = {ch: ATBASH_ABC[-i - 1] for i, ch in enumerate(ATBASH_ABC)}

GREEK = {
    "α": 1, "β": 2, "γ": 3, "δ": 4, "ε": 5, "ϛ": 6, "ϝ": 6, "ζ": 7, "η": 8, "θ": 9,
    "ι": 10, "κ": 20, "λ": 30, "μ": 40, "ν": 50, "ξ": 60, "ο": 70, "π": 80, "ϟ": 90,
    "ρ": 100, "σ": 200, "ς": 200, "τ": 300, "υ": 400, "φ": 500, "χ": 600, "ψ": 700,
    "ω": 800, "ϡ": 900,
}


def _read_json(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def load_tractates():
    return _read_json(DATA / "tractates.json")


def load_tree():
    return _read_json(DATA / "tree.json")


def load_xref():
    return _read_json(DATA / "xref.json")


def load_words():
    return _read_json(DATA / "hebrew_words.json")


def build_status():
    return {
        "name": "CODEX",
        "version": "1.3",
        "host": HOST,
        "port": PORT,
        "runtime": "vercel" if os.environ.get("VERCEL") else "local",
        "now": __import__("time").time(),
    }


def _norm(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", ascii_value.lower()).strip()


def english_letters(value: str) -> list[str]:
    return [ch.upper() for ch in value if "A" <= ch.upper() <= "Z"]


def full_reduce(number: int) -> int:
    return ((number - 1) % 9) + 1 if number > 0 else 0


def hebrew_sum(text: str, table: dict[str, int]) -> int:
    return sum(table.get(ch, 0) for ch in text)


def greek_sum(text: str) -> int:
    folded = unicodedata.normalize("NFD", text.lower())
    folded = "".join(ch for ch in folded if unicodedata.category(ch) != "Mn")
    return sum(GREEK.get(ch, 0) for ch in folded)


def atbash_hebrew(text: str) -> str:
    out = []
    for ch in text:
        out.append(ATBASH.get(ch, ch))
    return "".join(out)


def gematria(text: str) -> dict:
    text = (text or "").strip()
    letters = english_letters(text)
    ordinal = sum(ord(ch) - 64 for ch in letters)
    reverse = sum(27 - (ord(ch) - 64) for ch in letters)
    heb = hebrew_sum(text, HEBREW)
    gadol = hebrew_sum(text, HEBREW_GADOL)
    gre = greek_sum(text)
    atb = atbash_hebrew(text)
    atb_val = hebrew_sum(atb, HEBREW)
    ciphers = {
        "hebrew": heb,
        "hebrew_gadol": gadol,
        "atbash": atb_val,
        "atbash_text": atb if any(ch in HEBREW for ch in text) else "",
        "greek": gre,
        "ordinal": ordinal,
        "reduction": sum(full_reduce(ord(ch) - 64) for ch in letters),
        "reverse": reverse,
        "reverse_reduction": sum(full_reduce(27 - (ord(ch) - 64)) for ch in letters),
    }
    targets = {heb, gadol, ordinal}
    matches = []
    if any(targets):
        for word in load_words():
            val = int(word.get("value") or 0)
            if val in targets and val:
                matches.append(word)
            if len(matches) >= 16:
                break
    return {"query": text, "ciphers": ciphers, "matches": matches}


def find_tractate(q: str):
    qn = (q or "").strip().lower()
    if not qn:
        return None
    for t in load_tractates().get("tractates") or []:
        blob = " ".join(
            [t.get("id", ""), t.get("name", ""), str(t.get("rank", "")), " ".join(t.get("aliases") or [])]
        ).lower()
        if qn == t.get("id") or qn == str(t.get("rank")) or qn == t.get("name", "").lower() or qn in blob:
            return t
    return None


def find_sefirah(q: str):
    qn = _norm(q or "")
    if not qn:
        return None
    for s in load_tree().get("sefirot") or []:
        names = {_norm(s.get("key", "")), _norm(s.get("name", "")), _norm(s.get("meaning", "")), str(s.get("id"))}
        if qn in names or qn == _norm(s.get("hebrew", "")):
            return s
    return None


def find_path(q: str):
    qn = (q or "").strip().lower()
    if not qn:
        return None
    for p in load_tree().get("paths") or []:
        if (
            qn == str(p.get("id"))
            or qn == (p.get("letter") or "").lower()
            or qn == (p.get("letter_name") or "").lower()
            or qn in (p.get("card") or "").lower()
            or qn == (p.get("astrology") or "").lower()
        ):
            return p
    return None


def xref_lookup(q: str):
    data = load_xref()
    qn = _norm(q or "")
    if not qn:
        return {"query": q, "hits": []}
    hits = []
    for key, body in data.items():
        names = {_norm(key)}
        blob = " ".join([key, json.dumps(body, ensure_ascii=False)]).lower()
        if qn in names or qn in _norm(key) or qn in blob:
            rec = {"id": key, "name": key}
            if isinstance(body, dict):
                rec.update(body)
            hits.append(rec)
    return {"query": q, "hits": hits[:20]}


def search_all(q: str, limit: int = 40):
    qn = (q or "").strip().lower()
    if not qn:
        return {"query": q, "hits": []}
    hits = []
    for t in load_tractates().get("tractates") or []:
        blob = " ".join(
            [
                t.get("name", ""),
                t.get("id", ""),
                t.get("tradition", ""),
                t.get("summary", ""),
                t.get("in_the_file", ""),
                " ".join(t.get("aliases") or []),
            ]
        ).lower()
        if qn in blob:
            hits.append({"kind": "tractate", "id": t["id"], "name": t["name"], "detail": t.get("summary") or ""})
    for s in load_tree().get("sefirot") or []:
        blob = " ".join(
            [s.get("name", ""), s.get("key", ""), s.get("meaning", ""), s.get("planet", ""), s.get("archangel", "")]
        ).lower()
        if qn in blob:
            hits.append({"kind": "sefirah", "id": s["key"], "name": s["name"], "detail": s.get("meaning") or ""})
    for p in load_tree().get("paths") or []:
        blob = " ".join(
            [str(p.get("id")), p.get("letter", ""), p.get("letter_name", ""), p.get("card", ""), p.get("astrology", "")]
        ).lower()
        if qn in blob:
            hits.append(
                {
                    "kind": "path",
                    "id": str(p["id"]),
                    "name": f"Path {p['id']} {p.get('card')}",
                    "detail": f"{p.get('letter')} · {p.get('astrology')}",
                }
            )
    xr = xref_lookup(q)
    for rec in xr.get("hits") or []:
        hits.append(
            {
                "kind": "xref",
                "id": rec.get("id"),
                "name": rec.get("name"),
                "detail": rec.get("kabbalah") or rec.get("hermeticism") or "",
            }
        )
        if len(hits) >= limit:
            break
    return {"query": q, "hits": hits[:limit]}


def send_json(req: BaseHTTPRequestHandler, payload, code: int = 200, cache: int = 300) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req.send_response(code)
    req.send_header("Content-Type", "application/json; charset=utf-8")
    if cache > 0:
        req.send_header("Cache-Control", f"public, s-maxage={cache}, stale-while-revalidate=600")
    else:
        req.send_header("Cache-Control", "no-store")
    req.send_header("Content-Length", str(len(body)))
    req.end_headers()
    req.wfile.write(body)


def qs(req: BaseHTTPRequestHandler) -> dict[str, list[str]]:
    return parse_qs(urlparse(req.path).query)
