import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createClassFor,
  createStudentFor,
  createTestUser,
  deleteTestUser,
  hasTestEnv,
  type TestUser,
} from "./helpers";

describe.skipIf(!hasTestEnv)("RLS: students", () => {
  let owner: TestUser;
  let other: TestUser;
  let classId: string;
  let studentId: string;

  beforeAll(async () => {
    owner = await createTestUser("stud-owner");
    other = await createTestUser("stud-other");
    classId = (await createClassFor(owner, "כיתה — תלמידים")).id;
    studentId = (await createStudentFor(owner, classId, "יוסי כהן")).id;
  });

  afterAll(async () => {
    await deleteTestUser(owner);
    await deleteTestUser(other);
  });

  it("owner can read and update their student", async () => {
    const read = await owner.client.from("students").select("id, name").eq("id", studentId);
    expect(read.error).toBeNull();
    expect(read.data).toHaveLength(1);

    const upd = await owner.client
      .from("students")
      .update({ address: "רחוב הרב קוק 5" })
      .eq("id", studentId)
      .select("id, address");
    expect(upd.error).toBeNull();
    expect(upd.data?.[0]?.address).toBe("רחוב הרב קוק 5");
  });

  it("another teacher cannot read or update the student", async () => {
    const read = await other.client.from("students").select("id").eq("id", studentId);
    expect(read.data ?? []).toHaveLength(0);

    const upd = await other.client
      .from("students")
      .update({ name: "hijacked" })
      .eq("id", studentId)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);

    const check = await owner.client.from("students").select("name").eq("id", studentId).single();
    expect(check.data?.name).not.toBe("hijacked");
  });

  it("anon has no access at all (REVOKE still in force)", async () => {
    const anon = anonClient();
    const read = await anon.from("students").select("id").eq("id", studentId);
    expect(read.data ?? []).toHaveLength(0);

    const upd = await anon.from("students").update({ name: "anon" }).eq("id", studentId).select("id");
    expect(upd.data ?? []).toHaveLength(0);

    const ins = await anon.from("students").insert({ class_id: classId, name: "anon" }).select("id");
    expect(ins.error).not.toBeNull();
  });

  it("sync_student_name keeps `name` in sync with first/last name", async () => {
    const upd = await owner.client
      .from("students")
      .update({ first_name: "שמואל", last_name: "לוי" })
      .eq("id", studentId)
      .select("name, first_name, last_name")
      .single();
    expect(upd.error).toBeNull();
    expect(upd.data?.name).toBe("שמואל לוי");

    // A partial update that touches neither name part must not blank `name`.
    const partial = await owner.client
      .from("students")
      .update({ notes: "הערה" })
      .eq("id", studentId)
      .select("name")
      .single();
    expect(partial.data?.name).toBe("שמואל לוי");
  });
});
