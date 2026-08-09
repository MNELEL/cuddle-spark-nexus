import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClassFor, createTestUser, deleteTestUser, hasTestEnv, type TestUser } from "./helpers";

describe.skipIf(!hasTestEnv)("RLS: classes", () => {
  let teacherA: TestUser;
  let teacherB: TestUser;
  let classId: string;

  beforeAll(async () => {
    teacherA = await createTestUser("a");
    teacherB = await createTestUser("b");
    classId = (await createClassFor(teacherA, "כיתה א׳ — טסט")).id;
  });

  afterAll(async () => {
    await deleteTestUser(teacherA);
    await deleteTestUser(teacherB);
  });

  it("owner can read and update their own class", async () => {
    const read = await teacherA.client.from("classes").select("id, name").eq("id", classId);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(1);

    const upd = await teacherA.client
      .from("classes")
      .update({ name: "כיתה א׳ — עודכן" })
      .eq("id", classId)
      .select("id");
    expect(upd.error).toBeNull();
    expect(upd.data).toHaveLength(1);
  });

  it("another teacher cannot read the class", async () => {
    const read = await teacherB.client.from("classes").select("id").eq("id", classId);
    expect(read.data ?? []).toHaveLength(0);
  });

  it("another teacher cannot update the class", async () => {
    const upd = await teacherB.client
      .from("classes")
      .update({ name: "hijacked" })
      .eq("id", classId)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);

    const check = await teacherA.client.from("classes").select("name").eq("id", classId).single();
    expect(check.data?.name).not.toBe("hijacked");
  });
});