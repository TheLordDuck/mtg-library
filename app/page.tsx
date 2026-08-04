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

interface BackupFile {
  filename: string;
  size: number;
  created: string;
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

function ManaSymbols({ small = false }: { small?: boolean }) {
  const symbols = [
    { s: "W", bg: "#e8ddb4", fg: "#333" },
    { s: "U", bg: "#0e68ab", fg: "#fff" },
    { s: "B", bg: "#2d2d2d", fg: "#fff" },
    { s: "R", bg: "#c3202a", fg: "#fff" },
    { s: "G", bg: "#00743e", fg: "#fff" },
  ];
  return (
    <div className="flex gap-1.5 items-center">
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
  const [menuOpen, setMenuOpen] = useState(false);

  // Backup state
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null); // filename being restored
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null); // filename awaiting confirm

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

  const fetchBackups = () => {
    fetch("/api/backup")
      .then((r) => r.json())
      .then((data) => setBackups(data.backups ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchMeta();
    fetchBackups();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchMeta();
        fetchBackups();
      }
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

  const handleManualBackup = () => {
    setBackingUp(true);
    setBackupMsg(null);
    fetch("/api/backup", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setBackupMsg(`✓ Backup created: ${data.filename}`);
          setBackups(data.backups ?? []);
        } else {
          setBackupMsg(`✗ ${data.error ?? "Backup failed"}`);
        }
        setBackingUp(false);
        setTimeout(() => setBackupMsg(null), 4000);
      })
      .catch(() => {
        setBackupMsg("✗ Backup failed");
        setBackingUp(false);
      });
  };

  const handleRestore = (filename: string) => {
    setRestoring(filename);
    setBackupMsg(null);
    setConfirmRestore(null);
    fetch("/api/backup/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setBackupMsg(
            `✓ Restored from ${filename} — current file was backed up automatically`,
          );
          fetchMeta();
          fetchBackups();
        } else {
          setBackupMsg(`✗ ${data.error ?? "Restore failed"}`);
        }
        setRestoring(null);
        setTimeout(() => setBackupMsg(null), 6000);
      })
      .catch(() => {
        setBackupMsg("✗ Restore failed");
        setRestoring(null);
      });
  };

  const handleDownloadBackup = (filename: string) => {
    const a = document.createElement("a");
    a.href = `/api/backup/download?file=${encodeURIComponent(filename)}`;
    a.download = filename;
    a.click();
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, #1a0e2e, #0a0a0f)",
        }}
      >
        <ManaSymbols />
        <p className="text-neutral-500 text-sm">Loading…</p>
      </div>
    );
  }

  if (!meta?.exists) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-5 text-center px-6"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, #1a0e2e, #0a0a0f)",
        }}
      >
        <ManaSymbols />
        <h2 className="text-xl sm:text-2xl font-bold text-neutral-100">
          No collection file found
        </h2>
        <p className="text-neutral-500 max-w-sm leading-relaxed text-sm">
          Place{" "}
          <code className="bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-violet-300">
            collection.csv
          </code>{" "}
          in{" "}
          <code className="bg-neutral-800 border border-white/10 rounded px-1.5 py-0.5 text-violet-300">
            /public
          </code>
          , or import one now.
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full max-w-xs py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors"
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

  return (
    <div className="flex flex-col min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 bg-neutral-900 border-b border-white/10">
        <div className="flex items-center gap-2 sm:gap-3">
          <ManaSymbols small />
          <span className="text-sm font-semibold whitespace-nowrap">
            Collection Manager
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2.5">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 text-sm border border-white/10 rounded-lg text-neutral-300 hover:border-violet-400 hover:text-violet-300 disabled:opacity-50 transition-colors"
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
          <button
            onClick={() => router.push("/collection")}
            className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
          >
            Open collection →
          </button>
        </div>
        <button
          className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 text-neutral-400 shrink-0"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </header>

      {menuOpen && (
        <div className="sm:hidden flex flex-col gap-2 px-4 py-3 bg-neutral-900 border-b border-white/10">
          <button
            onClick={() => {
              fileRef.current?.click();
              setMenuOpen(false);
            }}
            disabled={uploading}
            className="w-full py-3 text-sm border border-white/10 rounded-lg text-neutral-300 text-left px-4 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "↑ Import CSV"}
          </button>
          <button
            onClick={() => {
              handleDownload();
              setMenuOpen(false);
            }}
            className="w-full py-3 text-sm border border-white/10 rounded-lg text-neutral-300 text-left px-4"
          >
            ↓ Download CSV
          </button>
          <button
            onClick={() => router.push("/collection")}
            className="w-full py-3 text-sm bg-violet-600 text-white rounded-lg font-medium text-left px-4"
          >
            Open collection →
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            hidden
          />
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-4 sm:gap-6">
        {uploadMsg && (
          <div
            className={`px-4 py-2.5 rounded-lg text-sm font-medium ${uploadMsg.startsWith("✓") ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}
          >
            {uploadMsg}
          </div>
        )}

        {/* File card */}
        <div className="bg-neutral-900 border border-white/10 rounded-xl p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
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
              <div className="text-sm sm:text-base font-semibold truncate">
                {meta.filename}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5 font-mono truncate">
                public/{meta.filename}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 sm:flex-none py-2 px-3 text-xs border border-white/10 rounded-md text-neutral-400 hover:border-violet-400 hover:text-violet-300 transition-colors"
            >
              Replace
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 sm:flex-none py-2 px-3 text-xs border border-white/10 rounded-md text-neutral-400 hover:border-violet-400 hover:text-violet-300 transition-colors"
            >
              Download
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 gap-px bg-white/10">
            {[
              { label: "File size", value: formatBytes(meta.size) },
              { label: "Cards", value: meta.rows },
              { label: "Columns", value: meta.columns },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-neutral-900 px-4 py-3.5 flex flex-col gap-1"
              >
                <span className="text-[10px] uppercase tracking-widest font-semibold text-neutral-500">
                  {label}
                </span>
                <span className="text-lg font-bold text-violet-300 leading-tight">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <div className="h-px bg-white/10" />
          {[
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
            {
              label: "Format",
              value: "ManaBox CSV",
              sub: "UTF-8, comma-separated",
            },
          ].map(({ label, value, sub }, i, arr) => (
            <div
              key={label}
              className={`flex items-center justify-between gap-4 px-4 py-3.5 bg-neutral-900 ${i < arr.length - 1 ? "border-b border-white/10" : ""}`}
            >
              <span className="text-[10px] uppercase tracking-widest font-semibold text-neutral-500 shrink-0">
                {label}
              </span>
              <div className="flex flex-col items-end gap-0.5 min-w-0">
                <span className="text-sm font-semibold text-violet-300 text-right">
                  {value}
                </span>
                {sub && (
                  <span className="text-[10px] text-neutral-600">{sub}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          onClick={() => router.push("/collection")}
          className="flex items-center gap-3 sm:gap-4 bg-neutral-900 border border-white/10 hover:border-violet-500 hover:bg-neutral-800 rounded-xl px-4 sm:px-6 py-4 sm:py-5 cursor-pointer transition-colors group"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-base sm:text-lg shrink-0">
            ✎
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Edit collection</div>
            <div className="text-xs text-neutral-500 mt-0.5">
              Add, remove, or modify cards. Export when done.
            </div>
          </div>
          <div className="ml-auto text-neutral-600 group-hover:text-neutral-400 text-lg shrink-0 transition-colors">
            →
          </div>
        </div>

        {/* ── Backups ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Backups</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Last 7 daily backups — auto-created at 03:30
              </p>
            </div>
            <button
              onClick={handleManualBackup}
              disabled={backingUp}
              className="px-3 py-1.5 text-xs border border-white/10 rounded-lg text-neutral-300 hover:border-violet-400 hover:text-violet-300 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {backingUp ? "Backing up…" : "↑ Backup now"}
            </button>
          </div>

          {backupMsg && (
            <div
              className={`px-4 py-2.5 rounded-lg text-sm font-medium ${backupMsg.startsWith("✓") ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}
            >
              {backupMsg}
            </div>
          )}

          {backups.length === 0 ? (
            <div className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-6 text-center text-neutral-600 text-sm">
              No backups yet — click Backup now to create one.
            </div>
          ) : (
            <div className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden divide-y divide-white/10">
              {backups.map((b) => {
                const isRestoring = restoring === b.filename;
                const isConfirming = confirmRestore === b.filename;
                const dateLabel = b.filename
                  .replace("collection-", "")
                  .replace(".csv", "");
                return (
                  <div
                    key={b.filename}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-neutral-200">
                        {dateLabel}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {formatBytes(b.size)} · {timeAgo(b.created)}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {/* Download backup */}

                      {/* Restore — two-step confirm */}
                      {isConfirming ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleRestore(b.filename)}
                            disabled={isRestoring}
                            className="py-1.5 px-2.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50"
                          >
                            {isRestoring ? "…" : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmRestore(null)}
                            className="py-1.5 px-2.5 text-xs border border-white/10 rounded-md text-neutral-400 hover:text-neutral-200 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmRestore(b.filename)}
                          disabled={!!restoring}
                          className="py-1.5 px-2.5 text-xs border border-white/10 rounded-md text-neutral-400 hover:border-amber-500 hover:text-amber-400 disabled:opacity-50 transition-colors"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
