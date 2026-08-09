import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createClassFor,
  createInstitution,
  createTestUser,
  deleteInstitution,
  deleteTestUser,
  grantRole,
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
  let principal: TestUser;
  let classId: string;
  let className: string;
  let institutionId: string;

  beforeAll(async () => {
    owner = await createTestUser("notif-flow-owner");
    other = await createTestUser("notif-flow-other");
    principal = await createTestUser("notif-flow-principal");
    const cls = await createClassFor(owner, "כיתה — זרימת התראות");
    classId = cls.id;
    className = cls.name;

    // institution_admin (principal) scoped to the institution that owns the class
    const inst = await createInstitution(`מוסד — זרימת התראות ${crypto.randomUUID()}`);
    institutionId = inst.id;
    await grantRole(principal, "principal", institutionId);
    await adminClient().from("classes").update({ institution_id: institutionId }).eq("id", classId);

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
    await deleteTestUser(principal);
    await deleteInstitution(institutionId);
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

  it("recipient filter mismatch yields nothing, even for rows the user can read", async () => {
    // owner asks for rows addressed to `other`: filter + RLS both exclude them
    const mismatch = await owner.client
      .from("class_notifications")
      .select("id, recipient_id")
      .eq("recipient_id", other.id)
      .is("read_at", null);
    expect(mismatch.error).toBeNull();
    expect(mismatch.data ?? []).toHaveLength(0);

    // and a completely unrelated recipient id returns nothing as well
    const bogus = await owner.client
      .from("class_notifications")
      .select("id")
      .eq("recipient_id", crypto.randomUUID());
    expect(bogus.data ?? []).toHaveLength(0);

    // without any recipient filter, RLS still limits the rows to the caller's own
    const unfiltered = await owner.client.from("class_notifications").select("id, recipient_id");
    expect(unfiltered.error).toBeNull();
    expect(unfiltered.data?.length).toBeGreaterThan(0);
    expect(unfiltered.data?.every((n) => n.recipient_id === owner.id)).toBe(true);
  });

  it("an institution_admin (principal) of the class's institution still only sees their own notifications", async () => {
    // sanity: the principal really is scoped to the institution owning this class
    const role = await principal.client
      .from("user_roles")
      .select("role, institution_id")
      .eq("user_id", principal.id);
    expect(role.data?.[0]).toMatchObject({ role: "principal", institution_id: institutionId });

    const mine = await listUnread(principal);
    expect(mine.error).toBeNull();
    expect(mine.data ?? []).toHaveLength(0);

    // cannot read the teacher's notifications, with or without a recipient filter
    const spoof = await principal.client
      .from("class_notifications")
      .select("id")
      .eq("recipient_id", owner.id);
    expect(spoof.data ?? []).toHaveLength(0);

    const all = await principal.client.from("class_notifications").select("id, recipient_id");
    expect(all.error).toBeNull();
    expect(all.data ?? []).toHaveLength(0);

    // and cannot mark them read
    const target = ids[0]!;
    const upd = await principal.client
      .from("class_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", target)
      .select("id");
    expect(upd.data ?? []).toHaveLength(0);
  });
});

/**
 * Pagination + ordering must never widen the recipient filter.
 * Uses its own users/class so the counts above stay intact.
 */
describe.skipIf(!hasTestEnv)("flow: class_notifications recipient filter with pagination + ordering", () => {
  const pageIds: string[] = [];
  let mine: TestUser;
  let theirs: TestUser;
  let classId: string;
  let className: string;
  const MINE_COUNT = 12;
  const THEIRS_COUNT = 5;

  /** Same query chain as listUnreadClassNotifications, plus range/order knobs. */
  async function page(
    user: TestUser,
    opts: { ascending?: boolean; from: number; to: number; recipientId?: string; filter?: boolean }
  ) {
    let q = user.client
      .from("class_notifications")
      .select("id, recipient_id, created_at")
      .is("read_at", null);
    if (opts.filter !== false) q = q.eq("recipient_id", opts.recipientId ?? user.id);
    return q.order("created_at", { ascending: opts.ascending ?? false }).range(opts.from, opts.to);
  }

  beforeAll(async () => {
    mine = await createTestUser("notif-page-mine");
    theirs = await createTestUser("notif-page-theirs");
    const cls = await createClassFor(mine, "כיתה — דפדוף התראות");
    classId = cls.id;
    className = cls.name;

    const base = Date.now();
    const rows = [
      ...Array.from({ length: MINE_COUNT }, (_, i) => ({
        class_id: classId,
        class_name: className,
        recipient_id: mine.id,
        type: "archived_by_admin",
        created_at: new Date(base - i * 3_600_000).toISOString(),
      })),
      ...Array.from({ length: THEIRS_COUNT }, (_, i) => ({
        class_id: classId,
        class_name: className,
        recipient_id: theirs.id,
        type: "archived_by_admin",
        created_at: new Date(base - i * 3_600_000).toISOString(),
      })),
    ];
    const { data, error } = await adminClient().from("class_notifications").insert(rows).select("id");
    if (error) throw error;
    pageIds.push(...(data ?? []).map((r) => r.id));
  });

  afterAll(async () => {
    if (pageIds.length) await adminClient().from("class_notifications").delete().in("id", pageIds);
    await deleteTestUser(mine);
    await deleteTestUser(theirs);
  });

  it("each page (desc order) contains only the caller's rows", async () => {
    const first = await page(mine, { from: 0, to: 4 });
    const second = await page(mine, { from: 5, to: 9 });
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(first.data).toHaveLength(5);
    expect(second.data).toHaveLength(5);
    for (const row of [...(first.data ?? []), ...(second.data ?? [])]) {
      expect(row.recipient_id).toBe(mine.id);
    }
  });

  it("order + range without an explicit recipient filter is still limited by RLS", async () => {
    const res = await page(mine, { from: 0, to: 19, filter: false });
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(MINE_COUNT);
    expect(res.data?.every((r) => r.recipient_id === mine.id)).toBe(true);
  });

  it("ascending and descending return the same id set, reversed, with no foreign rows", async () => {
    const desc = await page(mine, { from: 0, to: 19, ascending: false });
    const asc = await page(mine, { from: 0, to: 19, ascending: true });
    const descIds = (desc.data ?? []).map((r) => r.id);
    const ascIds = (asc.data ?? []).map((r) => r.id);
    expect(descIds).toHaveLength(MINE_COUNT);
    expect([...ascIds].reverse()).toEqual(descIds);
    expect(new Set(descIds).size).toBe(MINE_COUNT);

    const foreign = await page(theirs, { from: 0, to: 19 });
    const foreignIds = new Set((foreign.data ?? []).map((r) => r.id));
    expect(descIds.some((id) => foreignIds.has(id))).toBe(false);
  });

  it("paging through everything yields each row exactly once, in non-increasing created_at order", async () => {
    const collected: string[] = [];
    const dates: string[] = [];
    for (let from = 0; from < MINE_COUNT + 5; from += 5) {
      const res = await page(mine, { from, to: from + 4 });
      expect(res.error).toBeNull();
      for (const row of res.data ?? []) {
        collected.push(row.id);
        dates.push(row.created_at);
      }
    }
    expect(new Set(collected).size).toBe(MINE_COUNT);
    expect(collected).toHaveLength(MINE_COUNT);
    for (let i = 1; i < dates.length; i += 1) {
      expect(new Date(dates[i]!).getTime()).toBeLessThanOrEqual(new Date(dates[i - 1]!).getTime());
    }
  });

  it("a page past the end is empty rather than an error", async () => {
    const res = await page(mine, { from: 100, to: 119 });
    expect(res.error).toBeNull();
    expect(res.data ?? []).toHaveLength(0);
  });

  it("paging with another user's recipient id returns nothing on every page", async () => {
    for (const from of [0, 5, 10]) {
      const res = await page(mine, { from, to: from + 4, recipientId: theirs.id });
      expect(res.error).toBeNull();
      expect(res.data ?? []).toHaveLength(0);
    }
  });

  it("the other recipient sees only their own rows on a wide page", async () => {
    const res = await page(theirs, { from: 0, to: 19 });
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(THEIRS_COUNT);
    expect(res.data?.every((r) => r.recipient_id === theirs.id)).toBe(true);
  });
});
