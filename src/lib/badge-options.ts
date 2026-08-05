/** Client-safe badge metadata shared by UI and server functions. */
export const BADGE_CATEGORIES = ["torah", "midot", "persistence", "order"] as const;
export type BadgeCategory = (typeof BADGE_CATEGORIES)[number];
export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  torah: "לימוד תורה",
  midot: "מידות טובות",
  persistence: "התמדה",
  order: "סדר וניקיון",
};

export type BadgeRow = {
  id: string;
  class_id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  criteria: string;
  points_reward: number;
  active: boolean;
  created_at: string;
};

export type BadgeAwardRow = {
  id: string;
  badge_id: string;
  student_id: string;
  note: string;
  awarded_at: string;
};

export type BadgeIdea = { name: string; description: string; criteria: string };
