#!/usr/bin/env python3
"""CODEX 1.3 — local Workbench station + tractate / gematria desk."""

from __future__ import annotations

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from corpus import (
    HOST,
    PORT,
    build_status,
    gematria,
    load_tractates,
    load_tree,
    load_xref,
    search_all,
    send_json,
    xref_lookup,
)

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "public"
if not STATIC.exists():
    STATIC = ROOT / "static"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC), **kwargs)

    def log_message(self, fmt, *args):
        import sys

        sys.stderr.write("[codex] " + (fmt % args) + "\n")

    def _err(self, message, code=500):
        send_json(self, {"error": message}, code=code, cache=0)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        q = parse_qs(parsed.query)
        try:
            if path == "/api/status":
                return send_json(self, build_status(), cache=30)
            if path == "/api/tractates":
                return send_json(self, load_tractates(), cache=3600)
            if path == "/api/tree":
                return send_json(self, load_tree(), cache=3600)
            if path == "/api/xref":
                term = (q.get("q") or [""])[0]
                if term:
                    return send_json(self, xref_lookup(term), cache=300)
                return send_json(self, {"entries": load_xref()}, cache=3600)
            if path == "/api/gematria":
                return send_json(self, gematria((q.get("q") or [""])[0]), cache=0)
            if path == "/api/search":
                return send_json(self, search_all((q.get("q") or [""])[0]), cache=60)
            if path in ("/", "/index.html"):
                self.path = "/index.html"
            return super().do_GET()
        except Exception as exc:  # noqa: BLE001
            self._err(str(exc), 500)

    def do_POST(self):
        self._err("not found", 404)


def main():
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"CODEX 1.3  http://{HOST}:{PORT}/")
    print("Desk: TRACTATE-10 · Tree of Life · Gematria · XREF")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nDF0: motor off")
        httpd.server_close()


if __name__ == "__main__":
    main()
