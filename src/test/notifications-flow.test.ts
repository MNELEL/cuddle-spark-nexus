import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createClassFor,
  createTestUser,
  deleteTestUser,
  hasTestEnv,
  type TestUser,
} from "./helpers";

/**
 * End-to-end flow test for the class-archive notification feature.
 * Mirrors the exact queries in src/lib/notifications.functions.ts
 * (listUnreadClassNotifications / markNotificationRead) against the real DB,
 * to prove the flow still works after the generic `notifications` table was removed.
 */
const ids: string[] = [];

async function listUnread(user: TestUser) {
  // same shape as listUnreadClassNotifications
  return user.client
    .from("class_notifications")
    .select("id, class_id, class_name, type, created_at")
    .eq("recipient_id", user.id)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
}

describe.skipIf(!hasTestEnv)("flow: class_notifications end-to-end", () => {
  let owner: TestUser;
  let other: TestUser;
  let classId: string;
  let className: string;

  beforeAll(async () => {
    owner = await createTestUser("notif-flow-owner");
    other = await createTestUser("notif-flow-other");
    const cls = await createClassFor(owner, "כיתה — זרימת התראות");
    classId = cls.id;
    className = cls.name;

    const admin = adminClient();
    const rows = [
      { class_id: classId, class_name: className, recipient_id: owner.id, type: "archived_by_admin" },
      { class_id: classId, class_name: className, recipient_id: owner.id, type: "archived_by_admin" },
      { class_id: classId, class_name: className, recipient_id: other.id, type: "archived_by_admin" },
    ];
    const { data, error } = await admin.from("class_notifications").insert(rows).select("id");
    if (error) throw error;
    ids.push(...(data ?? []).map((r) => r.id));
  });

  afterAll(async () => {
    if (ids.length) await adminClient().from("class_notifications").delete().in("id", ids);
    await deleteTestUser(owner);
    await deleteTestUser(other);
  });

  it("the generic `notifications` table no longer exists", async () => {
    const probe = await adminClient().from("notifications" as never).select("id").limit(1);
    expect(probe.error).not.toBeNull();
  });

  it("loads only the signed-in recipient's unread notifications", async () => {
    const mine = await listUnread(owner);
    expect(mine.error).toBeNull();
    expect(mine.data).toHaveLength(2);
    expect(mine.data?.every((n) => n.class_id === classId)).toBe(true);
    expect(mine.data?.[0]?.class_name).toBe(className);

    const theirs = await listUnread(other);
    expect(theirs.error).toBeNull();
    expect(theirs.data).toHaveLength(1);
  });

  it("marking one read removes it from the unread list, and does not affect the other recipient", async () => {
    const first = (await listUnread(owner)).data?.[0]?.id;
    expect(first).toBeTruthy();

    // same shape as markNotificationRead
    const upd = await owner.client
      .from("class_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", first!)
      .eq("recipient_id", owner.id);
    expect(upd.error).toBeNull();

    const after = await listUnread(owner);
    expect(after.data).toHaveLength(1);
    expect(after.data?.[0]?.id).not.toBe(first);

    const theirs = await listUnread(other);
    expect(theirs.data).toHaveLength(1);
  });

  it("a recipient cannot mark someone else's notification read", async () => {
    const theirId = (await listUnread(other)).data?.[0]?.id;
    const upd = await owner.client
      .from("class_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", theirId!)
      .eq("recipient_id", other.id)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);

    const stillUnread = await listUnread(other);
    expect(stillUnread.data).toHaveLength(1);
  });
});
