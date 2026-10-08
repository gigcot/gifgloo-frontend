import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Gifgloo", short_name: "Gifgloo", start_url: "/", display: "standalone",
    background_color: "#0c0c0e", theme_color: "#0c0c0e",
    icons: [{ src: "/icon.png", sizes: "644x644", type: "image/png" }],
  };
}
