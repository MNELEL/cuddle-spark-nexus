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
 * Self-service trial extension requests: a user may create and read only their own
 * request (and only one pending at a time), managers may read the queue, and only
 * a system admin may approve/reject.
 */
describe.skipIf(!hasTestEnv)("RLS: trial_extension_requests", () => {
  let sysAdmin: TestUser;
  let principal: TestUser;
  let teacher: TestUser;
  let otherTeacher: TestUser;
  let institutionId: string;
  let requestId: string;

  beforeAll(async () => {
    sysAdmin = await createTestUser("tr-admin");
    principal = await createTestUser("tr-principal");
    teacher = await createTestUser("tr-teacher");
    otherTeacher = await createTestUser("tr-teacher2");

    institutionId = (await createInstitution(`מוסד הארכות — ${crypto.randomUUID()}`)).id;
    await grantRole(sysAdmin, "admin");
    await grantRole(principal, "principal", institutionId);

    const insert = await teacher.client
      .from("trial_extension_requests")
      .insert({
        user_id: teacher.id,
        email: teacher.email,
        institution_name: "תלמוד תורה טסט",
        message: "רוצים להמשיך את השנה",
        requested_days: 30,
      })
      .select()
      .single();
    expect(insert.error).toBeNull();
    requestId = insert.data!.id;
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin
      .from("trial_extension_requests")
      .delete()
      .in("user_id", [teacher.id, otherTeacher.id]);
    await admin.from("user_roles").delete().in("user_id", [sysAdmin.id, principal.id]);
    await deleteInstitution(institutionId);
    await deleteTestUser(sysAdmin);
    await deleteTestUser(principal);
    await deleteTestUser(teacher);
    await deleteTestUser(otherTeacher);
  });

  it("blocks anonymous visitors entirely", async () => {
    const read = await anonClient().from("trial_extension_requests").select("id");
    expect(read.data ?? []).toHaveLength(0);
  });

  it("a user reads only their own request", async () => {
    const mine = await teacher.client.from("trial_extension_requests").select("id, user_id");
    expect(mine.error).toBeNull();
    expect(mine.data ?? []).toHaveLength(1);
    expect(mine.data?.[0]?.user_id).toBe(teacher.id);

    const theirs = await otherTeacher.client.from("trial_extension_requests").select("id");
    expect(theirs.data ?? []).toHaveLength(0);
  });

  it("a user cannot open a request on someone else's behalf", async () => {
    const spoof = await otherTeacher.client
      .from("trial_extension_requests")
      .insert({ user_id: teacher.id, requested_days: 365 })
      .select();
    expect(spoof.error).not.toBeNull();
  });

  it("only one pending request per user", async () => {
    const dup = await teacher.client
      .from("trial_extension_requests")
      .insert({ user_id: teacher.id, requested_days: 30 })
      .select();
    expect(dup.error).not.toBeNull();
  });

  it("a user cannot approve their own request", async () => {
    const upd = await teacher.client
      .from("trial_extension_requests")
      .update({ status: "approved", granted_days: 365 })
      .eq("id", requestId)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);

    const row = await adminClient()
      .from("trial_extension_requests")
      .select("status")
      .eq("id", requestId)
      .single();
    expect(row.data?.status).toBe("pending");
  });

  it("a principal may read the queue but not review it", async () => {
    const read = await principal.client
      .from("trial_extension_requests")
      .select("id, status")
      .eq("status", "pending");
    expect(read.error).toBeNull();
    expect((read.data ?? []).some((r) => r.id === requestId)).toBe(true);

    const upd = await principal.client
      .from("trial_extension_requests")
      .update({ status: "rejected" })
      .eq("id", requestId)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);
  });

  it("a system admin approves the request in one action", async () => {
    const upd = await sysAdmin.client
      .from("trial_extension_requests")
      .update({
        status: "approved",
        granted_days: 365,
        reviewed_by: sysAdmin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select("id, status, granted_days");
    expect(upd.error).toBeNull();
    expect(upd.data ?? []).toHaveLength(1);
    expect(upd.data?.[0]?.status).toBe("approved");
    expect(upd.data?.[0]?.granted_days).toBe(365);

    // once resolved, the user may open a fresh request
    const again = await teacher.client
      .from("trial_extension_requests")
      .insert({ user_id: teacher.id, requested_days: 30 })
      .select("id");
    expect(again.error).toBeNull();
    expect(again.data ?? []).toHaveLength(1);
  });
});
