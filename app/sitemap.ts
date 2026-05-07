import type { MetadataRoute } from "next";

const siteUrl = "https://xianshi.icu";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: new Date("2026-05-07"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/infinite-explore`,
      lastModified: new Date("2026-05-07"),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/open.html`,
      lastModified: new Date("2026-05-07"),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
