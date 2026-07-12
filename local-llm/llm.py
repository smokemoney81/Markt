#!/usr/bin/env python3
"""
local-llm — Offline-Tool, um LLMs lokal laufen zu lassen.

Einmalig online: Runtime (llama.cpp) und Modelle (GGUF) herunterladen.
Danach läuft alles zu 100 % offline auf der eigenen Maschine.

Benötigt nur Python 3.8+ (Standardbibliothek, keine pip-Pakete).

Befehle:
  setup              llama.cpp-Runtime für dieses System herunterladen
  pull <modell|url>  Modell herunterladen (Katalogname oder direkte GGUF-URL)
  list               Lokale Modelle und Katalog anzeigen
  chat <modell>      Interaktiver Chat im Terminal
  run <modell> -p …  Einzelner Prompt, Antwort auf stdout
  serve <modell>     Lokaler Server: Web-UI + OpenAI-kompatible API
  rm <modell>        Lokales Modell löschen
  info               Pfade, Runtime- und Plattform-Infos
"""

import argparse
import json
import os
import platform
import shutil
import ssl
import stat
import subprocess
import sys
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

HOME = Path(os.environ.get("LOCAL_LLM_HOME", Path.home() / ".local-llm"))
BIN_DIR = HOME / "bin"
MODELS_DIR = HOME / "models"

LLAMA_CPP_RELEASES = "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest"

# Kuratierter Katalog: kleine bis mittlere Instruct-Modelle als GGUF,
# alle frei zugänglich (kein Hugging-Face-Login nötig).
CATALOG = {
    "smollm2-135m": {
        "url": "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct-GGUF/resolve/main/smollm2-135m-instruct-q8_0.gguf",
        "size": "~0.15 GB",
        "desc": "Winziges Testmodell, läuft überall",
    },
    "qwen2.5-0.5b": {
        "url": "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
        "size": "~0.4 GB",
        "desc": "Sehr schnell, brauchbar für einfache Aufgaben",
    },
    "qwen2.5-1.5b": {
        "url": "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "size": "~1.0 GB",
        "desc": "Guter Kompromiss aus Tempo und Qualität",
    },
    "llama3.2-1b": {
        "url": "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
        "size": "~0.8 GB",
        "desc": "Meta Llama 3.2, kompakt",
    },
    "llama3.2-3b": {
        "url": "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
        "size": "~2.0 GB",
        "desc": "Meta Llama 3.2, deutlich stärker",
    },
    "gemma2-2b": {
        "url": "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf",
        "size": "~1.7 GB",
        "desc": "Google Gemma 2, gut auf Deutsch",
    },
    "phi3.5-mini": {
        "url": "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf",
        "size": "~2.4 GB",
        "desc": "Microsoft Phi 3.5, stark bei Logik/Code",
    },
    "qwen2.5-7b": {
        "url": "https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf",
        "size": "~4.7 GB",
        "desc": "Sehr gute Qualität, braucht ≥8 GB RAM",
    },
    "mistral-7b": {
        "url": "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
        "size": "~4.4 GB",
        "desc": "Mistral 7B, Allrounder, braucht ≥8 GB RAM",
    },
}


def die(msg, code=1):
    print(f"Fehler: {msg}", file=sys.stderr)
    sys.exit(code)


def ssl_context():
    # SSL_CERT_FILE/REQUESTS_CA_BUNDLE respektieren (z. B. Firmen-Proxys)
    cafile = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
    return ssl.create_default_context(cafile=cafile)


def http_get(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": "local-llm", **(headers or {})})
    return urllib.request.urlopen(req, context=ssl_context(), timeout=60)


def download(url, dest: Path, label=None):
    """Download mit Fortschrittsanzeige und Resume über eine .part-Datei."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + ".part")
    resume_from = part.stat().st_size if part.exists() else 0
    headers = {"Range": f"bytes={resume_from}-"} if resume_from else {}

    try:
        resp = http_get(url, headers)
    except urllib.error.HTTPError as e:
        if e.code == 416:  # .part ist bereits vollständig
            part.rename(dest)
            return
        raise

    if resume_from and resp.status != 206:
        resume_from = 0  # Server kann kein Resume, von vorn
    total = resp.headers.get("Content-Length")
    total = resume_from + int(total) if total else None

    mode = "ab" if resume_from else "wb"
    done = resume_from
    label = label or dest.name
    with open(part, mode) as f:
        while True:
            chunk = resp.read(1024 * 256)
            if not chunk:
                break
            f.write(chunk)
            done += len(chunk)
            if total:
                pct = done * 100 // total
                print(f"\r  {label}: {pct}% ({done // 2**20} / {total // 2**20} MB)",
                      end="", flush=True)
            else:
                print(f"\r  {label}: {done // 2**20} MB", end="", flush=True)
    print()
    part.rename(dest)


# ---------------------------------------------------------------- Runtime

def platform_asset_patterns():
    sysname = platform.system()
    machine = platform.machine().lower()
    x64 = machine in ("x86_64", "amd64")
    arm = machine in ("arm64", "aarch64")
    if sysname == "Linux":
        if x64:
            return ["bin-ubuntu-x64", "bin-linux-x64"]
        if arm:
            return ["bin-ubuntu-arm64", "bin-linux-arm64"]
    elif sysname == "Darwin":
        return ["bin-macos-arm64"] if arm else ["bin-macos-x64"]
    elif sysname == "Windows":
        return ["bin-win-cpu-x64", "bin-win-avx2-x64", "bin-win-x64"]
    return []


def find_binary(name):
    """Sucht llama-cli/llama-server unterhalb von BIN_DIR."""
    exe = name + (".exe" if platform.system() == "Windows" else "")
    hits = sorted(BIN_DIR.rglob(exe)) if BIN_DIR.exists() else []
    return hits[0] if hits else None


def runtime_env(binary: Path):
    env = os.environ.copy()
    libdir = str(binary.parent)
    for var in ("LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"):
        env[var] = libdir + (os.pathsep + env[var] if env.get(var) else "")
    return env


def require_binary(name):
    b = find_binary(name)
    if not b:
        die(f"Runtime nicht gefunden ({name}). Bitte zuerst ausführen: llm.py setup")
    return b


def cmd_setup(args):
    if find_binary("llama-cli") and not args.force:
        print(f"Runtime bereits installiert: {find_binary('llama-cli')}")
        print("Erneut installieren mit: llm.py setup --force")
        return

    patterns = [args.flavor] if args.flavor else platform_asset_patterns()
    if not patterns:
        die(f"Keine vorgebaute llama.cpp-Runtime für {platform.system()}/{platform.machine()}.\n"
            "Bitte selbst bauen (https://github.com/ggml-org/llama.cpp) und die Binaries\n"
            f"nach {BIN_DIR} legen.")

    print("Suche aktuelles llama.cpp-Release …")
    with http_get(LLAMA_CPP_RELEASES) as resp:
        release = json.load(resp)
    tag = release["tag_name"]

    asset = None
    for pat in patterns:
        for a in release["assets"]:
            name = a["name"]
            if pat in name and not any(g in name for g in ("cuda", "vulkan", "sycl", "hip", "kompute")):
                asset = a
                break
        if asset:
            break
    if not asset:
        names = "\n  ".join(a["name"] for a in release["assets"])
        die(f"Kein passendes Release-Asset gefunden (gesucht: {patterns}).\n"
            f"Verfügbar in {tag}:\n  {names}\n"
            "Tipp: llm.py setup --flavor <teilstring>")

    print(f"Lade {asset['name']} ({tag}, {asset['size'] // 2**20} MB) …")
    zip_path = HOME / asset["name"]
    download(asset["browser_download_url"], zip_path)

    target = BIN_DIR / tag
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(target)
    zip_path.unlink()

    # Unter Unix Ausführungsrechte setzen (gehen im Zip verloren)
    if platform.system() != "Windows":
        for p in target.rglob("*"):
            if p.is_file():
                p.chmod(p.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    cli = find_binary("llama-cli")
    if not cli:
        die("Archiv entpackt, aber llama-cli nicht gefunden — Release-Layout unbekannt.")
    print(f"Fertig. Runtime installiert in {target}")


# ---------------------------------------------------------------- Modelle

def model_path(name):
    p = MODELS_DIR / f"{name}.gguf"
    if p.exists():
        return p
    # auch direkte Dateinamen/Pfade akzeptieren
    cand = Path(name)
    if cand.exists() and cand.suffix == ".gguf":
        return cand
    return None


def local_models():
    if not MODELS_DIR.exists():
        return []
    return sorted(MODELS_DIR.glob("*.gguf"))


def cmd_pull(args):
    name = args.model
    if name.startswith(("http://", "https://")):
        url = name
        fname = url.rsplit("/", 1)[-1]
        dest = MODELS_DIR / fname
    elif name in CATALOG:
        url = CATALOG[name]["url"]
        dest = MODELS_DIR / f"{name}.gguf"
    else:
        die(f"Unbekanntes Modell '{name}'. Katalog anzeigen mit: llm.py list\n"
            "Oder eine direkte GGUF-URL angeben.")
    if dest.exists() and not args.force:
        print(f"Schon vorhanden: {dest}")
        return
    print(f"Lade Modell nach {dest} …")
    download(url, dest, label=name)
    print("Fertig.")


def cmd_list(args):
    print("Lokale Modelle:")
    models = local_models()
    if models:
        for m in models:
            size = m.stat().st_size / 2**30
            print(f"  {m.stem:<18} {size:5.1f} GB   {m}")
    else:
        print("  (keine — Modell holen mit: llm.py pull <name>)")
    print("\nKatalog (llm.py pull <name>):")
    for name, meta in CATALOG.items():
        print(f"  {name:<15} {meta['size']:>8}   {meta['desc']}")


def cmd_rm(args):
    p = MODELS_DIR / f"{args.model}.gguf"
    if not p.exists():
        die(f"Modell '{args.model}' nicht gefunden.")
    p.unlink()
    print(f"Gelöscht: {p}")


def cmd_info(args):
    cli = find_binary("llama-cli")
    srv = find_binary("llama-server")
    print(f"Datenverzeichnis : {HOME}")
    print(f"Plattform        : {platform.system()} {platform.machine()}")
    print(f"llama-cli        : {cli or '— (llm.py setup ausführen)'}")
    print(f"llama-server     : {srv or '—'}")
    print(f"Modelle          : {len(local_models())} in {MODELS_DIR}")


# ---------------------------------------------------------------- Inferenz

def resolve_model_or_die(name):
    p = model_path(name)
    if not p:
        die(f"Modell '{name}' ist nicht lokal vorhanden. Erst holen: llm.py pull {name}")
    return p


def cmd_chat(args):
    binary = require_binary("llama-cli")
    model = resolve_model_or_die(args.model)
    cmd = [str(binary), "-m", str(model), "-cnv", "--simple-io",
           "-c", str(args.ctx), "-t", str(args.threads or os.cpu_count() or 4)]
    if args.system:
        cmd += ["-sys", args.system]
    print(f"Chat mit {model.stem} — beenden mit Strg+C oder /exit\n")
    os.execve(str(binary), cmd, runtime_env(binary))


def cmd_run(args):
    binary = require_binary("llama-cli")
    model = resolve_model_or_die(args.model)
    cmd = [str(binary), "-m", str(model), "-st", "--simple-io", "--no-display-prompt",
           "-n", str(args.max_tokens), "-c", str(args.ctx),
           "-t", str(args.threads or os.cpu_count() or 4), "-p", args.prompt]
    if args.system:
        cmd += ["-sys", args.system]
    r = subprocess.run(cmd, env=runtime_env(binary),
                       stderr=subprocess.DEVNULL if not args.verbose else None)
    sys.exit(r.returncode)


def cmd_serve(args):
    binary = require_binary("llama-server")
    model = resolve_model_or_die(args.model)
    cmd = [str(binary), "-m", str(model), "--host", args.host, "--port", str(args.port),
           "-c", str(args.ctx), "-t", str(args.threads or os.cpu_count() or 4)]
    print(f"Server startet: Web-UI  → http://{args.host}:{args.port}")
    print(f"                OpenAI-API → http://{args.host}:{args.port}/v1/chat/completions")
    print("Beenden mit Strg+C\n")
    os.execve(str(binary), cmd, runtime_env(binary))


# ---------------------------------------------------------------- CLI

def main():
    ap = argparse.ArgumentParser(
        prog="llm.py", description="LLMs lokal und offline laufen lassen (llama.cpp)",
        formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__.split("Befehle:")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("setup", help="llama.cpp-Runtime herunterladen")
    p.add_argument("--force", action="store_true", help="Neu installieren")
    p.add_argument("--flavor", help="Asset-Teilstring erzwingen (z. B. 'vulkan-x64' für GPU)")
    p.set_defaults(func=cmd_setup)

    p = sub.add_parser("pull", help="Modell herunterladen")
    p.add_argument("model", help="Katalogname oder direkte GGUF-URL")
    p.add_argument("--force", action="store_true")
    p.set_defaults(func=cmd_pull)

    p = sub.add_parser("list", help="Modelle und Katalog anzeigen")
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("rm", help="Lokales Modell löschen")
    p.add_argument("model")
    p.set_defaults(func=cmd_rm)

    p = sub.add_parser("info", help="Status anzeigen")
    p.set_defaults(func=cmd_info)

    def common(p):
        p.add_argument("model")
        p.add_argument("--ctx", type=int, default=4096, help="Kontextgröße (Standard 4096)")
        p.add_argument("--threads", type=int, help="CPU-Threads (Standard: alle)")
        p.add_argument("--system", help="System-Prompt")

    p = sub.add_parser("chat", help="Interaktiver Chat im Terminal")
    common(p)
    p.set_defaults(func=cmd_chat)

    p = sub.add_parser("run", help="Einzelner Prompt")
    common(p)
    p.add_argument("-p", "--prompt", required=True)
    p.add_argument("-n", "--max-tokens", type=int, default=512)
    p.add_argument("-v", "--verbose", action="store_true")
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("serve", help="Lokaler Server (Web-UI + OpenAI-API)")
    common(p)
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8080)
    p.set_defaults(func=cmd_serve)

    args = ap.parse_args()
    try:
        args.func(args)
    except KeyboardInterrupt:
        print("\nAbgebrochen.")
        sys.exit(130)
    except urllib.error.URLError as e:
        die(f"Netzwerkfehler: {e}\n(Downloads brauchen einmalig Internet; "
            "chat/run/serve laufen komplett offline.)")


if __name__ == "__main__":
    main()
