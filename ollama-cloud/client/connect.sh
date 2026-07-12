#!/usr/bin/env bash
# Verbindet Claude Code / die Claude-CLI mit dem selbst-gehosteten Ollama-Modell.
#
# Das Skript ermittelt die Endpunkt-URL (Cloud Run) samt Auth-Token, startet den
# lokalen Anthropic->Ollama-Proxy und ruft anschließend `claude` mit den richtigen
# Umgebungsvariablen auf.
#
# Nutzung:
#   ./connect.sh                 # Proxy starten + claude launchen
#   ./connect.sh --print-env     # nur die export-Zeilen ausgeben (kein Launch)
#   ./connect.sh -- chat "Hi"    # alles nach -- wird an `claude` durchgereicht
#
# Endpunkt-Quelle (in dieser Reihenfolge):
#   1. OLLAMA_URL (Umgebungsvariable)  -> direkt verwenden
#   2. SERVICE + REGION aus .env       -> via `gcloud run services describe` auflösen
#
# Konfiguration über ../.env (siehe ../.env.example) oder Umgebungsvariablen:
#   OLLAMA_URL    Basis-URL des Servers (überschreibt Auto-Auflösung)
#   OLLAMA_MODEL  Modellname bei Ollama
#   SERVICE/REGION/PROJECT_ID  für die Cloud-Run-Auflösung
#   ALLOW_UNAUTH  "true" = kein Identity-Token nötig
#   PROXY_PORT    lokaler Proxy-Port (Standard: 8787)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# .env aus dem übergeordneten ollama-cloud-Verzeichnis laden.
if [ -f "${SCRIPT_DIR}/../.env" ]; then
    set -a; . "${SCRIPT_DIR}/../.env"; set +a
fi

PRINT_ENV=false
CLAUDE_ARGS=()
while [ $# -gt 0 ]; do
    case "$1" in
        --print-env) PRINT_ENV=true; shift ;;
        --) shift; CLAUDE_ARGS=("$@"); break ;;
        *) CLAUDE_ARGS+=("$1"); shift ;;
    esac
done

OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2:3b}"
PROXY_PORT="${PROXY_PORT:-8787}"
UPSTREAM_TOKEN=""

# 1) URL bestimmen.
if [ -n "${OLLAMA_URL:-}" ]; then
    URL="${OLLAMA_URL}"
elif [ -n "${SERVICE:-}" ]; then
    REGION="${REGION:-us-central1}"
    [ -n "${PROJECT_ID:-}" ] && gcloud config set project "${PROJECT_ID}" >/dev/null 2>&1 || true
    echo "==> Löse Cloud-Run-URL für Dienst '${SERVICE}' (${REGION}) auf ..."
    URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" \
        --format 'value(status.url)')"
    if [ "${ALLOW_UNAUTH:-false}" != "true" ]; then
        UPSTREAM_TOKEN="$(gcloud auth print-identity-token)"
    fi
else
    echo "!! Kein Endpunkt gefunden. Setze OLLAMA_URL oder SERVICE/REGION in ../.env." >&2
    exit 1
fi

echo "==> Endpunkt : ${URL}"
echo "==> Modell   : ${OLLAMA_MODEL}"

if [ "${PRINT_ENV}" = "true" ]; then
    echo
    echo "# Proxy separat starten:"
    echo "UPSTREAM_URL='${URL}' UPSTREAM_MODEL='${OLLAMA_MODEL}' \\"
    echo "  UPSTREAM_TOKEN='${UPSTREAM_TOKEN}' PROXY_PORT='${PROXY_PORT}' \\"
    echo "  python3 '${SCRIPT_DIR}/anthropic_proxy.py'"
    echo
    echo "# Danach für Claude Code exportieren:"
    echo "export ANTHROPIC_BASE_URL=http://127.0.0.1:${PROXY_PORT}"
    echo "export ANTHROPIC_AUTH_TOKEN=dummy"
    exit 0
fi

# 2) Proxy im Hintergrund starten.
echo "==> Starte Anthropic-Proxy auf Port ${PROXY_PORT} ..."
UPSTREAM_URL="${URL}" UPSTREAM_MODEL="${OLLAMA_MODEL}" \
    UPSTREAM_TOKEN="${UPSTREAM_TOKEN}" PROXY_PORT="${PROXY_PORT}" \
    python3 "${SCRIPT_DIR}/anthropic_proxy.py" &
PROXY_PID=$!
trap 'kill "${PROXY_PID}" 2>/dev/null || true' EXIT

# Auf Bereitschaft warten.
i=0
until curl -sf "http://127.0.0.1:${PROXY_PORT}/health" >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -gt 30 ] && { echo "!! Proxy startet nicht." >&2; exit 1; }
    sleep 0.5
done

if ! command -v claude >/dev/null 2>&1; then
    echo "!! 'claude' (Claude Code) ist nicht installiert."
    echo "   Proxy läuft trotzdem. Exportiere in einer anderen Shell:"
    echo "     export ANTHROPIC_BASE_URL=http://127.0.0.1:${PROXY_PORT}"
    echo "     export ANTHROPIC_AUTH_TOKEN=dummy"
    echo "   (Strg-C beendet den Proxy.)"
    wait "${PROXY_PID}"
    exit 0
fi

# 3) Claude Code mit dem Proxy als Backend starten.
echo "==> Starte Claude Code gegen das gehostete Modell ..."
ANTHROPIC_BASE_URL="http://127.0.0.1:${PROXY_PORT}" \
    ANTHROPIC_AUTH_TOKEN="dummy" \
    claude "${CLAUDE_ARGS[@]}"
