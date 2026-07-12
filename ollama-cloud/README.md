# ollama-cloud — Ollama-Modelle auf Google Cloud hosten

Ein eigenständiges Deployment-Paket, um ein **Ollama-LLM als Server auf Google
Cloud** zu betreiben. Das Modell wird aus dem **Ollama-Katalog** oder direkt von
**Hugging Face** geladen und über eine **OpenAI-kompatible API** bereitgestellt —
nutzbar aus jedem Client, Skript oder Tool.

Zwei Wege, je nach Modellgröße und Budget:

| Weg | Wofür | Skript |
|---|---|---|
| **Cloud Run** (serverlos, GPU) | Schnell startklar, zahlt nur bei Nutzung, skaliert auf 0. Ideal für kleine bis mittlere Modelle. | `deploy-cloudrun.sh` |
| **Compute Engine** (VM, GPU) | Große Modelle (70B+), dauerhafter Betrieb, mehr GPU-Speicher, persistente Modell-Disk. | `deploy-gce.sh` |

> Das Gegenstück in diesem Repo, [`local-llm`](../local-llm), lässt Modelle
> **offline auf der eigenen Maschine** laufen. `ollama-cloud` ist die
> **gehostete** Variante für Google Cloud.

## Voraussetzungen

- Ein **Google-Cloud-Projekt** mit aktivierter Abrechnung
- Die **[gcloud CLI](https://cloud.google.com/sdk/docs/install)**, eingeloggt:
  ```bash
  gcloud auth login
  ```
- GPU-Kontingent im gewünschten Projekt/Region (für Cloud Run: NVIDIA L4;
  ggf. unter *IAM & Verwaltung → Kontingente* anfragen)

## Schnellstart (Cloud Run)

```bash
cd ollama-cloud
cp .env.example .env          # PROJECT_ID und OLLAMA_MODEL eintragen
./deploy-cloudrun.sh
```

Das Skript baut das Container-Image (via Cloud Build), deployt es mit GPU auf
Cloud Run und gibt am Ende die Dienst-URL samt Test-`curl` aus.

## Modell wählen

Gesteuert über die Variable **`OLLAMA_MODEL`** (in `.env` oder als Umgebungsvariable):

**Aus dem Ollama-Katalog** — einfach der Modellname:
```
OLLAMA_MODEL=llama3.2:3b       # kompakt, günstig
OLLAMA_MODEL=qwen2.5:7b        # guter Allrounder
OLLAMA_MODEL=gemma2:9b         # stark auf Deutsch
OLLAMA_MODEL=minimax-m2        # MiniMax M2 (groß → Compute Engine nutzen)
```

**Direkt von Hugging Face** — jedes GGUF-Repo per `hf.co/...`-Referenz:
```
OLLAMA_MODEL=hf.co/bartowski/Llama-3.2-3B-Instruct-GGUF:Q4_K_M
```
Für **private oder gated** Hugging-Face-Modelle zusätzlich einen Read-Token
setzen: `HF_TOKEN=hf_xxx` in `.env`.

> **Hinweis zu „minimax-m3:cloud":** Im Ollama-Katalog gibt es aktuell
> **`minimax-m2`** (MiniMax M2). Eine `:cloud`-Variante ist Ollamas gehostetes
> Angebot und läuft **nicht** in deiner eigenen Cloud. Wenn du MiniMax selbst
> hosten willst, nimm `minimax-m2` **oder** verweise per `hf.co/...` auf ein
> GGUF-Repo von MiniMax auf Hugging Face. MiniMax ist groß — dafür den
> **Compute-Engine-Weg** mit ausreichend GPU-Speicher verwenden.

## Große Modelle: Compute Engine

Für Modelle, die mehr GPU-Speicher brauchen, als Cloud Run bietet:

```bash
cp .env.example .env          # PROJECT_ID, OLLAMA_MODEL, ggf. MACHINE_TYPE/GPU
./deploy-gce.sh
```

Das Skript erstellt eine GPU-VM (Container-Optimized Deep-Learning-Image),
legt die Modelle auf einer **persistenten Disk** ab (überleben VM-Neustarts),
installiert Ollama als systemd-Dienst und lädt das Modell. Für größere Modelle
`MACHINE_TYPE` / `GPU_COUNT` in `.env` hochsetzen (z. B. `a2-highgpu-1g` mit
`nvidia-tesla-a100`).

## API benutzen

Der Dienst spricht sowohl die **Ollama-API** als auch eine **OpenAI-kompatible
API**. Beispiel gegen Cloud Run (URL aus der Skript-Ausgabe):

```bash
URL="https://ollama-xxxx.a.run.app"

curl "$URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  -d '{
    "model": "llama3.2:3b",
    "messages": [{"role": "user", "content": "Erklär mir Row Level Security."}]
  }'
```

Als **Backend für Tools**, die einen OpenAI-Endpunkt erwarten:

```bash
export OPENAI_BASE_URL="$URL/v1"
export OPENAI_API_KEY="$(gcloud auth print-identity-token)"   # bei privatem Dienst
```

> Bei `ALLOW_UNAUTH=false` (Standard) ist der Dienst nur mit gültigem
> Google-Identity-Token erreichbar. Für einen offenen Endpunkt
> `ALLOW_UNAUTH=true` setzen — aber nur mit Bedacht, ein offener LLM-Endpunkt
> kann teuer werden.

## Mit Claude Code / der Claude-CLI verbinden

Willst du **Claude Code** (oder die `claude`-CLI) mit deinem selbst-gehosteten
Modell betreiben? Claude Code spricht die **Anthropic-API** (`/v1/messages`),
Ollama die **OpenAI-API** (`/v1/chat/completions`). Der Ordner
[`client/`](client) enthält dafür einen kleinen **Übersetzungs-Proxy** (nur
Python-Standardbibliothek) und einen Launcher:

```bash
cd ollama-cloud/client
./connect.sh          # löst den Cloud-Endpunkt auf, startet den Proxy und ruft `claude`
```

`connect.sh` liest `../.env` (URL/Modell/Auth), startet
`anthropic_proxy.py` lokal und launcht `claude` mit den passenden Variablen
(`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`). Nur die Umgebung ausgeben,
ohne zu starten:

```bash
./connect.sh --print-env
```

Gegen einen beliebigen Endpunkt (statt Auto-Auflösung über Cloud Run):

```bash
OLLAMA_URL=https://ollama-xxxx.a.run.app OLLAMA_MODEL=llama3.2:3b ./connect.sh
```

> **Was funktioniert:** normaler Chat inkl. Streaming. **Grenzen:** Der Proxy
> überträgt Text, aber **kein Tool-Calling** im Anthropic-Format — Claude Codes
> werkzeuglastige Abläufe (Datei-Edits, Bash) brauchen ein Modell, das
> Tool-Use beherrscht, und laufen mit kleinen lokalen Modellen nur
> eingeschränkt. Für reine Chat-/Text-Nutzung reicht es. Wer volle
> OpenAI-/Anthropic-Kompatibilität inkl. Tools braucht, kann alternativ einen
> ausgereiften Proxy wie **LiteLLM** vor denselben Endpunkt setzen.

Ohne Umweg über Claude Code lässt sich der Endpunkt direkt als
**OpenAI-Backend** nutzen — siehe Abschnitt „API benutzen" oben.

## Konfiguration (Übersicht)

| Variable | Standard | Beschreibung |
|---|---|---|
| `PROJECT_ID` | – | **Pflicht.** GCP-Projekt-ID |
| `OLLAMA_MODEL` | `llama3.2:3b` | Modellname oder `hf.co/...`-Referenz |
| `HF_TOKEN` | – | Hugging-Face-Token für private/gated Modelle |
| `REGION` | `us-central1` | Cloud-Run-Region (GPU-fähig) |
| `SERVICE` | `ollama` | Name des Cloud-Run-Dienstes |
| `GPU_TYPE` | `nvidia-l4` | GPU-Typ |
| `MEMORY` / `CPU` | `16Gi` / `4` | Cloud-Run-Ressourcen |
| `ALLOW_UNAUTH` | `false` | `true` = öffentlich ohne Auth |
| `ZONE` | `us-central1-a` | Compute-Engine-Zone |
| `MACHINE_TYPE` | `g2-standard-8` | VM-Maschinentyp |
| `GPU_COUNT` | `1` | Anzahl GPUs (GCE) |
| `DISK_SIZE` | `200` | Größe der Modell-Disk in GB (GCE) |
| `OPEN_FIREWALL` | `false` | `true` = Port 11434 öffentlich (GCE) |

## Kosten & Aufräumen

GPUs kosten Geld, solange sie laufen. Cloud Run skaliert bei Inaktivität auf 0
(`min-instances 0`), eine GCE-VM läuft dagegen durch, bis du sie stoppst.

```bash
# Cloud-Run-Dienst löschen
gcloud run services delete ollama --region us-central1

# GCE-VM stoppen (Rechenkosten aus, Disk bleibt) bzw. ganz löschen
gcloud compute instances stop ollama-vm --zone us-central1-a
gcloud compute instances delete ollama-vm --zone us-central1-a
```

## Lokal testen (ohne Google Cloud)

Das Image läuft auch lokal, z. B. zum Ausprobieren (GPU optional):

```bash
docker build -t ollama-cloud .
docker run --rm -p 11434:11434 -e OLLAMA_MODEL=llama3.2:3b ollama-cloud
# in einem zweiten Terminal:
curl http://localhost:11434/api/tags
```
