import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VLK Навігатор — 402 Assist",
    short_name: "VLK 402",
    description: "Професійний навігатор по наказу МОУ №402 для лікарів-членів ВЛК.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2ec",
    theme_color: "#082f2b",
    lang: "uk",
    icons: [
      {
        src: "/vlk-command-emblem.png",
        sizes: "1254x1254",
        type: "image/png",
      },
    ],
  };
}
