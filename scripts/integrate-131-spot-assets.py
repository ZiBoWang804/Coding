from __future__ import annotations

import csv
import hashlib
import html
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

import fitz
from PIL import Image

Image.MAX_IMAGE_PIXELS = None


WZB_ROOT = Path(r"D:/wzb")
ROOT = Path(r"D:/wzb/codex")
SOURCE_DIR = WZB_ROOT / "全部131个景点"
OUTPUT_DIR = ROOT / "data" / "131景点资料整合_2026-03-25"
PREVIEW_DIR = OUTPUT_DIR / "previews"
TEXT_DIR = OUTPUT_DIR / "texts"

SECTION_NAMES = [
    "概述",
    "亮点",
    "有问必答",
    "线路推荐",
    "景点",
    "活动",
    "住宿",
    "餐饮",
    "购物",
    "交通",
    "实用信息",
    "背景",
    "更多线路",
    "地图",
    "小贴士",
    "目录",
    "印象",
    "关于",
    "心愿单",
    "FAQ",
    "SCHEDULE",
    "CATALOG",
    "ABOUT",
    "IMPRESSION",
]

COMFORT_LABELS = ["享乐", "舒适", "经济", "休闲", "腐败", "自虐"]
PROVINCE_OR_REGION_NAMES = {
    "北京",
    "天津",
    "上海",
    "重庆",
    "河北",
    "山西",
    "辽宁",
    "吉林",
    "黑龙江",
    "江苏",
    "浙江",
    "安徽",
    "福建",
    "江西",
    "山东",
    "河南",
    "湖北",
    "湖南",
    "广东",
    "海南",
    "四川",
    "贵州",
    "云南",
    "陕西",
    "甘肃",
    "青海",
    "台湾",
    "内蒙古",
    "广西",
    "西藏",
    "宁夏",
    "新疆",
    "香港",
    "澳门",
    "呼伦贝尔",
    "黔东南",
    "西双版纳",
    "北疆",
    "川藏",
    "甘南",
    "林芝",
}
NATIONAL_NAMES = {"中国", "中国国家地理", "游遍中国"}
KEYWORD_STOPWORDS = {
    "旅游",
    "攻略",
    "关键词",
    "费用",
    "天数",
    "舒适程度",
    "关于",
    "概述",
    "印象",
    "景点",
    "活动",
    "住宿",
    "餐饮",
    "购物",
    "交通",
    "地图",
    "更多线路",
    "实用信息",
}


@dataclass(slots=True)
class AssetProfile:
    file_name: str
    title: str
    normalized_name: str
    ext: str
    asset_kind: str
    scope_level: str
    source_path: str
    preview_path: str
    text_path: str
    pages: int
    first_text_page: int
    text_pages: int
    text_chars: int
    file_size_mb: float
    image_width: int
    image_height: int
    keywords: str
    estimated_cost: str
    suggested_days: str
    comfort_level: str
    sections: str
    section_count: int
    summary: str
    content_hash: str
    duplicate_group: str
    duplicate_group_size: int
    is_best_version: str


def normalize_title(stem: str) -> str:
    name = stem.strip()
    name = re.sub(r"\.\d+$", "", name)
    name = re.sub(r"(旅游攻略|攻略)$", "", name)
    name = re.sub(r"([0-9一二三四五六七八九十]+日)(旅游攻略)?$", "", name)
    name = re.sub(r"可打印$", "", name)
    return name.strip(" -_")


def detect_asset_kind(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in {".jpg", ".jpeg", ".png"}:
        if "地图" in path.stem or path.stem.startswith("01") or path.stem.startswith("02"):
            return "地图图片"
        return "图片素材"
    if "地图" in path.stem:
        return "地图PDF"
    if "国家地理" in path.stem or "游遍中国" in path.stem:
        return "全国地理资料"
    if "攻略" in path.stem:
        return "旅游攻略PDF"
    return "目的地图册PDF"


def detect_scope_level(normalized_name: str) -> str:
    if normalized_name in NATIONAL_NAMES or "中国" in normalized_name or "中华人民共和国" in normalized_name:
        return "全国"
    if normalized_name in PROVINCE_OR_REGION_NAMES:
        return "区域/省份"
    if any(name in normalized_name for name in PROVINCE_OR_REGION_NAMES):
        return "区域/省份"
    return "城市/景区"


def clean_text(text: str) -> str:
    text = text.replace("\u3000", " ").replace("\xa0", " ").replace("\u200b", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def clean_flat_text(text: str) -> str:
    return re.sub(r"\s+", " ", clean_text(text))


def make_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_text_bundle(pdf_path: Path) -> tuple[str, list[str], int, int]:
    page_texts: list[str] = []
    first_text_page = 0
    text_pages = 0
    with fitz.open(pdf_path) as doc:
        for index, page in enumerate(doc, start=1):
            text = clean_text(page.get_text("text"))
            page_texts.append(text)
            if text:
                text_pages += 1
                if first_text_page == 0:
                    first_text_page = index
    full_text = "\n\n".join(text for text in page_texts if text)
    return full_text, page_texts, first_text_page, text_pages


def extract_summary(page_texts: list[str]) -> str:
    for text in page_texts:
        if not text:
            continue
        flat = clean_flat_text(text)
        for marker in ["关键词", "目录", "CATALOG", "概述", "亮点"]:
            if marker in flat:
                flat = flat.split(marker, 1)[0].strip()
                break
        flat = re.sub(r"^\d+\s*", "", flat)
        if len(flat) >= 40:
            return flat[:280]
    return ""


def extract_keyword_meta(page_texts: list[str]) -> tuple[str, str, str, str]:
    sample_text = clean_flat_text(" ".join(text for text in page_texts[:6] if text))
    sample_text = sample_text[:7000]
    keywords = ""
    days = ""
    cost = ""
    comfort = ""

    anchor = sample_text.find("关键词")
    if anchor >= 0:
        snippet = sample_text[anchor : anchor + 500]
        pattern = re.compile(
            r"关键词\s+费用\s+天数\s+舒适程度\s+(?P<keywords>.+?)\s+"
            r"(?P<days>\d+(?:-\d+)?天)\s+(?P<cost>\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?元(?:/人)?)\s+"
            r"(?P<comfort>享乐|舒适|经济|休闲|腐败|自虐)"
        )
        match = pattern.search(snippet)
        if match:
            keywords = match.group("keywords").strip(" |")
            days = match.group("days")
            cost = match.group("cost")
            comfort = match.group("comfort")
        else:
            sample_window = snippet
            day_match = re.search(r"\d+(?:-\d+)?天", sample_window)
            cost_match = re.search(r"\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?元(?:/人)?", sample_window)
            comfort_match = next((label for label in COMFORT_LABELS if label in sample_window), "")
            stop_positions = [m.start() for m in [day_match, cost_match] if m]
            if comfort_match:
                stop_positions.append(sample_window.find(comfort_match))
            if stop_positions:
                start = sample_window.find("关键词") + 3
                end = min(pos for pos in stop_positions if pos > start)
                keywords = sample_window[start:end].replace("费用", "").replace("天数", "").replace("舒适程度", "").strip(" |")
            if day_match:
                days = day_match.group(0)
            if cost_match:
                cost = cost_match.group(0)
            if comfort_match:
                comfort = comfort_match

    keywords = normalize_keywords(keywords)
    return keywords, cost, days, comfort


def detect_sections(full_text: str) -> tuple[str, int]:
    hits = [section for section in SECTION_NAMES if section in full_text]
    unique_hits = []
    seen = set()
    for item in hits:
        if item in seen:
            continue
        seen.add(item)
        unique_hits.append(item)
    return " / ".join(unique_hits), len(unique_hits)


def normalize_keywords(raw_keywords: str) -> str:
    text = clean_flat_text(raw_keywords)
    for noise in ["费 用", "天 数", "舒 适 程 度", "费用", "天数", "舒适程度"]:
        text = text.replace(noise, " ")
    tokens = []
    seen = set()
    for token in re.split(r"[、/|,，；;\s]+", text):
        token = token.strip()
        if not token:
            continue
        if token in KEYWORD_STOPWORDS:
            continue
        if re.fullmatch(r"\d+(?:-\d+)?", token):
            continue
        if "元" in token or token.endswith("天"):
            continue
        if token in seen:
            continue
        seen.add(token)
        tokens.append(token)
    return " / ".join(tokens)


def make_pdf_preview(pdf_path: Path, preview_path: Path) -> None:
    with fitz.open(pdf_path) as doc:
        page = doc.load_page(0)
        pix = page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False)
        pix.save(preview_path)


def make_image_preview(image_path: Path, preview_path: Path) -> tuple[int, int]:
    with Image.open(image_path) as image:
        width, height = image.size
        image.thumbnail((900, 900))
        if image.mode not in {"RGB", "RGBA"}:
            image = image.convert("RGB")
        image.save(preview_path)
    return width, height


def keyword_counter_from_rows(rows: list[AssetProfile]) -> list[dict[str, object]]:
    counter: Counter[str] = Counter()
    for row in rows:
        for token in re.split(r"[、/|,，；;·\s]+", row.keywords):
            token = token.strip()
            if not token or token in KEYWORD_STOPWORDS:
                continue
            if len(token) == 1:
                continue
            counter[token] += 1
    return [{"关键词": key, "出现次数": value} for key, value in counter.most_common(200)]


def section_counter_from_rows(rows: list[AssetProfile]) -> list[dict[str, object]]:
    counter: Counter[str] = Counter()
    for row in rows:
        for section in row.sections.split(" / "):
            if section:
                counter[section] += 1
    return [{"栏目": key, "命中文档数": value} for key, value in counter.most_common()]


def render_html(rows: list[AssetProfile], output_path: Path) -> None:
    cards: list[str] = []
    for row in rows:
        preview = Path(row.preview_path).relative_to(OUTPUT_DIR).as_posix()
        text_link = Path(row.text_path).relative_to(OUTPUT_DIR).as_posix() if row.text_path else ""
        summary = html.escape(row.summary or "无摘要")
        cards.append(
            f"""
<article class="card">
  <img src="{preview}" alt="{html.escape(row.title)}" loading="lazy">
  <div class="meta">
    <h3>{html.escape(row.title)}</h3>
    <p>{html.escape(row.asset_kind)} | {html.escape(row.scope_level)}</p>
    <p>标准名称：{html.escape(row.normalized_name)}</p>
    <p>页数/尺寸：{row.pages or '-'} / {row.image_width or '-'}x{row.image_height or '-'}</p>
    <p>关键词：{html.escape(row.keywords or '无')}</p>
    <p>费用：{html.escape(row.estimated_cost or '无')} | 天数：{html.escape(row.suggested_days or '无')} | 舒适度：{html.escape(row.comfort_level or '无')}</p>
    <p>栏目：{html.escape(row.sections or '无')}</p>
    <p class="summary">{summary}</p>
    <p><a href="{html.escape(row.source_path)}">原文件</a>{' | <a href="' + text_link + '">全文文本</a>' if text_link else ''}</p>
  </div>
</article>""".strip()
        )

    html_text = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>131景点资料整合总览</title>
  <style>
    :root {{
      --bg: #f3efe7;
      --card: #fffdfa;
      --line: #ddcfbf;
      --text: #211814;
      --muted: #706154;
      --accent: #a3492b;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(163,73,43,0.1), transparent 24rem),
        linear-gradient(180deg, #faf7f2 0%, var(--bg) 100%);
    }}
    main {{
      width: min(1360px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: clamp(28px, 4vw, 44px);
    }}
    .lead {{
      margin: 0;
      color: var(--muted);
    }}
    .grid {{
      margin-top: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 18px;
    }}
    .card {{
      border: 1px solid var(--line);
      border-radius: 18px;
      overflow: hidden;
      background: var(--card);
      box-shadow: 0 16px 34px rgba(33, 24, 20, 0.08);
    }}
    img {{
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      background: #ecdfd2;
    }}
    .meta {{
      padding: 14px 16px 18px;
    }}
    h3 {{
      margin: 0 0 8px;
      font-size: 18px;
      line-height: 1.35;
    }}
    p {{
      margin: 6px 0 0;
      font-size: 13px;
      line-height: 1.45;
      color: var(--muted);
    }}
    .summary {{
      color: var(--text);
    }}
    a {{
      color: var(--accent);
      text-decoration: none;
    }}
  </style>
</head>
<body>
  <main>
    <h1>131景点资料整合总览</h1>
    <p class="lead">展示的是清洗去重后的最佳版本资料，包含 PDF 首图预览、结构化字段和全文文本链接。</p>
    <section class="grid">
      {"".join(cards)}
    </section>
  </main>
</body>
</html>
"""
    output_path.write_text(html_text, encoding="utf-8")


def write_csv(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def to_row(asset: AssetProfile) -> dict[str, object]:
    return {
        "资料标题": asset.title,
        "标准名称": asset.normalized_name,
        "扩展名": asset.ext,
        "资料类型": asset.asset_kind,
        "主题层级": asset.scope_level,
        "原文件路径": asset.source_path,
        "预览图路径": asset.preview_path,
        "文本文件路径": asset.text_path,
        "页数": asset.pages,
        "首个有文字页": asset.first_text_page,
        "有文字页数": asset.text_pages,
        "文本字符数": asset.text_chars,
        "文件大小MB": asset.file_size_mb,
        "图片宽度": asset.image_width,
        "图片高度": asset.image_height,
        "关键词": asset.keywords,
        "参考费用": asset.estimated_cost,
        "推荐天数": asset.suggested_days,
        "舒适程度": asset.comfort_level,
        "栏目清单": asset.sections,
        "栏目命中数": asset.section_count,
        "摘要": asset.summary,
        "内容哈希": asset.content_hash,
        "重复组": asset.duplicate_group,
        "重复组大小": asset.duplicate_group_size,
        "是否最佳版本": asset.is_best_version,
    }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    TEXT_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted([path for path in SOURCE_DIR.iterdir() if path.is_file()])
    profiles: list[AssetProfile] = []

    for index, path in enumerate(files, start=1):
        title = path.stem
        normalized_name = normalize_title(path.stem)
        asset_kind = detect_asset_kind(path)
        scope_level = detect_scope_level(normalized_name)
        preview_path = PREVIEW_DIR / f"asset_{index:03d}.png"
        text_path = TEXT_DIR / f"asset_{index:03d}.txt"
        text_path_str = ""
        pages = 0
        first_text_page = 0
        text_pages = 0
        text_chars = 0
        image_width = 0
        image_height = 0
        keywords = ""
        estimated_cost = ""
        suggested_days = ""
        comfort_level = ""
        sections = ""
        section_count = 0
        summary = ""

        if path.suffix.lower() == ".pdf":
            full_text, page_texts, first_text_page, text_pages = extract_text_bundle(path)
            text_chars = len(full_text)
            text_path.write_text(full_text, encoding="utf-8")
            text_path_str = str(text_path)
            with fitz.open(path) as doc:
                pages = len(doc)
            make_pdf_preview(path, preview_path)
            keywords, estimated_cost, suggested_days, comfort_level = extract_keyword_meta(page_texts)
            sections, section_count = detect_sections(full_text)
            summary = extract_summary(page_texts)
        else:
            width, height = make_image_preview(path, preview_path)
            image_width = width
            image_height = height
            summary = "地图或图片素材，未进行文本提取。"

        content_hash = make_hash(path)
        duplicate_group = f"{asset_kind}:{normalized_name}"
        profiles.append(
            AssetProfile(
                file_name=path.name,
                title=title,
                normalized_name=normalized_name,
                ext=path.suffix.lower(),
                asset_kind=asset_kind,
                scope_level=scope_level,
                source_path=str(path),
                preview_path=str(preview_path),
                text_path=text_path_str,
                pages=pages,
                first_text_page=first_text_page,
                text_pages=text_pages,
                text_chars=text_chars,
                file_size_mb=round(path.stat().st_size / (1024 * 1024), 2),
                image_width=image_width,
                image_height=image_height,
                keywords=keywords,
                estimated_cost=estimated_cost,
                suggested_days=suggested_days,
                comfort_level=comfort_level,
                sections=sections,
                section_count=section_count,
                summary=summary,
                content_hash=content_hash,
                duplicate_group=duplicate_group,
                duplicate_group_size=0,
                is_best_version="否",
            )
        )
        print(f"[{index}/{len(files)}] {path.name} -> {asset_kind}")

    groups: dict[str, list[AssetProfile]] = defaultdict(list)
    for profile in profiles:
        groups[profile.duplicate_group].append(profile)

    deduped_profiles: list[AssetProfile] = []
    for group_key, items in groups.items():
        items.sort(
            key=lambda item: (item.text_chars, item.pages, item.file_size_mb, item.title),
            reverse=True,
        )
        best_hash = items[0].content_hash
        for item in items:
            item.duplicate_group_size = len(items)
            item.is_best_version = "是" if item.content_hash == best_hash else "否"
        deduped_profiles.append(items[0])

    full_rows = [to_row(profile) for profile in profiles]
    deduped_rows = [to_row(profile) for profile in sorted(deduped_profiles, key=lambda item: (item.asset_kind, item.normalized_name))]
    pdf_rows = [row for row in full_rows if row["扩展名"] == ".pdf"]
    image_rows = [row for row in full_rows if row["扩展名"] != ".pdf"]

    write_csv(
        OUTPUT_DIR / "资料总表.csv",
        full_rows,
        list(full_rows[0].keys()) if full_rows else [],
    )
    write_csv(
        OUTPUT_DIR / "资料去重整合.csv",
        deduped_rows,
        list(deduped_rows[0].keys()) if deduped_rows else [],
    )
    write_csv(
        OUTPUT_DIR / "PDF资料画像.csv",
        pdf_rows,
        list(pdf_rows[0].keys()) if pdf_rows else [],
    )
    write_csv(
        OUTPUT_DIR / "图片资料索引.csv",
        image_rows,
        list(image_rows[0].keys()) if image_rows else [],
    )
    write_csv(
        OUTPUT_DIR / "栏目统计.csv",
        section_counter_from_rows(deduped_profiles),
        ["栏目", "命中文档数"],
    )
    write_csv(
        OUTPUT_DIR / "关键词统计.csv",
        keyword_counter_from_rows(deduped_profiles),
        ["关键词", "出现次数"],
    )

    render_html(sorted(deduped_profiles, key=lambda item: item.normalized_name), OUTPUT_DIR / "资料图文总览.html")

    readme_text = f"""# 131景点资料整合

- 来源目录：`{SOURCE_DIR}`
- 原始文件数：`{len(files)}`
- PDF 数量：`{sum(1 for p in profiles if p.ext == '.pdf')}`
- 图片数量：`{sum(1 for p in profiles if p.ext != '.pdf')}`
- 去重后资料数：`{len(deduped_profiles)}`
- 提取全文文本目录：`{TEXT_DIR}`
- 预览图目录：`{PREVIEW_DIR}`

## 输出文件

- `资料总表.csv`：全部文件的结构化结果。
- `资料去重整合.csv`：按标准名称和资料类型去重后的最佳版本。
- `PDF资料画像.csv`：只看 PDF 的提取结果。
- `图片资料索引.csv`：地图/图片资料索引。
- `栏目统计.csv`：攻略栏目命中统计。
- `关键词统计.csv`：文档关键词汇总统计。
- `资料图文总览.html`：带预览图的浏览页。

## 清洗与提取规则

- 标准名称会去掉 `.1`、`攻略`、`旅游攻略`、`可打印`、`9日/12日` 等尾缀。
- PDF 会提取全文文本、首个有文字页、总字符数、栏目清单、关键词、费用、推荐天数、舒适程度和摘要。
- 同一标准名称下若存在多份重复版本，优先保留文本更多、页数更多、文件更大的版本。
- 图片资料只生成预览和基础索引，不做文本抽取。
"""
    (OUTPUT_DIR / "README.md").write_text(readme_text, encoding="utf-8")

    print(f"source_dir={SOURCE_DIR}")
    print(f"output_dir={OUTPUT_DIR}")
    print(f"files={len(files)}")
    print(f"pdfs={sum(1 for p in profiles if p.ext == '.pdf')}")
    print(f"images={sum(1 for p in profiles if p.ext != '.pdf')}")
    print(f"deduped={len(deduped_profiles)}")


if __name__ == "__main__":
    main()
