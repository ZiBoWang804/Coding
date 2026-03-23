"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { RuralSpotSeed } from "@/types";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

export function MapClient({ spots }: { spots: RuralSpotSeed[] }) {
  const mapSpots = spots.filter((spot) => spot.latitude != null && spot.longitude != null);

  if (mapSpots.length === 0) {
    return <div className="rounded-3xl border border-dashed border-brand-200 bg-white p-8 text-sm text-slate-500">当前数据中暂时没有可展示的精确点位，后续可通过后台导入补充。</div>;
  }

  return (
    <div className="h-[480px] overflow-hidden rounded-3xl border border-brand-100 shadow-card">
      <MapContainer center={[mapSpots[0].latitude!, mapSpots[0].longitude!]} zoom={5} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {mapSpots.map((spot) => (
          <Marker key={spot.id} position={[spot.latitude!, spot.longitude!]}>
            <Popup>
              <div className="space-y-2">
                <div className="font-medium">{spot.name}</div>
                <div className="text-xs text-slate-500">{spot.province} · {spot.city}</div>
                <Link href={`/spots/${spot.id}`} className="text-xs text-brand-700 underline">查看详情</Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}