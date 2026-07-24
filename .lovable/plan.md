# Verify /blog/free-tools-comparison indexing in Google Search Console

The last SEO scan shows Google Search Console is not connected yet (`gsc:gsc`, state: ignored). Without a connection there's no way to read indexing status or crawl errors — the check needs GSC access first.

## Steps

1. **Connect GSC.** Call `standard_connectors--connect` with `connector_id: "google_search_console"` so you can authorize the OAuth flow inline.
2. **Confirm the property is verified.** `GET /webmasters/v3/sites` and look for `https://cuddle-spark-nexus.lovable.app/` (URL-prefix) or `sc-domain:cuddle-spark-nexus.lovable.app`. If it's not there, verify it with the META flow:
   - `POST /siteVerification/v1/token` with `{"site":{"identifier":"https://cuddle-spark-nexus.lovable.app/","type":"SITE"},"verificationMethod":"META"}`
   - Add the returned `<meta name="google-site-verification" ...>` to `src/routes/__root.tsx` head, publish
   - `POST /siteVerification/v1/webResource?verificationMethod=META`
   - `PUT /webmasters/v3/sites/https%3A%2F%2Fcuddle-spark-nexus.lovable.app%2F`
3. **Inspect the URL.** `POST /v1/urlInspection/index:inspect` with:
   ```json
   {"inspectionUrl":"https://cuddle-spark-nexus.lovable.app/blog/free-tools-comparison",
    "siteUrl":"https://cuddle-spark-nexus.lovable.app/"}
   ```
4. **Report back** the `coverageState`, `indexingState`, `lastCrawlTime`, `pageFetchState`, `robotsTxtState`, `mobileUsabilityResult`, and any `crawledAs` / error fields. If not yet indexed, note it (new pages typically take days–weeks) and suggest submitting the sitemap and requesting indexing from the GSC UI.

## What I will not do without confirmation

- Won't ask for account credentials — the connector handles OAuth.
- Won't modify robots.txt or sitemap (already correct for this URL).
- Won't submit a re-indexing request; the URL inspection API is read-only. Manual "Request Indexing" still requires the GSC web UI.

## Expected outcome

Either a clean report (URL is on Google, no crawl errors) or a specific diagnosis (not indexed yet, blocked by robots, soft-404, discovered-not-indexed, etc.) with a concrete next step.
