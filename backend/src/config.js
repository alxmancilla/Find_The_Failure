import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Load the single, centralized .env located at the repository root, regardless
// of the current working directory the process is started from.
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env") });

export const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/find_the_failure";
export const PORT = process.env.PORT || 4000;
