import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Certly - site access compliance for South African contractors",
    short_name: SITE.name,
    description:
      "Training and certification register, safety files and monthly HR reporting for South African contractors.",
    start_url: "/",
    display: "standalone",
    background_color: "#ede7d9",
    theme_color: "#ede7d9",
    lang: "en-ZA",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
