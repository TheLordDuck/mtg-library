import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const COLLECTION_PATH = path.join(process.cwd(), "public", "collection.csv");
const BACKUP_DIR = path.join(process.cwd(), "backups");

export async function POST(req: NextRequest) {
  try {
    const { filename } = await req.json();

    if (!filename || typeof filename !== "string") {
      return NextResponse.json({ ok: false, error: "No filename provided" }, { status: 400 });
    }

    // Sanitize — only allow collection-YYYY-MM-DD.csv, no path traversal
    if (!/^collection-[\d\w-]+\.csv$/.test(filename)) {
      return NextResponse.json({ ok: false, error: "Invalid filename" }, { status: 400 });
    }

    const backupPath = path.join(BACKUP_DIR, filename);

    if (!fs.existsSync(backupPath)) {
      return NextResponse.json({ ok: false, error: "Backup not found" }, { status: 404 });
    }

    // Safety backup of current file before overwriting
    if (fs.existsSync(COLLECTION_PATH)) {
      const safetyName = `collection-pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
      fs.copyFileSync(COLLECTION_PATH, path.join(BACKUP_DIR, safetyName));
    }

    fs.copyFileSync(backupPath, COLLECTION_PATH);

    return NextResponse.json({ ok: true, restored: filename });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
