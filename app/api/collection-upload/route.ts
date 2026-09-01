import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE_PATH = path.join(process.cwd(), "public", "collection.csv");
const DIR_PATH  = path.join(process.cwd(), "public");

function ensureDir() {
  if (!fs.existsSync(DIR_PATH)) {
    fs.mkdirSync(DIR_PATH, { recursive: true });
  }
}

// GET — serve the CSV file directly (reliable in standalone mode)
export async function GET() {
  try {
    ensureDir();
    if (!fs.existsSync(FILE_PATH)) {
      // Return empty CSV with just the header so the app doesn't crash
      const header = "Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency,Added\n";
      return new NextResponse(header, {
        headers: { "Content-Type": "text/csv" },
      });
    }
    const content = fs.readFileSync(FILE_PATH, "utf-8");
    return new NextResponse(content, {
      headers: { "Content-Type": "text/csv" },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — replace the CSV file
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ ok: false, error: "File must be a .csv" }, { status: 400 });
    }

    ensureDir();
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(FILE_PATH, buffer);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
