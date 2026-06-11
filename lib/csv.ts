// ─── Types ────────────────────────────────────────────────────────────────────

export interface Card {
  _id: string;
  Name: string;
  "Set code": string;
  "Set name": string;
  "Collector number": string;
  Foil: string;
  Rarity: string;
  Quantity: string;
  "ManaBox ID": string;
  "Scryfall ID": string;
  "Purchase price": string;
  Misprint: "true" | "false";
  Altered: "true" | "false";
  Condition: string;
  Language: string;
  "Purchase price currency": string;
  Added: string;
}

export const HEADERS: (keyof Omit<Card, "_id">)[] = [
  "Name",
  "Set code",
  "Set name",
  "Collector number",
  "Foil",
  "Rarity",
  "Quantity",
  "ManaBox ID",
  "Scryfall ID",
  "Purchase price",
  "Misprint",
  "Altered",
  "Condition",
  "Language",
  "Purchase price currency",
  "Added",
];

export const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  mythic: 3,
  special: 4,
};

export const RARITY_COLOR: Record<string, string> = {
  common: "#9ca3af",
  uncommon: "#6ee7b7",
  rare: "#fbbf24",
  mythic: "#f97316",
  special: "#c084fc",
};

export const CONDITION_LABELS: Record<string, string> = {
  near_mint: "NM",
  lightly_played: "LP",
  moderately_played: "MP",
  heavily_played: "HP",
  damaged: "DMG",
};

export const CONDITIONS = Object.keys(CONDITION_LABELS);
export const LANGUAGES = [
  "en",
  "ja",
  "es",
  "de",
  "fr",
  "it",
  "pt",
  "ko",
  "ru",
  "zhs",
  "zht",
];

export const EMPTY_CARD = (): Card => ({
  _id: crypto.randomUUID(),
  Name: "",
  "Set code": "",
  "Set name": "",
  "Collector number": "",
  Foil: "normal",
  Rarity: "common",
  Quantity: "1",
  "ManaBox ID": "",
  "Scryfall ID": "",
  "Purchase price": "",
  Misprint: "false",
  Altered: "false",
  Condition: "near_mint",
  Language: "en",
  "Purchase price currency": "EUR",
  Added: new Date().toISOString(),
});

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseCSV(text: string): Card[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = { _id: crypto.randomUUID() };
    headers.forEach((h, i) => (row[h] = values[i] ?? ""));
    return row as unknown as Card;
  });
}

export function toCSV(rows: Card[]): string {
  const escape = (v: string | undefined) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = HEADERS.join(",");
  const body = rows
    .map((r) => HEADERS.map((h) => escape(r[h])).join(","))
    .join("\n");
  return header + "\n" + body;
}

export function downloadCSV(rows: Card[], filename = "collection.csv") {
  const blob = new Blob([toCSV(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
