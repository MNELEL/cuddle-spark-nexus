/**
 * Shared field validators for the structural student fields (ID numbers,
 * phones, birth date). Used both by the roster review table (file import) and
 * by the "פרטי קשר" tab in the student file, so the rules stay identical.
 */

export function validateNationalId(v: string): string | null {
  const val = (v ?? "").trim();
  if (!val) return null;
  const digits = val.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 9) return "ת.ז. חייבת להיות 5-9 ספרות";
  return null;
}

export function validatePhone(v: string): string | null {
  const val = (v ?? "").trim();
  if (!val) return null;
  const digits = val.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 10) return "טלפון לא תקין (9-10 ספרות)";
  if (!/^0/.test(digits)) return "טלפון מתחיל ב-0";
  return null;
}

export function validateBirthDate(v: string): string | null {
  const val = (v ?? "").trim();
  if (!val) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return "פורמט: YYYY-MM-DD";
  const d = new Date(`${val}T00:00:00`);
  if (isNaN(d.getTime())) return "תאריך לא תקין";
  const y = d.getFullYear();
  if (y < 1990 || y > new Date().getFullYear()) return "שנה מחוץ לטווח סביר";
  return null;
}

/** Digits-only phone for tel:/WhatsApp links (Israeli local → E.164). */
export function phoneHref(v: string | null | undefined): string | null {
  const digits = (v ?? "").replace(/\D/g, "");
  if (digits.length < 9) return null;
  return digits;
}

export function whatsappHref(v: string | null | undefined): string | null {
  const digits = phoneHref(v);
  if (!digits) return null;
  const intl = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}`;
}

/** Split a full name into first / last name (first word = first name). */
export function splitFullName(name: string): { first_name: string; last_name: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

export function joinName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last].map((p) => (p ?? "").trim()).filter(Boolean).join(" ");
}
