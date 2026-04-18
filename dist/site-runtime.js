(function initializeWebClassificationRuntime() {
  const config = {
    mode: "dynamic",
    staticBundlePath: "/data/static-state-bundle.json",
    trackedClusterStorageKey: "web-classification-tracked-cluster",
    ...(window.__APP_CONFIG__ ?? {}),
  };

  let staticBundlePromise = null;

  function fetchJson(url, options = {}) {
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

  function clonePayload(payload) {
    if (typeof structuredClone === "function") {
      return structuredClone(payload);
    }
    return JSON.parse(JSON.stringify(payload));
  }

  function isStaticMode() {
    return config.mode === "static";
  }

  function normalizeClusterId(value, fallback = 0) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
  }

  function trackedClusterStorageKey() {
    return config.trackedClusterStorageKey || "web-classification-tracked-cluster";
  }

  function readTrackedClusterId(bundle) {
    const fallback = normalizeClusterId(bundle?.default_cluster_id, 0);
    try {
      const storedValue = window.localStorage.getItem(trackedClusterStorageKey());
      return normalizeClusterId(storedValue, fallback);
    } catch (error) {
      return fallback;
    }
  }

  function persistTrackedClusterId(clusterId) {
    try {
      window.localStorage.setItem(trackedClusterStorageKey(), String(clusterId));
    } catch (error) {
      return;
    }
  }

  function resolveStateFromBundle(bundle, preferredClusterId = null) {
    const states = bundle?.states ?? {};
    const defaultClusterId = normalizeClusterId(bundle?.default_cluster_id, 0);
    const requestedClusterId = preferredClusterId === null || preferredClusterId === undefined || preferredClusterId === ""
      ? readTrackedClusterId(bundle)
      : normalizeClusterId(preferredClusterId, defaultClusterId);
    const resolvedClusterId = Object.prototype.hasOwnProperty.call(states, String(requestedClusterId))
      ? requestedClusterId
      : defaultClusterId;
    const payload = states[String(resolvedClusterId)] ?? states[String(defaultClusterId)] ?? null;
    return {
      clusterId: resolvedClusterId,
      state: payload ? clonePayload(payload) : null,
    };
  }

  function loadStaticBundle() {
    if (!staticBundlePromise) {
      staticBundlePromise = fetchJson(config.staticBundlePath || "/data/static-state-bundle.json");
    }
    return staticBundlePromise;
  }

  async function loadState(preferredClusterId = null) {
    if (!isStaticMode()) {
      return fetchJson("/api/state");
    }

    const bundle = await loadStaticBundle();
    const resolved = resolveStateFromBundle(bundle, preferredClusterId);
    if (!resolved.state) {
      throw new Error("静态数据包中没有可用的主题状态。");
    }
    persistTrackedClusterId(resolved.clusterId);
    return resolved.state;
  }

  async function followCluster(clusterId) {
    if (!isStaticMode()) {
      return fetchJson("/api/follow", {
        method: "POST",
        body: JSON.stringify({ cluster_id: clusterId }),
      });
    }

    persistTrackedClusterId(clusterId);
    return loadState(clusterId);
  }

  function rebuildDashboard(payload) {
    if (isStaticMode()) {
      return Promise.reject(new Error("静态演示版不支持在线重聚类，请在本地重新生成 dist 后再部署。"));
    }

    return fetchJson("/api/rebuild", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  window.WebClassificationRuntime = {
    config,
    fetchJson,
    isStaticMode,
    loadStaticBundle,
    loadState,
    followCluster,
    rebuildDashboard,
    persistTrackedClusterId,
    readTrackedClusterId,
  };
})();
