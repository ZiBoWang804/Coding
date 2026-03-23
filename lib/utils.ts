import clsx, { type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(value?: number | null) {
  if (value == null) return "待补充";
  return `约￥${value}/人`;
}

export function formatCrowdLevel(value?: number | null) {
  if (value == null) return "未知";
  return ["很少", "较少", "适中", "偏多", "拥挤"][Math.max(0, Math.min(4, value - 1))];
}

export function parseNumber(value: unknown) {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function parseBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "yes", "是"].includes(value.toLowerCase());
  }
  return false;
}

export function normalizePipeList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== "string") return [];
  return value
    .split(/[|｜、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function slugifyAction(type: "wantToGo" | "visited" | "favorite") {
  return {
    wantToGo: "想去",
    visited: "去过",
    favorite: "收藏"
  }[type];
}

export function isLikelyImageUrl(url?: string | null) {
  if (!url) return false;
  const normalized = url.toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].some((ext) => normalized.includes(ext));
}

export function isRemoteHttpUrl(url?: string | null) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

export function buildAmapNavigationUrl(name: string, city: string, address?: string | null) {
  const keyword = encodeURIComponent(address || `${city}${name}`);
  return `https://uri.amap.com/search?keyword=${keyword}&city=${encodeURIComponent(city)}`;
}

export function buildGenericTicketUrl(name: string, city: string) {
  return `https://m.ctrip.com/webapp/ticket/tickets?keyword=${encodeURIComponent(`${city} ${name}`)}`;
}

export function buildGenericHotelUrl(name: string, city: string) {
  return `https://m.ctrip.com/webapp/hotel/?keyword=${encodeURIComponent(`${city} ${name}`)}`;
}
