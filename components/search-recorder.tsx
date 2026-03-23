"use client";

import { useEffect, useMemo } from "react";

export function SearchRecorder({ payload }: { payload: { query?: string; province?: string; city?: string; tag?: string; resultIds?: string[] } }) {
  const serialized = useMemo(() => JSON.stringify(payload), [payload]);

  useEffect(() => {
    const parsed = JSON.parse(serialized) as typeof payload;
    if (!parsed.query && !parsed.province && !parsed.city && !parsed.tag) return;
    void fetch("/api/search-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: serialized
    });
  }, [serialized]);

  return null;
}