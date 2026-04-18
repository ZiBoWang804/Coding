const clusterPalette = ["#d9ff2f", "#ff5e3d", "#34d6ff", "#ff53cf", "#ffe27a", "#8a7dff", "#7bffb2", "#ff9462"];

const labels = {
  positive: "正面",
  neutral: "中性",
  negative: "负面",
};

const sourceModeSelect = document.querySelector("#sourceMode");
const clusterCountSelect = document.querySelector("#clusterCount");
const rebuildButton = document.querySelector("#rebuildButton");

const stateTargets = {
  headlineStats: document.querySelector("#headlineStats"),
  metricGrid: document.querySelector("#metricGrid"),
  sourceLibrary: document.querySelector("#sourceLibrary"),
  noteList: document.querySelector("#noteList"),
  clusterCards: document.querySelector("#clusterCards"),
  statusMeta: document.querySelector("#statusMeta"),
  trackedTitle: document.querySelector("#trackedTitle"),
  trackedStatement: document.querySelector("#trackedStatement"),
  trackedSources: document.querySelector("#trackedSources"),
  keywordChips: document.querySelector("#keywordChips"),
  sentimentBars: document.querySelector("#sentimentBars"),
  trackedArticles: document.querySelector("#trackedArticles"),
  focusMood: document.querySelector("#focusMood"),
  graphStage: document.querySelector("#graphStage"),
  graphCanvas: document.querySelector("#constellationCanvas"),
  mapSection: document.querySelector("#map-section"),
  graphScaleBadge: document.querySelector("#graphScaleBadge"),
  graphFocusBadge: document.querySelector("#graphFocusBadge"),
  graphFocusCard: document.querySelector("#graphFocusCard"),
  graphFocusKicker: document.querySelector("#graphFocusKicker"),
  graphFocusTitle: document.querySelector("#graphFocusTitle"),
  graphFocusDesc: document.querySelector("#graphFocusDesc"),
  graphFocusMeta: document.querySelector("#graphFocusMeta"),
  graphZoomIn: document.querySelector("#graphZoomIn"),
  graphZoomOut: document.querySelector("#graphZoomOut"),
  graphReset: document.querySelector("#graphReset"),
  constellationViewport: document.querySelector("#constellationViewport"),
  constellationSvg: document.querySelector("#constellationSvg"),
  timelineSvg: document.querySelector("#timelineSvg"),
};

let currentState = null;
const runtimeBridge = window.WebClassificationRuntime;

const graphView = {
  width: 980,
  height: 560,
};

const graphState = {
  scale: 1,
  minScale: 0.82,
  maxScale: 1.72,
  translateX: 0,
  translateY: 0,
  hoveredKey: null,
  selectedKey: null,
  registry: new Map(),
  dragging: false,
  dragPointerId: null,
  dragClientX: 0,
  dragClientY: 0,
  renderQueued: false,
  navigationTimer: null,
  entranceAnimating: false,
  entrancePlayed: false,
  entranceTimer: null,
  focusPanelSignature: "",
  focusBadgeText: "",
  spotlightFrame: 0,
  pendingSpotlightX: null,
  pendingSpotlightY: null,
};

let revealObserver = null;
let graphEntranceObserver = null;
const tiltSelectors = [
  ".hero-stat",
  ".hero-signal-card",
  ".control-note-card",
  ".metric-card",
  ".source-row",
  ".cluster-card",
  ".subpanel",
  ".article-card",
];

async function requestJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `请求失败：${response.status}`);
  }

  return response.json();
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

function createLink(href, text, className) {
  const link = createElement("a", className, text);
  link.href = href;
  return link;
}

function createExternalLink(href, text, className) {
  const link = createLink(href, text, className);
  link.target = "_blank";
  link.rel = "noreferrer noopener";
  return link;
}

function createChip(text, extraClass = "") {
  return createElement("span", `chip ${extraClass}`.trim(), text);
}

function createChipLink(text, href, extraClass = "") {
  return createLink(href, text, `chip chip-link ${extraClass}`.trim());
}

function sentimentLabel(code) {
  return labels[code] ?? "中性";
}

function formatDate(value) {
  if (!value) {
    return "未标注日期";
  }
  return value.replaceAll("-", ".");
}

function buildArticleHref(article) {
  return `/article.html?id=${encodeURIComponent(article.id)}`;
}

function buildTopicHref(cluster) {
  const clusterId = typeof cluster === "object" ? cluster.id : cluster;
  return `/topic.html?cluster=${encodeURIComponent(clusterId)}`;
}

function buildSourceHref(source) {
  const sourceId = source.source_id ?? source.id ?? source.name;
  return `/source.html?source=${encodeURIComponent(sourceId)}`;
}

function buildHeadlineStats(state) {
  const stats = [
    ["文章总量", state.metrics.article_count],
    ["来源站点", state.metrics.source_count],
    ["聚类数量", state.metrics.cluster_count],
    ["跟踪文章", state.metrics.tracked_article_count],
  ];

  stateTargets.headlineStats.innerHTML = "";
  stats.forEach(([label, value], index) => {
    const card = createElement("div", "hero-stat");
    card.dataset.tone = ["lime", "orange", "cyan", "magenta"][index % 4];
    card.appendChild(createElement("div", "hero-stat-value", String(value)));
    card.appendChild(createElement("div", "hero-stat-label", label));
    stateTargets.headlineStats.appendChild(card);
  });
}

function renderMetrics(state) {
  const metrics = [
    ["轮廓系数", state.metrics.silhouette_score ?? "N/A"],
    ["关注簇文章", state.metrics.tracked_article_count],
    ["聚类模式", state.source_mode_resolved_label],
    ["生成时间", state.generated_at.replace("T", " ")],
  ];

  stateTargets.metricGrid.innerHTML = "";
  metrics.forEach(([label, value], index) => {
    const card = createElement("div", "metric-card");
    card.dataset.tone = ["cyan", "orange", "lime", "magenta"][index % 4];
    card.appendChild(createElement("div", "metric-value", String(value)));
    card.appendChild(createElement("div", "metric-label", label));
    stateTargets.metricGrid.appendChild(card);
  });
}

function renderStatusMeta(state) {
  stateTargets.statusMeta.innerHTML = "";
  [
    `请求模式：${state.source_mode_requested_label}`,
    `实际模式：${state.source_mode_resolved_label}`,
    `来源站点：${state.metrics.source_count} 个`,
  ].forEach((text) => {
    stateTargets.statusMeta.appendChild(createElement("span", "status-pill", text));
  });
}

function renderNotes(state) {
  stateTargets.noteList.innerHTML = "";
  if (!state.notes.length) {
    stateTargets.noteList.appendChild(createElement("li", "", "当前没有额外系统提示。"));
    return;
  }

  state.notes.forEach((note) => {
    stateTargets.noteList.appendChild(createElement("li", "", note));
  });
}

function renderSourceLibrary(state) {
  stateTargets.sourceLibrary.innerHTML = "";
  state.source_examples.forEach((item, index) => {
    const row = createLink(buildSourceHref(item), "", "source-row source-row-link");
    row.dataset.tone = ["cyan", "lime", "orange", "magenta"][index % 4];
    row.style.setProperty("--row-index", String(index));
    row.appendChild(
      (() => {
        const left = createElement("div");
        left.appendChild(createElement("div", "source-name", item.name));
        left.appendChild(createElement("div", "source-meta", `样本文章 ${item.count} 篇`));
        return left;
      })(),
    );
    row.appendChild(createElement("span", "source-count", String(item.count)));
    stateTargets.sourceLibrary.appendChild(row);
  });
}

function renderSourceLibrary(state) {
  stateTargets.sourceLibrary.innerHTML = "";
  state.source_examples.forEach((item, index) => {
    const row = createElement("article", "source-row");
    row.dataset.tone = ["cyan", "lime", "orange", "magenta"][index % 4];
    row.style.setProperty("--row-index", String(index));

    const left = createElement("div", "source-row-main");
    left.appendChild(createLink(buildSourceHref(item), item.name, "source-name source-name-link"));
    left.appendChild(createElement("div", "source-meta", `样本文章 ${item.count} 篇`));
    row.appendChild(left);

    const right = createElement("div", "source-row-side");
    right.appendChild(createElement("span", "source-count", String(item.count)));

    const actions = createElement("div", "source-action-row");
    actions.appendChild(createLink(buildSourceHref(item), "来源页", "source-link-button"));
    if (item.url) {
      actions.appendChild(createExternalLink(item.url, "来源网站", "source-link-button external"));
    }
    right.appendChild(actions);
    row.appendChild(right);

    stateTargets.sourceLibrary.appendChild(row);
  });
}

function buildSentimentNode(distribution) {
  const wrapper = createElement("div", "sentiment-row");
  ["positive", "neutral", "negative"].forEach((key) => {
    wrapper.appendChild(
      createChip(`${sentimentLabel(key)} ${distribution[key] ?? 0}`, `sentiment-pill ${key}`),
    );
  });
  return wrapper;
}

function renderClusterCards(state) {
  const template = document.querySelector("#clusterCardTemplate");
  const selectedClusterId = state.tracked_topic.cluster_id;
  stateTargets.clusterCards.innerHTML = "";

  state.clusters.forEach((cluster, index) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".cluster-card");
    const representative = fragment.querySelector(".cluster-representative");
    const topicHref = buildTopicHref(cluster);
    const accent = clusterPalette[index % clusterPalette.length];

    card.style.setProperty("--cluster-accent", accent);
    card.style.setProperty("--cluster-accent-soft", `${accent}20`);
    card.dataset.tone = ["lime", "orange", "cyan", "magenta"][index % 4];

    fragment.querySelector(".cluster-index").textContent = `主题簇 ${index + 1}`;
    fragment.querySelector(".cluster-size").textContent = `${cluster.size} 篇文章 · ${cluster.mood_label}`;
    const titleNode = fragment.querySelector(".cluster-title");
    const titleLink = createLink(topicHref, cluster.label, "inline-link");
    titleNode.textContent = "";
    titleNode.appendChild(titleLink);
    fragment.querySelector(".cluster-summary").textContent = cluster.summary;

    const keywordSlot = fragment.querySelector(".cluster-keywords");
    cluster.keywords.forEach((keyword) => {
      keywordSlot.appendChild(createChip(keyword, "highlight"));
    });

    fragment.querySelector(".cluster-sentiment").replaceWith(
      buildSentimentNode(cluster.sentiment_distribution),
    );

    const sourceSlot = fragment.querySelector(".cluster-sources");
    cluster.sources.slice(0, 4).forEach((source) => {
      sourceSlot.appendChild(createChipLink(`${source.name} ${source.count}`, buildSourceHref(source), "soft"));
    });

    representative.textContent = "代表文章：";
    representative.appendChild(
      createLink(buildArticleHref(cluster.representative_article), cluster.representative_title, "inline-link"),
    );

    const button = fragment.querySelector(".follow-button");
    button.textContent = cluster.id === selectedClusterId ? "当前关注中" : "设为关注主题";
    button.disabled = cluster.id === selectedClusterId;
    button.addEventListener("click", () => followCluster(cluster.id));

    card.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) {
        return;
      }
      window.location.href = topicHref;
    });

    if (cluster.id === selectedClusterId) {
      card.classList.add("active");
    }

    stateTargets.clusterCards.appendChild(fragment);
  });
}

function renderTrackedTopic(state) {
  const tracked = state.tracked_topic;
  stateTargets.trackedTitle.textContent = tracked.label;
  stateTargets.trackedStatement.textContent = tracked.theme_statement;
  stateTargets.focusMood.textContent = `当前主导情感：${tracked.dominant_sentiment_label}`;

  stateTargets.keywordChips.innerHTML = "";
  tracked.keywords.forEach((keyword) => {
    stateTargets.keywordChips.appendChild(createChip(keyword, "highlight"));
  });

  stateTargets.trackedSources.innerHTML = "";
  if (!tracked.sources.length) {
    stateTargets.trackedSources.appendChild(createChip("暂无来源样本"));
  } else {
    tracked.sources.forEach((source) => {
      stateTargets.trackedSources.appendChild(
        createChipLink(`${source.name} ${source.count}`, buildSourceHref(source), "soft"),
      );
    });
  }

  stateTargets.sentimentBars.innerHTML = "";
  [
    ["positive", tracked.sentiment_distribution.positive, "近期报道偏向利好与增长信号"],
    ["neutral", tracked.sentiment_distribution.neutral, "观点更审慎，信息更新为主"],
    ["negative", tracked.sentiment_distribution.negative, "更集中于风险、压力或不确定性"],
  ].forEach(([key, value, description]) => {
    const card = createElement("div", `bar-card ${key}`);
    card.appendChild(createElement("div", "bar-label", sentimentLabel(key)));
    const valueNode = createElement("div", "bar-value", String(value));
    valueNode.style.color = `var(--${key})`;
    card.appendChild(valueNode);
    card.appendChild(createElement("div", "bar-desc", description));
    stateTargets.sentimentBars.appendChild(card);
  });

  stateTargets.trackedArticles.innerHTML = "";
  if (!tracked.articles.length) {
    stateTargets.trackedArticles.appendChild(
      createElement("div", "empty-state", "当前没有可展示的跟踪文章。"),
    );
  } else {
    tracked.articles.forEach((article, index) => {
      const card = createElement("article", "article-card");
      card.dataset.tone = ["orange", "cyan", "lime", "magenta"][index % 4];
      const meta = createElement("div", "article-meta");
      const titleLink = createLink(buildArticleHref(article), article.title, "article-link");

      meta.appendChild(createChipLink(article.source, buildSourceHref(article), "soft"));
      meta.appendChild(createChip(formatDate(article.published_at)));
      meta.appendChild(createChip(sentimentLabel(article.sentiment.label), `sentiment-pill ${article.sentiment.label}`));

      card.appendChild(meta);
      card.appendChild(titleLink);
      card.appendChild(createElement("p", "article-summary", article.summary || "暂无摘要信息。"));
      card.appendChild(createElement("div", "article-score", `主题相关度：${article.relevance}`));

      card.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
          return;
        }
        window.location.href = buildArticleHref(article);
      });

      stateTargets.trackedArticles.appendChild(card);
    });
  }

  renderTimeline(tracked.timeline);
}

function drawSvgNode(parent, name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  parent.appendChild(element);
  return element;
}

function buildClusterEdges(clusters) {
  const edgeMap = new Map();

  clusters.forEach((cluster) => {
    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    clusters.forEach((candidate) => {
      if (candidate.id === cluster.id) {
        return;
      }
      const dx = cluster.centroid.x - candidate.centroid.x;
      const dy = cluster.centroid.y - candidate.centroid.y;
      const distance = Math.hypot(dx, dy);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = candidate;
      }
    });

    if (!nearest) {
      return;
    }

    const key = [cluster.id, nearest.id].sort((a, b) => a - b).join("-");
    if (!edgeMap.has(key)) {
      edgeMap.set(key, [cluster, nearest]);
    }
  });

  return [...edgeMap.values()];
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function focusChip(text, extraClass = "soft") {
  return createChip(text, extraClass);
}

function createGraphKey(type, id) {
  return `${type}:${id}`;
}

function sameGraphKey(left, right) {
  return Boolean(left && right && left === right);
}

function graphPanBounds(scale = graphState.scale) {
  if (scale >= 1) {
    return {
      minX: graphView.width - graphView.width * scale,
      maxX: 0,
      minY: graphView.height - graphView.height * scale,
      maxY: 0,
    };
  }

  const centeredX = (graphView.width - graphView.width * scale) / 2;
  const centeredY = (graphView.height - graphView.height * scale) / 2;
  const slack = 18;

  return {
    minX: centeredX - slack,
    maxX: centeredX + slack,
    minY: centeredY - slack,
    maxY: centeredY + slack,
  };
}

function clampGraphPan(translateX, translateY, scale = graphState.scale) {
  const bounds = graphPanBounds(scale);
  return {
    x: clampNumber(translateX, bounds.minX, bounds.maxX),
    y: clampNumber(translateY, bounds.minY, bounds.maxY),
  };
}

function applyGraphTransform() {
  const viewport = stateTargets.constellationViewport;
  if (viewport) {
    viewport.setAttribute(
      "transform",
      `matrix(${graphState.scale} 0 0 ${graphState.scale} ${graphState.translateX} ${graphState.translateY})`,
    );
  }

  if (stateTargets.graphScaleBadge) {
    stateTargets.graphScaleBadge.textContent = `缩放 ${Math.round(graphState.scale * 100)}%`;
  }
  if (stateTargets.graphScaleBadge) {
    stateTargets.graphScaleBadge.textContent = `\u7f29\u653e ${Math.round(graphState.scale * 100)}%`;
  }
  stateTargets.graphCanvas?.classList.toggle("is-zoomed", graphState.scale > 1.01);

  if (stateTargets.graphZoomIn) {
    stateTargets.graphZoomIn.disabled = graphState.scale >= graphState.maxScale - 0.001;
  }
  if (stateTargets.graphZoomOut) {
    stateTargets.graphZoomOut.disabled = graphState.scale <= graphState.minScale + 0.001;
  }
  if (stateTargets.graphReset) {
    stateTargets.graphReset.disabled = graphState.scale === 1 && graphState.translateX === 0 && graphState.translateY === 0;
  }
}

function markGraphNavigation() {
  if (!stateTargets.graphCanvas) {
    return;
  }

  stateTargets.graphCanvas.classList.add("is-navigating");
  stateTargets.graphStage?.classList.add("is-navigating");
  if (graphState.navigationTimer !== null) {
    window.clearTimeout(graphState.navigationTimer);
  }

  graphState.navigationTimer = window.setTimeout(() => {
    stateTargets.graphCanvas?.classList.remove("is-navigating");
    stateTargets.graphStage?.classList.remove("is-navigating");
    graphState.navigationTimer = null;
  }, 160);
}

function updateGraphTransform() {
  const viewport = stateTargets.constellationViewport;

  if (stateTargets.graphScaleBadge) {
    stateTargets.graphScaleBadge.textContent = `缂╂斁 ${Math.round(graphState.scale * 100)}%`;
  }
  stateTargets.graphCanvas?.classList.toggle("is-zoomed", graphState.scale > 1.01);

  if (stateTargets.graphZoomIn) {
    stateTargets.graphZoomIn.disabled = graphState.scale >= graphState.maxScale - 0.001;
  }
  if (stateTargets.graphZoomOut) {
    stateTargets.graphZoomOut.disabled = graphState.scale <= graphState.minScale + 0.001;
  }
  if (stateTargets.graphReset) {
    stateTargets.graphReset.disabled = graphState.scale === 1 && graphState.translateX === 0 && graphState.translateY === 0;
  }
  if (!viewport) {
    return;
  }

  if (stateTargets.graphScaleBadge) {
    stateTargets.graphScaleBadge.textContent = `\u7f29\u653e ${Math.round(graphState.scale * 100)}%`;
  }

  const writeTransform = () => {
    viewport.setAttribute(
      "transform",
      `matrix(${graphState.renderScale} 0 0 ${graphState.renderScale} ${graphState.renderTranslateX} ${graphState.renderTranslateY})`,
    );
  };

  const snapTransform = () => {
    graphState.renderScale = graphState.scale;
    graphState.renderTranslateX = graphState.translateX;
    graphState.renderTranslateY = graphState.translateY;
    writeTransform();
  };

  if (graphState.dragging) {
    snapTransform();
    if (graphState.transformFrame) {
      window.cancelAnimationFrame(graphState.transformFrame);
      graphState.transformFrame = 0;
    }
    return;
  }

  if (graphState.transformFrame) {
    return;
  }

  const stepTransform = () => {
    graphState.transformFrame = 0;
    const easing = stateTargets.graphCanvas?.classList.contains("is-navigating") ? 0.22 : 0.17;
    graphState.renderScale += (graphState.scale - graphState.renderScale) * easing;
    graphState.renderTranslateX += (graphState.translateX - graphState.renderTranslateX) * easing;
    graphState.renderTranslateY += (graphState.translateY - graphState.renderTranslateY) * easing;

    const settled = Math.abs(graphState.renderScale - graphState.scale) < 0.0015
      && Math.abs(graphState.renderTranslateX - graphState.translateX) < 0.4
      && Math.abs(graphState.renderTranslateY - graphState.translateY) < 0.4;

    if (settled) {
      snapTransform();
      return;
    }

    writeTransform();
    graphState.transformFrame = window.requestAnimationFrame(stepTransform);
  };

  graphState.transformFrame = window.requestAnimationFrame(stepTransform);
}

function updateGraphTransform() {
  applyGraphTransform();
}

function applyGraphTransform() {
  const viewport = stateTargets.constellationViewport;
  if (viewport) {
    viewport.setAttribute(
      "transform",
      `matrix(${graphState.scale} 0 0 ${graphState.scale} ${graphState.translateX} ${graphState.translateY})`,
    );
  }

  if (stateTargets.graphScaleBadge) {
    stateTargets.graphScaleBadge.textContent = `缩放 ${Math.round(graphState.scale * 100)}%`;
  }
  stateTargets.graphCanvas?.classList.toggle("is-zoomed", graphState.scale > 1.01);

  if (stateTargets.graphZoomIn) {
    stateTargets.graphZoomIn.disabled = graphState.scale >= graphState.maxScale - 0.001;
  }
  if (stateTargets.graphZoomOut) {
    stateTargets.graphZoomOut.disabled = graphState.scale <= graphState.minScale + 0.001;
  }
  if (stateTargets.graphReset) {
    stateTargets.graphReset.disabled = graphState.scale === 1 && graphState.translateX === 0 && graphState.translateY === 0;
  }
}

function focusTargetFromRegistry() {
  const key = graphState.hoveredKey ?? graphState.selectedKey;
  return key ? graphState.registry.get(key) ?? null : null;
}

function isClusterGraphKey(key) {
  return typeof key === "string" && key.startsWith("cluster:");
}

function scheduleConstellationRender() {
  if (!currentState || graphState.renderQueued) {
    return;
  }

  graphState.renderQueued = true;
  window.requestAnimationFrame(() => {
    graphState.renderQueued = false;
    renderConstellation(currentState);
  });
}

function setHoveredGraphKey(key) {
  if (graphState.entranceAnimating) {
    return;
  }
  if (sameGraphKey(key, graphState.hoveredKey)) {
    return;
  }

  const previousKey = graphState.hoveredKey;
  graphState.hoveredKey = key;
  updateGraphFocusPanel();
  if (isClusterGraphKey(previousKey) || isClusterGraphKey(key)) {
    scheduleConstellationRender();
  }
}

function clearHoveredGraphKey(key = null) {
  if (graphState.entranceAnimating) {
    return;
  }
  if (!graphState.hoveredKey) {
    return;
  }

  if (key && !sameGraphKey(key, graphState.hoveredKey)) {
    return;
  }

  const previousKey = graphState.hoveredKey;
  graphState.hoveredKey = null;
  updateGraphFocusPanel();
  if (isClusterGraphKey(previousKey)) {
    scheduleConstellationRender();
  }
}

function syncGraphSelection(state) {
  graphState.selectedKey = createGraphKey("cluster", state.tracked_topic.cluster_id);
  graphState.hoveredKey = null;
}

function graphPointFromClient(clientX, clientY) {
  const svg = stateTargets.constellationSvg;
  if (!svg) {
    return {
      x: graphView.width / 2,
      y: graphView.height / 2,
    };
  }

  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return {
      x: graphView.width / 2,
      y: graphView.height / 2,
    };
  }

  return {
    x: ((clientX - rect.left) / rect.width) * graphView.width,
    y: ((clientY - rect.top) / rect.height) * graphView.height,
  };
}

function setGraphScale(nextScale, focusPoint = { x: graphView.width / 2, y: graphView.height / 2 }) {
  let normalizedScale = clampNumber(nextScale, graphState.minScale, graphState.maxScale);
  if (Math.abs(normalizedScale - 1) < 0.02) {
    normalizedScale = 1;
  }

  if (Math.abs(normalizedScale - graphState.scale) < 0.001) {
    return;
  }

  const scaleRatio = normalizedScale / graphState.scale;
  const nextTranslateX = focusPoint.x - (focusPoint.x - graphState.translateX) * scaleRatio;
  const nextTranslateY = focusPoint.y - (focusPoint.y - graphState.translateY) * scaleRatio;

  graphState.scale = normalizedScale;
  const clamped = clampGraphPan(nextTranslateX, nextTranslateY, normalizedScale);
  graphState.translateX = clamped.x;
  graphState.translateY = clamped.y;
  markGraphNavigation();
  updateGraphTransform();
  updateGraphFocusPanel();
}

function resetGraphView() {
  graphState.scale = 1;
  graphState.translateX = 0;
  graphState.translateY = 0;
  markGraphNavigation();
  updateGraphTransform();
  updateGraphFocusPanel();
}

function drawFloatingLabel(parent, options) {
  const text = options.text ?? "";
  if (!text) {
    return null;
  }

  const align = options.align ?? "center";
  const fontSize = options.fontSize ?? 12;
  const maxWidth = options.maxWidth ?? 260;
  const estimatedWidth = clampNumber(Array.from(text).length * (fontSize * 0.95) + 24, 72, maxWidth);
  const labelText = estimatedWidth >= maxWidth
    ? truncateLabel(text, Math.max(8, Math.floor((maxWidth - 24) / (fontSize * 0.95)) - 1))
    : text;
  const labelWidth = clampNumber(Array.from(labelText).length * (fontSize * 0.95) + 24, 72, maxWidth);

  let rectX = options.x - labelWidth / 2;
  if (align === "start") {
    rectX = options.x;
  } else if (align === "end") {
    rectX = options.x - labelWidth;
  }
  rectX = clampNumber(rectX, 12, graphView.width - labelWidth - 12);

  const rectY = clampNumber(options.y - 18, 12, graphView.height - 38);
  const group = drawSvgNode(parent, "g", {
    class: "constellation-label-group",
  });
  drawSvgNode(group, "rect", {
    x: rectX,
    y: rectY,
    width: labelWidth,
    height: 28,
    rx: 14,
    fill: options.fill ?? "rgba(8, 12, 29, 0.88)",
    stroke: options.stroke ?? "rgba(146, 169, 209, 0.2)",
    "stroke-width": 1,
    class: "constellation-label-frame",
  });
  const label = drawSvgNode(group, "text", {
    x: rectX + labelWidth / 2,
    y: rectY + 18,
    "text-anchor": "middle",
    class: "constellation-label",
    fill: options.color ?? "#233245",
  });
  label.style.fontSize = `${fontSize}px`;
  label.textContent = labelText;
  return group;
}

function updateGraphFocusPanel() {
  if (!stateTargets.graphFocusTitle || !stateTargets.graphFocusDesc || !stateTargets.graphFocusMeta) {
    return;
  }

  const focus = focusTargetFromRegistry();
  if (!focus) {
    stateTargets.graphFocusKicker.textContent = "当前焦点";
    stateTargets.graphFocusTitle.textContent = "把鼠标移到主题簇附近";
    stateTargets.graphFocusDesc.textContent = "系统会自动放大邻近的主题簇，并在这里展开完整中文名称、关键词与交互说明。";
    stateTargets.graphFocusMeta.innerHTML = "";
    stateTargets.graphFocusMeta.appendChild(focusChip("点击主题簇进入主题页"));
    stateTargets.graphFocusMeta.appendChild(focusChip("点击文章节点进入文章页", "highlight"));
    stateTargets.graphFocusMeta.appendChild(focusChip("点击来源网站节点进入网站页"));
    if (stateTargets.graphFocusBadge) {
      stateTargets.graphFocusBadge.textContent = graphState.scale === 1
        ? "悬停节点查看完整中文名称"
        : "滚轮缩放，拖动画布浏览细节";
    }
    return;
  }

  stateTargets.graphFocusKicker.textContent = focus.kicker;
  stateTargets.graphFocusTitle.textContent = focus.title;
  stateTargets.graphFocusDesc.textContent = focus.description;
  stateTargets.graphFocusMeta.innerHTML = "";

  focus.meta.forEach((item) => {
    const config = typeof item === "string" ? { label: item } : item;
    const className = config.className ?? "soft";
    const node = config.href
      ? createChipLink(config.label, config.href, className)
      : focusChip(config.label, className);
    stateTargets.graphFocusMeta.appendChild(node);
  });

  if (stateTargets.graphFocusBadge) {
    stateTargets.graphFocusBadge.textContent = focus.badge;
  }
}

function defaultGraphFocusBadgeText() {
  return graphState.scale === 1
    ? "悬停节点查看完整中文名称"
    : "滚轮缩放，拖动画布浏览细节";
}

function buildGraphFocusMetaNodes(items) {
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const config = typeof item === "string" ? { label: item } : item;
    const className = config.className ?? "soft";
    const node = config.href
      ? createChipLink(config.label, config.href, className)
      : focusChip(config.label, className);
    fragment.appendChild(node);
  });
  return fragment;
}

function updateGraphFocusBadge(force = false) {
  if (!stateTargets.graphFocusBadge) {
    return;
  }

  const focus = focusTargetFromRegistry();
  const nextBadgeText = focus?.badge ?? defaultGraphFocusBadgeText();
  if (!force && nextBadgeText === graphState.focusBadgeText) {
    return;
  }

  graphState.focusBadgeText = nextBadgeText;
  stateTargets.graphFocusBadge.textContent = nextBadgeText;
}

function updateGraphFocusPanel({ forceContent = false, forceBadge = false } = {}) {
  if (!stateTargets.graphFocusTitle || !stateTargets.graphFocusDesc || !stateTargets.graphFocusMeta) {
    return;
  }

  const focus = focusTargetFromRegistry();
  const signature = focus ? `focus:${focus.key}` : "focus:idle";

  if (forceContent || signature !== graphState.focusPanelSignature) {
    graphState.focusPanelSignature = signature;

    if (!focus) {
      stateTargets.graphFocusKicker.textContent = "当前焦点";
      stateTargets.graphFocusTitle.textContent = "把鼠标移到主题簇附近";
      stateTargets.graphFocusDesc.textContent = "系统会自动放大邻近的主题簇，并在这里展开完整中文名称、关键词与交互说明。";
      stateTargets.graphFocusMeta.replaceChildren(
        buildGraphFocusMetaNodes([
          "点击主题簇进入主题页",
          { label: "点击文章节点进入文章页", className: "highlight" },
          "点击来源网站节点进入网站页",
        ]),
      );
    } else {
      stateTargets.graphFocusKicker.textContent = focus.kicker;
      stateTargets.graphFocusTitle.textContent = focus.title;
      stateTargets.graphFocusDesc.textContent = focus.description;
      stateTargets.graphFocusMeta.replaceChildren(buildGraphFocusMetaNodes(focus.meta));
    }
  }

  updateGraphFocusBadge(forceBadge);
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
  if (!("IntersectionObserver" in window)) {
    root.querySelectorAll(".reveal").forEach((node) => {
      node.classList.add("is-visible");
    });
    return;
  }

  root.querySelectorAll(".reveal").forEach((node, index) => {
    registerRevealNode(node, index);
  });
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

function attachGraphHoverHandlers(element, key, onActivate, options = {}) {
  if (!element) {
    return;
  }

  element.setAttribute("tabindex", "0");
  element.setAttribute("role", options.role ?? "button");
  if (options.label) {
    element.setAttribute("aria-label", options.label);
  }
  element.style.cursor = "pointer";

  element.addEventListener("pointerenter", () => setHoveredGraphKey(key));
  element.addEventListener("pointerleave", () => clearHoveredGraphKey(key));
  element.addEventListener("focus", () => setHoveredGraphKey(key));
  element.addEventListener("blur", () => clearHoveredGraphKey(key));
  element.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate();
  });
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    onActivate();
  });
}

function updateGraphSpotlight(clientX = null, clientY = null) {
  if (!stateTargets.graphStage) {
    return;
  }

  if (clientX === null || clientY === null) {
    stateTargets.graphStage.style.setProperty("--spotlight-x", "52%");
    stateTargets.graphStage.style.setProperty("--spotlight-y", "38%");
    return;
  }

  const rect = stateTargets.graphStage.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const x = clampNumber(((clientX - rect.left) / rect.width) * 100, 6, 94);
  const y = clampNumber(((clientY - rect.top) / rect.height) * 100, 8, 92);
  stateTargets.graphStage.style.setProperty("--spotlight-x", `${x}%`);
  stateTargets.graphStage.style.setProperty("--spotlight-y", `${y}%`);
}

function queueGraphSpotlight(clientX = null, clientY = null) {
  graphState.pendingSpotlightX = clientX;
  graphState.pendingSpotlightY = clientY;

  if (graphState.spotlightFrame) {
    return;
  }

  graphState.spotlightFrame = window.requestAnimationFrame(() => {
    graphState.spotlightFrame = 0;
    updateGraphSpotlight(graphState.pendingSpotlightX, graphState.pendingSpotlightY);
  });
}

function setupGraphInteractions() {
  if (!stateTargets.graphCanvas || stateTargets.graphCanvas.dataset.ready === "true") {
    return;
  }

  stateTargets.graphCanvas.dataset.ready = "true";

  stateTargets.graphZoomIn?.addEventListener("click", () => {
    setGraphScale(graphState.scale * 1.12);
  });

  stateTargets.graphZoomOut?.addEventListener("click", () => {
    setGraphScale(graphState.scale / 1.12);
  });

  stateTargets.graphReset?.addEventListener("click", () => {
    resetGraphView();
  });

  stateTargets.graphCanvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const focusPoint = graphPointFromClient(event.clientX, event.clientY);
    const wheelDelta = clampNumber(event.deltaY, -140, 140);
    const zoomFactor = Math.exp(-wheelDelta * 0.00115);
    setGraphScale(graphState.scale * zoomFactor, focusPoint);
    queueGraphSpotlight(event.clientX, event.clientY);
  }, { passive: false });

  stateTargets.graphCanvas.addEventListener("dblclick", () => {
    resetGraphView();
  });

  stateTargets.graphCanvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || graphState.scale <= 1.01) {
      return;
    }

    graphState.dragging = true;
    graphState.dragPointerId = event.pointerId;
    graphState.dragClientX = event.clientX;
    graphState.dragClientY = event.clientY;
    stateTargets.graphCanvas.classList.add("is-dragging");
    stateTargets.graphCanvas.setPointerCapture?.(event.pointerId);
    markGraphNavigation();
    event.preventDefault();
  });

  window.addEventListener("pointermove", (event) => {
    if (!graphState.dragging || !stateTargets.constellationSvg) {
      queueGraphSpotlight(event.clientX, event.clientY);
      return;
    }

    const rect = stateTargets.constellationSvg.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const deltaX = ((event.clientX - graphState.dragClientX) / rect.width) * graphView.width;
    const deltaY = ((event.clientY - graphState.dragClientY) / rect.height) * graphView.height;
    const clamped = clampGraphPan(
      graphState.translateX + deltaX,
      graphState.translateY + deltaY,
    );

    graphState.translateX = clamped.x;
    graphState.translateY = clamped.y;
    graphState.dragClientX = event.clientX;
    graphState.dragClientY = event.clientY;
    markGraphNavigation();
    updateGraphTransform();
  });

  window.addEventListener("pointerup", (event) => {
    if (!graphState.dragging) {
      return;
    }

    graphState.dragging = false;
    stateTargets.graphCanvas.classList.remove("is-dragging");
    if (graphState.dragPointerId !== null) {
      stateTargets.graphCanvas.releasePointerCapture?.(graphState.dragPointerId);
    }
    graphState.dragPointerId = null;
    queueGraphSpotlight(event.clientX, event.clientY);
  });

  window.addEventListener("pointercancel", () => {
    if (!graphState.dragging) {
      return;
    }

    graphState.dragging = false;
    graphState.dragPointerId = null;
    stateTargets.graphCanvas.classList.remove("is-dragging");
    queueGraphSpotlight();
  });

  stateTargets.graphStage?.addEventListener("pointerleave", () => {
    if (!graphState.dragging) {
      queueGraphSpotlight();
    }
  });

  updateGraphTransform();
  updateGraphFocusPanel();
}

function appendSvgTitle(parent, text) {
  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  title.textContent = text;
  parent.appendChild(title);
}

function colorForCluster(clusterId) {
  return clusterPalette[clusterId % clusterPalette.length];
}

function drawCurvedLink(parent, start, end, options = {}) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy) || 1;
  const normalX = -dy / distance;
  const normalY = dx / distance;
  const curvature = options.curvature ?? 0;
  const controlX = (start.x + end.x) / 2 + normalX * curvature;
  const controlY = (start.y + end.y) / 2 + normalY * curvature;
  const attributes = {
    d: `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`,
    fill: "none",
    stroke: options.stroke ?? "rgba(109, 139, 185, 0.24)",
    "stroke-width": options.width ?? 1,
    "stroke-opacity": options.opacity ?? 1,
    "stroke-linecap": "round",
  };

  if (options.dasharray) {
    attributes["stroke-dasharray"] = options.dasharray;
  }

  if (options.className) {
    attributes.class = options.className;
  }

  return drawSvgNode(parent, "path", attributes);
}

function truncateLabel(text, maxLength = 12) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}…`;
}

function buildClusterAnchors(state) {
  const anchorMap = new Map();

  if (!state?.clusters?.length) {
    return anchorMap;
  }

  const width = graphView.width;
  const height = graphView.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const horizontalPadding = 186;
  const verticalPadding = 118;
  const layoutRadiusX = width / 2 - horizontalPadding;
  const layoutRadiusY = height / 2 - verticalPadding;
  const safeMinX = 176;
  const safeMaxX = width - safeMinX;
  const safeMinY = 110;
  const safeMaxY = height - safeMinY;
  const minCenterDistance = 118;

  const centroidXs = state.clusters.map((cluster) => cluster.centroid?.x ?? 0);
  const centroidYs = state.clusters.map((cluster) => cluster.centroid?.y ?? 0);
  const minX = Math.min(...centroidXs);
  const maxX = Math.max(...centroidXs);
  const minY = Math.min(...centroidYs);
  const maxY = Math.max(...centroidYs);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const total = Math.max(1, state.clusters.length);

  const anchors = state.clusters.map((cluster, index) => {
    const fallbackAngle = (index / total) * Math.PI * 2 - Math.PI / 2;
    const normalizedX = spanX > 0.0001
      ? ((cluster.centroid.x - minX) / spanX) * 2 - 1
      : Math.cos(fallbackAngle) * 0.22;
    const normalizedY = spanY > 0.0001
      ? ((cluster.centroid.y - minY) / spanY) * 2 - 1
      : Math.sin(fallbackAngle) * 0.22;
    const emphasis = 0.9 + clampNumber(Math.sqrt(cluster.size ?? 1) * 0.035, 0.04, 0.18);
    let x = centerX + normalizedX * layoutRadiusX * emphasis;
    let y = centerY + normalizedY * layoutRadiusY * emphasis;
    const radialFloor = minCenterDistance + clampNumber(Math.sqrt(cluster.size ?? 1) * 8, 0, 26);
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.hypot(dx, dy) || 1;

    if (distance < radialFloor) {
      const scale = radialFloor / distance;
      x = centerX + dx * scale;
      y = centerY + dy * scale;
    }

    return {
      id: cluster.id,
      size: cluster.size ?? 1,
      baseX: clampNumber(x, safeMinX, safeMaxX),
      baseY: clampNumber(y, safeMinY, safeMaxY),
      x: clampNumber(x, safeMinX, safeMaxX),
      y: clampNumber(y, safeMinY, safeMaxY),
    };
  });

  for (let iteration = 0; iteration < 28; iteration += 1) {
    for (let index = 0; index < anchors.length; index += 1) {
      for (let candidateIndex = index + 1; candidateIndex < anchors.length; candidateIndex += 1) {
        const left = anchors[index];
        const right = anchors[candidateIndex];
        let dx = right.x - left.x;
        let dy = right.y - left.y;
        let distance = Math.hypot(dx, dy);

        if (distance < 0.001) {
          const angle = ((index + candidateIndex + 1) / total) * Math.PI * 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const minSpacing = 146 + clampNumber(Math.sqrt(left.size + right.size) * 3.8, 0, 28);
        if (distance >= minSpacing) {
          continue;
        }

        const overlap = (minSpacing - distance) / 2;
        const pushX = (dx / distance) * overlap;
        const pushY = (dy / distance) * overlap;
        left.x -= pushX;
        left.y -= pushY;
        right.x += pushX;
        right.y += pushY;
      }
    }

    anchors.forEach((anchor) => {
      anchor.x = anchor.x * 0.84 + anchor.baseX * 0.16;
      anchor.y = anchor.y * 0.84 + anchor.baseY * 0.16;

      const dx = anchor.x - centerX;
      const dy = anchor.y - centerY;
      const distance = Math.hypot(dx, dy) || 1;
      const radialFloor = minCenterDistance + clampNumber(Math.sqrt(anchor.size) * 8, 0, 26);

      if (distance < radialFloor) {
        const scale = radialFloor / distance;
        anchor.x = centerX + dx * scale;
        anchor.y = centerY + dy * scale;
      }

      anchor.x = clampNumber(anchor.x, safeMinX, safeMaxX);
      anchor.y = clampNumber(anchor.y, safeMinY, safeMaxY);
    });
  }

  anchors.forEach((anchor) => {
    anchorMap.set(anchor.id, {
      x: Math.round(anchor.x * 10) / 10,
      y: Math.round(anchor.y * 10) / 10,
    });
  });

  return anchorMap;
}

function buildSourceNodes(state, selectedClusterId) {
  const sourceMap = new Map();

  state.clusters.forEach((cluster) => {
    cluster.sources.forEach((source) => {
      const sourceId = source.id ?? source.source_id ?? source.name;
      if (!sourceMap.has(sourceId)) {
        sourceMap.set(sourceId, {
          id: sourceId,
          name: source.name,
          url: source.url ?? "",
          count: 0,
          clusterIds: new Set(),
        });
      }

      const sourceRecord = sourceMap.get(sourceId);
      sourceRecord.count += source.count ?? 0;
      sourceRecord.clusterIds.add(cluster.id);
      if (!sourceRecord.url && source.url) {
        sourceRecord.url = source.url;
      }
    });
  });

  const sources = [...sourceMap.values()].sort(
    (left, right) => right.count - left.count || left.name.localeCompare(right.name, "zh-CN"),
  );

  const centerX = 490;
  const centerY = 280;
  const radiusX = 404;
  const radiusY = 220;

  return sources.map((source, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, sources.length)) * Math.PI * 2;
    return {
      ...source,
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
      radius: clampNumber(10 + source.count * 0.85, 10, 16),
      isConnected: source.clusterIds.has(selectedClusterId),
    };
  });
}

function buildArticleNodes(state, clusterAnchors, sourceLookup, selectedClusterId) {
  const articleNodes = [];

  state.clusters.forEach((cluster, clusterIndex) => {
    const anchor = clusterAnchors.get(cluster.id);
    const clusterArticles = [...cluster.articles].sort(
      (left, right) => (right.cluster_relevance_norm ?? 0) - (left.cluster_relevance_norm ?? 0)
        || String(right.published_at).localeCompare(String(left.published_at))
        || left.title.localeCompare(right.title, "zh-CN"),
    );
    const total = Math.max(1, clusterArticles.length);
    const rotation = (clusterIndex / Math.max(1, state.clusters.length)) * Math.PI * 2;
    const safeInnerRadius = 94;
    const outerRadius = clampNumber(154 + clusterArticles.length * 2.6, 154, 206);

    clusterArticles.forEach((article, articleIndex) => {
      const relevanceNorm = clampNumber(article.cluster_relevance_norm ?? (1 - articleIndex / total), 0, 1);
      const sourceNode = sourceLookup.get(article.source_id);
      const baseAngle = rotation + ((articleIndex + 0.5) / total) * Math.PI * 2;
      const sourceAngle = sourceNode
        ? Math.atan2(sourceNode.y - anchor.y, sourceNode.x - anchor.x)
        : baseAngle;
      const angleBlend = sourceNode ? 0.32 : 0;
      const baseSpread = ((articleIndex % 2 === 0 ? 1 : -1) * (0.08 + (1 - relevanceNorm) * 0.18));
      const angle = baseAngle * (1 - angleBlend) + sourceAngle * angleBlend + baseSpread;
      const bandOffset = (articleIndex % 3) * 10 + Math.floor(articleIndex / 10) * 16;
      const radius = clampNumber(
        safeInnerRadius + (1 - relevanceNorm) * (outerRadius - safeInnerRadius) + bandOffset,
        safeInnerRadius,
        outerRadius + 28,
      );

      let x = anchor.x + Math.cos(angle) * radius;
      let y = anchor.y + Math.sin(angle) * radius;

      if (sourceNode) {
        const blendedX = x * 0.86 + sourceNode.x * 0.14;
        const blendedY = y * 0.86 + sourceNode.y * 0.14;
        const dx = blendedX - anchor.x;
        const dy = blendedY - anchor.y;
        const distance = Math.hypot(dx, dy) || 1;
        const minDistance = safeInnerRadius + 8;
        const scale = distance < minDistance ? minDistance / distance : 1;
        x = anchor.x + dx * scale;
        y = anchor.y + dy * scale;
      }

      articleNodes.push({
        ...article,
        clusterId: cluster.id,
        clusterLabel: cluster.label,
        x: clampNumber(x, 72, 908),
        y: clampNumber(y, 74, 500),
        radius: cluster.id === selectedClusterId ? 6.8 : 5.3,
        sourceNode,
        isSelected: cluster.id === selectedClusterId,
        showLabel: cluster.id === selectedClusterId && articleIndex < 2,
        clusterRelevance: article.cluster_relevance ?? null,
        clusterRelevanceNorm: relevanceNorm,
      });
    });
  });

  return articleNodes;
}

function renderConstellation(state) {
  const viewport = stateTargets.constellationViewport;
  if (!viewport) {
    return;
  }

  viewport.innerHTML = "";
  graphState.registry.clear();

  const width = graphView.width;
  const height = graphView.height;
  const selectedClusterId = state.tracked_topic.cluster_id;
  const hoveredClusterId = graphState.hoveredKey?.startsWith("cluster:")
    ? Number(graphState.hoveredKey.split(":")[1])
    : null;
  const activeClusterId = Number.isFinite(hoveredClusterId) ? hoveredClusterId : selectedClusterId;
  const focusKey = graphState.hoveredKey ?? graphState.selectedKey;

  const backgroundLayer = drawSvgNode(viewport, "g");
  const edgeLayer = drawSvgNode(viewport, "g");
  const nodeLayer = drawSvgNode(viewport, "g");
  const labelLayer = drawSvgNode(viewport, "g", {
    "pointer-events": "none",
  });

  [
    { x: 490, y: 280, r: 224, fill: "#1d2458", opacity: 0.34 },
    { x: 256, y: 162, r: 128, fill: "#2d1029", opacity: 0.42 },
    { x: 786, y: 422, r: 144, fill: "#0e4b57", opacity: 0.36 },
    { x: 788, y: 120, r: 108, fill: "#3c2b07", opacity: 0.28 },
  ].forEach((bubble) => {
    drawSvgNode(backgroundLayer, "circle", {
      cx: bubble.x,
      cy: bubble.y,
      r: bubble.r,
      fill: bubble.fill,
      opacity: bubble.opacity,
      class: "graph-bubble",
    });
  });

  [160, 240, 320].forEach((radius, index) => {
    const ring = drawSvgNode(backgroundLayer, "circle", {
      cx: width / 2,
      cy: height / 2,
      r: radius,
      fill: "none",
      stroke: "rgba(212, 255, 0, 0.08)",
      "stroke-width": index === 0 ? 1.6 : 1.1,
      "stroke-dasharray": index === 1 ? "6 16" : "12 14",
      class: "graph-orbit-ring",
    });
    ring.style.setProperty("--ring-duration", `${18 + index * 8}s`);
  });

  Array.from({ length: 18 }).forEach((_, index) => {
    const angle = (index / 18) * Math.PI * 2;
    const ringBias = index % 3 === 0 ? 254 : index % 2 === 0 ? 194 : 300;
    const star = drawSvgNode(backgroundLayer, "circle", {
      cx: width / 2 + Math.cos(angle) * ringBias,
      cy: height / 2 + Math.sin(angle) * (ringBias * 0.56),
      r: index % 4 === 0 ? 2 : 1.3,
      fill: index % 3 === 0 ? "#d9ff2f" : index % 2 === 0 ? "#34d6ff" : "#ff53cf",
      opacity: index % 5 === 0 ? 0.9 : 0.58,
      class: "graph-star",
    });
    star.style.setProperty("--star-delay", `${(index % 9) * 0.28}s`);
  });

  const clusterAnchors = buildClusterAnchors(state);
  const sourceNodes = buildSourceNodes(state, activeClusterId);
  const sourceLookup = new Map(sourceNodes.map((source) => [source.id, source]));
  const articleNodes = buildArticleNodes(state, clusterAnchors, sourceLookup, activeClusterId);
  const clusterDelayMap = new Map(
    [...state.clusters]
      .map((cluster) => {
        const anchor = clusterAnchors.get(cluster.id);
        return {
          id: cluster.id,
          distance: Math.hypot(anchor.x - width / 2, anchor.y - height / 2),
        };
      })
      .sort((left, right) => left.distance - right.distance)
      .map((entry, index) => {
        const delay = index < 2 ? index * 80 : 160 + (index - 2) * 170;
        return [entry.id, delay];
      }),
  );
  const sourceDelayMap = new Map(
    sourceNodes.map((source) => {
      const clusterDelays = [...source.clusterIds].map((clusterId) => clusterDelayMap.get(clusterId) ?? 0);
      return [source.id, Math.min(...clusterDelays, 0) + 380];
    }),
  );

  const clusterMoodKey = (distribution) => Object.entries(distribution ?? {})
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? "neutral";

  state.clusters.forEach((cluster) => {
    const key = createGraphKey("cluster", cluster.id);
    const isSelected = cluster.id === selectedClusterId;
    const dominantKey = clusterMoodKey(cluster.sentiment_distribution);

    graphState.registry.set(key, {
      key,
      badge: isSelected ? "点击进入当前关注主题页" : "点击主题簇进入主题页",
      kicker: "当前焦点 · 主题簇",
      title: cluster.label,
      description: isSelected && state.tracked_topic.theme_statement
        ? state.tracked_topic.theme_statement
        : cluster.summary,
      meta: [
        { label: `${cluster.size} 篇文章`, className: "soft" },
        { label: cluster.mood_label, className: `sentiment-pill ${dominantKey}` },
        ...cluster.keywords.slice(0, 3).map((keyword) => ({
          label: keyword,
          className: "highlight",
        })),
        {
          label: isSelected ? "当前关注主题" : "可在主题页设为关注",
          className: isSelected ? "highlight" : "soft",
        },
        { label: "打开主题页", href: buildTopicHref(cluster), className: "highlight" },
      ],
    });
  });

  sourceNodes.forEach((source, index) => {
    const key = createGraphKey("source", source.id);
    graphState.registry.set(key, {
      key,
      badge: "点击来源网站节点进入网站页",
      kicker: "当前焦点 · 来源网站",
      title: source.name,
      description: `该来源网站共关联 ${source.count} 篇网页文章，覆盖 ${source.clusterIds.size} 个主题簇。点击节点可进入对应网站页。`,
      meta: [
        { label: `${source.count} 篇样本`, className: "soft" },
        { label: `覆盖 ${source.clusterIds.size} 个主题簇`, className: "soft" },
        { label: "打开网站页", href: buildSourceHref(source), className: "highlight" },
      ],
    });
  });

  articleNodes.forEach((article) => {
    const key = createGraphKey("article", article.id);
    graphState.registry.set(key, {
      key,
      badge: "点击文章节点进入文章页",
      kicker: "当前焦点 · 网页文章",
      title: article.title,
      description: article.summary || `这篇文章来自 ${article.source}，点击节点即可查看文章详情。`,
      meta: [
        { label: article.source, href: buildSourceHref(article), className: "soft" },
        { label: formatDate(article.published_at), className: "soft" },
        {
          label: sentimentLabel(article.sentiment.label),
          className: `sentiment-pill ${article.sentiment.label}`,
        },
        { label: "打开文章页", href: buildArticleHref(article), className: "highlight" },
      ],
    });
  });

  buildClusterEdges(state.clusters).forEach(([fromCluster, toCluster]) => {
    const isConnectedToActive = fromCluster.id === activeClusterId || toCluster.id === activeClusterId;
    const path = drawCurvedLink(
      edgeLayer,
      clusterAnchors.get(fromCluster.id),
      clusterAnchors.get(toCluster.id),
      {
        stroke: isConnectedToActive ? "rgba(126, 154, 195, 0.36)" : "rgba(126, 154, 195, 0.2)",
        width: isConnectedToActive ? 1.9 : 1.5,
        opacity: isConnectedToActive ? 0.98 : 0.72,
        dasharray: "10 10",
        curvature: 34,
        className: graphState.entranceAnimating ? "graph-link graph-link-cluster" : "",
      },
    );
    if (graphState.entranceAnimating) {
      const delay = Math.min(clusterDelayMap.get(fromCluster.id) ?? 0, clusterDelayMap.get(toCluster.id) ?? 0) + 90;
      path.style.setProperty("--activate-delay", `${delay}ms`);
    }
  });

  articleNodes.forEach((article) => {
    const clusterAnchor = clusterAnchors.get(article.clusterId);
    const clusterColor = colorForCluster(article.clusterId);
    const articleKey = createGraphKey("article", article.id);
    const isFocused = sameGraphKey(articleKey, focusKey);
    const isActiveCluster = article.clusterId === activeClusterId;

    const clusterPath = drawCurvedLink(edgeLayer, article, clusterAnchor, {
      stroke: clusterColor,
      width: isFocused ? 1.75 : isActiveCluster ? 1.4 : 0.95,
      opacity: isFocused ? 0.32 : isActiveCluster ? 0.2 : 0.08,
      curvature: isFocused ? 14 : 8,
      className: graphState.entranceAnimating ? "graph-link graph-link-article" : "",
    });
    if (graphState.entranceAnimating) {
      const delay = (clusterDelayMap.get(article.clusterId) ?? 0) + 240 + articleIndexDelay(article);
      clusterPath.style.setProperty("--activate-delay", `${delay}ms`);
    }

    if (article.sourceNode) {
      const sourcePath = drawCurvedLink(edgeLayer, article, article.sourceNode, {
        stroke: "rgba(109, 139, 185, 0.38)",
        width: isFocused ? 1.35 : article.sourceNode.isConnected ? 1.08 : 0.84,
        opacity: isFocused ? 0.32 : article.sourceNode.isConnected ? 0.22 : 0.12,
        curvature: article.sourceNode.isConnected ? -18 : -10,
        className: graphState.entranceAnimating ? "graph-link graph-link-source" : "",
      });
      if (graphState.entranceAnimating) {
        const delay = Math.max(
          (clusterDelayMap.get(article.clusterId) ?? 0) + 300,
          sourceDelayMap.get(article.sourceNode.id) ?? 0,
        );
        sourcePath.style.setProperty("--activate-delay", `${delay}ms`);
      }
    }
  });

  sourceNodes.forEach((source, index) => {
    const key = createGraphKey("source", source.id);
    const isFocused = sameGraphKey(key, focusKey);
    const radius = source.radius + (isFocused ? 2.8 : 0);
    const group = drawSvgNode(nodeLayer, "g", {
      class: "constellation-node node-source",
    });
    if (graphState.entranceAnimating) {
      group.classList.add("graph-node-shell");
      group.style.setProperty("--activate-delay", `${sourceDelayMap.get(source.id) ?? 0}ms`);
    }
    group.style.setProperty("--float-delay", `${index * 0.16}s`);
    group.style.setProperty("--float-distance", `${5 + (index % 4) * 2}px`);

    attachGraphHoverHandlers(group, key, () => {
      window.location.href = buildSourceHref(source);
    }, {
      label: `来源网站 ${source.name}，点击进入网站页`,
      role: "link",
    });

    drawSvgNode(group, "circle", {
      cx: source.x,
      cy: source.y,
      r: radius + 16,
      fill: "#ffffff",
      opacity: 0,
    });

    if (source.isConnected || isFocused) {
      drawSvgNode(group, "circle", {
        cx: source.x,
        cy: source.y,
        r: radius + (isFocused ? 12 : 9),
        fill: "#0f6f67",
        opacity: isFocused ? 0.16 : 0.1,
        class: "node-halo",
      });
    }

    const node = drawSvgNode(group, "circle", {
      cx: source.x,
      cy: source.y,
      r: radius,
      fill: source.isConnected || isFocused ? "#34d6ff" : "#8cf4ff",
      "fill-opacity": isFocused ? 0.98 : source.isConnected ? 0.92 : 0.72,
      stroke: "rgba(255,255,255,0.98)",
      "stroke-width": isFocused ? 3.2 : 2.6,
      class: "node-core",
    });
    appendSvgTitle(node, `来源网站：${source.name}\n点击进入网站页`);

    if (isFocused) {
      const align = source.x < width / 2 ? "end" : "start";
      const offset = source.x < width / 2 ? -18 : 18;
      drawFloatingLabel(labelLayer, {
        x: source.x + offset,
        y: source.y - 16,
        text: source.name,
        align,
        color: "#0f6f67",
        stroke: "rgba(15, 111, 103, 0.18)",
        maxWidth: 230,
      });

      const detail = drawSvgNode(labelLayer, "text", {
        x: source.x + offset,
        y: source.y + 21,
        "text-anchor": align === "end" ? "end" : "start",
        class: "constellation-label small",
      });
      detail.textContent = `${source.count} 篇样本`;
    }
  });

  articleNodes.forEach((article) => {
    const key = createGraphKey("article", article.id);
    const isFocused = sameGraphKey(key, focusKey);
    const clusterColor = colorForCluster(article.clusterId);
    const radius = article.radius + (isFocused ? 1.6 : 0);
    const group = drawSvgNode(nodeLayer, "g", {
      class: "constellation-node node-article",
    });
    if (graphState.entranceAnimating) {
      const delay = (clusterDelayMap.get(article.clusterId) ?? 0) + 250 + articleIndexDelay(article);
      group.classList.add("graph-node-shell");
      group.style.setProperty("--activate-delay", `${delay}ms`);
    }
    group.style.setProperty("--float-delay", `${(String(article.id).length + article.clusterId) * 0.09}s`);
    group.style.setProperty("--float-distance", `${4 + (article.clusterId % 3) * 2}px`);

    attachGraphHoverHandlers(group, key, () => {
      window.location.href = buildArticleHref(article);
    }, {
      label: `文章 ${article.title}，点击进入文章页`,
      role: "link",
    });

    drawSvgNode(group, "circle", {
      cx: article.x,
      cy: article.y,
      r: radius + 9,
      fill: "#ffffff",
      opacity: 0,
    });

    if (isFocused) {
      drawSvgNode(group, "circle", {
        cx: article.x,
        cy: article.y,
        r: radius + 7,
        fill: clusterColor,
        opacity: 0.14,
        class: "node-halo",
      });
    }

    const node = drawSvgNode(group, "circle", {
      cx: article.x,
      cy: article.y,
      r: radius,
      fill: isFocused || article.clusterId === activeClusterId ? clusterColor : "#5d769b",
      "fill-opacity": isFocused ? 0.96 : article.clusterId === activeClusterId ? 0.84 : 0.62,
      stroke: clusterColor,
      "stroke-opacity": isFocused ? 0.94 : 0.32,
      "stroke-width": isFocused ? 2.1 : 1.2,
      class: "node-core",
    });
    appendSvgTitle(node, `文章：${article.title}\n来源：${article.source}\n点击进入文章页`);

    if (isFocused) {
      const align = article.x < width * 0.66 ? "start" : "end";
      const offset = align === "start" ? 14 : -14;
      drawFloatingLabel(labelLayer, {
        x: article.x + offset,
        y: article.y - 14,
        text: truncateLabel(article.title, 18),
        align,
        color: clusterColor,
        stroke: `${clusterColor}33`,
        maxWidth: 250,
      });

      const detail = drawSvgNode(labelLayer, "text", {
        x: article.x + offset,
        y: article.y + 20,
        "text-anchor": align === "end" ? "end" : "start",
        class: "constellation-label small",
      });
      detail.textContent = `${article.source} · ${formatDate(article.published_at)}`;
    }
  });

  state.clusters.forEach((cluster, index) => {
    const anchor = clusterAnchors.get(cluster.id);
    const color = colorForCluster(cluster.id);
    const key = createGraphKey("cluster", cluster.id);
    const isFocused = sameGraphKey(key, focusKey);
    const isSelected = cluster.id === selectedClusterId;
    const showDetailed = isFocused;
    const baseRadius = clampNumber(23 + cluster.size * 0.8, 24, 34);
    const radius = baseRadius + (isSelected ? 1.5 : 0) + (isFocused ? 4.5 : 0);
    const group = drawSvgNode(nodeLayer, "g", {
      class: "constellation-node node-cluster",
    });
    if (graphState.entranceAnimating) {
      group.classList.add("graph-node-shell");
      group.style.setProperty("--activate-delay", `${clusterDelayMap.get(cluster.id) ?? 0}ms`);
    }
    group.style.setProperty("--float-delay", `${index * 0.22}s`);
    group.style.setProperty("--float-distance", `${8 + (index % 3) * 2}px`);

    attachGraphHoverHandlers(group, key, () => {
      window.location.href = buildTopicHref(cluster);
    }, {
      label: `主题簇 ${cluster.label}，点击进入主题页`,
      role: "link",
    });

    drawSvgNode(group, "circle", {
      cx: anchor.x,
      cy: anchor.y,
      r: radius + 34,
      fill: "#ffffff",
      opacity: 0,
    });

    drawSvgNode(group, "circle", {
      cx: anchor.x,
      cy: anchor.y,
      r: radius + (isFocused ? 20 : isSelected ? 16 : 12),
      fill: color,
      opacity: isFocused ? 0.22 : isSelected ? 0.16 : 0.08,
      class: "node-halo",
    });

    const orbit = drawSvgNode(group, "circle", {
      cx: anchor.x,
      cy: anchor.y,
      r: radius + (isFocused ? 27 : 22),
      fill: "none",
      stroke: color,
      "stroke-width": isFocused ? 1.5 : 1.15,
      "stroke-opacity": isFocused ? 0.4 : 0.26,
      "stroke-dasharray": "8 10",
      class: "node-orbit",
    });
    orbit.style.setProperty("--orbit-duration", `${11 + index * 1.8}s`);

    const node = drawSvgNode(group, "circle", {
      cx: anchor.x,
      cy: anchor.y,
      r: radius,
      fill: color,
      "fill-opacity": isFocused ? 0.98 : isSelected ? 0.96 : 0.88,
      stroke: "rgba(255,255,255,0.96)",
      "stroke-width": isFocused ? 3.6 : 3,
      class: "node-core",
    });
    appendSvgTitle(node, `主题簇：${cluster.label}\n点击进入主题页`);

    const indexText = drawSvgNode(group, "text", {
      x: anchor.x,
      y: anchor.y + 5,
      "text-anchor": "middle",
      class: "constellation-label",
      fill: "#fff",
    });
    indexText.textContent = String(index + 1);
    indexText.style.fontSize = isFocused ? "14px" : "13px";

    if (showDetailed) {
      drawFloatingLabel(labelLayer, {
        x: anchor.x,
        y: anchor.y - radius - 24,
        text: cluster.label,
        color,
        stroke: `${color}33`,
        maxWidth: 260,
      });

      const keywordLine = drawSvgNode(labelLayer, "text", {
        x: anchor.x,
        y: anchor.y + radius + 25,
        "text-anchor": "middle",
        class: "constellation-label small",
      });
      keywordLine.textContent = truncateLabel(cluster.keywords.slice(0, 3).join(" · "), 20);
    }
  });

  const hint = drawSvgNode(labelLayer, "text", {
    x: width / 2,
    y: height - 16,
    "text-anchor": "middle",
    class: "constellation-label hint",
  });
  hint.textContent = graphState.scale > 1
    ? "滚轮缩放，拖动画布浏览细节，双击或点击“重置”恢复视角"
    : "悬停节点显示完整中文名称，点击主题进入主题页，点击文章或网站进入对应页面";

  const clampedPan = clampGraphPan(graphState.translateX, graphState.translateY);
  graphState.translateX = clampedPan.x;
  graphState.translateY = clampedPan.y;
  updateGraphTransform();
  updateGraphFocusPanel({ forceContent: true, forceBadge: true });
}

function buildLinePath(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildAreaPath(points, baselineY) {
  if (!points.length) {
    return "";
  }
  return `${buildLinePath(points)} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
}

function articleIndexDelay(article) {
  return Math.min(220, Math.round((1 - (article.clusterRelevanceNorm ?? 0)) * 180));
}

function renderTimeline(timeline) {
  const svg = stateTargets.timelineSvg;
  svg.innerHTML = "";
  svg.classList.remove("is-ready");

  if (!timeline.length) {
    const emptyLabel = drawSvgNode(svg, "text", {
      x: 390,
      y: 122,
      "text-anchor": "middle",
      class: "timeline-empty-label",
    });
    emptyLabel.textContent = "当前关注主题还没有形成可绘制的时间线。";
    return;
  }

  const width = 780;
  const chartLeft = 72;
  const chartRight = 28;
  const chartTop = 28;
  const chartBottom = 190;
  const chartHeight = chartBottom - chartTop;
  const chartWidth = width - chartLeft - chartRight;
  const series = [
    { key: "positive", label: "正面", color: "#7cff95" },
    { key: "neutral", label: "中性", color: "#d4d8eb" },
    { key: "negative", label: "负面", color: "#ff8a72" },
  ];
  const maxValue = Math.max(
    1,
    ...timeline.flatMap((item) => series.map((entry) => item[entry.key] ?? 0)),
  );
  const defs = drawSvgNode(svg, "defs");

  series.forEach((entry) => {
    const gradient = drawSvgNode(defs, "linearGradient", {
      id: `timeline-gradient-${entry.key}`,
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
    });
    drawSvgNode(gradient, "stop", {
      offset: "0%",
      "stop-color": entry.color,
      "stop-opacity": 0.3,
    });
    drawSvgNode(gradient, "stop", {
      offset: "100%",
      "stop-color": entry.color,
      "stop-opacity": 0,
    });
  });

  drawSvgNode(svg, "line", {
    x1: chartLeft,
    y1: chartBottom,
    x2: width - chartRight,
    y2: chartBottom,
    class: "timeline-axis",
  });

  [0, 1, 2, 3, 4].forEach((step) => {
    const ratio = step / 4;
    const y = chartBottom - chartHeight * ratio;
    drawSvgNode(svg, "line", {
      x1: chartLeft,
      y1: y,
      x2: width - chartRight,
      y2: y,
      class: "timeline-grid-line",
    });

    const label = drawSvgNode(svg, "text", {
      x: chartLeft - 16,
      y: y + 4,
      "text-anchor": "end",
      class: "timeline-axis-label",
    });
    label.textContent = String(Math.round(maxValue * ratio));
  });

  series.forEach((entry, index) => {
    const legendX = chartLeft + index * 114;
    drawSvgNode(svg, "circle", {
      cx: legendX,
      cy: 14,
      r: 4.6,
      fill: entry.color,
      class: "timeline-legend-dot",
    });
    const legendText = drawSvgNode(svg, "text", {
      x: legendX + 12,
      y: 18,
      class: "timeline-legend-label",
    });
    legendText.textContent = entry.label;
  });

  series.forEach((entry, lineIndex) => {
    const points = timeline.map((item, pointIndex) => {
      const ratio = timeline.length === 1 ? 0.5 : pointIndex / (timeline.length - 1);
      const value = item[entry.key] ?? 0;
      return {
        x: +(chartLeft + chartWidth * ratio).toFixed(2),
        y: +(chartBottom - (value / maxValue) * chartHeight).toFixed(2),
        value,
      };
    });

    const area = drawSvgNode(svg, "path", {
      d: buildAreaPath(points, chartBottom),
      fill: `url(#timeline-gradient-${entry.key})`,
      class: `timeline-area ${entry.key}`,
    });
    area.style.setProperty("--timeline-delay", `${80 + lineIndex * 120}ms`);

    const line = drawSvgNode(svg, "path", {
      d: buildLinePath(points),
      fill: "none",
      stroke: entry.color,
      "stroke-width": 3.2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      class: `timeline-line ${entry.key}`,
      "pathLength": 1,
    });
    line.style.color = entry.color;
    line.style.setProperty("--timeline-delay", `${140 + lineIndex * 120}ms`);

    points.forEach((point, pointIndex) => {
      const dot = drawSvgNode(svg, "circle", {
        cx: point.x,
        cy: point.y,
        r: 5.2,
        fill: "#05060d",
        stroke: entry.color,
        "stroke-width": 2.4,
        class: `timeline-dot ${entry.key}`,
      });
      dot.style.setProperty("--timeline-delay", `${200 + lineIndex * 120 + pointIndex * 56}ms`);

    });
  });

  timeline.forEach((item, index) => {
    const ratio = timeline.length === 1 ? 0.5 : index / (timeline.length - 1);
    const x = chartLeft + chartWidth * ratio;
    const dateLabel = drawSvgNode(svg, "text", {
      x,
      y: 218,
      "text-anchor": "middle",
      class: "timeline-date-label",
    });
    dateLabel.textContent = item.date.slice(5);
    dateLabel.style.setProperty("--timeline-delay", `${120 + index * 48}ms`);
  });

  svg.classList.add("is-ready");
}

function applyStateToControls(state) {
  const sourceMode = String(state.source_mode_requested ?? "");
  const clusterCount = String(state.metrics.cluster_count ?? "");

  if ([...sourceModeSelect.options].some((option) => option.value === sourceMode)) {
    sourceModeSelect.value = sourceMode;
  }
  if ([...clusterCountSelect.options].some((option) => option.value === clusterCount)) {
    clusterCountSelect.value = clusterCount;
  }

  const isStatic = runtimeBridge?.isStaticMode?.() ?? false;
  sourceModeSelect.disabled = isStatic;
  clusterCountSelect.disabled = isStatic;

  if (isStatic) {
    rebuildButton.disabled = true;
    rebuildButton.textContent = "静态演示版请重新本地构建";
    rebuildButton.title = "Cloudflare 静态演示版不支持在线重聚类，请重新运行构建脚本后再部署。";
    return;
  }

  rebuildButton.disabled = false;
  rebuildButton.textContent = "重新聚类并刷新看板";
  rebuildButton.title = "";
}

function renderState(state) {
  currentState = state;
  syncGraphSelection(state);
  buildHeadlineStats(state);
  renderMetrics(state);
  renderStatusMeta(state);
  renderSourceLibrary(state);
  renderNotes(state);
  renderClusterCards(state);
  renderTrackedTopic(state);
  renderConstellation(state);
  applyStateToControls(state);
  hydrateInteractiveSurfaces();
  syncRevealNodes();
  registerGraphEntrance();
}

function isElementVisible(element, visibleRatio = 0.28) {
  if (!element) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const visibleTop = Math.max(rect.top, 0);
  const visibleBottom = Math.min(rect.bottom, viewportHeight);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  return visibleHeight >= rect.height * visibleRatio;
}

function triggerGraphEntrance() {
  if (!currentState || graphState.entranceAnimating || graphState.entrancePlayed) {
    return;
  }

  graphState.entranceAnimating = true;
  stateTargets.graphCanvas?.classList.add("is-entering");
  renderConstellation(currentState);

  if (graphState.entranceTimer !== null) {
    window.clearTimeout(graphState.entranceTimer);
  }

  graphState.entranceTimer = window.setTimeout(() => {
    graphState.entranceAnimating = false;
    graphState.entrancePlayed = true;
    stateTargets.graphCanvas?.classList.remove("is-entering");
    if (currentState) {
      renderConstellation(currentState);
    }
  }, 2500);
}

function registerGraphEntrance() {
  if (!stateTargets.mapSection || graphState.entrancePlayed) {
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    graphState.entrancePlayed = true;
    return;
  }

  if (isElementVisible(stateTargets.mapSection)) {
    triggerGraphEntrance();
    return;
  }

  if (!("IntersectionObserver" in window)) {
    graphState.entrancePlayed = true;
    return;
  }

  if (!graphEntranceObserver) {
    graphEntranceObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        triggerGraphEntrance();
        graphEntranceObserver?.unobserve(entry.target);
      });
    }, {
      threshold: 0.3,
      rootMargin: "0px 0px -10% 0px",
    });
  }

  graphEntranceObserver.observe(stateTargets.mapSection);
}

function renderLoadingState(message) {
  stateTargets.clusterCards.innerHTML = "";
  stateTargets.clusterCards.appendChild(createElement("div", "empty-state", message));
}

async function loadState() {
  rebuildButton.disabled = true;
  rebuildButton.textContent = "正在读取当前分析状态...";
  try {
    const state = await requestJSON("/api/state");
    renderState(state);
  } catch (error) {
    console.error(error);
    renderLoadingState(`加载失败：${error.message}`);
  } finally {
    rebuildButton.disabled = false;
    rebuildButton.textContent = "重新聚类并刷新看板";
  }
}

async function rebuildDashboard() {
  rebuildButton.disabled = true;
  rebuildButton.textContent = "正在重新聚类...";
  try {
    const state = await requestJSON("/api/rebuild", {
      method: "POST",
      body: JSON.stringify({
        source_mode: sourceModeSelect.value,
        cluster_count: Number(clusterCountSelect.value),
      }),
    });
    renderState(state);
  } catch (error) {
    console.error(error);
    window.alert(`重新聚类失败：${error.message}`);
  } finally {
    rebuildButton.disabled = false;
    rebuildButton.textContent = "重新聚类并刷新看板";
  }
}

async function followCluster(clusterId) {
  try {
    const state = await requestJSON("/api/follow", {
      method: "POST",
      body: JSON.stringify({ cluster_id: clusterId }),
    });
    renderState(state);
  } catch (error) {
    console.error(error);
    window.alert(`设为关注失败：${error.message}`);
  }
}

function renderMetrics(state) {
  const metrics = [
    ["最佳K值", state.metrics.best_k ?? state.metrics.cluster_count],
    ["轮廓系数", state.metrics.silhouette_score ?? "N/A"],
    ["关注主题文章", state.metrics.tracked_article_count],
    ["生成时间", state.generated_at.replace("T", " ")],
  ];

  stateTargets.metricGrid.innerHTML = "";
  metrics.forEach(([label, value], index) => {
    const card = createElement("div", "metric-card");
    card.dataset.tone = ["cyan", "orange", "lime", "magenta"][index % 4];
    card.appendChild(createElement("div", "metric-value", String(value)));
    card.appendChild(createElement("div", "metric-label", label));
    stateTargets.metricGrid.appendChild(card);
  });
}

function renderStatusMeta(state) {
  stateTargets.statusMeta.innerHTML = "";
  [
    `请求模式：${state.source_mode_requested_label}`,
    `实际模式：${state.source_mode_resolved_label}`,
    `最佳K值：${state.metrics.best_k ?? state.metrics.cluster_count}`,
    `来源站点：${state.metrics.source_count} 个`,
  ].forEach((text) => {
    stateTargets.statusMeta.appendChild(createElement("span", "status-pill", text));
  });
}

rebuildButton.addEventListener("click", rebuildDashboard);
window.addEventListener("DOMContentLoaded", () => {
  setupGraphInteractions();
  syncRevealNodes();
  registerGraphEntrance();
  loadState();
});
window.addEventListener("resize", () => {
  if (!currentState) {
    return;
  }
  window.requestAnimationFrame(() => {
    renderConstellation(currentState);
    renderTimeline(currentState.tracked_topic.timeline);
  });
});

function applyStateToControls(state) {
  const sourceMode = String(state.source_mode_requested ?? "");
  const clusterCount = String(state.metrics.cluster_count ?? "");
  const isStatic = runtimeBridge?.isStaticMode?.() ?? false;

  if ([...sourceModeSelect.options].some((option) => option.value === sourceMode)) {
    sourceModeSelect.value = sourceMode;
  }
  if ([...clusterCountSelect.options].some((option) => option.value === clusterCount)) {
    clusterCountSelect.value = clusterCount;
  }

  sourceModeSelect.disabled = isStatic;
  clusterCountSelect.disabled = isStatic;

  if (isStatic) {
    rebuildButton.disabled = true;
    rebuildButton.textContent = "静态演示版请重新本地构建";
    rebuildButton.title = "Cloudflare 静态演示版不支持在线重聚类，请重新运行构建脚本后再部署。";
    return;
  }

  rebuildButton.disabled = false;
  rebuildButton.textContent = "重新聚类并刷新看板";
  rebuildButton.title = "";
}

async function loadState() {
  rebuildButton.disabled = true;
  rebuildButton.textContent = runtimeBridge?.isStaticMode?.()
    ? "正在加载静态演示数据..."
    : "正在读取当前分析状态...";
  try {
    const state = await runtimeBridge.loadState();
    renderState(state);
  } catch (error) {
    console.error(error);
    renderLoadingState(`加载失败：${error.message}`);
  } finally {
    if (currentState) {
      applyStateToControls(currentState);
    } else if (runtimeBridge?.isStaticMode?.()) {
      rebuildButton.disabled = true;
      rebuildButton.textContent = "静态演示版请重新本地构建";
    } else {
      rebuildButton.disabled = false;
      rebuildButton.textContent = "重新聚类并刷新看板";
    }
  }
}

async function rebuildDashboard() {
  if (runtimeBridge?.isStaticMode?.()) {
    window.alert("静态演示版不支持在线重聚类，请在本地重新运行构建脚本后再部署。");
    return;
  }

  rebuildButton.disabled = true;
  rebuildButton.textContent = "正在重新聚类...";
  try {
    const state = await runtimeBridge.rebuildDashboard({
      source_mode: sourceModeSelect.value,
      cluster_count: Number(clusterCountSelect.value),
    });
    renderState(state);
  } catch (error) {
    console.error(error);
    window.alert(`重新聚类失败：${error.message}`);
  } finally {
    if (currentState) {
      applyStateToControls(currentState);
    } else {
      rebuildButton.disabled = false;
      rebuildButton.textContent = "重新聚类并刷新看板";
    }
  }
}

async function followCluster(clusterId) {
  try {
    const state = await runtimeBridge.followCluster(clusterId);
    renderState(state);
  } catch (error) {
    console.error(error);
    window.alert(`设置关注失败：${error.message}`);
  }
}

function renderStatusMeta(state) {
  stateTargets.statusMeta.innerHTML = "";
  [
    `请求模式：${state.source_mode_requested_label}`,
    `实际模式：${state.source_mode_resolved_label}`,
    `最佳 K 值：${state.metrics.best_k ?? state.metrics.cluster_count}`,
    `来源站点：${state.metrics.source_count} 个`,
    runtimeBridge?.isStaticMode?.() ? "部署模式：Cloudflare 静态演示版" : "部署模式：本地动态版",
  ].forEach((text) => {
    stateTargets.statusMeta.appendChild(createElement("span", "status-pill", text));
  });
}
