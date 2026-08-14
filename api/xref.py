import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from corpus import load_xref, qs, send_json, xref_lookup


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        term = (qs(self).get("q") or [""])[0]
        if term:
            send_json(self, xref_lookup(term), cache=300)
        else:
            send_json(self, {"entries": load_xref()}, cache=3600)
