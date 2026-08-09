/**
 * Client-side guard for route params that feed server functions expecting a
 * UUID `classId`. Without this, a malformed URL segment reaches the server
 * function and surfaces as a raw ZodError (red error screen) instead of a
 * friendly Hebrew message.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidClassId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}
