import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/** Old published slug — 301 any straggling request/crawler to the current domain. */
const LEGACY_HOSTS = new Set(["cuddle-spark-nexus.lovable.app"]);
const CANONICAL_HOST = "hakitasheli.lovable.app";

const legacyDomainRedirect = createMiddleware().server(async ({ request, next }) => {
  try {
    const url = new URL(request.url);
    const host = (request.headers.get("x-forwarded-host") ?? url.host).toLowerCase();
    if (LEGACY_HOSTS.has(host)) {
      url.host = CANONICAL_HOST;
      url.protocol = "https:";
      url.port = "";
      return new Response(null, {
        status: 301,
        headers: { location: url.toString(), "cache-control": "public, max-age=3600" },
      });
    }
  } catch {
    // fall through to normal handling
  }
  return await next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [legacyDomainRedirect, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
