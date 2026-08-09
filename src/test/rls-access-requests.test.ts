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
 * Access to the user-management screen is decided server-side by the caller's
 * rows in `user_roles`, and the review queue itself is protected by RLS:
 * plain users only see their own request, admins/principals see the queue,
 * and only admins may resolve requests.
 */
describe.skipIf(!hasTestEnv)("RLS: access_requests & user-management gating", () => {
  let sysAdmin: TestUser;
  let principal: TestUser;
  let teacher: TestUser;
  let otherTeacher: TestUser;
  let institutionId: string;
  let teacherRequestId: string;

  beforeAll(async () => {
    sysAdmin = await createTestUser("ar-admin");
    principal = await createTestUser("ar-principal");
    teacher = await createTestUser("ar-teacher");
    otherTeacher = await createTestUser("ar-teacher2");

    institutionId = (await createInstitution("מוסד בקשות — טסט")).id;
    await grantRole(sysAdmin, "admin");
    await grantRole(principal, "principal", institutionId);

    const insert = await teacher.client
      .from("access_requests")
      .insert({ user_id: teacher.id, email: teacher.email, requested_role: "principal", message: "צריך גישה" })
      .select()
      .single();
    expect(insert.error).toBeNull();
    teacherRequestId = insert.data!.id;
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("access_requests").delete().in("user_id", [teacher.id, otherTeacher.id]);
    await admin.from("user_roles").delete().in("user_id", [sysAdmin.id, principal.id]);
    await deleteInstitution(institutionId);
    await deleteTestUser(sysAdmin);
    await deleteTestUser(principal);
    await deleteTestUser(teacher);
    await deleteTestUser(otherTeacher);
  });

  it("blocks anonymous visitors entirely", async () => {
    const read = await anonClient().from("access_requests").select("id");
    expect(read.data ?? []).toHaveLength(0);
    const write = await anonClient()
      .from("access_requests")
      .insert({ user_id: teacher.id, requested_role: "admin" });
    expect(write.error).not.toBeNull();
  });

  it("a plain user sees only their own request", async () => {
    const mine = await teacher.client.from("access_requests").select("id, user_id");
    expect(mine.error).toBeNull();
    expect(mine.data).toHaveLength(1);
    expect(mine.data![0]!.user_id).toBe(teacher.id);

    const others = await otherTeacher.client.from("access_requests").select("id");
    expect(others.data ?? []).toHaveLength(0);
  });

  it("admins and principals can read the review queue", async () => {
    for (const u of [sysAdmin, principal]) {
      const read = await u.client.from("access_requests").select("id").eq("id", teacherRequestId);
      expect(read.error, `manager ${u.email}`).toBeNull();
      expect(read.data, `manager ${u.email}`).toHaveLength(1);
    }
  });

  it("only a system admin can resolve a request", async () => {
    const byPrincipal = await principal.client
      .from("access_requests")
      .update({ status: "approved" })
      .eq("id", teacherRequestId)
      .select();
    expect(byPrincipal.data ?? []).toHaveLength(0);

    const bySelf = await teacher.client
      .from("access_requests")
      .update({ status: "approved" })
      .eq("id", teacherRequestId)
      .select();
    expect(bySelf.data ?? []).toHaveLength(0);

    const byAdmin = await sysAdmin.client
      .from("access_requests")
      .update({ status: "approved", reviewed_by: sysAdmin.id })
      .eq("id", teacherRequestId)
      .select();
    expect(byAdmin.error).toBeNull();
    expect(byAdmin.data).toHaveLength(1);
    expect(byAdmin.data![0]!.status).toBe("approved");
  });

  it("user-management gating: only admin/principal rows grant access", async () => {
    async function roleGate(u: TestUser) {
      const { data } = await u.client
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id)
        .in("role", ["admin", "principal"]);
      const roles = (data ?? []).map((r) => r.role);
      return { canManage: roles.length > 0, isAdmin: roles.includes("admin") };
    }

    expect(await roleGate(sysAdmin)).toEqual({ canManage: true, isAdmin: true });
    expect(await roleGate(principal)).toEqual({ canManage: true, isAdmin: false });
    expect(await roleGate(teacher)).toEqual({ canManage: false, isAdmin: false });
  });

  it("a plain user cannot self-grant a role to reach /settings admin links", async () => {
    const escalate = await teacher.client
      .from("user_roles")
      .insert({ user_id: teacher.id, role: "admin" })
      .select();
    expect(escalate.error).not.toBeNull();
    expect(escalate.data ?? []).toHaveLength(0);
  });

  it("the requester may only acknowledge their own result", async () => {
    const ack = await teacher.client
      .from("access_requests")
      .update({ seen_by_requester_at: new Date().toISOString() })
      .eq("id", teacherRequestId)
      .select();
    expect(ack.error).toBeNull();
    expect(ack.data).toHaveLength(1);
    expect(ack.data![0]!.seen_by_requester_at).not.toBeNull();
  });

  it("the requester cannot change the decision fields", async () => {
    const tamper = await teacher.client
      .from("access_requests")
      .update({ granted_role: "admin", review_note: "מזויף" })
      .eq("id", teacherRequestId)
      .select();
    expect(tamper.error).not.toBeNull();

    const row = await adminClient()
      .from("access_requests")
      .select("granted_role, review_note")
      .eq("id", teacherRequestId)
      .single();
    expect(row.data!.granted_role).toBeNull();
  });

  it("a requester cannot acknowledge someone else's request", async () => {
    const other = await otherTeacher.client
      .from("access_requests")
      .update({ seen_by_requester_at: new Date().toISOString() })
      .eq("id", teacherRequestId)
      .select();
    expect(other.data ?? []).toHaveLength(0);
  });
});
