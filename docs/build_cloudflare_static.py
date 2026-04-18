"""Build a Cloudflare Pages friendly static export for the web classification project."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = PROJECT_ROOT / "web"
DIST_DIR = PROJECT_ROOT / "dist"
DIST_DATA_DIR = DIST_DIR / "data"
GENERATED_DIR = PROJECT_ROOT / "generated"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.pipeline import PipelineConfig, build_dashboard, create_state_payload, write_dashboard_snapshot  # noqa: E402

STATIC_RUNTIME_CONFIG = """window.__APP_CONFIG__ = {
  mode: "static",
  staticBundlePath: "/data/static-state-bundle.json",
  trackedClusterStorageKey: "web-classification-tracked-cluster",
};
"""


def build_static_bundle(cluster_limit: int = 8) -> dict:
    runtime = build_dashboard(PipelineConfig(source_mode="demo", cluster_count=cluster_limit))
    default_state = create_state_payload(runtime)
    write_dashboard_snapshot(default_state)

    states: dict[str, dict] = {}
    cluster_ids: list[int] = []
    for cluster in runtime.dashboard.get("clusters", []):
        cluster_id = int(cluster["id"])
        cluster_ids.append(cluster_id)
        states[str(cluster_id)] = create_state_payload(runtime, tracked_cluster_id=cluster_id)

    default_cluster_id = int(default_state.get("tracked_topic", {}).get("cluster_id", cluster_ids[0] if cluster_ids else 0))
    return {
        "mode": "static",
        "generated_at": default_state.get("generated_at"),
        "default_cluster_id": default_cluster_id,
        "cluster_ids": cluster_ids,
        "states": states,
    }


def prepare_dist(bundle: dict) -> None:
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)

    shutil.copytree(WEB_DIR, DIST_DIR)
    DIST_DATA_DIR.mkdir(parents=True, exist_ok=True)

    (DIST_DIR / "runtime-config.js").write_text(STATIC_RUNTIME_CONFIG, encoding="utf-8")
    (DIST_DATA_DIR / "static-state-bundle.json").write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    dashboard_snapshot = GENERATED_DIR / "dashboard.json"
    if dashboard_snapshot.exists():
        shutil.copy2(dashboard_snapshot, DIST_DATA_DIR / "dashboard.json")


def main() -> None:
    bundle = build_static_bundle()
    prepare_dist(bundle)
    print(f"静态站点已生成：{DIST_DIR}")
    print(f"默认关注主题：{bundle['default_cluster_id']}")
    print(f"可用主题数：{len(bundle['cluster_ids'])}")
    print(f"静态数据包：{DIST_DATA_DIR / 'static-state-bundle.json'}")


if __name__ == "__main__":
    main()
