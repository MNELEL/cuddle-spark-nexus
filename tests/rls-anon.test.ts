import { describe, expect, it } from "vitest";
import { anonClient, isBlocked } from "./anon-client";

const supabase = anonClient();
const suite = supabase ? describe : describe.skip;

/**
 * Anonymous (unauthenticated) access must never leak owner-scoped rows.
 * A pass = the Data API errors OR returns zero rows.
 */
suite("RLS: anonymous reads are blocked", () => {
  const tables = [
    "classes",
    "students",
    "student_profiles",
    "grades",
    "attendance",
    "behavior_points",
    "discipline_events",
    "student_documents",
    "parent_communications",
    "profiles",
    "user_roles",
    "app_logs",
    "partner_leads",
    "checklist_leads",
    "notifications",
  ] as const;

  for (const table of tables) {
    it(`blocks anon SELECT on ${table}`, async () => {
      const res = await supabase!.from(table).select("*").limit(1);
      expect(isBlocked(res), `anon leaked rows from ${table}`).toBe(true);
    });
  }
});

suite("RLS: anonymous writes are blocked", () => {
  it("rejects anon INSERT into classes", async () => {
    const res = await supabase!
      .from("classes")
      .insert({ name: "rls-probe", owner_id: crypto.randomUUID() } as never)
      .select();
    expect(res.error, "anon was able to insert a class").toBeTruthy();
  });

  it("rejects anon INSERT into student_profiles", async () => {
    const res = await supabase!
      .from("student_profiles")
      .insert({
        student_id: crypto.randomUUID(),
        class_id: crypto.randomUUID(),
        sensitive_notes: "rls-probe",
      } as never)
      .select();
    expect(res.error, "anon was able to insert a sensitive student profile").toBeTruthy();
  });

  it("rejects anon INSERT into notifications (spoofed cross-user notice)", async () => {
    const res = await supabase!
      .from("notifications")
      .insert({
        recipient_id: crypto.randomUUID(),
        type: "class_archived",
        title: "rls-probe",
      } as never)
      .select();
    expect(res.error, "anon was able to insert a notification").toBeTruthy();
  });

  it("rejects anon UPDATE of classes status (archive bypass attempt)", async () => {
    const res = await supabase!.from("classes").update({ status: "archived" } as never).neq("id", crypto.randomUUID()).select();
    expect(isBlocked(res), "anon was able to archive classes").toBe(true);
  });

  it("rejects anon role escalation via user_roles", async () => {
    const res = await supabase!
      .from("user_roles")
      .insert({ user_id: crypto.randomUUID(), role: "admin" } as never)
      .select();
    expect(res.error, "anon was able to grant itself a role").toBeTruthy();
  });
});