# local-llm — LLMs lokal & offline laufen lassen

Ein eigenständiges Kommandozeilen-Tool, um Sprachmodelle komplett **lokal auf
der eigenen Maschine** zu betreiben — ohne Cloud, ohne API-Schlüssel, ohne
Abo. Internet wird nur **einmalig** gebraucht, um die Runtime und die Modelle
herunterzuladen. Danach funktioniert alles zu 100 % offline.

Unter der Haube nutzt das Tool [llama.cpp](https://github.com/ggml-org/llama.cpp)
(fertige Binaries, nichts muss kompiliert werden) und GGUF-Modelle von
Hugging Face.

## Voraussetzungen

- Python 3.8 oder neuer (nur Standardbibliothek, **keine pip-Pakete nötig**)
- Linux (x64/ARM64), macOS (Intel/Apple Silicon) oder Windows (x64)
- RAM je nach Modell: ab ~1 GB (kleine Modelle) bis ~8 GB (7B-Modelle)

## Schnellstart

```bash
cd local-llm

# 1. Runtime installieren (einmalig, ~30 MB)
python3 llm.py setup

# 2. Ein Modell holen (einmalig, hier ~1 GB)
python3 llm.py pull qwen2.5-1.5b

# 3. Chatten — ab jetzt komplett offline
python3 llm.py chat qwen2.5-1.5b
```

## Befehle

| Befehl | Beschreibung |
|---|---|
| `llm.py setup` | Lädt die passende llama.cpp-Runtime für dein System |
| `llm.py list` | Zeigt lokale Modelle und den Katalog |
| `llm.py pull <name>` | Lädt ein Modell aus dem Katalog (oder per direkter GGUF-URL) |
| `llm.py chat <name>` | Interaktiver Chat im Terminal |
| `llm.py run <name> -p "…"` | Einzelner Prompt, Antwort auf stdout (für Skripte) |
| `llm.py serve <name>` | Lokaler Server mit Web-UI und OpenAI-kompatibler API |
| `llm.py rm <name>` | Löscht ein lokales Modell |
| `llm.py info` | Zeigt Pfade und installierte Runtime |

Abgebrochene Downloads werden automatisch fortgesetzt.

## Modell-Katalog

| Name | Größe | Beschreibung |
|---|---|---|
| `smollm2-135m` | ~0,15 GB | Winziges Testmodell, läuft überall |
| `qwen2.5-0.5b` | ~0,4 GB | Sehr schnell, einfache Aufgaben |
| `qwen2.5-1.5b` | ~1,0 GB | Guter Kompromiss aus Tempo und Qualität |
| `llama3.2-1b` | ~0,8 GB | Meta Llama 3.2, kompakt |
| `llama3.2-3b` | ~2,0 GB | Meta Llama 3.2, deutlich stärker |
| `gemma2-2b` | ~1,7 GB | Google Gemma 2, gut auf Deutsch |
| `phi3.5-mini` | ~2,4 GB | Microsoft Phi 3.5, stark bei Logik/Code |
| `qwen2.5-7b` | ~4,7 GB | Sehr gute Qualität, braucht ≥ 8 GB RAM |
| `mistral-7b` | ~4,4 GB | Mistral 7B, Allrounder, braucht ≥ 8 GB RAM |

Jede andere GGUF-Datei geht auch:

```bash
python3 llm.py pull https://huggingface.co/<repo>/resolve/main/<datei>.gguf
```

## Server-Modus: Web-UI und API

```bash
python3 llm.py serve qwen2.5-1.5b
```

- **Web-UI** (Chat im Browser): <http://127.0.0.1:8080>
- **OpenAI-kompatible API**: `http://127.0.0.1:8080/v1/chat/completions` —
  funktioniert mit jedem OpenAI-Client, einfach die Base-URL umbiegen:

```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hallo!"}]}'
```

## Nützliche Optionen

```bash
# System-Prompt setzen
python3 llm.py chat qwen2.5-1.5b --system "Antworte immer auf Deutsch."

# Für Skripte: einzelne Antwort auf stdout
python3 llm.py run qwen2.5-1.5b -p "Fasse zusammen: …" -n 200

# Größerer Kontext, weniger CPU-Threads
python3 llm.py serve qwen2.5-1.5b --ctx 8192 --threads 4

# GPU-Build erzwingen (z. B. Vulkan unter Linux)
python3 llm.py setup --force --flavor vulkan-x64
```

## Wo landet was?

Alles liegt unter `~/.local-llm/` (änderbar über die Umgebungsvariable
`LOCAL_LLM_HOME`):

```
~/.local-llm/
├── bin/      # llama.cpp-Runtime
└── models/   # GGUF-Modelle
```

Zum vollständigen Entfernen einfach dieses Verzeichnis löschen.
