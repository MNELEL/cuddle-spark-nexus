import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("settings navigation", () => {
  const layout = read("src/routes/_authenticated.tsx");
  const palette = read("src/components/global-command-palette.tsx");
  const tabs = read("src/components/settings-tabs.tsx");
  const settings = read("src/routes/_authenticated.settings.index.tsx");

  it('header "הגדרות" link points at /settings', () => {
    const link = layout.match(/<Link to="\/settings"[^>]*>[\s\S]{0,160}?<\/Link>/);
    expect(link, "header settings link missing").toBeTruthy();
    expect(link![0]).toContain("הגדרות");
  });

  it("the /settings route exists and is the settings index", () => {
    expect(settings).toContain('createFileRoute("/_authenticated/settings/")');
  });

  it("Ctrl+K palette still targets /settings/brand and /settings", () => {
    expect(palette).toContain('(e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k"');
    expect(palette).toContain('to: "/settings/brand"');
    expect(palette).toContain('to: "/settings"');
    expect(read("src/routes/_authenticated.settings.brand.tsx"))
      .toContain('createFileRoute("/_authenticated/settings/brand")');
  });

  it("settings tabs cover security, reminders, docs and brand with active state", () => {
    for (const label of ["אבטחה", "תזכורות", "מסמכים", "מותג"]) {
      expect(tabs, `missing tab ${label}`).toContain(`label: "${label}"`);
    }
    expect(tabs).toContain('aria-current={isActive ? "page" : undefined}');
    expect(settings).toContain("<SettingsTabs active={tab} />");
    expect(read("src/routes/_authenticated.settings.brand.tsx")).toContain('<SettingsTabs active="brand" />');
    expect(read("src/routes/_authenticated.settings.theme.tsx")).toContain('<SettingsTabs active="theme" />');
  });

  it("every screen offers a way back home, to the classes and to the dashboard", () => {
    const quick = read("src/components/home-quick-nav.tsx");
    expect(quick).toContain('to="/"');
    expect(quick).toContain('to="/classes"');
    expect(quick).toContain('to="/institution"');
    expect(layout).toContain("<HomeQuickNav />");
  });

  it("settings tabs support full keyboard control", () => {
    expect(tabs).toContain("ArrowRight");
    expect(tabs).toContain("ArrowLeft");
    expect(tabs).toContain('"Home"');
    expect(tabs).toContain('"End"');
    expect(tabs).toContain("onKeyDown={onKeyDown}");
    expect(tabs).toContain("focus-visible:ring-2");
    // Links are natively activated with Enter — no custom handler should shadow it.
    expect(tabs).not.toContain('e.key === "Enter"');
  });

  it("settings sub-screens keep the tabs and the global back navigation", () => {
    for (const file of [
      "src/routes/_authenticated.settings.index.tsx",
      "src/routes/_authenticated.settings.brand.tsx",
      "src/routes/_authenticated.settings.theme.tsx",
    ]) {
      expect(read(file), `${file} missing SettingsTabs`).toContain("SettingsTabs");
    }
    // HomeQuickNav lives in the authenticated layout, so it covers every sub-screen.
    expect(layout).toContain("<HomeQuickNav />");
  });

  it("a missing or forbidden class redirects to a usable fallback", () => {
    const hook = read("src/hooks/use-class-fallback.ts");
    expect(hook).toContain('to: adminFlag ? "/institution" : "/classes"');
    expect(hook).toContain("replace: true");
    expect(read("src/routes/_authenticated.classes.$classId.tsx")).toContain("useClassFallbackRedirect");
    expect(read("src/routes/_authenticated.classes.$classId.display.tsx")).toContain("useClassFallbackRedirect");
  });
});
