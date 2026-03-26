from __future__ import annotations

import hashlib
import html
import re
import shutil
from collections import Counter
from pathlib import Path

import fitz
import pandas as pd
from PIL import Image


ROOT = Path(r"D:/wzb/codex")
WZB_ROOT = Path(r"D:/wzb")
OUTPUT_DIR = ROOT / "data" / "全国旅游数据整合_2026-03-24"
PREVIEW_DIR = OUTPUT_DIR / "previews"


NUMERIC_COLUMNS = [
    "游客年龄",
    "门票价格",
    "访问时长(小时)",
    "消费金额",
    "门票消费",
    "其他消费",
    "评分",
    "团费",
    "行程天数",
]

STRING_COLUMNS = [
    "游客性别",
    "游客年龄段",
    "游客来源省",
    "景点名称",
    "景点类型",
    "景点等级",
    "所在城市",
    "所在省份",
    "是否跟团",
    "旅行社",
    "主要景点",
    "交通方式",
    "季节",
    "是否节假日",
    "推荐程度",
    "满意度",
]

NOISE_WORDS = [
    "旅游攻略",
    "攻略",
    "可打印",
    "电子版",
    "景点地图",
    "旅游景点地图",
    "中国旅游地图",
    "中华人民共和国旅游景点地图",
    "中国国家地理",
    "游遍中国",
    "高清图片素材",
]


def find_paths() -> tuple[Path, Path]:
    csv_path = max(ROOT.glob("*.csv"), key=lambda p: p.stat().st_size)
    asset_dir = next(p for p in WZB_ROOT.iterdir() if p.is_dir() and "131" in p.name)
    return csv_path, asset_dir


def clean_string(value: object) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip()
    return re.sub(r"\s+", "", text)


def normalize_name(text: str) -> str:
    name = clean_string(text)
    for word in NOISE_WORDS:
        name = name.replace(word, "")
    name = re.sub(r"\.\d+$", "", name)
    name = re.sub(r"\d+日", "", name)
    name = re.sub(r"[()（）·、,，\-—_【】\[\]：:]", "", name)
    return name.strip()


def top_join(series: pd.Series, limit: int = 3) -> str:
    values = [clean_string(v) for v in series if clean_string(v)]
    if not values:
        return ""
    counts = Counter(values).most_common(limit)
    return " / ".join(f"{name}({count})" for name, count in counts)


def mode_or_empty(series: pd.Series) -> str:
    values = [clean_string(v) for v in series if clean_string(v)]
    if not values:
        return ""
    return Counter(values).most_common(1)[0][0]


def safe_ratio(mask: pd.Series) -> float:
    if len(mask) == 0:
        return 0.0
    return round(float(mask.mean()) * 100, 2)


def render_pdf_preview(pdf_path: Path, preview_path: Path) -> str:
    with fitz.open(pdf_path) as doc:
        page = doc.load_page(0)
        pix = page.get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False)
        pix.save(preview_path)
        text = page.get_text("text")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:180]


def create_image_preview(image_path: Path, preview_path: Path) -> None:
    with Image.open(image_path) as img:
        img = img.convert("RGB")
        img.thumbnail((720, 720))
        img.save(preview_path, quality=88)


def index_assets(asset_dir: Path) -> pd.DataFrame:
    rows: list[dict[str, str]] = []
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted([p for p in asset_dir.iterdir() if p.is_file()], key=lambda p: p.name)
    for idx, path in enumerate(files, start=1):
        ext = path.suffix.lower()
        title = path.stem
        normalized = normalize_name(title)
        preview_name = f"asset_{idx:03d}.jpg" if ext in {".jpg", ".jpeg"} else f"asset_{idx:03d}.png"
        preview_path = PREVIEW_DIR / preview_name
        snippet = ""

        if ext == ".pdf":
            try:
                snippet = render_pdf_preview(path, preview_path)
            except Exception:
                preview_path = Path("")
        elif ext in {".jpg", ".jpeg", ".png"}:
            try:
                create_image_preview(path, preview_path)
            except Exception:
                preview_path = Path("")
        else:
            preview_path = Path("")

        rows.append(
            {
                "素材标题": title,
                "素材类型": "PDF攻略" if ext == ".pdf" else "图片素材",
                "扩展名": ext,
                "标准名称": normalized,
                "原文件路径": str(path),
                "预览图路径": str(preview_path) if preview_path else "",
                "首页摘要": snippet,
            }
        )

    return pd.DataFrame(rows)


def match_asset(attraction: str, city: str, assets: pd.DataFrame) -> tuple[str, str, str]:
    attraction_key = normalize_name(attraction)
    city_key = normalize_name(city.replace("市", ""))

    if attraction_key:
        exact = assets[assets["标准名称"] == attraction_key]
        if not exact.empty:
            row = exact.iloc[0]
            return row["素材标题"], row["原文件路径"], row["预览图路径"]

        contains = assets[
            assets["标准名称"].apply(
                lambda x: bool(x) and (x in attraction_key or attraction_key in x)
            )
        ]
        if not contains.empty:
            row = contains.iloc[0]
            return row["素材标题"], row["原文件路径"], row["预览图路径"]

    if city_key:
        city_match = assets[
            assets["标准名称"].apply(lambda x: bool(x) and (x == city_key or x in city_key or city_key in x))
        ]
        if not city_match.empty:
            row = city_match.iloc[0]
            return row["素材标题"], row["原文件路径"], row["预览图路径"]

    return "", "", ""


def build_clean_records(df: pd.DataFrame) -> pd.DataFrame:
    clean_df = df.copy()

    for col in STRING_COLUMNS:
        clean_df[col] = clean_df[col].map(clean_string)

    for col in NUMERIC_COLUMNS:
        clean_df[col] = pd.to_numeric(clean_df[col], errors="coerce")

    clean_df["访问日期"] = pd.to_datetime(clean_df["访问日期"], errors="coerce")
    clean_df["访问年份"] = clean_df["访问日期"].dt.year
    clean_df["访问月份"] = clean_df["访问日期"].dt.month
    clean_df["访问季度"] = clean_df["访问日期"].dt.quarter

    clean_df["是否跟团布尔"] = clean_df["是否跟团"].eq("是")
    clean_df["是否节假日布尔"] = clean_df["是否节假日"].eq("是")

    clean_df["游客记录哈希"] = clean_df["游客ID"].map(
        lambda x: hashlib.md5(str(x).encode("utf-8")).hexdigest()[:12]
    )

    ordered_columns = [
        "游客记录哈希",
        "游客性别",
        "游客年龄",
        "游客年龄段",
        "游客来源省",
        "景点名称",
        "景点类型",
        "景点等级",
        "所在城市",
        "所在省份",
        "门票价格",
        "访问日期",
        "访问年份",
        "访问月份",
        "访问季度",
        "访问时长(小时)",
        "消费金额",
        "门票消费",
        "其他消费",
        "评分",
        "是否跟团",
        "团费",
        "行程天数",
        "主要景点",
        "交通方式",
        "季节",
        "是否节假日",
        "推荐程度",
        "满意度",
    ]
    return clean_df[ordered_columns]


def aggregate_attractions(clean_df: pd.DataFrame, assets: pd.DataFrame) -> pd.DataFrame:
    grouped = clean_df.groupby(["景点名称", "所在城市", "所在省份"], dropna=False)
    rows: list[dict[str, object]] = []

    for (attraction, city, province), group in grouped:
        asset_title, asset_path, preview_path = match_asset(attraction, city, assets)
        rows.append(
            {
                "景点名称": attraction,
                "所在城市": city,
                "所在省份": province,
                "景点类型": mode_or_empty(group["景点类型"]),
                "景点等级": mode_or_empty(group["景点等级"]),
                "游客样本量": int(len(group)),
                "平均评分": round(group["评分"].mean(), 2),
                "平均消费金额": round(group["消费金额"].mean(), 2),
                "平均门票价格": round(group["门票价格"].mean(), 2),
                "平均访问时长(小时)": round(group["访问时长(小时)"].mean(), 2),
                "跟团占比(%)": safe_ratio(group["是否跟团"] == "是"),
                "节假日访问占比(%)": safe_ratio(group["是否节假日"] == "是"),
                "高频季节": top_join(group["季节"], 2),
                "高频交通方式": top_join(group["交通方式"], 3),
                "高频游客来源省": top_join(group["游客来源省"], 5),
                "推荐程度分布": top_join(group["推荐程度"], 3),
                "满意度分布": top_join(group["满意度"], 3),
                "匹配素材标题": asset_title,
                "匹配素材路径": asset_path,
                "预览图路径": preview_path,
            }
        )

    result = pd.DataFrame(rows)
    return result.sort_values(["游客样本量", "平均评分"], ascending=[False, False])


def aggregate_cities(clean_df: pd.DataFrame) -> pd.DataFrame:
    grouped = clean_df.groupby(["所在城市", "所在省份"], dropna=False)
    rows: list[dict[str, object]] = []

    for (city, province), group in grouped:
        rows.append(
            {
                "所在城市": city,
                "所在省份": province,
                "景点样本数": int(group["景点名称"].nunique()),
                "游客样本量": int(len(group)),
                "平均评分": round(group["评分"].mean(), 2),
                "平均消费金额": round(group["消费金额"].mean(), 2),
                "平均访问时长(小时)": round(group["访问时长(小时)"].mean(), 2),
                "高频景点": top_join(group["景点名称"], 5),
                "高频季节": top_join(group["季节"], 3),
                "高频交通方式": top_join(group["交通方式"], 3),
                "高频游客来源省": top_join(group["游客来源省"], 5),
            }
        )

    return pd.DataFrame(rows).sort_values(["游客样本量", "平均评分"], ascending=[False, False])


def write_summary(
    clean_df: pd.DataFrame,
    attraction_df: pd.DataFrame,
    city_df: pd.DataFrame,
    assets_df: pd.DataFrame,
) -> None:
    matched_count = int((attraction_df["匹配素材路径"] != "").sum())
    summary = f"""# 全国旅游数据整合说明

整理日期：2026-03-24

本次整合做了三件事：

- 清洗 `全国旅游数据集.csv`，去掉直接可识别个人信息，只保留可分析字段。
- 为 `全部131个景点` 目录中的 PDF/JPG 建立素材索引。
- 尝试把景点统计结果和本地攻略素材自动匹配，并生成带预览图的总览页。

数据规模：

- 游客记录：{len(clean_df):,} 条
- 景点数：{attraction_df['景点名称'].nunique():,} 个
- 城市数：{city_df['所在城市'].nunique():,} 个
- 素材文件：{len(assets_df):,} 个
- 已匹配到本地素材的景点：{matched_count:,} 个

输出文件：

- `游客明细_脱敏清洗.csv`
- `景点画像汇总.csv`
- `城市画像汇总.csv`
- `攻略素材索引.csv`
- `景点图文总览.html`

说明：

- 图片预览以 PDF 首页缩略图或 JPG 缩略图为主。
- 自动匹配优先按“景点名称”，其次按“所在城市”；因此部分城市攻略会挂到该城市下的多个景点上。
- 如果你后续要做 PPT、网页或数据库，这套输出已经比原始文件更适合直接消费。
"""
    (OUTPUT_DIR / "README.md").write_text(summary, encoding="utf-8")


def build_html_gallery(attraction_df: pd.DataFrame) -> None:
    cards: list[str] = []
    for row in attraction_df.head(180).to_dict("records"):
        preview = row["预览图路径"]
        preview_rel = ""
        if preview:
            preview_rel = Path(preview).relative_to(OUTPUT_DIR).as_posix()
        image_html = (
            f'<img src="{html.escape(preview_rel)}" alt="{html.escape(row["景点名称"])}" loading="lazy">'
            if preview_rel
            else '<div class="no-image">暂无预览图</div>'
        )
        cards.append(
            f"""
            <article class="card">
              <div class="media">{image_html}</div>
              <div class="body">
                <h2>{html.escape(row["景点名称"])}</h2>
                <p class="meta">{html.escape(row["所在省份"])} / {html.escape(row["所在城市"])} / {html.escape(row["景点类型"] or '未分类')}</p>
                <p>样本量：<strong>{row["游客样本量"]}</strong>，平均评分：<strong>{row["平均评分"]}</strong></p>
                <p>平均消费：{row["平均消费金额"]} 元，平均门票：{row["平均门票价格"]} 元，平均停留：{row["平均访问时长(小时)"]} 小时</p>
                <p>高频季节：{html.escape(row["高频季节"] or '暂无')}</p>
                <p>高频交通：{html.escape(row["高频交通方式"] or '暂无')}</p>
                <p>游客来源：{html.escape(row["高频游客来源省"] or '暂无')}</p>
                <p class="asset">素材：{html.escape(row["匹配素材标题"] or '未匹配')}</p>
              </div>
            </article>
            """
        )

    html_text = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>全国旅游景点图文总览</title>
  <style>
    :root {{
      --bg: #f6f2ea;
      --card: #fffdf8;
      --line: #d7cbb5;
      --text: #2c241b;
      --muted: #7b6957;
      --accent: #a35c2c;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, #efe3cf 0, transparent 28%),
        linear-gradient(180deg, #faf6ef, var(--bg));
    }}
    .wrap {{ max-width: 1280px; margin: 0 auto; padding: 28px; }}
    h1 {{ margin: 0 0 8px; font-size: 32px; }}
    .intro {{ color: var(--muted); margin-bottom: 24px; }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 18px;
    }}
    .card {{
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 10px 24px rgba(95, 69, 44, 0.08);
    }}
    .media {{
      height: 220px;
      background: #efe2cf;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    .media img {{
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }}
    .no-image {{
      color: var(--muted);
      font-size: 14px;
    }}
    .body {{ padding: 16px; }}
    .body h2 {{ margin: 0 0 8px; font-size: 22px; }}
    .meta {{ color: var(--accent); font-size: 14px; }}
    .body p {{ margin: 8px 0; line-height: 1.55; }}
    .asset {{ color: var(--muted); }}
  </style>
</head>
<body>
  <main class="wrap">
    <h1>全国旅游景点图文总览</h1>
    <p class="intro">基于游客记录清洗结果 + 本地 131 份景点攻略素材自动整合生成。页面按游客样本量和评分排序，方便快速筛选高价值目的地。</p>
    <section class="grid">
      {''.join(cards)}
    </section>
  </main>
</body>
</html>
"""
    (OUTPUT_DIR / "景点图文总览.html").write_text(html_text, encoding="utf-8")


def main() -> None:
    csv_path, asset_dir = find_paths()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(csv_path)
    clean_df = build_clean_records(df)
    assets_df = index_assets(asset_dir)
    attraction_df = aggregate_attractions(clean_df, assets_df)
    city_df = aggregate_cities(clean_df)

    clean_df.to_csv(OUTPUT_DIR / "游客明细_脱敏清洗.csv", index=False, encoding="utf-8-sig")
    attraction_df.to_csv(OUTPUT_DIR / "景点画像汇总.csv", index=False, encoding="utf-8-sig")
    city_df.to_csv(OUTPUT_DIR / "城市画像汇总.csv", index=False, encoding="utf-8-sig")
    assets_df.to_csv(OUTPUT_DIR / "攻略素材索引.csv", index=False, encoding="utf-8-sig")

    write_summary(clean_df, attraction_df, city_df, assets_df)
    build_html_gallery(attraction_df)


if __name__ == "__main__":
    main()
