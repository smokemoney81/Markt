#!/usr/bin/env bash
# Deployt den Ollama-Server auf eine Google-Compute-Engine-VM mit GPU.
#
# Für große Modelle (z. B. MiniMax, 70B+), die mehr GPU-Speicher brauchen als
# Cloud Run bietet, oder wenn der Server dauerhaft laufen soll. Das Modell wird
# in einer Container-VM (Container-Optimized OS) betrieben; die Modelle liegen
# auf einer persistenten Disk, damit sie einen VM-Neustart überleben.
#
# Konfiguration über Umgebungsvariablen (oder .env – siehe .env.example):
#   PROJECT_ID    GCP-Projekt-ID                 (Pflicht)
#   ZONE          Compute-Zone                   (Standard: us-central1-a)
#   VM_NAME       Name der VM                    (Standard: ollama-vm)
#   MACHINE_TYPE  Maschinentyp                   (Standard: g2-standard-8)
#   GPU_TYPE      Beschleuniger                  (Standard: nvidia-l4)
#   GPU_COUNT     Anzahl GPUs                    (Standard: 1)
#   DISK_SIZE     Größe der Modell-Disk in GB    (Standard: 200)
#   OLLAMA_MODEL  Modell für Ollama              (Standard: llama3.2:3b)
#   OPEN_FIREWALL "true" = Port 11434 öffentlich (Standard: false)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/.env" ]; then
    set -a; . "${SCRIPT_DIR}/.env"; set +a
fi

PROJECT_ID="${PROJECT_ID:?Bitte PROJECT_ID setzen (GCP-Projekt-ID)}"
ZONE="${ZONE:-us-central1-a}"
VM_NAME="${VM_NAME:-ollama-vm}"
MACHINE_TYPE="${MACHINE_TYPE:-g2-standard-8}"
GPU_TYPE="${GPU_TYPE:-nvidia-l4}"
GPU_COUNT="${GPU_COUNT:-1}"
DISK_SIZE="${DISK_SIZE:-200}"
OLLAMA_MODEL="${OLLAMA_MODEL:-llama3.2:3b}"
OPEN_FIREWALL="${OPEN_FIREWALL:-false}"

echo "==> Projekt : ${PROJECT_ID}"
echo "==> Zone    : ${ZONE}  VM: ${VM_NAME}  (${MACHINE_TYPE}, ${GPU_COUNT}x ${GPU_TYPE})"
echo "==> Modell  : ${OLLAMA_MODEL}"

gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud services enable compute.googleapis.com --project "${PROJECT_ID}" >/dev/null

# Startskript: installiert Ollama, mountet die Modell-Disk und lädt das Modell.
STARTUP="$(cat <<STARTUP_EOF
#!/bin/bash
set -e
# Modell-Disk (falls angehängt) mounten und für Ollama verwenden.
DISK=/dev/disk/by-id/google-ollama-models
if [ -b "\$DISK" ]; then
  if ! blkid "\$DISK"; then mkfs.ext4 -F "\$DISK"; fi
  mkdir -p /var/lib/ollama
  mount "\$DISK" /var/lib/ollama || true
fi
# Ollama installieren (bringt NVIDIA-Setup automatisch mit, wenn GPU vorhanden).
curl -fsSL https://ollama.com/install.sh | sh
mkdir -p /var/lib/ollama
# Ollama als Dienst so konfigurieren, dass er extern lauscht und Modelle auf
# der persistenten Disk ablegt.
mkdir -p /etc/systemd/system/ollama.service.d
cat >/etc/systemd/system/ollama.service.d/override.conf <<CONF
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_MODELS=/var/lib/ollama/models"
CONF
systemctl daemon-reload
systemctl restart ollama
# Auf Server warten und Modell laden.
until curl -sf http://localhost:11434/api/tags >/dev/null; do sleep 2; done
ollama pull "${OLLAMA_MODEL}"
STARTUP_EOF
)"

echo "==> Erstelle persistente Modell-Disk (falls nicht vorhanden) ..."
gcloud compute disks create "${VM_NAME}-models" \
    --size "${DISK_SIZE}GB" --type pd-balanced --zone "${ZONE}" 2>/dev/null || true

echo "==> Erstelle VM ..."
gcloud compute instances create "${VM_NAME}" \
    --zone "${ZONE}" \
    --machine-type "${MACHINE_TYPE}" \
    --accelerator "type=${GPU_TYPE},count=${GPU_COUNT}" \
    --maintenance-policy TERMINATE \
    --image-family common-gpu-debian-12 \
    --image-project deeplearning-platform-release \
    --boot-disk-size 100GB \
    --disk "name=${VM_NAME}-models,device-name=ollama-models,mode=rw,boot=no" \
    --metadata-from-file startup-script=<(printf '%s' "${STARTUP}") \
    --scopes cloud-platform

if [ "${OPEN_FIREWALL}" = "true" ]; then
    echo "==> Öffne Firewall für Port 11434 ..."
    gcloud compute firewall-rules create allow-ollama \
        --allow tcp:11434 --target-tags ollama 2>/dev/null || true
    gcloud compute instances add-tags "${VM_NAME}" --zone "${ZONE}" --tags ollama
fi

echo
echo "==> VM wird gestartet. Das Startskript installiert Ollama und lädt das"
echo "    Modell (kann einige Minuten dauern). Fortschritt ansehen mit:"
echo "    gcloud compute ssh ${VM_NAME} --zone ${ZONE} --command 'sudo journalctl -u google-startup-scripts -f'"
echo
echo "Sicherer Zugriff per SSH-Tunnel (empfohlen, statt offener Firewall):"
echo "  gcloud compute ssh ${VM_NAME} --zone ${ZONE} -- -N -L 11434:localhost:11434"
echo "  # danach lokal: curl http://localhost:11434/api/tags"
