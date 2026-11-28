import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Store new account passwords as salted scrypt hashes with an unambiguous format. */
export function hashLocalPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

/**
 * Verify current hashes and the short-lived legacy format produced by the
 * first multi-account preview build (which omitted the two separators).
 */
export function verifyLocalPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  let salt = "";
  let expectedHex = "";

  const parts = stored.split("$");
  if (parts.length === 3 && parts[0] === "scrypt" &&
      /^[a-f0-9]{32}$/i.test(parts[1]) && /^[a-f0-9]{128}$/i.test(parts[2])) {
    [, salt, expectedHex] = parts;
  } else {
    const legacy = stored.match(/^scrypt([a-f0-9]{32})([a-f0-9]{128})$/i);
    if (!legacy) return false;
    salt = legacy[1];
    expectedHex = legacy[2];
  }

  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
