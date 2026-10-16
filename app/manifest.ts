import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Red Anchor Sentinel · AI智能体安全探测与防护工具",
    short_name: "Red Anchor",
    description: "AI agent security detection and protection. AI智能体 · AI安全.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    lang: "en",
  };
}
