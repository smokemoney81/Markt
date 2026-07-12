#!/usr/bin/env python3
"""
Anthropic-zu-Ollama-Proxy — verbindet Claude Code / die Claude-CLI mit einem
selbst-gehosteten Ollama-Server.

Claude Code spricht die Anthropic-API (POST /v1/messages). Ollama spricht die
OpenAI-API (POST /v1/chat/completions). Dieser Proxy nimmt Anthropic-Anfragen
entgegen, leitet sie an den Ollama-Server weiter und übersetzt die Antwort
(inklusive Streaming) zurück ins Anthropic-Format.

Nur Python-Standardbibliothek nötig – keine pip-Pakete.

Konfiguration über Umgebungsvariablen:
  UPSTREAM_URL    Basis-URL des Ollama-Servers   (Standard: http://localhost:11434)
  UPSTREAM_MODEL  Modellname bei Ollama          (Standard: llama3.2:3b)
  UPSTREAM_TOKEN  Bearer-Token für den Server    (optional; z. B. GCP-Identity-Token)
  PROXY_PORT      lokaler Port des Proxys         (Standard: 8787)

Start:
  UPSTREAM_URL=https://ollama-xxx.a.run.app UPSTREAM_MODEL=llama3.2:3b \\
      python3 anthropic_proxy.py
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UPSTREAM_URL = os.environ.get("UPSTREAM_URL", "http://localhost:11434").rstrip("/")
UPSTREAM_MODEL = os.environ.get("UPSTREAM_MODEL", "llama3.2:3b")
UPSTREAM_TOKEN = os.environ.get("UPSTREAM_TOKEN", "")
PROXY_PORT = int(os.environ.get("PROXY_PORT", "8787"))


def _text_from_content(content):
    """Anthropic-Content kann String oder Block-Liste sein → reinen Text ziehen."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif block.get("type") == "tool_result":
                    parts.append(_text_from_content(block.get("content", "")))
        return "\n".join(p for p in parts if p)
    return ""


def anthropic_to_openai(body):
    """Anthropic-Messages-Request → OpenAI-Chat-Request."""
    messages = []
    system = body.get("system")
    if isinstance(system, list):
        system = _text_from_content(system)
    if system:
        messages.append({"role": "system", "content": system})
    for msg in body.get("messages", []):
        messages.append(
            {"role": msg.get("role", "user"), "content": _text_from_content(msg.get("content", ""))}
        )
    out = {
        "model": UPSTREAM_MODEL,
        "messages": messages,
        "stream": bool(body.get("stream", False)),
    }
    if body.get("max_tokens") is not None:
        out["max_tokens"] = body["max_tokens"]
    for key in ("temperature", "top_p"):
        if body.get(key) is not None:
            out[key] = body[key]
    if body.get("stop_sequences"):
        out["stop"] = body["stop_sequences"]
    return out


def _upstream_request(payload, stream):
    data = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if UPSTREAM_TOKEN:
        headers["Authorization"] = f"Bearer {UPSTREAM_TOKEN}"
    req = urllib.request.Request(
        f"{UPSTREAM_URL}/v1/chat/completions", data=data, headers=headers, method="POST"
    )
    return urllib.request.urlopen(req, timeout=600)


def _sse(event, data):
    return f"event: {event}\ndata: {json.dumps(data)}\n\n".encode("utf-8")


def _stop_reason(openai_reason):
    return {"stop": "end_turn", "length": "max_tokens", "stop_sequence": "stop_sequence"}.get(
        openai_reason or "stop", "end_turn"
    )


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):  # ruhiger Server
        pass

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.rstrip("/") in ("", "/health", "/v1/health"):
            self._json(200, {"status": "ok", "upstream": UPSTREAM_URL, "model": UPSTREAM_MODEL})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw or b"{}")
        except json.JSONDecodeError:
            return self._json(400, {"type": "error", "error": {"message": "invalid JSON"}})

        path = self.path.split("?", 1)[0].rstrip("/")
        if path.endswith("/count_tokens"):
            # Grobe Schätzung; Claude Code nutzt das nur informativ.
            approx = max(1, len(raw) // 4)
            return self._json(200, {"input_tokens": approx})
        if not path.endswith("/messages"):
            return self._json(404, {"type": "error", "error": {"message": "not found"}})

        payload = anthropic_to_openai(body)
        try:
            if payload["stream"]:
                self._stream(payload)
            else:
                self._complete(payload)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace")
            self._json(exc.code, {"type": "error", "error": {"message": detail}})
        except Exception as exc:  # noqa: BLE001
            self._json(502, {"type": "error", "error": {"message": f"upstream: {exc}"}})

    def _complete(self, payload):
        resp = _upstream_request(payload, stream=False)
        data = json.loads(resp.read().decode("utf-8"))
        choice = (data.get("choices") or [{}])[0]
        text = (choice.get("message") or {}).get("content", "") or ""
        usage = data.get("usage") or {}
        self._json(
            200,
            {
                "id": data.get("id", "msg_proxy"),
                "type": "message",
                "role": "assistant",
                "model": payload["model"],
                "content": [{"type": "text", "text": text}],
                "stop_reason": _stop_reason(choice.get("finish_reason")),
                "stop_sequence": None,
                "usage": {
                    "input_tokens": usage.get("prompt_tokens", 0),
                    "output_tokens": usage.get("completion_tokens", 0),
                },
            },
        )

    def _stream(self, payload):
        resp = _upstream_request(payload, stream=True)
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        msg_id = "msg_proxy"
        self.wfile.write(
            _sse(
                "message_start",
                {
                    "type": "message_start",
                    "message": {
                        "id": msg_id,
                        "type": "message",
                        "role": "assistant",
                        "model": payload["model"],
                        "content": [],
                        "stop_reason": None,
                        "stop_sequence": None,
                        "usage": {"input_tokens": 0, "output_tokens": 0},
                    },
                },
            )
        )
        self.wfile.write(
            _sse("content_block_start", {"type": "content_block_start", "index": 0,
                                         "content_block": {"type": "text", "text": ""}})
        )
        self.wfile.write(_sse("ping", {"type": "ping"}))

        finish = "stop"
        out_tokens = 0
        for line in resp:
            line = line.decode("utf-8", "replace").strip()
            if not line or not line.startswith("data:"):
                continue
            chunk = line[len("data:"):].strip()
            if chunk == "[DONE]":
                break
            try:
                obj = json.loads(chunk)
            except json.JSONDecodeError:
                continue
            choice = (obj.get("choices") or [{}])[0]
            delta = choice.get("delta") or {}
            piece = delta.get("content")
            if piece:
                out_tokens += 1
                self.wfile.write(
                    _sse(
                        "content_block_delta",
                        {"type": "content_block_delta", "index": 0,
                         "delta": {"type": "text_delta", "text": piece}},
                    )
                )
            if choice.get("finish_reason"):
                finish = choice["finish_reason"]

        self.wfile.write(_sse("content_block_stop", {"type": "content_block_stop", "index": 0}))
        self.wfile.write(
            _sse(
                "message_delta",
                {"type": "message_delta",
                 "delta": {"stop_reason": _stop_reason(finish), "stop_sequence": None},
                 "usage": {"output_tokens": out_tokens}},
            )
        )
        self.wfile.write(_sse("message_stop", {"type": "message_stop"}))


def main():
    server = ThreadingHTTPServer(("127.0.0.1", PROXY_PORT), Handler)
    print(f"==> Anthropic-Proxy läuft auf http://127.0.0.1:{PROXY_PORT}")
    print(f"    Upstream : {UPSTREAM_URL}  (Modell: {UPSTREAM_MODEL})")
    print(f"    Token    : {'gesetzt' if UPSTREAM_TOKEN else '—'}")
    print("    Für Claude Code:")
    print(f"      export ANTHROPIC_BASE_URL=http://127.0.0.1:{PROXY_PORT}")
    print("      export ANTHROPIC_AUTH_TOKEN=dummy")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n==> Beende Proxy.")
        server.shutdown()


if __name__ == "__main__":
    main()
