import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "collection.csv");

  try {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.trim().split(/\r?\n/);
    const rows = lines.length - 1; // subtract header

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
    return NextResponse.json({ exists: false }, { status: 404 });
  }
}
