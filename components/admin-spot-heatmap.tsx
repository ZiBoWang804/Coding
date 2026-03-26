"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { AdminHeatmapSpot } from "@/lib/repository";

function HeatmapViewport({ spots }: { spots: AdminHeatmapSpot[] }) {
  const map = useMap();

  useEffect(() => {
    if (spots.length === 0) return;

    const bounds = L.latLngBounds(spots.map((spot) => [spot.latitude, spot.longitude] as [number, number]));
    if (spots.length === 1) {
      map.setView(bounds.getCenter(), 10);
      return;
    }

    map.fitBounds(bounds, { padding: [28, 28] });
  }, [map, spots]);

  return null;
}

function normalizeScore(score: number, min: number, max: number) {
  if (max <= min) return 0.5;
  return (score - min) / (max - min);
}

function heatColor(ratio: number) {
  if (ratio >= 0.8) return "#e0553d";
  if (ratio >= 0.6) return "#ef8d4a";
  if (ratio >= 0.35) return "#f4c35f";
  return "#6fb68b";
}

function heatRadius(ratio: number) {
  return 8 + ratio * 16;
}

export function AdminSpotHeatmap({ spots }: { spots: AdminHeatmapSpot[] }) {
  if (spots.length === 0) {
    return (
      <div className="rounded-[1.8rem] bg-white p-6 text-sm text-slate-500">
        当前还没有足够的带坐标景点数据，暂时无法生成热力图。
      </div>
    );
  }

  const scores = spots.map((spot) => spot.heatScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  return (
    <div className="relative h-[420px]">
      <MapContainer center={[34.3416, 108.9398]} zoom={7} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <HeatmapViewport spots={spots} />
        {spots.map((spot) => {
          const ratio = normalizeScore(spot.heatScore, min, max);
          const color = heatColor(ratio);
          const radius = heatRadius(ratio);

          return (
            <CircleMarker
              key={spot.id}
              center={[spot.latitude, spot.longitude]}
              radius={radius}
              pathOptions={{
                color,
                weight: 1,
                fillColor: color,
                fillOpacity: 0.45
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={1}>
                <div className="space-y-1 text-sm">
                  <div className="font-medium text-brand-900">{spot.name}</div>
                  <div className="text-xs text-slate-500">{[spot.city, spot.district].filter(Boolean).join(" / ") || spot.province}</div>
                  <div className="text-xs text-slate-600">
                    热度 {spot.heatScore} · 收藏/状态 {spot.actionCount} · 打卡 {spot.checkInCount} · 帖子 {spot.postCount}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-4 left-4 rounded-[1.2rem] border border-white/70 bg-white/90 px-4 py-3 text-xs text-slate-600 shadow-[0_16px_35px_rgba(17,32,26,0.12)] backdrop-blur">
        <div className="font-medium text-brand-900">热度说明</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#6fb68b]" />
          <span>较冷</span>
          <span className="h-3 w-3 rounded-full bg-[#f4c35f]" />
          <span>活跃</span>
          <span className="h-3 w-3 rounded-full bg-[#e0553d]" />
          <span>热门</span>
        </div>
      </div>
    </div>
  );
}
