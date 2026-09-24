import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vegas Blackjack Trainer",
    short_name: "Blackjack Trainer",
    description: "ラスベガス旅行前のブラックジャック実戦トレーニング",
    start_url: "./",
    display: "standalone",
    background_color: "#062817",
    theme_color: "#062817",
    icons: [
      {
        src: "./icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
