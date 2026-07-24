Scope: Update the existing `/blog/free-tools-comparison` route to include a collapsible FAQ section and `FAQPage` structured data, improving accessibility and SEO rich-results eligibility.

Changes:
1. Import the reusable `FaqSection` component and `faqJsonLd` helper from `@/components/faq-section`.
2. Add a Hebrew FAQ array (5–6 items) covering: whether the tools are truly free, privacy/PII, Hebrew/RTL support, exporting data, suitability for Charedi classrooms, and migration from paper/Excel.
3. Render the FAQ section near the bottom of the article, before the related guides block.
4. Append a second `application/ld+json` script in `head()` with `FAQPage` schema while keeping the existing `Article` schema.
5. Verify with `tsgo --noEmit` and a quick preview check that the page renders and the JSON-LD is emitted.

No new dependencies, no backend changes, no route changes.