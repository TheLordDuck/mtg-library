"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Upload, Download, ArrowRight, Menu, X, FileSpreadsheet, Clock, CalendarDays,
  FileType, PencilLine, History, RotateCcw, Check, AlertTriangle, Loader2,
} from "lucide-react";
import { Button, IconButton, Panel, StatTile, Banner } from "@/components/ui";

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
          className={`rounded-full flex items-center justify-center font-bold shrink-0 ring-1 ring-white/10 ${small ? "w-5 h-5 text-[10px]" : "w-7 h-7 text-xs"}`}
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
            ? `ok:Replaced with ${file.name}`
            : `err:${data.error ?? "Upload failed"}`,
        );
        if (data.ok) fetchMeta();
        setUploading(false);
      })
      .catch(() => {
        setUploadMsg("err:Upload failed");
        setUploading(false);
      });
    e.target.value = "";
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = "/api/collection-upload";
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
          setBackupMsg(`ok:Backup created — ${data.filename}`);
          setBackups(data.backups ?? []);
        } else {
          setBackupMsg(`err:${data.error ?? "Backup failed"}`);
        }
        setBackingUp(false);
        setTimeout(() => setBackupMsg(null), 4000);
      })
      .catch(() => {
        setBackupMsg("err:Backup failed");
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
          setBackupMsg(`ok:Restored from ${filename} — previous file backed up automatically`);
          fetchMeta();
          fetchBackups();
        } else {
          setBackupMsg(`err:${data.error ?? "Restore failed"}`);
        }
        setRestoring(null);
        setTimeout(() => setBackupMsg(null), 6000);
      })
      .catch(() => {
        setBackupMsg("err:Restore failed");
        setRestoring(null);
      });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <ManaSymbols />
        <p className="text-text-faint text-sm flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </p>
      </div>
    );
  }

  if (!meta?.exists) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 text-center px-6">
        <ManaSymbols />
        <h2 className="text-xl sm:text-2xl font-bold text-text">No collection file found</h2>
        <p className="text-text-muted max-w-sm leading-relaxed text-sm">
          Import a ManaBox <code className="bg-surface border border-border rounded px-1.5 py-0.5 text-accent font-mono text-xs">collection.csv</code> export to get started.
        </p>
        <Button variant="primary" className="w-full max-w-xs py-3.5" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4" /> Import CSV
        </Button>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} hidden />
      </div>
    );
  }

  const uploadOk = uploadMsg?.startsWith("ok:");
  const uploadText = uploadMsg?.replace(/^(ok|err):/, "");
  const backupOk = backupMsg?.startsWith("ok:");
  const backupText = backupMsg?.replace(/^(ok|err):/, "");

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 bg-surface-2/90 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-2 sm:gap-3">
          <ManaSymbols small />
          <span className="text-sm font-semibold whitespace-nowrap">Collection Manager</span>
        </div>
        <div className="hidden sm:flex items-center gap-2.5">
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "Uploading…" : "Import CSV"}
          </Button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} hidden />
          <Button onClick={handleDownload}>
            <Download className="w-3.5 h-3.5" /> Download CSV
          </Button>
          <Button variant="primary" onClick={() => router.push("/collection")}>
            Open collection <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
        <IconButton className="sm:hidden !w-9 !h-9 border border-border" onClick={() => setMenuOpen((o) => !o)}>
          {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </IconButton>
      </header>

      {menuOpen && (
        <div className="sm:hidden flex flex-col gap-2 px-4 py-3 bg-surface-2 border-b border-border">
          <Button
            className="w-full justify-start px-4 py-3"
            disabled={uploading}
            onClick={() => { fileRef.current?.click(); setMenuOpen(false); }}
          >
            <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Import CSV"}
          </Button>
          <Button className="w-full justify-start px-4 py-3" onClick={() => { handleDownload(); setMenuOpen(false); }}>
            <Download className="w-3.5 h-3.5" /> Download CSV
          </Button>
          <Button variant="primary" className="w-full justify-start px-4 py-3" onClick={() => router.push("/collection")}>
            Open collection <ArrowRight className="w-3.5 h-3.5" />
          </Button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} hidden />
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-4 sm:gap-6">
        {uploadMsg && (
          <Banner tone={uploadOk ? "success" : "danger"}>
            {uploadOk ? <Check className="w-3.5 h-3.5 inline mr-1.5" /> : <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />}
            {uploadText}
          </Banner>
        )}

        {/* File card */}
        <Panel className="p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-11 h-11 rounded-lg bg-accent-soft border border-accent-border flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm sm:text-base font-semibold truncate">{meta.filename}</div>
              <div className="text-xs text-text-faint mt-0.5 font-mono truncate">persistent data volume</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 sm:flex-none" onClick={() => fileRef.current?.click()}>
              Replace
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={handleDownload}>
              Download
            </Button>
          </div>
        </Panel>

        {/* Stats */}
        <Panel className="overflow-hidden">
          <div className="grid grid-cols-3 gap-px bg-border">
            {[
              { label: "File size", value: formatBytes(meta.size) },
              { label: "Cards", value: meta.rows },
              { label: "Columns", value: meta.columns },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface px-4 py-3.5">
                <StatTile label={label} value={value} />
              </div>
            ))}
          </div>
          <div className="h-px bg-border" />
          {[
            { label: "Last modified", icon: <Clock className="w-3 h-3" />, value: formatDate(meta.lastModified), sub: timeAgo(meta.lastModified) },
            { label: "Created", icon: <CalendarDays className="w-3 h-3" />, value: formatDate(meta.created), sub: timeAgo(meta.created) },
            { label: "Format", icon: <FileType className="w-3 h-3" />, value: "ManaBox CSV", sub: "UTF-8, comma-separated" },
          ].map(({ label, icon, value, sub }, i, arr) => (
            <div
              key={label}
              className={`flex items-center justify-between gap-4 px-4 py-3.5 bg-surface ${i < arr.length - 1 ? "border-b border-border" : ""}`}
            >
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-semibold text-text-faint shrink-0">
                {icon}
                {label}
              </span>
              <div className="flex flex-col items-end gap-0.5 min-w-0">
                <span className="text-sm font-semibold text-accent text-right font-mono">{value}</span>
                {sub && <span className="text-[10px] text-text-faint">{sub}</span>}
              </div>
            </div>
          ))}
        </Panel>

        {/* CTA */}
        <button
          onClick={() => router.push("/collection")}
          className="flex items-center gap-3 sm:gap-4 bg-surface border border-border hover:border-accent-border hover:bg-surface-hover rounded-xl px-4 sm:px-6 py-4 sm:py-5 cursor-pointer transition-colors group text-left"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-accent-soft border border-accent-border flex items-center justify-center shrink-0">
            <PencilLine className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-accent" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Edit collection</div>
            <div className="text-xs text-text-faint mt-0.5">Add, remove, or modify cards. Export when done.</div>
          </div>
          <ArrowRight className="ml-auto w-4 h-4 text-text-faint group-hover:text-text-muted shrink-0 transition-colors" />
        </button>

        {/* ── Backups ── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-text-faint" /> Backups
              </h2>
              <p className="text-xs text-text-faint mt-0.5">Last 7 daily backups — auto-created at 03:00</p>
            </div>
            <Button size="sm" disabled={backingUp} onClick={handleManualBackup}>
              {backingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {backingUp ? "Backing up…" : "Backup now"}
            </Button>
          </div>

          {backupMsg && (
            <Banner tone={backupOk ? "success" : "danger"}>
              {backupOk ? <Check className="w-3.5 h-3.5 inline mr-1.5" /> : <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />}
              {backupText}
            </Banner>
          )}

          {backups.length === 0 ? (
            <Panel className="px-4 py-6 text-center text-text-faint text-sm">
              No backups yet — click Backup now to create one.
            </Panel>
          ) : (
            <Panel className="overflow-hidden divide-y divide-border">
              {backups.map((b) => {
                const isRestoring = restoring === b.filename;
                const isConfirming = confirmRestore === b.filename;
                const dateLabel = b.filename.replace("collection-", "").replace(".csv", "");
                return (
                  <div key={b.filename} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text">{dateLabel}</div>
                      <div className="text-xs text-text-faint mt-0.5">
                        {formatBytes(b.size)} · {timeAgo(b.created)}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {isConfirming ? (
                        <div className="flex gap-1.5">
                          <Button variant="danger" size="sm" disabled={isRestoring} onClick={() => handleRestore(b.filename)}>
                            {isRestoring ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmRestore(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" disabled={!!restoring} onClick={() => setConfirmRestore(b.filename)}>
                          <RotateCcw className="w-3 h-3" /> Restore
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
