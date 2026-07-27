// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Defensive guard for the auto-generated route tree: if a route module fails
// to export `Route` (e.g. a transient circular-import during dev), the
// generated `XImport.update({...})` call would throw the opaque
// "Cannot read properties of undefined (reading 'update')" and blank the
// entire app. This transform rewrites those calls so they throw a clear,
// route-specific error instead — and never crash on `undefined.update`.
const guardRouteTreePlugin = {
  name: "guard-route-tree-update",
  enforce: "pre" as const,
  transform(code: string, id: string) {
    if (!id.endsWith("routeTree.gen.ts")) return null;
    const transformed = code.replace(
      /\b([A-Za-z_$][\w$]*Import)\.update\(/g,
      (_m, name) =>
        `(${name} ?? (() => { throw new Error("routeTree.gen: missing Route export from module for " + ${JSON.stringify(name)}); })()).update(`,
    );
    if (transformed === code) return null;
    return { code: transformed, map: null };
  },
};

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [guardRouteTreePlugin],
  },
});
