FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CODEX_HOST=0.0.0.0 \
    CODEX_PORT=1987

COPY corpus.py server.py requirements.txt ./
COPY api/ api/
COPY data/ data/
COPY public/ public/

RUN useradd --system --uid 999 --no-create-home desk \
    && chown -R desk:desk /app

USER desk

EXPOSE 1987

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:1987/api/status', timeout=4)"

CMD ["python3", "server.py"]
