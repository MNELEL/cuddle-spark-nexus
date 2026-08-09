import { config } from "dotenv";

// Load local env files if present; CI supplies the same vars as secrets.
config({ path: ".env", quiet: true });
config({ path: ".env.test", quiet: true, override: true });
