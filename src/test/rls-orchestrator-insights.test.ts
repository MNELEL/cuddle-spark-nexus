import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createClassFor, createTestUser, deleteTestUser, hasTestEnv, type TestUser } from "./helpers";

describe.skipIf(!hasTestEnv)("RLS: orchestrator_insights insertion", () => {
  let owner: TestUser;
  let other: TestUser;
  let classId: string;
  let foreignClassId: string;
  const row = (ownerId: string, targetClass = classId) => ({
    owner_id: ownerId, class_id: targetClass, insight_type: "manual", severity: "low",
    title: "בדיקת הרשאת תובנה", description: "נתוני בדיקה זמניים", insight_date: "2026-10-27",
  });
  beforeAll(async () => {
    owner = await createTestUser("insight-owner");
    other = await createTestUser("insight-other");
    classId = (await createClassFor(owner, "בדיקת תובנות זמנית")).id;
    foreignClassId = (await createClassFor(other, "בדיקת כיתה אחרת")).id;
  });
  afterAll(async () => {
    const admin = adminClient();
    if (classId) await admin.from("orchestrator_insights").delete().eq("class_id", classId);
    if (foreignClassId) await admin.from("orchestrator_insights").delete().eq("class_id", foreignClassId);
    if (classId) await admin.from("classes").delete().eq("id", classId);
    if (foreignClassId) await admin.from("classes").delete().eq("id", foreignClassId);
    await deleteTestUser(owner);
    await deleteTestUser(other);
  });
  it("allows the owner to insert and read their class insight", async () => {
    const result = await owner.client.from("orchestrator_insights").insert(row(owner.id)).select("id,owner_id,class_id").single();
    expect(result.error).toBeNull();
    expect(result.data?.owner_id).toBe(owner.id);
    expect(result.data?.class_id).toBe(classId);
  });
  it("rejects a forged row owner", async () => {
    const result = await owner.client.from("orchestrator_insights").insert(row(other.id));
    expect(result.error?.code).toBe("42501");
  });
  it("rejects an authenticated user's insertion into someone else's class", async () => {
    const result = await owner.client.from("orchestrator_insights").insert(row(owner.id, foreignClassId));
    expect(result.error?.code).toBe("42501");
  });
  it("does not allow guest insertion", async () => {
    const result = await anonClient().from("orchestrator_insights").insert(row(owner.id));
    expect(result.error).not.toBeNull();
  });
});