import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClassesTool from "./tools/list-classes";
import listStudentsTool from "./tools/list-students";
import behaviorSummaryTool from "./tools/behavior-summary";
import addBehaviorPointTool from "./tools/add-behavior-point";
import createReminderTool from "./tools/create-reminder";
import listRemindersTool from "./tools/list-reminders";

// The OAuth issuer must be the direct Supabase host: the project ref is the only
// value that survives publish unchanged, and Vite inlines it at build time.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "hakita-sheli",
  title: "הכיתה שלי",
  version: "0.1.0",
  instructions:
    "Tools for HaKita Sheli ('My Classroom'), a Hebrew classroom-management app for talmudei torah. Use `list_classes` to find a class id, `list_students` for its students, `behavior_summary` for point totals, `add_behavior_point` to record points, and `create_reminder` / `list_reminders` for follow-ups. All tools act as the signed-in teacher and respect their permissions.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listClassesTool,
    listStudentsTool,
    behaviorSummaryTool,
    addBehaviorPointTool,
    createReminderTool,
    listRemindersTool,
  ],
});