import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createInstitution,
  createTestUser,
  deleteInstitution,
  deleteTestUser,
  grantRole,
  hasTestEnv,
  type TestUser,
} from "./helpers";

/**
 * Covers institutions + user_roles, and in particular that
 * `private.is_institution_admin` accepts BOTH `admin` and `principal`.
 */
describe.skipIf(!hasTestEnv)("RLS: institutions & user_roles", () => {
  let instAdmin: TestUser;
  let principal: TestUser;
  let teacher: TestUser;
  let outsider: TestUser;
  let institutionId: string;
  let otherInstitutionId: string;

  beforeAll(async () => {
    instAdmin = await createTestUser("inst-admin");
    principal = await createTestUser("inst-principal");
    teacher = await createTestUser("inst-teacher");
    outsider = await createTestUser("inst-outsider");

    institutionId = (await createInstitution("תלמוד תורה — טסט")).id;
    otherInstitutionId = (await createInstitution("מוסד אחר — טסט")).id;

    await grantRole(instAdmin, "admin", institutionId);
    await grantRole(principal, "principal", institutionId);
    await grantRole(teacher, "teacher", institutionId);
    await grantRole(outsider, "teacher", otherInstitutionId);
  });

  afterAll(async () => {
    await adminClient().from("user_roles").delete().in("institution_id", [institutionId, otherInstitutionId]);
    await deleteInstitution(institutionId);
    await deleteInstitution(otherInstitutionId);
    await deleteTestUser(instAdmin);
    await deleteTestUser(principal);
    await deleteTestUser(teacher);
    await deleteTestUser(outsider);
  });

  it("members can view their own institution", async () => {
    for (const u of [instAdmin, principal, teacher]) {
      const read = await u.client.from("institutions").select("id, name").eq("id", institutionId);
      expect(read.error).toBeNull();
      expect(read.data, `member ${u.email}`).toHaveLength(1);
    }
  });

  it("a member of another institution cannot view it", async () => {
    const read = await outsider.client.from("institutions").select("id").eq("id", institutionId);
    expect(read.data ?? []).toHaveLength(0);
  });

  it("both admin and principal can update their institution", async () => {
    for (const [label, u] of [["admin", instAdmin], ["principal", principal]] as const) {
      const upd = await u.client
        .from("institutions")
        .update({ name: `מוסד — ${label}` })
        .eq("id", institutionId)
        .select("id, name");
      expect(upd.error, label).toBeNull();
      expect(upd.data, label).toHaveLength(1);
    }
  });

  it("a plain teacher cannot update the institution", async () => {
    const upd = await teacher.client
      .from("institutions")
      .update({ name: "hijacked" })
      .eq("id", institutionId)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);

    const check = await adminClient().from("institutions").select("name").eq("id", institutionId).single();
    expect(check.data?.name).not.toBe("hijacked");
  });

  it("both admin and principal can manage roles in their institution", async () => {
    for (const [label, u] of [["admin", instAdmin], ["principal", principal]] as const) {
      const target = await createTestUser(`inst-target-${label}`);
      try {
        const ins = await u.client
          .from("user_roles")
          .insert({ user_id: target.id, role: "teacher", institution_id: institutionId })
          .select("id");
        expect(ins.error, label).toBeNull();
        expect(ins.data, label).toHaveLength(1);

        const del = await u.client.from("user_roles").delete().eq("user_id", target.id).select("id");
        expect(del.data, label).toHaveLength(1);
      } finally {
        await deleteTestUser(target);
      }
    }
  });

  it("a plain teacher cannot grant roles", async () => {
    const ins = await teacher.client
      .from("user_roles")
      .insert({ user_id: teacher.id, role: "principal", institution_id: institutionId })
      .select("id");
    expect(ins.error).not.toBeNull();
  });

  it("an outsider cannot grant roles in someone else's institution", async () => {
    const ins = await outsider.client
      .from("user_roles")
      .insert({ user_id: outsider.id, role: "admin", institution_id: institutionId })
      .select("id");
    expect(ins.error).not.toBeNull();
  });

  it("users see only their own role rows", async () => {
    const read = await teacher.client.from("user_roles").select("user_id, role");
    expect(read.error).toBeNull();
    expect((read.data ?? []).every((r) => r.user_id === teacher.id)).toBe(true);
  });

  it("anon sees no institutions and cannot create one", async () => {
    const anon = anonClient();
    const read = await anon.from("institutions").select("id").eq("id", institutionId);
    expect(read.data ?? []).toHaveLength(0);

    const ins = await anon.from("institutions").insert({ name: "anon" }).select("id");
    expect(ins.error).not.toBeNull();
  });
});
