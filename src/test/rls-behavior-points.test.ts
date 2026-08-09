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

describe.skipIf(!hasTestEnv)("RLS: behavior_points", () => {
  let owner: TestUser;
  let other: TestUser;
  let classId: string;
  let studentId: string;
  let pointId: string;
  const today = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    owner = await createTestUser("bp-owner");
    other = await createTestUser("bp-other");
    classId = (await createClassFor(owner, "כיתה — התנהגות")).id;
    studentId = (await createStudentFor(owner, classId, "מנחם רוזן")).id;
  });

  afterAll(async () => {
    await deleteTestUser(owner);
    await deleteTestUser(other);
  });

  it("owner can award and read behavior points", async () => {
    const ins = await owner.client
      .from("behavior_points")
      .insert({ class_id: classId, student_id: studentId, category: "התמדה", points: 3, date: today })
      .select("id, points")
      .single();
    expect(ins.error).toBeNull();
    pointId = ins.data!.id;

    const read = await owner.client.from("behavior_points").select("id, points").eq("id", pointId);
    expect(read.data?.[0]?.points).toBe(3);
  });

  it("another teacher cannot read or modify them", async () => {
    const read = await other.client.from("behavior_points").select("id").eq("id", pointId);
    expect(read.data ?? []).toHaveLength(0);

    const upd = await other.client
      .from("behavior_points")
      .update({ points: 99 })
      .eq("id", pointId)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);

    const check = await owner.client
      .from("behavior_points")
      .select("points")
      .eq("id", pointId)
      .single();
    expect(check.data?.points).toBe(3);
  });

  it("anon cannot read or insert behavior points", async () => {
    const anon = anonClient();
    const read = await anon.from("behavior_points").select("id").eq("id", pointId);
    expect(read.data ?? []).toHaveLength(0);

    const ins = await anon
      .from("behavior_points")
      .insert({ class_id: classId, student_id: studentId, category: "anon", points: 1, date: today })
      .select("id");
    expect(ins.error).not.toBeNull();
  });
});
