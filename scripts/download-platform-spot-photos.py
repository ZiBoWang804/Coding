from __future__ import annotations

import argparse
import csv
import html
import mimetypes
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import quote, urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


ROOT = Path(r"D:/wzb/codex")
DATA_ROOT = ROOT / "data"
DEFAULT_DATASET_DIR = DATA_ROOT / "全国旅游数据整合_2026-03-24"
DEFAULT_IMAGE_DIR = DEFAULT_DATASET_DIR / "平台景点照片" / "携程Trip"
DEFAULT_INDEX_CSV = DEFAULT_DATASET_DIR / "平台景点照片索引.csv"
DEFAULT_MERGED_CSV = DEFAULT_DATASET_DIR / "景点画像汇总_含平台照片.csv"
DEFAULT_GALLERY_HTML = DEFAULT_DATASET_DIR / "平台景点照片总览.html"

SEARCH_ENDPOINT = "https://www.trip.com/global-gssearch/searchlist/search?keyword={keyword}"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
)

LINK_RE = re.compile(
    r'<a href="(?P<href>https://(?:us|www)\.trip\.com/travel-guide/'
    r'(?P<page_type>attraction|destination)/[^"]+/)" title="(?P<title>[^"]+)"'
)
POSITION_RE = re.compile(r'gl-search-result_list-position">([^<]+)</div>')
COVER_RE = re.compile(r'"coverImage":"(https:[^"]+)"')
IMAGE_RE = re.compile(r'"image":"(https:[^"]+)"')
INVALID_FILENAME_RE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')

STRIP_SUFFIXES = (
    "旅游景区",
    "风景名胜区",
    "风景区",
    "旅游区",
    "度假区",
    "国家森林公园",
    "国家公园",
    "森林公园",
    "湿地公园",
    "遗址公园",
    "公园",
    "景区",
)

PLATFORM_NAME = "携程Trip景点页"
thread_local = threading.local()
LOCATION_SUFFIXES = ("市", "州", "地区", "盟", "县", "区")
MANUAL_ALIASES = {
    "西递宏村": ["宏村 黄山市", "西递 黄山市", "宏村", "西递"],
    "泸沽湖(云南部分)": ["泸沽湖 丽江市", "泸沽湖"],
    "天门陆羽故里": ["陆羽故里 天门", "陆羽故园 天门", "陆羽故园"],
    "廊坊天下第一城": ["天下第一城 廊坊", "天下第一城"],
    "福州三山两塔": ["三山两塔 福州"],
    "苏州园林": ["拙政园 苏州", "留园 苏州"],
}


@dataclass(slots=True)
class Candidate:
    href: str
    title: str
    page_type: str
    position: str


@dataclass(slots=True)
class SpotResult:
    key: tuple[str, str, str]
    chosen_query: str
    platform: str
    page_type: str
    detail_url: str
    source_title: str
    source_position: str
    image_urls: list[str]
    local_paths: list[str]
    status: str
    note: str


def build_session() -> requests.Session:
    retry = Retry(
        total=3,
        connect=3,
        read=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=frozenset({"GET"}),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=10, pool_maxsize=10)
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": "https://www.trip.com/",
        }
    )
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def get_session() -> requests.Session:
    session = getattr(thread_local, "session", None)
    if session is None:
        session = build_session()
        thread_local.session = session
    return session


def find_dataset_dir(preferred: Path) -> Path:
    if preferred.exists():
        return preferred
    candidates = [path for path in DATA_ROOT.iterdir() if (path / "景点画像汇总.csv").exists()]
    if not candidates:
        raise FileNotFoundError("未找到包含景点画像汇总.csv 的整合目录。")
    return max(candidates, key=lambda item: item.stat().st_mtime)


def read_spot_rows(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))
    deduped: list[dict[str, str]] = []
    seen: set[tuple[str, str, str]] = set()
    for row in rows:
        key = (
            row.get("景点名称", "").strip(),
            row.get("所在城市", "").strip(),
            row.get("所在省份", "").strip(),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped


def read_failed_keys(index_csv: Path) -> set[tuple[str, str, str]]:
    if not index_csv.exists():
        return set()
    failed_keys: set[tuple[str, str, str]] = set()
    with index_csv.open("r", encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            if row.get("状态", "").strip() == "已下载":
                continue
            failed_keys.add(
                (
                    row.get("景点名称", "").strip(),
                    row.get("所在城市", "").strip(),
                    row.get("所在省份", "").strip(),
                )
            )
    return failed_keys


def read_existing_results(index_csv: Path) -> list[SpotResult]:
    if not index_csv.exists():
        return []
    grouped: dict[tuple[str, str, str], SpotResult] = {}
    with index_csv.open("r", encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            key = (
                row.get("景点名称", "").strip(),
                row.get("所在城市", "").strip(),
                row.get("所在省份", "").strip(),
            )
            result = grouped.get(key)
            if result is None:
                result = SpotResult(
                    key=key,
                    chosen_query=row.get("搜索关键词", "").strip(),
                    platform=row.get("平台", "").strip() or PLATFORM_NAME,
                    page_type=row.get("页面类型", "").strip(),
                    detail_url=row.get("详情页URL", "").strip(),
                    source_title=row.get("来源标题", "").strip(),
                    source_position=row.get("来源位置", "").strip(),
                    image_urls=[],
                    local_paths=[],
                    status=row.get("状态", "").strip(),
                    note=row.get("备注", "").strip(),
                )
                grouped[key] = result
            image_url = row.get("图片URL", "").strip()
            local_path = row.get("本地图片路径", "").strip()
            if image_url:
                result.image_urls.append(image_url)
            if local_path:
                result.local_paths.append(local_path)
            if row.get("状态", "").strip():
                result.status = row["状态"].strip()
            if row.get("备注", "").strip():
                result.note = row["备注"].strip()
    return list(grouped.values())


def sanitize_filename(name: str) -> str:
    cleaned = INVALID_FILENAME_RE.sub("_", name.strip())
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return cleaned or "未命名景点"


def trim_name(name: str) -> str:
    text = re.sub(r"\s+", "", name)
    for suffix in STRIP_SUFFIXES:
        if text.endswith(suffix) and len(text) > len(suffix) + 1:
            return text[: -len(suffix)]
    return text


def strip_brackets(text: str) -> str:
    return re.sub(r"[\(\[（【].*?[\)\]）】]", "", text).strip()


def strip_location_prefix(name: str, location: str) -> str:
    text = name.strip()
    location_text = location.strip()
    if not location_text:
        return text
    candidates = [location_text]
    for suffix in LOCATION_SUFFIXES:
        if location_text.endswith(suffix):
            candidates.append(location_text[: -len(suffix)])
    for candidate in unique_keep_order(candidates):
        if candidate and text.startswith(candidate) and len(text) > len(candidate):
            return text[len(candidate) :].strip()
    return text


def unique_keep_order(items: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for item in items:
        value = item.strip()
        if not value or value in seen:
            continue
        seen.add(value)
        output.append(value)
    return output


def build_queries(row: dict[str, str]) -> list[str]:
    name = row.get("景点名称", "").strip()
    city = row.get("所在城市", "").strip()
    province = row.get("所在省份", "").strip()
    bare_name = strip_brackets(name)
    short_name = trim_name(bare_name)
    city_less_name = strip_location_prefix(short_name, city)
    province_less_name = strip_location_prefix(city_less_name, province)
    aliases = [
        bare_name,
        short_name,
        city_less_name,
        province_less_name,
        *MANUAL_ALIASES.get(name, []),
    ]
    queries = [
        f"{name} {city}",
        f"{name} {province}",
        name,
        f"{city} {name}",
        f"{province} {name}",
    ]
    for alias in unique_keep_order(aliases):
        queries.extend(
            [
                f"{alias} {city}",
                f"{alias} {province}",
                alias,
                f"{city} {alias}",
                f"{province} {alias}",
            ]
        )
    return unique_keep_order(queries)


def fetch_text(url: str, timeout: int = 30) -> str:
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            response = get_session().get(url, timeout=timeout)
            response.raise_for_status()
            return response.text
        except Exception as exc:
            last_error = exc
            if attempt == 3:
                break
            time.sleep(attempt)
    if last_error is not None:
        raise last_error
    raise RuntimeError(f"请求失败: {url}")


def extract_candidates(search_html: str) -> list[Candidate]:
    candidates: list[Candidate] = []
    seen: set[str] = set()
    for match in LINK_RE.finditer(search_html):
        href = html.unescape(match.group("href")).split("?")[0]
        if href in seen:
            continue
        seen.add(href)
        title = html.unescape(match.group("title"))
        page_type = match.group("page_type")
        snippet = search_html[match.end() : match.end() + 900]
        position_match = POSITION_RE.search(snippet)
        position = html.unescape(position_match.group(1)) if position_match else ""
        candidates.append(
            Candidate(
                href=href,
                title=title,
                page_type=page_type,
                position=position,
            )
        )
    return candidates


def choose_candidate(queries: list[str]) -> tuple[str, Candidate | None]:
    destination_fallback: tuple[str, Candidate] | None = None
    last_error: Exception | None = None
    for query in queries:
        try:
            url = SEARCH_ENDPOINT.format(keyword=quote(query, safe=""))
            search_html = fetch_text(url)
            candidates = extract_candidates(search_html)
            attraction_candidates = [candidate for candidate in candidates if candidate.page_type == "attraction"]
            if attraction_candidates:
                return query, attraction_candidates[0]
            destination_candidates = [candidate for candidate in candidates if candidate.page_type == "destination"]
            if destination_candidates and destination_fallback is None:
                destination_fallback = (query, destination_candidates[0])
        except Exception as exc:
            last_error = exc
            continue
    if destination_fallback:
        return destination_fallback
    if last_error is not None:
        raise last_error
    return queries[0] if queries else "", None


def extract_image_urls(detail_html: str, limit: int) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for pattern in (COVER_RE, IMAGE_RE):
        for match in pattern.finditer(detail_html):
            url = html.unescape(match.group(1)).replace("\\/", "/")
            if url in seen:
                continue
            seen.add(url)
            urls.append(url)
            if len(urls) >= limit:
                return urls
    return urls


def infer_extension(url: str, content_type: str = "") -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".avif"}:
        return suffix
    guessed = mimetypes.guess_extension(content_type.split(";")[0].strip()) if content_type else ""
    if guessed in {".jpg", ".jpeg", ".png", ".webp", ".avif"}:
        return guessed
    return ".jpg"


def download_image(url: str, destination_without_ext: Path, overwrite: bool) -> Path:
    existing = list(destination_without_ext.parent.glob(f"{destination_without_ext.name}.*"))
    if existing and not overwrite:
        return existing[0]
    last_error: Exception | None = None
    for attempt in range(1, 5):
        response = None
        destination = destination_without_ext.with_suffix(".jpg")
        try:
            response = get_session().get(url, timeout=60, stream=True)
            response.raise_for_status()
            extension = infer_extension(url, response.headers.get("Content-Type", ""))
            destination = destination_without_ext.with_suffix(extension)
            if destination.exists() and not overwrite:
                return destination
            with destination.open("wb") as file:
                for chunk in response.iter_content(chunk_size=65536):
                    if chunk:
                        file.write(chunk)
            return destination
        except Exception as exc:
            last_error = exc
            if destination.exists():
                destination.unlink(missing_ok=True)
            if attempt == 4:
                break
            time.sleep(attempt)
        finally:
            if response is not None:
                response.close()
    if last_error is not None:
        raise last_error
    raise RuntimeError(f"图片下载失败: {url}")


def process_spot(
    row: dict[str, str],
    image_root: Path,
    images_per_spot: int,
    overwrite: bool,
) -> SpotResult:
    name = row.get("景点名称", "").strip()
    city = row.get("所在城市", "").strip()
    province = row.get("所在省份", "").strip()
    key = (name, city, province)
    queries = build_queries(row)

    try:
        chosen_query, candidate = choose_candidate(queries)
    except Exception as exc:
        return SpotResult(
            key=key,
            chosen_query=queries[0] if queries else "",
            platform=PLATFORM_NAME,
            page_type="",
            detail_url="",
            source_title="",
            source_position="",
            image_urls=[],
            local_paths=[],
            status="搜索失败",
            note=str(exc),
        )

    if candidate is None:
        return SpotResult(
            key=key,
            chosen_query=chosen_query,
            platform=PLATFORM_NAME,
            page_type="",
            detail_url="",
            source_title="",
            source_position="",
            image_urls=[],
            local_paths=[],
            status="未命中页面",
            note="搜索结果中未找到 attraction 或 destination 页。",
        )

    try:
        detail_html = fetch_text(candidate.href)
        image_urls = extract_image_urls(detail_html, limit=max(images_per_spot, 1))
        if not image_urls:
            return SpotResult(
                key=key,
                chosen_query=chosen_query,
                platform=PLATFORM_NAME,
                page_type=candidate.page_type,
                detail_url=candidate.href,
                source_title=candidate.title,
                source_position=candidate.position,
                image_urls=[],
                local_paths=[],
                status="页面无图",
                note="详情页未提取到 coverImage/image。",
            )

        spot_dir = image_root / sanitize_filename(province) / sanitize_filename(city) / sanitize_filename(name)
        spot_dir.mkdir(parents=True, exist_ok=True)
        local_paths: list[str] = []
        for index, image_url in enumerate(image_urls, start=1):
            target = spot_dir / f"trip_{index:02d}"
            image_path = download_image(image_url, target, overwrite=overwrite)
            local_paths.append(str(image_path))

        return SpotResult(
            key=key,
            chosen_query=chosen_query,
            platform=PLATFORM_NAME,
            page_type=candidate.page_type,
            detail_url=candidate.href,
            source_title=candidate.title,
            source_position=candidate.position,
            image_urls=image_urls,
            local_paths=local_paths,
            status="已下载",
            note="",
        )
    except Exception as exc:
        return SpotResult(
            key=key,
            chosen_query=chosen_query,
            platform=PLATFORM_NAME,
            page_type=candidate.page_type,
            detail_url=candidate.href,
            source_title=candidate.title,
            source_position=candidate.position,
            image_urls=[],
            local_paths=[],
            status="下载失败",
            note=str(exc),
        )


def write_index_csv(results: list[SpotResult], output_path: Path) -> None:
    fieldnames = [
        "景点名称",
        "所在城市",
        "所在省份",
        "平台",
        "搜索关键词",
        "页面类型",
        "来源标题",
        "来源位置",
        "详情页URL",
        "图片序号",
        "图片URL",
        "本地图片路径",
        "状态",
        "备注",
    ]
    with output_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for result in results:
            name, city, province = result.key
            if result.local_paths:
                for index, local_path in enumerate(result.local_paths, start=1):
                    writer.writerow(
                        {
                            "景点名称": name,
                            "所在城市": city,
                            "所在省份": province,
                            "平台": result.platform,
                            "搜索关键词": result.chosen_query,
                            "页面类型": result.page_type,
                            "来源标题": result.source_title,
                            "来源位置": result.source_position,
                            "详情页URL": result.detail_url,
                            "图片序号": index,
                            "图片URL": result.image_urls[index - 1] if index - 1 < len(result.image_urls) else "",
                            "本地图片路径": local_path,
                            "状态": result.status,
                            "备注": result.note,
                        }
                    )
                continue
            writer.writerow(
                {
                    "景点名称": name,
                    "所在城市": city,
                    "所在省份": province,
                    "平台": result.platform,
                    "搜索关键词": result.chosen_query,
                    "页面类型": result.page_type,
                    "来源标题": result.source_title,
                    "来源位置": result.source_position,
                    "详情页URL": result.detail_url,
                    "图片序号": "",
                    "图片URL": "",
                    "本地图片路径": "",
                    "状态": result.status,
                    "备注": result.note,
                }
            )


def write_merged_csv(
    original_rows: list[dict[str, str]],
    results: list[SpotResult],
    output_path: Path,
) -> None:
    result_map = {result.key: result for result in results}
    extra_fields = [
        "平台图片平台",
        "平台图片状态",
        "平台图片页面类型",
        "平台图片搜索关键词",
        "平台图片详情页",
        "平台图片来源标题",
        "平台图片来源位置",
        "平台图片数量",
        "平台图片首图路径",
        "平台图片全部路径",
        "平台图片备注",
    ]
    fieldnames = list(original_rows[0].keys()) + extra_fields if original_rows else extra_fields
    with output_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for row in original_rows:
            key = (
                row.get("景点名称", "").strip(),
                row.get("所在城市", "").strip(),
                row.get("所在省份", "").strip(),
            )
            result = result_map.get(key)
            output_row = dict(row)
            output_row["平台图片平台"] = result.platform if result else PLATFORM_NAME
            output_row["平台图片状态"] = result.status if result else "未处理"
            output_row["平台图片页面类型"] = result.page_type if result else ""
            output_row["平台图片搜索关键词"] = result.chosen_query if result else ""
            output_row["平台图片详情页"] = result.detail_url if result else ""
            output_row["平台图片来源标题"] = result.source_title if result else ""
            output_row["平台图片来源位置"] = result.source_position if result else ""
            output_row["平台图片数量"] = len(result.local_paths) if result else 0
            output_row["平台图片首图路径"] = result.local_paths[0] if result and result.local_paths else ""
            output_row["平台图片全部路径"] = " | ".join(result.local_paths) if result else ""
            output_row["平台图片备注"] = result.note if result else ""
            writer.writerow(output_row)


def build_gallery_html(dataset_dir: Path, results: list[SpotResult], output_path: Path) -> None:
    cards: list[str] = []
    for result in results:
        if not result.local_paths:
            continue
        name, city, province = result.key
        image_path = Path(result.local_paths[0])
        try:
            relative_image = image_path.relative_to(dataset_dir).as_posix()
        except ValueError:
            relative_image = image_path.as_posix()
        detail_link = html.escape(result.detail_url, quote=True)
        cards.append(
            f"""
<article class="card">
  <img src="{relative_image}" alt="{html.escape(name, quote=True)}" loading="lazy">
  <div class="meta">
    <h3>{html.escape(name)}</h3>
    <p>{html.escape(province)} / {html.escape(city)}</p>
    <p>{html.escape(result.platform)} | {html.escape(result.page_type or '未知页面')}</p>
    <p>图片数：{len(result.local_paths)} | 搜索词：{html.escape(result.chosen_query)}</p>
    <p class="source"><a href="{detail_link}">来源页</a></p>
  </div>
</article>""".strip()
        )

    html_text = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>平台景点照片总览</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f5f1ea;
      --card: #fffdfa;
      --text: #1f1a17;
      --muted: #6f6259;
      --line: #dfd2c5;
      --accent: #a44a2f;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(164,74,47,0.08), transparent 22rem),
        linear-gradient(180deg, #fbf8f3 0%, var(--bg) 100%);
      color: var(--text);
    }}
    main {{
      width: min(1280px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }}
    header {{
      margin-bottom: 24px;
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1.1;
    }}
    p {{
      margin: 0;
      color: var(--muted);
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 18px;
    }}
    .card {{
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: var(--card);
      box-shadow: 0 16px 36px rgba(31, 26, 23, 0.08);
    }}
    img {{
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      background: #e9dfd5;
    }}
    .meta {{
      padding: 14px 16px 18px;
    }}
    h3 {{
      margin: 0 0 8px;
      font-size: 18px;
    }}
    .meta p {{
      margin-top: 6px;
      font-size: 13px;
      line-height: 1.45;
    }}
    .source a {{
      color: var(--accent);
      text-decoration: none;
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>平台景点照片总览</h1>
      <p>来源优先级：携程/Trip 景点页。当前仅展示每个景点的首张本地图片，详情见索引 CSV。</p>
    </header>
    <section class="grid">
      {"".join(cards)}
    </section>
  </main>
</body>
</html>
"""
    output_path.write_text(html_text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="按景点画像汇总批量下载平台景点照片。")
    parser.add_argument(
        "--dataset-dir",
        type=Path,
        default=DEFAULT_DATASET_DIR,
        help="全国旅游数据整合目录，默认使用 data/全国旅游数据整合_2026-03-24。",
    )
    parser.add_argument("--workers", type=int, default=6, help="并发线程数。")
    parser.add_argument("--limit", type=int, default=0, help="仅处理前 N 个景点，0 表示全部。")
    parser.add_argument("--images-per-spot", type=int, default=2, help="每个景点最多下载多少张图。")
    parser.add_argument("--overwrite", action="store_true", help="覆盖已存在的图片。")
    parser.add_argument("--failed-only", action="store_true", help="仅处理现有索引里状态不是“已下载”的景点。")
    args = parser.parse_args()

    dataset_dir = find_dataset_dir(args.dataset_dir)
    spot_csv = dataset_dir / "景点画像汇总.csv"
    image_root = DEFAULT_IMAGE_DIR if dataset_dir == DEFAULT_DATASET_DIR else dataset_dir / "平台景点照片" / "携程Trip"
    index_csv = DEFAULT_INDEX_CSV if dataset_dir == DEFAULT_DATASET_DIR else dataset_dir / "平台景点照片索引.csv"
    merged_csv = DEFAULT_MERGED_CSV if dataset_dir == DEFAULT_DATASET_DIR else dataset_dir / "景点画像汇总_含平台照片.csv"
    gallery_html = DEFAULT_GALLERY_HTML if dataset_dir == DEFAULT_DATASET_DIR else dataset_dir / "平台景点照片总览.html"
    image_root.mkdir(parents=True, exist_ok=True)

    original_rows = read_spot_rows(spot_csv)
    rows = original_rows
    if args.failed_only:
        failed_keys = read_failed_keys(index_csv)
        rows = [
            row
            for row in rows
            if (
                row.get("景点名称", "").strip(),
                row.get("所在城市", "").strip(),
                row.get("所在省份", "").strip(),
            )
            in failed_keys
        ]
    rows = rows[: args.limit] if args.limit else rows
    print(f"dataset_dir={dataset_dir}")
    print(f"spots={len(rows)}")
    print(f"workers={args.workers}")
    print(f"images_per_spot={args.images_per_spot}")

    results: list[SpotResult] = []
    with ThreadPoolExecutor(max_workers=max(args.workers, 1)) as executor:
        future_map = {
            executor.submit(
                process_spot,
                row,
                image_root,
                max(args.images_per_spot, 1),
                args.overwrite,
            ): row
            for row in rows
        }
        for index, future in enumerate(as_completed(future_map), start=1):
            result = future.result()
            results.append(result)
            name, city, _ = result.key
            print(f"[{index}/{len(rows)}] {name} ({city}) -> {result.status} ({len(result.local_paths)} 张)")

    if args.failed_only:
        existing_map = {result.key: result for result in read_existing_results(index_csv)}
        for result in results:
            existing_map[result.key] = result
        all_results = sorted(existing_map.values(), key=lambda item: item.key)
    else:
        all_results = sorted(results, key=lambda item: item.key)

    write_index_csv(all_results, index_csv)
    write_merged_csv(original_rows, all_results, merged_csv)
    build_gallery_html(dataset_dir, all_results, gallery_html)

    success_count = sum(1 for item in all_results if item.local_paths)
    image_count = sum(len(item.local_paths) for item in all_results)
    print(f"success_spots={success_count}")
    print(f"downloaded_images={image_count}")
    print(f"index_csv={index_csv}")
    print(f"merged_csv={merged_csv}")
    print(f"gallery_html={gallery_html}")


if __name__ == "__main__":
    main()
