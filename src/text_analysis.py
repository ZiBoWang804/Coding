"""Text utilities, stopwords, and lexicon-based sentiment scoring."""

from __future__ import annotations

import math
import re
from collections import Counter

TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z\-]{2,}")

CUSTOM_STOPWORDS = {
    "analysts",
    "demo",
    "described",
    "wire",
    "officials",
    "operators",
    "provider",
    "providers",
    "project",
    "projects",
    "market",
    "markets",
    "said",
    "says",
    "report",
    "reported",
    "reported",
    "plans",
    "plan",
    "team",
    "teams",
    "new",
    "could",
    "remain",
    "across",
    "after",
    "before",
    "during",
    "fresh",
    "regional",
    "domestic",
    "stable",
    "steady",
    "support",
    "improve",
    "reduce",
}

POSITIVE_WORDS = {
    "adoption",
    "beat",
    "beats",
    "boost",
    "boosts",
    "celebrated",
    "confident",
    "creative",
    "dependable",
    "efficient",
    "easing",
    "encouraging",
    "expand",
    "expands",
    "faster",
    "gain",
    "gains",
    "good",
    "grow",
    "growth",
    "healthy",
    "help",
    "improve",
    "improved",
    "improving",
    "important",
    "lower",
    "momentum",
    "optimistic",
    "outperform",
    "positive",
    "promising",
    "rebound",
    "recovery",
    "recover",
    "reduce",
    "reliable",
    "resilient",
    "returned",
    "rally",
    "savings",
    "shine",
    "smooth",
    "strong",
    "stronger",
    "support",
    "supporting",
    "thrilling",
    "upgrade",
    "victory",
    "win",
}

NEGATIVE_WORDS = {
    "bottleneck",
    "cautious",
    "concern",
    "crisis",
    "cut",
    "delay",
    "delays",
    "discount",
    "drag",
    "drought",
    "drop",
    "drops",
    "friction",
    "hurt",
    "inflation",
    "injury",
    "loss",
    "lost",
    "miss",
    "misses",
    "out",
    "pressure",
    "risk",
    "serious",
    "selloff",
    "shortage",
    "shortfall",
    "slow",
    "slower",
    "slump",
    "setback",
    "soft",
    "strain",
    "tense",
    "threaten",
    "tumble",
    "uncertain",
    "uncertainty",
    "volatile",
    "volatility",
    "warned",
    "weak",
}

SOURCE_HINTS = {
    "compute frontier": "ai chip server data center cloud inference compute",
    "ai systems weekly": "ai chip server data center cloud inference compute",
    "silicon dispatch": "ai chip server data center cloud inference compute packaging accelerator",
    "openai watch": "ai model reasoning agent benchmark developer safety inference deployment",
    "model wire": "ai model gpu benchmark inference datacenter deployment chips multimodal",
    "infra radar": "ai chip server data center cloud inference compute packaging accelerator",
    "算力前沿网": "ai chip server data center cloud inference compute",
    "智算周报": "ai chip server data center cloud inference compute",
    "芯片产业快讯": "ai chip server data center cloud inference compute packaging accelerator",
    "ev insight": "electric vehicle battery charging fleet transport lithium",
    "charge network daily": "electric vehicle battery charging fleet transport lithium",
    "mobility journal": "electric vehicle battery charging fleet transport lithium mobility diagnostics",
    "电驱观察": "electric vehicle battery charging fleet transport lithium",
    "充电产业网": "electric vehicle battery charging fleet transport lithium",
    "智能出行观察": "electric vehicle battery charging fleet transport lithium mobility diagnostics",
    "pitch report": "football league match coach stadium tournament striker",
    "stadium wire": "football league match coach stadium tournament striker",
    "fan route review": "football league match coach stadium tournament striker fan venue ticketing",
    "hupu nba": "basketball nba playoff injury comeback victory defeat guard center forward rotation",
    "nba official": "basketball nba playoff injury comeback victory defeat guard center forward rotation",
    "球场观察": "football league match coach stadium tournament striker",
    "场馆脉冲": "football league match coach stadium tournament striker",
    "赛事商业内参": "football league match coach stadium tournament striker fan venue ticketing",
    "climate desk": "renewable energy climate solar wind grid storage resilience",
    "grid watch": "renewable energy climate solar wind grid storage resilience",
    "power market brief": "renewable energy climate solar wind grid storage resilience transmission demand-response",
    "气候瞭望": "renewable energy climate solar wind grid storage resilience",
    "电网观察": "renewable energy climate solar wind grid storage resilience",
    "电力市场通": "renewable energy climate solar wind grid storage resilience transmission demand-response",
    "cyber brief": "cybersecurity zero trust phishing ransomware breach disclosure identity",
    "security post": "cybersecurity zero trust phishing ransomware breach disclosure identity",
    "threat monitor": "cybersecurity zero trust phishing ransomware breach disclosure identity passkey supplier",
    "安全内参": "cybersecurity zero trust phishing ransomware breach disclosure identity",
    "网安邮报": "cybersecurity zero trust phishing ransomware breach disclosure identity",
    "威胁监测站": "cybersecurity zero trust phishing ransomware breach disclosure identity passkey supplier",
    "health next": "healthcare biotech imaging hospital vaccine sensor telehealth",
    "bio innovation daily": "healthcare biotech imaging hospital vaccine sensor telehealth",
    "med device review": "healthcare biotech imaging hospital vaccine sensor telehealth surgical device remote care",
    "健康科技参考": "healthcare biotech imaging hospital vaccine sensor telehealth",
    "生物创新日报": "healthcare biotech imaging hospital vaccine sensor telehealth",
    "医疗器械观察": "healthcare biotech imaging hospital vaccine sensor telehealth surgical device remote care",
    "capital pulse": "finance fintech payment settlement credit compliance banking tokenized",
    "fintech scope": "finance fintech payment settlement credit compliance banking tokenized",
    "payments wire": "finance fintech payment settlement credit compliance banking tokenized chargeback invoice",
    "market expectations": "stock market earnings guidance shares forecast valuation analyst equity expectations",
    "forex flash": "currency exchange rate dollar yuan euro yen central bank yield forecast hedge",
    "equity sentiment": "stock market earnings guidance shares forecast valuation analyst equity expectations",
    "资本脉冲": "finance fintech payment settlement credit compliance banking tokenized",
    "金融科技视野": "finance fintech payment settlement credit compliance banking tokenized",
    "支付产业线": "finance fintech payment settlement credit compliance banking tokenized chargeback invoice",
    "travel loop": "culture travel tourism museum concert festival scenic creator",
    "culture grid": "culture travel tourism museum concert festival scenic creator",
    "exhibit lab": "culture travel tourism museum concert festival scenic creator exhibition immersive",
    "文旅环线": "culture travel tourism museum concert festival scenic creator",
    "城市文化网": "culture travel tourism museum concert festival scenic creator",
    "展陈体验实验室": "culture travel tourism museum concert festival scenic creator exhibition immersive",
    "bbc 科技": "technology innovation software hardware digital ai chip cloud",
    "bbc 商业": "business market company finance industry investment payment",
    "bbc 科学环境": "science environment climate research energy health",
    "bbc 体育": "sport football match league coach tournament stadium",
    "bbc 健康": "healthcare biotech hospital medicine wearable telehealth",
    "bbc 国际": "world policy trade economy security diplomacy",
    "bbc 文艺": "culture entertainment streaming tourism museum event",
    "bbc 英国": "uk policy business transport society public service",
    "bbc 欧洲": "europe policy trade economy energy diplomacy",
    "bbc 北美": "north america business technology policy finance security",
    "bbc 亚洲": "asia trade technology policy supply chain economy",
}


def tokenize(text: str) -> list[str]:
    return [match.group(0).lower() for match in TOKEN_RE.finditer(text)]


def build_source_hint(source: str) -> str:
    lowered = source.lower()
    for key, hint in SOURCE_HINTS.items():
        if key in lowered:
            return hint
    return lowered


def build_document(article: dict) -> str:
    title = article.get("raw_title", article.get("title", ""))
    summary = article.get("raw_summary", article.get("summary", ""))
    source = article.get("raw_source", article.get("source", ""))
    source_hint = build_source_hint(source)
    return f"{title}. {summary}. {source}. {source_hint}".strip()


def build_stopwords() -> list[str]:
    return sorted(CUSTOM_STOPWORDS)


def analyze_sentiment(text: str) -> dict:
    tokens = tokenize(text)
    counts = Counter(tokens)
    positive_hits = sorted(word for word in counts if word in POSITIVE_WORDS)
    negative_hits = sorted(word for word in counts if word in NEGATIVE_WORDS)
    positive_score = sum(counts[word] for word in positive_hits)
    negative_score = sum(counts[word] for word in negative_hits)
    raw_score = positive_score - negative_score
    normalized_score = raw_score / max(math.sqrt(len(tokens)), 1.0)

    if raw_score >= 1:
        label = "positive"
    elif raw_score <= -1:
        label = "negative"
    else:
        label = "neutral"

    return {
        "label": label,
        "score": round(normalized_score, 3),
        "positive_hits": positive_hits,
        "negative_hits": negative_hits,
    }
