"use client";

import dynamic from "next/dynamic";
import type { RuralSpotSeed } from "@/types";

const MapClient = dynamic(() => import("@/components/map-client").then((mod) => mod.MapClient), {
  ssr: false,
  loading: () => <div className="rounded-3xl border border-dashed border-brand-200 bg-white p-8 text-sm text-slate-500">地图加载中...</div>
});

export function SpotsMap({ spots }: { spots: RuralSpotSeed[] }) {
  return <MapClient spots={spots} />;
}
