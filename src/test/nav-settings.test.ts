import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTestUser, deleteTestUser, hasTestEnv, type TestUser } from "./helpers";

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

/* ---------------- Contract: settings area structure ---------------- */

describe("settings area contract", () => {
  const settings = read("src/routes/_authenticated.settings.index.tsx");
  const tabs = read("src/components/settings-tabs.tsx");

  it("every declared tab is rendered by a real component in the settings page", () => {
    // general / security / reminders / docs must each map to actual content.
    expect(settings).toContain('tab === "general"');
    expect(settings).toContain('tab === "security"');
    expect(settings).toContain('tab === "reminders"');
    expect(settings).toContain('tab === "docs"');
    expect(settings).toContain("<SecuritySettings");
    expect(settings).toContain("<ReminderPreferencesCard");
    expect(settings).toContain("<SubscriptionStatusCard");
  });

  it("brand and theme are separate routes, not search tabs", () => {
    expect(tabs).toContain('to: "/settings/brand"');
    expect(tabs).toContain('to: "/settings/theme"');
    // The tab ids used in ?tab= never include brand/theme.
    expect(settings).toContain('TAB_IDS: SettingsTabId[] = ["general", "security", "reminders", "docs"]');
  });

  it("unknown /settings/* sub-paths get a branded Hebrew not-found screen", () => {
    const notFound = read("src/routes/_authenticated.settings.$.tsx");
    expect(notFound).toContain('createFileRoute("/_authenticated/settings/$")');
    expect(notFound).toContain("הדף לא נמצא באזור ההגדרות");
    expect(notFound).toContain('to="/settings"');
    expect(notFound).toContain("SettingsBreadcrumb");
  });

  it("settings area shows dedicated breadcrumbs, not the toolkit breadcrumb", () => {
    const toolBreadcrumbs = read("src/components/tool-breadcrumbs.tsx");
    expect(toolBreadcrumbs).toContain('pathname.startsWith("/settings")');
    expect(toolBreadcrumbs).toContain("return null;");

    expect(settings).toContain("Breadcrumb");
    expect(settings).toContain("SETTINGS_TAB_LABELS[tab]");

    const brandRoute = read("src/routes/_authenticated.settings.brand.tsx");
    const themeRoute = read("src/routes/_authenticated.settings.theme.tsx");
    expect(brandRoute).toContain('to="/settings"');
    expect(brandRoute).toContain("SETTINGS_TAB_LABELS.brand");
    expect(themeRoute).toContain('to="/settings"');
    expect(themeRoute).toContain("SETTINGS_TAB_LABELS.theme");
  });

  it("settings mutations are audited through logInfo with a dedicated source", () => {
    const brand = read("src/lib/brand.functions.ts");
    const security = read("src/lib/security.functions.ts");
    const reminders = read("src/lib/reminder-preferences.functions.ts");
    for (const [name, src] of [["brand", brand], ["security", security], ["reminders", reminders]] as const) {
      expect(src, `${name} missing audit log`).toContain('source: "settings_update"');
      expect(src, `${name} must lazy-import the server-only logger`).toContain(
        'await import("@/lib/logger.server")',
      );
    }
    // The PIN itself (or its hash/salt) must never reach the audit log.
    const pinLogs = security.match(/logInfo\([\s\S]*?\}\);/g) ?? [];
    expect(pinLogs.length).toBe(2);
    for (const block of pinLogs) {
      expect(block).not.toMatch(/data\.pin|pin_hash|pin_salt|\bhash\b|\bsalt\b/);
    }
  });
});

/* ---------------- Runtime: settings reads work for a fresh user ---------------- */

describe.skipIf(!hasTestEnv)("settings reads for a fresh user", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser("settings-reads");
  });

  afterAll(async () => {
    await deleteTestUser(user);
  });

  it("brand settings read returns no row instead of erroring (getBrand)", async () => {
    const { data, error } = await user.client
      .from("brand_settings")
      .select("school_name, logo_data_url, primary_color, theme")
      .eq("user_id", user.id)
      .eq("scope", "user")
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("security read returns a disabled PIN (getSecurity)", async () => {
    const { data, error } = await user.client
      .from("app_security")
      .select("pin_enabled, pin_hash")
      .eq("user_id", user.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(Boolean(data?.pin_enabled)).toBe(false);
    expect(Boolean(data?.pin_hash)).toBe(false);
  });

  it("reminder preferences read falls back to defaults (getReminderPreferences)", async () => {
    const { data, error } = await user.client
      .from("reminder_preferences")
      .select("user_id,types_enabled,lead_time_minutes")
      .eq("user_id", user.id)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull(); // the server fn substitutes the 30-minute defaults
  });

  it("trial status read finds the user's own profile (getMyTrialStatus)", async () => {
    const { data, error } = await user.client
      .from("profiles")
      .select("trial_started_at, trial_ends_at")
      .eq("id", user.id)
      .maybeSingle();
    expect(error).toBeNull();
    // A profile row must exist for the settings screen to render a trial state.
    expect(data).not.toBeNull();
  });

  it("saving reminder preferences round-trips under RLS", async () => {
    const { error } = await user.client
      .from("reminder_preferences")
      .upsert(
        {
          user_id: user.id,
          types_enabled: { lessons: true, assignments: false, messages: true },
          lead_time_minutes: 45,
        },
        { onConflict: "user_id" },
      );
    expect(error).toBeNull();

    const { data } = await user.client
      .from("reminder_preferences")
      .select("lead_time_minutes")
      .eq("user_id", user.id)
      .maybeSingle();
    expect(data?.lead_time_minutes).toBe(45);
  });
});
