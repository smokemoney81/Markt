#!/usr/bin/env bash
# Deployt den Ollama-Server auf Google Cloud Run (serverlos, mit GPU).
#
# Voraussetzungen:
#   - gcloud CLI installiert und eingeloggt:  gcloud auth login
#   - Ein GCP-Projekt mit aktivierter Abrechnung
#
# Konfiguration über Umgebungsvariablen (oder .env – siehe .env.example):
#   PROJECT_ID   GCP-Projekt-ID            (Pflicht)
#   REGION       Cloud-Run-Region          (Standard: us-central1)
#   SERVICE      Name des Cloud-Run-Dienstes (Standard: ollama)
#   OLLAMA_MODEL Modell für Ollama         (Standard: llama3.2:3b)
#   GPU_TYPE     GPU-Typ                   (Standard: nvidia-l4)
#   MEMORY / CPU Ressourcen                (Standard: 16Gi / 4)
#   ALLOW_UNAUTH "true" = öffentlich erreichbar (Standard: false)
set -euo pipefail

# .env laden, falls vorhanden.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/.env" ]; then
    set -a; . "${SCRIPT_DIR}/.env"; set +a
fi

PROJECT_ID="${PROJECT_ID:?Bitte PROJECT_ID setzen (GCP-Projekt-ID)}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-ollama}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2:3b}"
GPU_TYPE="${GPU_TYPE:-nvidia-l4}"
MEMORY="${MEMORY:-16Gi}"
CPU="${CPU:-4}"
ALLOW_UNAUTH="${ALLOW_UNAUTH:-false}"

AUTH_FLAG="--no-allow-unauthenticated"
[ "${ALLOW_UNAUTH}" = "true" ] && AUTH_FLAG="--allow-unauthenticated"

echo "==> Projekt : ${PROJECT_ID}"
echo "==> Region  : ${REGION}"
echo "==> Dienst  : ${SERVICE}"
echo "==> Modell  : ${OLLAMA_MODEL}"
echo "==> GPU     : ${GPU_TYPE}"

gcloud config set project "${PROJECT_ID}" >/dev/null

echo "==> Aktiviere benötigte APIs ..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
    artifactregistry.googleapis.com --project "${PROJECT_ID}" >/dev/null

echo "==> Baue Image und deploye auf Cloud Run ..."
gcloud run deploy "${SERVICE}" \
    --source "${SCRIPT_DIR}" \
    --region "${REGION}" \
    --gpu 1 \
    --gpu-type "${GPU_TYPE}" \
    --no-gpu-zonal-redundancy \
    --cpu "${CPU}" \
    --memory "${MEMORY}" \
    --timeout 3600 \
    --concurrency 4 \
    --min-instances 0 \
    --max-instances 1 \
    --port 8080 \
    --set-env-vars "OLLAMA_MODEL=${OLLAMA_MODEL}" \
    ${AUTH_FLAG}

URL="$(gcloud run services describe "${SERVICE}" --region "${REGION}" \
    --format 'value(status.url)')"

echo
echo "==> Fertig! Dienst-URL: ${URL}"
echo
echo "Test (OpenAI-kompatibel):"
echo "  curl ${URL}/v1/chat/completions \\"
echo "    -H 'Content-Type: application/json' \\"
if [ "${ALLOW_UNAUTH}" != "true" ]; then
    echo "    -H \"Authorization: Bearer \$(gcloud auth print-identity-token)\" \\"
fi
echo "    -d '{\"model\":\"${OLLAMA_MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"Hallo!\"}]}'"
