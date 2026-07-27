-- Adds two new class_event_type values requested for the class calendar:
-- "special_exam" (מבחן מיוחד) and "celebration" (חגיגת סיום / אירוע חגיגי).
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside a transaction
-- block and cannot be combined with other statements in the same transaction
-- as a use of the new value, so this migration only adds the enum values.
ALTER TYPE public.class_event_type ADD VALUE IF NOT EXISTS 'special_exam';
ALTER TYPE public.class_event_type ADD VALUE IF NOT EXISTS 'celebration';
