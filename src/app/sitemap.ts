import type { MetadataRoute } from "next";

import {
  getCollectionsReadModel,
  getDevelopersReadModel,
  getLanguageReadModels,
  getTechnologiesReadModel,
  getTopicsReadModel,
} from "@/application/read-model";
import { listRepositories } from "@/infrastructure/db/repository-store";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const routes = [
    "",
    "/trending",
    "/repositories",
    "/developers",
    "/languages",
    "/technologies",
    "/topics",
    "/collections",
    "/compare",
    "/compare/ecosystems",
    "/discover",
    "/insights",
    "/daily",
    "/weekly",
    "/coverage",
    "/methodology",
    "/data-policy",
    "/index",
  ];
  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${base}${route}`,
    changeFrequency: route === "/trending" || route === "/daily" ? "daily" : "weekly",
    priority: route === "" ? 1 : 0.7,
  }));
  try {
    const [repositories, developers, languages, technologies, topics, collections] =
      await Promise.all([
        listRepositories({ limit: 100, onlyIndexed: true }),
        getDevelopersReadModel(),
        getLanguageReadModels(),
        getTechnologiesReadModel(),
        getTopicsReadModel(),
        getCollectionsReadModel(),
      ]);
    return [
      ...staticEntries,
      ...repositories.map((repository) => ({
        url: `${base}/r/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}`,
        lastModified: repository.observedAt ?? undefined,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...developers.map((developer) => ({
        url: `${base}/d/${encodeURIComponent(developer.username)}`,
        lastModified: developer.lastIndexedAt ?? undefined,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...languages
        .filter((language) => language.name)
        .map((language) => ({
          url: `${base}/language/${language.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          changeFrequency: "daily" as const,
          priority: 0.65,
        })),
      ...technologies.map((technology) => ({
        url: `${base}/technology/${technology.slug}`,
        changeFrequency: "daily" as const,
        priority: 0.65,
      })),
      ...topics.map((topic) => ({
        url: `${base}/topic/${topic.slug}`,
        changeFrequency: "daily" as const,
        priority: 0.65,
      })),
      ...collections.map((collection) => ({
        url: `${base}/collection/${collection.slug}`,
        lastModified: collection.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.65,
      })),
    ];
  } catch {
    return staticEntries;
  }
}
