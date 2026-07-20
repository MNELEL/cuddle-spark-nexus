import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type FaqItem = { q: string; a: string };

export function faqJsonLd(items: FaqItem[]) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: "he",
      mainEntity: items.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    }),
  } as const;
}

export function FaqSection({
  items,
  title = "שאלות נפוצות",
  intro,
}: {
  items: FaqItem[];
  title?: string;
  intro?: string;
}) {
  return (
    <section aria-labelledby="faq-heading" className="max-w-3xl mx-auto">
      <h2 id="faq-heading" className="text-2xl font-bold mb-2 text-center">{title}</h2>
      {intro ? <p className="text-center text-muted-foreground mb-6">{intro}</p> : null}
      <div className="divide-y rounded-2xl border bg-card">
        {items.map((item, i) => (
          <FaqRow key={i} item={item} defaultOpen={i === 0} />
        ))}
      </div>
    </section>
  );
}

function FaqRow({ item, defaultOpen }: { item: FaqItem; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="group"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-start font-semibold list-none [&::-webkit-details-marker]:hidden">
        <span>{item.q}</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5 text-muted-foreground leading-relaxed">{item.a}</div>
    </details>
  );
}