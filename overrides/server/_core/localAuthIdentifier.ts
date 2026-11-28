export function isE164Phone(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

/** Non-user-facing stable login key. Students sign in with the phone number itself. */
export function buildPhoneLoginUsername(phone: string): string {
  if (!isE164Phone(phone)) throw new Error("INVALID_PHONE_IDENTIFIER");
  return "phone_" + phone.replace(/\D/g, "");
}

export function resolveLocalLoginIdentifier(
  value: string,
): { kind: "phone"; value: string } | { kind: "username"; value: string } | null {
  const normalized = value.trim();
  if (isE164Phone(normalized)) return { kind: "phone", value: normalized };
  if (/^[A-Za-z0-9._-]{3,32}$/.test(normalized)) {
    return { kind: "username", value: normalized.toLowerCase() };
  }
  return null;
}
