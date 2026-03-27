"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { RuralSpotSeed } from "@/types";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

function MapViewport({ spots }: { spots: RuralSpotSeed[] }) {
  const map = useMap();

  useEffect(() => {
    if (spots.length === 0) return;

    const bounds = L.latLngBounds(spots.map((spot) => [spot.latitude!, spot.longitude!] as [number, number]));

    if (spots.length === 1) {
      map.setView(bounds.getCenter(), 13);
      return;
    }

    map.fitBounds(bounds, { padding: [32, 32] });
  }, [map, spots]);

  return null;
}

function buildSpotAddress(spot: RuralSpotSeed) {
  return spot.address || [spot.city, spot.district].filter(Boolean).join(" / ") || spot.province;
}

function buildGeocodeQuery(spot: RuralSpotSeed) {
  return [spot.name, spot.address, spot.district, spot.city, spot.province].filter(Boolean).join(" ");
}

export function MapClient({ spots }: { spots: RuralSpotSeed[] }) {
  const [resolvedSpots, setResolvedSpots] = useState<RuralSpotSeed[]>(spots);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveMissingCoordinates() {
      const missingSpots = spots.filter((spot) => spot.latitude == null || spot.longitude == null);
      if (missingSpots.length === 0) {
        setResolvedSpots(spots);
        setIsResolving(false);
        return;
      }

      setIsResolving(true);

      const nextSpots = await Promise.all(
        spots.map(async (spot) => {
          if (spot.latitude != null && spot.longitude != null) return spot;

          const query = buildGeocodeQuery(spot);
          if (!query) return spot;

          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=cn&q=${encodeURIComponent(query)}`,
              {
                headers: {
                  "Accept-Language": "zh-CN,zh;q=0.9"
                }
              }
            );

            if (!response.ok) return spot;

            const payload = (await response.json()) as Array<{ lat?: string; lon?: string }>;
            const first = payload[0];
            const latitude = first?.lat ? Number(first.lat) : NaN;
            const longitude = first?.lon ? Number(first.lon) : NaN;
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return spot;

            return {
              ...spot,
              latitude,
              longitude,
              coordinatePrecision: spot.coordinatePrecision ?? "district_approx",
              geoSource: spot.geoSource || "nominatim-fallback"
            };
          } catch {
            return spot;
          }
        })
      );

      if (!cancelled) {
        setResolvedSpots(nextSpots);
        setIsResolving(false);
      }
    }

    void resolveMissingCoordinates();

    return () => {
      cancelled = true;
    };
  }, [spots]);

  const mapSpots = resolvedSpots.filter((spot) => spot.latitude != null && spot.longitude != null);

  if (mapSpots.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-brand-200 bg-white p-8 text-sm text-slate-500">
        {isResolving ? "正在根据景点名称和地址尝试定位地图点位..." : "当前没有可展示的地图点位。可以先调整筛选条件，或回到景点库查看详情。"}
      </div>
    );
  }

  return (
    <div className="h-[480px] overflow-hidden rounded-3xl border border-brand-100 shadow-card">
      <MapContainer center={[mapSpots[0].latitude!, mapSpots[0].longitude!]} zoom={10} scrollWheelZoom preferCanvas className="h-full w-full">
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapViewport spots={mapSpots} />
        {mapSpots.map((spot) => (
          <Marker key={spot.id || `${spot.name}-${spot.latitude}-${spot.longitude}`} position={[spot.latitude!, spot.longitude!]}>
            <Popup>
              <div className="space-y-2 text-sm">
                <div className="font-medium text-brand-900">{spot.name}</div>
                <div className="text-xs text-slate-500">{buildSpotAddress(spot)}</div>
                <div className="text-xs leading-6 text-slate-600">
                  {spot.description.length > 72 ? `${spot.description.slice(0, 72)}...` : spot.description}
                </div>
                <Link href={`/spots/${spot.id}`} className="text-xs font-medium text-brand-700 underline">
                  查看详情
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
