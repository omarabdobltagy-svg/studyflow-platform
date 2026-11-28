import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, type Pool, type ResultSetHeader } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
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
