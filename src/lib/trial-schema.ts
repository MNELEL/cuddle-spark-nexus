import { z } from "zod";

export const trialExtensionSchema = z.object({
  userId: z.string().uuid(),
  days: z.number().int().min(1).max(730),
});
