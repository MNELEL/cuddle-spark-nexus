// Structured server-side logging. Writes a row to `public.app_logs` via the
// service-role client AND mirrors the event to the console, so existing
// console-based debugging keeps working while the DB gains a searchable,
// filterable audit trail.
//
// Fail-safe by design: if the DB insert itself fails (network, RLS, schema
// drift, etc.), we fall back to console.error with the original message and
// the logger's own failure — a broken logger must NEVER break the caller.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogOptions = {
  context?: Record<string, unknown> | null;
  source?: string | null;
  userId?: string | null;
};

export type LogEventInput = LogOptions & {
  level: LogLevel;
  message: string;
};

function mirrorToConsole(level: LogLevel, message: string, opts: LogOptions): void {
  const extras: unknown[] = [];
  if (opts.source) extras.push(`[${opts.source}]`);
  if (opts.context) extras.push(opts.context);
  if (opts.userId) extras.push({ userId: opts.userId });
  switch (level) {
    case "error":
      console.error(message, ...extras);
      break;
    case "warn":
      console.warn(message, ...extras);
      break;
    case "debug":
    case "info":
    default:
      console.log(message, ...extras);
      break;
  }
}

export async function logEvent(input: LogEventInput): Promise<void> {
  const { level, message, context = null, source = null, userId = null } = input;

  // Always mirror to console first so the operator sees output even if the
  // DB write fails or is slow.
  mirrorToConsole(level, message, { context, source, userId });

  try {
    const { error } = await supabaseAdmin.from("app_logs").insert({
      level,
      message,
      context: context ?? null,
      source: source ?? null,
      user_id: userId ?? null,
    });
    if (error) {
      console.error(
        `[logger.server] Failed to persist log entry to app_logs. Original message: ${message}`,
        { loggerError: error, originalContext: context, originalSource: source },
      );
    }
  } catch (err) {
    console.error(
      `[logger.server] Unexpected error persisting log entry to app_logs. Original message: ${message}`,
      { loggerError: err, originalContext: context, originalSource: source },
    );
  }
}

export function logInfo(message: string, opts: LogOptions = {}): Promise<void> {
  return logEvent({ level: "info", message, ...opts });
}

export function logWarn(message: string, opts: LogOptions = {}): Promise<void> {
  return logEvent({ level: "warn", message, ...opts });
}

export function logError(message: string, opts: LogOptions = {}): Promise<void> {
  return logEvent({ level: "error", message, ...opts });
}