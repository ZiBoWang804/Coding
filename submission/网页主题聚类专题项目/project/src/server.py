"""Lightweight HTTP server for the web clustering assignment app."""

from __future__ import annotations

import json
import mimetypes
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .pipeline import PipelineConfig, build_dashboard, create_state_payload, write_dashboard_snapshot

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_ROOT = PROJECT_ROOT / "web"


class AppStore:
    def __init__(self, source_mode: str = "demo", cluster_count: int = 8) -> None:
        self.lock = threading.Lock()
        self.source_mode = source_mode
        self.cluster_count = cluster_count
        self.runtime = build_dashboard(PipelineConfig(source_mode=self.source_mode, cluster_count=self.cluster_count))
        self.state = create_state_payload(self.runtime)
        write_dashboard_snapshot(self.state)

    def rebuild(self, source_mode: str | None = None, cluster_count: int | None = None) -> dict:
        with self.lock:
            if source_mode:
                self.source_mode = source_mode
            if cluster_count:
                self.cluster_count = cluster_count
            self.runtime = build_dashboard(
                PipelineConfig(source_mode=self.source_mode, cluster_count=self.cluster_count)
            )
            self.state = create_state_payload(self.runtime)
            write_dashboard_snapshot(self.state)
            return self.state

    def follow_cluster(self, cluster_id: int) -> dict:
        with self.lock:
            self.state = create_state_payload(self.runtime, tracked_cluster_id=cluster_id)
            write_dashboard_snapshot(self.state)
            return self.state


STORE: AppStore | None = None


def get_store() -> AppStore:
    global STORE
    if STORE is None:
        STORE = AppStore()
    return STORE


class ApplicationHandler(BaseHTTPRequestHandler):
    server_version = "WebClassificationServer/1.0"

    def _send_json(self, payload: dict, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, file_path: Path) -> None:
        mime_type, _ = mimetypes.guess_type(file_path.name)
        body = file_path.read_bytes()
        content_type = mime_type or "application/octet-stream"
        if content_type.startswith("text/") or content_type in {
            "application/javascript",
            "application/json",
            "image/svg+xml",
        }:
            content_type = f"{content_type}; charset=utf-8"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length) if length else b"{}"
        if not raw_body:
            return {}
        return json.loads(raw_body.decode("utf-8"))

    def do_GET(self) -> None:  # noqa: N802
        store = get_store()
        parsed = urlparse(self.path)
        if parsed.path == "/api/state":
            self._send_json(store.state)
            return

        if parsed.path == "/api/health":
            self._send_json({"status": "ok"})
            return

        requested = "index.html" if parsed.path in {"", "/"} else parsed.path.lstrip("/")
        file_path = (WEB_ROOT / requested).resolve()
        if WEB_ROOT not in file_path.parents and file_path != WEB_ROOT / "index.html":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if not file_path.exists() or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self._send_file(file_path)

    def do_POST(self) -> None:  # noqa: N802
        store = get_store()
        parsed = urlparse(self.path)
        try:
            payload = self._read_json_body()
        except json.JSONDecodeError:
            self._send_json({"error": "请求体不是有效的 JSON。"}, status=HTTPStatus.BAD_REQUEST)
            return

        if parsed.path == "/api/rebuild":
            source_mode = payload.get("source_mode", store.source_mode)
            cluster_count = int(payload.get("cluster_count", store.cluster_count))
            cluster_count = max(2, min(cluster_count, 10))
            self._send_json(store.rebuild(source_mode=source_mode, cluster_count=cluster_count))
            return

        if parsed.path == "/api/follow":
            cluster_id = int(payload.get("cluster_id", -1))
            valid_ids = {cluster["id"] for cluster in store.state.get("clusters", [])}
            if cluster_id not in valid_ids:
                self._send_json({"error": "未找到对应的主题簇编号。"}, status=HTTPStatus.BAD_REQUEST)
                return
            self._send_json(store.follow_cluster(cluster_id))
            return

        self._send_json({"error": "接口不存在。"}, status=HTTPStatus.NOT_FOUND)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return


def run(host: str = "127.0.0.1", port: int = 8765) -> None:
    global STORE
    print("正在初始化本地演示数据...", flush=True)
    STORE = AppStore(source_mode="demo", cluster_count=8)
    server = ThreadingHTTPServer((host, port), ApplicationHandler)
    print(f"Web classification app running at http://{host}:{port}", flush=True)
    print("Press Ctrl+C to stop the server.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    run()
