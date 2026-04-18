"""Best-effort RSS collection for live article acquisition."""

from __future__ import annotations

import html
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from email.utils import parsedate_to_datetime

import requests
from bs4 import BeautifulSoup

from .demo_data import RSS_FEEDS, RSS_SOURCE_LABELS

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36"


def clean_description(raw_html: str) -> str:
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    text = soup.get_text(" ", strip=True)
    return html.unescape(text)


def parse_date(raw_date: str) -> str:
    if not raw_date:
        return ""
    try:
        return parsedate_to_datetime(raw_date).date().isoformat()
    except Exception:
        return raw_date


def _fetch_single_feed(topic: str, url: str, max_items_per_feed: int, timeout: int) -> list[dict]:
    response = requests.get(
        url,
        timeout=timeout,
        headers={"User-Agent": USER_AGENT},
    )
    response.raise_for_status()

    root = ET.fromstring(response.content)
    source_url = url.replace("feeds.bbci.co.uk", "www.bbc.com").replace("/rss.xml", "")
    items: list[dict] = []
    for index, item in enumerate(root.findall("./channel/item")[:max_items_per_feed], start=1):
        title = (item.findtext("title") or "").strip()
        if not title:
            continue

        items.append(
            {
                "id": f"live-{topic}-{index:03d}",
                "source_id": topic,
                "title": title,
                "summary": clean_description(item.findtext("description") or ""),
                "source": RSS_SOURCE_LABELS.get(topic, f"BBC {topic.title()}"),
                "url": (item.findtext("link") or "").strip(),
                "source_url": source_url,
                "published_at": parse_date(item.findtext("pubDate") or ""),
            }
        )

    return items


def fetch_rss_articles(max_items_per_feed: int = 8, timeout: int = 8) -> list[dict]:
    articles: list[dict] = []
    seen_titles: set[str] = set()
    feed_results: dict[str, list[dict]] = {}

    max_workers = min(6, len(RSS_FEEDS)) or 1
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(_fetch_single_feed, topic, url, max_items_per_feed, timeout): topic
            for topic, url in RSS_FEEDS.items()
        }

        for future in as_completed(future_map):
            topic = future_map[future]
            try:
                feed_results[topic] = future.result()
            except Exception:
                continue

    for topic in RSS_FEEDS:
        for item in feed_results.get(topic, []):
            normalized_title = item["title"].lower()
            if normalized_title in seen_titles:
                continue
            seen_titles.add(normalized_title)
            item["id"] = f"live-{item['source_id']}-{len(articles) + 1:03d}"
            articles.append(item)

    if not articles:
        raise RuntimeError("No live RSS articles were collected.")

    return articles
