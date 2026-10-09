// Where the shared reference data lives. (Kept apart from the seed script so the API does not import the seed.)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// src/lib or dist/lib  ->  repo root  ->  data/geo   (the production image copies data/ to /app/data)
export const GEO_DIR = join(here, "../../../../data/geo");
