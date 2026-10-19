import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

// ─── Shared design primitives ──────────────────────────────────────────────
// Centralizes button/input/badge styling so both pages stay visually
// consistent instead of each hand-rolling className strings.

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none whitespace-nowrap";

const sizes = {
  sm: "text-[13px] px-3 min-h-9",
  md: "text-sm px-4 min-h-11",
};

const variants = {
  primary:
    "bg-accent hover:bg-accent-hover text-accent-ink font-semibold",
  secondary:
    "border border-border-strong text-text hover:bg-surface-hover",
  soft: "border border-accent-border bg-accent-soft text-accent hover:text-accent-hover",
  ghost: "text-text-muted hover:text-text hover:bg-surface-hover",
  danger: "bg-[#2a1714] border border-[#6b2e26] text-danger hover:bg-[#3a1d18]",
  warning: "bg-warning/10 border border-warning/30 text-warning hover:bg-warning/20",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

export function IconButton({
  tone = "default",
  className = "",
  title,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "danger" | "accent";
}) {
  const toneCls = {
    default: "text-text-faint hover:bg-surface-hover hover:text-text",
    danger: "text-text-faint hover:bg-danger/10 hover:text-danger",
    accent: "text-text-faint hover:bg-accent-soft hover:text-accent",
  }[tone];
  return (
    <button
      title={title}
      aria-label={rest["aria-label"] ?? title}
      className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-lg transition-colors duration-150 ${toneCls} ${className}`}
      {...rest}
    />
  );
}

export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: "neutral" | "accent" | "warning" | "danger" | "success";
  className?: string;
  children: ReactNode;
}) {
  const toneCls = {
    neutral: "bg-white/5 border-border text-text-muted",
    accent: "bg-accent-soft border-accent-border text-accent-hover",
    warning: "bg-warning/10 border-warning/30 text-warning",
    danger: "bg-danger/10 border-danger/30 text-danger",
    success: "bg-success/10 border-success/30 text-success",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold border leading-none ${toneCls} ${className}`}
    >
      {children}
    </span>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`bg-bg border border-border-strong rounded-[10px] px-3.5 min-h-11 text-sm text-text placeholder:text-text-faint outline-none focus:border-accent transition-colors w-full ${className}`}
      {...rest}
    />
  );
}

export function Select({ className = "", ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`bg-bg border border-border-strong rounded-[10px] px-3 min-h-11 text-sm text-text outline-none focus:border-accent transition-colors w-full ${className}`}
      {...rest}
    />
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <label
      className={`flex flex-col gap-1.5 text-xs text-text-faint font-medium ${className}`}
    >
      {children}
    </label>
  );
}

export function Panel({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-surface border border-border rounded-2xl ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  icon,
  className = "",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="flex items-center gap-1.5 text-[13px] text-text-faint">
        {icon}
        {label}
      </span>
      <span className="text-2xl sm:text-[34px] leading-tight font-semibold font-mono">{value}</span>
    </div>
  );
}

export function Banner({
  tone,
  children,
  action,
}: {
  tone: "success" | "danger" | "warning" | "accent";
  children: ReactNode;
  action?: ReactNode;
}) {
  const toneCls = {
    success: "bg-[#12251c] border-[#1f4a35] text-success",
    danger: "bg-[#2a1714] border-[#6b2e26] text-danger",
    warning: "bg-warning/10 border-warning/30 text-warning",
    accent: "bg-accent-soft border-accent-border text-accent-hover",
  }[tone];
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium ${toneCls}`}
    >
      <span className="flex-1 min-w-0">{children}</span>
      {action}
    </div>
  );
}
