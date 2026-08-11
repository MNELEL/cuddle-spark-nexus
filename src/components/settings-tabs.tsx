import { useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Palette, ShieldCheck, BellRing, FileText, Sliders } from "lucide-react";

export type SettingsTabId = "general" | "security" | "reminders" | "docs";

/** Internal navigation for the settings area. Active state comes from the URL. */
const TABS: {
  id: SettingsTabId | "brand" | "theme";
  label: string;
  icon: typeof Palette;
  to: "/settings" | "/settings/brand" | "/settings/theme";
  tab?: SettingsTabId;
}[] = [
  { id: "general", label: "כללי", icon: Sliders, to: "/settings", tab: "general" },
  { id: "security", label: "אבטחה", icon: ShieldCheck, to: "/settings", tab: "security" },
  { id: "reminders", label: "תזכורות", icon: BellRing, to: "/settings", tab: "reminders" },
  { id: "docs", label: "מסמכים", icon: FileText, to: "/settings", tab: "docs" },
  { id: "brand", label: "מותג", icon: Palette, to: "/settings/brand" },
  { id: "theme", label: "ערכת נושא", icon: Palette, to: "/settings/theme" },
];

export function SettingsTabs({ active }: { active?: SettingsTabId | "brand" | "theme" }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navRef = useRef<HTMLElement | null>(null);

  /** Arrow keys move focus between tabs (Home/End jump to the edges). */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const items = Array.from(
      navRef.current?.querySelectorAll<HTMLAnchorElement>("[data-settings-tab]") ?? [],
    );
    if (items.length === 0) return;
    const idx = items.findIndex((el) => el === document.activeElement);
    // RTL: ArrowLeft advances, ArrowRight goes back.
    const step = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0;
    let next = idx < 0 ? 0 : (idx + step + items.length) % items.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;
    e.preventDefault();
    items[next]?.focus();
  };

  const current =
    active ??
    (pathname.startsWith("/settings/brand")
      ? "brand"
      : pathname.startsWith("/settings/theme")
        ? "theme"
        : "general");

  return (
    <nav
      ref={navRef}
      aria-label="ניווט בהגדרות"
      onKeyDown={onKeyDown}
      className="mb-4 flex flex-wrap gap-1 rounded-lg border bg-card p-1"
    >
      {TABS.map((t) => {
        const isActive = current === t.id;
        return (
          <Link
            key={t.id}
            to={t.to}
            search={t.tab ? { tab: t.tab } : undefined}
            aria-current={isActive ? "page" : undefined}
            data-settings-tab={t.id}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
