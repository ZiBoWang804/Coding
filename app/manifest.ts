import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "游乡记",
    short_name: "游乡记",
    description: "乡村旅游智能规划平台 MVP",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#2f6b50",
    lang: "zh-CN"
  };
}
