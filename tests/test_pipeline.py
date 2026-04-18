from __future__ import annotations

import sys
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.demo_data import get_seed_articles  # noqa: E402
from src.live_fetch import fetch_rss_articles  # noqa: E402
from src.pipeline import PipelineConfig, build_dashboard, create_state_payload  # noqa: E402


class PipelineTests(TestCase):
    def test_demo_build_returns_clusters_and_tracked_topic(self) -> None:
        runtime = build_dashboard(PipelineConfig(source_mode="demo", cluster_count=8))
        state = create_state_payload(runtime)
        seed_articles = get_seed_articles()
        expected_source_count = len({article["source_id"] for article in seed_articles})
        best_k = state["metrics"]["best_k"]

        self.assertEqual(state["source_mode_resolved"], "demo")
        self.assertEqual(state["metrics"]["article_count"], len(seed_articles))
        self.assertEqual(state["metrics"]["source_count"], expected_source_count)
        self.assertEqual(state["metrics"]["cluster_count"], best_k)
        self.assertEqual(len(state["clusters"]), best_k)
        self.assertGreaterEqual(best_k, 2)
        self.assertLessEqual(best_k, 8)
        self.assertTrue(state["tracked_topic"]["articles"])
        self.assertTrue(state["tracked_topic"]["keywords"])
        self.assertTrue(state["clusters"][0]["topic_keyword"])
        sample_cluster_article = state["clusters"][0]["articles"][0]
        self.assertIn("cluster_relevance", sample_cluster_article)
        self.assertIn("cluster_relevance_norm", sample_cluster_article)
        self.assertGreaterEqual(sample_cluster_article["cluster_relevance_norm"], 0)
        self.assertLessEqual(sample_cluster_article["cluster_relevance_norm"], 1)
        self.assertEqual(
            state["metrics"]["tracked_article_count"],
            len(state["tracked_topic"]["articles"]),
        )

    def test_auto_mode_falls_back_when_live_fetch_fails(self) -> None:
        with patch("src.pipeline.fetch_rss_articles", side_effect=RuntimeError("network blocked")):
            runtime = build_dashboard(PipelineConfig(source_mode="auto", cluster_count=8))
            state = create_state_payload(runtime)

        self.assertEqual(state["source_mode_resolved"], "demo")
        self.assertIn("自动回退到演示数据", " ".join(state["notes"]))

    def test_followed_topic_distribution_matches_article_count(self) -> None:
        runtime = build_dashboard(PipelineConfig(source_mode="demo", cluster_count=8))
        state = create_state_payload(runtime, tracked_cluster_id=state_cluster_id(runtime))
        distribution = state["tracked_topic"]["sentiment_distribution"]
        total = distribution["positive"] + distribution["neutral"] + distribution["negative"]
        self.assertEqual(total, len(state["tracked_topic"]["articles"]))

    def test_live_fetch_keeps_successful_feeds_when_one_feed_fails(self) -> None:
        xml_payload = b"""
        <rss>
          <channel>
            <item>
              <title>Test article</title>
              <description>Positive growth story</description>
              <link>https://example.com/test-article</link>
              <pubDate>Fri, 17 Apr 2026 10:00:00 GMT</pubDate>
            </item>
          </channel>
        </rss>
        """

        class FakeResponse:
            def __init__(self, content: bytes) -> None:
                self.content = content

            def raise_for_status(self) -> None:
                return None

        def fake_get(url: str, **_: object) -> FakeResponse:
            if "bad-feed" in url:
                raise RuntimeError("network blocked")
            return FakeResponse(xml_payload)

        with patch("src.live_fetch.RSS_FEEDS", {"good": "https://good-feed", "bad": "https://bad-feed"}):
            with patch("src.live_fetch.requests.get", side_effect=fake_get):
                articles = fetch_rss_articles(max_items_per_feed=2)

        self.assertEqual(len(articles), 1)
        self.assertEqual(articles[0]["source_id"], "good")
        self.assertEqual(articles[0]["title"], "Test article")


def state_cluster_id(runtime) -> int:
    state = create_state_payload(runtime)
    return state["clusters"][0]["id"]
