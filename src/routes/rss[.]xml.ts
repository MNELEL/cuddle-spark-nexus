import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { blogPostsNewestFirst } from "@/lib/blog-posts";
import { SITE_NAME, SITE_URL } from "@/lib/site-meta";

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const rfc822 = (isoDate: string) => new Date(`${isoDate}T09:00:00Z`).toUTCString();

export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: () => {
        const posts = blogPostsNewestFirst();
        const items = posts.map((p) => {
          const url = `${SITE_URL}${p.path}`;
          return [
            `    <item>`,
            `      <title>${escapeXml(p.title)}</title>`,
            `      <link>${url}</link>`,
            `      <guid isPermaLink="true">${url}</guid>`,
            `      <pubDate>${rfc822(p.published)}</pubDate>`,
            `      <description>${escapeXml(p.description)}</description>`,
            `      <enclosure url="${escapeXml(p.image)}" type="image/jpeg" length="0" />`,
            `    </item>`,
          ].join("\n");
        });

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
          `  <channel>`,
          `    <title>בלוג ${escapeXml(SITE_NAME)} — מדריכים למלמדים ולרבנים</title>`,
          `    <link>${SITE_URL}/blog</link>`,
          `    <description>מדריכים מקצועיים לניהול כיתה בתלמודי תורה, חיידרים ובתי ספר.</description>`,
          `    <language>he</language>`,
          `    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />`,
          posts[0] ? `    <lastBuildDate>${rfc822(posts[0].published)}</lastBuildDate>` : null,
          ...items,
          `  </channel>`,
          `</rss>`,
        ]
          .filter(Boolean)
          .join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=600, s-maxage=600",
          },
        });
      },
    },
  },
});
