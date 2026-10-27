# Architecture rules
- New Claude classroom tools use authenticated server functions and a dedicated native streaming Messages helper; existing AI calls keep their original models and protocols.
- Daily portfolio snapshots read saved student-specific records under class ownership and are approved on insertion; they do not copy class-wide notes or staff meetings.
- Seating, grade extraction, exam generation, and transcript resource prompts keep free-form caller preferences in user-role data, never system instructions, to preserve server-owned task constraints.
- Selected trial-gated AI actions use ai-entitlement.server.ts before provider calls; it mirrors the existing trial window and legacy lazy-start behavior without changing ordinary record access.
- Claude provider failure logs are diagnostic only and never determine access for subsequent requests, so restored credits or permissions take effect immediately.