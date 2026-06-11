"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

interface FileMeta {
  exists: boolean;
  size: number;
  lastModified: string;
  created: string;
  rows: number;
  columns: number;
  filename: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function ManaRow({ small = false }: { small?: boolean }) {
  const symbols = [
    { s: "W", bg: "#e8ddb4", fg: "#333" },
    { s: "U", bg: "#0e68ab", fg: "#fff" },
    { s: "B", bg: "#2d2d2d", fg: "#fff" },
    { s: "R", bg: "#c3202a", fg: "#fff" },
    { s: "G", bg: "#00743e", fg: "#fff" },
  ];
  return (
    <div className="flex gap-2 items-center">
      {symbols.map(({ s, bg, fg }) => (
        <span
          key={s}
          className={`rounded-full flex items-center justify-center font-bold shrink-0 ${small ? "w-5 h-5 text-[10px]" : "w-7 h-7 text-xs"}`}
          style={{ background: bg, color: fg }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchMeta = () => {
    fetch("/api/collection-meta")
      .then((r) => r.json())
      .then((data) => {
        setMeta(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchMeta();
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchMeta();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    const formData = new FormData();
    formData.append("file", file);
    fetch("/api/collection-upload", { method: "POST", body: formData })
      .then((r) => r.json())
      .then((data) => {
        setUploadMsg(
          data.ok
            ? `✓ Replaced with ${file.name}`
            : `✗ ${data.error ?? "Upload failed"}`,
        );
        if (data.ok) fetchMeta();
        setUploading(false);
      })
      .catch(() => {
        setUploadMsg("✗ Upload failed");
        setUploading(false);
      });
    e.target.value = "";
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = "/collection.csv";
    a.download = "collection.csv";
    a.click();
  };

  // ── Loading ──
  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 bg-neutral-950"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, #1a0e2e, #0a0a0f)",
        }}
      >
        <ManaRow />
        <p className="text-neutral-500">Loading…</p>
      </div>
    );
  }

  // ── No file ──
  if (!meta?.exists) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, #1a0e2e, #0a0a0f)",
        }}
      >
        <ManaRow />
        <h2 className="text-2xl font-bold text-neutral-100">
          No collection file found
        </h2>
        <p className="text-neutral-500 max-w-sm leading-relaxed">
          Place{" "}
          <code className="bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-[0.85em] text-violet-300">
            collection.csv
          </code>{" "}
          in{" "}
          <code className="bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-[0.85em] text-violet-300">
            /public
          </code>
          , or import one now.
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-2 px-8 py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg text-base transition-colors"
        >
          Import CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleImport}
          hidden
        />
      </div>
    );
  }

  const metaItems = [
    { label: "File size", value: formatBytes(meta.size), sub: null },
    { label: "Cards (rows)", value: meta.rows, sub: null },
    { label: "Columns", value: meta.columns, sub: null },
    {
      label: "Last modified",
      value: formatDate(meta.lastModified),
      sub: timeAgo(meta.lastModified),
    },
    {
      label: "Created",
      value: formatDate(meta.created),
      sub: timeAgo(meta.created),
    },
    { label: "Format", value: "ManaBox CSV", sub: "UTF-8, comma-separated" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-neutral-900 border-b border-white/10">
        <div className="flex items-center gap-3">
          <ManaRow small />
          <span className="text-sm font-semibold">Collection Manager</span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 text-sm border border-white/10 rounded-lg text-neutral-300 hover:border-violet-400 hover:text-violet-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? "Uploading…" : "↑ Import CSV"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            hidden
          />
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-sm border border-white/10 rounded-lg text-neutral-300 hover:border-violet-400 hover:text-violet-300 transition-colors"
          >
            ↓ Download CSV
          </button>
          {/*
          <button
            onClick={() => router.push("/collection")}
            className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
          >
            Open collection →
          </button>
          */}
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
        {/* Upload feedback */}
        {uploadMsg && (
          <div
            className={`px-4 py-2.5 rounded-lg text-sm font-medium ${
              uploadMsg.startsWith("✓")
                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}
          >
            {uploadMsg}
          </div>
        )}

        {/* File card */}
        <div className="flex items-center gap-4 bg-neutral-900 border border-white/10 rounded-xl p-5">
          <div className="shrink-0">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#22222d" />
              <path
                d="M12 8h12l8 8v20a2 2 0 01-2 2H12a2 2 0 01-2-2V10a2 2 0 012-2z"
                fill="#2e2e3a"
                stroke="#7c3aed"
                strokeWidth="1.5"
              />
              <path
                d="M24 8v8h8"
                stroke="#7c3aed"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M16 22h8M16 26h6"
                stroke="#a78bfa"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold">{meta.filename}</div>
            <div className="text-xs text-neutral-500 mt-0.5 font-mono">
              public/{meta.filename}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-1.5 text-xs border border-white/10 rounded-md text-neutral-400 hover:border-violet-400 hover:text-violet-300 transition-colors"
            >
              Replace
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-1.5 text-xs border border-white/10 rounded-md text-neutral-400 hover:border-violet-400 hover:text-violet-300 transition-colors"
            >
              Download
            </button>
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-xl overflow-hidden">
          {metaItems.map(({ label, value, sub }) => (
            <div
              key={label}
              className="bg-neutral-900 px-5 py-4 flex flex-col gap-1"
            >
              <span className="text-[11px] uppercase tracking-widest font-semibold text-neutral-500">
                {label}
              </span>
              <span className="text-xl font-bold text-violet-300 leading-tight">
                {value}
              </span>
              {sub && (
                <span className="text-[11px] text-neutral-600">{sub}</span>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          onClick={() => router.push("/collection")}
          className="flex items-center gap-4 bg-neutral-900 border border-white/10 hover:border-violet-500 hover:bg-neutral-800 rounded-xl px-6 py-5 cursor-pointer transition-colors group"
        >
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-lg shrink-0">
            ✎
          </div>
          <div>
            <div className="text-sm font-semibold">Edit collection</div>
            <div className="text-xs text-neutral-500 mt-0.5">
              Add, remove, or modify cards. Export when done.
            </div>
          </div>
          <div className="ml-auto text-neutral-600 group-hover:text-neutral-400 text-lg shrink-0 transition-colors">
            →
          </div>
        </div>
      </div>
    </div>
  );
}
