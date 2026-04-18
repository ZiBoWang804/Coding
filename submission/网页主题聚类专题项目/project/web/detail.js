const sentimentLabels = {
  positive: "正面",
  neutral: "中性",
  negative: "负面",
};

let revealObserver = null;
let revealFlushTimer = null;
const tiltSelectors = [
  ".detail-stat",
  ".detail-list-item",
  ".detail-action",
  ".panel.detail-section",
  ".panel.detail-hero",
];

function requestJSON(url, options = {}) {
  return fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `请求失败：${response.status}`);
    }
    return response.json();
  });
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function createLink(href, text, className, external = false) {
  const link = createElement("a", className, text);
  link.href = href;
  if (external) {
    link.target = "_blank";
    link.rel = "noreferrer noopener";
  }
  return link;
}

function createChip(text, extraClass = "") {
  return createElement("span", `chip ${extraClass}`.trim(), text);
}

function formatDate(value) {
  if (!value) {
    return "未标注日期";
  }
  return value.replaceAll("-", ".");
}

function sentimentLabel(value) {
  return sentimentLabels[value] ?? "中性";
}

function normalizeKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function buildArticleHref(articleId) {
  return `/article.html?id=${encodeURIComponent(articleId)}`;
}

function buildTopicHref(clusterId) {
  return `/topic.html?cluster=${encodeURIComponent(clusterId)}`;
}

function buildSourceHref(sourceId) {
  return `/source.html?source=${encodeURIComponent(sourceId)}`;
}

function appendAction(container, label, href, primary = false, external = true) {
  if (!href) {
    return;
  }
  container.appendChild(
    createLink(href, label, `detail-action${primary ? " primary" : ""}`, external),
  );
}

function appendStat(container, value, label) {
  const card = createElement("div", "detail-stat");
  card.appendChild(createElement("div", "detail-stat-value", value));
  card.appendChild(createElement("div", "detail-stat-label", label));
  container.appendChild(card);
}

function renderEmpty(container, message) {
  container.innerHTML = "";
  container.appendChild(createElement("div", "detail-empty", message));
}

function registerRevealNode(node, index = 0) {
  if (!node || node.dataset.revealBound === "true") {
    return;
  }

  node.dataset.revealBound = "true";
  node.style.setProperty("--reveal-delay", `${Math.min(index * 90, 420)}ms`);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    node.classList.add("is-visible");
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, {
      threshold: 0.12,
      rootMargin: "0px 0px -8% 0px",
    });
  }

  revealObserver.observe(node);
}

function syncRevealNodes(root = document) {
  root.querySelectorAll(".reveal").forEach((node, index) => {
    registerRevealNode(node, index);
  });

  if (revealFlushTimer !== null) {
    window.clearTimeout(revealFlushTimer);
  }

  revealFlushTimer = window.setTimeout(() => {
    document.querySelectorAll(".reveal").forEach((node) => {
      node.classList.add("is-visible");
    });
  }, 920);
}

function registerTiltSurface(node) {
  if (!node || node.dataset.tiltReady === "true") {
    return;
  }

  node.dataset.tiltReady = "true";
  node.classList.add("tilt-surface");
  node.style.setProperty("--tilt-rotate-x", "0deg");
  node.style.setProperty("--tilt-rotate-y", "0deg");

  node.addEventListener("pointermove", (event) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const offsetX = (event.clientX - rect.left) / rect.width - 0.5;
    const offsetY = (event.clientY - rect.top) / rect.height - 0.5;
    node.style.setProperty("--tilt-rotate-y", `${offsetX * 10}deg`);
    node.style.setProperty("--tilt-rotate-x", `${offsetY * -10}deg`);
    node.style.setProperty("--tilt-glow-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    node.style.setProperty("--tilt-glow-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  });

  ["pointerleave", "pointercancel"].forEach((eventName) => {
    node.addEventListener(eventName, () => {
      node.style.setProperty("--tilt-rotate-x", "0deg");
      node.style.setProperty("--tilt-rotate-y", "0deg");
      node.style.setProperty("--tilt-glow-x", "50%");
      node.style.setProperty("--tilt-glow-y", "50%");
    });
  });
}

function hydrateInteractiveSurfaces(root = document) {
  root.querySelectorAll(tiltSelectors.join(",")).forEach((node) => {
    registerTiltSurface(node);
  });
}

function clusterLookup(state) {
  return new Map((state.clusters ?? []).map((cluster) => [cluster.id, cluster]));
}

function findCluster(state, clusterId) {
  const normalizedId = Number(clusterId);
  if (Number.isNaN(normalizedId)) {
    return null;
  }
  return clusterLookup(state).get(normalizedId) ?? null;
}

function collectAllArticles(state) {
  const articleMap = new Map();
  const clusters = clusterLookup(state);
  const tracked = state.tracked_topic ?? {};

  function upsert(rawArticle, extra = {}) {
    if (!rawArticle || !rawArticle.id) {
      return;
    }
    const existing = articleMap.get(rawArticle.id) ?? {};
    const merged = {
      ...existing,
      ...rawArticle,
      ...extra,
    };
    merged.source_id = merged.source_id ?? normalizeKey(merged.source);
    merged.source_url = merged.source_url ?? "";
    merged.url = merged.url ?? "";
    merged.cluster_label = merged.cluster_label ?? "";
    merged.cluster_keywords = merged.cluster_keywords ?? [];
    merged.sentiment = merged.sentiment ?? { label: "neutral", score: 0 };
    merged.relevance = merged.relevance ?? null;
    merged.is_tracked = merged.is_tracked ?? false;
    articleMap.set(rawArticle.id, merged);
  }

  (state.articles ?? []).forEach((article) => {
    const cluster = clusters.get(article.cluster_id);
    upsert(article, {
      cluster_label: cluster?.label ?? "",
      cluster_keywords: cluster?.keywords ?? [],
      cluster_id: article.cluster_id,
      is_tracked: false,
    });
  });

  (tracked.articles ?? []).forEach((article) => {
    upsert(article, {
      cluster_id: tracked.cluster_id,
      cluster_label: tracked.label ?? "",
      cluster_keywords: tracked.keywords ?? [],
      is_tracked: true,
    });
  });

  return [...articleMap.values()];
}

function findArticle(state, articleId) {
  return collectAllArticles(state).find((article) => article.id === articleId) ?? null;
}

function findArticlesBySource(state, sourceId) {
  const normalizedSourceId = normalizeKey(sourceId);
  return collectAllArticles(state).filter((article) => (
    normalizeKey(article.source_id) === normalizedSourceId
    || normalizeKey(article.source) === normalizedSourceId
  ));
}

function sortArticles(articles) {
  return [...articles].sort((left, right) => {
    if (left.published_at !== right.published_at) {
      return String(right.published_at).localeCompare(String(left.published_at));
    }
    return (right.relevance ?? right.cluster_relevance ?? 0) - (left.relevance ?? left.cluster_relevance ?? 0);
  });
}

function renderArticlePage(state, articleId) {
  const article = findArticle(state, articleId);
  if (!article) {
    document.title = "文章详情 - 未找到";
    document.querySelector("#detailTitle").textContent = "没有找到这篇文章";
    document.querySelector("#detailLead").textContent = "可能是参数错误，或者当前数据刷新后该文章已不在结果集中。";
    renderEmpty(document.querySelector("#articleContext"), "请返回总览页重新选择文章。");
    renderEmpty(document.querySelector("#relatedArticles"), "暂无可以展示的相关内容。");
    return;
  }

  document.title = `${article.title} - 文章详情`;

  const detailTitle = document.querySelector("#detailTitle");
  const detailLead = document.querySelector("#detailLead");
  const detailMeta = document.querySelector("#detailMeta");
  const detailActions = document.querySelector("#detailActions");
  const summary = document.querySelector("#articleSummary");
  const keywords = document.querySelector("#articleKeywords");
  const context = document.querySelector("#articleContext");
  const relatedMeta = document.querySelector("#relatedMeta");
  const relatedArticles = document.querySelector("#relatedArticles");

  detailTitle.textContent = article.title;
  detailLead.textContent = article.summary || "当前数据集中没有更长的正文，以下展示系统抓取到的摘要与主题上下文。";

  detailMeta.innerHTML = "";
  detailMeta.appendChild(createLink(buildSourceHref(article.source_id), article.source, "chip chip-link soft"));
  detailMeta.appendChild(createChip(formatDate(article.published_at)));
  detailMeta.appendChild(createChip(sentimentLabel(article.sentiment.label), `sentiment-pill ${article.sentiment.label}`));
  if (article.cluster_label) {
    detailMeta.appendChild(createLink(buildTopicHref(article.cluster_id), article.cluster_label, "chip chip-link highlight"));
  }
  if (article.is_tracked) {
    detailMeta.appendChild(createChip("当前关注主题中的跟踪文章", "soft"));
  }

  detailActions.innerHTML = "";
  if (article.cluster_id !== undefined && article.cluster_id !== null) {
    appendAction(detailActions, "查看主题页", buildTopicHref(article.cluster_id), false, false);
  }
  appendAction(detailActions, "查看来源页", buildSourceHref(article.source_id), false, false);
  appendAction(detailActions, "打开原网页", article.url, true);
  appendAction(detailActions, "访问来源站点", article.source_url);

  summary.textContent = article.summary || "暂无摘要信息。";
  keywords.innerHTML = "";
  if ((article.cluster_keywords ?? []).length) {
    article.cluster_keywords.forEach((keyword) => {
      keywords.appendChild(createChip(keyword, "highlight"));
    });
  } else {
    keywords.appendChild(createChip("当前文章暂无可展示关键词"));
  }

  context.innerHTML = "";
  appendStat(context, article.cluster_label || "未匹配聚类", "所属主题");
  appendStat(context, article.source, "来源网站");
  appendStat(context, sentimentLabel(article.sentiment.label), "情感倾向");
  appendStat(
    context,
    article.relevance === null || article.relevance === undefined ? "聚类样本" : String(article.relevance),
    "主题相关度",
  );

  const related = sortArticles(
    findArticlesBySource(state, article.source_id).filter((item) => item.id !== article.id),
  ).slice(0, 8);

  relatedMeta.innerHTML = "";
  relatedMeta.appendChild(createChip(`同来源文章 ${related.length} 篇`));
  if (article.source_url) {
    relatedMeta.appendChild(createLink(article.source_url, "打开该来源站点", "chip chip-link", true));
  }

  relatedArticles.innerHTML = "";
  if (!related.length) {
    renderEmpty(relatedArticles, "该来源当前只有这一篇文章。");
    return;
  }

  related.forEach((item) => {
    const card = createElement("article", "detail-list-item");
    const meta = createElement("div", "detail-inline");
    meta.appendChild(createChip(formatDate(item.published_at)));
    meta.appendChild(createChip(sentimentLabel(item.sentiment.label), `sentiment-pill ${item.sentiment.label}`));
    if (item.cluster_label) {
      meta.appendChild(createLink(buildTopicHref(item.cluster_id), item.cluster_label, "chip chip-link"));
    }

    card.appendChild(meta);
    card.appendChild(createLink(buildArticleHref(item.id), item.title, "detail-anchor"));
    card.appendChild(createElement("p", "detail-caption", item.summary || "暂无摘要信息。"));
    relatedArticles.appendChild(card);
  });

  hydrateInteractiveSurfaces();
  syncRevealNodes();
}

function renderSourcePage(state, sourceId) {
  const articles = sortArticles(findArticlesBySource(state, sourceId));
  const detailTitle = document.querySelector("#detailTitle");
  const detailLead = document.querySelector("#detailLead");
  const detailMeta = document.querySelector("#detailMeta");
  const detailActions = document.querySelector("#detailActions");
  const sourceStats = document.querySelector("#sourceStats");
  const sourceThemes = document.querySelector("#sourceThemes");
  const sourceMeta = document.querySelector("#sourceMeta");
  const sourceArticles = document.querySelector("#sourceArticles");

  if (!articles.length) {
    document.title = "来源详情 - 未找到";
    detailTitle.textContent = "没有找到这个来源站点";
    detailLead.textContent = "可能是来源编号已经变化，建议返回总览页重新点击来源标签进入。";
    renderEmpty(sourceStats, "当前没有可用的来源统计信息。");
    renderEmpty(sourceArticles, "当前没有可展示的来源文章。");
    return;
  }

  const sourceName = articles[0].source;
  const sourceUrl = articles.find((article) => article.source_url)?.source_url ?? "";
  const uniqueThemes = new Map();
  const sentimentCount = { positive: 0, neutral: 0, negative: 0 };

  articles.forEach((article) => {
    sentimentCount[article.sentiment.label] += 1;
    if (article.cluster_label) {
      uniqueThemes.set(article.cluster_label, article.cluster_keywords ?? []);
    }
  });

  const dominantSentiment = ["positive", "neutral", "negative"].sort(
    (left, right) => sentimentCount[right] - sentimentCount[left],
  )[0];

  document.title = `${sourceName} - 来源详情`;
  detailTitle.textContent = sourceName;
  detailLead.textContent = `该来源目前被系统收录 ${articles.length} 篇文章，覆盖 ${uniqueThemes.size || 1} 个主题方向，近期整体情感以“${sentimentLabel(dominantSentiment)}”为主。`;

  detailMeta.innerHTML = "";
  detailMeta.appendChild(createChip(`文章数 ${articles.length}`));
  detailMeta.appendChild(createChip(`主题覆盖 ${uniqueThemes.size || 1}`));
  detailMeta.appendChild(createChip(`最近更新 ${formatDate(articles[0].published_at)}`));

  detailActions.innerHTML = "";
  appendAction(detailActions, "打开来源网站", sourceUrl, true);

  sourceStats.innerHTML = "";
  appendStat(sourceStats, String(articles.length), "收录文章");
  appendStat(sourceStats, String(uniqueThemes.size || 1), "覆盖主题");
  appendStat(sourceStats, String(sentimentCount.positive), "正面文章");
  appendStat(sourceStats, String(sentimentCount.negative), "负面文章");

  sourceThemes.innerHTML = "";
  if (!uniqueThemes.size) {
    sourceThemes.appendChild(createChip("当前没有可展示的主题覆盖"));
  } else {
    uniqueThemes.forEach((keywords, theme) => {
      const themeCluster = (state.clusters ?? []).find((cluster) => cluster.label === theme);
      if (themeCluster) {
        sourceThemes.appendChild(createLink(buildTopicHref(themeCluster.id), theme, "chip chip-link highlight"));
      } else {
        sourceThemes.appendChild(createChip(theme, "highlight"));
      }
      (keywords ?? []).slice(0, 2).forEach((keyword) => {
        sourceThemes.appendChild(createChip(keyword, "soft"));
      });
    });
  }

  sourceMeta.innerHTML = "";
  sourceMeta.appendChild(createChip(`正面 ${sentimentCount.positive}`));
  sourceMeta.appendChild(createChip(`中性 ${sentimentCount.neutral}`));
  sourceMeta.appendChild(createChip(`负面 ${sentimentCount.negative}`));

  sourceArticles.innerHTML = "";
  articles.forEach((article) => {
    const card = createElement("article", "detail-list-item");
    const meta = createElement("div", "detail-inline");
    meta.appendChild(createChip(formatDate(article.published_at)));
    meta.appendChild(createChip(sentimentLabel(article.sentiment.label), `sentiment-pill ${article.sentiment.label}`));
    if (article.cluster_label) {
      meta.appendChild(createLink(buildTopicHref(article.cluster_id), article.cluster_label, "chip chip-link"));
    }

    card.appendChild(meta);
    card.appendChild(createLink(buildArticleHref(article.id), article.title, "detail-anchor"));
    card.appendChild(createElement("p", "detail-caption", article.summary || "暂无摘要信息。"));

    const actionRow = createElement("div", "detail-inline");
    actionRow.appendChild(createLink(buildSourceHref(article.source_id), "查看来源页", "chip chip-link soft"));
    if (article.url) {
      actionRow.appendChild(createLink(article.url, "打开原网页", "chip chip-link", true));
    }
    card.appendChild(actionRow);
    sourceArticles.appendChild(card);
  });

  hydrateInteractiveSurfaces();
  syncRevealNodes();
}

function createActionButton(label, primary = false) {
  const button = createElement("button", `detail-action${primary ? " primary" : ""}`, label);
  button.type = "button";
  return button;
}

function renderTopicPage(state, clusterId) {
  const cluster = findCluster(state, clusterId);
  const detailTitle = document.querySelector("#detailTitle");
  const detailLead = document.querySelector("#detailLead");
  const detailMeta = document.querySelector("#detailMeta");
  const detailActions = document.querySelector("#detailActions");
  const topicStats = document.querySelector("#topicStats");
  const topicKeywords = document.querySelector("#topicKeywords");
  const topicSources = document.querySelector("#topicSources");
  const topicArticlesMeta = document.querySelector("#topicArticlesMeta");
  const topicArticles = document.querySelector("#topicArticles");
  const topicFollowupMeta = document.querySelector("#topicFollowupMeta");
  const topicFollowupArticles = document.querySelector("#topicFollowupArticles");

  if (!cluster) {
    document.title = "主题详情 - 未找到";
    detailTitle.textContent = "没有找到这个主题簇";
    detailLead.textContent = "可能是聚类已刷新，或链接中的主题编号已失效。请返回总览页重新选择主题。";
    renderEmpty(topicStats, "当前没有可用的主题统计信息。");
    renderEmpty(topicArticles, "当前没有可展示的主题文章。");
    if (topicFollowupArticles) {
      renderEmpty(topicFollowupArticles, "当前没有可展示的后续跟踪内容。");
    }
    return;
  }

  const isTracked = state.tracked_topic?.cluster_id === cluster.id;
  const trackedTopic = isTracked ? state.tracked_topic : null;
  const clusterArticles = [...(cluster.articles ?? [])].sort((left, right) => (
    (right.cluster_relevance ?? 0) - (left.cluster_relevance ?? 0)
    || String(right.published_at).localeCompare(String(left.published_at))
  ));
  const positiveCount = cluster.sentiment_distribution?.positive ?? 0;
  const neutralCount = cluster.sentiment_distribution?.neutral ?? 0;
  const negativeCount = cluster.sentiment_distribution?.negative ?? 0;

  document.title = `${cluster.label} - 主题详情`;
  detailTitle.textContent = cluster.label;
  detailLead.textContent = cluster.summary;

  detailMeta.innerHTML = "";
  detailMeta.appendChild(createChip(`簇编号 ${cluster.id + 1}`));
  detailMeta.appendChild(createChip(`${cluster.size} 篇聚类网页样本`));
  detailMeta.appendChild(createChip(cluster.mood_label, `sentiment-pill ${cluster.mood}`));
  if (isTracked) {
    detailMeta.appendChild(createChip("当前已设为关注主题", "highlight"));
  }

  detailActions.innerHTML = "";
  const followButton = createActionButton(isTracked ? "当前已关注" : "设为当前关注主题", true);
  followButton.disabled = isTracked;
  if (!isTracked) {
    followButton.addEventListener("click", async () => {
      const previousLabel = followButton.textContent;
      followButton.disabled = true;
      followButton.textContent = "正在设为关注...";
      try {
        await requestJSON("/api/follow", {
          method: "POST",
          body: JSON.stringify({ cluster_id: cluster.id }),
        });
        window.location.reload();
      } catch (error) {
        console.error(error);
        window.alert(`设为关注失败：${error.message}`);
        followButton.disabled = false;
        followButton.textContent = previousLabel;
      }
    });
  }
  detailActions.appendChild(followButton);
  if (cluster.representative_article?.id) {
    appendAction(detailActions, "查看代表文章", buildArticleHref(cluster.representative_article.id), false, false);
  }

  topicStats.innerHTML = "";
  appendStat(topicStats, String(cluster.size), "簇内文章");
  appendStat(topicStats, String(cluster.sources?.length ?? 0), "来源网站");
  appendStat(topicStats, String(positiveCount), "正面文章");
  appendStat(topicStats, String(negativeCount), "负面文章");

  topicKeywords.innerHTML = "";
  if ((cluster.keywords ?? []).length) {
    cluster.keywords.forEach((keyword) => {
      topicKeywords.appendChild(createChip(keyword, "highlight"));
    });
  } else {
    topicKeywords.appendChild(createChip("当前主题暂无关键词"));
  }

  topicSources.innerHTML = "";
  if ((cluster.sources ?? []).length) {
    cluster.sources.forEach((source) => {
      topicSources.appendChild(
        createLink(buildSourceHref(source.id ?? source.name), `${source.name} ${source.count}`, "chip chip-link soft"),
      );
    });
  } else {
    topicSources.appendChild(createChip("当前主题暂无来源网站"));
  }

  topicArticlesMeta.innerHTML = "";
  topicArticlesMeta.appendChild(createChip(`正面 ${positiveCount}`));
  topicArticlesMeta.appendChild(createChip(`中性 ${neutralCount}`));
  topicArticlesMeta.appendChild(createChip(`负面 ${negativeCount}`));

  topicArticles.innerHTML = "";
  if (!clusterArticles.length) {
    renderEmpty(topicArticles, "当前主题暂无可展示的聚类网页样本。");
  } else {
    clusterArticles.forEach((article) => {
      const card = createElement("article", "detail-list-item");
      const meta = createElement("div", "detail-inline");
      meta.appendChild(createChip(formatDate(article.published_at)));
      meta.appendChild(createLink(buildSourceHref(article.source_id), article.source, "chip chip-link soft"));
      meta.appendChild(createChip(sentimentLabel(article.sentiment.label), `sentiment-pill ${article.sentiment.label}`));
      if (article.cluster_relevance !== null && article.cluster_relevance !== undefined) {
        meta.appendChild(createChip(`簇内相关度 ${article.cluster_relevance}`));
      }

      card.appendChild(meta);
      card.appendChild(createLink(buildArticleHref(article.id), article.title, "detail-anchor"));
      card.appendChild(createElement("p", "detail-caption", article.summary || "暂无摘要信息。"));

      const actionRow = createElement("div", "detail-inline");
      actionRow.appendChild(createLink(buildSourceHref(article.source_id), "查看来源页", "chip chip-link soft"));
      if (article.url) {
        actionRow.appendChild(createLink(article.url, "打开原网页", "chip chip-link", true));
      }
      card.appendChild(actionRow);
      topicArticles.appendChild(card);
    });
  }

  topicFollowupMeta.innerHTML = "";
  topicFollowupArticles.innerHTML = "";
  if (!trackedTopic) {
    topicFollowupMeta.appendChild(createChip("先将该主题设为关注，再查看后续跟踪文章"));
    renderEmpty(topicFollowupArticles, "当前主题还未设为关注，因此没有后续跟踪文章。");
    return;
  }

  topicFollowupMeta.appendChild(createChip(`跟踪文章 ${trackedTopic.articles.length} 篇`));
  topicFollowupMeta.appendChild(createChip(`当前主导情感 ${trackedTopic.dominant_sentiment_label}`));

  if (!(trackedTopic.articles ?? []).length) {
    renderEmpty(topicFollowupArticles, "当前主题暂无后续跟踪文章。");
    return;
  }

  trackedTopic.articles.forEach((article) => {
    const card = createElement("article", "detail-list-item");
    const meta = createElement("div", "detail-inline");
    meta.appendChild(createChip(formatDate(article.published_at)));
    meta.appendChild(createLink(buildSourceHref(article.source_id), article.source, "chip chip-link soft"));
    meta.appendChild(createChip(sentimentLabel(article.sentiment.label), `sentiment-pill ${article.sentiment.label}`));
    meta.appendChild(createChip(`主题相关度 ${article.relevance}`));

    card.appendChild(meta);
    card.appendChild(createLink(buildArticleHref(article.id), article.title, "detail-anchor"));
    card.appendChild(createElement("p", "detail-caption", article.summary || "暂无摘要信息。"));

    const actionRow = createElement("div", "detail-inline");
    actionRow.appendChild(createLink(buildSourceHref(article.source_id), "查看来源页", "chip chip-link soft"));
    if (article.url) {
      actionRow.appendChild(createLink(article.url, "打开原网页", "chip chip-link", true));
    }
    card.appendChild(actionRow);
    topicFollowupArticles.appendChild(card);
  });

  hydrateInteractiveSurfaces();
  syncRevealNodes();
}

async function init() {
  try {
    syncRevealNodes();
    const state = await requestJSON("/api/state");
    const page = document.body.dataset.page;
    const params = new URLSearchParams(window.location.search);

    if (page === "article") {
      renderArticlePage(state, params.get("id") ?? "");
      return;
    }

    if (page === "source") {
      renderSourcePage(state, params.get("source") ?? "");
      return;
    }

    if (page === "topic") {
      renderTopicPage(state, params.get("cluster") ?? "");
    }
  } catch (error) {
    console.error(error);
    const title = document.querySelector("#detailTitle");
    const lead = document.querySelector("#detailLead");
    if (title) {
      title.textContent = "页面加载失败";
    }
    if (lead) {
      lead.textContent = error.message;
    }
  }
}

window.addEventListener("DOMContentLoaded", init);
