# Ollama-Server als Container – deploybar auf Google Cloud (Cloud Run oder GCE).
#
# Baut auf dem offiziellen Ollama-Image auf und startet einen HTTP-Server, der
# das gewünschte Modell bereitstellt (OpenAI-kompatible API + Ollama-API).
#
# Das Modell wird standardmäßig beim ersten Start geladen. Optional lässt es
# sich schon beim Bauen ins Image "backen" (schnellere Kaltstarts, größeres
# Image) – siehe Build-Argument PRELOAD_MODEL weiter unten.

FROM ollama/ollama:latest

# Welches Modell soll bereitgestellt werden?
#   - Aus dem Ollama-Katalog:      z. B. "llama3.2:3b", "qwen2.5:7b", "minimax-m2"
#   - Direkt von Hugging Face:     z. B. "hf.co/bartowski/Llama-3.2-3B-Instruct-GGUF:Q4_K_M"
ENV OLLAMA_MODEL="llama3.2:3b"

# Ollama muss im Container von außen erreichbar sein.
ENV OLLAMA_HOST="0.0.0.0:11434"

# Modelle liegen unter /root/.ollama – als Volume mountbar (persistenter Cache).
ENV OLLAMA_MODELS="/root/.ollama/models"

# Optional beim Bauen ein Modell mit ins Image legen (leer lassen = aus).
# Beispiel:  docker build --build-arg PRELOAD_MODEL="llama3.2:3b" .
ARG PRELOAD_MODEL=""
RUN if [ -n "$PRELOAD_MODEL" ]; then \
        ollama serve & \
        server_pid=$!; \
        until ollama list >/dev/null 2>&1; do sleep 1; done; \
        ollama pull "$PRELOAD_MODEL"; \
        kill "$server_pid"; \
    fi

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Cloud Run erwartet, dass der Container auf $PORT lauscht; entrypoint.sh
# bringt Ollamas Port damit in Einklang.
EXPOSE 11434

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
