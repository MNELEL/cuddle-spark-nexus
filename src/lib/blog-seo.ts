/**
 * Shared head() builder for blog post routes: canonical + Open Graph +
 * Twitter card + BlogPosting JSON-LD, all derived from BLOG_POSTS so a post's
 * metadata can never drift between the feed, the sitemap and the page itself.
 */
import { SITE_NAME, SITE_URL } from "@/lib/site-meta";
import { findBlogPost } from "@/lib/blog-posts";

export const RSS_PATH = "/rss.xml";

type Json = Record<string, unknown>;

export function blogPostHead(path: string, extraJsonLd: Json[] = []) {
  const post = findBlogPost(path);
  const url = `${SITE_URL}${path}`;
  const title = post?.title ?? SITE_NAME;
  const description = post?.description ?? "";
  const image = post?.image;

  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: url },
    { property: "og:site_name", content: SITE_NAME },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (image) {
    meta.push(
      { property: "og:image", content: image },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: title },
      { name: "twitter:image", content: image },
    );
  }

  const blogPosting: Json = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    inLanguage: "he",
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(image ? { image: [image] } : {}),
    ...(post ? { datePublished: post.published, dateModified: post.published } : {}),
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    isPartOf: { "@type": "Blog", name: `בלוג ${SITE_NAME}`, url: `${SITE_URL}/blog` },
  };

  return {
    meta,
    links: [
      { rel: "canonical", href: url },
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: `בלוג ${SITE_NAME} — RSS`,
        href: `${SITE_URL}${RSS_PATH}`,
      },
    ],
    scripts: [blogPosting, ...extraJsonLd].map((obj) => ({
      type: "application/ld+json",
      children: JSON.stringify(obj),
    })),
  };
}
