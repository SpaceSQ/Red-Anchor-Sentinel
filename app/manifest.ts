import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "红锚哨兵 Red Anchor Sentinel",
    short_name: "红锚哨兵",
    description: "L0 级智能体安全检测与可逆对齐补丁分发",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    lang: "zh-CN",
  };
}
