import { config } from "dotenv";

// Load the project's env so RLS tests can reach the backend with the public key.
config({ path: ".env", quiet: true });