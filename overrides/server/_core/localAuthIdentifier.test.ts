import { describe, expect, it } from "vitest";
import { buildPhoneLoginUsername, resolveLocalLoginIdentifier } from "./localAuthIdentifier";

describe("phone-based account registration", () => {
  it("creates a stable internal identifier without asking the student for a username", () => {
    expect(buildPhoneLoginUsername("+201012345678")).toBe("phone_201012345678");
    expect(() => buildPhoneLoginUsername("01012345678")).toThrow();
  });

  it("supports phone login for new accounts and username login for existing accounts", () => {
    expect(resolveLocalLoginIdentifier("+201012345678"))
      .toEqual({ kind: "phone", value: "+201012345678" });
    expect(resolveLocalLoginIdentifier("Omar_2026"))
      .toEqual({ kind: "username", value: "omar_2026" });
    expect(resolveLocalLoginIdentifier("12")).toBeNull();
  });
});
