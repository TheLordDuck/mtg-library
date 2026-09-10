"use client";

import {
  useState, useRef, useMemo, useEffect, useCallback, ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Upload, Download, Plus, Search, FileText, X, Pencil, Trash2,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, Menu,
  Check, AlertTriangle, Loader2,
} from "lucide-react";
import {
  parseCSV, toCSV, downloadCSV,
  RARITY_ORDER, RARITY_COLOR, CONDITION_LABELS, CONDITIONS, LANGUAGES,
  type Card,
} from "@/lib/csv";
import { Button, IconButton, Badge, Input, Select, Label, Banner } from "@/components/ui";

type SortField = keyof Omit<Card, "_id">;
const PAGE_SIZE = 50;

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── Normalize helper ─────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['''\u2018\u2019`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Deck list parser ─────────────────────────────────────────────────────────
// Handles:
//   "4 Lightning Bolt" / "4x Lightning Bolt"  → qty 4
//   "Lightning Bolt"                           → qty 1 (name-only)
//   "# Mainboard" or "// Comment"             → ignored

function parseDeckList(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#") || line.startsWith("//")) continue;
    const withQty = line.match(/^(\d+)x?\s+(.+)$/i);
    if (withQty) {
      const qty = parseInt(withQty[1]);
      const name = normalize(withQty[2].trim());
      if (name) map.set(name, (map.get(name) ?? 0) + qty);
      continue;
    }
    if (/^[a-zA-Z]/.test(line)) {
      const name = normalize(line);
      if (name) map.set(name, (map.get(name) ?? 0) + 1);
    }
  }
  return map;
}

// ─── Scryfall types ───────────────────────────────────────────────────────────

interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  foil: boolean;
  nonfoil: boolean;
  lang: string;
  image_uris?: { normal: string };
  card_faces?: { image_uris?: { normal: string } }[];
}

// ─── Fullscreen image overlay ─────────────────────────────────────────────────

function ImageOverlay({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <img src={src} alt={alt} className="max-h-[85vh] max-w-[90vw] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200" />
      <IconButton className="absolute top-4 right-4 !w-10 !h-10 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={onClose}>
        <X className="w-4 h-4" />
      </IconButton>
    </div>
  );
}

// ─── Set icon overlay ─────────────────────────────────────────────────────────

const setIconCache: Record<string, string> = {};

function SetIconOverlay({ setCode, onClose }: { setCode: string; onClose: () => void }) {
  const [iconUrl, setIconUrl] = useState<string | null>(setIconCache[setCode] ?? null);
  useEffect(() => {
    if (!iconUrl) {
      fetch(`https://api.scryfall.com/sets/${setCode.toLowerCase()}`)
        .then((r) => r.json())
        .then((d) => { if (d.icon_svg_uri) { setIconCache[setCode] = d.icon_svg_uri; setIconUrl(d.icon_svg_uri); } })
        .catch(() => {});
    }
  }, [setCode, iconUrl]);
  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center animate-in fade-in duration-150" onClick={onClose}>
      <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        {iconUrl
          ? <img src={iconUrl} alt={setCode} className="w-32 h-32 invert opacity-90" />
          : <div className="w-32 h-32 flex items-center justify-center text-text-faint text-2xl">…</div>
        }
        <span className="text-white font-bold text-lg uppercase tracking-wider">{setCode}</span>
        <Button size="sm" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

// ─── Desktop tooltips ─────────────────────────────────────────────────────────

function CardTooltip({ scryfallId, name }: { scryfallId: string; name: string }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  if (!scryfallId) return <span>{name}</span>;
  const imgUrl = `https://cards.scryfall.io/normal/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`;
  return (
    <>
      <span
        className="border-b border-dashed border-white/20 hover:border-accent hover:text-accent transition-colors cursor-default"
        onMouseEnter={(e) => { setPos({ x: e.clientX, y: e.clientY }); setVisible(true); }}
        onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setVisible(false)}
      >{name}</span>
      {visible && (
        <div className="fixed z-50 pointer-events-none drop-shadow-2xl" style={{ left: pos.x + 16, top: pos.y - 20 }}>
          <img src={imgUrl} alt={name} className="w-[200px] rounded-xl block" />
        </div>
      )}
    </>
  );
}

function SetTooltip({ setCode }: { setCode: string }) {
  const [visible, setVisible] = useState(false);
  const [iconUrl, setIconUrl] = useState<string | null>(setIconCache[setCode] ?? null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <>
      <span
        className="inline-block bg-white/5 border border-border rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-text-muted uppercase cursor-default hover:border-accent hover:text-accent transition-colors"
        onMouseEnter={(e) => {
          setPos({ x: e.clientX, y: e.clientY }); setVisible(true);
          if (!iconUrl) {
            fetch(`https://api.scryfall.com/sets/${setCode.toLowerCase()}`)
              .then((r) => r.json())
              .then((d) => { if (d.icon_svg_uri) { setIconCache[setCode] = d.icon_svg_uri; setIconUrl(d.icon_svg_uri); } })
              .catch(() => {});
          }
        }}
        onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setVisible(false)}
      >{setCode}</span>
      {visible && (
        <div className="fixed z-50 pointer-events-none bg-surface-2 border border-border rounded-lg p-2 flex items-center justify-center shadow-xl" style={{ left: pos.x + 12, top: pos.y - 12 }}>
          {iconUrl
            ? <img src={iconUrl} alt={setCode} className="w-12 h-12 invert opacity-80" />
            : <span className="text-text-faint px-2 text-lg">…</span>
          }
        </div>
      )}
    </>
  );
}

function RarityPip({ rarity }: { rarity: string }) {
  return <span className="inline-block w-2 h-2 rounded-full shrink-0 mr-1.5" style={{ background: RARITY_COLOR[rarity] ?? "#6b7280" }} />;
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({ row, onSave, onClose }: { row: Card; onSave: (c: Card) => void; onClose: () => void }) {
  const [form, setForm] = useState<Card>({ ...row });
  const set = (f: keyof Card) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }));
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-surface-2 border border-border rounded-t-2xl sm:rounded-xl w-full sm:max-w-[420px] flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
        <div className="px-5 pt-4 pb-3 sm:px-6 sm:pt-5 border-b border-border">
          <p className="text-[11px] uppercase tracking-widest text-text-faint font-semibold mb-1">Card</p>
          <h2 className="text-base font-semibold text-text">{row.Name}</h2>
          <p className="text-xs text-text-faint mt-0.5">{row["Set name"]} · #{row["Collector number"]} · {row["Set code"].toUpperCase()}</p>
        </div>
        <div className="grid grid-cols-2 gap-3.5 p-5 sm:p-6">
          <Label>Quantity<Input type="number" min="1" value={form.Quantity} onChange={set("Quantity")} /></Label>
          <Label>Foil
            <Select value={form.Foil} onChange={set("Foil")}>
              <option value="normal">Normal</option>
              <option value="foil">Foil</option>
              <option value="etched">Etched</option>
            </Select>
          </Label>
          <Label>Condition
            <Select value={form.Condition} onChange={set("Condition")}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]} – {c}</option>)}
            </Select>
          </Label>
          <Label>Language
            <Select value={form.Language} onChange={set("Language")}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          </Label>
        </div>
        <div className="flex gap-2.5 px-5 pb-5 sm:px-6 sm:pb-6">
          <Button className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="primary" className="flex-1" onClick={() => onSave(form)}>Save</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Card Modal ───────────────────────────────────────────────────────────

function AddCardModal({ onAdd, onClose }: { onAdd: (card: Card) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 400);
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [picked, setPicked] = useState<ScryfallCard | null>(null);
  const [foil, setFoil] = useState<"normal" | "foil">("normal");
  const [condition, setCondition] = useState("near_mint");
  const [language, setLanguage] = useState("en");
  const [quantity, setQuantity] = useState("1");

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) return;
    const normalized = normalize(q);
    const scryfallQ = `name:/^${normalized.replace(/\s+/g, ".*")}/`;
    let cancelled = false;
    fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(scryfallQ)}&unique=prints&order=released`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setResults(d.data ?? []); })
      .catch(() => { if (!cancelled) setResults([]); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const displayResults = debouncedQuery.trim() ? results : [];
  const getImg = (c: ScryfallCard) => c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? "";

  const handleAdd = () => {
    if (!picked) return;
    const card: Card = {
      _id: crypto.randomUUID(),
      Name: picked.name,
      "Set code": picked.set.toUpperCase(),
      "Set name": picked.set_name,
      "Collector number": picked.collector_number,
      Foil: foil,
      Rarity: picked.rarity,
      Quantity: quantity,
      "ManaBox ID": "",
      "Scryfall ID": picked.id,
      "Purchase price": "",
      Misprint: "false",
      Altered: "false",
      Condition: condition,
      Language: language,
      "Purchase price currency": "EUR",
      Added: new Date().toISOString(),
    };
    onAdd(card);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-surface-2 border border-border rounded-t-2xl sm:rounded-xl w-full sm:max-w-[640px] max-h-[92vh] overflow-y-auto flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 sm:px-6 sm:pt-5 border-b border-border">
          <h2 className="text-base font-semibold">{picked ? picked.name : "Add Card"}</h2>
          <IconButton onClick={onClose}><X className="w-4 h-4" /></IconButton>
        </div>

        {!picked ? (
          <div className="flex flex-col gap-3 p-5 sm:p-6">
            <div className="relative">
              <Search className="w-4 h-4 text-text-faint absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input autoFocus className="pl-9" placeholder="Search card name…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            {query !== debouncedQuery && (
              <p className="text-sm text-text-faint text-center py-4 flex items-center justify-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
              </p>
            )}
            {query === debouncedQuery && query && displayResults.length === 0 && (
              <p className="text-sm text-text-faint text-center py-4">No results for &ldquo;{query}&rdquo;</p>
            )}
            {displayResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto pr-1">
                {displayResults.map((c) => {
                  const img = getImg(c);
                  return (
                    <button key={c.id} onClick={() => setPicked(c)} className="flex flex-col gap-1.5 text-left group">
                      {img
                        ? <img src={img} alt={c.name} className="w-full rounded-lg border border-white/5 group-hover:border-accent-border transition-colors" />
                        : <div className="w-full aspect-[2.5/3.5] rounded-lg bg-surface border border-white/5 group-hover:border-accent-border transition-colors flex items-center justify-center text-text-faint text-xs p-2 text-center">{c.name}</div>
                      }
                      <div>
                        <p className="text-xs font-medium text-text-muted leading-tight">{c.set_name}</p>
                        <p className="text-[10px] text-text-faint">#{c.collector_number} · {c.rarity}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex gap-4">
              {getImg(picked) && <img src={getImg(picked)} alt={picked.name} className="w-24 rounded-lg shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{picked.name}</p>
                <p className="text-xs text-text-faint mt-0.5">{picked.set_name} · #{picked.collector_number}</p>
                <p className="text-xs text-text-faint mt-0.5 capitalize">{picked.rarity}</p>
                <button className="mt-2 text-xs text-accent hover:text-accent-hover transition-colors" onClick={() => setPicked(null)}>← Pick different printing</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Label>Quantity<Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Label>
              <Label>Foil
                <Select value={foil} onChange={(e) => setFoil(e.target.value as "normal" | "foil")}>
                  <option value="normal">Normal</option>
                  {picked.foil && <option value="foil">Foil</option>}
                </Select>
              </Label>
              <Label>Condition
                <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
                  {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]} – {c}</option>)}
                </Select>
              </Label>
              <Label>Language
                <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </Select>
              </Label>
            </div>
            <div className="flex gap-2.5">
              <Button className="flex-1" onClick={onClose}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={handleAdd}>Add to collection</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mobile card row ──────────────────────────────────────────────────────────

function MobileCardRow({
  card, selected, onSelect, onEdit, onDelete, deckQty,
}: {
  card: Card; selected: boolean; onSelect: () => void; onEdit: () => void; onDelete: () => void; deckQty?: number;
}) {
  const [imgOverlay, setImgOverlay] = useState(false);
  const [setOverlay, setSetOverlay] = useState(false);
  const scryfallId = card["Scryfall ID"];
  const imgUrl = scryfallId
    ? `https://cards.scryfall.io/normal/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`
    : null;
  return (
    <>
      {imgOverlay && imgUrl && <ImageOverlay src={imgUrl} alt={card.Name} onClose={() => setImgOverlay(false)} />}
      {setOverlay && <SetIconOverlay setCode={card["Set code"]} onClose={() => setSetOverlay(false)} />}
      <div className={`px-4 py-3 border-b border-white/5 flex gap-3 ${selected ? "bg-accent-soft" : ""}`}>
        <input type="checkbox" className="accent-[var(--color-accent)] mt-1 shrink-0" checked={selected} onChange={onSelect} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <button
              className="font-medium text-sm leading-tight text-left text-text active:text-accent transition-colors"
              onClick={() => imgUrl && setImgOverlay(true)}
            >{card.Name}</button>
            <button
              className="inline-block bg-white/5 border border-border rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-text-muted uppercase shrink-0 active:border-accent active:text-accent transition-colors"
              onClick={() => setSetOverlay(true)}
            >{card["Set code"]}</button>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-faint">
            <span className="flex items-center capitalize"><RarityPip rarity={card.Rarity} />{card.Rarity}</span>
            {card.Foil !== "normal" && <Badge tone="accent" className="capitalize">{card.Foil}</Badge>}
            <Badge>{CONDITION_LABELS[card.Condition] ?? card.Condition}</Badge>
            <span className="uppercase tracking-wider">{card.Language}</span>
            <span className="font-semibold text-accent font-mono">×{card.Quantity}</span>
            {deckQty !== undefined && <span className="text-warning font-semibold">deck: {deckQty}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end justify-between shrink-0 gap-1">
          <IconButton tone="accent" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></IconButton>
          <IconButton tone="danger" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></IconButton>
        </div>
      </div>
    </>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  const btnCls = (active: boolean) =>
    `min-w-[32px] h-8 px-2 rounded text-sm transition-colors ${active ? "bg-accent text-white font-semibold" : "text-text-muted hover:bg-surface-hover hover:text-text"}`;
  return (
    <div className="flex items-center gap-1 px-4 sm:px-6 py-2.5 border-t border-border bg-surface-2">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className="h-8 px-3 flex items-center gap-1 text-sm text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft className="w-3.5 h-3.5" /> Prev
      </button>
      <div className="flex items-center gap-1 mx-1">
        {pages.map((p, i) => p === "…"
          ? <span key={`el-${i}`} className="px-1 text-text-faint">…</span>
          : <button key={p} onClick={() => onChange(p as number)} className={btnCls(p === page)}>{p}</button>
        )}
      </div>
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className="h-8 px-3 flex items-center gap-1 text-sm text-text-muted hover:text-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        Next <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CollectionPage() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [sortField, setSortField] = useState<SortField>("Name");
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [editRow, setEditRow] = useState<Card | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [deckFilter, setDeckFilter] = useState<Map<string, number> | null>(null);
  const [deckFileName, setDeckFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const deckRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/collection-upload")
      .then((r) => { if (!r.ok) throw new Error("not found"); return r.text(); })
      .then((text) => { setCards(parseCSV(text)); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCards(parseCSV(ev.target?.result as string));
      setSelected(new Set());
      setDirty(false);
      setPage(1);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDeckFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseDeckList(ev.target?.result as string);
      setDeckFilter(parsed);
      setDeckFileName(file.name);
      setPage(1);
      setSearch("");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const clearDeckFilter = () => { setDeckFilter(null); setDeckFileName(""); setPage(1); };

  const handleSaveToFile = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const blob = new Blob([toCSV(cards)], { type: "text/csv" });
      const fd = new FormData();
      fd.append("file", new File([blob], "collection.csv", { type: "text/csv" }));
      const data = await fetch("/api/collection-upload", { method: "POST", body: fd }).then((r) => r.json());
      if (data.ok) {
        setDirty(false);
        setSaveMsg("ok:Saved successfully");
        setTimeout(() => setSaveMsg(null), 3000);
      } else {
        setSaveMsg(`err:${data.error ?? "Save failed"}`);
      }
    } catch {
      setSaveMsg("err:Save failed");
    }
    setSaving(false);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc((a) => !a);
    else { setSortField(field); setSortAsc(true); }
  };

  const filtered = useMemo(() => {
    const q = normalize(debouncedSearch);
    let base = cards;
    if (deckFilter) {
      base = cards.filter((c) => deckFilter.has(normalize(c.Name)));
    }
    if (q) {
      base = base.filter((c) =>
        normalize(c.Name).includes(q) ||
        normalize(c["Set name"]).includes(q) ||
        normalize(c["Set code"]).includes(q)
      );
    }
    return [...base].sort((a, b) => {
      const av = a[sortField] ?? "", bv = b[sortField] ?? "";
      if (sortField === "Rarity") return sortAsc
        ? (RARITY_ORDER[av] ?? 0) - (RARITY_ORDER[bv] ?? 0)
        : (RARITY_ORDER[bv] ?? 0) - (RARITY_ORDER[av] ?? 0);
      if (sortField === "Quantity" || sortField === "Purchase price") return sortAsc
        ? (parseFloat(av) || 0) - (parseFloat(bv) || 0)
        : (parseFloat(bv) || 0) - (parseFloat(av) || 0);
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [cards, debouncedSearch, sortField, sortAsc, deckFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const stats = useMemo(() => ({
    total: cards.reduce((s, c) => s + (parseInt(c.Quantity) || 0), 0),
    value: cards.reduce((s, c) => s + (parseFloat(c["Purchase price"]) || 0) * (parseInt(c.Quantity) || 1), 0),
    sets: new Set(cards.map((c) => c["Set code"])).size,
  }), [cards]);

  const goToPage = (p: number) => {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openEdit = (row: Card) => setEditRow({ ...row });

  const handleSave = (updated: Card) => {
    setCards((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
    setEditRow(null);
    setDirty(true);
  };

  const handleAdd = (card: Card) => { setCards((prev) => [...prev, card]); setDirty(true); };

  const deleteRow = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c._id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    setDirty(true);
  }, []);

  const deleteSelected = () => {
    setCards((prev) => prev.filter((c) => !selected.has(c._id)));
    setSelected(new Set());
    setDirty(true);
  };

  const toggleSelect = useCallback((id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }), []);

  const toggleAll = () => {
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map((c) => c._id)));
  };

  const SI = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 inline ml-1 opacity-30" />;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 inline ml-1" />
      : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-faint gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading collection…
      </div>
    );
  }

  const saveTone = saveMsg?.startsWith("ok:") ? "success" : saveMsg ? "danger" : "warning";
  const saveText = saveMsg?.replace(/^(ok|err):/, "");

  const tableHeaders: [SortField | null, string][] = [
    ["Name", "Name"],
    ["Set code", "Set"],
    ["Rarity", "Rarity"],
    [null, "Foil"],
    ["Quantity", "Qty"],
    [null, "Cond."],
    [null, "Lang."],
    ...(deckFilter ? [[null, "Deck"]] as [null, string][] : []),
  ];

  return (
    <div ref={topRef} className="flex flex-col min-h-screen">

      {/* ── Save banner ── */}
      {(dirty || !!saveMsg) && (
        <div className="sticky top-0 z-20 px-4 py-2 border-b border-border bg-surface-2/95 backdrop-blur-md">
          <Banner
            tone={saveTone}
            action={dirty && (
              <Button variant="warning" size="sm" disabled={saving} onClick={handleSaveToFile}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {saving ? "Saving…" : "Save to file"}
              </Button>
            )}
          >
            {saveMsg ? (saveTone === "success" ? <Check className="w-3.5 h-3.5 inline mr-1.5" /> : <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />) : <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />}
            {saveMsg ? saveText : "Unsaved changes — won't persist until saved."}
          </Banner>
        </div>
      )}

      {/* ── Deck filter banner ── */}
      {deckFilter && (
        <div className="px-4 py-2.5 border-b border-border">
          <Banner
            tone="warning"
            action={
              <Button variant="warning" size="sm" onClick={clearDeckFilter}>
                <X className="w-3 h-3" /> Clear
              </Button>
            }
          >
            <FileText className="w-3.5 h-3.5 inline mr-1.5" />
            <span className="font-semibold">{deckFileName}</span>
            <span className="text-warning/70 ml-2">— {filtered.length} of {deckFilter.size} cards found in collection</span>
          </Banner>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 bg-surface-2/90 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex gap-1 sm:gap-1.5">
            {[["W","#e8ddb4","#333"],["U","#0e68ab","#fff"],["B","#2d2d2d","#fff"],["R","#c3202a","#fff"],["G","#00743e","#fff"]].map(([s,bg,fg]) => (
              <span key={s} className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ring-1 ring-white/10" style={{ background: bg, color: fg }}>{s}</span>
            ))}
          </div>
          <span className="text-sm font-semibold">Collection Editor</span>
        </div>
        <div className="hidden sm:flex gap-2.5">
          <Button onClick={() => router.push("/")}><ArrowLeft className="w-3.5 h-3.5" /> Dashboard</Button>
          <Button onClick={() => fileRef.current?.click()}><Upload className="w-3.5 h-3.5" /> Import</Button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} hidden />
          <Button variant="primary" onClick={() => downloadCSV(cards)}><Download className="w-3.5 h-3.5" /> Export</Button>
        </div>
        <IconButton className="sm:hidden !w-9 !h-9 border border-border" onClick={() => setMobileMenuOpen((o) => !o)}>
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </IconButton>
      </header>

      {mobileMenuOpen && (
        <div className="sm:hidden flex flex-col gap-2 px-4 py-3 bg-surface-2 border-b border-border">
          <Button className="w-full justify-start px-4 py-2.5" onClick={() => { router.push("/"); setMobileMenuOpen(false); }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Button>
          <Button className="w-full justify-start px-4 py-2.5" onClick={() => { fileRef.current?.click(); setMobileMenuOpen(false); }}>
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </Button>
          <Button variant="primary" className="w-full justify-start px-4 py-2.5" onClick={() => { downloadCSV(cards); setMobileMenuOpen(false); }}>
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} hidden />
        </div>
      )}

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:flex bg-surface-2 border-b border-border">
        {[["unique cards", cards.length], ["total copies", stats.total], ["sets", stats.sets], ["total value", `€${stats.value.toFixed(2)}`]].map(([label, val]) => (
          <div key={label as string} className="px-4 sm:px-5 py-2.5 sm:py-3 border-r border-b sm:border-b-0 border-border last:border-r-0 [&:nth-child(2)]:border-r-0 sm:[&:nth-child(2)]:border-r sm:[&:nth-child(4)]:border-r-0">
            <span className="text-[10px] sm:text-[11px] uppercase tracking-widest text-text-faint font-semibold block mb-0.5">{label}</span>
            <span className="text-lg sm:text-xl font-bold text-accent font-mono">{val}</span>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-2.5 border-b border-border">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-4 h-4 text-text-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search by name, set…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-2 ml-auto">
          {selected.size > 0 && (
            <Button variant="danger" onClick={deleteSelected}>
              <Trash2 className="w-3.5 h-3.5" /> Delete {selected.size}
            </Button>
          )}
          <Button
            variant={deckFilter ? "warning" : "secondary"}
            onClick={() => deckFilter ? clearDeckFilter() : deckRef.current?.click()}
          >
            {deckFilter ? <X className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
            Deck
          </Button>
          <input ref={deckRef} type="file" accept=".txt,.dec,.dek" onChange={handleDeckFile} hidden />
          <Button variant="primary" onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5" /> Add</Button>
        </div>
      </div>

      {/* ── Desktop table ── */}
      <div className="overflow-x-auto hidden sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface-2">
              <th className="w-9 px-3.5 py-2.5 text-left border-b border-border">
                <input type="checkbox" className="accent-[var(--color-accent)] w-3.5 h-3.5 cursor-pointer" checked={selected.size === visible.length && visible.length > 0} onChange={toggleAll} />
              </th>
              {tableHeaders.map(([field, label]) => (
                <th
                  key={label}
                  onClick={field ? () => toggleSort(field) : undefined}
                  className={`px-3.5 py-2.5 text-left text-[11px] uppercase tracking-widest font-semibold border-b border-border whitespace-nowrap ${
                    field ? "cursor-pointer select-none hover:text-text text-text-faint" : "text-text-faint"
                  } ${label === "Deck" ? "text-warning" : ""}`}
                >
                  {label}{field && <SI field={field} />}
                </th>
              ))}
              <th className="w-16 border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {visible.map((card) => {
              const deckQty = deckFilter?.get(normalize(card.Name));
              return (
                <tr
                  key={card._id}
                  onDoubleClick={() => openEdit(card)}
                  className={`border-b border-white/5 transition-colors cursor-default ${selected.has(card._id) ? "bg-accent-soft" : "hover:bg-white/[0.03]"}`}
                >
                  <td className="px-3.5 py-2.5">
                    <input type="checkbox" className="accent-[var(--color-accent)] w-3.5 h-3.5 cursor-pointer" checked={selected.has(card._id)} onChange={() => toggleSelect(card._id)} />
                  </td>
                  <td className="px-3.5 py-2.5 font-medium"><CardTooltip scryfallId={card["Scryfall ID"]} name={card.Name} /></td>
                  <td className="px-3.5 py-2.5"><SetTooltip setCode={card["Set code"]} /></td>
                  <td className="px-3.5 py-2.5">
                    <span className="flex items-center text-xs capitalize text-text-muted">
                      <RarityPip rarity={card.Rarity} />{card.Rarity}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    {card.Foil !== "normal" && <Badge tone="accent" className="capitalize">{card.Foil}</Badge>}
                  </td>
                  <td className="px-3.5 py-2.5 text-center font-semibold text-accent font-mono">{card.Quantity}</td>
                  <td className="px-3.5 py-2.5">
                    <Badge>{CONDITION_LABELS[card.Condition] ?? card.Condition}</Badge>
                  </td>
                  <td className="px-3.5 py-2.5 text-[11px] uppercase tracking-wider text-text-faint">{card.Language}</td>
                  {deckFilter && (
                    <td className="px-3.5 py-2.5 text-center font-semibold text-warning text-sm">{deckQty ?? "—"}</td>
                  )}
                  <td className="px-3.5 py-2.5">
                    <div className="flex gap-1">
                      <IconButton tone="accent" title="Edit" onClick={() => openEdit(card)}><Pencil className="w-3.5 h-3.5" /></IconButton>
                      <IconButton tone="danger" title="Delete" onClick={() => deleteRow(card._id)}><Trash2 className="w-3.5 h-3.5" /></IconButton>
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={tableHeaders.length + 2} className="text-center text-text-faint py-16">No cards match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile list ── */}
      <div className="sm:hidden">
        {visible.length === 0
          ? <div className="text-center text-text-faint py-16 text-sm">No cards match your search.</div>
          : (
            <>
              <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 bg-surface-2/50">
                <input type="checkbox" className="accent-[var(--color-accent)]" checked={selected.size === visible.length && visible.length > 0} onChange={toggleAll} />
                <span className="text-xs text-text-faint">Select all on this page ({visible.length})</span>
              </div>
              {visible.map((card) => (
                <MobileCardRow
                  key={card._id}
                  card={card}
                  selected={selected.has(card._id)}
                  onSelect={() => toggleSelect(card._id)}
                  onEdit={() => openEdit(card)}
                  onDelete={() => deleteRow(card._id)}
                  deckQty={deckFilter?.get(normalize(card.Name))}
                />
              ))}
            </>
          )
        }
      </div>

      {/* ── Pagination & footer ── */}
      <Pagination page={safePage} totalPages={totalPages} onChange={goToPage} />

      <div className="px-4 sm:px-6 py-2.5 text-xs text-text-faint border-t border-border bg-surface-2">
        Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} cards
        {cards.length !== filtered.length && ` (filtered from ${cards.length})`}
        {search && ` · "${search}"`}
      </div>

      {editRow && <EditModal row={editRow} onSave={handleSave} onClose={() => setEditRow(null)} />}
      {showAdd && <AddCardModal onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
