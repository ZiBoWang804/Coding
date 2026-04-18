"""Core data pipeline for collection, clustering, keyword extraction, and topic tracking."""

from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from statistics import mean
from typing import Any

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .demo_data import get_followup_articles, get_seed_articles
from .live_fetch import fetch_rss_articles
from .text_analysis import analyze_sentiment, build_document, build_stopwords, tokenize

PROJECT_ROOT = Path(__file__).resolve().parent.parent
GENERATED_DIR = PROJECT_ROOT / "generated"

KEYWORD_TRANSLATIONS = {
    "ai": "人工智能",
    "agent": "智能体",
    "agents": "智能体",
    "accelerator": "加速器",
    "accelerators": "加速器",
    "adoption": "采用率",
    "approval": "审批",
    "bank": "银行",
    "banking": "银行业务",
    "banks": "银行",
    "battery": "电池",
    "batteries": "电池",
    "benchmark": "基准测试",
    "bond": "债券",
    "bonds": "债券",
    "broker": "券商",
    "brokers": "券商",
    "bullion": "黄金",
    "central bank": "央行",
    "charging": "充电",
    "chip": "芯片",
    "chipmakers": "芯片厂商",
    "chips": "芯片",
    "cloud": "云计算",
    "coach": "教练",
    "comeback": "逆转",
    "compliance": "合规",
    "compute": "算力",
    "computing": "算力",
    "concert": "演出",
    "contracts": "合约",
    "cooling": "散热",
    "credit": "信贷",
    "culture": "文化",
    "currency": "汇率",
    "cybersecurity": "网络安全",
    "data": "数据",
    "datacenter": "数据中心",
    "datacenters": "数据中心",
    "defense": "防守",
    "defeat": "失利",
    "developer": "开发者",
    "developers": "开发者",
    "digital": "数字化",
    "disclosure": "信息披露",
    "dollar": "美元",
    "earnings": "财报",
    "edge": "边缘",
    "electric": "电动",
    "electric vehicle": "电动汽车",
    "electric vehicles": "电动汽车",
    "energy": "能源",
    "equity": "股票",
    "exchange": "汇率",
    "exchange rate": "汇率",
    "festival": "节庆",
    "finance": "金融",
    "financing": "融资",
    "fintech": "金融科技",
    "fleet": "车队",
    "football": "足球",
    "forecast": "预测",
    "forex": "外汇",
    "forward": "前锋",
    "fund": "基金",
    "funds": "基金",
    "glucose": "血糖",
    "gold": "黄金",
    "gpu": "GPU",
    "guard": "后卫",
    "guidance": "业绩指引",
    "healthcare": "医疗健康",
    "hospital": "医院",
    "hospitals": "医院",
    "hydro": "水电",
    "identity": "身份治理",
    "imaging": "影像",
    "importers": "进口商",
    "inference": "推理",
    "infra": "基础设施",
    "injury": "伤病",
    "innovation": "创新",
    "interest rate": "利率",
    "investment": "投资",
    "investors": "投资者",
    "league": "联赛",
    "liquid cooling": "液冷",
    "lithium": "锂",
    "loss": "失利",
    "market": "市场",
    "markets": "市场",
    "medical": "医疗",
    "microgrid": "微电网",
    "model": "模型",
    "models": "模型",
    "momentum": "走势",
    "multimodal": "多模态",
    "museum": "博物馆",
    "network": "网络",
    "networks": "网络",
    "nba": "NBA",
    "offshore": "海上",
    "optical": "光互连",
    "outlook": "预期",
    "packaging": "封装",
    "passkey": "无密码登录",
    "payment": "支付",
    "payments": "支付",
    "phishing": "钓鱼攻击",
    "playoff": "季后赛",
    "positive": "利好",
    "power": "电力",
    "practice": "训练",
    "pressure": "压力",
    "pricing": "定价",
    "processor": "处理器",
    "processors": "处理器",
    "provider": "服务商",
    "providers": "服务商",
    "rate": "利率",
    "rate cut": "降息",
    "rates": "利率",
    "rally": "反弹",
    "ransomware": "勒索攻击",
    "rebound": "反弹",
    "recovery": "复苏",
    "renewable": "可再生能源",
    "return": "复出",
    "returns": "复出",
    "robotics": "机器人",
    "rotation": "轮换",
    "season": "赛季",
    "securities": "证券",
    "security": "安全",
    "sensor": "传感器",
    "sensors": "传感器",
    "server": "服务器",
    "servers": "服务器",
    "settlement": "结算",
    "share": "股票",
    "shares": "股票",
    "small-cap": "小盘股",
    "software": "软件",
    "solar": "光伏",
    "sport": "体育",
    "sports": "体育",
    "stadium": "场馆",
    "stock": "股票",
    "stocks": "股票",
    "storage": "储能",
    "striker": "前锋",
    "supply": "供应链",
    "telehealth": "远程医疗",
    "title race": "争冠",
    "climate": "气候",
    "tournament": "赛事",
    "tourism": "文旅",
    "expectations": "预期",
    "trade": "交易",
    "training": "训练",
    "transport": "交通",
    "travel": "旅游",
    "treasury": "美债",
    "tokenized": "资产代币化",
    "valuation": "估值",
    "vehicle": "汽车",
    "vehicles": "汽车",
    "victory": "胜利",
    "vitals": "生命体征",
    "vulnerability": "漏洞",
    "vulnerabilities": "漏洞",
    "vaccine": "疫苗",
    "wearable": "可穿戴",
    "win": "赢球",
    "wind": "风电",
    "workflow": "工作流",
    "world": "国际",
    "yuan": "人民币",
    "yield": "收益率",
    "yields": "收益率",
    "zero trust": "零信任",
    "grid": "电网",
    "biotech": "生物科技",
}

TOPIC_NAME_RULES = [
    ("AI技术", {"ai", "agent", "model", "inference", "gpu", "chip", "datacenter", "server", "accelerator", "multimodal"}),
    ("体育资讯", {"nba", "basketball", "playoff", "injury", "guard", "center", "forward", "coach", "victory", "loss", "rotation", "stadium", "match", "tournament"}),
    ("金融资讯", {"bank", "banking", "equity", "stock", "share", "bond", "yield", "currency", "forex", "exchange", "rate", "treasury", "gold", "bullion", "securities", "valuation"}),
    ("金融科技", {"fintech", "payment", "payments", "settlement", "credit", "tokenized", "compliance"}),
    ("文旅资讯", {"travel", "tourism", "museum", "festival", "concert", "culture", "exhibition", "hotel", "visitor"}),
    ("新能源车", {"electric", "vehicle", "battery", "charging", "fleet", "lithium", "swap", "dealer"}),
    ("能源电力", {"energy", "grid", "solar", "wind", "storage", "power", "renewable", "hydro", "microgrid"}),
    ("网络安全", {"cybersecurity", "phishing", "breach", "ransomware", "identity", "passkey", "vulnerability", "zero trust", "security"}),
    ("医疗科技", {"healthcare", "hospital", "medical", "biotech", "vaccine", "imaging", "telehealth", "sensor", "wearable", "glucose"}),
]

GENERIC_KEYWORDS = {
    "analysis",
    "analyst",
    "analysts",
    "company",
    "companies",
    "daily",
    "desk",
    "group",
    "groups",
    "latest",
    "news",
    "official",
    "officials",
    "operator",
    "operators",
    "people",
    "pilot",
    "pilots",
    "project",
    "projects",
    "reported",
    "reports",
    "said",
    "says",
    "story",
    "team",
    "teams",
    "update",
    "updates",
    "week",
    "weekly",
    "wire",
}

KEYWORD_ALIASES = {
    "agents": "agent",
    "banks": "bank",
    "batteries": "battery",
    "bonds": "bond",
    "chipmakers": "chip",
    "chips": "chip",
    "companies": "company",
    "currencies": "currency",
    "developers": "developer",
    "funds": "fund",
    "guards": "guard",
    "hospitals": "hospital",
    "investors": "investor",
    "markets": "market",
    "models": "model",
    "providers": "provider",
    "rates": "rate",
    "returns": "return",
    "servers": "server",
    "shares": "share",
    "stocks": "stock",
    "sensors": "sensor",
    "vehicles": "vehicle",
    "yields": "yield",
}

SENTIMENT_LABELS = {
    "positive": "偏正面",
    "neutral": "中性",
    "negative": "偏负面",
}

SOURCE_MODE_LABELS = {
    "auto": "自动模式",
    "demo": "演示数据",
    "live": "实时抓取",
}


@dataclass(slots=True)
class PipelineConfig:
    source_mode: str = "auto"
    cluster_count: int = 8
    top_keywords: int = 5
    max_features: int = 900


@dataclass(slots=True)
class PipelineRuntime:
    config: PipelineConfig
    resolved_source_mode: str
    notes: list[str]
    articles: list[dict]
    followup_articles: list[dict]
    vectorizer: TfidfVectorizer
    matrix: Any
    kmeans: Any
    dashboard: dict


@dataclass(slots=True)
class SimpleKMeansResult:
    cluster_centers_: np.ndarray
    labels_: np.ndarray
    n_clusters: int
    n_iter_: int
    inertia_: float


def _normalize_article(article: dict) -> dict:
    raw_title = article["title"].strip()
    raw_summary = article.get("summary", "").strip()
    raw_source = article.get("source", "Unknown")
    title = article.get("title_zh", raw_title).strip()
    summary = article.get("summary_zh", raw_summary).strip()
    source = article.get("source_zh", raw_source).strip()

    normalized = {
        "id": article["id"],
        "source_id": article.get("source_id", raw_source.lower().replace(" ", "-")),
        "title": title,
        "summary": summary,
        "source": source,
        "source_url": article.get("source_url", ""),
        "url": article.get("url", ""),
        "published_at": article.get("published_at", ""),
        "raw_title": raw_title,
        "raw_summary": raw_summary,
        "raw_source": raw_source,
    }
    normalized["document"] = build_document(normalized)
    normalized["token_set"] = set(tokenize(normalized["document"]))
    normalized["sentiment"] = analyze_sentiment(normalized["document"])
    return normalized


def _load_initial_articles(source_mode: str) -> tuple[list[dict], str, list[str]]:
    notes: list[str] = []

    if source_mode == "demo":
        notes.append("当前使用本地演示数据，适合稳定展示真实聚类、主题选择与情感跟踪流程。")
        return [_normalize_article(article) for article in get_seed_articles()], "demo", notes

    if source_mode == "live":
        articles = [_normalize_article(article) for article in fetch_rss_articles()]
        notes.append("当前使用在线 RSS 实时抓取结果。")
        return articles, "live", notes

    try:
        articles = [_normalize_article(article) for article in fetch_rss_articles()]
        notes.append("在线 RSS 抓取成功，当前页面展示实时采集结果。")
        return articles, "live", notes
    except Exception as exc:
        notes.append(f"在线抓取失败，系统已自动回退到演示数据。原因：{exc}")
        return [_normalize_article(article) for article in get_seed_articles()], "demo", notes


def _load_followup_articles(source_mode: str, resolved_mode: str) -> tuple[list[dict], list[str]]:
    notes: list[str] = []

    if source_mode == "demo" or resolved_mode == "demo":
        notes.append("主题跟踪文章当前也来自本地内置样例集。")
        return [_normalize_article(article) for article in get_followup_articles()], notes

    try:
        live_articles = [_normalize_article(article) for article in fetch_rss_articles(max_items_per_feed=5)]
        notes.append("主题跟踪文章已刷新为最新在线 RSS 内容。")
        return live_articles, notes
    except Exception as exc:
        notes.append(f"在线主题跟踪刷新失败，已回退到内置跟踪样例。原因：{exc}")
        return [_normalize_article(article) for article in get_followup_articles()], notes


def _resolve_candidate_ks(requested_limit: int, article_count: int) -> list[int]:
    if article_count < 3:
        return [1]

    heuristic_upper = max(2, int(math.floor(math.sqrt(article_count))))
    requested_upper = max(2, requested_limit)
    upper_bound = min(article_count - 1, 10, max(heuristic_upper, requested_upper))
    return list(range(2, upper_bound + 1))


def _project_positions(matrix: Any) -> list[tuple[float, float]]:
    if matrix.shape[0] < 2 or matrix.shape[1] < 2:
        return [(0.5, 0.5) for _ in range(matrix.shape[0])]

    reducer = TruncatedSVD(n_components=2, random_state=42)
    coords = reducer.fit_transform(matrix)
    xs = coords[:, 0]
    ys = coords[:, 1]
    x_min, x_max = xs.min(), xs.max()
    y_min, y_max = ys.min(), ys.max()

    positions: list[tuple[float, float]] = []
    for x, y in zip(xs, ys):
        normalized_x = 0.5 if x_max == x_min else (x - x_min) / (x_max - x_min)
        normalized_y = 0.5 if y_max == y_min else (y - y_min) / (y_max - y_min)
        positions.append((round(float(normalized_x), 4), round(float(normalized_y), 4)))
    return positions


def _run_simple_kmeans(
    vectors: np.ndarray,
    n_clusters: int,
    random_state: int = 42,
    max_iter: int = 60,
    n_init: int = 12,
) -> SimpleKMeansResult:
    sample_count = vectors.shape[0]

    def single_run(seed: int) -> tuple[np.ndarray, np.ndarray, int, float]:
        rng = np.random.default_rng(seed)
        first_index = int(rng.integers(sample_count))
        centroids = [vectors[first_index]]

        while len(centroids) < n_clusters:
            current = np.vstack(centroids)
            squared_distances = ((vectors[:, None, :] - current[None, :, :]) ** 2).sum(axis=2)
            closest = squared_distances.min(axis=1)
            total = float(closest.sum())
            if total <= 0:
                next_index = int(rng.integers(sample_count))
            else:
                next_index = int(rng.choice(sample_count, p=closest / total))
            centroids.append(vectors[next_index])

        centroid_array = np.vstack(centroids)
        labels = np.zeros(sample_count, dtype=int)

        for iteration in range(max_iter):
            squared_distances = ((vectors[:, None, :] - centroid_array[None, :, :]) ** 2).sum(axis=2)
            new_labels = squared_distances.argmin(axis=1)

            new_centroids = []
            for cluster_id in range(n_clusters):
                mask = new_labels == cluster_id
                if mask.any():
                    new_centroids.append(vectors[mask].mean(axis=0))
                else:
                    new_centroids.append(vectors[int(rng.integers(sample_count))])
            new_centroid_array = np.vstack(new_centroids)

            if np.array_equal(new_labels, labels) and np.allclose(new_centroid_array, centroid_array):
                inertia = float(((vectors - new_centroid_array[new_labels]) ** 2).sum())
                return new_centroid_array, new_labels, iteration + 1, inertia

            centroid_array = new_centroid_array
            labels = new_labels

        inertia = float(((vectors - centroid_array[labels]) ** 2).sum())
        return centroid_array, labels, max_iter, inertia

    best_centers = None
    best_labels = None
    best_iterations = 0
    best_inertia = None

    for offset in range(n_init):
        centers, labels, iterations, inertia = single_run(random_state + offset)
        if best_inertia is None or inertia < best_inertia:
            best_centers = centers
            best_labels = labels
            best_iterations = iterations
            best_inertia = inertia

    return SimpleKMeansResult(
        cluster_centers_=best_centers,
        labels_=best_labels,
        n_clusters=n_clusters,
        n_iter_=best_iterations,
        inertia_=float(best_inertia if best_inertia is not None else 0.0),
    )


def _silhouette_score(vectors: np.ndarray, labels: np.ndarray) -> float | None:
    unique_labels = sorted(set(int(label) for label in labels))
    if len(unique_labels) < 2:
        return None

    distances = np.linalg.norm(vectors[:, None, :] - vectors[None, :, :], axis=2)
    scores = []

    for index, label in enumerate(labels):
        same_cluster_mask = labels == label
        same_cluster_mask[index] = False
        a_i = float(distances[index, same_cluster_mask].mean()) if same_cluster_mask.any() else 0.0

        b_i = None
        for other_label in unique_labels:
            if other_label == int(label):
                continue
            other_mask = labels == other_label
            if not other_mask.any():
                continue
            candidate = float(distances[index, other_mask].mean())
            b_i = candidate if b_i is None else min(b_i, candidate)

        if b_i is None:
            continue

        denominator = max(a_i, b_i, 1e-9)
        scores.append((b_i - a_i) / denominator)

    return float(sum(scores) / len(scores)) if scores else None


def _evaluate_kmeans(vectors: np.ndarray, kmeans: SimpleKMeansResult) -> dict[str, Any]:
    sizes = [int(np.sum(kmeans.labels_ == cluster_id)) for cluster_id in range(kmeans.n_clusters)]
    mean_size = float(np.mean(sizes)) if sizes else 0.0
    imbalance = float(np.std(sizes) / max(mean_size, 1.0)) if sizes else 0.0
    silhouette = _silhouette_score(vectors, kmeans.labels_)
    singleton_count = sum(size <= 1 for size in sizes)
    tiny_cluster_count = sum(size < 3 for size in sizes)
    return {
        "k": kmeans.n_clusters,
        "kmeans": kmeans,
        "sizes": sizes,
        "min_size": min(sizes) if sizes else 0,
        "mean_size": mean_size,
        "imbalance": imbalance,
        "singleton_count": singleton_count,
        "tiny_cluster_count": tiny_cluster_count,
        "silhouette": silhouette,
        "inertia": float(kmeans.inertia_),
    }


def _select_best_candidate(candidates: list[dict[str, Any]]) -> dict[str, Any]:
    if len(candidates) == 1:
        candidate = dict(candidates[0])
        candidate["quality"] = 1.0
        return candidate

    inertias = [candidate["inertia"] for candidate in candidates]
    inertia_min = min(inertias)
    inertia_max = max(inertias)

    scored_candidates: list[dict[str, Any]] = []
    for candidate in candidates:
        silhouette = candidate["silhouette"] if candidate["silhouette"] is not None else -0.35
        if inertia_max == inertia_min:
            compactness = 1.0
        else:
            compactness = 1.0 - ((candidate["inertia"] - inertia_min) / (inertia_max - inertia_min))
        singleton_ratio = candidate["singleton_count"] / max(candidate["k"], 1)
        tiny_ratio = candidate["tiny_cluster_count"] / max(candidate["k"], 1)
        quality = (
            silhouette
            + 0.12 * compactness
            - 0.18 * singleton_ratio
            - 0.08 * tiny_ratio
            - 0.05 * candidate["imbalance"]
        )
        scored = dict(candidate)
        scored["quality"] = float(quality)
        scored_candidates.append(scored)

    scored_candidates.sort(
        key=lambda candidate: (
            candidate["quality"],
            candidate["silhouette"] if candidate["silhouette"] is not None else -1.0,
            -candidate["singleton_count"],
            -candidate["tiny_cluster_count"],
            -candidate["imbalance"],
            -candidate["k"],
        ),
        reverse=True,
    )
    return scored_candidates[0]


def _normalize_keyword_term(term: str) -> str:
    parts = []
    for token in term.lower().replace("-", " ").split():
        parts.append(KEYWORD_ALIASES.get(token, token))
    return " ".join(parts)


def _display_term_fallback(term: str) -> str:
    if term.isalpha() and len(term) <= 5:
        return term.upper()
    return term.replace("-", " ")


def _localize_keyword(keyword: str) -> str:
    normalized = _normalize_keyword_term(keyword)
    if normalized in KEYWORD_TRANSLATIONS:
        return KEYWORD_TRANSLATIONS[normalized]

    translated_parts = []
    for part in normalized.split():
        translated_parts.append(KEYWORD_TRANSLATIONS.get(part, _display_term_fallback(part)))
    return " / ".join(part for part in translated_parts if part)


def _extract_cluster_keywords(
    matrix: Any,
    labels: np.ndarray,
    vectorizer: TfidfVectorizer,
    cluster_id: int,
    top_keywords: int,
) -> list[str]:
    terms = vectorizer.get_feature_names_out()
    cluster_mask = labels == cluster_id
    if not cluster_mask.any():
        return []

    cluster_mean = np.asarray(matrix[cluster_mask].mean(axis=0)).ravel()
    ranked_indices = cluster_mean.argsort()[::-1]
    keywords: list[str] = []
    seen_terms: set[str] = set()

    for term_index in ranked_indices:
        candidate = _normalize_keyword_term(str(terms[term_index]))
        if not candidate or candidate in seen_terms:
            continue

        candidate_parts = candidate.split()
        if all(part in GENERIC_KEYWORDS for part in candidate_parts):
            continue
        if any(part in GENERIC_KEYWORDS for part in candidate_parts) and len(candidate_parts) == 1:
            continue

        seen_terms.add(candidate)
        keywords.append(candidate)
        if len(keywords) >= max(top_keywords * 2, 8):
            break

    return keywords


def _localize_keywords(raw_keywords: list[str], top_keywords: int) -> list[str]:
    localized: list[str] = []
    for keyword in raw_keywords:
        display = _localize_keyword(keyword)
        if display not in localized:
            localized.append(display)
        if len(localized) >= top_keywords:
            break
    return localized


def _topic_keyword(raw_keywords: list[str]) -> str:
    for keyword in raw_keywords:
        localized = _localize_keyword(keyword)
        if localized and localized not in {"市场", "数据", "系统", "平台"}:
            return localized
    return "未命名主题"


def _topic_name(raw_keywords: list[str]) -> str:
    flattened_terms = set()
    for keyword in raw_keywords:
        normalized = _normalize_keyword_term(keyword)
        flattened_terms.add(normalized)
        flattened_terms.update(normalized.split())

    for topic_name, hints in TOPIC_NAME_RULES:
        if len(flattened_terms & hints) >= 2:
            return topic_name

    return _topic_keyword(raw_keywords)


def _sentiment_label(sentiment_code: str) -> str:
    return SENTIMENT_LABELS.get(sentiment_code, "中性")


def _mood_from_articles(articles: list[dict]) -> str:
    counts = Counter(article["sentiment"]["label"] for article in articles)
    if counts["positive"] > counts["negative"]:
        return "positive"
    if counts["negative"] > counts["positive"]:
        return "negative"
    return "neutral"


def _cluster_summary(label: str, keywords: list[str], articles: list[dict]) -> str:
    mood_code = _mood_from_articles(articles)
    lead = articles[0]["title"] if articles else "暂无代表文章"
    keyword_text = "、".join(keywords[:3]) if keywords else "暂无关键词"
    return f"{label}主要围绕“{keyword_text}”展开，当前整体舆情为{_sentiment_label(mood_code)}，代表文章是《{lead}》。"


def _keyword_overlap_ratio(article: dict, raw_keywords: list[str]) -> float:
    if not raw_keywords:
        return 0.0

    lowered_document = article["document"].lower()
    token_set = article.get("token_set", set())
    hits = 0
    for keyword in raw_keywords:
        normalized = _normalize_keyword_term(keyword)
        if " " in normalized:
            if normalized in lowered_document or all(part in token_set for part in normalized.split()):
                hits += 1
        elif normalized in token_set or normalized in lowered_document:
            hits += 1
    return hits / max(len(raw_keywords), 1)


def _build_source_examples(articles: list[dict]) -> list[dict]:
    grouped: dict[str, dict] = {}
    for article in articles:
        source_id = article.get("source_id", article["source"].lower().replace(" ", "-"))
        if source_id not in grouped:
            grouped[source_id] = {
                "id": source_id,
                "name": article["source"],
                "url": article.get("source_url", ""),
                "count": 0,
            }
        grouped[source_id]["count"] += 1
        if not grouped[source_id]["url"] and article.get("source_url"):
            grouped[source_id]["url"] = article["source_url"]

    return sorted(grouped.values(), key=lambda item: (-item["count"], item["name"]))


def _reindex_clusters(kmeans: SimpleKMeansResult) -> SimpleKMeansResult:
    cluster_sizes = Counter(int(label) for label in kmeans.labels_)
    sort_order = sorted(range(kmeans.n_clusters), key=lambda cluster_id: (-cluster_sizes.get(cluster_id, 0), cluster_id))
    id_map = {old_id: new_id for new_id, old_id in enumerate(sort_order)}
    new_labels = np.array([id_map[int(label)] for label in kmeans.labels_], dtype=int)
    new_centers = np.vstack([kmeans.cluster_centers_[old_id] for old_id in sort_order])
    return SimpleKMeansResult(
        cluster_centers_=new_centers,
        labels_=new_labels,
        n_clusters=kmeans.n_clusters,
        n_iter_=kmeans.n_iter_,
        inertia_=kmeans.inertia_,
    )


def build_dashboard(config: PipelineConfig | None = None) -> PipelineRuntime:
    config = config or PipelineConfig()
    articles, resolved_mode, notes = _load_initial_articles(config.source_mode)
    followup_articles, followup_notes = _load_followup_articles(config.source_mode, resolved_mode)
    notes.extend(followup_notes)

    documents = [article["document"] for article in articles]
    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words=sorted(set(build_stopwords()) | set(ENGLISH_STOP_WORDS)),
        max_features=config.max_features,
        ngram_range=(1, 2),
        max_df=0.8,
        min_df=1,
        token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z\-]{2,}\b",
    )
    matrix = vectorizer.fit_transform(documents)
    dense_matrix = matrix.toarray()
    coordinates = _project_positions(matrix)

    candidate_ks = _resolve_candidate_ks(config.cluster_count, len(articles))
    if candidate_ks == [1]:
        initial_center = dense_matrix[:1] if len(dense_matrix) else np.zeros((1, matrix.shape[1]))
        best_candidate = {
            "k": 1,
            "quality": 1.0,
            "silhouette": None,
            "mean_size": float(len(articles)),
            "min_size": len(articles),
            "sizes": [len(articles)],
            "imbalance": 0.0,
            "singleton_count": 0,
            "tiny_cluster_count": 0,
            "kmeans": SimpleKMeansResult(
                cluster_centers_=initial_center,
                labels_=np.zeros(len(articles), dtype=int),
                n_clusters=1,
                n_iter_=1,
                inertia_=0.0,
            ),
        }
    else:
        evaluated_candidates = []
        for k in candidate_ks:
            evaluated_candidates.append(_evaluate_kmeans(dense_matrix, _run_simple_kmeans(dense_matrix, k)))
        best_candidate = _select_best_candidate(evaluated_candidates)

    kmeans = _reindex_clusters(best_candidate["kmeans"])
    label_array = kmeans.labels_

    raw_keywords_by_cluster = {
        cluster_id: _extract_cluster_keywords(matrix, label_array, vectorizer, cluster_id, config.top_keywords)
        for cluster_id in range(kmeans.n_clusters)
    }

    cluster_articles: dict[int, list[dict]] = defaultdict(list)
    for vector_index, (article, (x, y)) in enumerate(zip(articles, coordinates)):
        cluster_id = int(label_array[vector_index])
        article["cluster_id"] = cluster_id
        article["x"] = x
        article["y"] = y
        article["_vector_index"] = vector_index
        cluster_articles[cluster_id].append(article)

    clusters = []
    for cluster_id in range(kmeans.n_clusters):
        cluster_group = cluster_articles[cluster_id]
        if not cluster_group:
            continue

        centroid_vector = kmeans.cluster_centers_[cluster_id].reshape(1, -1)
        cluster_indices = [article["_vector_index"] for article in cluster_group]
        cluster_vectors = dense_matrix[cluster_indices]
        cluster_scores = cosine_similarity(cluster_vectors, centroid_vector).ravel()
        score_min = float(cluster_scores.min()) if len(cluster_scores) else 0.0
        score_max = float(cluster_scores.max()) if len(cluster_scores) else 1.0

        for article, score in zip(cluster_group, cluster_scores):
            normalized_score = 1.0 if score_max == score_min else (float(score) - score_min) / (score_max - score_min)
            article["cluster_relevance"] = round(float(score), 3)
            article["cluster_relevance_norm"] = round(normalized_score, 3)

        cluster_group.sort(
            key=lambda article: (
                article.get("cluster_relevance", 0.0),
                article["published_at"],
            ),
            reverse=True,
        )
        representative_article = cluster_group[0]
        latest_article = max(cluster_group, key=lambda article: article["published_at"])
        counts = Counter(article["sentiment"]["label"] for article in cluster_group)

        raw_keywords = raw_keywords_by_cluster.get(cluster_id, [])
        keywords = _localize_keywords(raw_keywords, config.top_keywords)
        topic_keyword = _topic_keyword(raw_keywords)
        topic_name = _topic_name(raw_keywords)
        centroid_x = round(mean(article["x"] for article in cluster_group), 4)
        centroid_y = round(mean(article["y"] for article in cluster_group), 4)
        mood_code = _mood_from_articles(cluster_group)
        matching_threshold = max(
            0.18,
            min(0.72, float(np.median(cluster_scores)) * 0.82 if len(cluster_scores) else 0.18),
        )
        quality_score = round(float(np.mean(cluster_scores)) if len(cluster_scores) else 0.0, 3)

        clusters.append(
            {
                "id": cluster_id,
                "label": topic_name,
                "topic_name": topic_name,
                "topic_keyword": topic_keyword,
                "keywords": keywords,
                "raw_keywords": raw_keywords,
                "size": len(cluster_group),
                "mood": mood_code,
                "mood_label": _sentiment_label(mood_code),
                "sources": _build_source_examples(cluster_group),
                "sentiment_distribution": {
                    "positive": counts.get("positive", 0),
                    "neutral": counts.get("neutral", 0),
                    "negative": counts.get("negative", 0),
                },
                "centroid": {"x": centroid_x, "y": centroid_y},
                "quality_score": quality_score,
                "matching_threshold": round(matching_threshold, 3),
                "representative_title": representative_article["title"],
                "representative_article": {
                    "id": representative_article["id"],
                    "title": representative_article["title"],
                    "url": representative_article["url"],
                    "source": representative_article["source"],
                    "source_id": representative_article["source_id"],
                },
                "latest_article": {
                    "id": latest_article["id"],
                    "title": latest_article["title"],
                    "url": latest_article["url"],
                    "source": latest_article["source"],
                    "source_id": latest_article["source_id"],
                    "published_at": latest_article["published_at"],
                },
                "summary": _cluster_summary(topic_name, keywords, cluster_group),
                "articles": [
                    {
                        "id": article["id"],
                        "source_id": article["source_id"],
                        "title": article["title"],
                        "summary": article["summary"],
                        "source": article["source"],
                        "source_url": article["source_url"],
                        "url": article["url"],
                        "published_at": article["published_at"],
                        "sentiment": article["sentiment"],
                        "cluster_relevance": article["cluster_relevance"],
                        "cluster_relevance_norm": article["cluster_relevance_norm"],
                        "x": article["x"],
                        "y": article["y"],
                    }
                    for article in cluster_group
                ],
            }
        )

    notes.append(f"当前结果来自真实 TF-IDF + KMeans 聚类；候选 K 为 {candidate_ks}，算法自动选择最佳 K={kmeans.n_clusters}。")

    runtime = PipelineRuntime(
        config=config,
        resolved_source_mode=resolved_mode,
        notes=notes,
        articles=articles,
        followup_articles=followup_articles,
        vectorizer=vectorizer,
        matrix=matrix,
        kmeans=kmeans,
        dashboard={},
    )

    metrics = {
        "article_count": len(articles),
        "cluster_count": len(clusters),
        "best_k": kmeans.n_clusters,
        "candidate_ks": candidate_ks,
        "source_count": len(_build_source_examples(articles)),
        "tracked_article_count": 0,
        "silhouette_score": round(best_candidate["silhouette"], 3) if best_candidate["silhouette"] is not None else None,
        "clustering_quality": round(best_candidate.get("quality", 0.0), 3),
    }

    runtime.dashboard = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source_mode_requested": config.source_mode,
        "source_mode_requested_label": SOURCE_MODE_LABELS.get(config.source_mode, config.source_mode),
        "source_mode_resolved": resolved_mode,
        "source_mode_resolved_label": SOURCE_MODE_LABELS.get(resolved_mode, resolved_mode),
        "notes": notes,
        "metrics": metrics,
        "source_examples": _build_source_examples(articles),
        "clusters": clusters,
        "articles": [
            {
                "id": article["id"],
                "source_id": article["source_id"],
                "title": article["title"],
                "summary": article["summary"],
                "source": article["source"],
                "source_url": article["source_url"],
                "url": article["url"],
                "published_at": article["published_at"],
                "cluster_id": article["cluster_id"],
                "sentiment": article["sentiment"],
                "cluster_relevance": article.get("cluster_relevance"),
                "cluster_relevance_norm": article.get("cluster_relevance_norm"),
                "x": article["x"],
                "y": article["y"],
            }
            for article in articles
        ],
        "tracked_topic": {},
    }
    default_cluster_id = clusters[0]["id"] if clusters else 0
    runtime.dashboard["tracked_topic"] = build_topic_tracking(runtime, default_cluster_id)
    runtime.dashboard["metrics"]["tracked_article_count"] = len(runtime.dashboard["tracked_topic"]["articles"])
    return runtime


def build_topic_tracking(runtime: PipelineRuntime, cluster_id: int) -> dict:
    cluster_record = next(
        (cluster for cluster in runtime.dashboard.get("clusters", []) if cluster["id"] == cluster_id),
        None,
    )
    if cluster_record is None:
        return {
            "cluster_id": cluster_id,
            "label": "未找到主题",
            "topic_name": "未找到主题",
            "topic_keyword": "未命名主题",
            "keywords": [],
            "raw_keywords": [],
            "articles": [],
            "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
            "timeline": [],
            "dominant_sentiment": "neutral",
            "dominant_sentiment_label": _sentiment_label("neutral"),
            "sources": [],
        }

    documents = [article["document"] for article in runtime.followup_articles]
    if not documents:
        return {
            "cluster_id": cluster_id,
            "label": cluster_record["label"],
            "topic_name": cluster_record["topic_name"],
            "topic_keyword": cluster_record["topic_keyword"],
            "keywords": cluster_record["keywords"],
            "raw_keywords": cluster_record["raw_keywords"],
            "articles": [],
            "sentiment_distribution": {"positive": 0, "neutral": 0, "negative": 0},
            "timeline": [],
            "dominant_sentiment": "neutral",
            "dominant_sentiment_label": _sentiment_label("neutral"),
            "sources": [],
        }

    followup_matrix = runtime.vectorizer.transform(documents)
    centroid = runtime.kmeans.cluster_centers_[cluster_id].reshape(1, -1)
    similarity_scores = cosine_similarity(followup_matrix, centroid).ravel()

    ranked_articles = []
    for article, score in zip(runtime.followup_articles, similarity_scores):
        overlap_score = _keyword_overlap_ratio(article, cluster_record["raw_keywords"])
        blended_score = (0.8 * float(score)) + (0.2 * overlap_score)
        ranked_articles.append(
            {
                "id": article["id"],
                "source_id": article["source_id"],
                "title": article["title"],
                "summary": article["summary"],
                "source": article["source"],
                "source_url": article["source_url"],
                "url": article["url"],
                "published_at": article["published_at"],
                "sentiment": article["sentiment"],
                "relevance": round(blended_score, 3),
                "_relevance_raw": blended_score,
            }
        )

    ranked_articles.sort(
        key=lambda article: (article["_relevance_raw"], article["published_at"]),
        reverse=True,
    )
    threshold = cluster_record.get("matching_threshold", 0.2)
    tracked_articles = [article for article in ranked_articles if article["_relevance_raw"] >= threshold][:8]
    if not tracked_articles:
        tracked_articles = ranked_articles[:8]

    for article in tracked_articles:
        article.pop("_relevance_raw", None)

    distribution = Counter(article["sentiment"]["label"] for article in tracked_articles)
    timeline_map: dict[str, Counter] = defaultdict(Counter)
    for article in tracked_articles:
        timeline_map[article["published_at"]][article["sentiment"]["label"]] += 1

    timeline = [
        {
            "date": date,
            "positive": counts.get("positive", 0),
            "neutral": counts.get("neutral", 0),
            "negative": counts.get("negative", 0),
        }
        for date, counts in sorted(timeline_map.items())
    ]

    dominant_sentiment = "neutral"
    if distribution["positive"] > distribution["negative"]:
        dominant_sentiment = "positive"
    elif distribution["negative"] > distribution["positive"]:
        dominant_sentiment = "negative"

    keyword_text = "、".join(cluster_record["keywords"][:4]) if cluster_record["keywords"] else "暂无关键词"
    return {
        "cluster_id": cluster_id,
        "label": cluster_record["label"],
        "topic_name": cluster_record["topic_name"],
        "topic_keyword": cluster_record["topic_keyword"],
        "keywords": cluster_record["keywords"],
        "raw_keywords": cluster_record["raw_keywords"],
        "theme_statement": f"当前关注主题为“{cluster_record['label']}”，系统会结合簇中心相似度与“{keyword_text}”等关键词持续筛选后续文章。",
        "dominant_sentiment": dominant_sentiment,
        "dominant_sentiment_label": _sentiment_label(dominant_sentiment),
        "sentiment_distribution": {
            "positive": distribution.get("positive", 0),
            "neutral": distribution.get("neutral", 0),
            "negative": distribution.get("negative", 0),
        },
        "timeline": timeline,
        "sources": _build_source_examples(tracked_articles),
        "articles": tracked_articles,
    }


def write_dashboard_snapshot(state: dict) -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    (GENERATED_DIR / "dashboard.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def create_state_payload(runtime: PipelineRuntime, tracked_cluster_id: int | None = None) -> dict:
    tracked_cluster_id = (
        runtime.dashboard["tracked_topic"]["cluster_id"]
        if tracked_cluster_id is None
        else tracked_cluster_id
    )
    payload = dict(runtime.dashboard)
    payload["tracked_topic"] = build_topic_tracking(runtime, tracked_cluster_id)
    payload["metrics"] = dict(payload["metrics"])
    payload["metrics"]["tracked_article_count"] = len(payload["tracked_topic"]["articles"])
    return payload


if __name__ == "__main__":
    runtime = build_dashboard(PipelineConfig(source_mode="demo", cluster_count=8))
    state = create_state_payload(runtime)
    write_dashboard_snapshot(state)
    print(json.dumps(state["metrics"], ensure_ascii=False, indent=2))
