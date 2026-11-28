import { describe, expect, it } from "vitest";
import { summarizeDatabaseError } from "./official-education-error";

describe("summarizeDatabaseError", () => {
  it("never returns an exception message that may contain SQL parameters or student data", () => {
    const error = Object.assign(new Error(
      'Failed query: update studentProfiles set selectionJson = ? where userId = ? params: {"studentName":"PRIVATE"}',
    ), {
      code: "ER_DATA_TOO_LONG",
      errno: 1406,
      sqlState: "22001",
      sql: "UPDATE studentProfiles ...",
    });

    const summary = summarizeDatabaseError(error);
    expect(summary).toEqual({
      errorName: "Error",
      errorCode: "ER_DATA_TOO_LONG",
      errorNumber: 1406,
      sqlState: "22001",
    });
    expect(JSON.stringify(summary)).not.toContain("PRIVATE");
    expect(JSON.stringify(summary)).not.toContain("studentName");
    expect(JSON.stringify(summary)).not.toContain("selectionJson");
  });

  it("reads safe driver metadata from a wrapped database cause", () => {
    const summary = summarizeDatabaseError({
      name: "DrizzleQueryError",
      message: "sensitive SQL and bound params",
      cause: {
        code: "ER_LOCK_WAIT_TIMEOUT",
        errno: 1205,
        sqlState: "HY000",
        message: "driver message with user data",
      },
    });
    expect(summary).toEqual({
      errorName: "DrizzleQueryError",
      errorCode: "ER_LOCK_WAIT_TIMEOUT",
      errorNumber: 1205,
      sqlState: "HY000",
    });
  });

  it("returns a safe generic summary for unknown or malformed errors", () => {
    expect(summarizeDatabaseError("private text")).toEqual({ errorName: "UnknownError" });
    expect(summarizeDatabaseError({
      name: "bad name with spaces", code: "DROP TABLE", errno: -1, sqlState: "not-state",
    })).toEqual({ errorName: "UnknownError" });
  });
});
