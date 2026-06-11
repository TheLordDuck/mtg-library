"use client";

import {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
  ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  parseCSV,
  toCSV,
  downloadCSV,
  RARITY_ORDER,
  RARITY_COLOR,
  CONDITION_LABELS,
  CONDITIONS,
  LANGUAGES,
  EMPTY_CARD,
  type Card,
} from "@/lib/csv";

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

// ─── Card image tooltip ───────────────────────────────────────────────────────

function CardTooltip({
  scryfallId,
  name,
}: {
  scryfallId: string;
  name: string;
}) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  if (!scryfallId) return <span>{name}</span>;
  const imgUrl = `https://cards.scryfall.io/normal/front/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`;
  return (
    <>
      <span
        className="border-b border-dashed border-white/20 hover:border-violet-400 transition-colors cursor-default"
        onMouseEnter={(e) => {
          setPos({ x: e.clientX, y: e.clientY });
          setVisible(true);
        }}
        onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setVisible(false)}
      >
        {name}
      </span>
      {visible && (
        <div
          className="fixed z-50 pointer-events-none drop-shadow-2xl"
          style={{ left: pos.x + 16, top: pos.y - 20 }}
        >
          <img src={imgUrl} alt={name} className="w-[200px] rounded-xl block" />
        </div>
      )}
    </>
  );
}

// ─── Set icon tooltip ─────────────────────────────────────────────────────────

const setIconCache: Record<string, string> = {};

function SetTooltip({ setCode }: { setCode: string }) {
  const [visible, setVisible] = useState(false);
  const [iconUrl, setIconUrl] = useState<string | null>(
    setIconCache[setCode] ?? null,
  );
  const [pos, setPos] = useState({ x: 0, y: 0 });
  return (
    <>
      <span
        className="inline-block bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase cursor-default hover:border-violet-400 hover:text-violet-300 transition-colors"
        onMouseEnter={(e) => {
          setPos({ x: e.clientX, y: e.clientY });
          setVisible(true);
          if (!iconUrl) {
            fetch(`https://api.scryfall.com/sets/${setCode.toLowerCase()}`)
              .then((r) => r.json())
              .then((d) => {
                if (d.icon_svg_uri) {
                  setIconCache[setCode] = d.icon_svg_uri;
                  setIconUrl(d.icon_svg_uri);
                }
              })
              .catch(() => {});
          }
        }}
        onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setVisible(false)}
      >
        {setCode}
      </span>
      {visible && (
        <div
          className="fixed z-50 pointer-events-none bg-neutral-800 border border-white/10 rounded-lg p-2 flex items-center justify-center"
          style={{ left: pos.x + 12, top: pos.y - 12 }}
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={setCode}
              className="w-12 h-12 invert opacity-80"
            />
          ) : (
            <span className="text-neutral-500 px-2 text-lg">…</span>
          )}
        </div>
      )}
    </>
  );
}

function RarityPip({ rarity }: { rarity: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0 mr-1.5"
      style={{ background: RARITY_COLOR[rarity] ?? "#6b7280" }}
    />
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  row,
  onSave,
  onClose,
}: {
  row: Card;
  onSave: (c: Card) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Card>({ ...row });
  const set =
    (f: keyof Card) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [f]: e.target.value }));
  const toggle = (f: "Misprint" | "Altered") => () =>
    setForm((p) => ({ ...p, [f]: p[f] === "true" ? "false" : "true" }));
  const inp =
    "bg-neutral-800 border border-white/10 rounded-md px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500 transition-colors w-full";
  const lbl =
    "flex flex-col gap-1.5 text-[11px] uppercase tracking-widest text-neutral-500 font-semibold";
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-white/10 rounded-t-2xl sm:rounded-xl w-full sm:max-w-[580px] max-h-[92vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 sm:px-6 sm:pt-5 border-b border-white/10">
          <h2 className="text-base font-semibold truncate pr-4">
            {row.Name || "New Card"}
          </h2>
          <button
            className="text-neutral-500 hover:text-neutral-200 w-7 h-7 flex items-center justify-center rounded transition-colors shrink-0"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-5 sm:p-6">
          <label className={lbl}>
            Name
            <input className={inp} value={form.Name} onChange={set("Name")} />
          </label>
          <label className={lbl}>
            Set Code
            <input
              className={inp}
              value={form["Set code"]}
              onChange={set("Set code")}
            />
          </label>
          <label className={lbl}>
            Set Name
            <input
              className={inp}
              value={form["Set name"]}
              onChange={set("Set name")}
            />
          </label>
          <label className={lbl}>
            Collector #
            <input
              className={inp}
              value={form["Collector number"]}
              onChange={set("Collector number")}
            />
          </label>
          <label className={lbl}>
            Foil
            <select className={inp} value={form.Foil} onChange={set("Foil")}>
              <option value="normal">Normal</option>
              <option value="foil">Foil</option>
              <option value="etched">Etched</option>
            </select>
          </label>
          <label className={lbl}>
            Rarity
            <select
              className={inp}
              value={form.Rarity}
              onChange={set("Rarity")}
            >
              {Object.keys(RARITY_ORDER).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className={lbl}>
            Quantity
            <input
              className={inp}
              type="number"
              min="1"
              value={form.Quantity}
              onChange={set("Quantity")}
            />
          </label>
          <label className={lbl}>
            Condition
            <select
              className={inp}
              value={form.Condition}
              onChange={set("Condition")}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {CONDITION_LABELS[c]} – {c}
                </option>
              ))}
            </select>
          </label>
          <label className={lbl}>
            Language
            <select
              className={inp}
              value={form.Language}
              onChange={set("Language")}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className={lbl}>
            Purchase Price
            <input
              className={inp}
              type="number"
              step="0.01"
              value={form["Purchase price"]}
              onChange={set("Purchase price")}
            />
          </label>
          <label className={lbl}>
            Currency
            <input
              className={inp}
              value={form["Purchase price currency"]}
              onChange={set("Purchase price currency")}
            />
          </label>
          <label className={lbl}>
            ManaBox ID
            <input
              className={inp}
              value={form["ManaBox ID"]}
              onChange={set("ManaBox ID")}
            />
          </label>
          <label className={`${lbl} sm:col-span-2`}>
            Scryfall ID
            <input
              className={inp}
              value={form["Scryfall ID"]}
              onChange={set("Scryfall ID")}
            />
          </label>
          <div className="sm:col-span-2 flex gap-2.5">
            {(["Misprint", "Altered"] as const).map((f) => (
              <button
                key={f}
                onClick={toggle(f)}
                className={`flex-1 py-2.5 rounded-md text-sm border transition-all ${form[f] === "true" ? "bg-violet-500/20 border-violet-500 text-violet-300 font-semibold" : "bg-neutral-800 border-white/10 text-neutral-500"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2.5 px-5 py-4 sm:px-6 border-t border-white/10">
          <button
            className="flex-1 sm:flex-none px-4 py-2.5 text-sm border border-white/10 rounded-lg text-neutral-300 hover:border-violet-400 hover:text-violet-300 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex-1 sm:flex-none px-4 py-2.5 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
            onClick={() => onSave(form)}
          >
            Save card
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile card row ──────────────────────────────────────────────────────────

function MobileCardRow({
  card,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  card: Card;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`px-4 py-3 border-b border-white/5 flex gap-3 ${selected ? "bg-violet-500/8" : ""}`}
    >
      <input
        type="checkbox"
        className="accent-violet-500 mt-1 shrink-0"
        checked={selected}
        onChange={onSelect}
      />
      <div className="flex-1 min-w-0" onClick={onEdit}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="font-medium text-sm leading-tight">{card.Name}</span>
          <span className="inline-block bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-neutral-400 uppercase shrink-0">
            {card["Set code"]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          <span className="flex items-center capitalize">
            <RarityPip rarity={card.Rarity} />
            {card.Rarity}
          </span>
          {card.Foil !== "normal" && (
            <span className="bg-violet-500/10 border border-violet-500/30 text-violet-300 rounded px-1.5 py-0.5 text-[11px] capitalize">
              {card.Foil}
            </span>
          )}
          <span className="bg-white/5 rounded px-1.5 py-0.5 text-[11px] font-semibold text-neutral-400">
            {CONDITION_LABELS[card.Condition] ?? card.Condition}
          </span>
          <span className="uppercase tracking-wider">{card.Language}</span>
          <span className="font-semibold text-violet-300">
            ×{card.Quantity}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end justify-between shrink-0">
        <span className="text-xs text-neutral-500 tabular-nums">
          {card["Purchase price"]
            ? `€${parseFloat(card["Purchase price"]).toFixed(2)}`
            : "—"}
        </span>
        <button
          onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    )
      pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }
  const btnCls = (active: boolean) =>
    `min-w-[32px] h-8 px-2 rounded text-sm transition-colors ${active ? "bg-violet-600 text-white font-semibold" : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"}`;
  return (
    <div className="flex items-center gap-1 px-4 sm:px-6 py-2.5 border-t border-white/10 bg-neutral-900">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="h-8 px-3 text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ← Prev
      </button>
      <div className="flex items-center gap-1 mx-1">
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`el-${i}`} className="px-1 text-neutral-600">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={btnCls(p === page)}
            >
              {p}
            </button>
          ),
        )}
      </div>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="h-8 px-3 text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next →
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
  const [isNew, setIsNew] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/collection.csv")
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.text();
      })
      .then((text) => {
        setCards(parseCSV(text));
        setLoading(false);
      })
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

  const handleSaveToFile = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const blob = new Blob([toCSV(cards)], { type: "text/csv" });
      const fd = new FormData();
      fd.append(
        "file",
        new File([blob], "collection.csv", { type: "text/csv" }),
      );
      const data = await fetch("/api/collection-upload", {
        method: "POST",
        body: fd,
      }).then((r) => r.json());
      if (data.ok) {
        setDirty(false);
        setSaveMsg("✓ Saved successfully");
        setTimeout(() => setSaveMsg(null), 3000);
      } else setSaveMsg(`✗ ${data.error ?? "Save failed"}`);
    } catch {
      setSaveMsg("✗ Save failed");
    }
    setSaving(false);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc((a) => !a);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const base = q
      ? cards.filter(
          (c) =>
            c.Name.toLowerCase().includes(q) ||
            c["Set name"].toLowerCase().includes(q) ||
            c["Set code"].toLowerCase().includes(q),
        )
      : cards;
    return [...base].sort((a, b) => {
      const av = a[sortField] ?? "",
        bv = b[sortField] ?? "";
      if (sortField === "Rarity")
        return sortAsc
          ? (RARITY_ORDER[av] ?? 0) - (RARITY_ORDER[bv] ?? 0)
          : (RARITY_ORDER[bv] ?? 0) - (RARITY_ORDER[av] ?? 0);
      if (sortField === "Quantity" || sortField === "Purchase price")
        return sortAsc
          ? (parseFloat(av) || 0) - (parseFloat(bv) || 0)
          : (parseFloat(bv) || 0) - (parseFloat(av) || 0);
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [cards, debouncedSearch, sortField, sortAsc]);

  // Clamp page to valid range (derived — no effect needed)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const stats = useMemo(
    () => ({
      total: cards.reduce((s, c) => s + (parseInt(c.Quantity) || 0), 0),
      value: cards.reduce(
        (s, c) =>
          s +
          (parseFloat(c["Purchase price"]) || 0) * (parseInt(c.Quantity) || 1),
        0,
      ),
      sets: new Set(cards.map((c) => c["Set code"])).size,
    }),
    [cards],
  );

  const goToPage = (p: number) => {
    setPage(p);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openEdit = (row: Card) => {
    setIsNew(false);
    setEditRow({ ...row });
  };
  const openNew = () => {
    setIsNew(true);
    setEditRow(EMPTY_CARD());
  };

  const handleSave = (updated: Card) => {
    if (isNew) setCards((prev) => [...prev, updated]);
    else
      setCards((prev) =>
        prev.map((c) => (c._id === updated._id ? updated : c)),
      );
    setEditRow(null);
    setDirty(true);
  };

  const deleteRow = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c._id !== id));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    setDirty(true);
  }, []);

  const deleteSelected = () => {
    setCards((prev) => prev.filter((c) => !selected.has(c._id)));
    setSelected(new Set());
    setDirty(true);
  };
  const toggleSelect = useCallback(
    (id: string) =>
      setSelected((s) => {
        const n = new Set(s);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
      }),
    [],
  );
  const toggleAll = () => {
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map((c) => c._id)));
  };

  const SI = ({ field }: { field: SortField }) =>
    sortField === field ? (
      sortAsc ? (
        " ↑"
      ) : (
        " ↓"
      )
    ) : (
      <span className="opacity-30"> ↕</span>
    );

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-500 bg-neutral-950">
        Loading collection…
      </div>
    );

  const bannerCls = saveMsg?.startsWith("✓")
    ? "bg-emerald-950 border-b border-emerald-800 text-emerald-300"
    : saveMsg
      ? "bg-red-950 border-b border-red-800 text-red-300"
      : "bg-amber-950 border-b border-amber-800 text-amber-300";

  return (
    <div
      ref={topRef}
      className="flex flex-col min-h-screen bg-neutral-950 text-neutral-100 font-sans"
    >
      {(dirty || !!saveMsg) && (
        <div
          className={`sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium ${bannerCls}`}
        >
          <span className="flex-1 min-w-0 text-xs sm:text-sm">
            {saveMsg ?? "Unsaved changes — won't persist until saved."}
          </span>
          {dirty && (
            <button
              onClick={handleSaveToFile}
              disabled={saving}
              className="shrink-0 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-3.5 py-1.5 rounded-md transition-colors"
            >
              {saving ? "Saving…" : "Save to file"}
            </button>
          )}
        </div>
      )}

      <header className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 bg-neutral-900 border-b border-white/10">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex gap-1 sm:gap-1.5">
            {[
              ["W", "#e8ddb4", "#333"],
              ["U", "#0e68ab", "#fff"],
              ["B", "#2d2d2d", "#fff"],
              ["R", "#c3202a", "#fff"],
              ["G", "#00743e", "#fff"],
            ].map(([s, bg, fg]) => (
              <span
                key={s}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: bg, color: fg }}
              >
                {s}
              </span>
            ))}
          </div>
          <span className="text-sm font-semibold">Collection Editor</span>
        </div>
        <div className="hidden sm:flex gap-2.5">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 text-sm border border-white/10 rounded-lg text-neutral-400 hover:text-neutral-200 hover:border-white/20 transition-colors"
          >
            ← Dashboard
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 text-sm border border-white/10 rounded-lg text-neutral-300 hover:border-violet-400 hover:text-violet-300 transition-colors"
          >
            ↑ Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            hidden
          />
          <button
            onClick={() => downloadCSV(cards)}
            className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
          >
            ↓ Export
          </button>
        </div>
        <button
          className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 text-neutral-400"
          onClick={() => setMobileMenuOpen((o) => !o)}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="sm:hidden flex flex-col gap-2 px-4 py-3 bg-neutral-900 border-b border-white/10">
          <button
            onClick={() => {
              router.push("/");
              setMobileMenuOpen(false);
            }}
            className="w-full py-2.5 text-sm border border-white/10 rounded-lg text-neutral-400 text-left px-4"
          >
            ← Dashboard
          </button>
          <button
            onClick={() => {
              fileRef.current?.click();
              setMobileMenuOpen(false);
            }}
            className="w-full py-2.5 text-sm border border-white/10 rounded-lg text-neutral-300 text-left px-4"
          >
            ↑ Import CSV
          </button>
          <button
            onClick={() => {
              downloadCSV(cards);
              setMobileMenuOpen(false);
            }}
            className="w-full py-2.5 text-sm bg-violet-600 text-white rounded-lg font-medium text-left px-4"
          >
            ↓ Export CSV
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            hidden
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:flex bg-neutral-900 border-b border-white/10">
        {[
          ["unique cards", cards.length],
          ["total copies", stats.total],
          ["sets", stats.sets],
          ["total value", `€${stats.value.toFixed(2)}`],
        ].map(([label, val]) => (
          <div
            key={label as string}
            className="px-4 sm:px-5 py-2.5 sm:py-3 flex flex-col gap-0.5 border-r border-b sm:border-b-0 border-white/10 last:border-r-0 [&:nth-child(2)]:border-r-0 sm:[&:nth-child(2)]:border-r sm:[&:nth-child(4)]:border-r-0"
          >
            <span className="text-[10px] sm:text-[11px] uppercase tracking-widest text-neutral-500 font-semibold">
              {label}
            </span>
            <span className="text-lg sm:text-xl font-bold text-violet-300">
              {val}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-2.5 border-b border-white/10">
        <input
          className="flex-1 min-w-[160px] bg-neutral-900 border border-white/10 rounded-lg px-3.5 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-violet-500 transition-colors"
          placeholder="Search by name, set…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div className="flex gap-2 ml-auto">
          {selected.size > 0 && (
            <button
              onClick={deleteSelected}
              className="px-3 py-2 text-sm bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors whitespace-nowrap"
            >
              Delete {selected.size}
            </button>
          )}
          <button
            onClick={openNew}
            className="px-3 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="overflow-x-auto hidden sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-800">
              <th className="w-9 px-3.5 py-2.5 text-left border-b border-white/10">
                <input
                  type="checkbox"
                  className="accent-violet-500 w-3.5 h-3.5 cursor-pointer"
                  checked={
                    selected.size === visible.length && visible.length > 0
                  }
                  onChange={toggleAll}
                />
              </th>
              {(
                [
                  ["Name", "Name"],
                  ["Set code", "Set"],
                  ["Rarity", "Rarity"],
                  [null, "Foil"],
                  ["Quantity", "Qty"],
                  [null, "Cond."],
                  [null, "Lang."],
                  ["Purchase price", "Price"],
                ] as [SortField | null, string][]
              ).map(([field, label]) => (
                <th
                  key={label}
                  onClick={field ? () => toggleSort(field) : undefined}
                  className={`px-3.5 py-2.5 text-left text-[11px] uppercase tracking-widest font-semibold text-neutral-500 border-b border-white/10 whitespace-nowrap ${field ? "cursor-pointer select-none hover:text-neutral-200" : ""}`}
                >
                  {label}
                  {field && <SI field={field} />}
                </th>
              ))}
              <th className="w-16 border-b border-white/10" />
            </tr>
          </thead>
          <tbody>
            {visible.map((card) => (
              <tr
                key={card._id}
                onDoubleClick={() => openEdit(card)}
                className={`border-b border-white/5 transition-colors cursor-default ${selected.has(card._id) ? "bg-violet-500/8" : "hover:bg-white/[0.03]"}`}
              >
                <td className="px-3.5 py-2.5">
                  <input
                    type="checkbox"
                    className="accent-violet-500 w-3.5 h-3.5 cursor-pointer"
                    checked={selected.has(card._id)}
                    onChange={() => toggleSelect(card._id)}
                  />
                </td>
                <td className="px-3.5 py-2.5 font-medium">
                  <CardTooltip
                    scryfallId={card["Scryfall ID"]}
                    name={card.Name}
                  />
                </td>
                <td className="px-3.5 py-2.5">
                  <SetTooltip setCode={card["Set code"]} />
                </td>
                <td className="px-3.5 py-2.5">
                  <span className="flex items-center text-xs capitalize text-neutral-400">
                    <RarityPip rarity={card.Rarity} />
                    {card.Rarity}
                  </span>
                </td>
                <td className="px-3.5 py-2.5">
                  {card.Foil !== "normal" && (
                    <span className="bg-violet-500/10 border border-violet-500/30 text-violet-300 rounded px-1.5 py-0.5 text-[11px] capitalize">
                      {card.Foil}
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-2.5 text-center font-semibold text-violet-300">
                  {card.Quantity}
                </td>
                <td className="px-3.5 py-2.5">
                  <span className="bg-white/5 rounded px-1.5 py-0.5 text-[11px] font-semibold text-neutral-400">
                    {CONDITION_LABELS[card.Condition] ?? card.Condition}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-[11px] uppercase tracking-wider text-neutral-500">
                  {card.Language}
                </td>
                <td className="px-3.5 py-2.5 text-neutral-500 tabular-nums text-xs">
                  {card["Purchase price"]
                    ? `${card["Purchase price currency"] ?? "EUR"} ${parseFloat(card["Purchase price"]).toFixed(2)}`
                    : "—"}
                </td>
                <td className="px-3.5 py-2.5">
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(card)}
                      title="Edit"
                      className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:bg-neutral-800 hover:text-violet-300 transition-colors text-sm"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => deleteRow(card._id)}
                      title="Delete"
                      className="w-7 h-7 flex items-center justify-center rounded text-neutral-600 hover:bg-red-500/10 hover:text-red-400 transition-colors text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-neutral-600 py-16">
                  No cards match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="sm:hidden">
        {visible.length === 0 ? (
          <div className="text-center text-neutral-600 py-16 text-sm">
            No cards match your search.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 bg-neutral-900/50">
              <input
                type="checkbox"
                className="accent-violet-500"
                checked={selected.size === visible.length && visible.length > 0}
                onChange={toggleAll}
              />
              <span className="text-xs text-neutral-500">
                Select all on this page ({visible.length})
              </span>
            </div>
            {visible.map((card) => (
              <MobileCardRow
                key={card._id}
                card={card}
                selected={selected.has(card._id)}
                onSelect={() => toggleSelect(card._id)}
                onEdit={() => openEdit(card)}
                onDelete={() => deleteRow(card._id)}
              />
            ))}
          </>
        )}
      </div>

      <Pagination page={safePage} totalPages={totalPages} onChange={goToPage} />

      <div className="px-4 sm:px-6 py-2.5 text-xs text-neutral-600 border-t border-white/10 bg-neutral-900">
        Showing {(safePage - 1) * PAGE_SIZE + 1}–
        {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}{" "}
        cards
        {cards.length !== filtered.length && ` (filtered from ${cards.length})`}
        {search && ` · "${search}"`}
      </div>

      {editRow && (
        <EditModal
          row={editRow}
          onSave={handleSave}
          onClose={() => setEditRow(null)}
        />
      )}
    </div>
  );
}
