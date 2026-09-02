import { hebrewDateTime } from "@/lib/hebrew-date";
/**
 * Shared shapes for the teacher change history (notes/style edits and class
 * assignments). Kept out of the server-fn module so the UI can import the
 * labels without pulling server code into the client bundle.
 */
export const TEACHER_AUDIT_ACTIONS = {
  notes: "teacher.notes_updated",
  assignClass: "teacher.class_assigned",
} as const;

export const TEACHER_AUDIT_LABEL: Record<string, string> = {
  [TEACHER_AUDIT_ACTIONS.notes]: "סגנון הוראה והערות",
  [TEACHER_AUDIT_ACTIONS.assignClass]: "שיוך כיתה למלמד",
};

export type TeacherAuditEntry = {
  id: string;
  createdAt: string;
  action: string;
  message: string;
  /** Who made the change. */
  actorName: string;
  teacherName: string | null;
  previousTeacherName: string | null;
  className: string | null;
  before: string | null;
  after: string | null;
};

export function formatAuditDate(iso: string): string {
  return hebrewDateTime(iso);
}