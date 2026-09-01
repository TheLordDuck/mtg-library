import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE_PATH = path.join(process.cwd(), "public", "collection.csv");

export async function GET() {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      return NextResponse.json({ exists: false });
    }

    const stat = fs.statSync(FILE_PATH);
    const content = fs.readFileSync(FILE_PATH, "utf-8");
    const lines = content.trim().split(/\r?\n/);
    const rows = lines.length - 1;

    return NextResponse.json({
      exists: true,
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
      created: stat.birthtime.toISOString(),
      rows,
      columns: lines[0]?.split(",").length ?? 0,
      filename: "collection.csv",
    });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
