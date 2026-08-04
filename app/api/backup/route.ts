import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const COLLECTION_PATH = path.join(process.cwd(), "public", "collection.csv");
const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 7;

function getBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("collection-") && f.endsWith(".csv"))
    .sort()
    .reverse()
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, size: stat.size, created: stat.mtime.toISOString() };
    });
}

// GET — list backups
export async function GET() {
  return NextResponse.json({ backups: getBackups() });
}

// POST — trigger manual backup
export async function POST() {
  try {
    if (!fs.existsSync(COLLECTION_PATH)) {
      return NextResponse.json({ ok: false, error: "collection.csv not found" }, { status: 404 });
    }

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const date = new Date().toISOString().slice(0, 10);
    const dest = path.join(BACKUP_DIR, `collection-${date}.csv`);
    fs.copyFileSync(COLLECTION_PATH, dest);

    // Prune
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("collection-") && f.endsWith(".csv"))
      .sort()
      .reverse();
    for (const f of files.slice(MAX_BACKUPS)) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
    }

    return NextResponse.json({ ok: true, filename: path.basename(dest), backups: getBackups() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
