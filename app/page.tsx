"use client";

import { useState, useRef, useEffect, ChangeEvent } from "react";
import Link from "next/link";
import {
  Upload, Download, ArrowRight, FileSpreadsheet, Plus, Check, AlertTriangle, Loader2,
} from "lucide-react";
import { Button, Panel, StatTile, Banner } from "@/components/ui";
import { AppHeader, Logo } from "@/components/app-header";
import { parseCSV, RARITY_COLOR, RARITY_ORDER, type Card } from "@/lib/csv";

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

export default function DashboardPage() {
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);

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
    fetch("/api/collection-upload")
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => setCards(text.trim() ? parseCSV(text) : []))
      .catch(() => {});
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
        <Logo size={72} />
        <p className="text-text-faint text-sm flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </p>
      </div>
    );
  }

  if (!meta?.exists) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 text-center px-6">
        <Logo size={72} />
        <h2 className="font-serif text-4xl sm:text-5xl font-normal text-text">No collection yet</h2>
        <p className="text-text-muted max-w-sm leading-relaxed text-sm">
          Import a ManaBox <code className="bg-surface border border-border rounded px-1.5 py-0.5 text-accent-hover font-mono text-xs">collection.csv</code> export to get started.
        </p>
        <Button variant="primary" className="w-full max-w-xs min-h-[52px]" onClick={() => fileRef.current?.click()}>
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

  const copies = cards.reduce((s, c) => s + (parseInt(c.Quantity) || 0), 0);
  const value = cards.reduce((s, c) => s + (parseFloat(c["Purchase price"]) || 0) * (parseInt(c.Quantity) || 1), 0);
  const sets = new Set(cards.map((c) => c["Set code"])).size;
  const rarityCounts = Object.keys(RARITY_ORDER).map((r) => ({
    rarity: r,
    count: cards.filter((c) => c.Rarity === r).reduce((s, c) => s + (parseInt(c.Quantity) || 0), 0),
  }));

  return (
    <div className="flex flex-col min-h-screen">
      <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} hidden />
      <AppHeader
        actions={
          <>
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading…" : "Import CSV"}
            </Button>
            <Button onClick={handleDownload}>
              <Download className="w-4 h-4" /> Export
            </Button>
          </>
        }
      />

      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16 flex flex-col gap-8">
        {uploadMsg && (
          <Banner tone={uploadOk ? "success" : "danger"}>
            {uploadOk ? <Check className="w-4 h-4 inline mr-2" /> : <AlertTriangle className="w-4 h-4 inline mr-2" />}
            {uploadText}
          </Banner>
        )}

        {/* ── Hero ── */}
        <section className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs tracking-[2px] uppercase text-text-faint font-semibold">Your library</span>
            <h1 className="font-serif font-normal text-5xl sm:text-[64px] leading-none">
              The collection, <em className="text-accent">up to date</em>
            </h1>
            <p className="text-text-muted max-w-[520px]">
              {meta.filename} · updated {timeAgo(meta.lastModified)} · daily backup at 03:00
            </p>
          </div>
          <Link
            href="/collection"
            className="inline-flex items-center gap-2.5 min-h-[52px] px-6 rounded-xl bg-accent hover:bg-accent-hover text-accent-ink font-semibold transition-colors"
          >
            Open collection <ArrowRight className="w-[18px] h-[18px]" />
          </Link>
        </section>

        {/* ── Stats ── */}
        <section aria-label="Summary" className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-2xl overflow-hidden">
          {[
            { label: "Unique cards", value: cards.length.toLocaleString() },
            { label: "Total copies", value: copies.toLocaleString() },
            { label: "Sets", value: sets.toLocaleString() },
            { label: "Estimated value", value: `€${value.toFixed(2)}`, accent: true },
          ].map(({ label, value, accent }) => (
            <div key={label} className="bg-surface p-5 sm:p-6">
              <StatTile label={label} value={<span className={accent ? "text-accent" : ""}>{value}</span>} />
            </div>
          ))}
        </section>

        {/* ── Rarity breakdown ── */}
        {copies > 0 && (
          <section aria-label="By rarity" className="flex flex-col gap-3">
            <div className="flex justify-between items-baseline">
              <h2 className="text-[15px] font-semibold">By rarity</h2>
              <span className="text-[13px] text-text-faint">copies</span>
            </div>
            <div className="flex h-3 rounded-md overflow-hidden gap-0.5" aria-hidden="true">
              {rarityCounts.filter((r) => r.count > 0).map(({ rarity, count }) => (
                <span key={rarity} style={{ flex: count, background: RARITY_COLOR[rarity] }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-text-muted">
              {rarityCounts.map(({ rarity, count }) => (
                <span key={rarity} className="inline-flex items-center gap-2 capitalize">
                  <span className="w-2 h-2 rounded-full" style={{ background: RARITY_COLOR[rarity] }} />
                  {rarity}
                  <b className="text-text font-mono font-semibold">{count.toLocaleString()}</b>
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-6 items-start">
          {/* ── File card ── */}
          <Panel className="flex-[1_1_360px] min-w-0 p-6 flex flex-col gap-5" aria-label="File">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 shrink-0 rounded-xl bg-accent-soft border border-accent-border flex items-center justify-center text-accent">
                <FileSpreadsheet className="w-[22px] h-[22px]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold truncate">{meta.filename}</span>
                <span className="text-[13px] text-text-faint">ManaBox CSV · UTF-8 · persistent volume</span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                ["Size", formatBytes(meta.size)],
                ["Columns", meta.columns],
                ["Modified", formatDate(meta.lastModified)],
                ["Created", formatDate(meta.created)],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-text-faint">{label}</dt>
                  <dd className="font-mono text-sm">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 pt-5 border-t border-border">
              <Button className="flex-[1_1_140px] bg-surface-hover" onClick={() => fileRef.current?.click()}>
                Replace file
              </Button>
              <Button className="flex-[1_1_140px] bg-surface-hover" onClick={handleDownload}>
                Download
              </Button>
            </div>
          </Panel>

          {/* ── Backups ── */}
          <Panel className="flex-[1.4_1_420px] min-w-0 p-6 flex flex-col gap-4" aria-label="Backups">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div className="flex flex-col">
                <h2 className="font-semibold">Backups</h2>
                <span className="text-[13px] text-text-faint">Last 7 days · automatic at 03:00</span>
              </div>
              <Button variant="soft" disabled={backingUp} onClick={handleManualBackup}>
                {backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {backingUp ? "Backing up…" : "Back up now"}
              </Button>
            </div>

            {backupMsg && (
              <Banner tone={backupOk ? "success" : "danger"}>
                {backupOk ? <Check className="w-4 h-4 inline mr-2" /> : <AlertTriangle className="w-4 h-4 inline mr-2" />}
                {backupText}
              </Banner>
            )}

            {backups.length === 0 ? (
              <p className="py-6 text-center text-text-faint text-sm">
                No backups yet — click Back up now to create one.
              </p>
            ) : (
              <ol className="flex flex-col">
                {backups.map((b, i) => {
                  const isRestoring = restoring === b.filename;
                  const isConfirming = confirmRestore === b.filename;
                  const dateLabel = b.filename.replace("collection-", "").replace(".csv", "");
                  return (
                    <li key={b.filename} className="flex flex-wrap items-center gap-x-3.5 gap-y-1 py-3 border-b border-border last:border-b-0">
                      <span
                        aria-hidden="true"
                        className={`w-2.5 h-2.5 rounded-full ${i === 0 ? "bg-accent shadow-[0_0_0_4px_#2a2314]" : "bg-[#3a3b42]"}`}
                      />
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className="font-mono text-sm">{dateLabel}</span>
                        <span className="text-xs text-text-faint">{formatBytes(b.size)} · {timeAgo(b.created)}</span>
                      </div>
                      {i === 0 && !isConfirming && (
                        <span className="text-xs text-text-muted border border-border-strong rounded-full px-2.5 py-0.5">Latest</span>
                      )}
                      {isConfirming ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[13px] text-danger">Replace current collection?</span>
                          <Button variant="danger" disabled={isRestoring} onClick={() => handleRestore(b.filename)}>
                            {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
                          </Button>
                          <Button variant="ghost" onClick={() => setConfirmRestore(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button variant="ghost" disabled={!!restoring} onClick={() => setConfirmRestore(b.filename)}>
                          Restore
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>
      </main>
    </div>
  );
}
