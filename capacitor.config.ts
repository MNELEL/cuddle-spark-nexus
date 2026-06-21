import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "studio.classalign.app",
  appName: "ClassAlign Studio",
  webDir: "dist/client",
  android: {
    allowMixedContent: false,
  },
  // For live-reload development against the deployed preview, uncomment:
  // server: { url: "https://cuddle-spark-nexus.lovable.app", cleartext: false },
};

export default config;