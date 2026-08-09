import { z } from "zod";

export const trialExtensionSchema = z.object({
  userId: z.string().uuid(),
  days: z.number().int().min(1).max(730),
});

/** User-submitted self-service extension request. */
export const trialRequestSchema = z.object({
  institution_name: z.string().trim().max(120).optional(),
  message: z.string().trim().max(500).optional(),
  requested_days: z.number().int().min(1).max(730).default(30),
});

/** Admin decision on a pending extension request. */
export const trialReviewSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  days: z.number().int().min(1).max(730).optional(),
  note: z.string().trim().max(500).optional(),
});
