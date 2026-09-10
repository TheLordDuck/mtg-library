import fs from "fs";
import path from "path";

// All runtime-written data lives here. In production (Coolify) this MUST be
// a mounted persistent volume — set DATA_DIR to its mount path (e.g. "/data")
// in the app's environment variables and add a matching persistent storage
// entry in Coolify pointing at that same path. Without a volume mounted here,
// the container's writable layer is discarded on every redeploy/restart and
// the collection is lost.
//
// Falls back to "<repo>/data" for local development, kept out of the "public"
// folder and out of the build output so it never depends on process.cwd()
// tricks like Next's standalone server changing the working directory.
export const DATA_DIR =
  process.env.DATA_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "data");

export const COLLECTION_PATH = path.join(DATA_DIR, "collection.csv");
export const BACKUP_DIR = path.join(DATA_DIR, "backups");

export function ensureDataDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
