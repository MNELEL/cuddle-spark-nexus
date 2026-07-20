import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://cuddle-spark-nexus.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/login", changefreq: "monthly", priority: "0.5" },
          { path: "/blog", changefreq: "weekly", priority: "0.8" },
          { path: "/blog/digital-hall-pass-guide", changefreq: "monthly", priority: "0.7" },
          { path: "/blog/progress-tracking-guide", changefreq: "monthly", priority: "0.8" },
          { path: "/blog/weekly-report-template", changefreq: "monthly", priority: "0.7" },
          { path: "/blog/classroom-tools-teachers", changefreq: "monthly", priority: "0.7" },
          { path: "/tools/group-maker", changefreq: "monthly", priority: "0.7" },
          { path: "/partners", changefreq: "monthly", priority: "0.8" },
          { path: "/partners/districts", changefreq: "monthly", priority: "0.7" },
          { path: "/partners/schools", changefreq: "monthly", priority: "0.7" },
          { path: "/partners/case-studies", changefreq: "monthly", priority: "0.7" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/support", changefreq: "monthly", priority: "0.4" },
          { path: "/resources", changefreq: "weekly", priority: "0.6" },
          { path: "/toolkit", changefreq: "monthly", priority: "0.5" },
          { path: "/sound-board", changefreq: "monthly", priority: "0.5" },
          { path: "/ingest", changefreq: "monthly", priority: "0.5" },
          { path: "/questions", changefreq: "weekly", priority: "0.6" },
          { path: "/parents-guide", changefreq: "monthly", priority: "0.8" },
          { path: "/parents-guide/weekly-report", changefreq: "monthly", priority: "0.7" },
          { path: "/parents-guide/grading-scale", changefreq: "monthly", priority: "0.7" },
          { path: "/parents-guide/behavior-points", changefreq: "monthly", priority: "0.7" },
          { path: "/parents-guide/supporting-progress-at-home", changefreq: "monthly", priority: "0.7" },
          { path: "/help", changefreq: "weekly", priority: "0.8" },
          { path: "/help/setup-grade-tracking", changefreq: "monthly", priority: "0.8" },
          { path: "/help/grading-scale-and-weights", changefreq: "monthly", priority: "0.7" },
          { path: "/help/import-grades-from-image", changefreq: "monthly", priority: "0.7" },
          { path: "/help/weekly-reports", changefreq: "monthly", priority: "0.7" },
          { path: "/help/mobile-usage", changefreq: "monthly", priority: "0.6" },
          { path: "/help/privacy-and-pin", changefreq: "monthly", priority: "0.6" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ].filter(Boolean).join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});