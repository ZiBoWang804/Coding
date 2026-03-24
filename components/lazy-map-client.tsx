"use client";

import dynamic from "next/dynamic";
import type { RuralSpotSeed } from "@/types";

const MapClient = dynamic(
  () => import("@/components/map-client").then((mod) => mod.MapClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] items-center justify-center rounded-3xl border border-brand-100 bg-white text-sm text-slate-500 shadow-card">
        地图正在加载中...
      </div>
    )
  }
);

export function LazyMapClient({ spots }: { spots: RuralSpotSeed[] }) {
  return <MapClient spots={spots} />;
}
