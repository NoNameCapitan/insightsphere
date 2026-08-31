import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VLK Навігатор — 402 Assist",
    short_name: "VLK 402",
    description: "Професійний навігатор по наказу МОУ №402 для лікарів-членів ВЛК.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1e9",
    theme_color: "#123f40",
    lang: "uk",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
