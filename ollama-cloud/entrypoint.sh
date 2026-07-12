#!/usr/bin/env sh
# Startet den Ollama-Server, lädt das gewünschte Modell und hält den Prozess
# am Leben. Funktioniert sowohl auf Cloud Run (Port kommt via $PORT) als auch
# auf einer Compute-Engine-VM oder lokal.
set -eu

# Cloud Run gibt den Port über $PORT vor. Ollama lauscht auf OLLAMA_HOST, also
# bringen wir beides in Einklang.
if [ -n "${PORT:-}" ]; then
    export OLLAMA_HOST="0.0.0.0:${PORT}"
fi
: "${OLLAMA_HOST:=0.0.0.0:11434}"
: "${OLLAMA_MODEL:=llama3.2:3b}"

echo "==> Ollama-Host : ${OLLAMA_HOST}"
echo "==> Modell      : ${OLLAMA_MODEL}"

# Falls ein Hugging-Face-Token gesetzt ist (für gated/private Modelle),
# reicht Ollama es beim Pull von hf.co/... automatisch mit.
if [ -n "${HF_TOKEN:-}" ]; then
    export HF_TOKEN
    echo "==> Hugging-Face-Token erkannt (für private/gated Modelle)."
fi

# Server im Hintergrund starten.
ollama serve &
SERVER_PID=$!

# Auf Bereitschaft warten (max. 60 s).
echo "==> Warte auf Ollama-Server ..."
i=0
until ollama list >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -gt 60 ]; then
        echo "!! Ollama-Server ist nicht rechtzeitig gestartet." >&2
        exit 1
    fi
    sleep 1
done

# Modell laden, falls noch nicht vorhanden (z. B. bei leerem Volume).
if ollama list | awk '{print $1}' | grep -qx "${OLLAMA_MODEL}"; then
    echo "==> Modell bereits lokal vorhanden."
else
    echo "==> Lade Modell '${OLLAMA_MODEL}' ..."
    ollama pull "${OLLAMA_MODEL}"
fi

# Modell vorwärmen, damit die erste echte Anfrage schnell ist.
echo "==> Wärme Modell vor ..."
ollama run "${OLLAMA_MODEL}" "" >/dev/null 2>&1 || true

echo "==> Bereit. API unter http://${OLLAMA_HOST}"
echo "    - Ollama-API          : POST /api/chat"
echo "    - OpenAI-kompatibel   : POST /v1/chat/completions"

# Server im Vordergrund halten; Signale sauber weiterreichen.
trap 'kill -TERM "$SERVER_PID" 2>/dev/null || true' TERM INT
wait "$SERVER_PID"
