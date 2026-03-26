from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path


ROOT = Path(r"D:/wzb")
DEFAULT_INPUT_DIR = ROOT / "旅游"
OUTPUT_ROOT = Path(r"D:/wzb/codex/data")
DEFAULT_OUTPUT_DIR = OUTPUT_ROOT / "小红书旅游数据整合_2026-03-25"

CANONICAL_FIELDS = [
    "平台",
    "来源文件",
    "主题",
    "搜索词",
    "标题",
    "作者",
    "作者主页",
    "笔记发布时间原文",
    "笔记发布时间",
    "抓取日期",
    "点赞数原文",
    "点赞数",
    "搜索结果链接",
    "帖子详情页链接",
    "封面链接地址",
    "记录哈希",
    "去重键",
    "标题是否缺失",
    "详情链接是否缺失",
]


def find_input_dir(preferred: Path) -> Path:
    if preferred.exists():
        return preferred
    candidates = [path for path in ROOT.iterdir() if path.is_dir() and list(path.glob("*.json"))]
    if not candidates:
        raise FileNotFoundError("未找到包含 JSON 文件的输入目录。")
    return max(candidates, key=lambda item: len(list(item.glob("*.json"))))


def canonicalize_key(raw_key: str) -> str:
    text = raw_key.strip().rstrip(":：")
    rules = [
        ("搜索结果链接", "搜索结果链接"),
        ("帖子详情页链接", "帖子详情页链接"),
        ("笔记发布时间", "笔记发布时间"),
        ("封面链接地址", "封面链接地址"),
        ("作者主页", "作者主页"),
        ("点赞数", "点赞数"),
        ("搜索词", "搜索词"),
        ("标题", "标题"),
        ("作者", "作者"),
    ]
    for needle, target in rules:
        if needle in text:
            return target
    return text


def clean_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).replace("\u200b", " ").replace("\xa0", " ").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def parse_like_count(raw_text: str) -> int:
    text = clean_text(raw_text).lower().replace(",", "")
    if not text:
        return 0
    match = re.search(r"(\d+(?:\.\d+)?)\s*万", text)
    if match:
        return int(float(match.group(1)) * 10000)
    match = re.search(r"(\d+(?:\.\d+)?)\s*k", text)
    if match:
        return int(float(match.group(1)) * 1000)
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else 0


def normalize_publish_date(raw_text: str, crawl_date: date) -> str:
    text = clean_text(raw_text)
    if not text:
        return ""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return text
    if re.fullmatch(r"\d{2}-\d{2}", text):
        month, day = map(int, text.split("-"))
        year = crawl_date.year
        candidate = date(year, month, day)
        if candidate > crawl_date:
            candidate = date(year - 1, month, day)
        return candidate.isoformat()
    match = re.fullmatch(r"(\d+)天前", text)
    if match:
        return (crawl_date - timedelta(days=int(match.group(1)))).isoformat()
    match = re.fullmatch(r"(\d+)小时前", text)
    if match:
        return (crawl_date - timedelta(hours=int(match.group(1)))).isoformat()
    if text == "昨天":
        return (crawl_date - timedelta(days=1)).isoformat()
    if text == "今天":
        return crawl_date.isoformat()
    return ""


def normalize_topic(file_path: Path) -> str:
    name = file_path.stem
    if name.startswith("小红书-"):
        name = name[4:]
    return clean_text(name)


def build_record_hash(parts: list[str]) -> str:
    joined = "||".join(clean_text(part) for part in parts)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def build_dedupe_key(record: dict[str, str]) -> str:
    detail_url = record["帖子详情页链接"]
    if detail_url:
        return detail_url
    fallback = [
        record["标题"],
        record["作者"],
        record["封面链接地址"],
        record["搜索词"],
    ]
    return build_record_hash(fallback)


def load_records(input_dir: Path) -> tuple[list[dict[str, str]], list[dict[str, object]]]:
    cleaned_rows: list[dict[str, str]] = []
    file_stats: list[dict[str, object]] = []

    for file_path in sorted(input_dir.glob("*.json")):
        raw_data = json.loads(file_path.read_text(encoding="utf-8"))
        if not isinstance(raw_data, list):
            continue

        crawl_date = datetime.fromtimestamp(file_path.stat().st_mtime).date()
        topic = normalize_topic(file_path)
        raw_count = len(raw_data)
        valid_count = 0
        missing_title = 0
        missing_detail = 0

        for item in raw_data:
            if not isinstance(item, dict):
                continue
            normalized = {canonicalize_key(key): clean_text(value) for key, value in item.items()}
            row = {
                "平台": "小红书",
                "来源文件": file_path.name,
                "主题": topic,
                "搜索词": clean_text(normalized.get("搜索词", "")),
                "标题": clean_text(normalized.get("标题", "")),
                "作者": clean_text(normalized.get("作者", "")),
                "作者主页": clean_text(normalized.get("作者主页", "")),
                "笔记发布时间原文": clean_text(normalized.get("笔记发布时间", "")),
                "笔记发布时间": "",
                "抓取日期": crawl_date.isoformat(),
                "点赞数原文": clean_text(normalized.get("点赞数", "")),
                "点赞数": "0",
                "搜索结果链接": clean_text(normalized.get("搜索结果链接", "")),
                "帖子详情页链接": clean_text(normalized.get("帖子详情页链接", "")),
                "封面链接地址": clean_text(normalized.get("封面链接地址", "")),
                "记录哈希": "",
                "去重键": "",
                "标题是否缺失": "否",
                "详情链接是否缺失": "否",
            }

            if not any([row["标题"], row["作者"], row["帖子详情页链接"], row["封面链接地址"]]):
                continue

            if not row["标题"]:
                missing_title += 1
                row["标题是否缺失"] = "是"
            if not row["帖子详情页链接"]:
                missing_detail += 1
                row["详情链接是否缺失"] = "是"

            row["点赞数"] = str(parse_like_count(row["点赞数原文"]))
            row["笔记发布时间"] = normalize_publish_date(row["笔记发布时间原文"], crawl_date)
            row["记录哈希"] = build_record_hash(
                [
                    row["来源文件"],
                    row["搜索词"],
                    row["标题"],
                    row["作者"],
                    row["帖子详情页链接"],
                    row["封面链接地址"],
                ]
            )
            row["去重键"] = build_dedupe_key(row)
            cleaned_rows.append(row)
            valid_count += 1

        file_stats.append(
            {
                "来源文件": file_path.name,
                "主题": topic,
                "原始记录数": raw_count,
                "清洗后记录数": valid_count,
                "空标题记录数": missing_title,
                "空详情链接记录数": missing_detail,
                "抓取日期": crawl_date.isoformat(),
            }
        )

    return cleaned_rows, file_stats


def dedupe_records(rows: list[dict[str, str]]) -> tuple[list[dict[str, str]], Counter]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row["去重键"]].append(row)

    deduped_rows: list[dict[str, str]] = []
    duplicate_counter: Counter[str] = Counter()

    for key, group in grouped.items():
        best = sorted(
            group,
            key=lambda item: (
                int(item["点赞数"]),
                1 if item["标题"] else 0,
                1 if item["帖子详情页链接"] else 0,
                item["抓取日期"],
            ),
            reverse=True,
        )[0]
        deduped_rows.append(best)
        duplicate_counter[key] = len(group)

    deduped_rows.sort(
        key=lambda item: (
            int(item["点赞数"]),
            item["笔记发布时间"] or item["抓取日期"],
            item["标题"],
        ),
        reverse=True,
    )
    return deduped_rows, duplicate_counter


def write_csv(output_path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    with output_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def build_topic_stats(rows: list[dict[str, str]]) -> list[dict[str, object]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row["主题"]].append(row)

    stats: list[dict[str, object]] = []
    for topic, group in grouped.items():
        likes = [int(row["点赞数"]) for row in group]
        authors = {row["作者"] for row in group if row["作者"]}
        latest_publish = max((row["笔记发布时间"] or row["抓取日期"] for row in group), default="")
        stats.append(
            {
                "主题": topic,
                "笔记数": len(group),
                "独立作者数": len(authors),
                "平均点赞数": round(sum(likes) / len(likes), 2) if likes else 0,
                "最高点赞数": max(likes) if likes else 0,
                "最新发布时间": latest_publish,
            }
        )
    return sorted(stats, key=lambda item: item["笔记数"], reverse=True)


def build_file_stats(
    file_stats: list[dict[str, object]],
    deduped_rows: list[dict[str, str]],
) -> list[dict[str, object]]:
    kept_counter = Counter(row["来源文件"] for row in deduped_rows)
    output: list[dict[str, object]] = []
    for item in file_stats:
        row = dict(item)
        row["去重后保留数"] = kept_counter.get(str(item["来源文件"]), 0)
        output.append(row)
    return output


def build_top_rows(rows: list[dict[str, str]], limit: int = 100) -> list[dict[str, str]]:
    return rows[:limit]


def build_gallery_html(rows: list[dict[str, str]], output_path: Path) -> None:
    cards: list[str] = []
    for row in rows[:300]:
        title = row["标题"] or "无标题"
        author = row["作者"] or "未知作者"
        image = row["封面链接地址"]
        detail = row["帖子详情页链接"] or row["搜索结果链接"]
        cards.append(
            f"""
<article class="card">
  <img src="{image}" alt="{title}" loading="lazy">
  <div class="meta">
    <h3>{title}</h3>
    <p>{row["主题"]} | {row["搜索词"]}</p>
    <p>作者：{author}</p>
    <p>点赞：{row["点赞数"]} | 发布时间：{row["笔记发布时间"] or row["笔记发布时间原文"] or "未知"}</p>
    <p><a href="{detail}">打开链接</a></p>
  </div>
</article>""".strip()
        )

    html_text = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>小红书旅游笔记总览</title>
  <style>
    :root {{
      --bg: #f5f0ea;
      --card: #fffdfa;
      --line: #e2d4c8;
      --text: #201814;
      --muted: #716257;
      --accent: #bf4b33;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(191,75,51,0.10), transparent 20rem),
        linear-gradient(180deg, #fbf8f5 0%, var(--bg) 100%);
    }}
    main {{
      width: min(1320px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: clamp(28px, 4vw, 42px);
    }}
    p {{
      margin: 0;
      color: var(--muted);
    }}
    .grid {{
      margin-top: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 18px;
    }}
    .card {{
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: var(--card);
      box-shadow: 0 14px 34px rgba(32, 24, 20, 0.08);
    }}
    img {{
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      background: #eadfd4;
    }}
    .meta {{
      padding: 14px 16px 18px;
    }}
    h3 {{
      margin: 0 0 8px;
      font-size: 18px;
      line-height: 1.35;
    }}
    .meta p {{
      margin-top: 6px;
      font-size: 13px;
      line-height: 1.45;
    }}
    a {{
      color: var(--accent);
      text-decoration: none;
    }}
  </style>
</head>
<body>
  <main>
    <h1>小红书旅游笔记总览</h1>
    <p>展示的是去重后的笔记数据，默认按点赞数倒序，仅保留前 300 条做图文预览。</p>
    <section class="grid">
      {"".join(cards)}
    </section>
  </main>
</body>
</html>
"""
    output_path.write_text(html_text, encoding="utf-8")


def write_readme(
    output_path: Path,
    input_dir: Path,
    file_count: int,
    raw_rows: int,
    cleaned_rows: int,
    deduped_rows: int,
    missing_title: int,
    missing_detail: int,
) -> None:
    text = f"""# 小红书旅游数据整合

- 输入目录：`{input_dir}`
- JSON 文件数：`{file_count}`
- 原始记录数：`{raw_rows}`
- 清洗后记录数：`{cleaned_rows}`
- 去重后记录数：`{deduped_rows}`
- 空标题记录数：`{missing_title}`
- 空详情链接记录数：`{missing_detail}`

## 输出文件

- `小红书旅游笔记_全量清洗.csv`
- `小红书旅游笔记_去重整合.csv`
- `文件统计.csv`
- `主题统计.csv`
- `高赞笔记TOP100.csv`
- `小红书旅游笔记总览.html`

## 清洗规则

- 统一字段名为搜索词、标题、作者、发布时间、点赞数、详情链接、封面链接等标准列。
- 去掉标题、作者、详情链接、封面都为空的无效记录。
- 点赞数统一转换为整数。
- 相对时间按文件抓取日期换算为标准日期。
- 详情链接优先去重，缺详情链接时退回到标题+作者+封面+搜索词组合去重。
"""
    output_path.write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="清洗并整合旅游目录中的小红书 JSON 数据。")
    parser.add_argument("--input-dir", type=Path, default=DEFAULT_INPUT_DIR, help="原始 JSON 目录。")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR, help="输出目录。")
    args = parser.parse_args()

    input_dir = find_input_dir(args.input_dir)
    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    cleaned_rows, file_stats = load_records(input_dir)
    deduped_rows, duplicate_counter = dedupe_records(cleaned_rows)

    missing_title = sum(1 for row in cleaned_rows if row["标题是否缺失"] == "是")
    missing_detail = sum(1 for row in cleaned_rows if row["详情链接是否缺失"] == "是")
    raw_rows = sum(int(item["原始记录数"]) for item in file_stats)

    write_csv(output_dir / "小红书旅游笔记_全量清洗.csv", cleaned_rows, CANONICAL_FIELDS)
    write_csv(output_dir / "小红书旅游笔记_去重整合.csv", deduped_rows, CANONICAL_FIELDS)
    write_csv(
        output_dir / "文件统计.csv",
        build_file_stats(file_stats, deduped_rows),
        ["来源文件", "主题", "原始记录数", "清洗后记录数", "去重后保留数", "空标题记录数", "空详情链接记录数", "抓取日期"],
    )
    write_csv(
        output_dir / "主题统计.csv",
        build_topic_stats(deduped_rows),
        ["主题", "笔记数", "独立作者数", "平均点赞数", "最高点赞数", "最新发布时间"],
    )
    write_csv(output_dir / "高赞笔记TOP100.csv", build_top_rows(deduped_rows, limit=100), CANONICAL_FIELDS)
    build_gallery_html(deduped_rows, output_dir / "小红书旅游笔记总览.html")
    write_readme(
        output_dir / "README.md",
        input_dir,
        len(list(input_dir.glob("*.json"))),
        raw_rows,
        len(cleaned_rows),
        len(deduped_rows),
        missing_title,
        missing_detail,
    )

    duplicate_rows = sum(count - 1 for count in duplicate_counter.values() if count > 1)
    print(f"input_dir={input_dir}")
    print(f"output_dir={output_dir}")
    print(f"json_files={len(list(input_dir.glob('*.json')))}")
    print(f"raw_rows={raw_rows}")
    print(f"cleaned_rows={len(cleaned_rows)}")
    print(f"deduped_rows={len(deduped_rows)}")
    print(f"duplicate_rows_removed={duplicate_rows}")
    print(f"missing_title={missing_title}")
    print(f"missing_detail={missing_detail}")


if __name__ == "__main__":
    main()
