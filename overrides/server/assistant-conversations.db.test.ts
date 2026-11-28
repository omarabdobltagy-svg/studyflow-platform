import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, type Pool, type ResultSetHeader } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import {
  clearAIActivityForTests,
  completeAIActivity,
  flushAIActivityPersistenceForTests,
  getDurableAIActivitySnapshot,
  setAIActivityPersistenceForTests,
  startAIActivity,
  updateAIActivity,
} from "./aiActivity";
import {
  deleteAssistantConversation,
  listAssistantConversations,
  saveAssistantConversation,
  setDbForTests,
} from "./db";

function getDedicatedTestDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (process.env.NODE_ENV !== "test" || !value) return null;
  try {
    const parsed = new URL(value);
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    return databaseName.endsWith("_test") ? value : null;
  } catch {
    return null;
  }
}

const testDatabaseUrl = getDedicatedTestDatabaseUrl();
const databaseSuite = testDatabaseUrl ? describe : describe.skip;

databaseSuite("assistant conversation MySQL ownership and persistence", () => {
  let pool: Pool;
  let userA: number;
  let userB: number;

  beforeAll(async () => {
    pool = createPool(testDatabaseUrl!);
    setDbForTests(drizzle(pool));

    const [first] = await pool.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name) VALUES (?, ?)",
      ["assistant-history-test-a-" + randomUUID(), "Assistant history integration A"],
    );
    const [second] = await pool.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name) VALUES (?, ?)",
      ["assistant-history-test-b-" + randomUUID(), "Assistant history integration B"],
    );
    userA = Number(first.insertId);
    userB = Number(second.insertId);
  });

  afterAll(async () => {
    if (pool) {
      const userIds = [userA, userB].filter(Number.isInteger);
      if (userIds.length) {
        await pool.execute(
          "DELETE FROM users WHERE id IN (" + userIds.map(() => "?").join(",") + ")",
          userIds,
        );
      }
      setDbForTests(undefined);
      await pool.end();
    }
  });

  it("restores background AI stages from the database after in-memory state is cleared", async () => {
    setAIActivityPersistenceForTests(true);
    try {
      const activityId = startAIActivity(userA, {
        kind: "daily_plan",
        title: "إعادة ترتيب خطة الطالب",
        stage: "تجميع السياق",
        detail: "يجمع التقدم والمهام والمواعيد.",
      });
      updateAIActivity(userA, activityId, "مطابقة المنهج", "يربط مواضع الدروس بفهرس المنهج.");
      updateAIActivity(userA, activityId, "مواءمة الجدول", "يراعي مواعيد المدرسين وسعة الأيام.");
      completeAIActivity(userA, activityId, "اكتملت الخطة وحُفظت.");

      await flushAIActivityPersistenceForTests(userA);
      clearAIActivityForTests();

      const restored = await getDurableAIActivitySnapshot(userA);
      expect(restored.active).toEqual([]);
      expect(restored.recent[0]).toMatchObject({
        id: activityId,
        kind: "daily_plan",
        status: "complete",
        stage: "اكتملت العملية",
        detail: "اكتملت الخطة وحُفظت.",
      });
      expect(restored.recent[0].events.map(event => event.stage)).toEqual([
        "تجميع السياق",
        "مطابقة المنهج",
        "مواءمة الجدول",
        "اكتملت العملية",
      ]);
      expect(await getDurableAIActivitySnapshot(userB)).toEqual({ active: [], recent: [] });
    } finally {
      await flushAIActivityPersistenceForTests(userA);
      clearAIActivityForTests();
      setAIActivityPersistenceForTests(false);
    }
  });

  it("isolates same client IDs between accounts and persists updates and deletes", async () => {
    const clientId = "shared-client-id-" + randomUUID();
    await saveAssistantConversation(userA, {
      clientId,
      title: "محادثة الطالب الأول",
      messages: [
        { role: "user", content: "سؤال الطالب الأول" },
        { role: "assistant", content: "إجابة الطالب الأول" },
      ],
    });
    await saveAssistantConversation(userB, {
      clientId,
      title: "محادثة الطالب الثاني",
      messages: [
        { role: "user", content: "سؤال الطالب الثاني" },
        { role: "assistant", content: "إجابة الطالب الثاني" },
      ],
    });

    const firstAccount = await listAssistantConversations(userA);
    const secondAccount = await listAssistantConversations(userB);
    expect(firstAccount).toHaveLength(1);
    expect(secondAccount).toHaveLength(1);
    expect(firstAccount[0]).toMatchObject({
      clientId,
      title: "محادثة الطالب الأول",
      messages: [
        { role: "user", content: "سؤال الطالب الأول" },
        { role: "assistant", content: "إجابة الطالب الأول" },
      ],
    });
    expect(secondAccount[0]).toMatchObject({
      clientId,
      title: "محادثة الطالب الثاني",
      messages: [
        { role: "user", content: "سؤال الطالب الثاني" },
        { role: "assistant", content: "إجابة الطالب الثاني" },
      ],
    });

    await saveAssistantConversation(userA, {
      clientId,
      title: "محادثة الطالب الأول — محدّثة",
      messages: [{ role: "user", content: "سؤال جديد" }],
    });
    expect(await listAssistantConversations(userA)).toMatchObject([{
      clientId,
      title: "محادثة الطالب الأول — محدّثة",
      messages: [{ role: "user", content: "سؤال جديد" }],
    }]);
    expect(await listAssistantConversations(userB)).toMatchObject([{
      clientId,
      title: "محادثة الطالب الثاني",
      messages: [{ role: "user", content: "سؤال الطالب الثاني" }, { role: "assistant", content: "إجابة الطالب الثاني" }],
    }]);

    await deleteAssistantConversation(userB, clientId);
    expect(await listAssistantConversations(userB)).toEqual([]);
    expect(await listAssistantConversations(userA)).toMatchObject([{
      clientId,
      title: "محادثة الطالب الأول — محدّثة",
    }]);
  });
});
