/**
 * Pure roster-merge helpers used by `commitRoster` (src/lib/ingest.functions.ts).
 *
 * Extracted verbatim from the handler so the field-level merge rules can be
 * unit-tested without a DB. No behaviour change: same normalisation, same
 * match precedence (national id first, then full name), same patch shape.
 */

export type RosterExistingRow = {
  id: string;
  name?: string | null;
  national_id?: string | null;
};

export type RosterInputRow = {
  name: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  national_id?: string | null;
  birth_date?: string | null;
  address?: string | null;
  father_name?: string | null;
  father_id?: string | null;
  father_phone?: string | null;
  mother_name?: string | null;
  mother_id?: string | null;
  mother_phone?: string | null;
};

export type StudentFields = Record<string, string | null>;

export type MatchIndex = {
  /** digits-only national id (>= 5 digits) -> student id */
  byId: Map<string, string>;
  /** normalised full name -> student id */
  byName: Map<string, string>;
};

/** Trim + collapse internal whitespace. */
export function normalizeName(v: string | null | undefined): string {
  return (v ?? "").trim().replace(/\s+/g, " ");
}

/** Strip every non-digit character. */
export function digitsOnly(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Build the lookup maps from the class's existing roster rows. */
export function buildMatchIndex(existing: RosterExistingRow[] | null | undefined): MatchIndex {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const row of existing ?? []) {
    const idKey = digitsOnly(row.national_id);
    if (idKey.length >= 5 && !byId.has(idKey)) byId.set(idKey, row.id);
    const nameKey = normalizeName(row.name);
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, row.id);
  }
  return { byId, byName };
}

/** Full field set for one uploaded row (empty strings become null). */
export function studentFieldsFromRow(s: RosterInputRow): StudentFields {
  const fullName = normalizeName(s.name);
  const parts = fullName.split(" ").filter(Boolean);
  const explicitFirst = normalizeName(s.first_name);
  const explicitMiddle = normalizeName(s.middle_name);
  const explicitLast = normalizeName(s.last_name);
  return {
    name: fullName,
    first_name: explicitFirst || parts[0] || null,
    middle_name: explicitMiddle || null,
    last_name: explicitLast || (parts.length > 1 ? parts.slice(1).join(" ") : null),
    national_id: s.national_id || null,
    birth_date: s.birth_date || null,
    address: s.address || null,
    father_name: s.father_name || null,
    father_id: s.father_id || null,
    father_phone: s.father_phone || null,
    mother_name: s.mother_name || null,
    mother_id: s.mother_id || null,
    mother_phone: s.mother_phone || null,
  };
}

/** Existing student id this uploaded row belongs to, if any. */
export function resolveMatch(index: MatchIndex, s: RosterInputRow): string | undefined {
  const idKey = digitsOnly(s.national_id);
  const fullName = normalizeName(s.name);
  return (idKey.length >= 5 ? index.byId.get(idKey) : undefined) ?? index.byName.get(fullName);
}

/**
 * Field-level merge: only non-empty incoming values overwrite; every field
 * absent from the uploaded file keeps its stored value.
 */
export function mergePatch(fields: StudentFields): StudentFields {
  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => (v ?? "") !== ""),
  );
}

/** Remember a freshly inserted student so later rows in the same file match it. */
export function rememberMatch(index: MatchIndex, s: RosterInputRow, id: string): void {
  const idKey = digitsOnly(s.national_id);
  const fullName = normalizeName(s.name);
  if (idKey.length >= 5) index.byId.set(idKey, id);
  if (fullName) index.byName.set(fullName, id);
}
