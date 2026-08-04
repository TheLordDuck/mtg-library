import fs from "fs";
import path from "path";
import cron from "node-cron";

const COLLECTION_PATH = path.join(process.cwd(), "public", "collection.csv");
const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 7;

function runBackup() {
  try {
    if (!fs.existsSync(COLLECTION_PATH)) {
      console.log("[backup] collection.csv not found, skipping.");
      return;
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Filename: collection-2026-08-04.csv
    const date = new Date().toISOString().slice(0, 10);
    const dest = path.join(BACKUP_DIR, `collection-${date}.csv`);

    fs.copyFileSync(COLLECTION_PATH, dest);
    console.log(`[backup] Saved → ${dest}`);

    // Prune old backups — keep only the most recent MAX_BACKUPS
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("collection-") && f.endsWith(".csv"))
      .sort() // ISO dates sort lexicographically = chronologically
      .reverse(); // newest first

    const toDelete = files.slice(MAX_BACKUPS);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      console.log(`[backup] Pruned old backup: ${f}`);
    }
  } catch (err) {
    console.error("[backup] Error:", err);
  }
}





let scheduled = false;

export function startBackupScheduler(hour = 3, minute = 0) {
  if (scheduled) return;
  scheduled = true;

  // Cron format: "minute hour * * *"
  // e.g. hour=3, minute=30 → "30 3 * * *" = 03:30 every day
  const schedule = `${minute} ${hour} * * *`;
  cron.schedule(schedule, runBackup);
  console.log(`[backup] Scheduler started — daily at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
}
