import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");

  if (!file || !/^collection-[\d\w-]+\.csv$/.test(file)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(BACKUP_DIR, file);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${file}"`,
    },
  });
}
